/**
 * A public page's text, read by OCADE's server for JARVIS: an app's current
 * official documentation, when what the model remembers may be out of date.
 *
 * Public https only, re-checked on every redirect; no cookies or credentials
 * go with it; the text that comes back is page data, never instructions.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isPrivateHost } from "./permissions";

const MAX_BYTES = 2_000_000;
const MAX_TEXT = 20_000;
const READABLE = /^(text\/(html|plain|markdown|xml)|application\/(json|xml|xhtml\+xml))\b/i;

export type DocsPage =
  | { ok: true; url: string; host: string; title: string; text: string; truncated: boolean }
  | { ok: false; message: string };

function publicUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // An address instead of a name is refused outright: names are what documentation lives at.
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (/^[\d.]+$/.test(host) || host.includes(":") || !host.includes(".") || isPrivateHost(host))
    return null;
  return url;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** A character reference as its character; one that names no Unicode character is U+FFFD. */
function codePoint(name: string): string {
  const hex = name[1] === "x" || name[1] === "X";
  const value = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
  const valid = value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff);
  return valid ? String.fromCodePoint(value) : "�";
}

const decode = (text: string) =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) =>
    name.startsWith("#") ? codePoint(name) : (ENTITIES[name.toLowerCase()] ?? whole),
  );

export function pageText(whole: string): { title: string; text: string } {
  // Bounded before any expression runs over it: a page of unclosed tags cannot burn the CPU.
  const html = whole.slice(0, 300_000);
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim();
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/pre|\/section|\/article)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title: title.replace(/\s+/g, " ").slice(0, 200), text };
}

export async function readPublicPage(
  raw: string,
  fetcher: typeof fetch = fetch,
): Promise<DocsPage> {
  let url = publicUrl(raw);
  for (let hop = 0; url && hop < 4; hop += 1) {
    let response: Response;
    try {
      response = await fetcher(url.toString(), {
        redirect: "manual",
        headers: { accept: "text/html,text/plain,text/markdown;q=0.9,*/*;q=0.1" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { ok: false, message: "That page could not be reached." };
    }
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      url = next ? publicUrl(new URL(next, url).toString()) : null;
      continue;
    }
    if (!response.ok) return { ok: false, message: `That page answered ${response.status}.` };
    if (!READABLE.test(response.headers.get("content-type") ?? "")) {
      return { ok: false, message: "That address is not a readable page." };
    }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (reader && size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.byteLength;
      }
    } catch {
      return { ok: false, message: "That page stopped answering." };
    } finally {
      await reader?.cancel().catch(() => undefined);
    }
    const bytes = new Uint8Array(size);
    chunks.reduce((at, chunk) => (bytes.set(chunk, at), at + chunk.byteLength), 0);
    const body = new TextDecoder().decode(bytes);
    const { title, text } = /html|xml/i.test(response.headers.get("content-type") ?? "")
      ? pageText(body)
      : { title: "", text: body.trim() };
    return {
      ok: true,
      url: url.toString(),
      host: url.hostname,
      title,
      text: text.slice(0, MAX_TEXT),
      truncated: text.length > MAX_TEXT || size >= MAX_BYTES,
    };
  }
  return { ok: false, message: "Only public https pages can be read." };
}

/** Documentation pages one task may read. */
const DOCS_PER_TASK = 20;

/**
 * One documentation read for a task, the same from a tab and from Background Mode: within the
 * task's allowance (null past it), read, and kept in its activity either way, since what JARVIS
 * does next may follow from it. `keepPage`: the whole page stays on the task (Background Mode
 * plans from what the database holds); otherwise only its title.
 */
export async function readDocsForTask(
  service: SupabaseClient<Database>,
  userId: string,
  taskId: string,
  url: string,
  keepPage: boolean,
  controller?: string,
): Promise<DocsPage | null> {
  const { count } = await service
    .from("jarvis_activity")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId)
    .in("action->>action", ["docs"]);
  if ((count ?? 0) >= DOCS_PER_TASK) return null;
  const page = await readPublicPage(url);
  await service.from("jarvis_activity").insert({
    user_id: userId,
    task_id: taskId,
    ...(controller ? { controller } : {}),
    summary: (page.ok ? `Read the documentation at ${page.host}` : page.message).slice(0, 300),
    action: { action: "docs", url },
    status: page.ok ? "done" : "failed",
    result: keepPage
      ? (page as never)
      : page.ok
        ? { status: "done", title: page.title }
        : { status: "failed" },
    completed_at: new Date().toISOString(),
  });
  return page;
}
