#!/bin/bash
# Health Engine — Checker: Dashboard
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_dashboard() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local dash_html="${repo_dir}/CRM/pages/dashboard/dashboard.html"
  local dash_index="${repo_dir}/CRM/pages/dashboard/index.html"
  local dash_dir="${repo_dir}/CRM/pages/dashboard"

  local dash_exists=false
  local dash_nonempty=false
  local has_key_elements=false

  if [[ -f "$dash_html" ]]; then
    dash_exists=true
    if [[ -s "$dash_html" ]]; then
      dash_nonempty=true
      if grep -q -E "cc-|container|dashboard" "$dash_html" 2>/dev/null; then
        has_key_elements=true
      fi
    fi
  elif [[ -f "$dash_index" ]]; then
    dash_exists=true
    if [[ -s "$dash_index" ]]; then
      dash_nonempty=true
      if grep -q -E "cc-|container|dashboard" "$dash_index" 2>/dev/null; then
        has_key_elements=true
      fi
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"CRM/pages/dashboard/dashboard.html não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ "$dash_exists" == true && "$dash_nonempty" == false ]]; then
    issues+=("{\"severity\":\"error\",\"message\":\"dashboard.html está vazio\"}")
    score=$((score - 25))
  fi

  if [[ "$dash_exists" == true && "$dash_nonempty" == true && "$has_key_elements" == false ]]; then
    issues+=("{\"severity\":\"warn\",\"message\":\"dashboard.html não contém elementos chave esperados\"}")
    score=$((score - 10))
  fi

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
  "checker": "dashboard",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "dashboard_dir_exists": $( if [[ -d "$dash_dir" ]]; then echo true; else echo false; fi ),
    "dashboard_html_exists": ${dash_exists},
    "dashboard_nonempty": ${dash_nonempty},
    "has_key_elements": ${has_key_elements}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_dashboard
