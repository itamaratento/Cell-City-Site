#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Estatísticas (Fase 10
# — CCC-F10-001, "Estatísticas"). Só agrega contagens que as outras telas
# deste módulo já sabem calcular individualmente — nunca duplica a lógica
# de cada uma (mesmo princípio de modules/branches-sincronizacao/lib/
# statistics.sh).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_cia_estatisticas_coletar() {
  CC_CIA_INFO=()
  local total_fases total_concluidas total_revisao total_impl total_naoiniciadas pct
  local total_pareceres total_docs total_claude total_deepseek

  total_fases=$(_cc_cia_fases | grep -c . || true)
  total_concluidas=$(_cc_cia_fases | awk -F'|' '$4=="CONCLUIDA"' | grep -c . || true)
  total_revisao=$(_cc_cia_fases | awk -F'|' '$4=="AGUARDANDO_REVISAO"' | grep -c . || true)
  total_impl=$(_cc_cia_fases | awk -F'|' '$4=="EM_IMPLEMENTACAO"' | grep -c . || true)
  total_naoiniciadas=$(_cc_cia_fases | awk -F'|' '$4=="NAO_INICIADA"' | grep -c . || true)
  total_claude=$(_cc_cia_fases | awk -F'|' '$3=="claude"' | grep -c . || true)
  total_deepseek=$(_cc_cia_fases | awk -F'|' '$3=="deepseek"' | grep -c . || true)

  pct=0
  [ "${total_fases:-0}" -gt 0 ] && pct=$(( total_concluidas * 100 / total_fases ))

  total_pareceres=$(find "$CC_ROOT/docs" -maxdepth 1 -iname 'PARECER-*.md' 2>/dev/null | grep -c . || true)
  total_docs=$(find "$CC_ROOT" -name '*.md' 2>/dev/null | grep -c . || true)

  CC_CIA_INFO+=("Fases concluídas: ${total_concluidas}/${total_fases} (${pct}%)")
  CC_CIA_INFO+=("Fases em implementação: $total_impl")
  CC_CIA_INFO+=("Fases aguardando revisão: $total_revisao")
  CC_CIA_INFO+=("Fases não iniciadas: $total_naoiniciadas")
  CC_CIA_INFO+=("Homologações (Pareceres Executivos): $total_pareceres")
  CC_CIA_INFO+=("Documentos Markdown no Control Center: $total_docs")
  CC_CIA_INFO+=("Distribuição de responsabilidades — Claude: $total_claude fase(s) · DeepSeek: $total_deepseek fase(s)")
  CC_CIA_INFO+=("Data da análise: $(date '+%Y-%m-%d %H:%M:%S')")
}

_cc_cia_estatisticas() {
  _cc_cia_estatisticas_coletar
  _cc_screen_title "ESTATÍSTICAS"
  _cc_screen_breadcrumb "Control Center › Central de IAs"
  _cc_box_blank
  local info
  for info in "${CC_CIA_INFO[@]:-}"; do
    [ -n "$info" ] && _cc_box_text "$info"
  done
  _cc_box_blank
  _cc_box_close
  _cc_cia_log "Estatísticas geradas"
}
