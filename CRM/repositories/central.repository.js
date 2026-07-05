import { createRepository } from './base.repository.js';

export const ComandosRepository = createRepository('comandos');
export const CategoriasComandosRepository = createRepository('categorias_comandos');
export const InformacoesRepository = createRepository('informacoes');
export const CategoriasInformacoesRepository = createRepository('categorias_informacoes');
