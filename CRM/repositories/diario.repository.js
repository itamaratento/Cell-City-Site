import { createTenantRepository } from './base.repository.tenant.js';

export const DiarioRegistrosRepository = createTenantRepository('diario_registros');
export const DiarioEventosRepository = createTenantRepository('diario_eventos');
export const TarefasSemanaRepository = createTenantRepository('tarefas_semana');
export const AgendaRepository = createTenantRepository('agenda');
export const AcoesSemanaRepository = createTenantRepository('acoes_semana');
