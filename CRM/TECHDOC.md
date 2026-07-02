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

Descoberta de módulos acontece via: cards do Dashboard, `shared/favoritos.js` (barra de favoritos), busca global do Dashboard, sidebar global (`shared/sidebar.js`, lista mestra `ITEMS`) e a **Central de Módulos** (`shared/central-modulos.js`, catálogo `TODOS_MODULOS` — recriada em 2026-07-01; favoritos marcados ali aparecem automaticamente na sidebar via `shared/menu-favoritos.js`). Um módulo listado em `TODOS_MODULOS`/`ITEMS` é tratado como módulo oficial do sistema, com o mesmo tratamento visual e de navegação dos demais (não existe hoje uma categoria separada de "módulo isolado/experimental" nesses catálogos).

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

## 6. Módulo "🔐 Usuários e Permissões" (`pages/usuarios-permissoes/`) — Fase 1

Homologado em 2026-07-01 (checklist completo: segurança, CRUD de usuários, CRUD de perfis, Firebase secundário, auditoria, Firestore Rules, regressão, performance e documentação). Ver §6.8 para o resultado da homologação.

### 6.1 Arquitetura e isolamento

| Arquivo | Papel |
|---|---|
| `pages/usuarios-permissoes/index.html` | Página do módulo: gate de bloqueio (`#up-bloqueado`), 5 abas (Dashboard/Usuários/Perfis/Permissões/Logs), modal genérico, toast |
| `pages/usuarios-permissoes/usuarios-permissoes.css` | Visual próprio (prefixo de classes `up-`) |
| `pages/usuarios-permissoes/usuarios-permissoes.js` | Toda a lógica: CRUD de usuários/perfis, matriz de permissões, auditoria, seed |
| `pages/usuarios-permissoes/firebase-secondary.js` | Instância Firebase App **separada** (`usuarios-permissoes-secondary`) só para criar contas/redefinir senha sem afetar a sessão do admin logado |

O módulo **não importa** `shared/tenant.js` nem altera `scripts/kernel.js`, `scripts/firebase.js` ou `login.html` — usa apenas as APIs públicas já existentes do kernel (`initModulo`/`temPermissao`/`getUid`/`getNome`). Está listado como módulo oficial em `shared/central-modulos.js` (`TODOS_MODULOS`) e `shared/sidebar.js` (`ITEMS`), com o mesmo tratamento visual/de navegação dos demais módulos — não é uma página acessível apenas por URL direta.

### 6.2 Duas camadas de "perfil" (propositalmente separadas)

| Campo | Onde vive | Papel |
|---|---|---|
| `usuarios/{uid}.perfil` | Lido por `kernel.js::temPermissao()` | Nível de acesso do kernel (`master_admin(100) > admin(80) > gerente(60) > tecnico(40) > atendente(20)`) — controla o **gate deste módulo** (exige `admin`) |
| `usuarios/{uid}.perfil_operacional_id` | Referencia `perfis_operacionais/{id}` | RBAC operacional novo, com matriz de permissões por módulo (visualizar/criar/editar/excluir/aprovar) |

Todo usuário criado por este módulo recebe um `perfil` de kernel mapeado a partir do perfil operacional escolhido (`PERFIL_OPERACIONAL_PARA_KERNEL` em `usuarios-permissoes.js`), pois deixar o campo vazio faria `kernel.js::_buildContext()` assumir `admin` por padrão (comportamento pré-existente do kernel, não introduzido por este módulo — ver §6.7).

### 6.3 Modelo de dados

**`usuarios/{uid}`** (documento já existente do kernel; este módulo só adiciona campos):
```
perfil_operacional_id, nome_exibicao, setor, telefone, observacao,
status ('ativo'|'inativo'), conta_padrao (bool), criado_por,
ultima_alteracao, createdAt
```
Só usuários com `perfil_operacional_id` preenchido aparecem na aba Usuários (filtro em `iniciarListeners()`).

