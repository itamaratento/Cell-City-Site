#!/bin/bash
# Monitoring — Funções de alerta
set -uo pipefail

_cc_v3_monitor_log() {
  local level="$1"
  local component="$2"
  local message="$3"
  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")
  local color=""
  case "$level" in
    error|critical) color="\033[0;31m" ;;
    warn)           color="\033[0;33m" ;;
    info)           color="\033[0;32m" ;;
    debug)          color="\033[0;36m" ;;
  esac
  if [[ -t 1 ]]; then
    echo -e "${color}[${timestamp}] [${level}] [${component}] ${message}\033[0m"
  else
    echo "[${timestamp}] [${level}] [${component}] ${message}"
  fi
}

_cc_v3_monitor_avaliar_regras() {
  local evento="$1"
  local regras_file="$2"

  while IFS='|' read -r componente metrica operador limiar severidade; do
    [[ -z "$componente" || "$componente" =~ ^# ]] && continue

    local valor
    valor=$(echo "$evento" | grep -o "\"${metrica}\":[[:space:]]*[0-9]*" | tr -d ' ' | cut -d: -f2)
    [[ -z "$valor" ]] && continue

    local disparou=false
    case "$operador" in
      "<")  (( $(echo "$valor < $limiar" | bc -l 2>/dev/null || echo 0) )) && disparou=true ;;
      ">")  (( $(echo "$valor > $limiar" | bc -l 2>/dev/null || echo 0) )) && disparou=true ;;
      "<=") (( $(echo "$valor <= $limiar" | bc -l 2>/dev/null || echo 0) )) && disparou=true ;;
      ">=") (( $(echo "$valor >= $limiar" | bc -l 2>/dev/null || echo 0) )) && disparou=true ;;
      "==") [[ "$valor" == "$limiar" ]] && disparou=true ;;
    esac

    if [[ "$disparou" == true ]]; then
      _cc_v3_monitor_registrar_alerta "$evento" "$componente" "$metrica" "$severidade"
    fi
  done < "$regras_file"
}

_cc_v3_monitor_registrar_alerta() {
  local evento="$1"
  local componente="$2"
  local metrica="$3"
  local severidade="$4"

  local alert_file="$MON_DIR/state/alert-history.json"
  local alertas_existentes="[]"

  if [[ -f "$alert_file" ]]; then
    alertas_existentes=$(cat "$alert_file" 2>/dev/null || echo '{"alertas":[]}')
  fi

  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  _cc_v3_monitor_log "warn" "Monitoring" "Alerta disparado: ${componente}/${metrica} (${severidade})"
}
