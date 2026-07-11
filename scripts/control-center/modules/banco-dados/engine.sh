#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, mecanismo de orquestração.
# Carrega utilitários e bibliotecas de inspeção do Firebase/Firestore.
# Não contém UI — só lógica de negócio (ver CCC-F04-001 §14/§17: todas as
# operações são somente leitura, nenhuma escreve/publica nada).
set -uo pipefail

if [ -z "${CC_ROOT:-}" ]; then
  MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
fi
if [ -z "${MODULE_DIR:-}" ]; then
  MODULE_DIR="$CC_ROOT/modules/banco-dados"
fi
if [ -z "${REPO_DIR:-}" ]; then
  REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"
fi

CC_BD_LIB="$MODULE_DIR/lib"

source "$CC_BD_LIB/utils.sh"
source "$CC_BD_LIB/status.sh"
source "$CC_BD_LIB/collections.sh"
source "$CC_BD_LIB/indexes.sh"
source "$CC_BD_LIB/rules.sh"
source "$CC_BD_LIB/functions.sh"
source "$CC_BD_LIB/integrity.sh"
source "$CC_BD_LIB/statistics.sh"
source "$CC_BD_LIB/export.sh"
source "$CC_BD_LIB/config.sh"
