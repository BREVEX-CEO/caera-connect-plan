import { HIGH_WARNING_VERSION, type IntelligenceQuality } from "@/lib/intelligence/quality";
/**
 * EVERYTHING CHAT DOES, IN ONE HOOK.
 *
 * The screen renders; this decides. Conversations, the transcript, sending,
 * streaming, persistence, rename, archive, delete and delete-all all
 * live here, so the component cannot grow a second copy of any of them — which
 * is exactly how the 4,519-line screen this replaces came to have three
 * different ideas of what "the current conversation" was.
 *
 * THE ORDER OF A SEND IS THE PRODUCT'S CORRECTNESS, and it is this:
 *
 *   1. a permit, from the account's allowance. No permit, no generation, and
 *      the person has already been told when their allowance returns.
 *   2. the conversation, created on the first turn so a failed send does not
 *      leave an empty one behind.
 *   3. the question, persisted before the answer is asked for. A tab closed
 *      mid-answer must not lose what the person typed.
 *   4. the answer, streamed and then persisted.
 *   5. delivery recorded, then the permit settled. A request that produced
 *      nothing releases rather than charges.
 *
 * ONE REQUEST IS ONE USE. The permit is taken once per send, whatever the
 * routing does inside it — `docs/DECISIONS.md` #23.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createConversation,
  deleteAllConversations,
  deleteMessage,
  deleteMessagesFrom,
  listConversations,
  deleteConversation,
  updateConversation,
  type OcadeConversationRow,
} from "@/lib/ocade.functions";
import {
  describeStorageError,
  flushUnsyncedTurns,
  isUnreachable,
  loadChatMessages,
  persistChatMessage,
  type ChatMessageRecord,
} from "@/lib/ocade-chat-store";
import { beginBilledRequest } from "@/lib/commercial/use-generation-permit";
import { citationInstruction } from "@/lib/chat/attachments";
import { forgetUnsyncedTurn } from "@/lib/chat/unsynced-turns";
import type { NormalizedAttachment, NormalizedMessage } from "@/lib/intelligence/contract";
import { USAGE_QUERY_KEY } from "@/lib/commercial/use-commercial-usage";
import { ocadeIntelligence } from "@/lib/intelligence/ocade-intelligence";
import type { IntelligenceMode } from "@/lib/intelligence/contract";
import { useSession } from "@/lib/session";
import { saveFile } from "@/lib/utils";

/** How many questions keep their attachment bytes in this tab. */
const CARRIED_QUESTIONS = 5;

/** The three words a customer sees, and the mode each one means. */
export type IntelligenceChoice = "auto" | "online" | "offline";

const MODE_FOR: Record<IntelligenceChoice, IntelligenceMode> = {
  auto: "automatic",
  online: "online",
  offline: "local_only",
};

/** A title from the first thing somebody said, rather than "New chat" forever. */
function titleFrom(message: string): string {
  const line = message.trim().split("\n")[0] ?? "";
  const trimmed = line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
  return trimmed || "New chat";
}

/**
 * A turn that exists only in this tab.
 *
 * Shaped exactly like a stored one so the transcript, Copy, Edit, Regenerate
 * and Delete all work on it without learning about a second kind of message.
 * `unsynced` is deliberately absent: that flag means "should have been saved
 * and was not", and a temporary turn was never going to be saved.
 */
function temporaryRecord(
  role: "user" | "assistant",
  content: string,
  attachments: NormalizedAttachment[],
): ChatMessageRecord {
  return {
    id: crypto.randomUUID(),
    conversation_id: "temporary",
    role,
    content,
    attachments: attachments.map((attachment) => ({
      kind: attachment.image ? ("image" as const) : ("file" as const),
      name: attachment.name,
      mime: attachment.mime,
      sizeBytes: attachment.sizeBytes,
    })),
    model_id: null,
    created_at: new Date().toISOString(),
  };
}

export interface ChatState {
  conversations: OcadeConversationRow[];
  conversationId: string | null;
  messages: ChatMessageRecord[];
  /** The answer as it arrives. Empty when nothing is streaming. */
  streaming: string;
  busy: boolean;
  /** One line, already in OCADE's words. Never a provider's. */
  problem: string | null;
  /** The problem is Standard being busy or unavailable: High may be offered, never chosen for them. */
  standardBusy: boolean;
  loadingConversations: boolean;
  /** The history read failed. Not the same as an account with no history. */
  conversationsFailed: boolean;
  loadingMessages: boolean;
  /** The transcript read failed. Not the same as a conversation with no turns. */
  messagesFailed: boolean;
  /** This conversation is being kept nowhere. Nothing about it is written. */
  temporary: boolean;
}

