/**
 * EVERYTHING CHAT DOES, IN ONE HOOK.
 *
 * The screen renders; this decides. Conversations, the transcript, sending,
 * streaming, persistence, rename, archive, trash, restore and delete-all all
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
  listConversations,
  setConversationTrashed,
  updateConversation,
  type OcadeConversationRow,
} from "@/lib/ocade.functions";
import {
  describeStorageError,
  flushUnsyncedTurns,
  loadChatMessages,
  persistChatMessage,
  type ChatMessageRecord,
} from "@/lib/ocade-chat-store";
import { beginBilledRequest } from "@/lib/commercial/use-generation-permit";
import { citationInstruction } from "@/lib/chat/attachments";
import type { NormalizedAttachment, NormalizedMessage } from "@/lib/intelligence/contract";
import { USAGE_QUERY_KEY } from "@/lib/commercial/use-commercial-usage";
import { ocadeIntelligence } from "@/lib/intelligence/ocade-intelligence";
import type { IntelligenceMode } from "@/lib/intelligence/contract";
import { useSession } from "@/lib/session";
import { saveFile } from "@/lib/utils";

/** The three words a customer sees, and the mode each one means. */
export type IntelligenceChoice = "auto" | "ocade" | "offline";

const MODE_FOR: Record<IntelligenceChoice, IntelligenceMode> = {
  auto: "automatic",
  ocade: "online",
  offline: "local_only",
};

