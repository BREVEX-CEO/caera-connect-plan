/** UPLOAD-06: a deletion fences uploads begun before it. Pure functions, used by library.functions. */

/**
 * A UUID version 7: its first 48 bits are when the upload began (ms since 1970), so finishing it
 * can tell whether the person emptied their Library after it began (UPLOAD-06).
 */
export function timeOrderedId(now = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 6; i++) bytes[i] = Math.floor(now / 2 ** (8 * (5 - i))) % 256;
  bytes[6] = 0x70 | (bytes[6] & 0x0f);
  bytes[8] = 0x80 | (bytes[8] & 0x3f);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** When an upload id says it began; 0 for an id that carries no time (begun before this rule). */
export function uploadBeganAt(id: string): number {
  const hex = id.replace(/-/g, "");
  return hex[12] === "7" ? parseInt(hex.slice(0, 12), 16) : 0;
}

/** Why a finished upload may not be listed: deleted, or begun before the Library was emptied. */
export function fencedUpload(
  id: string,
  tombstoned: boolean,
  clearedAt: string | null | undefined,
): string | null {
  if (tombstoned) return "That upload was deleted.";
  if (clearedAt && uploadBeganAt(id) < Date.parse(clearedAt))
    return "Your Library was emptied after this upload began, so it was not kept.";
  return null;
}
