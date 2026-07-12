#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Histórico (Fase 10 —
# CCC-F10-001, "Histórico": implementações/auditorias/homologações/
# releases/alterações relevantes, com filtros por IA/Fase/Módulo/Data).
# Fonte real: `git log` do próprio scripts/control-center — nenhum evento
# fabricado. A IA de cada commit é inferida pelo número de fase citado no
# assunto (convenção já usada em todos os commits desta árvore, ver
# memória do projeto) cruzado com fases.conf.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_cia_historico() {
  local filtro_ia filtro_fase filtro_modulo filtro_data
  read -rp "Filtrar por IA (claude/deepseek, Enter = todas): " filtro_ia
  read -rp "Filtrar por número de fase (Enter = todas): " filtro_fase
  read -rp "Filtrar por módulo (slug, Enter = todos): " filtro_modulo
  read -rp "Filtrar por data (AAAA-MM-DD, Enter = todas): " filtro_data

  _cc_screen_title "HISTÓRICO"
  _cc_screen_breadcrumb "Control Center › Central de IAs"
  _cc_box_blank

  local hash data assunto numero ia total=0
  while IFS='|' read -r hash data assunto; do
    numero=$(echo "$assunto" | grep -oP 'Fase \K[0-9]+' | head -1)
    [ -z "$numero" ] && continue
    ia=$(_cc_cia_fase_campo "$numero" 3)

    [ -n "$filtro_ia" ] && [ "$ia" != "$filtro_ia" ] && continue
    [ -n "$filtro_fase" ] && [ "$numero" != "$filtro_fase" ] && continue
    [ -n "$filtro_data" ] && [ "$data" != "$filtro_data" ] && continue
    if [ -n "$filtro_modulo" ] && ! echo "$assunto" | grep -qi "$filtro_modulo"; then
      continue
    fi

    total=$((total + 1))
    _cc_box_text "$data — Fase $numero (${ia:-?}) — $assunto"
  done < <(git -C "$REPO_DIR" log --date=short --format='%h|%ad|%s' -- scripts/control-center 2>/dev/null)

  [ "$total" -eq 0 ] && _cc_box_text "Nenhum registro encontrado com esse filtro."
  _cc_box_blank
  _cc_box_close
  _cc_cia_log "Histórico consultado (ia='$filtro_ia' fase='$filtro_fase' modulo='$filtro_modulo' data='$filtro_data', $total resultado(s))"
}
