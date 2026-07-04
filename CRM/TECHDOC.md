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
| Ambientes | 🟢 **MAIN** (branch `main` → raiz do domínio) e 🟠 **DEVELOP** (branch `develop` → `/dev`) — ver §9. ⚠️ Backend Firebase é **único** para os dois (separação planejada, não implementada). |
| Firestore | Apenas dados (fonte oficial: `CRM/firestore.rules` + `CRM/firestore.indexes.json`) — deploy via `firebase deploy --only firestore:rules`, verificação obrigatória do release via API `firebaserules.googleapis.com` |

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
| `pages/usuarios-permissoes/usuarios-permissoes.js` | Toda a lógica: CRUD de usuários/perfis, matriz de permissões, auditoria, exclusão de usuário |
| `pages/usuarios-permissoes/firebase-secondary.js` | Instância Firebase App **separada** (`usuarios-permissoes-secondary`) só para criar contas/redefinir senha/excluir conta sem afetar a sessão do admin logado |

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

### 6.9 Conclusão da tela para produção (2026-07-04)

Fechamento dos itens deixados em aberto pela Fase 1, a pedido do proprietário, na branch `develop` (commits `3459486`/`bed1793`/`d11821b`, publicados só em `/dev`):

- **Seed removido**: os 7 perfis padrão e as 8 contas seed (§6.3/6.8) deixaram de ter botão/rotina de criação automática na UI — cadastro de perfis e usuários passa a ser sempre manual, pelo próprio módulo. Coluna "Últimos acessos" do Dashboard também removida (item nunca implementado, §6.7).
- **Exclusão de usuário** (nova, `abrirExcluirUsuario()`): remove o documento em `usuarios/{uid}` **e** a conta no Firebase Auth secundário — a senha atual da conta-alvo passou a ser **obrigatória** (antes era opcional/"mantém login"), pela mesma limitação de falta de Admin SDK do §6.6: o client SDK só apaga o usuário autenticado na instância corrente, então é preciso autenticar como o próprio alvo antes de excluí-lo.
- **Proteção do último administrador** (guarda única, reaproveitada em exclusão e desativação — `bloqueadoPorProtecaoAdmin(u, baseAdmins, msgProprio, msgUltimoAdmin)`), client-side (não substitui as Firestore Rules — reforço de UX):
  - Bloqueia agir sobre a própria conta logada (`u.id === getUid()`), tanto para excluir quanto para desativar.
  - Bloqueia excluir o **último administrador existente** — conta TODOS os usuários com `perfil` (kernel) `admin`/`master_admin` geridos por este módulo (`ehAdministrador()`), independente do `status`, já que excluir é definitivo.
  - Bloqueia desativar o **último administrador ATIVO** — mesma função, mas a base considerada é filtrada por `status !== 'inativo'` (reativar nunca passa pela guarda, só reduz o problema). Contas legadas sem `perfil_operacional_id` não entram em nenhuma das duas contagens (fora do array `usuarios[]` por construção, §6.3), o que torna os bloqueios mais restritivos, nunca menos seguros.
  - **Observação registrada, não corrigida**: o campo `status` (`ativo`/`inativo`) gerido por este módulo é hoje só informativo — `kernel.js`, `login.html` e `CRM/firestore.rules` não leem esse campo em nenhum ponto, então um usuário "inativo" continua conseguindo logar e usar todo o seu `perfil` de kernel normalmente. A guarda do último admin ativo protege contra "achar" que sobrou um admin operante quando não sobrou, mas não é (e não pretende ser) o mecanismo real de bloqueio de acesso.
