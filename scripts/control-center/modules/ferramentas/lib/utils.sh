#!/bin/bash
# Cell City Control Center — módulo Ferramentas, utilitários compartilhados.
# Contadores, timestamps, classificação e formatação de resultados.
# Nenhuma regra de auditoria — só coleções e formatação.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/utils.sh}"
: "${MODULE_DIR:?MODULE_DIR precisa estar definido antes de carregar lib/utils.sh}"

CC_FERR_STATE="$CC_ROOT/state/auditoria.json"

_cc_ferr_init() {
  CC_FERR_RESULTADOS=()
  CC_FERR_TOTAL=0
  CC_FERR_OK=0
  CC_FERR_WARN=0
  CC_FERR_FAIL=0
  CC_FERR_INFO=()
  CC_FERR_INICIO=$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "unknown")
  CC_FERR_INICIO_EPOCA=$(date '+%s' 2>/dev/null || echo "0")
  _cc_log "Ferramentas iniciado em $CC_FERR_INICIO"
}

_cc_ferr_adicionar() {
  local status="$1" descricao="$2" detalhes="${3:-}" causa="${4:-}" impacto="${5:-}" sugestao="${6:-}"
  CC_FERR_RESULTADOS+=("${status}|${descricao}|${detalhes}|${causa}|${impacto}|${sugestao}")
  CC_FERR_TOTAL=$((CC_FERR_TOTAL + 1))
  case "$status" in
    ok)   CC_FERR_OK=$((CC_FERR_OK + 1)) ;;
    warn) CC_FERR_WARN=$((CC_FERR_WARN + 1)) ;;
    fail) CC_FERR_FAIL=$((CC_FERR_FAIL + 1)) ;;
  esac
}

_cc_ferr_info() {
  local mensagem="$1"
  CC_FERR_INFO+=("$mensagem")
}

_cc_ferr_duracao() {
  local agora
  agora=$(date '+%s' 2>/dev/null || echo "0")
  [ "$agora" = "0" ] && echo "0s" && return
  [ "${CC_FERR_INICIO_EPOCA:-0}" = "0" ] && echo "0s" && return
  local diff=$((agora - CC_FERR_INICIO_EPOCA))
  local minutos=$((diff / 60))
  local segundos=$((diff % 60))
  [ "$minutos" -gt 0 ] && echo "${minutos}m${segundos}s" || echo "${segundos}s"
}

_cc_ferr_classificar() {
  if [ "${CC_FERR_FAIL:-0}" -gt 0 ]; then
    echo "CRITICO"
  elif [ "${CC_FERR_WARN:-0}" -gt 0 ]; then
    echo "ATENCAO"
  else
    echo "OK"
  fi
}

_cc_ferr_status_label() {
  local status="$1"
  case "$status" in
    ok)   printf '%sOK%s' "$_CC_C_VERDE" "$_CC_C_RESET" ;;
    warn) printf '%sATENÇÃO%s' "$_CC_C_AMARELO" "$_CC_C_RESET" ;;
    fail) printf '%sFALHA%s' "$_CC_C_VERMELHO" "$_CC_C_RESET" ;;
    info) printf '%sINFO%s' "$_CC_C_CIANO" "$_CC_C_RESET" ;;
    CRITICO) printf '%sCRÍTICO%s' "$_CC_C_VERMELHO" "$_CC_C_RESET" ;;
    ATENCAO) printf '%sATENÇÃO%s' "$_CC_C_AMARELO" "$_CC_C_RESET" ;;
    OK)   printf '%sOK%s' "$_CC_C_VERDE" "$_CC_C_RESET" ;;
    *)    echo "$status" ;;
  esac
}

# Persiste o resumo da última auditoria em state/auditoria.json — mesmo
# schema já declarado no arquivo (ver state/README.md), só nunca escrito
# até agora (CC_FERR_STATE existia mas nenhuma função gravava nele).
_cc_ferr_salvar_estado() {
  local tipo="$1" classificacao timestamp duracao
  classificacao=$(_cc_ferr_classificar)
  timestamp=$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')
  duracao=$(_cc_ferr_duracao)
  cat > "$CC_FERR_STATE" <<EOF
{
  "descricao": "Estado da última auditoria (executada pelo módulo Ferramentas — Fase 7).",
  "timestamp": "$timestamp",
  "status": "$classificacao",
  "tipo": "$tipo",
  "total": $CC_FERR_TOTAL,
  "aprovados": $CC_FERR_OK,
  "avisos": $CC_FERR_WARN,
  "falhas": $CC_FERR_FAIL
}
EOF
  _cc_log "Ferramentas: estado salvo em state/auditoria.json (tipo=$tipo, status=$classificacao)"
}

# Resumo + lista detalhada dos resultados da última auditoria (mesmo
# padrão visual de lib/relatorio.sh do módulo Diagnóstico) — consomem
# CC_FERR_RESULTADOS/CC_FERR_TOTAL/CC_FERR_OK/CC_FERR_WARN/CC_FERR_FAIL,
# preenchidos por _cc_ferr_adicionar() durante a auditoria.
_cc_ferr_resumo() {
  local classificacao duracao
  classificacao=$(_cc_ferr_classificar)
  duracao=$(_cc_ferr_duracao)
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}RESUMO DA AUDITORIA${_CC_C_RESET}"
  _cc_box_sep
  _cc_box_line "Projeto      : Cell City CRM"
  _cc_box_line "Branch       : $(_cc_git_branch 2>/dev/null || echo '?')"
  _cc_box_line "Status Geral : $(_cc_ferr_status_label "$classificacao")"
  _cc_box_blank
  _cc_box_line "Total     : $CC_FERR_TOTAL"
  _cc_box_line "Aprovados : $(_cc_ferr_status_label "ok") $CC_FERR_OK"
  _cc_box_line "Avisos    : $(_cc_ferr_status_label "warn") $CC_FERR_WARN"
  _cc_box_line "Falhas    : $(_cc_ferr_status_label "fail") $CC_FERR_FAIL"
  _cc_box_blank
  _cc_box_line "Tempo de Execução : $duracao"
  _cc_box_sep
  _cc_box_line_center "Classificação: $(_cc_ferr_status_label "$classificacao")"
}

_cc_ferr_detalhado() {
  local i=0 resultado status desc detalhes causa impacto sugestao
  for resultado in "${CC_FERR_RESULTADOS[@]}"; do
    IFS='|' read -r status desc detalhes causa impacto sugestao <<< "$resultado"
    i=$((i + 1))
    _cc_box_blank
    _cc_box_line "${i}. [$(_cc_ferr_status_label "$status")] ${desc}"
    if [ -n "$detalhes" ]; then
      _cc_box_line "   ${_CC_C_CIANO}Detalhes:${_CC_C_RESET} $detalhes"
    fi
    if [ "$status" = "fail" ] || [ "$status" = "warn" ]; then
      [ -n "$causa" ] && _cc_box_line "   ${_CC_C_AMARELO}Causa:${_CC_C_RESET} $causa"
      [ -n "$impacto" ] && _cc_box_line "   ${_CC_C_VERMELHO}Impacto:${_CC_C_RESET} $impacto"
      [ -n "$sugestao" ] && _cc_box_line "   ${_CC_C_VERDE}Sugestão:${_CC_C_RESET} $sugestao"
    fi
  done
}
