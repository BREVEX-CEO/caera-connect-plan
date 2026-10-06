import { describe, expect, it } from "vitest";
import { pageText, readPublicPage } from "../docs.server";

const page = (body: string, headers: Record<string, string> = {}, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html", ...headers } });

describe("documentation pages read for JARVIS", () => {
  it("are public https names only, checked again on every redirect", async () => {
    const asked: string[] = [];
    const fetcher = (async (url: string) => {
      asked.push(url);
      if (url.includes("moved")) return page("", { location: "http://127.0.0.1/admin" }, 302);
      return page("<title>Docs</title><p>Use the API.</p>");
    }) as typeof fetch;
    for (const url of [
      "http://learn.example.com/a",
      "https://127.0.0.1/a",
      "https://[::1]/a",
      "https://localhost/a",
      "https://printer.local/a",
      "https://user:pw@learn.example.com/a",
      "https://intranet/a",
    ]) {
      expect((await readPublicPage(url, fetcher)).ok, url).toBe(false);
    }
    expect(asked).toEqual([]);
    expect((await readPublicPage("https://docs.example.com/moved", fetcher)).ok).toBe(false);
    expect(asked).toEqual(["https://docs.example.com/moved"]);
    const read = await readPublicPage("https://docs.example.com/guide", fetcher);
    expect(read).toMatchObject({ ok: true, host: "docs.example.com", title: "Docs" });
  });

  it("come back as plain text, without scripts, and bounded", async () => {
    const { title, text } = pageText(
      "<html><head><title> Excel &amp; VBA </title><style>p{}</style></head><body>" +
        "<script>steal()</script><h1>Range</h1><p>Use <b>Range.Value</b>&nbsp;to set.</p>" +
        "<ul><li>One</li><li>Two</li></ul></body></html>",
    );
    expect(title).toBe("Excel & VBA");
    // A reference that names no character is a replacement character, never a crash.
    expect(pageText("<p>&#65;&#1114112;&#xD800;&#x41;</p>").text).toBe("A��A");
    expect(text).not.toContain("steal");
    expect(text).toContain("Use Range.Value to set.");
    expect(text).toContain("- One");
    const big = await readPublicPage("https://docs.example.com/big", (async () =>
      page(`<p>${"word ".repeat(10_000)}</p>`)) as typeof fetch);
    expect(big.ok && big.text.length).toBe(20_000);
    expect(big.ok && big.truncated).toBe(true);
    const binary = await readPublicPage("https://docs.example.com/file.zip", (async () =>
      page("PK", { "content-type": "application/zip" })) as typeof fetch);
    expect(binary.ok).toBe(false);
  });
});
