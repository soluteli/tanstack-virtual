#!/bin/bash
set -euo pipefail

# === Project paths ===
SRC_PROJECT="/Users/toy/Documents/frontend-projects/tanstack-virtual/src"
DEST_PROJECT="/Users/toy/Documents/StackTech/projects/wellytalk-monorepo/apps/workbench/src/components/chat"

# Direction: "pull" = copy from SRC_PROJECT → DEST_PROJECT (here is target)
#            "push" = copy from DEST_PROJECT → SRC_PROJECT (here is source)
DIRECTION="${1:-pull}"

# === Folder mappings: "src_rel:dst_rel" pairs ===
FOLDERS=(
  "examples:examples"
  "hooks:hooks"
  "utils:utils"
)

# === Execute based on direction ===
case "$DIRECTION" in
  pull)
    for pair in "${FOLDERS[@]}"; do
      src="${pair%%:*}"
      dst="${pair##*:}"
      cp -v "$SRC_PROJECT/$src"/* "$DEST_PROJECT/$dst/"
    done
    ;;
  push)
    for pair in "${FOLDERS[@]}"; do
      src="${pair%%:*}"
      dst="${pair##*:}"
      cp -v "$DEST_PROJECT/$dst"/* "$SRC_PROJECT/$src/"
    done
    ;;
  *)
    echo "Usage: $0 <pull|push>"
    echo "  pull: copy from wellytalk → tanstack-virtual"
    echo "  push: copy from tanstack-virtual → wellytalk"
    exit 1
    ;;
esac