- **Robustez**: helper `comCarregamento(btn, texto, fn)` centraliza loading (desabilita botão + texto de progresso), trava de duplo clique e tratamento de erro (`console.error` + toast) em todo botão de escrita do módulo — e corrigiu 3 funções (`toggleStatusUsuario`, `toggleAtivoPerfil`, `salvarMatrizPerfil`) que antes não tinham nenhum tratamento de erro (uma `Promise` rejeitada nelas passava em silêncio, sem feedback ao usuário).
- **Layout**: coluna de ações da tabela de usuários agora é `position: sticky` (sempre visível durante scroll horizontal em telas estreitas, com ajuste de padding/gap abaixo de 480px para caber os 4 botões); `env(safe-area-inset-bottom)` somado ao padding/posição inferior. Modal e toast tiveram o `z-index` revisado duas vezes: primeiro para ficar acima do dock global (`shared/dock.css`, 9000), depois — achado numa segunda auditoria — para também ficar acima da barra de marca sticky injetada por `shared/brand-header.js` (`#crm-brand-bar`, `z-index:9999`) e do menu de ambiente dela (`.crm-env-menu`, `z-index:10000`); sem esse segundo ajuste, a barra fixa no topo (presente em toda página do sistema) podia renderizar por cima do modal em telas baixas. Valores finais: modal `10500`, toast `10600`.
- **Homologação funcional automatizada** (sem navegador — método [[feedback-homologacao-sem-browser]]): harness em jsdom carrega o **arquivo real** `usuarios-permissoes.js` sem nenhuma modificação, com `kernel.js`/`firebase.js`/`firebase-secondary.js` substituídos por mocks que capturam cada chamada e simulam os `onSnapshot` do Firestore. **43/43 casos aprovados**, cobrindo: boot/gate, criar/editar usuário, alterar perfil, ativar/desativar (incl. as duas guardas novas e a auto-ação), excluir (cancelar, senha administrativa errada, senha da conta obrigatória, sucesso, bloqueio do último admin), atualização automática da tabela via listener, pesquisa, filtro de período dos Logs, estado de carregamento do botão durante a operação assíncrona, tratamento de erro (Firestore rejeitado → toast, zero `unhandledRejection`), e exatamente 1 `onSnapshot` por coleção (sem listener duplicado). Não existe paginação nesta tela (não é uma pendência: nunca foi implementada, não há necessidade identificada com os volumes atuais).
- Produção (`main`) não foi tocada — mudanças só em `develop`/`/dev`.

### 6.10 Homologação em navegador real (2026-07-04)

Diferente do §6.9 (jsdom + mocks), esta rodada usou **Chrome real** (`playwright-core` pilotando o binário já instalado no ambiente, headless) logado de verdade em `cellcityadmin@gmail.com` (conta de homologação da Fase 4) contra o Firestore/Auth reais do projeto `cellcity-crm-dev`, viewport desktop (1440×900) e mobile (390×844).

**Aprovado, com evidência real (screenshots, `getComputedStyle`, `getBoundingClientRect`, `document.elementFromPoint`, não simulação):**
- z-index real: modal `10500` e toast `10600` ficam acima da barra de marca `#crm-brand-bar` (`9999`) e do menu dela (`10000`) — inclusive confirmado por `elementFromPoint` que o próprio overlay (não a página por trás) é o elemento clicável na região onde a barra/dock ficariam.
- Sticky real: `position:sticky` computado; após scroll horizontal total da tabela (mobile), a coluna de ações permanece dentro da área visível.
- Safe-area real: `padding-bottom` computado do `.up-wrap` = 120px no mobile.
- Dashboard, Perfis, Permissões, Logs renderizam corretamente com dados reais (18 usuários, 7 perfis).
- Editar usuário, ativar/desativar (com reversão, testado em conta de teste pré-existente "Tecnico Homolog"), cancelar exclusão, bloqueio real de autoexclusão (toast real) — todos confirmados **com o Firestore de verdade**, sem mock.
- Pesquisa filtra corretamente com dados reais.

**Defeito real encontrado e corrigido nesta rodada:** coluna "Perfil" presa em "—" para as 18 contas reais — é o bug de condição de corrida já documentado desde a Fase 1 (§6.7), agora reproduzido com dados reais. Causa raiz confirmada (`renderUsuarios()` só era chamado pelo listener de `usuarios`), corrigido com 1 linha (chamar `renderUsuarios()` também no listener de `perfis_operacionais`), coberto por novo teste de regressão no harness jsdom (45/45 agora) e **revalidado no navegador real** após o deploy: as 18 linhas passaram a mostrar o nome do perfil corretamente. Commit `6bf116b` (+ `adaf849`, redisparo de deploy).

**🔴 Defeito CRÍTICO encontrado, NÃO corrigido — exige autorização explícita:** a regra `allow create` de `usuarios/{uid}` em `CRM/firestore.rules` (linha ~236, escrita durante a correção do BL-006 em 2026-07-03) é:
```
allow create: if request.auth != null && request.auth.uid == uid;
```
Só permite que o próprio usuário crie o **seu** documento (auto-provisionamento no primeiro login) — **sem** a mesma exceção de admin/master_admin que as regras de `update` e `delete` têm logo abaixo. Na prática: **nenhum admin consegue mais criar um usuário novo por este módulo** — reproduzido ao vivo (`FirebaseError: Missing or insufficient permissions`, toast "Sem permissão para esta operação"). Como o `criarContaSecundaria()` roda ANTES do `setDoc()`, o teste chegou a criar uma conta de teste órfã no Firebase Auth do DEV (`qa.homolog.<timestamp>@teste.cellcity.invalid`) — **removida manualmente logo em seguida**, sem deixar rastro.

