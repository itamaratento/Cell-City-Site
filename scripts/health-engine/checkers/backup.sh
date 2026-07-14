#!/bin/bash
# Health Engine — Checker: Backup
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_backup() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local backup_dir="${repo_dir}/scripts/backup"
  local backup_manual="${backup_dir}/backup-manual.sh"
  local backup_auto="${backup_dir}/backup-automatic.sh"
  local backups_store="${repo_dir}/_BACKUPS"

  local backup_dir_exists=false
  local manual_exists=false
  local auto_exists=false
  local store_exists=false
  local store_count=0

  if [[ -d "$backup_dir" ]]; then
    backup_dir_exists=true
  else
    issues+=("{\"severity\":\"error\",\"message\":\"scripts/backup não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ -f "$backup_manual" ]]; then
    manual_exists=true
  else
    issues+=("{\"severity\":\"error\",\"message\":\"backup-manual.sh não encontrado\"}")
    score=$((score - 20))
  fi

  if [[ -f "$backup_auto" ]]; then
    auto_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"backup-automatic.sh não encontrado\"}")
    score=$((score - 15))
  fi

  if [[ -d "$backups_store" ]]; then
    store_exists=true
    store_count=$(find "$backups_store" -maxdepth 1 -type d 2>/dev/null | wc -l)
    if [[ $store_count -lt 3 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Poucos diretórios de backup em _BACKUPS: ${store_count}\"}")
      score=$((score - 10))
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"Diretório _BACKUPS não encontrado\"}")
    score=$((score - 25))
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
  "checker": "backup",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "backup_dir_exists": ${backup_dir_exists},
    "backup_manual_exists": ${manual_exists},
    "backup_automatic_exists": ${auto_exists},
    "backups_store_exists": ${store_exists},
    "backup_directories_count": ${store_count}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_backup
