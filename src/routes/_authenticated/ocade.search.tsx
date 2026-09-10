import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Brain,
  FileOutput,
  FolderKanban,
  ListChecks,
  Loader2,
  MessageSquare,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Input } from "@/components/ui/input";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { scoreMatch, snippetAround, sortResults, type SearchResult } from "@/lib/search/results";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/ocade/search")({
  head: () => ({ meta: [{ title: "Search — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: SearchPage,
});

/** Escape LIKE wildcards while keeping the value inside typed filter calls. */
function escapedLike(raw: string) {
  return raw.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/**
 * Search only through Supabase's parameterized filter methods.
 *
 * `.or()` accepts raw PostgREST filter grammar. Interpolating search text into
 * that string lets punctuation such as commas or parentheses alter the filter
 * expression even when LIKE wildcards are escaped. Separate typed queries keep
 * the user's text as data, then de-duplicate matching records by id.
 */
/**
 * Search the account, through Supabase's parameterized filter methods.
 *
 * Kept as separate typed queries rather than one `.or()` because `.or()` takes
 * raw PostgREST grammar, and interpolating a person's search text into that
 * lets punctuation alter the filter expression even with LIKE wildcards
 * escaped. The user's text stays data.
 *
 * Every row is RLS-scoped to the account, so this cannot reach across users or
 * organizations however the query is shaped.
 */
async function searchAccount(raw: string): Promise<SearchResult[]> {
  const supabase = await loadSupabaseClient();
  const q = raw.trim();
  if (q.length < 2) return [];
  const pattern = `%${escapedLike(q)}%`;

  const [
    conversations,
    messages,
    projectsByName,
    projectsByInstructions,
    outputsByTitle,
    outputsByContent,
    tasks,
    memories,
  ] = await Promise.all([
    supabase
      .from("ocade_conversations")
      .select("id, title, updated_at")
      .ilike("title", pattern)
      .limit(20),
    supabase
      .from("ocade_messages")
      .select("id, conversation_id, role, content, created_at")
      .ilike("content", pattern)
      .limit(30),
    supabase
      .from("ocade_projects")
      .select("id, name, instructions, updated_at")
      .ilike("name", pattern)
      .limit(20),
    supabase
      .from("ocade_projects")
      .select("id, name, instructions, updated_at")
      .ilike("instructions", pattern)
      .limit(20),
    supabase
      .from("ocade_outputs")
      .select("id, title, content, kind, created_at")
      .ilike("title", pattern)
      .limit(20),
    supabase
      .from("ocade_outputs")
      .select("id, title, content, kind, created_at")
      .ilike("content", pattern)
      .limit(20),
    /*
     * TASKS AND MEMORIES ARE PART OF THE SAME ACCOUNT.
     *
     * Searching for a task by its title used to return nothing, which reads as
     * "you never wrote that down" rather than "this box does not look there" —
     * and a memory, which is the most personal thing OCADE holds, was equally
     * unfindable. Same typed filters, same RLS scoping, same bounds.
     */
    supabase
      .from("ocade_tasks")
      .select("id, title, request, status, updated_at")
      .ilike("title", pattern)
      .limit(20),
    supabase
      .from("ocade_memory")
      .select("id, content, scope, updated_at")
      .ilike("content", pattern)
      .limit(20),
  ]);

  const responses = [
    conversations,
    messages,
    projectsByName,
    projectsByInstructions,
    outputsByTitle,
    outputsByContent,
    tasks,
    memories,
  ];
  const firstError = responses.find((response) => response.error)?.error;
  if (firstError) throw firstError;

  const projects = new Map<string, NonNullable<typeof projectsByName.data>[number]>();
  for (const row of [...(projectsByName.data ?? []), ...(projectsByInstructions.data ?? [])]) {
    projects.set(row.id, row);
  }

  const outputs = new Map<string, NonNullable<typeof outputsByTitle.data>[number]>();
  for (const row of [...(outputsByTitle.data ?? []), ...(outputsByContent.data ?? [])]) {
    outputs.set(row.id, row);
  }

  return [
    ...(conversations.data ?? []).map((row) => ({
      key: `conversation:${row.id}`,
      kind: "conversation" as const,
      title: row.title || "Untitled conversation",
      createdAt: row.updated_at,
      conversationId: row.id,
      score: scoreMatch(row.title ?? "", "", q),
    })),
    ...(messages.data ?? []).map((row) => ({
      key: `message:${row.id}`,
      kind: "message" as const,
      title: `${row.role === "assistant" ? "OCADE" : "You"} message`,
      excerpt: snippetAround(row.content ?? "", q),
      createdAt: row.created_at,
      conversationId: row.conversation_id,
      score: scoreMatch("", row.content ?? "", q),
    })),
    ...[...projects.values()].map((row) => ({
      key: `project:${row.id}`,
      kind: "project" as const,
      title: row.name,
      excerpt: row.instructions ? snippetAround(row.instructions, q) : undefined,
      createdAt: row.updated_at,
      score: scoreMatch(row.name ?? "", row.instructions ?? "", q),
    })),
    ...(tasks.data ?? []).map((row) => ({
      key: `task:${row.id}`,
      kind: "task" as const,
      title: row.title,
      excerpt: row.request ? snippetAround(row.request, q) : undefined,
      createdAt: row.updated_at,
      to: "/ocade/tasks",
      score: scoreMatch(row.title ?? "", row.request ?? "", q),
    })),
    ...(memories.data ?? []).map((row) => ({
      key: `memory:${row.id}`,
      kind: "memory" as const,
      // The memory IS the content, so the title is the snippet rather than a
      // heading invented for it.
      title: snippetAround(row.content ?? "", q, 80),
      excerpt: row.scope === "project" ? "Project memory" : "Account memory",
      createdAt: row.updated_at,
      to: "/settings/memory",
      score: scoreMatch("", row.content ?? "", q),
    })),
    ...[...outputs.values()].map((row) => ({
      key: `output:${row.id}`,
      kind: "output" as const,
      title: row.title,
      excerpt: row.content ? snippetAround(row.content, q) : undefined,
      createdAt: row.created_at,
      score: scoreMatch(row.title ?? "", row.content ?? "", q),
    })),
  ];
}

function SearchPage() {
  /*
   * `useSession` rather than the route context: the context's `user` is typed
   * as possibly-absent on this layout, and Search is only reachable signed in,
   * so the hook the rest of the authenticated product uses is the honest
   * source. Without a user id there is no local corpus to read.
   */
  const { user } = useSession();
  const userId = user?.id ?? "";
  const [query, setQuery] = useState("");
  const normalized = useMemo(() => query.trim(), [query]);

  const results = useQuery({
    queryKey: ["ocade-universal-search", normalized, userId],
    enabled: normalized.length >= 2 && userId.length > 0,
    /*
     * ONE CORPUS, ASKED ONCE.
     *
     * This used to read an encrypted device store first and fold the server's
     * answer into it, because a Browser Only conversation was never uploaded
     * and could not otherwise be found. `PLAN.md` Phase 2 removed that mode:
     * every conversation, project and output is an account row, so the account
     * is the whole corpus and a merge would have nothing to merge.
     */
    queryFn: () => searchAccount(normalized).then(sortResults),
    staleTime: 10_000,
  });

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Search"
        description="Search your conversations, message text, projects, saved outputs, tasks and memories. Results are protected by the same RLS rules as the records themselves."
      />
      <div className="mt-6 max-w-3xl">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search OCADE…"
            className="pl-9"
            aria-label="Search OCADE"
          />
        </div>
        {normalized.length < 2 ? (
          <p className="mt-3 text-sm text-muted-foreground">Type at least two characters.</p>
        ) : results.isPending ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching your workspace…
          </p>
        ) : results.isError ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            Search failed:{" "}
            {results.error instanceof Error ? results.error.message : String(results.error)}
          </div>
        ) : results.data.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No matching OCADE content.</p>
        ) : (
          <GlassPanel className="mt-4 overflow-hidden p-0">
            <ul className="divide-y divide-border/40">
              {results.data.map((result) => (
                <ResultRow key={result.key} result={result} />
              ))}
            </ul>
          </GlassPanel>
        )}
      </div>
    </>
  );
}

