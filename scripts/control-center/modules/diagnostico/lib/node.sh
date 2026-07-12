#!/bin/bash
# Cell City Control Center — módulo Diagnóstico, verificações do Node.js
# (Node, npm, dependências, package-lock, node_modules e scripts).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/node.sh}"
: "${REPO_DIR:?REPO_DIR precisa estar definido antes de carregar lib/node.sh}"

_cc_diag_node() {
  _cc_diag_nodejs
  _cc_diag_npm
  _cc_diag_package_json
  _cc_diag_package_lock
  _cc_diag_node_modules
  _cc_diag_scripts_disponiveis
}

_cc_diag_nodejs() {
  local versao
  if ! versao=$(node --version 2>/dev/null); then
    _cc_diag_adicionar "fail" "Node.js" "Não instalado" "Node.js não encontrado no PATH" "Projeto não pode ser executado" "Instale Node.js via nvm ou apt"
    return
  fi
  local major
  major=$(echo "$versao" | sed 's/v//' | cut -d. -f1)
  if [ "$major" -ge 18 ]; then
    _cc_diag_adicionar "ok" "Node.js" "${versao} (v${major} — compatível)"
  elif [ -n "$major" ]; then
    _cc_diag_adicionar "warn" "Node.js" "${versao} (v${major} — versão antiga)" "Versão do Node inferior à recomendada (18+)" "Podem ocorrer incompatibilidades com dependências" "Atualize para Node.js 18+"
  else
    _cc_diag_adicionar "warn" "Node.js" "$versao" "Versão não identificada"
  fi
}

_cc_diag_npm() {
  local versao
  if ! versao=$(npm --version 2>/dev/null); then
    _cc_diag_adicionar "fail" "npm" "Não instalado" "npm não encontrado no PATH" "Impossível gerenciar dependências" "Instale npm (geralmente junto com Node.js)"
    return
  fi
  _cc_diag_adicionar "ok" "npm" "v${versao}"
}

_cc_diag_package_json() {
  if [ -f "$REPO_DIR/package.json" ]; then
    local pacotes_dep pacotes_dev scripts_count
    pacotes_dep=$(grep -c '"dependencies"' "$REPO_DIR/package.json" 2>/dev/null || echo "0")
    pacotes_dev=$(grep -c '"devDependencies"' "$REPO_DIR/package.json" 2>/dev/null || echo "0")
    scripts_count=$(grep -c '"scripts"' "$REPO_DIR/package.json" 2>/dev/null || echo "0")
    _cc_diag_adicionar "ok" "package.json" "Presente (dependências: ${pacotes_dep}, dev: ${pacotes_dev}, scripts: ${scripts_count})"
  else
    _cc_diag_adicionar "fail" "package.json" "Arquivo não encontrado" "package.json ausente" "Projeto Node sem configuração" "Crie package.json com npm init"
  fi
}

_cc_diag_package_lock() {
  if [ -f "$REPO_DIR/package-lock.json" ]; then
    _cc_diag_adicionar "ok" "package-lock.json" "Presente"
  elif [ -f "$REPO_DIR/yarn.lock" ]; then
    _cc_diag_adicionar "ok" "package-lock.json" "yarn.lock encontrado (alternativa)"
  else
    _cc_diag_adicionar "warn" "package-lock.json" "Ausente" "package-lock.json não encontrado" "Instalações podem ter versões inconsistentes" "Execute npm install para gerá-lo"
  fi
}

_cc_diag_node_modules() {
  if [ -d "$REPO_DIR/node_modules" ]; then
    local total_pacotes
    total_pacotes=$(ls -1 "$REPO_DIR/node_modules" 2>/dev/null | wc -l)
    if [ "$total_pacotes" -gt 0 ]; then
      _cc_diag_adicionar "ok" "node_modules" "Presente (${total_pacotes} pacotes)"
    else
      _cc_diag_adicionar "warn" "node_modules" "Diretório vazio" "node_modules existe mas está vazio" "Dependências não instaladas corretamente" "Execute npm install"
    fi
  else
    _cc_diag_adicionar "fail" "node_modules" "Não encontrado" "Dependências não instaladas" "Projeto não pode ser executado" "Execute npm install"
  fi
}

_cc_diag_scripts_disponiveis() {
  if [ ! -f "$REPO_DIR/package.json" ]; then
    _cc_diag_adicionar "warn" "Scripts Disponíveis" "Não foi possível verificar (package.json ausente)"
    return
  fi
  local scripts=""
  if command -v node &>/dev/null; then
    scripts=$(node -e "const p=require('$REPO_DIR/package.json'); console.log(Object.keys(p.scripts||{}).join(', '))" 2>/dev/null)
  fi
  if [ -z "$scripts" ]; then
    scripts=$(grep -oP '"[^"]+"\s*:' "$REPO_DIR/package.json" 2>/dev/null | grep -vE '"(dependencies|devDependencies|scripts|name|version|description|main|author|license|private|keywords|homepage|bugs|repository|engines|browserslist|type|files)"' | tr -d '": ' | head -20 | tr '\n' ',' | sed 's/,$//')
  fi
  if [ -n "$scripts" ]; then
    _cc_diag_adicionar "ok" "Scripts Disponíveis" "$scripts"
  else
    _cc_diag_adicionar "ok" "Scripts Disponíveis" "Nenhum script personalizado encontrado"
  fi
}
