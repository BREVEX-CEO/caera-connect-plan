/**
 * WHAT BROKE, KEPT WHERE THE PERSON IT HAPPENED TO CAN READ IT.
 *
 * Until now a crash reached `reportRuntimeError`, which forwards to two globals
 * that exist only inside a development preview. On ocade.in they are undefined,
 * so both calls are no-ops — which is exactly the privacy property this product
 * wants, and it left nothing behind at all. Settings › Diagnostics offered
 * "error triage" and had no errors to triage. Somebody whose sidebar went blank
 * yesterday had nothing to show support but a sentence.
 *
 * So the journal is local and stays local: a ring buffer in this browser's own
 * storage, shown on the diagnostics screen, copyable by its owner, and never
 * sent anywhere by anything in this file. There is no endpoint here to disable
 * later, which is the point — the previous design was safe because nothing was
 * listening, and this one is safe because there is nothing to listen to.
 *
 * REDACTED BEFORE IT IS WRITTEN, NOT BEFORE IT IS SHOWN. A stack frame carries
 * URLs, and a URL carries query strings, and a query string carries tokens. A
 * message carries whatever was interpolated into it, which on an auth path is
 * an email address. Redacting at read time means the secret was on disk in the
 * meantime, so it happens on the way in.
 */

const STORAGE_KEY = "ocade.diagnostics.errors.v1";

/**
 * Fifty. Enough to cover the burst that usually follows one real failure —
 * a boundary error, then the retries, then the unhandled rejection — without
 * turning the browser's storage quota into a log file.
 */
export const JOURNAL_LIMIT = 50;

export interface JournalEntry {
  /** ISO timestamp. */
  at: string;
  /** Where in the product it happened: a boundary name, or a hook. */
  where: string;
  /** The route, which is the single most useful field for reproducing it. */
  route: string;
  message: string;
  stack?: string;
}

/*
 * Patterns whose VALUE is never worth keeping. Ordered longest-first so a
 * bearer token is not first mangled by the generic long-token rule.
 */
const REDACTIONS: Array<[RegExp, string]> = [
  // JWTs, which is what a Supabase session is.
  [/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g, "[token]"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]"],
  // Anything a URL calls a secret, however it spells it.
  [
    /([?&](?:access_token|refresh_token|token|key|apikey|api_key|code|secret|password)=)[^&\s"']+/gi,
    "$1[redacted]",
  ],
  [/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[key]"],
  // A long unbroken token-looking run. Deliberately last and deliberately
  // conservative: 40+ characters of base64 alphabet is not prose.
  [/\b[A-Za-z0-9_-]{40,}\b/g, "[opaque]"],
];

/** Strip anything that should not be written down, before writing it down. */
export function redactForJournal(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out;
}

function read(): JournalEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as JournalEntry[]) : [];
  } catch {
    // Corrupt or unavailable storage is not worth an error about errors.
    return [];
  }
}

function write(entries: JournalEntry[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /*
     * Full quota, or private browsing. Dropping the record is the right
     * failure: a diagnostics journal must never be the thing that breaks the
     * page it is trying to describe.
     */
  }
}

/** Newest first, because the last thing that happened is what you came for. */
export function readErrorJournal(): JournalEntry[] {
  return read();
}

export function clearErrorJournal(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Nothing to do, and nothing worth saying. */
  }
}

/**
 * Record one failure. Never throws — a journal that can break the app it is
 * describing is worse than no journal.
 */
export function recordErrorInJournal(entry: {
  where: string;
  route: string;
  message: string;
  stack?: string;
  at?: string;
}): void {
  try {
    const next: JournalEntry = {
      at: entry.at ?? new Date().toISOString(),
      where: redactForJournal(entry.where).slice(0, 80),
      route: redactForJournal(entry.route).slice(0, 200),
      message: redactForJournal(entry.message).slice(0, 500),
      // Four frames. Past that it is somebody else's minified bundle.
      stack: entry.stack
        ? redactForJournal(entry.stack).split("\n").slice(0, 5).join("\n").slice(0, 800)
        : undefined,
    };
    write([next, ...read()].slice(0, JOURNAL_LIMIT));
  } catch {
    /* See above. */
  }
}

/** The whole journal as text, for pasting into a support message. */
export function formatErrorJournal(entries: JournalEntry[] = read()): string {
  if (entries.length === 0) return "No errors recorded on this device.";
  return entries
    .map((e) => {
      const head = `${e.at}  ${e.where}  ${e.route}\n  ${e.message}`;
      return e.stack ? `${head}\n${e.stack.replace(/^/gm, "  ")}` : head;
    })
    .join("\n\n");
}
