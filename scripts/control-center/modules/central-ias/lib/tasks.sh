#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Distribuição de
# Tarefas (Fase 10 — CCC-F10-001, "Distribuição de Tarefas": "Não
# implementar gerenciamento automático. Apenas organização."). Só agrupa
# fases.conf por status — nenhuma ação move uma tarefa de coluna.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"

_cc_cia_tarefas_lista() {
  local status_alvo="$1" rotulo="$2" numero nome ia status modulos encontrou=0
  _cc_box_text "$rotulo:"
  while IFS='|' read -r numero nome ia status modulos; do
    [ "$status" = "$status_alvo" ] || continue
    encontrou=1
    _cc_box_text "  Fase $numero — $nome (responsável: $(_cc_cia_ia_nome "$ia"), módulo: $modulos)"
  done < <(_cc_cia_fases)
  [ "$encontrou" -eq 0 ] && _cc_box_text "  Nenhuma."
  _cc_box_blank
}

_cc_cia_tarefas() {
  _cc_screen_title "DISTRIBUIÇÃO DE TAREFAS"
  _cc_screen_breadcrumb "Control Center › Central de IAs"
  _cc_box_blank

  _cc_cia_tarefas_lista "CONCLUIDA" "Concluídas"
  _cc_cia_tarefas_lista "EM_IMPLEMENTACAO" "Em andamento"
  _cc_cia_tarefas_lista "AGUARDANDO_REVISAO" "Aguardando revisão técnica (prioridade: Claude)"
  _cc_cia_tarefas_lista "NAO_INICIADA" "Pendentes (prioridade: ordem do Plano de Execução do Roadmap)"

  _cc_box_close
  _cc_cia_log "Distribuição de Tarefas consultada"
}
