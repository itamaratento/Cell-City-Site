#!/bin/bash
# Cell City Control Center — módulo Diagnóstico, utilitários compartilhados.
# Nenhuma regra de diagnóstico — só coleções, contadores, timestamps e
# formatação de resultados. Carregado por engine.sh antes de qualquer
# lib de verificação.
#
# Isolamento: nenhum script fora de modules/diagnostico/ chama estas
# funções — são internas do módulo.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/utils.sh}"
: "${MODULE_DIR:?MODULE_DIR precisa estar definido antes de carregar lib/utils.sh}"

CC_DIAG_STATE="$CC_ROOT/state/health-check.json"

_cc_diag_init() {
  CC_DIAG_RESULTADOS=()
  CC_DIAG_TOTAL=0
  CC_DIAG_OK=0
  CC_DIAG_WARN=0
  CC_DIAG_FAIL=0
  CC_DIAG_INICIO=$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "unknown")
  CC_DIAG_INICIO_EPOCA=$(date '+%s' 2>/dev/null || echo "0")
  _cc_log "Diagnóstico iniciado em $CC_DIAG_INICIO"
}

_cc_diag_adicionar() {
  local status="$1" descricao="$2" detalhes="${3:-}" causa="${4:-}" impacto="${5:-}" sugestao="${6:-}"
  CC_DIAG_RESULTADOS+=("${status}|${descricao}|${detalhes}|${causa}|${impacto}|${sugestao}")
  CC_DIAG_TOTAL=$((CC_DIAG_TOTAL + 1))
  case "$status" in
    ok)   CC_DIAG_OK=$((CC_DIAG_OK + 1)) ;;
    warn) CC_DIAG_WARN=$((CC_DIAG_WARN + 1)) ;;
    fail) CC_DIAG_FAIL=$((CC_DIAG_FAIL + 1)) ;;
  esac
}

_cc_diag_duracao() {
  local agora
  agora=$(date '+%s' 2>/dev/null || echo "0")
  [ "$agora" = "0" ] && echo "0s" && return
  [ "$CC_DIAG_INICIO_EPOCA" = "0" ] && echo "0s" && return
  local diff=$((agora - CC_DIAG_INICIO_EPOCA))
  local minutos=$((diff / 60))
  local segundos=$((diff % 60))
  [ "$minutos" -gt 0 ] && echo "${minutos}m${segundos}s" || echo "${segundos}s"
}

_cc_diag_classificar() {
  if [ "$CC_DIAG_FAIL" -gt 0 ]; then
    echo "CRITICO"
  elif [ "$CC_DIAG_WARN" -gt 0 ]; then
    echo "ATENCAO"
  else
    echo "OK"
  fi
}

_cc_diag_salvar_estado() {
  local classificacao timestamp duracao
  classificacao=$(_cc_diag_classificar)
  timestamp=$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')
  duracao=$(_cc_diag_duracao)
  cat > "$CC_DIAG_STATE" <<EOF
{
  "descricao": "Último health check automático (executado pelo módulo Diagnóstico).",
  "timestamp": "$timestamp",
  "status": "$classificacao",
  "duracao": "$duracao",
  "total": $CC_DIAG_TOTAL,
  "aprovados": $CC_DIAG_OK,
  "avisos": $CC_DIAG_WARN,
  "falhas": $CC_DIAG_FAIL
}
EOF
  _cc_log "Estado salvo em state/health-check.json: $classificacao"
}

_cc_diag_status_label() {
  local status="$1"
  case "$status" in
    ok)   printf '%sOK%s' "$_CC_C_VERDE" "$_CC_C_RESET" ;;
    warn) printf '%sATENÇÃO%s' "$_CC_C_AMARELO" "$_CC_C_RESET" ;;
    fail) printf '%sFALHA%s' "$_CC_C_VERMELHO" "$_CC_C_RESET" ;;
    CRITICO) printf '%sCRÍTICO%s' "$_CC_C_VERMELHO" "$_CC_C_RESET" ;;
    ATENCAO) printf '%sATENÇÃO%s' "$_CC_C_AMARELO" "$_CC_C_RESET" ;;
    OK)   printf '%sOK%s' "$_CC_C_VERDE" "$_CC_C_RESET" ;;
    *)    echo "$status" ;;
  esac
}
