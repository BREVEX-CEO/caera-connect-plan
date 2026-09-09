/**
 * A CONVERSATION THAT LEAVES NOTHING BEHIND — PLAN.md §8.
 *
 * §8 asks for "incognito conversations excluded from ordinary history and
 * memory". Two exclusions, and both have to be real: a conversation that stayed
 * out of the sidebar while its messages sat in the vault would be a privacy
 * feature that lies, which is worse than not having one.
 *
 * WHAT IT DOES. Nothing about the conversation is written anywhere: no
 * conversation record, no message record, no queued sync obligation, and no
 * memory. It exists in the tab and ends with it. Memory is excluded in BOTH
 * directions — not written and not read — because excluding only the write is
 * the weaker half: somebody who goes incognito is saying "do not connect this
 * to me", and a reply shaped by what OCADE remembers about them connects it.
 *
 * WHAT IT DOES NOT DO, and the product says so rather than letting somebody
 * assume otherwise. It is not anonymity: the request still reaches whichever
 * intelligence answers it, and on Online Intelligence that is a provider that
 * has its own logs and its own retention. It does not erase what OCADE already
 * remembers. And it does not hide anything from somebody who can read the
 * screen. `INCOGNITO_CLAIMS` is the exact list, in the words the interface
 * uses, so a test can hold the copy to it — every one of those sentences is a
 * promise, and a promise a reader might act on.
 *
 * WHY THE FLAG IS NEVER PERSISTED. Storing "this conversation was incognito"
 * would itself be a record of the conversation having happened, which is the
 * one thing it is for. So it lives in React state, and a reload ends it — which
 * is also the honest behaviour: there is nothing to reload.
 */

/** What OCADE promises, and what it explicitly does not. */
export const INCOGNITO_CLAIMS = {
  kept: [
    "Nothing from this conversation is saved on this device.",
    "Nothing from it is sent to your account, or synchronised to your other devices.",
    "It does not appear in your history or in search.",
    "OCADE will not remember anything from it.",
    "OCADE will not use what it already remembers about you while answering.",
  ],
  notKept: [
    "It does not hide the conversation from whoever can see this screen.",
    "It does not erase anything OCADE already remembers.",
    "On Online Intelligence the request still reaches the provider that answers it, which keeps its own records. Offline Intelligence answers on this machine and sends nothing.",
  ],
} as const;

/**
 * Where a message went.
 *
 * `not_stored` is a first-class outcome rather than an absent one, so a caller
 * cannot mistake "we deliberately kept nothing" for "the write failed" — the
 * two need opposite responses from the interface. `unsynced` is the third: the
 * turn is real and on screen, it is held in this tab's memory because the
 * database could not be reached, and closing the tab loses it.
 *
 * The `vault` and `pending_sync` outcomes went with the browser vault and its
 * upload queue. `PLAN.md` Phase 2 leaves one persistent authority, so a
 * message is either in it, deliberately absent from it, or waiting.
 */
export type IncognitoAwarePersistTarget = "cloud" | "unsynced" | "not_stored";

/**
 * May this conversation be written down?
 *
 * A single predicate rather than a scattering of `if (!incognito)` checks: the
 * places that write are the chat store, the sync queue behind it, and the
 * memory step, and every one of them has to agree. One function is one thing to
 * get right and one thing to test.
 */
export function mayPersist(incognito: boolean): boolean {
  return !incognito;
}

/** May OCADE learn from this conversation? */
export function mayRemember(incognito: boolean): boolean {
  return !incognito;
}

/**
 * The sentence shown where the conversation title would be.
 *
 * Named rather than inlined so the one place it is written is the one place it
 * can be got wrong.
 */
export const INCOGNITO_TITLE = "Incognito conversation";

/**
 * What a person is told before they start, and while they are in one.
 *
 * Deliberately short: a banner nobody reads is a banner that does not inform,
 * and the full list is a click away in the Help Center.
 */
export const INCOGNITO_SUMMARY =
  "Nothing from this conversation is saved, synchronised or remembered. It ends when you close this tab.";
