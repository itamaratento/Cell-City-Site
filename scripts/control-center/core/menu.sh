#!/bin/bash
# Cell City Control Center — núcleo (Fase 1.1: manifesto de módulos, versão,
# plugin loader e estado do sistema — ver README.md).
#
# Comando oficial: `cellcity` (função em ~/.bashrc que executa este arquivo).
# Uso direto (sem passar pelo bashrc): scripts/control-center/core/menu.sh
#
# Arquitetura (ver README.md em scripts/control-center/ para o documento
# completo): este arquivo não conhece nenhum módulo por nome — o menu e o
# dispatch são 100% carregados de config/modules.conf (o "Manifesto Oficial
# dos Módulos"). Crescer o Control Center (Versão 2.0 em diante) é só
# adicionar uma pasta nova em modules/ e uma linha no manifesto — nunca
# precisa tocar neste arquivo.
set -uo pipefail

CORE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$CORE_DIR/.." && pwd)"
MODULES_DIR="$CC_ROOT/modules"
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"

# shellcheck source=../lib/common.sh
source "$CC_ROOT/lib/common.sh"
# shellcheck source=../lib/ui-box.sh
source "$CC_ROOT/lib/ui-box.sh"
# shellcheck source=../lib/plugin-loader.sh
source "$CC_ROOT/lib/plugin-loader.sh"
# shellcheck source=../config/control-center.conf
source "$CC_ROOT/config/control-center.conf"

# Versão (semver) — fonte única em VERSION, nunca duplicada no .conf (ver
# config/control-center.conf).
CC_VERSION="$(<"$CC_ROOT/VERSION")"

# Manifesto Oficial dos Módulos (config/modules.conf) — única fonte do menu
# principal. Formato: ordem|slug|rotulo. Ver comentário do próprio arquivo.
declare -a CC_ORDEM=() CC_SLUG=() CC_ROTULO=()
while IFS='|' read -r ordem slug rotulo; do
  [ -z "$ordem" ] && continue
  case "$ordem" in \#*) continue ;; esac
  CC_ORDEM+=("$ordem")
  CC_SLUG+=("$slug")
  CC_ROTULO+=("$rotulo")
done < "$CC_ROOT/config/modules.conf"

_cc_dispatch() {
  local escolha="$1" i
  for i in "${!CC_ORDEM[@]}"; do
    if [ "${CC_ORDEM[$i]}" = "$escolha" ]; then
      bash "$MODULES_DIR/${CC_SLUG[$i]}/menu.sh"
      return
    fi
  done
  echo "Opção inválida."
}

_cc_load_plugins
_cc_log "Control Center iniciado (v$CC_VERSION, Fase $CC_FASE)"

while true; do
  echo ""
  _cc_screen_title "CELL CITY CONTROL CENTER" "v$CC_VERSION — Fase $CC_FASE"
  _cc_screen_status_block
  _cc_box_sep
  _cc_box_blank
  for i in "${!CC_ORDEM[@]}"; do
    _cc_box_item "${CC_ORDEM[$i]}" "${CC_ROTULO[$i]}"
  done
  _cc_box_blank
  _cc_box_item "0" "Sair"
  _cc_screen_footer "Use os números para navegar · 0 sai do Control Center"
  # `|| break`: em EOF (stdin esgotado — pipe, teste, uso não-interativo)
  # o read falha; sem isto o loop redesenhava o menu infinitamente
  # (defeito real encontrado na certificação CCC-V1.0-FINAL-001: 57s de
  # saída até estourar o buffer de quem capturava).
  read -rp "Escolha uma opção: " escolha || { _cc_log "Control Center encerrado (EOF no stdin)"; echo ""; break; }
  if [ "$escolha" = "0" ]; then
    _cc_log "Control Center encerrado (opção 0)"
    echo "Saindo do Control Center."
    exit 0
  fi
  _cc_log "Opção selecionada: $escolha"
  _cc_dispatch "$escolha"
done
