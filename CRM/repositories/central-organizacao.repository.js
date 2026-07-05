import { createRepository } from './base.repository.js';

// Central de Organização (CRM/pages/central-organizacao/) — cada "seção"
// (whatsapp, etc.) é um documento dentro desta coleção única.
export const CentralOrganizacaoRepository = createRepository('central_organizacao');
