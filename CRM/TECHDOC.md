# Cell City CRM — Documentação Técnica

> Recriado em: 2026-06-30 (o arquivo original foi perdido no rollback de 2026-06-27 que reverteu o experimento multiempresa). Esta versão descreve a arquitetura **atual** do sistema — não o modelo SaaS/multiempresa antigo, que foi descontinuado.

---

## 1. Visão Geral da Arquitetura

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML + JavaScript (ES modules nativos) — sem build step |
| Backend | Firebase / Firestore v10 (client SDK modular) |
| Auth | Firebase Auth (e-mail/senha via `scripts/kernel.js`) |
| Hosting | **GitHub Pages** (`www.cellcityinformatica.com.br`) — publicação só via `git push`. **Firebase Hosting está proibido** (decisão do projeto). |
| Firestore | Apenas dados (`firestore.rules` + `firestore.indexes.json`) — deploy via `firebase deploy --only firestore:rules` |

**Princípio central:** sem transpilação, sem bundler. Cada módulo é uma pasta em `CRM/pages/<modulo>/` com `index.html`, `<modulo>.js`, `<modulo>.css`. Compartilhamento via ES module imports (`CRM/shared/`, `CRM/scripts/`).

---

## 2. Autenticação e bootstrap de módulo (`scripts/kernel.js`)

Todo módulo segue o mesmo padrão de inicialização:

```javascript
import { initModulo } from '/CRM/scripts/kernel.js';

const ctx = await initModulo();
if (!ctx) return; // não autenticado → kernel.js já redirecionou para /CRM/login.html

// ctx.uid        — UID Firebase do usuário
// ctx.email      — e-mail
// ctx.nome       — nome de exibição
// ctx.empresaId  — empresa ativa (single-store: 'cellcity-master')
// ctx.perfil     — admin | gerente | tecnico | atendente | caixa
```

- `kernel.js` mantém um único `onAuthStateChanged` global (`_ready` Promise, timeout de 10s).
- Gate visual nos `<head>` dos módulos: `localStorage.cc_kernel_v1 === '1'` evita flash de conteúdo antes do redirect — **não é mecanismo de segurança**, isso é papel das Firestore Rules.
- Multiempresa (`tenant.js`, `empresa_id` em queries) foi **revertido**; não usar como referência — a maioria das coleções de negócio (`os`, `clientes`, `posvenda_contatos`, `mensagens_portal`, `avaliacoes`, `agenda`) não filtra por `empresa_id`.

Outros pontos de entrada compartilhados, incluídos via `<script>`/`<script type="module">` em quase toda página de módulo:
- `shared/brand-header.js` — injeta o cabeçalho padrão (`#crm-brand-bar`) com logo + título centralizado.
- `shared/dock.js` — dock lateral de atalhos + bloco de notas (`notas_usuarios/{uid}`), importa `shared/favoritos.js`.
- `shared/favoritos.js` — catálogo `MODULES` (ícone/label) usado para "Fixar nos Favoritos"; fonte de verdade em `favoritos_usuarios/{uid}`.

---

## 3. Central de Alertas (`pages/central-alertas/`)

### 3.1 Histórico

Até 2026-06-30 a "Central de Alertas" era um **modal** (`#modal-lista-alertas`) dentro de `pages/dashboard/index.html`, populado por `dashboard.js`. Em 2026-06-30 a interface foi descartada e reconstruída como **módulo independente**, seguindo o padrão visual do Diário (`pages/diario/`). A lógica de geração de alertas (regras de negócio) foi **portada, não reescrita** — mesmas condições, mesma priorização.

### 3.2 Arquivos

| Arquivo | Papel |
|---|---|
| `pages/central-alertas/index.html` | Página do módulo: header, cards de resumo, busca, filtros, lista, modal de detalhes, modal de configuração de som |
| `pages/central-alertas/central-alertas.css` | Visual — mesmos design tokens de `pages/diario/diario.css` (`--cell-green`, `--bg-surface`, etc.) |
| `pages/central-alertas/central-alertas.js` | Toda a lógica: geração de alertas, status, filtros, sons |

