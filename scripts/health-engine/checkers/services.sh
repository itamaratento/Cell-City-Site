#!/bin/bash
# Health Engine — Checker: Services
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_services() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local services_dir="${repo_dir}/CRM/services"

  local services_exists=false
  local js_count=0
  local has_readme=false

  if [[ -d "$services_dir" ]]; then
    services_exists=true
    js_count=$(find "$services_dir" -maxdepth 1 -type f -name "*.js" 2>/dev/null | wc -l)
    if [[ -f "${services_dir}/README.md" ]]; then
      has_readme=true
    fi
    if [[ $js_count -lt 1 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Nenhum arquivo de serviço encontrado em CRM/services/\"}")
      score=$((score - 20))
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"Diretório CRM/services não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ $has_readme == false ]]; then
    issues+=("{\"severity\":\"warn\",\"message\":\"README.md não encontrado em CRM/services/\"}")
    score=$((score - 5))
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
  "checker": "services",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "services_dir_exists": ${services_exists},
    "service_js_count": ${js_count},
    "has_readme": ${has_readme}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_services
