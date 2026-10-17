/** What every browser journey is pointed at: `--base=`, `--supabase=` and the browser to drive. */
export const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
export const BASE = arg("base", "http://127.0.0.1:8788");
export const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
export const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;
