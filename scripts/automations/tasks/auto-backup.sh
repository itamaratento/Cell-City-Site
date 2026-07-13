#!/bin/bash
# Automations — Auto Backup
# Executa backup automático (delega para scripts V2 existentes)
set -uo pipefail

AUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$AUT_DIR/lib/utils.sh"

CC_V3_ROOT="$(cd "$AUT_DIR/../.." && pwd)"

_cc_v3_autom_auto_backup() {
  _cc_v3_log "info" "Auto-Backup" "Iniciando backup automático"

  local backup_scripts=(
    "$CC_V3_ROOT/scripts/backup/backup-manual.sh"
  )

  local executed=false
  for script in "${backup_scripts[@]}"; do
    if [[ -f "$script" ]]; then
      _cc_v3_log "info" "Auto-Backup" "Executando: $(basename "$script")"
      bash "$script" 2>/dev/null && executed=true
    fi
  done

  if [[ "$executed" == true ]]; then
    _cc_v3_autom_salvar_status "auto-backup" "concluido" "Backup automático executado"
    _cc_v3_log "info" "Auto-Backup" "Backup automático concluído"
  else
    _cc_v3_autom_salvar_status "auto-backup" "falha" "Nenhum script de backup encontrado"
    _cc_v3_log "error" "Auto-Backup" "Nenhum script de backup encontrado"
  fi
}

_cc_v3_autom_auto_backup
