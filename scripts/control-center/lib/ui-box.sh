#!/bin/bash
# Cell City Control Center — padronização visual de menus/submenus
# (Fase 1.1, "Ajuste de Arquitetura — Padronização dos Menus e Submenus").
#
# Toda tela do Control Center (menu principal, submenu de módulo, tela de
# placeholder) usa exclusivamente estas funções pra desenhar a moldura —
# não deve existir tela com layout diferente. Responsivo: a largura se
# adapta ao terminal (tput cols), com teto e piso fixos pra nunca ficar
# ilegível nem, num terminal enorme, virar uma linha só de bordas.
#
# Convenção deliberada: nenhuma função aqui imprime emoji dentro da caixa.
# Emoji (✅/❌/⚠️/🚧) ocupa 2 colunas em terminais reais mas só 1 posição em
# `${#string}` — colocar um dentro da moldura desalinharia a borda direita.
# Status com emoji (ex.: _cc_ok/_cc_fail) continuam livres, mas sempre FORA
# de uma caixa (mesmo padrão que scripts/release/release-center.sh já usa).
#
# Cor ANSI (lib/ui-colors.sh) É permitida dentro da caixa — ao contrário do
# emoji, uma sequência de escape `\e[...m` não ocupa NENHUMA coluna visual,
# então _cc_box_line/_cc_box_line_center medem o texto "visível" (sem as
# sequências de escape) pra calcular o preenchimento, não `${#texto}` cru.
: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/ui-box.sh}"

_CC_BOX_MAX=56
_CC_BOX_MIN=30

_cc_term_width() {
  local cols
  cols="$(tput cols 2>/dev/null)"
  if ! [[ "$cols" =~ ^[0-9]+$ ]]; then
    cols="${COLUMNS:-80}"
  fi
  echo "$cols"
}

# Largura do CONTEÚDO da caixa (sem contar as bordas "║ "/" ║"). Toda
# função de desenho abaixo chama isto — nunca um número fixo espalhado.
_cc_box_width() {
  local largura=$(( $(_cc_term_width) - 4 ))
  [ "$largura" -gt "$_CC_BOX_MAX" ] && largura="$_CC_BOX_MAX"
  [ "$largura" -lt "$_CC_BOX_MIN" ] && largura="$_CC_BOX_MIN"
  echo "$largura"
}

_cc_box_border() {
  local esq="$1" meio="$2" dir="$3" largura traco i
  largura="$(_cc_box_width)"
  traco=""
  for ((i = 0; i < largura + 2; i++)); do traco+="$meio"; done
  printf '%s%s%s\n' "$esq" "$traco" "$dir"
}

_cc_box_top()    { _cc_box_border '╔' '═' '╗'; }
_cc_box_sep()    { _cc_box_border '╠' '═' '╣'; }
_cc_box_bottom() { _cc_box_border '╚' '═' '╝'; }

_cc_box_blank() {
  local largura
  largura="$(_cc_box_width)"
  printf '║ %*s ║\n' "$largura" ""
}

# Tamanho "visível" de uma string — desconta sequências de escape ANSI, que
# não ocupam coluna nenhuma no terminal. Usada por toda função de linha
# abaixo em vez de `${#texto}` cru. Duas famílias de sequência importam
# aqui (as únicas que lib/ui-colors.sh gera): CSI `\e[...m` (cor/negrito) e
# seleção de charset `\e(B` (parte do `tput sgr0` — comprovado na prática:
# sem cobrir isto, a linha "Status" saía 3 colunas curta na borda direita).
_cc_visible_len() {
  local limpo
  limpo="$(printf '%s' "$1" | sed -E $'s/\x1b\\[[0-9;]*m//g; s/\x1b[()][A-Za-z0-9]//g')"
  echo "${#limpo}"
}

# Uma linha de conteúdo alinhada à esquerda. Corta o texto se não couber —
# nunca estoura a moldura (só corta texto sem cor; com cor, o corte fica
# por conta de quem chama — casos de uso atuais são sempre curtos).
_cc_box_line() {
  local texto="$1" largura pad visivel
  largura="$(_cc_box_width)"
  visivel="$(_cc_visible_len "$texto")"
  if [ "$visivel" -gt "$largura" ] && [[ "$texto" != *$'\x1b'* ]]; then
    texto="${texto:0:$largura}"
    visivel="${#texto}"
  fi
  pad=$((largura - visivel))
  [ "$pad" -lt 0 ] && pad=0
  printf '║ %s%*s ║\n' "$texto" "$pad" ""
}

# Texto centralizado — usado pro título, subtítulo (versão/fase) e status.
_cc_box_line_center() {
  local texto="$1" largura total esq dir visivel
  largura="$(_cc_box_width)"
  visivel="$(_cc_visible_len "$texto")"
  if [ "$visivel" -gt "$largura" ] && [[ "$texto" != *$'\x1b'* ]]; then
    texto="${texto:0:$largura}"
    visivel="${#texto}"
  fi
  total=$((largura - visivel))
  [ "$total" -lt 0 ] && total=0
  esq=$((total / 2))
  dir=$((total - esq))
  printf '║ %*s%s%*s ║\n' "$esq" "" "$texto" "$dir" ""
}

# Quebra de linha simples por palavra, pro corpo de texto de telas sem
# menu (ex.: placeholder). Nunca corta uma palavra ao meio.
_cc_box_text() {
  local texto="$1" largura linha palavra
  largura="$(_cc_box_width)"
  linha=""
  for palavra in $texto; do
    if [ -z "$linha" ]; then
      linha="$palavra"
    elif [ $((${#linha} + 1 + ${#palavra})) -le "$largura" ]; then
      linha="$linha $palavra"
    else
      _cc_box_line "$linha"
      linha="$palavra"
    fi
  done
  [ -n "$linha" ] && _cc_box_line "$linha"
}

# Item de menu numerado: "N ► Rótulo".
_cc_box_item() {
  local numero="$1" rotulo="$2"
  _cc_box_line "${numero} ► ${rotulo}"
}

# Screen simples de uma seção só (ex.: placeholder de módulo). Menus com
# lista dinâmica de opções (menu principal, futuros submenus reais) montam
# a caixa direto com as funções acima em vez de usar isto.
_cc_box_open() {
  local titulo="$1"
  _cc_box_top
  _cc_box_line_center "$titulo"
  _cc_box_sep
  _cc_box_blank
}

_cc_box_close() {
  _cc_box_blank
  _cc_box_bottom
}
