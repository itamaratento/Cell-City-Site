#!/bin/bash
# Dependencias: nao utilizadas, ausentes, duplicadas, obsoletas.
set -uo pipefail
: "${CC_ROOT:?}"; : "${REPO_DIR:?}"

_cc_man_dependencias() {
  _cc_man_dep_nao_utilizadas
  _cc_man_dep_ausentes
  _cc_man_dep_duplicadas
  _cc_man_dep_obsoletas
}

_cc_man_dep_nao_utilizadas() {
  [ ! -f "$REPO_DIR/package.json" ] && _cc_man_adicionar "ok" "Dependências Não Utilizadas" "Sem package.json" && return
  [ ! -d "$REPO_DIR/node_modules" ] && _cc_man_adicionar "ok" "Dependências Não Utilizadas" "node_modules ausente" && return
  if command -v node &>/dev/null; then
    local orfas
    orfas=$(node -e "
      const p=require('$REPO_DIR/package.json');
      const deps=new Set(Object.keys(p.dependencies||{}).concat(Object.keys(p.devDependencies||{})));
      const fs=require('fs'); let o=0;
      if (fs.existsSync('$REPO_DIR/node_modules')) {
        fs.readdirSync('$REPO_DIR/node_modules').forEach(d => { if (!deps.has(d)&&!d.startsWith('.')) o++; });
      }
      console.log(o);
    " 2>/dev/null)
    [ "$orfas" -gt 0 ] && _cc_man_adicionar "warn" "Dependências Não Utilizadas" "${orfas} pacote(s) em node_modules não listados" "Dependências instaladas mas não declaradas" "Ocupam espaço em disco" "Execute npm prune" || _cc_man_adicionar "ok" "Dependências Não Utilizadas" "Nenhuma"
  else
    _cc_man_adicionar "ok" "Dependências Não Utilizadas" "Node ausente para verificação"
  fi
}

_cc_man_dep_ausentes() {
  [ ! -f "$REPO_DIR/package.json" ] && _cc_man_adicionar "ok" "Dependências Ausentes" "Sem package.json" && return
  if command -v node &>/dev/null; then
    local deps_disp=1
    node -e "
      const p=require('$REPO_DIR/package.json');
      const deps=Object.keys(p.dependencies||{}).concat(Object.keys(p.devDependencies||{}));
      const fs=require('fs');
      deps.forEach(d => { if (!fs.existsSync('$REPO_DIR/node_modules/'+d)) { process.exit(1); } });
    " 2>/dev/null && deps_disp=0 || deps_disp=1
    [ "$deps_disp" -eq 1 ] && _cc_man_adicionar "warn" "Dependências Ausentes" "Algumas dependências declaradas não estão instaladas" "Dependências faltando" "Projeto pode não funcionar" "Execute npm install" || _cc_man_adicionar "ok" "Dependências Ausentes" "Todas instaladas"
  else
    _cc_man_adicionar "ok" "Dependências Ausentes" "Node ausente para verificação"
  fi
}

_cc_man_dep_duplicadas() {
  [ ! -f "$REPO_DIR/package-lock.json" ] && _cc_man_adicionar "ok" "Dependências Duplicadas" "Sem lockfile" && return
  local dups
  dups=$(grep -oP '"[^"]+":\s*\{' "$REPO_DIR/package-lock.json" 2>/dev/null | sort | uniq -d | wc -l)
  [ "$dups" -gt 0 ] && _cc_man_adicionar "warn" "Dependências Duplicadas" "${dups} entrada(s) duplicada(s) no lockfile" "Múltiplas versões do mesmo pacote" "Aumenta tamanho do node_modules" "Execute npm dedupe" || _cc_man_adicionar "ok" "Dependências Duplicadas" "Nenhuma"
}

_cc_man_dep_obsoletas() {
  [ ! -f "$REPO_DIR/package.json" ] && _cc_man_adicionar "ok" "Dependências Obsoletas" "Sem package.json" && return
  if command -v npm &>/dev/null; then
    local desatualizadas
    desatualizadas=$(npm outdated --prefix "$REPO_DIR" 2>/dev/null | tail -n +2 | wc -l)
    [ "$desatualizadas" -gt 0 ] && _cc_man_adicionar "warn" "Dependências Obsoletas" "${desatualizadas} pacote(s) desatualizado(s)" "Versões antigas de dependências" "Risco de segurança e incompatibilidade" "Execute npm update" || _cc_man_adicionar "ok" "Dependências Obsoletas" "Todas atualizadas"
  else
    _cc_man_adicionar "ok" "Dependências Obsoletas" "npm ausente para verificação"
  fi
}
