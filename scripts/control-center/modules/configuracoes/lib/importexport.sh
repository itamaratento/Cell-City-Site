#!/bin/bash
# Cell City Control Center — módulo Configurações, Importar/Exportar/Reset
# do próprio config/local.json (Fase 11, CCC-F11-001). Distinto de
# lib/exportacao.sh (que gera um relatório formatado) — aqui é
# especificamente cópia/restauração do arquivo de preferências em si.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_cfg_importexport() {
  local opcao
  while true; do
    _cc_screen_title "IMPORTAR / EXPORTAR / RESET"
    _cc_screen_breadcrumb "Control Center › Configurações › Importar/Exportar"
    _cc_box_blank
    _cc_box_line "Arquivo atual : $CC_CFG_CONFIG_FILE"
    _cc_box_blank
    _cc_box_item "1" "Exportar cópia de segurança do arquivo atual"
    _cc_box_item "2" "Importar de um arquivo de backup"
    _cc_box_item "3" "Reset seguro (restaurar padrões)"
    _cc_box_blank
    _cc_box_item "0" "Voltar"
    _cc_screen_footer "0 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1) _cc_cfg_backup_exportar ;;
      2) _cc_cfg_backup_importar ;;
      3) _cc_cfg_reset_seguro ;;
      0) break ;;
      *) echo "Opção inválida." ;;
    esac
  done
}

_cc_cfg_backup_exportar() {
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir="$(_cc_cfg_export_dir)"
  mkdir -p "$dir"
  filename="$dir/config-backup_${timestamp}.json"
  _cc_cfg_config_ler > "$filename"
  _cc_ok "Cópia de segurança salva: $filename"
  _cc_log "Configurações: backup do local.json exportado ($filename)"
  _cc_pause
}

_cc_cfg_backup_importar() {
  local caminho
  read -rp "Caminho do arquivo de backup a importar (Enter cancela): " caminho
  if [ -z "$caminho" ]; then
    echo "Cancelado."
    _cc_pause
    return
  fi
  if [ ! -f "$caminho" ]; then
    _cc_fail "Arquivo não encontrado: $caminho"
    _cc_pause
    return
  fi
  if ! _cc_cfg_tem jq || ! jq -e . "$caminho" >/dev/null 2>&1; then
    _cc_fail "Arquivo não é um JSON válido — importação cancelada."
    _cc_pause
    return
  fi
  echo ""
  echo "Prévia do arquivo a importar:"
  jq -r 'to_entries[] | "  - \(.key): \(.value)"' "$caminho" 2>/dev/null
  echo ""
  if ! _cc_confirm "Substituir as preferências atuais por este arquivo?"; then
    echo "Cancelado."
    _cc_pause
    return
  fi
  mkdir -p "$(dirname "$CC_CFG_CONFIG_FILE")"
  cp "$caminho" "$CC_CFG_CONFIG_FILE"
  _cc_ok "Configurações importadas de: $caminho"
  _cc_log "Configurações: local.json importado de $caminho"
  _cc_pause
}

_cc_cfg_reset_seguro() {
  if _cc_confirm "Restaurar TODAS as preferências deste módulo para o padrão? Isto é irreversível."; then
    rm -f "$CC_CFG_CONFIG_FILE"
    _cc_ok "Configurações restauradas ao padrão."
    _cc_log "Configurações: reset seguro executado"
  else
    echo "Cancelado."
  fi
  _cc_pause
}
