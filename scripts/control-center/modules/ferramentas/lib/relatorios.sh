#!/bin/bash
# Cell City Control Center — módulo Ferramentas, Relatórios.
# Gera relatórios geral, técnico, executivo, auditoria, segurança e performance.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"

_cc_ferr_gerar_relatorios() {
  _cc_ferr_menu_relatorios
}

_cc_ferr_menu_relatorios() {
  local opcao
  while true; do
    _cc_screen_title "GERAR RELATÓRIOS"
    _cc_screen_breadcrumb "Control Center › Ferramentas › Relatórios"
    _cc_box_blank
    _cc_box_item "1" "Relatório Geral (completo)"
    _cc_box_item "2" "Relatório Técnico"
    _cc_box_item "3" "Relatório Executivo"
    _cc_box_item "4" "Relatório de Auditoria"
    _cc_box_item "5" "Relatório de Segurança"
    _cc_box_item "6" "Relatório de Performance"
    _cc_box_blank
    _cc_box_item "9" "Voltar"
    _cc_screen_footer "Escolha o tipo de relatório · 9 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1) _cc_ferr_relatorio_geral ;;
      2) _cc_ferr_relatorio_tecnico ;;
      3) _cc_ferr_relatorio_executivo ;;
      4) _cc_ferr_relatorio_auditoria ;;
      5) _cc_ferr_relatorio_seguranca ;;
      6) _cc_ferr_relatorio_performance ;;
      9) break ;;
      0) echo "Saindo do Control Center."; exit 0 ;;
      *) echo "Opção inválida." ;;
    esac
  done
}

_cc_ferr_relatorio_geral() {
  _cc_screen_title "RELATÓRIO GERAL"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Relatórios › Geral"
  _cc_box_blank
  _cc_box_line "Projeto : Cell City CRM"
  _cc_box_line "Branch  : $(_cc_git_branch 2>/dev/null || echo '?')"
  _cc_box_line "Data    : $(date '+%Y-%m-%d %H:%M:%S')"
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}INFORMAÇÕES DO PROJETO${_CC_C_RESET}"
  _cc_box_sep
  local total_scripts total_dirs total_files
  total_scripts=$(find "$REPO_DIR" -name '*.sh' -type f 2>/dev/null | wc -l)
  total_dirs=$(find "$REPO_DIR" -maxdepth 1 -type d 2>/dev/null | wc -l)
  total_files=$(find "$REPO_DIR" -maxdepth 1 -type f 2>/dev/null | wc -l)
  _cc_box_line "Scripts     : ${total_scripts}"
  _cc_box_line "Diretórios  : ${total_dirs}"
  _cc_box_line "Arquivos    : ${total_files}"
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}RECURSOS DO SISTEMA${_CC_C_RESET}"
  _cc_box_sep
  _cc_box_line "SO    : $(uname -s) $(uname -r)"
  _cc_box_line "Shell : $SHELL"
  _cc_box_line "User  : $USER"
  _cc_box_blank
  _cc_screen_footer "Pressione ENTER para voltar"
  _cc_pause
}

_cc_ferr_relatorio_tecnico() {
  _cc_screen_title "RELATÓRIO TÉCNICO"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Relatórios › Técnico"
  _cc_box_blank
  _cc_box_line "Versão do Control Center: $CC_VERSION"
  _cc_box_line "Módulo : Ferramentas (Fase 7)"
  _cc_box_line "Branch : $(_cc_git_branch 2>/dev/null || echo '?')"
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}COMPONENTES${_CC_C_RESET}"
  _cc_box_sep
  _cc_box_line "Auditoria Geral     : $(find "$REPO_DIR/scripts" -name '*.sh' -type f 2>/dev/null | wc -l) scripts"
  _cc_box_line "Auditoria Segurança : $(find "$REPO_DIR" -maxdepth 3 -name '*.key' -o -name '*.pem' -o -name 'sa-key*' 2>/dev/null | wc -l) arquivos sensíveis"
  _cc_box_line "Auditoria Git       : $(git -C "$REPO_DIR" rev-list --count HEAD 2>/dev/null || echo '?') commits"
  _cc_box_line "Auditoria Firebase  : $(find "$REPO_DIR" -maxdepth 1 -name 'firebase*' -o -name '.firebase*' 2>/dev/null | wc -l) arquivos"
  _cc_box_line "Auditoria Node      : $(ls -1 "$REPO_DIR/node_modules" 2>/dev/null | wc -l) pacotes"
  _cc_box_line "Auditoria Bash      : validados"
  _cc_box_blank
  _cc_screen_footer "Pressione ENTER para voltar"
  _cc_pause
}

