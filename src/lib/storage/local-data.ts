/**
 * THE ONE PLACE LOCAL DATA IS DELETED.
 *
 * PLAN.md §A asks for exactly this and says why in a single line: "Do not
 * scatter deletion calls across Settings components." Scattered deletion is how
 * a product ends up with three different ideas of what "delete my data" means,
 * and the one that matters is always the one somebody forgot to update.
 *
 * IT REPLACES A `localStorage.clear()`. "Sign out everywhere" called that, on
 * an origin where the model vault keeps its active-version pointer and its
 * verified-digest metadata. So signing out of a lost laptop threw away the
 * evidence that the model on THIS machine had been verified — the bytes stayed
 * in OPFS, unusable, and preparation would start again from nothing. PLAN.md
 * §A names that clear() as a defect to correct, and this is the correction.
 *
 * TWO RULES DECIDE EVERYTHING HERE, AND THEY POINT IN OPPOSITE DIRECTIONS:
 *
 *   FAIL SAFE ON WHAT TO DELETE. A class deletes only keys matching patterns it
 *   declares. A key nothing classifies is LEFT ALONE. The cost of that is a
 *   forgotten key surviving a wipe, which a test catches; the cost of the
 *   opposite default is deleting something nobody meant to.
 *
 *   FAIL CLOSED ON WHAT MUST SURVIVE. Model-owned keys are protected
 *   explicitly, and the protection is checked at deletion time rather than
 *   trusted to the patterns — so a future class whose pattern happens to reach
 *   a model key deletes nothing instead of quietly destroying an install.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It never touches OPFS. Offline
 * Intelligence is removed by exactly one authority — the model vault's
 * uninstall — and only when somebody asks for that specifically. Deleting
 * account data and removing the model are different requests, and PLAN.md §A
 * draws that boundary in a diagram rather than a sentence.
 */

/** The classes PLAN.md §A names. `all_account_data` is every other class. */
export type LocalDataClass =
  | "chats"
  | "messages"
  | "projects"
  | "tasks"
  | "artifacts"
  | "memory"
  | "search_index"
  | "sync_cache"
  | "outbox"
  | "notifications"
  | "preferences"
  | "device_lease"
  | "all_account_data";

/** What was on the machine, and what it still is. */
export interface VerifiedModelIdentity {
  /** The active version's immutable identity. */
  version: string;
  /** Whether that version's digest had been matched. */
  verified: boolean;
  /** The published digest, when the install recorded one. */
  sha256?: string;
}

export interface LocalDataDeletionResult {
  deletedClasses: LocalDataClass[];
  deletedRecords: number;
  modelBefore: VerifiedModelIdentity | null;
  modelAfter: VerifiedModelIdentity | null;
  /**
   * Always zero, and asserted rather than assumed.
   *
   * Deleting account data must not cause a single request to a model origin —
   * no fetch, no HEAD, no Range, no mirror probe. This module makes none; the
   * field exists so a caller can record the fact and a test can prove it.
   */
  modelNetworkRequests: 0;
}

/**
 * Keys nothing in this module may delete, whatever class is asked for.
 *
 * These belong to Offline Intelligence: the active pointer, the rollback
 * pointer, per-version verified metadata, the legacy per-file metadata, and the
 * record of a deliberate uninstall. Losing any of them turns a verified,
 * working install into an unverified pile of bytes.
 */
export const MODEL_OWNED_KEY_PREFIXES: readonly string[] = [
  "ocade.model.active.v1",
  "ocade.model.previous.v1",
  "ocade.model.version.v1.",
  "ocade.model.meta.",
  "ocade.model.uninstalled.at.v1",
];

/**
 * Device-owned keys that are not account data either.
 *
 * A measured hardware tier, an engine setup outcome, an appearance choice made
 * on this screen: none of it identifies the account, none of it follows the
 * person to another machine, and wiping it makes the product worse on this one
 * for no privacy gain. `preferences` deletes them when somebody explicitly asks
 * for preferences; `all_account_data` does not, because they are not that.
 */
const DEVICE_OWNED_KEY_PREFIXES: readonly string[] = [
  "ocade.brain.tier-benchmark.v1",
  "ocade.engine.autosetup",
  "ocade.isolation.attempted.v1",
  "ocade.application.deployment",
  "caera.browser_install_id",
  "caera:appearance:",
  "caera:shell:collapsed",
  "ocade.settings.advanced.v1",
];

/**
 * The keys each class owns.
 *
 * Prefixes rather than exact names wherever the product writes one key per
 * record, so a class cannot silently stop covering its own data the first time
 * somebody adds an id to a key.
 */
