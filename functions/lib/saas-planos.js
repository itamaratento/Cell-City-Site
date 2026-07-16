/* Espelho CJS de CRM/shared/saas-planos.js — sincronizar manualmente ao alterar planos. */
const PLANOS = {
  trial: {
    id: 'trial',
    nome: 'Trial',
    modulos: null,
    features: ['whatsapp', 'portal_cliente'],
    trial: true,
  },
  basico: {
    id: 'basico',
    nome: 'Plano Básico',
    modulos: [
      'dashboard', 'os', 'caixa', 'financeiro', 'central-alertas',
      'clientes', 'config', 'relatorios', 'contas',
    ],
    features: ['whatsapp'],
    trial: false,
  },
  profissional: {
    id: 'profissional',
    nome: 'Plano Profissional',
    modulos: [
      'dashboard', 'os', 'caixa', 'financeiro', 'central-alertas',
      'clientes', 'config', 'relatorios', 'contas',
      'estoque', 'compras', 'fornecedor', 'catalogo',
      'acaodasemana', 'agenda', 'pos-venda', 'crm',
      'diario', 'importar',
    ],
    features: ['whatsapp', 'portal_cliente', 'importacao_dados'],
    trial: false,
  },
  enterprise: {
    id: 'enterprise',
    nome: 'Enterprise',
    modulos: null,
    features: [
      'whatsapp', 'portal_cliente', 'importacao_dados',
      'dashboard_avancado', 'relatorios_premium', 'api_externa',
      'backup_automatico',
    ],
    trial: false,
  },
};

const PLANOS_VALIDOS = Object.keys(PLANOS);

function getPlano(planoId) {
  return PLANOS[planoId] || PLANOS.trial;
}

function featureFlagsObject(features) {
  return Object.fromEntries((features || []).map((f) => [f, true]));
}

function provisionamentoPorPlano(planoId) {
  const plano = getPlano(planoId);
  return {
    modulos_ativos: plano.modulos,
    feature_flags: featureFlagsObject(plano.features),
  };
}

module.exports = { PLANOS, PLANOS_VALIDOS, getPlano, provisionamentoPorPlano };
