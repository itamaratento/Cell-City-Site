#!/bin/bash
# Health Engine — Checker: Git
# Verifica saúde do repositório Git
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_git() {
  local repo_dir="${REPO_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo '/home/cellcity/Músicas/projetos/Cell-City-Site')}"

  if [[ ! -d "$repo_dir/.git" ]]; then
    echo '{"checker":"git","status":"error","score":0,"details":{"erro":"Diretório .git não encontrado"}}'
    return
  fi

  local branch=""
  local workspace_clean=true
  local commits_ahead=0
  local commits_behind=0
  local last_commit=""
  local issues=()
  local score=100

  branch=$(cd "$repo_dir" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "desconhecido")

  if [[ "$branch" != "develop" && "$branch" != "main" ]]; then
    issues+=("{\"severity\":\"warn\",\"message\":\"Branch não padrão: $branch\"}")
    score=$((score - 10))
  fi

  if ! (cd "$repo_dir" && git diff --quiet 2>/dev/null); then
    workspace_clean=false
    issues+=("{\"severity\":\"warn\",\"message\":\"Workspace tem alterações não commitadas\"}")
    score=$((score - 15))
  fi

  local ahead behind
  ahead=$(cd "$repo_dir" && git rev-list --count "@{upstream}..HEAD" 2>/dev/null || echo 0)
  behind=$(cd "$repo_dir" && git rev-list --count "HEAD..@{upstream}" 2>/dev/null || echo 0)
  commits_ahead=$ahead
  commits_behind=$behind

  if (( commits_ahead > 5 )); then
    issues+=("{\"severity\":\"warn\",\"message\":\"${commits_ahead} commits ahead do remoto\"}")
    score=$((score - 5))
  fi

  last_commit=$(cd "$repo_dir" && git log -1 --format="%h - %s" 2>/dev/null || echo "N/A")
  local last_commit_ts
  last_commit_ts=$(cd "$repo_dir" && git log -1 --format="%ct" 2>/dev/null || echo 0)
  local now
  now=$(date +%s)
  local days_since=$(( (now - last_commit_ts) / 86400 ))

  if (( days_since > 7 )); then
    issues+=("{\"severity\":\"warn\",\"message\":\"Último commit há ${days_since} dias\"}")
    score=$((score - 10))
  fi

  if (( score < 0 )); then score=0; fi

  local status="pass"
  if (( score < 70 )); then status="fail"
  elif (( score < 90 )); then status="warn"
  fi

  local issues_json="["
  local first=true
  for issue in "${issues[@]}"; do
    if [[ "$first" == true ]]; then first=false; else issues_json+=","; fi
    issues_json+="$issue"
  done
  issues_json+="]"

  cat <<EOF
{
  "checker": "git",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "branch": "${branch}",
    "workspace_clean": ${workspace_clean},
    "commits_ahead": ${commits_ahead},
    "commits_behind": ${commits_behind},
    "last_commit": "${last_commit}",
    "days_since_last_commit": ${days_since}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_git