const CLASS_KEY_PREFIXES: Record<Exclude<LocalDataClass, "all_account_data">, readonly string[]> = {
  chats: ["caera:conversations", "ocade.chat-citations.v1", "ocade.chat.prefs.v1", "caera:draft:"],
  messages: ["ocade.chat.reactions.v1"],
  projects: ["ocade.project-files.v1", "ocade.project-folders.v1"],
  tasks: ["ocade:unified-tasks:v1", "ocade:task-comments:v1", "ocade:task-feed:last-seen"],
  artifacts: ["ocade.artifacts.v1", "caera:appmaps:v1"],
  memory: ["ocade.memory.local.v1"],
  search_index: ["ocade.monitors.v1", "ocade.output-activity.v1"],
  sync_cache: ["caera:mobile:queue:v1"],
  outbox: ["ocade.sync.outbox.v1"],
  notifications: ["caera:approvals:v1", "ocade.diagnostics.errors.v1"],
  preferences: [
    "ocade.locale.v1",
    "ocade.notifications.preferences.v1",
    "ocade.table.",
    "ocade.support.article-feedback",
    "ocade.status.samples",
    "caera:voice:",
    "caera:landing:intro:v1",
    ...DEVICE_OWNED_KEY_PREFIXES,
  ],
  /*
   * The device's registration and pairing records. Named as their own class
   * because "sign this machine out" and "delete my chats" are different
   * requests, and one of them takes the browser's identity with it.
   */
  device_lease: ["caera:devices:v1", "ocade.pairing.v1", "caera:browser:policy:v1"],
};

/**
 * The classes `all_account_data` covers.
 *
 * Named `LOCAL_` because `lib/account/data-classes.ts` exports an
 * `ACCOUNT_DATA_CLASSES` that means something else entirely — the classes of
 * data OCADE holds on the SERVER. One name for two lists is how somebody
 * eventually imports the wrong one.
 *
 * NOT every class. `preferences` carries device-owned settings that are not
 * account data, and `device_lease` is this machine's registration — a person
 * deleting their account data has not asked to forget which browser they are
 * using. Both remain available on their own.
 */
const LOCAL_ACCOUNT_DATA_CLASSES: readonly Exclude<LocalDataClass, "all_account_data">[] = [
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
];

/**
 * WHAT EACH LOCAL CLASS IS, IN WORDS A PERSON CAN CHOOSE BETWEEN.
 *
 * PLAN.md §A asks for per-selection deletion controls in Settings › Privacy,
 * and a control that says "sync_cache" is not a choice anybody can make. The
 * labels live beside the key prefixes rather than in the panel so the two
 * cannot drift: a class added here without a label is a compile error, which is
 * exactly what should happen — an unlabelled checkbox is worse than none.
 *
 * `all_account_data` is deliberately absent. It is a bulk action with its own
 * button and its own confirmation, not one tick box among twelve.
 */
export const LOCAL_DATA_CLASS_LABELS: Record<
  Exclude<LocalDataClass, "all_account_data">,
  { label: string; description: string }
> = {
  chats: {
    label: "Chats",
    description: "Conversations, drafts and citations kept on this device.",
  },
  messages: { label: "Message reactions", description: "Your reactions to individual messages." },
  projects: { label: "Projects", description: "Project files and folders held locally." },
  tasks: { label: "Tasks", description: "Tasks, their comments and what you have already seen." },
  artifacts: { label: "Artifacts", description: "Generated artifacts and app maps." },
  memory: { label: "Memory", description: "What OCADE remembered on this device only." },
  search_index: {
    label: "Search index",
    description: "Monitors and the local index that makes search fast.",
  },
  sync_cache: {
    label: "Sync cache",
    description: "Work queued for other devices. Clearing this discards anything not yet sent.",
  },
  outbox: {
    label: "Outbox",
    description: "Changes waiting to reach OCADE. Clearing this discards them.",
  },
  notifications: {
    label: "Notifications",
    description: "Approvals and diagnostics shown in this browser.",
  },
  preferences: {
    label: "Preferences",
    description: "Language, appearance, table layouts and other choices made on this device.",
  },
  device_lease: {
    label: "This device's registration",
    description: "How OCADE recognises this browser. Clearing it signs the device out of pairing.",
  },
};

/**
 * WHAT THE LOCAL STORE SAYS ABOUT THE ACTIVE MODEL — A WITNESS, NOT AN
 * AUTHORITY.
 *
 * `deleteLocalData` takes a reader so it can record the model identity before
 * and after a deletion, which is how the §A guarantee stops being a promise and
 * becomes a measurement. Until now every caller supplied its own reader, and
 * the only callers were tests: the panel that shows a person their deletion
 * receipt had nothing to show.
 *
 * THIS IS NOT `model-vault.ts`, AND MUST NOT BECOME IT. The vault owns whether
 * Offline Intelligence is installed, verified and usable — it reads OPFS. This
 * reads the two pointer keys in the key-value store, which is exactly the
 * surface a local deletion could damage, and that is the whole point: the
 * witness has to look at the thing being protected. Nothing should ask this
 * function whether the model works.
 */
