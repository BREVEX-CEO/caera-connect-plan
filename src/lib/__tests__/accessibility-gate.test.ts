import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The accessibility gate — proving it bites (P19.S04).
 *
 * The tracked baseline is zero. A zero-defect gate that could not detect a
 * newly broken component would be decoration, so these drive the real gate
 * against deliberately inaccessible temporary TSX fixtures.
 */
const GATE = "scripts/check-accessibility.mjs";
const BASELINE = "release/OCADE_A11Y_BASELINE.json";
const ORIGINAL = readFileSync(BASELINE, "utf8");
const scratch = mkdtempSync(join(tmpdir(), "ocade-a11y-"));

function runGate(options?: { baselinePath?: string; scanRoots?: string }) {
  try {
    const stdout = execFileSync(process.execPath, [GATE], {
      encoding: "utf8",
      env: {
        ...process.env,
        ...(options?.baselinePath ? { OCADE_A11Y_BASELINE: options.baselinePath } : {}),
        ...(options?.scanRoots ? { OCADE_A11Y_SCAN_ROOTS: options.scanRoots } : {}),
      },
    });
    return { ok: true, out: stdout };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("the accessibility gate", () => {
  it("passes against the recorded baseline", () => {
    const r = runGate();
    expect(r.ok).toBe(true);
    expect(r.out).toMatch(/No statically decidable keyboard or screen-reader defects found/);
  });

  it("is exposed as the repository accessibility command", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["a11y:check"]).toBe("node scripts/check-accessibility.mjs");
  });

  it("is enforced by hosted CI", () => {
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).toContain("npm run a11y:check");
  });

  it("FAILS on a real unlabelled input regression", () => {
    const fixture = join(scratch, "unlabelled");
    mkdirSync(fixture, { recursive: true });
    writeFileSync(join(fixture, "Broken.tsx"), "export const Broken = () => <input />;");
    const r = runGate({ scanRoots: fixture });
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(/REGRESSION/);
    expect(r.out).toMatch(/rose from 0/);
    expect(r.out).toMatch(/unlabelled-input/);
  });

  it("FAILS on a real pointer-only custom control regression", () => {
    const fixture = join(scratch, "pointer-only");
    mkdirSync(fixture, { recursive: true });
    writeFileSync(
      join(fixture, "Broken.tsx"),
      "export const Broken = () => <div onClick={() => alert('x')}>Act</div>;",
    );
    const r = runGate({ scanRoots: fixture });
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(/pointer-only-control/);
  });

  it("records what it deliberately does NOT check", () => {
    // An approximate contrast check that passes is worse than none, because it
    // retires the question. The gate must say so rather than imply coverage.
    const r = runGate();
    expect(r.out).toMatch(/colour contrast/);
    expect(r.out).toMatch(/needs computed styles/);
  });

  it("leaves the tracked baseline byte-identical", () => {
    expect(readFileSync(BASELINE, "utf8")).toBe(ORIGINAL);
    rmSync(scratch, { recursive: true, force: true });
  });
});
