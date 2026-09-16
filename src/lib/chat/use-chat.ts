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
  listConversations,
  setConversationTrashed,
  updateConversation,
  type OcadeConversationRow,
} from "@/lib/ocade.functions";
import {
  describeStorageError,
  loadChatMessages,
  persistChatMessage,
  type ChatMessageRecord,
} from "@/lib/ocade-chat-store";
import { beginBilledRequest } from "@/lib/commercial/use-generation-permit";
import { USAGE_QUERY_KEY } from "@/lib/commercial/use-commercial-usage";
import { ocadeIntelligence } from "@/lib/intelligence/ocade-intelligence";
import type { IntelligenceMode } from "@/lib/intelligence/contract";
import { useSession } from "@/lib/session";

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
  loadingMessages: boolean;
}

export interface ChatActions {
  send(message: string, choice: IntelligenceChoice): Promise<void>;
  stop(): void;
  openConversation(id: string | null): void;
  newConversation(): void;
  rename(id: string, title: string): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
  trash(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  deleteEverything(): Promise<void>;
  dismissProblem(): void;
}

export function useChat(): ChatState & ChatActions {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [conversations, setConversations] = useState<OcadeConversationRow[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
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
    } catch {
      // A history that will not load is not a reason to block the composer.
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    let cancelled = false;
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    void loadChatMessages({ conversationId })
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const send = useCallback(
    async (message: string, choice: IntelligenceChoice) => {
      const text = message.trim();
      if (!text || busy) return;
      setProblem(null);

      /*
       * THE ALLOWANCE IS ASKED FIRST, before a conversation exists and before
       * anything is written. A permit taken after the question is persisted
       * would leave a question in somebody's transcript that OCADE then
       * refused to answer.
       */
      const billed = await beginBilledRequest({ surface: "chat" });
      if (!billed) return; // The gate has already said why, in its own words.

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
        let id = conversationId;
        if (!id) {
          const row = (await createConversation({
            data: { title: titleFrom(text) },
          })) as unknown as OcadeConversationRow;
          id = row.id;
          setConversationId(id);
          setConversations((current) => [row, ...current]);
        }

        const question = await persistChatMessage({
          conversationId: id,
          role: "user",
          content: text,
        });
        setMessages((current) => [...current, question.record]);

        const history = [...messages, question.record].map((record) => ({
          role: record.role === "system" ? ("assistant" as const) : record.role,
          content: record.content,
        }));

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
          attachments: [],
          privacy: {
            // `Offline` makes zero provider traffic — docs/PLAN.md Phase 7.
            onlineInferenceConsented: choice !== "offline",
            sealed: false,
          },
          conversationId: id,
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
          return;
        }

        const reply = await persistChatMessage({
          conversationId: id,
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
        void refreshConversations();
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
    },
    [busy, conversationId, messages, queryClient, refreshConversations],
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
  }, []);

  const openConversation = useCallback((id: string | null) => {
    setConversationId(id);
    setProblem(null);
  }, []);

  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setProblem(null);
  }, []);

  return useMemo(
    () => ({
      conversations,
      conversationId,
      messages,
      streaming,
      busy,
      problem,
      loadingConversations,
      loadingMessages,
      send,
      stop,
      openConversation,
      newConversation,
      rename,
      setArchived,
      trash,
      restore,
      deleteEverything,
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
      loadingMessages,
      send,
      stop,
      openConversation,
      newConversation,
      rename,
      setArchived,
      trash,
      restore,
      deleteEverything,
    ],
  );
}
