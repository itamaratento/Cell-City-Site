#!/bin/bash
# Automations — Auto Cleanup
# Limpeza automática de logs, state e arquivos temporários
set -uo pipefail

AUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$AUT_DIR/lib/utils.sh"

CC_V3_ROOT="$(cd "$AUT_DIR/../.." && pwd)"

_cc_v3_autom_auto_cleanup() {
  _cc_v3_log "info" "Auto-Cleanup" "Iniciando limpeza automática"

  local cleaned=0

  if [[ -d "$CC_V3_ROOT/logs" ]]; then
    local old_logs
    old_logs=$(find "$CC_V3_ROOT/logs" -name "*.log.*" -mtime +30 2>/dev/null | wc -l)
    if (( old_logs > 0 )); then
      find "$CC_V3_ROOT/logs" -name "*.log.*" -mtime +30 -delete 2>/dev/null
      _cc_v3_log "info" "Auto-Cleanup" "Removidos $old_logs logs antigos"
      ((cleaned++))
    fi
  fi

  find "$CC_V3_ROOT/scripts" -path "*/state/*.json" -mtime +90 -delete 2>/dev/null
  if [[ $? -eq 0 ]]; then
    _cc_v3_log "info" "Auto-Cleanup" "States antigos (>90d) limpos"
    ((cleaned++))
  fi

  _cc_v3_autom_salvar_status "auto-cleanup" "concluido" "Limpeza: $cleaned itens processados"
  _cc_v3_log "info" "Auto-Cleanup" "Limpeza concluída: $cleaned itens processados"
}

_cc_v3_autom_auto_cleanup
