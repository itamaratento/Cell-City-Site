#!/bin/bash
# Cell City Control Center — módulo Configurações, Logs (Fase 11,
# CCC-F11-001). Preferência de verbosidade/retenção (informativa — a
# limpeza real de logs continua sendo Ferramentas › Utilitários, nunca
# duplicada aqui) + visualização do log real.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"

_cc_cfg_logs() {
  local opcao verbosidade retencao tamanho
  while true; do
    verbosidade=$(_cc_cfg_config_get "logs_verbosidade" "normal")
    retencao=$(_cc_cfg_config_get "logs_retencao_dias" "30")
    if [ -f "$CC_ROOT/logs/control-center.log" ]; then
      tamanho=$(du -h "$CC_ROOT/logs/control-center.log" 2>/dev/null | cut -f1)
    else
      tamanho="(nenhum log ainda)"
    fi

    _cc_screen_title "LOGS"
    _cc_screen_breadcrumb "Control Center › Configurações › Logs"
    _cc_box_blank
    _cc_box_line "Verbosidade (preferência)  : $verbosidade"
    _cc_box_line "Retenção (preferência, dias): $retencao"
    _cc_box_line "Tamanho atual do log        : ${tamanho:-?}"
    _cc_box_blank
    _cc_box_item "1" "Definir verbosidade (normal/detalhada)"
    _cc_box_item "2" "Definir retenção (dias)"
    _cc_box_item "3" "Ver últimas 20 linhas do log"
    _cc_box_blank
    _cc_box_item "0" "Voltar"
    _cc_screen_footer "Limpeza real de logs: Ferramentas › Utilitários · 0 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1)
        read -rp "Verbosidade (normal/detalhada, vazio cancela): " valor
        case "$valor" in
          normal|detalhada) _cc_cfg_config_set "logs_verbosidade" "$valor"; _cc_ok "Verbosidade definida: $valor" ;;
          "") echo "Cancelado." ;;
          *) _cc_fail "Valor inválido — use normal ou detalhada" ;;
        esac
        _cc_pause
        ;;
      2)
        read -rp "Retenção em dias (vazio cancela): " valor
        if [[ "$valor" =~ ^[0-9]+$ ]] && [ "$valor" -gt 0 ]; then
          _cc_cfg_config_set "logs_retencao_dias" "$valor"
          _cc_ok "Retenção definida: ${valor} dia(s)"
        elif [ -n "$valor" ]; then
          _cc_fail "Valor inválido — informe um número inteiro positivo"
        else
          echo "Cancelado."
        fi
        _cc_pause
        ;;
      3)
        echo ""
        if [ -f "$CC_ROOT/logs/control-center.log" ]; then
          tail -20 "$CC_ROOT/logs/control-center.log"
        else
          echo "Nenhum log encontrado ainda."
        fi
        _cc_pause
        ;;
      0) break ;;
      *) echo "Opção inválida." ;;
    esac
  done
}
