/**
 * Deciding what a drag means.
 *
 * Split out of `ChatComposer` so the component file exports only a component:
 * mixing helpers in defeats fast refresh, and every edit to the composer then
 * loses whatever the user had typed. These are also the fiddliest part of drag
 * handling, and separating them is what makes them testable without a DOM.
 *
 * `acceptsFiles` used to live here too. It answered "may these files be
 * attached?" from four flags, and the composer that ships has only one of them
 * — it is never handler-less and has no `disabled` prop, so calling it meant
 * passing two constants and reading a rule that could not vary. The rule it
 * carried, refusing a file while a reply is streaming, is asserted directly
 * against the component in `composer-drop-wiring.test.tsx`.
 */
/**
 * Is this drag carrying files?
 *
 * Dragging selected TEXT across the composer also fires drag events, and
 * flashing a "drop to attach" overlay for a text drag is a lie about what is
 * about to happen. `types` is the only reliable answer during a drag, because
 * the file list itself is deliberately unreadable until the drop.
 */
export function dragCarriesFiles(types: readonly string[] | undefined): boolean {
  return types?.includes("Files") ?? false;
}

/**
 * The overlay counter.
 *
 * dragenter/dragleave fire once for EVERY element the pointer crosses, so a
 * boolean flag turns the overlay off the moment the cursor moves from the box
 * onto the textarea inside it. Counting enters against leaves is what makes
 * "has the pointer actually left" answerable. It never goes below zero: a
 * stray leave without a matching enter would otherwise leave the count
 * negative and the overlay stuck on for the rest of the session.
 */
export function dragDepthAfter(current: number, event: "enter" | "leave" | "drop"): number {
  if (event === "enter") return current + 1;
  if (event === "drop") return 0;
  return Math.max(0, current - 1);
}
