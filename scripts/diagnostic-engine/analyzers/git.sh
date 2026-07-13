#!/bin/bash
# Diagnostic Engine — Analyzer: Git
# Analisa saúde do repositório Git em profundidade
set -uo pipefail

DE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$DE_DIR/lib/utils.sh"

_cc_v3_diag_analyze_git() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local findings=()

  if [[ ! -d "$repo_dir/.git" ]]; then
    echo '[]'
    return
  fi

  local branch
  branch=$(cd "$repo_dir" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "desconhecido")

  if [[ "$branch" != "develop" && "$branch" != "main" ]]; then
    findings+=("$(jq -n --arg m "Branch não padrão: $branch" '{analyzer:"git",tipo:"warning",severidade:"warning",categoria:"git",mensagem:$m}')")
  fi

  if ! (cd "$repo_dir" && git diff --quiet 2>/dev/null); then
    local modified
    modified=$(cd "$repo_dir" && git status --porcelain 2>/dev/null | wc -l)
    findings+=("$(jq -n --arg m "$modified arquivos modificados no workspace" '{analyzer:"git",tipo:"warning",severidade:"warning",categoria:"git",mensagem:$m}')")
  fi

  local ahead
  ahead=$(cd "$repo_dir" && git rev-list --count "@{upstream}..HEAD" 2>/dev/null || echo 0)
  if (( ahead > 5 )); then
    findings+=("$(jq -n --arg m "$ahead commits não enviados ao remoto" '{analyzer:"git",tipo:"warning",severidade:"warning",categoria:"git",mensagem:$m}')")
  fi

  local behind
  behind=$(cd "$repo_dir" && git rev-list --count "HEAD..@{upstream}" 2>/dev/null || echo 0)
  if (( behind > 0 )); then
    findings+=("$(jq -n --arg m "$behind commits atrás do remoto" '{analyzer:"git",tipo:"error",severidade:"error",categoria:"git",mensagem:$m}')")
  fi

  local last_commit_ts
  last_commit_ts=$(cd "$repo_dir" && git log -1 --format="%ct" 2>/dev/null || echo 0)
  local now
  now=$(date +%s)
  local days_since=$(( (now - last_commit_ts) / 86400 ))
  if (( days_since > 7 )); then
    findings+=("$(jq -n --arg m "Último commit há $days_since dias" '{analyzer:"git",tipo:"warning",severidade:"warning",categoria:"git",mensagem:$m}')")
  fi

  if [[ ${#findings[@]} -eq 0 ]]; then
    echo '[]'
    return
  fi

  echo "["
  local first=true
  for f in "${findings[@]}"; do
    if [[ "$first" == true ]]; then first=false; else echo ","; fi
    echo -n "$f"
  done
  echo "]"
}

_cc_v3_diag_analyze_git
