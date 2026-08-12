import { describe, it, expect } from "vitest";
import {
  createDefaultExecutors,
  RUNTIME_REALITY,
  type DataInput,
} from "../skills/default-executors";
import { describeRunnable } from "../skills/executor-registry";
import { PackRegistry } from "../skills/pack-registry";
import { parseCsv } from "../skills/packs/data-pack";

/**
 * These prove what OCADE can genuinely do in the browser with no companion and
 * no network — and, just as importantly, that it does NOT register executors
 * for work it cannot perform here.
 */

const CSV = "region,amount\nNorth,120\nSouth,80\nEast,40\n";

function table() {
  const r = parseCsv(CSV);
  if (!r.ok) throw new Error("fixture failed");
  return r.data;
}

function withInput(input: DataInput | undefined) {
  return createDefaultExecutors(() => input);
}

describe("what actually runs in the browser", () => {
  it("registers only the capabilities that genuinely work here", () => {
    expect(withInput({}).runnable()).toEqual([
      "ocade.data:data.filter",
      "ocade.data:data.parse_csv",
      "ocade.data:data.parse_json",
      "ocade.data:data.summarise",
    ]);
  });

  /**
   * Registering these would produce controls that look available and fail on
   * use — the dead-control problem this whole design exists to avoid.
   */
  it("does NOT register companion or extension work", () => {
    const runnable = withInput({}).runnable().join(" ");
    for (const absent of ["ocade.desktop", "ocade.web", "git:", "tar:", "ocade.integrity"]) {
      expect(runnable).not.toContain(absent);
    }
  });

  it("states plainly which parts need which component", () => {
    expect(RUNTIME_REALITY).toMatch(/including offline/i);
    expect(RUNTIME_REALITY).toMatch(/companion app/i);
    expect(RUNTIME_REALITY).toMatch(/Playwright\/CDP browser host/i);
    expect(RUNTIME_REALITY).toMatch(/rather than showing a control that would fail/i);
  });

  it("reports the honest runnable ratio against all tested capabilities", () => {
    const all = new PackRegistry().testedCapabilities();
    const line = describeRunnable(withInput({}), all);
    expect(line).toMatch(/^4 of \d+ actions can run here\./);
    expect(line).toMatch(/isn't installed/);
  });
});

describe("data work runs for real, offline", () => {
  async function run(id: string, input: DataInput) {
    const fn = withInput(input).get("ocade.data", id)!;
    return fn({} as never);
  }

  it("parses CSV and reports the real shape", async () => {
    const r = await run("data.parse_csv", { text: CSV });
    expect(r.ok).toBe(true);
    expect(r).not.toHaveProperty("verified");
    expect(JSON.parse(r.data!)).toEqual({ columns: ["region", "amount"], rowCount: 3 });
  });

  it("parses JSON records", async () => {
    const r = await run("data.parse_json", { text: JSON.stringify([{ a: 1 }, { a: 2 }]) });
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.data!).rowCount).toBe(2);
  });

  it("summarises a numeric column with correct arithmetic", async () => {
    const r = await run("data.summarise", { table: table(), column: "amount" });
    expect(r.ok).toBe(true);
    const data = JSON.parse(r.data!);
    expect(data.sum).toBe(240);
    expect(data.mean).toBe(80);
  });

  it("filters and reports how many matched", async () => {
    const r = await run("data.filter", { table: table(), column: "region", value: "North" });
    expect(r.ok).toBe(true);
    expect(r.data).toBe("1");
    expect(r.evidence).toMatch(/1 of 3 rows/);
  });
});

/**
 * The failure paths matter more than the happy ones: an executor that invents
 * an empty result on missing input is the quiet-wrong-answer problem.
 */
describe("missing input fails rather than inventing a result", () => {
  it.each([
    ["data.parse_csv", {}],
    ["data.parse_json", {}],
    ["data.summarise", { table: table() }],
    ["data.filter", { table: table(), column: "region" }],
  ])("%s fails when its input is absent", async (id, input) => {
    const fn = withInput(input as DataInput).get("ocade.data", id)!;
    const r = await fn({} as never);
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty("verified");
    expect(r.evidence).toMatch(/no .*(provided|input)/i);
  });

  it("fails when no input object exists at all", async () => {
    const fn = withInput(undefined).get("ocade.data", "data.parse_csv")!;
    const r = await fn({} as never);
    expect(r.ok).toBe(false);
  });

  /** The refusal from the data pack must survive to the executor result. */
  it("carries through the refusal to average a mixed column", async () => {
    const mixed = parseCsv("v\n10\n20\nN/A\n");
    if (!mixed.ok) throw new Error("fixture failed");
    const fn = withInput({ table: mixed.data, column: "v" }).get("ocade.data", "data.summarise")!;
    const r = await fn({} as never);
    expect(r.ok).toBe(false);
    expect(r.evidence).toMatch(/won't average part of a column/i);
  });

  it("carries through a malformed-CSV refusal rather than partial data", async () => {
    const fn = withInput({ text: "a,b,c\n1,2\n" }).get("ocade.data", "data.parse_csv")!;
    const r = await fn({} as never);
    expect(r.ok).toBe(false);
    expect(r.evidence).toMatch(/won't guess which column/i);
  });
});
