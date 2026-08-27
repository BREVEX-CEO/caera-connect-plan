# The customer journey, walked end to end

`npm run audit:journey` builds the product, serves it, and walks **one browser
profile** from an empty machine to signed back in. Not eighteen checks against
eighteen fresh pages — one person, in order, where each stage inherits whatever
the last one really left behind.

That distinction is the whole point. Every other audit in `scripts/e2e` proves
one capability in isolation, against state somebody set up for it. A product
can pass all of them and still fail the first person who uses it, because
nobody ever walked the line.

## The line

| #   | Stage                                                     | What it proves                                                                              |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | A genuinely empty profile                                 | No session, no seeded storage. The run starts where a stranger starts.                      |
| 2   | Sign up, verify, sign in                                  | The account exists because the form made it, not because a fixture did.                     |
| 3   | Onboarding completes and lets go                          | All five steps accept input and the last one releases.                                      |
| 4   | The vault is set up before anything needs it              | Setup is reachable, creates a key, unlocks, and shows the recovery kit once.                |
| 5   | Chat answers, or says why it cannot                       | Pressing Send produces an answer **or** a stated reason. Silence fails.                     |
| 6   | The tool surface is reachable from chat                   | Attachments and the run-mode control are on the composer.                                   |
| 7   | A file attaches and is named back                         | The attachment is accepted and echoed by name.                                              |
| 8   | A project is created and persists                         | It survives a full page load — so it was stored, not held in a state variable.              |
| 9   | A task is created and persists                            | Same, through a different store.                                                            |
| 10  | Search finds what earlier stages made                     | **The chaining proof.** Nothing seeded this; the run's own mark comes back.                 |
| 11  | Cowork is honest about the missing companion              | The gate is shown and no live mission controls are offered for a mission that cannot start. |
| 12  | Approval and permissions are reachable                    | The permission surface has controls to actually decide with.                                |
| 13  | Offline: the work made online is still readable           | Chat, Projects and Tasks render, **and the vault unlocks**, with the network down.          |
| 14  | Reopen offline: a new page keeps the session and the work | The page is closed and a new one opened in the same profile, still offline.                 |
| 15  | Reconnect                                                 | Nothing is lost coming back.                                                                |
| 16  | Voice offers a control and states a reason                | It listens, or it names which of denied / absent / unreachable happened.                    |
| 17  | Every settings group opens                                | All eight groups render real content, not a heading.                                        |
| 18  | Sign out, sign back in, and the work is still there       | The project made in stage 8 survives the round trip.                                        |

**18 of 18 pass.**

## What it does not claim

- **Not a hosted database.** The Supabase behind it is the loopback fixture in
  `scripts/fixtures/stub-supabase.mjs`. It proves the product's own wiring —
  a control changes, a request goes out, a reload reads it back — and nothing
  about row-level security, which is proven against real PostgreSQL in
  `db-twin.test.ts`.
- **Not real inference.** A CI container has no room for a multi-gigabyte
  engine, and the product says so. Stage 5 asserts an answer _or_ a stated
  reason, because that is the honest bar here; real weights are
  `audit:real-inference`.
- **Not computer control.** Cowork needs a native companion that no CI machine
  has. Stage 11 asserts the product says so and offers no phantom controls,
  which is the behaviour that matters when the companion is missing.
- **Not a microphone.** Same rule: stage 16 asserts the control exists and
  names its failure.

## What walking it found

Nine defects, none of which a single-screen test could see.

1. **A locked vault read as an empty one.** `list` decrypted row by row, so it
   only asked for the key when there was at least one row — the state every new
   account is in. Projects rendered "No projects yet", which was false, above a
   Create button that failed on every press.
2. **Nothing ever set the vault up.** Both privacy modes write to the device
   first, and the only place a vault could be created was a Settings page
   nothing pointed at.
3. **The unlock was two screens from where it was needed.** The key is held in
   memory and nowhere else, so every page load drops it; the answer to that was
   to name a Settings page.
4. **A preference could lock you out of your own data.** Every unlock path
   ended by feeding `lock_timeout_seconds` to a setter that throws on anything
   non-finite — after the key was already derived.
5. **The privacy mode chosen at signup was never used.** Onboarding wrote it to
   `user_settings`; the storage resolver reads `data_class_privacy`. "Device
   only" was recorded and ignored.
6. **The vault could not be opened offline.** The row describing how to unwrap
   the key lived only in Supabase.
7. **`getSession` rejecting meant "still checking" forever.** No handler, so
   `loading` stayed true and every screen waiting for a user id waited for one
   that was never coming.
8. **The microphone could not be clicked.** No threshold between press and
   release, so a click started and stopped recognition in milliseconds — inert
   on any touch screen.
9. **And when it failed it said nothing.** The hook named every failure and the
   composer had nowhere to put the sentence.

## Running it

```
npm run audit:journey
```

Or against a server you are already running:

```
OCADE_BASE_URL=http://127.0.0.1:8080 node scripts/e2e/customer-journey.mjs
```

Each stage prints PASS or FAIL with a one-line reason. A failing stage does not
end the run — the later stages still have something to say about what survived.