### 3.3 Fluxo de funcionamento

```
DOMContentLoaded
   │
   ▼
initModulo() (kernel.js) ──► ctx.uid
   │
   ├─► iniciarStatusSync()   — onSnapshot em central_alertas_status/{uid}
   │
   └─► carregar() ──► gerarAlertas()
                          │
                          ├─ lerAgenda()                 → coleção 'agenda'
                          ├─ getDocs('os')                → 1 única leitura, reaproveitada
                          ├─ getDocs('posvenda_contatos')
                          ├─ getDocs('mensagens_portal', where lida==false)
                          └─ getDocs('avaliacoes', orderBy createdAt desc, limit 5)
                          (as 5 chamadas acima rodam em Promise.all — paralelas)
                          │
                          ▼
                     render() ──► aplicarFiltros() + atualizarResumo()
                          │
                          ▼
                  cards na tela (1 card por alerta, com id estável)

setInterval(carregar, 30000) + window 'focus' → refresh automático
```

### 3.4 Regras de negócio (geração de alertas)

Idênticas às que existiam em `dashboard.js::gerarAlertas()` antes da reconstrução. Por prioridade:

1. **Ação da Semana** (lida via `lerAgenda()`, coleção `agenda`, suporta recorrência semanal/mensal/anual):
   - Vencidas (qualquer dia anterior) → crítico, som, pulsar
   - No horário atual (0–5 min) → crítico, som, pulsar (só se não houver vencidas)
   - Próximas (6–15 min) → atenção, som (só se não houver vencidas nem "agora")
2. **Pós-venda**: por OS `status === 'entregue'`, prazos de contato 5/15/30 dias após entrega (via `posvenda_contatos`); vencido (>prazo+2 dias) = crítico, pendente = atenção.
3. **Ordem de Serviço**: orçamento parado >2 dias = crítico; orçamento aguardando aprovação = atenção; pronta para entrega = atenção.
4. **Portal do Cliente**: mensagens não lidas (`mensagens_portal` com `lida === false`) = atenção (+ um card individual por cliente, até 3).
5. **Avaliações** (`avaliacoes`, últimas 5): recebidas hoje = informativo; nota ≤ 2 = crítico, som, pulsar.
6. **Aparelhos prontos não retirados** (`status === 'concluido'` há >3 dias) → atenção, com lista detalhada (`_osData`) abrível no modal.
7. **Orçamentos sem resposta** (`status` orçamento há >2 dias) → atenção, com lista detalhada.

**Otimização introduzida na reconstrução:** a coleção `os` antes era lida 3× (pós-venda, prontos, orçamentos) dentro de `dashboard.js`; agora é lida 1× e o resultado é reaproveisado nas três regras — reduz leituras Firestore por carregamento.

### 3.5 Coleções Firestore utilizadas

| Coleção | Uso | Regra (`CRM/firestore.rules`) |
|---|---|---|
| `agenda` | Eventos da Ação da Semana | `auth != null` |
| `os` | Status de cada Ordem de Serviço | `get: true` (público p/ garantia.html) / `list,write: auth != null` |
| `posvenda_contatos` | Contatos de pós-venda já feitos | `auth != null` |
| `mensagens_portal` | Mensagens não lidas do Portal do Cliente | `auth != null` |
| `avaliacoes` | Avaliações de clientes | `auth != null` (cobre staff e sessão anônima do portal — ver §3.8) |
| `central_alertas_status` | Status por usuário (novo/lido/resolvido) | **`auth != null && auth.uid == docId`** (isolado por usuário) |

### 3.6 Controle de status (Novo / Lido / Resolvido)

Alertas são **recomputados a cada carga** (não são documentos persistidos) — não existe um "id de alerta" natural no banco. Para rastrear status entre sessões:

