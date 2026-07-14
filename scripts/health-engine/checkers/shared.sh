#!/bin/bash
# Health Engine — Checker: Shared
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_shared() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local shared_dir="${repo_dir}/CRM/shared"
  local sw_file="${repo_dir}/CRM/sw.js"
  local sw_root="${repo_dir}/sw.js"

  local shared_exists=false
  local kernel_exists=false
  local firebase_exists=false
  local permissoes_exists=false
  local sw_crm_exists=false
  local sw_root_exists=false
  local shared_js_count=0

  if [[ -d "$shared_dir" ]]; then
    shared_exists=true
    shared_js_count=$(find "$shared_dir" -maxdepth 1 -type f -name "*.js" 2>/dev/null | wc -l)
  else
    issues+=("{\"severity\":\"error\",\"message\":\"Diretório CRM/shared não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ -f "${shared_dir}/kernel.js" ]]; then
    kernel_exists=true
  else
    issues+=("{\"severity\":\"error\",\"message\":\"kernel.js não encontrado em CRM/shared\"}")
    score=$((score - 15))
  fi

  if [[ -f "${shared_dir}/firebase.js" ]]; then
    firebase_exists=true
  else
    issues+=("{\"severity\":\"error\",\"message\":\"firebase.js não encontrado em CRM/shared\"}")
    score=$((score - 15))
  fi

  if [[ -f "${shared_dir}/permissoes.js" ]]; then
    permissoes_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"permissoes.js não encontrado em CRM/shared\"}")
    score=$((score - 10))
  fi

  if [[ -f "$sw_file" ]]; then
    sw_crm_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"CRM/sw.js não encontrado\"}")
    score=$((score - 10))
  fi

  if [[ -f "$sw_root" ]]; then
    sw_root_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"sw.js raiz não encontrado\"}")
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
  "checker": "shared",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "shared_dir_exists": ${shared_exists},
    "shared_js_count": ${shared_js_count},
    "kernel_js_exists": ${kernel_exists},
    "firebase_js_exists": ${firebase_exists},
    "permissoes_js_exists": ${permissoes_exists},
    "sw_crm_exists": ${sw_crm_exists},
    "sw_root_exists": ${sw_root_exists}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_shared
