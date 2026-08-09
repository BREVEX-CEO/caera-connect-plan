import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * CI workflow guard.
 *
 * The Rust safety core CANNOT be tested on a developer machine without the MSVC
 * C++ build tools: `cargo test` fails at the link step, so the 10 safety
 * assertions (protected-text detection, prohibited typing, path-traversal
 * rejection, unapproved-app refusal, audit redaction) never execute locally.
 *
 * `windows-latest` ships that toolchain, so CI is the ONLY place those
 * assertions actually run. If the Rust job were deleted or its `cargo test`
 * step quietly downgraded to `cargo check`, the safety core would silently
 * return to being compile-verified only — and nothing would report the loss.
 * This suite pins the workflow so that regression is loud.
 *
 * It also pins the gates the web job must run: each of those gates has been
 * separately proven to FAIL on bad input, so running them is meaningful.
 */

const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

describe("the Rust safety core is executed somewhere", () => {
  it("declares a dedicated rust job", () => {
    expect(ci).toMatch(/^ {2}rust:/m);
  });

  it("runs the rust job on every desktop platform it ships to", () => {
    /*
     * Windows is the one that cannot be dropped — without MSVC the crate does
     * not link and `cargo test` cannot run at all, which is what the original
     * single-runner assertion protected.
     *
     * macOS and Linux are now required too. This crate decides what the
     * assistant is NOT allowed to do — protected text, prohibited typing, path
     * traversal — and the companion ships on all three. Proving those rules
     * hold on one platform proves them on one platform.
     */
    const rustJob = ci.slice(ci.indexOf("\n  rust:"), ci.indexOf("\n  worker-bundle:"));
    expect(rustJob).toMatch(/runs-on:\s*\$\{\{\s*matrix\.os\s*\}\}/);
    for (const os of ["windows-latest", "macos-latest", "ubuntu-latest"]) {
      expect(rustJob, `rust job does not cover ${os}`).toContain(os);
    }
  });

  it("typechecks, lints, tests and builds on every supported platform", () => {
    // The defects a single-platform build hides are specific: a backslash in a
    // path, a case-only import mismatch, a line-ending assumption.
    const buildJob = ci.slice(ci.indexOf("\n  build:"), ci.indexOf("\n  gates:"));
    for (const os of ["windows-latest", "macos-latest", "ubuntu-latest"]) {
      expect(buildJob, `build job does not cover ${os}`).toContain(os);
    }
    for (const step of ["npm run typecheck", "npm run lint", "npm run test", "npm run build"]) {
      expect(buildJob, `build job does not run ${step}`).toContain(step);
    }
    // A matrix that stops at the first red platform hides whether the break is
    // platform-specific, which is most of the diagnosis.
    expect(buildJob).toMatch(/fail-fast:\s*false/);
  });

  it("actually RUNS cargo test — not merely cargo check", () => {
    const rustJob = ci.slice(ci.indexOf("\n  rust:"), ci.indexOf("\n  audit:"));
    expect(rustJob).toMatch(/cargo test/);
  });

  it("points cargo at the safety crate", () => {
    expect(ci).toMatch(/working-directory:\s*native\/companion\/safety/);
  });

  it("also lints and format-checks the crate", () => {
    const rustJob = ci.slice(ci.indexOf("\n  rust:"), ci.indexOf("\n  audit:"));
    expect(rustJob).toMatch(/cargo fmt --check/);
    expect(rustJob).toMatch(/cargo clippy/);
    // A clippy run that does not fail on warnings is advisory, not a gate.
    expect(rustJob).toMatch(/-D warnings/);
  });
});

describe("the web job runs every gate that has been proven to enforce", () => {
  const required = [
    "npm run typecheck",
    "npm run lint",
    "npm run test",
    "npm run build",
    "npm run performance:budget",
    "npm run integration:source-check",
    "npm run release:source-check",
  ];

  for (const command of required) {
    it(`runs ${command}`, () => {
      expect(ci).toContain(command);
    });
  }

  it("only invokes npm scripts that actually exist", () => {
    const invoked = [...ci.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
    const missing = [...new Set(invoked)].filter((s) => !(s in pkg.scripts));
    expect(missing, `workflow calls undefined npm scripts: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("the surfaces that used to have no CI job at all", () => {
  /*
   * Worker and database deployment were both previously treated as partial source with the same
   * finding: "No extension CI job exists" / "No database CI job exists". Their
   * tests DID run, inside the web job's test step, which is why the gap was
   * easy to miss — a failure was attributed to "tests", and nothing named the
   * extension or the database as a thing CI covers.
   *
   * A named job is the difference between a red build somebody has to read and
   * a red build that says which surface broke.
   */
  it("gives the database its own job, not a step inside the test run", () => {
    expect(ci).toMatch(/^ {2}database:/m);
    const job = ci.slice(ci.indexOf("\n  database:"), ci.indexOf("\n  managed-browser:"));
    // The twin is the only thing that proves the migration set rebuilds from
    // zero; running only the SQL text assertions would pass on a broken set.
    expect(job).toContain("db-twin.test.ts");
    expect(job).toContain("supabase-sql-discipline.test.ts");
    expect(job).toContain("npm run supabase:types-check");
  });

  it("gives the extensionless managed browser host its own job", () => {
    expect(ci).toMatch(/^ {2}managed-browser:/m);
    const job = ci.slice(ci.indexOf("\n  managed-browser:"), ci.indexOf("\n  audit:"));
    expect(job).toContain("npm run browser:host-check");
    expect(job).toContain("managed-browser-bridge.test.ts");
  });

  it("needs no database service or credentials to run either", () => {
    // The twin is PostgreSQL in WebAssembly. If this ever grows a `services:`
    // block or a secret, the job stops being runnable on a fork's PR.
    const job = ci.slice(ci.indexOf("\n  database:"), ci.indexOf("\n  managed-browser:"));
    expect(job).not.toMatch(/services:/);
    expect(job).not.toMatch(/secrets\./);
  });
});

describe("dependency auditing", () => {
  it("audits the production dependency tree", () => {
    expect(ci).toMatch(/npm audit --omit=dev/);
  });
});

describe("workflow hygiene", () => {
  it("triggers on the working branch and on pull requests to main", () => {
    expect(ci).toMatch(/feat\/ocade-implementation/);
    expect(ci).toMatch(/pull_request:/);
  });

  it("embeds no credential-shaped literal", () => {
    expect(ci).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
    expect(ci).not.toMatch(/AKIA[0-9A-Z]{16}/);
    // Secrets must come from the secrets context, never be inlined.
    expect(ci).not.toMatch(/password:\s*['"][^'"]{6,}['"]/i);
  });

  it("does not deploy, publish or sign from CI", () => {
    // Release/signing belongs in the tag-triggered release workflow, under
    // human control — never on every push.
    expect(ci).not.toMatch(/\bnpx? wrangler deploy\b|\bnpm publish\b|\btauri-action\b/);
  });
});
