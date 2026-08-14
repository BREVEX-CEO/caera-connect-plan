// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChatComposer } from "@/components/ocade/chat/ChatComposer";

/**
 * The composer's keyboard contract, tested by pressing keys.
 *
 * WHY THIS FILE EXISTS. The composer already had coverage, and all of it went
 * through `renderToStaticMarkup` — which produces a string. A string can prove
 * the hint "Enter to send · Shift+Enter for a new line" is PRINTED. It cannot
 * prove Enter sends anything, because nothing is mounted and no key can be
 * pressed. So the one sentence the interface promises the user was the one
 * behaviour no test exercised.
 *
 * That gap is not theoretical. Driving the real page through a browser, Enter
 * appeared to clear the box without sending, and the ambiguity could not be
 * settled by looking: the harness's synthetic typing and React's controlled
 * value disagreed about what was in the field, so neither "it works" nor "it is
 * broken" was supportable. A mounted component removes the harness from the
 * question entirely — `value` is passed in, so there is no state to desync.
 *
 * WHAT IS DELIBERATELY ASSERTED: that Enter and the send button reach the SAME
 * callback. They are one `onSubmit` prop in the source, and a test that pressed
 * only Enter would still pass if somebody wired the button to something else.
 */

afterEach(cleanup);

const base = {
  value: "hello",
  onChange: () => {},
  onSubmit: () => {},
};

const field = () => screen.getByPlaceholderText("Message OCADE…");

describe("pressing Enter in the composer", () => {
  it("sends the message", () => {
    const onSubmit = vi.fn();
    render(<ChatComposer {...base} onSubmit={onSubmit} />);

    fireEvent.keyDown(field(), { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not send on Shift+Enter, which writes a new line instead", () => {
    const onSubmit = vi.fn();
    render(<ChatComposer {...base} onSubmit={onSubmit} />);

    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not send an empty message", () => {
    // Otherwise a stray Enter in an empty box posts nothing to the model and
    // starts a turn the user did not ask for.
    const onSubmit = vi.fn();
    render(<ChatComposer {...base} value="   " onSubmit={onSubmit} />);

    fireEvent.keyDown(field(), { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not send while an answer is already streaming", () => {
    const onSubmit = vi.fn();
    render(<ChatComposer {...base} streaming onSubmit={onSubmit} />);

    fireEvent.keyDown(field(), { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reaches the same callback as the send button", () => {
    // The two paths are one prop in the source. This fails if they ever stop
    // being, which is precisely the bug that would leave a working button beside
    // a dead Enter key.
    const viaKey = vi.fn();
    const { unmount } = render(<ChatComposer {...base} onSubmit={viaKey} />);
    fireEvent.keyDown(field(), { key: "Enter" });
    unmount();

    const viaClick = vi.fn();
    render(<ChatComposer {...base} onSubmit={viaClick} />);
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(viaKey).toHaveBeenCalledTimes(1);
    expect(viaClick).toHaveBeenCalledTimes(1);
  });
});

describe("when the user has chosen Ctrl+Enter to send", () => {
  const modBase = { ...base, sendKey: "mod_enter" as const };

  it("a bare Enter does not send", () => {
    const onSubmit = vi.fn();
    render(<ChatComposer {...modBase} onSubmit={onSubmit} />);

    fireEvent.keyDown(field(), { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Ctrl+Enter sends", () => {
    const onSubmit = vi.fn();
    render(<ChatComposer {...modBase} onSubmit={onSubmit} />);

    fireEvent.keyDown(field(), { key: "Enter", ctrlKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Cmd+Enter sends, for the same reason on a Mac", () => {
    const onSubmit = vi.fn();
    render(<ChatComposer {...modBase} onSubmit={onSubmit} />);

    fireEvent.keyDown(field(), { key: "Enter", metaKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
