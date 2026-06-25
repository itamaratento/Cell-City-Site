# Cell City CRM — Documentação Técnica

> Última atualização: 2026-06-25

---

## 1. Visão Geral da Arquitetura

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML + JavaScript (ES modules nativos) — sem build step |
| Backend | Firebase / Firestore v10 (Realtime + batch writes) |
| Auth | Firebase Auth (Google OAuth + email/password) |
| Hosting | Firebase Hosting — `cellcity-crm.web.app` |
| Rewrite | `/CRM/**` → `/CRM/index.html` (fallback SPA) |

**Princípio central:** sem transpilação, sem bundler. Cada módulo é uma pasta com `index.html`, `module.js`, `module.css`. O compartilhamento é feito por ES module imports.

---

## 2. Estrutura de Pastas

```
CRM/
├── pages/              ← módulos da aplicação (cada um é independente)
│   ├── os/             ← Ordem de Serviço
│   ├── caixa/          ← Caixa
│   ├── estoque/        ← Estoque
│   ├── financeiro/     ← Financeiro
│   ├── despesas/       ← Despesas
│   ├── compras/        ← Compras
│   ├── fornecedor/     ← Fornecedores
│   ├── pos-venda/      ← Pós-Venda
│   ├── dashboard/      ← Dashboard principal
│   ├── saas/           ← Central SaaS (master admin)
│   ├── clientes/       ← Cadastro de clientes
│   ├── central-alertas/← Alertas automáticos
│   ├── agenda/         ← Agenda
│   ├── diario/         ← Diário de atividades
│   ├── crm-comercial/  ← CRM / Chips / Leads
│   ├── central-comandos/   ← Comandos técnicos
│   ├── central-informacoes/← Base de conhecimento
│   ├── catalogo/       ← Catálogo de produtos
│   ├── garantias/      ← Garantias
│   ├── venda-rapida/   ← Venda rápida
│   └── ...             ← +15 módulos menores
│
├── shared/             ← componentes compartilhados
│   ├── firebase.js     ← re-exports de todos os helpers Firestore
│   ├── tenant.js       ← contexto multiempresa, PLANOS, PERFIS, loadContext()
│   ├── modulo-guard.js ← guard de autenticação/autorização para módulos
│   ├── sidebar.js      ← barra lateral (filtra módulos por empresa)
│   ├── session.js      ← gestão de sessão e auth
│   ├── brand-header.js ← header com logo
│   └── ...             ← outros componentes UI
│
├── scripts/
│   └── firebase.js     ← inicialização do Firebase, re-exports centrais
│
├── firestore.rules     ← regras de segurança (prod)
├── firestore.rules.secure ← versão mais restritiva (staging)
├── firebase.json       ← config de hosting e rewrites
└── TECHDOC.md          ← este arquivo
```

---

## 3. Catálogo de Módulos

| ID | Nome | Arquivo JS principal | empresa_id | modulo-guard |
|----|------|---------------------|:----------:|:------------:|
| `os` | Ordem de Serviço | `pages/os/os.js` | ✅ | ❌ |
| `caixa` | Caixa | `pages/caixa/caixa.js` | ✅ | ❌ |
| `estoque` | Estoque | `pages/estoque/estoque.js` | ✅ | ❌ |
| `financeiro` | Financeiro | `pages/financeiro/financeiro.js` | ✅ | ❌ |
| `despesas` | Despesas | `pages/despesas/despesas.js` | ✅ | ❌ |
| `compras` | Compras | `pages/compras/compras.js` | ✅ | ❌ |
| `fornecedor` | Fornecedores | `pages/fornecedor/fornecedor.js` | ✅ | ❌ |
| `pos-venda` | Pós-Venda | `pages/pos-venda/posvenda.js` | ✅ | ❌ |
| `dashboard` | Dashboard | `pages/dashboard/dashboard.js` | ✅ | ❌ |
| `saas` | Central SaaS | `pages/saas/saas.js` | N/A | ❌ |
| `clientes` | Clientes | `pages/clientes/clientes.js` | ❌ | ❌ |
| `central-alertas` | Alertas | `pages/central-alertas/alertas.js` | ❌ | ❌ |
| `garantias` | Garantias | `pages/garantias/garantias.js` | ❌ | ❌ |
| `venda-rapida` | Venda Rápida | `pages/venda-rapida/venda-rapida.js` | ❌ | ❌ |
| `catalogo` | Catálogo | `pages/catalogo/catalogo.js` | ❌ | ❌ |
| `crm-comercial` | CRM / Chips | `pages/crm-comercial/crm.js` | ❌ | ❌ |
| `central-comandos` | Comandos | `pages/central-comandos/comandos.js` | ❌ | ❌ |
| `central-informacoes` | Informações | `pages/central-informacoes/informacoes.js` | ❌ | ❌ |
| `diario` | Diário | `pages/diario/diario-gdrive.js` | ❌ | ❌ |
| `agenda` | Agenda | `pages/agenda/agenda.js` | sem reads | ❌ |
| `chips` | Chips (cadastro) | `pages/crm-comercial/chips.js` | ❌ | ❌ |

