#!/bin/bash
# Cell City Control Center — módulo Diagnóstico, mecanismo de orquestração.
# Carrega utilitários e bibliotecas de verificação, coordena a execução dos
# checks e o salvamento de estado. Não contém UI — só lógica de negócio.
#
# Chamado por menu.sh. Pode ser chamado isoladamente (depuração).
set -uo pipefail

if [ -z "${CC_ROOT:-}" ]; then
  MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
fi
if [ -z "${MODULE_DIR:-}" ]; then
  MODULE_DIR="$CC_ROOT/modules/diagnostico"
fi
if [ -z "${REPO_DIR:-}" ]; then
  REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"
fi

DIAG_LIB="$MODULE_DIR/lib"

# shellcheck source=./lib/utils.sh
source "$DIAG_LIB/utils.sh"
# shellcheck source=./lib/sistema.sh
source "$DIAG_LIB/sistema.sh"
# shellcheck source=./lib/projeto.sh
source "$DIAG_LIB/projeto.sh"
# shellcheck source=./lib/git.sh
source "$DIAG_LIB/git.sh"
# shellcheck source=./lib/node.sh
source "$DIAG_LIB/node.sh"
# shellcheck source=./lib/firebase.sh
source "$DIAG_LIB/firebase.sh"
# shellcheck source=./lib/ambiente.sh
source "$DIAG_LIB/ambiente.sh"
# shellcheck source=./lib/relatorio.sh
source "$DIAG_LIB/relatorio.sh"

_cc_diag_executar_completo() {
  _cc_diag_init
  _cc_diag_sistema
  _cc_diag_projeto
  _cc_diag_git
  _cc_diag_node
  _cc_diag_firebase
  _cc_diag_ambiente
  _cc_diag_salvar_estado
}

_cc_diag_executar_categoria() {
  local categoria="$1"
  _cc_diag_init
  case "$categoria" in
    sistema)  _cc_diag_sistema ;;
    projeto)  _cc_diag_projeto ;;
    git)      _cc_diag_git ;;
    node)     _cc_diag_node ;;
    firebase) _cc_diag_firebase ;;
    ambiente) _cc_diag_ambiente ;;
    *)
      _cc_diag_adicionar "fail" "Categoria inválida" "$categoria"
      return 1
      ;;
  esac
  _cc_diag_salvar_estado
}
