// @vitest-environment jsdom
/**
 * DROPPING A FILE ON THE COMPOSER, ON THE REAL COMPONENT.
 *
 * The drag HELPERS are tested on their own in `chat-ui.test.tsx`:
 * `dragCarriesFiles` and `dragDepthAfter` each have their own cases. What those
 * cannot show is the WIRING — that the component calls them with the right
 * things, and that a dropped file actually becomes an attachment.
 *
 * That gap is the whole failure mode this file exists for. Both helpers can be
 * correct and the component can still ignore the dropped list, refuse a drop it
 * should accept, or show "Drop to attach" over a drag carrying only text, and
 * no unit test of a pure function would notice, because none of them is wrong.
 *
 * So these fire real drag events carrying a real DataTransfer at the real
 * dropzone, and assert on what the component did.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { renderWithRouter } from "./support/router-harness";
import { Composer } from "@/components/ocade/chat/ChatComposer";

afterEach(cleanup);

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

async function renderComposer(overrides: Record<string, unknown> = {}) {
  const setAttachments = vi.fn();
  await renderWithRouter(
    <Composer
      draft=""
      setDraft={() => undefined}
      attachments={[]}
      setAttachments={setAttachments}
      onSubmit={() => undefined}
      streaming={false}
      permission="manual"
      setPermission={() => undefined}
      model="ocade-local"
      setModel={() => undefined}
      chatsMode="private_sync"
      {...overrides}
    />,
  );
  return { setAttachments, zone: screen.getByTestId("composer-dropzone") };
}

const OVERLAY = /drop to attach/i;

describe("a file dropped on the composer becomes an attachment", () => {
  it("reads the dropped file and adds it", async () => {
    const { setAttachments, zone } = await renderComposer();
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    fireEvent.drop(zone, { dataTransfer: transferWith([file]) });

    /*
     * Awaited, because reading happens ON THIS DEVICE before the attachment
     * exists — a text file is read, a PDF or workbook is decoded — and the raw
     * file is never uploaded. That asynchrony is the behaviour, not an
     * inconvenience, so the assertion waits for it rather than reaching past it.
     */
    await waitFor(() => expect(setAttachments).toHaveBeenCalledTimes(1));
    const next = setAttachments.mock.calls[0]![0] as Array<{ name: string; kind: string }>;
    expect(next.map((attachment) => attachment.name)).toEqual(["notes.txt"]);
    // A drop is not the image button, so it must not be restricted to images.
    expect(next[0]!.kind).toBe("file");
  });

  it("REFUSES a drop while a reply is streaming", async () => {
    // Not fussiness: the attachment list is read when the NEXT message is
    // assembled, so a file added mid-stream appears to belong to the turn
    // already in flight and silently arrives with the following one.
    const { setAttachments, zone } = await renderComposer({ streaming: true });

    fireEvent.drop(zone, { dataTransfer: transferWith([new File(["x"], "late.txt")]) });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(setAttachments).not.toHaveBeenCalled();
  });

  it("does nothing at all when the drop carries no files", async () => {
    const { setAttachments, zone } = await renderComposer();

    fireEvent.drop(zone, { dataTransfer: transferWith([]) });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(setAttachments).not.toHaveBeenCalled();
  });
});

describe("the overlay tells the truth about what is being dragged", () => {
  it("appears for a drag carrying files", async () => {
    const { zone } = await renderComposer();

    expect(screen.queryByText(OVERLAY)).toBeNull();
    fireEvent.dragEnter(zone, { dataTransfer: transferWith([new File(["x"], "a.txt")]) });
    expect(screen.getByText(OVERLAY)).toBeTruthy();
  });

  it("does NOT appear for a drag carrying only text", async () => {
    // Dragging selected text across the composer fires the same events.
    // Promising "drop to attach" for it is a lie about what will happen.
    const { zone } = await renderComposer();

    fireEvent.dragEnter(zone, { dataTransfer: TEXT_DRAG });

    expect(screen.queryByText(OVERLAY)).toBeNull();
  });

  it("stays up while the pointer crosses the box's own children", async () => {
    // dragenter/dragleave fire for every element crossed, so a boolean flag
    // would drop the overlay the moment the cursor reached the textarea.
    const { zone } = await renderComposer();
    const carrying = { dataTransfer: transferWith([new File(["x"], "a.txt")]) };

    fireEvent.dragEnter(zone, carrying); // onto the box
    fireEvent.dragEnter(zone, carrying); // onto the textarea inside it
    fireEvent.dragLeave(zone); // off the textarea, still inside the box
    expect(screen.getByText(OVERLAY)).toBeTruthy();

    fireEvent.dragLeave(zone); // and now genuinely out
    expect(screen.queryByText(OVERLAY)).toBeNull();
  });

  it("clears the overlay after a drop, not just after a leave", async () => {
    const { zone } = await renderComposer();
    const carrying = { dataTransfer: transferWith([new File(["x"], "a.txt")]) };

    fireEvent.dragEnter(zone, carrying);
    expect(screen.getByText(OVERLAY)).toBeTruthy();

    fireEvent.drop(zone, carrying);
    expect(screen.queryByText(OVERLAY)).toBeNull();
  });
});
