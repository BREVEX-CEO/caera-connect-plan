import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { resolveEngine, type EngineContext } from "../engine/resolve";

/**
 * ONE AUTHORITY, WITH EXPLICIT PRIVACY-PRESERVING MODES.
 *
 * The original version of this file proved that the local-versus-cloud rule
 * lived in exactly one module instead of being restated in the chat screen —
 * a real and useful property, because two copies of a privacy rule drift and
 * the drift is silent.
 *
 * Online inference now exists only behind the authenticated repository-owned
 * boundary. What is worth proving is that Chat delegates routing to the
 * canonical permit-carrying intelligence authority, passes the real privacy
 * policy, and cannot construct a direct provider path of its own.
 */

const base: EngineContext = {
  preference: "auto",
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

const chat = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("the signed-in chat delegates instead of deciding", () => {
  it("calls the authority", () => {
    expect(chat).toContain("createOcadeIntelligence({ online: onlineTransport, local })");
    expect(chat).toContain("await intelligence.generate({");
  });

  it("passes privacy policy into the authority instead of implementing a parallel rule", () => {
    /*
     * The screen used to hold its own copy of the privacy rule, derived from a
     * per-account storage mode. Two implementations of one rule is how a
     * conversation starts reaching a server while the authority still says it
     * must not — nothing fails, the promise just quietly stops being kept.
     *
     * `PLAN.md` Phase 2 removed the storage mode, so consent is what it should
     * always have been: Local Intelligence never goes out, and a sealed
     * conversation never goes out.
     */
    expect(chat).not.toMatch(/allowCloud:/);
    expect(chat).not.toMatch(/storageMode:/);
    expect(chat).toContain('onlineInferenceConsented: engineTier !== "local" && !sealed');
    expect(chat).toMatch(/privacy:\s*\{[\s\S]{0,180}sealed,/);
  });

  it("acquires a commercial permit before constructing or invoking intelligence", () => {
    const gate = chat.indexOf('const billed = await beginBilledRequest({ surface: "chat" });');
    const authority = chat.indexOf(
      "createOcadeIntelligence({ online: onlineTransport, local })",
      gate,
    );
    const send = chat.indexOf("await intelligence.generate({", authority);
    expect(gate).toBeGreaterThan(-1);
    expect(authority).toBeGreaterThan(gate);
    expect(send).toBeGreaterThan(authority);
  });

  it("holds a commercial permit before either send path, and neither can run without one", () => {
    /*
     * The allowance is ONE pool across every surface and every backend, so a
     * gate inside one branch would let an exhausted account fall through to
     * the other and spend it twice. It sits above both.
     *
     * The canonical intelligence request carries the same permit into either
     * transport. Probes and model initialization happen only after the router
     * validates it, so an exhausted account cannot spend work discovering or
     * invoking a backend.
     */
    const gate = chat.indexOf('const billed = await beginBilledRequest({ surface: "chat" });');
    expect(gate).toBeGreaterThan(-1);

    for (const call of [
      "await sendViaTools(text, billed);",
      "await sendViaIntelligence(text, atts, hasImage, billed);",
    ]) {
      expect(chat.indexOf(call), call).toBeGreaterThan(gate);
    }

    // Both paths REQUIRE the permit in their signature, so a future call site
    // cannot reach a backend without one.
    expect(chat).toMatch(/async function sendViaTools\(text: string, billed: BilledRequest\)/);
    expect(chat).toMatch(
      /async function sendViaIntelligence\([\s\S]{0,180}billed: BilledRequest,[\s\S]{0,40}\) \{/,
    );
    expect(chat).toContain("permit: billed.permit");

    // And every exit settles, so no path leaves a reservation held.
    expect(chat).toMatch(/\} finally \{[\s\S]{0,600}await billed\.settle\(\);/);
  });

  it("gates every path in this screen that runs the engine, not only the send", () => {
    /*
     * Re-run and prompt improvement both generate. A gate on the send alone
     * would leave two ways to spend an allowance without it counting — and the
     * short one is the more tempting to leave out, which is why it is named
     * here rather than assumed.
     *
     * Each is checked as a TRIO: acquire, record what was delivered, settle in
     * a finally. A permit acquired and never settled is worse than no permit,
     * because it holds allowance against somebody who received an answer.
     */
    const acquisitions = chat.match(/const billed = await beginBilledRequest\(/g) ?? [];
    expect(acquisitions.length, "one per engine-running path").toBeGreaterThanOrEqual(3);

    const settles = chat.match(/await billed\.settle\(\);/g) ?? [];
    expect(settles.length).toBe(acquisitions.length);

    const deliveries = chat.match(/billed\.recordDelivery\(/g) ?? [];
    expect(deliveries.length).toBeGreaterThanOrEqual(acquisitions.length);

    // The two short paths specifically, by the function they live in.
    const rerun = chat.slice(chat.indexOf("const rerunAnswer = useCallback"));
    expect(rerun.slice(0, 3000)).toContain(
      'const billed = await beginBilledRequest({ surface: "chat" });',
    );
    const improve = chat.slice(chat.indexOf("async function handleImprove()"));
    expect(improve.slice(0, 2000)).toContain(
      'const billed = await beginBilledRequest({ surface: "chat" });',
    );
  });

  it("asks the existing local routing authority for the capabilities the turn needs", () => {
    expect(chat).toContain("brain.route({ visionRequired: hasImage })");
    expect(chat).toContain('mode: engineTier === "local" ? "local_only" : "automatic"');
    expect(chat).toContain("sendViaLocal(text, atts, hasImage, billed, route)");
  });
});

describe("no screen has grown a direct provider path", () => {
  it("has no cloud-approval dialog anywhere", () => {
    const offenders = shippedFiles().filter((f) => {
      const t = readFileSync(f, "utf8");
      return t.includes("Approve cloud transfer") || t.includes("setCloudApprovalNeeded");
    });
    expect(offenders).toEqual([]);
  });

  it("does not embed a provider credential or direct provider transport", () => {
    expect(chat).not.toMatch(/"auto",\s*"local",\s*"cloud"/);
    expect(chat).not.toContain('providerId: "ocade-cloud"');
    expect(chat).not.toMatch(/GEMINI_API_KEY|x-goog-api-key|generativelanguage\.googleapis\.com/);
    expect(chat).toContain("createOnlineIntelligenceTransport()");
  });
});

describe("the authority has no branch to escape through", () => {
  it("prefers local whenever local can serve", () => {
    const d = resolveEngine(ctx());
    expect(d.ok).toBe(true);
    expect(d.target?.kind).toBe("local");
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
