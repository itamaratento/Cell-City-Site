#!/bin/bash
# Cell City Control Center — módulo Diagnóstico e Health Check (Fase 6,
# CCC-F06-001). Interface: monta o submenu, dispara os diagnósticos
# (engine.sh) e exibe os resultados (lib/relatorio.sh) — nenhuma regra de
# verificação mora aqui, só orquestração e exibição (ver docs/diagnostico.md,
# "Separação de camadas").
#
# Isolamento: este script não depende de core/menu.sh para funcionar — pode
# ser chamado direto (scripts/control-center/modules/diagnostico/menu.sh),
# recalcula seu próprio CC_ROOT e carrega só a lib/common.sh compartilhada.
set -uo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
# shellcheck disable=SC2034 # lido por lib/*.sh sourced depois (cross-file, invisivel ao shellcheck)
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"

# shellcheck source=../../lib/common.sh
source "$CC_ROOT/lib/common.sh"
# shellcheck source=./engine.sh
source "$MODULE_DIR/engine.sh"

_cc_diag_menu_completo() {
  _cc_diag_executar_completo
  echo ""
  _cc_ok "Diagnóstico concluído."
  echo ""
  _cc_diag_relatorio_resumo
}

_cc_diag_menu_categoria() {
  local categoria="$1"
  _cc_diag_executar_categoria "$categoria"
  echo ""
  _cc_diag_relatorio_detalhado
}

_cc_diag_menu_sistema()  { _cc_diag_menu_categoria sistema; }
_cc_diag_menu_projeto()  { _cc_diag_menu_categoria projeto; }
_cc_diag_menu_git()      { _cc_diag_menu_categoria git; }
_cc_diag_menu_node()     { _cc_diag_menu_categoria node; }
_cc_diag_menu_firebase() { _cc_diag_menu_categoria firebase; }
_cc_diag_menu_ambiente() { _cc_diag_menu_categoria ambiente; }

_cc_diag_menu_relatorio_completo() {
  _cc_diag_executar_completo
  echo ""
  _cc_diag_relatorio_detalhado
  echo ""
  _cc_diag_relatorio_resumo
  echo ""
  _cc_diag_relatorio_recomendacoes
  echo ""
  _cc_diag_relatorio_proximas_acoes
}

_cc_run_submenu "Diagnóstico" "Control Center › Diagnóstico" \
  "1|Executar Diagnóstico Completo|_cc_diag_menu_completo" \
  "2|Verificações do Sistema|_cc_diag_menu_sistema" \
  "3|Verificações do Projeto|_cc_diag_menu_projeto" \
  "4|Verificações Git|_cc_diag_menu_git" \
  "5|Verificações Node|_cc_diag_menu_node" \
  "6|Verificações Firebase|_cc_diag_menu_firebase" \
  "7|Verificações do Ambiente|_cc_diag_menu_ambiente" \
  "8|Relatório Técnico Completo|_cc_diag_menu_relatorio_completo"
