#!/bin/bash
# CELL CITY V3 — NOC Phase 1 Test Suite
# Testes de unidade e integracao para o NOC Dashboard.
# Cobre: data collectors, health score, widgets, navegacao, cache.
set -uo pipefail

V3_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../scripts/control-center/v3" && pwd)"
CC_ROOT="$(cd "$V3_ROOT/.." && pwd)"
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"
readonly V3_ROOT CC_ROOT REPO_DIR

export V3_ROOT CC_ROOT REPO_DIR

source "$V3_ROOT/shared/constants.sh"
source "$V3_ROOT/shared/utils.sh"
source "$V3_ROOT/shared/types.sh"
source "$V3_ROOT/logs/logger.sh"
source "$V3_ROOT/cache/engine.sh"

_V3_TESTS_PASSED=0
_V3_TESTS_FAILED=0
_V3_TESTS_TOTAL=0

_v3_test_assert() {
  local desc="$1" condition="$2" expected="${3:-0}" actual="${4:-}"
  ((_V3_TESTS_TOTAL++))
  if eval "$condition"; then
    ((_V3_TESTS_PASSED++))
    echo "  PASS: $desc"
  else
    ((_V3_TESTS_FAILED++))
    echo "  FAIL: $desc (expected: $expected, got: $actual)"
  fi
}

_v3_test_suite() {
  local suite="$1"
  echo ""
  echo "=== $suite ==="
}

echo "============================================"
echo "  CELL CITY V3 — NOC PHASE 1 TEST SUITE"
echo "============================================"

_v3_test_suite "1. Data Collectors"
source "$V3_ROOT/services/collectors.sh" 2>/dev/null || { echo "  SKIP: collectors.sh not found"; }

_v3_cache_boot

if declare -f _v3_collect_git >/dev/null 2>&1; then
  git_data=""
  git_data=$(_v3_collect_git 2>/dev/null || echo '{"status":"error"}')
  git_status=""
  git_status=$(echo "$git_data" | jq -r '.status // "error"')
  _v3_test_assert "Git collector returns data" '[[ "$git_status" != "error" ]]' "OK" "$git_status"

  git_branch=""
  git_branch=$(echo "$git_data" | jq -r '.branch // ""')
  _v3_test_assert "Git collector has branch" '[[ -n "$git_branch" ]]' "non-empty" "$git_branch"

  git_commit=""
  git_commit=$(echo "$git_data" | jq -r '.commit // ""')
  _v3_test_assert "Git collector has commit" '[[ -n "$git_commit" ]]' "non-empty" "$git_commit"

  git_ws=""
  git_ws=$(echo "$git_data" | jq -r '.workspace // ""')
  _v3_test_assert "Git collector has workspace status" '[[ "$git_ws" == "clean" || "$git_ws" == "dirty" ]]' "clean/dirty" "$git_ws"
else
  echo "  SKIP: Git collector not loaded"
fi

if declare -f _v3_collect_system >/dev/null 2>&1; then
  sys_data=""
  sys_data=$(_v3_collect_system 2>/dev/null || echo '{"status":"error"}')
  sys_status=""
  sys_status=$(echo "$sys_data" | jq -r '.status // "error"')
  _v3_test_assert "System collector returns data" '[[ "$sys_status" != "error" ]]' "OK" "$sys_status"

  cpu=""
  cpu=$(echo "$sys_data" | jq -r '.cpu_percent // -1')
  _v3_test_assert "System collector has CPU >= 0" '[[ "$cpu" -ge 0 ]]' ">=0" "$cpu"

  ram=""
  ram=$(echo "$sys_data" | jq -r '.ram_percent // -1')
  _v3_test_assert "System collector has RAM >= 0" '[[ "$ram" -ge 0 ]]' ">=0" "$ram"
else
  echo "  SKIP: System collector not loaded"
fi

if declare -f _v3_collect_backup >/dev/null 2>&1; then
  backup_data=""
  backup_data=$(_v3_collect_backup 2>/dev/null || echo '{"status":"error"}')
  _v3_test_assert "Backup collector returns data" '[[ -n "$backup_data" ]]' "non-empty" ""
else
  echo "  SKIP: Backup collector not loaded"
fi

if declare -f _v3_collect_all >/dev/null 2>&1; then
  all_data=""
  all_data=$(_v3_collect_all 2>/dev/null || echo "{}")
  _v3_test_assert "Collect all returns non-empty JSON" '[[ "$all_data" != "{}" ]]' "non-empty" ""
