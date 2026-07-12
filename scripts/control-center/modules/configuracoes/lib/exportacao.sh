#!/bin/bash
# Cell City Control Center — módulo Configurações, Exportações (Fase 11,
# CCC-F11-001). Mesmo padrão de 3 formatos já homologado em
# modules/banco-dados/lib/export.sh e modules/branches-sincronizacao/lib/export.sh.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_cfg_export_dir() {
  local dir
  dir=$(_cc_cfg_config_get "exportacao_diretorio" "_reports/configuracoes")
  echo "$REPO_DIR/$dir"
}

_cc_cfg_exportacao() {
  local opcao dir formato_padrao
  while true; do
    dir=$(_cc_cfg_config_get "exportacao_diretorio" "_reports/configuracoes")
    formato_padrao=$(_cc_cfg_config_get "exportacao_formato_padrao" "txt")

    _cc_screen_title "EXPORTAÇÕES"
    _cc_screen_breadcrumb "Control Center › Configurações › Exportações"
    _cc_box_blank
    _cc_box_line "Diretório de exportação (preferência) : $dir"
    _cc_box_line "Formato padrão (preferência)           : $formato_padrao"
    _cc_box_blank
    _cc_box_item "1" "Definir diretório de exportação"
    _cc_box_item "2" "Definir formato padrão (txt/md/json)"
    _cc_box_item "3" "Exportar Relatório (TXT)"
    _cc_box_item "4" "Exportar Relatório (Markdown)"
    _cc_box_item "5" "Exportar Relatório (JSON)"
    _cc_box_blank
    _cc_box_item "0" "Voltar"
    _cc_screen_footer "0 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1)
        read -rp "Diretório (relativo ao repositório, vazio cancela): " valor
        if [ -n "$valor" ]; then
          _cc_cfg_config_set "exportacao_diretorio" "$valor"
          _cc_ok "Diretório definido: $valor"
        else
          echo "Cancelado."
        fi
        _cc_pause
        ;;
      2)
        read -rp "Formato padrão (txt/md/json, vazio cancela): " valor
        case "$valor" in
          txt|md|json) _cc_cfg_config_set "exportacao_formato_padrao" "$valor"; _cc_ok "Formato definido: $valor" ;;
          "") echo "Cancelado." ;;
          *) _cc_fail "Valor inválido — use txt, md ou json" ;;
        esac
        _cc_pause
        ;;
      3) _cc_cfg_exportar_txt ;;
      4) _cc_cfg_exportar_md ;;
      5) _cc_cfg_exportar_json ;;
      0) break ;;
      *) echo "Opção inválida." ;;
    esac
  done
}

_cc_cfg_exportar_txt() {
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir="$(_cc_cfg_export_dir)"
  mkdir -p "$dir"
  filename="$dir/configuracoes_${timestamp}.txt"
  {
    echo "=============================================="
    echo "CELL CITY CONTROL CENTER — CONFIGURAÇÕES"
    echo "Data: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=============================================="
    echo ""
    echo "Preferências locais (config/local.json):"
    _cc_cfg_config_ler 2>/dev/null | jq -r 'to_entries[] | "  - \(.key): \(.value)"' 2>/dev/null
    echo ""
    echo "Relatório somente-leitura — gerado automaticamente."
  } > "$filename"
  _cc_ok "Relatório exportado: $filename"
  _cc_log "Configurações: exportação TXT ($filename)"
  _cc_pause
}

_cc_cfg_exportar_md() {
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir="$(_cc_cfg_export_dir)"
  mkdir -p "$dir"
  filename="$dir/configuracoes_${timestamp}.md"
  {
    echo "# Configurações — Cell City Control Center"
    echo ""
    echo "**Data:** $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "## Preferências locais"
    echo ""
    echo "| Chave | Valor |"
    echo "|---|---|"
    _cc_cfg_config_ler 2>/dev/null | jq -r 'to_entries[] | "| \(.key) | \(.value) |"' 2>/dev/null
    echo ""
    echo "---"
    echo "*Relatório somente-leitura, gerado automaticamente pelo Control Center.*"
  } > "$filename"
  _cc_ok "Relatório exportado: $filename"
  _cc_log "Configurações: exportação MD ($filename)"
  _cc_pause
}

_cc_cfg_exportar_json() {
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir="$(_cc_cfg_export_dir)"
  mkdir -p "$dir"
  filename="$dir/configuracoes_${timestamp}.json"
  if _cc_cfg_tem jq; then
    jq -n --arg data "$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')" \
          --argjson preferencias "$(_cc_cfg_config_ler 2>/dev/null || echo '{}')" \
          '{modulo: "Configurações", data: $data, preferencias: $preferencias}' > "$filename" 2>/dev/null
  fi
  if [ ! -s "$filename" ]; then
    printf '{"modulo":"Configurações","data":"%s"}\n' "$(date '+%Y-%m-%d %H:%M:%S')" > "$filename"
  fi
  _cc_ok "Relatório exportado: $filename"
  _cc_log "Configurações: exportação JSON ($filename)"
  _cc_pause
}
