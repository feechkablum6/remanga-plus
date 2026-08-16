export const PARSER_SERVER_DEFAULT_PORT = 7845;
export const PARSER_SERVER_HOST = "127.0.0.1";
export const PARSER_SERVER_HEALTHCHECK_PATH = "/health";
export const PROGRESS_PATH_PREFIX = "/api/chapters/progress/";

export const buildParserServerBaseUrl = (port: number): string =>
  `http://${PARSER_SERVER_HOST}:${port}`;

export const buildParserServerHealthcheckUrl = (port: number): string =>
  `${buildParserServerBaseUrl(port)}${PARSER_SERVER_HEALTHCHECK_PATH}`;

export const PARSER_SERVER_TOKEN_HEADER = "X-Parser-Token";

/**
 * Where the extension talks to the parser: either the locally launched server
 * or a self-hosted one. `token` is empty when the server needs no auth.
 */
export type ParserServerEndpoint = {
  baseUrl: string;
  token: string;
};

export const buildLocalEndpoint = (port: number): ParserServerEndpoint => ({
  baseUrl: buildParserServerBaseUrl(port),
  token: "",
});

export const buildParserServerHeaders = (
  endpoint: Pick<ParserServerEndpoint, "token">,
): Record<string, string> =>
  endpoint.token ? { [PARSER_SERVER_TOKEN_HEADER]: endpoint.token } : {};

export const isParserServerEndpoint = (
  value: unknown,
): value is ParserServerEndpoint => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { baseUrl?: unknown; token?: unknown };
  return typeof candidate.baseUrl === "string" && typeof candidate.token === "string";
};

export const ENSURE_PARSER_SERVER_MESSAGE_TYPE = "rre:ensure-parser-server";
export const RESTART_PARSER_SERVER_MESSAGE_TYPE = "rre:restart-parser-server";
export const STATUS_PARSER_SERVER_MESSAGE_TYPE = "rre:status-parser-server";
export const PROXY_IMAGE_MESSAGE_TYPE = "rre:proxy-image";
export const READER_IMAGE_DATA_URL_MESSAGE_TYPE = "rre:reader-image-data-url";
export const NATIVE_HOST_NAME = "org.remanga.parser_host";

export type ParserServerStatus =
  | { status: "ok"; port?: number; endpoint?: ParserServerEndpoint }
  | { status: "down" };

export const isParserServerStatus = (
  value: unknown,
): value is ParserServerStatus => {
  if (!value || typeof value !== "object" || !("status" in value)) {
    return false;
  }
  const status = (value as { status: unknown }).status;
  return status === "ok" || status === "down";
};

export type ParserServerEnsureResult =
  | {
      status: "ready";
      port?: number;
      /** Absent for old cached responses; callers fall back to the local port. */
      endpoint?: ParserServerEndpoint;
    }
  | {
      status: "install_required" | "failed";
      detail?: string;
    };

export const isParserServerEnsureResult = (
  value: unknown,
): value is ParserServerEnsureResult => {
  if (!value || typeof value !== "object" || !("status" in value)) {
    return false;
  }

  const status = (value as { status?: unknown }).status;
  return status === "ready" || status === "install_required" || status === "failed";
};
