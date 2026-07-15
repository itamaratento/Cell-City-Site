#!/bin/bash
# CELL CITY V3 — NOC Cache Engine
# Cache em memória e em disco para evitar chamadas repetitivas.
# Suporta TTL, invalidação e métricas de hit/miss.
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar cache/engine.sh}"

declare -A _V3_CACHE
declare -A _V3_CACHE_TTL

_V3_CACHE_HITS=0
_V3_CACHE_MISSES=0

_v3_cache_set() {
  local key="$1" value="$2" ttl_seconds="${3:-${_V3_CACHE_DEFAULT_TTL:-60}}"
  _V3_CACHE["$key"]="$value"
  _V3_CACHE_TTL["$key"]=$(( $(_v3_timestamp_epoch) + ttl_seconds ))
}

_v3_cache_get() {
  local key="$1"
  local now ttl

  if [[ -z "${_V3_CACHE[$key]:-}" ]]; then
    ((_V3_CACHE_MISSES++))
    return 1
  fi

  now=$(_v3_timestamp_epoch)
  ttl="${_V3_CACHE_TTL[$key]:-0}"

  if [[ "$now" -gt "$ttl" ]]; then
    _v3_cache_delete "$key"
    ((_V3_CACHE_MISSES++))
    return 1
  fi

  ((_V3_CACHE_HITS++))
  echo "${_V3_CACHE[$key]}"
  return 0
}

_v3_cache_get_or_set() {
  local key="$1" ttl="${2:-${_V3_CACHE_DEFAULT_TTL:-60}}"
  shift 2
  local command=("$@")

  local cached
  if cached=$(_v3_cache_get "$key"); then
    echo "$cached"
    return 0
  fi

  local result
  result=$("${command[@]}" 2>/dev/null)
  _v3_cache_set "$key" "$result" "$ttl"
  echo "$result"
}

_v3_cache_delete() {
  local key="$1"
  unset "_V3_CACHE[$key]"
  unset "_V3_CACHE_TTL[$key]"
}

_v3_cache_invalidate() {
  local pattern="$1"
  for key in "${!_V3_CACHE[@]}"; do
    if [[ -z "$pattern" ]] || [[ "$key" == *"$pattern"* ]]; then
      unset "_V3_CACHE[$key]"
      unset "_V3_CACHE_TTL[$key]"
    fi
  done
  _v3_log "debug" "Cache" "Cache invalidado (pattern: ${pattern:-*})"
  _v3_event_pub "cache.invalidated" "{\"pattern\":\"${pattern:-*}\"}"
}

_v3_cache_clear() {
  _V3_CACHE=()
  _V3_CACHE_TTL=()
  _V3_CACHE_HITS=0
  _V3_CACHE_MISSES=0
  _v3_log "info" "Cache" "Cache completamente limpo"
}

_v3_cache_persist() {
  local file="$_V3_CACHE_INDEX"
  mkdir -p "$_V3_STATE_DIR"

  local json='{'
  local first=true
  for key in "${!_V3_CACHE[@]}"; do
    if $first; then first=false; else json+=','; fi
    json+="\"$key\":{\"value\":\"${_V3_CACHE[$key]}\",\"ttl\":${_V3_CACHE_TTL[$key]:-0}}"
  done
  json+='}'
  echo "$json" > "$file"
}

_v3_cache_restore() {
  local file="$_V3_CACHE_INDEX"
  if [[ -f "$file" ]]; then
    local keys
    keys=$(jq -r 'keys[]' "$file" 2>/dev/null)
    for key in $keys; do
      local value ttl
      value=$(jq -r ".\"$key\".value // empty" "$file")
      ttl=$(jq -r ".\"$key\".ttl // 60" "$file")
      if [[ -n "$value" ]]; then
        _V3_CACHE["$key"]="$value"
        _V3_CACHE_TTL["$key"]="$ttl"
      fi
    done
  fi
}

_v3_cache_stats() {
  local total=$((_V3_CACHE_HITS + _V3_CACHE_MISSES))
  local hit_rate=0
  if [[ "$total" -gt 0 ]]; then
    hit_rate=$(( _V3_CACHE_HITS * 100 / total ))
  fi

  echo "╔══════════════════════════════════════════╗"
  echo "║  CACHE STATS                              ║"
  echo "╠══════════════════════════════════════════╣"
  local ccount=0; for _k in "${!_V3_CACHE[@]:-}"; do ((ccount++)); done
  echo "║  Entradas : $ccount"
  echo "║  Hits     : $_V3_CACHE_HITS"
  echo "║  Misses   : $_V3_CACHE_MISSES"
  echo "║  Hit Rate : ${hit_rate}%"
  echo "╚══════════════════════════════════════════╝"
}

_v3_cache_boot() {
  mkdir -p "$_V3_CACHE_DIR" "$_V3_STATE_DIR"
  _v3_cache_restore
  local count=0
  for _k in "${!_V3_CACHE[@]:-}"; do ((count++)); done
  _v3_log "info" "Cache" "Cache inicializado ($count entradas restauradas)"
}
