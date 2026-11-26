import assert from "node:assert/strict";
import test from "node:test";
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  type PreferenceBackend,
} from "../../src/lib/notifications/preference-sync.ts";
import { normalisePreferences } from "../../src/lib/notifications/preferences.ts";

const prefs = normalisePreferences(null, []);

test("a save from an out-of-date copy reports changed_elsewhere and no revision", async () => {
  let seen = -1;
  const backend: PreferenceBackend = {
    read: async () => ({ row: null, error: null }),
    save: async (_p, expected) => {
      seen = expected;
      return { revision: null, error: null, stale: true };
    },
  };
  const outcome = await saveNotificationPreferences({
    backend,
    preferences: prefs,
    expectedRevision: 3,
  });
  assert.equal(seen, 3);
  assert.equal(outcome.state, "changed_elsewhere");
});

test("a load returns the revision it read so the next save can name it", async () => {
  const backend: PreferenceBackend = {
    read: async () => ({
      row: { mute_optional: false, quiet_hours: null, categories: {}, revision: 7 },
      error: null,
    }),
    save: async () => ({ revision: 8, error: null }),
  };
  const loaded = await loadNotificationPreferences({ backend, availableChannelIds: [] });
  assert.equal(loaded.revision, 7);
  const none = await loadNotificationPreferences({
    backend: { ...backend, read: async () => ({ row: null, error: null }) },
    availableChannelIds: [],
  });
  assert.equal(none.revision, 0);
});
