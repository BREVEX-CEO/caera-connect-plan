import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

/**
 * The CI workflows must be well-formed and must reference real scripts.
 *
 * These workflows are the automation standing in for prerequisites this machine
 * does not have — the Rust tests run on `windows-latest`, and the Android, iOS
 * and desktop jobs are prepared for hardware that is absent here. That makes
 * them exactly the kind of code never exercised locally: a malformed workflow
 * does not fail a build, it simply never runs, and a step calling a script that
 * has been renamed fails only once CI is triggered. Nothing else in the suite
 * reads them.
 *
 * NO YAML LIBRARY IS USED. `js-yaml` is present only as a transitive dependency
 * of eslint; importing it here would make this suite break the moment that tree
 * shifted, and adding a dependency for a structural check is not warranted. So
 * these are deliberately SHALLOW line-level checks — enough to catch a missing
 * runner, a job with no steps, or a dead script reference, and honest about not
 * being a full parse.
 *
 * This claims nothing about execution. Structure is not a run: a green result
 * here is not evidence that any Android, iOS or Windows job has ever passed.
 */

const DIR = ".github/workflows";
const files = readdirSync(DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
const sources = new Map(files.map((f) => [f, readFileSync(`${DIR}/${f}`, "utf8")]));
const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts as Record<string, string>;

/** Job names are the keys indented exactly two spaces under `jobs:`. */
function jobNamesIn(src: string): string[] {
  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start < 0) return [];
  const names: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break; // dedented back to a top-level key
    const match = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (match) names.push(match[1]);
  }
  return names;
}

describe("every CI workflow is well-formed", () => {
  it("finds the workflows", () => {
    // An empty listing would make every assertion below vacuous.
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it.each(files)("%s declares a trigger and at least one job", (file) => {
    const src = sources.get(file)!;
    expect(/^on:/m.test(src), `${file} has no trigger`).toBe(true);
    expect(/^jobs:/m.test(src), `${file} has no jobs block`).toBe(true);
    expect(jobNamesIn(src).length, `${file} declares no job`).toBeGreaterThan(0);
  });

  it("gives every job a runner", () => {
    // A job without `runs-on` is rejected by GitHub at dispatch time, long
    // after it looked fine in review.
    for (const [file, src] of sources) {
      const jobs = jobNamesIn(src);
      const runners = src.match(/^\s+runs-on:/gm) ?? [];
      expect(runners.length, `${file}: ${jobs.length} jobs but ${runners.length} runners`).toBe(
        jobs.length,
      );
    }
  });

  it("gives every job a steps block", () => {
    for (const [file, src] of sources) {
      const jobs = jobNamesIn(src);
      const steps = src.match(/^\s+steps:/gm) ?? [];
      expect(steps.length, `${file}: ${jobs.length} jobs but ${steps.length} steps blocks`).toBe(
        jobs.length,
      );
    }
  });

  it("uses no tab indentation, which YAML rejects outright", () => {
    for (const [file, src] of sources) {
      expect(/^\t/m.test(src), `${file} indents with a tab`).toBe(false);
    }
  });
});

describe("CI never calls a script that does not exist", () => {
  it("resolves every `npm run` reference against package.json", () => {
    // The silent failure this prevents: a script is renamed, every local gate
    // still passes, and CI breaks only when someone pushes.
    const broken: string[] = [];
    let referenced = 0;

    for (const [file, src] of sources) {
      for (const match of src.matchAll(/npm run (?:-s )?([a-zA-Z0-9:_-]+)/g)) {
        referenced += 1;
        if (!(match[1] in scripts)) broken.push(`${file} -> npm run ${match[1]}`);
      }
    }

    expect(referenced, "no npm run references found — the scan is not working").toBeGreaterThan(5);
    expect(broken, `CI references missing scripts:\n${broken.join("\n")}`).toEqual([]);
  });
});

describe("the platform workflows do not overstate themselves", () => {
  it("keeps the unverified platform jobs manually triggered and labelled", () => {
    // Android, iOS and Windows packaging have never run. If those jobs fired on
    // every push, a green tick would read as device evidence that does not exist.
    const src = sources.get("platforms.yml")!;
    expect(src).toMatch(/workflow_dispatch/);
    expect(src).toMatch(/NOT YET VERIFIED/i);
  });

  it("runs the Rust safety tests in CI, where a linker exists", () => {
    // These cannot run locally: MSVC is absent and GNU coreutils `link`
    // shadows the linker. CI is the only place they can execute at all.
    const src = sources.get("ci.yml")!;
    expect(src).toMatch(/cargo test/);
    expect(src).toMatch(/windows-latest/);
  });
});
