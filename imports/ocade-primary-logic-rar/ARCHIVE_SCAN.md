# OCADE_PRIMARY_LOGIC.rar — pre-import scan

Source supplied by the repository owner for OCADE integration planning.

## Archive identity

- SHA-256: `13f336cedd2ef983a70f4220f625437c06dde8eedb8a49a164f0d351822312ee`
- Files: 2,123
- Directories: 346
- Uncompressed bytes: 33,932,069
- Main source mix: 1,439 `.ts`, 634 `.tsx`, 20 `.js`
- Package name: `@carcc-cadane/ocade-core`
- Package version: `0.1.0`
- Package is private and marked `UNLICENSED`
- Runtime/build assumptions include Bun/Node, React 19, react-reconciler, node-pty, xterm, Commander-style CLI tooling and a separate web surface.

## String scan

The current RAR contains zero case-insensitive occurrences of these exact strings in extracted text files:

- `Claude`
- `Anthropic`
- `@ant/`
- `tengu_`
- `sk-ant`
- `claude-code`
- `@anthropic-ai`
- `anthropic.com`

It does still contain legacy/internal `ant` terminology in comments, identifiers and paths such as `ant-trace`, `USER_TYPE=ant`, `artifactory.infra.ant.dev`, `build-ant`, and similar internal-mode references. Those must not be blindly string-replaced. During integration, Claude should classify each occurrence by behavior and either rename the OCADE-owned concept, remove obsolete internal-only behavior, or replace the implementation with an OCADE-native equivalent.

## Technical rule

The archive is not to be copied wholesale over the current application. The existing repository contains browser, Cloudflare, Supabase, extension, Tauri/native, service-worker and local-inference boundaries that must remain coherent. The plan must compare responsibilities and establish one authority per subsystem before implementation.

## Product outcome

The target is one OCADE product: simple customer surface, local-first intelligence, one Chat/agent spine, one tool authority, one task/automation architecture, one memory/search/project/output model, browser and computer control behind explicit permission/safety boundaries, and a premium but fast UI. Existing verified Cloudflare/public/OAuth URLs remain unchanged unless an implementation blocker proves otherwise.
