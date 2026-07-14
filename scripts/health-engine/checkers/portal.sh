#!/bin/bash
# Health Engine — Checker: Portal
set -uo pipefail

HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$HE_DIR/lib/utils.sh"

_cc_v3_check_portal() {
  local repo_dir="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"
  local score=100
  local issues=()

  local portal_html="${repo_dir}/CRM/pages/portal-cliente/portal-cliente.html"
  local portal_index="${repo_dir}/CRM/pages/portal-cliente/index.html"
  local garantia="${repo_dir}/garantia.html"
  local garanti="${repo_dir}/garanti.html"
  local crm_garantia="${repo_dir}/CRM/garantia.html"

  local portal_exists=false
  local portal_nonempty=false
  local warranty_exists=false

  if [[ -f "$portal_html" ]]; then
    portal_exists=true
    if [[ -s "$portal_html" ]]; then
      portal_nonempty=true
    fi
  elif [[ -f "$portal_index" ]]; then
    portal_exists=true
    if [[ -s "$portal_index" ]]; then
      portal_nonempty=true
    fi
  else
    issues+=("{\"severity\":\"error\",\"message\":\"portal-cliente.html não encontrado\"}")
    score=$((score - 30))
  fi

  if [[ "$portal_exists" == true && "$portal_nonempty" == false ]]; then
    issues+=("{\"severity\":\"error\",\"message\":\"portal-cliente.html está vazio\"}")
    score=$((score - 20))
  fi

  if [[ -f "$garantia" ]] || [[ -f "$garanti" ]] || [[ -f "$crm_garantia" ]]; then
    warranty_exists=true
  else
    issues+=("{\"severity\":\"warn\",\"message\":\"garantia.html não encontrado (nem garanti.html)\"}")
    score=$((score - 10))
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
  "checker": "portal",
  "status": "${status}",
  "score": ${score},
  "timestamp": "$(date +"%Y-%m-%dT%H:%M:%S%:z")",
  "details": {
    "portal_cliente_html_exists": ${portal_exists},
    "portal_cliente_nonempty": ${portal_nonempty},
    "warranty_page_exists": ${warranty_exists}
  },
  "issues": ${issues_json}
}
EOF
}

_cc_v3_check_portal
