# Runtime boundary shims

The donor archive was a terminal application: it logged to a TUI, probed a Node
process, phoned a hosted analytics sink and gated features on a Bun bundler
macro. None of those exist inside OCADE, and three of them are things OCADE
deliberately does not ship (hosted inference, telemetry, remote bridge).

Rather than drag those layers in and then disable them, each is replaced here by
the smallest honest boundary the ported logic actually needs. Every shim is a
real implementation for the OCADE runtime — not a stub that silently drops work.
