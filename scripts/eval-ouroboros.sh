#!/usr/bin/env bash
# Ouroboros self-host preset: score the repo tooling (CLI check + bash syntax).
# Lower OUROBOROS_EVAL_PRIMARY is better.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

start_ms="$(date +%s)000"
failures=0
status=ok

if [[ -d "cli" ]] && [[ -f "cli/package.json" ]]; then
	if ! (cd cli && bun run check); then
		failures=$((failures + 1))
		status=fail
	fi
else
	failures=$((failures + 1))
	status=fail
fi

if [[ -f "ouroboros.sh" ]]; then
	if ! bash -n ouroboros.sh; then
		failures=$((failures + 1))
		status=fail
	fi
fi

end_ms="$(date +%s)000"
duration=$((end_ms - start_ms))

echo "OUROBOROS_EVAL_STATUS=$status"
echo "OUROBOROS_EVAL_PRIMARY=$failures"
echo "OUROBOROS_EVAL_DURATION_MS=$duration"

if [[ "$status" != "ok" ]]; then
	exit 1
fi
exit 0
