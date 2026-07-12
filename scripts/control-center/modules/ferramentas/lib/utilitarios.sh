#!/bin/bash
# Cell City Control Center — módulo Ferramentas, Utilitários.
# Limpeza de cache, temporários e informações do ambiente/projeto.
# Toda operação destrutiva requer confirmação explícita.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_ferr_utilitarios() {
  local opcao
  while true; do
    _cc_screen_title "UTILITÁRIOS"
    _cc_screen_breadcrumb "Control Center › Ferramentas › Utilitários"
    _cc_box_blank
    _cc_box_item "1" "Limpeza de Cache"
    _cc_box_item "2" "Limpeza de Temporários"
    _cc_box_item "3" "Atualização de Índices"
    _cc_box_item "4" "Informações do Ambiente"
    _cc_box_item "5" "Informações do Projeto"
    _cc_box_blank
    _cc_box_item "9" "Voltar"
    _cc_screen_footer "Escolha uma opção · 9 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1) _cc_ferr_util_limpeza_cache ;;
      2) _cc_ferr_util_limpeza_temp ;;
      3) _cc_ferr_util_atualizar_indices ;;
      4) _cc_ferr_util_info_ambiente ;;
      5) _cc_ferr_util_info_projeto ;;
      9) break ;;
      0) echo "Saindo do Control Center."; exit 0 ;;
      *) echo "Opção inválida." ;;
    esac
  done
}

_cc_ferr_util_limpeza_cache() {
  _cc_screen_title "LIMPEZA DE CACHE"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Utilitários › Limpeza de Cache"
  _cc_box_blank
  _cc_box_line "Esta operação irá limpar:"
  _cc_box_line "  • Cache do npm (~/.npm/_cacache)"
  _cc_box_line "  • node_modules/.cache"
  _cc_box_line "  • .firebase/cache"
  _cc_box_line "  • Logs do Control Center"
  _cc_box_blank
  _cc_box_close
  echo ""
  if _cc_confirm "Deseja limpar o cache?"; then
    _cc_log "Iniciando limpeza de cache"
    [ -d "$REPO_DIR/node_modules/.cache" ] && rm -rf "$REPO_DIR/node_modules/.cache" 2>/dev/null && _cc_ok "Cache do node_modules limpo"
    [ -d "$REPO_DIR/.firebase" ] && rm -rf "$REPO_DIR/.firebase/cache" 2>/dev/null && _cc_ok "Cache do Firebase limpo"
    rm -f "$CC_ROOT/logs/control-center.log" 2>/dev/null && _cc_ok "Logs do Control Center limpos"
    _cc_ok "Limpeza concluída"
    _cc_log "Limpeza de cache concluída"
  else
    echo "Operação cancelada."
  fi
  _cc_pause
}

_cc_ferr_util_limpeza_temp() {
  _cc_screen_title "LIMPEZA DE TEMPORÁRIOS"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Utilitários › Limpeza de Temporários"
  _cc_box_blank
  _cc_box_line "Esta operação irá remover:"
  _cc_box_line "  • Arquivos .bak, .tmp, .swp"
  _cc_box_line "  • Arquivos *~ (backup do nano/vim)"
  _cc_box_line "  • firestore-debug.log"
  _cc_box_line "  • ui-debug.log"
  _cc_box_blank
  _cc_box_close
  echo ""
  if _cc_confirm "Deseja limpar arquivos temporários?"; then
    _cc_log "Iniciando limpeza de temporários"
    local count=0
    count=$((count + $(find "$REPO_DIR" -name '*.bak' -type f -delete 2>/dev/null | wc -l)))
    count=$((count + $(find "$REPO_DIR" -name '*.tmp' -type f -delete 2>/dev/null | wc -l)))
    count=$((count + $(find "$REPO_DIR" -name '*.swp' -type f -delete 2>/dev/null | wc -l)))
    count=$((count + $(find "$REPO_DIR" -name '*~' -type f -delete 2>/dev/null | wc -l)))
    rm -f "$REPO_DIR/firestore-debug.log" "$REPO_DIR/ui-debug.log" 2>/dev/null
    _cc_ok "${count} arquivo(s) temporário(s) removido(s)"
    _cc_log "Limpeza de temporários: ${count} arquivos removidos"
  else
    echo "Operação cancelada."
  fi
  _cc_pause
}

