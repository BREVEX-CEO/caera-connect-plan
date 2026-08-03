import { describe, it, expect } from "vitest";
import {
  createProjectInput,
  updateProjectInput,
  setConversationProjectInput,
  branchConversationInput,
  forkConversationBeforeInput,
  createOutputInput,
  projectNameSchema,
} from "../ocade-projects.functions";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

/**
 * These schemas are the first line of defence: anything failing here never
 * reaches a query. They are tested directly so the rules hold without needing
 * Supabase.
 */
describe("project name", () => {
  it("trims surrounding whitespace rather than storing it", () => {
    expect(projectNameSchema.parse("  Quarterly review  ")).toBe("Quarterly review");
  });

  it("rejects a name that is empty or only whitespace", () => {
    expect(projectNameSchema.safeParse("").success).toBe(false);
    expect(projectNameSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a name past the column limit instead of letting the DB truncate", () => {
    expect(projectNameSchema.safeParse("x".repeat(200)).success).toBe(true);
    expect(projectNameSchema.safeParse("x".repeat(201)).success).toBe(false);
  });
});

describe("createProject input", () => {
  it("accepts a name alone", () => {
    expect(createProjectInput.parse({ name: "Research" })).toEqual({ name: "Research" });
  });

  it("allows instructions to be omitted, null, or text", () => {
    expect(createProjectInput.safeParse({ name: "a", instructions: null }).success).toBe(true);
    expect(createProjectInput.safeParse({ name: "a", instructions: "Be brief." }).success).toBe(
      true,
    );
  });

  it("rejects oversized instructions", () => {
    expect(
      createProjectInput.safeParse({ name: "a", instructions: "x".repeat(20_001) }).success,
    ).toBe(false);
  });

  it("requires a name", () => {
    expect(createProjectInput.safeParse({}).success).toBe(false);
  });
});

describe("updateProject input", () => {
  it("requires a valid uuid id", () => {
    expect(updateProjectInput.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    expect(updateProjectInput.safeParse({ id: ID }).success).toBe(true);
  });

  /** Archive and restore are the same operation with a different flag. */
  it("accepts archiving and restoring", () => {
    expect(updateProjectInput.parse({ id: ID, archived: true }).archived).toBe(true);
    expect(updateProjectInput.parse({ id: ID, archived: false }).archived).toBe(false);
  });

  it("treats an omitted field as 'leave unchanged', not 'clear'", () => {
    const parsed = updateProjectInput.parse({ id: ID, name: "New name" });
    expect(parsed.instructions).toBeUndefined();
    expect(parsed.archived).toBeUndefined();
  });

  it("distinguishes clearing instructions (null) from leaving them alone (absent)", () => {
    expect(updateProjectInput.parse({ id: ID, instructions: null }).instructions).toBeNull();
    expect("instructions" in updateProjectInput.parse({ id: ID })).toBe(false);
  });

  it("still rejects an empty name when one is supplied", () => {
    expect(updateProjectInput.safeParse({ id: ID, name: "  " }).success).toBe(false);
  });
});

describe("filing a conversation", () => {
  it("accepts moving into a project", () => {
    expect(
      setConversationProjectInput.parse({ conversationId: ID, projectId: ID2 }).projectId,
    ).toBe(ID2);
  });

  /** Unfiling is explicit and supported — not an accident of a missing field. */
  it("accepts null as 'unfile'", () => {
    expect(
      setConversationProjectInput.parse({ conversationId: ID, projectId: null }).projectId,
    ).toBeNull();
  });

  it("does NOT accept an omitted projectId, which would be ambiguous", () => {
    expect(setConversationProjectInput.safeParse({ conversationId: ID }).success).toBe(false);
  });

  it("rejects a malformed id rather than passing it to the query", () => {
    expect(
      setConversationProjectInput.safeParse({ conversationId: "x", projectId: null }).success,
    ).toBe(false);
    expect(
      setConversationProjectInput.safeParse({ conversationId: ID, projectId: "'; drop table --" })
        .success,
    ).toBe(false);
  });
});

describe("branching a conversation", () => {
  it("requires both the conversation and the pivot message", () => {
    expect(branchConversationInput.safeParse({ conversationId: ID }).success).toBe(false);
    expect(branchConversationInput.safeParse({ fromMessageId: ID }).success).toBe(false);
    expect(
      branchConversationInput.safeParse({ conversationId: ID, fromMessageId: ID2 }).success,
    ).toBe(true);
  });

  it("makes the title optional so a default can be generated", () => {
    expect(
      branchConversationInput.parse({ conversationId: ID, fromMessageId: ID2 }).title,
    ).toBeUndefined();
  });

  it("caps the title at the column limit", () => {
    expect(
      branchConversationInput.safeParse({
        conversationId: ID,
        fromMessageId: ID2,
        title: "x".repeat(201),
      }).success,
    ).toBe(false);
  });
});

describe("forking before a message for edit or retry", () => {
  it("requires the conversation and pivot message", () => {
    expect(
      forkConversationBeforeInput.safeParse({
        conversationId: ID,
        fromMessageId: ID2,
      }).success,
    ).toBe(true);
    expect(forkConversationBeforeInput.safeParse({}).success).toBe(false);
  });
});

describe("versioned output input", () => {
  it("accepts a parent version and bounded retention", () => {
    expect(
      createOutputInput.safeParse({
        kind: "document",
        title: "Report",
        content: "v2",
        parentOutputId: ID,
        retentionDays: 90,
      }).success,
    ).toBe(true);
  });

  it("refuses oversized retention and content", () => {
    expect(
      createOutputInput.safeParse({
        kind: "document",
        title: "Report",
        retentionDays: 3651,
      }).success,
    ).toBe(false);
    expect(
      createOutputInput.safeParse({
        kind: "document",
        title: "Report",
        content: "x".repeat(1_000_001),
      }).success,
    ).toBe(false);
  });
});
