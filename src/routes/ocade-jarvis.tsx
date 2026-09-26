import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { JarvisWorkspace } from "@/jarvis/JarvisWorkspace";

/**
 * OCADE JARVIS, beside Chat. A signed-out visitor may look; sending, tasks,
 * voice intelligence and device control ask for an account first and return
 * here afterwards.
 */
export const Route = createFileRoute("/ocade-jarvis")({
  validateSearch: z.object({
    c: z.string().uuid().optional(),
    /** A device waiting for this person to approve it. */
    connect: z.string().uuid().optional(),
  }),
  head: () => ({
    meta: [
      { title: "OCADE JARVIS" },
      {
        name: "description",
        content: "OCADE JARVIS answers questions and works in your browser when you ask it to.",
      },
    ],
  }),
  component: JarvisPage,
});

function JarvisPage() {
  const { c, connect } = Route.useSearch();
  return <JarvisWorkspace conversationId={c ?? null} connectId={connect ?? null} />;
}
