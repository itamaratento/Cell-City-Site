#!/bin/bash
# Relatorio de Higienizacao com classificacao, espaco recuperavel e plano.
set -uo pipefail
: "${CC_ROOT:?}"; : "${REPO_DIR:?}"

_cc_man_relatorio() {
  local espaco=0
  for f in "${CC_MAN_ENCONTRADOS[@]}"; do
    [ -f "$f" ] && local sz && sz=$(stat -c%s "$f" 2>/dev/null || echo 0) && espaco=$((espaco + sz))
  done
  local tam_h && tam_h=$(numfmt --to=iec 2>/dev/null <<< "$espaco" || echo "${espaco}B")
  local aprovados=0
  for p in "${CC_MAN_PLANO[@]}"; do
    [[ "${p%%|*}" = "REMOVER" ]] && aprovados=$((aprovados + 1))
  done
  _cc_screen_title "RELATORIO DE HIGIENIZACAO"
  _cc_screen_breadcrumb "Control Center › Manutencao › Relatorio"
  _cc_box_blank
  _cc_box_line "Projeto : Cell City CRM"
  _cc_box_line "Data    : $(date '+%Y-%m-%d %H:%M')"
  _cc_box_line "Status  : $(_cc_man_status_label "$(_cc_man_classificar)")"
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}RESUMO${_CC_C_RESET}"; _cc_box_sep
  _cc_box_line "Itens verificados   : $CC_MAN_TOTAL"
  _cc_box_line "OK                  : $CC_MAN_OK"
  _cc_box_line "Avisos              : $CC_MAN_WARN"
  _cc_box_line "Falhas              : $CC_MAN_FAIL"
  _cc_box_blank
  _cc_box_line "Itens encontrados   : ${#CC_MAN_ENCONTRADOS[@]}"
  _cc_box_line "Itens protegidos    : ${#CC_MAN_BLOQUEADOS[@]}"
  _cc_box_line "Aprovados p/ remocao: $aprovados"
  _cc_box_line "Espaco recuperavel  : $tam_h"
  _cc_box_blank
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}CLASSIFICACAO DOS ITENS${_CC_C_RESET}"; _cc_box_sep
  local crit=0 alto=0 medio=0 baixo=0 info=0
  for c in "${CC_MAN_ITENS_CLASSIFICADOS[@]}"; do
    IFS='|' read -r nivel arq razao <<< "$c"
    case "$nivel" in CRITICO) crit=$((crit+1)) ;; ALTO) alto=$((alto+1)) ;; MEDIO) medio=$((medio+1)) ;; BAIXO) baixo=$((baixo+1)) ;; *) info=$((info+1)) ;; esac
  done
  _cc_box_line "CRITICO     : $crit"
  _cc_box_line "ALTO        : $alto"
  _cc_box_line "MEDIO       : $medio"
  _cc_box_line "BAIXO       : $baixo"
  _cc_box_line "INFORMATIVO : $info"
  _cc_box_blank
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}ITENS ENCONTRADOS${_CC_C_RESET}"; _cc_box_sep
  local limite=15
  for c in "${CC_MAN_ITENS_CLASSIFICADOS[@]}"; do
    IFS='|' read -r nivel arq razao <<< "$c"
    [ "$limite" -le 0 ] && _cc_box_line "  ... e mais ${#CC_MAN_ITENS_CLASSIFICADOS[@]} itens" && break
    _cc_box_line "  [$(_cc_man_status_label "$nivel")] $(basename "$arq")"
    limite=$((limite - 1))
  done
  _cc_box_blank
  if [ ${#CC_MAN_BLOQUEADOS[@]} -gt 0 ]; then
    _cc_box_sep
    _cc_box_line_center "${_CC_C_NEGRITO}ITENS PROTEGIDOS (NAO REMOVIDOS)${_CC_C_RESET}"; _cc_box_sep
    for b in "${CC_MAN_BLOQUEADOS[@]}"; do
      IFS='|' read -r bf br <<< "$b"
      _cc_box_line "  $(basename "$bf") — $br"
    done
    _cc_box_blank
  fi
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}RECOMENDACOES${_CC_C_RESET}"; _cc_box_sep
  [ "$crit" -gt 0 ] && _cc_box_line "🔸 Itens CRITICO: nao remover — revisar manualmente"
  [ "$alto" -gt 0 ] && _cc_box_line "🔸 Itens ALTO: avaliar impacto antes de qualquer acao"
  [ "$medio" -gt 0 ] && _cc_box_line "🔸 Itens MEDIO: podem ser removidos apos revisao"
  [ "$baixo" -gt 0 ] && _cc_box_line "🔸 Itens BAIXO: seguros para remocao"
  [ "$aprovados" -gt 0 ] && _cc_box_line "🔸 ${aprovados} item(ns) aprovado(s) — execute o Plano de Limpeza"
  _cc_box_line "🔸 Mantenha backup antes de remocoes"
  _cc_box_blank
  _cc_screen_footer "Relatorio completo · ENTER para voltar"
  _cc_pause
}
