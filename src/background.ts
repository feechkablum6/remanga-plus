import {
  ENSURE_PARSER_SERVER_MESSAGE_TYPE,
  RESTART_PARSER_SERVER_MESSAGE_TYPE,
  STATUS_PARSER_SERVER_MESSAGE_TYPE,
  NATIVE_HOST_NAME,
  PARSER_SERVER_DEFAULT_PORT,
  PROXY_IMAGE_MESSAGE_TYPE,
  buildParserServerBaseUrl,
  buildParserServerHealthcheckUrl,
  isParserServerEnsureResult,
  type ParserServerEnsureResult,
  type ParserServerStatus,
} from "./parser-server.js";
import {
  fetchMangalibAuthStatus,
  type MangalibFetch,
  type MangalibResponse,
  type MangalibTokenProvider,
} from "./import-mangalib/mangalib-client.js";
import {
  fetchRemangaAuthStatus,
  fetchRemangaBookmarkTypes,
} from "./import-mangalib/remanga-client.js";
import {
  MANGALIB_PROXIED_FETCH_MESSAGE_TYPE,
  READ_MANGALIB_TOKEN_MESSAGE_TYPE,
  READ_REMANGA_BOOKMARK_TYPES_MESSAGE_TYPE,
  type CheckAuthRequest,
  type CheckAuthResponse,
  type MangalibProxiedFetchResponse,
  type ReadMangalibTokenResponse,
  type ReadRemangaBookmarkTypesResponse,
} from "./import-mangalib/messages.js";
import { readRemangaAuthToken } from "./premium-free.js";
import {
  resolveRemangaBookmarkTypes,
  type BookmarkType,
  type CachedBookmarkTypes,
} from "./bookmark-types-resolver.js";

const HEALTHCHECK_TIMEOUT_MS = 3_000;
const HEALTHCHECK_MAX_ATTEMPTS = 5;
const HEALTHCHECK_RETRY_DELAY_MS = 500;
const NATIVE_HOST_RESPONSE_TIMEOUT_MS = 10_000;
const READY_CACHE_TTL_MS = 5_000;

const DISCOVERED_PORT_SESSION_KEY = "rre:discoveredPort";

let readyUntil = 0;
let discoveredPort = PARSER_SERVER_DEFAULT_PORT;
let activeEnsureRequest: Promise<ParserServerEnsureResult> | null = null;

const sessionStorage = (): chrome.storage.StorageArea | null =>
  typeof chrome !== "undefined" && chrome.storage?.session
    ? chrome.storage.session
    : null;

const persistDiscoveredPort = (port: number): void => {
  const area = sessionStorage();
  if (!area) return;
  area.set({ [DISCOVERED_PORT_SESSION_KEY]: port }, () => {
    void chrome.runtime?.lastError;
  });
};

const restoreDiscoveredPort = async (): Promise<void> => {
  const area = sessionStorage();
  if (!area) return;
  await new Promise<void>((resolve) => {
    area.get(DISCOVERED_PORT_SESSION_KEY, (items) => {
      const stored = items?.[DISCOVERED_PORT_SESSION_KEY];
      if (typeof stored === "number" && Number.isInteger(stored) && stored > 0) {
        discoveredPort = stored;
      }
      resolve();
    });
  });
};

void restoreDiscoveredPort();

type HealthcheckResult = {
  healthy: boolean;
  url: string;
  statusCode?: number;
  bodyStatus?: unknown;
  error?: string;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;

  return new Promise<T>((resolve, reject) => {
    timeoutHandle = globalThis.setTimeout(() => {
      reject(new Error("Parser-server healthcheck timed out."));
    }, timeoutMs);

    promise.then(
      (value) => {
        if (timeoutHandle !== null) {
          globalThis.clearTimeout(timeoutHandle);
        }
        resolve(value);
      },
      (error) => {
        if (timeoutHandle !== null) {
          globalThis.clearTimeout(timeoutHandle);
        }
        reject(error);
      },
    );
  });
};

const delay = (timeoutMs: number): Promise<void> =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, timeoutMs);
  });

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const extractPort = (result: ParserServerEnsureResult): number =>
  result.status === "ready" && typeof result.port === "number"
    ? result.port
    : PARSER_SERVER_DEFAULT_PORT;

