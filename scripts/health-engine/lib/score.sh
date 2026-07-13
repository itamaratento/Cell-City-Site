#!/bin/bash
# Health Engine — Cálculo de Health Score
set -uo pipefail

_cc_v3_health_peso() {
  local checker="$1"
  case "$checker" in
    build|firebase)          echo 20 ;;
    workspace|firestore|functions|node|npm|control-center|backup|rules|indexes) echo 10 ;;
    git|rbac|repositories|modules|services|shared|dashboard|portal|central-modulos|service-worker|logs) echo 5 ;;
    *)                       echo 5 ;;
  esac
}

_cc_v3_health_calc_score() {
  local results=("$@")
  local total_peso=0
  local total_score=0

  for result in "${results[@]}"; do
    local checker score peso
    checker=$(echo "$result" | grep -o '"checker":[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    score=$(echo "$result" | grep -o '"score":[[:space:]]*[0-9]*' | tr -d ' ' | cut -d: -f2)
    peso=$(_cc_v3_health_peso "$checker")

    total_peso=$((total_peso + peso))
    total_score=$((total_score + score * peso))
  done

  if [[ $total_peso -eq 0 ]]; then
    echo 100
    return
  fi

  echo $((total_score / total_peso))
}

_cc_v3_health_score_nivel() {
  local score="$1"
  if (( score >= 90 )); then echo "saudavel"
  elif (( score >= 70 )); then echo "atencao"
  elif (( score >= 50 )); then echo "critico"
  else echo "ruim"
  fi
}

_cc_v3_health_score_cor() {
  local score="$1"
  if (( score >= 90 )); then echo "\033[0;32m"
  elif (( score >= 70 )); then echo "\033[0;33m"
  elif (( score >= 50 )); then echo "\033[0;35m"
  else echo "\033[0;31m"
  fi
}
