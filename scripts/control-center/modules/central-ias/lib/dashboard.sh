#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Dashboard das IAs
# (Fase 10 — CCC-F10-001, "Dashboard das IAs"). Somente leitura: agrega o
# Registro de Fases com o estado REAL dos módulos no disco (nunca confia
# só no status declarado — ver lib/utils.sh:_cc_cia_modulo_estado_real).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

# CRÍTICO se uma fase CONCLUÍDA tiver módulo ausente/ainda placeholder no
# disco (quebra de integridade entre o que o Registro declara e a
# realidade) — ATENÇÃO se não há quebra mas existem fases aguardando
# revisão técnica (trabalho pendente esperado) — SAUDÁVEL caso contrário.
_cc_cia_classificar_saude() {
  local status modulos slug estado criticos=0 revisao=0
  while IFS='|' read -r _ _ _ status modulos; do
    if [ "$status" = "CONCLUIDA" ] && [ "$modulos" != "-" ]; then
      IFS=',' read -ra slugs <<< "$modulos"
      for slug in "${slugs[@]}"; do
        [ "$slug" = "*" ] && continue
        estado=$(_cc_cia_modulo_estado_real "$slug")
        [ "$estado" = "IMPLEMENTADO" ] || criticos=$((criticos + 1))
      done
    fi
    [ "$status" = "AGUARDANDO_REVISAO" ] && revisao=$((revisao + 1))
  done < <(_cc_cia_fases)

  if [ "$criticos" -gt 0 ]; then
    echo "CRITICO"
  elif [ "$revisao" -gt 0 ]; then
    echo "ATENCAO"
  else
    echo "SAUDAVEL"
  fi
}

_cc_cia_dashboard() {
  local total_ias total_fases total_concluidas total_revisao total_impl total_naoiniciadas pct saude ultima

  total_ias=$(_cc_cia_ias | grep -c . || true)
  total_fases=$(_cc_cia_fases | grep -c . || true)
  total_concluidas=$(_cc_cia_fases | awk -F'|' '$4=="CONCLUIDA"' | grep -c . || true)
  total_revisao=$(_cc_cia_fases | awk -F'|' '$4=="AGUARDANDO_REVISAO"' | grep -c . || true)
  total_impl=$(_cc_cia_fases | awk -F'|' '$4=="EM_IMPLEMENTACAO"' | grep -c . || true)
  total_naoiniciadas=$(_cc_cia_fases | awk -F'|' '$4=="NAO_INICIADA"' | grep -c . || true)

  pct=0
  [ "${total_fases:-0}" -gt 0 ] && pct=$(( total_concluidas * 100 / total_fases ))

  saude=$(_cc_cia_classificar_saude)
  ultima=$(git -C "$REPO_DIR" log -1 --format='%ar' -- scripts/control-center 2>/dev/null || echo "desconhecida")

  _cc_screen_title "DASHBOARD DAS IAs"
  _cc_screen_breadcrumb "Control Center › Central de IAs"
  _cc_box_blank
  _cc_box_text "IAs cadastradas: $total_ias"
  _cc_box_text "Fases do Roadmap: $total_fases"
  _cc_box_text "Fases concluídas: $total_concluidas"
  _cc_box_text "Fases em implementação: $total_impl"
  _cc_box_text "Fases aguardando revisão: $total_revisao"
  _cc_box_text "Fases não iniciadas: $total_naoiniciadas"
  _cc_box_text "Percentual de conclusão do projeto: ${pct}%"
  _cc_box_text "Última atividade (Control Center): $ultima"
  _cc_box_blank
  _cc_box_close
  echo ""
  _cc_bar "$total_concluidas" "$total_fases"
  echo "Estado geral: $(_cc_cia_status_label "$saude")"
  _cc_cia_log "Dashboard consultado (estado geral: $saude)"
}
