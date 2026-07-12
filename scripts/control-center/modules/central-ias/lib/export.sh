#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Exportações (Fase 10
# — CCC-F10-001, "Exportação": TXT/Markdown/JSON em _reports/ai-center/).
# Chamado a partir de lib/config.sh (não há item de menu dedicado — ver
# CCC-F10-001, o menu de 12 itens não reserva um número só pra isto, igual
# a decisão já tomada aqui). Nenhuma função aqui chama _cc_pause — quem
# chama (config.sh) decide quando pausar.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_cia_export_dir() {
  local dir
  dir=$(_cc_cia_config_get "diretorio_relatorios" "_reports/ai-center")
  echo "$REPO_DIR/$dir"
}

_cc_cia_exportar_txt() {
  _cc_cia_estatisticas_coletar
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir=$(_cc_cia_export_dir)
  mkdir -p "$dir"
  filename="$dir/central-ias_${timestamp}.txt"
  {
    echo "=============================================="
    echo "CELL CITY CONTROL CENTER — CENTRAL DE IAs"
    echo "Data: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=============================================="
    echo ""
    local info
    for info in "${CC_CIA_INFO[@]:-}"; do
      [ -n "$info" ] && echo "- $info"
    done
    echo ""
    echo "Relatório somente-leitura — gerado automaticamente."
  } > "$filename"
  _cc_ok "Relatório exportado: $filename"
  _cc_cia_log "Exportação TXT ($filename)"
}

_cc_cia_exportar_md() {
  _cc_cia_estatisticas_coletar
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir=$(_cc_cia_export_dir)
  mkdir -p "$dir"
  filename="$dir/central-ias_${timestamp}.md"
  {
    echo "# Central de IAs — Cell City Control Center"
    echo ""
    echo "**Data:** $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "## Estatísticas"
    echo ""
    local info
    for info in "${CC_CIA_INFO[@]:-}"; do
      [ -n "$info" ] && echo "- $info"
    done
    echo ""
    echo "---"
    echo "*Relatório somente-leitura, gerado automaticamente pelo Control Center.*"
  } > "$filename"
  _cc_ok "Relatório exportado: $filename"
  _cc_cia_log "Exportação MD ($filename)"
}

_cc_cia_exportar_json() {
  _cc_cia_estatisticas_coletar
  local dir filename timestamp json_info
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir=$(_cc_cia_export_dir)
  mkdir -p "$dir"
  filename="$dir/central-ias_${timestamp}.json"
  if _cc_cia_tem jq; then
    json_info=$(printf '%s\n' "${CC_CIA_INFO[@]:-}" | jq -R . | jq -s .)
  else
    json_info="[]"
  fi
  jq -n --arg data "$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')" \
        --argjson info "$json_info" \
        '{modulo: "Central de IAs", data: $data, estatisticas: $info}' > "$filename" 2>/dev/null \
    || printf '{"modulo":"Central de IAs","data":"%s"}\n' "$(date '+%Y-%m-%d %H:%M:%S')" > "$filename"
  _cc_ok "Relatório exportado: $filename"
  _cc_cia_log "Exportação JSON ($filename)"
}
