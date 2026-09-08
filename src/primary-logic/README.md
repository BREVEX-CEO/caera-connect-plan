# OCADE primary logic

This directory is the OCADE-side home of the primary-logic source supplied as
`.incoming/OCADE_PRIMARY_LOGIC.rar` and licensed by `LICENSE.md` in this folder.
`provenance.json` records the archive's verified hash, byte count and inventory,
and the licence determination that authorised direct integration.

## Why only part of the archive is here

The archive is a terminal application — 2,126 files whose centre of gravity is a
React reconciler that paints to a TTY. Copying all of it into a browser-first
product would have imported a second renderer, a PTY, an xterm host, a hosted
inference client, an analytics sink and a remote bridge, then required every one
of them to be disabled. The licence explicitly permits removing what does not
suit the target, so those layers were not imported at all.

What was imported is the part of the archive that is genuinely _logic_: rules,
parsers, state machines and contracts that do not care what is drawing the
screen. That code is stronger than what OCADE had, and it is now what OCADE
runs on.

## Layout, by responsibility

| Directory      | What lives here                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `permissions/` | The permission and risk model: modes, rules, rule parsing and serialisation, shell-rule matching, the dangerous-pattern table, classifier shapes, denial tracking. |
| `commands/`    | Shell safety. A complete bash parser, heredoc handling, pipe splitting, quoting, and the destructive-command warnings for both bash and PowerShell.                |
| `agent/`       | Agent-loop primitives: token budgeting, turn transitions, abort composition, a guarded async mailbox, sequential scheduling, tool limits.                          |
| `tasks/`       | Task and todo state: schemas, status transitions, and the tool-facing task contracts.                                                                              |
| `memory/`      | Memory record shapes and the age/decay model used to decide what is still relevant.                                                                                |
| `tools/`       | Tool-contract primitives: zod→JSON-schema conversion, schema caching, and the tool prompt/description text.                                                        |
| `protocol/`    | The message protocol the runtime speaks — content blocks, tool-use and tool-result shapes, stream events, session ids.                                             |
| `text/`        | Leaf utilities the above depend on: string handling, XML, formatting, hashing, ids, sanitisation.                                                                  |
| `shims/`       | The four boundaries where the donor assumed a terminal, a Node process, a bundler macro or a telemetry sink. See `shims/README.md`.                                |

## What is deliberately absent

Hosted inference and its OAuth; analytics and telemetry; the remote bridge and
upstream proxy; node-pty and the xterm web terminal; the Ink renderer and its
Yoga layout engine; the server-only entrypoints; and the donor's hosted model
provider table, which selected between vendor APIs that OCADE never calls.

`provenance.json` lists these under `removedDonorLayers`.

## Rules for changing this directory

Ported files keep the donor's formatting. Where behaviour was adapted, the
reason is written at the top of the file — read those before changing one, since
several encode a decision that is not obvious from the code.

Nothing here may import from `src/lib`, `src/components` or `src/routes`. The
dependency runs one way: the OCADE runtime in `src/lib/runtime` consumes this
directory, and this directory knows nothing about OCADE's surfaces.
