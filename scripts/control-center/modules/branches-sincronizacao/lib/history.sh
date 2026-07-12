#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Histórico" (Fase 5). Leitura pura (git log) — complementa
# lib/svc-git.sh (_cc_svc_git_log, sem filtro/decoração) com autor, data,
# branches/tags relacionadas (--decorate) e um filtro de quantidade.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_brs_historico() {
  echo "📜 Histórico"
  echo "─────────────"
  read -rp "Quantos commits mostrar? (Enter = 20): " qtd
  [[ "$qtd" =~ ^[0-9]+$ ]] || qtd=20

  echo ""
  git -C "$REPO_DIR" log -n "$qtd" \
    --pretty=format:'%h  %ad  %<(20,trunc)%an %d %s' --date=short --decorate
  echo ""
  echo ""
  local branch total_geral
  branch="$(_cc_git_branch)"
  total_geral="$(git -C "$REPO_DIR" rev-list --count HEAD)"
  echo "Branch: $branch — $total_geral commit(s) no total."
}
