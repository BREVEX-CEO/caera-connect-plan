import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { readSharedConversation, type SharedConversation } from "@/lib/chat/conversation-sharing";

/**
 * A SHARED CONVERSATION, READ BY SOMEBODY WITH NO ACCOUNT — PLAN.md §8.
 *
 * `noindex`, and that is not a detail. A share link is UNLISTED: its security is
 * that nobody can guess the token. Letting a crawler index the page would turn
 * "anyone with the link" into "anyone who searches", which is a different
 * promise from the one the person made when they shared it — and one they would
 * find out about from a search result. `/share` is also disallowed in
 * `robots.txt`, because a well-behaved crawler reads that before it reads a
 * meta tag it has to fetch the page to see.
 *
 * `ssr: false`. Rendering the transcript on the server would put a person's
 * conversation into the HTML of a response, where a proxy, a log or a cache
 * could hold it. The snapshot is fetched by the browser that was given the
 * link, and nowhere else.
 *
 * READ-ONLY, AND VISIBLY SO. There is no composer, no reply, no reaction and no
 * "continue this conversation": a reader is looking at a copy of something that
 * happened, and a control that implied otherwise would be inventing a
 * relationship between them and somebody else's account.
 */
export const Route = createFileRoute("/share/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shared conversation — OCADE" },
      /*
       * `noarchive` and `nosnippet` alongside `noindex`: a crawler that
       * respects only some of them must not be able to keep a cached copy or
       * quote the transcript in a result.
       */
      { name: "robots", content: "noindex, nofollow, noarchive, nosnippet" },
    ],
  }),
  component: SharedConversationPage,
});

function SharedConversationPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<
    { status: "loading" } | { status: "gone" } | { status: "ready"; shared: SharedConversation }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void readSharedConversation(token)
      .then((shared) => {
        if (cancelled) return;
        setState(shared ? { status: "ready", shared } : { status: "gone" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "gone" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Opening the shared conversation…
        </p>
      </main>
    );
  }

  if (state.status === "gone") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            This link does not open anything
          </h1>
          {/*
            ONE SENTENCE FOR ALL THREE CASES, because the database answers all
            three identically. Saying "this was revoked" would confirm the link
            had once been real, which the holder of a dead link is not owed —
            and would tell somebody trying tokens at random when they had
            guessed a real one.
          */}
          <p className="text-sm text-muted-foreground">
            It may have been unshared, it may have expired, or it may never have been a share link.
          </p>
          <Link to="/" className="inline-block text-sm underline">
            Go to OCADE
          </Link>
        </div>
      </main>
    );
  }

  const { shared } = state;
  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Shared conversation
          </p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{shared.title}</h1>
          {/*
            WHEN THE COPY WAS TAKEN, said plainly. A reader who assumes they are
            watching a live conversation will read a stale answer as the current
            one, and there is no way for them to tell from the transcript.
          */}
          <p className="mt-2 text-[12px] text-muted-foreground">
            A copy of {shared.messageCount === 1 ? "1 message" : `${shared.messageCount} messages`},
            taken on <SnapshotTime iso={shared.snapshotAt} />. It does not update.
          </p>
        </div>
      </header>

      <ol className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {shared.messages.map((message, index) => (
          <li key={index} className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              {message.role === "user" ? "Asked" : "OCADE"}
            </p>
            <div
              className={
                message.role === "user"
                  ? "rounded-2xl bg-secondary/70 px-3.5 py-2 text-[14px] whitespace-pre-wrap text-foreground"
                  : "text-[14px] leading-relaxed whitespace-pre-wrap text-foreground"
              }
            >
              {message.content}
            </div>
            {message.attachment_count > 0 ? (
              /*
                The count, not the names. "Share this conversation" is not
                consent to publish the documents read during it, and a file name
                alone can disclose more than the conversation does.
              */
              <p className="text-[11px] text-muted-foreground">
                {message.attachment_count === 1
                  ? "1 attachment, not included in this share"
                  : `${message.attachment_count} attachments, not included in this share`}
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-6 text-[12px] text-muted-foreground sm:px-6">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          <span>
            Shared from OCADE by CARCC CADANE.{" "}
            <Link to="/" className="underline">
              See what OCADE is
            </Link>
            .
          </span>
        </div>
      </footer>
    </main>
  );
}

/**
 * The snapshot time in the READER's locale and timezone.
 *
 * Rendered client-side only, which `ssr: false` already guarantees here: a
 * server-rendered local time is the server's idea of local, and it changes
 * under hydration.
 */
function SnapshotTime({ iso }: { iso: string }) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return <span>an unknown date</span>;
  return <time dateTime={iso}>{new Date(ms).toLocaleString()}</time>;
}
