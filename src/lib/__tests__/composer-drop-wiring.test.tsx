// @vitest-environment jsdom
/**
 * DROPPING A FILE ON THE COMPOSER, ON THE REAL COMPONENT.
 *
 * The drop HELPERS were already tested — `dragCarriesFiles`, `dragDepthAfter`
 * and `acceptsFiles` each have their own cases in chat-ui.test.tsx. What had
 * never been tested is the WIRING: that the component calls them with the right
 * things, and that a dropped file actually reaches `onAddFiles`.
 *
 * That gap is the whole failure mode this file exists for. Every helper can be
 * correct and the component can still hand `onAddFiles` the wrong list, refuse
 * a drop it should accept, or show "Drop to attach" over a drag carrying only
 * text — and no unit test of a pure function would notice, because none of them
 * is wrong.
 *
 * So these fire real drag events carrying a real DataTransfer at the real
 * dropzone, and assert on what the component did.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ChatComposer } from "@/components/ocade/chat/ChatComposer";

/** A DataTransfer carrying files, which jsdom does not construct for us. */
function transferWith(files: File[]) {
  // Built key by key rather than by spreading the array: object-spreading a
  // File[] also brings `length` along in the type, which then collides with the
  // one a FileList must declare. tsc caught that; vitest did not.
  const list: Record<string | number | symbol, unknown> = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () {
      yield* files;
    },
  };
  files.forEach((file, index) => {
    list[index] = file;
  });
  return {
    types: files.length ? ["Files"] : ["text/plain"],
    files: list as unknown as FileList,
    dropEffect: "none",
  };
}

const TEXT_DRAG = { types: ["text/plain"], files: { length: 0 } as unknown as FileList };

function renderComposer(overrides: Record<string, unknown> = {}) {
  const onAddFiles = vi.fn();
  render(
    <ChatComposer
      value=""
      onChange={() => undefined}
      onSubmit={() => undefined}
      onAddFiles={onAddFiles}
      {...overrides}
    />,
  );
  return { onAddFiles, zone: screen.getByTestId("composer-dropzone") };
}

const OVERLAY = /drop to attach/i;

describe("a file dropped on the composer reaches the attachment handler", () => {
  it("hands over exactly the dropped file", () => {
    const { onAddFiles, zone } = renderComposer();
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    fireEvent.drop(zone, { dataTransfer: transferWith([file]) });

    expect(onAddFiles).toHaveBeenCalledTimes(1);
    const [list, imagesOnly] = onAddFiles.mock.calls[0];
    expect(list.length).toBe(1);
    expect(list.item(0).name).toBe("notes.txt");
    // A drop is not the image button, so it must not be restricted to images.
    expect(imagesOnly).toBe(false);
    cleanup();
  });

  it("REFUSES a drop while a reply is streaming", () => {
    // Not fussiness: the attachment list is read when the NEXT message is
    // assembled, so a file added mid-stream appears to belong to the turn
    // already in flight and silently arrives with the following one.
    const { onAddFiles, zone } = renderComposer({ streaming: true });
    fireEvent.drop(zone, {
      dataTransfer: transferWith([new File(["x"], "late.txt")]),
    });
    expect(onAddFiles).not.toHaveBeenCalled();
    cleanup();
  });

  it("REFUSES a drop while the composer is disabled", () => {
    const { onAddFiles, zone } = renderComposer({ disabled: true });
    fireEvent.drop(zone, { dataTransfer: transferWith([new File(["x"], "no.txt")]) });
    expect(onAddFiles).not.toHaveBeenCalled();
    cleanup();
  });

  it("does nothing at all when the drop carries no files", () => {
    const { onAddFiles, zone } = renderComposer();
    fireEvent.drop(zone, { dataTransfer: transferWith([]) });
    expect(onAddFiles).not.toHaveBeenCalled();
    cleanup();
  });
});

describe("the overlay tells the truth about what is being dragged", () => {
  it("appears for a drag carrying files", () => {
    const { zone } = renderComposer();
    expect(screen.queryByText(OVERLAY)).toBeNull();
    fireEvent.dragEnter(zone, { dataTransfer: transferWith([new File(["x"], "a.txt")]) });
    expect(screen.getByText(OVERLAY)).toBeTruthy();
    cleanup();
  });

  it("does NOT appear for a drag carrying only text", () => {
    // Dragging selected text across the composer fires the same events.
    // Promising "drop to attach" for it is a lie about what will happen.
    const { zone } = renderComposer();
    fireEvent.dragEnter(zone, { dataTransfer: TEXT_DRAG });
    expect(screen.queryByText(OVERLAY)).toBeNull();
    cleanup();
  });

  it("stays up while the pointer crosses the box's own children", () => {
    // dragenter/dragleave fire for every element crossed, so a boolean flag
    // would drop the overlay the moment the cursor reached the textarea.
    const { zone } = renderComposer();
    const carrying = { dataTransfer: transferWith([new File(["x"], "a.txt")]) };
    fireEvent.dragEnter(zone, carrying); // onto the box
    fireEvent.dragEnter(zone, carrying); // onto the textarea inside it
    fireEvent.dragLeave(zone); // off the textarea, still inside the box
    expect(screen.getByText(OVERLAY)).toBeTruthy();
    fireEvent.dragLeave(zone); // and now genuinely out
    expect(screen.queryByText(OVERLAY)).toBeNull();
    cleanup();
  });

  it("clears the overlay after a drop, not just after a leave", () => {
    const { zone } = renderComposer();
    const carrying = { dataTransfer: transferWith([new File(["x"], "a.txt")]) };
    fireEvent.dragEnter(zone, carrying);
    expect(screen.getByText(OVERLAY)).toBeTruthy();
    fireEvent.drop(zone, carrying);
    expect(screen.queryByText(OVERLAY)).toBeNull();
    cleanup();
  });

  it("does not offer to attach when there is no handler to attach with", () => {
    render(<ChatComposer value="" onChange={() => undefined} onSubmit={() => undefined} />);
    const zone = screen.getByTestId("composer-dropzone");
    fireEvent.dragEnter(zone, { dataTransfer: transferWith([new File(["x"], "a.txt")]) });
    expect(screen.queryByText(OVERLAY)).toBeNull();
    cleanup();
  });
});
