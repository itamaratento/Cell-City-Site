#!/bin/bash
: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar shared/types.sh}"

_v3_event_new() {
  # Default de "{}" em 2 passos: "${4:-{}}" no bash fecha a expansão no 1º "}"
  # e anexa o 2º como literal, corrompendo o JSON com um "}" extra.
  local source="$1" type="$2" priority="${3:-P3}" data="${4:-}"
  [[ -z "$data" ]] && data='{}'
  jq -n \
    --arg src "$source" \
    --arg type "$type" \
    --arg pri "$priority" \
    --arg ts "$(_v3_timestamp)" \
    --argjson data "$data" \
    '{source: $src, type: $type, priority: $pri, timestamp: $ts, data: $data}'
}

_v3_component_new() {
  local id="$1" type="$2" version="${3:-0.1.0}" deps="${4:-[]}"
  jq -n \
    --arg id "$id" \
    --arg type "$type" \
    --arg ver "$version" \
    --argjson deps "$deps" \
    --arg ts "$(_v3_timestamp)" \
    '{id: $id, type: $type, version: $ver, dependencies: $deps, registered_at: $ts, status: "registered"}'
}

_v3_widget_new() {
  local id="$1" title="$2" refresh="${3:-30}" source="${4:-}"
  jq -n \
    --arg id "$id" \
    --arg title "$title" \
    --argjson refresh "$refresh" \
    --arg source "$source" \
    '{id: $id, title: $title, refresh_interval: $refresh, data_source: $source, last_update: null, data: {}}'
}

_v3_panel_new() {
  local id="$1" title="$2" layout="${3:-grid}" widgets="${4:-[]}"
  jq -n \
    --arg id "$id" \
    --arg title "$title" \
    --arg layout "$layout" \
    --argjson widgets "$widgets" \
    '{id: $id, title: $title, layout: $layout, widgets: $widgets}'
}

_v3_mission_new() {
  local id="$1" name="$2" blocks="${3:-[]}"
  jq -n \
    --arg id "$id" \
    --arg name "$name" \
    --argjson blocks "$blocks" \
    --arg ts "$(_v3_timestamp)" \
    '{id: $id, name: $name, blocks: $blocks, created_at: $ts, status: "pending"}'
}

_v3_checkpoint_new() {
  local mission_id="$1" block="${2:-0}" step="${3:-0}" percent="${4:-0}"
  jq -n \
    --arg mid "$mission_id" \
    --argjson blk "$block" \
    --argjson stp "$step" \
    --argjson pct "$percent" \
    --arg ts "$(_v3_timestamp)" \
    --arg status "executando" \
    '{mission_id: $mid, block_atual: $blk, passo_atual: $stp, percentual: $pct, timestamp: $ts, status: $status, historico: []}'
}
