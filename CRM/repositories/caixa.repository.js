import { createTenantRepository } from './base.repository.tenant.js';

export const CaixaLancamentosRepository = createTenantRepository('caixa_lancamentos');
export const CategoriasCaixaRepository = createTenantRepository('categorias_caixa');
