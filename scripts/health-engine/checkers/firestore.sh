#!/bin/bash
# Health Engine — Checker: Firestore
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_firestore() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()
  local details=""

  local fs_rules="${repo_dir}/CRM/firestore.rules"
  local fs_rules_root="${repo_dir}/firestore.rules"
  local fs_indexes="${repo_dir}/CRM/firestore.indexes.json"
  local fs_indexes_root="${repo_dir}/firestore.indexes.json"

  local crm_rules_exists=false
  local root_rules_exists=false
  local match_count=0
  local allow_if_true=0
  local crm_indexes_exists=false

  if [[ -f "$fs_rules" ]]; then
    crm_rules_exists=true
    match_count=$(grep -c "match " "$fs_rules" 2>/dev/null || true)
    allow_if_true=$(grep -c "allow.*:.*if true" "$fs_rules" 2>/dev/null || true)
  else
    issues+=("{\"severity\":\"error\",\"message\":\"CRM/firestore.rules não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ -f "$fs_rules_root" ]]; then
    root_rules_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"firestore.rules raiz não encontrado\"}")
    score=$((score - 10))
  fi

  if [[ $allow_if_true -gt 0 ]]; then
    issues+=("{\"severity\":\"error\",\"message\":\"Encontrados ${allow_if_true} padrões 'allow ...: if true' nas regras\"}")
    score=$((score - 25))
  fi

  if [[ -f "$fs_indexes" ]]; then
    crm_indexes_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"CRM/firestore.indexes.json não encontrado\"}")
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
  "checker": "firestore",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "crm_firestore_rules_exists": ${crm_rules_exists},
    "root_firestore_rules_exists": ${root_rules_exists},
    "match_blocks_count": ${match_count},
    "allow_if_true_patterns": ${allow_if_true},
    "crm_firestore_indexes_exists": ${crm_indexes_exists}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_firestore
