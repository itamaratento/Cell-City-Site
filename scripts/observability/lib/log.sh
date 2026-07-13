#!/bin/bash
# Observability — Funções de log
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

  local log_file="${CC_V3_LOGS:-/dev/null}/observability.log"
  if [[ -d "$(dirname "$log_file" 2>/dev/null)" ]]; then
    echo "[${timestamp}] [${level}] [${component}] ${message}" >> "$log_file"
  fi
}
