import { createTenantRepository } from './base.repository.tenant.js';

export const ProdutosRepository = createTenantRepository('produtos');
export const CatalogoProdutosRepository = createTenantRepository('catalogo_produtos');
export const CategoriasProdutosRepository = createTenantRepository('categorias_produtos');
export const CatalogoConfigRepository = createTenantRepository('catalogo_config');
