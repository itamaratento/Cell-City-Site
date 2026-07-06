import { createRepository } from './base.repository.js';

export const MetadataRepository = createRepository('metadata');
export const ConfigRepository = createRepository('config');
export const AlarmeConfigRepository = createRepository('alarme_config');
export const ResumoLiveRepository = createRepository('resumo_live');
export const HistoricoDiarioRepository = createRepository('historico_diario');
export const HistoricoMensalRepository = createRepository('historico_mensal');
export const HistoricoSemanalRepository = createRepository('historico_semanal');
export const VendasImportadasRepository = createRepository('vendas_importadas');
export const AlertasUsuarioRepository = createRepository('alertas_usuario');
export const CentralAlertasStatusRepository = createRepository('central_alertas_status');
