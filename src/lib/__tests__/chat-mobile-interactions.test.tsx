// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageBubble } from "@/components/ocade/chat/MessageBubble";

const message = {
  id: "assistant-1",
  role: "assistant" as const,
  content: "A reply that can be quoted.",
  createdAt: "2026-08-23T10:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("touch message actions", () => {
  it("reveals the action row after a deliberate long press", () => {
    vi.useFakeTimers();
    const view = render(<MessageBubble message={message} actions={{ onReply: () => {} }} />);
    const row = view.getByLabelText("OCADE reply");

    fireEvent.pointerDown(row, { pointerType: "touch", clientX: 20, clientY: 20 });
    act(() => vi.advanceTimersByTime(451));

    expect(row.getAttribute("data-touch-actions-open")).toBe("true");
  });

  it("replies on a horizontal right swipe but ignores a vertical scroll gesture", () => {
    const onReply = vi.fn();
    const view = render(<MessageBubble message={message} actions={{ onReply }} />);
    const row = view.getByLabelText("OCADE reply");

    fireEvent.pointerDown(row, { pointerType: "touch", clientX: 10, clientY: 20 });
    fireEvent.pointerMove(row, { pointerType: "touch", clientX: 78, clientY: 24 });
    fireEvent.pointerUp(row, { pointerType: "touch", clientX: 78, clientY: 24 });
    expect(onReply).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(row, { pointerType: "touch", clientX: 10, clientY: 20 });
    fireEvent.pointerMove(row, { pointerType: "touch", clientX: 80, clientY: 100 });
    fireEvent.pointerUp(row, { pointerType: "touch", clientX: 80, clientY: 100 });
    expect(onReply).toHaveBeenCalledTimes(1);
  });
});