**`perfis_operacionais/{id}`**:
```
nome, descricao, sistema (bool — true para os 7 perfis do seed), ativo (bool),
permissoes: { [moduloId]: { visualizar, criar, editar, excluir, aprovar } },
criadoEm, criadoPor, atualizadoEm
```
Catálogo de módulos da matriz: `dashboard, os, caixa, estoque, financeiro, crm, agenda, relatorios, configuracoes` (só `caixa`/`financeiro` têm coluna "Aprovar" habilitada). 7 perfis seed: Administrador (acesso total), Financeiro, Caixa, Estoque, Técnico, Comercial, Atendimento.

**`auditoria_usuarios_permissoes/{logId}`** (log imutável, append-only):
```
acao, admin_uid, admin_nome, alvo_uid, alvo_nome, detalhes, timestamp
```
Ações registradas: `usuario_criado, usuario_editado, usuario_desativado, usuario_reativado, perfil_alterado, perfil_criado, perfil_editado, permissoes_alteradas, senha_redefinida`.

### 6.4 Fluxo de autenticação

Idêntico ao padrão do kernel (§2) — `initModulo()` resolve o contexto (timeout 10s) ou redireciona para `login.html`. Este módulo não cria nenhum mecanismo de autenticação próprio.

### 6.5 Fluxo de autorização

Dupla camada, testada na homologação:
1. **UI**: `usuarios-permissoes.js::boot()` chama `temPermissao('admin')`; se falso, exibe `#up-bloqueado` com a mensagem "Você não possui permissão para acessar este módulo..." e nunca renderiza `#up-app` nem inicia os listeners.
2. **Firestore Rules** (`CRM/firestore.rules`): mesmo que a UI fosse contornada, as regras bloqueiam de verdade:
   ```
   match /usuarios/{uid} {
     allow read, write: if request.auth != null && (
       request.auth.uid == uid ||
       get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.perfil in ['admin', 'master_admin']
     );
   }
   match /perfis_operacionais/{perfilId} {
     allow read: if request.auth != null;
     allow write: if request.auth != null &&
       get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.perfil in ['admin', 'master_admin'];
   }
   match /auditoria_usuarios_permissoes/{logId} {
     allow read, create: if request.auth != null &&
       get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.perfil in ['admin', 'master_admin'];
     allow update, delete: if false; // imutável
   }
   ```

### 6.6 Firebase secundário (criação de conta / redefinição de senha)

Sem Cloud Functions/Admin SDK neste projeto. `firebase-secondary.js` mantém uma **segunda instância** do Firebase App (`usuarios-permissoes-secondary`), com seu próprio `Auth`, isolada da instância principal usada por `kernel.js`/`scripts/firebase.js`. Isso permite `createUserWithEmailAndPassword` (criar conta) e `signInWithEmailAndPassword` + `updatePassword` (redefinir senha) **sem** disparar `onAuthStateChanged` da sessão principal — confirmado na homologação: a sessão do administrador permanece ativa durante e depois de criar contas, rodar o seed e redefinir senhas. Redefinição de senha tem duas vias: informar a senha atual (o admin a define/controla) ou `sendPasswordResetEmail` (link por e-mail) — limitação conhecida da Fase 1 por falta de Admin SDK.

### 6.7 Limitações conhecidas / observações

- **Coluna "Perfil" da aba Usuários pode ficar em "—" indefinidamente** numa carga normal da página: `renderUsuarios()` só é re-executado pelo próprio listener de `usuarios` (`iniciarListeners()`, `usuarios-permissoes.js`), nunca pelo listener de `perfis`. Se o snapshot de `perfis_operacionais` chegar depois do de `usuarios` (comum, já que são `onSnapshot` independentes), a coluna renderiza com o array `perfis` ainda vazio e não se corrige sozinha — só um novo evento em `usuarios` (busca, edição, etc.) força o re-render correto. **Bug confirmado na homologação, não corrigido nesta entrega** (correção sugerida: chamar `renderUsuarios()` também no callback do listener de `perfis`).
- **Rastreamento de "Últimos acessos"** no Dashboard do módulo: não implementado nesta fase (mensagem explícita na UI).
- **`kernel.js::_buildContext()` assume `perfil = 'admin'` por padrão** para qualquer UID sem documento `usuarios/{uid}` prévio (primeiro acesso) — comportamento pré-existente do kernel, não introduzido por este módulo, mas relevante para quem for planejar a Fase 2: qualquer conta nova que faça login pela primeira vez sem passar por este módulo vira admin automaticamente.
- Sem Cloud Functions/Admin SDK: redefinição de senha exige a senha atual ou e-mail de reset (§6.6).
- Nenhum módulo operacional existente (`os`, `caixa`, `financeiro` etc.) consulta `perfis_operacionais`/`perfil_operacional_id` ainda — a matriz de permissões é gerida aqui, mas não é **aplicada** em nenhum outro lugar do sistema nesta fase.

