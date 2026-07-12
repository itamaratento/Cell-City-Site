#!/bin/bash
# Cell City Control Center — módulo Configurações, Configuração Geral e
# Tema (Fase 11, CCC-F11-001). Somente leitura sobre o projeto + 1
# preferência local (cores) — nunca altera comportamento de outro módulo.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_cfg_geral() {
  local versao fase
  versao=$(cat "$CC_ROOT/VERSION" 2>/dev/null || echo "?")
  fase=$(grep -oP 'CC_FASE="\K[^"]+' "$CC_ROOT/config/control-center.conf" 2>/dev/null || echo "?")
  _cc_screen_title "CONFIGURAÇÃO GERAL"
  _cc_screen_breadcrumb "Control Center › Configurações › Geral"
  _cc_box_blank
  _cc_box_line "Projeto            : Cell City CRM"
  _cc_box_line "Diretório raiz      : $REPO_DIR"
  _cc_box_line "Versão do Control Center : $versao"
  _cc_box_line "Fase atual          : $fase"
  _cc_box_line "Branch atual        : $(_cc_git_branch 2>/dev/null || echo '?')"
  _cc_box_blank
  _cc_box_text "Esta tela é somente leitura. Alterar versão/fase é feito"
  _cc_box_text "editando VERSION/config/control-center.conf diretamente"
  _cc_box_text "(ver README.md, \"Como adicionar um novo módulo\")."
  _cc_box_blank
}

_cc_cfg_tema() {
  local atual
  atual=$(_cc_cfg_config_get "tema_cores" "on")
  _cc_screen_title "TEMA E APARÊNCIA"
  _cc_screen_breadcrumb "Control Center › Configurações › Tema"
  _cc_box_blank
  _cc_box_line "Cores no terminal (preferência) : $atual"
  _cc_box_blank
  _cc_box_text "Preferência local, salva em config/local.json deste módulo."
  _cc_box_text "Ainda não é lida pelos componentes de UX (lib/ui-colors.sh) —"
  _cc_box_text "preparatória para uma Sprint futura, mesmo princípio já"
  _cc_box_text "registrado em branches.conf (Fase 5): valor informativo,"
  _cc_box_text "sem efeito colateral em nenhum outro módulo ainda."
  _cc_box_blank
  _cc_box_item "1" "Ligar cores (on)"
  _cc_box_item "2" "Desligar cores (off)"
  _cc_box_blank
  _cc_box_item "0" "Manter (não alterar)"
  read -rp "Opção: " opcao
  case "$opcao" in
    1) _cc_cfg_config_set "tema_cores" "on"; _cc_ok "Preferência salva: on" ;;
    2) _cc_cfg_config_set "tema_cores" "off"; _cc_ok "Preferência salva: off" ;;
    0) echo "Mantido: $atual" ;;
    *) echo "Opção inválida — nada alterado." ;;
  esac
}
