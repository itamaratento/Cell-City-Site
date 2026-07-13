#!/bin/bash
# Observability — Cálculos estatísticos
set -uo pipefail

_cc_v3_obs_stats_calcular() {
  local valores=("$@")
  local n=${#valores[@]}

  if (( n == 0 )); then
    echo '{"media":0,"mediana":0,"min":0,"max":0}'
    return
  fi

  local sorted=($(for v in "${valores[@]}"; do echo "$v"; done | sort -n))
  local min="${sorted[0]}"
  local max="${sorted[$((n-1))]}"

  local soma=0
  for v in "${valores[@]}"; do
    soma=$(echo "$soma + $v" | bc -l 2>/dev/null || echo 0)
  done
  local media
  media=$(echo "scale=2; $soma / $n" | bc -l 2>/dev/null || echo 0)

  local mediana
  if (( n % 2 == 1 )); then
    mediana="${sorted[$((n/2))]}"
  else
    local m1="${sorted[$((n/2 - 1))]}"
    local m2="${sorted[$((n/2))]}"
    mediana=$(echo "scale=2; ($m1 + $m2) / 2" | bc -l 2>/dev/null || echo 0)
  fi

  cat <<EOF
{
  "media": ${media},
  "mediana": ${mediana},
  "min": ${min},
  "max": ${max}
}
EOF
}
