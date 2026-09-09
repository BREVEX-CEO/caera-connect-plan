import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { classifyUnavailable, type UnavailableCopy } from "../unavailable-reason";

/**
 * DEFECT UI-01. Three routes rendered EVERY load failure as "needs the database
 * migration" and spliced the raw exception message into the user-facing
 * paragraph. A dropped connection was reported as a missing schema, and an
 * internal message ("No Start context found in AsyncLocalStorage…") was shown
 * to the reader as product copy.
 */

const COPY: UnavailableCopy = {
  migrationTitle: "Projects need the database migration",
  migrationNote: "The migration and RLS policies are prepared and ready to apply.",
  loadTitle: "Projects couldn't be loaded",
};

describe("a missing table is the only thing reported as a missing migration", () => {
  it.each([
    'relation "public.ocade_projects" does not exist',
    "Could not find the table 'public.ocade_projects' in the schema cache",
    "PGRST205: table not found",
    'error 42P01: relation "ocade_automations" does not exist',
  ])("recognises %s", (message) => {
    const state = classifyUnavailable(new Error(message), COPY);
    expect(state.migrationMissing).toBe(true);
    expect(state.title).toBe(COPY.migrationTitle);
    expect(state.description).toBe(COPY.migrationNote);
  });
});

describe("every other failure is NOT blamed on the migration", () => {
  it.each([
    // The exact string that surfaced in the component audit.
    "No Start context found in AsyncLocalStorage. Make sure you are using the function within the server runtime.",
    "Failed to fetch",
    "NetworkError when attempting to fetch resource.",
    "JWT expired",
    "new row violates row-level security policy for table",
    "Internal Server Error",
    "",
  ])("does not claim a missing migration for %s", (message) => {
    const state = classifyUnavailable(new Error(message), COPY);
    expect(state.migrationMissing).toBe(false);
    expect(state.title).toBe(COPY.loadTitle);
    expect(state.description).not.toMatch(/migration/i);
  });

  it("names the connection when the connection is what failed", () => {
    const state = classifyUnavailable(new Error("Failed to fetch"), COPY);
    expect(state.description).toMatch(/connection failed/i);
  });
});

describe("a raw exception message never becomes user-facing prose", () => {
  const internal =
    "No Start context found in AsyncLocalStorage. Make sure you are using the function within the server runtime.";

  it("keeps the raw text out of the title and description", () => {
    const state = classifyUnavailable(new Error(internal), COPY);
    expect(state.title).not.toContain("AsyncLocalStorage");
    expect(state.description).not.toContain("AsyncLocalStorage");
  });

  it("still surfaces it as a separately-labelled technical detail", () => {
    const state = classifyUnavailable(new Error(internal), COPY);
    expect(state.detail).toBe(internal);
  });

  it("reports no detail at all when there is no message to report", () => {
    expect(classifyUnavailable(new Error(""), COPY).detail).toBeNull();
    expect(classifyUnavailable(undefined, COPY).detail).toBeNull();
  });

  it("accepts a bare string as well as an Error", () => {
    expect(classifyUnavailable("Failed to fetch", COPY).description).toMatch(/connection failed/i);
  });
});

/**
 * The guard that stops the defect coming back by a different route: no caller
 * may interpolate an error into the copy again.
 */
describe("no route splices an error message into SetupRequiredState copy", () => {
  const ROUTES = [
    "src/routes/_authenticated/ocade.automations.tsx",
    "src/routes/_authenticated/settings.usage.tsx",
  ];

  it.each(ROUTES)("%s classifies rather than interpolating", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toContain("classifyUnavailable");
    // The original defect, verbatim in shape: `${unavailable} …` inside copy.
    expect(source).not.toMatch(/description=\{`\$\{unavailable\}/);
  });

  it("Projects keeps its description static and labels the error as technical detail", () => {
    const source = readFileSync("src/routes/_authenticated/ocade.projects.tsx", "utf8");
    expect(source).toContain(
      'description="Projects, their files and saved outputs live in your account.',
    );
    expect(source).toContain("detail={unavailable}");
    expect(source).not.toMatch(/description=\{`\$\{unavailable\}/);
  });
});
