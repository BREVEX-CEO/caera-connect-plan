import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, Check, Loader2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";
import { requireAdminRole } from "@/lib/admin/route-gate";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import type { AssuranceRefusal } from "@/lib/security/assurance";
import { proveIdentityWithPassword } from "@/lib/security/reauthentication";
import {
  SUPPORT_ARTICLES,
  SUPPORT_CATEGORIES,
  type SupportArticle,
  type SupportCategoryId,
} from "@/lib/support/articles";
import {
  keywordsFrom,
  loadArticleOverrides,
  mergeArticles,
  paragraphsFrom,
  textFrom,
} from "@/lib/support/catalogue";
import { saveSupportArticle, type PublishOutcome } from "@/lib/admin/help-publishing";

/**
 * HELP-CONTENT MANAGEMENT — PLAN.md §L's publishing workflow, §G's list.
 *
 * The article model has had a draft/published state since the Help Center was
 * built, and the only way to change one was to edit a TypeScript file and ship
 * it. That is a publishing workflow for engineers; the person who knows the
 * answer to a support question is usually not the person who can deploy.
 *
 * WHAT AN EDITOR MAY CHANGE, AND WHAT THEY MAY NOT. The form offers the title,
 * summary, category, body, keywords and state. It does NOT offer the slug of an
 * existing article, the version it applies from, the platforms, the related
 * reading or the locale — a help URL ends up in a support reply, a bookmark and
 * somebody's runbook, and renaming one silently turns all three into a 404.
 * Those fields stay in source, where changing one is a reviewed change.
 *
 * DRAFTS ARE NOT PUBLIC, AND THAT IS ENFORCED BELOW THIS SCREEN. The public
 * policy on the table filters by status, so a draft is invisible to a
 * signed-out visitor whatever this page does — which is what makes the state
 * worth having. Half-written guidance found through search is worse than no
 * guidance.
 *
 * EVERY SAVE IS A VERSION. The revision table is append-only, so "what did the
 * Help Center say about refunds in September" has an answer, and an editor who
 * publishes something wrong cannot make it look as though they never did.
 */
export const Route = createFileRoute("/_authenticated/admin/help")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Help content — CARCC CADANE Admin" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: () => requireAdminRole("help-content management"),
  component: AdminHelpPage,
});

/** A slug an editor typed, in the shape the schema will accept. */
function slugProblem(slug: string): string | null {
  if (!slug) return "A new article needs a handle.";
  if (!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(slug)) {
    return "Use lower-case letters, numbers and hyphens, three to eighty characters.";
  }
  return null;
}