export interface ChatActions {
  /**
   * Whether the request was accepted. `false` means nothing was sent, nothing
   * was written and nothing was charged — so the caller still owns what the
   * person typed and must give it back to them rather than discard it.
   *
   * `prepare` runs after the allowance says yes and before anything is written.
   * Regenerate uses it to drop the turns it is replacing, so a refused request
   * cannot delete somebody's question and leave nothing in its place.
   */
  send(
    message: string,
    choice: IntelligenceChoice,
    attachments?: NormalizedAttachment[],
    thinking?: boolean,
    research?: boolean,
    prepare?: () => Promise<void>,
    quality?: IntelligenceQuality,
  ): Promise<boolean>;
  /** Edit, Regenerate and Retry, which are the same operation. */
  resend(
    userMessageId: string,
    choice: IntelligenceChoice,
    newText?: string,
    quality?: IntelligenceQuality,
  ): Promise<void>;
  removeMessage(id: string): Promise<void>;
  stop(): void;
  openConversation(id: string | null): void;
  newConversation(): void;
  rename(id: string, title: string): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  deleteEverything(): Promise<void>;
  reloadConversations(): Promise<void>;
  reloadMessages(): Promise<void>;
  setTemporary(on: boolean): void;
  /** Save one conversation to a file, whether or not it is the open one. */
  exportConversation(id: string): Promise<void>;
  dismissProblem(): void;
}

