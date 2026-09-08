import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * "NO AI SURFACE BYPASSES THE GATE" — CHECKED AGAINST THE WHOLE TREE.
 *
 * The other tests in this directory prove the gate's arithmetic and its
 * behaviour against a real database. None of them can prove the property that
 * actually costs money, which is a NEGATIVE one: that nowhere in the product
 * is there a second way to reach the model.
 *
 * That property cannot be tested by naming the surfaces, because the failure
 * mode is a surface nobody named. It has already happened once here: three
 * chat paths and the Control room were gated, and a "Read this computer"
 * button in a side panel ran the same observe → plan → verify loop, against
 * the same model, for free — found by this list rather than by review.
 *
 * So this scans the shipped tree for the calls that START a model run and
 * requires each file that makes one to be accounted for: either it holds a
 * permit itself, or it is named below as something that cannot.
 */

/**
 * The calls that begin a model run on a person's behalf, each anchored to the
 * module that defines it.
 *
 * ANCHORED TO THE IMPORT, NOT MATCHED BY NAME. `runQuery` was matched by name
 * first, and it found the Lab's research panel — whose `runQuery` is a local
 * name for a server function that fetches web pages and never reaches a model.
 * A gate that reports surfaces which are not surfaces gets an exemption
 * written for it, and the exemption is what covers the real one later.
 */
const RUNS_THE_MODEL: { call: string; from: string }[] = [
  { call: "runAgentTask(", from: "agent/loop" },
  { call: "runPlannedTask(", from: "agent/planner" },
  { call: "runQuery(", from: "primary-logic/query/query" },
  { call: "observeComputerFn(", from: "agent.functions" },
  { call: "controlWorkTaskFn(", from: "agent.functions" },
  { call: "improvePrompt(", from: "chat/improve-prompt" },
];

/**
 * Files that make one of those calls and hold no permit, each with the reason
 * it cannot.
 *
 * A REASON, NOT A WAIVER. Every entry here is a module that either has no
 * account to charge or is handed a permit by whoever called it — never "this
 * one is small" or "this one is internal". A new entry is a claim that has to
 * be true, and the test below re-checks the mechanical half of each claim.
 */
const NOT_A_SURFACE: Record<string, string> = {
  // The loop and the planner ARE the model run. They are handed everything by
  // a caller who already holds the permit; a gate here would be a second
  // charge on the same request.
  "src/lib/agent/loop.ts": "the loop itself — the caller holds the permit",
  "src/lib/agent/planner.ts": "decomposes one permitted request into sub-agents",
  "src/primary-logic/query/query.ts": "the imported query loop; deps are injected",
  "src/lib/runtime/use-ocade-runtime.ts":
    "a runtime handed to a surface; its callers hold the permit",

  // Server functions. The permit is an account-scoped reservation acquired by
  // the surface that originated the request; these are the transport beneath
  // it, and they are reached only from a gated caller (asserted below).
  "src/lib/agent.functions.ts": "server transport; the calling surface holds the permit",
};

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
      if ([".ts", ".tsx"].includes(extname(entry))) out.push(full.replace(/\\/g, "/"));
    }
  };
  walk(root);
  return out;
}

/** A file holds a permit if it acquires one, or is handed one to settle. */
function holdsAPermit(source: string): boolean {
  return source.includes("beginBilledRequest(") || source.includes("billed: BilledRequest");
}

/**
 * The bodies of every `finally` block in a file, brace-balanced.
 *
 * WRITTEN BECAUSE THE OBVIOUS VERSION DID NOT WORK. This started as
 * `/\} finally \{[\s\S]{0,900}await billed\.settle\(\);/` — which passes when
 * the settle sits just AFTER the closing brace, because a bounded wildcard
 * happily crosses it. Moving a settle out of its `finally` is precisely the
 * regression this test exists to catch, and the regex version did not catch
 * it when that edit was made deliberately to check.
 */
function finallyBodies(source: string): string[] {
  const bodies: string[] = [];
  const opener = /\}?\s*finally\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < source.length && depth > 0) {
      const character = source[index];
      if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
      index += 1;
    }
    if (depth === 0) bodies.push(source.slice(start, index - 1));
  }
  return bodies;
}

/**
 * Does this file both CALL a model-running function and IMPORT it from the
 * module that defines it?
 *
 * The defining module itself counts: it calls its own export, and it is the
 * one file where the import would be missing.
 */
function runsTheModel(file: string, source: string): boolean {
  return RUNS_THE_MODEL.some(({ call, from }) => {
    if (!source.includes(call)) return false;
    return source.includes(`${from}"`) || file.includes(from.replace(/\./g, "."));
  });
}

const callers = shippedFiles()
  .map((file) => ({ file, source: readFileSync(file, "utf8").replace(/\r\n/g, "\n") }))
  .filter(({ file, source }) => runsTheModel(file, source));

