#!/bin/bash
# CELL CITY — WI CLI Wrapper
# Instalado como /usr/local/bin/wi ou symlink.
# Encaminha para a biblioteca workspace-intelligence.sh.
set -uo pipefail

# readlink -f resolve symlink (ex.: /usr/local/bin/wi -> este arquivo);
# sem isso, SCRIPT_DIR apontaria para /usr/local/bin e nada seria encontrado
# (mesmo padrão de v3/cellcity.sh).
SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
WI_LIB="$SCRIPT_DIR/../lib/workspace-intelligence.sh"

if [[ ! -f "$WI_LIB" ]]; then
  echo "ERRO: Workspace Intelligence nao encontrado em $WI_LIB" >&2
  exit 1
fi

exec bash "$WI_LIB" "$@"
