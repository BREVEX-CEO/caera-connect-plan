import { describe, expect, it } from "vitest";
import { buildGraph } from "../graph";
import type { JarvisState } from "../jarvis.functions";

const empty: JarvisState = {
  conversations: [],
  tasks: [],
  devices: [],
  permissions: [],
  memories: [],
  activity: [],
  sites: [],
  usage: null,
};

const at = "2026-09-20T10:00:00.000Z";

describe("the orb graph", () => {
  it("starts as a single core for a new account", () => {
    expect(buildGraph(empty).nodes.map((n) => n.kind)).toEqual(["core"]);
    expect(buildGraph(undefined).edges).toEqual([]);
  });

  it("grows only from real records, with threads between related ones", () => {
    const graph = buildGraph({
      ...empty,
      conversations: [{ id: "c1", title: "Trip", archived: false, created_at: at, updated_at: at }],
      tasks: [
        {
          id: "t1",
          conversation_id: "c1",
          device_id: "d1",
          title: "Book",
          plan: ["a"],
          current_step: 0,
          status: "completed",
          blocker: null,
          result: "Private result text",
          browser_mode: "isolated",
          checkpoint: null,
          created_at: at,
          updated_at: at,
        },
      ],
      devices: [
        {
          id: "d1",
          name: "Laptop",
          platform: "Linux",
          capabilities: {},
          last_seen_at: at,
          revoked_at: null,
          created_at: at,
          kind: "agent",
          software_version: null,
          background_enabled: false,
          online: true,
        },
      ],
      memories: [{ id: "m1", content: "I prefer the private editor", created_at: at }],
    });
    const kinds = graph.nodes.map((n) => n.kind);
    expect(kinds.filter((k) => k === "hub")).toHaveLength(4);
    expect(graph.edges).toContainEqual({ from: "task:t1", to: "conversation:c1" });
    expect(graph.edges).toContainEqual({ from: "task:t1", to: "device:d1" });
  });

  it("never puts private content in a node", () => {
    const graph = buildGraph({
      ...empty,
      memories: [{ id: "m1", content: "My passport number is 123", created_at: at }],
    });
    const text = JSON.stringify(graph);
    expect(text).not.toContain("passport");
  });

  it("draws the same shape for the same data", () => {
    const state = { ...empty, sites: ["example.com"] };
    expect(buildGraph(state)).toEqual(buildGraph(state));
  });
});