Isso **não é uma regressão desta sessão** — é uma consequência do rewrite da rule no BL-006 (2026-07-03), que corrigiu a escalada de privilégio mas esqueceu de preservar a exceção de admin no `create` (só ficou em `update`/`delete`). E como aquela correção **foi promovida a produção** na mesma sessão (ver [[project-vuln-usuarios-escalada]]), **é provável que a criação de usuários esteja quebrada em produção também**, não só no DEV — não confirmado aqui (não testei contra produção), mas a regra publicada é a mesma.

**Correção proposta (não aplicada — Firestore Rules exige apresentação prévia antes de aplicar, mesmo em DEV):**
```
allow create: if request.auth != null && (
  request.auth.uid == uid ||
  get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.perfil in ['admin', 'master_admin']
);
```
Mesmo padrão já usado em `update`/`delete` logo abaixo. Não reabre o BL-006: aquele exploit era sobre um usuário comum **alterar o próprio doc já existente** (`update`), não sobre um admin **criar o doc de outro**. As duas operações são regidas por regras diferentes.

**Achado à parte, fora do escopo, não corrigido:** o iframe de "fechamento automático do Caixa" do Dashboard carrega o contexto de **produção** mesmo dentro de `/dev`; como `/` e `/dev` compartilham `localStorage`, o `kernel.js` desse iframe (sem sessão no Auth de produção) roda `logout()` e apaga a flag `cc_kernel_v1` compartilhada — mesmo com a sessão DEV do admin válida. Contornado só no script de teste (reafirma a flag antes de navegar); a causa real pertence ao Dashboard/Caixa/kernel.js, fora do escopo desta entrega.

**Veredito (momento da rodada):** layout e a maior parte dos fluxos administrativos aprovados com evidência real de navegador. Módulo ainda não homologável com o defeito crítico de `allow create` em aberto.

### 6.11 Correção do `allow create` — homologada (2026-07-04)

Autorização explícita do dono para aplicar a correção proposta em §6.10, **só no projeto `cellcity-crm-dev`**. Diff aplicado exatamente como proposto (`CRM/firestore.rules`, bloco `usuarios/{uid}`), commit `e5dab0a`:
```
allow create: if request.auth != null && (
  request.auth.uid == uid ||
  get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.perfil in ['admin', 'master_admin']
);
```
Deploy via `firebase deploy --only firestore:rules --project dev` (com `GOOGLE_APPLICATION_CREDENTIALS=./sa-key-dev.json`). Verificado via `firebaserules.googleapis.com` ([[feedback-firestore-rules-verify-api]]): release ativo de `cellcity-crm-dev` idêntico ao arquivo-fonte; release ativo de `cellcity-crm` (produção) **confirmado DIFERENTE** — continua no ruleset `490b0139` de 2026-07-03, sem a correção, como esperado (nada promovido).

**Homologação com Firestore/Auth reais** (Chrome headless, `playwright-core`), contas descartáveis criadas e removidas ao final (Auth + Firestore, sem rastro):
- **Positivo — 14/14 casos**: criar, aparecer na tabela via listener, alterar perfil, desativar, ativar, excluir (Firestore + Auth) — ciclo completo executado **como admin comum** (`cellcityadmin@gmail.com`) **e** repetido **como master_admin** (conta QA descartável criada via Admin SDK só para este teste, com `perfil:'master_admin'`, removida ao final). Zero `console.error` inesperado nos dois casos.
- **Negativo — 2/2 casos**: usuário comum (`cellcitytecnico@gmail.com`, perfil `tecnico`) tenta criar via SDK direto (não pela UI) o documento de um uid diferente do seu → `permission-denied`, confirmado. Controle positivo no mesmo teste: o mesmo usuário consegue escrever um campo não-sensível no **próprio** doc → confirma que a regra não é deny-geral acidental (a lógica é avaliada de fato).
- **Guardas de último administrador (exclusão/desativação, §6.9) — não re-testadas contra o pool real de admins**: o array `usuarios[]` do módulo já tem hoje ≥3 admins reais com `perfil_operacional_id` preenchido (`itamar@gmail.com`, `cellcityadmin@gmail.com`, `teste@gmail.com`) — reduzir esse pool a 1 para forçar o bloqueio ao vivo exigiria desativar/excluir contas reais, risco desproporcional ao ganho (a lógica já está provada isoladamente nos 45/45 casos do harness jsdom, §6.9). Achado tranquilizador, não uma lacuna: a base real de admins tem redundância saudável hoje.

