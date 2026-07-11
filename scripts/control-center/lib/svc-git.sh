#!/bin/bash
# Cell City Control Center — serviço Git (Fase 2, camada "Serviços/Git" da
# Sprint "Desenvolvimento + Release"). Compartilhado pelos módulos
# Desenvolvimento e Release — nenhum dos dois duplica lógica de Git, os
# dois só chamam estas funções. Vive em lib/ (não dentro de um módulo)
# porque é a única peça de Fase 2 que os dois módulos novos precisam da
# mesma forma — "módulo não faz source de outro módulo" continua valendo.
#
# lib/ui-status.sh (Fase 1.2) já cobre branch atual e o rótulo colorido
# de status do menu principal — não duplicado aqui, só reutilizado.
: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/svc-git.sh}"

_cc_svc_git_status_verbose() {
  : "${REPO_DIR:?REPO_DIR precisa estar definido}"
  git -C "$REPO_DIR" status
}

_cc_svc_git_diff() {
  : "${REPO_DIR:?REPO_DIR precisa estar definido}"
  git -C "$REPO_DIR" diff
}

_cc_svc_git_log() {
  : "${REPO_DIR:?REPO_DIR precisa estar definido}"
  local n="${1:-20}"
  git -C "$REPO_DIR" log --oneline -n "$n"
}

_cc_svc_git_arquivos_alterados_count() {
  : "${REPO_DIR:?REPO_DIR precisa estar definido}"
  git -C "$REPO_DIR" status --porcelain | grep -c .
}

_cc_svc_git_workspace_limpo() {
  : "${REPO_DIR:?REPO_DIR precisa estar definido}"
  [ -z "$(git -C "$REPO_DIR" status --porcelain 2>/dev/null)" ]
}

_cc_svc_git_ultimo_commit() {
  : "${REPO_DIR:?REPO_DIR precisa estar definido}"
  git -C "$REPO_DIR" log -1 --format='%h %s (%an, %ar)' 2>/dev/null || echo "nenhum commit encontrado"
}

# 0 = branch reconhecida (develop/main), 1 = qualquer outra.
_cc_svc_git_branch_reconhecida() {
  [[ "$(_cc_git_branch)" =~ ^(develop|main)$ ]]
}
