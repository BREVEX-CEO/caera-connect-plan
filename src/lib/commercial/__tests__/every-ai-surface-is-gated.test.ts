import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NOTHING GENERATES WITHOUT SPENDING THE ALLOWANCE.
 *
 * This is a source-shape test and that is deliberate: the property is "no code
 * path reaches intelligence without a permit first", and a path that exists is
 * only visible before it ships. A runtime test can prove the paths it knows
 * about; this proves there are no others.
 *
 * It replaces a version that scanned eight surfaces — Chat, Cowork, Code,
 * Tasks, Automations, background agents, Voice and Artifacts. Six of those
 * products are gone; the rule is the same and the surface it guards is smaller.
 */

const ROOT = "src";

function sourceFiles(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry).replaceAll("\\", "/");
    if (statSync(path).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...sourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

const FILES = sourceFiles(ROOT).map((path) => ({ path, source: readFileSync(path, "utf8") }));

/** The one object that can start a generation. */
const INTELLIGENCE_ENTRY = "ocadeIntelligence()";
/** The one function that can produce a permit. */
const PERMIT_ENTRY = "beginBilledRequest";

describe("reaching intelligence", () => {
  it("happens through the single assembly point and nowhere else", () => {
    /*
     * `createOcadeIntelligence` is the router's factory. Exactly one module may
     * call it — a second construction is a second answer to "may this run
     * online?", and the first to disagree is the one nobody is watching.
     */
    const constructors = FILES.filter(
      ({ path, source }) =>
        source.includes("createOcadeIntelligence(") && !path.endsWith("intelligence/router.ts"),
    ).map(({ path }) => path);
    expect(constructors).toEqual(["src/lib/intelligence/ocade-intelligence.ts"]);
  });

  it("is only ever done by a caller that took a permit first", () => {
    const callers = FILES.filter(({ source }) => source.includes(INTELLIGENCE_ENTRY)).map(
      ({ path, source }) => ({ path, source }),
    );

    // The assembly point itself defines the entry; every other caller is a
    // surface and must acquire before it streams.
    const surfaces = callers.filter(
      ({ path }) => !path.endsWith("intelligence/ocade-intelligence.ts"),
    );
    expect(surfaces.length).toBeGreaterThan(0);

    for (const { path, source } of surfaces) {
      expect(source, `${path} reaches intelligence without taking a permit`).toContain(
        PERMIT_ENTRY,
      );
      expect(
        source.indexOf(PERMIT_ENTRY),
        `${path} takes its permit after it starts generating`,
      ).toBeLessThan(source.indexOf(INTELLIGENCE_ENTRY));
    }
  });

  it("carries the permit into the request rather than asserting one exists", () => {
    const chat = readFileSync("src/lib/chat/use-chat.ts", "utf8");
    expect(chat).toContain("permit: billed.permit");
    expect(chat).toContain("generationId: billed.permit.generationId");
    expect(chat).toContain("idempotencyKey: billed.permit.idempotencyKey");
  });
});

describe("what the gate refuses to let happen", () => {
  it("never lets an exhausted request fall back to the on-device engine", () => {
    /*
     * The allowance is ONE pool across both backends, so "the network said no,
     * run it on the device" is not a degradation path — it is the allowance
     * being spent twice. The gate sits above the router rather than inside one
     * branch of it, and `use-chat` returns rather than routing when there is no
     * permit.
     */
    const chat = readFileSync("src/lib/chat/use-chat.ts", "utf8");
    const refusal = chat.indexOf("if (!billed) return");
    expect(refusal).toBeGreaterThan(0);
    expect(refusal).toBeLessThan(chat.indexOf(INTELLIGENCE_ENTRY));
  });

  it("settles every permit it takes, on every path out", () => {
    const chat = readFileSync("src/lib/chat/use-chat.ts", "utf8");
    /*
     * ONE SETTLEMENT, IN THE `finally`. This used to be three calls — empty
     * answer, thrown error, success — which covered the three exits that
     * existed and none that a later edit might add. The exit itself settles
     * now, so the count that matters is one.
     */
    const settlements = chat.match(/await billed\.settle\(\)/g)?.length ?? 0;
    expect(settlements).toBe(1);
    expect(chat.indexOf("} finally {")).toBeLessThan(chat.indexOf("await billed.settle()"));
    // And the allowance is re-read after settlement rather than during it.
    expect(chat.indexOf("await billed.settle()")).toBeLessThan(
      chat.indexOf("invalidateQueries({ queryKey: USAGE_QUERY_KEY })"),
    );
  });

  it("records delivery only when something was actually delivered", () => {
    const chat = readFileSync("src/lib/chat/use-chat.ts", "utf8");
    expect(chat.indexOf("if (answer.length === 0)")).toBeLessThan(
      chat.indexOf("billed.recordDelivery"),
    );
  });
});

describe("the permit's own rules", () => {
  it("refuses an offline allocation for an online request", () => {
    const contract = readFileSync("src/lib/intelligence/contract.ts", "utf8");
    expect(contract).toContain("An offline usage allocation cannot authorize online intelligence.");
  });

  it("is asserted before any transport is probed", () => {
    const router = readFileSync("src/lib/intelligence/router.ts", "utf8");
    /*
     * Compared INSIDE `stream`, because `safeProbe` is also defined above it
     * for the status read — comparing against the whole file would be
     * comparing against a definition rather than against a call.
     */
    const stream = router.slice(router.indexOf("async function* stream("));
    expect(stream.indexOf("assertIntelligencePermit(request)")).toBeLessThan(
      stream.indexOf("safeProbe("),
    );
  });
});
