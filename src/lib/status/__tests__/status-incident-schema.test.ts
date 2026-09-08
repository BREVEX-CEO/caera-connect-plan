import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * THE INCIDENT AUTHORITY, AGAINST REAL POSTGRESQL — PLAN.md §K and §G.
 *
 * A status page is the one surface whose whole value is that outsiders can rely
 * on it, and that puts two unusual demands on the schema. It has to be readable
 * by a SIGNED-OUT visitor, which every other table in this deployment must not
 * be — so the first thing proven here is that opening it up did not also open a
 * way to write it. And its history has to be append-only, because a record of
 * what OCADE told people during an outage is worth nothing if it can be edited
 * into what OCADE currently wishes it had said.
 *
 * Every request runs under `SET ROLE authenticated` or `anon`, which is what
 * makes row-level security apply; a superuser probe would pass against policies
 * that protect nothing.
 */

const OPERATOR = "dd000000-0000-4000-8000-000000000001";
const PERSON = "ee000000-0000-4000-8000-000000000002";

let twin: DatabaseTwin;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(
    applied.filter((m) => !m.ok).map((m) => `${m.file}: ${m.error}`),
    "a migration failed",
  ).toEqual([]);

  for (const [id, email] of [
    [OPERATOR, "operator@example.com"],
    [PERSON, "person@example.com"],
  ]) {
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${id}', '${email}')
       on conflict (id) do nothing`,
    );
  }
  await twin.execSuperuser(
    `insert into public.user_roles (user_id, role) values ('${OPERATOR}', 'admin')
     on conflict do nothing`,
  );
});

afterAll(async () => {
  await twin?.close();
});

/** A published incident, opened the way the product opens one. */
async function openOne(overrides: { kind?: string; impact?: string } = {}) {
  const kind = overrides.kind ?? "incident";
  const impact = overrides.impact ?? "degraded";
  const opened = await twin.asTenant<{ ocade_open_status_incident: string }>(
    OPERATOR,
    `select public.ocade_open_status_incident(
       '${kind}', 'Sign-in is slow', '${impact}', ARRAY['account-authentication'],
       'We are looking into slow sign-ins.', null, null)`,
  );
  expect(opened.error).toBeUndefined();
  return opened.rows[0]?.ocade_open_status_incident ?? "";
}

describe("nothing was invented", () => {
  it("starts with no incidents at all", async () => {
    const rows = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_status_incidents`,
    );
    expect(Number(rows[0]?.count), "the migration seeded history that never happened").toEqual(0);
  });
});

describe("only an administrator may publish", () => {
  it("refuses an ordinary account", async () => {
    const attempt = await twin.asTenant(
      PERSON,
      `select public.ocade_open_status_incident(
         'incident', 'Everything is fine', 'outage', ARRAY[]::text[], 'Nothing to see', null, null)`,
    );
    expect(attempt.error, "anybody could publish to the status page").toMatch(
      /Only an administrator/i,
    );
  });

  it("refuses an administrator whose session has gone stale", async () => {
    // Publishing is a public statement in OCADE's name, so it is held to the
    // same rule as deleting an organization.
    const attempt = await twin.asTenant(
      OPERATOR,
      `select public.ocade_open_status_incident(
         'incident', 'Stale', 'outage', ARRAY[]::text[], 'From an old session', null, null)`,
      { provedSecondsAgo: 3_600 },
    );
    expect(attempt.error, "a stale session published to the status page").toMatch(
      /Confirm it is you/i,
    );
  });
});

describe("what a signed-out visitor can and cannot do", () => {
  it("reads incidents and their updates", async () => {
    const incidentId = await openOne();
    expect(incidentId).not.toEqual("");

    const rows = await twin.asAnon<{ title: string }>(
      `select title from public.ocade_status_incidents where id = '${incidentId}'`,
    );
    expect(rows.error, "a signed-out visitor cannot read the status page").toBeUndefined();
    expect(rows.rows[0]?.title).toEqual("Sign-in is slow");

    const updates = await twin.asAnon<{ body: string }>(
      `select body from public.ocade_status_incident_updates where incident_id = '${incidentId}'`,
    );
    expect(updates.rows.map((row) => row.body)).toEqual(["We are looking into slow sign-ins."]);
  });

  it("cannot write one", async () => {
    const forged = await twin.asAnon(
      `insert into public.ocade_status_incidents (kind, title, impact)
       values ('incident', 'OCADE is on fire', 'outage')`,
    );
    expect(forged.error, "a visitor published to the status page").toBeTruthy();
  });

  it("cannot call the publishing functions", async () => {
    const attempt = await twin.asAnon(
      `select public.ocade_open_status_incident(
         'incident', 'Forged', 'outage', ARRAY[]::text[], 'body', null, null)`,
    );
    expect(attempt.error, "a visitor called the publishing function").toBeTruthy();
  });
});

