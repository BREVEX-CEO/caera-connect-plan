import { describe, it, expect } from "vitest";
import {
  evaluateSkillTrust,
  versionsCompatible,
  RevocationList,
  SKILL_CAPABILITIES,
  HIGH_RISK_CAPABILITIES,
  type PublisherKey,
  type SignedSkill,
  type SkillCapability,
  type TrustInput,
} from "../skills/skill-trust";

/**
 * Signed, sandboxed, revocable community skills (P11.S05).
 *
 * These use a real Ed25519 keypair generated per test, so signature results are
 * genuine cryptography rather than a stubbed boolean. A skill that drives
 * someone's computer is exactly the wrong place for a mocked verifier.
 */

const DIGEST = "a".repeat(64);

async function keypair() {
  const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = await crypto.subtle.exportKey("raw", kp.publicKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
  return { kp, publicKeyBase64: b64 };
}

async function sign(privateKey: CryptoKey, hex: string): Promise<string> {
  const msg = new TextEncoder().encode(hex);
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, privateKey, msg);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

const manifest = (over: Partial<SignedSkill["manifest"]> = {}) => ({
  id: "skill.acme.invoice",
  version: "1.2.3",
  publisher: "acme",
  contentSha256: DIGEST,
  capabilities: ["read_screen", "click"] as SkillCapability[],
  targetAppId: "com.acme.editor",
  targetAppVersion: "4.1.0",
  ...over,
});

async function input(over: Partial<TrustInput> = {}): Promise<TrustInput> {
  const { kp, publicKeyBase64 } = await keypair();
  const m = manifest();
  return {
    skill: { manifest: m, signatureBase64: await sign(kp.privateKey, m.contentSha256) },
    publishers: [{ publisher: "acme", publicKeyBase64 }],
    revocations: [],
    grantedCapabilities: ["read_screen", "click"],
    observedAppVersion: "4.1.0",
    ...over,
  } as TrustInput;
}

describe("a correctly signed, granted, unrevoked skill is trusted", () => {
  it("trusts it and reports why", async () => {
    const v = await evaluateSkillTrust(await input());
    expect(v.trusted).toBe(true);
    if (v.trusted) {
      expect(v.evidence).toMatch(/Signed by acme/);
      expect(v.needsApproval).toEqual([]);
    }
  });

  it("still surfaces high-risk capabilities for confirmation", async () => {
    // A trusted publisher can still ship a mistake, so write_files/run_cli/
    // network are flagged every time rather than waved through on reputation.
    const { kp, publicKeyBase64 } = await keypair();
    const m = manifest({ capabilities: ["read_screen", "run_cli"] as never });
    const v = await evaluateSkillTrust({
      skill: { manifest: m, signatureBase64: await sign(kp.privateKey, m.contentSha256) },
      publishers: [{ publisher: "acme", publicKeyBase64 }],
      revocations: [],
      grantedCapabilities: ["read_screen", "run_cli"],
      observedAppVersion: "4.1.0",
    });
    expect(v.trusted).toBe(true);
    if (v.trusted) expect(v.needsApproval).toEqual(["run_cli"]);
  });
});

describe("revocation beats a valid signature", () => {
  it("REFUSES a revoked skill whose signature still verifies", async () => {
    // This is the whole point of revocation: the signature was and remains
    // genuine, and the skill must stop running anyway.
    const base = await input();
    const v = await evaluateSkillTrust({
      ...base,
      revocations: [
        {
          skillId: "skill.acme.invoice",
          version: "1.2.3",
          reason: "found to exfiltrate clipboard contents",
          revokedAt: new Date().toISOString(),
        },
      ],
    });
    expect(v.trusted).toBe(false);
    if (!v.trusted) {
      expect(v.refusal).toBe("skill_revoked");
      expect(v.reason).toMatch(/exfiltrate clipboard/);
    }
  });

  it("revokes every version when no version is named", async () => {
    const base = await input();
    const list = new RevocationList();
    list.revokeAllVersions("skill.acme.invoice", "publisher account compromised");
    expect(list.isRevoked("skill.acme.invoice", "1.2.3")).toBe(true);
    expect(list.isRevoked("skill.acme.invoice", "9.9.9")).toBe(true);
    expect(list.isRevoked("skill.other", "1.0.0")).toBe(false);

    const v = await evaluateSkillTrust({ ...base, revocations: list.all() });
    expect(v.trusted).toBe(false);
  });

  it("a compromised publisher key withdraws everything it signed", async () => {
    const base = await input();
    const v = await evaluateSkillTrust({
      ...base,
      publishers: base.publishers.map((p) => ({ ...p, revoked: true })),
    });
    expect(v.trusted).toBe(false);
    if (!v.trusted) expect(v.refusal).toBe("publisher_revoked");
  });
});

describe("signature refusals", () => {
  it("REFUSES an unsigned skill outright — no warn-and-continue", async () => {
    const base = await input();
    const v = await evaluateSkillTrust({
      ...base,
      skill: { ...base.skill, signatureBase64: null },
    });
    expect(v.trusted).toBe(false);
    if (!v.trusted) expect(v.refusal).toBe("unsigned");
  });

  it("REFUSES a signature from a different key", async () => {
    const base = await input();
    const other = await keypair();
    const v = await evaluateSkillTrust({
      ...base,
      skill: {
        ...base.skill,
        signatureBase64: await sign(other.kp.privateKey, base.skill.manifest.contentSha256),
      },
    });
    expect(v.trusted).toBe(false);
    if (!v.trusted) expect(v.refusal).toBe("bad_signature");
  });

  it("REFUSES a swapped body — the signature covers the content digest", async () => {
    // Signing the manifest alone would let the body change while the signature
    // still verified.
    const base = await input();
    const v = await evaluateSkillTrust({
      ...base,
      skill: {
        ...base.skill,
        manifest: { ...base.skill.manifest, contentSha256: "b".repeat(64) },
      },
    });
    expect(v.trusted).toBe(false);
    if (!v.trusted) expect(v.refusal).toBe("bad_signature");
  });

  it("refuses an unknown publisher", async () => {
    const base = await input();
    const v = await evaluateSkillTrust({ ...base, publishers: [] });
    expect(v.trusted).toBe(false);
    if (!v.trusted) expect(v.refusal).toBe("unknown_publisher");
  });

  it("distinguishes 'cannot check' from 'check failed'", async () => {
    // A placeholder key is an unconfigured build, not a bad skill. Reporting
    // bad_signature would send someone hunting the wrong problem.
    const base = await input();
    const v = await evaluateSkillTrust({
      ...base,
      publishers: [{ publisher: "acme", publicKeyBase64: "REPLACE_WITH_KEY" } as PublisherKey],
    });
    expect(v.trusted).toBe(false);
    if (!v.trusted) expect(v.refusal).toBe("no_signing_key");
  });
});

describe("capability sandbox", () => {
  it("refuses a capability outside the known set", async () => {
    const { kp, publicKeyBase64 } = await keypair();
    const m = manifest({ capabilities: ["read_screen", "become_admin"] as never });
    const v = await evaluateSkillTrust({
      skill: { manifest: m, signatureBase64: await sign(kp.privateKey, m.contentSha256) },
      publishers: [{ publisher: "acme", publicKeyBase64 }],
      revocations: [],
      grantedCapabilities: ["read_screen", "become_admin"] as never,
      observedAppVersion: "4.1.0",
    });
    expect(v.trusted).toBe(false);
    if (!v.trusted) expect(v.refusal).toBe("undeclared_capability");
  });

  it("refuses a capability the user has not granted", async () => {
    const base = await input();
    const v = await evaluateSkillTrust({ ...base, grantedCapabilities: ["read_screen"] });
    expect(v.trusted).toBe(false);
    if (!v.trusted) {
      expect(v.refusal).toBe("capability_not_granted");
      expect(v.reason).toMatch(/click/);
    }
  });

  it("keeps the high-risk set a strict subset of all capabilities", () => {
    for (const c of HIGH_RISK_CAPABILITIES) {
      expect(SKILL_CAPABILITIES as readonly string[]).toContain(c);
    }
    expect(HIGH_RISK_CAPABILITIES.length).toBeLessThan(SKILL_CAPABILITIES.length);
  });
});

describe("version binding and drift", () => {
  it("accepts a patch difference", () => {
    expect(versionsCompatible("4.1.0", "4.1.9")).toBe(true);
  });

  it("REJECTS a minor difference, where controls get renamed", () => {
    expect(versionsCompatible("4.1.0", "4.2.0")).toBe(false);
    expect(versionsCompatible("4.1.0", "5.1.0")).toBe(false);
  });

  it("does not treat an unparseable version as compatible", () => {
    expect(versionsCompatible("nightly", "4.1.0")).toBe(false);
    expect(versionsCompatible("nightly", "nightly")).toBe(true);
  });

  it("refuses a skill after the application drifted, and says to re-learn", async () => {
    const base = await input();
    const v = await evaluateSkillTrust({ ...base, observedAppVersion: "4.2.0" });
    expect(v.trusted).toBe(false);
    if (!v.trusted) {
      expect(v.refusal).toBe("version_drift");
      expect(v.reason).toMatch(/re-learned/);
    }
  });
});

describe("refusal ordering", () => {
  it("checks revocation BEFORE spending effort on cryptography", async () => {
    // A revoked skill with a deliberately broken signature must report
    // revocation, proving the cheap check ran first.
    const base = await input();
    const v = await evaluateSkillTrust({
      ...base,
      skill: { ...base.skill, signatureBase64: "not-a-signature" },
      revocations: [
        { skillId: "skill.acme.invoice", reason: "withdrawn", revokedAt: new Date().toISOString() },
      ],
    });
    expect(v.trusted).toBe(false);
    if (!v.trusted) expect(v.refusal).toBe("skill_revoked");
  });
});
