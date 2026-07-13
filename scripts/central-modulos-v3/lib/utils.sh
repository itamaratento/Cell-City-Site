#!/bin/bash
# Central de Módulos V3 — Utilitários
set -uo pipefail

_cc_v3_log() {
  local level="$1"
  local component="$2"
  local message="$3"
  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  if [[ -t 1 ]]; then
    echo "[${timestamp}] [${level}] [${component}] ${message}"
  else
    echo "[${timestamp}] [${level}] [${component}] ${message}"
  fi
}
