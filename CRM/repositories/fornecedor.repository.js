import { createTenantRepository } from './base.repository.tenant.js';

export const FornecedorComprasRepository = createTenantRepository('fornecedor_compras');
export const FornecedorTendenciasRepository = createTenantRepository('fornecedor_tendencias');
