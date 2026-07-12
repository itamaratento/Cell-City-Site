#!/bin/bash
# Cell City Control Center — módulo Diagnóstico, verificações do ambiente
# de desenvolvimento (Git, Bash, Curl, Wget, Python, Docker, Java e outras
# ferramentas utilizadas pelo projeto).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/ambiente.sh}"
: "${REPO_DIR:?REPO_DIR precisa estar definido antes de carregar lib/ambiente.sh}"

_cc_diag_ambiente() {
  _cc_diag_ferramenta "Git" "git" "--version"
  _cc_diag_ferramenta "Bash" "bash" "--version"
  _cc_diag_ferramenta "Curl" "curl" "--version"
  _cc_diag_ferramenta "Wget" "wget" "--version"
  _cc_diag_ferramenta "Python" "python3" "--version"
  _cc_diag_docker
  _cc_diag_java
  _cc_diag_ferramentas_projeto
}

_cc_diag_ferramenta() {
  local nome="$1" cmd="$2" flag="$3" linha versao
  linha=$("$cmd" "$flag" 2>/dev/null | head -1)
  if [ -z "$linha" ]; then
    _cc_diag_adicionar "warn" "$nome" "Não instalado" "$nome não encontrado no PATH" "Ferramenta não disponível" "Instale $nome via apt ou outro gerenciador"
    return
  fi
  versao=$(echo "$linha" | sed -E 's/^[^0-9]*([0-9]+\.[0-9]+(\.[0-9]+)?).*$/\1/' 2>/dev/null)
  [ -z "$versao" ] && versao=$(echo "$linha" | awk '{print $NF}' 2>/dev/null)
  [ -z "$versao" ] && versao="$linha"
  _cc_diag_adicionar "ok" "$nome" "$versao"
}

_cc_diag_docker() {
  local linha
  linha=$(docker --version 2>/dev/null)
  if [ -n "$linha" ]; then
    _cc_diag_adicionar "ok" "Docker" "$linha"
  else
    _cc_diag_adicionar "ok" "Docker" "Não instalado (opcional)"
  fi
}

_cc_diag_java() {
  local linha
  linha=$(java -version 2>/dev/null | head -1)
  if [ -n "$linha" ]; then
    _cc_diag_adicionar "ok" "Java" "$linha"
  else
    _cc_diag_adicionar "ok" "Java" "Não instalado (opcional)"
  fi
}

_cc_diag_ferramentas_projeto() {
  local encontradas=0 ferramenta
  local ferramentas=("firebase" "node" "npm" "npx")
  for ferramenta in "${ferramentas[@]}"; do
    if command -v "$ferramenta" &>/dev/null; then
      encontradas=$((encontradas + 1))
    fi
  done
  if [ "$encontradas" -ge 4 ]; then
    _cc_diag_adicionar "ok" "Ferramentas do Projeto" "${encontradas}/${#ferramentas[@]} ferramentas principais disponíveis"
  else
    local ausentes=$(( ${#ferramentas[@]} - encontradas ))
    _cc_diag_adicionar "warn" "Ferramentas do Projeto" "${encontradas}/${#ferramentas[@]} ferramentas disponíveis (${ausentes} ausente(s))" "Ferramentas essenciais para o projeto ausentes" "Podem impedir execução de comandos do projeto" "Instale as ferramentas faltantes: npm install -g <ferramenta>"
  fi
}
