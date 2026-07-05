import { createRepository } from './base.repository.js';

export const ProdutosRepository = createRepository('produtos');
export const CatalogoProdutosRepository = createRepository('catalogo_produtos');
export const CategoriasProdutosRepository = createRepository('categorias_produtos');
export const CatalogoConfigRepository = createRepository('catalogo_config');
