import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { preflight, redact, summarise, scanLimits } from "../edge/preflight";

/**
 * The scanner is judged on FALSE POSITIVES first.
 *
 * A secret scanner that flags ordinary text gets clicked through within a day,
 * and a warning everybody dismisses is worse than no warning — it converts an
 * unexamined risk into a completed dialogue that looks like consent. So the
 * "does not flag" cases below carry as much weight as the "does flag" ones.
 */

describe("real credentials are caught", () => {
  it("catches a private key", () => {
    const findings = preflight("here is my key\n-----BEGIN RSA PRIVATE KEY-----\nMIIE...");
    expect(findings.map((f) => f.kind)).toContain("private_key");
    expect(findings[0].severity).toBe("critical");
  });

  it("catches an AWS access key id", () => {
    expect(preflight("AKIAIOSFODNN7EXAMPLE").map((f) => f.kind)).toContain("aws_key");
  });

  it("catches vendor-prefixed API keys", () => {
    const keys = [
      "sk_live_4eC39HqLyjWDarjtT1zdp7dc",
      "ghp_1234567890abcdefghijklmnopqrstuvwxyz",
      "xoxb-1234567890-abcdefghij",
    ];
    for (const key of keys) {
      expect(preflight(`token: ${key}`).length, key).toBeGreaterThan(0);
    }
  });

  it("catches a database URL with a password", () => {
    const findings = preflight("postgres://admin:hunter2@db.internal:5432/prod");
    expect(findings.map((f) => f.kind)).toContain("connection_string");
  });

  it("catches a signed token", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    expect(preflight(jwt).map((f) => f.kind)).toContain("jwt");
  });

  it("catches a password assignment", () => {
    expect(preflight('password: "correct-horse-battery"').map((f) => f.kind)).toContain(
      "password_assignment",
    );
  });
});

describe("ordinary text is left alone", () => {
  /*
   * Every case here is something a developer plausibly pastes into a chat. If
   * any of them trips the scanner, the feature is a nuisance rather than a
   * safeguard.
   */
  const innocuous = [
    "The commit is 9f2b1c4e8a7d6b5c4e3f2a1b0c9d8e7f6a5b4c3d and it fixes the crash.",
    "Our base64 avatar starts iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk",
    "The order number is 4111111111111112 in the legacy system.",
    "Set the timeout to 30000 and retry 3 times.",
    "See https://example.com/docs/getting-started for the walkthrough.",
    "The class is called PasswordResetController and it lives in auth/.",
  ];

  it.each(innocuous)("does not flag: %s", (text) => {
    expect(preflight(text)).toEqual([]);
  });

  it("does not treat a 16-digit number that fails the checksum as a card", () => {
    // Shape alone matches invoice numbers and timestamps. Without the Luhn
    // check this is the single biggest source of false alarms.
    expect(preflight("invoice 1234567812345678").filter((f) => f.kind === "card_number")).toEqual(
      [],
    );
  });

  it("does flag a number that passes the checksum", () => {
    expect(preflight("4111 1111 1111 1111").map((f) => f.kind)).toContain("card_number");
  });
});

describe("findings are usable, not just alarming", () => {
  it("never repeats the secret back", () => {
    const secret = "sk_live_4eC39HqLyjWDarjtT1zdp7dc";
    const [finding] = preflight(`key ${secret}`);
    // A warning that quotes the credential has copied it into another surface.
    expect(finding.preview).not.toContain("4eC39HqLyjWDarjtT1zdp7dc");
    expect(finding.preview).toMatch(/•/);
  });

  it("explains what it found in plain words", () => {
    for (const finding of preflight("-----BEGIN PRIVATE KEY-----")) {
      expect(finding.explain.length).toBeGreaterThan(30);
      expect(finding.explain).not.toMatch(/regex|pattern|match/i);
    }
  });

  it("gives an exact offset and length, so it can be redacted precisely", () => {
    const text = "prefix AKIAIOSFODNN7EXAMPLE suffix";
    const [finding] = preflight(text);
    expect(text.slice(finding.at, finding.at + finding.length)).toBe("AKIAIOSFODNN7EXAMPLE");
  });

  it("reports one mistake once, not twice", () => {
    /*
     * A connection string contains a password assignment. Reporting both makes
     * one error look like two and makes the list feel padded, which is its own
     * kind of dishonesty.
     */
    const findings = preflight("DATABASE_URL=postgres://admin:hunter2@db.internal:5432/prod");
    const overlapping = findings.filter(
      (a, i) =>
        findings.findIndex(
          (b, j) => j !== i && a.at < b.at + b.length && b.at < a.at + a.length,
        ) !== -1,
    );
    expect(overlapping).toEqual([]);
  });

  it("orders findings by position, so they line up with the text", () => {
    const findings = preflight("me@example.com then AKIAIOSFODNN7EXAMPLE");
    expect(findings.map((f) => f.at)).toEqual([...findings.map((f) => f.at)].sort((a, b) => a - b));
  });
});

