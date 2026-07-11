#!/bin/bash
# Validação do artefato de deploy do GitHub Pages — Cell City.
#
# Incidente 2026-07-11: excludes do rsync em deploy-pages.yml sem "/" inicial
# casavam em qualquer profundidade e apagaram CRM/pages/ e CRM/scripts/
# inteiros do artefato publicado (site inteiro fora do ar). Este script
# reproduz LOCALMENTE o mesmo rsync do workflow, contra a árvore de trabalho
# atual, e falha se qualquer caminho crítico da aplicação não aparecer no
# resultado — pega essa classe de bug antes do push, não depois.
#
# Uso: scripts/release/validar-deploy.sh
# Saída: 0 se o artefato está íntegro, 1 se falhou alguma checagem.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_DIR" || { echo "❌ Não foi possível acessar o repositório em $REPO_DIR."; exit 1; }

TMPDIR_ARTEFATO=$(mktemp -d)
trap 'rm -rf "$TMPDIR_ARTEFATO"' EXIT

echo "📦 Simulando o rsync de deploy-pages.yml contra a árvore de trabalho atual..."

# Mesmos excludes do workflow — mantidos em sincronia manual (ver
# .github/workflows/deploy-pages.yml). Se um dia divergirem, este script
# passa a validar um artefato diferente do que a CI realmente publica.
rsync -a \
  --exclude='/.git' --exclude='/.github' \
  --exclude='/plans/' --exclude='/CLAUDE.md' --exclude='CRM/pages/kernel-test/' \
  --exclude='/_BACKUPS/' --exclude='/_runtime_audit/' --exclude='/sql/' --exclude='/pages/' --exclude='/scripts/' --exclude='/sistema/' \
  --exclude='/BACKUP_POSVENDA_SAAS_FIX_2026-06-26/' \
  --exclude='firestore.rules.backup*' --exclude='firebase.json.bak*' \
  ./ "$TMPDIR_ARTEFATO/" 2>&1

# Caminhos mínimos que precisam sobreviver ao rsync — se qualquer um sumir,
# a aplicação não carrega em produção (achado real do incidente: CRM/pages/
# e CRM/scripts/ inteiros desapareceram por um exclude mal ancorado).
CAMINHOS_CRITICOS=(
  "CRM/index.html"
  "CRM/pages/dashboard/index.html"
  "CRM/pages/dashboard/dashboard.js"
  "CRM/pages/dashboard/dashboard.css"
  "CRM/pages/os/index.html"
  "CRM/pages/os/os.js"
  "CRM/pages/portal-cliente/index.html"
  "CRM/pages/portal-cliente/portal.js"
  "CRM/scripts/firebase.js"
  "CRM/scripts/kernel.js"
  "CRM/garantia.html"
)

falhou=0
for caminho in "${CAMINHOS_CRITICOS[@]}"; do
  if [ ! -f "$TMPDIR_ARTEFATO/$caminho" ]; then
    echo "❌ AUSENTE no artefato: $caminho"
    falhou=1
  fi
done

# Confere também que nada crítico sumiu de contagem — CRM/pages/ e
# CRM/scripts/ precisam ter uma quantidade razoável de arquivos, não só o
# mínimo listado acima (achado do incidente: um exclude mal ancorado
# esvazia o diretório inteiro, não só arquivos pontuais).
total_pages=$(find "$TMPDIR_ARTEFATO/CRM/pages" -type f 2>/dev/null | wc -l)
total_scripts=$(find "$TMPDIR_ARTEFATO/CRM/scripts" -type f 2>/dev/null | wc -l)
if [ "$total_pages" -lt 50 ]; then
  echo "❌ CRM/pages/ tem só $total_pages arquivo(s) no artefato — esperado bem mais (algum exclude está apagando o diretório?)."
  falhou=1
fi
if [ "$total_scripts" -lt 3 ]; then
  echo "❌ CRM/scripts/ tem só $total_scripts arquivo(s) no artefato — esperado bem mais."
  falhou=1
fi

if [ "$falhou" -eq 1 ]; then
  echo ""
  echo "❌ VALIDAÇÃO DO ARTEFATO FALHOU — o deploy publicaria um site quebrado."
  exit 1
fi

echo "✅ Artefato íntegro: ${#CAMINHOS_CRITICOS[@]} caminhos críticos presentes, CRM/pages ($total_pages arquivos) e CRM/scripts ($total_scripts arquivos) completos."
exit 0
