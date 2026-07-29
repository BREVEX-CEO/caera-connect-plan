import { describe, it, expect } from "vitest";
import {
  parseVersion,
  compareVersions,
  planUpdate,
  decideRollback,
  advanceStage,
  verifyStagedArtifact,
  type UpdateManifest,
  type UpdatePolicy,
  type InstallRecord,
  type StageState,
  type IntegrityEvidence,
} from "../packaging/update-plan";

/**
 * Update-decision & rollback engine (§18 packaging). These exercise the pure
 * DECISION logic — the runtime download/swap/relaunch is device-gated and lives
 * in the Tauri updater plugin, so nothing here asserts a binary ran.
 */

const cmp = (a: string, b: string) => {
  const pa = parseVersion(a)!;
  const pb = parseVersion(b)!;
  return compareVersions(pa, pb);
};

describe("parseVersion", () => {
  it("parses a plain release", () => {
    expect(parseVersion("1.2.3")).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: [] });
  });

  it("parses a prerelease with dotted identifiers", () => {
    expect(parseVersion("0.1.0-beta.2")).toMatchObject({ prerelease: ["beta", "2"] });
  });

  it("rejects leading zeroes in core and numeric prerelease identifiers", () => {
    expect(parseVersion("01.2.3")).toBeNull();
    expect(parseVersion("1.2.3-01")).toBeNull();
  });

  it("rejects build metadata rather than silently dropping it", () => {
    expect(parseVersion("1.2.3+build.5")).toBeNull();
  });

  it("rejects garbage, empties, trailing dashes and non-strings", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("v1.2.3")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion("1.2.3-")).toBeNull();
    // @ts-expect-error deliberate wrong type
    expect(parseVersion(null)).toBeNull();
  });
});

describe("compareVersions (semver §11 precedence)", () => {
  it("orders core numerically, not lexically", () => {
    expect(cmp("0.9.0", "0.10.0")).toBe(-1);
    expect(cmp("2.0.0", "1.99.99")).toBe(1);
    expect(cmp("1.2.3", "1.2.3")).toBe(0);
  });

  it("ranks a release above its own prerelease", () => {
    expect(cmp("1.0.0-beta", "1.0.0")).toBe(-1);
    expect(cmp("1.0.0", "1.0.0-beta")).toBe(1);
  });

  it("compares numeric prerelease identifiers numerically and below alphanumeric", () => {
    expect(cmp("1.0.0-alpha.2", "1.0.0-alpha.10")).toBe(-1);
    expect(cmp("1.0.0-alpha.1", "1.0.0-alpha.beta")).toBe(-1);
  });

  it("gives the longer identifier set higher precedence when prefixes match", () => {
    expect(cmp("1.0.0-alpha", "1.0.0-alpha.1")).toBe(-1);
  });
});

const signed = (version: string, extra: Partial<UpdateManifest> = {}): UpdateManifest => ({
  version,
  signature: "ed25519:AAAA",
  sha256: "a".repeat(64),
  url: `https://updates.example/${version}`,
  ...extra,
});

const stable = (currentVersion: string, extra: Partial<UpdatePolicy> = {}): UpdatePolicy => ({
  currentVersion,
  ...extra,
});

describe("planUpdate — happy path", () => {
  it("applies a newer, signed, hashed release", () => {
    const d = planUpdate(signed("0.2.0"), stable("0.1.0"));
    expect(d).toEqual({
      action: "apply",
      from: "0.1.0",
      to: "0.2.0",
      url: "https://updates.example/0.2.0",
    });
  });

  it("skips when already at the offered version", () => {
    const d = planUpdate(signed("0.1.0"), stable("0.1.0"));
    expect(d.action).toBe("skip");
  });
});

describe("planUpdate — fails closed on provenance", () => {
  it("refuses an unsigned update", () => {
    const d = planUpdate(signed("0.2.0", { signature: null }), stable("0.1.0"));
    expect(d).toMatchObject({ action: "refuse" });
    if (d.action !== "refuse") throw new Error("unreachable");
    expect(d.reason).toMatch(/unsigned/i);
  });

  it("refuses an update with a blank signature (whitespace is not a signature)", () => {
    const d = planUpdate(signed("0.2.0", { signature: "   " }), stable("0.1.0"));
    expect(d.action).toBe("refuse");
  });

  it("refuses an update with no content hash", () => {
    const d = planUpdate(signed("0.2.0", { sha256: null }), stable("0.1.0"));
    expect(d).toMatchObject({ action: "refuse" });
    if (d.action !== "refuse") throw new Error("unreachable");
    expect(d.reason).toMatch(/hash/i);
  });

  it("only relaxes signature/hash when EXPLICITLY told to (never by default)", () => {
    const d = planUpdate(
      { version: "0.2.0" },
      stable("0.1.0", { requireSignature: false, requireHash: false }),
    );
    expect(d.action).toBe("apply");
  });
});

describe("planUpdate — never auto-downgrades", () => {
  it("refuses an older offered version", () => {
    const d = planUpdate(signed("0.1.0"), stable("0.2.0"));
    expect(d).toMatchObject({ action: "refuse" });
    if (d.action !== "refuse") throw new Error("unreachable");
    expect(d.reason).toMatch(/downgrade/i);
  });

  it("refuses a prerelease that is older than the installed release", () => {
    const d = planUpdate(signed("0.2.0-beta"), stable("0.2.0"));
    expect(d.action).toBe("refuse");
  });
});