**Achado de segurança relacionado, fora do escopo autorizado, não corrigido:** a regra `allow create` de auto-provisionamento (`request.auth.uid == uid`) não valida o CONTEÚDO do documento — em tese, um usuário com Auth válido mas sem doc `usuarios/{uid}` ainda (ex.: via Anonymous Auth, já listado como risco crítico separado em [[project-auditoria-seguranca-20260703]]) poderia se autoprovisionar diretamente com `perfil:'master_admin'` num único `create`, sem passar pelo `update` restrito do BL-006. Não é uma regressão desta correção (o `create` de auto-provisionamento já existia assim desde o BL-006) e corrigi-lo exigiria alterar a regra de `create` além do que foi autorizado aqui (ex.: validar `request.resource.data.perfil` no próprio `create`). Registrado para decisão futura, não corrigido.

**Veredito final:** `criar usuário` — o bloqueador que impedia a homologação — está corrigido e comprovado no DEV, para admin e master_admin, com testes negativos passando. Módulo **Usuários e Permissões homologado**. `develop` (`e5dab0a`) segue sem merge, sem tag, sem promoção a `main` — produção (`cellcity-crm`/`main`) confirmada intocada em código e em Firestore Rules.

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
| 2026-07-01 | Arquitetura de ambientes DEV/PROD (frontend): workflow `.github/workflows/deploy-pages.yml` publica `main` na raiz e `develop` em `/dev` num único deployment do GitHub Pages; indicador/seletor de ambiente (pill 🟢 MAIN / 🟠 DEVELOP) no `shared/brand-header.js`, detecção pela URL (`detectEnv()`), navegação bidirecional entre ambientes. Ver §9. *(Registro retroativo adicionado em 2026-07-02.)* |
| 2026-07-02 | Documentação: seção §9 (Ambientes e Publicação) adicionada ao TECHDOC; criados `GUIA_OPERACAO_AMBIENTES.md`, `GUIA_ROLLBACK.md` e `GUIA_MANUTENCAO.md`; `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md` e `plans/SEPARACAO_AMBIENTES_DEV_PROD.md` atualizados; inconsistências entre documentos eliminadas. Sem alteração de código. |
| 2026-07-04 | Usuários e Permissões: seed de perfis/contas removido, coluna "Últimos acessos" removida, exclusão de usuário concluída (remove Firestore + Auth secundário, senha da conta agora obrigatória, bloqueia autoexclusão e exclusão do último admin), coluna de ações da tabela sticky, modal/toast acima do dock global, `env(safe-area-inset-bottom)`, helper `comCarregamento` cobre loading/erro em todos os botões de escrita. Publicado só em `/dev` (branch `develop`); produção (`main`) intocada. Homologação em navegador real pendente. Ver §6.9. |
| 2026-07-04 | Usuários e Permissões (sprint final): guarda do último administrador estendida à desativação (mesma função de exclusão, sem duplicar lógica); corrigido z-index do modal/toast vs. `#crm-brand-bar` (`shared/brand-header.js`, 9999/10000) — achado numa segunda auditoria de interface; ajuste de responsividade da coluna de ações abaixo de 480px. Homologação funcional automatizada em jsdom (código real + mocks) — 43/43 casos aprovados. Homologação visual em navegador real (não verificável sem navegador) segue como único item pendente antes da promoção `develop`→`main`. Ver §6.9. |
| 2026-07-04 | Usuários e Permissões — homologação em navegador real (Chrome headless, login/dados reais do DEV): confirmado com evidência real z-index, sticky, safe-area e fluxos de editar/ativar/desativar/cancelar/autoexclusão. Corrigida coluna "Perfil" presa em "—" (bug conhecido desde a Fase 1, reproduzido com dados reais, commit `6bf116b`). **Achado crítico NÃO corrigido**: `allow create` de `usuarios/{uid}` em `CRM/firestore.rules` não tem exceção de admin (só `update`/`delete` têm) — nenhum admin consegue criar usuário novo, provavelmente também quebrado em produção desde o rewrite do BL-006 (2026-07-03). Diff proposto apresentado, aguardando autorização explícita antes de aplicar (Firestore Rules = exceção de segurança). Módulo NÃO homologado enquanto isso não for resolvido. Ver §6.10. |
| 2026-07-04 | Usuários e Permissões — `allow create` de `usuarios/{uid}` corrigido (commit `e5dab0a`), autorizado e deployado **somente em `cellcity-crm-dev`** (produção confirmada intocada via API). Homologado com Firestore/Auth reais: 14/14 positivo (criar/editar/alterar perfil/ativar/desativar/excluir como admin E como master_admin) + 2/2 negativo (usuário comum não cria doc de outro; controle positivo no próprio doc). Contas de teste descartáveis, todas removidas. **Módulo Usuários e Permissões homologado.** `develop` (`e5dab0a`) sem merge/tag/promoção — aguardando autorização para `develop`→`main`. Ver §6.11. |

