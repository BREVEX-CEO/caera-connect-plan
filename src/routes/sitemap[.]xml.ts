import { createFileRoute } from "@tanstack/react-router";
import { COMPANY_FACTS } from "@/config/company-facts";

/**
 * THE PAGES THAT EXIST, AT THE ORIGIN THEY EXIST ON.
 *
 * This listed twelve routes this application does not serve — `/company`,
 * `/compare`, `/blog`, `/careers`, `/press`, `/status` and the rest — and left
 * out two it does. Every one of those was a 404 handed to a crawler as a
 * canonical URL, and the two real ones were invisible.
 *
 * `sitemap-lists-only-real-pages.test.ts` reads the generated route tree and
 * fails if this list and the application ever disagree again, in either
 * direction. A list nobody checks is how the first twelve got here.
 *
 * THE ORIGIN IS FIXED, NOT TAKEN FROM THE REQUEST. Served from `www`, a
 * request-derived origin produced a sitemap of `www` URLs — a second origin
 * with its own sessions, storage and model download, advertised to search
 * engines as the place to index.
 */
export const PUBLIC_PATHS = ["/", "/about", "/pricing", "/help", "/privacy", "/terms"] as const;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const urls = PUBLIC_PATHS.map(
          (path) =>
            `  <url><loc>${escapeXml(new URL(path, COMPANY_FACTS.siteOrigin).href)}</loc></url>`,
        ).join("\n");
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
