#!/bin/bash
# Health Engine — Checker: Build
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_build() {
  local repo="${REPO_DIR:-/home/cellcity/Musicas/projetos/Cell-City-Site}"
  local score=100 issues=()
  local status="pass"

  if [[ -f "$repo/scripts/release/validar-deploy.sh" ]]; then
    local deploy_ok=1
    bash "$repo/scripts/release/validar-deploy.sh" >/dev/null 2>&1 || deploy_ok=0
    if [[ "$deploy_ok" -eq 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"validar-deploy.sh encontrou problemas\"}")
      score=$((score - 30))
    fi
  else
    score=$((score - 10))
    issues+=("{\"severity\":\"info\",\"message\":\"validar-deploy.sh nao encontrado\"}")
  fi

  if [[ -d "$repo/CRM/pages" ]]; then
    local page_count=$(find "$repo/CRM/pages" -name "*.html" 2>/dev/null | wc -l)
    if [[ "$page_count" -lt 10 ]]; then
      score=$((score - 20))
      issues+=("{\"severity\":\"warn\",\"message\":\"Apenas $page_count paginas CRM encontradas\"}")
    fi
  else
    score=$((score - 30))
    issues+=("{\"severity\":\"error\",\"message\":\"Diretorio CRM/pages nao encontrado\"}")
  fi

  if [[ -f "$repo/index.html" ]]; then
    local size=$(stat -c%s "$repo/index.html" 2>/dev/null || echo 0)
    [[ "$size" -lt 100 ]] && { score=$((score - 20)); issues+=("{\"severity\":\"error\",\"message\":\"index.html parece vazio ou corrompido (${size} bytes)\"}"); }
  else
    issues+=("{\"severity\":\"error\",\"message\":\"index.html nao encontrado\"}")
    score=$((score - 40))
  fi

  [[ "$score" -lt 0 ]] && score=0
  [[ "$score" -lt 70 ]] && status="fail"
  [[ "$score" -ge 70 && "$score" -lt 90 ]] && status="warn"

  echo "{\"checker\":\"build\",\"status\":\"$status\",\"score\":$score,\"timestamp\":\"$(date +"%Y-%m-%dT%H:%M:%S%:z")\",\"details\":{\"checked\":true},\"issues\":[${issues[*]}]}"
}
_cc_v3_check_build
