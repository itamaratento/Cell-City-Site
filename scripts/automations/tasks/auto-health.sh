#!/bin/bash
# Automations — Auto Health
# Executa health check automático
set -uo pipefail

AUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$AUT_DIR/lib/utils.sh"

CC_V3_ROOT="$(cd "$AUT_DIR/../.." && pwd)"
HE_ENGINE="$CC_V3_ROOT/scripts/health-engine/engine.sh"

_cc_v3_log "info" "Auto-Health" "Iniciando health check automático"

if [[ -f "$HE_ENGINE" ]]; then
  bash "$HE_ENGINE" --quick
  _cc_v3_autom_salvar_status "auto-health" "concluido" "Health check automático executado"
  _cc_v3_log "info" "Auto-Health" "Health check automático concluído"
else
  _cc_v3_log "error" "Auto-Health" "Health Engine não encontrado"
  _cc_v3_autom_salvar_status "auto-health" "falha" "Health Engine não encontrado"
fi
