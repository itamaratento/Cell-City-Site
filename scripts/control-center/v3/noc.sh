#!/bin/bash
# CELL CITY V3 — NOC (Network Operations Center) Fase 1
# Entry point principal. Boot rapido (<2s), dashboard operacional.
set -uo pipefail

NOC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V3_ROOT="$NOC_DIR"
CC_ROOT="$(cd "$V3_ROOT/.." && pwd)"
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"
readonly NOC_DIR V3_ROOT CC_ROOT REPO_DIR

source "$CC_ROOT/lib/common.sh" 2>/dev/null || {
  echo "AVISO: lib/common.sh da V1 nao encontrado — UI limitada."
  _cc_box_top()    { echo "================================================"; }
  _cc_box_line()   { echo "| $1"; }
  _cc_box_line_center() { echo "|           $1"; }
  _cc_box_sep()    { echo "|-----------------------------------------------|"; }
  _cc_box_bottom() { echo "================================================"; }
  _cc_screen_footer() { echo "  $1"; echo "================================================"; }
  _CC_C_VERDE=""; _CC_C_AMARELO=""; _CC_C_VERMELHO=""; _CC_C_CIANO=""; _CC_C_RESET=""
}

source "$V3_ROOT/shared/constants.sh"
source "$V3_ROOT/shared/utils.sh"
source "$V3_ROOT/shared/types.sh"
source "$V3_ROOT/logs/logger.sh"
source "$V3_ROOT/cache/engine.sh"
source "$V3_ROOT/core/event-bus.sh"
source "$V3_ROOT/core/registry.sh"
source "$V3_ROOT/core/loader.sh"
source "$V3_ROOT/core/plugin.sh"
source "$V3_ROOT/core/kernel.sh"

source "$V3_ROOT/widgets/base.sh"
source "$V3_ROOT/panels/base.sh"
source "$V3_ROOT/services/base.sh"
source "$V3_ROOT/services/collectors.sh"
source "$V3_ROOT/services/health-score.sh"
source "$V3_ROOT/panels/noc-dashboard.sh"

source "$V3_ROOT/config/v3.conf" 2>/dev/null || true

trap '_v3_kernel_shutdown' EXIT

_v3_noc_boot() {
  local boot_start
  boot_start=$(_v3_timestamp_epoch)

  clear 2>/dev/null || echo ""

  echo ""
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║                                                                  ║"
  echo "║         CELL CITY OPERATIONS CENTER                              ║"
  echo "║         NOC v$_V3_VERSION ($_V3_CODENOME)                                    ║"
  echo "║                                                                  ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"

  _v3_log_boot
  _v3_cache_boot
  _v3_event_boot
  _v3_registry_boot
  _v3_loader_boot
  _v3_plugin_boot
  _v3_registry_discover_all

  _v3_json_set "$_V3_KERNEL_STATE" '.boot_id' "\"$_V3_BOOT_ID\""
  _v3_json_set "$_V3_KERNEL_STATE" '.boot_time' "\"$(_v3_timestamp)\""
  _v3_json_set "$_V3_KERNEL_STATE" '.version' "\"$_V3_VERSION\""
  _v3_json_set "$_V3_KERNEL_STATE" '.status' '"running"'

  local boot_end boot_duration
  boot_end=$(_v3_timestamp_epoch)
  boot_duration=$((boot_end - boot_start))

  _v3_json_set "$_V3_KERNEL_STATE" '.boot_duration_s' "$boot_duration"

  local total_components
  total_components=$(_v3_registry_count)

  echo ""
  echo -e "  ${_CC_C_VERDE}KERNEL PRONTO${_CC_C_RESET} | Boot: ${boot_duration}s | Componentes: $total_components | v$_V3_VERSION"
  echo ""

  _v3_event_pub "system.boot" "{\"boot_id\":\"$_V3_BOOT_ID\",\"duration_s\":$boot_duration,\"components\":$total_components}"

  if [[ "$boot_duration" -gt 3 ]]; then
    _v3_log "warn" "NOC" "Boot excedeu 3s (${boot_duration}s)"
  fi

  _v3_noc_loop
}

_v3_noc_boot
