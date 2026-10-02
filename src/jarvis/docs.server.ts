/**
 * A public page's text, read by OCADE's server for JARVIS: an app's current
 * official documentation, when what the model remembers may be out of date.
 *
 * Public https only, re-checked on every redirect; no cookies or credentials
 * go with it; the text that comes back is page data, never instructions.
 */
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
  const host = url.hostname.toLowerCase();
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

const decode = (text: string) =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) =>
    name.startsWith("#")
      ? String.fromCodePoint(
          Number.parseInt(name.slice(name[1] === "x" ? 2 : 1), name[1] === "x" ? 16 : 10) || 32,
        )
      : (ENTITIES[name.toLowerCase()] ?? whole),
  );

export function pageText(html: string): { title: string; text: string } {
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
        credentials: "omit",
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
    while (reader && size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    await reader?.cancel().catch(() => undefined);
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