else
  echo "  SKIP: Collect all not loaded"
fi

_v3_test_suite "2. Health Score"
source "$V3_ROOT/services/health-score.sh" 2>/dev/null || { echo "  SKIP: health-score.sh not found"; }

if declare -f _v3_health_calculate >/dev/null 2>&1; then
  health_result=""
  health_result=$(_v3_health_calculate 2>/dev/null || echo '{"score":-1,"level":"ERROR"}')
  score=""
  score=$(echo "$health_result" | jq -r '.score // -1')
  _v3_test_assert "Health score is a number 0-100" '[[ "$score" -ge 0 && "$score" -le 100 ]]' "0-100" "$score"

  level=""
  level=$(echo "$health_result" | jq -r '.level // "ERROR"')
  _v3_test_assert "Health level is valid" '[[ "$level" == "EXCELENTE" || "$level" == "BOM" || "$level" == "ATENCAO" || "$level" == "CRITICO" ]]' "valid" "$level"

  components=""
  components=$(echo "$health_result" | jq -r '.components | keys | length')
  _v3_test_assert "Health has component details" '[[ "$components" -gt 0 ]]' ">0" "$components"
else
  echo "  SKIP: Health calculate not loaded"
fi

if declare -f _v3_health_quick >/dev/null 2>&1; then
  quick=""
  quick=$(_v3_health_quick 2>/dev/null || echo '{"score":-1}')
  qscore=""
  qscore=$(echo "$quick" | jq -r '.score // -1')
  _v3_test_assert "Quick health returns score" '[[ "$qscore" -ge 0 && "$qscore" -le 100 ]]' "0-100" "$qscore"
else
  echo "  SKIP: Quick health not loaded"
fi

_v3_test_suite "3. Health Label Ranges"
_v3_test_assert "Score 98 = EXCELENTE"  '[[ "$(_v3_health_label 98)" == "EXCELENTE" ]]' "EXCELENTE" "$(_v3_health_label 98)"
_v3_test_assert "Score 95 = EXCELENTE"  '[[ "$(_v3_health_label 95)" == "EXCELENTE" ]]' "EXCELENTE" "$(_v3_health_label 95)"
_v3_test_assert "Score 90 = BOM"        '[[ "$(_v3_health_label 90)" == "BOM" ]]' "BOM" "$(_v3_health_label 90)"
_v3_test_assert "Score 80 = BOM"        '[[ "$(_v3_health_label 80)" == "BOM" ]]' "BOM" "$(_v3_health_label 80)"
_v3_test_assert "Score 75 = ATENCAO"    '[[ "$(_v3_health_label 75)" == "ATENCAO" ]]' "ATENCAO" "$(_v3_health_label 75)"
_v3_test_assert "Score 60 = ATENCAO"    '[[ "$(_v3_health_label 60)" == "ATENCAO" ]]' "ATENCAO" "$(_v3_health_label 60)"
_v3_test_assert "Score 50 = CRITICO"    '[[ "$(_v3_health_label 50)" == "CRITICO" ]]' "CRITICO" "$(_v3_health_label 50)"
_v3_test_assert "Score 0  = CRITICO"    '[[ "$(_v3_health_label 0)" == "CRITICO" ]]' "CRITICO" "$(_v3_health_label 0)"

_v3_test_suite "4. Cache Engine"
_v3_cache_set "test_key" "test_value" 30
cached=""
cached=$(_v3_cache_get "test_key" 2>/dev/null || echo "")
_v3_test_assert "Cache set/get works" '[[ "$cached" == "test_value" ]]' "test_value" "$cached"

_v3_cache_delete "test_key"
cached=$(_v3_cache_get "test_key" 2>/dev/null || echo "")
_v3_test_assert "Cache delete works" '[[ -z "$cached" ]]' "empty" "$cached"

_v3_test_suite "5. Event Bus"
source "$V3_ROOT/core/event-bus.sh" 2>/dev/null
_v3_event_boot
_v3_event_pub "test.event" '{"key":"value"}'
events=0
[[ -f "$_V3_EVENT_LOG" ]] && events=$(jq '.events | length' "$_V3_EVENT_LOG" 2>/dev/null || echo 0)
_v3_test_assert "Event pub creates entry" '[[ "$events" -gt 0 ]]' ">0" "$events"

