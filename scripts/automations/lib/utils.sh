#!/bin/bash
# Automations — Utilitários
set -uo pipefail

_cc_v3_log() {
  local level="$1"
  local component="$2"
  local message="$3"
  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  local color=""
  case "$level" in
    error|critical) color="\033[0;31m" ;;
    warn)           color="\033[0;33m" ;;
    info)           color="\033[0;32m" ;;
    debug)          color="\033[0;36m" ;;
  esac

  if [[ -t 1 ]]; then
    echo -e "${color}[${timestamp}] [${level}] [${component}] ${message}\033[0m"
  else
    echo "[${timestamp}] [${level}] [${component}] ${message}"
  fi

  local log_file="${CC_V3_LOGS:-/dev/null}/automations.log"
  if [[ -d "$(dirname "$log_file" 2>/dev/null)" ]]; then
    echo "[${timestamp}] [${level}] [${component}] ${message}" >> "$log_file"
  fi
}

_cc_v3_autom_timestamp() {
  date +"%Y-%m-%dT%H:%M:%S%:z"
}

_cc_v3_autom_salvar_status() {
  local task="$1"
  local status="$2"
  local detalhes="${3:-}"

  local status_file="$AUT_DIR/state/automation-status.json"
  local timestamp
  timestamp=$(_cc_v3_autom_timestamp)

  cat <<EOF > "$status_file"
{
  "ultima_tarefa": "${task}",
  "status": "${status}",
  "timestamp": "${timestamp}",
  "detalhes": "${detalhes}"
}
EOF
}
