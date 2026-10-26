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
    /** Opened by "Hey OCADE" on the person's computer: start with voice on. */
    voice: z.coerce.number().optional(),
    /**
     * Words to start from, put in the box and never sent: a Shortcut (iPhone
     * Shortcuts, Siri, a home-screen link) can open JARVIS with a request ready,
     * and the person still presses Send. A link is not the person asking.
     */
    ask: z.string().max(1000).optional().catch(undefined),
    /** Opened by the OCADE app on a phone: the device the person is using, its id. */
    from: z.string().uuid().optional().catch(undefined),
  }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://ocade.in/ocade-jarvis" }],
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
  const { c, connect, voice, ask, from } = Route.useSearch();
  return (
    <JarvisWorkspace
      conversationId={c ?? null}
      connectId={connect ?? null}
      startVoice={voice === 1}
      ask={ask}
      from={from}
    />
  );
}
