#!/bin/bash
# CELL CITY — WI CLI Wrapper
# Instalado como /usr/local/bin/wi ou symlink.
# Encaminha para a biblioteca workspace-intelligence.sh.
set -uo pipefail

WI_LIB="$HOME/Músicas/projetos/Cell-City-Site/scripts/control-center/lib/workspace-intelligence.sh"

if [[ ! -f "$WI_LIB" ]]; then
  echo "ERRO: Workspace Intelligence nao encontrado em $WI_LIB" >&2
  exit 1
fi

exec bash "$WI_LIB" "$@"
