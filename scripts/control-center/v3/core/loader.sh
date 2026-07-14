#!/bin/bash
# CELL CITY V3 — NOC Decoupled Loader
# Carregamento desacoplado com resolução de dependências.
# Cada componente declara suas dependências — o loader garante a ordem correta.
# Nenhum componente conhece o caminho físico de outro — tudo é resolvido pelo Registry.
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar core/loader.sh}"

declare -A _V3_LOADED

_v3_loader_is_loaded() {
  local component="$1"
  [[ -n "${_V3_LOADED[$component]:-}" ]]
}

_v3_loader_mark_loaded() {
  local component="$1"
  _V3_LOADED["$component"]="$(_v3_timestamp)"
}

_v3_loader_resolve_path() {
  local type="$1" id="$2"
  local entry
  entry=$(_v3_registry_get "$type" "$id")
  if [[ -z "$entry" ]]; then
    _v3_log "error" "Loader" "Componente não registrado: $type::$id"
    return 1
  fi
  echo "$entry" | jq -r '.path // ""'
}

_v3_loader_load_component() {
  local type="$1" id="$2"

  if _v3_loader_is_loaded "$type:$id"; then
    _v3_log "debug" "Loader" "Componente já carregado: $type::$id"
    return 0
  fi

  local entry
  entry=$(_v3_registry_get "$type" "$id")
  if [[ -z "$entry" ]]; then
    _v3_log "error" "Loader" "Componente não registrado: $type::$id"
    return 1
  fi

  local deps
  deps=$(echo "$entry" | jq -r '.dependencies // [] | .[]' 2>/dev/null)
  for dep in $deps; do
    local dep_type="${dep%%:*}" dep_id="${dep##*:}"
    if [[ "$dep_type" != "$dep" ]]; then
      _v3_loader_load_component "$dep_type" "$dep_id" || {
        _v3_log "error" "Loader" "Falha ao carregar dependência: $dep"
        return 1
      }
    fi
  done

  local path
  path=$(echo "$entry" | jq -r '.path // ""')
  local file_to_source=""

  case "$type" in
    engine)  file_to_source="$path/engine.sh" ;;
    widget)  file_to_source="$path" ;;
    panel)   file_to_source="$path" ;;
    service) file_to_source="$path/service.sh" ;;
    *)       file_to_source="$path" ;;
  esac

  if [[ -f "$file_to_source" ]]; then
    # shellcheck disable=SC1090
    source "$file_to_source" 2>/dev/null || {
      _v3_log "error" "Loader" "Erro ao carregar: $file_to_source"
      return 1
    }
    _v3_loader_mark_loaded "$type:$id"
    _v3_log "info" "Loader" "Carregado: $type::$id ← $file_to_source"
    _v3_event_pub "module.activated" "{\"type\":\"$type\",\"id\":\"$id\"}"
  else
    _v3_log "warn" "Loader" "Arquivo não encontrado: $file_to_source"
    return 1
  fi

  return 0
}

_v3_loader_load_all() {
  local type="${1:-}"
  local entries
  entries=$(_v3_registry_list_json "$type")
  local count
  count=$(echo "$entries" | jq 'length')

  local loaded=0 failed=0

  for (( i=0; i<count; i++ )); do
    local comp_type comp_id
    comp_type=$(echo "$entries" | jq -r ".[$i].type")
    comp_id=$(echo "$entries" | jq -r ".[$i].id")
    if _v3_loader_load_component "$comp_type" "$comp_id"; then
      ((loaded++))
    else
      ((failed++))
    fi
  done

  _v3_log "info" "Loader" "Carregamento completo: $loaded carregados, $failed falhas"
  echo "$loaded $failed"
}

_v3_loader_load_priority() {
  local priority_order=("engine" "service" "widget" "panel")
  local total_loaded=0 total_failed=0

  for ptype in "${priority_order[@]}"; do
    local result
    result=$(_v3_loader_load_all "$ptype")
    local ploaded pfailed
    ploaded=$(echo "$result" | awk '{print $1}')
    pfailed=$(echo "$result" | awk '{print $2}')
    ((total_loaded += ploaded))
    ((total_failed += pfailed))
  done

  _v3_log "info" "Loader" "Carregamento prioritário: $total_loaded OK, $total_failed falhas"
}

_v3_loader_status() {
  echo "Componentes carregados:"
  for comp in "${!_V3_LOADED[@]}"; do
    echo "  $comp → ${_V3_LOADED[$comp]}"
  done
}

_v3_loader_boot() {
  _v3_log "info" "Loader" "Decoupled Loader inicializado"
}
