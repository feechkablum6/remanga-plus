export type ProviderResolveStatus =
  | "pending"
  | "searching"
  | "found_title"
  | "loading_chapters"
  | "parsing"
  | "success"
  | "failed";

export type ProviderProgress = {
  status: ProviderResolveStatus;
  reason?: "no_match" | "chapter_not_found" | "provider_error";
  detail?: string;
};

export type ResolveSession = {
  sessionId: string;
  providers: Record<string, ProviderProgress>;
  finalResult: unknown;
  createdAt: number;
};

export interface ResolveSessionStoreOptions {
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 60_000;

const generateId = (): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export class ResolveSessionStore {
  private readonly sessions = new Map<string, ResolveSession>();
  private readonly ttlMs: number;

  constructor(options?: ResolveSessionStoreOptions) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  }

  create(providerNames: readonly string[]): ResolveSession {
    const sessionId = generateId();
    const providers: Record<string, ProviderProgress> = {};
    for (const name of providerNames) {
      providers[name] = { status: "pending" };
    }
    const session: ResolveSession = {
      sessionId,
      providers,
      finalResult: null,
      createdAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  get(sessionId: string): ResolveSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  updateProviderStatus(
    sessionId: string,
    providerName: string,
    status: ProviderResolveStatus,
    extra?: { reason?: ProviderProgress["reason"]; detail?: string },
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const entry = session.providers[providerName];
    if (!entry) return;
    entry.status = status;
    if (extra?.reason) entry.reason = extra.reason;
    if (extra?.detail) entry.detail = extra.detail;
  }

  setFinalResult(sessionId: string, result: unknown): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.finalResult = result;
  }

  prune(now?: number): void {
    const cutoff = (now ?? Date.now()) - this.ttlMs;
    for (const [id, session] of this.sessions) {
      if (session.createdAt < cutoff) {
        this.sessions.delete(id);
      }
    }
  }
}
