#!/bin/bash
# CELL CITY V3 - NOC Services Layer
# Camada de servicos abstratos. Cada servico expoe uma API interna.
# Servicos sao descobertos automaticamente pelo Registry.
# Engines e Widgets consomem servicos - nunca acessam recursos diretamente.
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar services/base.sh}"

declare -A _V3_SERVICES

_v3_service_register() {
  local id="$1" description="$2" init_fn="${3:-}" shutdown_fn="${4:-}"

  local meta
  meta=$(jq -n \
    --arg id "$id" \
    --arg desc "$description" \
    --arg init "${init_fn:-}" \
    --arg shutdown "${shutdown_fn:-}" \
    --arg ts "$(_v3_timestamp)" \
    '{id: $id, description: $desc, init_fn: $init, shutdown_fn: $shutdown, registered_at: $ts, status: "registered"}')

  _v3_registry_register "service" "$id" "$_V3_SERVICES_DIR/$id" "$meta"
  _V3_SERVICES["$id"]="$meta"
  _v3_log "info" "Service" "Servico registrado: $id ($description)"
}

_v3_service_call() {
  local service_id="$1" method="$2"
  shift 2
  local args=("$@")

  local entry="${_V3_SERVICES[$service_id]:-}"
  if [[ -z "$entry" ]]; then
    _v3_log "error" "Service" "Servico nao encontrado: $service_id"
    return 1
  fi

  local fn_name="_v3_svc_${service_id}_${method}"
  if declare -f "$fn_name" >/dev/null 2>&1; then
    "$fn_name" "${args[@]}"
  else
    _v3_log "warn" "Service" "Metodo nao implementado: $fn_name"
    return 1
  fi
}

_v3_service_health() {
  local service_id="$1"
  local entry="${_V3_SERVICES[$service_id]:-}"
  if [[ -z "$entry" ]]; then
    echo "unknown"
    return 1
  fi
  echo "$entry" | jq -r '.status // "unknown"'
}

_v3_service_list() {
  echo "Servicos registrados:"
  for id in "${!_V3_SERVICES[@]}"; do
    local status desc
    status=$(echo "${_V3_SERVICES[$id]}" | jq -r '.status // "?"')
    desc=$(echo "${_V3_SERVICES[$id]}" | jq -r '.description // "?"')
    echo "  $id [$status]: $desc"
  done
}

_v3_service_boot() {
  _v3_log "info" "Service" "Services Layer inicializado"

  for id in "${!_V3_SERVICES[@]}"; do
    local init_fn
    init_fn=$(echo "${_V3_SERVICES[$id]}" | jq -r '.init_fn // ""')
    if [[ -n "$init_fn" ]] && declare -f "$init_fn" >/dev/null 2>&1; then
      "$init_fn" && {
        local updated
        updated=$(echo "${_V3_SERVICES[$id]}" | jq '.status = "running"')
        _V3_SERVICES["$id"]="$updated"
      }
    fi
  done
}

_v3_service_shutdown() {
  for id in "${!_V3_SERVICES[@]}"; do
    local shutdown_fn
    shutdown_fn=$(echo "${_V3_SERVICES[$id]}" | jq -r '.shutdown_fn // ""')
    if [[ -n "$shutdown_fn" ]] && declare -f "$shutdown_fn" >/dev/null 2>&1; then
      "$shutdown_fn"
    fi
  done
  _v3_log "info" "Service" "Todos os servicos encerrados"
}
