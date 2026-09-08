import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatComposer } from "@/components/ocade/chat/ChatComposer";
import {
  dragCarriesFiles,
  dragDepthAfter,
  acceptsFiles,
} from "@/components/ocade/chat/composer-drop";
import { MessageBubble } from "@/components/ocade/chat/MessageBubble";
import { EngineBadge } from "@/components/ocade/chat/EngineBadge";
import { groupConversations } from "@/lib/chat/group-conversations";
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

  it("refuses to imply a cloud fallback when the local engine is unavailable", () => {
    const html = renderToStaticMarkup(
      <EngineBadge status={{ locality: "unknown", label: "Unavailable", online: true }} />,
    );
    expect(html).toContain("Local engine unavailable");
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
      <EngineBadge status={{ locality: "unknown", label: "Unavailable", online: false }} />,
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
        isLatest
        actions={{
          onRegenerate: () => {},
          onContinue: () => {},
          onBranch: () => {},
          onAside: () => {},
          onSpeak: () => {},
          onSave: () => {},
        }}
      />,
    );
    for (const label of [
      "Regenerate answer",
      "Continue this answer",
      "Branch from here",
      "Ask about this — stays out of the thread",
      "Read aloud",
      "Save this answer",
    ]) {
      expect(html.split(`aria-label="${label}"`)).toHaveLength(2);
    }
  });

  it("does not offer an assistant-only control on a user turn", () => {
    /*
     * THE DEFECT THIS CATCHES WAS SHIPPING.
     *
     * One `actions` object is drawn for every message in the transcript, so a
     * user turn used to show "Branch from here", "Save this answer" and "Ask
     * about this". Each handler checked the role and returned without acting,
     * which meant three controls that looked available, were reachable by
     * keyboard, and did nothing at all when pressed.
     */
    const html = renderToStaticMarkup(
      <MessageBubble
        message={message({ role: "user" })}
        isLatest
        actions={{
          onEdit: () => {},
          onBranch: () => {},
          onSave: () => {},
          onAside: () => {},
          onRegenerate: () => {},
          onReact: () => {},
        }}
      />,
    );
    for (const absent of [
      "Branch from here",
      "Save this answer",
      "Ask about this",
      "Regenerate answer",
      "Helpful",
    ]) {
      expect(html).not.toContain(absent);
    }
    // The one control that IS the user's own turn stays.
    expect(html).toContain("Edit and resend");
  });

  it("does not offer editing on an assistant turn", () => {
    const html = renderToStaticMarkup(
      <MessageBubble message={message()} actions={{ onEdit: () => {} }} />,
    );
    // "Edit and resend" resends the prompt. There is no prompt in an answer.
    expect(html).not.toContain("Edit and resend");
  });

  it("offers regenerate and re-run only on the newest turn", () => {
    const older = renderToStaticMarkup(
      <MessageBubble message={message()} actions={{ onRegenerate: () => {}, onRerun: () => {} }} />,
    );
    /*
     * Regenerating an answer from the middle of a thread would silently
     * discard everything after it, and the run comparison has pinned
     * conditions only for the last answer.
     */
    expect(older).not.toContain("Regenerate answer");
    expect(older).not.toContain("Run again and compare");

    const newest = renderToStaticMarkup(
      <MessageBubble
        message={message()}
        isLatest
        actions={{ onRegenerate: () => {}, onRerun: () => {} }}
      />,
    );
    expect(newest).toContain("Regenerate answer");
    expect(newest).toContain("Run again and compare");
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
      <MessageBubble
        message={message({ streaming: true })}
        isLatest
        actions={{ onRegenerate: () => {} }}
      />,
    );
    // Regenerating a half-finished answer is meaningless, so it is not offered.
    expect(html).not.toContain("Regenerate answer");
  });

  it("renders truthful processing receipts rather than pretending a human read the turn", () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        message={message({ role: "user", deliveryState: "processed" })}
        actions={{ onReply: () => {} }}
      />,
    );
    expect(html).toContain("Processed by OCADE");
    expect(html).toContain("Reply to message");
    expect(html).toContain("Swipe right to reply");
    expect(html).not.toContain("Read by");
  });

  it("shows both feedback controls and exposes the selected reaction", () => {
    const html = renderToStaticMarkup(
      <MessageBubble message={message({ reaction: "helpful" })} actions={{ onReact: () => {} }} />,
    );
    expect(html).toContain('aria-label="Helpful"');
    expect(html).toContain('aria-label="Not helpful"');
    expect(html).toContain('aria-pressed="true"');
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

  it("puts every add action behind one labelled trigger", () => {
    /*
     * The composer used to carry a bare paperclip and a bare picture icon, and
     * a disabled picture had to smuggle its reason into an `aria-label`. Both
     * are now inside a single `+`, which is where a new chat and a link also
     * live — the row was growing an icon per capability.
     *
     * The reason for a disabled action moved with it, from an aria-label to
     * VISIBLE TEXT under the menu item. That is stronger, not weaker: a
     * sighted user could not read the old one at all without hovering.
     * `voice-and-composer.test.ts` pins the menu's own contents.
     */
    const html = renderToStaticMarkup(
      <ChatComposer
        {...base}
        onAddFiles={() => {}}
        imageDisabledReason="No image-reading engine is installed."
      />,
    );
    expect(html).toContain('aria-label="Add to this conversation"');
    expect(html).toContain('aria-haspopup="menu"');
    // Closed by default, so it cannot cover the message being written.
    expect(html).toContain('aria-expanded="false"');
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

describe("attaching by paste and by drop", () => {
  it("shows the drop overlay only for a file drag, not a text drag", () => {
    // Dragging selected text across the composer fires the same events. An
    // overlay promising "drop to attach" for a text drag is a lie about what
    // is about to happen.
    expect(dragCarriesFiles(["Files"])).toBe(true);
    expect(dragCarriesFiles(["Files", "text/plain"])).toBe(true);
    expect(dragCarriesFiles(["text/plain"])).toBe(false);
    expect(dragCarriesFiles(undefined)).toBe(false);
  });

  it("keeps the overlay up while the pointer moves between the box's own children", () => {
    // The defect this prevents: entering the box, then the textarea inside it,
    // fires enter/enter/leave — and a boolean flag would blank the overlay
    // while the file is still held over the target.
    let depth = 0;
    depth = dragDepthAfter(depth, "enter"); // over the composer
    depth = dragDepthAfter(depth, "enter"); // over the textarea inside it
    depth = dragDepthAfter(depth, "leave"); // off the textarea, still inside
    expect(depth).toBeGreaterThan(0);
    depth = dragDepthAfter(depth, "leave"); // off the composer entirely
    expect(depth).toBe(0);
  });

  it("never lets the counter go negative and strand the overlay on screen", () => {
    expect(dragDepthAfter(0, "leave")).toBe(0);
    expect(dragDepthAfter(3, "drop")).toBe(0);
  });

  it("ignores a paste that carries no files, so ordinary text paste still works", () => {
    expect(
      acceptsFiles({ hasHandler: true, disabled: false, streaming: false, fileCount: 0 }),
    ).toBe(false);
  });

  it("refuses files while a reply is streaming", () => {
    // The attachment list is read when the NEXT message is assembled, so a file
    // added mid-stream looks like it belongs to the turn already in flight and
    // silently arrives with the following one.
    expect(acceptsFiles({ hasHandler: true, disabled: false, streaming: true, fileCount: 1 })).toBe(
      false,
    );
    expect(acceptsFiles({ hasHandler: true, disabled: true, streaming: false, fileCount: 1 })).toBe(
      false,
    );
    expect(
      acceptsFiles({ hasHandler: false, disabled: false, streaming: false, fileCount: 1 }),
    ).toBe(false);
    expect(
      acceptsFiles({ hasHandler: true, disabled: false, streaming: false, fileCount: 1 }),
    ).toBe(true);
  });
});
