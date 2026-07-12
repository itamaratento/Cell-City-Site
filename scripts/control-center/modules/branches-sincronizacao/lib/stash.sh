#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Stash" (Fase 5). Envelopa `git stash` diretamente (não existe script
# próprio de stash no projeto pra reaproveitar) — mas nenhuma ação aplica/
# remove nada sem confirmação explícita (ver README.md, "Segurança").
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_brs_stash_listar() {
  echo "📋 Listar Stashes"
  echo "──────────────────"
  local lista
  lista="$(git -C "$REPO_DIR" stash list)"
  if [ -z "$lista" ]; then
    echo "Nenhum stash encontrado."
  else
    echo "$lista"
  fi
}

_brs_stash_visualizar() {
  echo "🔎 Visualizar Conteúdo de um Stash"
  echo "────────────────────────────────────"
  if [ -z "$(git -C "$REPO_DIR" stash list)" ]; then
    echo "Nenhum stash encontrado."
    return
  fi
  git -C "$REPO_DIR" stash list
  read -rp "Índice do stash (ex.: 0 para stash@{0}, Enter cancela): " indice
  if ! [[ "$indice" =~ ^[0-9]+$ ]]; then
    echo "Cancelado."
    return
  fi
  git -C "$REPO_DIR" stash show -p "stash@{$indice}"
}

_brs_stash_aplicar() {
  echo "📥 Aplicar Stash"
  echo "─────────────────"
  if [ -z "$(git -C "$REPO_DIR" stash list)" ]; then
    echo "Nenhum stash encontrado."
    return
  fi
  git -C "$REPO_DIR" stash list
  read -rp "Índice do stash a aplicar (ex.: 0, Enter cancela): " indice
  if ! [[ "$indice" =~ ^[0-9]+$ ]]; then
    echo "Cancelado."
    return
  fi
  if ! _cc_confirm "Aplicar stash@{$indice} no working tree atual?"; then
    echo "Cancelado."
    return
  fi
  git -C "$REPO_DIR" stash apply "stash@{$indice}"
}

_brs_stash_remover() {
  echo "🗑️  Remover Stash"
  echo "──────────────────"
  if [ -z "$(git -C "$REPO_DIR" stash list)" ]; then
    echo "Nenhum stash encontrado."
    return
  fi
  git -C "$REPO_DIR" stash list
  read -rp "Índice do stash a remover (ex.: 0, Enter cancela): " indice
  if ! [[ "$indice" =~ ^[0-9]+$ ]]; then
    echo "Cancelado."
    return
  fi
  if ! _cc_confirm "Remover (drop) stash@{$indice}? Isto é irreversível."; then
    echo "Cancelado."
    return
  fi
  git -C "$REPO_DIR" stash drop "stash@{$indice}"
}

_brs_stash() {
  while true; do
    echo "📦 Stash"
    echo "─────────"
    echo "  1) Listar stashes"
    echo "  2) Visualizar conteúdo"
    echo "  3) Aplicar stash"
    echo "  4) Remover stash"
    echo "  0) Voltar"
    read -rp "Opção: " opcao
    echo ""
    case "$opcao" in
      1) _brs_stash_listar ;;
      2) _brs_stash_visualizar ;;
      3) _brs_stash_aplicar ;;
      4) _brs_stash_remover ;;
      0) return ;;
      *) echo "Opção inválida." ;;
    esac
    echo ""
  done
}
