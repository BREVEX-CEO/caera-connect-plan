import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("native/companion/tauri/src/main.rs", "utf8");

describe("native operation idempotency source contract", () => {
  it("accepts caller-owned correlation and operation ids", () => {
    expect(source).toMatch(/fn execute\([\s\S]*run_id: String,[\s\S]*operation_id: String/);
    expect(source).not.toMatch(/let run_id = format!\("run-\{\}"/);
  });

  it("refuses an in-flight duplicate and replays a matching terminal result", () => {
    expect(source).toContain("OperationDecision::InFlight");
    expect(source).toContain("it was not executed again");
    expect(source).toContain("OperationDecision::Replay(result)");
    expect(source).toContain("Returned cached operation result.");
  });

  it("rejects operation-id collisions with a different signed action", () => {
    expect(source).toContain(
      "Operation id reuse was refused because the signed action does not match.",
    );
  });

  it("writes an action-free operation journal before dispatch and reloads it on startup", () => {
    expect(source).toContain("operation-journal-v1.jsonl");
    expect(source).toContain("file.sync_all()");
    expect(source).toContain("OperationJournalEvent::Started");
    expect(source).toContain("OperationJournalEvent::Finished");
    expect(source).toContain("safety::ipc::compute_mac");
    expect(source).toContain("never the signed");
  });
});
