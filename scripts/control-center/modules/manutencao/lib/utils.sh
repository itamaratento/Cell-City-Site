#!/bin/bash
# Module Manutencao e Higienizacao — utilitarios, classificacao, plano de limpeza.
set -uo pipefail
: "${CC_ROOT:?}"; : "${MODULE_DIR:?}"

CC_MAN_STATE="$CC_ROOT/state/manutencao.json"
CC_MAN_ENCONTRADOS=(); CC_MAN_REMOVIDOS=0; CC_MAN_ESPACO=0
CC_MAN_PLANO=(); CC_MAN_BLOQUEADOS=()
CC_MAN_ITENS_CLASSIFICADOS=()

# Lista de protecao — nunca remover sem confirmacao explicita
_CC_PROTEGIDOS=(
  ".git" ".github" ".gitattributes" ".gitignore"
  "firebase.json" "firestore.rules" "firestore.indexes.json" "storage.rules"
  "package.json" "package-lock.json" "yarn.lock"
  "README.md" "LICENSE" "CNAME" "robots.txt"
)

_cc_man_init() {
  CC_MAN_RESULTADOS=(); CC_MAN_TOTAL=0; CC_MAN_OK=0; CC_MAN_WARN=0; CC_MAN_FAIL=0
  CC_MAN_ENCONTRADOS=(); CC_MAN_REMOVIDOS=0; CC_MAN_ESPACO=0
  CC_MAN_PLANO=(); CC_MAN_BLOQUEADOS=(); CC_MAN_ITENS_CLASSIFICADOS=()
  CC_MAN_INICIO=$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "unknown")
  CC_MAN_INICIO_EPOCA=$(date '+%s' 2>/dev/null || echo "0")
  _cc_log "Manutencao iniciada em $CC_MAN_INICIO"
}

_cc_man_adicionar() {
  local status="$1" desc="$2" det="${3:-}" causa="${4:-}" impacto="${5:-}" sug="${6:-}"
  CC_MAN_RESULTADOS+=("${status}|${desc}|${det}|${causa}|${impacto}|${sug}")
  CC_MAN_TOTAL=$((CC_MAN_TOTAL + 1))
  case "$status" in ok) CC_MAN_OK=$((CC_MAN_OK + 1)) ;; warn) CC_MAN_WARN=$((CC_MAN_WARN + 1)) ;; fail) CC_MAN_FAIL=$((CC_MAN_FAIL + 1)) ;; esac
}

_cc_man_encontrar() { CC_MAN_ENCONTRADOS+=("$1"); }
_cc_man_bloquear() { local f="$1" r="$2"; CC_MAN_BLOQUEADOS+=("$f|$r"); }

# Classificar item: CRITICO, ALTO, MEDIO, BAIXO, INFORMATIVO
_cc_man_classificar_item() {
  local arquivo="$1" razao="$2"
  local nome
  nome=$(basename "$arquivo")
  local nivel="INFORMATIVO"
  for p in "${_CC_PROTEGIDOS[@]}"; do
    [[ "$nome" == "$p" ]] && nivel="CRITICO" && break
  done
  [[ "$razao" == *chave* ]] || [[ "$razao" == *token* ]] || [[ "$razao" == *credential* ]] && [ "$nivel" != "CRITICO" ] && nivel="ALTO"
  [[ "$razao" == *backup* ]] && [ "$nivel" = "INFORMATIVO" ] && nivel="BAIXO"
  [[ "$razao" == *temporario* ]] || [[ "$razao" == *cache* ]] && [ "$nivel" = "INFORMATIVO" ] && nivel="BAIXO"
  [[ "$razao" == *vazio* ]] && [ "$nivel" = "INFORMATIVO" ] && nivel="INFORMATIVO"
  [[ "$razao" == *morte* ]] || [[ "$razao" == *nao_utilizada* ]] && [ "$nivel" = "INFORMATIVO" ] && nivel="MEDIO"
  CC_MAN_ITENS_CLASSIFICADOS+=("$nivel|$arquivo|$razao")
}

