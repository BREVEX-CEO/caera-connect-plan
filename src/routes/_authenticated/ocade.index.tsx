import { useNavigate } from "@tanstack/react-router";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  Loader2,
  Mic,
  MicOff,
  MonitorCog,
  Paperclip,
  Keyboard,
  Pencil,
  Pin,
  PinOff,
  EyeOff,
  Plus,
  RefreshCcw,
  Search,
  Share2,
  Save,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  GitBranch,
  MessageSquareQuote,
  X,
  FolderOpen,
  FileOutput,
  CalendarClock,
  Workflow,
  SlidersHorizontal,
  ShieldCheck,
  FileCode2,
  /*
   * Aliased because `Lock` is also a DOM global — the Web Locks API interface —
   * and the unaliased name resolves to that instead of the icon, producing a
   * "cannot be used as a JSX component" error that reads as nonsense.
   */
  Lock as LockIcon,
  Unlock as UnlockIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { matchChatShortcut, CHAT_SHORTCUTS } from "@/lib/chat-shortcuts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { INCOGNITO_CLAIMS, INCOGNITO_SUMMARY, INCOGNITO_TITLE } from "@/lib/chat/incognito";
import {
  createConversation,
  deleteAllConversations,
  deleteConversation,
  listTrashedConversations,
  setConversationTrashed,
  conversationTrashDays,
  exportConversation,
  appendOcadeMessage,
  listConversations,
  listMessages,
  saveMessageCitations,
  setMessageReaction,
  updateConversation,
} from "@/lib/ocade.functions";
import { OCADE_DEFAULT_MODEL_ID, OCADE_MODELS, getOcadeModel } from "@/lib/ocade-models";
import { ocadeChatCapabilityDisclosure, ocadeIdentityAnswer } from "@/lib/ocade-identity";
import { capabilityLabelFor } from "@/lib/ocade-capability-labels";
import { useOnline } from "@/lib/use-online";
import { useLocalEngine } from "@/lib/use-local-engine";
import { useDevicePolicy } from "@/lib/use-device-policy";
import { useChatPrefs, readChatPrefs } from "@/lib/use-chat-prefs";
import { assembleSystemPrompt } from "@/lib/prompt/assemble";
import { chooseBrowserTier, systemPromptBudgetFor } from "@/lib/brain/browser-catalogue";
import { loadBenchmark } from "@/lib/brain/tier-benchmark-store";
import { improvePromptLocally } from "@/lib/chat/improve-prompt";
import {
  currentShareToken,
  describeSnapshot,
  readSharedConversation,
  revokeConversationShare,
  shareConversation,
  shareLinkFor,
  SHARE_REFUSAL_MESSAGE,
} from "@/lib/chat/conversation-sharing";
import {
  appendSideMessage,
  deleteSideThread,
  loadSideThread,
  sideConversationPrompt,
  type SideMessage,
} from "@/lib/chat/side-conversations";
import { useOcadeRuntime, type RuntimeApproval } from "@/lib/runtime/use-ocade-runtime";
import { OcadeOrb } from "@/components/ocade/OcadeOrb";
import { orbStateFor } from "@/lib/orb/state";
import { describe as describeOutcome } from "@/lib/agent/loop";
import { MessageList } from "@/components/ocade/chat/MessageList";
import { ChatSidebar } from "@/components/ocade/chat/ChatSidebar";
import { EngineBadge } from "@/components/ocade/chat/EngineBadge";
import { PreparationStatus } from "@/components/ocade/chat/PreparationStatus";
import { useBrain } from "@/lib/brain/use-brain";
import type { RouteChosen } from "@/lib/brain/router";
import {
  createOcadeIntelligence,
  createOnlineIntelligenceTransport,
  type IntelligenceBackend,
  type IntelligenceEvent,
  type IntelligenceTransport,
  type NormalizedMessage,
} from "@/lib/intelligence";
import { NetworkWitness, limits as networkLimits } from "@/lib/provenance/network-witness";
import { buildReceipt, type AnswerReceipt, type SourceUse } from "@/lib/provenance/receipt";
import { sha256OfText } from "@/lib/provenance/digest";
import { splitIntoPassages } from "@/lib/retrieval/passages";
import { AnswerReceiptPanel } from "@/components/ocade/chat/AnswerReceiptPanel";
import { ConversationIntegrity } from "@/components/ocade/chat/ConversationIntegrity";
import { Seal, describeSeal } from "@/lib/edge/sealed-mode";
import { installConversationSeal } from "@/lib/edge/seal-policy";
import { preflight, summarise as summarisePreflight } from "@/lib/edge/preflight";
import { measureRun, total as totalCost, describeTotals, type RunCost } from "@/lib/edge/meter";
import { append as appendLedger, type LedgerEntry } from "@/lib/edge/ledger";
import { emptyTree, type Tree } from "@/lib/edge/checkpoints";
import { recordTurn } from "@/lib/edge/session";
import { compareRuns, pinRun, type PinnedRun, type RepeatVerdict } from "@/lib/edge/reproducible";
import { beginBilledRequest, type BilledRequest } from "@/lib/commercial/use-generation-permit";
import { BROWSER_SAMPLER } from "@/lib/brain/sampler-settings";
import { AnswerDiff } from "@/components/ocade/chat/AnswerDiff";
import { SideThreadPanel } from "@/components/ocade/chat/SideThreadPanel";
import type { BrainMessage } from "@/lib/brain/adapter";
import type {
  ChatMessageView,
  ChatConversationView,
  ChatReaction,
} from "@/components/ocade/chat/chat-types";
import { deliveryStateFor, quoteForReply } from "@/lib/chat/message-feedback";
import { reason } from "@/lib/reasoning/engine";
import { brainReasonDeps, sessionPerfLedger } from "@/lib/reasoning/brain-deps";
import { thinkingFor } from "@/lib/local/fixed-model";
import {
  planContextWindow,
  SLOW_READ_WARNING_SECONDS,
  DEFAULT_LOCAL_BRIDGE_URL,
  type LocalChatMessage,
} from "@/lib/ocade-local";
import { PerfLedger, routeTask } from "@/lib/local/router-policy";
import {
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  MODES,
  newConversationId,
  readChatError,
  fileToDataUrl,
  toMessageView,
  type Attachment,
  type Conversation,
  type Message,
  type PendingChatMessage,
  type PermissionMode,
  type SpeechRecognitionLike,
} from "@/components/ocade/chat/conversation-model";
import { IncognitoBanner } from "@/components/ocade/chat/IncognitoBanner";
import { ShortcutsDialog } from "@/components/ocade/chat/ShortcutsDialog";
import {
  OcadeContextualSidebar,
  type ConversationListView,
} from "@/components/ocade/chat/ChatContextualSidebar";
import { HomeSurface } from "@/components/ocade/chat/ChatHomeSurface";
import { Composer } from "@/components/ocade/chat/ChatComposer";
import {
  DeleteAllDialog,
  DeleteDialog,
  RenameDialog,
  ShareDialog,
} from "@/components/ocade/chat/ConversationDialogs";

/**
 * One ledger per tab. Routing prefers the fastest MEASURED model, so
 * measurements must outlive a single send — but not the session, because a
 * machine's speed changes with whatever else is running on it.
 */
const localPerfLedger = new PerfLedger();
import {
  classifyFile,
  isNativeTextKind,
  extractDocument,
  extractBinaryDocument,
  clampForContext,
  DOCUMENT_RETAIN_MAX_CHARS,
  type ExtractResult,
} from "@/lib/ocade-documents";
import { isDecodableBinary } from "@/lib/ocade-decoders";
import { scanUntrustedContent, describeScan } from "@/lib/ocade-injection-guard";
import {
  buildSourceIndex,
  parseCitations,
  stripCitationMarkers,
  describeLocator,
  safeCitationHref,
  type IndexedSource,
  type Citation,
} from "@/lib/ocade-citations";
import { buildDocumentContext } from "@/lib/retrieval/document-context";
import { CopilotMount } from "@/components/ocade/CopilotPanel";
import { VisualResponse } from "@/components/ocade/VisualResponse";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import { saveDraft, recoverDraft, clearDraft } from "@/lib/offline-queue";
import { useStreamCoalescer } from "@/lib/chat/stream-coalescer";
import { LivingIntelligenceBackdrop } from "@/components/visual/LivingIntelligenceBackdrop";
import {
  branchConversation,
  forkConversationBeforeMessage,
  listProjectFiles,
  listProjects,
  readMemory,
  saveProjectFile,
  type OcadeProject,
  type OcadeProjectFile,
} from "@/lib/ocade-projects.functions";
import { persistChatMessage, loadChatMessages, describeStorageError } from "@/lib/ocade-chat-store";
import { forgetAllUnsyncedTurns, forgetConversationTurns } from "@/lib/chat/unsynced-turns";
import { globalMultimodalRegistry } from "@/lib/providers/multimodal-registry";
import { assertStreamWithinLimit } from "@/lib/stream-limits";
import {
  detectVoiceCapabilities,
  registerSystemVoice,
  toVoiceOptions,
  pickVoice,
  resolveVoiceLanguage,
  captionSentenceAt,
  matchesWakePhrase,
  buildGreeting,
  type VoiceGender,
} from "@/lib/ocade-voice";
import { redactForSpeech, redactSpokenSecrets } from "@/lib/voice/transcript-redaction";
import { describeRecognitionError, useDictation } from "@/lib/voice/use-dictation";
import { useVoicePrefs } from "@/lib/use-voice-prefs";
import { saveChatOutput } from "@/lib/artifacts/chat-output-flow";
import { buildContextTray, type ContextEntry } from "@/lib/chat/context-tray";
import { ContextTray } from "@/components/ocade/chat/ContextTray";
import { memoryContextFrom } from "@/lib/memory/portable";
import { classifyFreshness } from "@/lib/research/freshness-classifier";
import { retrieveCurrentInformation } from "@/lib/research.functions";
import type { CurrentInformationPacket } from "@/lib/research/current-information";
import { useFormatters } from "@/lib/locale/use-formatters";

