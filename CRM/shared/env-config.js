// ===== SELEÇÃO DE AMBIENTE (DEV × PRODUÇÃO) =====
// Fonte única de verdade para qual projeto Firebase o app usa.
// Script clássico (não-módulo): define window.CC_ENV e window.CC_FIREBASE_CONFIG,
// consumível tanto por <script src> (páginas compat) quanto por import de efeito
// colateral (módulos ES). Ver plans/SEPARACAO_AMBIENTES_DEV_PROD.md, seção 3.2.
//
// STATUS: arquivo criado na Fase 1 (infraestrutura). Ainda NÃO é referenciado por
// nenhum módulo do sistema — carregar/importar este arquivo é a Fase 5, que só
// começa com o TECHDOC aprovado e as Fases 1-4 concluídas. CONFIG_DEV já usa os
// valores reais do Web App registrado no cellcity-crm-dev; Auth e o bucket padrão
// do Storage desse projeto ainda estão pendentes de habilitação no console.

const CONFIG_PROD = {
  apiKey: "AIzaSyD5wQRvcVdweOhVqwd8e08JuzRXOESEbqE",
  authDomain: "cellcity-crm.firebaseapp.com",
  projectId: "cellcity-crm",
  storageBucket: "cellcity-crm.firebasestorage.app",
  messagingSenderId: "645609867368",
  appId: "1:645609867368:web:b3ee19ccfe3d17c61c53dd"
};

// Web App "Cell City CRM DEV Web", registrado no Firebase (Fase 1). Auth e o
// bucket padrão do Storage ainda estão pendentes de habilitação no console —
// até lá, Firestore funciona mas Auth/Storage do DEV retornam erro.
const CONFIG_DEV = {
  apiKey: "AIzaSyBq7Qq34lXXfFjvWUE8xFWBCboTHc2HAlQ",
  authDomain: "cellcity-crm-dev.firebaseapp.com",
  projectId: "cellcity-crm-dev",
  storageBucket: "cellcity-crm-dev.firebasestorage.app",
  messagingSenderId: "107140334516",
  appId: "1:107140334516:web:c8ff9a9c8f2e20d4a768e1"
};

// Regra: só é PRODUÇÃO quando está no domínio oficial E fora de /dev.
// Qualquer outro contexto (prefixo /dev, localhost, file://, preview) usa DEV.
// Fail-safe: em caso de dúvida, o padrão é DEV — erro possível vira "teste não
// achou dados", nunca "teste sujou a produção".
const host = location.hostname;
const isProdHost = host === 'www.cellcityinformatica.com.br' || host === 'cellcityinformatica.com.br';
const isDevPath  = location.pathname === '/dev' || location.pathname.startsWith('/dev/');

window.CC_ENV = (isProdHost && !isDevPath) ? 'prod' : 'dev';
window.CC_FIREBASE_CONFIG = window.CC_ENV === 'prod' ? CONFIG_PROD : CONFIG_DEV;
