import { createHash } from "node:crypto";

export const computeExtensionIdFromKey = (base64Key: string): string => {
  const derBytes = Buffer.from(base64Key, "base64");
  const hashHex = createHash("sha256").update(derBytes).digest("hex");
  return hashHex
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (hex) =>
      String.fromCharCode(97 + Number.parseInt(hex, 16)),
    );
};
