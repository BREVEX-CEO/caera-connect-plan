import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileOutput, FolderKanban, Loader2, MessageSquare, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ocade/search")({
  head: () => ({ meta: [{ title: "Search — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: SearchPage,
});

type SearchResult = {
  key: string;
  kind: "conversation" | "message" | "project" | "output";
  title: string;
  excerpt?: string | null;
  createdAt?: string | null;
};

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
async function searchOcade(raw: string): Promise<SearchResult[]> {
  const q = raw.trim();
  if (q.length < 2) return [];
  const pattern = `%${escapedLike(q)}%`;

  const [conversations, messages, projectsByName, projectsByInstructions, outputsByTitle, outputsByContent] =
    await Promise.all([
      supabase.from("ocade_conversations").select("id, title, updated_at").ilike("title", pattern).limit(20),
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
    ]);

  const responses = [
    conversations,
    messages,
    projectsByName,
    projectsByInstructions,
    outputsByTitle,
    outputsByContent,
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
    })),
    ...(messages.data ?? []).map((row) => ({
      key: `message:${row.id}`,
      kind: "message" as const,
      title: `${row.role === "assistant" ? "OCADE" : "You"} message`,
      excerpt: row.content.slice(0, 220),
      createdAt: row.created_at,
    })),
    ...[...projects.values()].map((row) => ({
      key: `project:${row.id}`,
      kind: "project" as const,
      title: row.name,
      excerpt: row.instructions?.slice(0, 220),
      createdAt: row.updated_at,
    })),
    ...[...outputs.values()].map((row) => ({
      key: `output:${row.id}`,
      kind: "output" as const,
      title: row.title,
      excerpt: row.content?.slice(0, 220),
      createdAt: row.created_at,
    })),
  ].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const normalized = useMemo(() => query.trim(), [query]);
  const results = useQuery({
    queryKey: ["ocade-universal-search", normalized],
    enabled: normalized.length >= 2,
    queryFn: () => searchOcade(normalized),
    staleTime: 10_000,
  });

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Search"
        description="Search your actual conversations, message text, projects and saved outputs. Results are protected by the same RLS rules as the source records."
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
            Search failed: {results.error instanceof Error ? results.error.message : String(results.error)}
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

function ResultRow({ result }: { result: SearchResult }) {
  const Icon = result.kind === "project" ? FolderKanban : result.kind === "output" ? FileOutput : MessageSquare;
  const to = result.kind === "project" ? "/ocade/projects" : result.kind === "output" ? "/ocade/artifacts" : "/ocade";

  return (
    <li>
      <Link to={to} className="flex gap-3 px-4 py-3 hover:bg-accent/40">
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
