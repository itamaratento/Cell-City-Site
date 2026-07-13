#!/bin/bash
# Monitoring — Funções de evento
set -uo pipefail

_cc_v3_monitor_criar_evento() {
  local id="$1"
  local tipo="$2"
  local severidade="$3"
  local timestamp="$4"
  local componente="$5"
  local mensagem="$6"
  local dados="$7"

  cat <<EOF
{
  "id": "${id}",
  "tipo": "${tipo}",
  "severidade": "${severidade}",
  "timestamp": "${timestamp}",
  "origem": "${componente}",
  "mensagem": "${mensagem}",
  "dados": ${dados}
}
EOF
}
