import { createTenantRepository } from './base.repository.tenant.js';

export const OSRepository = createTenantRepository('os');
export const PreOSRepository = createTenantRepository('pre_os');
export const SolicitacoesDiagnosticoRepository = createTenantRepository('solicitacoes_diagnostico');
