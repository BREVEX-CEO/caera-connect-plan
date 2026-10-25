/**
 * `node:buffer` for the browser: only base64 decoding of an upload, which OCADE never sends
 * through the vendored attachment service. Kept correct anyway, since it is reachable.
 */
class Base64Bytes extends Uint8Array {
  override toString(encoding?: string): string {
    if (encoding !== "base64") return new TextDecoder().decode(this);
    let binary = "";
    for (const byte of this) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
}

export const Buffer = {
  from(data: string, encoding: "base64"): Base64Bytes {
    if (encoding !== "base64") throw new Error("Only base64 is supported here.");
    let binary: string;
    try {
      binary = atob(data);
    } catch {
      binary = "";
    }
    return Base64Bytes.from(binary, (c) => c.charCodeAt(0)) as Base64Bytes;
  },
};
