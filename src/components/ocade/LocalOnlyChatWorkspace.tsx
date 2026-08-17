import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/shell/AppShell";
import { ChatComposer } from "@/components/ocade/chat/ChatComposer";
import { ChatSidebar } from "@/components/ocade/chat/ChatSidebar";
import { MessageList } from "@/components/ocade/chat/MessageList";
import type { ChatConversationView, ChatMessageView, EngineStatusView } from "@/components/ocade/chat/chat-types";
import { useLocalChatEngine } from "@/lib/chat/use-local-chat-engine";
import { useChatPrefs } from "@/lib/use-chat-prefs";
import { useSession } from "@/lib/session";
import { ocadeCorePolicy } from "@/lib/agent/ocade-core-policy";
import type { BrainMessage } from "@/lib/brain/adapter";

const STORAGE_VERSION = 1;
const MAX_STORED_CONVERSATIONS = 100;
const MAX_CONTEXT_MESSAGES = 60;

interface LocalConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageView[];
}
interface LocalChatStore {
  version: number;
  activeId: string | null;
  conversations: LocalConversation[];
}

const SYSTEM_PROMPT: BrainMessage = {
  role: "system",
  content:
    `${ocadeCorePolicy("chat")}\n\n` +
    "You are OCADE. AI inference for this product is local-only. Never claim that a prompt was sent to a cloud AI provider. Be concise, accurate and explicit when the local engine cannot perform something.",
};

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function defaultStore(): LocalChatStore {
  return { version: STORAGE_VERSION, activeId: null, conversations: [] };
}
function storageKey(userId: string) {
  return `ocade:local-only-chat:v${STORAGE_VERSION}:${userId}`;
}
function readStore(userId: string): LocalChatStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? "null") as LocalChatStore | null;
    if (!parsed || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.conversations)) return defaultStore();
    return parsed;
  } catch {
    return defaultStore();
  }
}
function writeStore(userId: string, store: LocalChatStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    storageKey(userId),
    JSON.stringify({
      ...store,
      conversations: [...store.conversations]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, MAX_STORED_CONVERSATIONS),
    }),
  );
}
function titleFrom(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 52) : "New local chat";
}

/**
 * Authenticated OCADE Chat with no server AI path.
 * Conversation bodies are account-scoped local browser data and generation
 * goes only through the on-device Brain. No prompt is written to Supabase or
 * posted to a server chat endpoint from this workspace.
 */
