#!/usr/bin/env bash
# Compare note extraction output: current tree vs another commit (older pipeline).
#
# Usage:
#   ./scripts/compare-notes-pipeline-worktree.sh 8f4bb2d fixtures/note-pipeline-compare.json
#
# Requires: git, npm, OPENAI_API_KEY in the environment (same key used for both runs).
# Creates a sibling worktree ../shadow-notes-<shortsha>, runs npm ci, copies this script + fixture,
# runs the fixture twice, writes compare-notes-<sha>-old.json and compare-notes-<sha>-new.json
# in the current repo root, then runs diff(1).
#
set -euo pipefail

OLD_COMMIT="${1:?first arg: git commit (e.g. 8f4bb2d)}"
FIXTURE="${2:-fixtures/note-pipeline-compare.json}"
ROOT="$(git rev-parse --show-toplevel)"
SHORT="$(git rev-parse --short "$OLD_COMMIT")"
WT_PARENT="$(dirname "$ROOT")"
WT="$WT_PARENT/shadow-notes-$SHORT"
OUT_OLD="$ROOT/compare-notes-$SHORT-old.json"
OUT_NEW="$ROOT/compare-notes-$SHORT-new.json"

if [[ ! -f "$ROOT/$FIXTURE" ]]; then
  echo "Fixture not found: $ROOT/$FIXTURE" >&2
  exit 1
fi

if [[ -d "$WT" ]]; then
  echo "Worktree already exists: $WT (remove it or pick another commit)" >&2
  exit 1
fi

echo "Adding worktree at $WT @ $OLD_COMMIT"
git worktree add "$WT" "$OLD_COMMIT"

mkdir -p "$WT/scripts" "$WT/fixtures"
cp "$ROOT/scripts/run-note-pipeline-fixture.ts" "$WT/scripts/"
cp "$ROOT/$FIXTURE" "$WT/fixtures/note-pipeline-compare.json"

echo "npm ci in worktree (may take a minute; use npm install if lockfile mismatch)..."
(cd "$WT" && npm ci --silent)

echo "Running OLD pipeline..."
(cd "$WT" && npx tsx scripts/run-note-pipeline-fixture.ts fixtures/note-pipeline-compare.json) > "$OUT_OLD"

echo "Running NEW pipeline..."
(cd "$ROOT" && npx tsx scripts/run-note-pipeline-fixture.ts "$FIXTURE") > "$OUT_NEW"

echo "Wrote $OUT_OLD"
echo "Wrote $OUT_NEW"
echo "--- diff ---"
diff -u "$OUT_OLD" "$OUT_NEW" || true

git worktree remove "$WT" --force
echo "Removed worktree $WT"