### 6.8 Homologação — resultado

**Status: ✅ APROVADA em 2026-07-01.** A partir desta data, o módulo Usuários e Permissões passa a fazer parte da arquitetura oficial do sistema, com o mesmo status dos demais módulos.

Todas as 9 seções do checklist de homologação foram executadas e aprovadas (login admin/comum, bloqueio de acesso por UI e por Rules, CRUD completo de usuários e perfis, matriz de permissões com persistência confirmada após reload, Firebase secundário com sessão do admin preservada, redefinição de senha por senha atual e por e-mail, 9/9 tipos de ação de auditoria confirmados com todos os campos, regressão limpa em 10 módulos existentes + o novo módulo, performance: app visível em ~0.9s, ~8 requisições Firestore por carregamento, zero polling desnecessário).

**Incidente crítico encontrado e corrigido durante a homologação:** o release ativo do Firestore Rules em produção estava travado numa versão anterior (2026-06-30), sem os blocos deste módulo — mesmo após confirmação de "Publicar" no Console. Causa raiz identificada via API do Firebase Rules (não pelo Console, que se mostrou não confiável para esse diagnóstico) e corrigida publicando o ruleset correto diretamente pela API. Rules validadas com 18/18 testes automatizados no emulador antes da correção.

**Dados de teste**: contas/perfil/usuário criados exclusivamente para a homologação (conta admin QA, conta comum QA, usuário "QA Teste CRUD Usuario", perfil "QA Perfil Customizado (Editado)") foram removidos após a aprovação, junto de uma alteração de teste na matriz do perfil Estoque (revertida). Os registros de auditoria gerados pelos testes foram **mantidos** — a coleção `auditoria_usuarios_permissoes` é imutável por regra (`allow update, delete: if false`), validada como correta na Seção 6; apagar registros exigiria abrir uma exceção pontual a essa garantia, o que não foi feito. Os 7 perfis padrão e as 8 contas seed (criadas com e-mails de teste `itamaratento+ccqaseed...`) foram mantidos a pedido — a atualização para o padrão de e-mail definitivo da empresa fica para quando essa estratégia for definida.

**Pendências oficiais para a Fase 2**:
1. Integrar o RBAC operacional (`perfis_operacionais`) aos módulos existentes — gradual, um módulo por vez, começando por um piloto, sem integração em massa.
2. Corrigir a condição de corrida da coluna "Perfil" (§6.7).
3. Implementar rastreamento de último acesso.
4. Evoluir o gerenciamento de senha usando Cloud Functions/Admin SDK, quando houver backend disponível.
5. Atualizar permissões em tempo real sem exigir recarregar a página.

---

## 7. Fase 2 — Integração gradual do RBAC

Roadmap oficial (nunca pular a ordem, nunca integrar módulos simultaneamente): **Sprint 1 — Dashboard (piloto) → Sprint 2 — CRM, Agenda → Sprint 3 — Estoque, Caixa → Sprint 4 — Financeiro → Sprint 5 — OS**. Cada sprint segue: Planejamento → Implementação → Testes unitários → Homologação → Correções → TECHDOC → Aprovação formal → Liberação.

### 7.1 Sprint 1 — Dashboard (piloto)

