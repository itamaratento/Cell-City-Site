#!/bin/bash
# ================================================================
# DEPLOY SaaS MULTIEMPRESA — Cell City
# Execute este script APÓS completar o setup master + migração.
# ================================================================

set -e
cd "$(dirname "$0")"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  🚀 DEPLOY SaaS — Cell City Gestão Empresarial"
echo "══════════════════════════════════════════════════════════"
echo ""

# ── Verificar login Firebase ─────────────────────────────────────
echo "▶ Verificando autenticação Firebase..."
if ! firebase projects:list --json 2>/dev/null | grep -q "cellcity-crm"; then
  echo "❌ Não autenticado. Execute: firebase login"
  exit 1
fi
echo "✅ Autenticado no projeto: cellcity-crm"
echo ""

# ── Passo 1: Deploy Hosting (setup.html, migration.html, homolog.html) ────
echo "▶ [1/3] Deploy Hosting — publicando páginas SaaS..."
firebase deploy --only hosting --project cellcity-crm
echo "✅ Hosting publicado"
echo ""
echo "   ⏸  PAUSA OBRIGATÓRIA — Execute agora:"
echo "   1. Abrir: https://cellcity-crm.web.app/CRM/pages/saas/setup.html"
echo "   2. Fazer login com sua conta Google"
echo "   3. Preencher nome e executar Setup Master"
echo "   4. Confirmar que empresa 'cellcity-master' e usuário master_admin foram criados"
echo ""
read -p "   ✅ Setup Master concluído? [ENTER para continuar] "

echo ""
echo "   ⏸  PAUSA OBRIGATÓRIA — Execute agora:"
echo "   1. Abrir: https://cellcity-crm.web.app/CRM/pages/saas/migration.html"
echo "   2. Clicar em 'Iniciar Migração'"
echo "   3. Aguardar conclusão (todos os docs devem mostrar ✅)"
echo ""
read -p "   ✅ Migração concluída? [ENTER para continuar] "

# ── Passo 2: Deploy Firestore Rules ─────────────────────────────
echo ""
echo "▶ [2/3] Deploy Firestore Rules..."
firebase deploy --only firestore:rules --project cellcity-crm
echo "✅ Rules publicadas"
echo ""

# ── Passo 3: Deploy Firestore Indexes ───────────────────────────
echo "▶ [3/3] Deploy Firestore Indexes..."
firebase deploy --only firestore:indexes --project cellcity-crm
echo "✅ Indexes atualizados"
echo ""

echo "══════════════════════════════════════════════════════════"
echo "  ✅ DEPLOY CONCLUÍDO"
echo ""
echo "  PRÓXIMO PASSO — Homologação:"
echo "  Abrir: https://cellcity-crm.web.app/CRM/pages/saas/homolog.html"
echo "  Executar todos os testes → verificar aprovação"
echo "══════════════════════════════════════════════════════════"
echo ""