describe("an update moves the incident and is kept forever", () => {
  it("records the state at the moment it was posted", async () => {
    const incidentId = await openOne();
    const posted = await twin.asTenant(
      OPERATOR,
      `select public.ocade_post_status_incident_update(
         '${incidentId}', 'identified', 'A slow query on the sessions table.')`,
    );
    expect(posted.error).toBeUndefined();

    const updates = await twin.asAnon<{ state: string; body: string }>(
      `select state, body from public.ocade_status_incident_updates
        where incident_id = '${incidentId}' order by created_at`,
    );
    // Two entries, and the FIRST still says investigating — the history answers
    // "what did we know at the time", which a single latest-state column cannot.
    expect(updates.rows.map((row) => row.state)).toEqual(["investigating", "identified"]);

    const incident = await twin.asAnon<{ state: string }>(
      `select state from public.ocade_status_incidents where id = '${incidentId}'`,
    );
    expect(incident.rows[0]?.state).toEqual("identified");
  });

  it("stamps the end when it resolves, and refuses to reopen", async () => {
    const incidentId = await openOne();
    await twin.asTenant(
      OPERATOR,
      `select public.ocade_post_status_incident_update(
         '${incidentId}', 'resolved', 'Sign-in is back to normal.')`,
    );

    const resolved = await twin.asAnon<{ resolved_at: string | null }>(
      `select resolved_at from public.ocade_status_incidents where id = '${incidentId}'`,
    );
    expect(resolved.rows[0]?.resolved_at, "a resolved incident has no end time").toBeTruthy();

    const reopened = await twin.asTenant(
      OPERATOR,
      `select public.ocade_post_status_incident_update(
         '${incidentId}', 'investigating', 'Actually it is back')`,
    );
    // Reopening would rewrite what the page said had ended. A new incident is
    // the honest way to report a recurrence.
    expect(reopened.error).toMatch(/resolved/i);
  });

  it("does not let an administrator edit or delete what was published", async () => {
    const incidentId = await openOne();
    const before = await twin.asSuperuser<{ body: string }>(
      `select body from public.ocade_status_incident_updates
        where incident_id = '${incidentId}' order by created_at limit 1`,
    );

    await twin.asTenant(
      OPERATOR,
      `update public.ocade_status_incident_updates set body = 'It was fine all along'
        where incident_id = '${incidentId}'`,
    );
    await twin.asTenant(
      OPERATOR,
      `delete from public.ocade_status_incident_updates where incident_id = '${incidentId}'`,
    );

    const after = await twin.asSuperuser<{ body: string }>(
      `select body from public.ocade_status_incident_updates
        where incident_id = '${incidentId}' order by created_at limit 1`,
    );
    expect(after[0]?.body, "published history was rewritten").toEqual(before[0]?.body);
  });
});

describe("maintenance opens announced rather than in progress", () => {
  it("starts in the scheduled state", async () => {
    const incidentId = await openOne({ kind: "maintenance", impact: "maintenance" });
    const rows = await twin.asAnon<{ state: string; kind: string }>(
      `select state, kind from public.ocade_status_incidents where id = '${incidentId}'`,
    );
    expect(rows.rows[0]).toEqual({ state: "scheduled", kind: "maintenance" });
  });
});

describe("the schema refuses states that would make the page lie", () => {
  it("will not store resolved without an end time", async () => {
    // Attempted as the superuser, because a check constraint is the last line
    // and must hold even against a path that bypasses every function.
    let refused = false;
    try {
      await twin.execSuperuser(
        `insert into public.ocade_status_incidents (kind, title, impact, state)
         values ('incident', 'Resolved with no end', 'outage', 'resolved')`,
      );
    } catch {
      refused = true;
    }
    expect(refused, "an incident can say resolved with no end time").toBe(true);
  });

  it("will not store an unknown state or impact", async () => {
    let refused = false;
    try {
      await twin.execSuperuser(
        `insert into public.ocade_status_incidents (kind, title, impact, state)
         values ('incident', 'Unknown', 'catastrophe', 'investigating')`,
      );
    } catch {
      refused = true;
    }
    expect(refused, "an unknown impact was stored").toBe(true);
  });
});
