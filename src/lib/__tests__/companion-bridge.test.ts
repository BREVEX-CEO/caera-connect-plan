import { describe, it, expect } from "vitest";
import {
  riskOf,
  isProtectedText,
  guardAction,
  redactForAudit,
  UnavailableCompanion,
  getCompanion,
  COMPANION_UNAVAILABLE_REASON,
  type CompanionAction,
} from "../native/companion-bridge";
import { NativeCompanionRequiredError } from "../storage/types";

describe("risk tiers", () => {
  it.each<[CompanionAction, string]>([
    [{ kind: "screen.read" }, "read_only"],
    [{ kind: "window.list" }, "read_only"],
    [{ kind: "clipboard.read" }, "read_only"],
    [{ kind: "window.focus", target: "Editor" }, "low"],
    [{ kind: "window.arrange", layout: "left" }, "low"],
    [{ kind: "app.open", appId: "notepad" }, "confirm"],
    [{ kind: "file.open", path: "C:/notes.md" }, "confirm"],
    [{ kind: "text.type", text: "hello there" }, "confirm"],
  ])("classifies %o as %s", (action, expected) => {
    expect(riskOf(action)).toBe(expected);
  });

  it("marks typing credential-like content as prohibited", () => {
    expect(riskOf({ kind: "text.type", text: "my password is hunter2" })).toBe("prohibited");
    expect(riskOf({ kind: "text.type", text: "the OTP is 483920" })).toBe("prohibited");
    expect(riskOf({ kind: "text.type", text: "4111111111111111" })).toBe("prohibited");
  });
});

describe("isProtectedText", () => {
  it.each([
    "password",
    "one-time code",
    "enter the CAPTCHA",
    "cvv 123",
    "recovery code",
    "seed phrase",
    "123456",
  ])("flags %s", (s) => expect(isProtectedText(s)).toBe(true));

  it.each(["open my notes", "summarise this page", "write a haiku"])(
    "allows ordinary text: %s",
    (s) => expect(isProtectedText(s)).toBe(false),
  );
});

describe("guardAction", () => {
  it("refuses protected input outright, even when confirmed", () => {
    const msg = guardAction({ kind: "text.type", text: "password: abc" }, { confirmed: true });
    expect(msg).toMatch(/protected information/i);
  });

  it("requires confirmation for confirm-tier actions", () => {
    expect(guardAction({ kind: "app.open", appId: "notepad" }, {})).toMatch(/confirmation/i);
    expect(guardAction({ kind: "app.open", appId: "notepad" }, { confirmed: true })).toBeNull();
  });

  it("allows read-only actions without confirmation", () => {
    expect(guardAction({ kind: "screen.read" }, {})).toBeNull();
  });
});

describe("redactForAudit", () => {
  it("removes digit runs and credential words before audit/replay", () => {
    const out = redactForAudit("otp 483920 and password swordfish");
    expect(out).not.toContain("483920");
    expect(out).toContain("[redacted]");
  });
});

describe("UnavailableCompanion (no signed binary yet)", () => {
  it("reports unavailable honestly", async () => {
    const s = await new UnavailableCompanion().status();
    expect(s.available).toBe(false);
    expect(s.reason).toBe(COMPANION_UNAVAILABLE_REASON);
  });

  it("throws rather than simulating success", async () => {
    await expect(
      new UnavailableCompanion().execute(),
    ).rejects.toBeInstanceOf(NativeCompanionRequiredError);
  });

  it("emergency stop is always safe to call", async () => {
    await expect(new UnavailableCompanion().emergencyStop()).resolves.toBeUndefined();
  });

  it("the default active adapter is the unavailable one", async () => {
    expect((await getCompanion().status()).available).toBe(false);
  });
});