---

## 9. Ambientes e Publicação (DEV/PROD)

> Implementado em 2026-07-01 (frontend). Guia operacional completo: [`GUIA_OPERACAO_AMBIENTES.md`](../GUIA_OPERACAO_AMBIENTES.md).

### 9.1 Arquitetura atual

| | 🟢 MAIN | 🟠 DEVELOP |
|---|---|---|
| Branch | `main` | `develop` |
| URL | `https://www.cellcityinformatica.com.br/` | `https://www.cellcityinformatica.com.br/dev/` |
| Backend | `cellcity-crm` | **`cellcity-crm` (o mesmo)** |

- **Publicação:** o workflow `.github/workflows/deploy-pages.yml` roda a cada push em `main` **ou** `develop`, faz checkout dos dois branches, monta `_site/` (main na raiz + develop em `/dev` + `.nojekyll`) e publica tudo num único deployment do GitHub Pages. Um push em qualquer branch republica os dois ambientes.
- **Indicador/seletor de ambiente:** `shared/brand-header.js` — `detectEnv()` classifica pelo pathname (prefixo `/dev` = DEVELOP; caso contrário MAIN, inclusive `localhost`/`file://`). O pill `🟢 ONLINE | MAIN` / `🟠 ONLINE | DEVELOP` abre um menu para alternar de ambiente (com confirmação), preservando o caminho da página atual (`otherEnvUrl()`). Nenhuma constante é hardcoded por branch — o mesmo código roda nos dois ambientes.
- **Mesma origem:** `/` e `/dev` compartilham origem — Service Worker, `localStorage` e `sessionStorage` são comuns aos dois ambientes.

### 9.2 Limitação central — backend compartilhado

Auth, Firestore e Storage são **únicos** (projeto `cellcity-crm`): dados criados em teste no DEVELOP aparecem na produção, e testes no DEVELOP consomem a cota Spark da produção (50k leituras/dia — ver `plans/RELATORIO_COTA_FIRESTORE_20260702.md`). A separação de backend (projeto `cellcity-crm-dev` + seletor de config em runtime `shared/env-config.js` com regra fail-safe: em dúvida, DEV) está planejada em [`plans/SEPARACAO_AMBIENTES_DEV_PROD.md`](../plans/SEPARACAO_AMBIENTES_DEV_PROD.md) — **aguardando autorização formal; freeze de alterações de infraestrutura em vigor desde 2026-07-02**. A auditoria pré-separação de 2026-07-02 registrou adendos obrigatórios ao escopo do plano (endpoints REST hardcoded, Anonymous/Google Auth, config em contexto de Service Worker, `garantia.html` com credenciais divergentes, `_BACKUPS` publicados, rules duplicadas raiz × CRM) — ver seção 7 do próprio plano.

### 9.3 Operação, rollback e manutenção

- Operação do dia a dia (publicar, validar, SW/cache, cota, comandos de verificação): [`GUIA_OPERACAO_AMBIENTES.md`](../GUIA_OPERACAO_AMBIENTES.md)
- Procedimentos de reversão (código, módulo, rules, dados): [`GUIA_ROLLBACK.md`](../GUIA_ROLLBACK.md)
- Convenções, dívida técnica conhecida e monitoramento: [`GUIA_MANUTENCAO.md`](../GUIA_MANUTENCAO.md)
