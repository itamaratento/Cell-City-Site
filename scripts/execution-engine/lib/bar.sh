#!/bin/bash
# Execution Engine — Bar Renderer
set -uo pipefail

_cc_v3_ee_renderizar_barra() {
  local percentual="$1"
  local bloco="$2"
  local passo="$3"
  local atual="$4"
  local total="$5"

  local cols=50
  local preenchido=$(( percentual * cols / 100 ))
  local vazio=$(( cols - preenchido ))

  local barra=""
  local i=0
  while (( i < preenchido )); do ((i++)); barra+="█"; done
  while (( i < cols )); do ((i++)); barra+="░"; done

  local cor="\033[0;32m"
  if (( percentual < 50 )); then cor="\033[0;33m"
  elif (( percentual < 25 )); then cor="\033[0;31m"
  fi

  echo -ne "\r${cor}[${barra}] ${percentual}%% ${bloco:+│ ${bloco}} ${passo:+│ ${passo}} ${atual}/${total}\033[0m\033[K"
}
