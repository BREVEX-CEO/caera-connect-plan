import { describe, expect, it, vi } from "vitest";
import { createOfflineIntelligenceTransport } from "../offline-transport";
import type { IntelligenceEvent, IntelligenceRequest } from "../contract";

vi.mock("@/lib/brain/runtime-activation", () => ({ authorityBackedAdapter: () => ({}) }));

describe("an offline answer about a picture", () => {
  it("is refused rather than answered without the image", async () => {
    const stream = vi.fn(async () => ({ ok: true as const }));
    const transport = createOfflineIntelligenceTransport({
      probe: vi.fn(),
      stream,
    } as never);
    const events: IntelligenceEvent[] = [];
    for await (const event of transport.stream({
      messages: [{ role: "user", content: "What is in this photo?" }],
      attachments: [{ name: "photo.png", mime: "image/png", sizeBytes: 3, image: "AAAA" }],
      signal: new AbortController().signal,
    } as unknown as IntelligenceRequest)) {
      events.push(event);
    }
    expect(events.at(-1)).toMatchObject({ type: "refusal", retryable: false });
    expect(stream).not.toHaveBeenCalled();
  });
});
