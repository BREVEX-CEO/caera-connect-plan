// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { Composer } from "@/components/ocade/chat/ChatComposer";
import { dragCarriesFiles, dragDepthAfter } from "@/components/ocade/chat/composer-drop";
import { renderWithRouter } from "./support/router-harness";
import { MessageBubble } from "@/components/ocade/chat/MessageBubble";
import { EngineBadge } from "@/components/ocade/chat/EngineBadge";
import { groupConversations } from "@/lib/chat/group-conversations";
import type { ChatMessageView } from "@/components/ocade/chat/chat-types";
import { OcadeContextualSidebar } from "@/components/ocade/chat/ChatContextualSidebar";
import type { Conversation } from "@/components/ocade/chat/conversation-model";

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

afterEach(cleanup);

describe("the composer", () => {
  /*
   * MOUNTED RATHER THAN STRINGIFIED. The composer links to Projects, so it
   * needs router context, and the states asserted below — Send disabled, Send
   * replaced by Stop — are what a person can and cannot press. A string of
   * markup can show an attribute; only a mounted control can be found by the
   * name a screen reader would announce.
   */
  const mount = (overrides: Record<string, unknown> = {}) =>
    renderWithRouter(
      <Composer
        draft=""
        setDraft={() => undefined}
        attachments={[]}
        setAttachments={() => undefined}
        onSubmit={() => undefined}
        streaming={false}
        permission="manual"
        setPermission={() => undefined}
        model="ocade-local"
        setModel={() => undefined}
        {...overrides}
      />,
    );

  const sendButton = () => screen.getByRole("button", { name: /^Send$/ });

  it("cannot be sent while empty", async () => {
    await mount();
    expect(sendButton()).toHaveProperty("disabled", true);
  });

  it("becomes sendable once there is text", async () => {
    await mount({ draft: "hello" });
    expect(sendButton()).toHaveProperty("disabled", false);
  });

  it("becomes sendable with an attachment even when the text is empty", async () => {
    await mount({
      attachments: [{ kind: "file", name: "report.pdf", mime: "application/pdf", sizeBytes: 10 }],
    });
    expect(sendButton()).toHaveProperty("disabled", false);
  });

  it("replaces Send with Stop during generation, in the same place", async () => {
    await mount({ draft: "hi", streaming: true, onStop: () => undefined });
    expect(screen.queryByRole("button", { name: /^Send$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Stop$/ })).toBeTruthy();
  });

  it("offers no Stop when there is nothing cancellable", async () => {
    // A red Stop that does nothing when clicked is worse than no Stop: it is
    // the control somebody reaches for when they most want it to work.
    await mount({ draft: "hi", streaming: true });
    expect(screen.queryByRole("button", { name: /^Stop$/ })).toBeNull();
  });

  it("states the send key that is actually in force", async () => {
    await mount();
    expect(
      screen.getByRole("textbox", { name: /message ocade/i }).getAttribute("placeholder"),
    ).toContain("Enter to send");
  });

  it("names the text area, so it is not an anonymous box", async () => {
    // Its placeholder is a hint, not a name: a screen reader announced the
    // product's primary control as "edit text, blank".
    await mount();
    expect(screen.getByRole("textbox", { name: /message ocade/i })).toBeTruthy();
  });

  it("offers every attachment path a named, pressable control", async () => {
    // By role, not by label: the hidden `<input type=file>` behind each button
    // carries the same name, and it is `display:none` — a real screen reader
    // never reaches it, so a test that found it would be measuring the wrong
    // element and would pass with the visible button removed.
    await mount();
    expect(screen.getByRole("button", { name: /^Attach files/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Attach images" })).toBeTruthy();
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

  /*
   * Whether a drop is ACCEPTED — refused while streaming, ignored when it
   * carries no files — is asserted against the mounted component in
   * `composer-drop-wiring.test.tsx`. It used to live here as a pure
   * `acceptsFiles` helper taking four flags, two of which the shipped composer
   * could only ever pass as constants.
   */
});

describe("the conversation rail and its three lists", () => {
  /**
   * ARCHIVE, TRASH AND PERMANENT DELETE ARE THREE DIFFERENT ACTS.
   *
   * `docs/PRD.md`, `docs/TRD.md`, `docs/APP_FLOW.md` and `docs/UI UX Brief.md`
   * all list them separately, and the rail is where a person tells them apart.
   * Before the trash existed the only way out of the sidebar was a permanent
   * delete, which made the confirmation honest and the choice unreasonable —
   * there was no smaller option to take.
   *
   * The assertions are about what reaches the screen rather than what the
   * source says, because "the trash row offers restore" is a claim about a
   * rendered control.
   */
  const conversation = (over: Partial<Conversation> = {}): Conversation => ({
    id: "c1",
    title: "How the tides work",
    pinned: false,
    archived: false,
    model_id: null,
    updated_at: "2026-09-01T10:00:00.000Z",
    ...over,
  });

  const rail = (over: Partial<Parameters<typeof OcadeContextualSidebar>[0]> = {}) => (
    <OcadeContextualSidebar
      onNew={() => {}}
      search=""
      setSearch={() => {}}
      view="active"
      setView={() => {}}
      pinned={[]}
      recent={[conversation()]}
      trashed={[]}
      trashDays={30}
      loading={false}
      activeId={null}
      onSelect={() => {}}
      onPin={() => {}}
      onArchive={() => {}}
      onRename={() => {}}
      onTrash={() => {}}
      onRestore={() => {}}
      onDelete={() => {}}
      onExport={() => {}}
      onShare={() => {}}
      onDeleteAll={() => {}}
      onShowShortcuts={() => {}}
      {...over}
    />
  );

  it("offers Move to trash rather than Delete on an ordinary conversation", async () => {
    await renderWithRouter(rail());
    expect(screen.getByTitle("Move to trash")).toBeTruthy();
    // The permanent one is not reachable from here any more, which is the whole
    // point: the smaller option is the one on the row.
    expect(screen.queryByTitle("Delete permanently")).toBeNull();
  });

  it("offers only restore and permanent delete on a trashed conversation", async () => {
    await renderWithRouter(
      rail({ view: "trash", recent: [], trashed: [conversation({ title: "In the trash" })] }),
    );
    expect(screen.getByTitle("Restore")).toBeTruthy();
    expect(screen.getByTitle("Delete permanently")).toBeTruthy();
    /*
     * Renaming, pinning, sharing or exporting something somebody has said they
     * are done with is a control that works and should not be there.
     */
    for (const absent of ["Rename", "Share", "Export", "Pin", "Archive", "Move to trash"]) {
      expect(screen.queryByTitle(absent), `the trash still offers ${absent}`).toBeNull();
    }
  });

  it("says how long the trash keeps things, in the trash", async () => {
    await renderWithRouter(rail({ view: "trash", recent: [], trashed: [conversation()] }));
    expect(screen.getByText(/deleted for good after 30 days/i)).toBeTruthy();
  });

  it("does not say it in the ordinary list, where nothing is counting down", async () => {
    await renderWithRouter(rail());
    expect(screen.queryByText(/deleted for good after/i)).toBeNull();
  });

  it("offers a way into the trash, and a way back out of it", async () => {
    await renderWithRouter(rail());
    expect(screen.getByText("Trash")).toBeTruthy();
    expect(screen.getByText("Archived chats")).toBeTruthy();

    cleanup();
    await renderWithRouter(rail({ view: "trash", recent: [], trashed: [] }));
    expect(screen.getByText("Back to active chats")).toBeTruthy();
    expect(screen.getByText("The trash is empty.")).toBeTruthy();
  });
});
