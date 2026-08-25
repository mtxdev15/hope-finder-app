#!/usr/bin/env bash
# Delete remote branches whose every commit is already reachable from main.
#
# WHY A SCRIPT AND NOT A LIST: the merged set changes as branches land. A list
# written today is wrong tomorrow, and a stale list is how a branch with unmerged
# work gets deleted. This recomputes the set every run, so it is only ever acting
# on what is genuinely merged AT THE MOMENT YOU RUN IT.
#
# Safe by construction: a branch is only a candidate when
# `git rev-list --count origin/main..origin/<branch>` is 0 — every commit already
# in main. Deleting the ref then loses nothing.
#
#   ./scripts/delete-merged-branches.sh          # dry run, prints what it would do
#   ./scripts/delete-merged-branches.sh --yes    # actually deletes
set -euo pipefail

# Never delete these, even if merged.
#   main                        obvious
#   release-c1-monetization     production Convex was deployed from it — keep
#                               until `convex function-spec --prod` confirms
#                               production no longer needs it as a reference
#   claude/*                    active work, one deliberately held for Stage 6
PROTECTED='^(main|release-c1-monetization|claude/.*)$'

git fetch --prune --quiet origin

candidates=()
while read -r ref; do
  b="${ref#refs/heads/}"
  [[ "$b" =~ $PROTECTED ]] && continue
  git rev-parse -q --verify "origin/$b" >/dev/null 2>&1 || continue
  [[ "$(git rev-list --count "origin/main..origin/$b")" == "0" ]] && candidates+=("$b")
done < <(git ls-remote --heads origin | awk '{print $2}')

if [ ${#candidates[@]} -eq 0 ]; then echo "Nothing fully merged. Nothing to do."; exit 0; fi

echo "Fully merged into main (${#candidates[@]}):"
for b in "${candidates[@]}"; do printf '  %-52s %s\n' "$b" "$(git rev-parse --short "origin/$b")"; done

if [ "${1:-}" != "--yes" ]; then
  echo
  echo "Dry run. Re-run with --yes to delete."
  echo "Tip SHAs are recorded in docs/operations/branch-cleanup-2026-08-25.md;"
  echo "restore any with:  git push origin <sha>:refs/heads/<branch>"
  exit 0
fi

for b in "${candidates[@]}"; do
  printf '  deleting %-52s ' "$b"
  if git push origin --delete "$b" >/dev/null 2>&1; then echo "ok"; else echo "FAILED"; fi
done
