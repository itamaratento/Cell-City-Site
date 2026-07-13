#!/bin/bash
# Automations — Auto Audit
# Executa auditoria automática
set -uo pipefail

AUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$AUT_DIR/lib/utils.sh"

CC_V3_ROOT="$(cd "$AUT_DIR/../.." && pwd)"
DE_ENGINE="$CC_V3_ROOT/scripts/diagnostic-engine/engine.sh"

_cc_v3_log "info" "Auto-Audit" "Iniciando auditoria automática"

if [[ -f "$DE_ENGINE" ]]; then
  bash "$DE_ENGINE" --auto
  _cc_v3_autom_salvar_status "auto-audit" "concluido" "Auditoria automática executada"
  _cc_v3_log "info" "Auto-Audit" "Auditoria automática concluída"
else
  _cc_v3_log "error" "Auto-Audit" "Diagnostic Engine não encontrado"
  _cc_v3_autom_salvar_status "auto-audit" "falha" "Diagnostic Engine não encontrado"
fi