_cc_ferr_relatorio_executivo() {
  _cc_screen_title "RELATÓRIO EXECUTIVO"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Relatórios › Executivo"
  _cc_box_blank
  _cc_box_line "CELL CITY CONTROL CENTER"
  _cc_box_line "Relatório Executivo — $(date '+%Y-%m-%d')"
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}ESTADO GERAL${_CC_C_RESET}"
  _cc_box_sep
  local branch status
  branch=$(_cc_git_branch 2>/dev/null || echo "?")
  status=$(_cc_projeto_status_label 2>/dev/null || echo "?")
  _cc_box_line "Projeto : Cell City CRM"
  _cc_box_line "Branch  : ${branch}"
  _cc_box_line "Status  : ${status}"
  _cc_box_blank
  _cc_box_line "Módulos disponíveis:"
  _cc_box_line "  1. Desenvolvimento"
  _cc_box_line "  2. Release"
  _cc_box_line "  3. Backup e Recuperação"
  _cc_box_line "  4. Banco de Dados"
  _cc_box_line "  5. Branches e Sincronização"
  _cc_box_line "  6. Diagnóstico e Health Check"
  _cc_box_line "  7. Ferramentas, Auditorias e Relatórios"
  _cc_box_line "  8. Central das IAs"
  _cc_box_line "  9. Configurações"
  _cc_box_blank
  _cc_screen_footer "Pressione ENTER para voltar"
  _cc_pause
}

_cc_ferr_relatorio_auditoria() {
  _cc_screen_title "RELATÓRIO DE AUDITORIA"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Relatórios › Auditoria"
  _cc_box_blank
  _cc_box_line "Auditoria do Cell City CRM"
  _cc_box_line "Data: $(date '+%Y-%m-%d %H:%M')"
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}ITENS AUDITADOS${_CC_C_RESET}"
  _cc_box_sep
  _cc_box_line "✓ Estrutura do projeto"
  _cc_box_line "✓ Organização de diretórios"
  _cc_box_line "✓ Arquivos obrigatórios"
  _cc_box_line "✓ Arquivos órfãos"
  _cc_box_line "✓ Arquivos duplicados"
  _cc_box_line "✓ Arquivos vazios"
  _cc_box_line "✓ Scripts inválidos"
  _cc_box_line "✓ Permissões"
  _cc_box_line "✓ Integridade geral"
  _cc_box_blank
  _cc_box_line "${_CC_C_CIANO}Para executar a auditoria completa,${_CC_C_RESET}"
  _cc_box_line "${_CC_C_CIANO}acesse: Ferramentas › Auditoria Geral${_CC_C_RESET}"
  _cc_box_blank
  _cc_screen_footer "Pressione ENTER para voltar"
  _cc_pause
}

_cc_ferr_relatorio_seguranca() {
  _cc_screen_title "RELATÓRIO DE SEGURANÇA"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Relatórios › Segurança"
  _cc_box_blank
  _cc_box_line "Checklist de Segurança"
  _cc_box_line "Data: $(date '+%Y-%m-%d %H:%M')"
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}VERIFICAÇÕES${_CC_C_RESET}"
  _cc_box_sep
  _cc_box_line "☐ Arquivos sensíveis no repositório"
  _cc_box_line "☐ Credenciais expostas"
  _cc_box_line "☐ Tokens de API"
  _cc_box_line "☐ Chaves privadas"
  _cc_box_line "☐ Permissões inseguras"
  _cc_box_line "☐ Segredos em código"
  _cc_box_line "☐ .gitignore configurado"
  _cc_box_blank
  _cc_box_line "${_CC_C_CIANO}Execute a Auditoria de Segurança para${_CC_C_RESET}"
  _cc_box_line "${_CC_C_CIANO}resultados detalhados (Ferramentas › Opção 2)${_CC_C_RESET}"
  _cc_box_blank
  _cc_screen_footer "Pressione ENTER para voltar"
  _cc_pause
}

_cc_ferr_relatorio_performance() {
  _cc_screen_title "RELATÓRIO DE PERFORMANCE"
  _cc_screen_breadcrumb "Control Center › Ferramentas › Relatórios › Performance"
  _cc_box_blank
  _cc_box_line "Performance do Control Center"
  _cc_box_line "Data: $(date '+%Y-%m-%d %H:%M')"
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}MÉTRICAS${_CC_C_RESET}"
  _cc_box_sep
  _cc_box_line "SO           : $(uname -s) $(uname -r)"
  _cc_box_line "Kernel       : $(uname -r)"
  _cc_box_line "Memória      : $(free -h 2>/dev/null | awk '/^Mem:/{print $2}' || echo '?')"
  _cc_box_line "CPU          : $(nproc 2>/dev/null || echo '?') núcleos"
  _cc_box_line "Disco        : $(df -h / 2>/dev/null | tail -1 | awk '{print $4}' || echo '?') disponível"
  _cc_box_blank
  _cc_box_line "${_CC_C_CIANO}Para dados detalhados de performance,${_CC_C_RESET}"
  _cc_box_line "${_CC_C_CIANO}utilize o módulo Diagnóstico (opção 6)${_CC_C_RESET}"
  _cc_box_blank
  _cc_screen_footer "Pressione ENTER para voltar"
  _cc_pause
}