1. Cada alerta gerado recebe um **id estável**: `slug((tipo || titulo) + '::' + sub)` (`alertId()` em `central-alertas.js`). `tipo` identifica a regra de negócio (ex.: `posVendaCritico`); `sub` carrega o dado variável (ex.: nome do cliente), garantindo que alertas por-cliente não colidam entre si.
2. O status fica em **um único documento por usuário**: `central_alertas_status/{uid}`, campo `itens: { [alertId]: { status, em } }` — mesmo padrão de `notas_usuarios/{uid}` (um doc, sincronizado em tempo real).
3. Sincronização em tempo real via `onSnapshot` (`iniciarStatusSync()`); escrita via `setDoc(..., { merge: true })` (`setStatus()`), com atualização **otimista** da UI antes da confirmação do Firestore.
4. Transições: `novo → lido` (automático ao abrir o modal de detalhes, ou manual via botão 👁️) `→ resolvido` (botão ✅) `→ novo` (botão ↩️ "Reabrir"). Não há transição automática para "resolvido" quando a condição de origem desaparece — se o alerta para de ser gerado, ele simplesmente some da lista (o registro de status fica órfão no Firestore, sem custo prático).

### 3.7 Configuração de sons

Reaproveita a **mesma chave de localStorage** que o sistema antigo do Dashboard usava (`cc_config_alertas`), para que a configuração feita em qualquer um dos dois lugares valha para o outro:

```json
{
  "som": {
    "ativo": true, "horarioInicio": "08:00", "horarioFim": "18:00",
    "diasSemana": [1,2,3,4,5],
    "silencio": { "ativo": false, "inicio": "12:00", "fim": "13:00" }
  },
  "alertasComSom": { "acaoSemanaVencidas": true, "...": "..." },
  "pulsacao": { "critico": true, "atencao": false }
}
```

O modal de configuração (`#alr-modal-config`) é uma cópia visual/funcional do antigo `#modal-config-alertas` do Dashboard, com prefixo de classes `alr-` em vez de `config-`. O som é gerado via Web Audio API (`tocarSomTeste()`), sem dependência de arquivos de áudio.

> Nota: a Central de Alertas **não** tenta tocar som sozinha em loop — isso continua sendo papel do painel rotativo oculto do Dashboard (`setupAlerts()`/`gerarAlertas()` em `dashboard.js`), que roda enquanto o usuário está na tela inicial. A nova página só oferece o botão "Testar Som" e o formulário de configuração.

### 3.8 Observação de segurança — `avaliacoes`

O Portal do Cliente (`pages/portal-cliente/index.html`) autentica o visitante via **Firebase Anonymous Auth** (`signInAnonymously`) antes de escrever uma avaliação — por isso a regra simples `auth != null` já cobre tanto a equipe (contas reais) quanto o cliente anônimo. **Limitação conhecida, não corrigida nesta entrega:** qualquer sessão anônima do portal pode, em tese, listar avaliações de outros clientes (telefone, nome, nota, texto), pois a regra não restringe por dono do documento — isso é consistente com o padrão usado em todas as outras coleções públicas do portal (`mensagens_portal`, `portal_eventos`, `solicitacoes_diagnostico`) e não foi alterado para não introduzir uma inconsistência isolada nem risco de regressão no Portal sem testes mais amplos.

### 3.9 Integração com o Dashboard