**Escopo aprovado**: só o grid de cards de módulo do Dashboard (`.module-card[data-module]`) passa a respeitar `visualizar` da matriz de `perfis_operacionais`. Busca global e sidebar do Dashboard **não** foram tocadas nesta sprint (ficam com o comportamento atual, sem filtro).

**Arquivos alterados**: `CRM/pages/dashboard/dashboard.js` (backups em `BACKUP_RBAC_DASHBOARD_2026-07-01/` e `dashboard.js.backup-antes-sprint1-RBAC-2026-07-01`). `index.html` do Dashboard não precisou de alteração.

**Arquivo criado**: `CRM/shared/permissoes.js` — a leitura/verificação da matriz, inicialmente escrita como função interna do Dashboard (`_carregarPermissoesVisualizar`), foi extraída para este módulo isolado logo em seguida, para que os Sprints 2-5 reutilizem a mesma API (`carregarPermissoes`, `podeVisualizar`, `podeCriar`, `podeEditar`, `podeExcluir`, `podeAprovar`) sem redesenho. `dashboard.js` hoje só importa e chama essa API — não tem mais lógica de leitura de `perfis_operacionais` embutida.

**Como funciona**:
```javascript
// Mapeamento data-module do card → moduloId da matriz (só os que a matriz cobre)
const RBAC_CARD_PARA_MODULO_ID = {
  'os': 'os', 'caixa': 'caixa', 'estoque': 'estoque',
  'financeiro': 'financeiro', 'crm-comercial': 'crm', 'relatorios': 'relatorios',
};
```
Cards fora desse mapa (`central-alertas`, `clientes`, `compras`, `fornecedor`, `pos-venda`, `impressora`, `contas`, `portal-cliente`, `portal-tecnico`, `central-organizacao`, `central-informacoes`, `catalogo`, `diario`, `auditoria`, `autoatendimento`) nunca são ocultados nesta sprint — a matriz de `perfis_operacionais` não cobre esses módulos ainda.

Em `_bootDashboard()`, logo após `initModulo()`, chama `carregarPermissoes(ctx)` (de `shared/permissoes.js`):
- Se `ctx.perfil` (kernel) é `admin` ou `master_admin` → matriz interna fica `null` sem nenhuma leitura extra ao Firestore (bypass, sempre mostra tudo — decisão explícita, consistente com o gate do próprio módulo de Usuários e Permissões).
- Senão, lê `usuarios/{uid}.perfil_operacional_id`; se vazio (usuário ainda não migrado ao RBAC novo) → matriz fica `null` (mostra tudo, **sem regressão** para quem não foi migrado — decisão explícita e testada).
- Só se houver `perfil_operacional_id` válido é que a matriz de `perfis_operacionais/{id}` é lida e cacheada em memória; qualquer erro de leitura também cai em `null` (nunca esconde módulo por falha de rede).
- `setupModules()` oculta (`display:none`) o card cujo `moduloId` mapeado retorna `podeVisualizar(moduloId) === false`.

**Testes realizados** (contas descartáveis, removidas ao final): (1) perfil operacional restrito (`estoque.visualizar=false`) + kernel `atendente` → só o card Estoque some, resto intacto; (2) usuário sem `perfil_operacional_id` (simulando a maioria da base atual, ainda não migrada) → todos os 22 cards visíveis, comportamento idêntico ao de antes da mudança; (3) kernel `admin` com perfil operacional restrito → bypass confirmado, todos os cards visíveis. Zero erros de console novos (só o warning pré-existente de Service Worker, não relacionado). Regressão nos demais módulos não re-executada nesta sprint (Dashboard não altera nenhum outro módulo).

**Extração para `shared/permissoes.js`**: revisão de código confirma que a extração preserva exatamente a mesma sequência e as mesmas regras de fail-open descritas acima — nenhuma lógica nova foi introduzida. Os 3 cenários acima não foram re-executados manualmente no navegador após a extração (ambiente sem `node`/browser automatizado disponível nesta sessão); recomenda-se repetir ao menos o cenário (1) antes do próximo deploy, como checagem de sanidade.

