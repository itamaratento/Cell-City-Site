#!/bin/bash
# Cell City V3 — Execution Engine
# Orquestrador de execução contínua com progresso, checkpoint e retomada
set -uo pipefail

CC_V3_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$EE_DIR/lib/progress.sh"
source "$EE_DIR/lib/checkpoint.sh"
source "$EE_DIR/lib/queue.sh"
source "$EE_DIR/lib/bar.sh"

_cc_v3_ee_log() {
  local level="$1"
  local component="$2"
  local message="$3"
  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  local color=""
  case "$level" in
    error|critical) color="\033[0;31m" ;;
    warn)           color="\033[0;33m" ;;
    info)           color="\033[0;32m" ;;
    debug)          color="\033[0;36m" ;;
  esac

  if [[ -t 1 ]]; then
    echo -e "${color}[${timestamp}] [${level}] [${component}] ${message}\033[0m"
  fi

  local log_file="${CC_V3_LOGS:-/dev/null}/execution-engine.log"
  if [[ -d "$(dirname "$log_file" 2>/dev/null)" ]]; then
    echo "[${timestamp}] [${level}] [${component}] ${message}" >> "$log_file"
  fi
}

_cc_v3_ee_executar_missao() {
  local missao_file="$1"
  local modo="${2:-autonomo}"

  if [[ ! -f "$missao_file" ]]; then
    _cc_v3_ee_log "error" "Execution Engine" "Missão não encontrada: $missao_file"
    return 1
  fi

  local missao_id
  missao_id=$(jq -r '.id // "unknown"' "$missao_file")
  local missao_nome
  missao_nome=$(jq -r '.nome // "Sem nome"' "$missao_file")

  _cc_v3_ee_log "info" "Execution Engine" "Iniciando missão: $missao_nome ($missao_id)"

  local checkpoint="$EE_DIR/state/checkpoint.json"
  local bloco_inicial=0
  local passo_inicial=0
  local historico="[]"

  if [[ -f "$checkpoint" ]] && [[ "$modo" != "force" ]]; then
    local cp_status
    cp_status=$(jq -r '.status // ""' "$checkpoint")
    if [[ "$cp_status" == "executando" ]] || [[ "$cp_status" == "pausado" ]]; then
      _cc_v3_ee_log "info" "Execution Engine" "Checkpoint encontrado. Retomando..."
      bloco_inicial=$(_cc_v3_ee_checkpoint_ler_bloco "$checkpoint")
      passo_inicial=$(_cc_v3_ee_checkpoint_ler_passo "$checkpoint")
      historico=$(_cc_v3_ee_checkpoint_ler_historico "$checkpoint")
    fi
  fi

  _cc_v3_ee_executar_blocos "$missao_file" "$bloco_inicial" "$passo_inicial" "$historico" "$modo"

  local status_final=$?
  if [[ $status_final -eq 0 ]]; then
    rm -f "$checkpoint"
    _cc_v3_ee_log "info" "Execution Engine" "Missão concluída: $missao_nome"
  else
    _cc_v3_ee_log "warn" "Execution Engine" "Missão interrompida: $missao_nome"
  fi
}

_cc_v3_ee_executar_blocos() {
  local missao_file="$1"
  local bloco_ini="$2"
  local passo_ini="$3"
  local historico="$4"
  local modo="$5"

  local missao_id
  missao_id=$(jq -r '.id // "unknown"' "$missao_file")

  local num_blocos
  num_blocos=$(jq '.blocos | length' "$missao_file")

  if [[ "$num_blocos" -eq 0 ]]; then
    _cc_v3_ee_log "error" "Execution Engine" "Nenhum bloco encontrado na missão"
    return 1
  fi

  local num_passos=0
  for (( b=0; b<num_blocos; b++ )); do
    local np
    np=$(jq ".blocos[$b].passos | length" "$missao_file")
    ((num_passos += np))
  done

  local passo_global=0
  for (( bloco_idx=0; bloco_idx<num_blocos; bloco_idx++ )); do
    local bloco_nome
    bloco_nome=$(jq -r ".blocos[$bloco_idx].nome // \"Bloco $bloco_idx\"" "$missao_file")
    local num_passos_bloco
    num_passos_bloco=$(jq ".blocos[$bloco_idx].passos | length" "$missao_file")

    if (( bloco_idx < bloco_ini )); then
      ((passo_global += num_passos_bloco))
      continue
    fi

    _cc_v3_ee_log "info" "Execution Engine" "Bloco: $bloco_nome"

    for (( passo_idx=0; passo_idx<num_passos_bloco; passo_idx++ )); do
      if (( bloco_idx == bloco_ini )) && (( passo_idx < passo_ini )); then
        ((passo_global++))
        continue
      fi

      local passo_id passo_cmd passo_desc
      passo_id=$(jq -r ".blocos[$bloco_idx].passos[$passo_idx].id // \"passo_$passo_idx\"" "$missao_file")
      passo_cmd=$(jq -r ".blocos[$bloco_idx].passos[$passo_idx].comando // \"\"" "$missao_file")
      passo_desc=$(jq -r ".blocos[$bloco_idx].passos[$passo_idx].descricao // \"\"" "$missao_file")

      local percentual=0
      if (( num_passos > 0 )); then
        percentual=$(( passo_global * 100 / num_passos ))
      fi

      _cc_v3_ee_renderizar_barra "$percentual" "$bloco_nome" "$passo_desc" "$passo_global" "$num_passos"

      _cc_v3_ee_log "info" "Execution Engine" "Passo ($passo_global/$num_passos): $passo_desc"

      local inicio
      inicio=$(date +%s)

      local saida=0
      if [[ -n "$passo_cmd" ]]; then
        eval "$passo_cmd" 2>/dev/null || saida=$?
      fi

      local fim
      fim=$(date +%s)
      local duracao=$((fim - inicio))

      local entrada_historico
      if [[ "$saida" -ne 0 ]]; then
        entrada_historico=$(jq -n --arg p "$passo_id" --arg d "$duracao" --arg c "$saida" '{passo: $p, status: "falha", duracao: ($d|tonumber), codigo: ($c|tonumber)}')
        _cc_v3_ee_log "warn" "Execution Engine" "Passo falhou: $passo_desc (código: $saida)"
      else
        entrada_historico=$(jq -n --arg p "$passo_id" --arg d "$duracao" '{passo: $p, status: "concluido", duracao: ($d|tonumber)}')
      fi

      historico=$(echo "$historico" | jq ". + [$entrada_historico]" 2>/dev/null || echo "[$entrada_historico]")

      _cc_v3_ee_salvar_checkpoint "$missao_id" "$bloco_idx" "$passo_idx" "$percentual" "executando" "$historico"

      ((passo_global++))
    done

    if [[ "$modo" == "manual" ]]; then
      echo -n "Pressione Enter para continuar... "
      read -r
    fi
  done

  _cc_v3_ee_salvar_checkpoint "$missao_id" "$num_blocos" "0" "100" "concluido" "$historico"
  _cc_v3_ee_renderizar_barra "100" "" "" "$num_passos" "$num_passos"
  echo

  return 0
}

