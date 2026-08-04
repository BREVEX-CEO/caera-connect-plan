import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatComposer } from "@/components/ocade/chat/ChatComposer";
import { MessageBubble } from "@/components/ocade/chat/MessageBubble";
import { EngineBadge } from "@/components/ocade/chat/EngineBadge";
import { groupConversations } from "@/components/ocade/chat/ChatSidebar";
import type { ChatMessageView } from "@/components/ocade/chat/chat-types";

/**
 * The chat surface, asserted on its rendered output.
 *
 * These components carry the product's privacy claim and its no-dead-button
 * rule, and both are properties of what reaches the screen — not of what the
 * source says. So the assertions read the markup.
 */

const message = (over: Partial<ChatMessageView> = {}): ChatMessageView => ({
  id: "m1",
  role: "assistant",
  content: "Tokyo.",
  createdAt: "2026-08-04T10:00:00.000Z",
  ...over,
});

describe("the engine badge never overstates where an answer came from", () => {
  it("claims the device only when the engine is actually local", () => {
    const html = renderToStaticMarkup(
      <EngineBadge status={{ locality: "local", label: "OCADE Local", online: true }} />,
    );
    expect(html).toContain("On this device");
  });

  it("says plainly that the cloud is in use, rather than softening it", () => {
    const html = renderToStaticMarkup(
      <EngineBadge status={{ locality: "cloud", label: "OCADE Cloud", online: true }} />,
    );
    expect(html).toContain("OCADE Cloud");
    expect(html).not.toContain("On this device");
  });

  it("does not claim readiness while the engine is still being fetched", () => {
    const html = renderToStaticMarkup(
      <EngineBadge
        status={{ locality: "local", label: "OCADE Local", online: true, preparing: true }}
      />,
    );
    expect(html).toContain("Preparing engine");
    expect(html).not.toContain("On this device");
  });

  it("shows offline as a state rather than hiding the badge", () => {
    const html = renderToStaticMarkup(
      <EngineBadge status={{ locality: "cloud", label: "OCADE Cloud", online: false }} />,
    );
    expect(html).toContain("Offline");
  });
});

describe("a message row offers only the actions it was given", () => {
  it("renders no edit or regenerate control when none was supplied", () => {
    const html = renderToStaticMarkup(<MessageBubble message={message()} actions={{}} />);
    expect(html).not.toContain("Regenerate answer");
    expect(html).not.toContain("Edit and resend");
    // Copy is always available, because the text is always there to copy.
    expect(html).toContain("Copy message");
  });

  it("renders each supplied action exactly once, with an accessible name", () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        message={message()}
        actions={{
          onEdit: () => {},
          onRegenerate: () => {},
          onContinue: () => {},
          onBranch: () => {},
          onSpeak: () => {},
          onSave: () => {},
        }}
      />,
    );
    for (const label of [
      "Edit and resend",
      "Regenerate answer",
      "Continue this answer",
      "Branch from here",
      "Read aloud",
      "Save this answer",
    ]) {
      expect(html.split(`aria-label="${label}"`)).toHaveLength(2);
    }
  });

  it("keeps a failed answer's text and offers a real retry", () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        message={message({ content: "partial answer", error: "The engine stopped responding." })}
        actions={{ onRetry: () => {} }}
      />,
    );
    expect(html).toContain("partial answer");
    expect(html).toContain("The engine stopped responding.");
    expect(html).toContain("Try again");
    expect(html).toContain('role="alert"');
  });

  it("hides the action row while a reply is still arriving", () => {
    const html = renderToStaticMarkup(
      <MessageBubble message={message({ streaming: true })} actions={{ onRegenerate: () => {} }} />,
    );
    // Regenerating a half-finished answer is meaningless, so it is not offered.
    expect(html).not.toContain("Regenerate answer");
  });
});

