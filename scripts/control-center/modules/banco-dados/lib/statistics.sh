#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, Estatísticas.
# CCC-F04-001 §10. Contagens estruturais, sempre a partir de arquivos
# locais (baixo custo, zero leitura de documentos Firestore — ver
# CLAUDE.md §9). Campos que exigiriam Admin SDK/Billing API são
# reportados honestamente como não mensuráveis, nunca estimados.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_bd_estatisticas_coletar() {
  local n_colecoes n_rules n_indices n_functions arquivo
  n_colecoes=$(_cc_bd_colecoes_conhecidas | grep -c . || true)
  n_rules=$(_cc_bd_rules_match_patterns | grep -c . || true)

  arquivo=$(_cc_bd_indexes_path)
  if [ -f "$arquivo" ] && _cc_bd_tem jq; then
    n_indices=$(jq '.indexes | length' "$arquivo" 2>/dev/null || echo "?")
  else
    n_indices="?"
  fi

  n_functions=$(_cc_bd_functions_declaradas | grep -c . || true)

  _cc_bd_info "Coleções conhecidas: $n_colecoes"
  _cc_bd_info "Blocos de Rules declarados: $n_rules"
  _cc_bd_info "Índices declarados: $n_indices"
  _cc_bd_info "Cloud Functions declaradas: $n_functions"
  _cc_bd_info "Documentos estimados: não mensurável sem Admin SDK/ADC"
  _cc_bd_info "Uso aproximado (armazenamento/leituras): não mensurável sem Cloud Billing API"
  _cc_bd_info "Data da análise: $(date '+%Y-%m-%d %H:%M:%S')"
}

_cc_bd_estatisticas() {
  _cc_bd_init
  _cc_bd_estatisticas_coletar
  _cc_bd_exibir_estatisticas
}

_cc_bd_exibir_estatisticas() {
  _cc_screen_title "ESTATÍSTICAS"
  _cc_screen_breadcrumb "Control Center › Banco de Dados"
  _cc_box_blank
  local info
  for info in "${CC_BD_INFO[@]:-}"; do
    [ -n "$info" ] && _cc_box_text "$info"
  done
  _cc_box_blank
  _cc_box_close
  _cc_log "Banco de Dados: Estatísticas geradas"
  # Sem _cc_pause aqui: chamada só pelo item "7" do menu principal via
  # _cc_run_submenu, que já pausa depois de despachar (lib/ui-screen.sh).
}
