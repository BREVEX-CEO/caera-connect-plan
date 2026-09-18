import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A SUITE THAT STARTS POSTGRES MUST BE IN THE LANE THAT EXPECTS IT.
 *
 * `vitest.config.ts` runs `DatabaseTwin` suites one at a time because running
 * them in parallel exhausted memory, and the failure did not look like memory:
 * PGlite threw mid-handshake and Vitest reported every test in the file as
 * SKIPPED. A green run, with a schema suite contributing nothing.
 *
 * The lane is a hand-written list, so the protection is opt-in and the failure
 * of forgetting is invisible. `library-schema.test.ts` had been forgotten, and
 * eight entries named files Phase 1 deleted. This keeps the list honest in both
 * directions.
 */
const CONFIG = readFileSync("vitest.config.ts", "utf8");
/** Only the lane's own array — the unit project's globs live in the same file. */
const DECLARED = CONFIG.slice(
  CONFIG.indexOf("const DATABASE_BACKED = ["),
  CONFIG.indexOf("];", CONFIG.indexOf("const DATABASE_BACKED = [")),
);
const LANE = new Set([...DECLARED.matchAll(/"(src\/[^"]*\.test\.ts)"/g)].map((m) => m[1]));

/** The import statement, so neither the class name nor this file matches. */
const IMPORTS_TWIN = /from "[^"]*db-twin\.mts"/;
const usesPostgres = globSync("src/**/*.test.ts").filter((file) =>
  IMPORTS_TWIN.test(readFileSync(file, "utf8")),
);

describe("the serial database lane", () => {
  it("contains every suite that builds a real PostgreSQL", () => {
    expect(usesPostgres.length).toBeGreaterThan(0);
    expect(usesPostgres.filter((file) => !LANE.has(file))).toEqual([]);
  });

  it("names no suite that does not exist", () => {
    expect([...LANE].filter((file) => !usesPostgres.includes(file))).toEqual([]);
  });
});
