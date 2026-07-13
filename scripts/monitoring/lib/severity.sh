#!/bin/bash
# Monitoring — Níveis de severidade
set -uo pipefail

_cc_v3_monitor_severidade_nivel() {
  local severidade="$1"
  case "$severidade" in
    critical) echo 5 ;;
    high)     echo 4 ;;
    warning)  echo 3 ;;
    info)     echo 2 ;;
    debug)    echo 1 ;;
    *)        echo 0 ;;
  esac
}

_cc_v3_monitor_severidade_cor() {
  local severidade="$1"
  case "$severidade" in
    critical) echo "\033[0;31m" ;;
    high)     echo "\033[0;35m" ;;
    warning)  echo "\033[0;33m" ;;
    info)     echo "\033[0;32m" ;;
    debug)    echo "\033[0;36m" ;;
  esac
}

_cc_v3_monitor_prioridade_label() {
  local prioridade="$1"
  case "$prioridade" in
    P0) echo "Imediato" ;;
    P1) echo "1 hora" ;;
    P2) echo "1 dia" ;;
    P3) echo "1 semana" ;;
    P4) echo "1 mês" ;;
    *)  echo "Desconhecido" ;;
  esac
}
