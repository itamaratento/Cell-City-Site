#!/bin/bash
# Cell City Control Center — módulo Backup e Recuperação, camada
# "Utilitários" (Fase 3).
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

# Limpeza de Backups — remove backups MANUAIS antigos do repositório de
# backup, sempre preservando o mais recente. Nunca mexe em auto-slot-*
# (esses rotacionam sozinhos, apagar um quebraria a idempotência do
# backup automático semanal — ver scripts/backup/backup-automatic.sh).
# Confirmação obrigatória (ver README.md, "Segurança").
_bkp_limpeza() {
  echo "🧹 Limpeza de Backups"
  echo "──────────────────────"
  # shellcheck source=/dev/null
  if ! source "$REPO_DIR/scripts/backup/config.sh" 2>/dev/null; then
    _cc_fail "Não foi possível carregar scripts/backup/config.sh"
    return
  fi

  mapfile -t manuais < <(git ls-remote --tags "$BACKUP_REPO_HTTPS" 2>/dev/null \
    | awk '{print $2}' | sed 's#refs/tags/##' \
    | grep '^manual-' | grep -v '\^{}$' | sort)

  if [ "${#manuais[@]}" -le 1 ]; then
    echo "Nada para limpar (${#manuais[@]} backup(s) manual(is) encontrado(s) — o mais recente nunca é removido)."
    return
  fi

  local mais_recente="${manuais[-1]}"
  local -a remover=("${manuais[@]:0:${#manuais[@]}-1}")

  echo "Backup manual mais recente (preservado): $mais_recente"
  echo "Backups manuais a remover (${#remover[@]}):"
  printf '  - %s\n' "${remover[@]}"

  if ! _cc_confirm "Remover os ${#remover[@]} backup(s) manual(is) acima?"; then
    echo "Cancelado."
    return
  fi

  local tag falhas=0
  for tag in "${remover[@]}"; do
    if git push "$BACKUP_REPO_HTTPS" --delete "refs/tags/$tag" >/dev/null 2>&1; then
      _cc_ok "Removido: $tag"
    else
      _cc_fail "Falha ao remover: $tag"
      falhas=$((falhas + 1))
    fi
  done

  [ "$falhas" -eq 0 ] && _cc_ok "Limpeza concluída." || _cc_warn "Limpeza concluída com $falhas falha(s)."
}
