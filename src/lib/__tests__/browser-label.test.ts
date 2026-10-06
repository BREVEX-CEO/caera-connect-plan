import { afterEach, describe, expect, it, vi } from "vitest";
import { browserLabel } from "../browser-install-id";

/** F-046: a phone is named for what it is. */
const as = (userAgent: string, maxTouchPoints = 0) =>
  vi.stubGlobal("navigator", { userAgent, maxTouchPoints });
afterEach(() => vi.unstubAllGlobals());

describe("the browser label", () => {
  it.each([
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      0,
      "Safari on iOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
      0,
      "Chrome on iOS",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      5,
      "Safari on iOS",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      0,
      "Safari on macOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0",
      0,
      "Edge on Windows",
    ],
  ])("%s", (userAgent, touch, label) => {
    as(userAgent, touch);
    expect(browserLabel()).toBe(label);
  });
});
