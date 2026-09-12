import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OCADE" },
      {
        name: "description",
        content: "Ask OCADE. A small AI workspace with chat, a library and work it can carry out.",
      },
    ],
  }),
  component: ChatPage,
});

/**
 * `/` IS CHAT. There is no landing page and no entry decision.
 *
 * The route used to choose between a marketing page, an opening state and a
 * redirect, based on a cookie read on the server and a session probe in the
 * browser. `docs/DECISIONS.md` #4 replaces all of it: everybody gets Chat, a
 * signed-out visitor may look around, and the account is asked for at the
 * moment they press Send.
 */
function ChatPage() {
  return <ChatWorkspace />;
}