export function LocalOnlyChatWorkspace() {
  const { user } = useSession();
  const userId = user?.id ?? "local";
  const { prefs } = useChatPrefs();
  const engine = useLocalChatEngine({ surface: "chat", thinking: prefs.thinking });
  const [store, setStore] = useState<LocalChatStore>(() => readStore(userId));
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");

  useEffect(() => setStore(readStore(userId)), [userId]);
  useEffect(() => writeStore(userId, store), [userId, store]);
  useEffect(() => {
    void engine.check();
    engine.warm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(
    () => store.conversations.find((conversation) => conversation.id === store.activeId) ?? null,
    [store],
  );

  const conversations: ChatConversationView[] = useMemo(
    () =>
      [...store.conversations]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          updatedAt: conversation.updatedAt,
          messageCount: conversation.messages.length,
        })),
    [store.conversations],
  );

  const renderedMessages = useMemo(() => {
    const messages = active?.messages ?? [];
    if (!streaming) return messages;
    return [
      ...messages,
      {
        id: "streaming-local",
        role: "assistant" as const,
        content: streamText,
        createdAt: new Date().toISOString(),
        engineLabel: engine.state.label ?? "OCADE Local",
        streaming: true,
      },
    ];
  }, [active?.messages, engine.state.label, streamText, streaming]);

  const engineView: EngineStatusView = useMemo(() => {
    const ready = engine.state.status === "ready" || engine.state.status === "generating";
    return {
      locality: ready ? "local" : "unknown",
      label: ready ? (engine.state.label ?? "OCADE Local") : "Local engine",
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      preparing: engine.state.status === "checking" || engine.state.status === "preparing",
      detail:
        engine.state.reason ??
        "AI generation runs on this device. There is no Gemini, OpenAI or other cloud-model fallback.",
    };
  }, [engine.state]);

  const createConversation = useCallback((initialTitle = "New local chat") => {
    const now = new Date().toISOString();
    const conversation: LocalConversation = {
      id: id("chat"),
      title: initialTitle,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    setStore((current) => ({
      ...current,
      activeId: conversation.id,
      conversations: [conversation, ...current.conversations],
    }));
    return conversation.id;
  }, []);

  const updateConversation = useCallback(
    (conversationId: string, update: (conversation: LocalConversation) => LocalConversation) => {
      setStore((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.id === conversationId ? update(conversation) : conversation,
        ),
      }));
    },
    [],
  );

  const removeConversation = useCallback((conversationId: string) => {
    setStore((current) => {
      const remaining = current.conversations.filter((conversation) => conversation.id !== conversationId);
      return {
        ...current,
        activeId: current.activeId === conversationId ? (remaining[0]?.id ?? null) : current.activeId,
        conversations: remaining,
      };
    });
  }, []);

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text || streaming) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessageView = {
      id: id("user"),
      role: "user",
      content: text,
      createdAt: now,
    };

    // New-chat creation and first-message append MUST be one state mutation.
    // React state updates are async; creating an empty conversation and then
    // trying to append against the previous store could silently lose turn 1.
    let conversationId: string;
    let existing: ChatMessageView[];
    if (active) {
      conversationId = active.id;
      existing = active.messages;
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        title: conversation.messages.length === 0 ? titleFrom(text) : conversation.title,
        updatedAt: now,
        messages: [...conversation.messages, userMessage],
      }));
    } else {
      conversationId = id("chat");
      existing = [];
      const created: LocalConversation = {
        id: conversationId,
        title: titleFrom(text),
        createdAt: now,
        updatedAt: now,
        messages: [userMessage],
      };
      setStore((current) => ({
        ...current,
        activeId: conversationId,
        conversations: [created, ...current.conversations],
      }));
    }

    setDraft("");
    setStreaming(true);
    setStreamText("");
    let answer = "";
    const history: BrainMessage[] = [
      SYSTEM_PROMPT,
      ...existing
        .slice(-MAX_CONTEXT_MESSAGES)
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
      { role: "user", content: text },
    ];

    const result = await engine.send({
      messages: history,
      onToken: (chunk) => {
        answer += chunk;
        setStreamText(answer);
      },
    });
    setStreaming(false);
    setStreamText("");

    if (result.cancelled) {
      if (answer.trim()) {
        const stopped = `${answer}\n\n_[stopped by you]_`;
        updateConversation(conversationId, (conversation) => ({
          ...conversation,
          updatedAt: new Date().toISOString(),
          messages: [
            ...conversation.messages,
            {
              id: id("assistant"),
              role: "assistant",
              content: stopped,
              createdAt: new Date().toISOString(),
              engineLabel: engine.state.label ?? "OCADE Local",
            },
          ],
        }));
      }
      return;
    }

    if (!result.ok) {
      setDraft(text);
      toast.error(result.reason ?? "No on-device OCADE engine is ready.");
      return;
    }

    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      updatedAt: new Date().toISOString(),
      messages: [
        ...conversation.messages,
        {
          id: id("assistant"),
          role: "assistant",
          content: answer,
          createdAt: new Date().toISOString(),
          engineLabel: engine.state.label ?? "OCADE Local",
        },
      ],
    }));
  }, [active, draft, engine, streaming, updateConversation]);

  return (
    <AppShell>
      <div className="-mx-5 -my-3 flex min-h-[calc(100vh-8rem)] border-t border-border/50 sm:-mx-8">
        <aside className="hidden w-[17.5rem] shrink-0 border-r border-border/60 md:block">
          <ChatSidebar
            conversations={conversations}
            activeId={store.activeId}
            onSelect={(conversationId) => setStore((current) => ({ ...current, activeId: conversationId }))}
            onNewChat={() => createConversation()}
            emptyLabel="No local conversations yet."
            renderRowMenu={(row) => (
              <button
                type="button"
                aria-label={`Delete ${row.title}`}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  removeConversation(row.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
            <div>
              <h1 className="text-sm font-medium">{active?.title ?? "OCADE Local"}</h1>
              <p className="text-[11px] text-muted-foreground">
                AI and chat bodies stay on this device. No cloud-model fallback exists.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => createConversation()}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New chat
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <MessageList
              messages={renderedMessages}
              conversationKey={active?.id ?? "empty"}
              renderMarkdown
              actions={{
                onCopy: (message) => void navigator.clipboard.writeText(message.content),
                onDelete: active
                  ? (message) =>
                      updateConversation(active.id, (conversation) => ({
                        ...conversation,
                        updatedAt: new Date().toISOString(),
                        messages: conversation.messages.filter((row) => row.id !== message.id),
                      }))
                  : undefined,
              }}
              emptyState={
                <div className="mx-auto max-w-2xl px-6 py-20 text-center">
                  <h2 className="text-xl font-medium">OCADE runs here.</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Your prompt is generated on this device. If the local engine is not ready,
                    OCADE tells you instead of sending the request to Gemini, OpenAI, or any other cloud model.
                  </p>
                  {engine.state.reason ? (
                    <p className="mt-4 rounded-lg border border-border/60 bg-card/60 p-3 text-xs text-muted-foreground">
                      {engine.state.reason}
                    </p>
                  ) : null}
                </div>
              }
            />
          </div>

          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSubmit={() => void submit()}
            onStop={streaming ? engine.stop : undefined}
            streaming={streaming}
            engine={engineView}
            sendKey={prefs.sendKey}
            onTypingStarted={engine.warm}
            onNewChat={() => createConversation()}
            signedIn
          />
        </section>
      </div>
    </AppShell>
  );
}
