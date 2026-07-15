#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Fluxo de
# Desenvolvimento (Fase 10 — CCC-F10-001, "Fluxo de Desenvolvimento").
# Mostra os estágios oficiais (config/workflow.conf) e, pra cada fase do
# Roadmap, o estágio atual — derivado do status via
# lib/utils.sh:_cc_cia_estagio_atual, nunca reclassificado aqui.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"

_cc_cia_workflow() {
  _cc_screen_title "FLUXO DE DESENVOLVIMENTO"
  _cc_screen_breadcrumb "Control Center › Central de IAs"
  _cc_box_blank

  local estagios
  # "→ " (com espaço) e nunca só "→": um separador sem espaço nenhum vira
  # uma "palavra" única longa demais pro word-wrap de _cc_box_text, que
  # degenera em corte silencioso de texto (mesmo achado real de
  # lib/agents.sh, "Módulos atribuídos").
  estagios=$(_cc_cia_estagios | paste -sd '→' - | sed 's/→/→ /g')
  _cc_box_text "Estágios oficiais: $estagios"
  _cc_box_blank

  local numero nome status
  while IFS='|' read -r numero nome _ status _; do
    _cc_box_text "Fase $numero — $nome: $(_cc_cia_estagio_atual "$status")"
  done < <(_cc_cia_fases)

  _cc_box_blank
  _cc_box_close
  _cc_cia_log "Fluxo de Desenvolvimento consultado"
}
