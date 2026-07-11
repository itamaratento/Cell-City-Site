#!/bin/bash
# Cell City Control Center — módulo Backup e Recuperação, camada
# "Recuperação" (Fase 3). Envelopa scripts/backup/restore-backup.sh —
# nunca reimplementa a lógica de restauração.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

# Restaurar Backup — lista os backups (automáticos e manuais), cria uma
# branch local "restore/<data>-<tag>" apontando pro commit escolhido e
# valida integridade via git fsck. Nunca toca em develop/main
# automaticamente (ver scripts/backup/restore-backup.sh). Confirmação
# obrigatória: uma aqui (camada do Control Center) e outra dentro do
# próprio script (depois de mostrar os metadados do backup escolhido) —
# mesma dupla confiança já usada no módulo Release.
_bkp_restaurar() {
  echo "🔄 Restaurar Backup"
  echo "────────────────────"
  echo "Lista os backups disponíveis, cria uma branch local só de leitura"
  echo "(nunca altera develop/main automaticamente) e valida integridade."
  if ! _cc_confirm "Continuar para a restauração guiada?"; then
    echo "Cancelado."
    return
  fi
  bash "$REPO_DIR/scripts/backup/restore-backup.sh"
}
