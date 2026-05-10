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
  type MangalibTokenProvider,
} from "./import-mangalib/mangalib-client.js";
import { fetchRemangaAuthStatus } from "./import-mangalib/remanga-client.js";
import {
  READ_MANGALIB_TOKEN_MESSAGE_TYPE,
  type CheckAuthRequest,
  type CheckAuthResponse,
  type ReadMangalibTokenResponse,
} from "./import-mangalib/messages.js";
import { readRemangaAuthToken } from "./premium-free.js";

const HEALTHCHECK_TIMEOUT_MS = 3_000;
const HEALTHCHECK_MAX_ATTEMPTS = 5;
const HEALTHCHECK_RETRY_DELAY_MS = 500;
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
    chrome.runtime.sendNativeMessage(
      NATIVE_HOST_NAME,
      { type: "ensure-parser-server" },
      (response: unknown) => {
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

    const nativeResult = await sendNativeEnsureMessage();
    console.warn("[RRE] Native host ensure-parser-server response.", nativeResult);
    if (nativeResult.status !== "ready") {
      return nativeResult;
    }

    discoveredPort = extractPort(nativeResult);
    persistDiscoveredPort(discoveredPort);

    if (await pollParserServerHealth(discoveredPort)) {
      readyUntil = Date.now() + READY_CACHE_TTL_MS;
      return { status: "ready", port: discoveredPort } as const;
    }

    console.error("[RRE] Parser-server remained unhealthy after native launch.", {
      port: discoveredPort,
      url: buildParserServerHealthcheckUrl(discoveredPort),
      nativeResult,
    });
    return {
      status: "failed",
      detail: "Parser-server did not become healthy after launch.",
    } as const;
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

async function getMangalibTokenViaBridge(): Promise<ReadMangalibTokenResponse> {
  const tabs = await chrome.tabs.query({ url: "https://mangalib.me/*" });
  for (const tab of tabs) {
    if (typeof tab.id !== "number") continue;
    try {
      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: READ_MANGALIB_TOKEN_MESSAGE_TYPE,
      })) as ReadMangalibTokenResponse;
      if (response && (response.token || response.token === null)) return response;
    } catch {
      continue;
    }
  }
  return { token: null, userId: null };
}

const mangalibTokenProvider: MangalibTokenProvider = async () => getMangalibTokenViaBridge();

async function getRemangaToken(): Promise<string | null> {
  const cookies = await chrome.cookies.getAll({ url: "https://remanga.org/" });
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return readRemangaAuthToken(cookieHeader);
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

    if (message.type === "import-mangalib/check-auth") {
      const site = (message as CheckAuthRequest).site;
      const action =
        site === "mangalib"
          ? fetchMangalibAuthStatus(mangalibTokenProvider)
          : fetchRemangaAuthStatus(getRemangaToken);
      action
        .then((status) => sendResponse(status as CheckAuthResponse))
        .catch(() => sendResponse({ signedIn: false }));
      return true;
    }

    return false;
  });
}
