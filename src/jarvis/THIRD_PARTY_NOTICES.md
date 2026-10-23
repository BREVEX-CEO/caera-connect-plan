# Third-party code adapted in `src/jarvis`

## DeepSeek Harness

- Upstream: https://github.com/deepseek-ai/deepseek-harness
- Pinned commit: `687f282e8625c6b8d11ff58211a90524be2e4317` (also the gitlink at `external/deepseek-harness/upstream`)
- License: MIT (below). Upstream `SAFETY.md` describes a developer-preview security posture; nothing here relies on it for OCADE's safety.

| OCADE file                                  | Upstream source                                                                                    | Local modification                                                                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine.ts` `scheduleCalls`                 | `packages/core/agent-loop/src/tool-calls.ts`                                                       | Re-expressed without Cordis/session services. Concurrency is fixed by OCADE (read-only server tools only); OCADE's broker, permissions and STOP remain the only effect gates. |
| `engine.ts` `pruneText`/`pruneOlderResults` | `packages/compaction/compaction-tool-result-pruner/src/index.ts`, `config.ts`                      | Same head/marker/tail budgets and code-point slicing, applied to OCADE's normalized tool-result messages; the newest results are never pruned.                                |
| `mention.tsx`                               | `packages/client/ui-input-trigger/src/core/detect.ts`, `menu.ts`                                   | Trigger detection and keyboard menu state reduced to the `@` app picker; IME composition is respected.                                                                        |
| `ocade_computer.py` `app_icons`             | `packages/host/open-in-app/src/icons.ts` (approach: icons from the resolved app, generic fallback) | Re-implemented in Python with platform tools only (Pillow, already a dependency); PNG only, bounded size.                                                                     |

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
