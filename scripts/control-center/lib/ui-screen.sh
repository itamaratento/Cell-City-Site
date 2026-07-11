#!/bin/bash
# Cell City Control Center — composição de tela (Fase 1.2, "UX do
# Terminal"). Componentes reutilizáveis de Cabeçalho/Rodapé/Menu — core/
# menu.sh e lib/common.sh (_cc_placeholder) montam toda tela só com estas
# funções, nunca escrevendo a moldura na mão. Evita repetir a mesma
# sequência de _cc_box_* em cada tela nova.
: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/ui-screen.sh}"

# Cabeçalho: título + subtítulo opcional (ex.: versão). Não fecha com
# separador sozinho — quem chama decide o que vem em seguida (bloco de
# status, breadcrumb, ou direto o corpo).
_cc_screen_title() {
  local titulo="$1" subtitulo="${2:-}"
  _cc_box_top
  _cc_box_line_center "$titulo"
  [ -n "$subtitulo" ] && _cc_box_line_center "$subtitulo"
}

# Bloco de identidade/status do menu principal: Projeto/Branch/Status.
_cc_screen_status_block() {
  _cc_box_sep
  _cc_box_line "Projeto : Cell City CRM"
  _cc_box_line "Branch  : $(_cc_git_branch)"
  _cc_box_line "Status  : $(_cc_projeto_status_label)"
}

# Breadcrumb (localização atual) — usado pelas telas de módulo em vez do
# bloco de status acima (que só faz sentido no menu principal).
_cc_screen_breadcrumb() {
  local caminho="$1"
  _cc_box_sep
  _cc_box_line "$caminho"
}

# Rodapé: separador + mensagem de ajuda + borda final. Toda tela termina
# assim — é o único jeito de fechar uma caixa (nunca _cc_box_bottom direto).
_cc_screen_footer() {
  local ajuda="$1"
  _cc_box_sep
  _cc_box_line "$ajuda"
  _cc_box_bottom
}
