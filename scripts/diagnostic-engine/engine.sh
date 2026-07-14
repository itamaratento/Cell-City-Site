#!/bin/bash
# Cell City V3 — Diagnostic Engine
# Motor de diagnóstico: automático, manual, rápido, profundo
set -uo pipefail

CC_V3_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$DE_DIR/lib/utils.sh"
source "$DE_DIR/lib/findings.sh"
source "$DE_DIR/lib/report.sh"

_cc_v3_diag_executar() {
  local tipo="${1:-completo}"
  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  _cc_v3_log "info" "Diagnostic Engine" "Iniciando diagnóstico (tipo: $tipo)"

  local analyzers=()
  case "$tipo" in
    quick)
      analyzers=("system" "git")
      ;;
    completo)
      analyzers=("system" "git" "build" "firebase" "security" "integrity")
      ;;
    deep)
      # "dependency" não existia (o arquivo é dependencies.sh) e os analyzers
      # novos structure/network não eram invocados por nenhum modo.
      analyzers=("system" "git" "build" "dependencies" "structure" "network" "firebase" "rules" "performance" "security" "integrity")
      ;;
    auto)
      analyzers=("system" "git" "build" "firebase" "security")
      ;;
  esac

  local all_findings=()
  local analyzers_executed=0

  for analyzer in "${analyzers[@]}"; do
    local analyzer_script="$DE_DIR/analyzers/$analyzer.sh"
    if [[ -f "$analyzer_script" ]]; then
      _cc_v3_log "debug" "Diagnostic Engine" "Executando analyzer: $analyzer"
      local result
      result=$(bash "$analyzer_script" 2>/dev/null || echo '[]')
      all_findings+=("$result")
      ((analyzers_executed++))
    fi
  done

  local report
  report=$(_cc_v3_diag_gerar_relatorio "$timestamp" "$tipo" "$analyzers_executed" "${all_findings[@]}")

  echo "$report" > "$DE_DIR/state/last-diagnostic.json"
  _cc_v3_log "info" "Diagnostic Engine" "Diagnóstico concluído. Analyzers: $analyzers_executed"
}

case "${1:-}" in
  --quick)  _cc_v3_diag_executar "quick" ;;
  --deep)   _cc_v3_diag_executar "deep" ;;
  --auto)   _cc_v3_diag_executar "auto" ;;
  --help|-h)
    echo "Uso: engine.sh [--quick|--deep|--auto]"
    ;;
  *)        _cc_v3_diag_executar "completo" ;;
esac
