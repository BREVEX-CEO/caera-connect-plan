import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { JarvisWorkspace } from "@/jarvis/JarvisWorkspace";
import { MAX_OBJECTIVE_LENGTH } from "@/lib/jarvis/objective";

/**
 * OCADE JARVIS, beside Chat. Its task engine is retired while a new one is
 * built: the page stays, with past conversations readable and sending off.
 */
export const Route = createFileRoute("/ocade-jarvis")({
  validateSearch: z.object({
    c: z.string().uuid().optional(),
    /**
     * Words to start from, put in the box and never sent: a Shortcut (iPhone
     * Shortcuts, Siri, a home-screen link) can open JARVIS with a request ready.
     */
    ask: z.string().max(MAX_OBJECTIVE_LENGTH).optional(),
  }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://ocade.in/ocade-jarvis" }],
    meta: [
      { title: "OCADE JARVIS" },
      {
        name: "description",
        content: "OCADE JARVIS, the task assistant beside Chat, is being rebuilt.",
      },
    ],
  }),
  component: JarvisPage,
});

function JarvisPage() {
  const { c, ask } = Route.useSearch();
  return <JarvisWorkspace conversationId={c ?? null} ask={ask} />;
}
