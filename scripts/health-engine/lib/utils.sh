#!/bin/bash
# Health Engine — Utilitários compartilhados
set -uo pipefail

_cc_v3_log() {
  local level="$1" component="$2" message="$3"
  local log_file="${CC_V3_LOGS:-/dev/null}/health-engine.log"
  local ts; ts=$(date '+%Y-%m-%dT%H:%M:%S%:z')
  local color="" reset="\033[0m"
  case "$level" in
    error|critical) color="\033[0;31m" ;; warn) color="\033[0;33m" ;;
    info)           color="\033[0;32m" ;; debug) color="\033[0;36m" ;;
  esac

  if [[ -t 1 ]]; then
    echo -e "${color}[${ts}] [${level}] [${component}] ${message}${reset}"
  else
    echo "[${ts}] [${level}] [${component}] ${message}"
  fi

  if [[ -d "$(dirname "$log_file" 2>/dev/null)" ]]; then
    echo "[${ts}] [${level}] [${component}] ${message}" >> "$log_file"
  fi
  # P2.5: quando logger.sh do V3 estiver disponível, log também centralizado
  if declare -f _v3_log >/dev/null 2>&1; then
    _v3_log "$level" "$component" "$message" 2>/dev/null || :
  fi
}

_cc_v3_check_deps() {
  local cmds=("$@")
  local missing=()
  for cmd in "${cmds[@]}"; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    _cc_v3_log "error" "Health Engine" "Dependências faltando: ${missing[*]}"
    return 1
  fi
  return 0
}

_cc_v3_check_file() {
  local path="$1"
  if [[ ! -e "$path" ]]; then
    _cc_v3_log "debug" "Health Engine" "Arquivo não encontrado: $path"
    return 1
  fi
  return 0
}

_cc_v3_json_result() {
  local checker="$1"
  local status="$2"
  local score="$3"
  echo "{\"checker\":\"${checker}\",\"status\":\"${status}\",\"score\":${score}}"
}
