import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
// @ts-expect-error — plain .mjs tool script, no type declarations by design.
import { classifyPath } from "../../../scripts/classify-untracked.mjs";

/**
 * Untracked-file classification (spec §4.3, §15.1, §19.1).
 *
 * §19.1 requires "no unclassified untracked source remains" before a commit,
 * and §15.1 is emphatic that `git add -A` must never be the first move on a
 * tree with hundreds of untracked paths. Classifying them needs no device,
 * credential or toolchain — so this was never externally blocked, it had simply
 * never been done.
 *
 * The classifier is the pre-commit worksheet: what to stage, what to ignore,
 * and what still needs a human. These tests keep it honest in the one direction
 * that matters — it must never wave a real secret through.
 */

/**
 * The classifier EXITS NON-ZERO when something needs a human — that is the
 * point of it. `execFileSync` throws on a non-zero exit, so the report must be
 * read from stdout either way; otherwise a correct refusal would crash this
 * suite instead of being asserted on.
 */
function runClassifier(): string {
  const options = {
    encoding: "utf8" as const,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  };
  try {
    return execFileSync(process.execPath, ["scripts/classify-untracked.mjs", "--json"], options);
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout;
    if (!stdout) throw error;
    return stdout;
  }
}

const report = JSON.parse(runClassifier()) as {
  total: number;
  counts: Record<string, number>;
  needsHuman: Array<{ path: string; kind: string; why: string }>;
  files: Array<{ path: string; kind: string; why: string; bytes: number }>;
};

