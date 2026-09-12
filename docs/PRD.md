# OCADE Product Requirements

## Product

OCADE is a small AI workspace with three primary customer destinations:

- **Chat** — ask, create and converse.
- **Library** — files, images and generated outputs.
- **Cowork** — let OCADE perform work; Jarvis is the voice/hands-free mode inside Cowork.

Settings is under Account. The interface is intentionally sparse.

## Customer promise

A new user should understand OCADE within seconds: open Chat, type, attach or speak. Advanced infrastructure stays hidden until needed.

## Required routes

- `/` → Chat
- `/library`
- `/cowork`
- About
- Help
- Terms
- Privacy

Signed-out people may view Chat, but sending requires authentication.

Pricing and the old marketing landing page are not part of this product structure.

## Chat requirements

- online OCADE answers through the configured Gemini server boundary;
- Offline Intelligence answers on-device when selected/required and available;
- `Auto`, `OCADE`, `Offline` are the only normal model labels;
- raw model/provider/runtime names are not customer-facing;
- recent conversations are simple and searchable;
- attachments flow into Library;
- failures are concise and truthful;
- usage exhaustion blocks generation without blocking history/Library/Settings/Billing.

## Offline Intelligence requirements

- starts preparing automatically on first supported visit;
- downloads in parallel with safe adaptive concurrency;
- resumes interrupted work;
- stores model bytes in browser OPFS;
- verifies content before use;
- repairs missing/corrupt chunks rather than redownloading everything;
- install once and reuse across refresh, sign-in/out and compatible app deployments;
- website commit/build changes do not invalidate a valid model;
- explicit Remove deletes local model data;
- normal UI never reveals the internal model's real name.

## Authentication requirements

- Continue with Google is primary;
- Email 6-digit OTP;
- Phone OTP with international country picker;
- optional password under Account where enabled;
- Supabase Auth is the identity authority;
- verified identity before full authenticated use.

## Usage requirements

Free allowance remains 28 successful user requests per 6h 28m, shared across devices and online/offline surfaces.

One successful user request is one use. Internal retries/tools/Cowork steps do not multiply that user charge.

## Library requirements

Library has `All`, `Images`, `Files`, search and a simple content grid/list. It owns uploaded and generated customer files/outputs. Support preview, download and delete.

## Cowork requirements

Owned by `PLAN2.md`.

- One Cowork runtime, written for OCADE. There is no donor tree.
- Cowork normal is prompt/task oriented.
- Jarvis is voice-first/hands-free inside Cowork.
- Both use one runtime, one usage authority and one permission system.
- Jarvis is online Gemini only for this release.
- browser/computer/file actions must be real, permissioned and postcondition-verified.

## Settings

Categories:

- Account
- Appearance
- Notifications
- Data Controls
- Billing
- Advanced

Data Controls includes delete-all conversations, delete uploaded files/images, export data and Offline Intelligence removal/state.

## Public/admin scope

About, Help, Terms and Privacy remain public. Admin/organization/security operations may remain hidden where required for the service; they are not normal customer navigation.

## Non-goals

No standalone customer product for:

- Code/terminal;
- Projects;
- Tasks;
- Artifacts;
- Customize;
- Devices;
- Search dashboard;
- desktop Copilot;
- cinematic Jarvis solar-system UI.

Capabilities may exist behind Cowork when required, but they do not become separate customer products.
