#!/bin/bash
# Backup manual sob demanda — Cell City.
# Uso: scripts/backup/backup-manual.sh ["descrição opcional"]
#
# Nunca faz deploy, nunca cria merge, nunca troca de branch automaticamente.
# Push em 'main' não é feito aqui (só via subir-ok) — apenas backup é sincronizado.
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

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -z "$branch" ]; then
  echo "❌ Não foi possível identificar a branch atual (HEAD desanexada?)."
  exit 1
fi

echo "🗄️  Backup manual — Cell City"
echo "Repositório: $REPO_DIR"
echo "Branch atual: $branch"
echo ""

desc="${1:-}"
commit_made="não"

if [ -n "$(git status --porcelain)" ]; then
  echo "📋 Alterações pendentes detectadas."
  if [ -z "$desc" ] && [ -t 0 ]; then
    read -r -p "📝 Descrição do backup (opcional, Enter para pular): " desc
  fi
  git add .
  if [ -n "$desc" ]; then
    git commit -q -m "backup: $desc ($(date +%d/%m/%Y-%H:%M))"
  else
    git commit -q -m "backup: $(date +%d/%m/%Y-%H:%M)"
  fi
  if [ $? -eq 0 ]; then commit_made="sim"; fi
else
  echo "ℹ️  Nenhuma alteração pendente — nenhum commit necessário."
  if [ -z "$desc" ] && [ -t 0 ]; then
    read -r -p "📝 Descrição para este ponto de backup (opcional, Enter para pular): " desc
  fi
fi

commit_hash=$(git rev-parse HEAD)
commit_short=$(git rev-parse --short HEAD)
author=$(git log -1 --pretty=format:'%an <%ae>')
ts=$(date -u +%Y-%m-%d_%H-%M-%S)

# 1) Sincronizar repositório principal (origin).
origin_status="pulado (main protegida)"
if [ "$branch" != "main" ]; then
  if git push origin "$branch"; then
    origin_status="ok"
  else
    origin_status="FALHOU"
  fi
else
  echo "⚠️  Branch 'main': push em main só é feito via 'subir-ok'. O backup manual não envia para origin/main."
fi

# 2) Sincronizar repositório de backup (mirror de main/develop + tags conhecidas).
git fetch origin --tags --quiet || true

branch_sync_status="ok"
for b in "${PROTECTED_BRANCHES[@]}"; do
  if git rev-parse --verify -q "refs/remotes/origin/$b" >/dev/null 2>&1; then
    if ! git push "$BACKUP_REPO_HTTPS" "refs/remotes/origin/$b:refs/heads/$b"; then
      branch_sync_status="FALHOU ($b)"
    fi
  fi
done
if ! git push "$BACKUP_REPO_HTTPS" --tags; then
  branch_sync_status="FALHOU (tags)"
fi

# 3) Criar identificador de backup manual (tag anotada isolada no repo de backup).
#    A tag é criada localmente, enviada ao repositório de backup e removida do
#    repositório principal em seguida — nenhuma tag nova fica em main/develop.
slug=""
if [ -n "$desc" ]; then
  slug="-$(printf '%s' "$desc" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-40)"
fi
tagname="manual-${ts}${slug}"
tagmsg="Backup manual
data: $(date +%Y-%m-%d)
hora: $(date +%H:%M:%S)
branch: $branch
commit: $commit_hash
autor: $author
descricao: ${desc:-(nenhuma)}
"
git tag -f -a "$tagname" -m "$tagmsg" "$commit_hash" >/dev/null

tag_status="ok"
if ! git push "$BACKUP_REPO_HTTPS" "refs/tags/$tagname:refs/tags/$tagname"; then
  tag_status="FALHOU"
fi
git tag -d "$tagname" >/dev/null 2>&1

echo ""
echo "======================================="
echo "📋 Relatório do Backup Manual"
echo "======================================="
echo "Data/hora:            $(date '+%Y-%m-%d %H:%M:%S')"
echo "Branch:               $branch"
echo "Commit:               $commit_short"
echo "Autor:                $author"
echo "Commit criado agora:  $commit_made"
echo "Descrição:            ${desc:-(nenhuma)}"
echo "Sync repo principal:  $origin_status"
echo "Sync repo backup:     $branch_sync_status"
echo "Tag de backup:        $tag_status ($tagname)"
echo "======================================="

if [[ "$branch_sync_status" != "ok" || "$tag_status" != "ok" || "$origin_status" == "FALHOU" ]]; then
  echo "❌ Backup concluído COM FALHAS. Verifique as mensagens acima."
  exit 1
fi
echo "✅ Backup manual concluído com sucesso."
exit 0
