#!/bin/bash
# Cell City Control Center — módulo Diagnóstico, verificações do Firebase
# (CLI, login, projeto ativo, Firestore, Rules, Indexes, Hosting,
# Cloud Functions).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/firebase.sh}"
: "${REPO_DIR:?REPO_DIR precisa estar definido antes de carregar lib/firebase.sh}"

_cc_diag_firebase() {
  _cc_diag_firebase_cli
  _cc_diag_firebase_login
  _cc_diag_firebase_projeto
  _cc_diag_firebase_firestore
  _cc_diag_firebase_rules
  _cc_diag_firebase_indexes
  _cc_diag_firebase_hosting
  _cc_diag_firebase_functions
}

_cc_diag_firebase_cmd() {
  firebase "$@" 2>/dev/null
}

_cc_diag_firebase_cli() {
  local versao
  if ! versao=$(_cc_diag_firebase_cmd --version); then
    _cc_diag_adicionar "fail" "Firebase CLI" "Não instalado" "Firebase CLI não encontrado no PATH" "Impossível gerenciar Firebase" "Instale com: npm install -g firebase-tools"
    return 1
  fi
  _cc_diag_adicionar "ok" "Firebase CLI" "v${versao}"
}

_cc_diag_firebase_login() {
  local login_status
  login_status=$(_cc_diag_firebase_cmd login:list 2>/dev/null)
  if echo "$login_status" | grep -qi "no authorized"; then
    _cc_diag_adicionar "fail" "Firebase Login" "Nenhum usuário logado" "Firebase CLI não autenticado" "Impossível acessar projetos Firebase" "Execute: firebase login"
  elif echo "$login_status" | grep -qiE "(✔|user|email)" 2>/dev/null; then
    local email
    email=$(echo "$login_status" | grep -oP '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+' | head -1)
    if [ -n "$email" ]; then
      _cc_diag_adicionar "ok" "Firebase Login" "Logado como ${email}"
    else
      _cc_diag_adicionar "ok" "Firebase Login" "Usuário autenticado"
    fi
  else
    _cc_diag_adicionar "warn" "Firebase Login" "Não foi possível verificar status do login" "Firebase CLI pode não estar autenticado" "Operações Firebase podem falhar" "Execute: firebase login"
  fi
}

_cc_diag_firebase_projeto() {
  if [ -f "$REPO_DIR/.firebaserc" ]; then
    local projetos
    projetos=$(grep -oP '"project"[^:]*:\s*"[^"]+"' "$REPO_DIR/.firebaserc" 2>/dev/null | head -5)
    if [ -n "$projetos" ]; then
      _cc_diag_adicionar "ok" "Firebase Projeto" "Projeto(s) configurado(s) em .firebaserc"
    else
      _cc_diag_adicionar "warn" "Firebase Projeto" ".firebaserc presente mas sem projetos definidos" "Arquivo de configuração incompleto" "Impossível determinar projeto ativo" "Verifique .firebaserc"
    fi
  else
    _cc_diag_adicionar "fail" "Firebase Projeto" ".firebaserc não encontrado" "Projeto Firebase não configurado" "Comandos Firebase não funcionarão" "Execute: firebase init"
  fi
}

_cc_diag_firebase_firestore() {
  if [ -f "$REPO_DIR/firestore.rules" ] && [ -f "$REPO_DIR/firestore.indexes.json" ]; then
    _cc_diag_adicionar "ok" "Firestore" "Rules e Indexes configurados"
  elif [ -f "$REPO_DIR/firestore.rules" ]; then
    _cc_diag_adicionar "warn" "Firestore" "Rules presente, Indexes ausente" "firestore.indexes.json não encontrado" "Índices compostos podem não estar definidos" "Crie firestore.indexes.json"
  else
    _cc_diag_adicionar "fail" "Firestore" "Rules não encontrada" "firestore.rules ausente" "Firestore sem regras de segurança" "Execute: firebase init firestore"
  fi
}