export const Route = createFileRoute("/_authenticated/ocade/")({
  head: () => ({
    meta: [{ title: "OCADE — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  /*
   * `?conversation=<id>` so a search result can open the conversation it
   * actually matched rather than dropping the reader at the top of Chat and
   * leaving them to find it. Validated rather than trusted: anything that is
   * not a string becomes undefined, so a hand-edited URL cannot push a
   * non-string into the id state.
   */
  validateSearch: (raw: Record<string, unknown>): { conversation?: string } => ({
    conversation: typeof raw.conversation === "string" ? raw.conversation : undefined,
  }),
  component: OcadePage,
});

/* ---------- Root ---------- */

function OcadePage() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <>
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }
  if (!user) {
    /*
     * A DEAD END IS NOT A STATE, IT IS A DEFECT.
     *
     * This used to be the sentence alone, with no control of any kind: the
     * reader was told they had to sign in and given nothing to press. The
     * `_authenticated` guard normally redirects before anyone arrives here, so
     * it went unnoticed — but a guard that has not resolved yet, a session that
     * expires while the page is open, or a direct mount all land on it, and
     * every one of those leaves the person stuck on the product's main screen.
     */
    return (
      <>
        <div className="mx-auto mt-10 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">You need to be signed in to use OCADE.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/auth"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Sign in
            </Link>
            <Link
              to="/"
              className="rounded-md border border-border/60 px-3 py-1.5 text-sm text-foreground transition hover:bg-accent/30"
            >
              Back to home
            </Link>
          </div>
        </div>
      </>
    );
  }
  return <OcadeWorkspace userId={user.id} userLabel={user.email?.split("@")[0] ?? "there"} />;
}

/* ---------- Workspace ---------- */

function OcadeWorkspace({ userId, userLabel }: { userId: string; userLabel: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  /*
   * Seeded from `?conversation=`, so a deep link from Search opens that
   * conversation. `useState`'s initialiser rather than an effect: setting it
   * afterwards would render the empty state first and flash.
   */
  const requestedConversation = Route.useSearch().conversation;
  const [activeId, setActiveId] = useState<string | null>(requestedConversation ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [listView, setListView] = useState<ConversationListView>("active");
  /*
   * The trash is a SEPARATE READ, not a filter over the sidebar list.
   *
   * `listConversations` excludes trashed rows on the server, so the two lists
   * never disagree about what is in which — and the trash is small and looked
   * at rarely, so fetching it only when somebody opens it costs nothing the
   * rest of the time.
   */
  const [trashed, setTrashed] = useState<Conversation[]>([]);
  const [trashDays, setTrashDays] = useState(30);
  const [search, setSearch] = useState("");
  const [model, setModel] = useState<string>(OCADE_DEFAULT_MODEL_ID);
  /*
   * Whether the NEXT conversation is incognito — PLAN.md §8.
   *
   * A property of the conversation once started, so this is only the setting
   * for what comes next; switching it does not retroactively unwrite anything,
   * and a conversation cannot change its mind halfway through. Both of those
   * would be worse than the restriction.
   */
  const [nextIsIncognito, setNextIsIncognito] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [permission, setPermission] = useState<PermissionMode>("manual");
  const [pendingMessage, setPendingMessage] = useState<PendingChatMessage | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  /**
   * The conversation whose Share dialog is open — PLAN.md §8.
   *
   * Opening the dialog PUBLISHES NOTHING. It reads whether a live link already
   * exists and shows it; taking a snapshot is a separate, named action. A
   * control that shared a conversation as a side effect of somebody checking
   * whether it was shared would be the worst possible reading of "Share".
   */
  const [shareTarget, setShareTarget] = useState<Conversation | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);

  /**
   * The account's conversations, from the one place they live.
   *
   * This used to read an encrypted device vault first and merge the server's
   * answer into it. `PLAN.md` Phase 2 leaves one persistent authority, so
   * there is nothing to merge: the row in `ocade_conversations` is the
   * conversation, on this device and on every other one.
   */
  const refreshList = useCallback(async () => {
    /*
     * KEEP THE INCOGNITO ONES — PLAN.md §8.
     *
     * Nothing about an incognito conversation is written, so it is in no list
     * this function reads, and replacing the state outright would make an open
     * one VANISH mid-sentence on the next refresh. They live in this state and
     * nowhere else, so this is the one place that has to remember them, and the
     * ordering below keeps them where they were: newest first, above the rest.
     */
    try {
      const stored = ((await listConversations()) as unknown as Conversation[]) ?? [];
      setConversations((current) => [...current.filter((c) => c.incognito), ...stored]);
    } catch (e) {
      /*
       * UNREACHABLE IS NOT EMPTY, and the list is deliberately not cleared.
       * "Your chats are gone" and "this device cannot reach your account right
       * now" are different claims and only one of them is true. Silent because
       * this runs from an effect on mount rather than from anything the user
       * did; the paths that toast are the ones where somebody asked for
       * something and did not get it.
       */
      void e;
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  /*
   * A boolean rather than the whole list, because this effect must not re-run
   * on every refresh: re-reading a conversation's messages whenever the sidebar
   * changed would reload the transcript underneath somebody mid-sentence.
   */
  const activeIsIncognito = useMemo(
    () => Boolean(conversations.find((c) => c.id === activeId)?.incognito),
    [conversations, activeId],
  );

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    /*
     * AN INCOGNITO CONVERSATION HAS NOWHERE TO BE READ FROM — PLAN.md §8.
     *
     * Its messages are in this component's state and in no vault, so asking
     * storage for them would return an empty list and wipe the transcript the
     * person is in the middle of. The state IS the conversation.
     */
    if (activeIsIncognito) {
      setLoadingMessages(false);
      return;
    }
    setLoadingMessages(true);
    void loadChatMessages({ conversationId: activeId })
      .then((rows) => setMessages(rows as unknown as Message[]))
      .catch((e) => {
        toast.error(describeStorageError(e));
        setMessages([]);
      })
      .finally(() => setLoadingMessages(false));
  }, [activeId, activeIsIncognito]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  useEffect(() => {
    if (active?.model_id) setModel(active.model_id);
  }, [active?.id, active?.model_id]);

  async function handleNew() {
    setPendingMessage(null);
    setActiveId(null);
  }

  /*
   * Keyboard shortcuts.
   *
   * What each one may do is decided by `matchChatShortcut`, which is where the
   * two rules that matter live: never fire on a bare letter while somebody is
   * writing, and never take a combination the browser owns. This listener only
   * carries out the decision.
   *
   * Focus moves by id rather than through a ref chain because the two targets
   * live in different subtrees — the search box is inside the shared sidebar
   * and the message box inside the composer — and threading refs through both
   * for two shortcuts would be more fragile than the query.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = matchChatShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: event.target as { tagName?: string; isContentEditable?: boolean } | null,
      });
      // Escape belongs to whatever is streaming, and to any open dialog. It is
      // deliberately not handled here.
      if (!action || action === "stop") return;

      event.preventDefault();
      switch (action) {
        case "new_chat":
          void handleNew();
          break;
        case "search": {
          setSidebarHidden(false);
          const field = document.getElementById("ocade-chat-search");
          if (field instanceof HTMLInputElement) {
            field.focus();
            field.select();
          }
          break;
        }
        case "focus_composer": {
          const box = document.getElementById("ocade-chat-composer");
          if (box instanceof HTMLTextAreaElement) box.focus();
          break;
        }
        case "toggle_sidebar":
          setSidebarHidden((hidden) => !hidden);
          break;
        case "show_help":
          setShortcutsOpen(true);
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /**
   * Start a conversation.
   *
   * THE ID IS CHOSEN HERE, and the row is created with it. Letting Postgres
   * generate the id meant a new chat could not exist until a round trip
   * succeeded, so the composer threw on a slow connection; choosing it on the
   * device means the transcript can render immediately and the row that
   * arrives carries the same id rather than a second one.
   *
   * The row is still awaited, because `ocade_messages` belongs to
   * `ocade_conversations` and the append refuses an unknown parent. A
   * conversation whose first two messages 404 while the screen shows them is
   * the failure this ordering prevents.
   */
  async function ensureActive(): Promise<Conversation> {
    if (active) return active;

    /*
     * AN INCOGNITO CONVERSATION IS NOT CREATED ANYWHERE — PLAN.md §8.
     *
     * `createConversation` writes a row. A conversation row is a record of the
     * conversation
     * having happened, which is precisely what this must not leave behind, so
     * the object is built here and lives only in React state.
     *
     * Its id is still a real time-ordered id: nothing downstream should have
     * to care which kind of conversation it is holding, and the one place that
     * does — `persistChatMessage` — is told explicitly.
     */
    if (nextIsIncognito) {
      const now = new Date().toISOString();
      const conv: Conversation = {
        id: newConversationId(),
        title: INCOGNITO_TITLE,
        pinned: false,
        archived: false,
        model_id: model,
        updated_at: now,
        incognito: true,
      };
      setConversations((prev) => [conv, ...prev]);
      setLoadingMessages(false);
      setActiveId(conv.id);
      return conv;
    }

    const id = newConversationId();
    const now = new Date().toISOString();
    const conv: Conversation = {
      id,
      title: "New chat",
      pinned: false,
      archived: false,
      model_id: model,
      updated_at: now,
    };
    await createConversation({ data: { id, title: conv.title, modelId: model ?? undefined } });

    setConversations((prev) => [conv, ...prev]);
    setLoadingMessages(true);
    setActiveId(conv.id);
    return conv;
  }

  /*
   * Pin, archive and rename change the row and then re-read the list.
   *
   * THE FAILURE IS SHOWN. These used to write to the device, refresh from it,
   * and fire the server call with `.catch(() => {})` — so a rename that the
   * server rejected left the new title on screen and the old one in the
   * account, and nothing said so. With one authority there is nothing to show
   * until the write lands, and a write that does not land is something the
   * person needs to know about.
   */
  async function togglePin(c: Conversation) {
    try {
      await updateConversation({ data: { id: c.id, pinned: !c.pinned } });
      await refreshList();
    } catch (e) {
      toast.error(describeStorageError(e));
    }
  }
  /**
   * Read the trash, and how long its contents have left.
   *
   * Called when the trash is opened and after anything that changes it. The
   * server sweeps whatever is past the undo period before answering, so a row
   * never appears here with a negative number of days on it.
   */
  const refreshTrash = useCallback(async () => {
    try {
      const [rows, days] = await Promise.all([
        listTrashedConversations() as unknown as Promise<Conversation[]>,
        conversationTrashDays(),
      ]);
      setTrashed(rows ?? []);
      setTrashDays(Number(days) || 30);
    } catch (e) {
      // Same reasoning as `refreshList`: unreachable is not empty. Showing an
      // empty trash to somebody whose account cannot be reached would tell them
      // their conversations are already gone.
      void e;
    }
  }, []);

  useEffect(() => {
    if (listView === "trash") void refreshTrash();
  }, [listView, refreshTrash]);

  /**
   * Move a conversation to the trash.
   *
   * NO CONFIRMATION, deliberately. It is undoable for `trashDays`, and a dialog
   * in front of an undoable act is what trains somebody to click through the
   * one that is not. The toast says where it went and offers the way back.
   *
   * AN INCOGNITO CONVERSATION HAS NOTHING TO TRASH. It was never written, so it
   * is dropped from this component's state the way closing it does — writing a
   * `deleted_at` would mean creating the row in order to mark it deleted.
   */
  async function trashConversation(c: Conversation) {
    if (c.incognito) {
      setConversations((current) => current.filter((row) => row.id !== c.id));
      if (c.id === activeId) setActiveId(null);
      toast.success("Closed. There was nothing stored to delete.");
      return;
    }
    try {
      await setConversationTrashed({ data: { id: c.id, trashed: true } });
    } catch (e) {
      toast.error(describeStorageError(e));
      return;
    }
    forgetConversationTurns(c.id);
    if (c.id === activeId) setActiveId(null);
    await refreshList();
    if (listView === "trash") await refreshTrash();
    toast.success(`Moved to trash. It stays restorable for ${trashDays} days.`, {
      action: {
        label: "Undo",
        onClick: () => {
          void restoreConversation(c);
        },
      },
    });
  }

  /** Take a conversation back out of the trash, into the state it was left in. */
  async function restoreConversation(c: Conversation) {
    try {
      await setConversationTrashed({ data: { id: c.id, trashed: false } });
    } catch (e) {
      toast.error(describeStorageError(e));
      return;
    }
    await Promise.all([refreshList(), refreshTrash()]);
    toast.success("Restored.");
  }

  async function toggleArchive(c: Conversation) {
    try {
      await updateConversation({ data: { id: c.id, archived: !c.archived } });
      if (c.id === activeId && !c.archived) setActiveId(null);
      await refreshList();
    } catch (e) {
      toast.error(describeStorageError(e));
    }
  }
  async function handleRenameSubmit(newTitle: string) {
    if (!renameTarget) return;
    const id = renameTarget.id;
    try {
      await updateConversation({ data: { id, title: newTitle } });
      setRenameTarget(null);
      await refreshList();
    } catch (e) {
      toast.error(describeStorageError(e));
    }
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;

    /*
     * AN INCOGNITO CONVERSATION HAS NOTHING TO DELETE — PLAN.md §8.
     *
     * Dropped from this component's state, which is the only place it exists.
     * Running the ordinary path would write a TOMBSTONE for a conversation
     * that was never recorded — a durable row saying "this conversation was
     * deleted", which is a record of it having happened and precisely what the
     * mode exists to avoid.
     */
    if (target.incognito) {
      setConversations((current) => current.filter((c) => c.id !== target.id));
      if (target.id === activeId) setActiveId(null);
      setDeleteTarget(null);
      toast.success("Closed. There was nothing stored to delete.");
      return;
    }

    /*
     * ONE DELETE, AND IT EITHER HAPPENED OR IT DID NOT.
     *
     * This used to write a tombstone to the device, fire the server call
     * without waiting, and then sweep the message bodies out of the local
     * vault — three writes to keep in step, and a success message that was
     * shown before any of them was confirmed. With one authority the row and
     * its messages go together, and the person is told the truth about it.
     */
    try {
      await deleteConversation({ data: { id: target.id } });
    } catch (e) {
      toast.error(describeStorageError(e));
      return;
    }

    /*
     * Anything of this conversation still waiting in the tab goes with it.
     * A queued upload into a conversation that no longer exists would fail
     * forever and hold the unsynchronised warning open with nothing behind it.
     */
    forgetConversationTurns(target.id);

    if (target.id === activeId) setActiveId(null);
    setDeleteTarget(null);
    // Both lists, because a permanent delete is reached from the trash and the
    // row has to leave the list it was deleted from as well as the sidebar.
    await Promise.all([refreshList(), refreshTrash()]);

    /*
     * The citations go with the messages, and the messages go with the
     * conversation, through the foreign keys. Citation evidence used to be a
     * separate browser store that had to be swept here, and the sweep is what
     * failed: a deleted conversation could leave verbatim excerpts of somebody
     * else's documents behind, keyed to messages that no longer existed.
     */
    toast.success("Conversation deleted");
  }

  /**
   * DELETE EVERY CONVERSATION — PLAN.md §8's "delete-all".
   *
   * ONE WRITE, AND IT IS AWAITED. The account's rows go, and with them every
   * message that hung off them. This used to clear a device vault first and
   * fire the server call without waiting, which meant "deleted from this
   * device and every other one you sign in on" was printed before the second
   * half had been attempted.
   *
   * INCOGNITO CONVERSATIONS ARE DROPPED FROM STATE, NOT DELETED. They were
   * never written, so there is nothing to delete, and writing anything now
   * would create the durable record that mode exists to avoid.
   *
   * WHAT THIS DOES NOT TOUCH, and it matters enough to say in the dialog:
   * Offline Intelligence, memory, and projects are separate authorities with
   * their own controls. Clearing a chat history that silently removed a
   * multi-gigabyte model would be unforgivable.
   */
  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      const removed = (await deleteAllConversations()) as unknown as
        { deleted?: number } | number | null;
      const count = typeof removed === "number" ? removed : (removed?.deleted ?? 0);

      forgetAllUnsyncedTurns();
      setConversations([]);
      setActiveId(null);
      setMessages([]);
      setDeleteAllOpen(false);
      toast.success(
        count === 0
          ? "There was nothing to delete."
          : `Deleted ${count} ${count === 1 ? "conversation" : "conversations"} from every device you sign in on.`,
      );
      await refreshList();
    } catch (e) {
      toast.error(describeStorageError(e));
    } finally {
      setDeletingAll(false);
    }
  }

  async function handleExport(c: Conversation) {
    /*
     * Export reads the SERVER's copy, and an incognito conversation has none.
     * Said rather than downloaded: a file containing nothing, named after the
     * conversation, is a worse answer than a sentence — and writing the
     * transcript out of React state would be OCADE creating the durable copy
     * this mode promised not to.
     */
    if (c.incognito) {
      toast.info("An incognito conversation cannot be exported.", {
        description: "Nothing from it is stored, so there is nothing to put in a file.",
      });
      return;
    }
    const bundle = await exportConversation({ data: { conversationId: c.id } });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.title.replace(/[^a-z0-9-]+/gi, "_")}_ocade.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pinned = useMemo(
    () => conversations.filter((c) => c.pinned && !c.archived),
    [conversations],
  );
  const recent = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => (listView === "archived" ? c.archived : !c.archived && !c.pinned))
      .filter((c) => (q ? c.title.toLowerCase().includes(q) : true));
  }, [conversations, search, listView]);

  return (
    <>
      {/* Offer the Desktop Copilot in the shell's adaptive right-hand panel. */}
      <CopilotMount />
      {/* Break out of centered workspace column and take the full height under the top bar. */}
      <div className="-mx-5 -my-6 flex h-[calc(100vh-2.75rem)] min-h-0 sm:-mx-8">
        {/* Contextual OCADE sidebar. Hidden on request (Ctrl+Shift+S) so a
            narrow screen or a long transcript can have the full width. */}
        {sidebarHidden ? null : (
          <OcadeContextualSidebar
            onNew={handleNew}
            search={search}
            setSearch={setSearch}
            view={listView}
            setView={setListView}
            pinned={pinned}
            recent={recent}
            trashed={trashed}
            trashDays={trashDays}
            loading={loadingList}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
            }}
            onPin={togglePin}
            onArchive={toggleArchive}
            onRename={(c) => setRenameTarget(c)}
            onTrash={(c) => void trashConversation(c)}
            onRestore={(c) => void restoreConversation(c)}
            onDelete={(c) => setDeleteTarget(c)}
            onExport={handleExport}
            onShare={(c) => setShareTarget(c)}
            onDeleteAll={() => setDeleteAllOpen(true)}
            onShowShortcuts={() => setShortcutsOpen(true)}
          />
        )}

        {/* Main workspace canvas */}
        <div className="flex min-h-0 flex-1 flex-col">
          {active?.incognito ? <IncognitoBanner /> : null}
          {active ? (
            <ChatSurface
              key={active.id}
              conversation={active}
              messages={messages}
              setMessages={setMessages}
              loading={loadingMessages}
              model={model}
              setModel={async (m) => {
                setModel(m);
                await updateConversation({ data: { id: active.id, modelId: m } });
                await refreshList();
              }}
              permission={permission}
              setPermission={setPermission}
              onRefreshList={refreshList}
              userLabel={userLabel}
              userId={userId}
              ensureActive={ensureActive}
              initialMessage={pendingMessage?.conversationId === active.id ? pendingMessage : null}
              onInitialMessageHandled={(id) =>
                setPendingMessage((current) => (current?.id === id ? null : current))
              }
              onOpenConversation={(id) => {
                setActiveId(id);
              }}
            />
          ) : (
            <HomeSurface
              userLabel={userLabel}
              model={model}
              setModel={setModel}
              permission={permission}
              setPermission={setPermission}
              incognito={nextIsIncognito}
              setIncognito={setNextIsIncognito}
              onSubmit={async (text, atts) => {
                const conv = await ensureActive();
                setPendingMessage({
                  id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  conversationId: conv.id,
                  text,
                  attachments: atts,
                });
                setActiveId(conv.id);
              }}
            />
          )}
        </div>
      </div>

      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
      />
      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <DeleteAllDialog
        open={deleteAllOpen}
        busy={deletingAll}
        count={conversations.filter((c) => !c.incognito).length}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={() => void handleDeleteAll()}
      />
      <ShareDialog
        conversation={shareTarget}
        /*
          Known only for the conversation currently open, and that is honest:
          the dialog says "N messages since you shared" when it can count them
          and says nothing about it when it cannot, rather than guessing.
        */
        currentMessageCount={shareTarget && shareTarget.id === activeId ? messages.length : null}
        onClose={() => setShareTarget(null)}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}

/* ---------- Chat Surface (open conversation) ---------- */