_cc_v3_ee_salvar_checkpoint() {
  local missao_id="$1"
  local bloco="$2"
  local passo="$3"
  local percentual="$4"
  local status="$5"
  local historico="$6"
  local timestamp
  timestamp=$(date +"%Y-%m-%dT%H:%M:%S%:z")

  mkdir -p "$EE_DIR/state"
  jq -n \
    --arg mid "$missao_id" \
    --argjson bloco "$bloco" \
    --argjson passo "$passo" \
    --argjson pct "$percentual" \
    --arg st "$status" \
    --arg ts "$timestamp" \
    --argjson hist "$historico" \
    '{missao_id: $mid, bloco_atual: $bloco, passo_atual: $passo, percentual: $pct, status: $st, timestamp: $ts, historico: $hist}' > "$EE_DIR/state/checkpoint.json"
}

_cc_v3_ee_status() {
  local checkpoint="$EE_DIR/state/checkpoint.json"
  if [[ -f "$checkpoint" ]]; then
    _cc_v3_ee_log "info" "Execution Engine" "Status da execução:"
    local missao_id status percentual
    missao_id=$(jq -r '.missao_id // "N/A"' "$checkpoint")
    status=$(jq -r '.status // "N/A"' "$checkpoint")
    percentual=$(jq -r '.percentual // 0' "$checkpoint")
    _cc_v3_ee_log "info" "Execution Engine" "Missão: $missao_id | Status: $status | $percentual%"
  else
    _cc_v3_ee_log "info" "Execution Engine" "Nenhuma execução em andamento"
  fi
}

_cc_v3_ee_listar_missoes() {
  local missoes_dir="$EE_DIR/missions"
  if [[ -d "$missoes_dir" ]]; then
    echo "Missões disponíveis:"
    for m in "$missoes_dir"/*.json; do
      if [[ -f "$m" ]]; then
        local nome
        nome=$(jq -r '.nome // "Sem nome"' "$m")
        echo "  $(basename "$m" .json): $nome"
      fi
    done
  else
    echo "Nenhuma missão encontrada em $missoes_dir"
  fi
}

_cc_v3_ee_criar_checkpoint_manual() {
  local checkpoint="$EE_DIR/state/checkpoint.json"
  if [[ -f "$checkpoint" ]]; then
    local percentual
    percentual=$(jq -r '.percentual // 0' "$checkpoint")
    local backup="$EE_DIR/state/checkpoint-manual-$(date +%Y%m%d_%H%M%S).json"
    cp "$checkpoint" "$backup"
    _cc_v3_ee_log "info" "Execution Engine" "Checkpoint manual salvo em $backup ($percentual%)"
  else
    _cc_v3_ee_log "warn" "Execution Engine" "Nenhum checkpoint ativo para salvar"
  fi
}

case "${1:-}" in
  --run)
    shift
    _cc_v3_ee_executar_missao "${1:-}" "${2:-autonomo}"
    ;;
  --resume)
    _cc_v3_ee_executar_missao "$EE_DIR/state/checkpoint.json" "autonomo"
    ;;
  --status)
    _cc_v3_ee_status
    ;;
  --checkpoint)
    _cc_v3_ee_criar_checkpoint_manual
    ;;
  --list)
    _cc_v3_ee_listar_missoes
    ;;
  --help|-h)
    echo "Uso: engine.sh [--run <missao.json>] [--resume] [--status] [--checkpoint] [--list]"
    echo ""
    echo "Modos:"
    echo "  --run <file>          Executa missão do arquivo"
    echo "  --resume              Retoma última missão"
    echo "  --status              Status da execução atual"
    echo "  --checkpoint          Cria checkpoint manual"
    echo "  --list                Lista missões disponíveis"
    ;;
  *)
    _cc_v3_ee_status
    ;;
esac
