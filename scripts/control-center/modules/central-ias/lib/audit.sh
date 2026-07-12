#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Auditorias (Fase 10 —
# CCC-F10-001, "Auditorias": auditorias executadas/pareceres/
# homologações/pendências/riscos/revisões/status). Pareceres reais são
# lidos de scripts/control-center/docs/PARECER-*.md (mesmo local usado
# pelas Fases 3 e 5, ver README.md) — nunca fabricados; pendências vêm
# direto de fases.conf (fases AGUARDANDO_REVISAO).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"

_cc_cia_auditorias() {
  _cc_screen_title "AUDITORIAS"
  _cc_screen_breadcrumb "Control Center › Central de IAs"
  _cc_box_blank

  _cc_box_text "Pareceres Executivos (homologações concluídas):"
  local arquivo titulo encontrados=0
  for arquivo in "$CC_ROOT"/docs/PARECER-*.md; do
    [ -e "$arquivo" ] || continue
    encontrados=$((encontrados + 1))
    titulo=$(grep -m1 '^# ' "$arquivo" | sed 's/^# //')
    _cc_box_text "  $(basename "$arquivo") — ${titulo:-(sem título)}"
  done
  [ "$encontrados" -eq 0 ] && _cc_box_text "  Nenhum ainda."
  _cc_box_blank

  _cc_box_text "Pendências (fases aguardando revisão técnica):"
  local numero nome ia status modulos pendentes=0
  while IFS='|' read -r numero nome ia status modulos; do
    [ "$status" = "AGUARDANDO_REVISAO" ] || continue
    pendentes=$((pendentes + 1))
    _cc_box_text "  Fase $numero — $nome (implementada por $(_cc_cia_ia_nome "$ia"), revisão: $(_cc_cia_ia_nome claude))"
  done < <(_cc_cia_fases)
  [ "$pendentes" -eq 0 ] && _cc_box_text "  Nenhuma."

  _cc_box_blank
  _cc_box_close
  _cc_cia_log "Auditorias consultadas ($encontrados parecer(es), $pendentes pendência(s))"
}
