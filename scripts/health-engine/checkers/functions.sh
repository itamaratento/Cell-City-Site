#!/bin/bash
# Health Engine — Checker: Functions
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_functions() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local func_index="${repo_dir}/functions/index.js"
  local func_pkg="${repo_dir}/functions/package.json"
  local func_dir="${repo_dir}/functions"

  local index_exists=false
  local pkg_exists=false
  local func_count=0
  local node_modules_exists=false
  local has_name=false
  local has_deps=false

  if [[ -f "$func_index" ]]; then
    index_exists=true
    func_count=$(grep -c "exports\." "$func_index" 2>/dev/null || true)
    if [[ $func_count -eq 0 ]]; then
      func_count=$(grep -c "module\.exports" "$func_index" 2>/dev/null || true)
    fi
    if [[ $func_count -eq 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Nenhuma função exportada encontrada em functions/index.js\"}")
      score=$((score - 15))
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"functions/index.js não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ -f "$func_pkg" ]]; then
    pkg_exists=true
    has_name=$(grep -c "\"name\"" "$func_pkg" 2>/dev/null || true)
    has_deps=$(grep -c "\"dependencies\"" "$func_pkg" 2>/dev/null || true)
    if [[ $has_name -eq 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"functions/package.json sem campo name\"}")
      score=$((score - 5))
    fi
    if [[ $has_deps -eq 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"functions/package.json sem dependencies\"}")
      score=$((score - 5))
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"functions/package.json não encontrado\"}")
    score=$((score - 20))
  fi

  if [[ -d "${func_dir}/node_modules" ]]; then
    node_modules_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"functions/node_modules não encontrado (npm install?)\"}")
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
  "checker": "functions",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "index_exists": ${index_exists},
    "package_json_exists": ${pkg_exists},
    "exported_functions_count": ${func_count},
    "node_modules_exists": ${node_modules_exists}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_functions
