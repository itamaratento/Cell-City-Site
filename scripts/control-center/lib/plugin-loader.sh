#!/bin/bash
# Cell City Control Center — Plugin Loader (Fase 1.1).
#
# Carrega automaticamente todo plugin em plugins/<nome>/plugin.sh, sem o
# núcleo (core/menu.sh) precisar conhecer nenhum plugin específico — mesma
# ideia do manifesto de módulos (config/modules.conf), aplicada a extensões
# futuras (Versão 3.0 do Roadmap: automação, monitoramento, ver
# ../plugins/README.md). Sem nenhum plugin instalado (caso desta Fase 1.1),
# o loop não encontra nada e não faz nada — idiom clássico do bash pra glob
# vazio sem precisar de `shopt -s nullglob`.
: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/plugin-loader.sh}"

_cc_load_plugins() {
  local plugin carregados=0
  for plugin in "$CC_ROOT"/plugins/*/plugin.sh; do
    [ -e "$plugin" ] || continue
    # shellcheck disable=SC1090
    source "$plugin"
    carregados=$((carregados + 1))
    _cc_log "Plugin carregado: $(basename "$(dirname "$plugin")")"
  done
  if [ "$carregados" -eq 0 ]; then
    _cc_log "Nenhum plugin encontrado em plugins/"
  fi
}
