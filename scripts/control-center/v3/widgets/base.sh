#!/bin/bash
# CELL CITY V3 — NOC Widget System
# Base para todos os widgets do NOC.
# Cada widget implementa: render(), refresh(), get_data().
# Widgets são registrados automaticamente pelo Registry.
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar widgets/base.sh}"

declare -A _V3_WIDGET_DATA
declare -A _V3_WIDGET_LAST_REFRESH

_V3_WIDGET_MAX_WIDTH=56
readonly _V3_WIDGET_MAX_WIDTH

# As funções de moldura _v3_box_* não existiam em lugar nenhum (widgets
# quebravam ao renderizar). Delegam para as _cc_box_* da lib V1 quando
# disponíveis, com fallback ASCII simples.
if ! declare -f _v3_box_top >/dev/null 2>&1; then
  if declare -f _cc_box_top >/dev/null 2>&1; then
    _v3_box_top()         { _cc_box_top; }
    _v3_box_line()        { _cc_box_line "$@"; }
    _v3_box_line_center() { _cc_box_line_center "$@"; }
    _v3_box_sep()         { _cc_box_sep; }
    _v3_box_bottom()      { _cc_box_bottom; }
  else
    _v3_box_top()         { echo "+--------------------------------------------------+"; }
    _v3_box_line()        { echo "| ${1:-}"; }
    _v3_box_line_center() { echo "|        ${1:-}"; }
    _v3_box_sep()         { echo "+--------------------------------------------------+"; }
    _v3_box_bottom()      { echo "+--------------------------------------------------+"; }
  fi
fi

_v3_widget_register() {
  local id="$1" title="$2" refresh_fn="${3:-}" render_fn="${4:-}"

  local meta
  meta=$(_v3_widget_new "$id" "$title" "30" "")

  if [[ -n "$refresh_fn" ]]; then
    meta=$(echo "$meta" | jq --arg rf "$refresh_fn" '. + {refresh_fn: $rf}')
  fi
  if [[ -n "$render_fn" ]]; then
    meta=$(echo "$meta" | jq --arg rf "$render_fn" '. + {render_fn: $rf}')
  fi

  _v3_registry_register "widget" "$id" "$_V3_WIDGETS_DIR/${id}.sh" "$meta"
  _V3_WIDGET_DATA["$id"]="{}"
  _V3_WIDGET_LAST_REFRESH["$id"]=0
  _v3_log "info" "Widget" "Widget registrado: $id ($title)"
}

_v3_widget_refresh() {
  local id="$1"
  local entry
  entry=$(_v3_registry_get "widget" "$id")
  if [[ -z "$entry" ]]; then
    _v3_log "warn" "Widget" "Widget não encontrado: $id"
    return 1
  fi

  local refresh_fn
  refresh_fn=$(echo "$entry" | jq -r '.refresh_fn // ""')
  if [[ -z "$refresh_fn" ]]; then
    return 0
  fi

  if declare -f "$refresh_fn" >/dev/null 2>&1; then
    local data
    data=$("$refresh_fn" 2>/dev/null || echo "{}")
    _V3_WIDGET_DATA["$id"]="$data"
    _V3_WIDGET_LAST_REFRESH["$id"]=$(_v3_timestamp_epoch)
    _v3_log "debug" "Widget" "Widget '$id' refreshed"
    _v3_event_pub "widget.refreshed" "{\"id\":\"$id\"}"
    return 0
  else
    _v3_log "warn" "Widget" "Refresh function não encontrada: $refresh_fn"
    return 1
  fi
}

_v3_widget_refresh_all() {
  local entries
  entries=$(_v3_registry_list_json "widget")
  local count
  count=$(echo "$entries" | jq 'length')

  for (( i=0; i<count; i++ )); do
    local wid
    wid=$(echo "$entries" | jq -r ".[$i].id")
    _v3_widget_refresh "$wid"
  done
}

_v3_widget_render() {
  local id="$1" width="${2:-$_V3_WIDGET_MAX_WIDTH}"
  local entry
  entry=$(_v3_registry_get "widget" "$id")
  if [[ -z "$entry" ]]; then
    echo "Widget '$id' não encontrado."
    return 1
  fi

  local render_fn title
  render_fn=$(echo "$entry" | jq -r '.render_fn // ""')
  title=$(echo "$entry" | jq -r '.title // "'"$id"'"')

  _v3_box_top
  _v3_box_line_center "$title"
  _v3_box_sep

  if [[ -n "$render_fn" ]] && declare -f "$render_fn" >/dev/null 2>&1; then
    local wdata="${_V3_WIDGET_DATA[$id]:-}"
    [[ -z "$wdata" ]] && wdata='{}'
    "$render_fn" "$wdata" "$width"
  else
    _v3_box_line "Sem dados"
  fi

  _v3_box_bottom
}

_v3_widget_get_data() {
  local id="$1" query="${2:-.}"
  local data="${_V3_WIDGET_DATA[$id]:-}"
  [[ -z "$data" ]] && data='{}'
  echo "$data" | jq -r "$query" 2>/dev/null || echo ""
}

_v3_widget_is_stale() {
  local id="$1" max_age="${2:-30}"
  local last="${_V3_WIDGET_LAST_REFRESH[$id]:-0}"
  local now
  now=$(_v3_timestamp_epoch)
  [[ $((now - last)) -gt "$max_age" ]]
}

_v3_widget_card() {
  local id="$1" title="$2" value="$3" status="$4"
  local status_color=""
  status_color=$(_v3_colorize_status "${status:-}")

  _v3_box_top
  _v3_box_line_center "$title"
  _v3_box_sep
  _v3_box_line_center "$value"
  _v3_box_line_center "$status_color"
  _v3_box_bottom
}

_v3_widget_boot() {
  _v3_log "info" "Widget" "Widget System inicializado"
}
