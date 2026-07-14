import { createTenantRepository } from './base.repository.tenant.js';

export const PosvendaContatosRepository = createTenantRepository('posvenda_contatos');
export const PosvendaMensagensRepository = createTenantRepository('posvenda_mensagens');
export const PosvendaRastreamentoRepository = createTenantRepository('posvenda_rastreamento');
