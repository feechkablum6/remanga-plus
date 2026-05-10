#!/bin/bash
# ReManga Plus native messaging host shim.
# Chrome spawns this binary with the calling extension origin as $1.
# We forward to the bundled Node + bundled host.js with all paths resolved
# relative to the install directory so the package is self-contained.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

export REMANGA_PARSER_BUNDLE="$DIR/parser-server.js"
export REMANGA_NODE_BIN="$DIR/node"
export REMANGA_PARSER_CACHE_DIR="$HOME/Library/Caches/Remanga Plus"

mkdir -p "$REMANGA_PARSER_CACHE_DIR"

exec "$DIR/node" "$DIR/host.js" "$@"
