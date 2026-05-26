export const PARSER_SERVER_DEFAULT_PORT = 7845;
export const PARSER_SERVER_HOST = "127.0.0.1";
export const PARSER_SERVER_HEALTHCHECK_PATH = "/health";
export const PROGRESS_PATH_PREFIX = "/api/chapters/progress/";

export const buildParserServerBaseUrl = (port: number): string =>
  `http://${PARSER_SERVER_HOST}:${port}`;

export const buildParserServerHealthcheckUrl = (port: number): string =>
  `${buildParserServerBaseUrl(port)}${PARSER_SERVER_HEALTHCHECK_PATH}`;

export const ENSURE_PARSER_SERVER_MESSAGE_TYPE = "rre:ensure-parser-server";
export const RESTART_PARSER_SERVER_MESSAGE_TYPE = "rre:restart-parser-server";
export const STATUS_PARSER_SERVER_MESSAGE_TYPE = "rre:status-parser-server";
export const PROXY_IMAGE_MESSAGE_TYPE = "rre:proxy-image";
export const NATIVE_HOST_NAME = "org.remanga.parser_host";

export type ParserServerStatus =
  | { status: "ok"; port: number }
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
