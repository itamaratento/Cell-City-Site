#!/bin/bash
# Health Engine — Checker: Control Center
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_control_center() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local cc_dir="${repo_dir}/scripts/control-center"
  local cc_core_menu="${cc_dir}/core/menu.sh"
  local cc_config="${cc_dir}/config/modules.conf"
  local cc_modules_dir="${cc_dir}/modules"

  local cc_exists=false
  local menu_exists=false
  local config_exists=false
  local modules_exists=false
  local module_count=0

  if [[ -d "$cc_dir" ]]; then
    cc_exists=true
  else
    issues+=("{\"severity\":\"error\",\"message\":\"scripts/control-center não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ -f "$cc_core_menu" ]]; then
    menu_exists=true
  else
    issues+=("{\"severity\":\"error\",\"message\":\"core/menu.sh não encontrado no control-center\"}")
    score=$((score - 20))
  fi

  if [[ -f "$cc_config" ]]; then
    config_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"config/modules.conf não encontrado no control-center\"}")
    score=$((score - 10))
  fi

  if [[ -d "$cc_modules_dir" ]]; then
    modules_exists=true
    module_count=$(find "$cc_modules_dir" -maxdepth 2 -type f 2>/dev/null | wc -l)
    if [[ $module_count -lt 1 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Nenhum módulo encontrado em control-center/modules\"}")
      score=$((score - 10))
    fi
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"control-center/modules não encontrado\"}")
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
  "checker": "control-center",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "control_center_exists": ${cc_exists},
    "core_menu_sh_exists": ${menu_exists},
    "config_modules_conf_exists": ${config_exists},
    "modules_dir_exists": ${modules_exists},
    "module_count": ${module_count}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_control_center
