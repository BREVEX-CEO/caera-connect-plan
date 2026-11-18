#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

if sh scripts/setup-graphify.sh >&2; then
    cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Graphify is ready. For architecture and system-relationship questions, run sh scripts/graphify-cli.sh query \"<question>\" and read graphify-out/GRAPH_REPORT.md before searching application source."}}
JSON
else
    cat <<'JSON'
{"systemMessage":"OCADE Graphify startup failed. Run sh scripts/graphify-status.sh for diagnostics and check the install.log or refresh.log path it prints.","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Graphify startup failed. Surface the failure and use sh scripts/graphify-cli.sh query \"<question>\" to retry recovery before answering architecture questions."}}
JSON
fi
