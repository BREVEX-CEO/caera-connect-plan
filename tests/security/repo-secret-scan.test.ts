/** KEY-06, KEY-08, KEY-12: history and artifact scanner finds secrets in old commits and binary files, passes clean ones. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/scan-repo-secrets.mjs");
const run = (cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
const git = (cwd: string, ...args: string[]) =>
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    cwd,
    encoding: "utf8",
  });
const fakeKey = "AKIA" + "ABCDEFGHIJKLMNOP";

test("a key committed then deleted is still found in history, and the value is never printed", () => {
  const dir = mkdtempSync(join(tmpdir(), "ocade-hist-"));
  try {
    git(dir, "init", "-q");
    writeFileSync(join(dir, "a.txt"), `key=${fakeKey}\n`);
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "one");
    writeFileSync(join(dir, "a.txt"), "clean\n");
    git(dir, "commit", "-qam", "two");
    const result = run(dir, "history");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AWS access key id/);
    assert.ok(!result.stderr.includes(fakeKey));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a clean history passes", () => {
  const dir = mkdtempSync(join(tmpdir(), "ocade-hist-"));
  try {
    git(dir, "init", "-q");
    writeFileSync(join(dir, "a.txt"), "hello\n");
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "one");
    assert.equal(run(dir, "history").status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a key inside an image's embedded text is found; an empty directory is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "ocade-art-"));
  try {
    assert.equal(run(dir, "artifacts", dir).status, 2);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
      Buffer.from(`tEXtComment\0${fakeKey}`),
      Buffer.from([0xff, 0xfe, 0x00]),
    ]);
    writeFileSync(join(dir, "shot.png"), png);
    const result = run(dir, "artifacts", dir);
    assert.equal(result.status, 1);
    assert.ok(!result.stderr.includes(fakeKey));
    writeFileSync(join(dir, "shot.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
    assert.equal(run(dir, "artifacts", dir).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
