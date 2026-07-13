#!/bin/bash
# Automations — Funções de agendamento
set -uo pipefail

_cc_v3_autom_schedule_cron() {
  local task="$1"
  local cron_expr="$2"
  echo "$cron_expr $AUT_DIR/automations.sh --run $task"
}

_cc_v3_autom_verificar_condicao() {
  local condicao="$1"
  case "$condicao" in
    always) return 0 ;;
    workspace_clean)
      cd "${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}" && git diff --quiet 2>/dev/null
      return $?
      ;;
    *)
      return 0
      ;;
  esac
}
