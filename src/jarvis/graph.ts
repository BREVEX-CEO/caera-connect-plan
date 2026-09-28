/**
 * The orb's graph, built only from the account's real JARVIS data.
 *
 * An empty account has one node: the core. Each category that holds anything
 * gains a hub, each record a node around its hub, and threads join what is
 * genuinely related (a task to its conversation and its device). Positions are
 * derived from ids, so the same data always draws the same shape.
 *
 * Metadata is safe by construction: counts, dates, status and short titles the
 * sidebar already lists. Memory text and task results are never in a node.
 */
import type { JarvisState } from "./jarvis.functions";

export type NodeKind = "core" | "hub" | "conversation" | "task" | "memory" | "device" | "app";
export type Category = "conversation" | "task" | "memory" | "device" | "app";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  category?: Category;
  label: string;
  meta: [string, string][];
  /** Unit-sphere-ish position, radius 0 (core) to ~1.25 (records). */
  position: [number, number, number];
  /** The record this node stands for, for an explicit open. */
  recordId?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const HUBS: Record<Category, { label: string; direction: [number, number, number] }> = {
  conversation: { label: "Conversations", direction: [0.85, 0.35, 0.4] },
  task: { label: "Tasks", direction: [-0.8, 0.45, 0.35] },
  memory: { label: "Memory", direction: [0.1, -0.85, 0.5] },
  device: { label: "Devices", direction: [-0.45, -0.55, -0.7] },
  app: { label: "Allowed Apps", direction: [0.55, 0.15, -0.8] },
};

/** A stable number in [0, 1) from a string. */
function unit(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100_000) / 100_000;
}

function normalise([x, y, z]: [number, number, number]): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function around(hub: [number, number, number], id: string): [number, number, number] {
  const spread = 0.55;
  const [x, y, z] = normalise([
    hub[0] + (unit(id, 1) - 0.5) * spread * 2,
    hub[1] + (unit(id, 2) - 0.5) * spread * 2,
    hub[2] + (unit(id, 3) - 0.5) * spread * 2,
  ]);
  const radius = 0.95 + unit(id, 4) * 0.3;
  return [x * radius, y * radius, z * radius];
}

const date = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));

const MAX_PER_CATEGORY = 60;

export function buildGraph(state: JarvisState | undefined): Graph {
  const nodes: GraphNode[] = [
    { id: "core", kind: "core", label: "OCADE JARVIS", meta: [], position: [0, 0, 0] },
  ];
  const edges: GraphEdge[] = [];
  if (!state) return { nodes, edges };

  const groups: Record<Category, GraphNode[]> = {
    conversation: state.conversations.slice(0, MAX_PER_CATEGORY).map((c) => ({
      id: `conversation:${c.id}`,
      kind: "conversation",
      category: "conversation",
      label: c.title,
      recordId: c.id,
      meta: [
        ["Type", "Conversation"],
        ["Started", date(c.created_at)],
        ["Last active", date(c.updated_at)],
      ],
      position: around(HUBS.conversation.direction, c.id),
    })),
    task: state.tasks.slice(0, MAX_PER_CATEGORY).map((t) => ({
      id: `task:${t.id}`,
      kind: "task",
      category: "task",
      label: t.title,
      recordId: t.id,
      meta: [
        ["Type", "Task"],
        ["Status", t.status.replace("_", " ")],
        ["Steps", String(t.plan.length)],
        ["Started", date(t.created_at)],
      ],
      position: around(HUBS.task.direction, t.id),
    })),
    memory: state.memories.slice(0, MAX_PER_CATEGORY).map((m) => ({
      id: `memory:${m.id}`,
      kind: "memory",
      category: "memory",
      label: "Saved preference",
      recordId: m.id,
      meta: [
        ["Type", "Memory"],
        ["Saved", date(m.created_at)],
        ["Length", `${m.content.length} characters`],
      ],
      position: around(HUBS.memory.direction, m.id),
    })),
    device: state.devices
      .filter((d) => !d.revoked_at && d.last_seen_at)
      .slice(0, MAX_PER_CATEGORY)
      .map((d) => ({
        id: `device:${d.id}`,
        kind: "device",
        category: "device",
        label: d.name,
        recordId: d.id,
        meta: [
          ["Type", "Device"],
          ["Status", d.online ? "Online" : "Offline"],
          ["Paired", date(d.created_at)],
        ],
        position: around(HUBS.device.direction, d.id),
      })),
    app: [
      ...state.sites.map((site): GraphNode => ({
        id: `app:${site}`,
        kind: "app",
        category: "app",
        label: site,
        recordId: site,
        meta: [
          ["Type", "Website"],
          [
            "Allowed",
            state.permissions.find((p) => p.capability === `site:${site}` && p.device_id === null)
              ?.allowed === false
              ? "No"
              : "Yes",
          ],
        ],
        position: around(HUBS.app.direction, site),
      })),
      // Computer apps the person made a decision about. An app only found on a
      // computer is a list entry, not yet a relationship.
      ...(state.apps ?? []).flatMap((group) =>
        group.apps
          .filter((app) => app.rule !== "ask")
          .map((app): GraphNode => ({
            id: `app:computer:${group.deviceId}:${app.name.toLowerCase()}`,
            kind: "app" as const,
            category: "app" as const,
            label: app.name,
            recordId: app.name,
            meta: [
              ["Type", `App on ${group.deviceName}`],
              ["Allowed", app.rule === "always" ? "Always" : "Never"],
            ] as [string, string][],
            position: around(HUBS.app.direction, `computer:${group.deviceId}:${app.name}`),
          })),
      ),
    ].slice(0, MAX_PER_CATEGORY),
  };

  for (const category of Object.keys(HUBS) as Category[]) {
    const members = groups[category];
    if (members.length === 0) continue;
    const hubId = `hub:${category}`;
    nodes.push({
      id: hubId,
      kind: "hub",
      category,
      label: HUBS[category].label,
      meta: [["Items", String(members.length)]],
      position: normalise(HUBS[category].direction).map((v) => v * 0.62) as [
        number,
        number,
        number,
      ],
    });
    edges.push({ from: "core", to: hubId });
    for (const member of members) {
      nodes.push(member);
      edges.push({ from: hubId, to: member.id });
    }
  }

  const present = new Set(nodes.map((n) => n.id));
  for (const t of state.tasks.slice(0, MAX_PER_CATEGORY)) {
    const conversation = `conversation:${t.conversation_id}`;
    if (present.has(conversation)) edges.push({ from: `task:${t.id}`, to: conversation });
    const device = `device:${t.device_id}`;
    if (t.device_id && present.has(device)) edges.push({ from: `task:${t.id}`, to: device });
  }
  return { nodes, edges };
}
