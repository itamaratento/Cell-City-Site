#!/bin/bash
# Cell City V3 — Health Engine
# Orquestrador principal de health checks.
# Coordena checkers, agrega resultados, calcula health score.
set -uo pipefail

CC_V3_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$HE_DIR/lib/utils.sh"
source "$HE_DIR/lib/score.sh"
source "$HE_DIR/lib/compare.sh"
source "$HE_DIR/lib/format.sh"

_cc_v3_health_executar() {
  local modo="${1:-completo}"
  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  _cc_v3_log "info" "Health Engine" "Iniciando health check (modo: $modo)"

  local checkers=()
  case "$modo" in
    quick)
      checkers=("git" "workspace" "node")
      ;;
    completo)
      checkers=("git" "workspace" "build" "node" "npm" "firebase" "firestore" "functions" "rbac" "repositories" "modules")
      ;;
    full)
      checkers=("git" "workspace" "build" "node" "npm" "firebase" "firestore" "rules" "indexes" "functions" "rbac" "repositories" "services" "shared" "modules" "dashboard" "portal" "central-modulos" "control-center" "service-worker" "backup" "logs")
      ;;
  esac

  local results=()
  local total=${#checkers[@]}
  local passed=0
  local failed=0

  for checker in "${checkers[@]}"; do
    local checker_script="$HE_DIR/checkers/$checker.sh"
    if [[ -f "$checker_script" ]]; then
      _cc_v3_log "debug" "Health Engine" "Executando checker: $checker"
      local result
      result=$(bash "$checker_script" 2>/dev/null || echo '{"checker":"'$checker'","status":"error","score":0}')
      results+=("$result")
      local status
      status=$(echo "$result" | grep -o '"status":[[:space:]]*"[^"]*"' | cut -d'"' -f4)
      if [[ "$status" == "pass" ]]; then
        ((passed++))
      else
        ((failed++))
      fi
    else
      _cc_v3_log "warn" "Health Engine" "Checker não encontrado: $checker"
    fi
  done

  local score
  score=$(_cc_v3_health_calc_score "${results[@]}")

  local report
  report=$(_cc_v3_health_gerar_relatorio "$timestamp" "$modo" "$score" "$passed" "$failed" "${results[@]}")

  echo "$report" > "$HE_DIR/state/health-check.json"
  _cc_v3_log "info" "Health Engine" "Health check concluído. Score: $score | Pass: $passed | Fail: $failed"

  if (( $(echo "$score < 70" | bc -l 2>/dev/null || echo 0) )); then
    _cc_v3_log "warn" "Health Engine" "Score abaixo do limiar: $score"
  fi
}

_cc_v3_health_executar_categoria() {
  local categoria="$1"
  if [[ -z "$categoria" ]]; then
    echo "Uso: engine.sh --category <nome>  (checkers em checkers/*.sh)" >&2
    return 1
  fi
  local checker_script="$HE_DIR/checkers/$categoria.sh"
  if [[ ! -f "$checker_script" ]]; then
    _cc_v3_log "error" "Health Engine" "Checker não encontrado: $categoria"
    return 1
  fi
  bash "$checker_script"
}

case "${1:-}" in
  --quick)
    _cc_v3_health_executar "quick"
    ;;
  --full)
    _cc_v3_health_executar "full"
    ;;
  --category)
    _cc_v3_health_executar_categoria "${2:-}"
    ;;
  --help|-h)
    echo "Uso: engine.sh [--quick|--full|--category <nome>]"
    echo ""
    echo "Modos:"
    echo "  (sem args)  Executa health check completo"
    echo "  --quick     Apenas git, workspace, node"
    echo "  --full      Todos os checkers disponíveis"
    echo "  --category  Apenas uma categoria"
    ;;
  *)
    _cc_v3_health_executar "completo"
    ;;
esac
