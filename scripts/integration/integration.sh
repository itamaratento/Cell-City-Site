#!/bin/bash
# Cell City V3 — Integration Hub
# Orquestra execução em cadeia entre todos os componentes V3
set -uo pipefail

CC_V3_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

_cc_v3_int_log() {
  local level="$1"
  local message="$2"
  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  local color=""
  case "$level" in
    error|critical) color="\033[0;31m" ;;
    warn)           color="\033[0;33m" ;;
    info)           color="\033[0;32m" ;;
  esac

  if [[ -t 1 ]]; then
    echo -e "${color}[${timestamp}] [${level}] [Integration] ${message}\033[0m"
  else
    echo "[${timestamp}] [${level}] [Integration] ${message}"
  fi
}

_cc_v3_int_health_chain() {
  _cc_v3_int_log "info" "Executando cadeia: Health → Monitor → Panel"

  local he_engine="$CC_V3_ROOT/scripts/health-engine/engine.sh"
  local monitor="$CC_V3_ROOT/scripts/monitoring/monitor.sh"
  local panel="$CC_V3_ROOT/scripts/smart-panel/panel.sh"

  if [[ -f "$he_engine" ]]; then
    _cc_v3_int_log "info" "Health Engine: health check rápido"
    bash "$he_engine" --quick 2>/dev/null
  fi

  if [[ -f "$monitor" ]]; then
    _cc_v3_int_log "info" "Monitoring: registrando evento"
    bash "$monitor" --event health info Integration "Cadeia de integração executada" 2>/dev/null
  fi

  if [[ -f "$panel" ]]; then
    _cc_v3_int_log "info" "Smart Panel: renderizando dashboard"
    bash "$panel" --compact 2>/dev/null
  fi

  _cc_v3_int_log "info" "Cadeia Health concluída"
}

_cc_v3_int_diagnose_chain() {
  _cc_v3_int_log "info" "Executando cadeia: Diag → Prompt"

  local de_engine="$CC_V3_ROOT/scripts/diagnostic-engine/engine.sh"
  local pg_generator="$CC_V3_ROOT/scripts/prompt-generator/generator.sh"

  if [[ -f "$de_engine" ]]; then
    _cc_v3_int_log "info" "Diagnostic Engine: diagnóstico rápido"
    bash "$de_engine" --quick 2>/dev/null
  fi

  if [[ -f "$pg_generator" ]]; then
    _cc_v3_int_log "info" "Prompt Generator: gerando prompt com contexto"
    bash "$pg_generator" --quick --goal "Diagnóstico do sistema" 2>/dev/null
  fi

  _cc_v3_int_log "info" "Cadeia Diagnóstico concluída"
}

_cc_v3_int_full() {
  _cc_v3_int_log "info" "Executando cadeia completa V3"

  local obs="$CC_V3_ROOT/scripts/observability/observability.sh"
  local he="$CC_V3_ROOT/scripts/health-engine/engine.sh"
  local de="$CC_V3_ROOT/scripts/diagnostic-engine/engine.sh"
  local mon="$CC_V3_ROOT/scripts/monitoring/monitor.sh"
  local pg="$CC_V3_ROOT/scripts/prompt-generator/generator.sh"
  local panel="$CC_V3_ROOT/scripts/smart-panel/panel.sh"

  if [[ -f "$obs" ]]; then
    _cc_v3_int_log "info" "[1/5] Coletando métricas"
    bash "$obs" --collect sistema 2>/dev/null
  fi

  if [[ -f "$he" ]]; then
    _cc_v3_int_log "info" "[2/5] Health check"
    bash "$he" --quick 2>/dev/null
  fi

  if [[ -f "$de" ]]; then
    _cc_v3_int_log "info" "[3/5] Diagnóstico rápido"
    bash "$de" --quick 2>/dev/null
  fi

  if [[ -f "$mon" ]]; then
    _cc_v3_int_log "info" "[4/5] Registrando evento"
    bash "$mon" --event health info Integration "Cadeia completa V3 executada" 2>/dev/null
  fi

  if [[ -f "$panel" ]]; then
    _cc_v3_int_log "info" "[5/5] Renderizando painel"
    bash "$panel" 2>/dev/null
  fi

  _cc_v3_int_log "info" "Cadeia completa V3 concluída"
}

_cc_v3_int_status() {
  _cc_v3_int_log "info" "Status consolidado dos componentes V3:"

  local he_state="$CC_V3_ROOT/scripts/health-engine/state/health-check.json"
  local metrics="$CC_V3_ROOT/scripts/observability/state/metrics.json"
  local alerts="$CC_V3_ROOT/scripts/monitoring/state/alert-history.json"
  local diag="$CC_V3_ROOT/scripts/diagnostic-engine/state/last-diagnostic.json"
  local auto="$CC_V3_ROOT/scripts/automations/state/automation-status.json"

  if [[ -f "$he_state" ]]; then
    local score
    score=$(jq -r '.score.geral // "N/A"' "$he_state")
    echo "  Health Engine: score $score"
  fi

  if [[ -f "$metrics" ]]; then
    local mem disk
    mem=$(jq -r '.metrics.system.memory_percent // "N/A"' "$metrics")
    disk=$(jq -r '.metrics.system.disk_usage_percent // "N/A"' "$metrics")
    echo "  Observability: mem ${mem}% disk ${disk}%"
  fi

  if [[ -f "$alerts" ]]; then
    local total
    total=$(jq '[.alertas[] | select(.resolvido == false)] | length' "$alerts" 2>/dev/null || echo 0)
    echo "  Monitoring: $total alertas ativos"
  fi

  if [[ -f "$diag" ]]; then
    local findings
    findings=$(jq -r '.total_findings // 0' "$diag")
    echo "  Diagnostic Engine: $findings findings"
  fi

  if [[ -f "$auto" ]]; then
    local last_task last_status
    last_task=$(jq -r '.ultima_tarefa // "N/A"' "$auto")
    last_status=$(jq -r '.status // "N/A"' "$auto")
    echo "  Automations: $last_task ($last_status)"
  fi

  local ee_status
  ee_status=$(bash "$CC_V3_ROOT/scripts/execution-engine/engine.sh" --status 2>/dev/null | tail -1)
  echo "  Execution Engine: $ee_status"
}

case "${1:-}" in
  --health)    _cc_v3_int_health_chain ;;
  --diagnose)  _cc_v3_int_diagnose_chain ;;
  --full)      _cc_v3_int_full ;;
  --status)    _cc_v3_int_status ;;
  --help|-h)
    echo "Uso: integration.sh [--health|--diagnose|--full|--status]"
    echo ""
    echo "  --health    Health → Monitor → Panel"
    echo "  --diagnose  Diag → Prompt"
    echo "  --full      Observability → Health → Diag → Monitor → Panel"
    echo "  --status    Status consolidado de todos os componentes"
    ;;
  *)           _cc_v3_int_status ;;
esac
