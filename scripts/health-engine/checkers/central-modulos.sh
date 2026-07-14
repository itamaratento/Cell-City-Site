#!/bin/bash
# Health Engine — Checker: Central Modulos
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_central_modulos() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local cm_dir="${repo_dir}/scripts/central-modulos"
  local cm3_dir="${repo_dir}/scripts/central-modulos-v3"
  local cm3_center="${cm3_dir}/module-center.sh"

  local cm_exists=false
  local cm3_exists=false
  local cm3_center_exists=false
  local cm_files=0
  local cm3_files=0

  if [[ -d "$cm_dir" ]]; then
    cm_exists=true
    cm_files=$(find "$cm_dir" -maxdepth 2 -type f 2>/dev/null | wc -l)
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"scripts/central-modulos não encontrado\"}")
    score=$((score - 15))
  fi

  if [[ -d "$cm3_dir" ]]; then
    cm3_exists=true
    cm3_files=$(find "$cm3_dir" -maxdepth 2 -type f 2>/dev/null | wc -l)
  else
    issues+=("{\"severity\":\"error\",\"message\":\"scripts/central-modulos-v3 não encontrado\"}")
    score=$((score - 25))
  fi

  if [[ -f "$cm3_center" ]]; then
    cm3_center_exists=true
  else
    issues+=("{\"severity\":\"error\",\"message\":\"module-center.sh não encontrado em central-modulos-v3\"}")
    score=$((score - 20))
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
  "checker": "central-modulos",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "central_modulos_exists": ${cm_exists},
    "central_modulos_v3_exists": ${cm3_exists},
    "module_center_sh_exists": ${cm3_center_exists},
    "central_modulos_files": ${cm_files},
    "central_modulos_v3_files": ${cm3_files}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_central_modulos
