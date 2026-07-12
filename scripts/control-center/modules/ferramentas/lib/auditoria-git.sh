#!/bin/bash
# Cell City Control Center — módulo Ferramentas, Auditoria Git.
# Verifica branch, commits, tags, histórico, conflitos e integridade.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_ferr_auditoria_git() {
  if ! _cc_ferr_git_valido; then
    _cc_ferr_adicionar "fail" "Repositório Git" "Não é um repositório Git válido"
    return
  fi
  _cc_ferr_aud_git_branch
  _cc_ferr_aud_git_commits
  _cc_ferr_aud_git_tags
  _cc_ferr_aud_git_historico
  _cc_ferr_aud_git_modificados
  _cc_ferr_aud_git_nao_rastreados
  _cc_ferr_aud_git_conflitos
  _cc_ferr_aud_git_integridade
}

_cc_ferr_git_cmd() { git -C "$REPO_DIR" "$@" 2>/dev/null; }

_cc_ferr_git_valido() { _cc_ferr_git_cmd rev-parse --git-dir &>/dev/null; }

_cc_ferr_aud_git_branch() {
  local branch total
  branch=$(_cc_ferr_git_cmd rev-parse --abbrev-ref HEAD)
  total=$(_cc_ferr_git_cmd branch -a 2>/dev/null | wc -l)
  if [[ "$branch" =~ ^(develop|main|master)$ ]]; then
    _cc_ferr_adicionar "ok" "Branch Atual" "$branch (${total} branches totais)"
  else
    _cc_ferr_adicionar "warn" "Branch Atual" "$branch" "Branch diferente de develop/main" "Verifique se a branch correta está ativa" "Considere mudar para develop ou main"
  fi
}

_cc_ferr_aud_git_commits() {
  local total recente
  total=$(_cc_ferr_git_cmd rev-list --count HEAD 2>/dev/null || echo "0")
  recente=$(_cc_ferr_git_cmd log --oneline -5 2>/dev/null | head -5)
  local count
  count=$(echo "$recente" | wc -l)
  _cc_ferr_adicionar "ok" "Commits" "${total} commits no histórico, ${count} recentes"
}

_cc_ferr_aud_git_tags() {
  local tags
  tags=$(_cc_ferr_git_cmd tag -l 2>/dev/null | wc -l)
  if [ "$tags" -gt 0 ]; then
    local ultima
    ultima=$(_cc_ferr_git_cmd tag -l 2>/dev/null | sort -V | tail -1)
    _cc_ferr_adicionar "ok" "Tags" "${tags} tag(s), última: ${ultima}"
  else
    _cc_ferr_adicionar "ok" "Tags" "Nenhuma tag encontrada"
  fi
}

_cc_ferr_aud_git_historico() {
  local branch datalimite antigos=0
  branch=$(_cc_ferr_git_cmd rev-parse --abbrev-ref HEAD)
  datalimite=$(date -d '30 days ago' '+%Y-%m-%d' 2>/dev/null)
  if [ -n "$datalimite" ]; then
    antigos=$(_cc_ferr_git_cmd log --oneline --before="$datalimite" --branches="$branch" 2>/dev/null | wc -l)
  fi
  local merge
  merge=$(_cc_ferr_git_cmd log --oneline --merges -5 2>/dev/null | wc -l)
  _cc_ferr_adicionar "ok" "Histórico" "${antigos} commit(s) com mais de 30 dias, ${merge} merge(s) recentes"
}

_cc_ferr_aud_git_modificados() {
  local modificados
  modificados=$(_cc_ferr_git_cmd diff --name-only | wc -l)
  if [ "$modificados" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Arquivos Modificados" "Nenhum arquivo modificado"
  else
    _cc_ferr_adicionar "warn" "Arquivos Modificados" "${modificados} arquivo(s) modificado(s)" "Working tree com alterações não commitadas" "Mudanças podem ser perdidas" "Commit ou stash as alterações"
  fi
}

_cc_ferr_aud_git_nao_rastreados() {
  local nao_rastreados
  nao_rastreados=$(_cc_ferr_git_cmd ls-files --others --exclude-standard | wc -l)
  if [ "$nao_rastreados" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Arquivos Não Rastreados" "Nenhum arquivo não rastreado"
  else
    _cc_ferr_adicionar "info" "Arquivos Não Rastreados" "${nao_rastreados} arquivo(s) não rastreado(s)"
  fi
}

_cc_ferr_aud_git_conflitos() {
  local conflitos
  conflitos=$(_cc_ferr_git_cmd diff --name-only --diff-filter=U 2>/dev/null | wc -l)
  if [ "$conflitos" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Conflitos" "Nenhum conflito de merge detectado"
  else
    _cc_ferr_adicionar "fail" "Conflitos" "${conflitos} arquivo(s) em conflito" "Conflitos de merge não resolvidos" "Impossível fazer merge ou commit" "Resolva os conflitos manualmente"
  fi
}

_cc_ferr_aud_git_integridade() {
  local objetos
  objetos=$(_cc_ferr_git_cmd fsck --lost-found 2>/dev/null | wc -l)
  if [ "$objetos" -le 2 ]; then
    _cc_ferr_adicionar "ok" "Integridade" "Repositório íntegro"
  else
    _cc_ferr_adicionar "warn" "Integridade" "${objetos} problemas detectados no git fsck" "Repositório pode ter corrupção" "Pode causar perda de dados" "Execute git fsck para diagnóstico"
  fi
}
