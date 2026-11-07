/**
 * Locally-generated, random Browser Installation ID.
 *
 * Per plan §6, we do NOT fingerprint the browser. Each browser install gets a
 * random UUID stored in that browser's localStorage. If the user clears
 * storage, they re-pair — no cross-browser correlation, no PII.
 */

// The original product name stays in the key so existing installs keep their ID.
const KEY = "caera.browser_install_id";

export function getBrowserInstallId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Best-effort desktop / mobile classification for device registration.
 * Not fingerprinting — a coarse form factor guess only.
 */
export function guessDeviceKind(): "desktop" | "mobile" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Best-effort browser label from UA (for display only — user can rename).
 */
export function browserLabel(): string {
  if (typeof navigator === "undefined") return "This browser";
  const ua = navigator.userAgent || "";
  let browser = "Browser";
  if (/Edg(?:iOS|A)?\//.test(ua)) browser = "Edge";
  else if (/(?:Chrome|CriOS)\//.test(ua)) browser = "Chrome";
  else if (/(?:Firefox|FxiOS)\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = "";
  // iOS first: every iPhone says "like Mac OS X", and an iPad asking for the
  // desktop site says Macintosh but has a touch screen (F-046).
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    os = "iOS";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Linux/.test(ua)) os = "Linux";
  return os ? `${browser} on ${os}` : browser;
}
