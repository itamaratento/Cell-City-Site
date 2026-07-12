#!/bin/bash
# Cell City Control Center — módulo Configurações, Ambiente e Diagnóstico
# (Fase 11, CCC-F11-001). Mostra o resumo do último health-check real
# (state/health-check.json) — nunca reexecuta as 45 verificações do
# módulo Diagnóstico (envelopar, nunca reimplementar).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"

_cc_cfg_ambiente() {
  local timestamp status total aprovados avisos falhas
  _cc_screen_title "AMBIENTE E DIAGNÓSTICO"
  _cc_screen_breadcrumb "Control Center › Configurações › Ambiente"
  _cc_box_blank
  if [ -f "$CC_ROOT/state/health-check.json" ] && command -v jq >/dev/null 2>&1; then
    timestamp=$(jq -r '.timestamp // empty' "$CC_ROOT/state/health-check.json" 2>/dev/null)
    status=$(jq -r '.status // empty' "$CC_ROOT/state/health-check.json" 2>/dev/null)
    total=$(jq -r '.total // empty' "$CC_ROOT/state/health-check.json" 2>/dev/null)
    aprovados=$(jq -r '.aprovados // empty' "$CC_ROOT/state/health-check.json" 2>/dev/null)
    avisos=$(jq -r '.avisos // empty' "$CC_ROOT/state/health-check.json" 2>/dev/null)
    falhas=$(jq -r '.falhas // empty' "$CC_ROOT/state/health-check.json" 2>/dev/null)
  fi
  if [ -z "${timestamp:-}" ]; then
    _cc_box_text "Nenhum diagnóstico foi executado ainda nesta máquina."
    _cc_box_blank
    _cc_box_text "Execute Control Center › Diagnóstico › Executar"
    _cc_box_text "Diagnóstico Completo para gerar este resumo."
  else
    _cc_box_line "Última execução : $timestamp"
    _cc_box_line "Status geral    : ${status:-?}"
    _cc_box_line "Verificações    : ${total:-?} (${aprovados:-?} ok, ${avisos:-?} avisos, ${falhas:-?} falhas)"
    _cc_box_blank
    _cc_box_text "Somente leitura — para reexecutar ou ver o relatório"
    _cc_box_text "técnico completo, acesse Control Center › Diagnóstico."
  fi
  _cc_box_blank
}
