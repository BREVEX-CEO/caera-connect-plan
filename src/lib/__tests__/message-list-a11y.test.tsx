// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageList } from "@/components/ocade/chat/MessageList";
import type { ChatMessageView } from "@/components/ocade/chat/chat-types";

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

const user: ChatMessageView = {
  id: "u1",
  role: "user",
  content: "Hello",
  createdAt: "2026-08-17T00:00:00.000Z",
};

const streaming: ChatMessageView = {
  id: "a1",
  role: "assistant",
  content: "Partial",
  createdAt: "2026-08-17T00:00:01.000Z",
  streaming: true,
};

describe("MessageList assistive-technology announcements", () => {
  it("stays silent while tokens stream and announces once the assistant turn completes", () => {
    const { rerender } = render(
      <main>
        <MessageList messages={[user]} actions={{}} conversationKey="chat-1" />
      </main>,
    );

    rerender(
      <main>
        <MessageList messages={[user, streaming]} actions={{}} conversationKey="chat-1" />
      </main>,
    );
    expect(screen.queryByText("OCADE response complete.")).toBeNull();

    rerender(
      <main>
        <MessageList
          messages={[user, { ...streaming, content: "Complete answer", streaming: false }]}
          actions={{}}
          conversationKey="chat-1"
        />
      </main>,
    );
    expect(screen.getByText("OCADE response complete.")).toBeTruthy();
  });

  it("does not announce historical completed answers when a conversation opens", () => {
    render(
      <main>
        <MessageList
          messages={[user, { ...streaming, content: "Historical answer", streaming: false }]}
          actions={{}}
          conversationKey="historical-chat"
        />
      </main>,
    );

    expect(screen.queryByText("OCADE response complete.")).toBeNull();
  });
});
