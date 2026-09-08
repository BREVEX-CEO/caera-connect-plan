import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * THE HELP PUBLISHING WORKFLOW, AGAINST REAL POSTGRESQL — PLAN.md §L and §G.
 *
 * One property matters more than the rest and is the reason the draft state
 * exists at all: a draft must be unreadable by anybody outside the admin role.
 * Half-written guidance found through search is worse than no guidance, and a
 * screen that merely declines to LINK to a draft is not what stops that — the
 * policy is.
 *
 * The second is the editorial history. An answer that can be silently rewritten
 * is a support record nobody can rely on afterwards, so the revisions table has
 * no write path at all and this suite tries to use one.
 */

const EDITOR = "ff000000-0000-4000-8000-000000000001";
const READER = "ff000000-0000-4000-8000-000000000002";

let twin: DatabaseTwin;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(
    applied.filter((m) => !m.ok).map((m) => `${m.file}: ${m.error}`),
    "a migration failed",
  ).toEqual([]);

  for (const [id, email] of [
    [EDITOR, "editor@example.com"],
    [READER, "reader@example.com"],
  ]) {
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${id}', '${email}')
       on conflict (id) do nothing`,
    );
  }
  await twin.execSuperuser(
    `insert into public.user_roles (user_id, role) values ('${EDITOR}', 'admin')
     on conflict do nothing`,
  );
});

afterAll(async () => {
  await twin?.close();
});

async function save(slug: string, status: "draft" | "published", title = "An answer") {
  return twin.asTenant(
    EDITOR,
    `select public.ocade_save_support_article(
       '${slug}', '${title}', 'A summary.', 'getting-started',
       ARRAY['A paragraph.'], ARRAY['keyword'], '${status}', 'because')`,
  );
}

describe("nothing was seeded", () => {
  it("starts with the shipped catalogue and no overrides at all", async () => {
    const rows = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_support_articles`,
    );
    expect(Number(rows[0]?.count)).toEqual(0);
  });
});

describe("only an administrator may publish", () => {
  it("refuses an ordinary account", async () => {
    const attempt = await twin.asTenant(
      READER,
      `select public.ocade_save_support_article(
         'forged', 'Forged', 'Summary', 'security', ARRAY['body'], ARRAY[]::text[], 'published', '')`,
    );
    expect(attempt.error, "anybody could rewrite the Help Center").toMatch(
      /Only an administrator/i,
    );
  });

  it("refuses an administrator whose session has gone stale", async () => {
    const attempt = await twin.asTenant(
      EDITOR,
      `select public.ocade_save_support_article(
         'stale', 'Stale', 'Summary', 'security', ARRAY['body'], ARRAY[]::text[], 'published', '')`,
      { provedSecondsAgo: 3_600 },
    );
    expect(attempt.error).toMatch(/Confirm it is you/i);
  });

  it("refuses a category the Help Center does not have", async () => {
    // An article filed under nothing would be published, unreachable from any
    // page, and findable only by search.
    const attempt = await twin.asTenant(
      EDITOR,
      `select public.ocade_save_support_article(
         'misfiled', 'Misfiled', 'Summary', 'miscellaneous',
         ARRAY['body'], ARRAY[]::text[], 'published', '')`,
    );
    expect(attempt.error).toMatch(/not a Help Center category/i);
  });
});

describe("a draft is not public", () => {
  it("is invisible to a signed-out visitor", async () => {
    const saved = await save("only-a-draft", "draft");
    expect(saved.error).toBeUndefined();

    const asVisitor = await twin.asAnon<{ slug: string }>(
      `select slug from public.ocade_support_articles where slug = 'only-a-draft'`,
    );
    expect(asVisitor.error).toBeUndefined();
    expect(asVisitor.rows, "a draft leaked to a signed-out visitor").toEqual([]);
  });

  it("is invisible to a signed-in account with no admin role", async () => {
    const asReader = await twin.asTenant<{ slug: string }>(
      READER,
      `select slug from public.ocade_support_articles where slug = 'only-a-draft'`,
    );
    expect(asReader.error).toBeUndefined();
    expect(asReader.rows, "a draft leaked to an ordinary account").toEqual([]);
  });

  it("is visible to the editor who wrote it", async () => {
    const asEditor = await twin.asTenant<{ slug: string; status: string }>(
      EDITOR,
      `select slug, status from public.ocade_support_articles where slug = 'only-a-draft'`,
    );
    expect(asEditor.rows[0]).toEqual({ slug: "only-a-draft", status: "draft" });
  });
});

describe("a published article is readable by everyone", () => {
  it("reaches a signed-out visitor", async () => {
    const saved = await save("published-answer", "published", "A published answer");
    expect(saved.error).toBeUndefined();

    const asVisitor = await twin.asAnon<{ title: string }>(
      `select title from public.ocade_support_articles where slug = 'published-answer'`,
    );
    expect(asVisitor.rows[0]?.title).toEqual("A published answer");
  });

  it("becomes invisible again when it is returned to a draft", async () => {
    // Unpublishing is the control an editor reaches for when an answer turns
    // out to be wrong, and it has to actually take it away.
    await save("published-answer", "draft", "A published answer");
    const asVisitor = await twin.asAnon<{ title: string }>(
      `select title from public.ocade_support_articles where slug = 'published-answer'`,
    );
    expect(asVisitor.rows).toEqual([]);
  });
});

describe("the editorial history", () => {
  it("records every version, including the unpublish", async () => {
    const rows = await twin.asTenant<{ status: string; title: string }>(
      EDITOR,
      `select status, title from public.ocade_support_article_revisions
        where slug = 'published-answer' order by created_at`,
    );
    expect(rows.rows.map((row) => row.status)).toEqual(["published", "draft"]);
  });

  it("is not readable by a signed-out visitor", async () => {
    const asVisitor = await twin.asAnon(`select slug from public.ocade_support_article_revisions`);
    expect(asVisitor.error, "the editorial history is public").toBeTruthy();
  });

  it("is not readable by an ordinary account", async () => {
    const asReader = await twin.asTenant<{ slug: string }>(
      READER,
      `select slug from public.ocade_support_article_revisions`,
    );
    expect(asReader.rows).toEqual([]);
  });

  it("cannot be edited or deleted, even by an administrator", async () => {
    const before = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_support_article_revisions`,
    );
    await twin.asTenant(
      EDITOR,
      `update public.ocade_support_article_revisions set title = 'Never said that'`,
    );
    await twin.asTenant(EDITOR, `delete from public.ocade_support_article_revisions`);
    const after = await twin.asSuperuser<{ count: string; title: string }>(
      `select count(*) as count from public.ocade_support_article_revisions`,
    );
    expect(Number(after[0]?.count), "editorial history was destroyed").toEqual(
      Number(before[0]?.count),
    );
    const rewritten = await twin.asSuperuser<{ count: string }>(
      `select count(*) as count from public.ocade_support_article_revisions
        where title = 'Never said that'`,
    );
    expect(Number(rewritten[0]?.count), "editorial history was rewritten").toEqual(0);
  });
});

describe("the current row cannot be written directly", () => {
  it("refuses an administrator reaching past the function", async () => {
    await twin.asTenant(
      EDITOR,
      `update public.ocade_support_articles set title = 'Straight to the table'
        where slug = 'published-answer'`,
    );
    const after = await twin.asSuperuser<{ title: string }>(
      `select title from public.ocade_support_articles where slug = 'published-answer'`,
    );
    // The function is what writes the revision alongside. A direct write would
    // change the answer with no record of who changed it.
    expect(after[0]?.title).toEqual("A published answer");
  });
});
