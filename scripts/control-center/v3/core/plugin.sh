#!/bin/bash
# CELL CITY V3 — NOC Plugin System
# Sistema de plugins hot-pluggable.
# Extende o Plugin Loader da V1 com suporte a hooks, ciclo de vida e prioridades.
# Compatível com plugins/ existentes — nenhum plugin V1 é quebrado.
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar core/plugin.sh}"

declare -A _V3_PLUGINS
declare -A _V3_PLUGIN_HOOKS

_V3_PLUGIN_LIFECYCLE=("on_install" "on_load" "on_activate" "on_deactivate" "on_uninstall")

_v3_plugin_register() {
  local id="$1" version="${2:-0.1.0}" path="${3:-}" hooks="${4:-}"
  [[ -z "$hooks" ]] && hooks='{}'
  local entry
  entry=$(jq -n \
    --arg id "$id" \
    --arg ver "$version" \
    --arg path "$path" \
    --arg ts "$(_v3_timestamp)" \
    --argjson hooks "$hooks" \
    '{id: $id, version: $ver, path: $path, registered_at: $ts, status: "registered", hooks: $hooks}')

  _V3_PLUGINS["$id"]="$entry"
  _v3_registry_register "plugin" "$id" "$path" "{\"version\":\"$version\"}"
  _v3_log "info" "Plugin" "Plugin registrado: $id v$version"
}

_v3_plugin_load() {
  local id="$1"
  local entry="${_V3_PLUGINS[$id]:-}"

  if [[ -z "$entry" ]]; then
    _v3_log "error" "Plugin" "Plugin não registrado: $id"
    return 1
  fi

  local path
  path=$(echo "$entry" | jq -r '.path // ""')
  if [[ -z "$path" ]] || [[ ! -f "$path" ]]; then
    _v3_log "error" "Plugin" "Arquivo do plugin não encontrado: $path"
    return 1
  fi

  # shellcheck disable=SC1090
  source "$path" 2>/dev/null || {
    _v3_log "error" "Plugin" "Erro ao carregar: $path"
    return 1
  }

  _V3_PLUGINS["$id"]=$(echo "$entry" | jq '.status = "loaded"')
  _v3_plugin_hook_call "$id" "on_load"

  _v3_log "info" "Plugin" "Plugin carregado: $id"
  return 0
}

_v3_plugin_activate() {
  local id="$1"
  local entry="${_V3_PLUGINS[$id]:-}"

  if [[ -z "$entry" ]]; then
    _v3_log "error" "Plugin" "Plugin não encontrado: $id"
    return 1
  fi

  _v3_plugin_hook_call "$id" "on_activate"
  _V3_PLUGINS["$id"]=$(echo "$entry" | jq '.status = "active"')
  _v3_event_pub "module.activated" "{\"type\":\"plugin\",\"id\":\"$id\"}"
  _v3_log "info" "Plugin" "Plugin ativado: $id"
}

_v3_plugin_deactivate() {
  local id="$1"
  local entry="${_V3_PLUGINS[$id]:-}"

  if [[ -z "$entry" ]]; then
    _v3_log "error" "Plugin" "Plugin não encontrado: $id"
    return 1
  fi

  _v3_plugin_hook_call "$id" "on_deactivate"
  _V3_PLUGINS["$id"]=$(echo "$entry" | jq '.status = "inactive"')
  _v3_event_pub "module.deactivated" "{\"type\":\"plugin\",\"id\":\"$id\"}"
  _v3_log "info" "Plugin" "Plugin desativado: $id"
}

_v3_plugin_hook_register() {
  local plugin_id="$1" hook="$2" handler="$3"

  local key="${plugin_id}:${hook}"
  if [[ -z "${_V3_PLUGIN_HOOKS[$key]:-}" ]]; then
    _V3_PLUGIN_HOOKS["$key"]="$handler"
  else
    _V3_PLUGIN_HOOKS["$key"]="${_V3_PLUGIN_HOOKS[$key]}|$handler"
  fi
}

_v3_plugin_hook_call() {
  local plugin_id="$1" hook="$2"
  local key="${plugin_id}:${hook}"
  local handlers="${_V3_PLUGIN_HOOKS[$key]:-}"

  if [[ -z "$handlers" ]]; then
    return 0
  fi

  IFS='|' read -ra hlist <<< "$handlers"
  for handler in "${hlist[@]}"; do
    if declare -f "$handler" >/dev/null 2>&1; then
      _v3_log "debug" "Plugin" "Hook: $plugin_id::$hook → $handler"
      "$handler" || _v3_log "warn" "Plugin" "Hook falhou: $handler"
    fi
  done
}

_v3_plugin_discover() {
  local dir="$1"
  local count=0
  for plugin_dir in "$dir"/*/; do
    [[ -d "$plugin_dir" ]] || continue
    local plugin_id
    plugin_id=$(basename "$plugin_dir")
    local plugin_sh="$plugin_dir/plugin.sh"

    if [[ -f "$plugin_sh" ]]; then
      _v3_plugin_register "$plugin_id" "0.1.0" "$plugin_sh"
      _v3_plugin_load "$plugin_id"
      _v3_plugin_activate "$plugin_id"
      ((count++))
    fi
  done
  _v3_log "info" "Plugin" "Descobertos $count plugins em $dir"
}

_v3_plugin_list() {
  echo "Plugins V3:"
  for id in "${!_V3_PLUGINS[@]}"; do
    local status ver
    status=$(echo "${_V3_PLUGINS[$id]}" | jq -r '.status // "unknown"')
    ver=$(echo "${_V3_PLUGINS[$id]}" | jq -r '.version // "?"')
    echo "  $id v$ver [$status]"
  done
}

_v3_plugin_status() {
  local id="$1"
  local entry="${_V3_PLUGINS[$id]:-}"
  if [[ -z "$entry" ]]; then
    echo "Plugin não encontrado: $id"
    return 1
  fi
  echo "$entry" | jq .
}

_v3_plugin_boot() {
  _v3_log "info" "Plugin" "Plugin System inicializado"

  local legacy_plugins="$CC_ROOT/plugins"
  if [[ -d "$legacy_plugins" ]]; then
    _v3_plugin_discover "$legacy_plugins"
  fi

  local v3_plugins="$V3_ROOT/plugins"
  if [[ -d "$v3_plugins" ]]; then
    _v3_plugin_discover "$v3_plugins"
  fi
}
