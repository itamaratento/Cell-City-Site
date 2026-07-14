#!/bin/bash
# Cell City V3 — Gerador Inteligente de Prompt
# Geração automática com: erros, stack, logs, arquivos, dependências, objetivo, restrições
set -uo pipefail

CC_V3_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$PG_DIR/lib/utils.sh"
source "$PG_DIR/lib/anexos.sh"

_cc_v3_prompt_gerar() {
  local modo="${1:-padrao}"
  shift
  local args=("$@")

  _cc_v3_log "info" "Prompt Generator" "Gerando prompt (modo: $modo)"

  local prompt=""
  prompt+="# CONTEXTO DO PROJETO — CELL CITY CRM\n\n"

  prompt+="## ESTADO DO SISTEMA\n"
  local branch commit
  branch=$(cd "$CC_V3_ROOT" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'N/A')
  commit=$(cd "$CC_V3_ROOT" && git log -1 --format=%h 2>/dev/null || echo 'N/A')
  prompt+="- Branch: $branch\n"
  prompt+="- Commit: $commit\n"
  prompt+="- Data: $(date '+%Y-%m-%d %H:%M')\n"

  if [[ -f "$CC_V3_ROOT/scripts/health-engine/state/health-check.json" ]]; then
    local score nivel pass fail
    score=$(jq -r '.score.geral // "N/A"' "$CC_V3_ROOT/scripts/health-engine/state/health-check.json")
    nivel=$(jq -r '.nivel // "N/A"' "$CC_V3_ROOT/scripts/health-engine/state/health-check.json")
    pass=$(jq -r '.execucao.checkers_pass // 0' "$CC_V3_ROOT/scripts/health-engine/state/health-check.json")
    fail=$(jq -r '.execucao.checkers_fail // 0' "$CC_V3_ROOT/scripts/health-engine/state/health-check.json")
    prompt+="- Health Score: $score/100 ($nivel, pass: $pass, fail: $fail)\n"
  fi

  if [[ -f "$CC_V3_ROOT/scripts/observability/state/metrics.json" ]]; then
    local mem disk
    mem=$(jq -r '.metrics.system.memory_percent // "N/A"' "$CC_V3_ROOT/scripts/observability/state/metrics.json")
    disk=$(jq -r '.metrics.system.disk_usage_percent // "N/A"' "$CC_V3_ROOT/scripts/observability/state/metrics.json")
    prompt+="- Memória: ${mem}%  Disco: ${disk}%\n"
  fi

  prompt+="\n## RESTRIÇÕES\n"
  prompt+="- Não alterar Firestore\n"
  prompt+="- Não alterar Rules\n"
  prompt+="- Não alterar banco\n"
  prompt+="- Manter compatibilidade com V2\n"
  prompt+="- Seguir padrão MPA + ES Modules\n"
  prompt+="- Zero build step\n"
  prompt+="- Zero bundler\n\n"

  local goal="" files_str="" debug=false
  local i=0
  while (( i < ${#args[@]} )); do
    case "${args[$i]}" in
      --goal) goal="${args[$((i+1))]}" ;;
      --files) files_str="${args[$((i+1))]}" ;;
      --debug) debug=true ;;
    esac
    ((i++))
  done

  if [[ -n "$goal" ]]; then
    prompt+="## MISSÃO\n$goal\n\n"
  fi

  if [[ -n "$files_str" ]]; then
    prompt+="## ARQUIVOS RELEVANTES\n"
    IFS=',' read -ra files <<< "$files_str"
    for file in "${files[@]}"; do
      file=$(echo "$file" | xargs)
      if [[ -f "$CC_V3_ROOT/$file" ]]; then
        local total_lines
        total_lines=$(wc -l < "$CC_V3_ROOT/$file")
        local max_lines=100
        if [[ "$modo" == "debug" ]] || [[ "$modo" == "revisao" ]]; then
          max_lines=300
        fi
        prompt+="### $file ($total_lines linhas)\n\`\`\`\n$(head -$max_lines "$CC_V3_ROOT/$file" 2>/dev/null)\n\`\`\`\n\n"
      fi
    done
  fi

  if [[ "$debug" == true ]] || [[ "$modo" == "debug" ]]; then
    prompt+="## LOGS\n\`\`\`\n$(_cc_v3_prompt_anexar_logs 30 2>/dev/null || echo "Nenhum log disponível")\n\`\`\`\n\n"
    prompt+="## ERROS\n\`\`\`\n$(_cc_v3_prompt_anexar_erros 2>/dev/null || echo "Nenhum erro encontrado")\n\`\`\`\n\n"
    prompt+="## TESTES\n\`\`\`\n$(_cc_v3_prompt_anexar_testes 2>/dev/null || echo "Nenhum teste encontrado")\n\`\`\`\n\n"
  fi

  prompt+="## DEPENDÊNCIAS\n"
  if [[ -f "$CC_V3_ROOT/package.json" ]]; then
    local deps
    deps=$(jq -r '.dependencies // {} | keys[]' "$CC_V3_ROOT/package.json" 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
    prompt+="- Dependências: $deps\n"
    local dev_deps
    dev_deps=$(jq -r '.devDependencies // {} | keys[]' "$CC_V3_ROOT/package.json" 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
    prompt+="- Dev Dependências: $dev_deps\n"
  fi

  prompt+="\n## RESULTADO ESPERADO\n"
  prompt+="- Código funcional e compatível com V2\n"
  prompt+="- Sem regressão nos componentes existentes\n"
  prompt+="- Seguindo padrão _cc_v3_ para nomenclatura\n"

  prompt+="\n---\n"
  prompt+="Gerado por Prompt Generator V3 em $(date '+%Y-%m-%d %H:%M:%S')\n"

  local output_dir="$PG_DIR/state"
  mkdir -p "$output_dir"
  local output_file="$output_dir/prompt-$(date +%Y%m%d_%H%M%S).md"
  echo -e "$prompt" > "$output_file"

  echo -e "$prompt"
  _cc_v3_log "info" "Prompt Generator" "Prompt salvo em $output_file"
}

_cc_v3_prompt_exportar() {
  local output="${1:-}"
  local mode="${2:-padrao}"
  shift 2 || shift || true

  local prompt
  prompt=$(_cc_v3_prompt_gerar "$mode" "$@" 2>/dev/null)

  if [[ -n "$output" ]]; then
    if [[ "$output" == "clipboard" ]]; then
      if command -v xclip &>/dev/null; then
        echo -e "$prompt" | xclip -selection clipboard
        _cc_v3_log "info" "Prompt Generator" "Prompt copiado para clipboard (xclip)"
      elif command -v xsel &>/dev/null; then
        echo -e "$prompt" | xsel --clipboard
        _cc_v3_log "info" "Prompt Generator" "Prompt copiado para clipboard (xsel)"
      elif command -v wl-copy &>/dev/null; then
        echo -e "$prompt" | wl-copy
        _cc_v3_log "info" "Prompt Generator" "Prompt copiado para clipboard (wl-copy)"
      else
        _cc_v3_log "warn" "Prompt Generator" "Nenhum clipboard tool disponível (xclip, xsel, wl-copy)"
        echo -e "$prompt"
      fi
    else
      mkdir -p "$(dirname "$output" 2>/dev/null)" 2>/dev/null || true
      echo -e "$prompt" > "$output"
      _cc_v3_log "info" "Prompt Generator" "Prompt exportado para $output"
    fi
  else
    echo -e "$prompt"
  fi
}

case "${1:-}" in
  --quick)   shift; _cc_v3_prompt_gerar "rapido" "$@" ;;
  --debug)   shift; _cc_v3_prompt_gerar "debug" "$@" ;;
  --review)  shift; _cc_v3_prompt_gerar "revisao" "$@" ;;
  --export)  shift; _cc_v3_prompt_exportar "$@" ;;
  --help|-h)
    echo "Uso: generator.sh [--quick|--debug|--review] --goal \"missão\" [--files \"caminho1,caminho2\"] [--debug]"
    echo "      generator.sh --export [<arquivo>|clipboard] [--quick|--debug|--review] [<args...>]"
    echo ""
    echo "Modos:"
    echo "  --export <destino>   Exporta prompt para arquivo ou clipboard"
    ;;
  *)         shift; _cc_v3_prompt_gerar "padrao" "$@" ;;
esac
