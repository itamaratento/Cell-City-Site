#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, Exportações.
# CCC-F04-001 §11. Exporta o resultado das Estatísticas (§10) em
# TXT/Markdown/JSON, sempre em _reports/database/ (nunca versionado —
# ver .gitignore). Mesmo padrão de modules/ferramentas/lib/exportacao.sh.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_bd_export_dir() {
  local dir
  dir=$(_cc_bd_config_get "diretorio_exportacao" "_reports/database")
  echo "$REPO_DIR/$dir"
}

_cc_bd_exportar() {
  local opcao
  while true; do
    _cc_screen_title "EXPORTAÇÕES"
    _cc_screen_breadcrumb "Control Center › Banco de Dados › Exportações"
    _cc_box_blank
    _cc_box_item "1" "Exportar Relatório (TXT)"
    _cc_box_item "2" "Exportar Relatório (Markdown)"
    _cc_box_item "3" "Exportar Relatório (JSON)"
    _cc_box_blank
    _cc_box_item "0" "Voltar"
    _cc_screen_footer "Escolha o formato · 0 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1) _cc_bd_exportar_txt ;;
      2) _cc_bd_exportar_md ;;
      3) _cc_bd_exportar_json ;;
      0) break ;;
      *) echo "Opção inválida." ;;
    esac
  done
}

_cc_bd_exportar_txt() {
  _cc_bd_init
  _cc_bd_estatisticas_coletar
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir=$(_cc_bd_export_dir)
  mkdir -p "$dir"
  filename="$dir/banco-dados_${timestamp}.txt"
  {
    echo "=============================================="
    echo "CELL CITY CONTROL CENTER — BANCO DE DADOS"
    echo "Data: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=============================================="
    echo ""
    local info
    for info in "${CC_BD_INFO[@]:-}"; do
      [ -n "$info" ] && echo "- $info"
    done
    echo ""
    echo "Relatório somente-leitura — gerado automaticamente."
  } > "$filename"
  _cc_ok "Relatório exportado: $filename"
  _cc_log "Banco de Dados: exportação TXT ($filename)"
  _cc_pause
}

_cc_bd_exportar_md() {
  _cc_bd_init
  _cc_bd_estatisticas_coletar
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir=$(_cc_bd_export_dir)
  mkdir -p "$dir"
  filename="$dir/banco-dados_${timestamp}.md"
  {
    echo "# Banco de Dados — Cell City Control Center"
    echo ""
    echo "**Data:** $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "## Estatísticas"
    echo ""
    local info
    for info in "${CC_BD_INFO[@]:-}"; do
      [ -n "$info" ] && echo "- $info"
    done
    echo ""
    echo "---"
    echo "*Relatório somente-leitura, gerado automaticamente pelo Control Center.*"
  } > "$filename"
  _cc_ok "Relatório exportado: $filename"
  _cc_log "Banco de Dados: exportação MD ($filename)"
  _cc_pause
}

_cc_bd_exportar_json() {
  _cc_bd_init
  _cc_bd_estatisticas_coletar
  local dir filename timestamp json_info
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir=$(_cc_bd_export_dir)
  mkdir -p "$dir"
  filename="$dir/banco-dados_${timestamp}.json"
  if _cc_bd_tem jq; then
    json_info=$(printf '%s\n' "${CC_BD_INFO[@]:-}" | jq -R . | jq -s .)
  else
    json_info="[]"
  fi
  jq -n --arg data "$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')" \
        --argjson info "$json_info" \
        '{modulo: "Banco de Dados", data: $data, estatisticas: $info}' > "$filename" 2>/dev/null \
    || printf '{"modulo":"Banco de Dados","data":"%s"}\n' "$(date '+%Y-%m-%d %H:%M:%S')" > "$filename"
  _cc_ok "Relatório exportado: $filename"
  _cc_log "Banco de Dados: exportação JSON ($filename)"
  _cc_pause
}
