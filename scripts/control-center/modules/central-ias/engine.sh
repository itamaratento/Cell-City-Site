#!/bin/bash
# Cell City Control Center — módulo Central de IAs, mecanismo de
# orquestração (Fase 10 — CCC-F10-001). Carrega utilitários e as camadas
# de serviço; não contém UI nem regra de negócio própria — só agrega os
# `source` (ver CCC-F10-001, "Arquitetura": "Nenhuma regra de negócio
# poderá permanecer na Interface").
set -uo pipefail

if [ -z "${CC_ROOT:-}" ]; then
  MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
fi
if [ -z "${MODULE_DIR:-}" ]; then
  MODULE_DIR="$CC_ROOT/modules/central-ias"
fi
if [ -z "${REPO_DIR:-}" ]; then
  REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"
fi

CC_CIA_LIB="$MODULE_DIR/lib"

source "$CC_CIA_LIB/utils.sh"
source "$CC_CIA_LIB/dashboard.sh"
source "$CC_CIA_LIB/agents.sh"
source "$CC_CIA_LIB/skills.sh"
source "$CC_CIA_LIB/responsibilities.sh"
source "$CC_CIA_LIB/workflow.sh"
source "$CC_CIA_LIB/tasks.sh"
source "$CC_CIA_LIB/history.sh"
source "$CC_CIA_LIB/audit.sh"
source "$CC_CIA_LIB/documentation.sh"
source "$CC_CIA_LIB/statistics.sh"
source "$CC_CIA_LIB/export.sh"
source "$CC_CIA_LIB/config.sh"
