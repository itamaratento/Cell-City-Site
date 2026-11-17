/* ============================================================
   SAAS-PLANOS.JS — Planos e Feature Flags (PS-5)
   Cell City Gestão Empresarial

   Define os planos disponíveis e os módulos/features
   que cada plano inclui.

   Uso:
     import { getModulosPorPlano, getFeatureFlags } from './saas-planos.js';
     const modulos = getModulosPorPlano('profissional');
   ============================================================ */

export const PLANOS = {
  trial: {
    id: 'trial',
    nome: 'Trial',
    descricao: 'Acesso completo por 30 dias',
    modulos: null, // null = todos
    features: ['whatsapp', 'portal_cliente'],
    trial: true,
  },
  basico: {
    id: 'basico',
    nome: 'Plano Básico',
    descricao: 'OS, Caixa, Financeiro e Alertas',
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
    descricao: 'Básico + Estoque, Compras, Agenda, CRM, Fornecedor',
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
    descricao: 'Todos os módulos sem restrição',
    modulos: null, // null = todos
    features: [
      'whatsapp', 'portal_cliente', 'importacao_dados',
      'dashboard_avancado', 'relatorios_premium', 'api_externa',
      'backup_automatico',
    ],
    trial: false,
  },
};

export function getPlano(planoId) {
  return PLANOS[planoId] || PLANOS.enterprise;
}

export function getModulosPorPlano(planoId) {
  return getPlano(planoId).modulos;
}

export function getFeatureFlags(planoId) {
  return getPlano(planoId).features;
}

export function temModulo(planoId, moduloId) {
  const plano = getPlano(planoId);
  if (!plano.modulos) return true; // null = todos
  return plano.modulos.includes(moduloId);
}

export function temFeature(planoId, featureId) {
  const plano = getPlano(planoId);
  return plano.features.includes(featureId);
}

/** Espelho do contrato de functions/lib/saas-planos.js — sync manual. */
export function featureFlagsObject(features) {
  return Object.fromEntries((features || []).map((f) => [f, true]));
}

/**
 * Provisiona módulos e flags a gravar em empresas/{id} (paridade com
 * saasOnboardingCriarEmpresa). Usado pelo CRUD manual do saas-admin.
 */
export function provisionamentoPorPlano(planoId) {
  const plano = getPlano(planoId);
  return {
    modulos_ativos: plano.modulos,
    feature_flags: featureFlagsObject(plano.features),
  };
}
