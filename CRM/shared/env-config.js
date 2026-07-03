// ===== SELEÇÃO DE AMBIENTE (DEV × PRODUÇÃO) =====
// Fonte única de verdade para qual projeto Firebase o app usa.
// Script clássico (não-módulo): define window.CC_ENV e window.CC_FIREBASE_CONFIG,
// consumível tanto por <script src> (páginas compat) quanto por import de efeito
// colateral (módulos ES). Ver plans/SEPARACAO_AMBIENTES_DEV_PROD.md, seção 3.2.
//
// STATUS: arquivo criado na Fase 1 (infraestrutura). Ainda NÃO é referenciado por
// nenhum módulo do sistema — carregar/importar este arquivo é a Fase 5, que só
// começa com o TECHDOC aprovado e as Fases 1-4 concluídas. CONFIG_DEV abaixo é
// placeholder até a Fase 1 terminar (Auth + bucket Storage do cellcity-crm-dev
// ainda pendentes) e o Web App do projeto DEV ser registrado no Firebase.

const CONFIG_PROD = {
  apiKey: "AIzaSyD5wQRvcVdweOhVqwd8e08JuzRXOESEbqE",
  authDomain: "cellcity-crm.firebaseapp.com",
  projectId: "cellcity-crm",
  storageBucket: "cellcity-crm.firebasestorage.app",
  messagingSenderId: "645609867368",
  appId: "1:645609867368:web:b3ee19ccfe3d17c61c53dd"
};

// TODO (Fase 1, pendente): preencher com o Web App real do projeto cellcity-crm-dev
// assim que Auth + Storage estiverem provisionados. Não usar em produção enquanto
// projectId não for "cellcity-crm-dev".
const CONFIG_DEV = {
  apiKey: "PENDENTE_FASE_1",
  authDomain: "cellcity-crm-dev.firebaseapp.com",
  projectId: "cellcity-crm-dev",
  storageBucket: "cellcity-crm-dev.firebasestorage.app",
  messagingSenderId: "PENDENTE_FASE_1",
  appId: "PENDENTE_FASE_1"
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
