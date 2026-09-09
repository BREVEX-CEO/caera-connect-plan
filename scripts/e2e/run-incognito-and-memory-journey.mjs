/**
 * Build the product, sign in for real, then drive PLAN.md §8: an incognito
 * conversation, side conversations, delete-all, and the memory export/import
 * round trip.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServedBuild } from "./served-build.mjs";

const storageState = join(tmpdir(), "ocade-incognito-state.json");

/**
 * THE CONVERSATION A SIDE QUESTION HANGS OFF.
 *
 * Seeded rather than typed, and the reason is not convenience: a side question
 * is asked ABOUT AN ANSWER, and this sandbox has no engine to produce one — no
 * GPU adapter, no Ollama, no paired machine. Driving the composer would leave a
 * user turn and a refusal, and there would be nothing to ask about.
 *
 * What is seeded is exactly what Supabase would hold after one exchange, and
 * nothing else. The screen still has to read it, render it, offer the control
 * and keep the side thread out of the transcript on its own.
 */
export const SEEDED_CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const SEEDED_ANSWER = "Kyoto was the capital of Japan until 1868, when it moved to Tokyo.";

const served = await startServedBuild({
  port: 8080,
  outDir: ".output-incognito",
  supabasePort: 54321,
  seedSupabase: (tables, userId) => {
    const now = new Date().toISOString();
    (tables.ocade_conversations ??= []).push({
      id: SEEDED_CONVERSATION_ID,
      user_id: userId,
      title: "When was the capital moved?",
      pinned: false,
      archived: false,
      model_id: null,
      privacy_mode: "private_sync",
      project_id: null,
      created_at: now,
      updated_at: now,
    });
    (tables.ocade_messages ??= []).push(
      {
        id: "22222222-2222-4222-8222-222222222222",
        conversation_id: SEEDED_CONVERSATION_ID,
        user_id: userId,
        role: "user",
        content: "When was Japan's capital moved?",
        attachments: [],
        model_id: null,
        provider_id: null,
        created_at: now,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        conversation_id: SEEDED_CONVERSATION_ID,
        user_id: userId,
        role: "assistant",
        content: SEEDED_ANSWER,
        attachments: [],
        model_id: "ocade-local",
        provider_id: "ocade-local",
        created_at: new Date(Date.parse(now) + 1000).toISOString(),
      },
    );
  },
});

let failures = 0;
failures += (await served.run("SIGN IN", ["scripts/e2e/sign-in-state.mjs"], {
  OCADE_STORAGE_STATE_OUT: storageState,
}))
  ? 1
  : 0;
failures += (await served.run(
  "INCOGNITO CONVERSATION AND MEMORY PORTABILITY",
  ["scripts/e2e/incognito-and-memory-journey.mjs"],
  { OCADE_STORAGE_STATE: storageState, OCADE_SEEDED_CONVERSATION_ID: SEEDED_CONVERSATION_ID },
))
  ? 1
  : 0;

const died = served.serverDied;
await served.stop();
console.log(
  `\n${failures === 0 ? "INCOGNITO AND MEMORY JOURNEY PASSED" : `${failures} STAGE(S) FAILED`}`,
);
if (died) console.error("The built app stopped serving during the audit.");
process.exit(failures === 0 && !died ? 0 : 1);
