// Test-only: negative authentication checks against a DISPOSABLE Supabase Auth (threat register
// AUTH-01, AUTH-04, AUTH-06, SESSION-06). Synthetic accounts only; refuses any non-loopback
// project unless OCADE_AUTH_NEGATIVE_ORIGIN names it exactly (a staging run is the owner's
// decision). Prints one JSON line per check and exits non-zero when any fails.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_PUBLISHABLE_KEY=… node tests/web/auth_negative.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost"].includes(host) && process.env.OCADE_AUTH_NEGATIVE_ORIGIN !== url)
  throw new Error("refusing a non-disposable project");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = () => createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY, options);
const suffix = crypto.randomUUID().slice(0, 8);
const results = [];
const check = (id, ok, detail) => {
  results.push(ok);
  console.log(JSON.stringify({ id, ok, detail }));
};

// AUTH-01: a recovery link is single-use.
{
  const email = `recover-${suffix}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true, password: crypto.randomUUID() });
  const { data } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const token_hash = data.properties.hashed_token;
  const first = await client().auth.verifyOtp({ type: "recovery", token_hash });
  const second = await client().auth.verifyOtp({ type: "recovery", token_hash });
  check("AUTH-01", !first.error && Boolean(second.error), {
    first: first.error?.code ?? "ok",
    second: second.error?.code ?? "accepted twice",
  });
}

// AUTH-06: a wrong password and an unknown account get the same answer.
{
  const email = `known-${suffix}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true, password: crypto.randomUUID() });
  const wrong = await client().auth.signInWithPassword({ email, password: "not-the-password-1" });
  const unknown = await client().auth.signInWithPassword({
    email: `nobody-${suffix}@example.test`,
    password: "not-the-password-1",
  });
  check(
    "AUTH-06",
    Boolean(wrong.error) &&
      wrong.error?.message === unknown.error?.message &&
      wrong.error?.status === unknown.error?.status,
    { wrong: wrong.error?.message, unknown: unknown.error?.message },
  );
}

// AUTH-04: guessing an emailed code is cut off by the server, not by the page.
{
  const email = `otp-${suffix}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await client().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  let limited = false;
  let tries = 0;
  for (; tries < 60 && !limited; tries += 1) {
    const guess = String(100000 + tries).padStart(6, "0");
    const { error } = await client().auth.verifyOtp({ type: "email", email, token: guess });
    if (error?.status === 429) limited = true;
  }
  check("AUTH-04", limited, { triesUntilRefused: limited ? tries : `none of ${tries}` });
}

// SESSION-06: a refresh token replayed after its session moved on ends the whole session family.
// (Supabase Auth hands an old token's still-unused child back, so a retry is safe; once that child
// has itself been rotated, the old token is a replay.)
{
  const email = `refresh-${suffix}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const signed = await client().auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  const original = signed.data.session.refresh_token;
  const second = await client().auth.refreshSession({ refresh_token: original });
  const third = await client().auth.refreshSession({
    refresh_token: second.data.session?.refresh_token ?? "",
  });
  // Past the provider's reuse interval (10 s by default).
  await new Promise((resolve) => setTimeout(resolve, 11_000));
  const replay = await client().auth.refreshSession({ refresh_token: original });
  const after = await client().auth.refreshSession({
    refresh_token: third.data.session?.refresh_token ?? "",
  });
  check(
    "SESSION-06",
    !second.error && !third.error && Boolean(replay.error) && Boolean(after.error),
    {
      replay: replay.error?.code ?? "accepted",
      familyAfterReplay: after.error?.code ?? "still valid",
    },
  );
}

process.exit(results.every(Boolean) ? 0 : 1);