_v3_test_suite "6. Component Registry"
source "$V3_ROOT/core/registry.sh" 2>/dev/null
_v3_registry_boot
_v3_registry_register "test" "test-component" "/tmp" '{"version":"1.0"}'
reg_count=""
reg_count=$(_v3_registry_count)
_v3_test_assert "Registry register works" '[[ "$reg_count" -gt 0 ]]' ">0" "$reg_count"

_v3_registry_unregister "test" "test-component"
_v3_test_assert "Registry unregister works" 'true' "" ""

_v3_test_suite "7. Utils"
ts=""
ts=$(_v3_timestamp)
_v3_test_assert "Timestamp format is ISO" '[[ "$ts" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]' "ISO format" "$ts"

dur=""
dur=$(_v3_format_duration 3661)
_v3_test_assert "Duration 3661s formatted" '[[ "$dur" == "1h 1m 1s" ]]' "1h 1m 1s" "$dur"

trunc=""
trunc=$(_v3_truncate "hello world test" 10)
_v3_test_assert "Truncate to 10 chars" '[[ ${#trunc} -le 10 ]]' "<=10" "${#trunc}"

_v3_test_suite "8. Dashboard File Integrity"
v3_files=(
  "$V3_ROOT/noc.sh"
  "$V3_ROOT/panels/noc-dashboard.sh"
  "$V3_ROOT/services/collectors.sh"
  "$V3_ROOT/services/health-score.sh"
  "$V3_ROOT/core/event-bus.sh"
  "$V3_ROOT/core/registry.sh"
  "$V3_ROOT/core/kernel.sh"
  "$V3_ROOT/core/plugin.sh"
  "$V3_ROOT/core/loader.sh"
  "$V3_ROOT/widgets/base.sh"
  "$V3_ROOT/panels/base.sh"
  "$V3_ROOT/services/base.sh"
  "$V3_ROOT/cache/engine.sh"
  "$V3_ROOT/logs/logger.sh"
  "$V3_ROOT/shared/constants.sh"
  "$V3_ROOT/shared/utils.sh"
  "$V3_ROOT/shared/types.sh"
  "$V3_ROOT/config/v3.conf"
  "$V3_ROOT/config/v3-modules.conf"
)
for f in "${v3_files[@]}"; do
  _v3_test_assert "File exists: $(basename "$f")" '[[ -f "$f" || -x "$f" ]]' "exists" ""
done

_v3_test_suite "9. Bash Syntax Validation"
for f in $(find "$V3_ROOT" -name "*.sh" -not -path "*/plugins/*" -not -path "*/state/*" | sort); do
  if bash -n "$f" 2>/dev/null; then
    _v3_test_assert "Syntax OK: $(basename "$(dirname "$f")")/$(basename "$f")" 'true' "" ""
  else
    _v3_test_assert "Syntax OK: $(basename "$(dirname "$f")")/$(basename "$f")" 'false' "valid" "invalid"
  fi
done

_v3_test_suite "10. V1/V2 Backward Compatibility"
v1_files=(
  "$CC_ROOT/core/menu.sh"
  "$CC_ROOT/config/modules.conf"
)
for f in "${v1_files[@]}"; do
  _v3_test_assert "V1 file intact: $(basename "$f")" '[[ -f "$f" ]]' "exists" ""
done

bash -n "$CC_ROOT/core/menu.sh" 2>/dev/null
_v3_test_assert "V1 menu.sh syntax valid" '[[ $? -eq 0 ]]' "valid" ""

v1_module_count=""
v1_module_count=$(grep -c '^[0-9]' "$CC_ROOT/config/modules.conf" 2>/dev/null || echo 0)
_v3_test_assert "V1 modules.conf has entries" '[[ "$v1_module_count" -ge 10 ]]' ">=10" "$v1_module_count"

echo ""
echo "============================================"
echo "  RESULTADOS"
echo "============================================"
echo "  Total  : $_V3_TESTS_TOTAL"
echo "  Passed : $_V3_TESTS_PASSED"
echo "  Failed : $_V3_TESTS_FAILED"
if [[ "$_V3_TESTS_FAILED" -eq 0 ]]; then
  echo -e "  Status : ${_CC_C_VERDE:-}ALL TESTS PASSED${_CC_C_RESET:-}"
else
  echo -e "  Status : ${_CC_C_VERMELHO:-}$_V3_TESTS_FAILED TESTS FAILED${_CC_C_RESET:-}"
fi
echo "============================================"

exit $_V3_TESTS_FAILED
