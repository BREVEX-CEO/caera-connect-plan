/**
 * AN IN-MEMORY `ocade_outputs`, BEHAVING LIKE THE REAL ONE.
 *
 * Artifacts are rows in the account now, so the store's own logic — kind
 * mapping, the refusal to save without provenance, integrity re-hashing,
 * lineage — can only be exercised against something that answers like the
 * table. This is that something.
 *
 * IT IS NOT A STUB THAT RETURNS WHATEVER THE TEST WANTS. It enforces the rules
 * the server enforces, because those rules are what the store is written
 * against: a first version is its own lineage, a child inherits its parent's
 * lineage and takes the next number, an unknown id is a 404, and a digest is
 * computed from the content rather than accepted from the caller. A fake that
 * were more permissive than the server would let the store pass here and fail
 * in production, which is the only way a fake can be actively harmful.
 */
import type { OcadeOutput } from "@/lib/ocade-projects.functions";

export interface FakeOutputStore {
  rows: OcadeOutput[];
  /** Wired into `vi.mock("@/lib/ocade-projects.functions", …)`. */
  module: {
    createOutput: (input: { data: Record<string, unknown> }) => Promise<OcadeOutput>;
    listOutputs: (input?: { data?: { projectId?: string | null } }) => Promise<OcadeOutput[]>;
    getOutput: (input: { data: { id: string } }) => Promise<OcadeOutput>;
    deleteOutput: (input: { data: { id: string } }) => Promise<{ ok: true }>;
    setOutputRetention: (input: {
      data: { id: string; days: number | null };
    }) => Promise<OcadeOutput>;
    purgeExpiredOutputs: () => Promise<{ removed: number }>;
  };
  reset: () => void;
  /** Rewrite a stored row, the way something outside OCADE could. */
  corrupt: (id: string, patch: Partial<OcadeOutput>) => void;
}

async function digestOf(content: string): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const bytes = await subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function notFound(): never {
  throw new Response("Output not found", { status: 404 });
}

export function createFakeOutputStore(): FakeOutputStore {
  let rows: OcadeOutput[] = [];
  let counter = 0;
  /*
   * A strictly increasing clock. Several saves complete inside one millisecond
   * in a test, and the real table orders by `created_at DESC`; without this the
   * order of two same-tick rows would be arbitrary and the tests that assert
   * "newest first" would pass or fail by luck.
   */
  let clock = Date.parse("2026-07-23T12:00:00.000Z");

  const store: FakeOutputStore = {
    get rows() {
      return rows;
    },
    reset() {
      rows = [];
      counter = 0;
      clock = Date.parse("2026-07-23T12:00:00.000Z");
    },
    corrupt(id, patch) {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) throw new Error(`no such row: ${id}`);
      rows[index] = { ...rows[index], ...patch } as OcadeOutput;
    },
    module: {
      async createOutput({ data }) {
        const input = data as {
          kind: OcadeOutput["kind"];
          title: string;
          content?: string | null;
          mime?: string | null;
          producedBy: string;
          verified?: boolean;
          evidence?: string | null;
          context?: OcadeOutput["context"];
          parentOutputId?: string | null;
          projectId?: string | null;
          conversationId?: string | null;
          retentionDays?: number | null;
        };
        if (!input.producedBy?.trim()) {
          throw new Response("producedBy is required", { status: 400 });
        }
        counter += 1;
        clock += 1;
        const id = `output-${counter}`;
        const content = input.content ?? null;

        let lineageId = id;
        let version = 1;
        if (input.parentOutputId) {
          const parent = rows.find((row) => row.id === input.parentOutputId);
          if (!parent) notFound();
          lineageId = parent.lineage_id;
          version = parent.version + 1;
        }

        const row: OcadeOutput = {
          id,
          project_id: input.projectId ?? null,
          conversation_id: input.conversationId ?? null,
          parent_output_id: input.parentOutputId ?? null,
          kind: input.kind,
          title: input.title,
          content,
          mime: input.mime ?? null,
          size_bytes: content ? new TextEncoder().encode(content).length : 0,
          lineage_id: lineageId,
          version,
          content_sha256: content ? await digestOf(content) : null,
          produced_by: input.producedBy,
          verified: input.verified ?? false,
          evidence: input.evidence ?? null,
          context: input.context ?? null,
          expires_at: input.retentionDays
            ? new Date(clock + input.retentionDays * 86_400_000).toISOString()
            : null,
          created_at: new Date(clock).toISOString(),
        };
        rows = [row, ...rows];
        return row;
      },
      async listOutputs(input) {
        const projectId = input?.data?.projectId ?? null;
        const matching = projectId ? rows.filter((row) => row.project_id === projectId) : rows;
        return [...matching].sort((a, b) => b.created_at.localeCompare(a.created_at));
      },
      async getOutput({ data }) {
        return rows.find((row) => row.id === data.id) ?? notFound();
      },
      async deleteOutput({ data }) {
        rows = rows.filter((row) => row.id !== data.id);
        return { ok: true };
      },
      async setOutputRetention({ data }) {
        const index = rows.findIndex((row) => row.id === data.id);
        if (index < 0) notFound();
        const expiresAt =
          data.days === null ? null : new Date(clock + data.days * 86_400_000).toISOString();
        rows[index] = { ...rows[index], expires_at: expiresAt };
        return rows[index];
      },
      async purgeExpiredOutputs() {
        const now = clock;
        const before = rows.length;
        rows = rows.filter((row) => !row.expires_at || Date.parse(row.expires_at) > now);
        return { removed: before - rows.length };
      },
    },
  };
  return store;
}

/** Move the fake's clock forward, so retention can actually expire. */
export function advance(store: FakeOutputStore, days: number): void {
  for (const row of store.rows) {
    if (!row.expires_at) continue;
    // Rewriting the expiry backwards is the same as moving time forwards, and
    // keeps the fake's single clock the only source of "now".
    (row as { expires_at: string | null }).expires_at = new Date(
      Date.parse(row.expires_at) - days * 86_400_000,
    ).toISOString();
  }
}
