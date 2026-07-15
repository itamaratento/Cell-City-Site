#!/bin/bash
# CELL CITY V3 — NOC Component Registry
# Registro central de todos os componentes do ecossistema V3.
# Detecta automaticamente engines, widgets, panels, services e plugins.
# Nenhum componente é hardcoded — tudo é descoberto e registrado dinamicamente.
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar core/registry.sh}"

declare -A _V3_REGISTRY

_v3_registry_register() {
  local type="$1" id="$2" path="$3" meta="${4:-}"
  [[ -z "$meta" ]] && meta='{}'
  local key="${type}:${id}"

  if [[ -n "${_V3_REGISTRY[$key]:-}" ]]; then
    _v3_log "warn" "Registry" "Componente já registrado: $key"
    return 1
  fi

  # meta é uma string JSON (não um arquivo) — extrai campos com jq via stdin
  local mver mdeps
  mver=$(echo "$meta" | jq -r '.version // "0.1.0"' 2>/dev/null) || mver="0.1.0"
  mdeps=$(echo "$meta" | jq -c '.dependencies // []' 2>/dev/null) || mdeps="[]"
  local entry
  entry=$(_v3_component_new "$id" "$type" "$mver" "$mdeps")
  entry=$(echo "$entry" | jq --arg p "$path" '. + {path: $p}')

  _V3_REGISTRY["$key"]="$entry"
  _v3_json_set "$_V3_REGISTRY_STATE" ".components.\"$key\"" "$entry"
  _v3_log "info" "Registry" "Registrado: $type::$id"

  _v3_event_pub "module.registered" "{\"type\":\"$type\",\"id\":\"$id\"}"

  return 0
}

_v3_registry_unregister() {
  local type="$1" id="$2"
  local key="${type}:${id}"

  if [[ -z "${_V3_REGISTRY[$key]:-}" ]]; then
    _v3_log "warn" "Registry" "Componente não encontrado: $key"
    return 1
  fi

  unset "_V3_REGISTRY[$key]"
  _v3_json_set "$_V3_REGISTRY_STATE" ".components.\"$key\"" "null"
  _v3_log "info" "Registry" "Removido: $type::$id"

  return 0
}

_v3_registry_get() {
  local type="$1" id="$2"
  local key="${type}:${id}"
  echo "${_V3_REGISTRY[$key]:-}"
}

_v3_registry_list() {
  local type="${1:-}"
  for key in "${!_V3_REGISTRY[@]}"; do
    if [[ -z "$type" ]] || [[ "$key" == "$type:"* ]]; then
      echo "  $key → $(echo "${_V3_REGISTRY[$key]}" | jq -r '.version // "?"')"
    fi
  done
}

_v3_registry_list_json() {
  local type="${1:-}"
  local result="["
  local first=true
  for key in "${!_V3_REGISTRY[@]}"; do
    if [[ -z "$type" ]] || [[ "$key" == "$type:"* ]]; then
      if $first; then first=false; else result+=","; fi
      result+="${_V3_REGISTRY[$key]}"
    fi
  done
  result+="]"
  echo "$result"
}

# shellcheck disable=SC2119,SC2120 # filtro por tipo é API opcional; nenhum caller hoje passa argumento, mantido para uso futuro
_v3_registry_count() {
  local type="${1:-}"
  local count=0
  for key in "${!_V3_REGISTRY[@]}"; do
    if [[ -z "$type" ]] || [[ "$key" == "$type:"* ]]; then
      ((count++))
    fi
  done
  echo "$count"
}

_v3_registry_discover_engines() {
  local dir="$1" count=0
  for engine_dir in "$dir"/*/; do
    [[ -d "$engine_dir" ]] || continue
    local engine_name
    engine_name=$(basename "$engine_dir")
    local engine_sh="$engine_dir/engine.sh"
    if [[ -f "$engine_sh" ]]; then
      _v3_registry_register "engine" "$engine_name" "$engine_dir" '{"version":"0.1.0","dependencies":[]}'
      ((count++))
    fi
  done
  _v3_log "info" "Registry" "Descobertos $count engines em $dir"
}

_v3_registry_discover_widgets() {
  local dir="$1" count=0
  for widget_file in "$dir"/*.sh; do
    [[ -f "$widget_file" ]] || continue
    local widget_name
    widget_name=$(basename "$widget_file" .sh)
    if [[ "$widget_name" != "base" ]]; then
      _v3_registry_register "widget" "$widget_name" "$widget_file" '{"version":"0.1.0"}'
      ((count++))
    fi
  done
  _v3_log "info" "Registry" "Descobertos $count widgets em $dir"
}

_v3_registry_discover_panels() {
  local dir="$1" count=0
  for panel_file in "$dir"/*.sh; do
    [[ -f "$panel_file" ]] || continue
    local panel_name
    panel_name=$(basename "$panel_file" .sh)
    if [[ "$panel_name" != "base" ]]; then
      _v3_registry_register "panel" "$panel_name" "$panel_file" '{"version":"0.1.0"}'
      ((count++))
    fi
  done
  _v3_log "info" "Registry" "Descobertos $count panels em $dir"
}

_v3_registry_discover_services() {
  local dir="$1" count=0
  for svc_file in "$dir"/*.sh; do
    [[ -f "$svc_file" ]] || continue
    local svc_name
    svc_name=$(basename "$svc_file" .sh)
    if [[ "$svc_name" != "base" ]]; then
      _v3_registry_register "service" "$svc_name" "$svc_file" '{"version":"0.1.0"}'
      ((count++))
    fi
  done
  _v3_log "info" "Registry" "Descobertos $count services em $dir"
}

_v3_registry_discover_all() {
  _v3_registry_discover_engines "$_V3_ENGINES_DIR"
  _v3_registry_discover_widgets "$_V3_WIDGETS_DIR"
  _v3_registry_discover_panels "$_V3_PANELS_DIR"
  _v3_registry_discover_services "$_V3_SERVICES_DIR"

  local total
  total=$(_v3_registry_count)
  _v3_log "info" "Registry" "Descoberta completa: $total componentes registrados"

  _v3_json_set "$_V3_REGISTRY_STATE" '.last_discovery' "\"$(_v3_timestamp)\""
  _v3_json_set "$_V3_REGISTRY_STATE" '.total_components' "$total"
}

_v3_registry_boot() {
  mkdir -p "$_V3_STATE_DIR"

  local init_state='{"components":{}, "last_discovery":null, "total_components":0}'
  if [[ ! -f "$_V3_REGISTRY_STATE" ]]; then
    echo "$init_state" > "$_V3_REGISTRY_STATE"
  fi

  _v3_log "info" "Registry" "Component Registry inicializado"
}
