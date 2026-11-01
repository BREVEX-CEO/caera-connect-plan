// Test-only: a session for a synthetic staging account, printed as JSON for the audit browser.
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [email, publishable] = process.argv.slice(-2);
await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => {});
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) throw error;
const anon = createClient(url, publishable, { auth: { persistSession: false } });
const verified = await anon.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
if (verified.error) throw verified.error;
process.stdout.write(JSON.stringify(verified.data.session));
