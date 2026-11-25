#!/bin/sh
# Install RTK (Rust Token Killer, github.com/rtk-ai/rtk) if missing and link it into /usr/local/bin.
# Always copy the repo RTK config (command exclusions) into place, even when RTK is already installed.
# The version comes from git tags because the installer's own lookup (releases redirect/API) is blocked by the cloud proxy.
set -eu
cd "$(dirname "$0")/.."
mkdir -p "$HOME/.config/rtk"
cp .claude/rtk/config.toml "$HOME/.config/rtk/config.toml"
command -v rtk >/dev/null 2>&1 && exit 0
version=$(git ls-remote --tags --refs https://github.com/rtk-ai/rtk.git | sed 's#.*/##' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | RTK_VERSION="$version" sh
ln -sf "$HOME/.local/bin/rtk" /usr/local/bin/rtk
