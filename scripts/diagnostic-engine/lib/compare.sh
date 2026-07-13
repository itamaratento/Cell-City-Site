#!/bin/bash
# Diagnostic Engine — Comparação entre diagnósticos
set -uo pipefail

_cc_v3_diag_comparar() {
  local atual="$1"
  local anterior="$2"

  if [[ ! -f "$anterior" ]]; then
    jq -n '{comparavel: false, motivo: "Arquivo anterior não encontrado"}'
    return
  fi

  local diag_atual diag_anterior
  diag_atual=$(jq '.total_findings // 0' "$atual")
  diag_anterior=$(jq '.total_findings // 0' "$anterior")

  local delta=$((diag_atual - diag_anterior))

  local tendencia="estavel"
  if (( delta < 0 )); then
    tendencia="melhorou"
  elif (( delta > 0 )); then
    tendencia="piorou"
  fi

  jq -n \
    --argjson atual "$diag_atual" \
    --argjson anterior "$diag_anterior" \
    --argjson delta "$delta" \
    --arg tendencia "$tendencia" \
    '{comparavel: true, findings_atual: $atual, findings_anterior: $anterior, delta: $delta, tendencia: $tendencia}'
}
