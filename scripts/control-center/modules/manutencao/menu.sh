#!/bin/bash
# Cell City Control Center — modulo Manutencao e Higienizacao (Fase 9).
set -uo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"

source "$CC_ROOT/lib/common.sh"
source "$MODULE_DIR/engine.sh"

_cc_man_cabecalho() {
  _cc_screen_title "MANUTENÇÃO E HIGIENIZAÇÃO"
  _cc_screen_breadcrumb "Control Center › Manutenção"
}

_cc_man_exibir_menu() {
  _cc_box_blank
  _cc_box_item "1"  "Análise Geral"
  _cc_box_item "2"  "Arquivos Órfãos"
  _cc_box_item "3"  "Código Morto"
  _cc_box_item "4"  "Scripts Duplicados"
  _cc_box_item "5"  "Dependências"
  _cc_box_item "6"  "Estrutura do Projeto"
  _cc_box_item "7"  "Auditoria do .gitignore"
  _cc_box_item "8"  "Relatório de Higienização"
  _cc_box_item "9"  "Limpeza Assistida"
  _cc_box_item "10" "Executar Plano de Limpeza"
  _cc_box_item "11" "Configurações"
  _cc_box_blank
  _cc_box_item "12" "Voltar"
  _cc_screen_footer "Navegue · 12 volta · 0 sai"
}

_cc_man_exibir_resultados() {
  for resultado in "${CC_MAN_RESULTADOS[@]}"; do
    IFS='|' read -r status desc det _ _ _ <<< "$resultado"
    case "$status" in
      ok)   _cc_ok "$desc — $det" ;;
      warn) _cc_warn "$desc — $det" ;;
      fail) _cc_fail "$desc — $det" ;;
    esac
  done
}

_cc_man_exibir_resumo() {
  local d && d=$(_cc_man_duracao)
  _cc_box_blank; _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}RESUMO${_CC_C_RESET}"; _cc_box_sep
  _cc_box_line "Total : $CC_MAN_TOTAL"; _cc_box_line "OK    : $CC_MAN_OK"; _cc_box_line "Avisos: $CC_MAN_WARN"; _cc_box_line "Falhas: $CC_MAN_FAIL"
  _cc_box_blank; _cc_box_line "Status: $(_cc_man_status_label "$(_cc_man_classificar)")"
  _cc_box_line "Tempo : $d"; _cc_box_blank; _cc_box_close; echo ""
  [ "${CC_MAN_FAIL:-0}" -gt 0 ] && _cc_fail "$CC_MAN_FAIL falha(s)"
  [ "${CC_MAN_WARN:-0}" -gt 0 ] && _cc_warn "$CC_MAN_WARN aviso(s)"
  [ "${CC_MAN_FAIL:-0}" -eq 0 ] && [ "${CC_MAN_WARN:-0}" -eq 0 ] && _cc_ok "Ambiente limpo"
}

_cc_man_executar_display() {
  local cat="$1" titulo="$2"
  _cc_man_cabecalho; _cc_box_blank; _cc_box_line "Executando: $titulo..."; _cc_box_sep; _cc_box_close; echo ""
  _cc_log "Iniciando: $titulo"
  _cc_man_executar "$cat"; echo ""
  _cc_man_exibir_resultados; _cc_box_top; _cc_man_exibir_resumo
  _cc_log "Concluido: $(_cc_man_classificar)"
  _cc_pause
}

_cc_man_analise_e_limpeza() {
  _cc_man_executar_display "geral" "Analise Geral"
  [ "${#CC_MAN_ENCONTRADOS[@]}" -eq 0 ] && _cc_ok "Nenhum item encontrado para limpeza" && _cc_pause && return
  echo ""
  _cc_man_relatorio
  echo ""
  _cc_man_limpeza_assistida
  local aprovados=0
  for p in "${CC_MAN_PLANO[@]}"; do [[ "${p%%|*}" = "REMOVER" ]] && aprovados=$((aprovados + 1)); done
  [ "$aprovados" -eq 0 ] && _cc_ok "Nenhum item aprovado — fim do fluxo" && _cc_pause && return
  echo ""
  _cc_man_simular
  echo ""
  _cc_warn "PLANO DE LIMPEZA: ${aprovados} item(ns) aprovado(s)"
  _cc_confirm "Executar plano agora?" || { echo "Plano salvo. Execute em 'Executar Plano de Limpeza'."; _cc_pause; return; }
  _cc_man_executar_plano
}

