#!/bin/bash
# CELL CITY V3 — NOC Event Bus
# Sistema pub/sub desacoplado para comunicação entre componentes.
# Nenhum componente conhece outro diretamente — toda comunicação passa pelo barramento.
# Uso:
#   _v3_event_sub "health.score.changed" "_my_handler"
#   _v3_event_pub "health.score.changed" '{"score":85,"level":"BOM"}'
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar core/event-bus.sh}"

declare -A _V3_EVENT_SUBSCRIBERS

_v3_event_trim_log() {
  local max="${_V3_EVENT_MAX_EVENTS:-1000}"
  [[ -f "$_V3_EVENT_LOG" ]] || return 0
  local count
  count=$(jq '.events | length' "$_V3_EVENT_LOG" 2>/dev/null) || return 0
  if [[ "$count" -gt "$max" ]]; then
    local tmp
    tmp=$(jq --argjson max "$max" '.events |= .[-$max:]' "$_V3_EVENT_LOG" 2>/dev/null) \
      && echo "$tmp" > "$_V3_EVENT_LOG"
  fi
}

_v3_event_sub() {
  local event="$1" handler="$2"
  if [[ -z "${_V3_EVENT_SUBSCRIBERS[$event]:-}" ]]; then
    _V3_EVENT_SUBSCRIBERS["$event"]="$handler"
  else
    _V3_EVENT_SUBSCRIBERS["$event"]="${_V3_EVENT_SUBSCRIBERS[$event]}|$handler"
  fi
  _v3_log "debug" "EventBus" "Subscribed: $event → $handler"
}

_v3_event_unsub() {
  local event="$1" handler="$2"
  local current="${_V3_EVENT_SUBSCRIBERS[$event]:-}"
  if [[ -n "$current" ]]; then
    local new_list=""
    IFS='|' read -ra handlers <<< "$current"
    for h in "${handlers[@]}"; do
      [[ "$h" != "$handler" ]] && new_list="${new_list:+$new_list|}$h"
    done
    _V3_EVENT_SUBSCRIBERS["$event"]="$new_list"
  fi
}

_v3_event_pub() {
  local event="$1" data="${2:-}"
  [[ -z "$data" ]] && data='{}'
  local envelope
  envelope=$(_v3_event_new "event-bus" "$event" "P3" "$data")

  _v3_json_append "$_V3_EVENT_LOG" '.events' "$envelope"
  _v3_event_trim_log
  _v3_log "debug" "EventBus" "Published: $event"

  local current="${_V3_EVENT_SUBSCRIBERS[$event]:-}"
  if [[ -z "$current" ]]; then
    return 0
  fi

  IFS='|' read -ra handlers <<< "$current"
  for handler in "${handlers[@]}"; do
    if declare -f "$handler" >/dev/null 2>&1; then
      _v3_log "debug" "EventBus" "Dispatching: $event → $handler"
      "$handler" "$event" "$data" &
    else
      _v3_log "warn" "EventBus" "Handler não encontrado: $handler"
    fi
  done
  wait
}

_v3_event_pub_sync() {
  local event="$1" data="${2:-}"
  [[ -z "$data" ]] && data='{}'
  local envelope
  envelope=$(_v3_event_new "event-bus" "$event" "P3" "$data")

  _v3_json_append "$_V3_EVENT_LOG" '.events' "$envelope"
  _v3_event_trim_log
  _v3_log "debug" "EventBus" "Published (sync): $event"

  local current="${_V3_EVENT_SUBSCRIBERS[$event]:-}"
  if [[ -z "$current" ]]; then
    return 0
  fi

  IFS='|' read -ra handlers <<< "$current"
  for handler in "${handlers[@]}"; do
    if declare -f "$handler" >/dev/null 2>&1; then
      _v3_log "debug" "EventBus" "Dispatching sync: $event → $handler"
      "$handler" "$event" "$data"
    fi
  done
}

_v3_event_list_subscribers() {
  for event in "${!_V3_EVENT_SUBSCRIBERS[@]}"; do
    echo "  $event → ${_V3_EVENT_SUBSCRIBERS[$event]}"
  done
}

_v3_event_history() {
  local limit="${1:-20}"
  if [[ -f "$_V3_EVENT_LOG" ]]; then
    jq -r --argjson lim "$limit" '.events[-$lim:] | .[] | "[\(.timestamp)] [\(.priority)] \(.type) ← \(.source)"' "$_V3_EVENT_LOG" 2>/dev/null
  else
    echo "Nenhum evento registrado."
  fi
}

_v3_event_clear_history() {
  rm -f "$_V3_EVENT_LOG"
  _v3_log "info" "EventBus" "Histórico de eventos limpo"
}

_V3_EVENTS_STANDARD=(
  "system.boot"
  "system.shutdown"
  "system.error"
  "health.check.completed"
  "health.score.changed"
  "health.alert.triggered"
  "mission.started"
  "mission.completed"
  "mission.failed"
  "mission.checkpoint"
  "diagnostic.started"
  "diagnostic.completed"
  "diagnostic.failure.detected"
  "backup.started"
  "backup.completed"
  "backup.failed"
  "release.started"
  "release.completed"
  "release.rollback"
  "deploy.completed"
  "config.changed"
  "module.registered"
  "module.activated"
  "module.deactivated"
  "widget.refreshed"
  "panel.rendered"
  "cache.invalidated"
  "security.alert"
  "rbac.violation"
)

_v3_event_boot() {
  mkdir -p "$_V3_STATE_DIR" "$_V3_LOG_DIR"

  local init_state='{"subscriptions":{}, "event_count":0, "boot_time":null}'
  if [[ ! -f "$_V3_EVENT_BUS_STATE" ]]; then
    echo "$init_state" > "$_V3_EVENT_BUS_STATE"
  fi

  if [[ ! -f "$_V3_EVENT_LOG" ]]; then
    echo '{"events":[]}' > "$_V3_EVENT_LOG"
  fi

  _v3_json_set "$_V3_EVENT_BUS_STATE" '.boot_time' "\"$(_v3_timestamp)\""
  _v3_log "info" "EventBus" "Event Bus inicializado com ${#_V3_EVENTS_STANDARD[@]} eventos padrão"
  _v3_event_pub "system.boot" "{\"version\":\"$_V3_VERSION\"}"
}
