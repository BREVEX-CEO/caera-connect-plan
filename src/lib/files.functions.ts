/**
 * File management server functions (G1-G4 production wiring).
 *
 * Node-only for the same reason as `sandbox.functions.ts`: the implementation
 * imports `node:fs`, and a client-reachable import would pull Node builtins
 * into the browser bundle. The `await import()` inside each handler keeps it on
 * the server.
 *
 * TWO THINGS THE CALLER DOES NOT GET TO DECIDE
 *
 * 1. **The approved root is not a free-text parameter.** A client that could
 *    name its own root could name `C:\`. Callers pass a root, but it is checked
 *    against the same denylist and scope rules the file manager enforces, and
 *    the protected-path list refuses system locations regardless.
 * 2. **Deletion is always reversible.** There is no permanent-delete function
 *    exposed here at all. Files move to a trash folder with a record of where
 *    they came from and what they hashed to.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SearchHit, TrashRecord } from "@/lib/files/manager";

/** Bounds the client cannot raise. A request is not an instruction. */
const MAX_SEARCH_HITS = 200;
const MAX_DEPTH = 8;

const searchInput = z.object({
  root: z.string().min(1).max(4096),
  match: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(MAX_SEARCH_HITS).optional(),
});

export const searchFilesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(searchInput)
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; hits: SearchHit[]; truncated: boolean } | { ok: false; reason: string }
    > => {
      const { searchFiles } = await import("@/lib/files/manager");
      const { nodeFileSystem } = await import("@/lib/files/manager.node");
      return searchFiles(nodeFileSystem(), data.root, {
        match: data.match,
        limit: Math.min(data.limit ?? MAX_SEARCH_HITS, MAX_SEARCH_HITS),
        maxDepth: MAX_DEPTH,
      });
    },
  );

const copyInput = z.object({
  root: z.string().min(1).max(4096),
  from: z.string().min(1).max(4096),
  to: z.string().min(1).max(4096),
});

export const copyFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(copyInput)
  .handler(async ({ data }) => {
    const { copyFileVerified } = await import("@/lib/files/manager");
    const { nodeFileSystem } = await import("@/lib/files/manager.node");
    // Overwrite is deliberately NOT exposed: a client that can pass
    // overwrite:true can silently replace a user's file.
    return copyFileVerified(nodeFileSystem(), data.root, data.from, data.to);
  });

export const moveFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(copyInput)
  .handler(async ({ data }) => {
    const { moveFileVerified } = await import("@/lib/files/manager");
    const { nodeFileSystem } = await import("@/lib/files/manager.node");
    return moveFileVerified(nodeFileSystem(), data.root, data.from, data.to);
  });

const deleteInput = z.object({
  root: z.string().min(1).max(4096),
  trashDir: z.string().min(1).max(4096),
  target: z.string().min(1).max(4096),
});

export const deleteToTrashFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(deleteInput)
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; record: TrashRecord; evidence: string } | { ok: false; reason: string }
    > => {
      const { deleteToTrash } = await import("@/lib/files/manager");
      const { nodeFileSystem } = await import("@/lib/files/manager.node");
      return deleteToTrash(nodeFileSystem(), data.root, data.trashDir, data.target);
    },
  );

const restoreInput = z.object({
  root: z.string().min(1).max(4096),
  record: z.object({
    id: z.string(),
    originalPath: z.string(),
    trashPath: z.string(),
    sha256: z.string(),
    sizeBytes: z.number(),
    deletedAt: z.string(),
  }),
});

export const restoreFromTrashFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(restoreInput)
  .handler(async ({ data }) => {
    const { restoreFromTrash } = await import("@/lib/files/manager");
    const { nodeFileSystem } = await import("@/lib/files/manager.node");
    return restoreFromTrash(nodeFileSystem(), data.root, data.record);
  });
