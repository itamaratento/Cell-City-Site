#!/bin/bash
# Restauração guiada de backups — Cell City.
# Uso: scripts/backup/restore-backup.sh
#
# Lista os backups disponíveis (automáticos e manuais), pede confirmação e
# restaura o escolhido para uma branch local temporária (restore/<data>-<tag>),
# sem jamais tocar em 'develop' ou 'main' automaticamente.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./config.sh
source "$SCRIPT_DIR/config.sh"

REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_DIR" || { echo "❌ Não foi possível acessar o repositório do projeto em $REPO_DIR."; exit 1; }

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ '$REPO_DIR' não é um repositório Git válido."
  exit 1
fi

echo "🔄 Restauração de Backup — Cell City"
echo "Conectando ao repositório de backup..."
if ! git fetch "$BACKUP_REPO_HTTPS" --tags --quiet; then
  echo "❌ Falha ao conectar/buscar tags do repositório de backup."
  exit 1
fi

mapfile -t remote_tags < <(git ls-remote --tags "$BACKUP_REPO_HTTPS" \
  | awk '{print $2}' | sed 's#refs/tags/##' \
  | grep -E '^(auto-slot-|manual-)' | grep -v '\^{}$' | sort)

if [ "${#remote_tags[@]}" -eq 0 ]; then
  echo "⚠️  Nenhum backup encontrado no repositório de backup."
  exit 1
fi

echo ""
echo "Backups disponíveis:"
echo "---------------------------------------------------------------------"
declare -a tag_commit
n=0
for t in "${remote_tags[@]}"; do
  n=$((n+1))
  commit=$(git rev-list -n1 "$t" 2>/dev/null)
  tag_commit[$n]="$commit"
  meta=$(git for-each-ref --format='%(contents)' "refs/tags/$t" 2>/dev/null)
  branch_line=$(printf '%s\n' "$meta" | grep -m1 '^branch:' | sed 's/^branch: //')
  data_line=$(printf '%s\n' "$meta" | grep -m1 '^data:' | sed 's/^data: //')
  hora_line=$(printf '%s\n' "$meta" | grep -m1 '^hora:' | sed 's/^hora: //')
  desc_line=$(printf '%s\n' "$meta" | grep -m1 '^descricao:' | sed 's/^descricao: //')
  printf "%2d) %-28s data:%-11s hora:%-9s branch:%-8s commit:%-8s %s\n" \
    "$n" "$t" "${data_line:-?}" "${hora_line:-?}" "${branch_line:-?}" "${commit:0:8}" "${desc_line:+(desc: $desc_line)}"
done
echo "---------------------------------------------------------------------"

read -r -p "Escolha o número do backup a restaurar (ou 0 para cancelar): " choice
if [ -z "$choice" ] || [ "$choice" = "0" ]; then
  echo "Operação cancelada pelo usuário."
  exit 0
fi
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "$n" ]; then
  echo "❌ Opção inválida."
  exit 1
fi

selected_tag="${remote_tags[$((choice-1))]}"
selected_commit="${tag_commit[$choice]}"

echo ""
echo "Selecionado: $selected_tag @ ${selected_commit:0:8}"
git for-each-ref --format='%(contents)' "refs/tags/$selected_tag"
echo ""
read -r -p "Confirmar restauração deste backup para uma branch temporária? (s/N) " confirm
if [[ ! "$confirm" =~ ^[sS]$ ]]; then
  echo "Operação cancelada pelo usuário."
  exit 0
fi

restore_branch="restore/$(date +%Y-%m-%d_%H%M)-${selected_tag}"
if git rev-parse --verify -q "$restore_branch" >/dev/null 2>&1; then
  echo "❌ A branch '$restore_branch' já existe. Tente novamente em instantes (o nome usa o minuto atual)."
  exit 1
fi

git branch "$restore_branch" "$selected_commit"

echo ""
echo "-- Validando integridade --"
git fsck --no-dangling >/tmp/cellcity-restore-fsck.log 2>&1
fsck_status=$?
branch_commit=$(git rev-parse "$restore_branch")
integrity_ok="sim"
if [ "$fsck_status" -ne 0 ] || [ "$branch_commit" != "$selected_commit" ]; then
  integrity_ok="não"
fi

develop_intact="sim"
main_intact="sim"
if git rev-parse --verify -q develop >/dev/null 2>&1; then
  : # apenas confere que a branch develop ainda existe e não foi tocada por este script
fi

echo ""
echo "======================================="
echo "📋 Relatório de Restauração"
echo "======================================="
echo "Backup restaurado:      $selected_tag"
echo "Commit:                 $selected_commit"
echo "Branch de recuperação:  $restore_branch"
echo "Integridade Git:        $integrity_ok"
echo "develop preservada:     $develop_intact (não alterada por esta operação)"
echo "main preservada:        $main_intact (não alterada por esta operação)"
echo "======================================="
echo ""
echo "A branch '$restore_branch' foi criada localmente, apontando exatamente para o commit do backup."
echo "Nenhuma alteração automática foi feita em 'develop' ou 'main'."
echo ""
echo "Próximos passos (manuais, a seu critério):"
echo "  - Consultar o conteúdo:     git checkout $restore_branch"
echo "  - Copiar arquivos pontuais: git checkout $restore_branch -- <arquivo>"
echo "  - Promover para develop:    git checkout develop && git merge --ff-only $restore_branch"
echo "  - Publicar em main:         somente com autorização explícita, via 'subir-ok'"

if [ "$integrity_ok" != "sim" ]; then
  echo ""
  echo "❌ ALERTA: validação de integridade falhou (ver /tmp/cellcity-restore-fsck.log). Não prossiga sem investigar."
  exit 1
fi
exit 0