_cc_man_eh_protegido() {
  local nome
  nome=$(basename "$1")
  for p in "${_CC_PROTEGIDOS[@]}"; do
    [[ "$nome" == "$p" ]] && return 0
  done
  return 1
}

# Adicionar ao plano de limpeza (apenas se aprovado e nao protegido)
_cc_man_plano_adicionar() {
  local acao="$1" alvo="$2" descricao="$3"
  CC_MAN_PLANO+=("${acao}|${alvo}|${descricao}")
}

_cc_man_duracao() {
  local agora diff
  agora=$(date '+%s' 2>/dev/null || echo "0")
  [ "$agora" = "0" ] || [ "${CC_MAN_INICIO_EPOCA:-0}" = "0" ] && echo "0s" && return
  diff=$((agora - CC_MAN_INICIO_EPOCA))
  local min=$((diff / 60)) seg=$((diff % 60))
  [ "$min" -gt 0 ] && echo "${min}m${seg}s" || echo "${seg}s"
}

_cc_man_classificar() {
  [ "${CC_MAN_FAIL:-0}" -gt 0 ] && echo "CRITICO" && return
  [ "${CC_MAN_WARN:-0}" -gt 0 ] && echo "ATENCAO" && return
  echo "OK"
}

_cc_man_status_label() {
  local s="$1"
  case "$s" in
    ok) printf '%sOK%s' "$_CC_C_VERDE" "$_CC_C_RESET" ;;
    warn) printf '%sATENÇÃO%s' "$_CC_C_AMARELO" "$_CC_C_RESET" ;;
    fail|CRITICO) printf '%s%s%s' "$_CC_C_VERMELHO" "$s" "$_CC_C_RESET" ;;
    ALTO)  printf '%s%s%s' "$_CC_C_VERMELHO" "$s" "$_CC_C_RESET" ;;
    MEDIO) printf '%s%s%s' "$_CC_C_AMARELO" "$s" "$_CC_C_RESET" ;;
    BAIXO|INFORMATIVO) printf '%s%s%s' "$_CC_C_CIANO" "$s" "$_CC_C_RESET" ;;
    ATENCAO) printf '%sATENÇÃO%s' "$_CC_C_AMARELO" "$_CC_C_RESET" ;;
    OK) printf '%sOK%s' "$_CC_C_VERDE" "$_CC_C_RESET" ;;
    *) echo "$s" ;;
  esac
}

# Persiste o resumo da última análise/limpeza em state/manutencao.json —
# mesmo schema já declarado no arquivo (a versão original declarava
# CC_MAN_STATE mas nunca escrevia nele; um stub morto
# _cc_man_classificar_estado foi removido nesta homologação).
_cc_man_salvar_estado() {
  local classificacao timestamp
  classificacao=$(_cc_man_classificar)
  timestamp=$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')
  local lista="" sep=""
  for f in "${CC_MAN_ENCONTRADOS[@]}"; do
    lista="${lista}${sep}\"$(basename "$f" | sed 's/"/\\"/g')\"" && sep=","
  done
  cat > "$CC_MAN_STATE" <<EOF
{
  "descricao": "Estado da última higienização (módulo Manutenção — Fase 9).",
  "timestamp": "$timestamp",
  "status": "$classificacao",
  "total": ${CC_MAN_TOTAL:-0},
  "aprovados": ${CC_MAN_OK:-0},
  "avisos": ${CC_MAN_WARN:-0},
  "falhas": ${CC_MAN_FAIL:-0},
  "encontrados": [${lista}],
  "removidos": ${CC_MAN_REMOVIDOS:-0},
  "espaco_recuperado": ${CC_MAN_ESPACO:-0}
}
EOF
  _cc_log "Manutencao: estado salvo em state/manutencao.json ($classificacao)"
}