describe("the composer", () => {
  const base = { value: "", onChange: () => {}, onSubmit: () => {} };

  /**
   * Attribute ORDER is React's business, not a property of the component, so
   * the tag is isolated and inspected rather than matched with one regex that
   * happens to encode today's emission order.
   */
  const sendButton = (html: string) => {
    const match = /<button[^>]*aria-label="Send message"[^>]*>/.exec(html);
    if (!match) throw new Error("no send button rendered");
    return match[0];
  };

  it("cannot be sent while empty", () => {
    expect(sendButton(renderToStaticMarkup(<ChatComposer {...base} />))).toContain("disabled");
  });

  it("becomes sendable once there is text", () => {
    expect(
      sendButton(renderToStaticMarkup(<ChatComposer {...base} value="hello" />)),
    ).not.toContain("disabled");
  });

  it("becomes sendable with an attachment even when the text is empty", () => {
    const html = renderToStaticMarkup(
      <ChatComposer
        {...base}
        attachments={[{ kind: "file", name: "report.pdf", mime: "application/pdf", sizeBytes: 10 }]}
      />,
    );
    expect(sendButton(html)).not.toContain("disabled");
  });

  it("replaces Send with Stop during generation, in the same place", () => {
    const html = renderToStaticMarkup(
      <ChatComposer {...base} value="hi" streaming onStop={() => {}} />,
    );
    expect(html).toContain("Stop generating");
    expect(html).not.toContain("Send message");
  });

  it("offers no Stop when there is nothing cancellable", () => {
    const html = renderToStaticMarkup(<ChatComposer {...base} value="hi" streaming />);
    expect(html).not.toContain("Stop generating");
  });

  it("states the send key that is actually in force", () => {
    expect(renderToStaticMarkup(<ChatComposer {...base} />)).toContain("Enter to send");
    expect(renderToStaticMarkup(<ChatComposer {...base} sendKey="mod_enter" />)).toContain(
      "Ctrl+Enter to send",
    );
  });

  it("gives a disabled image control its reason as the accessible name", () => {
    const html = renderToStaticMarkup(
      <ChatComposer
        {...base}
        onAddFiles={() => {}}
        imageDisabledReason="No image-reading engine is installed."
      />,
    );
    // A grey icon with no explanation is the defect; the reason IS the label.
    expect(html).toContain('aria-label="No image-reading engine is installed."');
  });

  it("labels the text area, so it is not an anonymous box", () => {
    const html = renderToStaticMarkup(<ChatComposer {...base} />);
    expect(html).toContain('for="ocade-composer"');
    expect(html).toContain('id="ocade-composer"');
  });
});

describe("history is grouped by when it happened", () => {
  const now = Date.parse("2026-08-04T12:00:00.000Z");
  const at = (ms: number) => new Date(now - ms).toISOString();

  it("buckets by recency and drops empty groups", () => {
    const buckets = groupConversations(
      [
        { id: "a", title: "today", updatedAt: at(60 * 60 * 1000) },
        { id: "b", title: "older", updatedAt: at(30 * 24 * 60 * 60 * 1000) },
      ],
      now,
    );
    expect(buckets.map((b) => b.label)).toEqual(["Today", "Older"]);
  });

  it("puts pinned chats first regardless of age", () => {
    const buckets = groupConversations(
      [
        { id: "a", title: "recent", updatedAt: at(1000) },
        {
          id: "b",
          title: "pinned but ancient",
          updatedAt: at(90 * 24 * 60 * 60 * 1000),
          pinned: true,
        },
      ],
      now,
    );
    expect(buckets[0].label).toBe("Pinned");
    expect(buckets[0].items[0].id).toBe("b");
  });

  it("files an unparseable date under Older instead of losing the chat", () => {
    const buckets = groupConversations(
      [{ id: "a", title: "broken", updatedAt: "not a date" }],
      now,
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0].label).toBe("Older");
    expect(buckets[0].items[0].id).toBe("a");
  });
});
