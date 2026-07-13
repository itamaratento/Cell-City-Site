#!/bin/bash
# Prompt Generator — Anexos: logs, erros, testes, stacktrace
set -uo pipefail

_cc_v3_prompt_anexar_logs() {
  local lines="${1:-20}"

  local log_dir="${CC_V3_LOGS:-}"
  if [[ -z "$log_dir" ]] || [[ "$log_dir" == "/dev/null" ]]; then
    log_dir="$CC_V3_ROOT/logs"
  fi

  if [[ ! -d "$log_dir" ]]; then
    echo "Nenhum log disponível"
    return
  fi

  local all_logs=()
  for log in "$log_dir"/*.log; do
    [[ -f "$log" ]] && all_logs+=("$log")
  done

  if [[ ${#all_logs[@]} -eq 0 ]]; then
    local he_log="$CC_V3_ROOT/scripts/health-engine/state/health-check.json"
    if [[ -f "$he_log" ]]; then
      echo "Último health check: $(cat "$he_log" 2>/dev/null | head -5)"
    else
      echo "Nenhum log disponível"
    fi
    return
  fi

  for log in "${all_logs[@]}"; do
    echo "=== $(basename "$log") ==="
    tail -n "$lines" "$log" 2>/dev/null
    echo ""
  done
}

_cc_v3_prompt_anexar_erros() {
  local log_dir="${CC_V3_LOGS:-}"
  if [[ -z "$log_dir" ]] || [[ "$log_dir" == "/dev/null" ]]; then
    log_dir="$CC_V3_ROOT/logs"
  fi

  if [[ ! -d "$log_dir" ]]; then
    echo "Nenhum erro encontrado"
    return
  fi

  local results=()
  for log in "$log_dir"/*.log; do
    [[ -f "$log" ]] || continue
    local errors
    errors=$(grep -c "\[error\]" "$log" 2>/dev/null || echo 0)
    if (( errors > 0 )); then
      results+=("$log: $errors erros")
    fi
  done

  if [[ ${#results[@]} -eq 0 ]]; then
    echo "Nenhum erro encontrado"
  else
    printf '%s\n' "${results[@]}"
  fi
}

_cc_v3_prompt_anexar_testes() {
  local test_dirs=("$CC_V3_ROOT/tests" "$CC_V3_ROOT/__tests__" "$CC_V3_ROOT/test")
  local total=0

  for dir in "${test_dirs[@]}"; do
    if [[ -d "$dir" ]]; then
      local count
      count=$(find "$dir" -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | wc -l)
      total=$((total + count))
    fi
  done

  if [[ -f "$CC_V3_ROOT/scripts/central-modulos/test-catalogo.mjs" ]]; then
    total=$((total + 1))
  fi

  if (( total > 0 )); then
    echo "Total de arquivos de teste: $total"
    for dir in "${test_dirs[@]}"; do
      if [[ -d "$dir" ]]; then
        find "$dir" -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | head -10
      fi
    done
  else
    echo "Nenhum arquivo de teste encontrado (V3 não possui testes próprios ainda)"
  fi
}

_cc_v3_prompt_anexar_stacktrace() {
  local log_file="$1"
  if [[ ! -f "$log_file" ]]; then
    echo "Nenhum stack trace disponível"
    return
  fi
  grep -A 20 "Error\|Traceback\|FATAL" "$log_file" 2>/dev/null | head -50
}
