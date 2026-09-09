/**
 * Identifiers chosen on the device.
 *
 * WHY THE DEVICE CHOOSES THEM. Several things need an id before the row that
 * will hold it exists: a conversation the person is already typing into, a task
 * something else is about to reference, a message that has to be idempotent
 * across a retry. Waiting for the database to name them would mean holding the
 * screen on a round trip, or renaming things after the fact.
 *
 * SHAPE-COMPATIBLE WITH THE COLUMN, ALWAYS. The fallback below is a real UUID
 * v4, not a readable string like `task-1738…`. An id the column rejects turns a
 * missing browser API into work that cannot be saved at all, and the browsers
 * without `crypto.randomUUID` are exactly the ones nobody is testing on.
 */
export function randomUuid(): string {
  const source = globalThis.crypto;
  if (source && "randomUUID" in source) return source.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = (Math.random() * 16) | 0;
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}