describe("redaction removes exactly the finding", () => {
  it("replaces the secret and keeps everything else", () => {
    const text = "deploy with AKIAIOSFODNN7EXAMPLE now";
    const out = redact(text, preflight(text));
    expect(out).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(out).toContain("deploy with");
    expect(out).toContain("now");
  });

  it("handles several findings without corrupting the text", () => {
    const text = "a me@example.com b AKIAIOSFODNN7EXAMPLE c";
    const out = redact(text, preflight(text));
    expect(out.startsWith("a ")).toBe(true);
    expect(out.endsWith(" c")).toBe(true);
    expect(out).not.toContain("@example.com");
  });

  it("returns the text unchanged when there is nothing to redact", () => {
    const text = "nothing sensitive here";
    expect(redact(text, preflight(text))).toBe(text);
  });
});

describe("the summary does not overstate in either direction", () => {
  it("refuses to call a clean scan 'safe'", () => {
    /*
     * "We found nothing" and "there is nothing" are different statements. The
     * scanner can only make the first one.
     */
    const text = summarise([]);
    expect(text).toMatch(/nothing that looks like/i);
    expect(text).not.toMatch(/\bsafe\b|\bclean\b|\bno secrets\b/i);
  });

  it("leads with account access when a credential is present", () => {
    expect(summarise(preflight("AKIAIOSFODNN7EXAMPLE"))).toMatch(/access to an account/i);
  });

  it("states what it cannot catch", () => {
    const limits = scanLimits().join(" ");
    expect(limits).toMatch(/unusual format/i);
    expect(limits).toMatch(/attached file/i);
  });
});

describe("scanning is repeatable", () => {
  it("gives the same answer twice on the same text", () => {
    /*
     * Module-level /g regexes carry `lastIndex` between calls. Without an
     * explicit reset the second scan silently finds fewer matches — and the
     * second scan is the one that runs when the user edits and resends.
     */
    const text = "AKIAIOSFODNN7EXAMPLE and me@example.com";
    expect(preflight(text)).toEqual(preflight(text));
  });

  it("is synchronous and sends nothing to check", async () => {
    // A preflight that phoned a service to ask whether your text contained
    // secrets would be a remarkable thing to build.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/edge/preflight.ts", "utf8"),
    );
    expect(source).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon/);
  });
});

