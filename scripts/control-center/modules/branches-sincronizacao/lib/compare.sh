#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Comparação" (Fase 5). Leitura pura (git log/diff entre duas branches) —
# nunca faz merge nem altera nenhuma das duas branches comparadas.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_brs_comparar_branches() {
  echo "🔬 Comparar Branches"
  echo "─────────────────────"
  local atual outra a b
  atual="$(_cc_git_branch)"
  if [ "$atual" = "develop" ]; then outra="main"; else outra="develop"; fi

  read -rp "Branch A (Enter = $atual): " a
  a="${a:-$atual}"
  read -rp "Branch B (Enter = $outra): " b
  b="${b:-$outra}"

  if ! git -C "$REPO_DIR" rev-parse --verify --quiet "$a" >/dev/null; then
    _cc_fail "Branch '$a' não encontrada."
    _cc_log "Branches e Sincronização: Comparar Branches — falha, '$a' não encontrada"
    return
  fi
  if ! git -C "$REPO_DIR" rev-parse --verify --quiet "$b" >/dev/null; then
    _cc_fail "Branch '$b' não encontrada."
    _cc_log "Branches e Sincronização: Comparar Branches — falha, '$b' não encontrada"
    return
  fi

  echo ""
  echo "Commits exclusivos de '$a' (não estão em '$b'):"
  git -C "$REPO_DIR" log --oneline "$b".."$a"
  echo ""
  echo "Commits exclusivos de '$b' (não estão em '$a'):"
  git -C "$REPO_DIR" log --oneline "$a".."$b"
  echo ""
  echo "Resumo de arquivos ($a vs $b):"
  git -C "$REPO_DIR" diff --stat "$b"..."$a"
  echo ""
  echo "Arquivos adicionados/removidos/modificados ($a vs $b):"
  git -C "$REPO_DIR" diff --name-status "$b"..."$a"
  _cc_log "Branches e Sincronização: Comparar Branches — $a vs $b"
}
