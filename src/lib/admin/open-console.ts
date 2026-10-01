/**
 * From the site to the console, on the person's press: mint the one-time way
 * in and go. `replace`, so Back from the console returns to where they were.
 */
export async function enterTheConsole(): Promise<void> {
  const { openConsole } = await import("./console.functions");
  const { url } = await openConsole();
  window.location.replace(url);
}
