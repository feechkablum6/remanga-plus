/**
 * Quality upgrades for an already-rendered Premium Free chapter.
 *
 * The server answers with whatever source replied first, then keeps looking at
 * better-ranked ones. When a better source lands, its pages replace the ones on
 * screen — silently, without moving the reader's place in the chapter.
 */

export type PremiumFreeUpgradeResponse =
  | { status: "pending" }
  | { status: "none" }
  | { status: "ready"; result: unknown };

export const UPGRADE_PATH_PREFIX = "/api/chapters/upgrade/";

const POLL_INTERVAL_MS = 1_500;
const POLL_TIMEOUT_MS = 45_000;

export type UpgradeFetchOptions = {
  baseUrl: string;
  headers: Record<string, string>;
  sessionId: string;
  signal?: AbortSignal;
};

export const fetchPremiumFreeUpgrade = async ({
  baseUrl,
  headers,
  sessionId,
  signal,
}: UpgradeFetchOptions): Promise<PremiumFreeUpgradeResponse> => {
  const response = await fetch(`${baseUrl}${UPGRADE_PATH_PREFIX}${sessionId}`, {
    headers,
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    return { status: "none" };
  }

  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("status" in body)) {
    return { status: "none" };
  }

  const status = (body as { status: unknown }).status;
  if (status === "ready") {
    return { status: "ready", result: (body as Record<string, unknown>).result };
  }
  if (status === "pending") {
    return { status: "pending" };
  }
  return { status: "none" };
};

export type PollUpgradeOptions = UpgradeFetchOptions & {
  /** Injected in tests; defaults to real timers. */
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
};

const defaultWait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls until the server says a better source is ready or that none is coming.
 * Returns null when nothing better arrived.
 */
export const pollPremiumFreeUpgrade = async (
  options: PollUpgradeOptions,
): Promise<unknown | null> => {
  const wait = options.wait ?? defaultWait;
  const now = options.now ?? (() => Date.now());
  const deadline = now() + POLL_TIMEOUT_MS;

  while (now() < deadline) {
    if (options.signal?.aborted) return null;

    let response: PremiumFreeUpgradeResponse;
    try {
      response = await fetchPremiumFreeUpgrade(options);
    } catch {
      return null;
    }

    if (response.status === "ready") return response.result;
    if (response.status === "none") return null;

    await wait(POLL_INTERVAL_MS);
  }

  return null;
};

export type ScrollAnchor = {
  /** Current window scroll offset. */
  scrollY: number;
  /** Absolute document offset of the chapter's first page, before the swap. */
  oldTop: number;
  oldHeight: number;
  newTop: number;
  newHeight: number;
};

/**
 * Where the window must land so the swap is invisible.
 *
 * - reading inside the chapter: keep the same relative position within it;
 * - already past the chapter: absorb the height difference so the content below
 *   does not jump;
 * - chapter still below the viewport: nothing to correct.
 *
 * Returns null when no scroll change is needed.
 */
export const computeScrollAfterSwap = ({
  scrollY,
  oldTop,
  oldHeight,
  newTop,
  newHeight,
}: ScrollAnchor): number | null => {
  const oldBottom = oldTop + oldHeight;

  if (scrollY < oldTop) {
    return null;
  }

  if (scrollY <= oldBottom && oldHeight > 0) {
    const ratio = (scrollY - oldTop) / oldHeight;
    const next = newTop + ratio * newHeight;
    return Math.max(0, Math.round(next));
  }

  const delta = newHeight - oldHeight;
  if (delta === 0) {
    return null;
  }
  return Math.max(0, Math.round(scrollY + delta));
};
