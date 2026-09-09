import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  readModelIdentityFromStore,
  deleteLocalData,
  isModelOwnedKey,
  keysForClass,
  MODEL_OWNED_KEY_PREFIXES,
  type LocalDataClass,
  type LocalKeyValueStore,
  type VerifiedModelIdentity,
} from "../local-data";

/**
 * THE BOUNDARY PLAN.md §A DRAWS AS A DIAGRAM.
 *
 *   IndexedDB account/product data deletion  ≠  OPFS model deletion
 *
 * The failure this exists to prevent is not subtle and it already happened:
 * "sign out everywhere" called `localStorage.clear()` on an origin where the
 * model vault keeps its active pointer and its verified-digest metadata. The
 * weights survived — they are in OPFS — and became unusable, because the
 * evidence that they had been verified was gone. A person who signed out of a
 * lost laptop paid for the download again.
 *
 * So every test below asks the same question in a different way: after this
 * deletion, is the verified model still exactly what it was?
 */

/** A localStorage-shaped store with real ordering, for exercising the walk. */
function store(seed: Record<string, string>): LocalKeyValueStore & {
  entries: Record<string, string>;
} {
  const entries = { ...seed };
  return {
    entries,
    get length() {
      return Object.keys(entries).length;
    },
    key(index) {
      return Object.keys(entries)[index] ?? null;
    },
    removeItem(key) {
      delete entries[key];
    },
  };
}

const MODEL: VerifiedModelIdentity = {
  version: "qwen2.5-7b-instruct-q4",
  verified: true,
  sha256: "a".repeat(64),
};

/** The model's identity, read from keys the deletion must not touch. */
function modelIdentityFrom(target: LocalKeyValueStore & { entries: Record<string, string> }) {
  return (): VerifiedModelIdentity | null => {
    const version = target.entries["ocade.model.active.v1"];
    if (!version) return null;
    const raw = target.entries[`ocade.model.version.v1.${version}`];
    if (!raw) return { version, verified: false };
    return { version, ...(JSON.parse(raw) as { verified: boolean; sha256?: string }) };
  };
}

function withModel(seed: Record<string, string>): Record<string, string> {
  return {
    "ocade.model.active.v1": MODEL.version,
    "ocade.model.previous.v1": "qwen2.5-7b-instruct-q4-previous",
    [`ocade.model.version.v1.${MODEL.version}`]: JSON.stringify({
      verified: true,
      sha256: MODEL.sha256,
    }),
    "ocade.model.meta.engine/qwen.gguf": JSON.stringify({ verified: true, expectedBytes: 1 }),
    "ocade.model.uninstalled.at.v1": "",
    ...seed,
  };
}

const ALL_CLASSES: LocalDataClass[] = [
  "chats",
  "messages",
  "projects",
  "tasks",
  "artifacts",
  "memory",
  "search_index",
  "sync_cache",
  "outbox",
  "notifications",
  "preferences",
  "device_lease",
  "all_account_data",
];

