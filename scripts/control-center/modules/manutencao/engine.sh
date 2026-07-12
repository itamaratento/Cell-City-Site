#!/bin/bash
# Engine - orquestrador do modulo Manutencao.
set -uo pipefail

if [ -z "${CC_ROOT:-}" ]; then
  MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
fi
if [ -z "${MODULE_DIR:-}" ]; then
  MODULE_DIR="$CC_ROOT/modules/manutencao"
fi
if [ -z "${REPO_DIR:-}" ]; then
  REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"
fi

MAN_LIB="$MODULE_DIR/lib"
# shellcheck source=./lib/utils.sh
source "$MAN_LIB/utils.sh"
# shellcheck source=./lib/scanner.sh
source "$MAN_LIB/scanner.sh"
# shellcheck source=./lib/codigo-morto.sh
source "$MAN_LIB/codigo-morto.sh"
# shellcheck source=./lib/duplicados.sh
source "$MAN_LIB/duplicados.sh"
# shellcheck source=./lib/dependencias.sh
source "$MAN_LIB/dependencias.sh"
# shellcheck source=./lib/estrutura.sh
source "$MAN_LIB/estrutura.sh"
# shellcheck source=./lib/gitignore.sh
source "$MAN_LIB/gitignore.sh"
# shellcheck source=./lib/limpeza.sh
source "$MAN_LIB/limpeza.sh"
# shellcheck source=./lib/relatorio.sh
source "$MAN_LIB/relatorio.sh"

_cc_man_executar() {
  local categoria="$1"
  _cc_man_init
  case "$categoria" in
    orfaos)     _cc_man_scanner ;;
    morto)      _cc_man_codigo_morto ;;
    duplicados) _cc_man_duplicados ;;
    dependencias) _cc_man_dependencias ;;
    estrutura)  _cc_man_estrutura ;;
    gitignore)  _cc_man_gitignore ;;
    geral|completo)
      _cc_man_scanner
      _cc_man_codigo_morto
      _cc_man_duplicados
      _cc_man_dependencias
      _cc_man_estrutura
      _cc_man_gitignore
      ;;
    *)
      _cc_man_adicionar "fail" "Categoria inválida" "$categoria"
      return 1
      ;;
  esac
  _cc_man_salvar_estado
}
