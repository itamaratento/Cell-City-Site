#!/bin/bash
# Rollback de produção (main) para uma versão semântica anterior — Cell City.
#
# NÃO reescreve histórico: restaura a árvore da versão escolhida como um commit
# NOVO em main (via "git read-tree --reset -u"), com push normal (sem --force,
# sem reset --hard). Nunca apaga tags/versões existentes, nunca mexe em develop.
#
# Uso: scripts/release/rollback.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_DIR" || { echo "❌ Não foi possível acessar o repositório do projeto em $REPO_DIR."; exit 1; }

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ '$REPO_DIR' não é um repositório Git válido."
  exit 1
fi

echo "⏪ Rollback de Produção — Cell City"
echo "Buscando versões (tags vX.Y.Z) em origin..."
if ! git fetch origin --tags --quiet; then
  echo "❌ Falha ao buscar tags de origin."
  exit 1
fi

mapfile -t versions < <(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname)
if [ "${#versions[@]}" -eq 0 ]; then
  echo "⚠️  Nenhuma versão semântica (vX.Y.Z) encontrada. Rode 'subir-ok' ao menos uma vez para gerar a primeira versão."
  exit 1
fi

current_main_commit=$(git rev-parse origin/main 2>/dev/null)

echo ""
echo "Rollback para:"
echo "---------------------------------------------------------------------"
n=0
for t in "${versions[@]}"; do
  n=$((n+1))
  commit=$(git rev-list -n1 "$t")
  date_line=$(git log -1 --format=%ai "$t" 2>/dev/null | cut -d' ' -f1)
  marker=""
  [ "$commit" = "$current_main_commit" ] && marker="  (versão atual em produção)"
  printf "%2d - %-14s data:%-11s commit:%-8s%s\n" "$n" "$t" "${date_line:-?}" "${commit:0:8}" "$marker"
done
echo "---------------------------------------------------------------------"

read -r -p "Escolha o número da versão (ou 0 para cancelar): " choice
if [ -z "$choice" ] || [ "$choice" = "0" ]; then
  echo "Operação cancelada pelo usuário."
  exit 0
fi
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "$n" ]; then
  echo "❌ Opção inválida."
  exit 1
fi

target_tag="${versions[$((choice-1))]}"
target_commit=$(git rev-list -n1 "$target_tag")

if [ "$target_commit" = "$current_main_commit" ]; then
  echo "ℹ️  '$target_tag' já é exatamente a versão atual em produção. Nada a fazer."
  exit 0
fi

echo ""
echo "Selecionado: $target_tag (commit ${target_commit:0:8})"
read -r -p "Confirmar rollback de produção (main) para '$target_tag'? Isso cria um commit NOVO restaurando esse conteúdo — não reescreve histórico, não usa force-push. (s/N) " confirm
if [[ ! "$confirm" =~ ^[sS]$ ]]; then
  echo "Operação cancelada pelo usuário."
  exit 0
fi

echo ""
echo "🗄️  Gerando backup de segurança antes do rollback..."
if ! bash "$SCRIPT_DIR/../backup/backup-manual.sh" "pre-rollback para $target_tag"; then
  echo "❌ Backup falhou. Rollback cancelado por segurança (nada foi alterado em main)."
  exit 1
fi

orig_branch=$(git rev-parse --abbrev-ref HEAD)

echo ""
echo "-- Preparando rollback --"
if ! git checkout main --quiet; then
  echo "❌ Falha ao mudar para 'main'."
  exit 1
fi
if ! git pull origin main --quiet; then
  echo "❌ Falha ao atualizar 'main' local."
  git checkout "$orig_branch" --quiet 2>/dev/null
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Há alterações pendentes em 'main'. Abortando para não misturar rollback com trabalho não commitado."
  git checkout "$orig_branch" --quiet 2>/dev/null
  exit 1
fi

# Restaura a árvore inteira (adiciona o que faltar, remove o que não existia
# na versão-alvo) como um NOVO commit — sem tocar no ponteiro de main via reset.
if ! git read-tree --reset -u "$target_tag"; then
  echo "❌ Falha ao preparar a árvore de rollback (read-tree). Nada foi alterado."
  git checkout "$orig_branch" --quiet 2>/dev/null
  exit 1
fi

if git diff --cached --quiet; then
  echo "ℹ️  Não há diferença entre o conteúdo atual de main e '$target_tag'. Nada a commitar."
  git checkout "$orig_branch" --quiet 2>/dev/null
  exit 0
fi

rollback_ts=$(date -u +%Y-%m-%d_%H-%M-%S)
git commit -q -m "rollback: restaura conteúdo de $target_tag (commit ${target_commit:0:8})

Rollback sem reescrita de histórico: commit novo em main, sem reset --hard e sem force-push.
Versão restaurada: $target_tag
Commit de origem:  $target_commit
Executado em (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
new_commit=$(git rev-parse HEAD)

rollback_tagname=""
read -r -p "Deseja marcar este rollback com uma tag de rastreio? (s/N) " tag_resp
if [[ "$tag_resp" =~ ^[sS]$ ]]; then
  rollback_tagname="rollback-${rollback_ts}-para-${target_tag}"
  git tag -a "$rollback_tagname" -m "Rollback para $target_tag em $rollback_ts"
fi

echo ""
echo "-- Enviando para origin/main (push normal, sem --force) --"
push_ok="sim"
if [ -n "$rollback_tagname" ]; then
  git push origin main --follow-tags || push_ok="não"
else
  git push origin main || push_ok="não"
fi

if [ "$push_ok" != "sim" ]; then
  echo "❌ Push falhou. O commit de rollback existe localmente em 'main' mas ainda não foi publicado."
  echo "   Corrija a causa do erro acima e rode 'git push origin main' manualmente quando estiver pronto."
  exit 1
fi

echo ""
echo "-- Validando --"
remote_head=$(git ls-remote origin refs/heads/main | awk '{print $1}')
integrity_ok="sim"
[ "$remote_head" != "$new_commit" ] && integrity_ok="não"
fsck_out=$(git fsck --no-dangling 2>&1)
fsck_status=$?

git checkout "$orig_branch" --quiet 2>/dev/null

echo ""
echo "======================================="
echo "📋 Relatório de Rollback"
echo "======================================="
echo "Versão restaurada:      $target_tag"
echo "Commit de origem:       $target_commit"
echo "Novo commit em main:    $new_commit"
[ -n "$rollback_tagname" ] && echo "Tag de rastreio:        $rollback_tagname"
echo "origin/main confirmado: $integrity_ok"
echo "Integridade Git (fsck): $([ $fsck_status -eq 0 ] && echo sim || echo NÃO)"
echo "Histórico reescrito:    não (commit novo, sem reset/force-push)"
echo "develop preservada:     sim (não tocada por esta operação)"
echo "======================================="

if [ "$integrity_ok" != "sim" ] || [ "$fsck_status" -ne 0 ]; then
  echo "❌ ALERTA: verifique manualmente antes de considerar o rollback concluído."
  exit 1
fi
echo "✅ Rollback concluído com sucesso."
exit 0
