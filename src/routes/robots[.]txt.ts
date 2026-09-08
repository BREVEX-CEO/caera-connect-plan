import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin;
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /api/",
          "Disallow: /auth",
          "Disallow: /home",
          "Disallow: /settings",
          /*
           * A SHARE LINK IS UNLISTED, AND THAT IS ITS SECURITY.
           *
           * Indexing one would turn "anyone with the link" into "anyone who
           * searches" — a different promise from the one somebody made when
           * they shared a conversation, and one they would learn about from a
           * search result. The page also carries `noindex`, but a well-behaved
           * crawler reads this file BEFORE it fetches the page it would have to
           * fetch to see the tag.
           */
          "Disallow: /share",
          `Sitemap: ${origin}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
