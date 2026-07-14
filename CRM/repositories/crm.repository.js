import { createTenantRepository } from './base.repository.tenant.js';

export const CrmLeadsRepository = createTenantRepository('crm_leads');
export const ContasNumerosRepository = createTenantRepository('contas_numeros');