**Legenda:**
- `empresa_id ✅` = leituras e escritas filtradas por empresa_id
- `modulo-guard ✅` = usa `initModulo()` para autenticação e autorização padronizadas

---

## 4. Fluxo de Autenticação e Permissões

```
Usuário abre página
    │
    ▼
session.js → verifica localStorage/sessionStorage
    │
    ▼
onAuthStateChanged (Firebase Auth)
    │
    ├─ não logado → redireciona /config (login)
    │
    └─ logado
         │
         ▼
    loadContext(uid)  ← tenant.js
         │
         ├─ carrega empresas/{uid_empresa}
         ├─ carrega usuarios/{uid}
         ├─ verifica status, vencimento, bloqueio
         ├─ carrega feature_flags, modulos_ativos
         └─ armazena em window._tenantCtx
              │
              ▼
         modulo-guard.js → initModulo(moduloId)
              │
              ├─ verifica isBloqueado()
              ├─ verifica hasModulo(moduloId)
              └─ retorna ctx ou null (bloqueia acesso)
```

**Perfis disponíveis:** `master_admin`, `admin`, `gerente`, `tecnico`, `caixa`, `atendente`

**Modo Suporte:** Master admin pode simular acesso a qualquer empresa via `ativarModoSuporte(empresaId)`. O `loadContext()` detecta `cc_suporte_empresa_id` no sessionStorage e carrega o contexto da empresa cliente.

---

## 5. Estrutura Firestore

### Coleções de negócio (isoladas por empresa_id)
| Coleção | Módulo responsável |
|---------|-------------------|
| `os` | OS |
| `clientes` | OS / Clientes |
| `caixa_lancamentos` | Caixa |
| `categorias_caixa` | Caixa |
| `financeiro_pagar`, `financeiro_receber`, `financeiro_fixas` | Financeiro |
| `financeiro_despesas`, `financeiro_cat_despesas`, `financeiro_centros_custo`, `financeiro_metas` | Financeiro / Despesas |
| `financeiro_categorias` | Financeiro |
| `estoque_produtos`, `produtos`, `categorias_produtos` | Estoque / Compras |
| `fornecedores`, `fornecedor_compras`, `fornecedor_tendencias` | Fornecedor |
| `compras_financeiras` | Compras |
| `posvenda_contatos` | Pós-Venda |
| `agenda` | Agenda |
| `alertas_usuario` | Central Alertas |
| `pre_os` | Pré-OS |
| `crm_leads` | CRM Comercial |
| `chips_cadastros` | Chips |
| `catalogo_produtos` | Catálogo |
| `lembretes_pagamento`, `encomendas` | Caixa |
| `resumo_live`, `historico_diario/semanal/mensal` | Caixa (fechamento) |
| `acoes_semana`, `tarefas_semana` | Minha Semana |
| `notas_usuarios`, `notas_projeto` | Notas |
| `comandos`, `categorias_comandos` | Central Comandos |
| `informacoes`, `categorias_informacoes` | Central Informações |
| `categorias_wpp`, `blacklist_wpp` | WhatsApp |
| `vendas_importadas` | Importar |
| `diario_registros` | Diário |
| `config` | Config |

### Coleções SaaS (fora do isolamento empresa_id)
| Coleção | Conteúdo |
|---------|---------|
| `empresas/{empresaId}` | Dados do tenant |
| `empresas_arquivadas/{id}` | Exclusão segura (90 dias) |
| `usuarios/{uid}` | Perfil e permissões do usuário |
| `assinaturas/{id}` | Histórico de planos |
| `notificacoes_saas/{id}` | Alertas para o master |
| `auditoria_saas/{id}` | Log de ações administrativas |

---

## 6. Padrão Multiempresa (obrigatório para novos módulos)

```javascript
// 1. Importações
import { initModulo } from '../../shared/modulo-guard.js';
import { getEmpresaId } from '../../shared/tenant.js';
import { query, where, getDocs, collection, db } from '../../scripts/firebase.js';

// 2. Inicialização com guard
const ctx = await initModulo('nome-do-modulo');
if (!ctx) return; // redireciona automaticamente

// 3. Toda leitura filtra por empresa
const q = query(
  collection(db, 'minha_colecao'),
  where('empresa_id', '==', getEmpresaId())
);

// 4. Toda escrita inclui empresa_id
await addDoc(collection(db, 'minha_colecao'), {
  empresa_id: getEmpresaId(),
  // ...demais campos
});
```

