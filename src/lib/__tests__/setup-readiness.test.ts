import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Setup readiness check — the credential/permission wizard.
 *
 * Its job is to turn "why doesn't PC control work" into a named prerequisite
 * and an exact remedy. Its danger is obvious: a script that inspects
 * credentials could leak them, or could report a present key as a working one.
 *
 * These tests pin both halves — that it explains every gap, and that it never
 * touches a secret value nor overstates what presence proves.
 */

const report = JSON.parse(
  execFileSync(process.execPath, ["scripts/check-setup.mjs", "--json"], {
    encoding: "utf8",
    timeout: 180_000,
  }),
) as {
  note: string;
  summary: { present: number; missing: number };
  results: Array<{
    id: string;
    capability: string;
    status: "present" | "missing";
    detail: string;
    action: string | null;
    unlocks: string;
  }>;
};

const source = readFileSync("scripts/check-setup.mjs", "utf8");

describe("every gap is actionable", () => {
  it("checks a meaningful set of prerequisites", () => {
    expect(report.results.length).toBeGreaterThanOrEqual(8);
  });

  it("gives every MISSING prerequisite a concrete action", () => {
    for (const r of report.results.filter((x) => x.status === "missing")) {
      expect(r.action, `${r.id} has no action`).toBeTruthy();
      expect(r.action!.length).toBeGreaterThan(30);
    }
  });

  it("says what each prerequisite unlocks, so it can be prioritised", () => {
    for (const r of report.results) {
      expect(r.unlocks.length).toBeGreaterThan(10);
    }
  });

  it("explains WHY a missing item is missing, not just that it is", () => {
    for (const r of report.results.filter((x) => x.status === "missing")) {
      expect(r.detail.length).toBeGreaterThan(10);
      expect(r.detail).not.toBe("missing");
    }
  });

  it("counts reconcile with the result list", () => {
    const present = report.results.filter((r) => r.status === "present").length;
    const missing = report.results.filter((r) => r.status === "missing").length;
    expect(report.summary).toEqual({ present, missing });
  });
});

describe("it never handles a secret value", () => {
  it("only ever tests PRESENCE of an env var", () => {
    // envPresent checks type and trimmed length. Nothing else reads the value.
    expect(source).toMatch(/function envPresent\(name\)/);
    expect(source).toMatch(/typeof value === "string" && value\.trim\(\)\.length > 0/);
  });

  it("never prints, logs or measures a credential value", () => {
    // No length reporting, no prefixes, no masking-that-still-reveals.
    expect(source).not.toMatch(/process\.env\[[^\]]+\]\.slice/);
    expect(source).not.toMatch(/\.length\s*\)\s*\}`/);
    expect(source).not.toMatch(/console\.log\([^)]*process\.env/);
  });

  it("emits no credential-shaped value in its own report", () => {
    const blob = JSON.stringify(report);
    expect(blob).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
    expect(blob).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(blob).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./);
  });

  it("reports each key as present or absent and nothing more", () => {
    for (const r of report.results) {
      expect(["present", "missing"]).toContain(r.status);
    }
  });
});

describe("it does not overstate what it knows", () => {
  it("says plainly that PRESENT does not mean WORKING", () => {
    // A present key can still be revoked, wrong-project or expired. Only a real
    // call proves otherwise, and this script makes none.
    expect(report.note).toMatch(/NOT that it is valid or working/i);
  });

  it("makes no network call and installs nothing", () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/npm install|apt-get|winget|choco install/);
    expect(source).not.toMatch(/writeFileSync|mkdirSync/);
  });

  it("exits 0 even with prerequisites missing", () => {
    // A fresh machine is not a broken build; treating it as one would train
    // people to ignore the check.
    expect(source).toMatch(/process\.exit\(0\)/);
  });
});

describe("it covers the prerequisites this project actually has", () => {
  const ids = new Set(report.results.map((r) => r.id));
  for (const id of [
    "supabase",
    "ai-gateway",
    "msvc",
    "android",
    "docker",
    "free-tools",
    "signing",
  ]) {
    it(`covers ${id}`, () => {
      expect(ids.has(id)).toBe(true);
    });
  }

  it("detects the unreplaced Tauri signing placeholder", () => {
    // The shipped config still carries REPLACE_WITH_SIGNING_PUBLIC_KEY; the
    // check must notice rather than assume signing is configured.
    const signing = report.results.find((r) => r.id === "signing")!;
    const conf = readFileSync("native/companion/tauri/tauri.conf.json", "utf8");
    if (conf.includes("REPLACE_WITH_SIGNING_PUBLIC_KEY")) {
      expect(signing.status).toBe("missing");
      expect(signing.detail).toMatch(/placeholder/i);
    }
  });

  it("is exposed as an npm script", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["setup:check"]).toContain("check-setup.mjs");
  });
});
