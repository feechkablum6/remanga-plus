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

export const resolveExtensionIds = (
  keyBase64: string | null,
  explicitIds: string[],
): string[] => {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (id: string): void => {
    if (id.length === 0 || seen.has(id)) {
      return;
    }
    seen.add(id);
    ordered.push(id);
  };

  if (keyBase64 !== null && keyBase64.length > 0) {
    push(computeExtensionIdFromKey(keyBase64));
  }
  for (const id of explicitIds) {
    push(id);
  }

  if (ordered.length === 0) {
    throw new Error(
      "Installer needs at least one extension id: provide --extension-id or a manifest with a \"key\" field.",
    );
  }

  return ordered;
};
