#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Branches" (Fase 5). Não existia nenhum script de gerenciamento de
# branch no projeto antes desta Sprint (ver README.md) — as ações abaixo
# são novas de propósito, mas de escopo estreito (listar/alternar/criar/
# excluir branch local), nunca tag/push/merge/promoção: isso continua
# sendo papel exclusivo do módulo Release (subir/subir-ok/rollback).
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

# develop/main nunca são excluídas por aqui — mesmo critério de "branch
# reconhecida" já usado por lib/svc-git.sh (_cc_svc_git_branch_reconhecida).
_brs_branch_protegida() {
  [[ "$1" =~ ^(develop|main)$ ]]
}

_brs_listar_locais() {
  echo "🌿 Branches Locais"
  echo "───────────────────"
  git -C "$REPO_DIR" branch -vv
}

_brs_listar_remotas() {
  echo "☁️  Branches Remotas"
  echo "─────────────────────"
  git -C "$REPO_DIR" branch -r
}

_brs_mostrar_padroes() {
  echo "📌 Branch Padrão / Protegida"
  echo "─────────────────────────────"
  echo "Branch padrão (produção) : main"
  echo "Branches protegidas      : develop, main (nunca excluídas por aqui)"
  echo "Branch atual             : $(_cc_git_branch)"
}

_brs_alternar_branch() {
  echo "🔀 Alternar Branch"
  echo "───────────────────"
  if ! _cc_svc_git_workspace_limpo; then
    _cc_warn "Working tree com alterações — o Git pode recusar a troca de branch."
  fi
  read -rp "Nome da branch de destino (Enter cancela): " destino
  if [ -z "$destino" ]; then
    echo "Cancelado."
    return
  fi
  if ! git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$destino" \
     && ! git -C "$REPO_DIR" show-ref --verify --quiet "refs/remotes/origin/$destino"; then
    _cc_fail "Branch '$destino' não encontrada (local nem remota)."
    return
  fi
  if ! _cc_confirm "Trocar de '$(_cc_git_branch)' para '$destino'?"; then
    echo "Cancelado."
    return
  fi
  git -C "$REPO_DIR" checkout "$destino"
}

_brs_criar_branch() {
  echo "🌱 Criar Branch"
  echo "────────────────"
  read -rp "Nome da nova branch (Enter cancela): " nome
  if [ -z "$nome" ]; then
    echo "Cancelado."
    return
  fi
  if git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$nome"; then
    _cc_fail "Já existe uma branch local '$nome'."
    return
  fi
  if ! _cc_confirm "Criar branch '$nome' a partir de '$(_cc_git_branch)' (sem trocar pra ela)?"; then
    echo "Cancelado."
    return
  fi
  git -C "$REPO_DIR" branch "$nome" && _cc_ok "Branch '$nome' criada."
}

_brs_excluir_branch() {
  echo "🗑️  Excluir Branch Local"
  echo "─────────────────────────"
  read -rp "Nome da branch local a excluir (Enter cancela): " nome
  if [ -z "$nome" ]; then
    echo "Cancelado."
    return
  fi
  if _brs_branch_protegida "$nome"; then
    _cc_fail "'$nome' é uma branch protegida — nunca excluída por aqui."
    return
  fi
  if [ "$nome" = "$(_cc_git_branch)" ]; then
    _cc_fail "Não é possível excluir a branch atual — troque de branch primeiro."
    return
  fi
  if ! git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$nome"; then
    _cc_fail "Branch local '$nome' não encontrada."
    return
  fi
  if ! _cc_confirm "Excluir a branch local '$nome' (git branch -d, sem forçar)?"; then
    echo "Cancelado."
    return
  fi
  git -C "$REPO_DIR" branch -d "$nome"
}

_brs_gerenciar_branches() {
  while true; do
    echo "🌳 Gerenciar Branches"
    echo "──────────────────────"
    echo "  1) Listar branches locais"
    echo "  2) Listar branches remotas"
    echo "  3) Branch padrão / protegida"
    echo "  4) Alternar branch"
    echo "  5) Criar branch"
    echo "  6) Excluir branch local"
    echo "  0) Voltar"
    read -rp "Opção: " opcao
    echo ""
    case "$opcao" in
      1) _brs_listar_locais ;;
      2) _brs_listar_remotas ;;
      3) _brs_mostrar_padroes ;;
      4) _brs_alternar_branch ;;
      5) _brs_criar_branch ;;
      6) _brs_excluir_branch ;;
      0) return ;;
      *) echo "Opção inválida." ;;
    esac
    echo ""
  done
}
