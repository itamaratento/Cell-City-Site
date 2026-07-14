#!/bin/bash
# Health Engine — Checker: NPM
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_npm() {
  local repo="${REPO_DIR:-/home/cellcity/Musicas/projetos/Cell-City-Site}"
  local score=100 issues=() status="pass"

  if ! command -v npm &>/dev/null; then
    echo "{\"checker\":\"npm\",\"status\":\"error\",\"score\":0,\"timestamp\":\"$(date +"%Y-%m-%dT%H:%M:%S%:z")\",\"details\":{\"npm_installed\":false},\"issues\":[{\"severity\":\"error\",\"message\":\"npm nao instalado\"}]}"
    return
  fi

  local npm_ver=$(npm --version 2>/dev/null || echo "unknown")
  if [[ -f "$repo/package.json" ]]; then
    local deps=$(python3 -c "import json; d=json.load(open(/package.json)); print(len(d.get('dependencies',{}))+len(d.get('devDependencies',{})))" 2>/dev/null || echo 0)
    if [[ -d "$repo/node_modules" ]]; then
      local nm_count=$(find "$repo/node_modules" -maxdepth 1 -type d 2>/dev/null | wc -l)
      [[ "$nm_count" -lt 2 ]] && { score=$((score - 20)); issues+=("{\"severity\":\"warn\",\"message\":\"node_modules parece vazio — rode npm install\"}"); }
    else
      score=$((score - 15))
      issues+=("{\"severity\":\"warn\",\"message\":\"node_modules nao encontrado — rode npm install\"}")
    fi
  else
    score=$((score - 10))
    issues+=("{\"severity\":\"info\",\"message\":\"package.json nao encontrado\"}")
  fi

  [[ "$score" -lt 0 ]] && score=0
  [[ "$score" -lt 70 ]] && status="fail"
  [[ "$score" -ge 70 && "$score" -lt 90 ]] && status="warn"

  echo "{\"checker\":\"npm\",\"status\":\"$status\",\"score\":$score,\"timestamp\":\"$(date +"%Y-%m-%dT%H:%M:%S%:z")\",\"details\":{\"npm_version\":\"$npm_ver\"},\"issues\":[${issues[*]}]}"
}
_cc_v3_check_npm
