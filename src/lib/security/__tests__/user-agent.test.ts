import { describe, expect, it } from "vitest";
import { describeAgent } from "@/lib/security/user-agent";

/**
 * The question this string has to answer is "is that me?".
 *
 * Every case below is a real header shape, and most of them exist because the
 * naive parser gets them wrong: every Chromium browser claims to be Chrome, and
 * Chrome claims to be Safari, so a list tested in the wrong order reports Edge,
 * Opera, Brave and Samsung Internet all as Chrome — and reports Chrome as
 * Safari. Somebody scanning their sessions for one they do not recognise is
 * then looking at four rows that all say the same wrong thing.
 */
describe("a browser is named as itself, not as what it claims to be", () => {
  const cases: [string, string][] = [
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      "Edge on Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
      "Opera on Windows",
    ],
    [
      "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
      "Samsung Internet on Android",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Chrome on Windows",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
      "Safari on macOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
      "Firefox on Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
      "Safari on iPhone",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
      "Chrome on iPhone",
    ],
    [
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Chrome on Chrome OS",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Chrome on Linux",
    ],
  ];

  for (const [agent, expected] of cases) {
    it(`reads "${expected}"`, () => {
      expect(describeAgent(agent)).toBe(expected);
    });
  }

  it("does not report an iPhone as macOS", () => {
    // iOS strings contain "like Mac OS X". Testing macOS first turns every
    // phone in the list into a desktop.
    expect(describeAgent(cases[6]![0])).not.toContain("macOS");
  });

  it("does not report Android as plain Linux", () => {
    // Every Android string also matches /Linux/.
    expect(describeAgent(cases[2]![0])).toContain("Android");
  });
});

describe("it never guesses", () => {
  it("says so rather than inventing a browser", () => {
    /*
     * The whole purpose is deciding whether to trust a session. Forcing an
     * unknown agent into the nearest match tells somebody "Safari on macOS"
     * about something that is neither, which is worse than admitting OCADE
     * cannot say.
     */
    expect(describeAgent("curl/8.4.0")).toBe("Unknown device");
    expect(describeAgent("SomeInternalTool/1.0")).toBe("Unknown device");
  });

  it("survives a missing or empty header", () => {
    for (const agent of [null, undefined, "", "   "]) {
      expect(describeAgent(agent)).toBe("Unknown device");
    }
  });

  it("names the platform alone when the browser is unrecognisable", () => {
    expect(describeAgent("SomeTool/1.0 (Windows NT 10.0)")).toBe("A browser on Windows");
  });

  it("carries no version numbers or build identifiers", () => {
    /*
     * Nobody recognises their own session by its Chrome minor version, and
     * every extra detail is a fingerprint sitting in a page and an audit log.
     */
    for (const [agent] of [
      ["Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.6099.109 Safari/537.36"],
      ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.1 Safari/605.1.15"],
    ]) {
      expect(describeAgent(agent!)).not.toMatch(/\d/);
    }
  });
});