describe("every surface that runs the model spends the allowance", () => {
  it("finds the model-running call sites at all", () => {
    // A scan that matches nothing passes every assertion below it. This is the
    // guard against a rename quietly turning this whole file into a no-op.
    expect(callers.length).toBeGreaterThanOrEqual(5);
  });

  it("leaves no caller unaccounted for", () => {
    const ungated = callers
      .filter(({ file, source }) => !holdsAPermit(source) && !(file in NOT_A_SURFACE))
      .map(({ file }) => file);

    /*
     * If this fails, a new way to reach the model has appeared. The fix is to
     * gate it with the acquire → recordDelivery → settle trio — NOT to add it
     * to `NOT_A_SURFACE`, unless it genuinely has no account to charge.
     */
    expect(ungated).toEqual([]);
  });

  it("keeps the exemption list honest — every entry still makes the call", () => {
    // An exemption for a file that no longer runs the model is dead weight
    // that would silently cover a future file of the same name.
    const stale = Object.keys(NOT_A_SURFACE).filter(
      (file) => !callers.some((caller) => caller.file === file),
    );
    expect(stale).toEqual([]);
  });

  it("settles every permit it acquires, in a finally", () => {
    /*
     * A permit acquired and never settled is WORSE than no permit: it holds
     * allowance against somebody who received their answer, until the window
     * expires. So acquisitions and settles are counted per file, and every
     * settle must sit in a `finally` — a settle on the success path alone
     * leaves the failure path holding the reservation.
     */
    for (const { file, source } of callers) {
      const acquisitions = (source.match(/const billed = await beginBilledRequest\(/g) ?? [])
        .length;
      if (acquisitions === 0) continue;

      const settles = (source.match(/billed\.settle\(\)/g) ?? []).length;
      expect(settles, `${file}: one settle per acquisition`).toBe(acquisitions);

      // And every one of them INSIDE a `finally` body, counted by brace
      // matching rather than by proximity.
      const inFinally = finallyBodies(source).reduce(
        (total, body) => total + (body.match(/billed\.settle\(\)/g) ?? []).length,
        0,
      );
      expect(inFinally, `${file}: every settle sits inside a finally`).toBe(acquisitions);
    }
  });

  it("records what was delivered, so a refusal cannot be charged", () => {
    for (const { file, source } of callers) {
      if (!source.includes("beginBilledRequest(")) continue;
      expect(source, `${file}: records delivery`).toContain("recordDelivery(");
    }
  });

  it("refuses BEFORE it runs anything, on every gated surface", () => {
    /*
     * The whole point of reserving first is that an exhausted account is
     * answered without any backend being touched. Most surfaces return
     * immediately. Chat may first persist the attempted turn with an explicit
     * non-answer so Send never appears broken, but that is storage/UI work and
     * cannot route intelligence.
     */
    for (const { file, source } of callers) {
      if (!source.includes("beginBilledRequest(")) continue;
      expect(source, `${file}: returns immediately when refused`).toMatch(
        /const billed = await beginBilledRequest\([^;]*\);\n(\s*\/\/[^\n]*\n|\s*\/\*[\s\S]*?\*\/\n)*\s*if \(!billed\)(?: return;| \{\s*await recordUnavailableTurn\([\s\S]*?\);\s*return;\s*\})/,
      );
    }
  });
});

describe("the transports are reached only from a gated surface", () => {
  /*
   * Three entries in `NOT_A_SURFACE` are exempt on the same claim: they are
   * handed a request by a caller who already holds the permit. That claim is
   * only true while EVERY caller holds one, and the exemptions are what would
   * hide it if one did not — so each is checked here rather than trusted.
   */
  const TRANSPORTS: { name: string; owner: string; reached: string[] }[] = [
    {
      name: "the server agent entry points",
      owner: "src/lib/agent.functions.ts",
      reached: ["observeComputerFn(", "controlWorkTaskFn("],
    },
    {
      name: "the query runtime",
      owner: "src/lib/runtime/use-ocade-runtime.ts",
      reached: ["useOcadeRuntime("],
    },
  ];

  for (const transport of TRANSPORTS) {
    it(`${transport.name} have no caller without a permit`, () => {
      const found = shippedFiles()
        .filter((file) => file !== transport.owner)
        .map((file) => ({
          file,
          source: readFileSync(file, "utf8").replace(/\r\n/g, "\n"),
        }))
        .filter(({ source }) => transport.reached.some((call) => source.includes(call)));

      // A check that finds no callers proves nothing about them.
      expect(found.length, `${transport.owner} has callers to check`).toBeGreaterThan(0);
      expect(found.filter(({ source }) => !holdsAPermit(source)).map(({ file }) => file)).toEqual(
        [],
      );
    });
  }

  it("the browser query runtime validates its permit before the query loop", () => {
    const source = readFileSync("src/lib/runtime/use-ocade-runtime.ts", "utf8").replace(
      /\r\n/g,
      "\n",
    );
    expect(source).toContain('permit: BilledRequest["permit"]');
    expect(source.indexOf("requireRuntimeGenerationPermit(opts.permit)")).toBeGreaterThan(0);
    expect(source.indexOf("requireRuntimeGenerationPermit(opts.permit)")).toBeLessThan(
      source.indexOf("plainlyConversational(request)"),
    );
    expect(source.indexOf("requireRuntimeGenerationPermit(opts.permit)")).toBeLessThan(
      source.indexOf("await runQuery("),
    );
  });

  it("the authenticated server transports revalidate durable permits before adapters", () => {
    const source = readFileSync("src/lib/agent.functions.ts", "utf8").replace(/\r\n/g, "\n");
    const assertions = [...source.matchAll(/await assertActiveGenerationPermit\(/g)].map(
      (match) => match.index,
    );
    const modelImports = [...source.matchAll(/import\("@\/lib\/agent\/model-turn\.node"\)/g)].map(
      (match) => match.index,
    );
    expect(assertions).toHaveLength(2);
    expect(modelImports).toHaveLength(2);
    expect(assertions[0]).toBeLessThan(modelImports[0]);
    expect(assertions[1]).toBeLessThan(modelImports[1]);
  });

  it("every surface acquisition names its commercial surface explicitly", () => {
    for (const file of shippedFiles().filter((candidate) =>
      callers.some((caller) => caller.file === candidate),
    )) {
      const source = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      const acquisitions = [
        ...source.matchAll(/const billed = await beginBilledRequest\(([^;]*)\)/g),
      ];
      for (const acquisition of acquisitions) {
        expect(acquisition[1], `${file}: explicit surface`).toMatch(/\bsurface\s*:/);
      }
    }
  });
});