---

## 7. Plano de Estabilização (2026-06-25)

### Fase 1 — Deploy crítico (imediato)
- [ ] `firebase deploy --only firestore:rules,hosting`
- [ ] Executar Setup via Central SaaS → aba ⚙️ Setup
- [ ] Executar Migração via Central SaaS → aba 🔄 Migração

### Fase 2 — Completar isolamento empresa_id (alta prioridade)
Módulos com Firestore mas sem filtro empresa_id:

| Módulo | Leituras | Escritas | Complexidade |
|--------|----------|----------|-------------|
| `central-alertas` | 7 | 17 | Alta |
| `clientes` | 9 | 11 | Alta |
| `crm-comercial` (crm.js) | 6 | 9 | Média |
| `central-comandos` | 5 | 8 | Média |
| `central-informacoes` | 6 | 6 | Média |
| `chips` (chips.js) | 2 | 4 | Baixa |
| `catalogo` | 3 | 7 | Média |
| `garantias` | 2 | 2 | Baixa |
| `venda-rapida` | 3 | 3 | Baixa |

### Fase 3 — Limpeza de arquivos legados (média prioridade)
- [ ] Avaliar remoção de `setup.html`, `migration.html`, `homolog.html` (substituídos pela Central SaaS)
- [ ] Remover backups da pasta `shared/`: 7 arquivos `.BACKUP*` e `.bak*`
- [ ] Avaliar `_BACKUPS/` (os.js.bak, fornecedor.js.bak, etc.)
- [ ] Avaliar `limpar-cache.html`, `limpar-cache-os.html` (utilitários manuais)

### Fase 4 — Centralizar catálogo de módulos (média prioridade)
- [ ] `MODULOS_CATALOGO` existe duplicado em `saas.js` e `central-modulos.js` — unificar em um arquivo de configuração compartilhado
- [ ] `PLANOS` e `PERFIS` já centralizados em `tenant.js` — manter lá

### Fase 5 — Adotar modulo-guard em todos os módulos (média prioridade)
- [ ] Os 9 módulos principais (os, caixa, estoque...) ainda fazem auth própria
- [ ] Migrar gradualmente para `initModulo()` — começa pelos menores

### Fase 6 — Revisão de segurança (baixa prioridade)
- [ ] Avaliar `firestore.rules.secure` vs `firestore.rules` — diferenças e quando usar cada uma
- [ ] Testar isolamento de Modo Suporte entre empresas
- [ ] Testar que uma empresa não acessa dados de outra

---

## 8. Arquivos Temporários / Utilitários (atenção)

| Arquivo | Função | Status |
|---------|--------|--------|
| `pages/saas/setup.html` | One-time setup master | ⚠️ Substituído pela aba Setup na Central SaaS |
| `pages/saas/migration.html` | Migração empresa_id | ⚠️ Substituído pela aba Migração na Central SaaS |
| `pages/saas/homolog.html` | Testes de integração | ⚠️ Avaliar incorporar na Central SaaS |
| `limpar-cache.html` | Limpar localStorage | ⚠️ Utilitário manual |
| `limpar-cache-os.html` | Limpar cache de OS | ⚠️ Utilitário manual |

---

## 9. Template de Relatório de Entrega

Toda nova funcionalidade deve incluir este relatório no chat (não gera arquivo):

```
## Relatório de Entrega — [Nome da Funcionalidade]
**Data:** YYYY-MM-DD

### Objetivo
Uma frase descrevendo o que foi entregue.

### Arquivos modificados
- `caminho/arquivo.js` — o que mudou
- `caminho/arquivo.html` — o que mudou

### Arquivos criados
- `caminho/novo.js` — propósito

### Impacto em outros módulos
- Módulo X: impacto Y

### Dependências
- Requer: [o que precisa estar em vigor]

### Testes realizados
- [ ] Fluxo principal: descrição
- [ ] Edge case: descrição

### Possíveis riscos
- Risco: mitigação

### Documentação atualizada
- TECHDOC.md seção X atualizada? Sim/Não
```

---

## 10. Histórico de Entregas

| Data | Funcionalidade | Fase |
|------|---------------|------|
| 2026-06-24 | Sistema SaaS Multiempresa (tenant.js, modulo-guard.js, Central SaaS) | Fase 1 |
| 2026-06-24 | Regras Firestore com isolamento empresa_id | Fase 1 |
| 2026-06-25 | empresa_id em financeiro, despesas, compras, caixa, os, estoque, fornecedor, posvenda, dashboard | Fase 2 |
| 2026-06-25 | Setup e Migração integrados à Central SaaS (abas ⚙️ e 🔄) | Fase 1 |
| 2026-06-25 | Status OS "Aguardando peça" promovido de legacy para fluxo principal | Melhoria |
