#!/bin/bash
# Smart Panel — Utilitários de card
set -uo pipefail

_cc_v3_panel_card() {
  local titulo="$1"
  local conteudo="$2"
  local cor="${3:-}"

  local reset="\033[0m"
  echo -e "${cor}┌─ ${titulo} ${reset}"
  echo "$conteudo" | while IFS= read -r line; do
    echo -e "${cor}│ ${line}${reset}"
  done
  echo -e "${cor}└${reset}"
}
