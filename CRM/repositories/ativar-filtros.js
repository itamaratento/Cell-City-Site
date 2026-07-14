/* ============================================================
   ATIVAR-FILTROS.JS — Ativação dos Filtros Multiempresa (PS-3)
   Cell City Gestão Empresarial

   Executar APÓS o backfill de empresa_id estar 100% concluído.
   Ativa o filtro automático empresa_id em todos os repositories.

   Uso (console do navegador, ambiente DEV):
     import { ativarFiltrosTenant } from './ativar-filtros.js';
     await ativarFiltrosTenant();

   Ou via script:
     import './ativar-filtros.js'; // auto-executa ao importar
   ============================================================ */

import {
  OSRepository, PreOSRepository, SolicitacoesDiagnosticoRepository
} from './os.repository.js';
import { CaixaLancamentosRepository, CategoriasCaixaRepository } from './caixa.repository.js';
import { ClientesRepository } from './clientes.repository.js';
import { EstoqueRepository } from './estoque.repository.js';
import {
  FinanceiroPagarRepository, FinanceiroReceberRepository,
  FinanceiroCategoriasRepository, FinanceiroFixasRepository,
  LembretesPagamentoRepository
} from './financeiro.repository.js';
import { CrmLeadsRepository, ContasNumerosRepository } from './crm.repository.js';
import { ChipsRepository } from './chips.repository.js';
import {
  DiarioRegistrosRepository, DiarioEventosRepository,
  TarefasSemanaRepository, AgendaRepository, AcoesSemanaRepository
} from './diario.repository.js';
import {
  FornecedorComprasRepository, FornecedorTendenciasRepository
} from './fornecedor.repository.js';
import {
  PosvendaContatosRepository, PosvendaMensagensRepository,
  PosvendaRastreamentoRepository
} from './posvenda.repository.js';
import {
  ProdutosRepository, CatalogoProdutosRepository,
  CategoriasProdutosRepository, CatalogoConfigRepository
} from './produtos.repository.js';
import {
  ComandosRepository, CategoriasComandosRepository,
  InformacoesRepository, CategoriasInformacoesRepository
} from './central.repository.js';
import { CentralOrganizacaoRepository } from './central-organizacao.repository.js';
import {
  PortalEventosRepository, MensagensPortalRepository,
  AvaliacoesRepository, AgendamentosRepository
} from './portal.repository.js';
import {
  ResumoLiveRepository, HistoricoDiarioRepository,
  HistoricoMensalRepository, HistoricoSemanalRepository,
  VendasImportadasRepository, AlertasUsuarioRepository,
  CentralAlertasStatusRepository
} from './sistema.repository.js';

export function ativarFiltrosTenant() {
  const repos = [
    OSRepository, PreOSRepository, SolicitacoesDiagnosticoRepository,
    CaixaLancamentosRepository, CategoriasCaixaRepository,
    ClientesRepository,
    EstoqueRepository,
    FinanceiroPagarRepository, FinanceiroReceberRepository,
    FinanceiroCategoriasRepository, FinanceiroFixasRepository,
    LembretesPagamentoRepository,
    CrmLeadsRepository, ContasNumerosRepository,
    ChipsRepository,
    DiarioRegistrosRepository, DiarioEventosRepository,
    TarefasSemanaRepository, AgendaRepository, AcoesSemanaRepository,
    FornecedorComprasRepository, FornecedorTendenciasRepository,
    PosvendaContatosRepository, PosvendaMensagensRepository,
    PosvendaRastreamentoRepository,
    ProdutosRepository, CatalogoProdutosRepository,
    CategoriasProdutosRepository, CatalogoConfigRepository,
    ComandosRepository, CategoriasComandosRepository,
    InformacoesRepository, CategoriasInformacoesRepository,
    CentralOrganizacaoRepository,
    PortalEventosRepository, MensagensPortalRepository,
    AvaliacoesRepository, AgendamentosRepository,
    ResumoLiveRepository, HistoricoDiarioRepository,
    HistoricoMensalRepository, HistoricoSemanalRepository,
    VendasImportadasRepository, AlertasUsuarioRepository,
    CentralAlertasStatusRepository,
  ];

  let ativos = 0;
  let jaAtivos = 0;

  repos.forEach(repo => {
    if (repo.isFilterEnabled()) {
      jaAtivos++;
      return;
    }
    if (typeof repo.enableFilter === 'function') {
      repo.enableFilter();
      ativos++;
    }
  });

  console.log(`[FiltrosTenant] ${ativos} repositórios ativados. ${jaAtivos} já estavam ativos.`);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tenant-filters-enabled', {
      detail: { ativados: ativos, jaAtivos }
    }));
  }

  return { ativados: ativos, jaAtivos };
}

// Auto-ativação via import (descomentar quando backfill estiver concluído)
// ativarFiltrosTenant();