**Aprovado formalmente pelo usuário em 2026-07-02.** Sprint 1 liberado. Próximo passo oficial: Sprint 2 — CRM, Agenda (ver `plans/` — planejamento técnico ainda não elaborado).

### 7.2 Sprint 2 — CRM + Agenda

**Status: ✅ aprovado formalmente em 2026-07-02.** Documentação completa (implementação, homologação, análises e aprovação): `plans/fase2-sprint2-crm-agenda-rbac.md`.

**Arquivos alterados** (backups `.BACKUP_2026-07-02*` nas mesmas pastas): `pages/crm-comercial/crm.js`, `entrada.js`, `chips.js`, `chips-entrada.js` (moduloId `crm`) e `pages/acaodasemana/acaodasemana.js` (moduloId `agenda`). Nenhum HTML, `kernel.js`, `firebase.js` ou Firestore Rules alterado.

**Padrão aplicado** (mesmo do Sprint 1, agora com verbos de escrita): boot explícito `initModulo()` → `carregarPermissoes(ctx)` → gate de `podeVisualizar` (redirect) antes de qualquer render; `podeCriar`/`podeEditar`/`podeExcluir` condicionam a renderização de botões/cards/pills. Telas 100% de criação (`entrada.html`, `chips-entrada.html`) bloqueiam a página inteira com redirect se `!podeCriar('crm')`. **Achado estrutural**: 4 dos 5 arquivos nunca chamavam `initModulo()` diretamente (gate real só indireto via `dock.js`; `chips-entrada.html` sem gate real nenhum) — o boot explícito corrigiu isso de tabela.

**Decisão de produto (Agenda)**: a UI não separa criar/editar (autosave reescreve o documento do dia inteiro), então a escrita só é liberada com `podeCriar('agenda') && podeEditar('agenda')` — regra AND, mais restritiva, confirmada pelo usuário e validada em teste (casos cruzados permanecem bloqueados).

**Homologação**: (a) automatizada — harness Node+jsdom executando o código real dos 5 arquivos com kernel/Firestore mockados, 20/20 cenários corretos (admin legado, seed com matriz total, restrito por verbo, não migrado, visualizar=false), zero exceção; (b) manual pelo usuário em navegador real — login admin e restrito, edição de perfis, bloqueios confirmados. `FirebaseError` de Favoritos observado no console foi analisado (pré-existente, cosmético, listener ativo em troca de conta; Sprint 2 não tocou `central-modulos.js`) e aceito pelo usuário como comportamento esperado.

**Pendências registradas (não bloqueantes, fora desta sprint)**: card da Agenda no grid do Dashboard ainda não é ocultado por `podeVisualizar('agenda')` (`RBAC_CARD_PARA_MODULO_ID` sem entrada — Dashboard é módulo fechado do Sprint 1, micro-fix futuro precisa de autorização própria); BL-001 no `plans/BACKLOG.md` (indicador permanente de usuário + os dois perfis na barra superior).

**Marco de restauração**: tag git `sprint2-rbac-crm-agenda-aprovado` (branch `develop`).

### 7.3 Sprint 3 — Estoque + Caixa

**Status: implementado e verificado automaticamente em 2026-07-02 (12/12 cenários) — aguardando homologação manual e aprovação formal.** Documentação completa: `plans/fase2-sprint3-estoque-caixa-rbac.md`.

**Arquivos alterados** (backups `.BACKUP_2026-07-02.js` nas mesmas pastas): `pages/estoque/estoque.js` (moduloId `estoque`; boot reestruturado — não chamava `initModulo()`) e `pages/caixa/caixa.js` (moduloId `caixa`; já chamava `initModulo()`, ganhou `carregarPermissoes` + gates). Verbos aplicados: visualizar (redirect), criar, editar, excluir — nos botões/forms de produto, movimentação ±, lançamento, lembretes e nova categoria.

