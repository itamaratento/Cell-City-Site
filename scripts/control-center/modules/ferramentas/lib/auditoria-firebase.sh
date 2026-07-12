#!/bin/bash
# Cell City Control Center — módulo Ferramentas, Auditoria Firebase.
# Valida projeto ativo, rules, indexes, hosting, cloud functions e Firestore.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_ferr_auditoria_firebase() {
  _cc_ferr_aud_fire_projeto
  _cc_ferr_aud_fire_rules
  _cc_ferr_aud_fire_indexes
  _cc_ferr_aud_fire_hosting
  _cc_ferr_aud_fire_functions
  _cc_ferr_aud_fire_firestore
  _cc_ferr_aud_fire_config
}

_cc_ferr_fire_cmd() { firebase "$@" 2>/dev/null; }

_cc_ferr_aud_fire_projeto() {
  if [ -f "$REPO_DIR/.firebaserc" ]; then
    local projetos
    projetos=$(grep -oP '"project"[^:]*:\s*"[^"]+"' "$REPO_DIR/.firebaserc" 2>/dev/null | head -3)
    if [ -n "$projetos" ]; then
      _cc_ferr_adicionar "ok" "Projeto Ativo" "Configurado em .firebaserc"
    else
      _cc_ferr_adicionar "warn" "Projeto Ativo" ".firebaserc sem projetos definidos"
    fi
  else
    _cc_ferr_adicionar "warn" "Projeto Ativo" ".firebaserc não encontrado"
  fi
}

_cc_ferr_aud_fire_rules() {
  local ok=0
  [ -f "$REPO_DIR/firestore.rules" ] && ok=$((ok + 1)) && _cc_ferr_adicionar "ok" "Firestore Rules" "firestore.rules presente"
  [ -f "$REPO_DIR/storage.rules" ] && ok=$((ok + 1)) && _cc_ferr_adicionar "ok" "Storage Rules" "storage.rules presente"
  [ "$ok" -eq 0 ] && _cc_ferr_adicionar "fail" "Firebase Rules" "Nenhum arquivo de rules encontrado"
}

_cc_ferr_aud_fire_indexes() {
  if [ -f "$REPO_DIR/firestore.indexes.json" ]; then
    local valido
    valido=$(python3 -c "import json; json.load(open('$REPO_DIR/firestore.indexes.json')); print('ok')" 2>/dev/null)
    if [ "$valido" = "ok" ]; then
      _cc_ferr_adicionar "ok" "Indexes" "firestore.indexes.json válido"
    else
      _cc_ferr_adicionar "warn" "Indexes" "firestore.indexes.json presente (não foi possível validar)"
    fi
  else
    _cc_ferr_adicionar "ok" "Indexes" "Nenhum arquivo de índices"
  fi
}

_cc_ferr_aud_fire_hosting() {
  if [ -f "$REPO_DIR/firebase.json" ]; then
    if grep -q '"hosting"' "$REPO_DIR/firebase.json" 2>/dev/null; then
      local public_dir
      public_dir=$(grep -oP '"public"\s*:\s*"[^"]+"' "$REPO_DIR/firebase.json" 2>/dev/null | cut -d'"' -f4)
      [ -n "$public_dir" ] && _cc_ferr_adicionar "ok" "Hosting" "Configurado (public: $public_dir)"
    else
      _cc_ferr_adicionar "ok" "Hosting" "Não configurado"
    fi
  else
    _cc_ferr_adicionar "fail" "Hosting" "firebase.json ausente"
  fi
}

_cc_ferr_aud_fire_functions() {
  if [ -d "$REPO_DIR/functions" ]; then
    [ -f "$REPO_DIR/functions/package.json" ] && _cc_ferr_adicionar "ok" "Cloud Functions" "Configurada (package.json presente)" || _cc_ferr_adicionar "warn" "Cloud Functions" "functions/ sem package.json"
  else
    _cc_ferr_adicionar "ok" "Cloud Functions" "Não configurada"
  fi
}

_cc_ferr_aud_fire_firestore() {
  if [ -f "$REPO_DIR/firebase.json" ]; then
    if grep -q '"firestore"' "$REPO_DIR/firebase.json" 2>/dev/null; then
      _cc_ferr_adicionar "ok" "Firestore" "Configurado em firebase.json"
    else
      _cc_ferr_adicionar "ok" "Firestore" "Não configurado explicitamente"
    fi
  fi
}

_cc_ferr_aud_fire_config() {
  if [ -f "$REPO_DIR/firebase.json" ]; then
    local valido
    valido=$(python3 -c "import json; json.load(open('$REPO_DIR/firebase.json')); print('ok')" 2>/dev/null)
    [ "$valido" = "ok" ] && _cc_ferr_adicionar "ok" "Configuração" "firebase.json é JSON válido" || _cc_ferr_adicionar "warn" "Configuração" "firebase.json com problemas de sintaxe"
  else
    _cc_ferr_adicionar "fail" "Configuração" "firebase.json não encontrado"
  fi
}
