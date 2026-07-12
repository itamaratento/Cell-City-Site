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
  estagios=$(_cc_cia_estagios | paste -sd '→' -)
  _cc_box_text "Estágios oficiais: $estagios"
  _cc_box_blank

  local numero nome ia status modulos
  while IFS='|' read -r numero nome ia status modulos; do
    _cc_box_text "Fase $numero — $nome: $(_cc_cia_estagio_atual "$status")"
  done < <(_cc_cia_fases)

  _cc_box_blank
  _cc_box_close
  _cc_cia_log "Fluxo de Desenvolvimento consultado"
}
