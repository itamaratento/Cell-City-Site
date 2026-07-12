#!/bin/bash
# Cell City Control Center — módulo Diagnóstico, geração de relatórios.
# Consome os arrays e contadores globais definidos por utils.sh e
# preenchidos pelas libs de verificação.
#
# Nenhuma função aqui executa diagnóstico — só formata e exibe resultados.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/relatorio.sh}"

_cc_diag_relatorio_resumo() {
  local classificacao duracao
  classificacao=$(_cc_diag_classificar)
  duracao=$(_cc_diag_duracao)
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}RESUMO DO HEALTH CHECK${_CC_C_RESET}"
  _cc_box_sep
  _cc_box_line "Projeto       : Cell City CRM"
  _cc_box_line "Branch        : $(_cc_git_branch)"
  _cc_box_line "Status Geral  : $(_cc_diag_status_label "$classificacao")"
  _cc_box_blank
  _cc_box_line "Itens Verificados : $CC_DIAG_TOTAL"
  _cc_box_line "Itens Aprovados   : $(_cc_diag_status_label "ok") $CC_DIAG_OK"
  _cc_box_line "Avisos            : $(_cc_diag_status_label "warn") $CC_DIAG_WARN"
  _cc_box_line "Falhas            : $(_cc_diag_status_label "fail") $CC_DIAG_FAIL"
  _cc_box_blank
  _cc_box_line "Tempo de Execução : $duracao"
  _cc_box_sep
  _cc_box_line_center "Classificação: $(_cc_diag_status_label "$classificacao")"
  if [ "$CC_DIAG_FAIL" -gt 0 ]; then
    _cc_box_blank
    _cc_box_line "${_CC_C_VERMELHO}${CC_DIAG_FAIL} erro(s) encontrado(s) — veja detalhes abaixo${_CC_C_RESET}"
  fi
}

_cc_diag_relatorio_detalhado() {
  local classificacao duracao timestamp
  classificacao=$(_cc_diag_classificar)
  duracao=$(_cc_diag_duracao)
  timestamp=$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null)

  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}RELATÓRIO TÉCNICO${_CC_C_RESET}"
  _cc_box_sep
  _cc_box_line "Projeto : Cell City CRM"
  _cc_box_line "Branch  : $(_cc_git_branch)"
  _cc_box_line "Status  : $(_cc_diag_status_label "$classificacao")"
  _cc_box_line "Data    : $timestamp"
  _cc_box_line "Duração : $duracao"
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}RESULTADOS DAS VERIFICAÇÕES${_CC_C_RESET}"
  _cc_box_sep

  local i=0 status desc detalhes
  for resultado in "${CC_DIAG_RESULTADOS[@]}"; do
    IFS='|' read -r status desc detalhes causa impacto sugestao <<< "$resultado"
    i=$((i + 1))
    _cc_box_blank
    _cc_box_line "${i}. [$(_cc_diag_status_label "$status")] ${desc}"
    if [ -n "$detalhes" ]; then
      _cc_box_line "   ${_CC_C_CIANO}Detalhes:${_CC_C_RESET} $detalhes"
    fi
    if [ "$status" != "ok" ] && [ -n "$causa" ]; then
      _cc_box_line "   ${_CC_C_AMARELO}Causa:${_CC_C_RESET} $causa"
    fi
    if [ "$status" != "ok" ] && [ -n "$impacto" ]; then
      _cc_box_line "   ${_CC_C_VERMELHO}Impacto:${_CC_C_RESET} $impacto"
    fi
    if [ "$status" != "ok" ] && [ -n "$sugestao" ]; then
      _cc_box_line "   ${_CC_C_VERDE}Sugestão:${_CC_C_RESET} $sugestao"
    fi
  done
}

_cc_diag_relatorio_falhas() {
  local i=0 count=0
  for resultado in "${CC_DIAG_RESULTADOS[@]}"; do
    IFS='|' read -r status desc detalhes causa impacto sugestao <<< "$resultado"
    if [ "$status" = "fail" ]; then
      count=$((count + 1))
    fi
  done
  if [ "$count" -eq 0 ]; then
    _cc_box_line "${_CC_C_VERDE}Nenhuma falha encontrada.${_CC_C_RESET}"
    return
  fi
  i=0
  for resultado in "${CC_DIAG_RESULTADOS[@]}"; do
    IFS='|' read -r status desc detalhes causa impacto sugestao <<< "$resultado"
    if [ "$status" = "fail" ]; then
      i=$((i + 1))
      _cc_box_blank
      _cc_box_line "${_CC_C_VERMELHO}${i}. ${desc}${_CC_C_RESET}"
      [ -n "$causa" ] && _cc_box_line "   Causa: $causa"
      [ -n "$impacto" ] && _cc_box_line "   Impacto: $impacto"
      [ -n "$sugestao" ] && _cc_box_line "   Sugestão: $sugestao"
    fi
  done
}

_cc_diag_relatorio_recomendacoes() {
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}RECOMENDAÇÕES${_CC_C_RESET}"
  _cc_box_sep
  _cc_box_blank
  if [ "$CC_DIAG_FAIL" -eq 0 ] && [ "$CC_DIAG_WARN" -eq 0 ]; then
    _cc_box_line "✓ Ambiente saudável. Nenhuma ação necessária."
    _cc_box_blank
    _cc_box_line "✓ Mantenha o hábito de executar diagnósticos periódicos."
    return
  fi
  if [ "$CC_DIAG_FAIL" -gt 0 ]; then
    _cc_box_line "🔸 Corrija as falhas listadas acima antes de continuar o desenvolvimento."
    _cc_box_blank
    _cc_box_line "🔸 Priorize falhas com impacto crítico no funcionamento do projeto."
  fi
  if [ "$CC_DIAG_WARN" -gt 0 ]; then
    _cc_box_blank
    _cc_box_line "🔸 Revise os avisos — podem evoluir para falhas se ignorados."
  fi
  _cc_box_blank
  _cc_box_line "🔸 Execute 'npm install' se houver problemas com dependências."
  _cc_box_blank
  _cc_box_line "🔸 Mantenha o Git sincronizado (git pull / git push)."
  _cc_box_blank
  _cc_box_line "🔸 Verifique a documentação em scripts/control-center/README.md."
}

_cc_diag_relatorio_proximas_acoes() {
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}PRÓXIMAS AÇÕES${_CC_C_RESET}"
  _cc_box_sep
  _cc_box_blank
  if [ "$CC_DIAG_FAIL" -gt 0 ]; then
    _cc_box_line "1. Corrigir todas as falhas identificadas no relatório"
    _cc_box_line "2. Reexecutar o diagnóstico para confirmar as correções"
    _cc_box_line "3. Se persistirem, consulte a documentação do projeto"
  elif [ "$CC_DIAG_WARN" -gt 0 ]; then
    _cc_box_line "1. Revisar os pontos de atenção listados"
    _cc_box_line "2. Agendar correções para os avisos relevantes"
    _cc_box_line "3. Reexecutar o diagnóstico periodicamente"
  else
    _cc_box_line "1. Ambiente OK — siga com o desenvolvimento normalmente"
    _cc_box_line "2. Execute diagnósticos regulares para manter a saúde"
    _cc_box_line "3. Após alterações significativas, reexecute esta verificação"
  fi
}

