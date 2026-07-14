#!/bin/bash
# Health Engine — Checker: Indexes
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_indexes() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local idx_root="${repo_dir}/firestore.indexes.json"
  local idx_crm="${repo_dir}/CRM/firestore.indexes.json"

  local root_exists=false
  local crm_exists=false
  local root_count=0
  local crm_count=0
  local duplicates=0

  if [[ -f "$idx_root" ]]; then
    root_exists=true
    root_count=$(python3 -c "import json; d=json.load(open('$idx_root')); print(len(d.get('indexes',[])))" 2>/dev/null || echo 0)
    if [[ $root_count -eq 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"firestore.indexes.json raiz está vazio ou sem indexes\"}")
      score=$((score - 10))
    fi
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"firestore.indexes.json raiz não encontrado\"}")
    score=$((score - 15))
  fi

  if [[ -f "$idx_crm" ]]; then
    crm_exists=true
    crm_count=$(python3 -c "import json; d=json.load(open('$idx_crm')); print(len(d.get('indexes',[])))" 2>/dev/null || echo 0)
    if [[ $crm_count -eq 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"CRM/firestore.indexes.json está vazio ou sem indexes\"}")
      score=$((score - 10))
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"CRM/firestore.indexes.json não encontrado\"}")
    score=$((score - 25))
  fi

  if [[ $root_exists == true && $crm_exists == true ]]; then
    duplicates=$(python3 -c "
import json
with open('$idx_root') as f: r=json.load(f)
with open('$idx_crm') as f: c=json.load(f)
ri={i.get('collectionGroup','')+'/'+i.get('fields','') for i in r.get('indexes',[])}
ci={i.get('collectionGroup','')+'/'+i.get('fields','') for i in c.get('indexes',[])}
print(len(ri & ci))
" 2>/dev/null || echo 0)
    if [[ $duplicates -gt 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"${duplicates} indexes duplicados entre raiz e CRM\"}")
      score=$((score - 10))
    fi
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
  "checker": "indexes",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "root_indexes_exists": ${root_exists},
    "crm_indexes_exists": ${crm_exists},
    "root_indexes_count": ${root_count},
    "crm_indexes_count": ${crm_count},
    "duplicate_indexes": ${duplicates}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_indexes
