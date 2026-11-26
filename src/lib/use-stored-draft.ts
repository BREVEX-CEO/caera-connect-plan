import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * UX-29 Working Memory: words typed into a composer survive navigating away and back (and a page
 * reload) within the same browser tab. sessionStorage is used on purpose: it ends with the tab
 * and is never shared with another account, so a draft never outlives the person's visit.
 */
export const DRAFT_KEY_PREFIX = "ocade:draft:v1:";
export const DRAFT_MAX_LENGTH = 20_000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function draftKey(surface: string, accountId: string): string {
  return `${DRAFT_KEY_PREFIX}${surface}:${accountId}`;
}

export function saveDraft(store: Store | null, key: string, text: string): void {
  try {
    if (text.trim()) store?.setItem(key, text.slice(0, DRAFT_MAX_LENGTH));
    else store?.removeItem(key);
  } catch {
    // Storage may be full or disabled; the draft still lives in the page.
  }
}

export function loadDraft(store: Store | null, key: string): string {
  try {
    return store?.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function tabStore(): Store | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Like useState(""), but saved under `key` (null while the account is unknown: nothing saved). */
export function useStoredDraft(key: string | null): [string, Dispatch<SetStateAction<string>>] {
  const [draft, setState] = useState("");
  const latest = useRef("");
  const keyRef = useRef(key);
  keyRef.current = key;
  const setDraft = useCallback<Dispatch<SetStateAction<string>>>(
    (action) => {
      const next = typeof action === "function" ? action(latest.current) : action;
      latest.current = next;
      setState(next);
      if (keyRef.current) saveDraft(tabStore(), keyRef.current, next);
    },
    [],
  );
  const owner = useRef(key);
  useEffect(() => {
    // Another account's words are never carried over to this one.
    if (owner.current && owner.current !== key) {
      latest.current = "";
      setState("");
    }
    owner.current = key;
    if (!key || latest.current) return;
    const saved = loadDraft(tabStore(), key);
    if (saved) {
      latest.current = saved;
      setState(saved);
    }
  }, [key]);
  return [draft, setDraft];
}