describe("Offline Intelligence survives every local deletion", () => {
  it.each(ALL_CLASSES)("deleting %s leaves the verified model identical", (dataClass) => {
    const target = store(
      withModel({
        "caera:conversations": "[]",
        "ocade.memory.local.v1": "[]",
        "ocade.artifacts.v1": "[]",
        "ocade:unified-tasks:v1": "[]",
        "ocade.sync.outbox.v1": "[]",
        "caera:devices:v1": "[]",
        "ocade.table.user.people": "{}",
      }),
    );
    const result = deleteLocalData([dataClass], {
      store: target,
      readModelIdentity: modelIdentityFrom(target),
    });

    expect(result.modelBefore).toEqual(MODEL);
    expect(result.modelAfter).toEqual(MODEL);
    expect(result.modelNetworkRequests).toBe(0);
    for (const prefix of MODEL_OWNED_KEY_PREFIXES) {
      const survivors = Object.keys(target.entries).filter((key) => key.startsWith(prefix));
      expect(survivors.length, `${prefix} was removed by ${dataClass}`).toBeGreaterThan(0);
    }
  });

  it("deleting every class at once still leaves the model", () => {
    const target = store(withModel({ "caera:conversations": "[]", "ocade.memory.local.v1": "[]" }));
    const result = deleteLocalData(ALL_CLASSES, {
      store: target,
      readModelIdentity: modelIdentityFrom(target),
    });
    expect(result.modelAfter).toEqual(MODEL);
  });

  it("refuses a model key even when a class pattern reaches it", () => {
    /*
     * The second gate, tested on its own. If a future class declares a prefix
     * that happens to cover a model key, the answer must be "delete nothing"
     * rather than "destroy the install".
     */
    expect(keysForClass("memory", ["ocade.model.active.v1", "ocade.memory.local.v1"])).toEqual([
      "ocade.memory.local.v1",
    ]);
    for (const prefix of MODEL_OWNED_KEY_PREFIXES) expect(isModelOwnedKey(prefix)).toBe(true);
    expect(isModelOwnedKey("ocade.memory.local.v1")).toBe(false);
  });
});

describe("what each class actually removes", () => {
  it("removes only its own keys", () => {
    const target = store({
      "caera:conversations": "[]",
      "ocade.memory.local.v1": "[]",
      "ocade.artifacts.v1": "[]",
    });
    const result = deleteLocalData(["memory"], { store: target });
    expect(result.deletedRecords).toBe(1);
    expect(Object.keys(target.entries).sort()).toEqual([
      "caera:conversations",
      "ocade.artifacts.v1",
    ]);
  });

  it("leaves an unclassified key alone rather than guessing", () => {
    // Fail safe: a forgotten key surviving a wipe is caught by the coverage
    // test below. The opposite default deletes something nobody meant to.
    const target = store({ "ocade.something.nobody.classified": "1" });
    deleteLocalData(["all_account_data"], { store: target });
    expect(target.entries["ocade.something.nobody.classified"]).toBe("1");
  });

  it("counts a key once when two classes both claim it", () => {
    const target = store({ "ocade.memory.local.v1": "[]" });
    const result = deleteLocalData(["memory", "all_account_data"], { store: target });
    expect(result.deletedRecords).toBe(1);
  });

  it("does not treat device settings as account data", () => {
    /*
     * Somebody deleting their account data has not asked to forget which
     * browser they are using, or to un-measure their hardware.
     */
    const target = store({
      "caera:appearance:v1": "{}",
      "ocade.brain.tier-benchmark.v1": "{}",
      "caera:devices:v1": "[]",
      "ocade.memory.local.v1": "[]",
    });
    deleteLocalData(["all_account_data"], { store: target });
    expect(Object.keys(target.entries).sort()).toEqual([
      "caera:appearance:v1",
      "caera:devices:v1",
      "ocade.brain.tier-benchmark.v1",
    ]);
  });

  it("does remove them when preferences or the device lease are asked for", () => {
    const target = store({ "caera:appearance:v1": "{}", "caera:devices:v1": "[]" });
    deleteLocalData(["preferences", "device_lease"], { store: target });
    expect(Object.keys(target.entries)).toEqual([]);
  });

  it("survives a store that refuses to delete, and reports what actually went", () => {
    const stubborn: LocalKeyValueStore = {
      length: 2,
      key: (index) => ["ocade.memory.local.v1", "ocade.artifacts.v1"][index] ?? null,
      removeItem: (key) => {
        if (key === "ocade.memory.local.v1") throw new Error("blocked");
      },
    };
    const result = deleteLocalData(["memory", "artifacts"], { store: stubborn });
    // A partial deletion reports as partial, not as a success.
    expect(result.deletedRecords).toBe(1);
  });

  it("survives having no storage at all, as on the server", () => {
    const result = deleteLocalData(["all_account_data"], { store: null });
    expect(result).toMatchObject({ deletedRecords: 0, modelNetworkRequests: 0 });
  });
});

