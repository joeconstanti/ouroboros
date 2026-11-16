#!/usr/bin/env bash
# Generic evaluator: runs commands from .ouroboros/config.yaml and emits a parseable score.
# Lower OUROBOROS_EVAL_PRIMARY is better (failed steps increment the score).
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

start_ms="$(date +%s)000"

run_step() {
	"$@" || return 1
	return 0
}

failures=0
status=ok

test_cmd=""
lint_cmd=""
build_cmd=""

evaluation_error() {
 echo "OUROBOROS_EVAL_STATUS=fail"
 echo "OUROBOROS_EVAL_PRIMARY=1"
 echo "OUROBOROS_EVAL_DURATION_MS=0"
 echo "$1" >&2
 exit 1
}
[[ -f .ouroboros/config.yaml ]] || evaluation_error "Missing .ouroboros/config.yaml"
command -v yq &>/dev/null || evaluation_error "Install mikefarah/yq to read evaluator commands"
test_cmd="$(yq -r '.commands.test // ""' .ouroboros/config.yaml)" || evaluation_error "Invalid evaluator configuration"
lint_cmd="$(yq -r '.commands.lint // ""' .ouroboros/config.yaml)" || evaluation_error "Invalid evaluator configuration"
build_cmd="$(yq -r '.commands.build // ""' .ouroboros/config.yaml)" || evaluation_error "Invalid evaluator configuration"

if [[ -n "${test_cmd// /}" ]]; then
	if ! run_step bash -c "$test_cmd"; then
		failures=$((failures + 1))
		status=fail
	fi
fi

if [[ -n "${lint_cmd// /}" ]]; then
	if ! run_step bash -c "$lint_cmd"; then
		failures=$((failures + 1))
		status=fail
	fi
fi

if [[ -n "${build_cmd// /}" ]]; then
	if ! run_step bash -c "$build_cmd"; then
		failures=$((failures + 1))
		status=fail
	fi
fi

# An empty evaluator provides no evidence of correctness.
if [[ -z "${test_cmd//[[:space:]]/}" && -z "${lint_cmd//[[:space:]]/}" && -z "${build_cmd//[[:space:]]/}" ]]; then
 evaluation_error "Configure commands.test, commands.lint, or commands.build in .ouroboros/config.yaml"
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