**Pontos de atenção resolvidos**: (a) integração Estoque↔Caixa preservada — a baixa/entrada automática de estoque na venda é executada por funções locais do Caixa e não recebe nenhum gate (testado: venda com `estoque.*` 100% negado ainda baixa estoque); (b) **guarda de iframe** no gate de `visualizar` do Caixa — o Dashboard carrega o Caixa em iframe invisível a cada abertura (`_verificarFechamentoCaixa`); o redirect só ocorre em `window.self === window.top`, eliminando risco de loop (testado em cenário automatizado com iframe simulado); (c) `aprovar` do Caixa **sem efeito nesta sprint** por decisão do usuário — o fluxo de fechamento (semântica original) foi removido em 30/06; quando reintroduzido (Fase 4), gatear por `podeAprovar('caixa')`.

**Pendência pré-existente registrada (não corrigida — fora de escopo)**: o iframe de fechamento do Dashboard dispara a cada carga sem efeito (orquestrador não existe mais no Caixa; cache `caixa_ultimo_fechamento` nunca é gravado). Correção exige autorização própria (módulo Dashboard).

---

## 8. Histórico de Entregas

| Data | Funcionalidade |
|------|---------------|
| 2026-06-30 | Reconstrução da Central de Alertas como módulo independente (`pages/central-alertas/`), status por usuário (`central_alertas_status`), regra Firestore corrigida, TECHDOC.md recriado |
| 2026-07-01 | Novo módulo "🔐 Usuários e Permissões" (`pages/usuarios-permissoes/`) — Fase 1: usuários funcionais, perfis operacionais livres (`perfis_operacionais`), matriz de permissões por módulo, auditoria (`auditoria_usuarios_permissoes`), seed de 7 perfis + 8 contas padrão. Login/kernel.js/firebase.js/tenant.js intocados. Homologado no mesmo dia — ver §6. |
| 2026-07-01 | Favoritos da Central de Módulos passam a aparecer automaticamente no menu principal (`shared/menu-favoritos.js` consumindo `shared/central-modulos.js`), estrela ⭐ na grade de módulos, regras Firestore para `usuarios/{uid}/preferencias/*` e `crm_leads` corrigidas, gate de sessão real adicionado em `crm-comercial/entrada.js` |
| 2026-07-01 | Homologação da Fase 1 de "🔐 Usuários e Permissões" **aprovada** — 9/9 seções do checklist, incidente crítico de Firestore Rules em produção corrigido durante o processo. Ver §6.8. Projeto liberado para a Fase 2 (integração gradual do RBAC aos módulos existentes). |
| 2026-07-01 | Fase 2, Sprint 1 (piloto): Dashboard passa a ocultar cards de módulo sem `visualizar:true` na matriz de `perfis_operacionais`, com bypass para admin/master_admin e fallback seguro (sem regressão) para usuários ainda não migrados ao RBAC novo. `kernel.js`/Firestore Rules intocados. Ver §7.1 — aprovado em 2026-07-02. |
| 2026-07-02 | Fase 2, Sprint 2: RBAC integrado ao CRM Comercial (`crm.js`, `entrada.js`, `chips.js`, `chips-entrada.js`) e à Agenda (`acaodasemana.js`) — visualizar/criar/editar/excluir aplicados à UI, boot explícito `initModulo()`+`carregarPermissoes()` adicionado aos 4 arquivos que não o tinham, regra AND criar+editar na Agenda. Homologado (jsdom 20/20 + navegador real) e **aprovado formalmente** no mesmo dia. Tag `sprint2-rbac-crm-agenda-aprovado`. Ver §7.2. |
| 2026-07-02 | Fase 2, Sprint 3: RBAC integrado ao Estoque (`estoque.js`, boot reestruturado) e ao Caixa (`caixa.js`) — visualizar/criar/editar/excluir na UI; guarda de iframe no gate do Caixa (evita loop com o iframe de fechamento do Dashboard); fluxo venda→baixa de estoque preservado sem gate (testado com estoque 100% negado); `aprovar` do Caixa sem efeito por decisão formal (fechamento inexistente no código vivo). Verificação automatizada 12/12. Ver §7.3 — pendente homologação manual e aprovação. |
