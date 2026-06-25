#!/bin/bash
# deploy.sh — Cell City CRM: deploy completo
set -e

cd "/home/cellcity/Músicas/projetos/Cell-City-Site"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Cell City CRM — Deploy Completo        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Verificar login
echo "▶ Verificando autenticação Firebase..."
if ! firebase projects:list --project cellcity-crm > /dev/null 2>&1; then
  echo ""
  echo "Você não está logado. Iniciando login..."
  echo ""
  firebase login --no-localhost
fi

# 2. Confirmar projeto
echo ""
echo "▶ Usando projeto: cellcity-crm"
firebase use cellcity-crm

# 3. Deploy Hosting
echo ""
echo "▶ Deploy do Hosting (publicando todos os arquivos)..."
firebase deploy --only hosting --project cellcity-crm

echo ""
echo "▶ Deploy das Firestore Rules..."
firebase deploy --only firestore:rules --project cellcity-crm

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅ Deploy concluído!                    ║"
echo "║                                          ║"
echo "║   Próximo passo:                         ║"
echo "║   Abra no browser:                       ║"
echo "║   https://cellcity-crm.web.app/CRM/      ║"
echo "║   pages/saas/setup.html                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""
