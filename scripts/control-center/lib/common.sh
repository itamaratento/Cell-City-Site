#!/bin/bash
# Cell City Control Center — biblioteca de funções compartilhadas.
#
# Usada por core/menu.sh e por todo módulo em modules/*/menu.sh. Centraliza
# a UI de menu (moldura, cores, status, breadcrumb, pausa) e o log, pra
# nenhum módulo duplicar essa lógica (ver scripts/control-center/README.md,
# "Padrão de desenvolvimento", "Padrão de menus" e "Padrão de logs").
#
# Ponto único de entrada da UX (Fase 1.2): quem só faz `source` deste
# arquivo já ganha, transitivamente, cores (ui-colors.sh), moldura
# (ui-box.sh), status/git (ui-status.sh), composição de tela (ui-screen.sh)
# e widgets de interação (ui-widgets.sh) — nunca precisa dar source em cada
# um na mão.
#
# Pré-requisito: quem faz `source` deste arquivo precisa ter definido CC_ROOT
# antes (caminho absoluto de scripts/control-center/).
: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/common.sh}"
: "${CC_LOGS_DIR:=$CC_ROOT/logs}"

# shellcheck source=./ui-colors.sh
source "$CC_ROOT/lib/ui-colors.sh"
# shellcheck source=./ui-box.sh
source "$CC_ROOT/lib/ui-box.sh"
# shellcheck source=./ui-status.sh
source "$CC_ROOT/lib/ui-status.sh"
# shellcheck source=./ui-screen.sh
source "$CC_ROOT/lib/ui-screen.sh"
# shellcheck source=./ui-widgets.sh
source "$CC_ROOT/lib/ui-widgets.sh"

_cc_ok()   { echo "  ✅ $1"; }
_cc_fail() { echo "  ❌ $1"; }
_cc_warn() { echo "  ⚠️  $1"; }

_cc_pause() {
  read -rp $'\nPressione ENTER para voltar ao menu...' _dummy
}

# Log append-only em logs/control-center.log. Pasta nunca versionada com
# conteúdo real (ver .gitignore) — só a estrutura (logs/.gitkeep) acompanha
# o repositório.
_cc_log() {
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  mkdir -p "$CC_LOGS_DIR"
  echo "[$ts] $1" >> "$CC_LOGS_DIR/control-center.log"
}

# Tela padrão de módulo ainda não implementado (Fase 1 — só estrutura,
# ver ROADMAP no README.md). Toda pasta em modules/ chama isto até a Sprint
# que implementar a funcionalidade real daquele módulo. Usa os mesmos
# componentes de tela (lib/ui-screen.sh) de qualquer outra tela do Control
# Center — nenhum módulo tem uma tela com layout diferente.
_cc_placeholder() {
  local nome="$1"
  _cc_screen_title "$nome"
  _cc_screen_breadcrumb "Control Center › $nome"
  _cc_box_blank
  _cc_box_text "Módulo em construção."
  _cc_box_blank
  _cc_box_text "Estrutura preparada na Fase 1 — funcionalidade chega nas próximas fases do roadmap (ver scripts/control-center/README.md)."
  _cc_box_blank
  _cc_box_item "0" "Voltar"
  _cc_screen_footer "0 volta ao menu principal"
  _cc_log "Módulo '$nome' acessado (placeholder Fase 1)"
  _cc_pause
}