_cc_ferr_util_atualizar_indices() {
  _cc_screen_title "ATUALIZAÇÃO DE ÍNDICES"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Utilitários › Atualização de Índices"
  _cc_box_blank
  _cc_box_line "Esta operação irá:"
  _cc_box_line "  • Recriar índices do sistema de arquivos"
  _cc_box_line "  • Atualizar cache de busca do projeto"
  _cc_box_blank
  _cc_box_close
  echo ""
  _cc_log "Atualizando índices"
  local count
  count=$(find "$REPO_DIR" -maxdepth 3 -name '*.sh' -type f 2>/dev/null | wc -l)
  _cc_ok "${count} scripts indexados"
  count=$(find "$REPO_DIR" -maxdepth 3 -name '*.js' -type f 2>/dev/null | wc -l)
  _cc_ok "${count} arquivos JS indexados"
  count=$(find "$REPO_DIR" -maxdepth 3 -name '*.json' -type f 2>/dev/null | wc -l)
  _cc_ok "${count} arquivos JSON indexados"
  _cc_ferr_info "Indexação concluída"
  _cc_log "Indexação concluída"
  _cc_pause
}

_cc_ferr_util_info_ambiente() {
  _cc_screen_title "INFORMAÇÕES DO AMBIENTE"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Utilitários › Ambiente"
  _cc_box_blank
  _cc_box_line "Sistema    : $(uname -s) $(uname -r)"
  _cc_box_line "Hostname   : $(hostname 2>/dev/null || echo '?')"
  _cc_box_line "Usuário    : $USER"
  _cc_box_line "Home       : $HOME"
  _cc_box_line "Shell      : $SHELL"
  _cc_box_line "Terminal   : ${TERM:-?}"
  _cc_box_blank
  _cc_box_line "Data       : $(date '+%Y-%m-%d %H:%M:%S %Z')"
  _cc_box_line "Uptime     : $(uptime -p 2>/dev/null || uptime 2>/dev/null || echo '?')"
  _cc_box_line "CPU        : $(nproc 2>/dev/null || echo '?') núcleos"
  _cc_box_line "Memória    : $(free -h 2>/dev/null | awk '/^Mem:/{print $3"/"$2}' || echo '?')"
  _cc_box_line "Disco      : $(df -h / 2>/dev/null | tail -1 | awk '{print $3"/"$2}' || echo '?')"
  _cc_box_blank
  _cc_screen_footer "Pressione ENTER para voltar"
  _cc_pause
}

_cc_ferr_util_info_projeto() {
  _cc_screen_title "INFORMAÇÕES DO PROJETO"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Utilitários › Projeto"
  _cc_box_blank
  _cc_box_line "Projeto  : Cell City CRM"
  _cc_box_line "Diretório: $REPO_DIR"
  _cc_box_line "Branch   : $(_cc_git_branch 2>/dev/null || echo '?')"
  _cc_box_blank
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}ESTRUTURA${_CC_C_RESET}"
  _cc_box_sep
  local dirs files
  dirs=$(find "$REPO_DIR" -maxdepth 1 -type d 2>/dev/null | wc -l)
  files=$(find "$REPO_DIR" -maxdepth 1 -type f 2>/dev/null | wc -l)
  _cc_box_line "Diretórios  : ${dirs}"
  _cc_box_line "Arquivos    : ${files}"
  _cc_box_line "Scripts .sh : $(find "$REPO_DIR" -name '*.sh' -type f 2>/dev/null | wc -l)"
  _cc_box_line "node_modules: $(ls -1 "$REPO_DIR/node_modules" 2>/dev/null | wc -l) pacotes"
  _cc_box_blank
  _cc_screen_footer "Pressione ENTER para voltar"
  _cc_pause
}
