#!/bin/bash
# Cell City V3 — Automations
# Automações: auditoria, health, backup, limpeza, relatórios, alertas
set -uo pipefail

CC_V3_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$AUT_DIR/lib/utils.sh"
source "$AUT_DIR/lib/schedule.sh"

_cc_v3_autom_executar() {
  local task="${1:-}"
  local force="${2:-false}"

  if [[ -z "$task" ]]; then
    _cc_v3_autom_listar
    return
  fi

  _cc_v3_log "info" "Automations" "Executando automação: $task"

  case "$task" in
    auto-health)
      _cc_v3_autom_executar_task "$AUT_DIR/tasks/auto-health.sh"
      ;;
    auto-audit)
      _cc_v3_autom_executar_task "$AUT_DIR/tasks/auto-audit.sh"
      ;;
    auto-backup)
      _cc_v3_autom_executar_task "$AUT_DIR/tasks/auto-backup.sh"
      ;;
    auto-cleanup)
      _cc_v3_autom_executar_task "$AUT_DIR/tasks/auto-cleanup.sh"
      ;;
    auto-report)
      _cc_v3_autom_executar_task "$AUT_DIR/tasks/auto-report.sh"
      ;;
    auto-alert)
      local status_file="$CC_V3_ROOT/scripts/health-engine/state/health-check.json"
      if [[ -f "$status_file" ]]; then
        local score
        score=$(jq -r '.score.geral // 100' "$status_file")
        if (( $(echo "$score < 70" | bc -l 2>/dev/null || echo 0) )); then
          _cc_v3_log "warn" "Auto-Alert" "Score crítico: $score"
          _cc_v3_autom_salvar_status "auto-alert" "alerta" "Score $score abaixo do limiar 70"
        fi
      fi
      ;;
    auto-test)
      _cc_v3_log "info" "Auto-Test" "Testes automáticos disponível na V3-F11"
      _cc_v3_autom_salvar_status "auto-test" "pendente" "Disponível na V3-F11"
      ;;
    all)
      for task_script in "$AUT_DIR/tasks/"*.sh; do
        _cc_v3_autom_executar_task "$task_script"
      done
      ;;
    *)
      _cc_v3_log "error" "Automations" "Tarefa desconhecida: $task"
      ;;
  esac
}

_cc_v3_autom_executar_task() {
  local script="$1"
  if [[ -f "$script" ]]; then
    _cc_v3_log "info" "Automations" "Executando script: $(basename "$script")"
    bash "$script" 2>/dev/null || _cc_v3_log "error" "Automations" "Falha na execução: $(basename "$script")"
  fi
}

_cc_v3_autom_listar() {
  echo "Automações disponíveis:"
  echo "  auto-health   - Health check automático"
  echo "  auto-audit    - Auditoria automática"
  echo "  auto-backup   - Backup automático"
  echo "  auto-cleanup  - Limpeza automática"
  echo "  auto-report   - Relatório automático"
  echo "  all           - Todas as automações"
}

_cc_v3_autom_status() {
  local status_file="$AUT_DIR/state/automation-status.json"
  if [[ -f "$status_file" ]]; then
    cat "$status_file"
  else
    echo '{"status":"sem_execucoes","ultima_execucao":null}'
  fi
}

case "${1:-}" in
  --run)       shift; _cc_v3_autom_executar "$@" ;;
  --status)    _cc_v3_autom_status ;;
  --list)      _cc_v3_autom_listar ;;
  --help|-h)
    echo "Uso: automations.sh [--run <task>] [--status] [--list]"
    echo "Tasks: auto-health, auto-audit, auto-backup, auto-cleanup, auto-report, all"
    ;;
  *)           _cc_v3_autom_listar ;;
esac
