#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, Configurações.
# CCC-F04-001 §13. Persiste em config/local.json, escopo isolado deste
# módulo (ver lib/utils.sh, "Config local do módulo"). Nunca afeta outro
# módulo nem o Manifesto (config/modules.conf).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_bd_configuracoes() {
  local opcao
  while true; do
    local amb_padrao dir_export verbosidade timeout
    amb_padrao=$(_cc_bd_config_get "ambiente_padrao" "não definido")
    dir_export=$(_cc_bd_config_get "diretorio_exportacao" "_reports/database")
    verbosidade=$(_cc_bd_config_get "verbosidade" "normal")
    timeout=$(_cc_bd_config_get "timeout_segundos" "15")

    _cc_screen_title "CONFIGURAÇÕES"
    _cc_screen_breadcrumb "Control Center › Banco de Dados › Configurações"
    _cc_box_blank
    _cc_box_text "Ambiente padrão: $amb_padrao"
    _cc_box_text "Diretório de exportação: $dir_export"
    _cc_box_text "Verbosidade: $verbosidade"
    _cc_box_text "Timeout (gcloud, segundos): $timeout"
    _cc_box_blank
    _cc_box_item "1" "Definir ambiente padrão (dev/prod)"
    _cc_box_item "2" "Definir diretório de exportação"
    _cc_box_item "3" "Definir verbosidade (normal/detalhada)"
    _cc_box_item "4" "Definir timeout do gcloud (segundos)"
    _cc_box_item "5" "Ver arquivo de log"
    _cc_box_item "6" "Restaurar padrões"
    _cc_box_blank
    _cc_box_item "0" "Voltar"
    _cc_screen_footer "Configurações são locais deste módulo · 0 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1)
        read -rp "Ambiente padrão (dev/prod, vazio cancela): " valor
        case "$valor" in
          dev|prod) _cc_bd_config_set "ambiente_padrao" "$valor"; _cc_ok "Ambiente padrão definido: $valor" ;;
          "") echo "Cancelado." ;;
          *) _cc_fail "Valor inválido — use dev ou prod" ;;
        esac
        _cc_pause
        ;;
      2)
        read -rp "Diretório de exportação (relativo ao repositório, vazio cancela): " valor
        if [ -n "$valor" ]; then
          _cc_bd_config_set "diretorio_exportacao" "$valor"
          _cc_ok "Diretório de exportação definido: $valor"
        else
          echo "Cancelado."
        fi
        _cc_pause
        ;;
      3)
        read -rp "Verbosidade (normal/detalhada, vazio cancela): " valor
        case "$valor" in
          normal|detalhada) _cc_bd_config_set "verbosidade" "$valor"; _cc_ok "Verbosidade definida: $valor" ;;
          "") echo "Cancelado." ;;
          *) _cc_fail "Valor inválido — use normal ou detalhada" ;;
        esac
        _cc_pause
        ;;
      4)
        read -rp "Timeout do gcloud em segundos (vazio cancela): " valor
        if [[ "$valor" =~ ^[0-9]+$ ]] && [ "$valor" -gt 0 ]; then
          _cc_bd_config_set "timeout_segundos" "$valor"
          _cc_ok "Timeout definido: ${valor}s"
        elif [ -n "$valor" ]; then
          _cc_fail "Valor inválido — informe um número inteiro positivo"
        else
          echo "Cancelado."
        fi
        _cc_pause
        ;;
      5)
        if [ -f "$CC_ROOT/logs/control-center.log" ]; then
          grep "Banco de Dados" "$CC_ROOT/logs/control-center.log" | tail -20
        else
          echo "Nenhum log encontrado ainda."
        fi
        _cc_pause
        ;;
      6)
        if _cc_confirm "Restaurar as configurações padrão deste módulo?"; then
          rm -f "$CC_BD_CONFIG_FILE"
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
