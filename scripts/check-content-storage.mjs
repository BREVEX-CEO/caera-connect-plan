#!/usr/bin/env node
/**
 * ORDINARY USER CONTENT HAS ONE PERSISTENT AUTHORITY, AND THIS IS THE GATE.
 *
 * `PLAN.md` Phase 2: conversations, messages, projects, tasks, artifacts,
 * memory, notifications and ordinary account data live in Supabase and private
 * Supabase Storage. They must not acquire a second home in IndexedDB,
 * localStorage, sessionStorage, Cache Storage or OPFS — not as a cache, not as
 * an outbox, not as a "temporary" copy.
 *
 * WHY A STATIC GATE RATHER THAN A CODE REVIEW. The failure is silent. A second
 * copy does not break anything on the day it is added: it breaks months later
 * when the two disagree, when a deletion clears one of them, or when a person
 * exports their account and finds half their work missing. Nothing on screen
 * says which copy answered.
 *
 * WHAT IS ALLOWED, AND WHY EACH ONE IS NOT CONTENT:
 *
 *   OPFS holds Offline Intelligence — model weights and the metadata that
 *   describes them. It is the one thing that must survive account deletion and
 *   must never be uploaded, which is the opposite of content.
 *
 *   `localStorage` holds device preferences: a theme, a send key, a locale, a
 *   table layout, an unsent draft, a sign-in throttle. Losing them is an
 *   inconvenience, not data loss, and syncing them would be wrong — a laptop
 *   and a phone reasonably want different answers.
 *
 *   The Cache Storage API holds the application shell, which is code.
 *
 * HOW A FILE IS CLEARED. Either it does not touch storage at all, or it is
 * named in ALLOWED below with the reason it is not content. The list is the
 * point: it makes each exception a decision somebody made and can be asked
 * about, rather than a pattern that spread.
 *
 * Usage: node scripts/check-content-storage.mjs [--json] [--root=<dir>]
 *
 * `--root` exists so the gate can be run against a scratch tree by its own
 * test. Paths are reported relative to it, which is what the allowance list
 * below is keyed on.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rootArgument = process.argv.find((argument) => argument.startsWith("--root="));
const ROOT = rootArgument ? rootArgument.slice("--root=".length) : "src";
/** What the allowance list is keyed on: the path as the repository writes it. */
const KEY_PREFIX = rootArgument ? "" : "src";
const jsonOnly = process.argv.includes("--json");

/**
 * Files that legitimately use browser storage, and what they keep there.
 *
 * A reason is required. "It is convenient" is not one of them: every entry
 * below names something that is either device-scoped by nature or model data.
 */
const ALLOWED = new Map([
  // --- the model, and only the model -------------------------------------
  ["src/lib/brain/model-store.ts", "Offline Intelligence chunks in OPFS."],
  ["src/lib/brain/model-vault.ts", "The model's own install state and verified digests."],
  ["src/lib/brain/installation-authority.ts", "Which model version this device has verified."],
  ["src/lib/brain/tier-benchmark-store.ts", "How fast this machine ran the model."],
  ["src/lib/brain/paired-credentials.ts", "A paired local runtime's credential, per device."],
  [
    "src/lib/device/local-data.ts",
    "The authority that deletes device data, and protects the model from that deletion.",
  ],

  // --- device preferences and per-device UI state -------------------------
  ["src/lib/theme-provider.tsx", "Theme, which is a per-device choice."],
  ["src/lib/use-chat-prefs.ts", "Send key, density and other per-device chat preferences."],
  ["src/lib/use-voice-prefs.ts", "Voice, captions and wake-phrase preferences, per device."],
  ["src/routes/_authenticated/ocade.index.tsx", "The voice this machine speaks with."],
  ["src/lib/locale/use-locale.ts", "The locale this browser displays in."],
  ["src/lib/computer-use-settings.ts", "Per-device computer-control preferences."],
  ["src/lib/runtime/permission-settings.ts", "Per-device permission prompts already answered."],
  ["src/components/ui/data-table-preferences.ts", "Column layout, per device."],
  ["src/components/settings/DeviceAvatarEditor.tsx", "A device avatar, which is device state."],
  ["src/components/settings/SettingsShell.tsx", "Which settings section was last open."],
  ["src/components/shell/WorkspaceShell.tsx", "Rail and panel layout, per device."],
  ["src/lib/browser-install-id.ts", "An opaque per-browser id, carrying no content."],
  ["src/lib/devices.ts", "This device's own identity, cached so a lease survives a restart."],
  ["src/lib/auth/throttle.ts", "Sign-in attempt throttling, which must survive a reload."],
  [
    "src/integrations/supabase/previewAuthStorage.ts",
    "The session token itself, which is per-browser by definition.",
  ],
  ["src/lib/legal/consent-receipts.ts", "Consent receipts, which are evidence about this device."],
  ["src/lib/time/trusted-clock.ts", "Clock drift measured on this device."],
  ["src/lib/status/uptime.ts", "Uptime samples this browser observed."],
  ["src/lib/landing/universe.ts", "Whether the landing intro has played."],
  ["src/lib/entry/root-entry.ts", "Whether the landing page has been seen, and a session probe."],
  ["src/lib/capabilities/use-capabilities.ts", "Reads device state to report what is available."],
  ["src/lib/limits/use-limits.ts", "A cached view of the server's own usage answer."],
  [
    "src/lib/commercial/offline-counter.ts",
    "A signed offline allowance, which is device-bound by design.",
  ],
  ["src/components/commercial/OfflineUsageBridge.tsx", "Drives the offline allowance above."],
  ["src/components/legal/LegalConsentGate.tsx", "Which legal version this device accepted."],
  ["src/lib/skills/app-map.ts", "Learned layouts of third-party applications, per device."],
  ["src/lib/support/feedback.ts", "Whether this browser found an article useful."],
  [
    "src/components/ocade/TaskBoard.tsx",
    'What this TAB has already looked at in the task feed, so "new since I last looked" means this session.',
  ],
  [
    "src/lib/security/isolation-upgrade.ts",
    "One reload attempt, remembered for this tab so a failed upgrade cannot loop.",
  ],
  [
    "src/lib/offline-queue.ts",
    "An unsent draft, which is what the person is looking at and is never sent on its own. The queue beside it is held in memory.",
  ],

  // --- Cache Storage, which holds code rather than content ----------------
  ["src/lib/offline/mirror.ts", "The application shell in Cache Storage, which is code."],
  ["src/lib/offline/measure-readiness.ts", "Measures how much of that shell is present."],
  ["src/lib/offline/storage-report.ts", "Reports and clears that shell."],
  [
    "src/lib/attachments/deletion.ts",
    "Clears cached responses that mention a deleted file; it is the deleter, not a store.",
  ],
]);

