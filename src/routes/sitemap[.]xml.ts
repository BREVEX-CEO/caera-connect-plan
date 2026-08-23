import { createFileRoute } from "@tanstack/react-router";

const PUBLIC_PATHS = [
  "/",
  "/company",
  "/founder/haans-antoni",
  "/products/ocade",
  "/pricing",
  "/compare",
  "/blog",
  "/careers",
  "/team",
  "/press",
  "/status",
  "/faq",
  "/search",
  "/privacy",
  "/terms",
];

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
      GET: ({ request }) => {
        const origin = new URL(request.url).origin;
        const urls = PUBLIC_PATHS.map(
          (path) => `  <url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`,
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
