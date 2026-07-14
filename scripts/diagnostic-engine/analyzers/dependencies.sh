#!/bin/bash
# Diagnostic Engine — Analyzer: Dependencies
# Verifica dependências do package.json contra vulnerabilidades conhecidas
set -uo pipefail

DE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$DE_DIR/lib/utils.sh"

_cc_v3_diag_analyze_dependencies() {
  local findings=()
  local pkg_file="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}/package.json"

  if [[ ! -f "$pkg_file" ]]; then
    echo "[]"
    return
  fi

  local known_vulnerable=(
    "lodash:<4.17.19"
    "minimist:<1.2.6"
    "node-fetch:<2.6.7"
    "axios:<0.21.2"
    "express:<4.17.3"
    "moment:<2.29.2"
    "glob-parent:<5.1.2"
    "jsonwebtoken:<8.5.1"
    "validator:<13.7.0"
    "protobufjs:<6.11.3"
  )

  local all_deps
  all_deps=$(jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys[]' "$pkg_file" 2>/dev/null)

  if [[ -z "$all_deps" ]]; then
    findings+=("{\"analyzer\":\"dependencies\",\"tipo\":\"info\",\"severidade\":\"info\",\"categoria\":\"deps\",\"mensagem\":\"Nenhuma dependência encontrada no package.json\"}")
    echo "[${findings[0]}]"
    return
  fi

  local outdated=0
  while IFS= read -r dep; do
    [[ -z "$dep" ]] && continue

    local current_ver
    current_ver=$(jq -r "(.dependencies[\"$dep\"] // .devDependencies[\"$dep\"] // \"\")" "$pkg_file" 2>/dev/null | sed 's/^[~^]//' | sed 's/>=\|>=\|^\|<=\|>=\|~\|>=/=')

    for vuln_entry in "${known_vulnerable[@]}"; do
      local vuln_name="${vuln_entry%%:*}"
      local vuln_ver="${vuln_entry##*:}"
      vuln_ver="${vuln_ver#<}"

      if [[ "$dep" == "$vuln_name" ]]; then
        local safe
        safe=$(printf '%s\n' "$vuln_ver" "$current_ver" | sort -V 2>/dev/null | head -1 || echo "")
        if [[ "$safe" == "$current_ver" ]] && [[ "$current_ver" != "$vuln_ver" ]]; then
          findings+=("{\"analyzer\":\"dependencies\",\"tipo\":\"warning\",\"severidade\":\"high\",\"categoria\":\"deps\",\"mensagem\":\"$dep@$current_ver é anterior a $vuln_ver (possível vulnerabilidade)\"}")
          ((outdated++))
        fi
        break
      fi
    done
  done <<< "$all_deps"

  if (( outdated > 0 )); then
    findings+=("{\"analyzer\":\"dependencies\",\"tipo\":\"info\",\"severidade\":\"info\",\"categoria\":\"deps\",\"mensagem\":\"$outdated dependências com possíveis vulnerabilidades conhecidas\"}")
  fi

  local total
  total=$(echo "$all_deps" | wc -l)
  findings+=("{\"analyzer\":\"dependencies\",\"tipo\":\"info\",\"severidade\":\"info\",\"categoria\":\"deps\",\"mensagem\":\"Total de dependências analisadas: $total\"}")

  local json="["
  local first=true
  for f in "${findings[@]}"; do
    [[ "$first" == true ]] && first=false || json+=","
    json+="$f"
  done
  json+="]"
  echo "$json"
}

_cc_v3_diag_analyze_dependencies
