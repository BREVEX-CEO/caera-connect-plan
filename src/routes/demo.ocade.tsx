import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Settings2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChatShell } from "@/components/ocade/chat/ChatShell";
import { ChatSidebar } from "@/components/ocade/chat/ChatSidebar";
import { MessageList } from "@/components/ocade/chat/MessageList";
import { type AnswerReceipt } from "@/lib/provenance/receipt";
import { prepareSend, runGuarded, defaultGuards, recordTurn } from "@/lib/edge/session";
import { estimateTokens } from "@/lib/edge/context-budget";
import { append as appendLedger, type LedgerEntry } from "@/lib/edge/ledger";
import { emptyTree, type Tree } from "@/lib/edge/checkpoints";
import { total as totalCost, describeTotals, type RunCost } from "@/lib/edge/meter";
import { compareRuns, type PinnedRun, type RepeatVerdict } from "@/lib/edge/reproducible";
import { Seal } from "@/lib/edge/sealed-mode";
import { installConversationSeal } from "@/lib/edge/seal-policy";
import { AnswerDiff } from "@/components/ocade/chat/AnswerDiff";
import { ChatComposer } from "@/components/ocade/chat/ChatComposer";
import { useChatPrefs } from "@/lib/use-chat-prefs";
import { ChatEmptyState } from "@/components/ocade/chat/ChatEmptyState";
import { EngineBadge } from "@/components/ocade/chat/EngineBadge";
import { DemoSessionBadge } from "@/components/ocade/demo/DemoSessionBadge";
import { DemoSidebarNav } from "@/components/ocade/demo/DemoSidebarNav";
import { useDemoSession } from "@/lib/demo/use-demo-session";
import { warningMessage } from "@/lib/demo/session";
import { useLocalChatEngine } from "@/lib/chat/use-local-chat-engine";
import { useDictation } from "@/lib/voice/use-dictation";
import { LANGUAGE_CANDIDATES, languageInstruction } from "@/lib/voice/speech-capabilities";
import { OCADE_IDENTITY } from "@/lib/ocade-identity";
import type {
  ChatConversationView,
  ChatMessageView,
  EngineStatusView,
} from "@/components/ocade/chat/chat-types";
import type { BrainMessage } from "@/lib/brain/adapter";

