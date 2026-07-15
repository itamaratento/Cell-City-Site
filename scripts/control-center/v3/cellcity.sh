#!/bin/bash
# CELL CITY V3 — NOC CLI Wrapper
# Instalado em /usr/local/bin/cellcity para substituir o entry point V1.
# Detecta se a V3 está disponível e faz fallback para V1 se não estiver.
# Compatibilidade total com V1 e V2.
set -uo pipefail

# readlink -f resolve symlink (ex.: /usr/local/bin/cellcity -> este arquivo);
# sem isso, SCRIPT_DIR apontaria para /usr/local/bin e nada seria encontrado.
SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
V3_NOC="$SCRIPT_DIR/noc.sh"
V1_MENU="$SCRIPT_DIR/../core/menu.sh"

source "$SCRIPT_DIR/config/v3.conf" 2>/dev/null || true

if [[ -f "$V3_NOC" && "${V3_NOC_ENABLED:-true}" != "false" ]]; then
  exec bash "$V3_NOC"
elif [[ -f "$V1_MENU" ]]; then
  exec bash "$V1_MENU"
else
  echo "ERRO: Cell City Control Center não encontrado." >&2
  exit 1
fi
