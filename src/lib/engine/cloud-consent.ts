/**
 * Which conversations the user has allowed to use OCADE Cloud.
 *
 * ASKED ONCE PER CONVERSATION, NOT ONCE PER MESSAGE. A vault-backed chat that
 * interrogated the user on every turn would train them to click yes without
 * reading, which is the opposite of informed consent. Asked once, remembered,
 * and revocable — the three properties that make a permission real.
 *
 * WHY PER CONVERSATION AND NOT GLOBAL. A single global "allow cloud" switch
 * cannot express the thing people actually want: this chat about a contract
 * stays here, that chat about a recipe can go anywhere. Consent scoped to the
 * unit the user thinks in is consent they can give accurately.
 *
 * STORED LOCALLY, DELIBERATELY. The grant is a statement about a device's
 * willingness to send data, so syncing it would let a phone speak for a laptop.
 * Clearing browser data revokes everything, which is the correct direction to
 * fail in.
 */

const KEY = "caera:cloud-consent:v1";

export interface CloudConsentRecord {
  conversationId: string;
  grantedAt: number;
}

function safeLocal(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readAll(storage?: Pick<Storage, "getItem">): CloudConsentRecord[] {
  const store = storage ?? safeLocal();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is CloudConsentRecord =>
        typeof (row as CloudConsentRecord)?.conversationId === "string" &&
        typeof (row as CloudConsentRecord)?.grantedAt === "number",
    );
  } catch {
    // Corrupt storage reads as "nothing granted". Failing closed is the only
    // safe direction for a permission.
    return [];
  }
}

function writeAll(rows: CloudConsentRecord[], storage?: Pick<Storage, "setItem">): void {
  const store = storage ?? safeLocal();
  try {
    store?.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* Private browsing. The grant holds for this page's lifetime only, which
       is a safe degradation: the user is asked again next time. */
  }
}

export function hasCloudConsent(
  conversationId: string,
  storage?: Pick<Storage, "getItem">,
): boolean {
  return readAll(storage).some((row) => row.conversationId === conversationId);
}

export function grantCloudConsent(
  conversationId: string,
  now: number = Date.now(),
  storage?: Pick<Storage, "getItem" | "setItem">,
): void {
  const rows = readAll(storage);
  if (rows.some((row) => row.conversationId === conversationId)) return;
  writeAll([...rows, { conversationId, grantedAt: now }], storage);
}

export function revokeCloudConsent(
  conversationId: string,
  storage?: Pick<Storage, "getItem" | "setItem">,
): void {
  writeAll(
    readAll(storage).filter((row) => row.conversationId !== conversationId),
    storage,
  );
}

/** Every grant, newest first, for the settings screen. */
export function listCloudConsent(storage?: Pick<Storage, "getItem">): CloudConsentRecord[] {
  return [...readAll(storage)].sort((a, b) => b.grantedAt - a.grantedAt);
}

/**
 * Revoke everything.
 *
 * The control someone reaches for when they have changed their mind about the
 * whole idea, so it must not require visiting each conversation.
 */
export function revokeAllCloudConsent(storage?: Pick<Storage, "setItem">): void {
  writeAll([], storage);
}
