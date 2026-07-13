#!/bin/bash
# Health Engine — Comparação entre execuções
set -uo pipefail

_cc_v3_health_comparar() {
  local atual="$1"
  local anterior="$2"

  if [[ ! -f "$anterior" ]]; then
    echo '{"comparavel":false,"motivo":"arquivo anterior não encontrado"}'
    return
  fi

  local score_atual score_anterior
  score_atual=$(grep -o '"geral":[[:space:]]*[0-9]*' "$atual" | tr -d ' ' | cut -d: -f2)
  score_anterior=$(grep -o '"geral":[[:space:]]*[0-9]*' "$anterior" | tr -d ' ' | cut -d: -f2)

  local delta=$((score_atual - score_anterior))
  local tendencia="estavel"
  if (( delta > 0 )); then tendencia="melhorou"
  elif (( delta < 0 )); then tendencia="piorou"
  fi

  cat <<EOF
{
  "comparavel": true,
  "score_atual": ${score_atual},
  "score_anterior": ${score_anterior},
  "delta": ${delta},
  "tendencia": "${tendencia}"
}
EOF
}
