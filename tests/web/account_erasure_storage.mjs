// PRIVACY-01: an erased account leaves no stored Library bytes, rows or sign-in identity.
// Runs the real `eraseAccount` against a disposable LOCAL Supabase stack with a synthetic
// account; refuses any other host.
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... node tests/web/account_erasure_storage.mjs
import { createJiti } from "jiti";
import { createClient } from "@supabase/supabase-js";
const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.SUPABASE_URL ?? "http://invalid").hostname,
  )
) {
  console.error("REFUSED: run only against a disposable local Supabase stack.");
  process.exit(2);
}
const jiti = createJiti(import.meta.url, { alias: { "@": root + "/src" } });
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const email = `erase-${Date.now()}@example.test`;
const { data: made, error: e1 } = await admin.auth.admin.createUser({ email, email_confirm: true });
if (e1) throw e1;
const user = made.user.id;
const id = crypto.randomUUID();
const path = `${user}/${id}`;
const up = await admin.storage
  .from("library")
  .upload(path, new Blob(["synthetic bytes"]), { contentType: "application/octet-stream" });
if (up.error) throw up.error;
const row = await admin
  .from("ocade_library_items")
  .insert({
    id,
    user_id: user,
    kind: "file",
    source: "upload",
    name: "a.txt",
    mime: "text/plain",
    size_bytes: 15,
    storage_path: path,
  })
  .select("id")
  .single();
if (row.error) throw row.error;
const before = await admin.storage.from("library").list(user);
const { eraseAccount } = await jiti.import(root + "/src/lib/account/erase.server.ts");
const result = await eraseAccount(user);
const after = await admin.storage.from("library").list(user);
const rows = await admin.from("ocade_library_items").select("id").eq("user_id", user);
const identity = await admin.auth.admin.getUserById(user);
const out = {
  before: before.data?.length,
  pendingFiles: result.pendingFiles,
  objectsAfter: after.data?.length,
  rowsAfter: rows.data?.length,
  identityGone: !!identity.error || !identity.data.user,
};
console.log(JSON.stringify(out));
process.exit(
  out.before === 1 && out.objectsAfter === 0 && out.rowsAfter === 0 && out.identityGone ? 0 : 1,
);
