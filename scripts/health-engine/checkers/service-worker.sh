#!/bin/bash
# Health Engine — Checker: Service Worker
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_service_worker() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local sw_crm="${repo_dir}/CRM/sw.js"
  local sw_root="${repo_dir}/sw.js"
  local manifest_crm="${repo_dir}/CRM/manifest.json"
  local manifest_root="${repo_dir}/manifest.json"

  local sw_crm_exists=false
  local sw_crm_nonempty=false
  local sw_root_exists=false
  local manifest_crm_exists=false
  local manifest_root_exists=false

  if [[ -f "$sw_crm" ]]; then
    sw_crm_exists=true
    if [[ -s "$sw_crm" ]]; then
      sw_crm_nonempty=true
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"CRM/sw.js não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ "$sw_crm_exists" == true && "$sw_crm_nonempty" == false ]]; then
    issues+=("{\"severity\":\"error\",\"message\":\"CRM/sw.js está vazio\"}")
    score=$((score - 20))
  fi

  if [[ -f "$sw_root" ]]; then
    sw_root_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"sw.js raiz não encontrado\"}")
    score=$((score - 10))
  fi

  if [[ -f "$manifest_crm" ]]; then
    manifest_crm_exists=true
    if [[ ! -s "$manifest_crm" ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"CRM/manifest.json está vazio\"}")
      score=$((score - 5))
    fi
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"CRM/manifest.json não encontrado\"}")
    score=$((score - 15))
  fi

  if [[ -f "$manifest_root" ]]; then
    manifest_root_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"manifest.json raiz não encontrado\"}")
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
  "checker": "service-worker",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "sw_crm_exists": ${sw_crm_exists},
    "sw_crm_nonempty": ${sw_crm_nonempty},
    "sw_root_exists": ${sw_root_exists},
    "manifest_crm_exists": ${manifest_crm_exists},
    "manifest_root_exists": ${manifest_root_exists}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_service_worker
