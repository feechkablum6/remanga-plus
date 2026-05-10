export const CHECK_AUTH_MESSAGE_TYPE = "import-mangalib/check-auth";
export const READ_MANGALIB_TOKEN_MESSAGE_TYPE = "import-mangalib/read-mangalib-token";

export interface CheckAuthRequest {
  type: typeof CHECK_AUTH_MESSAGE_TYPE;
  site: "mangalib" | "remanga";
}

export interface CheckAuthResponse {
  signedIn: boolean;
  username?: string;
}

export interface ReadMangalibTokenRequest {
  type: typeof READ_MANGALIB_TOKEN_MESSAGE_TYPE;
}

export interface ReadMangalibTokenResponse {
  token: string | null;
  userId: number | null;
}
