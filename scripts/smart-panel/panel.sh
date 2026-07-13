#!/bin/bash
# Cell City V3 — Painel Inteligente (Smart Panel)
# Dashboard executivo: health score, testes, releases, backups, alertas, métricas
set -uo pipefail

CC_V3_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PANEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$PANEL_DIR/lib/widget-utils.sh"
source "$PANEL_DIR/lib/card-utils.sh"

_cc_v3_panel_renderizar() {
  local modo="${1:-dashboard}"

  _cc_v3_log "info" "Smart Panel" "Renderizando painel (modo: $modo)"

  local health_file="$CC_V3_ROOT/scripts/health-engine/state/health-check.json"
  local alert_file="$CC_V3_ROOT/scripts/monitoring/state/alert-history.json"
  local metrics_file="$CC_V3_ROOT/scripts/observability/state/metrics.json"
  local diagnostic_file="$CC_V3_ROOT/scripts/diagnostic-engine/state/last-diagnostic.json"

  local health_score=0
  local health_nivel="N/A"
  if [[ -f "$health_file" ]]; then
    health_score=$(jq -r '.score.geral // 0' "$health_file")
    health_nivel=$(jq -r '.nivel // "N/A"' "$health_file")
  fi

  local alertas_ativos=0
  if [[ -f "$alert_file" ]]; then
    alertas_ativos=$(jq '[.alertas[] | select(.resolvido == false)] | length' "$alert_file" 2>/dev/null || echo 0)
  fi

  local mem_pct=0 disk_pct=0 uptime_h=0
  if [[ -f "$metrics_file" ]]; then
    mem_pct=$(jq -r '.metrics.system.memory_percent // 0' "$metrics_file")
    disk_pct=$(jq -r '.metrics.system.disk_usage_percent // 0' "$metrics_file")
    uptime_h=$(jq -r '.metrics.system.uptime_hours // 0' "$metrics_file")
  fi

  local last_check_time=""
  if [[ -f "$health_file" ]]; then
    last_check_time=$(jq -r '.timestamp // ""' "$health_file")
  fi

  case "$modo" in
    dashboard)   _cc_v3_panel_render_dashboard "$health_score" "$health_nivel" "$alertas_ativos" "$mem_pct" "$disk_pct" "$uptime_h" "$last_check_time" ;;
    compacto)    _cc_v3_panel_render_compacto "$health_score" "$health_nivel" "$alertas_ativos" ;;
    status)      _cc_v3_panel_render_status "$health_score" "$health_nivel" "$alertas_ativos" "$mem_pct" "$disk_pct" ;;
    *)
      _cc_v3_panel_render_dashboard "$health_score" "$health_nivel" "$alertas_ativos" "$mem_pct" "$disk_pct" "$uptime_h" "$last_check_time"
      ;;
  esac
}

_cc_v3_panel_render_dashboard() {
  local health_score="$1"
  local health_nivel="$2"
  local alertas="$3"
  local mem_pct="$4"
  local disk_pct="$5"
  local uptime_h="$6"
  local last_check="$7"

  local score_cor="\033[0;32m"
  if (( health_score < 70 )); then score_cor="\033[0;33m"; fi
  if (( health_score < 50 )); then score_cor="\033[0;31m"; fi

  local mem_cor="\033[0;32m"
  if (( mem_pct > 80 )); then mem_cor="\033[0;33m"; fi
  if (( mem_pct > 90 )); then mem_cor="\033[0;31m"; fi

  local disk_cor="\033[0;32m"
  if (( disk_pct > 80 )); then disk_cor="\033[0;33m"; fi
  if (( disk_pct > 90 )); then disk_cor="\033[0;31m"; fi

  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║        CELL CITY CRM — PAINEL INTELIGENTE V3                    ║"
  echo "╠══════════════════════════════════════════════════════════════════╣"
  echo -e "║  ${score_cor}HEALTH SCORE: ${health_score}/100 (${health_nivel})\033[0m  │  Alertas: ${alertas}${reset}"
  echo "╠══════════════════════════════════════════════════════════════════╣"
  echo -e "║  ${mem_cor}Memória: ${mem_pct}% ${reset}  ${disk_cor}Disco: ${disk_pct}% ${reset}  │  Uptime: ${uptime_h}h"
  echo "╠══════════════════════════════════════════════════════════════════╣"
  echo "║  INDICADORES                                                    ║"
  echo "║  [1] Health Score     [2] Últimos Testes     [3] Últimos Commits║"
  echo "║  [4] Últimos Backups  [5] Últimos Releases   [6] Alertas       ║"
  echo "║  [7] Status Sistema   [8] Status Módulos     [9] Diagnóstico   ║"
  echo "╠══════════════════════════════════════════════════════════════════╣"
  if [[ -n "$last_check" ]]; then
    echo "║  Último health check: $last_check"
  fi
  echo "╠══════════════════════════════════════════════════════════════════╣"
  echo "║  DETALHES: [h] Health  [d] Diagnóstico  [g] Git  [m] Módulos   ║"
  echo "║  [a] Alertas  [e] Métricas  [c] Compacto  [q] Sair             ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
}

