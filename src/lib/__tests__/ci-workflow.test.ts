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

  it("runs the rust job on a windows runner, which has the MSVC linker", () => {
    // Without MSVC the crate cannot link and `cargo test` cannot run at all.
    const rustJob = ci.slice(ci.indexOf("\n  rust:"), ci.indexOf("\n  audit:"));
    expect(rustJob).toMatch(/runs-on:\s*windows-latest/);
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
