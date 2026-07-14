#!/bin/bash
# Diagnostic Engine — Analyzer: Network
# Verifica URLs do GitHub Pages e conectividade
set -uo pipefail

DE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$DE_DIR/lib/utils.sh"

_cc_v3_diag_analyze_network() {
  local findings=()

  local cname_file="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}/CNAME"
  local urls=()

  if [[ -f "$cname_file" ]]; then
    local domain
    domain=$(cat "$cname_file" 2>/dev/null | head -1 | xargs)
    if [[ -n "$domain" ]]; then
      urls+=("https://$domain")
      urls+=("https://${domain#www.}")
    fi
  fi

  urls+=("https://cell-city-crm.web.app")
  urls+=("https://cell-city-crm.firebaseapp.com")

  for url in "${urls[@]}"; do
    local code
    if command -v curl &>/dev/null; then
      code=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
    elif command -v wget &>/dev/null; then
      code=$(wget --spider --server-response --timeout=10 "$url" 2>&1 | grep -oP 'HTTP/\d\.\d \K\d+' | tail -1 || echo "000")
    else
      code="SKIP"
    fi

    if [[ "$code" == "SKIP" ]]; then
      findings+=("{\"analyzer\":\"network\",\"tipo\":\"info\",\"severidade\":\"info\",\"categoria\":\"rede\",\"mensagem\":\"Sem curl/wget para verificar $url\"}")
    elif [[ "$code" =~ ^2[0-9][0-9]$ ]] || [[ "$code" =~ ^3[0-9][0-9]$ ]]; then
      findings+=("{\"analyzer\":\"network\",\"tipo\":\"info\",\"severidade\":\"info\",\"categoria\":\"rede\",\"mensagem\":\"$url respondeu com HTTP $code\"}")
    else
      findings+=("{\"analyzer\":\"network\",\"tipo\":\"error\",\"severidade\":\"high\",\"categoria\":\"rede\",\"mensagem\":\"$url respondeu com HTTP $code\"}")
    fi
  done

  if [[ ${#findings[@]} -eq 0 ]]; then
    echo "[]"
    return
  fi

  local json="["
  local first=true
  for f in "${findings[@]}"; do
    [[ "$first" == true ]] && first=false || json+=","
    json+="$f"
  done
  json+="]"
  echo "$json"
}

_cc_v3_diag_analyze_network
