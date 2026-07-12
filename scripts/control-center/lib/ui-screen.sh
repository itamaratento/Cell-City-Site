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

# Motor genérico de submenu (Fase 2) — todo módulo com opções reais (não
# placeholder) chama isto em vez de escrever o próprio loop de menu, pra
# Desenvolvimento e Release (e qualquer módulo futuro) não duplicarem a
# mesma mecânica de tela. É camada de Interface pura: só desenha e
# despacha, nunca conhece a regra de negócio por trás de cada opção —
# quem chama passa o nome de uma função (camada de Serviço) por item.
#
# $1 = título da tela, $2 = breadcrumb.
# $3.. = itens no formato "numero|rótulo|nome_da_função", na ordem de
# exibição. "Voltar" é sempre o número seguinte ao último item (nunca um
# número fixo — com poucos itens pode ser "6", com muitos pode ser "14");
# "Sair" é sempre "0". Isso evita colidir com módulos que têm mais de 8
# opções reais (ver README.md, "Padrão de menus").
_cc_run_submenu() {
  local titulo="$1" breadcrumb="$2"; shift 2
  local -a itens=("$@")
  local total="${#itens[@]}" voltar_num
  voltar_num=$((total + 1))

  while true; do
    echo ""
    _cc_screen_title "$titulo"
    _cc_screen_breadcrumb "$breadcrumb"
    _cc_box_blank
    local item numero rotulo
    for item in "${itens[@]}"; do
      numero="${item%%|*}"
      rotulo="${item#*|}"; rotulo="${rotulo%%|*}"
      _cc_box_item "$numero" "$rotulo"
    done
    _cc_box_blank
    _cc_box_item "$voltar_num" "Voltar"
    _cc_box_item "0" "Sair"
    _cc_screen_footer "Escolha uma opção · $voltar_num volta · 0 sai do Control Center"
    # EOF no stdin encerra o submenu como um "Voltar" (mesma proteção
    # contra loop infinito do core/menu.sh — certificação CCC-V1.0-FINAL-001).
    read -rp "Opção: " escolha || return 0

    if [ "$escolha" = "0" ]; then
      _cc_log "Control Center encerrado (submenu '$titulo')"
      echo "Saindo do Control Center."
      exit 0
    fi
    if [ "$escolha" = "$voltar_num" ]; then
      return 0
    fi

    local encontrado=0
    for item in "${itens[@]}"; do
      numero="${item%%|*}"
      if [ "$numero" = "$escolha" ]; then
        local funcao="${item##*|}"
        echo ""
        _cc_log "Submenu '$titulo': opção $escolha ($funcao)"
        "$funcao"
        _cc_pause
        encontrado=1
        break
      fi
    done
    [ "$encontrado" -eq 0 ] && echo "Opção inválida."
  done
}
