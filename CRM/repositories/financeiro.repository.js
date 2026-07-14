import { createTenantRepository } from './base.repository.tenant.js';

export const FinanceiroPagarRepository = createTenantRepository('financeiro_pagar');
export const FinanceiroReceberRepository = createTenantRepository('financeiro_receber');
export const FinanceiroCategoriasRepository = createTenantRepository('financeiro_categorias');
export const FinanceiroFixasRepository = createTenantRepository('financeiro_fixas');
export const LembretesPagamentoRepository = createTenantRepository('lembretes_pagamento');
