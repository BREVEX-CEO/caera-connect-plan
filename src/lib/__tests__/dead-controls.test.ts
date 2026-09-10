import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every product source file, so a claim cannot survive by moving.
 *
 * Tests are excluded: this asserts what the PRODUCT says, and a test that
 * quotes the forbidden phrase in order to forbid it is not a false claim.
 */
function productSources(root = "src"): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      found.push(...productSources(path));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

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
  // The composer left the Chat route in the Phase 1 split; read where it lives.
  const ocade = readFileSync("src/components/ocade/chat/ChatComposer.tsx", "utf8");
  const route = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");

  it("makes onStop optional so a surface can decline to offer it", () => {
    // It was REQUIRED, which forced `onStop={() => {}}` on the home composer —
    // a red Stop button that did nothing when clicked.
    expect(ocade).toMatch(/onStop\?: \(\) => void;/);
  });

  it("renders Stop only when a real handler exists", () => {
    expect(ocade).toMatch(/streaming && onStop \? \(/);
  });

  it("no longer passes an empty stop handler anywhere", () => {
    // Read from the ROUTE, which is what mounts the composer and could pass a
    // no-op. Comments are stripped first: the prop's own doc comment QUOTES the
    // old `onStop={() => {}}` to explain why the prop is optional, and that
    // explanation must not be mistaken for the defect it describes.
    const code = route
      .concat(ocade)
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    expect(code).not.toMatch(/onStop=\{\(\) => \{\s*\}\}/);
    expect(code).not.toMatch(/onStop=\{\(\) => \{\s*\/\*[\s\S]*?\*\/\s*\}\}/);
  });

  it("disables Send while in flight instead of faking a Stop", () => {
    expect(ocade).toMatch(/disabled=\{streaming \|\| \(!draft\.trim\(\)/);
  });
});

describe("blocked controls explain themselves to assistive technology", () => {
  it("Cowork is its own screen and never bounces back to Chat", () => {
    /*
     * This used to assert the OPPOSITE — that `/ocade/work` redirected to
     * `/ocade`. A redirect made the two sections one place while the navigation
     * offered them as two, so choosing "Control + Work" silently put the user
     * in Chat. Chat answers and Cowork acts on the machine; a control that
     * quietly lands somewhere else is the dead control this file exists to
     * catch, whatever the destination.
     *
     * PLAN.md §4 has since moved the room to `/ocade/cowork` and made it one of
     * the three primary modes. The rule is unchanged and now applies to the
     * canonical path: the room renders itself. `/ocade/work` DOES redirect now,
     * and that is a forwarding address rather than a bounce — it goes to the
     * room, not away from it, which is asserted separately below.
     */
    const ocade = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");
    const cowork = readFileSync("src/routes/_authenticated/ocade.cowork.tsx", "utf8");
    expect(ocade).not.toMatch(/run-controls-setup-required/);
    expect(cowork).not.toMatch(/redirect\(/);
    // The room, which renders the panel. Phase 9 put `CoworkRoom` between them
    // so Normal and Jarvis share one mission; the route still lands in Cowork.
    expect(cowork).toMatch(/CoworkRoom/);
  });

  it("the old Cowork address forwards to the room, not to Chat", () => {
    // A migration that sends people somewhere OTHER than the thing they asked
    // for is the same defect the test above exists to catch, wearing a
    // migration's clothes.
    const forwarding = readFileSync("src/routes/_authenticated/ocade.work.tsx", "utf8");
    expect(forwarding).toMatch(/redirect\(\{ to: "\/ocade\/cowork"/);
    expect(forwarding).not.toMatch(/to: "\/ocade"[,}]/);
  });

  it("a gated composer control says WHY it is unavailable, not just that it is", () => {
    /*
     * A capability limit and an account gate are different answers, and a bare
     * disabled state gives neither. The menu carries a `disabledReason` for the
     * capability case and routes the account case to sign-in instead of
     * disabling — so no control is ever both dead and silent.
     */
    /*
     * WHAT REPLACED THE MENU. `ComposerMenu.tsx` carried this rule and nothing
     * rendered it — the shipped composer has its own attach controls. The rule
     * survives on the control people can actually press: every icon button
     * carries a `title`, which is also its accessible name, so no control in
     * the row is both unavailable and silent about it.
     */
    const composer = readFileSync("src/components/ocade/chat/ChatComposer.tsx", "utf8");
    expect(composer).toMatch(/aria-label=\{title\}/);
    const untitled = [...composer.matchAll(/<ComposerIcon\b([\s\S]*?)>/g)].filter(
      (match) => !/\btitle=/.test(match[1]!),
    );
    expect(untitled, "a composer icon offers no name for what it does").toHaveLength(0);
  });

  it("no reachable surface claims its replies are canned", () => {
    /*
     * OCADE runs a real engine on the device, or names an honest unavailable
     * state. Copy left over from a fixed-string era would now be false in the
     * other direction — a product understating itself is still a product
     * describing something that is not happening.
     */
    for (const file of productSources()) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
      expect(code, file).not.toMatch(/replies are canned/i);
      expect(code, file).not.toMatch(/no model is running/i);
      expect(code, file).not.toMatch(/sign in to talk to a real engine/i);
    }
  });
});

describe("the retired products are historical redirects, not half-built screens", () => {
  /*
   * The failure this guards against is a retired route quietly growing back
   * into a product: a data fetch, a table of sample employees, or a decorative
   * unavailable screen that looks actionable. Historic deep links must land in
   * the supported OCADE workspace before any unavailable UI can render.
   */
  const RETIRED = ["ficia", "madee", "cania"] as const;

  it("each retired route redirects before it renders an unavailable product", () => {
    for (const name of RETIRED) {
      const source = readFileSync(`src/routes/_authenticated/${name}.tsx`, "utf8");
      expect(source).toMatch(/beforeLoad/);
      expect(source).toMatch(/throw redirect\(\{ to: "\/ocade", replace: true \}\)/);
      expect(source).not.toMatch(/ComingLater/);
    }
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
    const parity = readFileSync("scripts/verify-full.mjs", "utf8");
    expect(ci).toContain("npm run verify:full");
    expect(parity).toContain('"controls:check"');
  });
});
