#!/bin/bash
# Health Engine — Formatação de relatórios
set -uo pipefail

_cc_v3_health_gerar_relatorio() {
  local timestamp="$1"
  local modo="$2"
  local score="$3"
  local passed="$4"
  local failed="$5"
  shift 5
  local results=("$@")

  local nivel
  nivel=$(_cc_v3_health_score_nivel "$score")

  cat <<EOF
{
  "descricao": "Health Check V3 - ${modo}",
  "versao": "3.0.0",
  "timestamp": "${timestamp}",
  "status": "concluido",
  "nivel": "${nivel}",
  "score": {
    "geral": ${score},
    "categorias": {}
  },
  "execucao": {
    "tipo": "${modo}",
    "checkers_executados": ${#results[@]},
    "checkers_pass": ${passed},
    "checkers_fail": ${failed}
  },
  "alertas": []
}
EOF
}
