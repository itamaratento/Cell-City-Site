#!/bin/bash
# Central de Módulos V3 — Utilitários de catálogo
set -uo pipefail

_cc_v3_central_catalogo_carregar() {
  local catalogo_file="$CC_V3_ROOT/CRM/shared/modulos.catalogo.json"
  if [[ -f "$catalogo_file" ]]; then
    cat "$catalogo_file" 2>/dev/null || echo '{"modulos":[]}'
  else
    echo '{"modulos":[]}'
  fi
}

_cc_v3_central_modulo_score() {
  local slug="$1"
  local health_file="$CC_V3_ROOT/scripts/health-engine/state/health-check.json"
  if [[ -f "$health_file" ]]; then
    grep -o '"geral":[[:space:]]*[0-9]*' "$health_file" | tr -d ' ' | cut -d: -f2
  else
    echo "N/A"
  fi
}
