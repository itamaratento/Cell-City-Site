#!/bin/bash
# Execution Engine — Queue Manager
set -uo pipefail

_cc_v3_ee_fila_adicionar() {
  local missao_file="$1"
  local prioridade="${2:-P2}"
  local fila_file="$EE_DIR/state/queue.json"

  mkdir -p "$(dirname "$fila_file")"

  local fila="[]"
  if [[ -f "$fila_file" ]]; then
    fila=$(cat "$fila_file")
  fi

  local missao_id
  missao_id=$(grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' "$missao_file" | cut -d'"' -f4)

  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  local entry="{\"missao_id\":\"${missao_id}\",\"prioridade\":\"${prioridade}\",\"status\":\"pendente\",\"adicionada\":\"${timestamp}\"}"

  echo "$fila" | sed "s/\]$/,${entry}]/" > "$fila_file" 2>/dev/null || echo "[$entry]" > "$fila_file"
}

_cc_v3_ee_fila_proxima() {
  local fila_file="$EE_DIR/state/queue.json"
  if [[ ! -f "$fila_file" ]]; then
    echo ""
    return
  fi

  grep -o '"missao_id":"[^"]*","prioridade":"P[0-4]"' "$fila_file" | head -1 | cut -d'"' -f4
}

_cc_v3_ee_fila_status() {
  local fila_file="$EE_DIR/state/queue.json"
  if [[ -f "$fila_file" ]]; then
    echo "Fila de execução:"
    grep -o '"id":"[^"]*"' "$fila_file" 2>/dev/null
  else
    echo "Fila vazia"
  fi
}
