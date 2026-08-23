/**
 * A conversation must be able to exist before the network does.
 */
import { describe, it, expect } from "vitest";
import {
  newConversationId,
  mergeRemoteConversations,
  isConversationKey,
  conversationKey,
  type LocalConversation,
} from "../local-conversations";

const conv = (over: Partial<LocalConversation> = {}): LocalConversation => ({
  id: "11111111-1111-7111-8111-111111111111",
  title: "New chat",
  pinned: false,
  archived: false,
  model_id: null,
  privacy_mode: "private_sync",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  ...over,
});

describe("client-generated ids", () => {
  it("are valid v7 uuids, so Postgres accepts them on sync", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(newConversationId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("are unique", () => {
    const seen = new Set(Array.from({ length: 2000 }, () => newConversationId()));
    expect(seen.size).toBe(2000);
  });

  it("sort by creation time, so two devices merge in a sensible order", () => {
    expect(newConversationId(1_000_000_000_000) < newConversationId(1_900_000_000_000)).toBe(true);
  });
});

describe("conversation keys never collide with message keys", () => {
  it("separates the two by prefix", () => {
    expect(isConversationKey(conversationKey("abc"))).toBe(true);
    expect(isConversationKey("c1::2026-01-01T00:00:00.000Z::xyz")).toBe(false);
  });
});

describe("merging another device's conversations", () => {
  it("adds a conversation this device has never seen", () => {
    const remote = conv({ id: "22222222-2222-7222-8222-222222222222", title: "From laptop" });
    expect(mergeRemoteConversations([], [remote]).map((c) => c.title)).toEqual(["From laptop"]);
  });

  it("never resurrects something deleted here", () => {
    const mine = conv({ deleted_at: "2026-01-02T00:00:00.000Z" });
    const theirs = conv({ title: "Still here", updated_at: "2026-01-03T00:00:00.000Z" });
    expect(mergeRemoteConversations([mine], [theirs])).toEqual([]);
  });

  it("accepts a delete made on the other device", () => {
    const mine = conv({ title: "Local" });
    const theirs = conv({ deleted_at: "2026-01-05T00:00:00.000Z" });
    expect(mergeRemoteConversations([mine], [theirs])).toEqual([]);
  });

  it("takes the newer edit when both sides changed", () => {
    const mine = conv({ title: "Old title", updated_at: "2026-01-01T00:00:00.000Z" });
    const theirs = conv({ title: "New title", updated_at: "2026-01-04T00:00:00.000Z" });
    expect(mergeRemoteConversations([mine], [theirs])[0].title).toBe("New title");
  });

  it("keeps the local edit when it is newer", () => {
    const mine = conv({ title: "Newer here", updated_at: "2026-02-01T00:00:00.000Z" });
    const theirs = conv({ title: "Older there", updated_at: "2026-01-04T00:00:00.000Z" });
    expect(mergeRemoteConversations([mine], [theirs])[0].title).toBe("Newer here");
  });

  it("never duplicates a conversation that exists on both sides", () => {
    expect(mergeRemoteConversations([conv()], [conv()])).toHaveLength(1);
  });

  it("returns newest first", () => {
    const a = conv({
      id: "aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const b = conv({
      id: "bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb",
      updated_at: "2026-03-01T00:00:00.000Z",
    });
    expect(mergeRemoteConversations([a, b], []).map((c) => c.id[0])).toEqual(["b", "a"]);
  });
});
