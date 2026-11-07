/**
 * The CSP nonce of the request being rendered, for the router's own inline scripts.
 *
 * The server entry generates one random nonce per request and runs the render inside a
 * request-scoped store; the router reads it when it is created for that request. In the
 * browser there is no store, so nothing is read and no nonce is invented.
 */
let source: (() => string | undefined) | undefined;

export function setRequestNonceSource(read: () => string | undefined): void {
  source = read;
}

export function requestNonce(): string | undefined {
  return source?.();
}

/** 128 random bits, base64: the value of `'nonce-…'` in `script-src`. */
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}
