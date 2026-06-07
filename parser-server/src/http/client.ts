const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

const DEFAULT_TIMEOUT_MS = 15_000;

export interface HttpClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

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

export class HttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async request(url: string, init: RequestInit = {}): Promise<Response> {
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

      return response;
    } catch (error) {
      if (isAbortError(error) && timeoutController.signal.aborted && !init.signal?.aborted) {
        throw new Error(`HTTP request timed out after ${this.timeoutMs}ms: ${url}`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private buildHeaders(initHeaders: RequestInit["headers"]): Headers {
    const headers = new Headers(initHeaders);
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", DEFAULT_USER_AGENT);
    }
    return headers;
  }
}
