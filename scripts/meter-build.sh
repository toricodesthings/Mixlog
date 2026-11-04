#!/bin/sh
# Builds meter/pkg (committed). Paths are remapped so the .wasm is byte-identical on any machine (CI diffs it).
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
CARGO_ENCODED_RUSTFLAGS=$(printf '%s\037%s' "--remap-path-prefix=$HOME=~" "--remap-path-prefix=$root=.") \
  wasm-pack build "$root/meter" --target web --release --no-pack
rm -f "$root/meter/pkg/.gitignore"
