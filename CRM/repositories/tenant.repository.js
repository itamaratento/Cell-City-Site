/* ============================================================
   TENANT.REPOSITORY.JS — Repositório de Empresas (PS-2)
   Cell City Gestão Empresarial

   Gerencia a coleção `empresas` — cadastro e configuração
   de cada inquilino/empresa no sistema multiempresa.

   Esta coleção é GLOBAL (não filtrada por empresa_id), pois
   contém o registro de todas as empresas do sistema.

   Uso:
     import { EmpresasRepository } from './tenant.repository.js';
     const empresa = await EmpresasRepository.getById('cellcity-master');
   ============================================================ */

import { createRepository } from './base.repository.js';

export const EmpresasRepository = createRepository('empresas');
