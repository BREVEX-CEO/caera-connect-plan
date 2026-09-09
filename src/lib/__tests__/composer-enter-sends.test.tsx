// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithRouter } from "./support/router-harness";
import { Composer } from "@/components/ocade/chat/ChatComposer";

/**
 * The composer's keyboard contract, tested by pressing keys.
 *
 * WHY THIS FILE EXISTS. The composer already had coverage, and all of it went
 * through `renderToStaticMarkup` — which produces a string. A string can prove
 * the hint "Enter to send, Shift+Enter for newline" is PRINTED. It cannot prove
 * Enter sends anything, because nothing is mounted and no key can be pressed.
 * So the one sentence the interface promises the user was the one behaviour no
 * test exercised.
 *
 * That gap is not theoretical. Driving the real page through a browser, Enter
 * appeared to clear the box without sending, and the ambiguity could not be
 * settled by looking: the harness's synthetic typing and React's controlled
 * value disagreed about what was in the field, so neither "it works" nor "it is
 * broken" was supportable. A mounted component removes the harness from the
 * question entirely — `draft` is passed in, so there is no state to desync.
 *
 * WHAT IS DELIBERATELY ASSERTED: that Enter and the send button reach the SAME
 * callback. They are one `onSubmit` prop in the source, and a test that pressed
 * only Enter would still pass if somebody wired the button to something else.
 *
 * THE SEND KEY IS READ FROM THE BROWSER, NOT FROM A PROP. `useChatPrefs` is a
 * per-device preference the composer reads itself, because it is mounted from
 * two screens and neither of them owns that choice. So the Ctrl+Enter cases
 * write the real preference to the real `localStorage` key rather than mocking
 * the hook — which also proves the stored shape the settings screen writes is
 * the shape the composer reads.
 */

const PREFS_KEY = "ocade.chat.prefs.v1";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

function chooseSendKey(sendKey: "enter" | "mod_enter") {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify({ sendKey }));
}

async function renderComposer(overrides: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  await renderWithRouter(
    <Composer
      draft="hello"
      setDraft={() => undefined}
      attachments={[]}
      setAttachments={() => undefined}
      onSubmit={onSubmit}
      streaming={false}
      permission="manual"
      setPermission={() => undefined}
      model="ocade-local"
      setModel={() => undefined}
      chatsMode="private_sync"
      {...overrides}
    />,
  );
  return onSubmit;
}

const field = () => screen.getByRole("textbox", { name: /message|ocade/i });

describe("pressing Enter in the composer", () => {
  it("sends the message", async () => {
    const onSubmit = await renderComposer();

    fireEvent.keyDown(field(), { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not send on Shift+Enter, which writes a new line instead", async () => {
    const onSubmit = await renderComposer();

    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cannot be sent from the button while the box is empty", async () => {
    // The Enter path is deliberately permissive — `sendMessage` in the Chat
    // route refuses an empty turn — but the BUTTON must not look pressable
    // when there is nothing to send.
    await renderComposer({ draft: "   " });

    expect(screen.getByRole("button", { name: /^Send$/ })).toHaveProperty("disabled", true);
  });

  it("offers Stop instead of Send while an answer is streaming", async () => {
    await renderComposer({ streaming: true, onStop: () => undefined });

    expect(screen.queryByRole("button", { name: /^Send$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Stop$/ })).toBeTruthy();
  });

  it("reaches the same callback as the send button", async () => {
    // The two paths are one prop in the source. This fails if they ever stop
    // being, which is precisely the bug that would leave a working button
    // beside a dead Enter key.
    const viaKey = await renderComposer();
    fireEvent.keyDown(field(), { key: "Enter" });
    cleanup();

    const viaClick = await renderComposer();
    fireEvent.click(screen.getByRole("button", { name: /^Send$/ }));

    expect(viaKey).toHaveBeenCalledTimes(1);
    expect(viaClick).toHaveBeenCalledTimes(1);
  });
});

describe("when the user has chosen Ctrl+Enter to send", () => {
  it("a bare Enter does not send", async () => {
    chooseSendKey("mod_enter");
    const onSubmit = await renderComposer();

    fireEvent.keyDown(field(), { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Ctrl+Enter sends", async () => {
    chooseSendKey("mod_enter");
    const onSubmit = await renderComposer();

    fireEvent.keyDown(field(), { key: "Enter", ctrlKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Cmd+Enter sends, for the same reason on a Mac", async () => {
    chooseSendKey("mod_enter");
    const onSubmit = await renderComposer();

    fireEvent.keyDown(field(), { key: "Enter", metaKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("says which key is in force rather than a fixed sentence", async () => {
    chooseSendKey("mod_enter");
    await renderComposer();

    expect(field().getAttribute("placeholder")).toContain("Ctrl+Enter to send");
  });
});
