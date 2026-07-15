#!/bin/bash
# CELL CITY V3 — NOC Logger
# Sistema de logging estruturado com níveis, rotação e múltiplos destinos.
# Toda atividade do NOC é registrada aqui — engines, widgets, panels, serviços.
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar logs/logger.sh}"

# Guarda de idempotência (evita erro de readonly em re-source via kernel.sh)
[[ -n "${_V3_LOGGER_LOADED:-}" ]] && return 0
_V3_LOGGER_LOADED=1

readonly _V3_LOG_LEVELS=("debug" "info" "warn" "error" "critical")
# Nome alinhado a config/v3.conf (V3_NOC_LOG_LEVEL); logger.sh é sourced antes
# do v3.conf em noc.sh, então este é só o fallback pré-config — noc.sh
# reaplica o valor real via _v3_log_set_level() depois de carregar o config.
_V3_LOG_CURRENT_LEVEL="${V3_NOC_LOG_LEVEL:-info}"

_v3_log_level_value() {
  local level="$1"
  case "$level" in
    debug)    echo 0 ;;
    info)     echo 1 ;;
    warn)     echo 2 ;;
    error)    echo 3 ;;
    critical) echo 4 ;;
    *)        echo 1 ;;
  esac
}

_v3_log_should_write() {
  local level="$1"
  local current_val level_val
  current_val=$(_v3_log_level_value "$_V3_LOG_CURRENT_LEVEL")
  level_val=$(_v3_log_level_value "$level")
  [[ "$level_val" -ge "$current_val" ]]
}

_v3_log_color() {
  local level="$1"
  case "$level" in
    error|critical) echo "${_CC_C_VERMELHO:-}" ;;
    warn)           echo "${_CC_C_AMARELO:-}" ;;
    info)           echo "${_CC_C_VERDE:-}" ;;
    debug)          echo "${_CC_C_CIANO:-}" ;;
    *)              echo "" ;;
  esac
}

_v3_log() {
  local level="$1" component="$2" message="$3"
  _v3_log_should_write "$level" || return 0

  local timestamp color reset
  timestamp=$(_v3_timestamp)
  color=$(_v3_log_color "$level")
  reset="${_CC_C_RESET:-}"

  if [[ -t 1 ]]; then
    printf '%b[%s] [%-8s] [%-20s] %s%b\n' \
      "$color" "$timestamp" "$level" "$component" "$message" "$reset" >&2
  fi

  if [[ -d "$_V3_LOG_DIR" ]]; then
    printf '[%s] [%-8s] [%-20s] %s\n' \
      "$timestamp" "$level" "$component" "$message" >> "$_V3_LOG_FILE"
    _v3_log_check_rotation
  fi
}

_v3_log_check_rotation() {
  local max_size=$((10 * 1024 * 1024))
  if [[ -f "$_V3_LOG_FILE" ]]; then
    local size
    size=$(stat -c %s "$_V3_LOG_FILE" 2>/dev/null) || true
    [[ -z "$size" ]] && size=0
    if [[ "$size" -gt "$max_size" ]]; then
      local rotated="$_V3_LOG_FILE.$(_v3_timestamp_epoch)"
      mv "$_V3_LOG_FILE" "$rotated"
      _v3_log "info" "Logger" "Log rotacionado: $rotated ($(_v3_format_bytes "$size"))"

      local rotation_dir="$_V3_LOG_DIR/rotations"
      mkdir -p "$rotation_dir"

      local old_logs
      old_logs=$(find "$_V3_LOG_DIR" -maxdepth 1 -name "noc.log.*" -type f 2>/dev/null | sort)
      local count
      count=$(echo "$old_logs" | wc -l)
      if [[ "$count" -gt 7 ]]; then
        local to_delete
        to_delete=$(echo "$old_logs" | head -n $((count - 7)))
        while IFS= read -r f; do
          [[ -n "$f" ]] && mv "$f" "$rotation_dir/" 2>/dev/null
        done <<< "$to_delete"
      fi
    fi
  fi
}

_v3_log_set_level() {
  local level="$1"
  case "$level" in
    debug|info|warn|error|critical) _V3_LOG_CURRENT_LEVEL="$level" ;;
    *) _v3_log "warn" "Logger" "Nível inválido: $level" ;;
  esac
}

_v3_log_tail() {
  local lines="${1:-20}"
  if [[ -f "$_V3_LOG_FILE" ]]; then
    tail -n "$lines" "$_V3_LOG_FILE"
  else
    echo "Nenhum log disponível."
  fi
}

_v3_log_search() {
  local pattern="$1" limit="${2:-50}"
  if [[ -f "$_V3_LOG_FILE" ]]; then
    grep -i "$pattern" "$_V3_LOG_FILE" | tail -n "$limit"
  else
    echo "Nenhum log disponível."
  fi
}

_v3_log_stats() {
  if [[ -f "$_V3_LOG_FILE" ]]; then
    echo "Estatísticas do log ($_V3_LOG_FILE):"
    echo "  Linhas : $(wc -l < "$_V3_LOG_FILE" 2>/dev/null || echo 0)"
    echo "  Tamanho: $(_v3_format_bytes "$(stat -c %s "$_V3_LOG_FILE" 2>/dev/null || echo 0)")"
    echo "  Levels:"
    for level in "${_V3_LOG_LEVELS[@]}"; do
      local count
      count=$(grep -c "\[$level\]" "$_V3_LOG_FILE" 2>/dev/null || true)
      echo "    $level: $count"
    done
  else
    echo "Nenhum log disponível."
  fi
}

_v3_log_boot() {
  mkdir -p "$_V3_LOG_DIR"
  if [[ ! -f "$_V3_LOG_FILE" ]]; then
    touch "$_V3_LOG_FILE"
  fi
  _v3_log "info" "Logger" "Logger inicializado (nível: $_V3_LOG_CURRENT_LEVEL)"
}

_v3_log_shutdown() {
  _v3_log "info" "Logger" "Logger encerrado"
}
