#!/bin/bash
# Health Engine — Checker: Repositories
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_repositories() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local repos_dir="${repo_dir}/CRM/repositories"
  local base_repo="${repos_dir}/base.repository.js"

  local repos_exists=false
  local js_count=0
  local base_exists=false
  local essential_repos=("clients.repository.js" "os.repository.js" "financeiro.repository.js")

  if [[ -d "$repos_dir" ]]; then
    repos_exists=true
    js_count=$(find "$repos_dir" -maxdepth 1 -type f -name "*.repository.js" 2>/dev/null | wc -l)
    if [[ $js_count -lt 5 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Poucos arquivos repository: ${js_count}\"}")
      score=$((score - 15))
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"Diretório CRM/repositories não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ -f "$base_repo" ]]; then
    base_exists=true
  else
    issues+=("{\"severity\":\"error\",\"message\":\"base.repository.js não encontrado\"}")
    score=$((score - 20))
  fi

  for repo in "${essential_repos[@]}"; do
    local expected="${repos_dir}/${repo}"
    if [[ ! -f "$expected" ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Repository essencial ausente: ${repo}\"}")
      score=$((score - 5))
    fi
  done

  if [[ $score -lt 0 ]]; then score=0; fi
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
  "checker": "repositories",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "repositories_dir_exists": ${repos_exists},
    "repository_js_count": ${js_count},
    "base_repository_exists": ${base_exists}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_repositories
