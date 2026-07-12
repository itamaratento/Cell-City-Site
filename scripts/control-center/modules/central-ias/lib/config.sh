#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Configurações (Fase
# 10 — CCC-F10-001, "Configurações": diretório dos documentos/diretório
# dos relatórios/verbosidade/logs/exportações). Persiste em
# config/local.json, escopo isolado deste módulo (ver lib/utils.sh) —
# nunca afeta outro módulo nem o Manifesto (../../../config/modules.conf).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_cia_configuracoes() {
  local opcao
  while true; do
    local dir_docs dir_export verbosidade logs formato
    dir_docs=$(_cc_cia_config_get "diretorio_documentos" "scripts/control-center/docs")
    dir_export=$(_cc_cia_config_get "diretorio_relatorios" "_reports/ai-center")
    verbosidade=$(_cc_cia_config_get "verbosidade" "normal")
    logs=$(_cc_cia_config_get "logs" "on")
    formato=$(_cc_cia_config_get "formato_exportacao_padrao" "txt")

    _cc_screen_title "CONFIGURAÇÕES"
    _cc_screen_breadcrumb "Control Center › Central de IAs › Configurações"
    _cc_box_blank
    _cc_box_text "Diretório dos documentos: $dir_docs"
    _cc_box_text "Diretório dos relatórios: $dir_export"
    _cc_box_text "Verbosidade: $verbosidade"
    _cc_box_text "Logs: $logs"
    _cc_box_text "Formato de exportação padrão: $formato"
    _cc_box_blank
    _cc_box_item "1" "Definir diretório de documentos"
    _cc_box_item "2" "Definir diretório de relatórios"
    _cc_box_item "3" "Definir verbosidade (normal/detalhada)"
    _cc_box_item "4" "Ativar/desativar logs (on/off)"
    _cc_box_item "5" "Definir formato de exportação padrão (txt/md/json)"
    _cc_box_item "6" "Exportar Estatísticas agora"
    _cc_box_item "7" "Ver log deste módulo"
    _cc_box_item "8" "Restaurar padrões"
    _cc_box_blank
    _cc_box_item "0" "Voltar"
    _cc_screen_footer "Configurações são locais deste módulo · 0 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1)
        read -rp "Diretório de documentos (relativo ao repositório, vazio cancela): " valor
        if [ -n "$valor" ]; then
          _cc_cia_config_set "diretorio_documentos" "$valor"
          _cc_ok "Diretório de documentos definido: $valor"
        else
          echo "Cancelado."
        fi
        _cc_pause
        ;;
      2)
        read -rp "Diretório de relatórios (relativo ao repositório, vazio cancela): " valor
        if [ -n "$valor" ]; then
          _cc_cia_config_set "diretorio_relatorios" "$valor"
          _cc_ok "Diretório de relatórios definido: $valor"
        else
          echo "Cancelado."
        fi
        _cc_pause
        ;;
      3)
        read -rp "Verbosidade (normal/detalhada, vazio cancela): " valor
        case "$valor" in
          normal|detalhada) _cc_cia_config_set "verbosidade" "$valor"; _cc_ok "Verbosidade definida: $valor" ;;
          "") echo "Cancelado." ;;
          *) _cc_fail "Valor inválido — use normal ou detalhada" ;;
        esac
        _cc_pause
        ;;
      4)
        read -rp "Logs (on/off, vazio cancela): " valor
        case "$valor" in
          on|off) _cc_cia_config_set "logs" "$valor"; _cc_ok "Logs definidos: $valor" ;;
          "") echo "Cancelado." ;;
          *) _cc_fail "Valor inválido — use on ou off" ;;
        esac
        _cc_pause
        ;;
      5)
        read -rp "Formato padrão (txt/md/json, vazio cancela): " valor
        case "$valor" in
          txt|md|json) _cc_cia_config_set "formato_exportacao_padrao" "$valor"; _cc_ok "Formato padrão definido: $valor" ;;
          "") echo "Cancelado." ;;
          *) _cc_fail "Valor inválido — use txt, md ou json" ;;
        esac
        _cc_pause
        ;;
      6)
        case "$formato" in
          md)   _cc_cia_exportar_md ;;
          json) _cc_cia_exportar_json ;;
          *)    _cc_cia_exportar_txt ;;
        esac
        _cc_pause
        ;;
      7)
        if [ -f "$CC_ROOT/logs/control-center.log" ]; then
          grep "Central de IAs" "$CC_ROOT/logs/control-center.log" | tail -20
        else
          echo "Nenhum log encontrado ainda."
        fi
        _cc_pause
        ;;
      8)
        if _cc_confirm "Restaurar as configurações padrão deste módulo?"; then
          rm -f "$CC_CIA_CONFIG_FILE"
          _cc_ok "Configurações restauradas ao padrão."
        else
          echo "Cancelado."
        fi
        _cc_pause
        ;;
      0) break ;;
      *) echo "Opção inválida." ;;
    esac
  done
}
