#!/bin/bash
# Cell City Control Center — módulo Ferramentas, Auditorias e Relatórios
# (Fase 7, CCC-F07-FINAL). Interface: monta o submenu, dispara as
# auditorias (engine.sh) e exibe os resultados (lib/utils.sh) — nenhuma
# regra de auditoria mora aqui, só orquestração e exibição.
#
# Isolamento: este script não depende de core/menu.sh para funcionar — pode
# ser chamado direto (scripts/control-center/modules/ferramentas/menu.sh),
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

_cc_ferr_menu_auditoria() {
  local categoria="$1"
  _cc_ferr_executar_auditoria "$categoria"
  echo ""
  _cc_ferr_detalhado
  echo ""
  _cc_ferr_resumo
}

_cc_ferr_menu_geral()     { _cc_ferr_menu_auditoria geral; }
_cc_ferr_menu_seguranca() { _cc_ferr_menu_auditoria seguranca; }
_cc_ferr_menu_git()       { _cc_ferr_menu_auditoria git; }
_cc_ferr_menu_firebase()  { _cc_ferr_menu_auditoria firebase; }
_cc_ferr_menu_node()      { _cc_ferr_menu_auditoria node; }
_cc_ferr_menu_bash()      { _cc_ferr_menu_auditoria bash; }

_cc_run_submenu "Ferramentas" "Control Center › Ferramentas" \
  "1|Auditoria Geral|_cc_ferr_menu_geral" \
  "2|Auditoria de Segurança|_cc_ferr_menu_seguranca" \
  "3|Auditoria do Git|_cc_ferr_menu_git" \
  "4|Auditoria Firebase|_cc_ferr_menu_firebase" \
  "5|Auditoria Node|_cc_ferr_menu_node" \
  "6|Auditoria Bash|_cc_ferr_menu_bash" \
  "7|Gerar Relatórios|_cc_ferr_gerar_relatorios" \
  "8|Exportações|_cc_ferr_exportar" \
  "9|Utilitários|_cc_ferr_utilitarios"
