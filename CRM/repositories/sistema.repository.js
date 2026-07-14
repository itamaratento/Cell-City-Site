import { createRepository } from './base.repository.js';
import { createTenantRepository } from './base.repository.tenant.js';

// Globais (sem isolamento por empresa)
export const MetadataRepository = createRepository('metadata');
export const ConfigRepository = createRepository('config');
export const AlarmeConfigRepository = createRepository('alarme_config');

// Escopo por empresa
export const ResumoLiveRepository = createTenantRepository('resumo_live');
export const HistoricoDiarioRepository = createTenantRepository('historico_diario');
export const HistoricoMensalRepository = createTenantRepository('historico_mensal');
export const HistoricoSemanalRepository = createTenantRepository('historico_semanal');
export const VendasImportadasRepository = createTenantRepository('vendas_importadas');
export const AlertasUsuarioRepository = createTenantRepository('alertas_usuario');
export const CentralAlertasStatusRepository = createTenantRepository('central_alertas_status');
