#!/bin/bash
# Automations — Auto Report
# Gera relatório consolidado de todos os componentes V3
set -uo pipefail

AUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$AUT_DIR/lib/utils.sh"

CC_V3_ROOT="$(cd "$AUT_DIR/../.." && pwd)"

_cc_v3_autom_auto_report() {
  _cc_v3_log "info" "Auto-Report" "Executando todas as automações antes do relatório"

  local automations_script="$AUT_DIR/automations.sh"
  local tasks_run=()
  local tasks_ok=0
  local tasks_fail=0

  if [[ -f "$automations_script" ]]; then
    for task_script in "$AUT_DIR/tasks/"*.sh; do
      local task_name
      task_name=$(basename "$task_script" .sh)
      [[ "$task_name" == "auto-report" ]] && continue

      _cc_v3_log "info" "Auto-Report" "Executando: $task_name"
      if bash "$task_script" 2>/dev/null; then
        tasks_run+=("$task_name:ok")
        ((tasks_ok++))
      else
        tasks_run+=("$task_name:fail")
        ((tasks_fail++))
      fi
    done
  fi

  _cc_v3_log "info" "Auto-Report" "Gerando relatório consolidado V3"

  local timestamp
  timestamp=$(_cc_v3_autom_timestamp)
  local report_dir="$AUT_DIR/state/reports"
  mkdir -p "$report_dir"

  local report_file="$report_dir/report-$(date +%Y%m%d_%H%M%S).json"

  local health_score="N/A"
  if [[ -f "$CC_V3_ROOT/scripts/health-engine/state/health-check.json" ]]; then
    health_score=$(jq -r '.score.geral // "N/A"' "$CC_V3_ROOT/scripts/health-engine/state/health-check.json")
  fi

  local alertas=0
  if [[ -f "$CC_V3_ROOT/scripts/monitoring/state/alert-history.json" ]]; then
    alertas=$(jq '[.alertas[] | select(.resolvido == false)] | length' "$CC_V3_ROOT/scripts/monitoring/state/alert-history.json" 2>/dev/null || echo 0)
  fi

  local findings=0
  if [[ -f "$CC_V3_ROOT/scripts/diagnostic-engine/state/last-diagnostic.json" ]]; then
    findings=$(jq -r '.total_findings // 0' "$CC_V3_ROOT/scripts/diagnostic-engine/state/last-diagnostic.json")
  fi

  local mem disk
  mem="N/A"; disk="N/A"
  if [[ -f "$CC_V3_ROOT/scripts/observability/state/metrics.json" ]]; then
    mem=$(jq -r '.metrics.system.memory_percent // "N/A"' "$CC_V3_ROOT/scripts/observability/state/metrics.json")
    disk=$(jq -r '.metrics.system.disk_usage_percent // "N/A"' "$CC_V3_ROOT/scripts/observability/state/metrics.json")
  fi

  local tasks_json="["
  local first_task=true
  for t in "${tasks_run[@]}"; do
    [[ "$first_task" == true ]] && first_task=false || tasks_json+=","
    local t_name="${t%%:*}"
    local t_status="${t##*:}"
    tasks_json+="{\"nome\":\"$t_name\",\"status\":\"$t_status\"}"
  done
  tasks_json+="]"

  jq -n \
    --arg ts "$timestamp" \
    --arg hs "$health_score" \
    --argjson al "$alertas" \
    --argjson fi "$findings" \
    --arg mem "$mem" \
    --arg disk "$disk" \
    --argjson tasks_ok "$tasks_ok" \
    --argjson tasks_fail "$tasks_fail" \
    --argjson tasks "$tasks_json" \
    '{
      timestamp: $ts,
      tipo: "relatorio_consolidado",
      versao: "3.0.0",
      health_score: $hs,
      alertas_ativos: $al,
      total_findings: $fi,
      memoria_percent: $mem,
      disco_percent: $disk,
      automacoes: {executadas: $tasks_ok, falhas: $tasks_fail, tarefas: $tasks},
      componentes: {
        health_engine: {state: "scripts/health-engine/state/health-check.json"},
        diagnostic_engine: {state: "scripts/diagnostic-engine/state/last-diagnostic.json"},
        monitoring: {state: "scripts/monitoring/state/alert-history.json"},
        observability: {state: "scripts/observability/state/metrics.json"}
      }
    }' > "$report_file"

  _cc_v3_autom_salvar_status "auto-report" "concluido" "Relatório salvo em $report_file"
  _cc_v3_log "info" "Auto-Report" "Relatório consolidado salvo em $report_file"
  cat "$report_file"
}

_cc_v3_autom_auto_report
