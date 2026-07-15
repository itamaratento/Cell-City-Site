#!/bin/bash
# CELL CITY V3 — NOC Kernel
# Orquestrador principal. Inicializa todos os subsistemas na ordem correta.
# Este é o ponto único de entrada da arquitetura V3.
# Não depende de menus — menus consomem o kernel, e não o contrário.
set -uo pipefail

V3_KERNEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# noc.sh já define V3_ROOT/CC_ROOT como readonly antes de carregar o kernel —
# só atribui quando o kernel é o primeiro a carregar (uso standalone).
if [[ -z "${V3_ROOT:-}" ]]; then
  V3_ROOT="$(cd "$V3_KERNEL_DIR/.." && pwd)"
  readonly V3_ROOT
fi
if [[ -z "${CC_ROOT:-}" ]]; then
  CC_ROOT="$(cd "$V3_ROOT/.." && pwd)"
  readonly CC_ROOT
fi

source "$CC_ROOT/lib/ui-colors.sh" 2>/dev/null || true

source "$V3_ROOT/shared/constants.sh"
source "$V3_ROOT/shared/utils.sh"
source "$V3_ROOT/shared/types.sh"
source "$V3_ROOT/logs/logger.sh"
source "$V3_ROOT/cache/engine.sh"
source "$V3_ROOT/core/event-bus.sh"
source "$V3_ROOT/core/registry.sh"
source "$V3_ROOT/core/loader.sh"
source "$V3_ROOT/core/plugin.sh"

readonly _V3_BOOT_ID="boot-$(_v3_timestamp_epoch)"

_V3_KERNEL_STATE="$_V3_STATE_DIR/kernel.json"

_v3_kernel_boot_sequence() {
  local boot_start
  boot_start=$(_v3_timestamp_epoch)

  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║     CELL CITY NOC — KERNEL BOOT                                 ║"
  echo "║     v$_V3_VERSION ($_V3_CODENOME)                                           ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
  echo ""

  _v3_log "info" "Kernel" "========== BOOT SEQUENCE INICIADA ($_V3_BOOT_ID) =========="

  _v3_log_boot
  _v3_log "info" "Kernel" "[1/7] Logger inicializado"

  _v3_cache_boot
  _v3_log "info" "Kernel" "[2/7] Cache inicializado"

  _v3_event_boot
  _v3_log "info" "Kernel" "[3/7] Event Bus inicializado"

  _v3_registry_boot
  _v3_log "info" "Kernel" "[4/7] Registry inicializado"

  _v3_loader_boot
  _v3_log "info" "Kernel" "[5/7] Loader inicializado"

  _v3_plugin_boot
  _v3_log "info" "Kernel" "[6/7] Plugin System inicializado"

  _v3_registry_discover_all
  _v3_log "info" "Kernel" "[7/7] Descoberta de componentes concluída"

  local boot_end boot_duration
  boot_end=$(_v3_timestamp_epoch)
  boot_duration=$((boot_end - boot_start))

  _v3_json_set "$_V3_KERNEL_STATE" '.boot_id' "\"$_V3_BOOT_ID\""
  _v3_json_set "$_V3_KERNEL_STATE" '.boot_time' "\"$(_v3_timestamp)\""
  _v3_json_set "$_V3_KERNEL_STATE" '.boot_duration_s' "$boot_duration"
  _v3_json_set "$_V3_KERNEL_STATE" '.version' "\"$_V3_VERSION\""
  _v3_json_set "$_V3_KERNEL_STATE" '.status' '"running"'

  local total_components
  total_components=$(_v3_registry_count)

  echo ""
  echo -e "  ${_CC_C_VERDE}KERNEL PRONTO${_CC_C_RESET}"
  echo "  Boot: ${boot_duration}s | Componentes: $total_components | Versão: $_V3_VERSION"
  echo ""

  _v3_event_pub "system.boot" "{\"boot_id\":\"$_V3_BOOT_ID\",\"duration_s\":$boot_duration,\"components\":$total_components}"

  return 0
}

_v3_kernel_shutdown() {
  _v3_log "info" "Kernel" "========== SHUTDOWN SEQUENCE INICIADA =========="

  _v3_event_pub "system.shutdown" "{\"boot_id\":\"$_V3_BOOT_ID\",\"uptime\":\"$SECONDS\"}"

  _v3_json_set "$_V3_KERNEL_STATE" '.status' '"shutdown"'
  _v3_json_set "$_V3_KERNEL_STATE" '.shutdown_time' "\"$(_v3_timestamp)\""

  _v3_log "info" "Kernel" "Shutdown completo. Uptime: ${SECONDS}s"
  _v3_log_shutdown
}

_v3_kernel_uptime() {
  local seconds="$SECONDS"
  _v3_format_duration "$seconds"
}

_v3_kernel_status() {
  if [[ -f "$_V3_KERNEL_STATE" ]]; then
    echo "╔══════════════════════════════════════════╗"
    echo "║  NOC KERNEL STATUS                       ║"
    echo "╠══════════════════════════════════════════╣"
    echo "║  Versão    : $_V3_VERSION"
    echo "║  Boot ID   : $_V3_BOOT_ID"
    echo "║  Uptime    : $(_v3_kernel_uptime)"
    local comps; comps=$(_v3_registry_count)
    echo "║  Componentes: $comps"
    local events=0
    [[ -f "$_V3_EVENT_LOG" ]] && events=$(jq '.events | length' "$_V3_EVENT_LOG" 2>/dev/null || echo 0)
    echo "║  Eventos   : $events"
    echo "╚══════════════════════════════════════════╝"
  else
    echo "Kernel não inicializado."
  fi
}

_v3_kernel_health() {
  local score="${1:-0}"
  local level
  level=$(_v3_health_label "$score")

  echo "╔══════════════════════════════════════════╗"
  echo "║  NOC HEALTH SCORE                        ║"
  echo "╠══════════════════════════════════════════╣"
  echo "║  Score     : $score/100"
  echo "║  Nível     : $level"
  echo "║  Uptime    : $(_v3_kernel_uptime)"
  echo "╚══════════════════════════════════════════╝"
}

_v3_kernel_panic() {
  local reason="$1" code="${2:-1}"
  _v3_log "critical" "Kernel" "KERNEL PANIC: $reason"
  _v3_event_pub "system.error" "{\"type\":\"kernel_panic\",\"reason\":\"$reason\"}"
  echo -e "${_CC_C_VERMELHO}KERNEL PANIC: $reason${_CC_C_RESET}" >&2
  _v3_kernel_shutdown
  exit "$code"
}

trap '_v3_kernel_shutdown' EXIT
