#!/bin/bash
# Diagnostic Engine — Geração de relatórios
set -uo pipefail

_cc_v3_diag_gerar_relatorio() {
  local timestamp="$1"
  local tipo="$2"
  local analyzers_executed="$3"
  shift 3
  local findings_arrays=("$@")

  local merged_findings="[]"
  for arr in "${findings_arrays[@]}"; do
    if [[ "$arr" != "[]" ]] && [[ -n "$arr" ]]; then
      merged_findings=$(echo "$merged_findings" | jq ". + $arr" 2>/dev/null || echo "$merged_findings")
    fi
  done

  local total_findings
  total_findings=$(echo "$merged_findings" | jq 'length' 2>/dev/null || echo 0)

  jq -n \
    --arg ts "$timestamp" \
    --arg tipo "$tipo" \
    --argjson ae "$analyzers_executed" \
    --argjson tf "$total_findings" \
    --argjson findings "$merged_findings" \
    '{
      diagnostic_id: ("diag_" + (now | strftime("%Y%m%d_%H%M%S"))),
      tipo: $tipo,
      timestamp: $ts,
      analyzers_executados: $ae,
      total_findings: $tf,
      findings: $findings
    }'
}
