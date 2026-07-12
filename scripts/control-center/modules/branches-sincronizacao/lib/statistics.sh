#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Estatísticas" (Fase 5). Leitura pura — só agrega números que as outras
# telas deste módulo já sabem calcular individualmente (branches/tags/
# stashes/commits/sincronização), sem duplicar a lógica de cada uma.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_brs_estatisticas() {
  echo "📊 Estatísticas"
  echo "────────────────"
  local total_locais total_remotas total_commits total_tags total_stashes ultimo branch_recente

  total_locais="$(git -C "$REPO_DIR" branch --list | grep -c .)"
  total_remotas="$(git -C "$REPO_DIR" branch -r --list | grep -vc '\->')"
  total_commits="$(git -C "$REPO_DIR" rev-list --count HEAD)"
  total_tags="$(git -C "$REPO_DIR" tag -l | grep -c .)"
  total_stashes="$(git -C "$REPO_DIR" stash list | grep -c .)"
  ultimo="$(_cc_svc_git_ultimo_commit)"
  branch_recente="$(git -C "$REPO_DIR" for-each-ref --sort=-committerdate refs/heads/ --format='%(refname:short)' | head -1)"

  echo "Total de branches locais  : $total_locais"
  echo "Total de branches remotas : $total_remotas"
  echo "Total de commits (HEAD)   : $total_commits"
  echo "Total de tags             : $total_tags"
  echo "Total de stashes          : $total_stashes"
  echo "Último commit             : $ultimo"
  echo "Branch mais recente       : ${branch_recente:-?}"
  echo "Última sincronização      : $(_brs_ultima_sincronizacao) ($(_brs_tempo_desde_sincronizacao))"
  _cc_log "Branches e Sincronização: Estatísticas consultadas (locais=$total_locais, remotas=$total_remotas, commits=$total_commits)"
}
