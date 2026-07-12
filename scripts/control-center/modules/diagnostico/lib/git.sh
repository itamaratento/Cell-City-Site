#!/bin/bash
# Cell City Control Center — módulo Diagnóstico, verificações do Git
# (branch, workspace, arquivos modificados, não versionados, commits
# pendentes, divergência com origin e estado do repositório).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/git.sh}"
: "${REPO_DIR:?REPO_DIR precisa estar definido antes de carregar lib/git.sh}"

_cc_diag_git() {
  if ! _cc_diag_git_repo_valido; then
    _cc_diag_adicionar "fail" "Estado do Repositório" "Não é um repositório Git válido"
    return
  fi
  _cc_diag_git_branch
  _cc_diag_git_workspace
  _cc_diag_git_modificados
  _cc_diag_git_nao_versionados
  _cc_diag_git_commits_pendentes
  _cc_diag_git_divergencia
  _cc_diag_git_estado_repo
}

_cc_diag_git_cmd() {
  git -C "$REPO_DIR" "$@" 2>/dev/null
}

_cc_diag_git_repo_valido() {
  _cc_diag_git_cmd rev-parse --git-dir &>/dev/null
}

_cc_diag_git_branch() {
  local branch
  branch=$(_cc_diag_git_cmd rev-parse --abbrev-ref HEAD)
  if [ -n "$branch" ]; then
    if [[ "$branch" =~ ^(develop|main|master)$ ]]; then
      _cc_diag_adicionar "ok" "Branch Atual" "$branch"
    else
      _cc_diag_adicionar "warn" "Branch Atual" "$branch" "Branch diferente de develop/main" "Verifique se está na branch correta para trabalho" "Considere mudar para develop ou main"
    fi
  else
    _cc_diag_adicionar "fail" "Branch Atual" "Não detectada" "Falha ao obter branch atual" "Impossível determinar branch" "Verifique o estado do repositório"
  fi
}

_cc_diag_git_workspace() {
  local sujo linhas
  sujo=$(_cc_diag_git_cmd status --porcelain)
  if [ -z "$sujo" ]; then
    _cc_diag_adicionar "ok" "Workspace Limpo" "Working tree limpo"
  else
    linhas=$(echo "$sujo" | wc -l)
    _cc_diag_adicionar "warn" "Workspace Limpo" "${linhas} arquivo(s) modificado(s) ou não versionado(s)" "Working tree sujo" "Mudanças locais não commitadas" "Revise e commit ou stash as alterações"
  fi
}

_cc_diag_git_modificados() {
  local modificados total
  modificados=$(_cc_diag_git_cmd diff --name-only)
  if [ -z "$modificados" ]; then
    _cc_diag_adicionar "ok" "Arquivos Modificados" "Nenhum arquivo modificado"
  else
    total=$(echo "$modificados" | wc -l)
    _cc_diag_adicionar "warn" "Arquivos Modificados" "${total} arquivo(s) com alterações" "Existem arquivos modificados no working tree" "Mudanças não commitadas podem ser perdidas" "Revise e commit as alterações"
  fi
}

_cc_diag_git_nao_versionados() {
  local nao_versionados total
  nao_versionados=$(_cc_diag_git_cmd ls-files --others --exclude-standard)
  if [ -z "$nao_versionados" ]; then
    _cc_diag_adicionar "ok" "Arquivos Não Versionados" "Nenhum arquivo não versionado"
    return
  fi
  total=$(echo "$nao_versionados" | wc -l)
  if [ "$total" -gt 20 ]; then
    _cc_diag_adicionar "warn" "Arquivos Não Versionados" "${total} arquivo(s) não versionados" "Muitos arquivos não rastreados" "Poluem o workspace e podem indicar arquivos esquecidos" "Revise e adicione ao .gitignore ou commit"
  else
    _cc_diag_adicionar "ok" "Arquivos Não Versionados" "${total} arquivo(s) não versionados (volume baixo)"
  fi
}

_cc_diag_git_commits_pendentes() {
  local branch ahead
  branch=$(_cc_diag_git_cmd rev-parse --abbrev-ref HEAD)
  ahead=$(_cc_diag_git_cmd rev-list --count "origin/$branch..HEAD")
  if [ -z "$ahead" ]; then
    _cc_diag_adicionar "warn" "Commits Pendentes" "Não foi possível verificar (sem upstream configurado)" "Branch sem tracking remote" "Não é possível determinar commits pendentes" "Configure upstream: git push -u origin $branch"
  elif [ "$ahead" -gt 0 ]; then
    _cc_diag_adicionar "warn" "Commits Pendentes" "${ahead} commit(s) não enviados para origin/${branch}" "Commits locais não publicados" "Alterações não estão disponíveis para outros devs" "Execute git push para publicar"
  else
    _cc_diag_adicionar "ok" "Commits Pendentes" "Sincronizado com origin"
  fi
}

_cc_diag_git_divergencia() {
  local branch ahead behind
  branch=$(_cc_diag_git_cmd rev-parse --abbrev-ref HEAD)
  ahead=$(_cc_diag_git_cmd rev-list --count "origin/$branch..HEAD")
  behind=$(_cc_diag_git_cmd rev-list --count "HEAD..origin/$branch")
  if [ -z "$ahead" ] && [ -z "$behind" ]; then
    _cc_diag_adicionar "warn" "Divergência com Origin" "Não foi possível comparar com origin" "Remote pode não estar configurado" "Não é possível verificar sincronia" "Configure o remote ou verifique conexão"
  elif [ "${ahead:-0}" -gt 0 ] || [ "${behind:-0}" -gt 0 ]; then
    local msg_a="" msg_b=""
    [ "${ahead:-0}" -gt 0 ] && msg_a="${ahead} à frente"
    [ "${behind:-0}" -gt 0 ] && msg_b="${behind} atrás"
    _cc_diag_adicionar "warn" "Divergência com Origin" "${msg_a} ${msg_b}" "Branch local divergente do remote" "Risco de conflitos no merge/push" "Execute git pull e git push para sincronizar"
  else
    _cc_diag_adicionar "ok" "Divergência com Origin" "Branch sincronizada com origin"
  fi
}

_cc_diag_git_estado_repo() {
  local stash
  stash=$(_cc_diag_git_cmd stash list | wc -l)
  if [ "$stash" -gt 0 ]; then
    _cc_diag_adicionar "warn" "Estado do Repositório" "${stash} stash(es) pendente(s)" "Existem stashes não aplicados" "Mudanças podem ser esquecidas" "Revise e aplique ou remova stashes"
  else
    _cc_diag_adicionar "ok" "Estado do Repositório" "Sem stashes pendentes"
  fi
}