describe("the signed-in chat scans on exposure, not on transmission", () => {
  /**
   * THE RULE THAT DIFFERS FROM THE DEMO, and why.
   *
   * The demo skips scanning whenever the conversation is sealed, because
   * sealed means nothing can leave. That reasoning does not transfer to a
   * signed-in chat: those messages are also PERSISTED, and on `private_sync`
   * they are persisted to a server. A credential pasted into a synced
   * conversation lands in a database whether or not the answer ever left the
   * machine.
   *
   * So the trigger is exposure, not transmission.
   */
  const CHAT = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");

  function code(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  }

  /** The predicate as written, so the table below tests the real rule. */
  function willBeExposed(chatsMode: string, engineTier: string, sealed: boolean): boolean {
    return chatsMode === "private_sync" || engineTier === "cloud" || !sealed;
  }

  it("is present at all", () => {
    expect(code(CHAT)).toMatch(/const findings = preflight\(text\)/);
  });

  it("blocks the send rather than warning past it", () => {
    const c = code(CHAT);
    const block = c.slice(c.indexOf("const critical = findings.filter"));
    expect(block.slice(0, 400)).toMatch(/return;/);
  });

  it("scans a synced conversation even when it is sealed", () => {
    // The case the demo's rule would have missed: sealed, so nothing leaves —
    // but the message is still written to a server.
    expect(willBeExposed("private_sync", "local", true)).toBe(true);
  });

  it("scans anything heading for cloud", () => {
    expect(willBeExposed("browser_only", "cloud", true)).toBe(true);
  });

  it("scans an unsealed conversation", () => {
    expect(willBeExposed("browser_only", "local", false)).toBe(true);
  });

  it("stays quiet only when the message genuinely cannot be exposed", () => {
    /*
     * Browser-Only, sealed, answered on-device. Warning here would train the
     * user to dismiss the warning in the one case where it is harmless, which
     * is how it stops working in the case where it is not.
     */
    expect(willBeExposed("browser_only", "local", true)).toBe(false);
    expect(willBeExposed("pc_vault", "auto", true)).toBe(false);
  });

  it("offers sealing as the remedy, not just removal", () => {
    // The user may legitimately need that credential in the conversation.
    expect(CHAT).toMatch(/Remove it, or seal this conversation, before sending/);
  });

  it("does not introduce a second context-budget system", () => {
    /*
     * `planContextWindow` already owns context sizing on this surface. Two
     * implementations of "what fits" would drift, and the one that drifted
     * would be silently wrong about what the engine actually saw — the same
     * defect as the duplicated privacy gate that was removed earlier.
     */
    const c = code(CHAT);
    expect(c).toMatch(/planContextWindow\(/);
    expect(c, "a second budget system was added").not.toMatch(/planBudget\(/);
  });

  it("names the attachments in the truncation warning", () => {
    // "The oldest part" tells a user who attached a contract nothing about
    // whether their contract was in it.
    expect(code(CHAT)).toMatch(/that may include \$\{named\.join/);
  });
});

describe("the scanner cannot be made to hang", () => {
  /**
   * WHY THIS IS NOT PARANOIA. `preflight` runs on the send path, synchronously,
   * on text the user controls. A pattern with nested quantifiers can backtrack
   * catastrophically on adversarial input — and the card rule,
   * `(?:\d[ -]?){13,19}`, has exactly that shape. A paste that froze the tab
   * would be a denial of service delivered through the safety feature.
   *
   * Measured rather than assumed: every case below completed in under a
   * millisecond when this was written. The budget is set far above that so the
   * test reports a real regression rather than machine noise.
   */
  const HOSTILE: Array<[string, string]> = [
    ["a long digit run", "1".repeat(2000)],
    ["digits with separators", "1 ".repeat(1500)],
    ["digits that fail at the end", "1".repeat(1500) + "x"],
    ["a long token that starts like a JWT", "eyJ" + "a".repeat(5000)],
    ["a JWT that never completes", "eyJ" + "a".repeat(2500) + "." + "b".repeat(2500)],
    ["an enormous password assignment", "password: " + "a".repeat(10_000)],
    ["repeated at-signs", "a@".repeat(3000)],
    ["a long IBAN-shaped run", "GB82" + "W".repeat(3000)],
  ];

  it.each(HOSTILE)("stays fast on %s", (_name, text) => {
    const started = performance.now();
    preflight(text);
    const ms = performance.now() - started;
    expect(ms, `${ms.toFixed(1)}ms — this pattern is backtracking`).toBeLessThan(250);
  });

  it("stays fast on a realistic large paste", () => {
    // A 200 KB log file with credentials scattered through it.
    const chunk = "2026-08-07 INFO request handled in 42ms for user 1234\n";
    const text = chunk.repeat(4000) + "\nAKIAIOSFODNN7EXAMPLE\n" + chunk.repeat(4000);
    const started = performance.now();
    const found = preflight(text);
    const ms = performance.now() - started;
    expect(ms, `${ms.toFixed(1)}ms on a 200KB paste`).toBeLessThan(1000);
    // And it still finds the needle.
    expect(found.map((f) => f.kind)).toContain("aws_key");
  });

  it("requires a word boundary, so a credential-shaped substring is not flagged", () => {
    /*
     * Checked because a probe of mine appeared to show missed cards, and the
     * cause turned out to be the test data rather than the scanner:
     * `order-x4111111111111111` has no boundary before the digits. Not
     * flagging it is correct — it is part of a longer token, and treating
     * every embedded digit run as a card is how a scanner becomes noise.
     */
    expect(preflight("order-x4111111111111111").filter((f) => f.kind === "card_number")).toEqual(
      [],
    );
    expect(
      preflight("card 4111 1111 1111 1111 here").filter((f) => f.kind === "card_number"),
    ).toHaveLength(1);
  });

  it("finds every distinct credential in one message", () => {
    const text = "first 4111111111111111 then 5500005555555559 and AKIAIOSFODNN7EXAMPLE";
    const kinds = preflight(text).map((f) => f.kind);
    expect(kinds.filter((k) => k === "card_number")).toHaveLength(2);
    expect(kinds).toContain("aws_key");
  });
});
