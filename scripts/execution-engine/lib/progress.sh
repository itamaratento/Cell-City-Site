#!/bin/bash
# Execution Engine — Progress Tracker
set -uo pipefail

_cc_v3_ee_progresso_calcular() {
  local concluidos="$1"
  local total="$2"
  if (( total > 0 )); then
    echo $(( concluidos * 100 / total ))
  else
    echo 0
  fi
}

_cc_v3_ee_tempo_estimado() {
  local concluidos="$1"
  local decorrido="$2"
  if (( concluidos > 0 )); then
    echo $(( decorrido * (100 - concluidos) / concluidos ))
  else
    echo 0
  fi
}

_cc_v3_ee_formatar_tempo() {
  local segundos="$1"
  local horas=$(( segundos / 3600 ))
  local minutos=$(( (segundos % 3600) / 60 ))
  local segs=$(( segundos % 60 ))
  printf "%02d:%02d:%02d" "$horas" "$minutos" "$segs"
}
