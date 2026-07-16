#!/bin/bash
# Observability — Funções de log
set -uo pipefail

_cc_v3_log() {
  local level="$1" component="$2" message="$3"
  local log_file="${CC_V3_LOGS:-/dev/null}/observability.log"
  local ts; ts=$(date '+%Y-%m-%dT%H:%M:%S%:z')
  local color="" reset="\033[0m"
  case "$level" in
    error|critical) color="\033[0;31m" ;; warn) color="\033[0;33m" ;;
    info)           color="\033[0;32m" ;; debug) color="\033[0;36m" ;;
  esac
  if [[ -t 1 ]]; then echo -e "${color}[${ts}] [${level}] [${component}] ${message}${reset}"
  else echo "[${ts}] [${level}] [${component}] ${message}"; fi
  if [[ -d "$(dirname "$log_file" 2>/dev/null)" ]]; then
    echo "[${ts}] [${level}] [${component}] ${message}" >> "$log_file"
  fi
  declare -f _v3_log >/dev/null 2>&1 && _v3_log "$level" "$component" "$message" 2>/dev/null || :
}