function ChatSurface(props: {
  conversation: Conversation;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  loading: boolean;
  model: string;
  setModel: (m: string) => void;
  permission: PermissionMode;
  setPermission: (p: PermissionMode) => void;
  onRefreshList: () => Promise<void>;
  userLabel: string;
  userId: string;
  ensureActive: () => Promise<Conversation>;
  initialMessage: PendingChatMessage | null;
  onInitialMessageHandled: (id: string) => void;
  onOpenConversation: (id: string) => void;
}) {
  const formatters = useFormatters();
  const {
    conversation,
    messages,
    setMessages,
    loading,
    model,
    setModel,
    permission,
    setPermission,
    onRefreshList,
    userId,
    initialMessage,
    onInitialMessageHandled,
    onOpenConversation,
  } = props;
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  /*
   * TOOLS IN CHAT.
   *
   * Chat could describe how to open a file and could not open one; Cowork could
   * open one and could not hold a conversation about it. The runtime below is
   * the same engine, registry, permission layer and loop Cowork runs, so a
   * request that needs an action gets one here — and a request that does not
   * never loads a tool schema, so ordinary chat is exactly as fast as it was.
   */
  const [toolApproval, setToolApproval] = useState<RuntimeApproval | null>(null);
  const toolApprovalResolve = useRef<((allowed: boolean) => void) | null>(null);
  const [toolSteps, setToolSteps] = useState<string[]>([]);
  const [streamText, setStreamTextState] = useState("");
  /*
   * Streaming used to call setState for every chunk. Both stream paths hand
   * over the WHOLE text so far, so coalescing to one paint per frame cannot
   * lose or reorder a token — see `stream-coalescer` for why, and note that
   * every terminal path below (done, error, cancel) uses `setStreamText`,
   * which flushes synchronously.
   */
  const streamPaint = useStreamCoalescer<string>(setStreamTextState);
  const pushStreamText = streamPaint.push;
  const setStreamText = streamPaint.setNow;
  const [improving, setImproving] = useState(false);
  const [listening, setListening] = useState(false);
  // Event handlers can run before React commits the next render. This ref is
  // the immediate authority, so a short press cannot strand the microphone on.
  const listeningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * FEEDBACK IS SAVED ON THE ANSWER IT IS ABOUT.
   *
   * It used to be a per-browser map keyed by user and conversation, which meant
   * marking a reply unhelpful on a laptop left it unmarked on a phone, and
   * clearing the browser lost it. The message row carries it now, so the
   * optimistic update below is corrected by the next load rather than being the
   * only record.
   *
   * Pressing the active choice again clears it — that is how somebody takes
   * back feedback they gave by accident.
   */
  const reactToMessage = useCallback(
    (messageId: string, reaction: ChatReaction) => {
      const current = messages.find((message) => message.id === messageId)?.reaction ?? null;
      const next = current === reaction ? null : reaction;
      setMessages((rows) =>
        rows.map((row) => (row.id === messageId ? { ...row, reaction: next } : row)),
      );
      void setMessageReaction({ data: { messageId, reaction: next } }).catch(() => {
        // Put it back rather than showing feedback that was not recorded.
        setMessages((rows) =>
          rows.map((row) => (row.id === messageId ? { ...row, reaction: current } : row)),
        );
        toast.error("That feedback could not be saved.", {
          description: "OCADE could not reach your account, so nothing was recorded.",
        });
      });
    },
    [messages, setMessages],
  );
  /**
   * Models already asked to load in this session. Typing fires on EVERY
   * keystroke; without this the runtime would receive a load request per
   * character, which is a denial of service aimed at the user's own machine.
   */
  const warmedRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<unknown>(null);
  const modelInfo = getOcadeModel(model);
  const online = useOnline();
  const localEngine = useLocalEngine();
  /*
   * Measured device facts for engine selection. Routing on the browser's own
   * memory hint alone picked a model that needed three minutes for a one-word
   * answer on this hardware, and excluded an installed vision model that works.
   */
  const devicePolicy = useDevicePolicy();
  const { prefs: chatPrefs, update: setChatPrefs } = useChatPrefs();
  /** A local engine that is genuinely serving, not merely installed. */
  const localEngineReady = localEngine.status === "ready" && localEngine.models.length > 0;
  const navigate = useNavigate();
  /** Engine selection and honest refusals across every device mode. */
  const brain = useBrain();

  /**
   * The shared runtime, in its chat configuration.
   *
   * `onApprovalNeeded` is supplied, so the permission layer can ask. Without it
   * the runtime refuses everything it wanted to check rather than allowing it —
   * a surface that forgets its approval UI fails closed.
   *
   * `missionId` returns null here on purpose. Chat holds no companion session,
   * so a call that needs the machine is refused with a sentence pointing at
   * Devices rather than half-executed. Web, research and continuity tools need
   * no companion and work in a plain browser tab.
   */
  const runtime = useOcadeRuntime({
    surface: "chat",
    missionId: () => null,
    intelligenceMode: () => (engineTier === "local" ? "local_only" : "automatic"),
    /*
     * CONSENT FOLLOWS THE MODE THE PERSON CHOSE, not a storage setting.
     *
     * This read `chatsMode === "private_sync"`, which meant the answer to "may
     * this request leave the device?" was derived from where chats were kept.
     * `PLAN.md` Phase 2 leaves one place, so the question is now what it always
     * should have been: Local Intelligence never goes out, and a sealed
     * conversation never goes out.
     */
    intelligencePrivacy: () => ({
      onlineInferenceConsented: engineTier !== "local" && !sealed,
      sealed,
    }),
    /*
     * PLAN.md §8: an incognito conversation teaches OCADE nothing. Read at the
     * moment of learning rather than at mount, because the conversation this
     * surface is showing can change without the runtime remounting.
     */
    incognito: () => Boolean(conversation.incognito),
    memoryContext: () => {
      /*
       * NEITHER WRITTEN NOR READ, for an incognito conversation.
       *
       * §8 asks for exclusion from memory, and only excluding the WRITE would
       * be the weaker half: somebody who goes incognito is saying "do not
       * connect this to me", and a reply shaped by what OCADE remembers about
       * them connects it. Both directions, or the word means less than the
       * person reading it thinks.
       */
      if (conversation.incognito) return null;

      // Scoped to the project this conversation belongs to, exactly as the
      // ordinary chat path scopes it. Memory that is off, empty or unreadable
      // returns null, and the prompt is then what it was before.
      return readMemoryContext(conversation.project_id ?? null);
    },
    onApprovalNeeded: (approval) =>
      new Promise<boolean>((resolve) => {
        toolApprovalResolve.current = resolve;
        setToolApproval(approval);
      }),
    onEvent: (event) => {
      if (event.kind === "started") {
        setToolSteps((current) => [...current, `Working — ${event.call.name.replace(/_/g, " ")}`]);
      }
      if (event.kind === "finished") {
        setToolSteps((current) => [...current.slice(0, -1), describeOutcome(event.outcome)]);
      }
      if (event.kind === "refused") {
        setToolSteps((current) => [...current.slice(0, -1), event.reason]);
      }
      if (event.kind === "compacted") {
        // Said out loud rather than hidden: the person is watching a long run,
        // and a silent context drop is how a later answer stops making sense
        // without anybody knowing why.
        setToolSteps((current) => [...current, "Condensing earlier context…"]);
      }
    },
  });
  /*
   * The user's chosen starting engine, from Settings › Chat. Read once as the
   * initial value so switching engine inside a conversation is not overwritten
   * on every render — the preference decides where a chat BEGINS, not where it
   * must stay.
   */
  /*
   * "Cloud" was the third member of this and it is gone with the engine that
   * served it. What is left is a real distinction and not a vestige: a user
   * who never opened the setting reads "Automatic", a user who deliberately
   * chose on-device reads it back. Collapsing an explicit privacy choice into
   * a default because the code no longer needs it is how a settings screen
   * stops being believed.
   */
  const [engineTier, setEngineTier] = useState<"auto" | "local">(() =>
    readChatPrefs().defaultEngineTier === "local" ? "local" : "auto",
  );
  // Sources attached to the in-flight request, so the reply's [S1] markers can
  // be resolved back to real documents (never to an invented id).
  const sourceIndexRef = useRef<IndexedSource[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [citationError, setCitationError] = useState<string | null>(null);
  /**
   * What retrieval did to the attachments on the last request, in one sentence.
   *
   * Shown rather than logged. The whole point of searching a document instead
   * of reading it is that OCADE answers from part of the file, and a user who
   * is not told that will read the answer as covering the whole of it.
   */
  const [retrievalNotice, setRetrievalNotice] = useState<string | null>(null);
  /**
   * Provenance receipts, keyed by the assistant message they describe.
   *
   * Held in component state rather than persisted: a receipt describes one
   * generation on one device, and restoring it from a database on a different
   * machine would present a claim nothing here measured.
   */
  /*
   * PLAN.md §8's side conversations, keyed by the message each hangs off.
   *
   * Loaded once per conversation rather than per message: a transcript with
   * forty turns would otherwise scan the same store forty times on every open.
   */
  const [sideThreads, setSideThreads] = useState<Map<string, SideMessage[]>>(new Map());
  const [openAside, setOpenAside] = useState<string | null>(null);
  const [asideBusy, setAsideBusy] = useState<string | null>(null);
  /*
   * The answer as it arrives. Kept out of `sideThreads` deliberately: a partial
   * answer is not a turn, and writing one into the thread would leave a
   * half-sentence behind if the tab were closed mid-stream.
   */
  const [asideStream, setAsideStream] = useState("");
  const [receipts, setReceipts] = useState<Record<string, AnswerReceipt>>({});

  /**
   * ASK IT AGAIN, AND KEEP WHAT YOU HAD.
   *
   * A mainstream assistant's "regenerate" overwrites the answer, so the thing
   * you would compare against is destroyed by the act of comparing. Here the
   * original stays and the repeat is shown beside it.
   *
   * The comparison is only meaningful because both runs name the same engine
   * file and the same sampler settings. `pinRun` records those conditions when
   * the answer is first produced; `compareRuns` reports the conditions BEFORE
   * the difference, because a different answer under changed conditions is not
   * a surprise and must not be presented as one.
   *
   * Local answers only. An online provider's weights change without notice, so
   * a repeat there compares two unknowns and any difference is uninterpretable
   * — there is no `onRerun` on those rows at all, rather than a button that
   * produces a meaningless verdict.
   */
  const [runPins, setRunPins] = useState<Record<string, PinnedRun>>({});
  const [reruns, setReruns] = useState<Record<string, { answer: string; verdict: RepeatVerdict }>>(
    {},
  );
  /**
   * Exactly what was sent, so a repeat replays it rather than reassembling it.
   *
   * Reassembling history would quietly change the input — a document that has
   * since been detached, a freshness line with a newer timestamp — and the
   * comparison would then be measuring OCADE's context builder rather than the
   * engine. Held in a ref because replaying is not a render input.
   */
  const replayRef = useRef<
    Record<
      string,
      {
        messages: LocalChatMessage[];
        modelId: string;
        task: "general" | "vision";
        prompt: string;
        engineLabel: string;
        adapterId: string;
        temperature: number;
        topP: number;
      }
    >
  >({});

  /**
   * Sealed mode for this conversation.
   *
   * The demo got this first because it was the easier surface to prove it on.
   * This is the one where it matters: real documents, real privacy modes, and
   * a user who may be pasting something they genuinely cannot afford to have
   * leave the machine.
   *
   * Off by default and per conversation, not global — sealing every chat would
   * break the ones that legitimately need the network, and a guarantee people
   * have to keep switching off is a guarantee they stop trusting.
   */
  const [sealed, setSealed] = useState(false);
  /**
   * SEALING A COLD ENGINE WOULD BE A TRAP.
   *
   * The seal stops anything leaving the device — including the model download
   * OCADE needs before it can answer at all. Sealed before the engine has ever
   * completed an answer, the conversation cannot be answered AND cannot fetch
   * what it would take to answer it, and the only way out is a control the
   * person has just been told is protecting them.
   *
   * One completed local answer proves the engine is present, so the seal is
   * offered from that point on. Unsealing is never blocked.
   */
  const canStartSeal =
    localEngineReady ||
    messages.some((message) => message.role === "assistant" && message.content.trim().length > 0);

  /**
   * Hold the seal for as long as the control says it is held.
   *
   * The send path below installs its own strict seal around `generate()`. That
   * covers the moment an answer is produced and nothing else, which is far less
   * than "Sealed: nothing may leave this device" claims. Overlapping seals
   * intersect, so this conversation-long barrier does not loosen the send-time
   * one — it only closes the gap between sends.
   *
   * See `edge/seal-policy.ts` for why assets and loopback are the two
   * exceptions, and why allowing them is what makes a persistent seal possible
   * at all.
   */
  useEffect(
    () =>
      installConversationSeal(
        sealed,
        (allow) => new Seal(undefined, allow),
        typeof window === "undefined" ? undefined : window.location.origin,
      ),
    [sealed],
  );

  /**
   * The tamper-evident record of this conversation, and its branch history.
   *
   * Refs because they are appended from inside async callbacks; `ledgerVersion`
   * is what tells the integrity panel to re-verify, since a ref change alone
   * does not re-render and a stale "intact" is the worst thing to be
   * confidently wrong about.
   */
  const ledgerRef = useRef<LedgerEntry[]>([]);
  const treeRef = useRef<Tree>(emptyTree());
  const [ledgerVersion, setLedgerVersion] = useState(0);

  /**
   * What this conversation has actually cost.
   *
   * This is measured on-device electricity and duration, not a payment meter.
   */
  const [costs, setCosts] = useState<RunCost[]>([]);

  /*
   * The chain describes ONE conversation. Switching to another must not leave
   * the panel verifying the previous one and reporting it intact — the same
   * defect the demo had across three separate reset paths.
   */
  useEffect(() => {
    ledgerRef.current = [];
    treeRef.current = emptyTree();
    setLedgerVersion((v) => v + 1);
    setReceipts({});
    // A pin and its comparison describe ONE conversation's runs. Carrying them
    // across would offer a repeat of an answer that is no longer on screen.
    setRunPins({});
    setReruns({});
    replayRef.current = {};
    // The tally describes THIS conversation's runs. Carrying it across would
    // attribute one conversation's electricity to another.
    setCosts([]);
  }, [conversation.id]);

  /*
   * SIDE THREADS ARE READ WHEN THE CONVERSATION OPENS — PLAN.md §8.
   *
   * One pass over the data class for the whole conversation, not one per
   * message: a forty-turn transcript would otherwise scan the same store forty
   * times on every open. An incognito conversation is skipped entirely, because
   * nothing of it was written down and asking storage would return an empty map
   * anyway — the state IS the conversation.
   *
   * The `cancelled` flag matters: switching conversations quickly would
   * otherwise let a slow read from the PREVIOUS one land and show its side
   * threads against this one's messages.
   */
  useEffect(() => {
    setSideThreads(new Map());
    setOpenAside(null);
    setAsideStream("");
  }, [conversation.id]);

  /*
   * A THREAD IS READ WHEN SOMEBODY OPENS IT, not when the conversation opens.
   *
   * This used to read every side thread of the conversation up front, because
   * the vault it read from had no way to find one without scanning all of
   * them. A conversation with forty messages therefore paid a full scan on
   * open for threads nobody had asked to see. The database has an index on the
   * anchor, so the question can be the one actually being asked.
   *
   * The `cancelled` flag matters: opening two panels quickly would otherwise
   * let a slow read from the first land against the second.
   */
  useEffect(() => {
    if (!openAside || conversation.incognito) return;
    let cancelled = false;
    void loadSideThread({ conversationId: conversation.id, anchorMessageId: openAside })
      .then((thread) => {
        if (cancelled) return;
        setSideThreads((current) => {
          const next = new Map(current);
          next.set(openAside, thread);
          return next;
        });
      })
      .catch(() => {
        // A side thread that cannot be read is not worth interrupting the
        // conversation for. The transcript is intact; the panel simply starts
        // empty, and asking again writes a new thread.
      });
    return () => {
      cancelled = true;
    };
  }, [openAside, conversation.id, conversation.incognito]);
  // Voice: shared preferences drive captions, wake phrase, device and output.
  const { prefs: voicePrefs, emergencyMute } = useVoicePrefs();
  const [caption, setCaption] = useState("");
  /** What OCADE is currently reading aloud, for output captions. */
  const [spokenCaption, setSpokenCaption] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const wakeRef = useRef<SpeechRecognitionLike | null>(null);
  // Visual responses are opt-in per answer.
  const [visualAnswer, setVisualAnswer] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<OcadeProjectFile[]>([]);
  const [projectFileError, setProjectFileError] = useState<string | null>(null);
  /**
   * Sources the user has excluded from the NEXT question.
   *
   * Per-question rather than persistent: removing a project file here means
   * "not for this one", not "detach it from the project". Silently unfiling a
   * document because someone skipped it once would be a destructive action
   * behind a dismissal control.
   */
  const [excludedContext, setExcludedContext] = useState<Set<string>>(() => new Set());

  /** What the tray shows: everything that will be read, minus what was removed. */
  const contextEntries = useMemo(
    () =>
      buildContextTray({
        attachments: attachments.map((a) => ({
          name: a.name,
          extractedText: a.extractedText,
          unreadableReason: a.extract?.status !== "ok" ? a.extract?.reason : undefined,
        })),
        projectFiles: projectFiles.map((f) => ({
          id: f.id,
          name: f.folder ? `${f.folder}/${f.name}` : f.name,
          text: f.text,
        })),
      }).filter((entry) => !excludedContext.has(entry.id)),
    [attachments, projectFiles, excludedContext],
  );

  const removeContextEntry = useCallback((entry: ContextEntry) => {
    // An attachment is detached outright — it belongs to this unsent message
    // and nothing else refers to it. A project file is only excluded, because
    // it belongs to the project and must survive the question.
    if (entry.origin === "attachment") {
      const index = Number(entry.id.split(":")[1]);
      setAttachments((current) => current.filter((_, i) => i !== index));
      return;
    }
    setExcludedContext((current) => new Set(current).add(entry.id));
  }, []);
  const [projectDetails, setProjectDetails] = useState<OcadeProject | null>(null);
  const [projectContextError, setProjectContextError] = useState<string | null>(null);
  const [projectContextLoading, setProjectContextLoading] = useState(false);
  const initialMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!conversation.project_id) {
      setProjectFiles([]);
      setProjectFileError(null);
      setProjectDetails(null);
      setProjectContextError(null);
      setProjectContextLoading(false);
      return;
    }
    const projectId = conversation.project_id;
    let live = true;
    setProjectContextLoading(true);
    /*
     * THE PROJECT AND ITS FILES TOGETHER.
     *
     * A conversation filed in a project answers with that project's
     * instructions and material, so both are needed before the next turn can
     * be assembled — and they are independent reads, so they go out together
     * rather than one after the other.
     */
    void Promise.all([listProjects(), listProjectFiles({ data: { projectId } })])
      .then(([projects, files]) => {
        if (!live) return;
        const project =
          ((projects ?? []) as OcadeProject[]).find((row) => row.id === projectId) ?? null;
        setProjectDetails(project);
        setProjectFiles(files as OcadeProjectFile[]);
        setProjectContextError(project ? null : "This conversation's project no longer exists.");
        setProjectFileError(null);
      })
      .catch((error: unknown) => {
        if (!live) return;
        setProjectDetails(null);
        setProjectFiles([]);
        const reason =
          error instanceof Error ? error.message : "Project context could not be loaded.";
        setProjectContextError(reason);
        setProjectFileError(reason);
      })
      .finally(() => {
        if (live) setProjectContextLoading(false);
      });
    return () => {
      live = false;
    };
  }, [conversation.project_id]);

  /*
   * The retrieval sentence describes the last request in THIS conversation.
   * Carrying it across a conversation switch would attribute one chat's
   * document search to another chat's answer.
   */
  useEffect(() => {
    setRetrievalNotice(null);
  }, [conversation.id]);

  useEffect(() => {
    if (streaming) return;
    const assistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!assistant) {
      setCitations([]);
      setCitationError(null);
      return;
    }
    // Restored from the answer itself: the evidence is a column on the message,
    // so it arrives with the transcript rather than needing a second lookup
    // that could disagree with it.
    setCitations(assistant.citations ?? []);
    setCitationError(null);
  }, [conversation.id, messages, streaming]);

  // Crash recovery: restore anything typed but not sent for THIS conversation,
  // and keep it saved as the user types (Plan §39).
  useEffect(() => {
    // Settings › Chat › Keep unsent drafts. Someone who turned this off on a
    // shared computer must not be handed back what they typed last time.
    if (!chatPrefs.keepDrafts) return;
    const recovered = recoverDraft(conversation.id);
    if (recovered?.text) {
      setDraft((current) => (current.trim() ? current : recovered.text));
      toast.info("Restored the message you were writing.");
    }
    // Only on conversation change — never clobber what the user is typing now.
  }, [conversation.id, chatPrefs.keepDrafts]);

  useEffect(() => {
    if (streaming) return;
    if (!chatPrefs.keepDrafts) {
      // Turning the preference off must also remove what was already stored,
      // not merely stop adding to it.
      clearDraft(conversation.id);
      return;
    }
    const id = setTimeout(() => saveDraft(conversation.id, draft), 400);
    return () => clearTimeout(id);
  }, [draft, conversation.id, streaming, chatPrefs.keepDrafts]);
  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].content;
    }
    return null;
  }, [messages]);
  // No assumed default voice — OCADE speaks with the platform voice until the
  // user chooses male or female (decision #22). Device-level preference.
  const [voiceGender, setVoiceGender] = useState<VoiceGender | null>(() => {
    if (typeof window === "undefined") return null;
    // A per-device voice choice: which voice this machine speaks with. Not
    // content, and deliberately not synchronised — a laptop and a phone
    // reasonably want different answers.
    const v = window.localStorage.getItem("caera:voice:gender");
    return v === "male" || v === "female" ? v : null;
  });

  function chooseVoice(g: VoiceGender) {
    setVoiceGender(g);
    if (typeof window !== "undefined") window.localStorage.setItem("caera:voice:gender", g);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText]);

  /**
   * Warm the on-device engine while the user is still typing.
   *
   * Cold start is pure disk time and it dominates the first message: 26,932 ms
   * against 2,192 ms warm for the same question on the reference machine
   * (release/OCADE_TIER_BENCHMARK.json). Nothing is sent — the runtime is asked
   * to load weights only — and failure is deliberately silent, because this is
   * an optimisation for a message that has not been sent yet.
   *
   * Skipped entirely when the user has chosen the cloud engine: loading
   * gigabytes for a request that will never touch them is exactly the kind of
   * background weight this product is meant not to impose.
   */
  function warmLocalEngine() {
    let warmKey = "browser-or-paired";
    if (localEngine.status === "ready" && localEngine.models.length > 0) {
      const route = routeTask("general", localEngine.models, localPerfLedger, devicePolicy.policy);
      if (route.ok) warmKey = route.model.id;
    }
    if (warmedRef.current.has(warmKey)) return;
    warmedRef.current.add(warmKey);
    /*
     * Warm at the window this message will actually need.
     *
     * The draft and whatever is already attached are handed over, because the
     * runtime reloads the weights when the context window changes: warming at
     * the default and then sending a long attachment pays the whole load again
     * AFTER the send, which is exactly the wait this optimisation exists to
     * remove. Measured on this machine, that reload plus prompt evaluation ran
     * past five minutes, against 40.6 seconds once warm at the same window.
     */
    const pending: BrainMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user" as const,
        content: draft,
        ...(attachments.some((a) => a.kind === "image") ? { images: [""] } : {}),
      },
    ];
    // Through the Brain, so one place owns "which engine, and get it ready" —
    // rather than the chat screen reaching for a specific runtime directly.
    brain.warm(pending);
  }

  /**
   * Keep a refused request visible without pretending a model answered it.
   *
   * Preparation and engine availability are checked before the commercial
   * permit because they generate nothing. That used to mean a send made while
   * Offline Intelligence was preparing produced only a transient toast: the
   * person's words stayed hidden inside the textarea and the transcript looked
   * as though Send had done nothing. The turn is now recorded together with an
   * explicit non-answer. It consumes no permit and names the real condition.
   */
  async function recordUnavailableTurn(text: string, atts: Attachment[], reason: string) {
    try {
      const userTurn = await persistChatMessage({
        incognito: conversation.incognito,
        conversationId: conversation.id,
        role: "user",
        content: text,
        attachments: atts.map((attachment) => ({
          kind: attachment.kind,
          name: attachment.name,
          mime: attachment.mime,
          sizeBytes: attachment.sizeBytes,
        })),
      });
      const notice = await persistChatMessage({
        incognito: conversation.incognito,
        conversationId: conversation.id,
        role: "assistant",
        content: `OCADE has not answered this request. ${reason}`,
        modelId: null,
        providerId: null,
      });

      if (userTurn.stored === "not_stored" || notice.stored === "not_stored") {
        setMessages((current) => [
          ...current,
          userTurn.record as unknown as Message,
          notice.record as unknown as Message,
        ]);
        setStreamText("");
      } else {
        await refreshAfterLocal();
      }
      setDraft("");
      setAttachments([]);
      clearDraft(conversation.id);
      toast.error(reason);
    } catch (error) {
      toast.error(describeStorageError(error));
    }
  }

  /**
   * Persist a deterministic OCADE product answer without starting inference.
   *
   * Identity is application-owned, so asking who made OCADE cannot depend on
   * a local model being installed, an online backend being reachable, or a
   * commercial permit. Keeping it out of the generation path also prevents a
   * backend swap from changing OCADE's answer about itself. Attachments are
   * deliberately excluded by the caller: an attached file changes the request
   * from an identity question into work that must use the normal path.
   */
  async function recordIdentityTurn(text: string, answer: string) {
    try {
      const userTurn = await persistChatMessage({
        incognito: conversation.incognito,
        conversationId: conversation.id,
        role: "user",
        content: text,
      });
      const assistantTurn = await persistChatMessage({
        incognito: conversation.incognito,
        conversationId: conversation.id,
        role: "assistant",
        content: answer,
        modelId: null,
        providerId: null,
      });

      if (userTurn.stored === "not_stored" || assistantTurn.stored === "not_stored") {
        setMessages((current) => [
          ...current,
          userTurn.record as unknown as Message,
          assistantTurn.record as unknown as Message,
        ]);
      } else {
        await refreshAfterLocal();
      }
      setDraft("");
      setAttachments([]);
      clearDraft(conversation.id);
    } catch (error) {
      toast.error(describeStorageError(error));
    }
  }

  async function sendMessage(overrideText?: string, overrideAtts?: Attachment[]) {
    const text = (overrideText ?? draft).trim();
    const atts = overrideAtts ?? attachments;
    if (!text && atts.length === 0) return;
    if (streaming) return;
    if (
      conversation.project_id &&
      (projectContextLoading || projectFileError || projectContextError || !projectDetails)
    ) {
      toast.error(
        `Project context is unavailable: ${
          projectContextLoading
            ? "still loading"
            : (projectFileError ?? projectContextError ?? "project record missing")
        }`,
      );
      return;
    }

    /*
     * WHAT IS ABOUT TO BE EXPOSED, CHECKED BEFORE IT CAN BE.
     *
     * The rule here is stricter than the demo's, and deliberately so. The demo
     * skips the scan whenever the conversation is sealed, because sealed means
     * nothing can leave. That reasoning does not transfer: a signed-in message
     * is also PERSISTED, and on `private_sync` it is persisted to a server. A
     * credential pasted into a synced conversation ends up in a database even
     * if the answer never left the machine.
     *
     * So the trigger is exposure, not transmission: scan whenever the message
     * will be synced or may reach cloud. A Browser-Only conversation answered
     * on-device genuinely cannot expose it, and warning there would train the
     * user to dismiss the warning in the one case where it is harmless — which
     * is how it stops working in the case where it is not.
     */
    /*
     * A SEALED CONVERSATION IS THE ONLY ONE NOTHING LEAVES.
     *
     * This also read `chatsMode === "private_sync"`, from an era when a chat
     * could be kept on the device alone. `PLAN.md` Phase 2 makes every ordinary
     * conversation an account record, so the storage half of the condition was
     * always true and the seal is what the warning actually turns on.
     */
    const willBeExposed = !sealed;
    if (willBeExposed) {
      const findings = preflight(text);
      const critical = findings.filter((f) => f.severity === "critical");
      if (critical.length > 0) {
        toast.error(summarisePreflight(findings), {
          description: `${critical[0].explain} Remove it, or seal this conversation, before sending.`,
          duration: 12_000,
        });
        return;
      }
    }

    /*
     * Product identity is deterministic application content, not an AI
     * generation. It therefore needs neither a model download nor a permit
     * and performs no inference/network request. This is the visible Chat
     * route; the same identity text is also injected into every runtime prompt
     * for requests that do require a backend.
     */
    const identityAnswer = atts.length === 0 ? ocadeIdentityAnswer(text) : null;
    if (identityAnswer) {
      await recordIdentityTurn(text, identityAnswer);
      return;
    }

    const hasImage = atts.some((a) => a.kind === "image");
    /*
     * THE COMMERCIAL GATE, ABOVE EVERY BACKEND.
     *
     * Acquired here rather than inside either branch below, and that placement
     * is the requirement rather than a preference: the allowance is one pool
     * across every surface and every backend, so a gate inside one branch would
     * let an exhausted account fall through to the other and spend it twice.
     *
     * A refusal has already told the person when their allowance returns.
     * Nothing is sent to intelligence and nothing is charged. The attempted
     * turn is still recorded with an explicit non-answer: Send must never look
     * broken merely because the commercial authority correctly failed closed.
     */
    const billed = await beginBilledRequest({ surface: "chat" });
    if (!billed) {
      await recordUnavailableTurn(
        text,
        atts,
        "OCADE Intelligence did not start because the usage gate did not issue a permit. Check Usage for the current allowance and exact reset time.",
      );
      return;
    }

    try {
      /*
       * A request that asks OCADE to DO something goes through the runtime
       * first.
       *
       * `run` returns `used: false` without touching the engine when the
       * request is plainly conversation, so the common case pays nothing. When
       * it does run, its answer is the answer — no second generation pass,
       * because asking the model to describe what it just did produces a
       * different account of it than the receipts do.
       */
      if (!hasImage && atts.length === 0) {
        const acted = await sendViaTools(text, billed);
        if (acted) return;
      }

      await sendViaIntelligence(text, atts, hasImage, billed);
    } finally {
      /*
       * EVERY WAY OUT PASSES THROUGH HERE — an answer, a failure, a thrown
       * storage error, a stop. `settle` releases unless something was actually
       * delivered, so the safe outcome is the default and no exit can leave a
       * reservation held against somebody who received nothing.
       */
      await billed.settle();
    }
  }

  /** Route one ordinary turn through the canonical permit-carrying authority. */
  async function sendViaIntelligence(
    text: string,
    atts: Attachment[],
    hasImage: boolean,
    billed: BilledRequest,
  ) {
    let selectedLocal: RouteChosen | null = null;
    let localFailureAlreadyShown = false;
    const backendFor = (route: RouteChosen): IntelligenceBackend => {
      switch (route.adapter.id) {
        case "browser_webgpu":
          return "webgpu_local";
        case "browser_wasm":
          return "wasm_local";
        case "paired_desktop":
          return "paired_local";
        case "desktop_bridge":
          return "ollama_local";
        default:
          return "native_local";
      }
    };

    const local: IntelligenceTransport = {
      get backend() {
        return selectedLocal ? backendFor(selectedLocal) : "native_local";
      },
      async probe() {
        const route = await brain.route({ visionRequired: hasImage });
        if (!route.ok) {
          return {
            available: false,
            state: "unavailable" as const,
            reason: route.reason,
            capabilities: { text: false, tools: false, vision: false },
          };
        }
        selectedLocal = route;
        return {
          available: true,
          state: "ready" as const,
          capabilities: { ...route.availability.capabilities },
        };
      },
      async *stream(): AsyncIterable<IntelligenceEvent> {
        const route = selectedLocal ?? (await brain.route({ visionRequired: hasImage }));
        if (!route.ok) {
          yield {
            type: "refusal",
            code: "local_unavailable",
            reason: route.reason,
            retryable: false,
          };
          return;
        }
        selectedLocal = route;
        const answer = await sendViaLocal(text, atts, hasImage, billed, route);
        if (!answer?.trim()) {
          // `sendViaLocal` restores the draft and explains the exact adapter
          // failure. The outer router must not append a second generic failure.
          localFailureAlreadyShown = true;
          yield {
            type: "refusal",
            code: "local_unavailable",
            reason: "Local Intelligence returned no response.",
            retryable: false,
          };
          return;
        }
        yield {
          type: "final",
          response: {
            text: answer,
            toolCalls: [],
            toolResults: [],
            backend: backendFor(route),
            stopReason: "end_turn",
          },
        };
      },
      cancel() {
        abortRef.current?.abort();
      },
    };

    const onlineBase = createOnlineIntelligenceTransport();
    const onlineTransport: IntelligenceTransport = {
      backend: onlineBase.backend,
      probe: (signal) => onlineBase.probe(signal),
      cancel: (generationId) => onlineBase.cancel?.(generationId),
      async *stream(request): AsyncIterable<IntelligenceEvent> {
        const optimistic: Message = {
          id: `online-${Date.now()}`,
          role: "user",
          content: text,
          attachments: atts,
          model_id: null,
          created_at: new Date().toISOString(),
        };
        setMessages((current) => [...current, optimistic]);
        saveDraft(conversation.id, text);
        setDraft("");
        setAttachments([]);
        setStreaming(true);
        setStreamText("");
        let answer = "";
        let delivered = false;
        try {
          for await (const event of onlineBase.stream(request)) {
            if (event.type === "token") {
              answer += event.text;
              pushStreamText(answer);
            }
            if (event.type === "final" && event.response.text.trim()) {
              answer = event.response.text;
              await persistOnlineTurn(text, atts, answer, request.messages, billed);
              delivered = true;
            }
            if (event.type === "refusal" && answer.trim()) {
              await persistOnlineTurn(
                text,
                atts,
                `${answer}\n\n_[Online Intelligence stopped before finishing.]_`,
                request.messages,
                billed,
              );
              delivered = true;
            }
            yield event;
          }
        } finally {
          setStreaming(false);
          setStreamText("");
          if (!delivered) {
            setMessages((current) => current.filter((message) => message.id !== optimistic.id));
            setDraft(text);
            setAttachments(atts);
          }
        }
      },
    };

    const context = await buildRequestContext(atts, true, text);
    if (!context.ok) {
      toast.error(context.reason);
      return;
    }
    const images = atts
      .filter(
        (attachment): attachment is Attachment & { dataUrl: string } =>
          attachment.kind === "image" && typeof attachment.dataUrl === "string",
      )
      .map((attachment) => attachment.dataUrl.split(",", 2)[1])
      .filter((payload): payload is string => Boolean(payload));
    const system = assembleSystemPrompt({
      now: new Date(),
      surface: "chat",
      mode: chatPrefs.thinking ? "thinking" : "fast",
      engineLabel: "OCADE Intelligence",
      local: engineTier === "local",
      online,
      project: projectDetails
        ? { name: projectDetails.name, instructions: projectDetails.instructions }
        : undefined,
    });
    const normalized: NormalizedMessage[] = [
      { role: "system", content: system },
      ...messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role, content: message.content })),
      ...(context.data
        ? [
            {
              role: "user" as const,
              content: `Context from files and memory selected for this turn:\n\n${context.data}`,
            },
          ]
        : []),
      { role: "user", content: text, ...(images.length ? { images } : {}) },
    ];
    const intelligence = createOcadeIntelligence({ online: onlineTransport, local });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await intelligence.generate({
        permit: billed.permit,
        generationId: billed.permit.generationId,
        idempotencyKey: billed.permit.idempotencyKey,
        surface: "chat",
        mode: engineTier === "local" ? "local_only" : "automatic",
        messages: normalized,
        tools: [],
        attachments: atts.map((attachment) => ({
          name: attachment.name,
          mime: attachment.mime,
          sizeBytes: attachment.sizeBytes,
          ...(attachment.extractedText ? { text: attachment.extractedText } : {}),
        })),
        privacy: {
          onlineInferenceConsented: engineTier !== "local" && !sealed,
          sealed,
        },
        conversationId: conversation.id,
        ...(conversation.project_id ? { projectId: conversation.project_id } : {}),
        signal: controller.signal,
      });
      if (!result.ok && !controller.signal.aborted && !localFailureAlreadyShown) {
        await recordUnavailableTurn(text, atts, result.reason);
      }
    } finally {
      abortRef.current = null;
    }
  }

  async function persistOnlineTurn(
    text: string,
    atts: Attachment[],
    answer: string,
    sentMessages: NormalizedMessage[],
    billed: BilledRequest,
  ) {
    await persistChatMessage({
      incognito: conversation.incognito,
      conversationId: conversation.id,
      role: "user",
      content: text,
      attachments: atts.map((attachment) => ({
        kind: attachment.kind,
        name: attachment.name,
        mime: attachment.mime,
        sizeBytes: attachment.sizeBytes,
      })),
    });
    await persistChatMessage({
      incognito: conversation.incognito,
      conversationId: conversation.id,
      role: "assistant",
      content: answer,
      modelId: null,
      providerId: "ocade-online",
    });
    const rows = await refreshAfterLocal();
    const assistant = [...rows].reverse().find((message) => message.role === "assistant");
    void recordCitations(answer, assistant?.id);
    billed.recordDelivery({
      prompt: sentMessages.map((message) => message.content).join("\n"),
      answer,
    });
    clearDraft(conversation.id);
  }

  /**
   * Run a request through the shared runtime, and persist what it did.
   *
   * Returns false when the runtime declined to act, in which case the caller
   * falls through to the ordinary on-device answer. Returns false ALSO when the
   * runtime ran and did nothing useful — a loop that stopped without a single
   * step has no better answer than the chat path would give, and showing its
   * "I could not do that" instead of a real reply would be a regression
   * disguised as a feature.
   */
  async function sendViaTools(text: string, billed: BilledRequest): Promise<boolean> {
    const controller = new AbortController();
    abortRef.current = controller;
    setToolSteps([]);
    setStreaming(true);
    setStreamText("");
    let streamed = "";
    try {
      const run = await runtime.run(text, { signal: controller.signal, permit: billed.permit });
      if (!run.used || !run.result) return false;
      const { result } = run;
      if (result.toolResults.length === 0) return false;

      streamed = result.text;
      /*
       * Delivered, with the work the tools genuinely did.
       *
       * `verified` is only set by an executor that went and LOOKED for the
       * change it made, so it is exactly the read/side-effect distinction the
       * weighting asks for: `true` is a verified change, absent is a read.
       * `false` — attempted and not found — counts as neither. OCADE charges
       * for what it can show it did, never for what it attempted.
       *
       * Reads are deduplicated by their content, because re-reading the same
       * thing inside one request is one batch, not several.
       */
      const steps = result.toolResults.filter((step) => !step.isError);
      billed.recordDelivery({
        prompt: text,
        answer: result.text,
        readToolBatches: new Set(
          steps.filter((step) => step.verified === undefined).map((step) => step.content),
        ).size,
        sideEffectActions: steps.filter((step) => step.verified === true).length,
      });
      /*
       * Said out loud rather than buried. A step that reported success and
       * could not be verified is the one case where "Done" would be a lie,
       * and the user is the person who can go and look.
       */
      const unverified = result.toolResults.some((step) => step.verified === false);
      const transcript = [
        result.text.trim(),
        "",
        ...result.toolResults.map((step) => `- ${step.content.split("\n")[0]}`),
        unverified ? "\nOCADE could not confirm every step. Worth a look." : "",
        result.terminal.reason === "max_turns"
          ? "\nOCADE stopped after several rounds without finishing. Tell it what to try next."
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      await persistChatMessage({
        incognito: conversation.incognito,
        conversationId: conversation.id,
        role: "user",
        content: text,
      });
      await persistChatMessage({
        incognito: conversation.incognito,
        conversationId: conversation.id,
        role: "assistant",
        content: transcript,
        modelId: OCADE_DEFAULT_MODEL_ID,
        providerId: "ocade-local",
      });
      await refreshAfterLocal();
      setDraft("");
      clearDraft(conversation.id);
      return true;
    } catch (error) {
      /*
       * A stop is the user's choice, not a failure, and the partial work is
       * still theirs. Anything else is reported and the caller falls back to
       * the ordinary answer rather than leaving the person with nothing.
       */
      if (controller.signal.aborted) {
        if (streamed) {
          // Stopped WITH output: the person has part of an answer, so it is
          // charged for what they received rather than released in full.
          billed.recordDelivery({ prompt: text, answer: streamed });
          toast.info("Stopped.");
        }
        return true;
      }
      toast.error(error instanceof Error ? error.message : "OCADE could not carry that out.");
      return false;
    } finally {
      setStreaming(false);
      setToolSteps([]);
      setToolApproval(null);
      toolApprovalResolve.current = null;
      abortRef.current = null;
    }
  }

  /**
   * On-device send with the capability-aware fallback chain: preferred local →
   * secondary → lightweight. Only after every local engine fails do we ask
   * permission to use a network-backed current-information connector. Cancellation is
   * honoured at any step and the partial answer is preserved.
   */
  /**
   * Turn the retrieval index into per-document usage for a receipt.
   *
   * Reports the sections ACTUALLY put in front of the engine against the
   * sections the document was split into — the difference between "OCADE read
   * your file" and "OCADE searched your file and used four sections of it".
   * Both are legitimate; only one of them is what happened, and a user reads
   * the answer differently depending on which.
   *
   * An unreadable source is listed with zero sections rather than omitted: it
   * is visibly attached, so its absence here would read as inclusion.
   */
  async function sourceUsesFor(sources: IndexedSource[]): Promise<SourceUse[]> {
    return Promise.all(
      sources.map(async (source) => {
        const text = source.text ?? "";
        const passagesTotal = source.readable ? splitIntoPassages(text).length : 0;
        return {
          name: source.name,
          sha256: await sha256OfText(text),
          // The index holds exactly what was sent, so everything in it was used.
          passagesUsed: passagesTotal,
          passagesTotal,
          category: source.provenance ?? "attached_document",
          url: source.url,
          domain: source.domain,
          publishedAt: source.publishedAt,
          retrievedAt: source.retrievedAt,
        };
      }),
    );
  }

  async function sendViaLocal(
    text: string,
    atts: Attachment[],
    hasImage: boolean,
    billed: BilledRequest,
    preselected?: RouteChosen,
  ): Promise<string | null> {
    /*
     * THE BROWSER IS THE ENGINE, AND THIS IS WHERE THAT BECAME TRUE.
     *
     * This screen used to select an Ollama model with `routeTask` and stream
     * from `http://localhost:11434`. Ollama is a program the user installs on
     * their computer, so a person on a clean laptop with only Chrome got a
     * refusal — while `useBrain`, imported a few lines above, was quietly
     * preloading a 340 MB WebGPU model that nothing would ever generate with,
     * because the hook returns `{ mode, route, warm, remedyLabel }` and has no
     * `generate` at all.
     *
     * `brain.route()` asks the adapter chain instead: browser WebGPU first,
     * browser WASM when there is no usable GPU adapter, then a desktop bridge
     * or a paired machine for the people who have one. Ollama becomes a bonus
     * for whoever installed it rather than the only way in.
     *
     * The route is awaited HERE rather than inside the stream because probing
     * WebGPU is a real hardware check that can take seconds, and the screen
     * needs to be able to say "preparing" while it happens instead of looking
     * frozen inside what appears to be a synchronous send.
     */
    const brainRoute = preselected ?? (await brain.route({ visionRequired: hasImage }));
    if (!brainRoute.ok) {
      const actions = brainRoute.remedies.map(brain.remedyLabel).join(" · ");
      toast.error(brainRoute.reason, actions ? { description: actions } : undefined);
      return null;
    }
    const localSteps = [
      { modelId: brainRoute.availability.modelId ?? brainRoute.adapter.id, label: "OCADE Local" },
    ];
    /*
     * A browser adapter runs a small fixed window; a desktop bridge or paired
     * machine does not, and there the canonical document is sent unchanged.
     * `null` means unbounded, which is the honest description of the latter.
     */
    const promptBudget =
      brainRoute.adapter.id === "browser_webgpu" || brainRoute.adapter.id === "browser_wasm"
        ? systemPromptBudgetFor(
            chooseBrowserTier(
              brainRoute.adapter.id === "browser_webgpu" ? "webgpu" : "wasm",
              null,
              loadBenchmark(brainRoute.adapter.id === "browser_webgpu" ? "webgpu" : "wasm"),
            ).tier,
          )
        : null;
    const requestContext = await buildRequestContext(atts, true, text);
    if (!requestContext.ok) {
      toast.error(requestContext.reason);
      return null;
    }

    const optimistic: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      attachments: atts,
      model_id: null,
      created_at: new Date().toISOString(),
    };
    const priorMessages = messages;
    setMessages((m) => [...m, optimistic]);
    saveDraft(conversation.id, text);
    setDraft("");
    setAttachments([]);
    setStreaming(true);
    setStreamText("");

    const controller = new AbortController();
    abortRef.current = controller;

    let userTurnPersisted = false;
    let completedUnsavedText = "";
    const failures: string[] = [];
    let currentInformation: CurrentInformationPacket | null = null;
    let currentInformationUnavailable: string | null = null;
    /*
     * A CURRENT-INFORMATION RETRIEVAL IS A VERIFIED READ BATCH.
     *
     * It is exactly what the weighting means by one: OCADE went out, fetched
     * pages, and came back with evidence it can cite. Leaving it out charged
     * a researched answer the same as one written from memory, which is the
     * wrong way round — the researched one is the more expensive.
     *
     * One per request, not one per source: the person asked one question, and
     * the batch is the retrieval.
     */
    let retrievalBatches = 0;

    try {
      const freshness = classifyFreshness(text);
      if (freshness.route === "current_information") {
        if (!online) {
          currentInformationUnavailable =
            "This question needs current information, but the device is offline. State that current verification is unavailable before giving any timeless background you can support locally. Do not present stored knowledge as current.";
        } else {
          toast.info("Checking current sources…", {
            description:
              "Search and page retrieval use ordinary web requests. The answer is still generated on this device.",
          });
          const retrieved = await retrieveCurrentInformation({
            data: { query: text, volatility: freshness.volatility },
          });
          if (controller.signal.aborted) throw new DOMException("Stopped by user", "AbortError");
          if (retrieved.ok) {
            currentInformation = retrieved.packet;
            // Counted only on success. A retrieval that found nothing gave the
            // person nothing, and they do not pay for it.
            retrievalBatches = 1;
            const webSources: IndexedSource[] = retrieved.packet.sources.map((source) => ({
              id: source.id,
              name: source.title,
              kind: "web",
              provenance: "internet_evidence",
              readable: true,
              text: source.evidence,
              locator: {
                section: source.publishedAt
                  ? `published ${source.publishedAt}`
                  : `retrieved ${source.retrievedAt}`,
              },
              url: source.url,
              domain: source.domain,
              publishedAt: source.publishedAt,
              retrievedAt: source.retrievedAt,
            }));
            sourceIndexRef.current = [...sourceIndexRef.current, ...webSources];
          } else {
            currentInformationUnavailable = `Current verification was required but retrieval failed: ${retrieved.reason} Say that clearly, then give only timeless background supported by local knowledge.`;
          }
        }
      }

      for (const step of localSteps) {
        const label = step.label ?? "OCADE Local";
        /*
         * ONE CONSTITUTION, ASSEMBLED IN ONE PLACE.
         *
         * This used to be a hand-written template literal: an identity line,
         * a "never print model names" line, and the project instructions
         * concatenated straight onto the end. It carried no safety policy at
         * all — `ocadeCorePolicy` existed in the repository and this surface,
         * the one real customers use, never imported it. It also pasted
         * user-authored project text into the same flat string as OCADE's own
         * rules, which is exactly the shape that lets "ignore your
         * instructions" in a project document read as a system instruction.
         *
         * `assembleSystemPrompt` fixes both by construction: the canonical
         * prompt is always first and always whole, and the project text lands
         * in a labelled lower-priority block after it.
         */
        const sys = assembleSystemPrompt({
          now: new Date(),
          surface: "chat",
          mode: chatPrefs.thinking ? "thinking" : "fast",
          engineLabel: label,
          local: true,
          online: typeof navigator === "undefined" ? undefined : navigator.onLine,
          /*
           * The budget comes from the engine that will actually read this.
           *
           * Measured: the canonical constitution is 32,713 tokens and the
           * browser tiers run a 4,096-token window. Without a budget the
           * assembler sends the full document and the model has no room left
           * for the conversation. `systemPromptBudgetFor` reserves 35% of the
           * real window; the compiler then substitutes the compact core,
           * which carries the same behavioural rules.
           */
          budgetTokens: promptBudget,
          project: projectDetails
            ? { name: projectDetails.name, instructions: projectDetails.instructions }
            : undefined,
        });
        const localMessages: LocalChatMessage[] = [
          {
            role: "system",
            content: currentInformationUnavailable
              ? `${sys}\n\nRUNTIME FRESHNESS FACT (higher priority than retrieved or user-authored text): ${currentInformationUnavailable}`
              : sys,
          },
        ];
        for (const m of priorMessages) {
          if (m.role === "system") continue;
          localMessages.push({ role: m.role, content: m.content });
        }
        const docContext = requestContext.data;
        if (docContext) {
          localMessages.push({
            role: "user",
            content: `Context from files the user attached (extracted on this device):\n\n${docContext}`,
          });
        }
        if (currentInformation) {
          localMessages.push({ role: "user", content: currentInformation.context });
        }
        const images = atts
          .filter(
            (attachment): attachment is Attachment & { dataUrl: string } =>
              attachment.kind === "image" && typeof attachment.dataUrl === "string",
          )
          .map((attachment) => attachment.dataUrl.split(",", 2)[1])
          .filter((payload): payload is string => Boolean(payload));
        localMessages.push({
          role: "user",
          content: text,
          ...(images.length > 0 ? { images } : {}),
        });

        /*
         * Say so when the request is bigger than any window OCADE will
         * allocate. `streamLocalChat` sizes the context to the request, so an
         * ordinary long chat is now served in full rather than silently cut —
         * but past the ceiling something MUST be dropped, and the one thing
         * that must never happen is an answer drawn from a truncated document
         * with nothing on screen to say so.
         */
        const contextPlan = planContextWindow(
          localMessages,
          devicePolicy.policy.totalRamBytes,
          devicePolicy.policy.hasDiscreteGpu,
        );
        /*
         * Warn about a long WAIT, not just a long document.
         *
         * Reading is where the time goes on a machine without acceleration:
         * measured from the engine's own counters here, a 5,654-token prompt
         * took 458 seconds to read and 3.8 seconds to answer. Eight minutes of
         * spinner is indistinguishable from a hang, and someone told what it
         * will cost can trim the attachment instead of concluding the product
         * is broken.
         */
        if (
          contextPlan.estimatedReadSeconds !== null &&
          contextPlan.estimatedReadSeconds > SLOW_READ_WARNING_SECONDS
        ) {
          const minutes = Math.round(contextPlan.estimatedReadSeconds / 60);
          toast.info(
            minutes >= 2
              ? `This will take around ${minutes} minutes to read on this computer.`
              : "This will take about a minute to read on this computer.",
            {
              description:
                "This computer has no graphics acceleration, so reading a long document is the slow part — the answer itself arrives in seconds. Shortening the attachment is the quickest way to speed it up.",
            },
          );
        }
        if (contextPlan.exceedsCeiling) {
          /*
           * Names the attachments, rather than saying "an attachment".
           *
           * `planContextWindow` already owns context sizing for this surface,
           * so this deliberately does NOT introduce a second budget system —
           * two implementations of "what fits" would drift, and the one that
           * drifted would be silently wrong about what the engine actually
           * saw. What it adds is the part that was missing: a user who
           * attached a contract and is told only that "the oldest part" was
           * dropped has no idea whether their contract was in it.
           */
          const named = atts.map((a) => a.name).filter(Boolean);
          toast.warning("This conversation is longer than OCADE can hold on this device at once.", {
            description:
              named.length > 0
                ? `The oldest part will not be visible to the engine, and that may include ${named.join(", ")}. Start a new chat, or remove an attachment, to keep the whole thing in view.`
                : "The oldest part will not be visible to the engine. Start a new chat to keep the whole thing in view.",
            duration: 9000,
          });
        }

        let acc = "";
        setStreamText("");
        /*
         * Measure the stream so routing has something real to work from. The
         * router prefers the fastest MEASURED model, and it can only do that if
         * ordinary chat feeds it — a ledger nothing writes to is a ledger that
         * routes on nothing.
         */
        const routeStarted = Date.now();
        let firstTokenMs: number | null = null;
        /*
         * Open the provenance window around THIS generation.
         *
         * It reads the browser's own resource-timing log, so it records every
         * request the page made while answering — whatever issued it. On the
         * on-device branch that should be nothing, and this is what turns that
         * from an assurance into a measurement the user can see.
         */
        const witness = new NetworkWitness();
        witness.start();
        /*
         * The seal goes up around the generation itself, not around the whole
         * send. Narrower is correct: the persistence calls after an answer are
         * the user's own storage, and sealing those would break saving the
         * conversation they just asked to keep.
         */
        const seal = sealed ? new Seal() : null;
        seal?.seal();
        /*
         * Chat goes through the shared reasoning service (W1) rather than
         * calling the engine directly, so local-first, the deterministic-work
         * refusal and receipts are decided in one place for every surface
         * instead of per screen.
         *
         * `modelId` is passed because chat has ALREADY chosen: `routeTask` ran
         * `selectFixedModel` above. Letting the service re-route here would
         * silently override the single-engine decision.
         *
         * `allowCloud` stays false. This is the on-device branch; cloud is a
         * separate, explicitly approved path, so a prompt can never leave the
         * machine as a side effect of the local engine failing.
         */
        const reasoned = await reason(
          brainReasonDeps(brainRoute, {
            ...(images.length > 0 ? { images } : {}),
            think: thinkingFor("chat", chatPrefs.thinking),
            /*
             * A switch the engine cannot honour is told about, not ignored.
             * The compatibility tier runs on the processor, where deliberating
             * costs time and buys nothing; saying so once is honest, and it is
             * how the user learns the toggle is real everywhere it can be.
             */
            onThinkingDegraded: () => {
              toast.info(
                "Thinking is not used on this device's engine — it would take longer without improving the answer. Answering directly.",
              );
            },
            ledger: sessionPerfLedger,
          }),
          {
            messages: localMessages,
            task: hasImage ? "vision" : "general",
            modelId: step.modelId!,
            signal: controller.signal,
            onToken: (c) => {
              if (firstTokenMs === null) firstTokenMs = Date.now() - routeStarted;
              acc += c;
              pushStreamText(acc);
            },
          },
        );
        /*
         * Unsealed FIRST, before anything else runs. A thrown persistence call
         * with the seal still up would leave the page offline for the rest of
         * the session, which is a worse bug than whatever caused it and would
         * look like the seal itself was broken.
         */
        const sealReport = seal?.unseal() ?? null;
        const observation = witness.stop();
        if (sealReport && sealReport.attempts.length > 0) {
          // Named, not swallowed. Something tried to leave while the user had
          // asked for silence, and they are entitled to know what.
          toast.warning(describeSeal(sealReport));
        }
        const result: { ok: boolean; reason?: string } = reasoned.ok
          ? { ok: true }
          : { ok: false, reason: reasoned.failure === "cancelled" ? "cancelled" : reasoned.reason };
        // A cancellation is the user's choice, not the model failing, so it is
        // not recorded as a failure against the model.
        if (result.reason !== "cancelled") {
          localPerfLedger.record({
            modelId: step.modelId!,
            task: hasImage ? "vision" : "general",
            firstTokenMs: firstTokenMs ?? Date.now() - routeStarted,
            totalMs: Date.now() - routeStarted,
            ok: result.ok,
          });
        }

        if (result.reason === "cancelled") {
          /*
           * Stopped. Charged for what actually reached the person and nothing
           * more: a stop before any output is a pre-output cancellation and
           * settles to a release, while a stop part-way through is charged for
           * the part they can read.
           */
          if (acc.trim()) {
            billed.recordDelivery({
              prompt: text,
              answer: acc,
              readToolBatches: retrievalBatches,
            });
          }
          completedUnsavedText = `${acc}\n\n_[stopped by you]_`;
          await persistChatMessage({
            incognito: conversation.incognito,
            conversationId: conversation.id,
            role: "user",
            content: text,
            attachments: atts.map((attachment) => ({
              kind: attachment.kind,
              name: attachment.name,
              mime: attachment.mime,
              sizeBytes: attachment.sizeBytes,
            })),
          });
          userTurnPersisted = true;
          await persistChatMessage({
            incognito: conversation.incognito,
            conversationId: conversation.id,
            role: "assistant",
            content: completedUnsavedText,
            modelId: step.modelId,
            providerId: "ocade-local",
          });
          const rows = await refreshAfterLocal();
          const assistant = [...rows].reverse().find((message) => message.role === "assistant");
          void recordCitations(acc, assistant?.id);
          clearDraft(conversation.id);
          return acc.trim() ? acc : null;
        }

        if (result.ok && acc.trim()) {
          completedUnsavedText = acc;
          await persistChatMessage({
            incognito: conversation.incognito,
            conversationId: conversation.id,
            role: "user",
            content: text,
            attachments: atts.map((attachment) => ({
              kind: attachment.kind,
              name: attachment.name,
              mime: attachment.mime,
              sizeBytes: attachment.sizeBytes,
            })),
          });
          userTurnPersisted = true;
          await persistChatMessage({
            incognito: conversation.incognito,
            conversationId: conversation.id,
            role: "assistant",
            content: acc,
            modelId: step.modelId,
            providerId: "ocade-local",
          });
          const rows = await refreshAfterLocal();
          const assistant = [...rows].reverse().find((message) => message.role === "assistant");
          void recordCitations(acc, assistant?.id);

          /*
           * Delivered. Recorded here, after the answer is persisted and on
           * screen, rather than when generation started — a request that
           * produced nothing the person can read has delivered nothing.
           *
           * `localMessages` is what OCADE was actually given, so the input is
           * measured from the request as sent rather than from the typed text.
           */
          billed.recordDelivery({
            prompt: localMessages.map((message) => message.content).join("\n"),
            answer: acc,
            readToolBatches: retrievalBatches,
          });

          /*
           * The receipt for this answer.
           *
           * Richer than the demo's, because this chat HAS documents: each
           * source is listed with its fingerprint and how much of it was
           * actually used, so "did it read my file?" is answered with a count
           * rather than an impression. `leftDevice` still comes only from the
           * measurement — never from the fact that this is the local branch.
           */
          if (assistant?.id) {
            const receipt = await buildReceipt({
              messageId: assistant.id,
              producedOn: "this_device",
              engineLabel: label,
              prompt: text,
              answer: acc,
              sources: await sourceUsesFor(sourceIndexRef.current),
              observation,
              networkUses: currentInformation
                ? [
                    {
                      purpose: "current_information",
                      provider: currentInformation.provider,
                      contacted: [
                        "html.duckduckgo.com",
                        ...currentInformation.sources.map((source) => source.domain),
                      ],
                      querySent: true,
                      retrievedAt: currentInformation.retrievedAt,
                    },
                  ]
                : undefined,
              blindSpots: networkLimits(),
              startedAt: new Date(routeStarted),
              durationMs: Date.now() - routeStarted,
            });
            setReceipts((current) => ({ ...current, [assistant.id]: receipt }));

            /*
             * The conditions this answer was produced under, so it can be
             * asked again and the two compared.
             *
             * `modelSha256` is empty because the browser engines do not expose
             * a digest of the weights they loaded. That is recorded honestly
             * rather than filled with a placeholder: an equal-but-unknown
             * field compares equal on a repeat, which is the truthful outcome
             * while the same engine is loaded, and `modelKey` still catches a
             * change of engine.
             */
            const pinned = await pinRun({
              prompt: text,
              answer: acc,
              modelKey: step.modelId ?? brainRoute.adapter.id,
              modelSha256: "",
              temperature: BROWSER_SAMPLER.temperature,
              topP: BROWSER_SAMPLER.topP,
              backend: brainRoute.adapter.id,
              at: new Date(routeStarted),
            });
            setRunPins((current) => ({ ...current, [assistant.id]: pinned }));
            replayRef.current[assistant.id] = {
              messages: localMessages,
              modelId: step.modelId!,
              task: hasImage ? "vision" : "general",
              prompt: text,
              engineLabel: label,
              adapterId: brainRoute.adapter.id,
              temperature: BROWSER_SAMPLER.temperature,
              topP: BROWSER_SAMPLER.topP,
            };

            /*
             * Generation always ran on-device. A receipt may report network use
             * for current-information sources, but that does not move inference.
             */
            setCosts((current) => [
              ...current,
              measureRun({
                durationMs: Date.now() - routeStarted,
              }),
            ]);
          }

          /*
           * The question AND the answer, into both records.
           *
           * The question goes in first because a branch point is identified by
           * what was asked before it — a tree of unlabelled answers cannot be
           * navigated, and a chain missing the questions would verify only
           * half the conversation.
           */
          const askedAt = new Date(routeStarted);
          ledgerRef.current = [
            ...ledgerRef.current,
            await appendLedger(ledgerRef.current, { role: "user", content: text, at: askedAt }),
          ];
          ledgerRef.current = [
            ...ledgerRef.current,
            await appendLedger(ledgerRef.current, {
              role: "assistant",
              content: acc,
              at: new Date(),
            }),
          ];
          treeRef.current = recordTurn(treeRef.current, {
            id: optimistic.id,
            role: "user",
            content: text,
            at: askedAt,
          }).tree;
          treeRef.current = recordTurn(treeRef.current, {
            id: assistant?.id ?? `a-${Date.now()}`,
            role: "assistant",
            content: acc,
            at: new Date(),
          }).tree;
          setLedgerVersion((v) => v + 1);

          clearDraft(conversation.id);
          return acc;
        }

        // The engine failed. There is no second one to try — record why.
        failures.push(`${label}: ${result.reason ?? "no response"}`);
      }

      // The on-device engine failed. Never cross to cloud silently.
      setStreaming(false);
      setStreamText("");
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setDraft(text);
      setAttachments(atts);
      /*
       * This used to open the cloud-approval dialog. There is nowhere to
       * escalate to now, so the message says what actually happened and what
       * clears it, rather than offering a door that no longer exists.
       */
      const why = failures.length > 0 ? ` (${failures[failures.length - 1]})` : "";
      toast.error(
        online
          ? `OCADE's on-device engine could not answer${why}. Your message is back in the box — try again in a moment.`
          : `You're offline and OCADE's on-device engine could not answer${why}.`,
      );
    } catch (e) {
      // Surfaces vault-locked / companion-required reasons actionably.
      toast.error(describeStorageError(e));
      if (!userTurnPersisted) {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(text);
        setAttachments(atts);
      } else {
        clearDraft(conversation.id);
        try {
          const rows = await refreshAfterLocal();
          if (completedUnsavedText) {
            setMessages([
              ...rows,
              {
                id: `unsaved-local-${Date.now()}`,
                role: "assistant",
                content: `${completedUnsavedText}\n\n_[This local response completed but could not be saved.]_`,
                attachments: [],
                model_id: model,
                created_at: new Date().toISOString(),
              },
            ]);
          }
        } catch {
          // The original storage error is already surfaced above.
        }
      }
    } finally {
      setStreaming(false);
      setStreamText("");
      abortRef.current = null;
    }
    return null;
  }

  /**
   * Assemble on-device-extracted document text into a single bounded context
   * block. Only extracted TEXT travels — never the raw file.
   *
   * `question` is what makes this a SEARCH rather than a dump: long attachments
   * are cut into sections, ranked against the question, and only the sections
   * that matched are sent. The user is told which of those two things happened
   * — see `setRetrievalNotice` below — because "OCADE read your file" and
   * "OCADE searched your file and read four sections of it" are different
   * claims and only one of them is true at a time.
   */
  function buildDocContext(atts: Attachment[], question: string): string | undefined {
    /*
     * Sources the user removed in the context tray are dropped HERE, at the
     * one place that decides what is actually sent. Filtering them only out of
     * the tray's own list would leave a control that changes a label and not
     * the request — which is worse than having no control, because it invites
     * the user to believe a document was withheld when it was not.
     */
    const projectAttachments: Attachment[] = projectFiles
      .filter((file) => !excludedContext.has(`project:${file.id}`))
      .map((file) => ({
        kind: "file",
        name: file.folder ? `${file.folder}/${file.name}` : file.name,
        mime: file.mime,
        sizeBytes: file.size_bytes,
        extractedText: file.text,
        extract: {
          status: "ok",
          meta: {
            name: file.folder ? `${file.folder}/${file.name}` : file.name,
            kind: classifyFile(file.name, file.mime),
            mime: file.mime,
            sizeBytes: file.size_bytes,
          },
          text: file.text,
        },
      }));
    /*
     * Everything attached is indexed, not only what was readable. An image, a
     * password-protected PDF and a cancelled read each have to reach the
     * context builder so it can say WHY they contributed nothing; filtering
     * them out here is how they used to disappear without a word.
     */
    const withText = [...projectAttachments, ...atts];
    if (withText.length === 0) {
      sourceIndexRef.current = [];
      setRetrievalNotice(null);
      return undefined;
    }
    // Index the sources so the answer can cite them, then remember the index so
    // markers in the reply can be mapped back to real documents (Plan §18).
    //
    // Built by `buildSourceIndex`, NOT by hand: it derives a real locator
    // (page, sheet or line) from the extraction metadata. The previous inline
    // version hardcoded an empty locator, so every citation could name the file
    // but never say where in it the answer came from.
    const sources: IndexedSource[] = buildSourceIndex(
      withText.map(
        (a): ExtractResult =>
          a.extract ?? {
            // Older attachments (restored from a draft) have no stored result;
            // fall back to a minimal one rather than dropping the source.
            status: "ok",
            meta: {
              name: a.name,
              kind: classifyFile(a.name, a.mime),
              mime: a.mime,
              sizeBytes: a.sizeBytes,
            },
            text: a.extractedText ?? null,
          },
      ),
    ).map((source, index) => ({
      ...source,
      provenance: index < projectAttachments.length ? "project_context" : "attached_document",
    }));
    sourceIndexRef.current = sources;

    /*
     * Retrieval, citation instructions and untrusted-content wrapping all live
     * in `buildDocumentContext`. They used to be assembled inline here, which
     * meant the one claim the user reads — how much of their file was actually
     * consulted — was produced by code no test could reach.
     */
    const built = buildDocumentContext(question, sources);
    setRetrievalNotice(built.notice);
    return built.context;
  }

  /**
   * WHAT OCADE REMEMBERS, READ FROM THE ACCOUNT AT THE MOMENT IT IS USED.
   *
   * Memory is one authority — `ocade_memory` — so this is a request, and the
   * request is made per message rather than cached at mount. A person who
   * deletes a memory in Settings and then asks a question in another tab is
   * entitled to a reply that does not still know it, and a snapshot taken when
   * the screen opened would.
   *
   * An unreachable account returns null rather than refusing the message. A
   * reply without remembered context is a smaller failure than no reply at all,
   * and the person can see the connection state elsewhere.
   */
  async function readMemoryContext(projectId: string | null): Promise<string | null> {
    try {
      const held = await readMemory();
      if (!held.enabled) return null;
      return memoryContextFrom(held.rows, projectId);
    } catch {
      return null;
    }
  }

  async function buildRequestContext(
    atts: Attachment[],
    includeMemory: boolean,
    question: string,
  ): Promise<{ ok: true; data: string | undefined } | { ok: false; reason: string }> {
    const documents = buildDocContext(atts, question);
    if (!includeMemory || conversation.incognito) return { ok: true, data: documents };
    const memory = await readMemoryContext(conversation.project_id ?? null);
    const parts = [memory, documents].filter((part): part is string => Boolean(part));
    return { ok: true, data: parts.length > 0 ? parts.join("\n\n") : undefined };
  }

  async function saveAttachmentToProject(attachment: Attachment) {
    if (!conversation.project_id || !attachment.extractedText) return;
    const projectId = conversation.project_id;
    try {
      await saveProjectFile({
        data: {
          projectId,
          name: attachment.name,
          mime: attachment.mime,
          sizeBytes: attachment.sizeBytes,
          text: attachment.extractedText,
        },
      });
      setProjectFiles((await listProjectFiles({ data: { projectId } })) as OcadeProjectFile[]);
      setProjectFileError(null);
      toast.success(`Saved ${attachment.name} to this project.`);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "The file could not be saved.";
      setProjectFileError(reason);
      toast.error(reason);
    }
  }

  /** Map citation markers in a finished answer back to the real sources. */
  async function recordCitations(answer: string, messageId?: string) {
    const sources = sourceIndexRef.current;
    const parsed = sources.length > 0 ? parseCitations(answer, sources) : [];
    setCitations(parsed);
    if (parsed.length === 0) {
      setCitationError(null);
      return;
    }
    if (!messageId) {
      setCitationError(
        "The cited response was not found in persistence, so its citation cards were not saved.",
      );
      return;
    }
    try {
      await saveMessageCitations({ data: { messageId, citations: parsed } });
      setMessages((rows) =>
        rows.map((row) => (row.id === messageId ? { ...row, citations: parsed } : row)),
      );
      setCitationError(null);
    } catch (error) {
      setCitationError(
        `Citation evidence could not be restored or saved: ${describeStorageError(error)}`,
      );
    }
  }

  /**
   * Fork the conversation at a message into a new thread (Plan §17). The
   * original is never modified — every turn up to and including this one is
   * copied, so the user can explore an alternative without losing anything.
   */
  /**
   * ASK A SIDE QUESTION ABOUT ONE MESSAGE — PLAN.md §8.
   *
   * THE ENGINE IS SENT THE ANCHOR AND THE SIDE THREAD, NOT THE CONVERSATION.
   * `sideConversationPrompt` decides that, and the reason is not only cost:
   * sending the whole transcript would make a two-word clarification consume
   * the same commercial allowance as a full turn, and answers to "what does
   * this word mean" would start drifting back toward whatever the conversation
   * was about.
   *
   * It goes through the same permit as any other generation. A side question
   * is a real request to a real engine, and a surface that skipped the gate
   * would be a way to spend an allowance nobody counted.
   */
  async function askAside(anchor: ChatMessageView, question: string) {
    const text = question.trim();
    if (!text || asideBusy) return;

    /*
     * ROUTED THROUGH THE SAME ENGINE CHAIN AS A MAIN TURN.
     *
     * `useBrain` returns `{ mode, route, warm, remedyLabel }` and has no
     * `generate`: routing is a real hardware probe that can take seconds, so it
     * is awaited here where the panel can say it is working, and the generation
     * itself goes through the shared reasoning service like every other surface.
     */
    const route = await brain.route();
    if (!route.ok) {
      const remedies = route.remedies.map(brain.remedyLabel).join(" · ");
      toast.error(route.reason, remedies ? { description: remedies } : undefined);
      return;
    }

    /*
     * Charged like any other generation. A side question is a real request to a
     * real engine, and an ungated surface would be a way to spend an allowance
     * nobody counted — the answer is shorter, not free.
     */
    const billed = await beginBilledRequest({ surface: "chat" });
    if (!billed) return;

    setAsideBusy(anchor.id);
    const controller = new AbortController();
    try {
      const thread = sideThreads.get(anchor.id) ?? [];
      const asked = await appendSideMessage({
        conversationId: conversation.id,
        anchorMessageId: anchor.id,
        role: "user",
        content: text,
        incognito: conversation.incognito,
      });
      setSideThreads((current) => {
        const next = new Map(current);
        next.set(anchor.id, [...(next.get(anchor.id) ?? []), asked.record]);
        return next;
      });

      let answer = "";
      const outcome = await reason(
        // Fast, deliberately: a side question is a short bounded clarification,
        // and deliberating over it costs seconds on a machine without graphics
        // acceleration while changing nothing about the answer.
        brainReasonDeps(route, { think: false, ledger: sessionPerfLedger }),
        {
          messages: sideConversationPrompt({
            anchorContent: anchor.content,
            thread,
            question: text,
          }),
          task: "general",
          signal: controller.signal,
          onToken: (chunk) => {
            answer += chunk;
            setAsideStream(answer);
          },
        },
      );
      if (!outcome.ok) {
        if (outcome.failure !== "cancelled") toast.error(outcome.reason);
        return;
      }
      const finalText = (answer || outcome.text).trim();
      if (!finalText) {
        toast.error("The engine returned nothing for that side question.");
        return;
      }
      // Delivered: the answer is on screen in the side panel.
      billed.recordDelivery({ prompt: text, answer: finalText });

      const answered = await appendSideMessage({
        conversationId: conversation.id,
        anchorMessageId: anchor.id,
        role: "assistant",
        content: finalText,
        incognito: conversation.incognito,
      });
      setSideThreads((current) => {
        const next = new Map(current);
        next.set(anchor.id, [...(next.get(anchor.id) ?? []), answered.record]);
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That side question could not be answered.");
    } finally {
      setAsideStream("");
      setAsideBusy(null);
      await billed.settle();
    }
  }

  /** Discard a side thread. The message it hangs off is untouched. */
  async function discardAside(anchorId: string) {
    try {
      if (!conversation.incognito) {
        await deleteSideThread({
          conversationId: conversation.id,
          anchorMessageId: anchorId,
        });
      }
      setSideThreads((current) => {
        const next = new Map(current);
        next.delete(anchorId);
        return next;
      });
      setOpenAside(null);
      toast.success("Side question discarded. The conversation is unchanged.");
    } catch (e) {
      toast.error(describeStorageError(e));
    }
  }

  async function branchFrom(message: Message) {
    try {
      const created = (await branchConversation({
        data: { conversationId: conversation.id, fromMessageId: message.id },
      })) as { id: string; title: string };
      toast.success(`Branched into “${created.title}”. The original is unchanged.`);
      await onRefreshList();
      onOpenConversation(created.id);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't branch — this needs the database migration.",
      );
    }
  }

  async function forkBeforeUser(message: Message, title: string) {
    /*
     * BRANCHING AN INCOGNITO CONVERSATION WOULD WRITE IT DOWN — PLAN.md §8.
     *
     * A branch is a new conversation with the earlier messages COPIED into it,
     * so branching out of an incognito thread is the one gesture that would
     * turn "nothing is saved" into a saved transcript. Refused with the reason
     * rather than silently producing an empty branch: the source messages are
     * not in any vault to copy, so the quiet version would hand somebody a
     * conversation that had lost everything before the fork.
     */
    if (conversation.incognito) {
      throw new Error(
        "An incognito conversation cannot be branched. A branch copies the earlier messages into a new conversation, which would save what this one is keeping out of storage.",
      );
    }

    /*
     * FORKED ON THE SERVER, IN ONE STATEMENT.
     *
     * There were two branches here: this one, and a local path that created a
     * conversation in the device vault and then copied the earlier turns into
     * it one `persistChatMessage` at a time — which could half-finish, and
     * which had its own rules about what it refused to copy. With one authority
     * the fork is a single call that either happened or did not.
     */
    return (await forkConversationBeforeMessage({
      data: {
        conversationId: conversation.id,
        fromMessageId: message.id,
        title,
      },
    })) as { id: string; title: string };
  }

  async function prepareEdit(message: Message) {
    try {
      const created = await forkBeforeUser(message, `${conversation.title} (edited branch)`);
      saveDraft(created.id, message.content);
      await onRefreshList();
      onOpenConversation(created.id);
      toast.success("Created an independent branch. Edit the restored prompt, then send it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare the edited branch.");
    }
  }

  async function saveAssistantOutput(message: Message, index: number) {
    const sourceTurn = [...messages.slice(0, index)]
      .reverse()
      .find((candidate) => candidate.role === "user");
    const attachedFiles = (sourceTurn?.attachments ?? [])
      .filter(
        (attachment): attachment is Attachment & { extractedText: string } =>
          typeof attachment.extractedText === "string" && attachment.extractedText.length > 0,
      )
      .map((attachment) => ({
        name: attachment.name,
        content: attachment.extractedText,
      }));
    const files = [
      ...projectFiles.map((file) => ({
        name: file.folder ? `${file.folder}/${file.name}` : file.name,
        content: file.text,
      })),
      ...attachedFiles,
    ].filter(
      (file, index, all) =>
        all.findIndex(
          (candidate) => candidate.name === file.name && candidate.content === file.content,
        ) === index,
    );

    const saved = await saveChatOutput({
      title: conversation.title,
      content: message.content,
      conversationId: conversation.id,
      messageId: message.id,
      ...(conversation.project_id
        ? {
            project: {
              id: conversation.project_id,
              ...(projectDetails
                ? { name: projectDetails.name, instructions: projectDetails.instructions }
                : {}),
            },
          }
        : {}),
      files,
      // A complete model response is not independent evidence that its claims
      // are correct. The artifact is integrity-checked but stays NOT CONFIRMED.
      producerEvidence:
        "Saved from a completed OCADE Chat response and re-hashed after local storage. Factual claims were not independently verified by this save action.",
      producerVerified: false,
    });
    if (!saved.ok) {
      toast.error(saved.reason);
      return;
    }
    toast.success("Saved to Artifacts and recorded in on-device Activity.");
  }

  async function refreshAfterLocal(): Promise<Message[]> {
    const rows = (await loadChatMessages({
      conversationId: conversation.id,
    })) as unknown as Message[];
    setMessages(rows);
    setStreamText("");
    await onRefreshList();
    return rows;
  }

  function stop() {
    abortRef.current?.abort();
  }

  /*
   * Escape stops the reply.
   *
   * Bound here rather than with the other shortcuts because this is the only
   * component that holds the abort controller, and it is bound ONLY while
   * something is actually streaming — an Escape that silently does nothing is
   * worse than no binding, since it trains people not to reach for it. It also
   * has to work while the cursor is in the message box, which is where it
   * already is when a reply starts going wrong.
   */
  useEffect(() => {
    if (!streaming) return;
    const onKey = (event: KeyboardEvent) => {
      if (matchChatShortcut({ key: event.key }) !== "stop") return;
      event.preventDefault();
      stop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [streaming]);

  useEffect(() => {
    if (
      loading ||
      !initialMessage ||
      initialMessage.conversationId !== conversation.id ||
      initialMessageRef.current === initialMessage.id
    ) {
      return;
    }
    initialMessageRef.current = initialMessage.id;
    onInitialMessageHandled(initialMessage.id);
    void sendMessage(initialMessage.text, initialMessage.attachments);
    // The message id is the one-shot authority. sendMessage is intentionally
    // excluded because its render identity changes while streaming.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, initialMessage, loading, onInitialMessageHandled]);

  /**
   * Ask the same question again, under the same pinned conditions.
   *
   * NON-DESTRUCTIVE BY CONSTRUCTION. The original answer is not touched: the
   * repeat is stored beside it and rendered as a comparison. "Run it again"
   * must never be a way to lose the answer you already had, which is exactly
   * what a regenerate that overwrites in place does.
   *
   * Replays the stored request rather than rebuilding it, so the comparison
   * measures the ENGINE and not OCADE's context assembly — see `replayRef`.
   *
   * Offered only where a pin exists, which is only the on-device path. Nothing
   * here can be reached for an answer that came from an online provider.
   */
  const rerunAnswer = useCallback(
    async (answerId: string) => {
      if (streaming) return;
      const replay = replayRef.current[answerId];
      const original = runPins[answerId];
      if (!replay || !original) return;

      const route = await brain.route({ visionRequired: replay.task === "vision" });
      if (!route.ok) {
        const actions = route.remedies.map(brain.remedyLabel).join(" · ");
        toast.error(route.reason, actions ? { description: actions } : undefined);
        return;
      }

      /*
       * A re-run is a whole generation, so it is charged like one.
       *
       * Not charged as a correction or a discount: the engine does the same
       * work the first answer took, and a reproducibility check that were free
       * would be a way to spend an allowance without it counting.
       */
      const billed = await beginBilledRequest({ surface: "chat" });
      if (!billed) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setStreamText("");
      let repeated = "";
      const startedAt = Date.now();
      try {
        const outcome = await reason(
          brainReasonDeps(route, { think: false, ledger: sessionPerfLedger }),
          {
            messages: replay.messages,
            task: replay.task,
            modelId: replay.modelId,
            signal: controller.signal,
            onToken: (chunk) => {
              repeated += chunk;
              pushStreamText(repeated);
            },
          },
        );
        if (!outcome.ok || !repeated.trim()) {
          if (outcome.ok === false && outcome.failure !== "cancelled") {
            toast.error(outcome.reason);
          }
          return;
        }

        /*
         * Pinned against the conditions the REPEAT actually ran under, not the
         * ones it was asked to run under. If the engine changed between the
         * two runs — a different adapter after a reload, another model tier —
         * that shows up as a condition change, which is the honest report and
         * the reason a difference in the text is not alarming.
         */
        const repeatPin = await pinRun({
          prompt: replay.prompt,
          answer: repeated,
          modelKey: replay.modelId,
          modelSha256: "",
          temperature: replay.temperature,
          topP: replay.topP,
          backend: route.adapter.id,
          at: new Date(startedAt),
        });
        setReruns((current) => ({
          ...current,
          [answerId]: { answer: repeated, verdict: compareRuns(original, repeatPin) },
        }));
        // Delivered: the comparison is on screen beside the original.
        billed.recordDelivery({
          prompt: replay.messages.map((message) => message.content).join("\n"),
          answer: repeated,
        });
      } finally {
        setStreaming(false);
        setStreamText("");
        abortRef.current = null;
        await billed.settle();
      }
    },
    [brain, pushStreamText, runPins, setStreamText, streaming],
  );

  async function regenerate() {
    const idx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (idx === -1) return;
    const realIdx = messages.length - 1 - idx;
    const userMsg = messages[realIdx];
    try {
      const created = await forkBeforeUser(userMsg, `${conversation.title} (retry branch)`);
      saveDraft(created.id, userMsg.content);
      await onRefreshList();
      onOpenConversation(created.id);
      toast.success("Created a retry branch with the prompt restored. Send when ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare the retry branch.");
    }
  }

  /**
   * Improve the draft using the engine on this machine.
   *
   * The old handler called a server function that sent the draft to Gemini
   * with no privacy gate. The failure message is also different now, and
   * deliberately so: "Could not improve prompt" told a user nothing, and the
   * commonest cause on a first visit is simply that the engine is still
   * preparing — which is not an error and resolves itself.
   */
  async function handleImprove() {
    if (!draft.trim()) return;

    /*
     * Rewriting a prompt runs the engine, so it is gated like anything else
     * that does. It is short and usually settles at the floor — but "small"
     * is not "free", and an ungated path is a way to spend an allowance
     * without it counting.
     */
    const billed = await beginBilledRequest({ surface: "chat" });
    if (!billed) return;

    setImproving(true);
    try {
      const route = await brain.route();
      if (!route.ok) {
        toast.error(route.reason);
        return;
      }
      const outcome = await improvePromptLocally(
        // Fast, deliberately: rewriting is a short bounded transformation, and
        // deliberating over it costs seconds on a machine with no graphics
        // acceleration while changing nothing about the result.
        brainReasonDeps(route, { think: false, ledger: sessionPerfLedger }),
        draft,
      );
      if (outcome.ok && outcome.improved) {
        setDraft(outcome.improved);
        // Delivered: the improved prompt is in the composer.
        billed.recordDelivery({ prompt: draft, answer: outcome.improved });
        toast.success("Prompt improved on this device");
      } else {
        toast.error(outcome.reason ?? "OCADE could not improve that prompt here.");
      }
    } finally {
      setImproving(false);
      await billed.settle();
    }
  }

  /**
   * Push-to-talk through the browser speech engine. The browser/OS may process
   * recognition remotely; only the optional wake listener requires an explicit
   * local-processing capability.
   */
  function toggleVoice() {
    const w = window as unknown as {
      speechSynthesis?: unknown;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      SpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const caps = detectVoiceCapabilities(w);
    if (!caps.recognition) {
      toast.error(caps.reason ?? "Voice input isn't available in this browser.");
      return;
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input isn't available in this browser.");
      return;
    }
    if (listeningRef.current) {
      (recogRef.current as SpeechRecognitionLike | null)?.stop();
      listeningRef.current = false;
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    // Interim results power live captions; without captions we only need finals.
    rec.interimResults = voicePrefs.captionsEnabled;
    // Only a verified language pack is used (decision #27).
    rec.lang = verifiedLanguage(voicePrefs.language);
    rec.onresult = (ev) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        const text = r?.[0]?.transcript ?? "";
        if (r?.isFinal) final += text;
        else interim += text;
      }
      /**
       * Redact BEFORE the transcript reaches anything that displays, stores or
       * transmits it. The draft feeds the composer, which feeds the model and
       * the saved conversation, so a spoken OTP left here would leak into all
       * three. Redaction is local and runs on interim results too, so a secret
       * never even flashes up in the live caption.
       */
      const safeFinal = redactSpokenSecrets(final).text;
      const safeInterim = redactSpokenSecrets(interim).text;
      if (voicePrefs.captionsEnabled) setCaption(safeFinal || safeInterim);
      if (safeFinal) setDraft((d) => (d ? d + " " : "") + safeFinal);
    };
    rec.onend = () => {
      listeningRef.current = false;
      setListening(false);
      setCaption("");
    };
    rec.onerror = (event: unknown) => {
      listeningRef.current = false;
      setListening(false);
      setCaption("");
      /*
       * SAY WHY. This handler used to reset the button and stop there, so a
       * denied microphone, an absent microphone and a recogniser that could
       * not be reached all looked the same: the microphone lights up for an
       * instant and goes out, with nothing to read and nothing to fix.
       *
       * `aborted` is what our own stop() produces, so it stays quiet —
       * reporting a deliberate stop as a failure is its own kind of noise.
       */
      const code =
        typeof event === "object" && event !== null && "error" in event
          ? String((event as { error?: unknown }).error ?? "")
          : "";
      if (code === "aborted") return;
      toast.error(describeRecognitionError(code));
    };
    recogRef.current = rec;
    try {
      rec.start();
      listeningRef.current = true;
      setListening(true);
    } catch {
      recogRef.current = null;
      listeningRef.current = false;
      setListening(false);
      setCaption("");
      toast.error("The browser couldn't start speech recognition.");
    }
  }

  /** Fall back to a verified pack rather than advertising an unverified one. */
  /**
   * The language voice will actually use.
   *
   * Delegates to `resolveVoiceLanguage` so region subtags resolve correctly —
   * matching on the exact code meant "en-GB" missed the "en" pack and fell back
   * for no reason.
   */
  function verifiedLanguage(code: string): string {
    return resolveVoiceLanguage(code).code;
  }

  /**
   * Optional local wake phrase (decision #23). It runs only when the recognition
   * engine explicitly exposes local processing; ordinary browser recognition
   * is not enough evidence for continuous background listening.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!voicePrefs.wakeEnabled || listening) return;
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      SpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const caps = detectVoiceCapabilities(w);
    if (!caps.wakePhrase) return;

    let stopped = false;
    const rec = new Ctor();
    rec.processLocally = true;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = verifiedLanguage(voicePrefs.language);
    rec.onresult = (ev) => {
      for (let i = 0; i < ev.results.length; i++) {
        const text = ev.results[i]?.[0]?.transcript ?? "";
        if (matchesWakePhrase(text)) {
          stopped = true;
          rec.stop();
          const greeting = buildGreeting(
            {
              style: voicePrefs.addressStyle,
              preferredName: voicePrefs.preferredName,
              customTitle: voicePrefs.preferredTitle,
              enabled: voicePrefs.greetingEnabled,
            },
            new Date().getHours(),
          );
          if (greeting) readAloud(greeting);
          toggleVoice();
          return;
        }
      }
    };
    // Keep the wake listener alive across the browser's idle auto-stops.
    rec.onend = () => {
      if (!stopped && voicePrefs.wakeEnabled) {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      }
    };
    rec.onerror = () => {
      /* transient — onend restarts */
    };
    try {
      rec.start();
    } catch {
      /* already running */
    }
    wakeRef.current = rec;
    return () => {
      stopped = true;
      try {
        rec.stop();
      } catch {
        /* not running */
      }
      wakeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voicePrefs.wakeEnabled, voicePrefs.language, listening]);

  /**
   * Read a reply aloud with the user's chosen OCADE voice. Speaking again
   * cancels the previous utterance, so the user can always interrupt.
   */
  function readAloud(raw: string) {
    if (typeof window === "undefined") return;
    /*
     * Publish the platform speech engine to the multimodal registry the first
     * time speech is actually used, so the registry holds the provider that
     * really ships rather than an empty list. Idempotent: the registry refuses
     * a duplicate id and this reports the reason instead of throwing.
     */
    registerSystemVoice(
      globalMultimodalRegistry,
      window as unknown as Parameters<typeof registerSystemVoice>[1],
    );
    /*
     * Citation markers are for the EYE, not the ear. Speaking "[S1]" comes out
     * as "bracket S one" mid-sentence and makes a cited answer hard to follow.
     * The markers stay in the written answer, where they are clickable.
     */
    /**
     * A secret must never be READ ALOUD — spoken output is audible to everyone
     * in the room and to any recording in progress, and unlike text it cannot
     * be un-seen. Redaction runs locally, before the utterance and before the
     * caption derived from it.
     */
    const spoken = redactForSpeech(stripCitationMarkers(raw));
    const text = spoken.text;
    if (spoken.containedProtected) {
      toast.warning("OCADE didn't read protected details aloud.", {
        description: `Removed before speaking: ${spoken.categories.join(", ")}.`,
      });
    }
    const caps = detectVoiceCapabilities(window as unknown as { speechSynthesis?: unknown });
    if (!caps.synthesis) {
      toast.error(caps.reason ?? "Read-aloud isn't available here.");
      return;
    }
    // Emergency mute wins over everything.
    if (voicePrefs.muted) {
      toast.error("OCADE Voice is muted. Unmute it in Settings → Voice.");
      return;
    }
    window.speechSynthesis.cancel(); // interruption / barge-in
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = verifiedLanguage(voicePrefs.language);
    const chosen = pickVoice(toVoiceOptions(window.speechSynthesis.getVoices()), {
      gender: voicePrefs.gender !== "unknown" ? voicePrefs.gender : (voiceGender ?? undefined),
      lang,
    });
    if (chosen) {
      const match = window.speechSynthesis
        .getVoices()
        .find((v) => (v.voiceURI ?? v.name) === chosen.id);
      if (match) utterance.voice = match;
    }
    utterance.lang = lang;
    utterance.rate = voicePrefs.rate;
    utterance.pitch = voicePrefs.pitch;
    utterance.onstart = () => {
      setSpeaking(true);
      // Output captions: show what is being READ ALOUD, not only what was
      // heard. Without this, a deaf or hard-of-hearing user — or anyone with
      // the sound off — gets nothing from read-aloud at all.
      if (voicePrefs.captionsEnabled) setSpokenCaption(text);
    };
    utterance.onend = () => {
      setSpeaking(false);
      setSpokenCaption("");
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setSpokenCaption("");
    };
    // Track progress through the utterance so the caption follows the voice
    // rather than dumping the whole answer at once.
    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (!voicePrefs.captionsEnabled) return;
      setSpokenCaption(captionSentenceAt(text, e.charIndex ?? 0));
    };
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setSpokenCaption("");
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/*
        Atmosphere, at the lowest opacity the composition survives at.
        Reading is the job of this screen: the backdrop sits behind an opaque
        message column and never competes with body text. Control + Work runs
        the same component at "cinematic"; Chat does not.
      */}
      <LivingIntelligenceBackdrop intensity="subtle" />
      {/*
        Top bar: what this chat is, and where its answers come from.
        Technical detail is deliberately absent — the raw model name lives in
        Settings › Models and About, and the badge here states the CAPABILITY
        and the locality, which is what a person needs to know before typing
        something private.
      */}
      <div className="flex h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border/40 px-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {conversation.title}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/*
            Sealed mode, beside the privacy badge on purpose. The badge states
            where this conversation is STORED; this states whether anything may
            leave while it is being answered. Related, different, and easy to
            confuse if they are not next to each other.
          */}
          <button
            type="button"
            onClick={() => {
              if (!sealed && !canStartSeal) return;
              setSealed((v) => !v);
              toast.info(
                sealed
                  ? "Conversation unsealed. OCADE can reach the network again."
                  : "Conversation sealed. Nothing can leave this device until you unseal it.",
                {
                  description: sealed
                    ? undefined
                    : "The on-device engine still works. Downloading one does not — unseal first if OCADE has not been set up here.",
                },
              );
            }}
            aria-pressed={sealed}
            disabled={!sealed && !canStartSeal}
            title={
              sealed
                ? "Sealed: nothing may leave this device"
                : canStartSeal
                  ? "Seal this conversation"
                  : "Send one message first so OCADE can finish preparing its local engine"
            }
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] transition",
              sealed
                ? "border-[color:var(--state-success-line-strong)] bg-[color:var(--state-success-surface)] text-[color:var(--state-success)]"
                : "border-border/60 text-muted-foreground hover:bg-accent",
            )}
          >
            {sealed ? (
              <LockIcon className="h-3 w-3" aria-hidden />
            ) : (
              <UnlockIcon className="h-3 w-3" aria-hidden />
            )}
            {sealed ? "Sealed" : "Seal"}
          </button>
          <EngineBadge
            status={{
              locality: localEngineReady ? "local" : modelInfo.locality,
              label: localEngineReady
                ? "OCADE Local"
                : capabilityLabelFor({ locality: modelInfo.locality }),
              online,
              detail: localEngineReady
                ? "Answers are generated on this computer. Nothing is sent anywhere."
                : devicePolicy.because,
              preparing: localEngine.status === "checking",
            }}
            onClick={() =>
              void navigate({ to: "/settings/$section", params: { section: "local-engine" } })
            }
          />
        </div>
      </div>

      {/* Conversation column */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto ocade-scroll">
        <div className="mx-auto w-full max-w-[820px] px-5 py-8">
          {loading ? (
            <div className="flex justify-center py-10 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : messages.length === 0 && !streaming ? (
            <div className="space-y-2 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                New conversation. Ask a question or paste content to begin.
              </p>
            </div>
          ) : (
            <div className={chatPrefs.density === "compact" ? "space-y-2.5" : "space-y-5"}>
              {/*
                The transcript renders through the SHARED chat components, the
                same ones the public demo uses. Two implementations of a message
                row is how a product ends up advertising an interface it does
                not ship — and it is also how the scroll-follow bug survived,
                because only one of the two ever got fixed.
              */}
              <MessageList
                conversationKey={conversation.id}
                messages={[
                  ...messages.map((message, index) => ({
                    ...toMessageView(message),
                    deliveryState: deliveryStateFor(messages, index, streaming),
                  })),
                  ...(streaming && streamText
                    ? [
                        {
                          id: "streaming",
                          role: "assistant" as const,
                          content: streamText,
                          createdAt: new Date().toISOString(),
                          engineLabel: capabilityLabelFor({ locality: modelInfo.locality }),
                          streaming: true,
                        },
                      ]
                    : []),
                ]}
                showTimestamps={chatPrefs.showTimestamps}
                renderMarkdown={chatPrefs.renderMarkdown}
                density={chatPrefs.density}
                /*
                 * The provenance receipt, under the answer it describes. Only
                 * present for answers this session actually generated — a
                 * message loaded from history was measured on some other run,
                 * possibly on another machine, and inventing a receipt for it
                 * would be exactly the unfounded claim the receipt exists to
                 * replace.
                 */
                renderFooter={(message) => {
                  const receipt = receipts[message.id];
                  const repeat = reruns[message.id];
                  const thread = sideThreads.get(message.id);
                  const asideOpen = openAside === message.id;
                  const hasAside = asideOpen || (thread?.length ?? 0) > 0;
                  if (!hasAside && !repeat && !(chatPrefs.showDiagnostics && receipt)) return null;
                  return (
                    <>
                      {/*
                        PLAN.md §8's side conversation, rendered UNDER its
                        anchor rather than inline. Inline would be the one
                        thing it must not be: a side question that appeared in
                        the transcript would be in the thread, which is what
                        somebody asked it not to be.
                      */}
                      {hasAside ? (
                        <SideThreadPanel
                          thread={thread ?? []}
                          open={asideOpen}
                          busy={asideBusy === message.id}
                          stream={asideBusy === message.id ? asideStream : ""}
                          onAsk={(question) => void askAside(message, question)}
                          onOpen={() => setOpenAside(message.id)}
                          onClose={() => setOpenAside(null)}
                          onDiscard={() => void discardAside(message.id)}
                        />
                      ) : null}
                      {chatPrefs.showDiagnostics && receipt ? (
                        <AnswerReceiptPanel receipt={receipt} className="pl-1" />
                      ) : null}
                      {/*
                        The repeat, BESIDE the original rather than instead of
                        it. Not behind the diagnostics switch: somebody who
                        asked for the comparison is owed the result of what
                        they just asked for.
                      */}
                      {repeat ? (
                        <AnswerDiff
                          before={message.content}
                          after={repeat.answer}
                          verdict={repeat.verdict}
                          className="mt-2"
                        />
                      ) : null}
                    </>
                  );
                }}
                actions={{
                  onSpeak: (m) => readAloud(m.content),
                  onReply: (m) => {
                    setDraft((current) => `${quoteForReply(m.content)}${current}`);
                    window.requestAnimationFrame(() =>
                      document.getElementById("ocade-composer")?.focus(),
                    );
                  },
                  onReact: (m, reaction) => {
                    if (m.role === "assistant") reactToMessage(m.id, reaction);
                  },
                  onEdit: (m) => {
                    const original = messages.find((x) => x.id === m.id);
                    if (original?.role === "user") void prepareEdit(original);
                  },
                  onSave: (m) => {
                    const index = messages.findIndex((x) => x.id === m.id);
                    const original = messages[index];
                    if (original?.role === "assistant" && !original.id.startsWith("local-")) {
                      void saveAssistantOutput(original, index);
                    }
                  },
                  onBranch: (m) => {
                    const original = messages.find((x) => x.id === m.id);
                    if (original?.role === "assistant" && !original.id.startsWith("local-")) {
                      void branchFrom(original);
                    }
                  },
                  onAside: (m) => {
                    // Offered on any assistant turn that exists, including one
                    // loaded from history — "what does this mean" is asked
                    // about old answers at least as often as new ones.
                    if (m.role === "assistant") setOpenAside(m.id);
                  },
                  // Offered only on the newest assistant turn: regenerating an
                  // answer from the middle of a thread would silently discard
                  // everything after it.
                  onRegenerate: (m) =>
                    m.id === messages.at(-1)?.id && m.role === "assistant"
                      ? void regenerate()
                      : undefined,
                  /*
                   * Only where this session produced the answer on this device
                   * and pinned the conditions. A message loaded from history,
                   * or produced by an online provider, has nothing meaningful
                   * to compare against — so the control is absent rather than
                   * present and misleading.
                   */
                  ...(messages.at(-1)?.role === "assistant" &&
                  runPins[messages.at(-1)!.id] &&
                  !reruns[messages.at(-1)!.id]
                    ? {
                        onRerun: (m: ChatMessageView) =>
                          m.id === messages.at(-1)?.id ? void rerunAnswer(m.id) : undefined,
                      }
                    : {}),
                }}
              />
              {/* Visual response is OFFERED, never auto-rendered (decision #41). */}
              {!streaming && lastAssistantText ? (
                visualAnswer ? (
                  <ErrorBoundary label="Visual response">
                    <VisualResponse
                      answer={visualAnswer}
                      onClose={() => setVisualAnswer(null)}
                      onNarrate={(t) => readAloud(t)}
                      projectId={conversation.project_id}
                      conversationId={conversation.id}
                    />
                  </ErrorBoundary>
                ) : (
                  <button
                    onClick={() => setVisualAnswer(lastAssistantText)}
                    className="mt-2 self-start rounded-md border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Create visual response
                  </button>
                )
              ) : null}
              {/*
                What retrieval actually did, shown next to the answer it shaped.
                Rendered while streaming as well as after it: a user watching an
                answer form from four sections of a 200-page report needs to
                know that before they read it, not once they have finished.
              */}
              {retrievalNotice ? (
                <div
                  role="status"
                  className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2 text-[12px] text-muted-foreground"
                >
                  <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{retrievalNotice}</span>
                </div>
              ) : null}

              {/*
                Whether this conversation is the one that happened.

                Rendered only once there is something to verify — an integrity
                panel on an empty chat is a claim about nothing, and it would
                train people to skip past it before it ever mattered.
              */}
              {chatPrefs.showDiagnostics && ledgerRef.current.length > 0 ? (
                <ConversationIntegrity
                  key={ledgerVersion}
                  chain={ledgerRef.current}
                  tree={treeRef.current}
                  messages={messages.map((m) => m.content)}
                  className="mt-3"
                />
              ) : null}

              {/*
                What this conversation cost on this machine. Hidden until there
                is something real to report — a running total of zero is noise.

                This reports measured on-device work only. It has no payment
                meter and no network-inference comparison.
              */}
              {costs.length > 0 ? (
                <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
                  {describeTotals(totalCost(costs))}
                </p>
              ) : null}
              {!streaming && citationError ? (
                <div className="mt-3 rounded-lg border border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-wash)] p-3 text-xs text-muted-foreground">
                  Citation evidence could not be restored or saved: {citationError}
                </div>
              ) : null}
              {!streaming && citations.length > 0 ? (
                <div className="mt-3 rounded-lg border border-border/60 bg-secondary/25 p-3">
                  {/*
                    A real heading, associated with the list via aria-labelledby.
                    A bare <p> left the list unlabelled, so a screen reader
                    announced "list, 2 items" with no indication these are the
                    sources backing the answer.
                  */}
                  <h3
                    id={`sources-${conversation.id}`}
                    className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Sources
                  </h3>
                  <ul
                    aria-labelledby={`sources-${conversation.id}`}
                    className="flex flex-col gap-1.5"
                  >
                    {citations.map((c) => {
                      const where = describeLocator(c.locator);
                      /*
                       * A web source is rendered as a link so it can be
                       * checked, and ONLY through `safeCitationHref`. A
                       * citation's URL comes from what a model produced about
                       * a page it read, and an unchecked href is `javascript:`
                       * away from being stored XSS on click.
                       */
                      const href = safeCitationHref(c.url);
                      return (
                        <li key={c.sourceId} className="text-[12px]">
                          <span className="mr-1.5 rounded bg-secondary px-1 py-0.5 text-[10px] text-muted-foreground">
                            {c.sourceId}
                          </span>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
                            >
                              {c.name}
                            </a>
                          ) : (
                            <span className="font-medium text-foreground">{c.name}</span>
                          )}
                          {c.domain ? (
                            <span className="text-muted-foreground"> · {c.domain}</span>
                          ) : null}
                          {where ? <span className="text-muted-foreground"> · {where}</span> : null}
                          {/*
                            TWO DATES, BECAUSE THEY ANSWER DIFFERENT QUESTIONS.
                            "As of" is what the page claimed; "read" is when
                            OCADE looked. A page from 2019 fetched this morning
                            and a page from this morning fetched in 2019 are not
                            the same evidence, and one date cannot say which.
                          */}
                          {c.publishedAt || c.retrievedAt ? (
                            <span className="ml-1 text-[10px] text-muted-foreground/80">
                              {c.publishedAt ? `as of ${c.publishedAt}` : ""}
                              {c.publishedAt && c.retrievedAt ? " · " : ""}
                              {c.retrievedAt ? `read ${formatters.dateTime(c.retrievedAt)}` : ""}
                            </span>
                          ) : null}
                          {c.snippet ? (
                            <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                              “{c.snippet}”
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {/*
                What OCADE is DOING, while it does it.
                
                A spinner reading "thinking" while the product opens a window is
                not a lie so much as a missed opportunity: the person can only
                interrupt something they can see. Each line is a step, replaced
                by its outcome as it completes.
              */}
              {toolSteps.length > 0 ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {toolSteps.map((step, index) => (
                    <li key={`${step}-${index}`} className="flex items-center gap-2">
                      {index === toolSteps.length - 1 && streaming ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
                          aria-hidden
                        />
                      )}
                      {step}
                    </li>
                  ))}
                </ul>
              ) : null}
              {/*
                THE ORB, WHERE THE SPINNER USED TO BE.

                A spinner says "something is happening" and nothing else — the
                same three dots whether OCADE is deciding, reading a page, or
                changing a file on the machine. The orb says which, in colour,
                motion and size at once, and reads the same here as it does in
                Work, because it is the same component driven by the same
                states.
              */}
              {streaming || toolApproval ? (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <OcadeOrb
                    size={34}
                    decorative
                    state={orbStateFor({
                      phase: toolSteps.length > 0 ? "controlling" : "thinking",
                      awaitingApproval: toolApproval !== null,
                    })}
                  />
                  <span role="status" aria-live="polite">
                    {toolApproval
                      ? "Waiting for you"
                      : toolSteps.length > 0
                        ? "Working"
                        : "OCADE is thinking…"}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Composer pinned to bottom */}
      {/*
        The composer stays READABLE over the backdrop. `bg-background/92` is
        near-opaque on purpose — a translucent input over a moving scene is the
        exact place where "looks alive" starts costing people the ability to
        proof-read what they are about to send.
      */}
      <div className="border-t border-border/40 bg-background/92 px-5 py-3">
        <div className="mx-auto w-full max-w-[820px]">
          {/*
            What will be read, ABOVE the composer — the only place the
            disclosure is still actionable. A note under the reply explains
            what already happened; this lets the user change it first.
          */}
          <ContextTray entries={contextEntries} onRemove={removeContextEntry} className="mb-2" />
          {/*
            Removing a source must be reversible. Without this the file simply
            vanishes from the tray with no way back, and the user is left
            wondering why OCADE has stopped knowing about a document that is
            still plainly in the project.
          */}
          {excludedContext.size > 0 ? (
            <button
              type="button"
              onClick={() => setExcludedContext(new Set())}
              className="mb-2 text-[11.5px] text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
            >
              {excludedContext.size} project {excludedContext.size === 1 ? "file is" : "files are"}{" "}
              being left out — use everything again
            </button>
          ) : null}

          {/* Microphone privacy indicator + live captions (Plan §22). */}
          {listening || speaking ? (
            <div className="mb-1.5 flex items-start gap-2 rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-[12px]">
              <span
                className={cn(
                  "mt-1 inline-block h-2 w-2 shrink-0 rounded-full",
                  listening ? "animate-pulse bg-destructive" : "bg-[color:var(--state-success)]",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="text-muted-foreground">
                  {listening ? "Microphone on — OCADE is listening" : "OCADE is speaking"}
                </span>
                {/*
                  Two caption tracks: what was HEARD while listening, and what
                  is being READ ALOUD while speaking. aria-live so a screen
                  reader announces the spoken text as it progresses.
                */}
                {voicePrefs.captionsEnabled && caption ? (
                  <span className="mt-0.5 block truncate text-foreground">{caption}</span>
                ) : null}
                {voicePrefs.captionsEnabled && spokenCaption ? (
                  <span
                    aria-live="polite"
                    className="mt-0.5 block text-foreground"
                    data-testid="spoken-caption"
                  >
                    {spokenCaption}
                  </span>
                ) : null}
              </span>
              <button
                onClick={() => {
                  stopSpeaking();
                  if (listening) toggleVoice();
                }}
                className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {listening ? "Stop listening" : "Stop speaking"}
              </button>
              <button
                onClick={() => {
                  emergencyMute();
                  stopSpeaking();
                  if (listening) toggleVoice();
                  toast.success("Voice muted.");
                }}
                title="Emergency mute — stop all voice immediately"
                className="shrink-0 text-[11px] text-destructive hover:underline"
              >
                Mute
              </button>
            </div>
          ) : null}
          <PreparationStatus />
          {/*
            THREE CHOICES, NAMED FOR WHAT THEY GIVE THE PERSON.

            This row said "Engine: OCADE Automatic / OCADE On this device", which
            is two ways of saying the same thing — both run on the device — and
            neither answers the question somebody actually has, which is whether
            they want the answer sooner or better.

            Fast and Thinking are that question. Local Intelligence is the third
            because it is a genuinely different promise: never leave this device
            for anything, including looking something up. It is the privacy
            choice, not a speed choice, which is why it sits alongside rather
            than inside them.
          */}
          <div className="mb-1.5 flex items-center gap-1 text-[11px]">
            <span className="text-muted-foreground">Mode</span>
            {MODES.map((mode) => {
              const active =
                mode.id === "local"
                  ? engineTier === "local"
                  : engineTier === "auto" && chatPrefs.thinking === (mode.id === "thinking");
              const disabled = mode.id === "local" && localEngine.status !== "ready";
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => {
                    if (mode.id === "local") {
                      setEngineTier("local");
                      return;
                    }
                    setEngineTier("auto");
                    setChatPrefs({ thinking: mode.id === "thinking" });
                  }}
                  title={disabled ? "OCADE is still getting ready on this device." : mode.hint}
                  className={cn(
                    "rounded px-2 py-0.5 transition-colors",
                    active
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  {mode.label}
                </button>
              );
            })}

            <span className="mx-1 h-3 w-px bg-border/70" />
            <span className="text-muted-foreground">Voice</span>
            {(["female", "male"] as const).map((g) => (
              <button
                aria-pressed={voiceGender === g}
                key={g}
                type="button"
                onClick={() => chooseVoice(g)}
                title={`Use the ${g} OCADE voice for read-aloud`}
                className={cn(
                  "rounded px-2 py-0.5 capitalize transition-colors",
                  voiceGender === g
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {g}
              </button>
            ))}
            <button
              type="button"
              onClick={stopSpeaking}
              title="Stop speaking"
              className="rounded px-2 py-0.5 text-muted-foreground hover:text-foreground"
            >
              Stop
            </button>
          </div>
          <Composer
            draft={draft}
            setDraft={setDraft}
            attachments={attachments}
            setAttachments={setAttachments}
            onSubmit={() => sendMessage()}
            onTypingStarted={warmLocalEngine}
            onStop={stop}
            streaming={streaming}
            permission={permission}
            setPermission={setPermission}
            model={model}
            setModel={setModel}
            onImprove={handleImprove}
            improving={improving}
            onToggleVoice={toggleVoice}
            listening={listening}
            onRegenerate={messages.some((m) => m.role === "assistant") ? regenerate : undefined}
            projectAssigned={Boolean(conversation.project_id)}
            onSaveAttachmentToProject={
              conversation.project_id ? saveAttachmentToProject : undefined
            }
          />
        </div>
      </div>

      {/*
        The approval card.

        It names the ACTION and, when the permission layer found one, the
        specific reason it stopped — "may discard uncommitted changes" is what
        makes the difference between a question a person answers and one they
        dismiss. Closing it without choosing is a refusal, because a dialog
        that treats silence as yes is not asking anything.
      */}
      <Dialog
        open={toolApproval !== null}
        onOpenChange={(next) => {
          if (next) return;
          toolApprovalResolve.current?.(false);
          toolApprovalResolve.current = null;
          setToolApproval(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{toolApproval?.question ?? "Go ahead?"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{toolApproval?.decision.reason}</p>
          {toolApproval?.decision.warning ? (
            <p className="rounded-lg border border-primary/25 bg-primary/[0.06] p-3 text-sm text-foreground/85">
              {toolApproval.decision.warning}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                toolApprovalResolve.current?.(false);
                toolApprovalResolve.current = null;
                setToolApproval(null);
              }}
            >
              Not now
            </Button>
            <Button
              onClick={() => {
                toolApprovalResolve.current?.(true);
                toolApprovalResolve.current = null;
                setToolApproval(null);
              }}
            >
              Go ahead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
