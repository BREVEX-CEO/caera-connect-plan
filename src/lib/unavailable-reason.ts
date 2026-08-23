/**
 * Why a database-backed panel could not load — decided, not guessed.
 *
 * DEFECT UI-01. Three routes (`ocade.projects`, `ocade.automations`,
 * `settings.usage`) caught ANY load failure and rendered it as
 *
 *   <h3>Projects need the database migration</h3>
 *   <p>{error.message} The migration, RLS policies … are ready to apply.</p>
 *
 * Two things were wrong with that, and both reach the user:
 *
 *  1. It asserted a cause it had not established. A dropped connection, an
 *     expired session, an RLS denial or a 500 all produced a confident claim
 *     that the schema was missing, sending the reader to fix a database that
 *     was fine.
 *  2. It spliced a raw exception message into user-facing prose. Under the
 *     component audit that surfaced as "No Start context found in
 *     AsyncLocalStorage. Make sure you are using the function within the server
 *     runtime." presented as product copy — internal wording no reader can act
 *     on, and not something to put in front of them.
 *
 * So the classification happens here, from the error itself, and the raw text
 * is kept as a clearly-labelled technical detail rather than passed off as the
 * explanation.
 */

export interface UnavailableState {
  /** Heading. Claims a missing migration ONLY when the error says so. */
  title: string;
  /** User-facing sentence. Never contains a raw exception message. */
  description: string;
  /** The underlying error text, shown as a technical detail or not at all. */
  detail: string | null;
  /** True only when the error genuinely indicates the schema is not applied. */
  migrationMissing: boolean;
}

/**
 * PostgREST/PostgreSQL signals for "this table is not there".
 * `42P01` is undefined_table; `PGRST205` is PostgREST's schema-cache miss.
 */
const MISSING_TABLE = [
  /relation\s+"?[\w.]+"?\s+does not exist/i,
  /could not find the table/i,
  /\bPGRST205\b/,
  /\b42P01\b/,
  /in the schema cache/i,
];

/** The connection, rather than the database, is the problem. */
const OFFLINE = [
  /failed to fetch/i,
  /network\s?error/i,
  /load failed/i,
  /fetch failed/i,
  /net::/i,
  /err_internet_disconnected/i,
  /the internet connection appears to be offline/i,
];

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export interface UnavailableCopy {
  /** Heading used when the schema genuinely is not applied. */
  migrationTitle: string;
  /** Sentence used when the schema genuinely is not applied. */
  migrationNote: string;
  /** Heading used for every other failure. */
  loadTitle: string;
}

export function classifyUnavailable(error: unknown, copy: UnavailableCopy): UnavailableState {
  const raw = messageOf(error).trim();
  const detail = raw || null;

  if (MISSING_TABLE.some((p) => p.test(raw))) {
    return {
      title: copy.migrationTitle,
      description: copy.migrationNote,
      detail,
      migrationMissing: true,
    };
  }

  if (OFFLINE.some((p) => p.test(raw))) {
    return {
      title: copy.loadTitle,
      description:
        "The connection failed, so this could not be loaded. Check your network and try again.",
      detail,
      migrationMissing: false,
    };
  }

  return {
    title: copy.loadTitle,
    description: "Something went wrong while loading this. Try again in a moment.",
    detail,
    migrationMissing: false,
  };
}