describe("planUpdate — channel and staged-upgrade floors", () => {
  it("skips a prerelease on a stable-only channel", () => {
    const d = planUpdate(signed("0.3.0-rc.1"), stable("0.2.0"));
    expect(d.action).toBe("skip");
  });

  it("applies a prerelease when the channel allows it", () => {
    const d = planUpdate(signed("0.3.0-rc.1"), stable("0.2.0", { allowPrerelease: true }));
    expect(d.action).toBe("apply");
  });

  it("refuses a jump that skips a required intermediate, naming the floor", () => {
    const d = planUpdate(signed("2.0.0", { minimumClientVersion: "1.5.0" }), stable("1.0.0"));
    expect(d).toMatchObject({ action: "refuse" });
    if (d.action !== "refuse") throw new Error("unreachable");
    expect(d.reason).toContain("1.5.0");
  });

  it("applies once the client is at or above the floor", () => {
    const d = planUpdate(signed("2.0.0", { minimumClientVersion: "1.5.0" }), stable("1.5.0"));
    expect(d.action).toBe("apply");
  });
});

describe("planUpdate — unreadable inputs refuse, never throw", () => {
  it("refuses an unreadable current version", () => {
    expect(planUpdate(signed("0.2.0"), stable("garbage")).action).toBe("refuse");
  });
  it("refuses an unreadable manifest version", () => {
    expect(planUpdate(signed("not-a-version"), stable("0.1.0")).action).toBe("refuse");
  });
});

const rec = (version: string, health: InstallRecord["health"], installedAt = 0): InstallRecord => ({
  version,
  health,
  installedAt,
});

describe("decideRollback", () => {
  it("rolls back to the newest known-good version older than the failed one", () => {
    const history = [
      rec("0.1.0", "known_good"),
      rec("0.2.0", "known_good"),
      rec("0.3.0", "failed"),
    ];
    const d = decideRollback(history, "0.3.0");
    expect(d).toEqual({ action: "rollback", from: "0.3.0", to: "0.2.0" });
  });

  it("never treats an unverified staged version as a rollback target", () => {
    const history = [rec("0.1.0", "known_good"), rec("0.2.0", "unverified")];
    const d = decideRollback(history, "0.3.0");
    expect(d).toEqual({ action: "rollback", from: "0.3.0", to: "0.1.0" });
  });

  it("refuses when the only known-good version is newer than the failure", () => {
    // Failed 0.2.0; the sole known-good (0.4.0) is newer, so it is not a valid
    // target — you cannot "roll back" forward. Fail closed to manual recovery.
    const history = [rec("0.2.0", "failed"), rec("0.4.0", "known_good")];
    const d = decideRollback(history, "0.2.0");
    expect(d).toMatchObject({ action: "refuse" });
    if (d.action !== "refuse") throw new Error("unreachable");
    expect(d.reason).toMatch(/manual recovery/i);
  });

  it("refuses when history holds no known-good record at all", () => {
    const history = [rec("0.1.0", "failed"), rec("0.2.0", "unverified")];
    expect(decideRollback(history, "0.2.0").action).toBe("refuse");
  });

  it("refuses on an unreadable failed version rather than throwing", () => {
    expect(decideRollback([rec("0.1.0", "known_good")], "oops").action).toBe("refuse");
  });
});

describe("advanceStage — staged-apply state machine", () => {
  const run = (events: Parameters<typeof advanceStage>[1][]): StageState | { error: string } => {
    let state: StageState = "idle";
    for (const e of events) {
      const next = advanceStage(state, e);
      if (typeof next !== "string") return next;
      state = next;
    }
    return state;
  };

  it("commits only through stage → verify → pass", () => {
    expect(run(["stage", "verify", "pass"])).toBe("committed");
  });

  it("rolls back when verification fails", () => {
    expect(run(["stage", "verify", "fail"])).toBe("rolled_back");
  });

  it("cannot commit before verifying", () => {
    expect(run(["stage", "pass"])).toEqual({ error: "cannot pass from staged" });
  });

  it("cannot stage from a terminal state", () => {
    expect(run(["stage", "verify", "pass", "stage"])).toEqual({ error: "committed is terminal" });
  });

  it("cannot verify before staging", () => {
    expect(run(["verify"])).toEqual({ error: "cannot verify from idle" });
  });
});

describe("verifyStagedArtifact — the verdict behind the verify step", () => {
  const H = "a".repeat(64);
  const evidence = (extra: Partial<IntegrityEvidence> = {}): IntegrityEvidence => ({
    expectedSha256: H,
    computedSha256: H,
    expectedBytes: 1024,
    actualBytes: 1024,
    ...extra,
  });

  it("passes when hash and size both match", () => {
    expect(verifyStagedArtifact(evidence())).toEqual({ ok: true });
  });

  it("normalises hash case before comparing (upper vs lower is still a match)", () => {
    expect(verifyStagedArtifact(evidence({ computedSha256: H.toUpperCase() })).ok).toBe(true);
  });

  it("fails closed when the computed hash differs by one nibble", () => {
    const v = verifyStagedArtifact(evidence({ computedSha256: "b" + "a".repeat(63) }));
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.reason).toMatch(/tamper|does not match/i);
  });

  it("fails on a size mismatch even if the hash matches", () => {
    const v = verifyStagedArtifact(evidence({ actualBytes: 2048 }));
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.reason).toMatch(/size mismatch/i);
  });

  it("rejects a malformed expected digest as malformed, not as a mismatch", () => {
    const v = verifyStagedArtifact(evidence({ expectedSha256: "xyz" }));
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.reason).toMatch(/manifest hash/i);
  });

  it("rejects a truncated computed digest", () => {
    expect(verifyStagedArtifact(evidence({ computedSha256: "a".repeat(63) })).ok).toBe(false);
  });

  it("rejects a missing or non-positive manifest size", () => {
    expect(verifyStagedArtifact(evidence({ expectedBytes: 0, actualBytes: 0 })).ok).toBe(false);
  });
});
