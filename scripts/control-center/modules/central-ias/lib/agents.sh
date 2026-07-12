#!/bin/bash
# Cell City Control Center — módulo Central de IAs, IAs Cadastradas
# (Fase 10 — CCC-F10-001, "IAs Cadastradas"). "Módulos atribuídos" e
# "última atividade" são sempre derivados (config/fases.conf + git log),
# nunca uma segunda cópia estática que poderia divergir do Registro.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_cia_agentes() {
  _cc_screen_title "IAs CADASTRADAS"
  _cc_screen_breadcrumb "Control Center › Central de IAs"
  _cc_box_blank

  local slug nome versao funcao especialidades modulos_ia ultima
  while IFS='|' read -r slug nome versao funcao especialidades; do
    # "-"/"*" (infra/transversal, ver fases.conf) não são módulos de
    # verdade — excluídos da listagem. Junção com ", " (nunca só ","):
    # uma lista sem espaço nenhum vira uma "palavra" única sem ponto de
    # quebra pro word-wrap de _cc_box_text, que degenerava em corte
    # silencioso de dado (achado real ao testar esta tela ao vivo).
    modulos_ia=$(_cc_cia_fases | awk -F'|' -v s="$slug" '$3==s {print $5}' \
      | grep -vE '^(-|\*)$' | paste -sd, - | sed 's/,/, /g')
    ultima=$(_cc_cia_ia_ultima_atividade "$slug")
    _cc_box_text "${nome} (${versao})"
    _cc_box_text "Função: $funcao"
    _cc_box_text "Especialidades: $(echo "$especialidades" | sed 's/,/, /g')"
    _cc_box_text "Módulos atribuídos: ${modulos_ia:-nenhum}"
    _cc_box_line "Status: ATIVA"
    _cc_box_text "Última atividade: $ultima"
    _cc_box_blank
  done < <(_cc_cia_ias)

  _cc_box_close
  _cc_cia_log "IAs Cadastradas consultadas"
}
