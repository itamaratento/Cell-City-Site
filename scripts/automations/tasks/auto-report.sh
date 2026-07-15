#!/bin/bash
# Automations — Auto Report
# Gera relatório consolidado de todos os componentes V3
set -uo pipefail

AUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$AUT_DIR/lib/utils.sh"

CC_V3_ROOT="$(cd "$AUT_DIR/../.." && pwd)"

_cc_v3_autom_auto_report() {
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

  jq -n \
    --arg ts "$timestamp" \
    --arg hs "$health_score" \
    --argjson al "$alertas" \
    --argjson fi "$findings" \
    --arg mem "$mem" \
    --arg disk "$disk" \
    '{
      timestamp: $ts,
      tipo: "relatorio_consolidado",
      versao: "3.0.0",
      health_score: $hs,
      alertas_ativos: $al,
      total_findings: $fi,
      memoria_percent: $mem,
      disco_percent: $disk,
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