const performParserServerHealthcheck = async (
  port: number,
  fetchImpl: typeof fetch,
): Promise<HealthcheckResult> => {
  const url = buildParserServerHealthcheckUrl(port);

  try {
    const response = await withTimeout(
      fetchImpl(url, {
        method: "GET",
        cache: "no-store",
      }),
      HEALTHCHECK_TIMEOUT_MS,
    );
    const result: HealthcheckResult = {
      healthy: false,
      url,
      statusCode: response.status,
    };

    if (!response.ok) {
      return result;
    }

    const body: unknown = await response.json();
    const bodyStatus =
      body !== null && typeof body === "object" && "status" in body
        ? (body as { status: unknown }).status
        : undefined;
    return {
      healthy: bodyStatus === "ok",
      url,
      statusCode: response.status,
      bodyStatus,
    };
  } catch (error) {
    return {
      healthy: false,
      url,
      error: describeError(error),
    };
  }
};

export const checkParserServerHealth = async (
  port: number = discoveredPort,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> => {
  const result = await performParserServerHealthcheck(port, fetchImpl);
  return result.healthy;
};

const pollParserServerHealth = async (
  port: number,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> => {
  for (let attempt = 1; attempt <= HEALTHCHECK_MAX_ATTEMPTS; attempt += 1) {
    const result = await performParserServerHealthcheck(port, fetchImpl);
    if (result.error) {
      console.warn("[RRE] Parser-server healthcheck failed.", {
        attempt,
        maxAttempts: HEALTHCHECK_MAX_ATTEMPTS,
        port,
        url: result.url,
        error: result.error,
      });
    } else {
      console.warn("[RRE] Parser-server healthcheck result.", {
        attempt,
        maxAttempts: HEALTHCHECK_MAX_ATTEMPTS,
        port,
        url: result.url,
        statusCode: result.statusCode,
        bodyStatus: result.bodyStatus,
        healthy: result.healthy,
      });
    }

    if (result.healthy) {
      return true;
    }

    if (attempt < HEALTHCHECK_MAX_ATTEMPTS) {
      await delay(HEALTHCHECK_RETRY_DELAY_MS * attempt);
    }
  }

  return false;
};

const isMissingNativeHostError = (message: string): boolean =>
  /native messaging host/i.test(message) &&
  /(not found|not registered|not allowed|не найден|не зарегистрирован)/i.test(message);

const sendNativeEnsureMessage = async (): Promise<ParserServerEnsureResult> => {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendNativeMessage) {
    return {
      status: "failed",
      detail: "Native Messaging API недоступен.",
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeout = globalThis.setTimeout(() => {
      settled = true;
      resolve({
        status: "failed",
        detail: "Native host did not answer in time.",
      });
    }, NATIVE_HOST_RESPONSE_TIMEOUT_MS);

    chrome.runtime.sendNativeMessage(
      NATIVE_HOST_NAME,
      { type: "ensure-parser-server" },
      (response: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timeout);

        const runtimeError = chrome.runtime?.lastError?.message;
        if (runtimeError) {
          resolve({
            status: isMissingNativeHostError(runtimeError)
              ? "install_required"
              : "failed",
            detail: runtimeError,
          });
          return;
        }

        if (!isParserServerEnsureResult(response)) {
          resolve({
            status: "failed",
            detail: "Native host returned an invalid response.",
          });
          return;
        }

        resolve(response);
      },
    );
  });
};