_cc_diag_firebase_rules() {
  if [ ! -f "$REPO_DIR/firestore.rules" ]; then
    _cc_diag_adicionar "fail" "Firebase Rules" "firestore.rules ausente" "Arquivo de regras não encontrado" "Firestore sem proteção" "Crie firestore.rules"
    return
  fi
  local rules_tamanho
  rules_tamanho=$(wc -l < "$REPO_DIR/firestore.rules" 2>/dev/null || echo "0")
  if [ "$rules_tamanho" -gt 5 ]; then
    _cc_diag_adicionar "ok" "Firebase Rules" "firestore.rules presente ($rules_tamanho linhas)"
  else
    _cc_diag_adicionar "warn" "Firebase Rules" "firestore.rules com apenas $rules_tamanho linhas" "Regras muito curtas ou vazias" "Podem não estar protegendo adequadamente" "Revise as regras de segurança"
  fi

  if [ -f "$REPO_DIR/storage.rules" ]; then
    local storage_tamanho
    storage_tamanho=$(wc -l < "$REPO_DIR/storage.rules" 2>/dev/null || echo "0")
    _cc_diag_adicionar "ok" "Storage Rules" "storage.rules presente ($storage_tamanho linhas)"
  else
    _cc_diag_adicionar "warn" "Storage Rules" "storage.rules não encontrado" "Regras de Storage não configuradas" "Armazenamento sem proteção" "Crie storage.rules"
  fi
}

_cc_diag_firebase_indexes() {
  if [ ! -f "$REPO_DIR/firestore.indexes.json" ]; then
    _cc_diag_adicionar "warn" "Firebase Indexes" "firestore.indexes.json ausente" "Índices compostos não configurados" "Consultas compostas podem falhar" "Crie firestore.indexes.json"
    return
  fi
  if command -v python3 &>/dev/null; then
    if python3 -c "import json; json.load(open('$REPO_DIR/firestore.indexes.json')); print('ok')" 2>/dev/null | grep -q ok; then
      _cc_diag_adicionar "ok" "Firebase Indexes" "firestore.indexes.json é JSON válido"
    else
      _cc_diag_adicionar "warn" "Firebase Indexes" "firestore.indexes.json presente (JSON inválido)" "Conteúdo não é JSON válido" "Índices podem não ser implantados corretamente" "Corrija a sintaxe do arquivo"
    fi
  else
    _cc_diag_adicionar "ok" "Firebase Indexes" "firestore.indexes.json presente"
  fi
}

_cc_diag_firebase_hosting() {
  if [ -f "$REPO_DIR/firebase.json" ]; then
    if grep -q '"hosting"' "$REPO_DIR/firebase.json" 2>/dev/null; then
      local public_dir
      public_dir=$(grep -oP '"public"\s*:\s*"[^"]+"' "$REPO_DIR/firebase.json" 2>/dev/null | cut -d'"' -f4)
      if [ -n "$public_dir" ] && [ -d "$REPO_DIR/$public_dir" ]; then
        _cc_diag_adicionar "ok" "Firebase Hosting" "Configurado (public: $public_dir)"
      elif [ -n "$public_dir" ]; then
        _cc_diag_adicionar "warn" "Firebase Hosting" "Configurado mas diretório '$public_dir' não encontrado" "Diretório public não existe" "Hosting pode não funcionar" "Crie o diretório ou ajuste firebase.json"
      else
        _cc_diag_adicionar "ok" "Firebase Hosting" "Configurado em firebase.json"
      fi
    else
      _cc_diag_adicionar "ok" "Firebase Hosting" "Não configurado (sem seção hosting)"
    fi
  else
    _cc_diag_adicionar "fail" "Firebase Hosting" "firebase.json ausente" "Configuração Firebase não encontrada" "Hosting não configurado" "Execute: firebase init hosting"
  fi
}

_cc_diag_firebase_functions() {
  if [ -d "$REPO_DIR/functions" ]; then
    if [ -f "$REPO_DIR/functions/package.json" ]; then
      local func_count
      func_count=$(grep -c '"index\|"handler\|"trigger\|exports\.' "$REPO_DIR/functions/index.js" 2>/dev/null || echo "0")
      if [ "$func_count" -gt 0 ]; then
        _cc_diag_adicionar "ok" "Cloud Functions" "Diretório functions configurado"
      else
        _cc_diag_adicionar "ok" "Cloud Functions" "Diretório functions presente"
      fi
    else
      _cc_diag_adicionar "warn" "Cloud Functions" "functions/ sem package.json" "Diretório functions incompleto" "Cloud Functions não podem ser implantadas" "Verifique functions/package.json"
    fi
  else
    _cc_diag_adicionar "ok" "Cloud Functions" "Não configurado (sem diretório functions)"
  fi
}
