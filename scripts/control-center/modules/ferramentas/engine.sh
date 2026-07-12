#!/bin/bash
# Cell City Control Center — módulo Ferramentas, mecanismo de orquestração.
# Carrega utilitários e bibliotecas de auditoria, coordena a execução
# e o salvamento de estado. Não contém UI — só lógica de negócio.
set -uo pipefail

if [ -z "${CC_ROOT:-}" ]; then
  MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
fi
if [ -z "${MODULE_DIR:-}" ]; then
  MODULE_DIR="$CC_ROOT/modules/ferramentas"
fi
if [ -z "${REPO_DIR:-}" ]; then
  REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"
fi

FERR_LIB="$MODULE_DIR/lib"

# shellcheck source=./lib/utils.sh
source "$FERR_LIB/utils.sh"
# shellcheck source=./lib/auditoria-geral.sh
source "$FERR_LIB/auditoria-geral.sh"
# shellcheck source=./lib/auditoria-seguranca.sh
source "$FERR_LIB/auditoria-seguranca.sh"
# shellcheck source=./lib/auditoria-git.sh
source "$FERR_LIB/auditoria-git.sh"
# shellcheck source=./lib/auditoria-firebase.sh
source "$FERR_LIB/auditoria-firebase.sh"
# shellcheck source=./lib/auditoria-node.sh
source "$FERR_LIB/auditoria-node.sh"
# shellcheck source=./lib/auditoria-bash.sh
source "$FERR_LIB/auditoria-bash.sh"
# shellcheck source=./lib/relatorios.sh
source "$FERR_LIB/relatorios.sh"
# shellcheck source=./lib/exportacao.sh
source "$FERR_LIB/exportacao.sh"
# shellcheck source=./lib/utilitarios.sh
source "$FERR_LIB/utilitarios.sh"

_cc_ferr_executar_auditoria() {
  local categoria="$1"
  _cc_ferr_init
  case "$categoria" in
    geral)     _cc_ferr_auditoria_geral ;;
    seguranca) _cc_ferr_auditoria_seguranca ;;
    git)       _cc_ferr_auditoria_git ;;
    firebase)  _cc_ferr_auditoria_firebase ;;
    node)      _cc_ferr_auditoria_node ;;
    bash)      _cc_ferr_auditoria_bash ;;
    *)
      _cc_ferr_adicionar "fail" "Categoria inválida" "$categoria"
      return 1
      ;;
  esac
  _cc_ferr_salvar_estado "$categoria"
}
