#!/usr/bin/env bash
# Cell City Release Center — homologação técnica obrigatória entre 'subir'
# e 'subir-ok' (Sprint 2026-07-11). Fluxo oficial:
#   subir -> release -> subir-ok
#
# Este arquivo é só um wrapper fino — a lógica completa (menu, checagens,
# marcador de homologação) vive em scripts/release/release-center.sh, VERSIONADA
# no repositório (Cell-City-Site/develop), pra acompanhar o código que ela
# audita. Este wrapper existe fora do repo, em /usr/local/bin/release, só
# pra estar disponível como comando global em qualquer diretório, do mesmo
# jeito que 'subir'/'subir-ok'/'backup' já funcionam via ~/.bashrc.
#
# Instalação (precisa de sudo — root é dono de /usr/local/bin):
#   sudo cp scripts/release/release-wrapper-usr-local-bin.sh /usr/local/bin/release
#   sudo chmod +x /usr/local/bin/release
set -uo pipefail

REPO_DIR="$HOME/Músicas/projetos/Cell-City-Site"
SCRIPT="$REPO_DIR/scripts/release/release-center.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "❌ Não encontrei $SCRIPT (ou está sem permissão de execução)." >&2
  echo "   O projeto Cell-City-Site está no caminho esperado, na branch develop?" >&2
  exit 1
fi

exec "$SCRIPT" "$@"
