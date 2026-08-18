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
  const ocade = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");

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
  it("Control + Work is its own screen and never bounces back to Chat", () => {
    /*
     * This used to assert the OPPOSITE — that /ocade/work redirected to /ocade.
     * A redirect made the two sections one place while the navigation offered
     * them as two, so choosing "Control + Work" silently put the user in Chat.
     * Chat answers and Control + Work acts on the machine; a control that
     * quietly lands somewhere else is the dead control this file exists to
     * catch, whatever the destination.
     */
    const ocade = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");
    const work = readFileSync("src/routes/_authenticated/ocade.work.tsx", "utf8");
    expect(ocade).not.toMatch(/run-controls-setup-required/);
    expect(work).not.toMatch(/redirect\(/);
    expect(work).toMatch(/ControlWorkPanel/);
  });

  it("demo-mode controls say WHY they are unavailable, not just that they are", () => {
    /*
     * This used to check the demo Files page, which was a separate top-level
     * product inside a product that has one. Files are a tool inside a
     * conversation now, so the control that is genuinely unavailable in the
     * demo is attachment upload in the composer — and it carries a reason
     * naming the fix rather than a bare disabled state.
     */
    const demo = readFileSync("src/routes/demo.ocade.tsx", "utf8");
    expect(demo).toMatch(/imageDisabledReason=/);
    expect(demo).toMatch(/create an account/i);
  });

  it("the demo no longer claims its replies are canned", () => {
    // The demo runs the real on-device engine. Copy left over from when it did
    // not would now be a false statement in the other direction.
    const demo = readFileSync("src/routes/demo.ocade.tsx", "utf8");
    const code = demo.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(code).not.toMatch(/replies are canned/i);
    expect(code).not.toMatch(/no model is running/i);
    expect(code).not.toMatch(/sign in to talk to a real engine/i);
  });
});

describe("the retired products are placeholders, not half-built screens", () => {
  /*
   * The failure this guards against is a placeholder that quietly grows back
   * into a product: a link to a removed page, a data fetch, a table of sample
   * employees. Each route must render one page and say the same sentence.
   */
  const RETIRED = ["ficia", "madee", "cania"] as const;

  it("each retired route says exactly what it is", () => {
    for (const name of RETIRED) {
      const source = readFileSync(`src/routes/_authenticated/${name}.tsx`, "utf8");
      expect(source).toMatch(/<ComingLater/);
    }
    const placeholder = readFileSync("src/components/shell/ComingLater.tsx", "utf8");
    expect(placeholder).toContain("Coming later — not an AI model.");
  });

  it("no retired route loads product data or unfinished screens", () => {
    for (const name of RETIRED) {
      const source = readFileSync(`src/routes/_authenticated/${name}.tsx`, "utf8");
      expect(source).not.toMatch(/supabase|useQuery|createServerFn|\.functions/);
      // A single screen. Sub-routes were the unfinished dashboards.
      expect(source).not.toMatch(/<Outlet/);
    }
  });

  it("their navigation offers no sub-pages that no longer exist", () => {
    const nav = readFileSync("src/lib/shell-nav.ts", "utf8");
    for (const dead of [
      "/people",
      "/roles",
      "/messenger",
      "/time",
      "/madee/new",
      "/cania/search",
    ]) {
      expect(nav).not.toContain(`"${dead}"`);
    }
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