export interface LocalKeyValueReader {
  getItem(key: string): string | null;
}

export function readModelIdentityFromStore(
  store: LocalKeyValueReader | null = browserReader(),
): VerifiedModelIdentity | null {
  if (!store) return null;
  try {
    const version = store.getItem("ocade.model.active.v1");
    if (!version) return null;
    const raw = store.getItem(`ocade.model.version.v1.${version}`);
    if (!raw) return { version, verified: false };
    const parsed = JSON.parse(raw) as { verified?: unknown; sha256?: unknown };
    return {
      version,
      verified: parsed.verified === true,
      ...(typeof parsed.sha256 === "string" ? { sha256: parsed.sha256 } : {}),
    };
  } catch {
    /*
     * A pointer that will not parse is not a model that is gone. Reporting the
     * version alone and `verified: false` is the honest reading, and it keeps
     * the before/after comparison meaningful — both sides read the same way.
     */
    const version = store.getItem("ocade.model.active.v1");
    return version ? { version, verified: false } : null;
  }
}

/** Is this key owned by Offline Intelligence, and therefore untouchable here? */
export function isModelOwnedKey(key: string): boolean {
  return MODEL_OWNED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Every key one class would delete, from the keys actually present. */
export function keysForClass(requested: LocalDataClass, presentKeys: readonly string[]): string[] {
  const classes: readonly Exclude<LocalDataClass, "all_account_data">[] =
    requested === "all_account_data" ? LOCAL_ACCOUNT_DATA_CLASSES : [requested];
  const prefixes = classes.flatMap((entry) => CLASS_KEY_PREFIXES[entry]);
  return presentKeys.filter(
    (key) =>
      prefixes.some((prefix) => key === prefix || key.startsWith(prefix)) &&
      // The second gate, deliberately not merged with the first: a class whose
      // pattern grows to reach a model key must delete nothing rather than
      // destroy an install.
      !isModelOwnedKey(key),
  );
}

/** Just enough of `Storage` to delete from it, so a test can supply its own. */
export interface LocalKeyValueStore {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

/** Reads the model's identity without touching it. Injected for testing. */
export type ReadModelIdentity = () => VerifiedModelIdentity | null;

/**
 * The same storage, read-only.
 *
 * A separate accessor rather than widening `LocalKeyValueStore`: the deletion
 * authority enumerates and removes and must never gain the ability to READ a
 * value, because the moment it can, something will start deciding what to
 * delete from what it found.
 */
function browserReader(): LocalKeyValueReader | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function browserStore(): LocalKeyValueStore | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Every key currently present, read before anything is removed. */
function presentKeys(store: LocalKeyValueStore): string[] {
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}

/**
 * Delete the local data for the requested classes.
 *
 * The model identity is read BEFORE and AFTER, and both are returned. That is
 * not decoration: the guarantee PLAN.md §A asks for is that the verified model
 * survives every deletion, and a guarantee nobody measures is a hope. A caller
 * that finds `modelBefore` and `modelAfter` different has found a defect, and
 * `local-data-deletion.test.ts` asserts they never are.
 */
export function deleteLocalData(
  classes: readonly LocalDataClass[],
  options: {
    store?: LocalKeyValueStore | null;
    readModelIdentity?: ReadModelIdentity;
  } = {},
): LocalDataDeletionResult {
  const store = options.store === undefined ? browserStore() : options.store;
  const readModel = options.readModelIdentity ?? (() => null);
  const modelBefore = readModel();

  if (!store) {
    return {
      deletedClasses: [],
      deletedRecords: 0,
      modelBefore,
      modelAfter: readModel(),
      modelNetworkRequests: 0,
    };
  }

  const keys = presentKeys(store);
  const removed = new Set<string>();
  const deletedClasses: LocalDataClass[] = [];

  for (const requested of classes) {
    const matching = keysForClass(requested, keys);
    deletedClasses.push(requested);
    for (const key of matching) {
      if (removed.has(key)) continue;
      try {
        store.removeItem(key);
        removed.add(key);
      } catch {
        /*
         * One key that will not go does not abandon the rest. The count below
         * is of what actually went, so a partial deletion reports as partial
         * rather than as a success.
         */
      }
    }
  }

  return {
    deletedClasses,
    deletedRecords: removed.size,
    modelBefore,
    modelAfter: readModel(),
    modelNetworkRequests: 0,
  };
}
