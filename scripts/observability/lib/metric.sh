#!/bin/bash
# Observability — Funções de métrica
set -uo pipefail

_cc_v3_obs_metric_registrar() {
  local nome="$1"
  local valor="$2"
  local unidade="${3:-}"
  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  local metric_file="$OBS_DIR/state/metrics.json"
  local entry="{\"timestamp\":\"${timestamp}\",\"metric\":\"${nome}\",\"value\":${valor},\"unit\":\"${unidade}\"}"

  if [[ -f "$metric_file" ]]; then
    local temp
    temp=$(cat "$metric_file")
    echo "$temp" | sed "s/\]$/,\"${entry}\"]/" > "$metric_file" 2>/dev/null || echo "[$entry]" > "$metric_file"
  else
    echo "[$entry]" > "$metric_file"
  fi
}