export const ensureParserServer = async (): Promise<ParserServerEnsureResult> => {
  if (readyUntil > Date.now() && (await checkParserServerHealth(discoveredPort))) {
    return { status: "ready", port: discoveredPort };
  }

  if (activeEnsureRequest) {
    return activeEnsureRequest;
  }

  activeEnsureRequest = (async () => {
    if (await checkParserServerHealth(discoveredPort)) {
      readyUntil = Date.now() + READY_CACHE_TTL_MS;
      return { status: "ready", port: discoveredPort } as const;
    }

    if (
      discoveredPort !== PARSER_SERVER_DEFAULT_PORT &&
      (await checkParserServerHealth(PARSER_SERVER_DEFAULT_PORT))
    ) {
      discoveredPort = PARSER_SERVER_DEFAULT_PORT;
      persistDiscoveredPort(discoveredPort);
      readyUntil = Date.now() + READY_CACHE_TTL_MS;
      return { status: "ready", port: discoveredPort } as const;
    }

    const nativeResult = await sendNativeEnsureMessage();
    console.warn("[RRE] Native host ensure-parser-server response.", nativeResult);
    if (nativeResult.status !== "ready") {
      return nativeResult;
    }

    discoveredPort = extractPort(nativeResult);
    persistDiscoveredPort(discoveredPort);
    readyUntil = Date.now() + READY_CACHE_TTL_MS;
    return { status: "ready", port: discoveredPort } as const;
  })();

  try {
    return await activeEnsureRequest;
  } finally {
    activeEnsureRequest = null;
  }
};

