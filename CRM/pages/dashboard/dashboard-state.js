/* ============================================
CELL CITY CRM — DASHBOARD — ESTADO COMPARTILHADO
Etapa 4 da refatoração modular: state inicial, _uid, RBAC_CARD_PARA_MODULO_ID.
============================================ */

// RBAC (Fase 2, Sprint 1 — só leitura/ocultação de cards no grid do
// Dashboard). Mapeia data-module (grid) → moduloId da matriz de
// perfis_operacionais. Cards sem entrada aqui nunca são ocultados
// (matriz não cobre esses módulos ainda — ver plans/fase2-sprint1-dashboard-rbac.md).
export const RBAC_CARD_PARA_MODULO_ID = {
  'os': 'os',
  'caixa': 'caixa',
  'estoque': 'estoque',
  'financeiro': 'financeiro',
  'crm-comercial': 'crm',
  'relatorios': 'relatorios',
};

// Substitui a antiga variável solta `let _uid` — um objeto mutável
// permite que outros módulos leiam/escrevam o mesmo valor através de
// imports ES (uma variável importada não pode ser reatribuída, uma
// propriedade de objeto pode).
export const dashboardShared = { uid: null };

export function criarEstadoInicial() {
  return {
    meta: { current: 151, goal: 10000 },
    calendar: {
      open: false,
      viewDate: new Date(),
      selectedDate: null
    },
    searchData: {
      os: [
        { id: 'OS-2847', title: 'iPhone 11 - Tela quebrada', sub: 'Cliente: João Silva' },
        { id: 'OS-2846', title: 'Samsung A52 - Bateria', sub: 'Cliente: Maria Santos' },
        { id: 'OS-2845', title: 'Xiaomi Redmi Note 10', sub: 'Cliente: Pedro Lima' }
      ],
      clientes: [
        { id: 'C-001', title: 'João Silva', sub: '(11) 99999-1234' },
        { id: 'C-002', title: 'Maria Santos', sub: '(11) 98888-5678' },
        { id: 'C-003', title: 'Pedro Lima', sub: '(11) 97777-9012' }
      ],
      produtos: [
        { id: 'P-001', title: 'Tela iPhone 11', sub: 'Estoque: 12 un.' },
        { id: 'P-002', title: 'Bateria Samsung A52', sub: 'Estoque: 8 un.' },
        { id: 'P-003', title: 'Carregador USB-C', sub: 'Estoque: 24 un.' }
      ],
      modulos: [
        { id: 'os', title: 'Ordem de Serviço', sub: 'Módulo' },
        { id: 'clientes', title: 'Clientes', sub: 'Módulo' },
        { id: 'caixa', title: 'Caixa', sub: 'Módulo' },
        { id: 'central-alertas', title: 'Central de Alertas', sub: 'Módulo' },
        { id: 'estoque', title: 'Estoque', sub: 'Módulo' },
        { id: 'campanhas', title: 'Campanhas', sub: 'Módulo' },
        { id: 'analise', title: 'Análise', sub: 'Módulo' },
        { id: 'pos-venda', title: 'Pós-venda', sub: 'Módulo' },
        { id: 'config', title: 'Configurações', sub: 'Módulo' },
        { id: 'ferramentas', title: 'Ferramentas', sub: 'Módulo' },
        { id: 'fornecedor',  title: 'Fornecedor',  sub: 'Módulo' },
        { id: 'financeiro',  title: 'Financeiro',  sub: 'Módulo' },
        { id: 'em-breve',    title: 'Em Breve',    sub: 'Módulo' },
        { id: 'diario',      title: 'Diário',      sub: 'Módulo' }
      ]
    }
  };
}
