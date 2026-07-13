#!/bin/bash
# Health Engine — Checker: Node.js
# Verifica ambiente Node.js
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_node() {
  local issues=()
  local score=100

  if ! command -v node &>/dev/null; then
    echo '{"checker":"node","status":"fail","score":0,"details":{"erro":"Node.js não encontrado"}}'
    return
  fi

  local node_version
  node_version=$(node --version 2>/dev/null || echo "desconhecido")
  local node_major
  node_major=$(echo "$node_version" | sed 's/v//' | cut -d. -f1)

  if (( node_major < 18 )); then
    issues+=("{\"severity\":\"warn\",\"message\":\"Node.js ${node_version} abaixo do mínimo 18\"}")
    score=$((score - 30))
  fi

  if (( node_major < 20 )); then
    issues+=("{\"severity\":\"info\",\"message\":\"Node.js ${node_version} — versão 20+ recomendada\"}")
    score=$((score - 5))
  fi

  local has_npm=false
  if command -v npm &>/dev/null; then
    has_npm=true
  fi

  local npm_version=""
  if [[ "$has_npm" == true ]]; then
    npm_version=$(npm --version 2>/dev/null || echo "desconhecido")
  fi

  if (( score < 0 )); then score=0; fi

  local status="pass"
  if (( score < 70 )); then status="fail"
  elif (( score < 90 )); then status="warn"
  fi

  local issues_json="["
  local first=true
  for issue in "${issues[@]}"; do
    if [[ "$first" == true ]]; then first=false; else issues_json+=","; fi
    issues_json+="$issue"
  done
  issues_json+="]"

  cat <<EOF
{
  "checker": "node",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "node_version": "${node_version}",
    "npm_version": "${npm_version}",
    "has_npm": ${has_npm}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_node
