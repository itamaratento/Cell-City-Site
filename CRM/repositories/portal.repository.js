import { createTenantRepository } from './base.repository.tenant.js';

export const PortalEventosRepository = createTenantRepository('portal_eventos');
export const MensagensPortalRepository = createTenantRepository('mensagens_portal');
export const AvaliacoesRepository = createTenantRepository('avaliacoes');
export const AgendamentosRepository = createTenantRepository('agendamentos');
