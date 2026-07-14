import { createTenantRepository } from './base.repository.tenant.js';

export const ComandosRepository = createTenantRepository('comandos');
export const CategoriasComandosRepository = createTenantRepository('categorias_comandos');
export const InformacoesRepository = createTenantRepository('informacoes');
export const CategoriasInformacoesRepository = createTenantRepository('categorias_informacoes');
