import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * No-Dead-Button policy, enforced against the actual JSX.
 *
 * The feature registry encodes the policy — every control must act, navigate,
 * open a setup flow, or honestly explain why it cannot — but nothing ever
 * checked the rendered controls against it. `scripts/check-dead-controls.mjs`
 * scans every component and route; this suite keeps it wired in and pins the
 * specific controls that were repaired.
 */

const GATE = "scripts/check-dead-controls.mjs";

function runGate(): { ok: boolean; stdout: string } {
  try {
    return {
      ok: true,
      stdout: execFileSync(process.execPath, [GATE], { encoding: "utf8" }),
    };
  } catch (error) {
    const e = error as { stdout?: string };
    return { ok: false, stdout: e.stdout ?? "" };
  }
}

describe("no dead controls remain", () => {
  const result = runGate();

  it("passes across every component and route", () => {
    expect(result.ok, result.stdout).toBe(true);
    expect(result.stdout).toContain("No dead controls found");
  });

  it("actually scanned a meaningful number of files", () => {
    // Guards against a silent pass caused by scanning nothing.
    const m = /scanned (\d+) component and route files/.exec(result.stdout);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(100);
  });
});

describe("the composer never offers a Stop it cannot honour", () => {
  const ocade = readFileSync("src/routes/_authenticated/ocade.tsx", "utf8");

  it("makes onStop optional so a surface can decline to offer it", () => {
    // It was REQUIRED, which forced `onStop={() => {}}` on the home composer —
    // a red Stop button that did nothing when clicked.
    expect(ocade).toMatch(/onStop\?: \(\) => void;/);
  });

  it("renders Stop only when a real handler exists", () => {
    expect(ocade).toMatch(/streaming && onStop \? \(/);
  });

  it("no longer passes an empty stop handler anywhere", () => {
    // Comments are stripped first: the prop's own doc comment QUOTES the old
    // `onStop={() => {}}` to explain why the prop is optional, and that
    // explanation must not be mistaken for the defect it describes.
    const code = ocade.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(code).not.toMatch(/onStop=\{\(\) => \{\s*\}\}/);
    expect(code).not.toMatch(/onStop=\{\(\) => \{\s*\/\*[\s\S]*?\*\/\s*\}\}/);
  });

  it("disables Send while in flight instead of faking a Stop", () => {
    expect(ocade).toMatch(/disabled=\{streaming \|\| \(!draft\.trim\(\)/);
  });
});

describe("blocked controls explain themselves to assistive technology", () => {
  it("the run controls name the prerequisite and point at the badge", () => {
    const ocade = readFileSync("src/routes/_authenticated/ocade.tsx", "utf8");
    // A "Setup Required" badge NEXT TO a button is not programmatically
    // associated with it: a screen reader would announce "Pause, dimmed" alone.
    expect(ocade).toMatch(/id="run-controls-setup-required"/);
    const described = ocade.match(/aria-describedby="run-controls-setup-required"/g) ?? [];
    expect(described.length).toBe(3); // Pause, Stop, Replay
    expect(ocade).toMatch(/title="Pause is available once the Native Companion is connected\."/);
  });

  it("demo-mode controls say they are disabled BECAUSE of demo mode", () => {
    const files = readFileSync("src/routes/demo.files.tsx", "utf8");
    const madee = readFileSync("src/routes/demo.madee.tsx", "utf8");
    expect(files).toMatch(/title="Uploads are disabled in demo mode/);
    expect(files).toMatch(/aria-label="Upload \(disabled in demo mode\)"/);
    expect(madee).toMatch(/title="Exporting is disabled in demo mode/);
    expect(madee).toMatch(/aria-label="Export PDF \(disabled in demo mode\)"/);
  });
});

describe("the audit is wired in permanently", () => {
  it("is exposed as an npm script", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["controls:check"]).toBe("node scripts/check-dead-controls.mjs");
  });

  it("runs in CI, so a new dead control fails the build", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(ci).toContain("npm run controls:check");
  });
});