const ICONS: Record<SearchResult["kind"], typeof MessageSquare> = {
  project: FolderKanban,
  output: FileOutput,
  task: ListChecks,
  memory: Brain,
  conversation: MessageSquare,
  message: MessageSquare,
};

function ResultRow({ result }: { result: SearchResult }) {
  const Icon = ICONS[result.kind];
  /*
   * WHERE THE ROW LIVES. A task and a memory carry their own destination,
   * because neither is in Chat and dropping the reader at the top of it is the
   * same failure as not finding the row at all.
   */
  const to =
    result.to ??
    (result.kind === "project"
      ? "/ocade/projects"
      : result.kind === "output"
        ? "/ocade/artifacts"
        : "/ocade");

  /*
   * A result you cannot open is a result you did not find. Conversation and
   * message rows carry the id they matched, so the link opens THAT
   * conversation instead of dropping the reader at the top of Chat.
   */
  const search = result.conversationId ? { conversation: result.conversationId } : undefined;

  return (
    <li>
      <Link
        to={to}
        {...(search ? { search } : {})}
        className="flex gap-3 px-4 py-3 hover:bg-accent/40"
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{result.title}</span>
          {result.excerpt ? (
            <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
              {result.excerpt}
            </span>
          ) : null}
          <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {result.kind}
            {result.createdAt ? ` · ${new Date(result.createdAt).toLocaleString()}` : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}
