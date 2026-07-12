#!/bin/bash
# Cell City Control Center — módulo Configurações, mecanismo de
# orquestração (Fase 11, CCC-F11-001). Carrega utilitários e as camadas
# de serviço; não contém UI nem regra de negócio própria — só agrega os
# `source`.
set -uo pipefail

if [ -z "${CC_ROOT:-}" ]; then
  MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
fi
if [ -z "${MODULE_DIR:-}" ]; then
  MODULE_DIR="$CC_ROOT/modules/configuracoes"
fi
if [ -z "${REPO_DIR:-}" ]; then
  REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"
fi

CC_CFG_LIB="$MODULE_DIR/lib"

# shellcheck source=./lib/utils.sh
source "$CC_CFG_LIB/utils.sh"
# shellcheck source=./lib/geral.sh
source "$CC_CFG_LIB/geral.sh"
# shellcheck source=./lib/logs.sh
source "$CC_CFG_LIB/logs.sh"
# shellcheck source=./lib/status.sh
source "$CC_CFG_LIB/status.sh"
# shellcheck source=./lib/ambiente.sh
source "$CC_CFG_LIB/ambiente.sh"
# shellcheck source=./lib/exportacao.sh
source "$CC_CFG_LIB/exportacao.sh"
# shellcheck source=./lib/validacao.sh
source "$CC_CFG_LIB/validacao.sh"
# shellcheck source=./lib/importexport.sh
source "$CC_CFG_LIB/importexport.sh"