/** A title from the first thing somebody said, rather than "New chat" forever. */
export function titleFrom(message: string): string {
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
   */
  send(
    message: string,
    choice: IntelligenceChoice,
    attachments?: NormalizedAttachment[],
    thinking?: boolean,
    research?: boolean,
  ): Promise<boolean>;
  /** Edit, Regenerate and Retry, which are the same operation. */
  resend(userMessageId: string, choice: IntelligenceChoice, newText?: string): Promise<void>;
  removeMessage(id: string): Promise<void>;
  stop(): void;
  openConversation(id: string | null): void;
  newConversation(): void;
  rename(id: string, title: string): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
  trash(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  deleteEverything(): Promise<void>;
  reloadConversations(): Promise<void>;
  reloadMessages(): Promise<void>;
  setTemporary(on: boolean): void;
  /** Save one conversation to a file, whether or not it is the open one. */
  exportConversation(id: string): Promise<void>;
  dismissProblem(): void;
}

export function useChat(): ChatState & ChatActions {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [conversations, setConversations] = useState<OcadeConversationRow[]>([]);
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
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [conversationsFailed, setConversationsFailed] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesFailed, setMessagesFailed] = useState(false);
  const [temporary, setTemporary] = useState(false);
  /** Which conversation the in-flight transcript read belongs to. */
  const opened = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }
    setLoadingConversations(true);
    try {
      const rows = (await listConversations()) as unknown as OcadeConversationRow[];
      setConversations(rows ?? []);
      setConversationsFailed(false);
    } catch {
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
  }, [user]);

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
      try {
        const rows = await loadChatMessages({ conversationId: id });
        if (opened.current !== id) return;
        setMessages(rows);
        setMessagesFailed(false);
      } catch {
        if (opened.current !== id) return;
        setMessages([]);
        setMessagesFailed(true);
      } finally {
        if (opened.current === id) setLoadingMessages(false);
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
    if (!user) return;
    const drain = () => {
      void flushUnsyncedTurns().then(({ uploaded }) => {
        if (uploaded > 0) {
          void refreshConversations();
          if (opened.current) void openMessages(opened.current);
        }
      });
    };
    drain();
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
    ) => {
      const text = message.trim();
      if (!text || busy) return false;
      setProblem(null);

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
      const billed = await beginBilledRequest({ surface: "chat" });
      if (!billed) return false; // The gate has already said why, in its own words.

      setBusy(true);
      const controller = new AbortController();
      abort.current = controller;

      let settled = false;
      const settle = async () => {
        if (settled) return;
        settled = true;
        await billed.settle();
      };

      try {
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
        if (!id && !temporary) {
          const row = (await createConversation({
            data: { title: titleFrom(text) },
          })) as unknown as OcadeConversationRow;
          id = row.id;
          setConversationId(id);
          setConversations((current) => [row, ...current]);
        }

        const question = temporary
          ? { record: temporaryRecord("user", text, attachments), stored: "memory" as const }
          : await persistChatMessage({
              conversationId: id!,
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
        setMessages((current) => [...current, question.record]);

        const turns: NormalizedMessage[] = [...transcript.current, question.record].map(
          (record) => ({
            role: record.role === "system" ? ("assistant" as const) : record.role,
            content: record.content,
          }),
        );
        // Only when there is something to cite: a standing instruction about
        // files on every request is tokens spent on nothing, and a model told
        // to cite sources that do not exist will invent one.
        const instruction = citationInstruction(attachments);
        const history = instruction
          ? ([{ role: "system", content: instruction }, ...turns] as NormalizedMessage[])
          : turns;

        let answer = "";
        let refusal: string | null = null;

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
          research,
          signal: controller.signal,
        })) {
          if (event.type === "token") {
            answer += event.text;
            setStreaming(answer);
          } else if (event.type === "refusal") {
            refusal = event.reason;
          }
        }

        if (answer.length === 0) {
          /*
           * NOTHING IS PERSISTED AND NOTHING IS RENDERED AS AN ANSWER.
           *
           * `docs/PRD.md`: a request that produced no answer must not appear
           * as a reply with controls beside it. The permit is released rather
           * than charged, because nothing was delivered.
           */
          setProblem(refusal ?? "OCADE could not answer that. Try again.");
          await settle();
          // Accepted: the question is in the transcript, and Retry re-asks it
          // from there. Returning it to the composer would make two of it.
          return true;
        }

        const reply = temporary
          ? { record: temporaryRecord("assistant", answer, []), stored: "memory" as const }
          : await persistChatMessage({
              conversationId: id!,
              role: "assistant",
              content: answer,
            });
        setMessages((current) => [...current, reply.record]);
        if (reply.stored === "unsynced") {
          setProblem(
            "This answer is held in this tab because your account could not be reached. Closing the tab discards it.",
          );
        }

        billed.recordDelivery({ answer });
        await settle();
        if (!temporary) void refreshConversations();
        /*
         * The allowance the person is shown must reflect what they just spent.
         * Settings reads it through the same query key, so one invalidation
         * keeps every surface honest rather than each caching its own answer.
         */
        void queryClient.invalidateQueries({ queryKey: USAGE_QUERY_KEY });
      } catch (cause) {
        setProblem(describeStorageError(cause));
        await settle();
      } finally {
        setStreaming("");
        setBusy(false);
        abort.current = null;
      }
      return true;
    },
    [busy, conversationId, queryClient, refreshConversations, setMessages, temporary],
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
    async (userMessageId: string, choice: IntelligenceChoice, newText?: string) => {
      if (busy) return;
      const at = transcript.current.findIndex((record) => record.id === userMessageId);
      if (at < 0) return;
      const question = transcript.current[at]!;
      const text = (newText ?? question.content).trim();
      if (!text) return;

      const dropped = transcript.current.slice(at);
      setMessages(transcript.current.slice(0, at));
      // A temporary turn was never written, so there is nothing to delete and
      // an authenticated call naming an id no row has ever carried.
      if (!temporary) {
        await Promise.all(
          dropped
            .filter((record) => !record.unsynced)
            .map((record) => deleteMessage({ data: { id: record.id } }).catch(() => undefined)),
        );
      }
      await send(text, choice);
    },
    [busy, send, setMessages, temporary],
  );

  /** Remove one turn, from the screen and from the account. */
  const removeMessage = useCallback(
    async (id: string) => {
      setMessages((current) => current.filter((record) => record.id !== id));
      if (temporary) return; // Nothing was written, so nothing is deleted.
      await deleteMessage({ data: { id } }).catch(() => undefined);
    },
    [setMessages, temporary],
  );

  const stop = useCallback(() => {
    abort.current?.abort();
  }, []);

  const rename = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim().slice(0, 200);
    if (!trimmed) return;
    setConversations((current) =>
      current.map((row) => (row.id === id ? { ...row, title: trimmed } : row)),
    );
    await updateConversation({ data: { id, title: trimmed } });
  }, []);

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    setConversations((current) =>
      current.map((row) => (row.id === id ? { ...row, archived } : row)),
    );
    await updateConversation({ data: { id, archived } });
  }, []);

  const trash = useCallback(async (id: string) => {
    // Removed from the list immediately; the row is recoverable until the
    // trash period expires, which is what makes this safe to do optimistically.
    setConversations((current) => current.filter((row) => row.id !== id));
    setConversationId((current) => (current === id ? null : current));
    await setConversationTrashed({ data: { id, trashed: true } });
  }, []);

  const restore = useCallback(
    async (id: string) => {
      await setConversationTrashed({ data: { id, trashed: false } });
      await refreshConversations();
    },
    [refreshConversations],
  );

  const deleteEverything = useCallback(async () => {
    await deleteAllConversations();
    setConversations([]);
    setConversationId(null);
    setMessages([]);
  }, [setMessages]);

  const openConversation = useCallback((id: string | null) => {
    // Opening a saved conversation leaves temporary mode, and with it the
    // temporary transcript. Staying in it would write the next turn nowhere
    // while the person is looking at a conversation that is saved.
    setTemporary(false);
    setConversationId(id);
    setProblem(null);
  }, []);

  /**
   * Turn temporary chat on or off.
   *
   * Either direction starts a clean transcript. Carrying turns across the
   * boundary would either write something the person was told would not be
   * written, or silently drop turns they could see.
   */
  const setTemporaryChat = useCallback(
    (on: boolean) => {
      opened.current = null;
      setTemporary(on);
      setConversationId(null);
      setMessages([]);
      setProblem(null);
    },
    [setMessages],
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
    opened.current = null;
    setConversationId(null);
    setMessages([]);
    setProblem(null);
  }, [setMessages]);

  return useMemo(
    () => ({
      conversations,
      conversationId,
      messages,
      streaming,
      busy,
      problem,
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
      trash,
      restore,
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
      trash,
      restore,
      deleteEverything,
      refreshConversations,
      openMessages,
      setTemporaryChat,
      exportConversation,
    ],
  );
}