| Ponto de integração | Antes (modal) | Depois (módulo) |
|---|---|---|
| Card `data-module="central-alertas"` (`dashboard/index.html`) | Inalterado — já existia | Inalterado |
| `dashboard.js::navigateTo()` | `if (module==='central-alertas') this.abrirListaAlertas()` | Removido o caso especial; entrada normal no mapa `routes` → `../../pages/central-alertas/index.html` |
| `dashboard.js::abrirListaAlertas()` | Renderizava o modal | **Removida** |
| `#modal-lista-alertas` (HTML) | Existia em `dashboard/index.html` | **Removido**, junto do CSS órfão (`.modal-lista-*`, `.lista-alerta-*` em `dashboard.css`) |
| `#modal-config-alertas` / `setupConfigAlertas()` | Usado pelo modal antigo e pelo painel rotativo oculto | **Mantido** — agora só referenciado pelo painel rotativo oculto (`#btn-abrir-config-alertas`); as referências mortas ao modal removido foram limpas |
| `shared/favoritos.js::MODULES` | Sem entrada `central-alertas` | Entrada adicionada (ícone ⚠️) |
| Busca global (`dashboard.js::state.searchData.modulos`) | Sem entrada | Entrada adicionada |
| "Painel de Alertas" (sino 🔔, `pv_visto`/`os_visto`) | — | **Não alterado** — é um sistema separado e continua funcionando como antes |

### 3.10 Dependências do módulo

- `scripts/kernel.js` (`initModulo`) — autenticação
- `scripts/firebase.js` — `db, collection, getDocs, query, where, orderBy, limit, doc, setDoc, onSnapshot, serverTimestamp`
- `shared/brand-header.js`, `shared/dock.js` (e, transitivamente, `shared/favoritos.js`) — UI padrão
- Coleções: `agenda`, `os`, `posvenda_contatos`, `mensagens_portal`, `avaliacoes`, `central_alertas_status`
- localStorage: `cc_config_alertas` (compartilhada com o painel oculto do Dashboard)

---

## 4. Catálogo de módulos (`pages/`)

`os`, `caixa`, `central-alertas`, `central-comandos`, `central-informacoes`, `central-organizacao`, `crm-comercial`, `clientes`, `compras`, `contas`, `diario`, `estoque`, `financeiro`, `fornecedor`, `importar`, `relatorios`, `acaodasemana`, `minha-semana`, `pos-venda`, `portal-cliente`, `portal-tecnico`, `analise`, `auditoria`, `autoatendimento`, `campanhas`, `catalogo`, `config`, `chat`, `em-breve`, `kernel-test`, `usuarios-permissoes` (Fase 1 — gestão de usuários/perfis/permissões, isolado, ver seção 6).

Não existe mais um catálogo centralizado de módulos em código (`shared/central-modulos.js` e a "Central de Controle" de 5 abas descritos em versões antigas desta documentação foram perdidos no rollback de 2026-06-27 e não foram recriados). Descoberta de módulos hoje acontece via: cards do Dashboard, `shared/favoritos.js` (barra de favoritos) e busca global do Dashboard.

---

## 5. Template de Relatório de Entrega

Toda nova funcionalidade entregue deve incluir este relatório no chat (não gera arquivo):

```
## Relatório de Entrega — [Nome da Funcionalidade]
**Data:** YYYY-MM-DD

### Objetivo
Uma frase descrevendo o que foi entregue.

### Arquivos modificados
- `caminho/arquivo.js` — o que mudou

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

## 6. Histórico de Entregas

| Data | Funcionalidade |
|------|---------------|
| 2026-06-30 | Reconstrução da Central de Alertas como módulo independente (`pages/central-alertas/`), status por usuário (`central_alertas_status`), regra Firestore corrigida, TECHDOC.md recriado |
| 2026-07-01 | Novo módulo isolado "🔐 Usuários e Permissões" (`pages/usuarios-permissoes/`) — Fase 1: usuários funcionais, perfis operacionais livres (`perfis_operacionais`), matriz de permissões por módulo, auditoria (`auditoria_usuarios_permissoes`), seed de 7 perfis + 8 contas padrão. Login/kernel.js/firebase.js/tenant.js intocados. Ver relatório completo no chat. |
| 2026-07-01 | Favoritos da Central de Módulos passam a aparecer automaticamente no menu principal (`shared/menu-favoritos.js` consumindo `shared/central-modulos.js`), estrela ⭐ na grade de módulos, regras Firestore para `usuarios/{uid}/preferencias/*` e `crm_leads` corrigidas, gate de sessão real adicionado em `crm-comercial/entrada.js` |
