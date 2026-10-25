# Third-party code in `src/jarvis` and `src/deepseek`

## DeepSeek Harness

- Upstream: https://github.com/deepseek-ai/deepseek-harness
- Pinned commit: `687f282e8625c6b8d11ff58211a90524be2e4317` (also the gitlink at `external/deepseek-harness/upstream`)
- License: MIT (below). Upstream `SAFETY.md` describes a developer-preview security posture; nothing here relies on it for OCADE's safety.

### Vendored verbatim: `src/deepseek/upstream/`

121 source files from 27 upstream packages (the runtime and type closure of `@deepseek-ai/dsh-agent-loop`, including the vendored Cordis 4.0.5, cosmokit and schemastery by Shigma, MIT), byte-identical to the pin. Upstream's `LICENSE`, `THIRD_PARTY_NOTICES.md`, each package's `package.json` and the Cordis/cosmokit/schemastery `LICENSE` files are copied beside them. `npm run deepseek:check` (part of `verify:full`) proves every file matches its pinned git blob; `scripts/deepseek-vendor.mjs` regenerates the set. They are never edited: OCADE's runtime needs are met outside them (`src/deepseek/resolve.ts` lowers decorators and `using` with esbuild and points Node built-ins at `src/deepseek/shims/` in the browser). `src/jarvis/upstream-turn.ts` runs them: the upstream `AgentLoop` drives every foreground JARVIS turn.

### Adapted

| OCADE file                                       | Upstream source                                                                                    | Local modification                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine.ts` `pruneText`/`pruneOlderResults`      | `packages/compaction/compaction-tool-result-pruner/src/index.ts`, `config.ts`                      | Same head/marker/tail budgets and code-point slicing, applied to OCADE's normalized tool-result messages; the newest results are never pruned. |
| `engine.ts` `pairToolHistory`, `OUTCOME_UNKNOWN` | `packages/core/session/src/repair.ts`, `packages/compaction/compaction/src/tool-pairing.ts`        | Recovery re-expressed over OCADE's normalized messages; the outcome-unknown wording is copied verbatim.                                        |
| `mention.tsx`                                    | `packages/client/ui-input-trigger/src/core/detect.ts`, `menu.ts`                                   | Trigger detection and keyboard menu state reduced to the `@` app picker; IME composition is respected.                                         |
| `ocade_computer.py` `app_icons`                  | `packages/host/open-in-app/src/icons.ts` (approach: icons from the resolved app, generic fallback) | Re-implemented in Python with platform tools only (Pillow, already a dependency); PNG only, bounded size.                                      |

```
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
