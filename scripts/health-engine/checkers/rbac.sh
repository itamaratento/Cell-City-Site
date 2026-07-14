#!/bin/bash
# Health Engine — Checker: RBAC
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_rbac() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local rbac_dir="${repo_dir}/tests/rbac"
  local fs_rules="${repo_dir}/CRM/firestore.rules"

  local rbac_dir_exists=false
  local test_file_count=0
  local role_patterns=0
  local role_types=()

  if [[ -d "$rbac_dir" ]]; then
    rbac_dir_exists=true
    test_file_count=$(find "$rbac_dir" -maxdepth 1 -type f -name "*.test.mjs" 2>/dev/null | wc -l)
    if [[ $test_file_count -lt 5 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Poucos arquivos de teste RBAC: ${test_file_count}\"}")
      score=$((score - 10))
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"Diretório tests/rbac não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ -f "$fs_rules" ]]; then
    role_patterns=$(grep -cE "request\.auth\." "$fs_rules" 2>/dev/null || true)
    if [[ $role_patterns -eq 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Nenhum padrão de controle de acesso (request.auth) encontrado nas regras\"}")
      score=$((score - 15))
    fi
    local role_check
    role_check=$(grep -cE "role|permission|nivel|acesso" "$fs_rules" 2>/dev/null || true)
    if [[ $role_check -eq 0 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Nenhuma referência a roles/permissions nas regras\"}")
      score=$((score - 10))
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"CRM/firestore.rules não encontrado para verificação RBAC\"}")
    score=$((score - 25))
  fi

  if [[ $score -lt 0 ]]; then score=0; fi
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
  "checker": "rbac",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "rbac_test_dir_exists": ${rbac_dir_exists},
    "test_file_count": ${test_file_count},
    "auth_patterns_in_rules": ${role_patterns}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_rbac
