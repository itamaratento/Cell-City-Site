#!/bin/bash
# Cell City Control Center — módulo Ferramentas, Auditoria Node.
# Valida package.json, package-lock.json, dependências e scripts.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_ferr_auditoria_node() {
  _cc_ferr_aud_node_package
  _cc_ferr_aud_node_lock
  _cc_ferr_aud_node_deps
  _cc_ferr_aud_node_orfas
  _cc_ferr_aud_node_scripts
  _cc_ferr_aud_node_npm
}

_cc_ferr_aud_node_package() {
  if [ ! -f "$REPO_DIR/package.json" ]; then
    _cc_ferr_adicionar "fail" "package.json" "Não encontrado"
    return
  fi
  local name version deps devDeps
  name=$(grep -oP '"name"\s*:\s*"[^"]+"' "$REPO_DIR/package.json" 2>/dev/null | cut -d'"' -f4)
  version=$(grep -oP '"version"\s*:\s*"[^"]+"' "$REPO_DIR/package.json" 2>/dev/null | cut -d'"' -f4)
  deps=$(grep -c '"dependencies"' "$REPO_DIR/package.json" 2>/dev/null || echo "0")
  devDeps=$(grep -c '"devDependencies"' "$REPO_DIR/package.json" 2>/dev/null || echo "0")
  [ -z "$name" ] && name="(desconhecido)"
  _cc_ferr_adicionar "ok" "package.json" "${name} v${version:-?} (deps: ${deps}, dev: ${devDeps})"
}

_cc_ferr_aud_node_lock() {
  if [ -f "$REPO_DIR/package-lock.json" ]; then
    local lockVersion
    lockVersion=$(grep -oP '"lockfileVersion"\s*:\s*\d+' "$REPO_DIR/package-lock.json" 2>/dev/null | grep -oP '\d+')
    _cc_ferr_adicionar "ok" "package-lock.json" "Presente (lockfileVersion: ${lockVersion:-?})"
  elif [ -f "$REPO_DIR/yarn.lock" ]; then
    _cc_ferr_adicionar "ok" "package-lock.json" "yarn.lock encontrado (alternativa)"
  else
    _cc_ferr_adicionar "warn" "package-lock.json" "Ausente" "Lockfile não encontrado" "Versões inconsistentes entre ambientes" "Execute npm install para gerá-lo"
  fi
}

_cc_ferr_aud_node_deps() {
  if [ ! -d "$REPO_DIR/node_modules" ]; then
    _cc_ferr_adicionar "fail" "Dependências" "node_modules não encontrado" "Dependências não instaladas" "Projeto não pode ser executado" "Execute npm install"
    return
  fi
  local total desatualizadas
  total=$(ls -1 "$REPO_DIR/node_modules" 2>/dev/null | wc -l)
  if command -v npm &>/dev/null; then
    desatualizadas=$(npm outdated --prefix "$REPO_DIR" 2>/dev/null | tail -n +2 | wc -l)
    [ -z "$desatualizadas" ] && desatualizadas=0
  else
    desatualizadas="?"
  fi
  [ "$desatualizadas" = "?" ] && _cc_ferr_adicionar "ok" "Dependências" "${total} pacotes instalados" || _cc_ferr_adicionar "ok" "Dependências" "${total} pacotes (${desatualizadas} desatualizados)"
}

_cc_ferr_aud_node_orfas() {
  if [ ! -f "$REPO_DIR/package.json" ] || [ ! -d "$REPO_DIR/node_modules" ]; then
    return
  fi
  if command -v node &>/dev/null; then
    local orfas
    orfas=$(node -e "
      const pkg = require('$REPO_DIR/package.json');
      const deps = new Set(Object.keys(pkg.dependencies||{}).concat(Object.keys(pkg.devDependencies||{})));
      const fs = require('fs');
      let orphans = 0;
      if (fs.existsSync('$REPO_DIR/node_modules')) {
        fs.readdirSync('$REPO_DIR/node_modules').forEach(d => { if (!deps.has(d) && !d.startsWith('.')) orphans++; });
      }
      console.log(orphans);
    " 2>/dev/null)
    [ "$orfas" -gt 0 ] && _cc_ferr_adicionar "warn" "Dependências Órfãs" "${orfas} pacote(s) em node_modules não listados em package.json"
  else
    _cc_ferr_adicionar "ok" "Dependências Órfãs" "Não foi possível verificar (node ausente)"
  fi
}

_cc_ferr_aud_node_scripts() {
  if [ ! -f "$REPO_DIR/package.json" ]; then
    return
  fi
  local scripts
  if command -v node &>/dev/null; then
    scripts=$(node -e "const p=require('$REPO_DIR/package.json'); console.log(Object.keys(p.scripts||{}).join(', '))" 2>/dev/null)
  else
    scripts=$(grep -oP '"[^"]+"\s*:' "$REPO_DIR/package.json" 2>/dev/null | grep -vE '"(dependencies|devDependencies|scripts|name|version|description|main|author|license|private|keywords|homepage|bugs|repository|engines|browserslist|type|files)"' | tr -d '": ' | head -20 | tr '\n' ',')
  fi
  [ -n "$scripts" ] && _cc_ferr_adicionar "ok" "Scripts npm" "$scripts" || _cc_ferr_adicionar "ok" "Scripts npm" "Nenhum script personalizado"
}

_cc_ferr_aud_node_npm() {
  if command -v npm &>/dev/null; then
    local versao
    versao=$(npm --version 2>/dev/null)
    _cc_ferr_adicionar "ok" "npm" "v${versao} instalado"
  else
    _cc_ferr_adicionar "warn" "npm" "Não instalado" "npm não encontrado" "Impossível gerenciar dependências" "Instale Node.js/npm"
  fi
}
