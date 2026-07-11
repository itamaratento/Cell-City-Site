#!/bin/bash
# Cell City Control Center — suporte a cores ANSI (Fase 1.2, "UX do
# Terminal"). Detecta capacidade do terminal uma única vez (por processo)
# e expõe variáveis prontas — quem usa nunca testa suporte a cor sozinho,
# só concatena `${_CC_C_VERDE}texto${_CC_C_RESET}`. Sem suporte (terminal
# "dumb", NO_COLOR definido, saída redirecionada pra arquivo/pipe), todas
# as variáveis ficam vazias e o texto sai normal — nunca quebra.
_cc_colors_suportadas() {
  [ -n "${NO_COLOR:-}" ] && return 1
  [ -t 1 ] || return 1
  local n
  n="$(tput colors 2>/dev/null)" || return 1
  [[ "$n" =~ ^[0-9]+$ ]] && [ "$n" -ge 8 ]
}

if _cc_colors_suportadas; then
  _CC_C_RESET="$(tput sgr0)"
  _CC_C_VERDE="$(tput setaf 2)"
  _CC_C_AMARELO="$(tput setaf 3)"
  _CC_C_VERMELHO="$(tput setaf 1)"
  _CC_C_CIANO="$(tput setaf 6)"
  _CC_C_NEGRITO="$(tput bold)"
else
  _CC_C_RESET="" _CC_C_VERDE="" _CC_C_AMARELO="" _CC_C_VERMELHO="" _CC_C_CIANO="" _CC_C_NEGRITO=""
fi
