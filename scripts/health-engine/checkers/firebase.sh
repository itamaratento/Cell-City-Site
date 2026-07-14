#!/bin/bash
# Health Engine — Checker: Firebase
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_firebase() {
  local repo="${REPO_DIR:-/home/cellcity/Musicas/projetos/Cell-City-Site}"
  local score=100 issues=() status="pass"

  if [[ -f "$repo/firebase.json" ]]; then
    local project=$(grep -oP '"default"\s*:\s*"\K[^"]+' "$repo/.firebaserc" 2>/dev/null || echo "unknown")
    [[ "$project" == "unknown" ]] && { score=$((score - 20)); issues+=("{\"severity\":\"warn\",\"message\":\"Projeto Firebase nao identificado no .firebaserc\"}"); }
  else
    score=$((score - 30))
    issues+=("{\"severity\":\"error\",\"message\":\"firebase.json nao encontrado\"}")
  fi

  if command -v firebase &>/dev/null; then
    local fb_ver=$(firebase --version 2>/dev/null || echo "unknown")
    issues+=("{\"severity\":\"info\",\"message\":\"Firebase CLI $fb_ver disponivel\"}")
  else
    score=$((score - 15))
    issues+=("{\"severity\":\"warn\",\"message\":\"Firebase CLI nao instalado\"}")
  fi

  [[ "$score" -lt 70 ]] && status="fail"
  [[ "$score" -ge 70 && "$score" -lt 90 ]] && status="warn"

  echo "{\"checker\":\"firebase\",\"status\":\"$status\",\"score\":$score,\"timestamp\":\"$(date +"%Y-%m-%dT%H:%M:%S%:z")\",\"details\":{\"configured\":true},\"issues\":[${issues[*]}]}"
}
_cc_v3_check_firebase
