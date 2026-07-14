#!/bin/bash
# Health Engine — Checker: Modules (CRM Pages)
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_modules() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local pages_dir="${repo_dir}/CRM/pages"

  local pages_exists=false
  local html_count=0
  local key_modules=("dashboard" "clientes" "estoque" "financeiro" "os" "config")
  local missing_key=()

  if [[ -d "$pages_dir" ]]; then
    pages_exists=true
    html_count=$(find "$pages_dir" -maxdepth 2 -type f -name "*.html" 2>/dev/null | wc -l)
    if [[ $html_count -lt 20 ]]; then
      issues+=("{\"severity\":\"warn\",\"message\":\"Menos de 20 módulos HTML encontrados: ${html_count}\"}")
      score=$((score - 15))
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"Diretório CRM/pages não encontrado\"}")
    score=$((score - 30))
  fi

  for mod in "${key_modules[@]}"; do
    if [[ -d "${pages_dir}/${mod}" ]]; then
      if [[ ! -f "${pages_dir}/${mod}/${mod}.html" && ! -f "${pages_dir}/${mod}/index.html" ]]; then
        missing_key+=("$mod")
        issues+=("{\"severity\":\"warn\",\"message\":\"Módulo chave sem HTML: ${mod}\"}")
        score=$((score - 5))
      fi
    else
      missing_key+=("$mod")
      issues+=("{\"severity\":\"warn\",\"message\":\"Módulo chave ausente: ${mod}\"}")
      score=$((score - 5))
    fi
  done

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
  "checker": "modules",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "pages_dir_exists": ${pages_exists},
    "html_module_count": ${html_count},
    "missing_key_modules": "$(IFS=,; echo "${missing_key[*]}")"
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_modules
