#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Especialidades
# (Fase 10 — CCC-F10-001, "Especialidades"). Só formata a coluna
# "especialidades" de config/registry.conf — nenhuma lista duplicada aqui.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"

_cc_cia_especialidades() {
  _cc_screen_title "ESPECIALIDADES"
  _cc_screen_breadcrumb "Control Center › Central de IAs"
  _cc_box_blank

  local slug nome versao funcao especialidades esp
  while IFS='|' read -r slug nome versao funcao especialidades; do
    _cc_box_text "${nome}:"
    IFS=',' read -ra lista <<< "$especialidades"
    for esp in "${lista[@]}"; do
      _cc_box_text "  • $esp"
    done
    _cc_box_blank
  done < <(_cc_cia_ias)

  _cc_box_close
  _cc_cia_log "Especialidades consultadas"
}
