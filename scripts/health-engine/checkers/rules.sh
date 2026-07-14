#!/bin/bash
# Health Engine — Checker: Rules
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_rules() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local fs_rules="${repo_dir}/firestore.rules"
  local crm_fs_rules="${repo_dir}/CRM/firestore.rules"
  local storage_rules="${repo_dir}/storage.rules"

  local fs_exists=false
  local crm_fs_exists=false
  local storage_exists=false
  local fs_match_count=0
  local storage_match_count=0
  local fs_allow_count=0
  local storage_allow_count=0

  if [[ -f "$fs_rules" ]]; then
    fs_exists=true
    fs_match_count=$(grep -c "match " "$fs_rules" 2>/dev/null || true)
    fs_allow_count=$(grep -c "allow " "$fs_rules" 2>/dev/null || true)
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"firestore.rules raiz não encontrado\"}")
    score=$((score - 15))
  fi

  if [[ -f "$crm_fs_rules" ]]; then
    crm_fs_exists=true
    local crm_match
    crm_match=$(grep -c "match " "$crm_fs_rules" 2>/dev/null || true)
    if [[ $crm_match -eq 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"CRM/firestore.rules não contém blocos match\"}")
      score=$((score - 10))
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"CRM/firestore.rules não encontrado\"}")
    score=$((score - 25))
  fi

  if [[ -f "$storage_rules" ]]; then
    storage_exists=true
    storage_match_count=$(grep -c "match " "$storage_rules" 2>/dev/null || true)
    storage_allow_count=$(grep -c "allow " "$storage_rules" 2>/dev/null || true)
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"storage.rules não encontrado\"}")
    score=$((score - 15))
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
  "checker": "rules",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "firestore_rules_root_exists": ${fs_exists},
    "firestore_rules_crm_exists": ${crm_fs_exists},
    "storage_rules_exists": ${storage_exists},
    "firestore_match_blocks": ${fs_match_count},
    "firestore_allow_statements": ${fs_allow_count},
    "storage_match_blocks": ${storage_match_count},
    "storage_allow_statements": ${storage_allow_count}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_rules
