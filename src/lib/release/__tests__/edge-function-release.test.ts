import { describe, expect, it } from "vitest";
import {
  currentRelease,
  edgeFunctionSources,
  hashSources,
  ledgerProblems,
  previousRelease,
  proveRollback,
  readLedger,
  verifyWorkingTree,
  workingTreeReader,
} from "../../../../scripts/edge-function-release.mjs";

/*
 * EDGE FUNCTION ROLLBACK -- PLAN.md Phase 16.
 *
 * Phase 16 wants "versioned releases and previous application/Edge Function/
 * Cloudflare rollback", and the Edge Function was the one with no answer:
 * Supabase counts the deployed versions, and nothing here recorded which
 * source each number was. The ledger fixes that, and the test that matters is
 * the last one -- it reconstructs the deployed version's source out of git and
 * proves it hashes identically, so "roll back" is a thing that has been done
 * rather than a thing that is written down.
 */

const files = new Map<string, string>([
  [
    "supabase/functions/f/index.ts",
    `import { createClient } from "npm:@supabase/supabase-js@2.110.7";\n` +
      `import { handler } from "../../../src/lib/handler.ts";\n`,
  ],
  ["src/lib/handler.ts", `import type { T } from "./contract.ts";\nexport const handler = 1;\n`],
  ["src/lib/contract.ts", `export type T = string;\n`],
  ["src/lib/unrelated.ts", `export const nobody = "imports this";\n`],
]);
const read = (file: string) => files.get(file) ?? null;

describe("what actually gets deployed", () => {
  it("follows local imports through the modules outside the functions directory", () => {
    // The Edge Function's real risk: a change in `src/lib` changes what runs
    // in production while nothing under `supabase/functions/` was touched.
    const { files: resolved } = edgeFunctionSources(read, "supabase/functions/f/index.ts");
    expect(resolved).toEqual([
      "src/lib/contract.ts",
      "src/lib/handler.ts",
      "supabase/functions/f/index.ts",
    ]);
    expect(resolved).not.toContain("src/lib/unrelated.ts");
  });

  it("records a remote import as a specifier rather than trying to hash it", () => {
    const { remote } = edgeFunctionSources(read, "supabase/functions/f/index.ts");
    expect(remote).toEqual(["npm:@supabase/supabase-js@2.110.7"]);
  });

  it("survives a missing file instead of throwing mid-walk", () => {
    const { files: resolved } = edgeFunctionSources(
      (file: string) => (file === "a.ts" ? `import "./gone.ts";\n` : null),
      "a.ts",
    );
    expect(resolved).toEqual(["a.ts"]);
  });

  it("changes the hash when any deployed file changes, including a deep one", () => {
    const { files: resolved } = edgeFunctionSources(read, "supabase/functions/f/index.ts");
    const before = hashSources(read, resolved).sourceHash;

    const edited = new Map(files);
    edited.set("src/lib/contract.ts", `export type T = number;\n`);
    const after = hashSources((f: string) => edited.get(f) ?? null, resolved).sourceHash;

    expect(after).not.toBe(before);
    expect(before).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not depend on the order the files are listed in", () => {
    const resolved = ["src/lib/handler.ts", "supabase/functions/f/index.ts"];
    expect(hashSources(read, resolved).sourceHash).toBe(
      hashSources(read, [...resolved].reverse()).sourceHash,
    );
  });
});

describe("the ledger's own rules", () => {
  const release = {
    version: 2,
    recordedAt: "2026-09-10T00:00:00.000Z",
    commit: "5b967735267fb650df63d02d76788ba620353cc4",
    sourceHash: "a".repeat(64),
    files: [{ file: "supabase/functions/f/index.ts", sha256: "b".repeat(64) }],
  };

  it("accepts a well-formed ledger", () => {
    expect(ledgerProblems({ schemaVersion: 1, releases: [release] })).toEqual([]);
  });

  it("refuses a version recorded twice, which is how a rewrite hides", () => {
    expect(ledgerProblems({ schemaVersion: 1, releases: [release, { ...release }] })).toContain(
      "a version is recorded twice",
    );
  });

  it("refuses a release with no files or an unusable hash", () => {
    expect(ledgerProblems({ schemaVersion: 1, releases: [{ ...release, files: [] }] })).toContain(
      "release 2: no files recorded",
    );
    expect(
      ledgerProblems({ schemaVersion: 1, releases: [{ ...release, sourceHash: "short" }] }),
    ).toContain("release 2: source hash is not a sha256");
  });

  it("refuses to keep anything secret-shaped, because this file is committed", () => {
    const poisoned = {
      schemaVersion: 1,
      releases: [{ ...release, note: "AIzaSyD-EXAMPLE-EXAMPLE-EXAMPLE-EXAMPLE0" }],
    };
    expect(ledgerProblems(poisoned)).toContain("a secret-shaped value is recorded");
  });

  it("orders releases so current and previous mean what they say", () => {
    const ledger = {
      schemaVersion: 1,
      releases: [
        { ...release, version: 3 },
        { ...release, version: 1 },
        { ...release, version: 2 },
      ],
    };
    expect(currentRelease(ledger)?.version).toBe(3);
    expect(previousRelease(ledger)?.version).toBe(2);
    expect(previousRelease({ schemaVersion: 1, releases: [release] })).toBeNull();
  });
});

describe("the ledger this repository actually ships", () => {
  const ledger = readLedger();

  it("is usable and records the deployed version", () => {
    expect(ledgerProblems(ledger)).toEqual([]);
    expect(currentRelease(ledger)).not.toBeNull();
    expect(currentRelease(ledger)?.files.map((f) => f.file)).toContain(
      "supabase/functions/ocade-intelligence/index.ts",
    );
  });

  it("says plainly whether the working tree is the deployed source", () => {
    const verified = verifyWorkingTree(ledger, workingTreeReader());
    // "ahead" is the ordinary state between a change and its deployment. What
    // must never happen is a ledger with nothing in it while a function runs.
    expect(["matches", "ahead"]).toContain(verified.state);
    expect(verified.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("can rebuild the deployed version from git and hash it identically", () => {
    // The demonstration, not the description: this is a rollback performed.
    const proof = proveRollback(ledger);
    expect(proof.detail).toContain("hashes identically");
    expect(proof.ok).toBe(true);
  });

  it("refuses to claim a rollback it cannot reconstruct", () => {
    const unreachable = {
      schemaVersion: 1,
      releases: [
        {
          version: 9,
          recordedAt: "2026-09-10T00:00:00.000Z",
          commit: "0000000000000000000000000000000000000000",
          sourceHash: "c".repeat(64),
          files: [
            { file: "supabase/functions/ocade-intelligence/index.ts", sha256: "d".repeat(64) },
          ],
        },
      ],
    };
    const proof = proveRollback(unreachable);
    expect(proof.ok).toBe(false);
    expect(proof.detail).toMatch(/not in commit|does NOT hash/);
  });
});
