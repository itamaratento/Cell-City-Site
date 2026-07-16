#!/bin/bash
# Central de Módulos V3 — Utilitários
set -uo pipefail

_cc_v3_log() {
  local level="$1" component="$2" message="$3"
  local ts; ts=$(date '+%Y-%m-%dT%H:%M:%S%:z')
  echo "[${ts}] [${level}] [${component}] ${message}"
  declare -f _v3_log >/dev/null 2>&1 && _v3_log "$level" "$component" "$message" 2>/dev/null || :
}