export function useChat(): ChatState & ChatActions {
  const { user, loading } = useSession();
  const queryClient = useQueryClient();
  /*
   * The list, read synchronously for the same reason the transcript is: an
   * optimistic change has to know what it is replacing so it can put it back,
   * and the array in a closure is the one from the render it was created in.
   */
  const conversationsRef = useRef<OcadeConversationRow[]>([]);
  const [conversations, publishConversations] = useState<OcadeConversationRow[]>([]);
  const setConversations = useCallback(
    (
      next: OcadeConversationRow[] | ((current: OcadeConversationRow[]) => OcadeConversationRow[]),
    ) => {
      conversationsRef.current = typeof next === "function" ? next(conversationsRef.current) : next;
      publishConversations(conversationsRef.current);
    },
    [],
  );
  const [conversationId, setConversationId] = useState<string | null>(null);
  /*
   * ONE TRANSCRIPT, READ SYNCHRONOUSLY.
   *
   * `send` builds the history it sends from this. Reading it out of a closure
   * meant the array `send` saw was the one from the render it was created in —
   * fine while Send was the only caller, and wrong the moment anything changed
   * the transcript and then sent in the same tick. Regenerate does exactly
   * that: it drops the turns after a question and re-asks it, and a stale
   * closure would send the dropped turns back to the model.
   */
  const transcript = useRef<ChatMessageRecord[]>([]);
  const [messages, publishMessages] = useState<ChatMessageRecord[]>([]);
  const setMessages = useCallback(
    (next: ChatMessageRecord[] | ((current: ChatMessageRecord[]) => ChatMessageRecord[])) => {
      transcript.current = typeof next === "function" ? next(transcript.current) : next;
      publishMessages(transcript.current);
    },
    [],
  );
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busyProblem, setBusyProblem] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [conversationsFailed, setConversationsFailed] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesFailed, setMessagesFailed] = useState(false);
  const [temporary, setTemporary] = useState(false);
  /** Which conversation the in-flight transcript read belongs to. */
  const opened = useRef<string | null>(null);
  /** The conversation `send` just started: there is nothing on the server to read yet. */
  const started = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  /*
   * ONE NUMBER SAYS WHOSE TRANSCRIPT IS ON THE SCREEN.
   *
   * Every asynchronous thing here — a history read, a transcript read, a
   * stream, a persisted answer — finishes after the state it was started for
   * may have stopped existing. Signing out, signing in as somebody else,
   * opening another conversation, starting a new one and turning Temporary on
   * all replace that state, and each of them used to leave the in-flight work
   * running with nothing to compare itself against: account A's answer could
   * arrive into account B's screen.
   *
   * So each of those bumps this counter, and every continuation compares the
   * value it captured before it awaited. Not equal means what it is holding
   * belongs to a screen nobody is looking at, and it is dropped. One mechanism
   * covers the account boundary, the conversation boundary and Temporary,
   * rather than three sets of guards that can disagree.
   */
  const epoch = useRef(0);
  /*
   * Set before the first await of a send, which `busy` cannot be: React state
   * is not visible to the caller that reads it in the same tick, so two Sends
   * pressed together both saw `busy === false` and both took a permit.
   */
  const sending = useRef(false);
  /**
   * The bytes that rode with a question, for as long as this tab is open.
   *
   * Stored messages keep names and sizes only, so Regenerate had no file to
   * resend and asked the question again as though there had never been one.
   */
  const carried = useRef(new Map<string, NormalizedAttachment[]>());
  /**
   * The Thinking and Research choices each question was asked with.
   *
   * Regenerate called `send(..., false, false, ...)`, so asking again silently
   * dropped both: a question asked WITH Thinking was repeated without it, and
   * the person was shown a different kind of answer to the one they asked to
   * have redone. Kept beside the bytes and released on the same schedule, for
   * the same reason — a stored row has no column for either.
   */
  const askedWith = useRef(
    new Map<string, { thinking: boolean; research: boolean; quality: IntelligenceQuality }>(),
  );

  /** Stop everything in flight and stop caring about what it returns. */
  const abandonInFlight = useCallback(() => {
    epoch.current += 1;
    abort.current?.abort();
    abort.current = null;
    sending.current = false;
    opened.current = null;
    setStreaming("");
    setBusy(false);
    /*
     * Nothing is in flight, so nothing is loading. Without this the transcript
     * read abandoned above leaves `loadingMessages` true for ever — the guard
     * that drops its result also skips the `finally` that would have cleared
     * it. It is invisible today only because every caller empties the
     * transcript too, and the list is not rendered when there is nothing in it.
     */
    setLoadingMessages(false);
  }, []);

  /*
   * A NEW ACCOUNT GETS A NEW SCREEN, WITH NOTHING OF THE OLD ONE ON IT.
   *
   * Sign-out cleared the conversation list and left the open transcript, the
   * conversation id and the streaming answer exactly where they were, so
   * signing in as somebody else in the same tab showed the previous person's
   * words — and a read that was already in flight could put them back even
   * after a clear. Every piece of account-owned state goes at once, and the
   * bump inside `abandonInFlight` makes the in-flight reads unable to restore
   * any of it.
   *
   * "SIGNED OUT" AND "NOT KNOWN YET" ARE NOT THE SAME ACCOUNT. The session hook
   * reports `null` while it is still reading the stored token, so treating that
   * first answer as a change wiped the screen of somebody who had just opened a
   * conversation — the reset landed in the middle of their own page load. The
   * first settled answer is recorded rather than acted on; every change after
   * it is a real one.
   */
  const account = user?.id ?? null;
  const lastAccount = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (loading) return;
    const previous = lastAccount.current;
    lastAccount.current = account;
    if (previous === undefined || previous === account) return;
    abandonInFlight();
    carried.current.clear();
    setConversations([]);
    setConversationId(null);
    setMessages([]);
    setProblem(null);
    setTemporary(false);
    setMessagesFailed(false);
    setConversationsFailed(false);
  }, [account, loading, abandonInFlight, setMessages, setConversations]);

  const refreshConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }
    setLoadingConversations(true);
    const at = epoch.current;
    try {
      const rows = (await listConversations()) as unknown as OcadeConversationRow[];
      if (epoch.current !== at) return; // Another account's list, arriving late.
      setConversations(rows ?? []);
      setConversationsFailed(false);
    } catch {
      if (epoch.current !== at) return;
      /*
       * A history that will not load is not a reason to block the composer —
       * and it is not an account with no history either. The empty list was
       * shown both ways, so a failed read was indistinguishable from a new
       * account. The sidebar says which, and offers to try again.
       */
      setConversations([]);
      setConversationsFailed(true);
    } finally {
      setLoadingConversations(false);
    }
  }, [user, setConversations]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  /*
   * A TRANSCRIPT THAT WOULD NOT LOAD IS NOT AN EMPTY CONVERSATION.
   *
   * The failure path emptied the transcript, so a conversation whose messages
   * could not be read looked exactly like one nobody had written in — and the
   * composer sat under it, ready to append to a history OCADE had not seen.
   */
  const openMessages = useCallback(
    async (id: string) => {
      // The conversation this read belongs to. Switching while one is in
      // flight must not let the slower answer overwrite the newer transcript.
      opened.current = id;
      setLoadingMessages(true);
      const at = epoch.current;
      const mine = () => opened.current === id && epoch.current === at;
      try {
        const rows = await loadChatMessages({ conversationId: id });
        if (!mine()) return;
        setMessages(rows);
        setMessagesFailed(false);
      } catch {
        if (!mine()) return;
        setMessages([]);
        setMessagesFailed(true);
      } finally {
        if (mine()) setLoadingMessages(false);
      }
    },
    [setMessages],
  );

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setMessagesFailed(false);
      return;
    }
    /*
     * A CONVERSATION THIS TAB JUST STARTED IS NOT READ BACK.
     *
     * `send` holds its turns. Reading it raced them, and with no network the read failed and
     * replaced an offline answer with "This conversation could not be opened".
     */
    if (conversationId === started.current) {
      // Once: coming back to it later reads it like any other.
      started.current = null;
      opened.current = conversationId;
      setMessagesFailed(false);
      return;
    }
    void openMessages(conversationId);
  }, [conversationId, openMessages, setMessages]);

  /*
   * WHEN THE NETWORK COMES BACK, UPLOAD WHAT WAS WRITTEN WITHOUT IT.
   *
   * Turns produced while the database was unreachable were held and never sent:
   * the buffer had a writer and a reader and nothing that drained it. Both
   * triggers matter — the event catches a reconnect while the tab is open, and
   * the mount catches the far more common case of somebody coming back to a tab
   * that regained its network while it was in the background.
   *
   * Exactly-once is the server's, through the idempotency key each turn
   * carries, so firing this more often than necessary is wasted work rather
   * than a duplicate.
   */
  useEffect(() => {
    // Restart-safe: this account's saved offline turns load before the drain.
    const journal = import("@/lib/chat/unsynced-turns").then(({ openJournal }) =>
      openJournal(user?.id ?? null),
    );
    if (!user) return;
    const drain = () => {
      void flushUnsyncedTurns().then(({ uploaded }) => {
        if (uploaded > 0) {
          void refreshConversations();
          if (opened.current) void openMessages(opened.current);
        }
      });
    };
    void journal.then(drain);
    window.addEventListener("online", drain);
    return () => window.removeEventListener("online", drain);
  }, [user, refreshConversations, openMessages]);

  const send = useCallback(
    async (
      message: string,
      choice: IntelligenceChoice,
      attachments: NormalizedAttachment[] = [],
      thinking = false,
      research = false,
      prepare?: () => Promise<void>,
      quality: IntelligenceQuality = "standard",
    ) => {
      const text = message.trim();
      /*
       * THE SECOND SEND IS REFUSED BEFORE THE FIRST ONE AWAITS ANYTHING.
       *
       * `busy` is state: the caller that set it cannot see it until the next
       * render, so two Sends in the same tick both read `false`, both reached
       * the gate, and both got a permit with a different idempotency key — two
       * charges for one question. A ref is written and read synchronously,
       * which is the only thing that can close a window that is one tick wide.
       */
      if (!text || sending.current) return false;
      sending.current = true;
      setProblem(null);

      /*
       * WHICH SCREEN THIS SEND BELONGS TO, CAPTURED BEFORE THE FIRST AWAIT.
       *
       * This used to be read AFTER the permit, which is an await of up to six
       * seconds against the allowance service. Switching account or conversation
       * inside that window moved the epoch, the permit then arrived, and the
       * send read the NEW epoch as its own — so it went on to create a
       * conversation and persist a question belonging to a screen nobody was
       * looking at, into the account now signed in. Everything after the first
       * await compares against the value from before it.
       */
      const at = epoch.current;
      const mine = () => epoch.current === at;
      const owner = account;

      /*
       * THE ALLOWANCE IS ASKED FIRST, before a conversation exists and before
       * anything is written. A permit taken after the question is persisted
       * would leave a question in somebody's transcript that OCADE then
       * refused to answer.
       */
      /*
       * A REFUSAL HERE MUST NOT COST THE PERSON THEIR WORDS.
       *
       * This returned void, so the composer cleared the moment Send was
       * pressed and a refused request — an exhausted allowance, an unreachable
       * gate — took the question with it. The caller is told the request was
       * not accepted and puts it back.
       */
      /*
       * A GATE THAT THROWS MUST NOT LEAVE THE COMPOSER STUCK FOR EVER.
       *
       * `sending` is set before this line, and nothing after a thrown permit
       * would clear it — Send would be dead for the life of the tab, with no
       * error anywhere. The gate explains its own refusals; an unexpected
       * throw is not one of them, so it gets a sentence of its own.
       */
      const acquired = await beginBilledRequest({ surface: "chat" }).catch(
        () => "gate_failed" as const,
      );
      const billed = acquired === "gate_failed" ? null : acquired;
      if (!billed) {
        // Request-owned, for the same reason the `finally` below is: if the
        // screen moved on during the refusal, `abandonInFlight` has already
        // cleared this and a newer send may be holding it.
        if (mine()) sending.current = false;
        // The gate explains its own refusals. An unexpected throw is not one of
        // them, so it gets a sentence rather than silence.
        if (acquired === "gate_failed") {
          setProblem("OCADE could not verify your usage allowance. Nothing was sent.");
        }
        return false;
      }

      try {
        /*
         * THE SCREEN MOVED WHILE THE ALLOWANCE WAS BEING ASKED.
         *
         * Nothing has been written yet, so there is nothing to undo — and the
         * permit is given back by the one settlement in the `finally`, like
         * every other exit. Reported as accepted so the caller does not push
         * this question into whatever screen replaced the one that asked it,
         * which for an account switch would be another person's composer.
         *
         * BEFORE `busy` AND BEFORE THE CONTROLLER, because both belong to the
         * screen that is on the display now — a send that no longer owns it must
         * not leave that composer waiting on an answer nobody asked for.
         */
        if (!mine()) return true;

        setBusy(true);
        const controller = new AbortController();
        abort.current = controller;

        /*
         * PERMISSION FIRST, THEN THE DESTRUCTIVE PART. Regenerate drops the
         * turns it is replacing here, after the allowance has said yes — it
         * used to delete them first, so an exhausted allowance took somebody's
         * question away and put nothing back. Inside the `try`, so the one
         * settlement in the `finally` covers this exit like every other.
         */
        if (prepare) {
          try {
            await prepare();
          } catch (cause) {
            setProblem(describeStorageError(cause));
            return false;
          }
        }

        /*
         * A TEMPORARY CHAT WRITES NOTHING, ANYWHERE.
         *
         * No conversation row, no message rows, no sync journal — the turns
         * live in this tab's state and go when it does. That is the whole
         * promise of the control, so it is kept by not calling the two
         * functions that would break it rather than by a flag each of them
         * checks and could forget.
         */
        let id = conversationId;
        /** Set when the chat starts with no connection; the drain creates it later. */
        let offlineTitle: string | undefined;
        if (!id && !temporary) {
          const row = (await createConversation({ data: { title: titleFrom(text) } }).catch(
            (cause) => {
              if (!isUnreachable(cause)) throw cause;
              offlineTitle = titleFrom(text);
              const now = new Date().toISOString();
              return {
                id: crypto.randomUUID(),
                title: offlineTitle,
                pinned: false,
                archived: false,
                model_id: null,
                updated_at: now,
                created_at: now,
              };
            },
          )) as unknown as OcadeConversationRow;
          // Opened another chat while this one was being created: the later choice keeps the
          // screen. The new conversation exists and shows up in the list; nothing is put in it.
          if (!mine()) {
            void refreshConversations();
            return true;
          }
          id = row.id;
          started.current = id;
          setConversationId(id);
          setConversations((current) => [row, ...current]);
        }

        const question = temporary
          ? { record: temporaryRecord("user", text, attachments), stored: "memory" as const }
          : await persistChatMessage({
              conversationId: id!,
              title: offlineTitle,
              role: "user",
              content: text,
              // Names and sizes only. The bytes are in Library, which is the one
              // place that owns a customer's files.
              attachments: attachments.map((attachment) => ({
                kind: attachment.image ? ("image" as const) : ("file" as const),
                name: attachment.name,
                mime: attachment.mime,
                sizeBytes: attachment.sizeBytes,
              })),
            });
        if (!mine()) return true; // The screen moved on while this was written.
        setMessages((current) => [...current, question.record]);
        // How this question was asked, so Regenerate asks it the same way. Only
        // recorded when it differs from the default, which is what keeps the map
        // empty for the ordinary case.
        if (thinking || research || quality === "high")
          askedWith.current.set(question.record.id, { thinking, research, quality });
        // The bytes stay in this tab so Regenerate can send the same file
        // again. Names and sizes are all the stored row will ever have.
        if (attachments.length > 0) {
          carried.current.set(question.record.id, attachments);
          // A file can be 100 MB. Only the recent questions can still be
          // regenerated in practice, so older bytes are released rather than
          // held until the tab closes.
          for (const id of [...carried.current.keys()].slice(0, -CARRIED_QUESTIONS)) {
            carried.current.delete(id);
          }
        }
        for (const id of [...askedWith.current.keys()].slice(0, -CARRIED_QUESTIONS)) {
          askedWith.current.delete(id);
        }

        /*
         * THE TRANSCRIPT ALREADY HAS THE QUESTION IN IT.
         *
         * `setMessages` writes `transcript.current` synchronously, so appending
         * `question.record` here as well sent the current question to the model
         * twice — the last thing the person typed, duplicated, in every request.
         */
        const turns: NormalizedMessage[] = transcript.current.map((record) => ({
          role: record.role === "system" ? ("assistant" as const) : record.role,
          content: record.content,
        }));
        // Only when there is something to cite: a standing instruction about
        // files on every request is tokens spent on nothing, and a model told
        // to cite sources that do not exist will invent one.
        const instruction = citationInstruction(attachments);
        const history = instruction
          ? ([{ role: "system", content: instruction }, ...turns] as NormalizedMessage[])
          : turns;

        let answer = "";
        /** What the person actually saw. Only this is charged and kept. */
        let shown = "";
        let refusal: string | null = null;
        let refusalCode: string | null = null;

        try {
          for await (const event of ocadeIntelligence().stream({
            permit: billed.permit,
            generationId: billed.permit.generationId,
            idempotencyKey: billed.permit.idempotencyKey,
            surface: "chat",
            mode: MODE_FOR[choice],
            messages: history,
            tools: [],
            attachments,
            privacy: {
              // `Offline` makes zero provider traffic — docs/PLAN.md Phase 7.
              onlineInferenceConsented: choice !== "offline",
              sealed: false,
            },
            conversationId: id ?? undefined,
            thinking,
            research: quality !== "high" && research,
            quality,
            ...(quality === "high" ? { highModeAcknowledged: HIGH_WARNING_VERSION } : {}),
            signal: controller.signal,
          })) {
            if (event.type === "token") {
              answer += event.text;
              /*
               * DELIVERY IS THE FIRST VISIBLE WORD. Recorded here, while this
               * screen still owns it, so switching chats after reading part of
               * an answer cannot release it at zero.
               */
              if (mine()) {
                billed.recordDelivery({ answer });
                shown = answer;
                setStreaming(answer);
              }
            } else if (event.type === "refusal") {
              refusal = event.reason;
              refusalCode = event.code;
            }
          }
        } catch (cause) {
          /*
           * STOP KEEPS WHAT IT ALREADY WROTE.
           *
           * Abort threw out of the loop and the half-written answer went with
           * it: the words were on the screen, then they were not, and nothing
           * was saved. Stopping is the person deciding they have enough, so
           * what arrived is persisted and charged like any other answer. A real
           * failure still throws.
           */
          if (!controller.signal.aborted) throw cause;
        }

        if (!mine()) {
          /*
           * THE SCREEN MOVED AFTER PART OF THE ANSWER WAS READ. It is kept with
           * the conversation that asked for it, never rendered here, and only
           * while the same account is signed in.
           */
          if (shown.trim() && id && !temporary && lastAccount.current === owner) {
            await persistChatMessage({
              conversationId: id,
              title: offlineTitle,
              role: "assistant",
              content: shown,
            });
          }
          return true;
        }

        if (answer.length === 0) {
          /*
           * NOTHING IS PERSISTED AND NOTHING IS RENDERED AS AN ANSWER.
           *
           * `docs/PRD.md`: a request that produced no answer must not appear
           * as a reply with controls beside it. The permit is released rather
           * than charged, because nothing was delivered.
           */
          // Stopping is a decision, not a failure: somebody who pressed Stop
          // before anything arrived does not need to be told OCADE could not
          // answer. A refusal or a genuine empty answer still says so.
          if (!controller.signal.aborted) {
            const said = refusal ?? "OCADE could not answer that. Try again.";
            setProblem(said);
            const busy =
              refusalCode === "provider_rate_limited" || refusalCode === "online_unavailable";
            setBusyProblem(busy && choice === "online" && quality === "standard" ? said : null);
          }
          // Accepted: the question is in the transcript, and Retry re-asks it
          // from there. Returning it to the composer would make two of it.
          return true;
        }

        /*
         * WORDS THEN A FAILURE ARE AN UNFINISHED ANSWER, said on screen and in the saved copy,
         * so neither today nor later does it pass for a complete one. Stop is the person's
         * own choice and needs no such note.
         */
        const cut = refusal !== null && !controller.signal.aborted;
        const kept = cut ? `${answer}\n\n_[This answer stopped before it finished.]_` : answer;
        const reply = temporary
          ? { record: temporaryRecord("assistant", kept, []), stored: "memory" as const }
          : await persistChatMessage({
              conversationId: id!,
              title: offlineTitle,
              role: "assistant",
              content: kept,
            });
        if (cut && mine()) setProblem(`The answer stopped early: ${refusal} Retry to ask again.`);
        if (!mine()) return true;
        // In the same render as the saved reply: the streamed copy stayed on
        // screen beside it until usage had settled, so the answer showed twice.
        setMessages((current) => [...current, reply.record]);
        setStreaming("");
        if (reply.stored === "unsynced") {
          setProblem(
            "durable" in reply && reply.durable === false
              ? "Your account could not be reached and this browser could not keep the answer either: it is saved only if this tab stays open until the connection returns."
              : "This answer is kept on this device because your account could not be reached. It is saved when the connection returns.",
          );
        }

        if (!temporary) void refreshConversations();
      } catch (cause) {
        if (mine()) setProblem(describeStorageError(cause));
      } finally {
        /*
         * SETTLE ON THE WAY OUT, WHICHEVER WAY OUT IT IS, so no exit can leave
         * a reservation held against somebody who received nothing — including
         * an exit somebody adds later. The allowance is re-read after that
         * settlement rather than during it.
         */
        await billed.settle();
        void queryClient.invalidateQueries({ queryKey: USAGE_QUERY_KEY });
        /*
         * THE GUARD IS RELEASED BY THE SEND THAT TOOK IT, AND ONLY THAT ONE.
         *
         * This cleared `sending` unconditionally. `abandonInFlight` already
         * clears it when the screen changes, so a newer send could be underway
         * by the time an abandoned one reached here — and this line opened the
         * duplicate-Send window the ref exists to close, for the whole of the
         * newer request. An epoch that still matches is the same test the rest
         * of the cleanup already used: nothing has replaced this screen, so this
         * send is the one holding the guard.
         */
        if (mine()) {
          sending.current = false;
          setStreaming("");
          setBusy(false);
          abort.current = null;
        }
      }
      return true;
    },
    [
      account,
      conversationId,
      queryClient,
      refreshConversations,
      setMessages,
      setConversations,
      temporary,
    ],
  );

  /**
   * ASK A QUESTION AGAIN — WHICH IS ALSO EDIT, ALSO REGENERATE, ALSO RETRY.
   *
   * Three controls and one operation: drop this question and everything after
   * it, then ask it. Edit supplies different words, Regenerate supplies none,
   * and Retry is Regenerate on the last question when the answer never came.
   * Three implementations of that would be three places for the history to be
   * truncated differently.
   *
   * The dropped turns go from the account as well as the screen. Leaving them
   * in the database would mean a reload resurrected the answer the person
   * asked OCADE to replace.
   */
  const resend = useCallback(
    async (
      userMessageId: string,
      choice: IntelligenceChoice,
      newText?: string,
      quality?: IntelligenceQuality,
    ) => {
      if (sending.current) return;
      const index = transcript.current.findIndex((record) => record.id === userMessageId);
      if (index < 0) return;
      const question = transcript.current[index]!;
      const text = (newText ?? question.content).trim();
      if (!text) return;

      /*
       * A FILE CANNOT BE ASKED ABOUT AGAIN IF IT IS NOT HERE ANY MORE.
       *
       * The stored question keeps the file's name and size, not its bytes, so
       * after a reload there is nothing to resend. Asking anyway would repeat
       * the question with the file silently missing and answer it as though
       * there had never been one. Say so instead.
       */
      const files = carried.current.get(question.id) ?? [];
      if (files.length === 0 && (question.attachments?.length ?? 0) > 0) {
        setProblem(
          "The file from this question is no longer attached. Attach it again to ask with it.",
        );
        return;
      }

      const before = transcript.current;
      // The choices this question was originally asked with. Regenerate passed
      // `false, false` and quietly answered a different question.
      const options = askedWith.current.get(question.id) ?? { thinking: false, research: false };
      const accepted = await send(
        text,
        choice,
        files,
        options.thinking,
        options.research,
        async () => {
          // Runs once the allowance has said yes. Deleting before that point cost
          // somebody their question whenever the answer was going to be refused.
          setMessages(before.slice(0, index));
          // Replaced turns still waiting on this device leave its journal too, so a reconnect
          // can never upload the words the person just replaced.
          for (const record of before.slice(index)) {
            if (record.unsynced) forgetUnsyncedTurn(record.id);
          }
          /*
           * ONE STATEMENT, NOT ONE PER TURN.
           *
           * This deleted each dropped turn with its own parallel call, so a
           * failure after some had succeeded removed turns from the middle of
           * somebody's transcript for good. The account now drops them together
           * or not at all, and a refusal leaves everything exactly where it was.
           *
           * FROM A STORED TURN'S OWN TIMESTAMP, NEVER THIS DEVICE'S CLOCK.
           * The obvious value to send is the anchor's `created_at` — and a turn
           * held in this tab because the account was unreachable carries a time
           * THIS BROWSER wrote. A clock running slow would name a moment before
           * turns that are genuinely earlier, and the delete would take them
           * too: turns nobody asked to replace, gone. Every stored row's
           * timestamp came from the database, so the first one being dropped is
           * a boundary the database itself chose. With nothing stored to drop,
           * there is nothing to ask for.
           */
          const from = before.slice(index).find((record) => !record.unsynced)?.created_at;
          if (temporary || !conversationId || !from) return;
          await deleteMessagesFrom({ data: { conversationId, from } });
        },
        quality ?? ("quality" in options ? (options.quality as IntelligenceQuality) : "standard"),
      );
      if (accepted) return;
      /*
       * REFUSED, OR THE ACCOUNT REFUSED THE DELETION. Either way nothing was
       * removed — the deletion is one statement — so the turns are still theirs
       * in the account and putting them back on the screen is the whole
       * recovery. This used to re-read the transcript instead, because a
       * part-finished deletion meant the screen could no longer be trusted.
       */
      setMessages(before);
    },
    [send, setMessages, temporary, conversationId],
  );

  /** Remove one turn, from the screen and from the account. */
  const removeMessage = useCallback(
    async (id: string) => {
      const before = transcript.current;
      setMessages((current) => current.filter((record) => record.id !== id));
      if (temporary) return; // Nothing was written, so nothing is deleted.
      // Not in the account yet: it is deleted where it waits, on this device.
      if (before.find((record) => record.id === id)?.unsynced) {
        forgetUnsyncedTurn(id);
        return;
      }
      try {
        await deleteMessage({ data: { id } });
      } catch (cause) {
        /*
         * A DELETION THAT FAILED MUST NOT LOOK LIKE ONE THAT WORKED.
         *
         * The failure was swallowed and the turn left the screen anyway, so
         * private text somebody had deleted came back on the next reload — it
         * had never left the account. It stays visible, and they are told.
         */
        setMessages(before);
        setProblem(describeStorageError(cause));
      }
    },
    [setMessages, temporary],
  );

  const stop = useCallback(() => {
    abort.current?.abort();
  }, []);

  /*
   * AN OPTIMISTIC CHANGE THAT FAILED IS PUT BACK.
   *
   * Rename, Archive and Delete all wrote to the screen first and then awaited
   * the account. When that write failed — no network, a policy refusal — the
   * screen kept the change and the account never had it, so somebody was
   * looking at a conversation they had renamed or deleted that was still
   * exactly where it was. The list is restored and they are told.
   */
  const mutateConversations = useCallback(
    async (
      optimistic: (rows: OcadeConversationRow[]) => OcadeConversationRow[],
      write: Promise<unknown>,
    ) => {
      const before = conversationsRef.current;
      setConversations(optimistic(before));
      try {
        await write;
      } catch (cause) {
        setConversations(before);
        setProblem(describeStorageError(cause));
      }
    },
    [setConversations],
  );

  const rename = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim().slice(0, 200);
      if (!trimmed) return;
      await mutateConversations(
        (rows) => rows.map((row) => (row.id === id ? { ...row, title: trimmed } : row)),
        updateConversation({ data: { id, title: trimmed } }),
      );
    },
    [mutateConversations],
  );

  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      await mutateConversations(
        (rows) => rows.map((row) => (row.id === id ? { ...row, archived } : row)),
        updateConversation({ data: { id, archived } }),
      );
    },
    [mutateConversations],
  );

  const remove = useCallback(
    async (id: string) => {
      if (conversationId === id) {
        abandonInFlight();
        setConversationId(null);
        setMessages([]);
      }
      await mutateConversations(
        (rows) => rows.filter((row) => row.id !== id),
        deleteConversation({ data: { id } }),
      );
    },
    [mutateConversations, conversationId, abandonInFlight, setMessages],
  );

  const deleteEverything = useCallback(async () => {
    await deleteAllConversations();
    abandonInFlight();
    setConversations([]);
    setConversationId(null);
    setMessages([]);
  }, [setMessages, setConversations, abandonInFlight]);

  const openConversation = useCallback(
    (id: string | null) => {
      // Opening a saved conversation leaves temporary mode, and with it the
      // temporary transcript. Staying in it would write the next turn nowhere
      // while the person is looking at a conversation that is saved.
      // An answer still arriving for the conversation being left is abandoned
      // rather than allowed to land in this one.
      abandonInFlight();
      setTemporary(false);
      setConversationId(id);
      setProblem(null);
    },
    [abandonInFlight],
  );

  /**
   * Turn temporary chat on or off.
   *
   * Either direction starts a clean transcript. Carrying turns across the
   * boundary would either write something the person was told would not be
   * written, or silently drop turns they could see.
   */
  const setTemporaryChat = useCallback(
    (on: boolean) => {
      abandonInFlight();
      setTemporary(on);
      setConversationId(null);
      setMessages([]);
      setProblem(null);
    },
    [setMessages, abandonInFlight],
  );

  /**
   * One conversation, saved to a file.
   *
   * Markdown rather than JSON: this is for a person who wants to keep, read or
   * send what was said. The whole-account export under Data Controls is the
   * machine-readable one.
   */
  const exportConversation = useCallback(
    async (id: string) => {
      const title = conversations.find((row) => row.id === id)?.title ?? "Conversation";
      // The open conversation is already here; any other one is read the same
      // way the transcript reads it, so Export works from the menu without
      // opening the conversation first.
      const rows =
        id === conversationId && !temporary
          ? transcript.current
          : await loadChatMessages({ conversationId: id });
      const body = rows
        .map((row) => `## ${row.role === "user" ? "You" : "OCADE"}\n\n${row.content}`)
        .join("\n\n");
      saveFile(
        `${title.replace(/[^\w- ]+/g, "").trim() || "conversation"}.md`,
        new Blob([`# ${title}\n\n${body}\n`], { type: "text/markdown;charset=utf-8" }),
      );
    },
    [conversations, conversationId, temporary],
  );

  const newConversation = useCallback(() => {
    abandonInFlight();
    setConversationId(null);
    setMessages([]);
    setProblem(null);
  }, [setMessages, abandonInFlight]);

  return useMemo(
    () => ({
      conversations,
      conversationId,
      messages,
      streaming,
      busy,
      problem,
      standardBusy: problem !== null && problem === busyProblem,
      loadingConversations,
      conversationsFailed,
      loadingMessages,
      messagesFailed,
      temporary,
      send,
      resend,
      removeMessage,
      stop,
      openConversation,
      newConversation,
      rename,
      setArchived,
      remove,
      deleteEverything,
      reloadConversations: refreshConversations,
      reloadMessages: async () => {
        if (conversationId) await openMessages(conversationId);
      },
      setTemporary: setTemporaryChat,
      exportConversation,
      dismissProblem: () => setProblem(null),
    }),
    [
      conversations,
      conversationId,
      messages,
      streaming,
      busy,
      problem,
      busyProblem,
      loadingConversations,
      conversationsFailed,
      loadingMessages,
      messagesFailed,
      temporary,
      send,
      resend,
      removeMessage,
      stop,
      openConversation,
      newConversation,
      rename,
      setArchived,
      remove,
      deleteEverything,
      refreshConversations,
      openMessages,
      setTemporaryChat,
      exportConversation,
    ],
  );
}