describe("nothing else clears the origin wholesale", () => {
  /**
   * PLAN.md §A: "Replace broad `localStorage.clear()` with scoped
   * session/account cleanup." One call site had it, and it took the model's
   * verified state with it. This refuses its return anywhere in the product.
   */
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (entry === "__tests__" || entry === "node_modules") continue;
      if (statSync(full).isDirectory()) {
        sourceFiles(full, out);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  }

  it("finds the source at all, so a broken scan cannot pass", () => {
    expect(sourceFiles("src").length).toBeGreaterThan(200);
  });

  /**
   * Source with comments removed.
   *
   * The rule is about CODE. Both files that fix this defect necessarily name it
   * in their comments — the module explaining what it replaced, and the call
   * site explaining what it no longer does — and a scan of raw text would be
   * tripped by the explanation of the very rule it enforces.
   */
  function code(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  it("has no localStorage.clear() left in the product", () => {
    const offenders = sourceFiles("src").filter((file) =>
      /\blocalStorage\s*\.\s*clear\s*\(/.test(code(readFileSync(file, "utf8"))),
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("would still catch one, so stripping comments did not disarm the rule", () => {
    // The scan is only worth having if it still fails on the real thing.
    expect(/\blocalStorage\s*\.\s*clear\s*\(/.test(code("window.localStorage.clear();"))).toBe(
      true,
    );
    expect(/\blocalStorage\s*\.\s*clear\s*\(/.test(code("/* localStorage.clear() */"))).toBe(false);
  });

  it("routes the sign-out-everywhere path through the canonical authority", () => {
    const source = readFileSync("src/routes/_authenticated/settings.security.tsx", "utf8");
    expect(source).toContain("deleteLocalData(");
  });
});

describe("the model-identity witness the deletion receipt shows", () => {
  /**
   * The receipt on Settings › Privacy tells a person their Offline Intelligence
   * survived. That sentence is only worth printing if it is a MEASUREMENT, and
   * until this reader existed every caller supplied its own — which meant the
   * only ones that measured anything were the tests below.
   *
   * It is a witness, not an authority: it reads the two pointer keys a local
   * deletion could damage, and nothing asks it whether the model works.
   */
  function reader(entries: Record<string, string>) {
    return { getItem: (key: string) => entries[key] ?? null };
  }

  it("reports the active version and that it was verified", () => {
    expect(
      readModelIdentityFromStore(
        reader({
          "ocade.model.active.v1": MODEL.version,
          [`ocade.model.version.v1.${MODEL.version}`]: JSON.stringify({
            verified: true,
            sha256: MODEL.sha256,
          }),
        }),
      ),
    ).toEqual(MODEL);
  });

  it("reports nothing installed as null rather than as an unverified model", () => {
    // The receipt says something different in each case, and saying "installed
    // but unverified" to somebody with no model at all would be alarming and
    // false.
    expect(readModelIdentityFromStore(reader({}))).toBeNull();
    expect(readModelIdentityFromStore(null)).toBeNull();
  });

  it("treats a pointer with no metadata as present but unverified", () => {
    expect(readModelIdentityFromStore(reader({ "ocade.model.active.v1": "v1" }))).toEqual({
      version: "v1",
      verified: false,
    });
  });

  it("survives metadata that will not parse, without claiming verification", () => {
    expect(
      readModelIdentityFromStore(
        reader({ "ocade.model.active.v1": "v1", "ocade.model.version.v1.v1": "{not json" }),
      ),
    ).toEqual({ version: "v1", verified: false });
  });

  it("never reports verified from a value that merely exists", () => {
    // `verified: "yes"` is not verification, and a truthy check would take it.
    expect(
      readModelIdentityFromStore(
        reader({
          "ocade.model.active.v1": "v1",
          "ocade.model.version.v1.v1": JSON.stringify({ verified: "yes" }),
        }),
      ),
    ).toEqual({ version: "v1", verified: false });
  });
});
