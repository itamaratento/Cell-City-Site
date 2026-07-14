#!/bin/bash
# Health Engine — Checker: Logs
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_logs() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local logs_dir="${repo_dir}/logs"
  local release_logs="${logs_dir}/release"

  local logs_exists=false
  local recent_count=0
  local release_exists=false
  local release_count=0
  local has_rotation_pattern=false

  if [[ -d "$logs_dir" ]]; then
    logs_exists=true
    recent_count=$(find "$logs_dir" -maxdepth 2 -type f -mtime -30 2>/dev/null | wc -l)
    if [[ $recent_count -eq 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Nenhum log recente (últimos 30 dias) encontrado\"}")
      score=$((score - 15))
    fi
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"Diretório logs/ não encontrado\"}")
    score=$((score - 20))
  fi

  if [[ -d "$release_logs" ]]; then
    release_exists=true
    release_count=$(find "$release_logs" -maxdepth 1 -type f 2>/dev/null | wc -l)
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"Subdiretório logs/release não encontrado\"}")
    score=$((score - 10))
  fi

  local rotation_files
  rotation_files=$(find "$logs_dir" -maxdepth 2 -type f -name "*.log.*" -o -name "*.log-*" -o -name "*.[0-9]*.log" 2>/dev/null | wc -l)
  if [[ $rotation_files -gt 0 ]]; then
    has_rotation_pattern=true
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
  "checker": "logs",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "logs_dir_exists": ${logs_exists},
    "recent_log_files": ${recent_count},
    "release_logs_exists": ${release_exists},
    "release_log_files": ${release_count},
    "has_rotation_pattern": ${has_rotation_pattern}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_logs
