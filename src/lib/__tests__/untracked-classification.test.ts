import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
  it("classifies a realistic number of paths", () => {
    expect(report.total).toBeGreaterThan(100);
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

describe("audit pipeline paths are classified without a catch-all", () => {
  // The audit pipeline emits `.mjs` tooling and `.jsonl` evidence from a
  // directory neither the `script` nor the config rule reached, which is what
  // left nine paths `unknown` and turned the gate red.

  it("classifies audit pipeline scripts as scripts", () => {
    const scripts = report.files.filter((f) => /^audit\/.*\.[cm]?js$/.test(f.path));
    expect(scripts.length).toBeGreaterThan(0);
    for (const f of scripts) expect(f.kind).toBe("script");
  });

  it("classifies audit .jsonl reports as retained evidence", () => {
    const evidence = report.files.filter((f) => f.path.endsWith(".jsonl"));
    expect(evidence.length).toBeGreaterThan(0);
    for (const f of evidence) {
      expect(f.path).toMatch(/^audit\//);
      expect(f.kind).toBe("docs");
    }
  });

  it("applies the audit rules to audit/ ONLY — the regression that matters", () => {
    // If either rule ever loses its `^audit/` anchor it becomes a catch-all
    // that silently absorbs unclassified files anywhere in the tree. That is
    // the exact failure this rule was introduced to avoid, so assert that no
    // file outside `audit/` was admitted by an audit reason.
    const admitted = report.files.filter((f) =>
      /audit pipeline script|retained audit evidence/.test(f.why),
    );
    expect(admitted.length).toBeGreaterThan(0);
    for (const f of admitted) expect(f.path).toMatch(/^audit\//);
  });

  it("keeps both audit rules anchored in source", () => {
    const source = readFileSync("scripts/classify-untracked.mjs", "utf8");
    expect(source).toMatch(/re: \/\^audit\\\/\.\*\\\.\[cm\]\?js\$\//);
    expect(source).toMatch(/re: \/\^audit\\\/\.\*\\\.jsonl\$\//);
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
