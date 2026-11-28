/**
 * FRONTEND-04: sign-out leaves no private page behind in the service worker.
 *
 * The shell cache holds navigations the person fetched while signed in; it is
 * deleted on sign-out. The static-asset cache is public, content-hashed files
 * and is kept, so the offline engine still opens for the next person.
 */
const PRIVATE_PREFIXES = ["ocade-shell-v", "ocade-assets"];

export async function clearPrivateCaches(
  store: Pick<CacheStorage, "keys" | "delete"> | undefined = typeof caches === "undefined"
    ? undefined
    : caches,
): Promise<string[]> {
  if (!store) return [];
  const names = (await store.keys()).filter((name) =>
    PRIVATE_PREFIXES.some((prefix) => name.startsWith(prefix)),
  );
  await Promise.all(names.map((name) => store.delete(name)));
  return names;
}

/** Sign out of this device, then clear what the worker kept. A cache failure never blocks the sign-out. */
export async function signOutThisDevice(signOut: () => Promise<unknown>): Promise<void> {
  try {
    await signOut();
  } finally {
    await clearPrivateCaches().catch(() => undefined);
  }
}
