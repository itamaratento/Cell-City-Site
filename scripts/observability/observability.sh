#!/bin/bash
# Cell City V3 — Observability
# Telemetria, estatísticas, performance, logs, métricas do sistema
set -uo pipefail

CC_V3_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OBS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$OBS_DIR/lib/log.sh"
source "$OBS_DIR/lib/metric.sh"
source "$OBS_DIR/lib/stats.sh"

_cc_v3_obs_coletar() {
  local tipo="${1:-tudo}"
  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  _cc_v3_log "info" "Observability" "Coletando métricas (tipo: $tipo)"

  case "$tipo" in
    sistema|system)
      _cc_v3_obs_coletar_sistema "$timestamp"
      ;;
    performance)
      _cc_v3_obs_coletar_performance "$timestamp"
      ;;
    tudo|all|*)
      _cc_v3_obs_coletar_sistema "$timestamp"
      _cc_v3_obs_coletar_performance "$timestamp"
      _cc_v3_obs_coletar_telemetria "$timestamp"
      ;;
  esac
}

_cc_v3_obs_coletar_sistema() {
  local timestamp="$1"
  local metrics="{"

  if command -v free &>/dev/null; then
    local mem_total mem_used mem_pct
    mem_total=$(free -m | awk '/^Mem/{print $2}')
    mem_used=$(free -m | awk '/^Mem/{print $3}')
    if [[ -n "$mem_total" ]] && [[ -n "$mem_used" ]] && (( mem_total > 0 )); then
      mem_pct=$(( mem_used * 100 / mem_total ))
    fi
    metrics+="\"memory_usage_mb\":${mem_used},\"memory_percent\":${mem_pct},"
  fi

  if command -v df &>/dev/null; then
    local disk_pct disk_free disk_total
    disk_pct=$(df -h / | awk 'NR==2{sub(/%/,"",$5);print $5}')
    disk_free=$(df -BG / | awk 'NR==2{gsub(/G/,"",$4);print $4}')
    disk_total=$(df -BG / | awk 'NR==2{gsub(/G/,"",$2);print $2}')
    metrics+="\"disk_usage_percent\":${disk_pct},\"disk_free_gb\":${disk_free},\"disk_total_gb\":${disk_total},"
  fi

  if command -v nproc &>/dev/null; then
    local cores
    cores=$(nproc)
    metrics+="\"cpu_cores\":${cores},"
  fi

  if command -v uptime &>/dev/null; then
    local uptime_seconds
    uptime_seconds=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)
    local uptime_hours=$(( uptime_seconds / 3600 ))
    local load_1 load_5 load_15
    read -r load_1 load_5 load_15 _ < /proc/loadavg 2>/dev/null || { load_1=0; load_5=0; load_15=0; }
    metrics+="\"uptime_hours\":${uptime_hours},\"load_1m\":${load_1},\"load_5m\":${load_5},\"load_15m\":${load_15},"
  fi

  metrics="${metrics%,}}"

  local result="{\"timestamp\":\"${timestamp}\",\"metrics\":{\"system\":${metrics}}}"
  mkdir -p "$OBS_DIR/state"
  echo "$result" > "$OBS_DIR/state/metrics.json"
  _cc_v3_log "info" "Observability" "Métricas de sistema coletadas"
}

_cc_v3_obs_coletar_performance() {
  local timestamp="$1"
  local health_file="$CC_V3_ROOT/scripts/health-engine/state/health-check.json"

  local exec_time=0
  if [[ -f "$health_file" ]]; then
    local check_time
    check_time=$(jq -r '.timestamp // ""' "$health_file")
    if [[ -n "$check_time" ]]; then
      local check_epoch diag_epoch
      check_epoch=$(date -d "${check_time/-03:00/+00:00}" +%s 2>/dev/null || echo 0)
      diag_epoch=$(date +%s)
      exec_time=$(( diag_epoch - check_epoch ))
      if (( exec_time < 0 )); then exec_time=0; fi
    fi
  fi

  local metrics="{\"health_check_duration_s\":${exec_time},\"collect_timestamp\":\"${timestamp}\"}"
  local result="{\"timestamp\":\"${timestamp}\",\"metrics\":{\"performance\":${metrics}}}"

  local perf_file="$OBS_DIR/state/performance.json"
  mkdir -p "$OBS_DIR/state"

  local history="[]"
  if [[ -f "$perf_file" ]]; then
    history=$(cat "$perf_file" 2>/dev/null || echo "[]")
  fi

  echo "$history" | jq ". + [$result]" > "$perf_file" 2>/dev/null || echo "[$result]" > "$perf_file"
  _cc_v3_log "info" "Observability" "Métricas de performance coletadas"
}

_cc_v3_obs_coletar_telemetria() {
  local timestamp="$1"
  local base="$CC_V3_ROOT/scripts"

  local components=("health-engine" "diagnostic-engine" "monitoring" "smart-panel" "prompt-generator" "observability" "automations" "central-modulos-v3" "execution-engine")

  local telemetry="{"
  for comp in "${components[@]}"; do
    local state_dir="$base/$comp/state"
    local files=0
    if [[ -d "$state_dir" ]]; then
      files=$(find "$state_dir" -name "*.json" 2>/dev/null | wc -l)
    fi
    telemetry+="\"${comp}\":{\"state_files\":${files}},"
  done
  telemetry="${telemetry%,}}"

  local result="{\"timestamp\":\"${timestamp}\",\"metrics\":{\"telemetria\":${telemetry}}}"

  local tel_file="$OBS_DIR/state/telemetry.json"
  mkdir -p "$OBS_DIR/state"
  echo "$result" > "$tel_file"
  _cc_v3_log "info" "Observability" "Telemetria coletada: ${#components[@]} componentes"
}

_cc_v3_obs_exportar() {
  local format="${1:-json}"
  local metric_file="$OBS_DIR/state/metrics.json"

  if [[ ! -f "$metric_file" ]]; then
    echo "Nenhuma métrica disponível"
    return
  fi

  case "$format" in
    json)
      cat "$metric_file"
      ;;
    texto|text)
      jq -r '.metrics.system | to_entries[] | "\(.key): \(.value)"' "$metric_file" 2>/dev/null || grep -o '"[^"]*":[0-9.]*' "$metric_file" | sed 's/"//g' | tr ':' ': '
      ;;
    historico|history)
      local perf_file="$OBS_DIR/state/performance.json"
      if [[ -f "$perf_file" ]]; then
        cat "$perf_file"
      else
        echo "Nenhum histórico disponível"
      fi
      ;;
  esac
}

case "${1:-}" in
  --collect)  shift; _cc_v3_obs_coletar "$@" ;;
  --export)   shift; _cc_v3_obs_exportar "$@" ;;
  --help|-h)
    echo "Uso: observability.sh [--collect <sistema|performance|tudo>] [--export <json|texto|historico>]"
    ;;
  *)          _cc_v3_obs_coletar "tudo" ;;
esac
