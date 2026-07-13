#!/bin/bash
# Diagnostic Engine — Analyzer: Sistema
# Analisa recursos do sistema (CPU, memória, disco)
set -uo pipefail

_cc_v3_diag_analyze_system() {
  local findings=()

  if command -v free &>/dev/null; then
    local mem_total mem_used mem_pct
    mem_total=$(free -m | awk '/^Mem:/{print $2}')
    mem_used=$(free -m | awk '/^Mem:/{print $3}')
    mem_pct=$(( mem_used * 100 / mem_total ))
    if (( mem_pct > 80 )); then
      findings+=("{\"analyzer\":\"system\",\"tipo\":\"warning\",\"severidade\":\"medium\",\"categoria\":\"recurso\",\"mensagem\":\"Uso de memória alto: ${mem_pct}%\",\"detalhes\":{\"total_mb\":${mem_total},\"used_mb\":${mem_used},\"percentual\":${mem_pct}}}")
    fi
  fi

  if command -v df &>/dev/null; then
    local disk_pct
    disk_pct=$(df -h / | awk 'NR==2{sub(/%/,"",$5);print $5}')
    if (( disk_pct > 85 )); then
      findings+=("{\"analyzer\":\"system\",\"tipo\":\"warning\",\"severidade\":\"high\",\"categoria\":\"recurso\",\"mensagem\":\"Disco quase cheio: ${disk_pct}%\",\"detalhes\":{\"percentual\":${disk_pct}}}")
    fi
  fi

  if command -p uptime &>/dev/null; then
    local load
    load=$(uptime | grep -oP 'load average: \K[0-9.]+')
    local cores
    cores=$(nproc 2>/dev/null || echo 1)
    local load_ok
    load_ok=$(echo "$load < $cores * 2" | bc -l 2>/dev/null || echo 1)
    if [[ "$load_ok" == 0 ]]; then
      findings+=("{\"analyzer\":\"system\",\"tipo\":\"warning\",\"severidade\":\"medium\",\"categoria\":\"recurso\",\"mensagem\":\"Load average alto: ${load} (cores: ${cores})\",\"detalhes\":{\"load\":${load},\"cores\":${cores}}}")
    fi
  fi

  if [[ ${#findings[@]} -eq 0 ]]; then
    echo "[]"
  else
    local json="["
    local first=true
    for f in "${findings[@]}"; do
      [[ "$first" == true ]] && first=false || json+=","
      json+="$f"
    done
    json+="]"
    echo "$json"
  fi
}

_cc_v3_diag_analyze_system
