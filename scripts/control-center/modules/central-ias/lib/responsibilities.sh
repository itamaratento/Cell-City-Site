#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Responsabilidades
# (Fase 10 — CCC-F10-001, "Responsabilidades": "Relacionar
# automaticamente: IA → Fase → Módulo → Responsabilidade → Status").
# Uma fase AGUARDANDO_REVISAO gera duas linhas — a Implementação de quem
# construiu e a Revisão Técnica de Claude (ver ENGINEERING.md: Claude é o
# único Revisor Técnico Principal do projeto) — nunca uma terceira fonte
# de dados, só uma regra de derivação sobre fases.conf.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"

_cc_cia_responsabilidades() {
  _cc_screen_title "RESPONSABILIDADES"
  _cc_screen_breadcrumb "Control Center › Central de IAs"
  _cc_box_blank

  local numero nome ia status
  while IFS='|' read -r numero nome ia status _; do
    _cc_box_text "$(_cc_cia_ia_nome "$ia") › Fase $numero › $nome › Implementação"
    _cc_box_line "  Status: $(_cc_cia_status_label "$status")"
    if [ "$status" = "AGUARDANDO_REVISAO" ]; then
      _cc_box_text "$(_cc_cia_ia_nome claude) › Fase $numero › $nome › Revisão Técnica"
      _cc_box_line "  Status: Pendente"
    fi
    _cc_box_blank
  done < <(_cc_cia_fases)

  _cc_box_close
  _cc_cia_log "Responsabilidades consultadas"
}
