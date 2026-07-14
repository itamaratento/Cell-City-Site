#!/bin/bash
# CELL CITY V3 — NOC Panel System
# Base para todos os painéis do NOC.
# Cada painel organiza widgets em layouts (grid, stacked, single).
# O painel principal é o NOC Dashboard.
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar panels/base.sh}"

_V3_PANEL_CURRENT=""
_V3_PANEL_LAYOUT="grid"

_v3_panel_register() {
  local id="$1" title="$2" layout="${3:-grid}" widget_ids="${4:-[]}"

  local meta
  meta=$(_v3_panel_new "$id" "$title" "$layout" "$widget_ids")
  meta=$(echo "$meta" | jq '. + {render_fn: "_v3_panel_render_'"$id"'"}')

  _v3_registry_register "panel" "$id" "$_V3_PANELS_DIR/${id}.sh" "$meta"
  _v3_log "info" "Panel" "Painel registrado: $id ($title, layout: $layout)"
}

_v3_panel_activate() {
  local id="$1"
  local entry
  entry=$(_v3_registry_get "panel" "$id")
  if [[ -z "$entry" ]]; then
    _v3_log "warn" "Panel" "Painel não encontrado: $id"
    return 1
  fi

  _V3_PANEL_CURRENT="$id"
  local layout
  layout=$(echo "$entry" | jq -r '.layout // "grid"')
  _V3_PANEL_LAYOUT="$layout"

  _v3_event_pub "panel.rendered" "{\"id\":\"$id\",\"layout\":\"$layout\"}"
  _v3_log "info" "Panel" "Painel ativado: $id"
}

_v3_panel_render() {
  local id="${1:-$_V3_PANEL_CURRENT}"
  local entry
  entry=$(_v3_registry_get "panel" "$id")
  if [[ -z "$entry" ]]; then
    echo "Painel não encontrado: $id"
    return 1
  fi

  local title render_fn
  title=$(echo "$entry" | jq -r '.title // "'"$id"'"')
  render_fn=$(echo "$entry" | jq -r '.render_fn // ""')

  if [[ -n "$render_fn" ]] && declare -f "$render_fn" >/dev/null 2>&1; then
    "$render_fn"
  else
    echo "Função de renderização não encontrada: $render_fn"
    return 1
  fi

  return 0
}

_v3_panel_render_grid() {
  local widget_ids_str="$1" columns="${2:-2}"
  local -a widget_ids
  IFS=',' read -ra widget_ids <<< "${widget_ids_str//[\[\]\"]/}"

  _v3_widget_refresh_all

  local total=${#widget_ids[@]}
  local col=0

  for (( i=0; i<total; i++ )); do
    local wid="${widget_ids[$i]}"
    [[ -z "$wid" ]] && continue

    if [[ $((col % columns)) -eq 0 ]]; then
      echo ""
    fi

    _v3_widget_render "$wid" 40
    ((col++))
  done
}

_v3_panel_render_stacked() {
  local widget_ids_str="$1"
  local -a widget_ids
  IFS=',' read -ra widget_ids <<< "${widget_ids_str//[\[\]\"]/}"

  _v3_widget_refresh_all

  for wid in "${widget_ids[@]}"; do
    [[ -z "$wid" ]] && continue
    echo ""
    _v3_widget_render "$wid"
  done
}

_v3_panel_loop() {
  local panel_id="$1"
  _v3_panel_activate "$panel_id"

  while true; do
    clear 2>/dev/null || echo ""
    _v3_panel_render "$panel_id"

    echo ""
    echo "  [r] Atualizar  [m] Menu V1  [q] Sair"
    read -rp "  NOC > " cmd || break

    case "$cmd" in
      r|R) continue ;;
      m|M)
        _v3_log "info" "Panel" "Alternando para Menu V1"
        bash "$CC_ROOT/core/menu.sh"
        ;;
      q|Q|0)
        _v3_log "info" "Panel" "NOC encerrado pelo usuário"
        break
        ;;
      *) echo "  Comando inválido." ;;
    esac
  done
}

_v3_panel_boot() {
  _v3_log "info" "Panel" "Panel System inicializado"
}
