#!/bin/bash
# Cell City Control Center — NOC V3 Bridge Module
# Permite acessar o NOC V3 a partir do menu V1.
# Compatibilidade: chama o noc.sh da V3; se nao existir, exibe aviso amigavel.
set -uo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"

source "$CC_ROOT/lib/common.sh"

V3_NOC="$CC_ROOT/v3/noc.sh"

_cc_screen_title "NOC V3"
_cc_screen_breadcrumb "Control Center > NOC V3"
_cc_box_blank
_cc_box_text "CELL CITY OPERATIONS CENTER"
_cc_box_text "NOC v$(cat "$CC_ROOT/v3/VERSION" 2>/dev/null || echo "3.0.0") (Network Operations Center)"
_cc_box_blank
_cc_box_text "O NOC V3 oferece uma visao unificada e em tempo real"
_cc_box_text "de todo o ecossistema Cell City."
_cc_box_blank

if [[ -f "$V3_NOC" ]]; then
  _cc_box_item "1" "Abrir NOC Dashboard"
  _cc_box_blank
  _cc_box_item "0" "Voltar"
  _cc_screen_footer "1 abre o NOC V3 · 0 volta ao menu principal"

  # Módulos são EXECUTADOS pelo core/menu.sh (bash modules/<slug>/menu.sh),
  # não "sourced" — "return" no nível do script gera erro; usar "exit".
  read -rp "Opcao: " escolha || exit 0

  case "$escolha" in
    1)
      _cc_log "NOC V3 acessado via menu V1"
      exec bash "$V3_NOC"
      ;;
    0) exit 0 ;;
    *) echo "Opcao invalida." ; _cc_pause ; exit 0 ;;
  esac
else
  _cc_box_text "NOC V3 ainda nao instalado."
  _cc_box_text "Execute a Fase 0 da arquitetura V3 para ativar."
  _cc_box_blank
  _cc_box_item "0" "Voltar"
  _cc_screen_footer "0 volta ao menu principal"
  _cc_pause
fi
