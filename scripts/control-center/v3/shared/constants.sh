#!/bin/bash
: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar shared/constants.sh}"

# Guarda de idempotência: constants.sh só define readonly — re-source (noc.sh
# carrega a pilha e kernel.sh a carrega de novo) geraria "variável somente leitura".
[[ -n "${_V3_CONSTANTS_LOADED:-}" ]] && return 0
_V3_CONSTANTS_LOADED=1

_V3_VERSION="$(<"$V3_ROOT/VERSION")"
readonly _V3_VERSION

_V3_CODENOME="NOC"
readonly _V3_CODENOME

readonly _V3_STATE_DIR="$V3_ROOT/state"
readonly _V3_CACHE_DIR="$V3_ROOT/cache"
readonly _V3_LOG_DIR="$V3_ROOT/logs"
readonly _V3_CONFIG_DIR="$V3_ROOT/config"
readonly _V3_ENGINES_DIR="$V3_ROOT/engines"
readonly _V3_WIDGETS_DIR="$V3_ROOT/widgets"
readonly _V3_PANELS_DIR="$V3_ROOT/panels"
readonly _V3_SERVICES_DIR="$V3_ROOT/services"
readonly _V3_SHARED_DIR="$V3_ROOT/shared"

readonly _V3_LOG_FILE="$_V3_LOG_DIR/noc.log"
readonly _V3_EVENT_LOG="$_V3_LOG_DIR/events.log"

readonly _V3_EVENT_BUS_STATE="$_V3_STATE_DIR/event-bus.json"
readonly _V3_REGISTRY_STATE="$_V3_STATE_DIR/registry.json"
readonly _V3_CACHE_INDEX="$_V3_STATE_DIR/cache-index.json"
readonly _V3_SESSION_STATE="$_V3_STATE_DIR/session.json"

_HEALTH_LEVELS=("CRITICO" "ATENCAO" "BOM" "EXCELENTE")
readonly _HEALTH_LEVELS

declare -A _V3_HEALTH_THRESHOLDS=(
  [CRITICO]=59
  [ATENCAO]=79
  [BOM]=94
  [EXCELENTE]=100
)
readonly _V3_HEALTH_THRESHOLDS

declare -A _V3_EVENT_PRIORITIES=(
  [P0]="critical"
  [P1]="high"
  [P2]="medium"
  [P3]="low"
  [P4]="info"
)
readonly _V3_EVENT_PRIORITIES
