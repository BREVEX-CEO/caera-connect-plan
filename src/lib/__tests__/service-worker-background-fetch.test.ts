import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The worker's background-preparation path, executed rather than read.
 *
 * WHY IT MATTERS THAT THESE RUN. Background Fetch is the only web API that
 * genuinely continues after a tab is closed, so it is the only place OCADE may
 * honestly say "you can close this". It is also the one place where bytes reach
 * OPFS WITHOUT going through the page's installer — which makes the id-to-path
 * mapping a write primitive, and an unvalidated one would be a path traversal
 * into somebody's stored files.
 *
 * `pathFromFetchId` is therefore extracted and executed against the real hostile
 * inputs, and the security properties of the rest of the worker are re-checked
 * here because a large addition to a caching worker is exactly when one gets
 * quietly lost.
 */

const SOURCE = readFileSync("public/sw.js", "utf8");

/**
 * Pull a function out of the worker source and run the REAL one.
 *
 * The constants it closes over come out of the same source rather than being
 * restated here: a copy of `MODEL_FETCH_PREFIX` in this file would keep passing
 * after somebody changed it in the worker, which is the failure mode that makes
 * source-extraction tests worthless.
 */
function extract(name: string, arg: string): (value: unknown) => unknown {
  const match = SOURCE.match(new RegExp(`function ${name}\\(${arg}\\)\\s*\\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`${name} not found in public/sw.js`);
  const constants = [...SOURCE.matchAll(/^const (MODEL_[A-Z_]+) = ("[^"]*");$/gm)]
    .map((m) => `const ${m[1]} = ${m[2]};`)
    .join("\n");
  if (!constants.includes("MODEL_FETCH_PREFIX")) {
    throw new Error("MODEL_FETCH_PREFIX not found in public/sw.js");
  }
  const factory = new Function(
    `${constants}\n${match[0]}; return ${name};`,
  ) as () => (value: unknown) => unknown;
  return factory();
}

const pathFromFetchId = extract("pathFromFetchId", "id") as (id: unknown) => string[] | null;

describe("the registration id is a write path, so it is validated as one", () => {
  it("accepts the versioned artifact path the installer uses", () => {
    expect(pathFromFetchId("ocade-model:versions/qwen-v1/qwen-v1.bin")).toEqual([
      "versions",
      "qwen-v1",
      "qwen-v1.bin",
    ]);
  });

  it("REFUSES traversal, however it is spelled", () => {
    // The id round-trips through browser storage, so it comes back untrusted.
    for (const hostile of [
      "ocade-model:../../etc/passwd",
      "ocade-model:versions/../../../secret.bin",
      "ocade-model:versions/..%2F..%2Ffoo.bin",
      "ocade-model:versions/./x/y.bin",
      "ocade-model:/absolute/path.bin",
      "ocade-model:versions/.hidden/x.bin",
      "ocade-model:versions//double.bin",
    ]) {
      const result = pathFromFetchId(hostile);
      if (result !== null) {
        // If anything is accepted, no segment may contain a traversal or start
        // with a dot — those are the two ways out of the directory.
        for (const segment of result) {
          expect(segment).not.toContain("..");
          expect(segment.startsWith(".")).toBe(false);
        }
      }
    }
    expect(pathFromFetchId("ocade-model:../../etc/passwd")).toBeNull();
    expect(pathFromFetchId("ocade-model:versions/../../../secret.bin")).toBeNull();
  });

  it("refuses ids that are not OCADE's at all", () => {
    expect(pathFromFetchId("some-other-app:versions/x.bin")).toBeNull();
    expect(pathFromFetchId("")).toBeNull();
    expect(pathFromFetchId(null)).toBeNull();
    expect(pathFromFetchId(42)).toBeNull();
  });

  it("refuses a path with no directory, and an implausibly deep one", () => {
    // One segment is a bare filename at the storage root, which the installer
    // never uses; a very deep path is not a shape this produces either.
    expect(pathFromFetchId("ocade-model:file.bin")).toBeNull();
    expect(pathFromFetchId("ocade-model:a/b/c/d/e/f/g/h.bin")).toBeNull();
  });
});

describe("the worker files bytes and refuses to vouch for them", () => {
  it("never hashes, and never records a verification of its own", () => {
    /*
     * VERIFICATION LIVES IN ONE PLACE. A second digest implementation here, in
     * unbundled worker JavaScript, would be a thing to keep in step with
     * `installation-authority.ts` — and the day they disagree, one of them says
     * a corrupt engine is safe to run.
     */
    expect(SOURCE).not.toMatch(/crypto\.subtle/);
    expect(SOURCE).not.toMatch(/sha256/i);
    expect(SOURCE).not.toMatch(/verified\s*[:=]\s*true/);
  });

  it("streams the response to disk rather than buffering it", () => {
    // This is a gigabyte-class artifact; the worker has no more memory to spend
    // on it than the page did.
    expect(SOURCE).toMatch(/pipeTo\(writable\)/);
    expect(SOURCE).not.toMatch(/backgroundfetch[\s\S]{0,2000}?arrayBuffer\(\)/i);
  });

  it("tells the page rather than acting on the file itself", () => {
    expect(SOURCE).toMatch(/ocade:model-staged/);
    expect(SOURCE).toMatch(/notifyClients/);
  });

  it("says nothing technical in the notification the browser shows", () => {
    // The browser renders this title in its own download UI, so the product
    // language rule reaches past OCADE's own screens.
    const titles = [...SOURCE.matchAll(/title:\s*(?:stored\s*\?\s*)?"([^"]+)"/g)].map((m) => m[1]);
    const alt = [...SOURCE.matchAll(/:\s*"([^"]*OCADE[^"]*)"/g)].map((m) => m[1]);
    for (const title of [...titles, ...alt]) {
      expect(title).not.toMatch(/qwen|gguf|hugging|\bMB\b|\bGB\b|wasm|webgpu|quantis/i);
    }
  });
});

describe("the security properties that already existed are still there", () => {
  it("still never caches API, server-function or auth responses", () => {
    const rule = SOURCE.match(/function isNeverCached\(url\)[\s\S]*?\n\}/)![0];
    expect(rule).toContain("/api/");
    expect(rule).toContain("/_serverFn/");
    expect(rule).toContain("/auth/");
  });

  it("still keeps model weights out of Cache Storage", () => {
    // They live in OPFS, where the user can see, resume and delete them. A
    // second copy in Cache Storage is a gigabyte nobody can find.
    const rule = SOURCE.match(/function isModelWeight\(url\)[\s\S]*?\n\}/)![0];
    expect(rule).toMatch(/gguf/);
    expect(SOURCE).toMatch(/if \(isModelWeight\(url\)\) return false/);
  });

  it("still versions its cache and deletes the previous generation", () => {
    expect(SOURCE).toMatch(/SHELL_CACHE_PREFIX/);
    expect(SOURCE).toMatch(/caches\.delete\(k\)/);
  });

  it("still handles only GET", () => {
    expect(SOURCE).toMatch(/request\.method !== "GET"/);
  });
});
