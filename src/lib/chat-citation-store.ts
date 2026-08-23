import type { Citation, SourceLocator } from "./ocade-citations";
import type { ArtifactOutcome } from "./artifacts/store";

const STORAGE_KEY = "ocade.chat-citations.v1";
const MAX_RECORDS = 5_000;

interface CitationRecord {
  conversationId: string;
  messageId: string;
  citations: Citation[];
  savedAt: string;
}

function validLocator(value: unknown): value is SourceLocator {
  if (!value || typeof value !== "object") return false;
  const locator = value as SourceLocator;
  return (
    (locator.line === undefined || (Number.isInteger(locator.line) && locator.line > 0)) &&
    (locator.page === undefined || (Number.isInteger(locator.page) && locator.page > 0)) &&
    (locator.sheet === undefined || typeof locator.sheet === "string") &&
    (locator.section === undefined || typeof locator.section === "string")
  );
}

function validCitation(value: unknown): value is Citation {
  if (!value || typeof value !== "object") return false;
  const citation = value as Partial<Citation>;
  return (
    typeof citation.sourceId === "string" &&
    /^(?:S|W)\d+$/.test(citation.sourceId) &&
    typeof citation.name === "string" &&
    typeof citation.kind === "string" &&
    validLocator(citation.locator) &&
    (citation.snippet === null || typeof citation.snippet === "string") &&
    (citation.provenance === undefined ||
      citation.provenance === "attached_document" ||
      citation.provenance === "project_context" ||
      citation.provenance === "internet_evidence") &&
    (citation.url === undefined || typeof citation.url === "string") &&
    (citation.domain === undefined || typeof citation.domain === "string") &&
    (citation.publishedAt === undefined ||
      citation.publishedAt === null ||
      typeof citation.publishedAt === "string") &&
    (citation.retrievedAt === undefined || typeof citation.retrievedAt === "string")
  );
}

function validRecord(value: unknown): value is CitationRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CitationRecord>;
  return (
    typeof record.conversationId === "string" &&
    typeof record.messageId === "string" &&
    Array.isArray(record.citations) &&
    record.citations.length <= 10 &&
    record.citations.every(validCitation) &&
    typeof record.savedAt === "string"
  );
}

function read(): ArtifactOutcome<CitationRecord[]> {
  const storage = globalThis.localStorage;
  if (!storage)
    return { ok: false, reason: "Browser storage is unavailable for citation history." };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ok: true, data: [], evidence: "No citation history stored." };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_RECORDS || !parsed.every(validRecord)) {
      return { ok: false, reason: "Citation history is corrupt; nothing was changed." };
    }
    return { ok: true, data: parsed, evidence: `${parsed.length} citation records read.` };
  } catch {
    return { ok: false, reason: "Citation history is corrupt; nothing was changed." };
  }
}

function write(records: CitationRecord[]): ArtifactOutcome<number> {
  const storage = globalThis.localStorage;
  if (!storage)
    return { ok: false, reason: "Browser storage is unavailable for citation history." };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(records));
    return {
      ok: true,
      data: records.length,
      evidence: `${records.length} citation records stored.`,
    };
  } catch (error) {
    return {
      ok: false,
      reason: `Citation history could not be saved: ${
        error instanceof Error ? error.message : "storage refused it"
      }.`,
    };
  }
}

export function saveChatCitations(input: {
  conversationId: string;
  messageId: string;
  citations: Citation[];
  now?: Date;
}): ArtifactOutcome<CitationRecord> {
  if (!input.conversationId || !input.messageId) {
    return { ok: false, reason: "A conversation and exact assistant message are required." };
  }
  if (input.citations.length === 0 || input.citations.length > 10) {
    return { ok: false, reason: "Citation history requires 1 to 10 verified citations." };
  }
  if (!input.citations.every(validCitation)) {
    return { ok: false, reason: "Citation history contains invalid source evidence." };
  }
  const current = read();
  if (!current.ok) return current;
  const record: CitationRecord = {
    conversationId: input.conversationId,
    messageId: input.messageId,
    citations: input.citations,
    savedAt: (input.now ?? new Date()).toISOString(),
  };
  const withoutOld = current.data.filter(
    (row) => row.conversationId !== input.conversationId || row.messageId !== input.messageId,
  );
  const next = [record, ...withoutOld].slice(0, MAX_RECORDS);
  const saved = write(next);
  if (!saved.ok) return saved;
  return { ok: true, data: record, evidence: "Citation evidence saved for this response." };
}

export function getChatCitations(
  conversationId: string,
  messageId: string,
): ArtifactOutcome<Citation[] | null> {
  const current = read();
  if (!current.ok) return current;
  const record = current.data.find(
    (row) => row.conversationId === conversationId && row.messageId === messageId,
  );
  return {
    ok: true,
    data: record?.citations ?? null,
    evidence: record
      ? "Citation evidence restored."
      : "No citation evidence stored for this response.",
  };
}

/**
 * Remove every citation that quotes one source, across all conversations.
 *
 * WHY THIS EXISTS. A citation carries a `snippet` — a verbatim excerpt of the
 * document it cites. Deleting the file while leaving its citations behind means
 * the user asked for a document to be gone and its text is still on disk, still
 * rendered under old assistant replies. The excerpt is small, which is exactly
 * why it gets forgotten, and it is still their content.
 *
 * Matched on `name`, because that is the only identifier a Citation carries.
 * Records that end up with no citations left are dropped entirely rather than
 * kept as empty shells — an empty record still names the conversation.
 */
export function removeCitationsForSource(name: string): ArtifactOutcome<{ removed: number }> {
  const target = name.trim();
  if (!target) return { ok: false, reason: "A source name is required." };
  const current = read();
  if (!current.ok) return current;

  let removed = 0;
  const next: CitationRecord[] = [];
  for (const row of current.data) {
    const kept = row.citations.filter((citation) => citation.name !== target);
    removed += row.citations.length - kept.length;
    if (kept.length > 0) next.push({ ...row, citations: kept });
  }

  if (removed === 0) {
    return { ok: true, data: { removed: 0 }, evidence: "No stored citations quote that source." };
  }
  const saved = write(next);
  if (!saved.ok) return saved;
  return {
    ok: true,
    data: { removed },
    evidence: `${removed} stored ${removed === 1 ? "excerpt" : "excerpts"} of “${target}” deleted.`,
  };
}

export function removeConversationCitations(
  conversationId: string,
): ArtifactOutcome<{ removed: number }> {
  const current = read();
  if (!current.ok) return current;
  const next = current.data.filter((row) => row.conversationId !== conversationId);
  const removed = current.data.length - next.length;
  if (removed === 0) {
    return { ok: true, data: { removed: 0 }, evidence: "No local citation evidence to delete." };
  }
  const saved = write(next);
  if (!saved.ok) return saved;
  return { ok: true, data: { removed }, evidence: `${removed} citation records deleted.` };
}