_cc_man_loop() {
  while true; do
    _cc_man_cabecalho; _cc_man_exibir_menu
    read -rp "Opção: " op
    case "$op" in
      1)  _cc_man_analise_e_limpeza ;;
      2)  _cc_man_executar_display "orfaos" "Arquivos Órfãos" ;;
      3)  _cc_man_executar_display "morto" "Código Morto" ;;
      4)  _cc_man_executar_display "duplicados" "Scripts Duplicados" ;;
      5)  _cc_man_executar_display "dependencias" "Dependências" ;;
      6)  _cc_man_executar_display "estrutura" "Estrutura do Projeto" ;;
      7)  _cc_man_executar_display "gitignore" "Auditoria do .gitignore" ;;
      8)  _cc_man_executar_display "geral" "Relatório"; _cc_man_relatorio ;;
      9)  _cc_man_limpeza_assistida ;;
      10) _cc_man_executar_plano ;;
      11) _cc_man_configuracoes ;;
      12) _cc_log "Módulo Manutenção encerrado"; break ;;
      0)  echo "Saindo do Control Center."; exit 0 ;;
      *)  echo "Opção inválida." ;;
    esac
  done
}

_cc_man_configuracoes() {
  local cfg_file="$MODULE_DIR/config/scan.conf"
  mkdir -p "$(dirname "$cfg_file")" 2>/dev/null
  [ ! -f "$cfg_file" ] && echo "SCAN_DEPTH=3" > "$cfg_file" && echo "AUDIT_LEVEL=normal" >> "$cfg_file" && echo "SECURITY_LEVEL=normal" >> "$cfg_file" && echo "PROTECTED_FILES=.git,.github,firebase.json,firestore.rules" >> "$cfg_file"
  local depth audit sec
  depth=$(grep SCAN_DEPTH "$cfg_file" 2>/dev/null | cut -d= -f2 || echo "3")
  audit=$(grep AUDIT_LEVEL "$cfg_file" 2>/dev/null | cut -d= -f2 || echo "normal")
  sec=$(grep SECURITY_LEVEL "$cfg_file" 2>/dev/null | cut -d= -f2 || echo "normal")
  local opcao
  while true; do
    _cc_screen_title "CONFIGURAÇÕES"
    _cc_screen_breadcrumb "Control Center › Manutenção › Configurações"
    _cc_box_blank
    _cc_box_line "Profundidade do scan: $depth níveis"
    _cc_box_line "Nível de auditoria   : $audit"
    _cc_box_line "Nível de segurança   : $sec"
    _cc_box_blank
    _cc_box_item "1" "Alterar profundidade (1-5)"
    _cc_box_item "2" "Nível de auditoria (basico/normal/completo)"
    _cc_box_item "3" "Nível de segurança (baixo/normal/alto)"
    _cc_box_blank
    _cc_box_item "9" "Voltar"
    _cc_screen_footer "Configure o comportamento · 9 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1) read -rp "Nova profundidade (1-5): " depth; [[ "$depth" =~ ^[1-5]$ ]] && sed -i "s/SCAN_DEPTH=.*/SCAN_DEPTH=$depth/" "$cfg_file" 2>/dev/null && _cc_ok "Profundidade alterada" || _cc_warn "Valor inválido" ;;
      2) read -rp "Nível (basico/normal/completo): " audit; [[ "$audit" =~ ^(basico|normal|completo)$ ]] && sed -i "s/AUDIT_LEVEL=.*/AUDIT_LEVEL=$audit/" "$cfg_file" 2>/dev/null && _cc_ok "Nível alterado" || _cc_warn "Valor inválido" ;;
      3) read -rp "Nível (baixo/normal/alto): " sec; [[ "$sec" =~ ^(baixo|normal|alto)$ ]] && sed -i "s/SECURITY_LEVEL=.*/SECURITY_LEVEL=$sec/" "$cfg_file" 2>/dev/null && _cc_ok "Nível alterado" || _cc_warn "Valor inválido" ;;
      9) break ;;
      0) echo "Saindo do Control Center."; exit 0 ;;
      *) echo "Opção inválida." ;;
    esac
  done
}

_cc_man_loop