describe("every untracked path is accounted for", () => {
  it("reports a self-consistent file list", () => {
    // NOT `total > 100`. Once the tree is fully committed the untracked set is
    // legitimately EMPTY, and an assertion that demands untracked files would
    // fail precisely when the repository is in its healthiest state. The rules
    // themselves are asserted directly in the suite below, against synthetic
    // paths, so coverage does not depend on the tree being messy.
    expect(report.files).toHaveLength(report.total);
  });

  it("leaves nothing unclassified", () => {
    // This is the §19.1 requirement itself.
    const unknown = report.files.filter((f) => f.kind === "unknown");
    expect(unknown.map((f) => f.path)).toEqual([]);
  });

  it("gives every file a reason, not just a label", () => {
    const unexplained = report.files.filter((f) => !f.why || f.why.trim().length === 0);
    expect(unexplained).toEqual([]);
  });

  it("counts reconcile with the file list", () => {
    const recomputed = report.files.reduce<Record<string, number>>((acc, f) => {
      acc[f.kind] = (acc[f.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(recomputed).toEqual(report.counts);
  });
});

describe("it never waves a secret through", () => {
  it("reports no real secret in the untracked tree", () => {
    const secrets = report.files.filter((f) => f.kind === "secret");
    expect(secrets.map((f) => f.path)).toEqual([]);
  });

  it("separates synthetic TEST fixtures from real credentials", () => {
    // A test asserting that a redactor catches `sk-…` must contain a
    // credential-SHAPED string or it asserts nothing. Those are surfaced as
    // `test-fixture` — staged after review — never silently reclassified as
    // ordinary source.
    const fixtures = report.files.filter((f) => f.kind === "test-fixture");
    for (const f of fixtures) {
      expect(f.path).toMatch(/__tests__|\.(test|spec)\./);
      expect(f.why).toMatch(/synthetic/i);
    }
  });

  it("only exempts files that are genuinely tests", () => {
    // The fixture exemption must not become a hiding place: it applies only
    // where the path itself proves the file is a test.
    const source = readFileSync("scripts/classify-untracked.mjs", "utf8");
    expect(source).toMatch(/if \(rule\.kind === "test"\)/);
  });

  it("treats an environment file or private key as a secret by PATH alone", () => {
    const source = readFileSync("scripts/classify-untracked.mjs", "utf8");
    expect(source).toMatch(/kind: "secret", why: "environment file"/);
    expect(source).toMatch(/pem\|key\|p12\|pfx\|keystore\|jks\|mobileprovision/);
  });

  it("lets content override a benign-looking path", () => {
    // A file that looks like source but CONTAINS a credential is a secret first.
    const source = readFileSync("scripts/classify-untracked.mjs", "utf8");
    expect(source).toMatch(/Path shape must never override content/);
  });
});

describe("build output and weights are never staged", () => {
  for (const kind of ["generated", "cache", "log", "temp", "model-weight"]) {
    it(`recognises ${kind}`, () => {
      const source = readFileSync("scripts/classify-untracked.mjs", "utf8");
      expect(source).toContain(`kind: "${kind}"`);
    });
  }

  it("classifies no build output as stageable source", () => {
    const misfiled = report.files.filter(
      (f) =>
        /(^|\/)(node_modules|dist|\.output|coverage|target)\//.test(f.path) && f.kind === "source",
    );
    expect(misfiled).toEqual([]);
  });
});

describe("the rules classify synthetic paths correctly", () => {
  // These EXECUTE the classifier against paths that need not exist, so they
  // keep asserting after the tree is fully committed and the untracked set is
  // empty. `sniff` is stubbed to "no credential" so path rules are isolated.
  const noSniff = () => false;
  const kindOf = (p: string) => classifyPath(p, 0, noSniff).kind;

  it("routes audit pipeline scripts to `script`", () => {
    expect(kindOf("audit/ocade-master-audit/process-document.mjs")).toBe("script");
    expect(kindOf("audit/x/y.js")).toBe("script");
    expect(kindOf("audit/deep/nested/tool.cjs")).toBe("script");
  });

  it("routes audit .jsonl reports to `docs`", () => {
    expect(kindOf("audit/ocade-master-audit/out/OCADE_LINE_COVERAGE.jsonl")).toBe("docs");
  });

  it("applies the audit rules to audit/ ONLY — the regression that matters", () => {
    // If either rule loses its `^audit/` anchor it becomes a catch-all that
    // silently absorbs unclassified files anywhere in the tree. This is the
    // exact failure the anchor exists to prevent, and it is now provable
    // without needing such a file to exist on disk.
    expect(kindOf("elsewhere/report.jsonl")).toBe("unknown");
    expect(kindOf("notaudit/tool.mjs")).toBe("unknown");
    // `src/audit/...` is NOT the audit pipeline — the anchor is `^audit/`, so
    // the ordinary source rule claims it. Proves the anchor is a prefix match,
    // not a substring match.
    expect(kindOf("src/audit/tool.mjs")).toBe("source");
  });

  it("still classifies the pre-existing categories", () => {
    expect(kindOf("src/lib/thing.ts")).toBe("source");
    expect(kindOf("src/lib/__tests__/thing.test.ts")).toBe("test");
    expect(kindOf("supabase/migrations/001_x.sql")).toBe("migration");
    expect(kindOf("scripts/check-x.mjs")).toBe("script");
    expect(kindOf("release/NOTES.md")).toBe("docs");
    expect(kindOf("public/logo.png")).toBe("asset");
    expect(kindOf("android/app/build.gradle")).toBe("platform-config");
    expect(kindOf("wrangler.json")).toBe("config");
  });

  it("treats secrets and build output as never-stage, by path", () => {
    expect(kindOf(".env")).toBe("secret");
    expect(kindOf("certs/server.pem")).toBe("secret");
    expect(kindOf("models/llama.gguf")).toBe("model-weight");
    expect(kindOf("dist/app.js")).toBe("generated");
    expect(kindOf("node_modules/x/index.js")).toBe("generated");
  });

  it("lets credential CONTENT override a benign-looking path", () => {
    const withSecret = () => true;
    expect(classifyPath("src/lib/thing.ts", 10, withSecret).kind).toBe("secret");
    // ...except in a genuine test, where a credential-shaped fixture is the
    // point — surfaced separately, never silently reclassified.
    expect(classifyPath("src/lib/__tests__/redact.test.ts", 10, withSecret).kind).toBe(
      "test-fixture",
    );
  });
});

describe("the classifier is available and blocks on a human decision", () => {
  it("is exposed as an npm script", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["untracked:classify"]).toContain("classify-untracked.mjs");
  });

  it("exits non-zero when anything needs a human", () => {
    const source = readFileSync("scripts/classify-untracked.mjs", "utf8");
    expect(source).toMatch(/process\.exit\(needsHuman\.length === 0 \? 0 : 1\)/);
  });

  it("currently needs no human decision", () => {
    expect(report.needsHuman).toEqual([]);
  });
});

describe("tool scripts are classified whatever language they are written in", () => {
  const noSniff = () => false;
  const kindOf = (p: string) => classifyPath(p, 0, noSniff).kind;

  it("classifies TypeScript tool scripts, not just JavaScript ones", () => {
    // A .mts runtime-evidence harness under scripts/ was left `unknown` and
    // turned the gate red. Tool scripts are increasingly TypeScript run through
    // vite-node; the rule must not be tied to one file extension family.
    for (const p of [
      "scripts/x.js",
      "scripts/x.mjs",
      "scripts/x.cjs",
      "scripts/x.ts",
      "scripts/x.mts",
      "scripts/x.cts",
    ]) {
      expect(kindOf(p)).toBe("script");
    }
  });

  it("does not turn `scripts/` into a catch-all for any file at all", () => {
    expect(kindOf("scripts/notes.md")).toBe("docs");
    expect(kindOf("scripts/data.bin")).toBe("model-weight");
    expect(kindOf("scripts/weird.xyz")).toBe("unknown");
  });
});
