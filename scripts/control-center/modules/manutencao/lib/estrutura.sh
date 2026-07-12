#!/bin/bash
# Estrutura e gitignore.
set -uo pipefail
: "${CC_ROOT:?}"; : "${REPO_DIR:?}"

_DIRS_ESPERADOS=("CRM" "scripts" "css" "js" "functions" "assets" "pages" "tests")
_ARQS_ESPERADOS=("package.json" "firebase.json" "firestore.rules" "firestore.indexes.json" "storage.rules" ".firebaserc")

_cc_man_estrutura() {
  _cc_man_est_organizacao
  _cc_man_est_convencoes
  _cc_man_est_arquivos
}

_cc_man_est_organizacao() {
  local ausentes=0
  for d in "${_DIRS_ESPERADOS[@]}"; do
    [ ! -d "$REPO_DIR/$d" ] && ausentes=$((ausentes + 1))
  done
  [ "$ausentes" -eq 0 ] && _cc_man_adicionar "ok" "Organização" "Todos os ${#_DIRS_ESPERADOS[@]} diretórios esperados existem" && return
  _cc_man_adicionar "warn" "Organização" "${ausentes} diretório(s) ausente(s)" "Estrutura incompleta" "Pode indicar projeto desorganizado" "Crie os diretórios faltantes"
}

_cc_man_est_convencoes() {
  local problemas=0
  while IFS= read -r -d '' f; do
    local nome
    nome=$(basename "$f")
    [[ "$nome" =~ ^[a-z0-9._-]+$ ]] && continue
    problemas=$((problemas + 1))
    _cc_man_encontrar "$f"
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f 2>/dev/null -print0)
  [ "$problemas" -eq 0 ] && _cc_man_adicionar "ok" "Convenções de Nomes" "Todas as convenções seguidas" && return
  _cc_man_adicionar "warn" "Convenções de Nomes" "${problemas} arquivo(s) com nome fora do padrão" "Nomes com maiúsculas ou caracteres especiais" "Inconsistência no projeto" "Renomeie seguindo o padrão lower-case"
}

_cc_man_est_arquivos() {
  local ausentes=0
  for a in "${_ARQS_ESPERADOS[@]}"; do
    [ ! -f "$REPO_DIR/$a" ] && ausentes=$((ausentes + 1))
  done
  [ "$ausentes" -eq 0 ] && _cc_man_adicionar "ok" "Arquivos Obrigatórios" "Todos presentes" && return
  _cc_man_adicionar "fail" "Arquivos Obrigatórios" "${ausentes} arquivo(s) obrigatório(s) ausente(s)" "Arquivos essenciais faltando" "Projeto pode não funcionar" "Verifique a integridade do repositório"
}
