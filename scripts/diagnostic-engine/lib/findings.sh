#!/bin/bash
# Diagnostic Engine — Gerenciamento de findings
set -uo pipefail

_cc_v3_diag_criar_finding() {
  local analyzer="$1"
  local tipo="$2"
  local severidade="$3"
  local categoria="$4"
  local mensagem="$5"
  local detalhes="${6:-{}}"
  local sugestao="${7:-}"

  cat <<EOF
{
  "analyzer": "${analyzer}",
  "tipo": "${tipo}",
  "severidade": "${severidade}",
  "categoria": "${categoria}",
  "mensagem": "${mensagem}",
  "detalhes": ${detalhes},
  "sugestao": "${sugestao}"
}
EOF
}
