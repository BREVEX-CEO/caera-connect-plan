/** SUPPLY-08: installs come only from the public registries, each package pinned by content hash. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type Entry = { link?: boolean; resolved?: string; integrity?: string; inBundle?: boolean };

test("every npm package is fetched from the npm registry over https and carries an integrity hash", () => {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
    packages: Record<string, Entry>;
  };
  const checked: string[] = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === "" || entry.link || entry.inBundle) continue; // the root, a workspace link, a package shipped inside another
    assert.match(
      entry.resolved ?? "",
      /^https:\/\/registry\.npmjs\.org\//,
      `${path} is not from the npm registry`,
    );
    assert.match(entry.integrity ?? "", /^sha(?:256|384|512)-/, `${path} has no integrity hash`);
    checked.push(path);
  }
  assert.ok(checked.length > 400, `only ${checked.length} packages were checked`);
});

test("every companion Python requirement is locked to at least one sha256 and none is a URL or path", () => {
  const text = readFileSync("device-agent/windows/requirements.lock", "utf8").replaceAll(
    "\\\n",
    " ",
  );
  const lines = text.split("\n").filter((line) => line.trim() && !line.trim().startsWith("#"));
  assert.ok(lines.length > 20, "the lock lists the requirements");
  for (const line of lines) {
    assert.match(
      line,
      /^[A-Za-z0-9_.\-[\]]+==[^\s;]+(?:\s*;[^-]*?)?\s+--hash=sha256:[0-9a-f]{64}/,
      line.slice(0, 80),
    );
    assert.doesNotMatch(line, /(?:@\s*|file:|git\+|https?:\/\/)/, line.slice(0, 80));
  }
});
