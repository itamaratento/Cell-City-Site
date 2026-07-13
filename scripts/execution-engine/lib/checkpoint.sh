#!/bin/bash
# Execution Engine — Checkpoint Manager
set -uo pipefail

_cc_v3_ee_checkpoint_ler_bloco() {
  local file="$1"
  jq -r '.bloco_atual // 0' "$file"
}

_cc_v3_ee_checkpoint_ler_passo() {
  local file="$1"
  jq -r '.passo_atual // 0' "$file"
}

_cc_v3_ee_checkpoint_ler_historico() {
  local file="$1"
  jq -c '.historico // []' "$file" 2>/dev/null || echo "[]"
}
