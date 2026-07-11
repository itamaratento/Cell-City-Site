#!/bin/bash
# Cell City Control Center — módulo Backup e Recuperação, camada
# "Validação" (Fase 3). Não existia uma checagem de integridade autônoma
# antes desta Sprint (scripts/backup/restore-backup.sh só valida DEPOIS de
# escolher um backup pra restaurar) — esta função é read-only e nova de
# propósito, sem duplicar nada (não reimplementa restauração nem backup).
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_bkp_validar_integridade() {
  echo "🔎 Validar Integridade"
  echo "───────────────────────"

  echo "Estrutura Git local (git fsck)..."
  if git -C "$REPO_DIR" fsck --no-dangling >/tmp/cellcity-backup-fsck.log 2>&1; then
    _cc_ok "Repositório local íntegro."
  else
    _cc_fail "git fsck encontrou problemas — ver /tmp/cellcity-backup-fsck.log"
  fi

  echo "Permissões dos scripts de backup..."
  local script faltando=0
  for script in backup-manual.sh backup-automatic.sh restore-backup.sh; do
    if [ ! -x "$REPO_DIR/scripts/backup/$script" ]; then
      _cc_fail "scripts/backup/$script sem permissão de execução"
      faltando=1
    fi
  done
  [ "$faltando" -eq 0 ] && _cc_ok "Todos os scripts de backup existem e são executáveis."

  echo "Configuração compartilhada (scripts/backup/config.sh)..."
  # shellcheck source=/dev/null
  if source "$REPO_DIR/scripts/backup/config.sh" 2>/dev/null && [ -n "${BACKUP_REPO_HTTPS:-}" ]; then
    _cc_ok "config.sh carregado (repo de backup: $BACKUP_REPO_HTTPS)."
  else
    _cc_fail "scripts/backup/config.sh ausente ou não define BACKUP_REPO_HTTPS."
    return
  fi

  echo "Conectividade com o repositório de backup..."
  if git ls-remote --tags "$BACKUP_REPO_HTTPS" >/tmp/cellcity-backup-lsremote.log 2>&1; then
    local total_tags
    total_tags=$(grep -c . /tmp/cellcity-backup-lsremote.log)
    _cc_ok "Conectado — $total_tags referência(s) encontrada(s)."
  else
    _cc_fail "Não foi possível acessar $BACKUP_REPO_HTTPS — ver /tmp/cellcity-backup-lsremote.log"
  fi

  echo "Backups locais do projeto (_BACKUPS/)..."
  if [ -d "$REPO_DIR/_BACKUPS" ] && [ -r "$REPO_DIR/_BACKUPS" ]; then
    local qtd
    qtd=$(find "$REPO_DIR/_BACKUPS" -maxdepth 1 -mindepth 1 -type d | wc -l)
    _cc_ok "_BACKUPS/ acessível — $qtd slot(s) de backup do projeto."
  else
    _cc_warn "_BACKUPS/ ainda não existe (nenhum 'Backup do Projeto' rodado ainda nesta máquina)."
  fi
}