/** What a file must not touch unless it is listed above. */
const STORAGE = [
  { name: "localStorage", pattern: /\blocalStorage\b/ },
  { name: "sessionStorage", pattern: /\bsessionStorage\b/ },
  { name: "indexedDB", pattern: /\bindexedDB\b|\bIDBDatabase\b|\bIDBFactory\b/ },
  { name: "caches", pattern: /\bcaches\.(open|match|keys|delete)\b|\bCacheStorage\b/ },
  { name: "OPFS", pattern: /getDirectory\(\)|navigator\.storage\.getDirectory/ },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.[cm]?tsx?$/.test(entry)) {
      const named = KEY_PREFIX ? path : relative(ROOT, path);
      out.push(named.replace(/\\/g, "/"));
    }
  }
  return out;
}

/** Comments and strings blanked, so prose about storage is not a finding. */
function stripNoise(source) {
  const blank = (text) => text.replace(/[^\n]/g, " ");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, before) => before + blank(match.slice(before.length)))
    .replace(/`(?:[^`\\]|\\.)*`/g, blank)
    .replace(/"(?:[^"\\]|\\.)*"/g, blank)
    .replace(/'(?:[^'\\]|\\.)*'/g, blank);
}

const findings = [];
const usedAllowances = new Set();

for (const file of walk(ROOT)) {
  // Tests stand things up on purpose; a test that writes to a fake store is
  // proving something about the code, not shipping a second content authority.
  if (/__tests__|\.test\.[cm]?tsx?$/.test(file)) continue;

  const source = stripNoise(readFileSync(KEY_PREFIX ? file : join(ROOT, file), "utf8"));
  const touched = STORAGE.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name);
  if (touched.length === 0) continue;

  if (ALLOWED.has(file)) {
    usedAllowances.add(file);
    continue;
  }
  findings.push({ file, touched });
}

/**
 * An allowance for a file that no longer touches storage is stale.
 *
 * Only checked against the real tree. A scratch root is a handful of files by
 * construction, so every other allowance would read as stale and bury whatever
 * the test was actually looking at.
 */
const stale = KEY_PREFIX ? [...ALLOWED.keys()].filter((file) => !usedAllowances.has(file)) : [];

if (jsonOnly) {
  console.log(JSON.stringify({ findings, stale }, null, 2));
} else {
  console.log(`Content-storage audit: scanned ${walk(ROOT).length} source files`);
  for (const { file, touched } of findings) {
    console.error(`  ${file} uses ${touched.join(", ")} and is not a declared device store`);
  }
  for (const file of stale) {
    console.error(`  ${file} is declared as a device store but no longer uses one`);
  }
  if (findings.length === 0 && stale.length === 0) {
    console.log(
      `No content in browser storage. ${ALLOWED.size} declared device/model stores, all still used.`,
    );
  }
}

if (findings.length > 0 || stale.length > 0) process.exitCode = 1;
