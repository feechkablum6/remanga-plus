const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;

const DEFAULT_RETRIABLE_STATUS = new Set([500, 502, 503, 504, 429]);

const defaultBackoff = (attempt: number): number => 200 * 2 ** (attempt - 1);

export interface HttpClientOptions {
  fetchImpl?: typeof fetch;
  userAgent?: string;
  timeoutMs?: number;
  maxRetries?: number;
  backoffMs?: (attempt: number) => number;
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

const isNetworkError = (error: unknown): boolean =>
  error instanceof TypeError;

const parseRetryAfterMs = (header: string | null): number | null => {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const timestamp = Date.parse(trimmed);
  if (Number.isFinite(timestamp)) {
    const delta = timestamp - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
};

const mergeAbortSignals = (
  externalSignal: AbortSignal | null | undefined,
  timeoutSignal: AbortSignal,
): AbortSignal => {
  if (!externalSignal) return timeoutSignal;
  const anyFn = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === "function") {
    return anyFn([externalSignal, timeoutSignal]);
  }
  const controller = new AbortController();
  const forward = (source: AbortSignal) => {
    if (source.aborted) {
      controller.abort(source.reason);
      return;
    }
    source.addEventListener("abort", () => controller.abort(source.reason), { once: true });
  };
  forward(externalSignal);
  forward(timeoutSignal);
  return controller.signal;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    setTimeout(resolve, ms);
  });

export class HttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly backoffMs: (attempt: number) => number;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.backoffMs = options.backoffMs ?? defaultBackoff;
  }

  async request(url: string, init: RequestInit = {}): Promise<Response> {
    const totalAttempts = this.maxRetries + 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      const timeoutController = new AbortController();
      const timeoutHandle = setTimeout(
        () => timeoutController.abort(new Error(`timeout_${this.timeoutMs}`)),
        this.timeoutMs,
      );

      const headers = this.buildHeaders(init.headers);
      const signal = mergeAbortSignals(init.signal, timeoutController.signal);

      try {
        const response = await this.fetchImpl(url, {
          ...init,
          headers,
          signal,
        });

        if (response.ok || !DEFAULT_RETRIABLE_STATUS.has(response.status)) {
          return response;
        }

        lastError = new Error(`HTTP ${response.status} from ${url}`);
        if (attempt >= totalAttempts) {
          throw lastError;
        }

        const retryAfterMs = parseRetryAfterMs(response.headers.get("Retry-After"));
        await sleep(retryAfterMs ?? this.backoffMs(attempt));
      } catch (error) {
        if (isAbortError(error) && timeoutController.signal.aborted && !init.signal?.aborted) {
          throw new Error(`HTTP request timed out after ${this.timeoutMs}ms: ${url}`);
        }

        if (isAbortError(error)) {
          throw error;
        }

        if (!isNetworkError(error)) {
          throw error;
        }

        lastError = error as Error;
        if (attempt >= totalAttempts) {
          throw lastError;
        }

        await sleep(this.backoffMs(attempt));
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    throw lastError ?? new Error(`HTTP request failed: ${url}`);
  }

  private buildHeaders(initHeaders: RequestInit["headers"]): Headers {
    const headers = new Headers(initHeaders);
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", this.userAgent);
    }
    return headers;
  }
}
