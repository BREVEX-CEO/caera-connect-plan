import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { resolveEngine, type EngineContext } from "../engine/resolve";

/**
 * ONE AUTHORITY, AND NOW ALSO ONE DESTINATION.
 *
 * The original version of this file proved that the local-versus-cloud rule
 * lived in exactly one module instead of being restated in the chat screen —
 * a real and useful property, because two copies of a privacy rule drift and
 * the drift is silent.
 *
 * The rule those copies implemented is gone: OCADE performs no cloud
 * inference, so there is no permission to decide and nothing to keep in sync.
 * What is worth proving now is that no screen has quietly grown its own
 * escalation path back, and that the authority itself has no branch to escape
 * through.
 */

const base: EngineContext = {
  preference: "auto",
  privacyMode: "private_sync",
  deviceMode: "pc_web",
  localAvailable: true,
  localLabel: "OCADE Local",
  localVision: false,
  visionRequired: false,
  online: true,
};
const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({ ...base, ...over });

function shippedFiles(root = "src"): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "__tests__") continue;
        walk(full);
        continue;
      }
      if (![".ts", ".tsx"].includes(extname(entry))) continue;
      out.push(full);
    }
  };
  walk(root);
  return out;
}

const chat = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");

describe("the signed-in chat delegates instead of deciding", () => {
  it("calls the authority", () => {
    expect(chat).toContain("resolveEngine({");
  });

  it("carries no copy of a privacy-versus-cloud rule", () => {
    /*
     * The screen used to hold its own `if (chatsMode !== "private_sync" &&
     * !allowCloud)`. Two implementations of one privacy rule is how a
     * Browser-Only conversation starts reaching a server while the authority
     * still says it must not — nothing fails, the promise just quietly stops
     * being kept.
     */
    expect(chat).not.toMatch(/if \([^)]*chatsMode !== "private_sync"[^)]*allowCloud/);
    expect(chat).not.toMatch(/allowCloud:/);
  });

  it("decides before it sends", () => {
    const decision = chat.indexOf("const decision = resolveEngine({");
    const send = chat.indexOf("await sendViaLocal(text, atts, hasImage);", decision);
    expect(decision).toBeGreaterThan(-1);
    expect(send).toBeGreaterThan(decision);
  });

  it("passes the real privacy mode rather than a constant", () => {
    expect(chat).toMatch(/privacyMode:\s*chatsMode/);
  });

  it("distinguishes no-engine from no-image-engine", () => {
    expect(chat).toContain("vision_unavailable_locally");
  });
});

describe("no screen has grown its own escalation path", () => {
  it("has no cloud-approval dialog anywhere", () => {
    const offenders = shippedFiles().filter((f) => {
      const t = readFileSync(f, "utf8");
      return t.includes("Approve cloud transfer") || t.includes("setCloudApprovalNeeded");
    });
    expect(offenders).toEqual([]);
  });

  it("offers no engine tier that means anything other than on-device", () => {
    expect(chat).not.toMatch(/"auto",\s*"local",\s*"cloud"/);
    expect(chat).not.toContain('providerId: "ocade-cloud"');
  });
});

describe("the authority has no branch to escape through", () => {
  it("prefers local whenever local can serve, in every privacy mode", () => {
    for (const privacyMode of ["browser_only", "pc_vault", "private_sync"] as const) {
      const d = resolveEngine(ctx({ privacyMode }));
      expect(d.ok).toBe(true);
      expect(d.target?.kind).toBe("local");
    }
  });

  it("reports being offline rather than blaming a plan", () => {
    const d = resolveEngine(ctx({ localAvailable: false, online: false }));
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/offline/i);
    expect(d.reason).not.toMatch(/plan|allowance|entitle/i);
  });

  it("never refuses without a code and a sentence to show", () => {
    for (const localAvailable of [true, false]) {
      for (const visionRequired of [true, false]) {
        for (const online of [true, false]) {
          for (const preference of ["auto", "local_only"] as const) {
            const d = resolveEngine(ctx({ localAvailable, visionRequired, online, preference }));
            if (d.ok) continue;
            expect(d.code, JSON.stringify({ localAvailable, visionRequired, online })).toBeTruthy();
            expect(d.reason?.length ?? 0).toBeGreaterThan(20);
          }
        }
      }
    }
  });
});
