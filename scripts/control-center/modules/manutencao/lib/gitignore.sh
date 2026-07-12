#!/bin/bash
# .gitignore verification.
set -uo pipefail
: "${CC_ROOT:?}"; : "${REPO_DIR:?}"

_cc_man_gitignore() {
  [ ! -f "$REPO_DIR/.gitignore" ] && _cc_man_adicionar "fail" ".gitignore" "Arquivo não encontrado" "Sem proteção de exclusão" "Arquivos sensíveis podem ser versionados" "Crie um .gitignore" && return
  _cc_man_git_item "node_modules" "node_modules"
  _cc_man_git_item "caches" "\.cache\|_cache"
  _cc_man_git_item "arquivos temporários" "\.tmp$\|\.swp$\|\.bak$"
  _cc_man_git_item "backups" "backup\|\.tar\.gz\|\.tgz"
  _cc_man_git_item "logs" "\.log$"
  _cc_man_git_item "arquivos sensíveis" "sa-key\|credentials\|\.env"
  _cc_man_git_item "diretório de reports" "_reports"
}

_cc_man_git_item() {
  local nome="$1" padrao="$2"
  if grep -qE "$padrao" "$REPO_DIR/.gitignore" 2>/dev/null; then
    _cc_man_adicionar "ok" ".gitignore › $nome" "Protegido"
  else
    _cc_man_adicionar "warn" ".gitignore › $nome" "Não protegido" "Padrão '$padrao' ausente" "Risco de versionamento acidental" "Adicione ao .gitignore"
  fi
}