function AdminHelpPage() {
  const { user } = useSession();
  const [selected, setSelected] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<{
    reason: AssuranceRefusal;
    message: string;
    retry: () => Promise<void>;
  } | null>(null);

  /*
   * Read as the administrator, so drafts are included — the same function the
   * public page calls, with the difference being the caller's token rather than
   * a flag somebody could pass wrongly.
   */
  const overrides = useQuery({
    queryKey: ["admin", "support-overrides"],
    queryFn: async () => loadArticleOverrides(await loadSupabaseClient()),
  });

  const articles = useMemo(
    () => mergeArticles(SUPPORT_ARTICLES, overrides.data ?? []),
    [overrides.data],
  );

  const current = articles.find((article) => article.slug === selected) ?? null;

  const run = useCallback(
    async (action: () => Promise<PublishOutcome>, success: string) => {
      const attempt = async (): Promise<boolean> => {
        setBusy(true);
        setProblem(null);
        setNotice(null);
        const result = await action();
        setBusy(false);
        if (!result.ok) {
          if (result.reason) {
            setRefusal({
              reason: result.reason,
              message: result.message,
              retry: async () => {
                await attempt();
              },
            });
          } else {
            setRefusal(null);
            setProblem(result.message);
          }
          return false;
        }
        setRefusal(null);
        setNotice(success);
        await overrides.refetch();
        return true;
      };
      return attempt();
    },
    [overrides],
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="CARCC CADANE"
        title="Help content"
        description="Twenty-one answers ship with the build. Anything changed here replaces one of them, or adds a new one, without a deploy."
      />

      {refusal ? (
        <ConfirmIdentity
          reason={refusal.reason}
          message={refusal.message}
          email={user?.email ?? null}
          onProved={refusal.retry}
          onDismiss={() => setRefusal(null)}
        />
      ) : null}
      {problem ? (
        <GlassPanel className="mt-4 p-4" role="alert">
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {problem}
          </p>
        </GlassPanel>
      ) : null}
      {notice ? (
        <GlassPanel className="mt-4 p-4" role="status">
          <p className="flex items-start gap-2 text-sm text-[color:var(--state-success)]">
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        </GlassPanel>
      ) : null}

      <GlassPanel className="mt-6 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Which article
        </h2>
        {overrides.isLoading ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reading what has been published…
          </p>
        ) : (
          <>
            <Label htmlFor="help-article" className="mt-3 block">
              Article
            </Label>
            <select
              id="help-article"
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Write a new one</option>
              {articles.map((article) => (
                <option key={article.slug} value={article.slug}>
                  {article.title}
                  {article.status === "draft" ? " (draft)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              A draft is not routable, not searchable and not readable by anybody without the admin
              role — the policy on the table refuses it, not this screen.
            </p>
          </>
        )}
      </GlassPanel>

      <ArticleEditor
        key={selected}
        article={current}
        busy={busy}
        onSave={(input, success) => run(() => saveSupportArticle(input), success)}
      />
    </AppShell>
  );
}

function ArticleEditor({
  article,
  busy,
  onSave,
}: {
  article: SupportArticle | null;
  busy: boolean;
  onSave: (
    input: {
      slug: string;
      title: string;
      summary: string;
      category: SupportCategoryId;
      body: readonly string[];
      keywords: readonly string[];
      status: "draft" | "published";
      note?: string;
    },
    success: string,
  ) => Promise<boolean>;
}) {
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [title, setTitle] = useState(article?.title ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [category, setCategory] = useState<SupportCategoryId>(
    article?.category ?? "getting-started",
  );
  const [body, setBody] = useState(article ? textFrom(article.body) : "");
  const [keywords, setKeywords] = useState(article ? article.keywords.join(", ") : "");
  const [note, setNote] = useState("");

  useEffect(() => {
    setSlug(article?.slug ?? "");
    setTitle(article?.title ?? "");
    setSummary(article?.summary ?? "");
    setCategory(article?.category ?? "getting-started");
    setBody(article ? textFrom(article.body) : "");
    setKeywords(article ? article.keywords.join(", ") : "");
    setNote("");
  }, [article]);

  const paragraphs = paragraphsFrom(body);
  const slugIssue = article ? null : slugProblem(slug.trim());
  const ready =
    title.trim().length > 0 && summary.trim().length > 0 && paragraphs.length > 0 && !slugIssue;

  const save = (status: "draft" | "published") =>
    void onSave(
      {
        slug: (article?.slug ?? slug).trim(),
        title: title.trim(),
        summary: summary.trim(),
        category,
        body: paragraphs,
        keywords: keywordsFrom(keywords),
        status,
        note: note.trim(),
      },
      status === "published"
        ? "Published. Anybody can read it now."
        : "Saved as a draft. Nobody outside the admin role can read it.",
    );

  return (
    <GlassPanel className="mt-4 p-5">
      <h2 className="text-base font-semibold">
        {article ? `Editing “${article.title}”` : "A new article"}
      </h2>
      {article ? (
        <p className="mt-1 text-sm text-muted-foreground">
          The handle stays <code className="rounded bg-muted px-1 py-0.5">{article.slug}</code>. A
          help URL ends up in a support reply and somebody&rsquo;s runbook, so it is never renamed
          from here.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        {article ? null : (
          <div>
            <Label htmlFor="help-slug">Handle</Label>
            <Input
              id="help-slug"
              className="mt-1.5"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              aria-describedby={slugIssue ? "help-slug-problem" : undefined}
              aria-invalid={slugIssue ? true : undefined}
            />
            {slugIssue ? (
              <p id="help-slug-problem" className="mt-1.5 text-xs text-destructive">
                {slugIssue}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                This becomes /support/{slug || "your-handle"} and never changes afterwards.
              </p>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="help-title">Title</Label>
          <Input
            id="help-title"
            className="mt-1.5"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
          />
        </div>

        <div>
          <Label htmlFor="help-summary">Summary</Label>
          <Input
            id="help-summary"
            className="mt-1.5"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={500}
          />
        </div>

        <div>
          <Label htmlFor="help-category">Category</Label>
          <select
            id="help-category"
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value as SupportCategoryId)}
          >
            {SUPPORT_CATEGORIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="help-body">Answer</Label>
          <textarea
            id="help-body"
            className="mt-1.5 min-h-48 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Plain text. A blank line starts a new paragraph — {paragraphs.length} so far. There is
            no markup, so there is nothing to sanitise and nothing to inject.
          </p>
        </div>

        <div>
          <Label htmlFor="help-keywords">Keywords</Label>
          <Input
            id="help-keywords"
            className="mt-1.5"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Comma separated. These are what search matches on besides the title and the answer.
          </p>
        </div>

        <div>
          <Label htmlFor="help-note">Why this version</Label>
          <Input
            id="help-note"
            className="mt-1.5"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Kept in the editorial history for the next editor. Readers never see it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={busy || !ready} onClick={() => save("published")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Publish
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !ready}
            onClick={() => save("draft")}
          >
            Save as draft
          </Button>
          {article?.status === "draft" ? (
            <span className="text-xs text-muted-foreground">
              This article is currently a draft, so nobody outside the admin role can read it.
            </span>
          ) : null}
        </div>
      </div>
    </GlassPanel>
  );
}

/** The same two doors the organization and status screens offer. */
function ConfirmIdentity({
  reason,
  message,
  email,
  onProved,
  onDismiss,
}: {
  reason: AssuranceRefusal;
  message: string;
  email: string | null;
  onProved: () => Promise<void>;
  onDismiss: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <GlassPanel className="mt-4 p-4" role="alert">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>{message}</span>
      </p>
      {reason === "factor_required" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Confirm the code from your authenticator app — sign in again, or open Settings › Security
          — then come back to this.
        </p>
      ) : (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setProblem(null);
            const outcome = await proveIdentityWithPassword(email, password);
            if (!outcome.proved) {
              setBusy(false);
              setProblem(
                outcome.reason === "no_email"
                  ? "OCADE cannot confirm this account's email address. Sign in again to continue."
                  : "That password did not match.",
              );
              return;
            }
            setPassword("");
            await onProved();
            setBusy(false);
          }}
        >
          <div className="min-w-0 flex-1">
            <Label htmlFor="help-reauth-password">Your password</Label>
            <Input
              id="help-reauth-password"
              type="password"
              autoComplete="current-password"
              className="mt-1.5"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={busy || password.length === 0}>
              {busy ? "Confirming…" : "Confirm and continue"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {problem ? <p className="mt-2 text-xs text-destructive">{problem}</p> : null}
    </GlassPanel>
  );
}