export const Route = createFileRoute("/demo/ocade")({
  head: () => ({
    meta: [{ title: "OCADE demo — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: DemoOcade,
});

/**
 * The public OCADE demo — running the real engine, with no account.
 *
 * This used to answer from a hard-coded string and say so on every surface:
 * "no model is running and replies are canned". Honest, and a demo of nothing.
 * A visitor learned what the interface looked like and nothing about whether
 * the product worked.
 *
 * The browser engines never needed an account. `BrowserWebGpuAdapter` and
 * `BrowserWasmAdapter` load weights into the visitor's own tab and stream from
 * there; the demo simply never called them. It does now, through the same
 * `useLocalChatEngine` the signed-in product uses, so what a visitor tries here
 * IS the product.
 *
 * WHAT IS STILL DIFFERENT, and still said out loud:
 *
 *   - The session lasts 8 minutes and the clock is visible.
 *   - Nothing is saved. The conversation lives in this component's state and
 *     goes when the session ends.
 *   - The first answer may be slow: weights download once, and that needs a
 *     connection. The empty state says so rather than looking frozen.
 *
 * And the rule that has not changed: if no engine can run on this device, the
 * demo says exactly that and offers the remedies. It never pretends.
 */

const SYSTEM_PROMPT: BrainMessage = {
  role: "system",
  content:
    `You are ${OCADE_IDENTITY.displayName}, a private AI assistant running entirely on the user's own device. ` +
    `Never name the underlying model, provider or vendor; refer to yourself only as OCADE. ` +
    `Be concise, accurate, and honest about what you do not know. ` +
    `This is a short demo session, so favour clear, complete answers over long ones.`,
};

/** One conversation, because the demo genuinely has one. */
const DEMO_CONVERSATION: ChatConversationView[] = [
  { id: "demo", title: "Demo conversation", updatedAt: new Date().toISOString() },
];

interface DemoTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  engineLabel?: string;
  /** Present on answers: what was measured while it was produced. */
  receipt?: AnswerReceipt;
  /** Set when context had to be dropped to fit the engine. */
  truncation?: string | null;
  /** The pinned conditions of this run, so it can be repeated exactly. */
  pinned?: PinnedRun;
  /** A later re-run of the same question, kept BESIDE the original. */
  rerun?: { answer: string; verdict: RepeatVerdict; receipt: AnswerReceipt };
}

function DemoOcade() {
  const navigate = useNavigate();
  // Chat reasons before it answers unless the user turned that off in
  // Settings › Chat. See `thinkingFor` in local/fixed-model.ts for why Control
  // + Work does not get the same choice.
  const { prefs: chatPrefs } = useChatPrefs();
  const engine = useLocalChatEngine({ surface: "chat", thinking: chatPrefs.thinking });
  const [turns, setTurns] = useState<DemoTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef("");
  const [streamText, setStreamText] = useState("");

  /**
   * Sealed mode, and the guards that go with it.
   *
   * Off by default: the demo has to download an engine on first use, and a
   * seal would block that download and look like a broken product. Once the
   * engine is on the device, sealing costs nothing.
   */
  const [sealed, setSealed] = useState(false);
  const guards = useMemo(
    () => ({ ...defaultGuards(), sealed, contextLimitTokens: 4096 }),
    [sealed],
  );

  /**
   * THE SEAL IS UP FOR AS LONG AS THE BUTTON SAYS IT IS.
   *
   * It used to be installed only inside `runGuarded`, around the `generate()`
   * call — so the barrier existed for the milliseconds an answer was being
   * produced, while this screen said "Sealed" and promised "Nothing can leave
   * this device until you unseal it". Checked in the browser, `fetch`,
   * `XMLHttpRequest`, `WebSocket` and `navigator.sendBeacon` were all still the
   * native ones, and a cross-origin `sendBeacon` returned `true`. The mechanism
   * was complete; nothing had connected it to the sentence.
   *
   * `allowAssetsAndLoopback` is what makes a conversation-long seal survivable:
   * route chunks and the on-device engine on `localhost` still work, and
   * everything capable of carrying the conversation off the machine does not.
   * `runGuarded` still installs its own stricter seal for the send itself, and
   * overlapping seals intersect, so that window stays as tight as it ever was.
   */
  // The returned cleanup covers unsealing AND unmount: a seal left installed by
  // a screen that no longer exists would be unreachable and unexplainable.
  useEffect(
    () =>
      installConversationSeal(
        sealed,
        (allow) => new Seal(undefined, allow),
        typeof window === "undefined" ? undefined : window.location.origin,
      ),
    [sealed],
  );

  /** The hash chain, in a ref because it is appended to inside a callback. */
  const ledgerRef = useRef<LedgerEntry[]>([]);
  /** Branching history: what else was tried, kept alongside the hash chain. */
  const treeRef = useRef<Tree>(emptyTree());
  const [costs, setCosts] = useState<RunCost[]>([]);
  /**
   * Bumped whenever the chain or tree changes.
   *
   * Both live in refs, which do not trigger a render. Without this the
   * integrity panel would show a verdict for a conversation two turns behind —
   * a stale "intact" being exactly the wrong thing to be confidently wrong
   * about.
   */
  const [ledgerVersion, setLedgerVersion] = useState(0);

  /**
   * The plaintext behind the chain, so the digests can be checked against the
   * real messages rather than only against each other.
   *
   * Without this the panel would verify that the chain is internally
   * consistent while saying nothing about whether it still describes the
   * conversation on screen — a narrower claim than it appears to make.
   */
  const ledgerMessages = useMemo(() => turns.map((t) => t.content), [turns]);

  /*
   * The language OCADE answers in.
   *
   * Taken from the browser rather than from a picker nobody wanted to open. A
   * visitor whose device is set to Hindi should be answered in Hindi without
   * finding a setting first, and a visitor on English should never be shown a
   * language control they have no use for.
   */
  const language = useMemo(() => {
    const fallback = LANGUAGE_CANDIDATES[0];
    if (typeof navigator === "undefined") return fallback;
    const primary = (navigator.language ?? "en").toLowerCase().split(/[-_]/)[0];
    return LANGUAGE_CANDIDATES.find((c) => c.code === primary) ?? fallback;
  }, []);

  const dictation = useDictation({
    lang: language.preferredTag,
    // Fills the composer; the person still presses send. `use-dictation`
    // explains why auto-send would be the wrong default.
    onTranscript: (text) => setDraft(text),
  });

  /**
   * Clear the conversation, INCLUDING its record.
   *
   * The chain, the tree and the cost tally all describe the turns being
   * discarded. Leaving any of them behind would leave the integrity panel
   * verifying a conversation that is no longer on screen and reporting it
   * intact — a confident claim about something that no longer exists, which is
   * worse than no claim at all.
   */
  const resetConversation = useCallback(() => {
    engine.stop();
    setStreaming(false);
    setStreamText("");
    streamRef.current = "";
    setTurns([]);
    setDraft("");
    ledgerRef.current = [];
    treeRef.current = emptyTree();
    setCosts([]);
    setLedgerVersion((v) => v + 1);
  }, [engine]);

  /*
   * End of session. Order matters: abort first, because clearing the turns
   * while a stream is still writing would leave tokens arriving into state the
   * component has already navigated away from.
   */
  const handleExpire = useCallback(() => {
    engine.stop();
    setStreaming(false);
    setStreamText("");
    streamRef.current = "";
    setTurns([]);
    // "Nothing was saved" has to be true of the record as well as the messages.
    ledgerRef.current = [];
    treeRef.current = emptyTree();
    setCosts([]);
    setLedgerVersion((v) => v + 1);
    toast.info("Your 8-minute demo has ended. Nothing was saved.", {
      description: "Create an account to keep your conversations and use OCADE without a timer.",
      duration: 8000,
    });
    void navigate({ to: "/", replace: true });
  }, [engine, navigate]);

  const { session } = useDemoSession({
    autoStart: true,
    onWarn: (state) => {
      toast.warning(warningMessage(state.remainingMs), { duration: 10_000 });
    },
    onExpire: handleExpire,
  });

  // Probe once on mount so the badge carries a real capability label before the
  // first send, rather than a placeholder that changes under the visitor.
  const check = engine.check;
  useEffect(() => {
    void check();
  }, [check]);

  const engineStatus: EngineStatusView = useMemo(() => {
    if (engine.state.status === "unavailable") {
      return {
        locality: "unknown",
        label: "No on-device engine",
        online: true,
        detail: engine.state.reason ?? "OCADE cannot run on this device.",
      };
    }
    if (engine.state.status === "checking" || engine.state.status === "idle") {
      return {
        locality: "unknown",
        label: "Checking this device…",
        online: true,
        detail: "OCADE is working out which engine this browser can run.",
      };
    }
    return {
      locality: "local",
      label: engine.state.label ?? "OCADE Local",
      online: true,
      detail: "Running in this browser. Nothing you type leaves your device.",
    };
  }, [engine.state]);

  const messages: ChatMessageView[] = useMemo(() => {
    const rendered: ChatMessageView[] = turns.map((t) => ({
      id: t.id,
      role: t.role,
      content: t.content,
      createdAt: t.createdAt,
      engineLabel: t.engineLabel,
    }));
    if (streaming) {
      rendered.push({
        id: "streaming",
        role: "assistant",
        content: streamText,
        createdAt: new Date().toISOString(),
        engineLabel: engine.state.label ?? undefined,
      });
    }
    return rendered;
  }, [turns, streaming, streamText, engine.state.label]);

  /**
   * Ask the same question again and compare.
   *
   * The comparison is only meaningful because both runs name the same engine
   * file. A cloud assistant cannot offer this: its weights change without
   * notice, so a re-run compares two unknowns and any difference is
   * uninterpretable.
   */
  const rerun = useCallback(
    async (answerId: string) => {
      if (streaming) return;
      const index = turns.findIndex((t) => t.id === answerId);
      const original = turns[index];
      const question = turns[index - 1];
      if (!original || question?.role !== "user") return;

      const history: BrainMessage[] = [
        SYSTEM_PROMPT,
        ...turns
          .slice(0, index - 1)
          .map((t) => ({ role: t.role, content: t.content }) as BrainMessage),
        { role: "user", content: question.content },
      ];

      setStreaming(true);
      streamRef.current = "";
      setStreamText("");

      const outcome = await runGuarded({
        prompt: question.content,
        chain: ledgerRef.current,
        guards,
        engineLabel: engine.state.label ?? "OCADE Local",
        modelKey: engine.state.label ?? "local",
        modelSha256: "",
        temperature: 0.2,
        topP: 0.9,
        backend: "browser",
        messageId: `${answerId}-rerun`,
        generate: async () => {
          await engine.send({
            messages: history,
            onToken: (chunk) => {
              streamRef.current += chunk;
              setStreamText(streamRef.current);
            },
          });
          return streamRef.current;
        },
      });

      setStreaming(false);
      setStreamText("");
      streamRef.current = "";
      if (!outcome.answer.trim()) return;

      /*
       * The original stays. Replacing it would destroy the very thing being
       * compared — and "run it again" must never be a way to lose the answer
       * you already had.
       */
      const verdict = original.pinned
        ? compareRuns(original.pinned, outcome.pinned)
        : compareRuns(outcome.pinned, outcome.pinned);

      setTurns((prev) =>
        prev.map((t) =>
          t.id === answerId
            ? { ...t, rerun: { answer: outcome.answer, verdict, receipt: outcome.receipt } }
            : t,
        ),
      );
    },
    [turns, streaming, engine, guards],
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || streaming) return;

    const userTurn: DemoTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const history: BrainMessage[] = [
      SYSTEM_PROMPT,
      ...turns.map((t) => ({ role: t.role, content: t.content }) as BrainMessage),
      { role: "user", content: text },
    ];

    /*
     * EVERY GUARANTEE, BEFORE A SINGLE TOKEN.
     *
     * `prepareSend` scans the outgoing text for credentials, budgets the
     * context and reports what will not fit — all of it decided before the
     * message can move. The order is load-bearing and lives in `edge/session`
     * rather than here, so every surface that sends gets the same one.
     */
    const prepared = prepareSend({
      text,
      items: [
        {
          id: "system",
          label: "OCADE instructions",
          kind: "system",
          tokens: 120,
          priority: 100,
          pinned: true,
        },
        ...turns.map((t) => ({
          id: t.id,
          label: t.role === "user" ? "your message" : "an earlier answer",
          kind: "turn" as const,
          tokens: estimateTokens(t.content),
          priority: 5,
        })),
        {
          id: "question",
          label: "your question",
          kind: "turn",
          tokens: estimateTokens(text),
          priority: 100,
          pinned: true,
        },
      ],
      guards,
    });

    if (!prepared.proceed) {
      // Refused before anything moved. The reason is the finding itself, so
      // the visitor can act on it rather than guessing.
      toast.error(prepared.blockedReason ?? "This message was not sent.", {
        description: prepared.findings.map((f) => f.explain)[0],
        duration: 9000,
      });
      return;
    }

    /*
     * THE SCREEN MOVES FIRST.
     *
     * These four lines used to sit AFTER the awaited `appendLedger` below —
     * which hashes the message with SHA-256 through WebCrypto before returning.
     * So pressing send did nothing visible until a cryptographic digest had
     * been computed: the message stayed in the box, the composer stayed idle,
     * and the interface looked frozen for the one moment a person is watching
     * it most closely. The delay was not the model; it was bookkeeping standing
     * in front of the model.
     *
     * Nothing here depends on the digest, so nothing here waits for it.
     */
    setTurns((prev) => [...prev, userTurn]);
    setDraft("");
    setStreaming(true);
    streamRef.current = "";
    setStreamText("");

    /*
     * The question goes into the tree AND the chain before the answer does.
     * Recording only answers would leave the branch points unlabelled — a fork
     * is identified by the question it followed, and "after node a-1735…" is
     * not something anyone can navigate by.
     */
    treeRef.current = recordTurn(treeRef.current, {
      id: userTurn.id,
      role: "user",
      content: text,
      at: new Date(),
    }).tree;
    ledgerRef.current = [
      ...ledgerRef.current,
      await appendLedger(ledgerRef.current, { role: "user", content: text, at: new Date() }),
    ];
    setLedgerVersion((v) => v + 1);

    const answerId = `a-${Date.now()}`;
    const outcome = await runGuarded({
      prompt: text,
      chain: ledgerRef.current,
      guards,
      engineLabel: engine.state.label ?? "OCADE Local",
      modelKey: engine.state.label ?? "local",
      modelSha256: "",
      temperature: 0.2,
      topP: 0.9,
      backend: "browser",
      messageId: answerId,
      /*
       * The seal and the witness wrap THIS call. Passing the real streaming
       * generation in, rather than sealing around a wrapper, is what makes the
       * measurement describe the work that actually happened.
       */
      generate: async () => {
        await engine.send({
          messages: history,
          onToken: (chunk) => {
            streamRef.current += chunk;
            setStreamText(streamRef.current);
          },
        });
        return streamRef.current;
      },
    });

    const produced = outcome.answer;
    setStreaming(false);
    setStreamText("");
    streamRef.current = "";

    if (produced.trim()) {
      // A cancelled generation keeps whatever it produced: the visitor asked it
      // to stop, not to throw the answer away.
      ledgerRef.current = [...ledgerRef.current, outcome.entry];
      treeRef.current = recordTurn(treeRef.current, {
        id: answerId,
        role: "assistant",
        content: produced,
        at: new Date(),
      }).tree;
      // Refs do not trigger a render, so the integrity panel is told explicitly
      // that there is something new to verify.
      setLedgerVersion((v) => v + 1);
      setCosts((prev) => [...prev, outcome.cost]);

      setTurns((prev) => [
        ...prev,
        {
          id: answerId,
          role: "assistant",
          content: produced,
          createdAt: new Date().toISOString(),
          engineLabel: engine.state.label ?? undefined,
          receipt: outcome.receipt,
          truncation: prepared.truncation,
          // Kept so this exact run can be repeated and compared later.
          pinned: outcome.pinned,
        },
      ]);
      return;
    }

    /*
     * Nothing was produced. `engine.send` reports its own reason through the
     * hook's state — a cancelled generation is not an error and must not be
     * shown as one, which is why this checks the state rather than assuming.
     */
    if (engine.state.status === "unavailable" && engine.state.reason) {
      toast.error(engine.state.reason);
    }
  }, [draft, streaming, turns, engine, guards]);

  const unavailable = engine.state.status === "unavailable";

  return (
    <ChatShell
      sidebar={
        <ChatSidebar
          conversations={DEMO_CONVERSATION}
          activeId="demo"
          onNewChat={() => {
            engine.stop();
            setStreaming(false);
            setTurns([]);
            setDraft("");
          }}
          emptyLabel="This conversation is temporary."
          footer={<DemoSidebarNav active="chat" />}
        />
      }
      header={
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-medium text-foreground">
            Demo conversation
          </span>
          {/*
            Sealed mode, as a control rather than a promise. While it is on, the
            page's network primitives really are replaced — for the whole time
            the button reads "Sealed", not just while an answer is streaming —
            and anything that tries to reach out is refused and recorded. The
            barrier is installed by the effect above; see lib/edge/sealed-mode
            and lib/edge/seal-policy.
          */}
          <button
            type="button"
            onClick={() => {
              setSealed((v) => !v);
              toast.info(
                sealed
                  ? "Conversation unsealed. OCADE can reach the network again."
                  : "Conversation sealed. Nothing can leave this device until you unseal it.",
              );
            }}
            aria-pressed={sealed}
            className={cn(
              "ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] transition",
              sealed
                ? "border-[color:var(--state-success)]/50 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]"
                : "border-border/60 text-muted-foreground hover:bg-accent",
            )}
          >
            {sealed ? (
              <Lock className="h-3 w-3" aria-hidden />
            ) : (
              <Unlock className="h-3 w-3" aria-hidden />
            )}
            {sealed ? "Sealed" : "Seal"}
          </button>
          <DemoSessionBadge session={session} className="shrink-0" />
          <EngineBadge status={engineStatus} className="shrink-0" />
        </div>
      }
      banner={
        unavailable ? (
          <div className="rounded-xl border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/5 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
            <span className="font-medium text-foreground">OCADE cannot run on this device.</span>{" "}
            {engine.state.reason}
            {engine.state.remedies.length > 0 ? (
              <span className="ml-1">
                {engine.state.remedies.map((r) => engine.remedyLabel(r)).join(" · ")}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-secondary/25 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
            <span className="font-medium text-foreground">This is the real OCADE.</span> It runs in
            this browser, on your device. The conversation is temporary and is not saved.{" "}
            <Link to="/auth" className="text-primary underline underline-offset-4">
              Create an account
            </Link>{" "}
            to keep your work.
          </div>
        )
      }
      composer={
        <>
          {/*
            What this conversation has actually cost.

            The number a user can check against their own electricity bill,
            alongside the allowance a cloud-only assistant would have spent for
            the same work. Hidden until there is something real to report.
          */}
          {costs.length > 0 ? (
            <p className="mb-1.5 px-1 text-[11px] leading-relaxed text-muted-foreground">
              {describeTotals(totalCost(costs), 28)}
            </p>
          ) : null}
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSubmit={() => void send()}
            onStop={streaming ? engine.stop : undefined}
            onNewChat={resetConversation}
            /*
              The demo has no account, so the three upload actions answer with a
              sign-in prompt instead of appearing as dead greyed items. Typing
              and sending stay completely open for the full 8 minutes.
            */
            signedIn={false}
            /*
             * Attachments need an account, so the demo passes `onAddFiles` only
             * to make the + menu appear with the file actions correctly disabled
             * and explained. A menu that hid them would leave a visitor guessing
             * whether OCADE can read documents at all.
             */
            onAddFiles={() => {
              toast.info("Attachments need an account.", {
                description: "Create one to read documents privately on your own device.",
              });
            }}
            dictation={{
              state: dictation.state,
              supported: dictation.supported,
              error: dictation.error,
              toggle: dictation.toggle,
              languageLabel: language.nativeLabel,
            }}
            streaming={streaming}
            disabled={unavailable}
            engine={engineStatus}
            placeholder={unavailable ? "OCADE cannot run on this device." : "Ask OCADE anything…"}
            imageDisabledReason="Attachments are available once you create an account."
          />
        </>
      }
    >
      <MessageList
        messages={messages}
        /*
         * The receipt for each answer, under it. Attached from `turns` rather
         * than carried on `ChatMessageView`, so the shared transcript type
         * stays free of anything the signed-in product does not also need.
         */
        renderFooter={(message) => {
          const turn = turns.find((t) => t.id === message.id);
          if (!turn?.receipt) return null;
          return (
            <div className="pl-1">
              {/*
                Truncation first, and only when it happened. It changes how the
                answer above should be read, so it belongs closer to the answer
                than the provenance panel does.
              */}
              {turn.truncation ? (
                <p className="mb-1 rounded-md border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/5 px-2 py-1 text-[11.5px] text-foreground">
                  {turn.truncation}
                </p>
              ) : null}
              {/* The per-answer receipt is gone from the demo — see the note in
                  the sidebar footer above. */}
              {/*
                The re-run, shown beside the original rather than replacing it.
                Replacing would destroy the thing being compared — and "run it
                again" must never be a way to lose the answer you already had.
              */}
              {turn.rerun ? (
                <AnswerDiff
                  before={turn.content}
                  after={turn.rerun.answer}
                  verdict={turn.rerun.verdict}
                  className="mt-1.5"
                />
              ) : null}
            </div>
          );
        }}
        actions={{
          onCopy: () => {
            /* MessageBubble owns the clipboard write and its own feedback. */
          },
          /*
           * Ask the same question again, under the same pin, and show what
           * changed. Offered only on the newest answer: re-running from the
           * middle of a thread would compare against a conversation state that
           * no longer exists, and the diff would be meaningless.
           */
          onRegenerate: (m) =>
            m.id === turns.at(-1)?.id && m.role === "assistant" ? void rerun(m.id) : undefined,
        }}
        emptyState={
          <ChatEmptyState
            greeting="OCADE, running on your device."
            privacyLine={
              unavailable
                ? "This browser cannot run an on-device engine, so OCADE has nothing to answer with here."
                : "Nothing you type leaves this computer. The first answer may take a moment while OCADE prepares — that happens once."
            }
            onPick={setDraft}
          />
        }
      />
    </ChatShell>
  );
}
