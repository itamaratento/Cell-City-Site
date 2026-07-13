#!/bin/bash
# Cell City V3 — Monitoring
# Sistema de monitoramento: eventos, alertas, notificações
set -uo pipefail

CC_V3_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$MON_DIR/lib/event.sh"
source "$MON_DIR/lib/alert.sh"
source "$MON_DIR/lib/severity.sh"

_cc_v3_monitor_evento() {
  local tipo="$1"
  local severidade="${2:-info}"
  local componente="$3"
  local mensagem="$4"
  local dados="${5:-{}}"

  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")
  local evento_id="evt_$(date +%Y%m%d_%H%M%S)_$$"

  local evento
  evento=$(_cc_v3_monitor_criar_evento "$evento_id" "$tipo" "$severidade" "$timestamp" "$componente" "$mensagem" "$dados")

  echo "$evento" >> "$MON_DIR/state/event-log.json"

  local regras="$MON_DIR/alerts/thresholds.conf"
  if [[ -f "$regras" ]]; then
    _cc_v3_monitor_avaliar_regras "$evento" "$regras"
  fi

  _cc_v3_monitor_notificar "$evento"
}

_cc_v3_monitor_notificar() {
  local evento="$1"
  local severidade
  severidade=$(echo "$evento" | grep -o '"severidade":[[:space:]]*"[^"]*"' | cut -d'"' -f4)

  local cor=""
  case "$severidade" in
    critical) cor="\033[0;31m" ;;
    high)     cor="\033[0;35m" ;;
    warning)  cor="\033[0;33m" ;;
    info)     cor="\033[0;32m" ;;
    debug)    cor="\033[0;36m" ;;
  esac

  # shellcheck disable=SC2154
  local mensagem
  mensagem=$(echo "$evento" | grep -o '"mensagem":[[:space:]]*"[^"]*"' | cut -d'"' -f4)

  if [[ -t 1 ]]; then
    echo -e "${cor}[MONITOR] ${severidade}: ${mensagem}\033[0m"
  else
    echo "[MONITOR] [${severidade}] ${mensagem}"
  fi

  local log_file="${CC_V3_LOGS:-/dev/null}/monitoring.log"
  if [[ -d "$(dirname "$log_file" 2>/dev/null)" ]]; then
    echo "$evento" >> "$log_file"
  fi
}

_cc_v3_monitor_listar_alertas() {
  local alert_file="$MON_DIR/state/alert-history.json"
  if [[ ! -f "$alert_file" ]]; then
    echo '{"alertas":[]}'
    return
  fi
  cat "$alert_file"
}

case "${1:-}" in
  --event)
    shift
    _cc_v3_monitor_evento "$@"
    ;;
  --alerts)
    _cc_v3_monitor_listar_alertas
    ;;
  --help|-h)
    echo "Uso: monitor.sh [--event <tipo> <severidade> <componente> <mensagem>] [--alerts]"
    ;;
  *)
    echo "Uso: monitor.sh --event <tipo> <severidade> <componente> <mensagem>"
    ;;
esac
