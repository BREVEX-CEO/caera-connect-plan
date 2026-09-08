/**
 * A USER-AGENT STRING, TURNED INTO SOMETHING A PERSON CAN RECOGNISE.
 *
 * The point of showing this at all is one question: "is that me?" A raw header
 * — `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 …` —
 * cannot answer it. "Chrome on macOS" can.
 *
 * DELIBERATELY COARSE. No version numbers, no build identifiers, no engine
 * names. Precision here buys nothing — nobody recognises their own session by
 * its Chrome minor version — and it costs something real: every extra detail is
 * a fingerprint sitting in a page and in an audit log.
 *
 * ORDER MATTERS AND IS NOT ARBITRARY. Every Chromium browser claims to be
 * Chrome, and Chrome claims to be Safari, so the more specific names have to be
 * tested first or Edge, Opera and Brave all report as Chrome. Safari is tested
 * last for the same reason, and only when Chrome has already been ruled out.
 *
 * Pure and dependency-free: a parser is worth testing exhaustively, and every
 * case here came from a real header shape.
 */

const BROWSERS: { name: string; pattern: RegExp }[] = [
  // Before Chrome: each of these carries "Chrome" in its own string.
  { name: "Edge", pattern: /\bEdg(?:e|A|iOS)?\// },
  { name: "Opera", pattern: /\bOPR\/|\bOpera\b/ },
  { name: "Samsung Internet", pattern: /\bSamsungBrowser\// },
  { name: "Firefox", pattern: /\bFirefox\/|\bFxiOS\// },
  { name: "Chrome", pattern: /\bChrome\/|\bCriOS\// },
  // Last: Chrome's string contains "Safari" too.
  { name: "Safari", pattern: /\bSafari\// },
];

const PLATFORMS: { name: string; pattern: RegExp }[] = [
  // iPad and iPhone before macOS: iPadOS reports as Macintosh in desktop mode.
  { name: "iPhone", pattern: /\biPhone\b/ },
  { name: "iPad", pattern: /\biPad\b/ },
  { name: "Android", pattern: /\bAndroid\b/ },
  { name: "Windows", pattern: /\bWindows NT\b/ },
  { name: "macOS", pattern: /\bMac OS X\b|\bMacintosh\b/ },
  // Before the generic Linux test, which every Android string also matches.
  { name: "Chrome OS", pattern: /\bCrOS\b/ },
  { name: "Linux", pattern: /\bLinux\b|\bX11\b/ },
];

/**
 * "Chrome on Windows", or the most honest thing that can be said.
 *
 * NEVER GUESSES. An unrecognised agent reports as unknown rather than being
 * forced into the nearest match: telling somebody a session is "Safari on
 * macOS" when it is neither is worse than telling them OCADE cannot say, since
 * the whole purpose is deciding whether to trust it.
 */
export function describeAgent(agent: string | null | undefined): string {
  if (!agent || !agent.trim()) return "Unknown device";

  const browser = BROWSERS.find((entry) => entry.pattern.test(agent))?.name;
  const platform = PLATFORMS.find((entry) => entry.pattern.test(agent))?.name;

  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  if (platform) return `A browser on ${platform}`;
  return "Unknown device";
}
