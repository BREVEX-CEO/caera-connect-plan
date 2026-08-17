import { createFileRoute } from "@tanstack/react-router";
import { LocalOnlyChatWorkspace } from "@/components/ocade/LocalOnlyChatWorkspace";

/**
 * OCADE Chat is local-only. AI inference and chat message bodies are handled by
 * LocalOnlyChatWorkspace on the device; there is no cloud-model fallback or
 * server chat generation path behind this route.
 */
export const Route = createFileRoute("/_authenticated/ocade")({
  head: () => ({
    meta: [
      { title: "OCADE Local — CAERA CADANE" },
      {
        name: "description",
        content: "Local-only OCADE chat. AI generation runs on this device.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LocalOnlyChatWorkspace,
});