_cc_v3_panel_render_compacto() {
  local health_score="$1"
  local health_nivel="$2"
  local alertas="$3"

  local cor="\033[0;32m"
  if (( health_score < 70 )); then cor="\033[0;33m"; fi
  if (( health_score < 50 )); then cor="\033[0;31m"; fi

  echo -e "${cor}[V3 PANEL] Score: ${health_score}/100 | Nível: ${health_nivel} | Alertas: ${alertas}\033[0m"
}

_cc_v3_panel_render_status() {
  local health_score="$1"
  local health_nivel="$2"
  local alertas="$3"
  local mem_pct="$4"
  local disk_pct="$5"

  if (( health_score >= 70 )) && (( alertas == 0 )) && (( mem_pct < 80 )) && (( disk_pct < 80 )); then
    echo "SAUDAVEL"
  elif (( health_score >= 50 )); then
    echo "ATENCAO"
  else
    echo "CRITICO"
  fi
}

_cc_v3_panel_score_nivel() {
  local score="$1"
  if (( score >= 90 )); then echo "Saudável"
  elif (( score >= 70 )); then echo "Atenção"
  elif (( score >= 50 )); then echo "Crítico"
  else echo "Ruim"
  fi
}

_cc_v3_panel_health_score() {
  local health_file="$CC_V3_ROOT/scripts/health-engine/state/health-check.json"
  if [[ -f "$health_file" ]]; then
    jq '{score: .score.geral, nivel: .nivel, pass: .execucao.checkers_pass, fail: .execucao.checkers_fail, timestamp: .timestamp}' "$health_file"
  else
    echo '{"score":0,"nivel":"N/A","pass":0,"fail":0,"timestamp":""}'
  fi
}

_cc_v3_panel_metricas() {
  local metrics_file="$CC_V3_ROOT/scripts/observability/state/metrics.json"
  if [[ -f "$metrics_file" ]]; then
    jq '.metrics.system // {}' "$metrics_file"
  else
    echo '{}'
  fi
}

case "${1:-}" in
  --compact)     _cc_v3_panel_renderizar "compacto" ;;
  --status)      _cc_v3_panel_renderizar "status" ;;
  --health)      _cc_v3_panel_health_score ;;
  --metrics)     _cc_v3_panel_metricas ;;
  --help|-h)
    echo "Uso: panel.sh [--compact|--status|--health|--metrics]"
    echo ""
    echo "Modos:"
    echo "  (sem args)  Dashboard completo"
    echo "  --compact   Visão compacta (1 linha)"
    echo "  --status    Status resumido (SAUDAVEL/ATENCAO/CRITICO)"
    echo "  --health    Apenas health score (JSON)"
    echo "  --metrics   Apenas métricas (JSON)"
    ;;
  *)               _cc_v3_panel_renderizar "dashboard" ;;
esac
