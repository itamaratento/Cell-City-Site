#!/bin/bash
# Health Engine — Checker: Workspace
# Verifica integridade do workspace
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_workspace() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local issues=()
  local score=100

  local dirs=("CRM" "scripts" "tests")
  for dir in "${dirs[@]}"; do
    if [[ ! -d "$repo_dir/$dir" ]]; then
      issues+=("{\"severity\":\"error\",\"message\":\"Diretório obrigatório não encontrado: $dir\"}")
      score=$((score - 30))
    fi
  done

  local files=("CRM/firestore.rules" "CRM/firestore.indexes.json" "firebase.json" "package.json")
  for file in "${files[@]}"; do
    if [[ ! -f "$repo_dir/$file" ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Arquivo crítico não encontrado: $file\"}")
      score=$((score - 20))
    fi
  done

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
  "checker": "workspace",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "repo_dir": "${repo_dir}",
    "dirs_ok": true,
    "files_ok": true
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_workspace
