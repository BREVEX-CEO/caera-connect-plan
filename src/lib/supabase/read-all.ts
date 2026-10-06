/**
 * Reading a whole list from PostgREST, which is not what `select()` does.
 *
 * PostgREST refuses to return more than `db-max-rows` — 1,000 by default on
 * Supabase — and it does so SILENTLY. The response is a well-formed array of
 * the first N rows: no error, no header the client checks, no marker of any
 * kind. So a query written as "every message in this conversation" is really
 * "the first thousand messages in this conversation", and the difference only
 * shows up as a transcript that is missing its beginning, an export that ends
 * early, or a branch taken from a conversation whose history was truncated.
 *
 * Two helpers, because the two cases want different answers:
 *
 *   `readAllPages` — for lists that must be COMPLETE to be correct: a
 *   transcript, an export, the history a branch is cut from. It keeps asking
 *   until a short page proves the end.
 *
 *   `LIST_CAP` — for lists a person browses, where a bound is honest and
 *   unbounded growth is not. A sidebar does not need ten thousand rows; it
 *   needs the most recent few hundred and a way to search for the rest.
 */

/** What a browsable list is allowed to return in one go. */
export const LIST_CAP = 500;

/** Rows per request while walking a list that has to be complete. */
const PAGE_ROWS = 500;

/**
 * Enough pages for any real account, and a bounded mistake rather than a tab
 * that grows until the browser kills it if a server keeps answering in full.
 */
const MAX_PAGES = 200;

export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Read every row a query matches, in pages.
 *
 * `build` is handed an inclusive row range and returns the PostgREST promise
 * for it — that is `.range(from, to)` on an otherwise-complete query. Range
 * paging rather than keyset because these callers order by `created_at`, which
 * is not unique, so there is no key to seek on; the reads are of settled
 * history where a shifting window is not a concern.
 */
export async function readAllPages<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const out: T[] = [];
  // One page past the cap only to prove the end: exactly MAX_PAGES full pages is complete.
  for (let page = 0; page <= MAX_PAGES; page += 1) {
    const from = page * PAGE_ROWS;
    const { data, error } = await build(from, from + PAGE_ROWS - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (page === MAX_PAGES && rows.length > 0) break;
    out.push(...rows);
    // Short page means the end. A full page might also be the end, and the
    // next request is what settles that rather than an assumption.
    if (rows.length < PAGE_ROWS) return out;
  }
  throw new Error(
    `This list is larger than ${MAX_PAGES * PAGE_ROWS} rows, which is past what one request can serve.`,
  );
}