const handleProxyImage = async (
  proxyPath: string,
): Promise<{ data: string; contentType: string } | { error: string }> => {
  const url = `${buildParserServerBaseUrl(discoveredPort)}${proxyPath}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const base64 = btoa(
      new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""),
    );
    return { data: `data:${contentType};base64,${base64}`, contentType };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

async function sendWithBridgeFallback<T>(
  tabId: number,
  bridgeFile: string,
  message: unknown,
): Promise<T | undefined> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T | undefined;
  } catch {
    // No content script yet (stale tab loaded before extension install/reload).
    // Inject the bridge file on-demand and retry once.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [bridgeFile],
      });
      return (await chrome.tabs.sendMessage(tabId, message)) as T | undefined;
    } catch {
      return undefined;
    }
  }
}

const REMANGA_BOOKMARK_TYPES_CACHE_KEY = "remangaBookmarkTypesCache";
const REMANGA_BOOKMARKS_URL = "https://remanga.org/user/bookmarks";
const HOME_BOOKMARK_DIRS_CACHE_KEY = "rre:homeBookmarkDirs:v2";
const HOME_BOOKMARK_DIRS_CACHE_TTL_MS = 30 * 60 * 1000;
const LOAD_HOME_BOOKMARKS_MESSAGE_TYPE = "rre/load-home-bookmarks";
const HIDDEN_TAB_POLL_DEADLINE_MS = 15_000;
const HIDDEN_TAB_POLL_INTERVAL_MS = 500;

type HomeBookmarkCategoryKey =
  | "reading"
  | "planned"
  | "completed"
  | "dropped"
  | "notInterest"
  | "favorite";

const DEFAULT_HOME_BOOKMARK_CATEGORY_KEY: HomeBookmarkCategoryKey = "reading";

type HomeBookmarkDirs = Record<string, HomeBookmarkCategoryKey[]>;

type CachedHomeBookmarkDirs = {
  dirs: HomeBookmarkDirs;
  userId: number;
  updatedAt: number;
};

function extractHomeBookmarkNextPage(next: unknown, currentPage: number): number | null {
  if (typeof next === "number") {
    return Number.isInteger(next) && next > currentPage ? next : null;
  }

  if (typeof next !== "string" || next.length === 0) {
    return null;
  }

  try {
    const url = new URL(next, "https://api.remanga.org");
    const page = Number(url.searchParams.get("page"));
    return Number.isInteger(page) && page > currentPage ? page : null;
  } catch {
    return null;
  }
}

const HOME_BOOKMARK_CATEGORY_NAMES: ReadonlyArray<{
  name: string;
  key: HomeBookmarkCategoryKey;
}> = [
  { name: "Читаю", key: "reading" },
  { name: "Буду читать", key: "planned" },
  { name: "Прочитано", key: "completed" },
  { name: "Брошено", key: "dropped" },
  { name: "Не интересно", key: "notInterest" },
  { name: "Любимое", key: "favorite" },
];

async function readRemangaTypesFromExistingTabs(): Promise<BookmarkType[]> {
  const allTabs = await chrome.tabs.query({});
  const tabs = allTabs.filter(
    (t) => typeof t.url === "string" && t.url.startsWith("https://remanga.org/"),
  );
  for (const tab of tabs) {
    if (typeof tab.id !== "number") continue;
    const resp = await sendWithBridgeFallback<ReadRemangaBookmarkTypesResponse>(
      tab.id,
      "remanga-bridge.js",
      { type: READ_REMANGA_BOOKMARK_TYPES_MESSAGE_TYPE },
    );
    if (resp && Array.isArray(resp.types) && resp.types.length > 0) {
      return resp.types;
    }
  }
  return [];
}

async function readRemangaTypesCache(): Promise<CachedBookmarkTypes | null> {
  const area = chrome.storage?.local;
  if (!area) return null;
  return await new Promise<CachedBookmarkTypes | null>((resolve) => {
    area.get(REMANGA_BOOKMARK_TYPES_CACHE_KEY, (items) => {
      void chrome.runtime?.lastError;
      const raw = items?.[REMANGA_BOOKMARK_TYPES_CACHE_KEY] as
        | { types?: unknown; updatedAt?: unknown }
        | undefined;
      if (!raw || !Array.isArray(raw.types) || typeof raw.updatedAt !== "number") {
        resolve(null);
        return;
      }
      const types: BookmarkType[] = [];
      for (const t of raw.types) {
        if (
          t &&
          typeof (t as BookmarkType).typeId === "number" &&
          typeof (t as BookmarkType).name === "string"
        ) {
          types.push({ typeId: (t as BookmarkType).typeId, name: (t as BookmarkType).name });
        }
      }
      resolve({ types, updatedAt: raw.updatedAt });
    });
  });
}

async function writeRemangaTypesCache(types: BookmarkType[]): Promise<void> {
  const area = chrome.storage?.local;
  if (!area) return;
  const payload: CachedBookmarkTypes = { types, updatedAt: Date.now() };
  await new Promise<void>((resolve) => {
    area.set({ [REMANGA_BOOKMARK_TYPES_CACHE_KEY]: payload }, () => {
      void chrome.runtime?.lastError;
      resolve();
    });
  });
}

async function readRemangaTypesViaHiddenTab(): Promise<BookmarkType[]> {
  let tabId: number | undefined;
  try {
    const tab = await chrome.tabs.create({ url: REMANGA_BOOKMARKS_URL, active: false });
    if (typeof tab.id !== "number") return [];
    tabId = tab.id;
    const deadline = Date.now() + HIDDEN_TAB_POLL_DEADLINE_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, HIDDEN_TAB_POLL_INTERVAL_MS));
      const resp = await sendWithBridgeFallback<ReadRemangaBookmarkTypesResponse>(
        tabId,
        "remanga-bridge.js",
        { type: READ_REMANGA_BOOKMARK_TYPES_MESSAGE_TYPE },
      );
      if (resp && Array.isArray(resp.types) && resp.types.length > 0) {
        return resp.types;
      }
    }
    return [];
  } catch {
    return [];
  } finally {
    if (typeof tabId === "number") {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        void chrome.runtime?.lastError;
      }
    }
  }
}

async function getMangalibTokenViaBridge(): Promise<ReadMangalibTokenResponse & { reason?: "no-tab" | "no-token" }> {
  const allTabs = await chrome.tabs.query({});
  const tabs = allTabs.filter((t) => typeof t.url === "string" && t.url.startsWith("https://mangalib.me/"));
  if (tabs.length === 0) return { token: null, userId: null, reason: "no-tab" };
  for (const tab of tabs) {
    if (typeof tab.id !== "number") continue;
    const response = await sendWithBridgeFallback<ReadMangalibTokenResponse>(
      tab.id,
      "mangalib-bridge.js",
      { type: READ_MANGALIB_TOKEN_MESSAGE_TYPE },
    );
    if (response && response.token) return response;
  }
  return { token: null, userId: null, reason: "no-token" };
}

const mangalibTokenProvider: MangalibTokenProvider = async () => getMangalibTokenViaBridge();

const mangalibBridgeFetch: MangalibFetch = async (url, headers): Promise<MangalibResponse> => {
  const allTabs = await chrome.tabs.query({});
  const tabs = allTabs.filter((t) => typeof t.url === "string" && t.url.startsWith("https://mangalib.me/"));
  for (const tab of tabs) {
    if (typeof tab.id !== "number") continue;
    const resp = await sendWithBridgeFallback<MangalibProxiedFetchResponse>(
      tab.id,
      "mangalib-bridge.js",
      { type: MANGALIB_PROXIED_FETCH_MESSAGE_TYPE, url, headers },
    );
    if (resp && resp.ok) {
      const body = resp.body;
      return {
        status: resp.status,
        ok: resp.httpOk,
        json: async () => JSON.parse(body) as unknown,
      };
    }
  }
  throw new Error("mangalib bridge unreachable");
};

async function getRemangaToken(): Promise<string | null> {
  const cookies = await chrome.cookies.getAll({ url: "https://remanga.org/" });
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return readRemangaAuthToken(cookieHeader);
}

async function readHomeBookmarkDirsCache(): Promise<CachedHomeBookmarkDirs | null> {
  const area = chrome.storage?.local;
  if (!area) return null;
  return await new Promise<CachedHomeBookmarkDirs | null>((resolve) => {
    area.get(HOME_BOOKMARK_DIRS_CACHE_KEY, (items) => {
      void chrome.runtime?.lastError;
      const raw = items?.[HOME_BOOKMARK_DIRS_CACHE_KEY] as
        | CachedHomeBookmarkDirs
        | undefined;
      if (
        !raw ||
        typeof raw.updatedAt !== "number" ||
        typeof raw.userId !== "number" ||
        !raw.dirs ||
        typeof raw.dirs !== "object"
      ) {
        resolve(null);
        return;
      }
      resolve(raw);
    });
  });
}

async function writeHomeBookmarkDirsCache(payload: CachedHomeBookmarkDirs): Promise<void> {
  const area = chrome.storage?.local;
  if (!area) return;
  await new Promise<void>((resolve) => {
    area.set({ [HOME_BOOKMARK_DIRS_CACHE_KEY]: payload }, () => {
      void chrome.runtime?.lastError;
      resolve();
    });
  });
}

async function loadHomeBookmarkDirs(): Promise<HomeBookmarkDirs> {
  const cached = await readHomeBookmarkDirsCache();
  if (cached && Date.now() - cached.updatedAt < HOME_BOOKMARK_DIRS_CACHE_TTL_MS) {
    return cached.dirs;
  }

  const token = await getRemangaToken();
  if (!token) return cached?.dirs ?? {};

  const auth = await fetchRemangaAuthStatus(async () => token);
  if (!auth.signedIn || typeof auth.userId !== "number") {
    return cached?.dirs ?? {};
  }

  const categoryByTypeId = new Map<number, HomeBookmarkCategoryKey>();
  const categoryByName = new Map(
    HOME_BOOKMARK_CATEGORY_NAMES.map((category) => [
      category.name.toLowerCase(),
      category.key,
    ]),
  );

  const types = await fetchRemangaBookmarkTypes(async () => token);
  for (const type of types) {
    const category = categoryByName.get(type.name.toLowerCase());
    if (category) categoryByTypeId.set(type.id, category);
  }

  const dirs: HomeBookmarkDirs = {};
  let page = 1;
  for (;;) {
    const url = new URL(`https://api.remanga.org/api/v2/users/${auth.userId}/bookmarks/`);
    url.searchParams.set("page", String(page));
    const response = await fetch(url.toString(), {
      credentials: "omit",
      headers: {
        Authorization: "bearer " + token,
        Accept: "application/json",
      },
    });
    if (!response.ok) break;
    const body = (await response.json()) as {
      next?: unknown;
      results?: Array<{
        title?: { dir?: unknown };
        type?: unknown;
        bookmark_type_id?: unknown;
      }>;
    };
    if (!body || !Array.isArray(body.results)) break;

    for (const row of body.results) {
      const dir = row.title?.dir;
      const typeId = row.type ?? row.bookmark_type_id;
      if (typeof dir !== "string" || typeof typeId !== "number") continue;
      const category = categoryByTypeId.get(typeId) ?? DEFAULT_HOME_BOOKMARK_CATEGORY_KEY;
      dirs[dir] ??= [];
      if (!dirs[dir].includes(category)) {
        dirs[dir].push(category);
      }
    }

    const nextPage = extractHomeBookmarkNextPage(body.next, page);
    if (nextPage === null) break;
    page = nextPage;
  }

  await writeHomeBookmarkDirsCache({
    dirs,
    userId: auth.userId,
    updatedAt: Date.now(),
  });
  return dirs;
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== "object" || !("type" in message)) {
      return false;
    }

    if (message.type === ENSURE_PARSER_SERVER_MESSAGE_TYPE) {
      void ensureParserServer().then(sendResponse);
      return true;
    }

    if (
      message.type === PROXY_IMAGE_MESSAGE_TYPE &&
      "proxyPath" in message &&
      typeof (message as { proxyPath: unknown }).proxyPath === "string"
    ) {
      void handleProxyImage(
        (message as { proxyPath: string }).proxyPath,
      ).then(sendResponse);
      return true;
    }

    if (message.type === RESTART_PARSER_SERVER_MESSAGE_TYPE) {
      readyUntil = 0;
      activeEnsureRequest = null;
      void ensureParserServer().then(sendResponse);
      return true;
    }

    if (message.type === STATUS_PARSER_SERVER_MESSAGE_TYPE) {
      void (async () => {
        await restoreDiscoveredPort();
        const healthy = await checkParserServerHealth(discoveredPort);
        const result: ParserServerStatus = healthy
          ? { status: "ok", port: discoveredPort }
          : { status: "down" };
        sendResponse(result);
      })();
      return true;
    }

    if (message.type === LOAD_HOME_BOOKMARKS_MESSAGE_TYPE) {
      void loadHomeBookmarkDirs().then((dirs) => sendResponse({ dirs }));
      return true;
    }

    if (message.type === READ_MANGALIB_TOKEN_MESSAGE_TYPE) {
      void getMangalibTokenViaBridge().then((r) => sendResponse(r));
      return true;
    }

    if (message.type === READ_REMANGA_BOOKMARK_TYPES_MESSAGE_TYPE) {
      void (async () => {
        const types = await resolveRemangaBookmarkTypes({
          readFromExistingTabs: readRemangaTypesFromExistingTabs,
          readCached: readRemangaTypesCache,
          writeCached: writeRemangaTypesCache,
          openHiddenTabAndRead: readRemangaTypesViaHiddenTab,
          now: () => Date.now(),
        });
        sendResponse({ types } satisfies ReadRemangaBookmarkTypesResponse);
      })();
      return true;
    }

    if (message.type === MANGALIB_PROXIED_FETCH_MESSAGE_TYPE) {
      void (async () => {
        const allTabs = await chrome.tabs.query({});
        const tabs = allTabs.filter(
          (t) => typeof t.url === "string" && t.url.startsWith("https://mangalib.me/"),
        );
        for (const tab of tabs) {
          if (typeof tab.id !== "number") continue;
          try {
            const resp = await chrome.tabs.sendMessage(tab.id, message);
            if (resp) {
              sendResponse(resp);
              return;
            }
          } catch {
            continue;
          }
        }
        sendResponse({ ok: false, error: "no mangalib tab" } satisfies MangalibProxiedFetchResponse);
      })();
      return true;
    }

    if (message.type === "import-mangalib/check-auth") {
      const site = (message as CheckAuthRequest).site;
      const origins =
        site === "mangalib"
          ? ["https://mangalib.me/*", "https://api.cdnlibs.org/*"]
          : ["https://remanga.org/*", "https://api.remanga.org/*"];
      void (async () => {
        let hasPerm = true;
        try {
          hasPerm = await chrome.permissions.contains({ origins });
        } catch {
          hasPerm = false;
        }
        if (!hasPerm) {
          sendResponse({ signedIn: false, reason: "no-permission" });
          return;
        }
        try {
          const status =
            site === "mangalib"
              ? await fetchMangalibAuthStatus(mangalibTokenProvider, mangalibBridgeFetch)
              : await fetchRemangaAuthStatus(getRemangaToken);
          sendResponse(status as CheckAuthResponse);
        } catch {
          sendResponse({ signedIn: false, reason: "network" });
        }
      })();
      return true;
    }

    return false;
  });
}
