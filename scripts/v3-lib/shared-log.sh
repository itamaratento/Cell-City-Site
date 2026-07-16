#!/bin/bash
# V3 — Shared Logger Wrapper (P2.5 2026-07-16)
# Substitui as 7 definições duplicadas de _cc_v3_log nos engines.
# Fonte única: delega para logger.sh do NOC V3 ou fallback básico.
set -uo pipefail

# Guarda idempotente
[[ -n "${_CC_V3_LOG_LOADED:-}" ]] && return 0
_CC_V3_LOG_LOADED=1

_cc_v3_log() {
  local level="$1" component="$2" message="$3"
  if declare -f _v3_log >/dev/null 2>&1; then
    _v3_log "$level" "$component" "$message"
  else
    # Fallback: timestamp + nível + componente (sem logger.sh carregado)
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$ts] [$level] [$component] $message" >&2
  fi
}
