import { describe, it, expect } from "vitest";
import {
  riskOf,
  isProtectedText,
  guardAction,
  redactForAudit,
  UnavailableCompanion,
  setCompanionAdapter,
  subscribeCompanionAdapter,
  getCompanion,
  classifyCompanionCompletion,
  COMPANION_UNAVAILABLE_REASON,
  type CompanionAction,
  type NativeCompanionAdapter,
} from "../native/companion-bridge";
import { NativeCompanionRequiredError } from "../storage/types";

describe("risk tiers", () => {
  it.each<[CompanionAction, string]>([
    [{ kind: "screen.read" }, "read_only"],
    [{ kind: "window.list" }, "read_only"],
    [{ kind: "accessibility.read" }, "read_only"],
    [{ kind: "clipboard.read" }, "read_only"],
    [{ kind: "window.focus", target: "Editor" }, "low"],
    [{ kind: "window.arrange", layout: "left" }, "low"],
    [{ kind: "app.open", appId: "notepad" }, "confirm"],
    [{ kind: "file.open", path: "C:/notes.md" }, "confirm"],
    [{ kind: "text.type", text: "hello there" }, "confirm"],
    [{ kind: "selection.read" }, "read_only"],
    [{ kind: "selection.replace", text: "a tidier sentence" }, "confirm"],
  ])("classifies %o as %s", (action, expected) => {
    expect(riskOf(action)).toBe(expected);
  });

  it("marks typing credential-like content as prohibited", () => {
    expect(riskOf({ kind: "text.type", text: "my password is hunter2" })).toBe("prohibited");
    expect(riskOf({ kind: "text.type", text: "the OTP is 483920" })).toBe("prohibited");
    expect(riskOf({ kind: "text.type", text: "4111111111111111" })).toBe("prohibited");
  });

  /**
   * Replacing a selection is a WRITE path. If it were treated as read-only,
   * "rewrite this" could be used to push a credential into a field.
   */
  it("gates replacing a selection exactly like typing", () => {
    expect(riskOf({ kind: "selection.replace", text: "my password is hunter2" })).toBe(
      "prohibited",
    );
    expect(riskOf({ kind: "selection.replace", text: "cvv 123456" })).toBe("prohibited");
    // ...and a confirm-tier replacement still cannot run unconfirmed.
    expect(
      guardAction({ kind: "selection.replace", text: "a tidier sentence" }, { confirmed: false }),
    ).toMatch(/confirmation/i);
    expect(
      guardAction({ kind: "selection.replace", text: "a tidier sentence" }, { confirmed: true }),
    ).toBeNull();
  });

  it("lets OCADE read the selection without a confirmation prompt", () => {
    expect(guardAction({ kind: "selection.read" }, { confirmed: false })).toBeNull();
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

describe("canonical companion completion", () => {
  const execution = { ok: true, runId: "run-1", detail: "Executor returned success." };

  it("never treats the executor's own success as verified completion", () => {
    expect(classifyCompanionCompletion(execution)).toEqual({
      status: "completed_unverified",
      evidence:
        "The companion acknowledged execution, but no independent observer verified the result.",
    });
  });

  it("requires independent positive evidence for verified completion", () => {
    expect(
      classifyCompanionCompletion(execution, {
        verified: true,
        evidence: "Fresh OS observation matched.",
      }),
    ).toEqual({
      status: "completed_verified",
      evidence: "Fresh OS observation matched.",
    });
  });

  it("preserves verification disagreement as completed but unverified", () => {
    expect(
      classifyCompanionCompletion(execution, {
        verified: false,
        evidence: "The observed window did not match.",
      }),
    ).toEqual({
      status: "completed_unverified",
      evidence: "The observed window did not match.",
    });
  });

  it("cannot launder an executor failure through positive verification", () => {
    expect(
      classifyCompanionCompletion(
        { ok: false, runId: "run-1", detail: "Host refused." },
        { verified: true, evidence: "Impossible stale evidence." },
      ),
    ).toEqual({ status: "failed", evidence: "Host refused." });
  });
});

describe("UnavailableCompanion (no signed binary yet)", () => {
  it("reports unavailable honestly", async () => {
    const s = await new UnavailableCompanion().status();
    expect(s.available).toBe(false);
    expect(s.reason).toBe(COMPANION_UNAVAILABLE_REASON);
  });

  it("throws rather than simulating success", async () => {
    await expect(new UnavailableCompanion().execute()).rejects.toBeInstanceOf(
      NativeCompanionRequiredError,
    );
  });

  it("does not claim an emergency stop was delivered without a companion", async () => {
    await expect(new UnavailableCompanion().emergencyStop()).rejects.toBeInstanceOf(
      NativeCompanionRequiredError,
    );
  });

  it("the default active adapter is the unavailable one", async () => {
    expect((await getCompanion().status()).available).toBe(false);
  });
});

describe("companion adapter replacement", () => {
  it("notifies once per new adapter and stops after unsubscribe", () => {
    const seen: NativeCompanionAdapter[] = [];
    const off = subscribeCompanionAdapter((adapter) => seen.push(adapter));
    const first = new UnavailableCompanion();
    const second = new UnavailableCompanion();
    setCompanionAdapter(first);
    setCompanionAdapter(first);
    setCompanionAdapter(second);
    off();
    setCompanionAdapter(new UnavailableCompanion());
    expect(seen).toEqual([first, second]);
  });
});
