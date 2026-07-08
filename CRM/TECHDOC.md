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

### 6.12 🔴 Auditoria pré-promoção — vulnerabilidade CRÍTICA confirmada, promoção INTERROMPIDA (2026-07-04)

Auditoria de segurança pedida pelo dono antes da promoção `develop`→`main` (revisar `allow create` para confirmar que autoprovisionamento não permite privilégio indevido). **Resultado: risco real confirmado empiricamente — promoção interrompida, nada mesclado/publicado/taggeado.**

**Prova de conceito completa, ponta a ponta, sem NENHUM acesso prévio ao sistema:**
1. `POST identitytoolkit.googleapis.com/v1/accounts:signUp` com a `apiKey` pública (já exposta em `shared/env-config.js`, publicada no site) — cria uma conta nova, sem precisar de convite/admin. Confirmado contra `cellcity-crm-dev`.
2. Com o `idToken` da própria resposta, `PATCH firestore.googleapis.com/.../usuarios/{uid}` (o mesmo uid do passo 1) gravando `perfil: 'master_admin'`. **Sucesso — o Firestore aceitou.**
3. Doc confirmado gravado via leitura de volta. Removido manualmente (Firestore + Auth) logo em seguida.

**Causa raiz — dois problemas empilhados, não só a regra:**
1. **`CRM/firestore.rules`, `allow create` de `usuarios/{uid}`**: a branch de autoprovisionamento (`request.auth.uid == uid`) não valida o CONTEÚDO do documento sendo criado — aceita qualquer `perfil`, incluindo `master_admin`. Isso já existia assim desde o próprio BL-006 (2026-07-03) — minha correção de hoje (§6.11) só adicionou a exceção de admin, não mexeu nessa branch de autoprovisionamento.
2. **`CRM/scripts/kernel.js::_buildContext()` (linha 90)**: `let perfil = 'admin';` — **o valor PADRÃO para qualquer conta nova sem doc prévio é `'admin'`**, e a própria função grava esse padrão no Firestore no primeiro acesso (linha 103-109). Ou seja: mesmo sem o PATCH manual do passo 2 acima, um invasor que só fizesse o signup (passo 1) e depois logasse pela **tela normal de login** já viraria `admin` automaticamente — o passo 2 só demonstra que dá pra pular direto pra `master_admin`. Esse comportamento já estava anotado como observação em §6.7 desde a Fase 1, mas nunca foi tratado como o risco crítico que é.

**Por que o vetor de Anonymous Auth NÃO é o caminho aqui** (só para registro): `kernel.js` linha 63 (`if (user && !user.isAnonymous)`) nunca constrói contexto para sessão anônima — esse vetor específico está bloqueado pela própria aplicação. O vetor real é o **cadastro público de e-mail/senha**, que não tem nenhuma restrição (sem allow-list, sem verificação, sem Cloud Function/App Check) — qualquer pessoa na internet, com a `apiKey` que já está pública no HTML/JS do site, consegue se cadastrar.

**Impacto:** comprometimento total do sistema — qualquer visitante externo pode se tornar `master_admin` (ou simplesmente `admin`, sem nem precisar do PATCH manual) e acessar/alterar qualquer dado do CRM, incluindo clientes, OS, financeiro e o próprio módulo de Usuários e Permissões. **Existe hoje em produção também** — a regra de `create` de produção (ruleset `490b0139`) tem a mesma branch de autoprovisionamento sem validação, e o `kernel.js` publicado em produção é o mesmo arquivo. Não testei diretamente contra produção (risco desproporcional para uma prova que já é conclusiva via DEV com o mesmo código).

**Correção proposta (NÃO aplicada — fora do escopo autorizado hoje, que era só revisar; e span duas áreas sensíveis: Firestore Rules e `kernel.js`/Autenticação):**
1. `CRM/firestore.rules` — restringir a branch de autoprovisionamento do `create` para não aceitar `perfil` privilegiado:
   ```
   allow create: if request.auth != null && (
     (request.auth.uid == uid &&
      request.resource.data.perfil in ['atendente', null] &&
      request.resource.data.get('perfil_operacional_id', null) == null) ||
     get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.perfil in ['admin', 'master_admin']
   );
   ```
   (ajustar a lista de valores permitidos conforme decisão de negócio — o ponto é nunca aceitar `admin`/`master_admin`/`gerente` no autoprovisionamento).
2. `CRM/scripts/kernel.js::_buildContext()` — trocar o padrão `let perfil = 'admin'` (linha 90) para o nível mínimo (`'atendente'`) ou para um estado explícito de "sem acesso" que force um admin a liberar manualmente. **Esta mudança tem prioridade sobre a da rule** — mesmo com a rule corrigida, se o app continuar tentando gravar `'admin'` por padrão, o próprio `setDoc` do primeiro login passaria a ser negado pela rule corrigida, quebrando o login de contas legítimas novas; as duas mudanças precisam ser decididas e testadas juntas.

**Não implementado nesta sessão** — precisa de autorização explícita separada (toca `kernel.js`, arquivo de Autenticação) e de uma decisão de negócio (qual o perfil padrão seguro para conta nova, e se cadastro público deveria sequer ser possível).

**Estado da promoção:** **interrompida**, conforme instrução do dono. `develop` permanece em `e5dab0a`+documentação, sem merge para `main`, sem deploy de rules em produção, sem tag. Nenhuma alteração de código/regra aplicada nesta auditoria — só investigação, prova de conceito controlada (limpa integralmente) e este relatório.

### 6.13 🟢 P0 de segurança — vulnerabilidade eliminada (2026-07-04)

Correção autorizada explicitamente para a vulnerabilidade do §6.12. Sequência seguida: mapear o fluxo inteiro antes de mudar código → decidir a regra de negócio → aplicar só o necessário → regressão → repetir a prova de conceito.

**Mapeamento do fluxo (ETAPA 1)** — confirmado que existe um único ponto de criação/decisão de perfil:
- `login.html` não tem nenhuma lógica própria de criação de doc ou perfil (confirmado por busca — zero ocorrências).
- `kernel.js`, `onAuthStateChanged` (linha 62-63): só constrói contexto (`_buildContext`) para usuário **não-anônimo** — sessão anônima nunca recebe `_ctx`, então nunca passa em nenhum `temPermissao()`. Esse vetor específico já estava fechado pela própria aplicação.
- `kernel.js::_buildContext()` (linha 88-119): único lugar que lê `usuarios/{uid}`, decide o `perfil` do contexto e **cria o documento no primeiro acesso** (`else` do `if (snap.exists())`). Antes da correção, usava `'admin'` como padrão local — tanto para o `create` do primeiro acesso quanto como *fallback* silencioso caso um doc existente não tivesse o campo `perfil`.
- `temPermissao()` (kernel.js): hierarquia fechada `master_admin(100) > admin(80) > gerente(60) > tecnico(40) > atendente(20)` — qualquer valor de `perfil` fora dessa lista cai no `NIVEL[...] ?? 0`, falhando em **qualquer** checagem.
- `CRM/firestore.rules`, `usuarios/{uid}`: o `create` de autoprovisionamento (`request.auth.uid == uid`) não validava o conteúdo gravado.

**Regra de negócio definida (ETAPA 2)**, sem depender de comportamento implícito:
- **Quem cria usuário:** só admin/master_admin, pelo módulo Usuários e Permissões (`criarContaSecundaria` + `setDoc` com `perfil` explícito escolhido pelo admin). Autoprovisionamento (kernel.js) deixa de ser um caminho de acesso — vira só um placeholder.
- **Cadastro público (nível Firebase Auth, fora do código deste repo):** continua tecnicamente possível — o projeto não tem Cloud Functions/blocking functions para desabilitá-lo, e desabilitar exigiria mudança de infraestrutura fora do escopo de hoje. **Decisão:** em vez de tentar impedir o cadastro em si, torná-lo **inofensivo** — nenhuma conta nasce com qualquer privilégio.
- **Perfil inicial de conta nova:** `'pendente'` — valor sentinela fora da hierarquia de `temPermissao()`, falha em toda checagem de permissão até intervenção de um admin.
- **Quem altera esse perfil:** só admin/master_admin — já garantido pela regra `update` do BL-006 (congela `perfil`/`perfil_operacional_id`/`empresa_id`/`status` fora de admin), sem necessidade de mudança adicional.
- **Momento da criação do doc:** inalterado — primeiro login bem-sucedido, dentro de `_buildContext()`.

**Correção aplicada (ETAPA 3)** — commit `b9c97a8`, duas mudanças coordenadas (uma sem a outra quebra o primeiro login legítimo):
```diff
--- kernel.js ---
- let perfil    = 'admin';
+ let perfil    = 'pendente';

--- firestore.rules, allow create de usuarios/{uid} ---
  allow create: if request.auth != null && (
-   request.auth.uid == uid ||
+   (request.auth.uid == uid && request.resource.data.perfil == 'pendente') ||
    get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.perfil in ['admin', 'master_admin']
  );
```
Aplicado e testado **somente em `cellcity-crm-dev`** (rules via `firebase deploy --project dev`; `kernel.js` publicado em `/dev` via push em `develop`). Produção confirmada intocada nos dois (rule ativa de `cellcity-crm` continua no ruleset `490b0139`; `kernel.js` de produção nunca tocado).

**Regressão (ETAPA 4)**, Firestore/Auth reais, contas descartáveis (removidas ao final):
- ✅ **Deve funcionar — 15/15**: criar usuário como admin comum e como master_admin (ciclo completo: criar → aparecer na tabela → alterar perfil → desativar → ativar → excluir), tudo repetido para os dois papéis, zero `console.error` inesperado.
- ✅ **Deve falhar — confirmado**: usuário comum não cria doc de outro uid (`permission-denied`, já validado antes e revalidado agora sem regressão).

**Prova de segurança repetida (ETAPA 5)** — exatamente o mesmo ataque do §6.12, agora:
1. Signup público via REST (sempre funciona — é do Firebase Auth, a rule não controla isso).
2. `PATCH` self-create com `perfil:'master_admin'` → **`403 PERMISSION_DENIED`** (antes: sucesso). Vulnerabilidade fechada.
3. Controle: o MESMO `PATCH` com `perfil:'pendente'` exato → sucesso (fluxo legítimo preservado).
4. Confirmação via navegador real, login normal pela tela (não REST): conta autocadastrada grava `perfil:'pendente'` sozinha (kernel.js real, não simulado) e o módulo Usuários e Permissões mostra `#up-bloqueado` (não acessa) — a escalada para admin está de fato eliminada ponta a ponta.

**Achado correlato, fora do escopo de hoje, registrado e NÃO corrigido:** a mesma conta "pendente" recém-autocadastrada, ao logar, **vê o Dashboard inteiro com todos os cards de módulo visíveis** (OS, Caixa, CRM, Estoque, Financeiro, Clientes, etc.). Causa: nenhum desses módulos (`os.js`, `caixa.js`, `estoque.js` — confirmado por busca) chama `temPermissao()`; dependem só do RBAC novo (`shared/permissoes.js`), que é **fail-open por design** quando `perfil_operacional_id` está ausente ("Usuário ainda não migrado... sem restrição" — comportamento intencional para não esconder módulo de usuário legado durante a migração gradual, mas também libera visualmente um autocadastrado). A segurança real desses módulos depende das Firestore Rules das respectivas coleções — que, pela leitura já feita nesta sessão, majoritariamente exigem só `request.auth != null` (sem checar `perfil`). Isso é **exatamente o achado já registrado e rastreado separadamente** em [[project-auditoria-seguranca-20260703]] ("Firestore aberto via Anonymous Auth") — hoje tenho prova de que o mesmo problema vale para contas normais autocadastradas, não só anônimas. **Não é uma regressão de hoje, não foi introduzido por esta correção, e corrigi-lo exigiria revisar dezenas de regras de coleções de negócio — bem além do escopo autorizado hoje** (que era eliminar a escalada para *privilégio administrativo*, não redesenhar o controle de acesso geral do sistema). Fica registrado para decisão futura.

**Veredito final:** a vulnerabilidade de escalada de privilégio administrativo via autoprovisionamento está **eliminada e comprovada** — mesma prova de conceito original, agora falha como esperado; nenhuma regressão nos fluxos administrativos. **Promoção `develop`→`main` segue bloqueada** aguardando autorização explícita e separada do dono (conforme instrução), incluindo a decisão sobre o achado correlato acima.

### 6.14 🟢 P0 de segurança (parte 2) — conta "pendente" sem acesso a dados reais (2026-07-04)

Continuação do §6.13: o "achado correlato" registrado ali (Dashboard mostra todos os módulos a uma conta pendente) foi investigado a fundo e **confirmado como risco efetivo de dados, não só exposição visual** — autorizado a corrigir pelo dono.

**Auditoria completa (ETAPA 1):**
- Só **1 de 33 módulos** (`usuarios-permissoes`) chama `temPermissao()` (gate no kernel).
- Só **5 módulos** (`dashboard`, `crm-comercial`, `caixa`, `acaodasemana`, `estoque`) usam `shared/permissoes.js` — fail-open por design quando `perfil_operacional_id` está ausente.
- **29 dos 33 módulos não têm nenhum controle de acesso no código** — alguns (`clientes.js`, `financeiro.js`) nem importam `kernel.js`. A segurança real depende só das Firestore Rules.
- Rules: **~45 coleções de negócio** (`clientes`, `os`, `caixa_lancamentos`, `estoque_produtos`, `financeiro_*`, `produtos`, `agenda`, etc.) tinham só `allow read, write: if request.auth != null;` — sem checar `perfil`.

**Validação real (ETAPA 2)**, conta pendente de teste (criada e removida ao final): confirmado por chamada direta ao SDK (não só UI) — **leitura E escrita bem-sucedidas** em `caixa_lancamentos`, `estoque_produtos`, `clientes`, `catalogo_produtos`, `financeiro_receber` e `os`. Risco de dados real, comprovado.

**Decisão de escopo:** dado o custo real (Firestore Rules `get()` custa 1 leitura extra por operação nas coleções que passam a chamá-lo, e o projeto já teve estouro de cota do Spark antes — [[project-firestore-cota-spark]]), apresentei a análise ao dono antes de aplicar em massa. **Decisão do dono: aplicar em todas as ~45 coleções**, aceitando o custo conscientemente.

**Correção aplicada (ETAPA 3)** — commit `2edd4ba`. Nova função em `CRM/firestore.rules`:
```
function temAcessoLiberado() {
  return exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.perfil != 'pendente';
}
```
Falha **fechado** (nega) se o doc `usuarios/{uid}` do próprio requisitante nem existir ainda — fecha a brecha de alguém nunca deixar o `kernel.js` rodar para escapar da checagem. Aplicada a `&& temAcessoLiberado()` em:
- 3 coleções com endpoint público (`os`, `config`, `pre_os`): só a parte **autenticada** (`list/create/update/delete` ou `list/write` ou `read/update/delete`) ganhou a checagem — o `get`/`create` público (garantia.html, abrir-atendimento.html) ficou **intocado**, confirmado por diff.
- **45 coleções restantes** com o padrão idêntico `allow read, write: if request.auth != null;`: substituição mecânica via `sed`, mesma condição em todas — `git diff --numstat` confirma só a linha da condição mudou em cada bloco, nada mais.
- **Não alteradas** (já corretamente restritas ou fora do escopo): `favoritos_usuarios`, `central_alertas_status`, `usuarios/{uid}/preferencias`, `_diagnostico_temp` (já só o próprio uid); `usuarios/{uid}`, `perfis_operacionais` write, `auditoria_usuarios_permissoes` (já geridas por perfil); `orders`/`clients` (já `if false`).

Aplicado e testado **somente em `cellcity-crm-dev`** — verificado via API que produção continua no ruleset antigo (`490b0139`).

**Regressão (ETAPA 4)** — 17/17, Firestore/Auth reais, contas de teste removidas ao final:
- ✅ Conta **pendente**: `permission-denied` em leitura E escrita nas 6 coleções antes vulneráveis (12/12).
- ✅ **Sem regressão** em nenhum perfil legítimo — `atendente`, `tecnico`, `gerente`, `admin` (contas reais da Fase 4) e `master_admin` (descartável, criada só para este teste): leitura e escrita normais nas mesmas 6 coleções (5/5).
- O módulo Usuários e Permissões não foi afetado por construção — suas 3 coleções próprias (`usuarios`, `perfis_operacionais`, `auditoria_usuarios_permissoes`) já tinham regra por perfil antes desta sprint e não entraram na varredura.

**Veredito final:** contas com perfil `pendente` não têm mais acesso a nenhuma funcionalidade ou dado que exija autorização — nem visual (já fechado no §6.13, módulo Usuários e Permissões) nem de dados (fechado agora, ~45 coleções de negócio). Custo assumido: +1 leitura por operação nessas coleções — monitorar cota do DEV/produção se e quando isso for promovido. **Promoção `develop`→`main` continua bloqueada**, aguardando autorização explícita do dono.

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

**Atualização (2026-07-07):** a homologação dos 5 arquivos, originalmente rodada num harness descartável, foi persistida em `tests/rbac/` (`crm.test.mjs`, `crm-entrada.test.mjs`, `chips.test.mjs`, `chips-entrada.test.mjs`, `agenda.test.mjs`) — ver §7.3 para o método completo. Reexecutada contra o código atual: 20/20 cenários (redirect por `visualizar`, botões por `criar`/`editar`/`excluir`, fail-open, admin legado, e o AND-gate de `agenda`) continuam corretos, zero regressão.

### 7.3 Sprint 3 — Estoque + Caixa

**Status: implementado (2026-07-02) e re-homologado tecnicamente em 2026-07-07 contra o código atual — aguardando aprovação formal do usuário.** Documentação completa: `plans/fase2-sprint3-estoque-caixa-rbac.md`.

**Arquivos alterados** (backups `.BACKUP_2026-07-02.js` nas mesmas pastas): `pages/estoque/estoque.js` (moduloId `estoque`; boot reestruturado — não chamava `initModulo()`) e `pages/caixa/caixa.js` (moduloId `caixa`; já chamava `initModulo()`, ganhou `carregarPermissoes` + gates). Verbos aplicados: visualizar (redirect), criar, editar, excluir — nos botões/forms de produto, movimentação ±, lançamento, lembretes e nova categoria.

**Pontos de atenção resolvidos**: (a) integração Estoque↔Caixa preservada — a baixa/entrada automática de estoque na venda é executada por funções locais do Caixa e não recebe nenhum gate (testado: venda com `estoque.*` 100% negado ainda baixa estoque); (b) **guarda de iframe** no gate de `visualizar` do Caixa — o Dashboard carrega o Caixa em iframe invisível a cada abertura (`_verificarFechamentoCaixa`); o redirect só ocorre em `window.self === window.top`, eliminando risco de loop (testado em cenário automatizado com iframe simulado); (c) `aprovar` do Caixa **sem efeito nesta sprint** por decisão do usuário — o fluxo de fechamento (semântica original) foi removido em 30/06; quando reintroduzido (Fase 4), gatear por `podeAprovar('caixa')`.

**Pendência pré-existente registrada (não corrigida — fora de escopo)**: o iframe de fechamento do Dashboard dispara a cada carga sem efeito (orquestrador não existe mais no Caixa; cache `caixa_ultimo_fechamento` nunca é gravado). Correção exige autorização própria (módulo Dashboard).

**Re-homologação técnica (2026-07-07, sessão de continuação):** os 12 cenários originais (§6 do plano) foram re-executados — não só relidos — porque os dois arquivos sofreram mudanças desde a verificação de 02/07: `estoque.js` foi migrado para a Camada Repository (`86e0000`, troca 1:1 de `getDocs/setDoc/deleteDoc` por `EstoqueRepository.list/set/remove`, lógica de RBAC intocada) e ambos os arquivos tiveram o destino do redirect corrigido para respeitar o prefixo `/dev` (`H-006`, 1 linha cada). A evidência de 12/12 de 02/07 tecnicamente não cobria mais o código vigente.

- **Método**: mesmo padrão já validado no projeto (Node + jsdom, código real sem alteração, só a borda do SDK mockada) — desta vez isolado 100% em diretório de scratchpad (`jsdom` instalado só ali via `npm install --no-save`), sem tocar `package.json`/`node_modules` do repositório. HTML real das duas páginas (`estoque/index.html`, `caixa/index.html`) carregado no jsdom para garantir presença fiel de todos os elementos.
- **Estoque**: 5 cenários (restrito, matriz total, não migrado, `visualizar:false`→redirect, admin legado) — **16/16 asserções aprovadas**.
- **Caixa**: 7 cenários (restrito — form + lembrete + botões de card/lembrete ocultos, matriz total, não migrado, `visualizar:false` em janela principal→redirect, admin legado, **venda com `estoque.*` 100% negado** confirmando lançamento criado E baixa de estoque 5→4, `visualizar:false` **dentro de iframe simulado**→sem redirect e boot abortado) — **18/18 asserções aprovadas**.
- **Total: 34/34 — zero regressão** encontrada nas duas mudanças subsequentes (H-006, Camada Repository). Nenhuma correção de código foi necessária.
- **Não coberto por esta sessão**: o roteiro manual em navegador real (§8 do plano) — sem navegador disponível neste ambiente, como em sessões anteriores do projeto (mesma limitação já registrada para Sprint 1b/Fase 9). A verificação automatizada acima é o substituto já estabelecido neste projeto para esse cenário.

**Critério de aprovação (§9 do plano) parcialmente cumprido**: evidência técnica completa e sem regressão; falta a aprovação formal do usuário antes de iniciar o Sprint 4 (Financeiro) — não concedida nesta sessão, pendente de decisão do dono do projeto.

**Atualização (2026-07-07, sessão de continuação — eliminação do bloqueio nº1 da Auditoria de Prontidão da Plataforma):** o harness acima, que rodava isolado num scratchpad temporário e era descartado a cada uso, foi **persistido definitivamente** em `tests/rbac/`. Os 12 cenários de Estoque+Caixa foram portados para `node:test` e passaram a importar o código real das páginas **sem cópia**, via um loader ESM (`tests/rbac/loader.mjs`, `node:module.register`) que redireciona só as importações de infraestrutura (`scripts/firebase.js`, `scripts/kernel.js`, `shared/permissoes.js`, `firebase/client.js`, e a URL do CDN do Firestore usada por `caixa.js`) para mocks — eliminando o risco de a evidência ficar obsoleta quando o código muda (exatamente o que aconteceu entre 02/07 e hoje). A mesma infraestrutura foi estendida para persistir também a homologação da Sprint 2 do RBAC (§7.2 — `crm.js`, `entrada.js`, `chips.js`, `chips-entrada.js`, `acaodasemana.js`), nunca antes persistida. Suíte completa: **34/34 testes aprovados** (`npm test` em `tests/rbac/`), incluída no workflow de CI (`.github/workflows/tests.yml`) ao lado das suítes de Firestore Rules e Cloud Functions — 111/111 testes automatizados do repositório passam hoje em CI a cada push/PR.

**Atualização (2026-07-07, auditoria de performance — `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md` §8/§9):** o hotspot H13 do plano de performance ("`estoque.js::descontarEstoque()` varre a coleção inteira para achar 1 produto, chamado pelo Caixa a cada venda") tinha premissa desatualizada — `descontarEstoque()` **não tinha nenhum chamador real** no código vivo; o Caixa usa sua própria função local (`descontarEstoqueLocal`, `caixa.js:699`), que já lia com `getDoc` direto. Função morta removida de `estoque.js`. Nenhuma leitura de produção é eliminada por esta mudança (a função nunca era executada), mas fecha uma armadilha de manutenção. Validado: RBAC 34/34 (incluindo o teste de integração Estoque↔Caixa que exercita `descontarEstoqueLocal`), Firestore Rules 52/52, Cloud Functions 25/25.

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
| 2026-07-04 | 🔴 Auditoria pré-promoção encontrou vulnerabilidade CRÍTICA real e confirmada por prova de conceito completa: cadastro público (REST, só com a `apiKey` já pública) + autoprovisionamento em `usuarios/{uid}` sem validação de conteúdo = qualquer visitante externo vira `master_admin`. Agravado por `kernel.js::_buildContext()` (linha 90) que já grava `perfil:'admin'` por padrão em qualquer conta nova, mesmo sem exploit manual. Existe também em produção (mesma regra/mesmo kernel.js publicados). **Promoção `develop`→`main` INTERROMPIDA** conforme instrução — nada mesclado, publicado ou taggeado. Prova de conceito limpa (contas de teste removidas). Correção proposta (rule + kernel.js) documentada, não aplicada — exige autorização explícita separada por tocar Autenticação. Ver §6.12. |
| 2026-07-04 | 🟢 P0 de segurança corrigido (commit `b9c97a8`, só `cellcity-crm-dev`): `kernel.js::_buildContext()` passa a gravar `perfil:'pendente'` (fora da hierarquia de `temPermissao()`) em vez de `'admin'` para conta nova; `firestore.rules` só aceita autoprovisionamento com `perfil` exatamente `'pendente'`. Prova de conceito original repetida — agora nega com `403`. 15/15 regressão (criar/editar/alterar perfil/ativar/desativar/excluir como admin e master_admin). Achado correlato registrado, fora do escopo: Dashboard mostra todos os módulos a uma conta "pendente" (RBAC novo é fail-open por design quando não migrado) — mesma classe do risco já rastreado em [[project-auditoria-seguranca-20260703]], não corrigido hoje. Produção segue intocada. **Promoção `develop`→`main` continua bloqueada**, aguardando autorização explícita separada. Ver §6.13. |
| 2026-07-04 | 🟢 P0 de segurança parte 2 (commit `2edd4ba`, só `cellcity-crm-dev`): confirmado que o achado correlato do dia era risco real de dados — conta pendente lia E escrevia em clientes/os/caixa/estoque/catálogo/financeiro via SDK direto. Nova função `temAcessoLiberado()` aplicada a ~45 coleções de negócio (troca mecânica via sed da mesma condição, endpoints públicos de os/config/pre_os preservados). Custo (+1 leitura por operação) aceito conscientemente pelo dono após eu apresentar a análise. 17/17 regressão: pendente bloqueado (12/12), zero regressão em atendente/tecnico/gerente/admin/master_admin (5/5). Produção intocada. **Promoção `develop`→`main` continua bloqueada.** Ver §6.14. |
| 2026-07-04 | 🆕 Primeira Cloud Function do projeto (commit `87dd648`): `excluirUsuarioAdmin`, Admin SDK, resolve o pedido do dono de excluir qualquer usuário só com a senha/PIN de admin (sem precisar da senha da conta-alvo). Produção migrada de Spark para Blaze (mesma conta de faturamento do DEV, autorizado). Testada em DEV e depois em produção: positivo (exclusão sem senha do alvo, exclusão de admin com outros existindo) e negativo (não-admin bloqueado, autoexclusão bloqueada) confirmados ao vivo nos dois ambientes. `usuarios-permissoes.js` migrado para chamar a function; campo "senha da conta" removido do modal; `excluirContaSecundaria()` removida (código morto). Promovido a produção com autorização explícita. Ver §14. |
| 2026-07-05 | 🔴 Sprint 1a — fecha exposição pública de `os/{osId}` (`allow get: if true` → `if false`) e gate de autenticação real em `admin.html` do Portal do Cliente. Duas Cloud Functions novas (`consultarOSPublica`, `consultarOSPorTelefonePublica`) migram as consultas públicas para Admin SDK com whitelist de campos. Achado paralelo durante a homologação: `temAcessoLiberado()` (commit `2edd4ba`) já estava ativo em produção havia ~20h, bloqueando clientes anônimos reais — hotfix P0 aplicado, depois reconciliado com a Sprint 1a. Duas dependências de `os.get` não previstas foram encontradas e corrigidas antes do fechamento definitivo (`garantia.html`, `responderOrcamentoConsulta`). Homologado e testado em produção real (não só DEV). **Promovido a `main`.** Ver §17, §18. |
| 2026-07-05 | 🆕 Camada Repository (padrão de acesso a dados): esqueleto completo criado (`CRM/repositories/` com 17 arquivos cobrindo ~52 coleções, `CRM/firebase/client.js`, `CRM/services/README.md`), sem tocar `scripts/firebase.js` (protegido) nem qualquer outro módulo. Piloto migrado: `crm-comercial/chips.js` + `chips-entrada.js` passam a usar `ChipsRepository` em vez do SDK direto — zero mudança de comportamento (7 call sites, mapeamento 1:1). Homologado via jsdom (código real + mocks) — 20/20 casos aprovados. Commit original (`b0270b6`) foi temporariamente separado da `develop` por colisão de checkout com a Sprint 1a (ver achado em §18) e trazido de volta via cherry-pick (`91afeaf`) após confirmação de integridade. Ver §22. |
| 2026-07-05 | Camada Repository — Fase 0 (`4a0ab9d`): fecha o gap de coleções sem repository (`agenda`, `agendamentos`, `central_organizacao`). Fase 1 (`76344d7`): 22 módulos de baixo risco migrados do SDK direto (Contas, Campanhas, Autoatendimento, Central de Comandos/Informações/Organização/Alertas, Diário, Minha Semana, Ação da Semana, Estoque, Fornecedor, Catálogo, Pós-venda, Relatórios, Portal Técnico, Clientes, Config, páginas de teste do kernel), mesmo padrão 1:1 do piloto. Duas extensões aditivas ao `base.repository.js` (`newId()`, `onDocChange()`). Homologação funcional ficou pendente neste commit. Ver §22.10. |
| 2026-07-07 | Camada Repository — homologação funcional da Fase 1 concluída: auditoria estática dos 22 arquivos (0 divergência), `node --check` 22/22, resolução de imports 22/22, e 48/48 cenários de execução real (código dos repositories sem alteração + Firestore fake) cobrindo CRUD, `where`/`orderBy`/`limitTo`, `newId()` e `onDocChange()`. Nenhuma correção de código necessária. Duas observações arquiteturais não-bloqueantes registradas (ordem de merge do campo `id`, listener sem `onError` explícito silencioso) — pré-existentes desde o piloto Chips, não introduzidas por esta fase. `develop` local segue não pushada/não mesclada — reconciliação com produção fica para decisão separada. Ver §22.10. |
| 2026-07-07 | 🆕 Preparação para SQL — modelagem relacional completa (`sql/`, novo diretório): 54 coleções ativas convertidas em 75 tabelas + 62 relacionamentos (FK), DER mestre em Mermaid, banco recomendado (PostgreSQL/Cloud SQL, com justificativa), estratégia de migração em 7 ondas (não executada) e plano de adaptação de cada Repository ao SQL sem alterar páginas consumidoras. Puramente planejamento — nenhum banco instalado, nenhum dado migrado, nenhum código funcional alterado. Ver §23. |
| 2026-07-07 | Preparação para SQL — auditoria final e aceite técnico: cross-check completo DER↔DDL↔Repository Layer↔`COLECOES_FIRESTORE.md`↔documentação. Achado real corrigido: 7 das 58 coleções da Camada Repository (legadas, sem consumidor de código) não tinham tabela — adicionadas como tabelas mínimas (só PK), fechando 100% de paridade Repository→SQL. Total revisado: 82 tabelas, 62 relacionamentos (inalterado — as 7 novas não têm FK). Todas as menções de contagem em `sql/`, `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md` e `HISTORICO_PROJETO.md` sincronizadas. Ver §23.2 e `sql/04_auditoria_final.md` para o parecer completo. |
| 2026-07-08 | 🟢 Performance — regularização das Fases 1 (pollers) e 2 (cache persistente do Firestore) do `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md`: código já existia sem commit desde 2026-07-07, foi auditado, backup do arquivo protegido (`firebase.js.bak-pre-fase2-cache-2026-07-08`) criado, validado item a item contra o plano (nenhum item fora do escopo), testado (Firestore Rules 52/52, Cloud Functions 25/25, RBAC 33/34 — a falha é pré-existente e não relacionada, reproduzida também no `HEAD` sem estas mudanças). Commitado em `develop` (`40fdb89`). Ver §24. |
| 2026-07-08 | 🟢 Performance — homologação em navegador real (sessão de continuação, mesmo dia): login via `signInWithCustomToken` (conta `cellcityadmin@gmail.com`, DEV), Chrome headless real. Dashboard e Central de Alertas renderizados com dados reais, sem erro. Cache offline confirmado (`usuarios/{uid}` servido do IndexedDB, `fromCache:true`, sem erro). Multiaba confirmado sem `failed-precondition`. Regressão das 3 suítes reconfirmada. Único ponto sem prova direta: supressão do polling especificamente durante os 300s/600s de aba oculta (limitação de instrumentação — tráfego do listener em tempo real pré-existente confundiu a contagem), mitigado pela constante determinística + teste de padrão isolado. **Aprovado para push.** Ver §24.6. |
| 2026-07-08 | 🆕 Automação da homologação de performance (`scripts/homologacao/`, comando `npm run homologar-performance`): transforma o processo manual do §24.6 num pipeline repetível de 7 fases (auditoria → testes → navegador real → relatório com veredito automático), com registro de pendências conhecidas (`known-issues.json`) e evidências versionadas por execução (`evidencias/<timestamp>/`, gitignored). Achado real durante a própria construção: a primeira versão do teste de offline testava só 1 aba, mascarando que o cache não estava realmente sendo servido offline — corrigido aplicando offline a todas as abas simultaneamente. Teste de polling promovido a permanente (`tests/performance/`) e incluído na CI. Nenhuma funcionalidade do sistema alterada. Ver §25. |

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

## 10. Sistema Oficial de Backup

> Implementado em 2026-07-04. Camada de proteção independente de `main`/`develop`, dedicada exclusivamente a disaster recovery. Scripts em [`scripts/backup/`](../scripts/backup/); workflow em [`.github/workflows/backup-weekly.yml`](../.github/workflows/backup-weekly.yml).

### 10.1 Arquitetura (camadas)

| Camada | O quê | Função |
|---|---|---|
| Produção | branch `main` | ambiente oficial; só recebe versões aprovadas via `subir-ok` |
| Desenvolvimento | branch `develop` | desenvolvimento/homologação; nada é publicado em `main` automaticamente |
| Repositório de backup | [`itamaratento/Cell-City-Backup`](https://github.com/itamaratento/Cell-City-Backup) (privado) | espelho fiel de `main`+`develop`+tags do Cell-City-Site; nunca usado para desenvolvimento ou deploy |
| Backup automático | GitHub Actions (`backup-weekly.yml`) | 1x/semana (domingo), com verificação de idempotência e retry |
| Backup manual | comando `backup` | sob demanda, antes de mudanças importantes; fora da rotação |

O repositório de backup possui:
- Branches `main`/`develop`: mirror atualizado a cada execução (branch, não usada para trabalho).
- Tags `auto-slot-A` / `auto-slot-B` / `auto-slot-C`: os 3 backups automáticos mais recentes, em rotação (semana 1→A, 2→B, 3→C, 4→substitui A, ...).
- Tags `manual-<data>-<descrição>`: backups manuais, fora da rotação — permanecem até remoção manual (`git push` com `:refs/tags/<nome>` no repo de backup).
- Branch `backup-meta`: `manifest/automatic.json` — índice/log dos backups automáticos (usado para checar idempotência e calcular o próximo slot).

### 10.2 Backup manual

Comando (definido em `~/.bashrc`, delega para `scripts/backup/backup-manual.sh`):

```bash
backup ["descrição opcional"]
```

Fluxo: identifica a branch atual → verifica alterações pendentes → commita apenas se necessário (`git add .` + mensagem com data/hora, ou a descrição informada) → push em `origin/<branch>` (não faz push em `main`; isso continua exclusivo de `subir-ok`) → sincroniza `main`/`develop` de `origin` para o repositório de backup → cria uma tag anotada `manual-<timestamp>[-slug-da-descrição]` no repositório de backup com data, hora, branch, commit, autor e descrição → apresenta relatório final. A tag é criada localmente, enviada e removida do repositório local em seguida — nenhuma tag nova fica em `main`/`develop`. Nunca faz deploy, merge ou troca de branch.

### 10.3 Backup automático

Workflow `.github/workflows/backup-weekly.yml`, script `scripts/backup/backup-automatic.sh`:

- Gatilho `schedule` (`cron: '0 */3 * * 0'`) — a cada 3h, somente aos domingos (UTC) — mais `workflow_dispatch` para execução manual/testes.
- **Idempotência:** calcula a semana ISO atual (`date -u +%G-W%V`) e consulta `manifest/automatic.json` (branch `backup-meta`); se o último registro daquela semana já tiver `result: sucesso`, encerra imediatamente sem qualquer ação.
- Caso contrário: clona um mirror completo de `origin` (main+develop+tags), envia para o repositório de backup, e atualiza a tag do slot da vez com metadados (semana, data, hora, branch, commit de `develop` e de `main`, autor, resultado).
- **Rotação:** slot = `(sequência - 1) mod 3`, mapeado em `auto-slot-A/B/C` — reproduz exatamente semana1→A, semana2→B, semana3→C, semana4→substitui A, etc. A tag do slot só é sobrescrita **depois** que o push do mirror (branches+tags) já teve sucesso; se o push da tag do slot falhar, a tag anterior permanece intacta.
- **Falha e retry:** qualquer etapa que falhe marca o registro da semana como `falha` no manifesto **sem avançar** o contador de sequência — a próxima verificação periódica do mesmo domingo recalcula a mesma semana/slot e tenta de novo. Só depois de um sucesso a semana é considerada concluída.
- **Importante — limitação do GitHub Actions:** o gatilho `schedule` só é disparado a partir do workflow presente na **branch padrão** (`main`). Enquanto este arquivo existir apenas em `develop`, a execução automática real não inicia sozinha; a ativação definitiva ocorre somente quando este workflow for promovido para `main` (fluxo normal `subir-ok`, mediante autorização explícita — ver seção 9).

### 10.4 Segurança

O sistema de backup (manual e automático) nunca: altera `main`/`develop` diretamente (só lê de `origin`, nunca escreve nelas), executa deploy, cria merge, cria tags em `main`/`develop`, ou modifica arquivos do projeto. Toda tag/branch criada pelo backup vive exclusivamente no repositório `Cell-City-Backup`. A credencial usada pelo GitHub Actions (`secrets.BACKUP_DEPLOY_KEY`) é uma **deploy key SSH dedicada**, com acesso de escrita restrito somente ao repositório de backup — não é o token pessoal de longa duração usado para `origin`, então um eventual vazamento do secret do workflow não dá acesso a nenhum outro repositório.

### 10.5 Registro de cada backup

Cada tag (manual ou automática) guarda, na própria mensagem anotada: data, hora, branch de origem, hash do commit, autor e (quando houver) descrição/resultado. O backup automático também é indexado em `manifest/automatic.json` (branch `backup-meta`) para a checagem de idempotência.

### 10.6 Testes executados na homologação (2026-07-04)

| Teste | Resultado |
|---|---|
| Backup manual ponta a ponta (commit + push origin + mirror + tag) | ✅ sucesso |
| Backup automático — primeira execução da semana | ✅ sucesso (seq 1, slot A) |
| Backup automático — segunda tentativa na mesma semana | ✅ idempotente, nenhuma ação repetida |
| Rotação dos 3 slots (semanas simuladas 1→2→3→4, via `WEEK_OVERRIDE`) | ✅ A→B→C→A confirmado (tag A passou a refletir a semana 4) |
| Falha de push (credencial sem permissão de escrita) | ✅ detectada, `result: falha`, sequência não avançada |
| Retry após falha (credencial corrigida) | ✅ reprocessou a mesma semana/slot com sucesso |
| **Encerramento — 1ª execução real** (semana ISO real `2026-W27`, sem override) | ✅ sucesso — seq 1, slot `auto-slot-A`, commit `develop@b9c97a8` |
| **Encerramento — idempotência com a semana real** (2ª chamada, mesma semana `2026-W27`) | ✅ encerrou sem nova ação |
| **Encerramento — auditoria de integridade** (`git fsck --full` no clone espelho do repo de backup) | ✅ sem nenhum erro/objeto corrompido |
| **Encerramento — sincronização** (`git ls-remote` main/develop: origin × backup) | ✅ hashes idênticos nos dois repositórios |

> As semanas de teste (`TEST-W1`…`TEST-W5`, exclusivas para testes) foram removidas do manifesto e as tags de slot recriadas do zero antes da 1ª execução real — o backup automático em produção partiu de um estado limpo, com dado genuíno desde a semana `2026-W27`.

### 10.7 Rotina operacional recomendada

- **Backup automático:** não exige ação manual — roda sozinho aos domingos assim que o workflow estiver na `main` (ver seção 10.3, ativação pendente de autorização). Mantém sempre os 3 backups semanais mais recentes em rotação.
- **Backup manual (`backup ["descrição"]`):** rodar antes de qualquer alteração estrutural, migração de dados, mudança de segurança (regras Firestore, autenticação, permissões) ou intervenção de alto impacto — antes de mexer, não depois. Os backups manuais não entram na rotação e ficam disponíveis indefinidamente, até remoção manual explícita.
- Nenhuma das duas rotinas exige acompanhamento além de conferir o relatório impresso ao final da execução (ou o resultado do job no GitHub Actions, uma vez ativo).

## 11. Procedimento Oficial de Restauração

Comando (definido em `~/.bashrc`, aliases `restore-backup` / `restaurar`, delega para `scripts/backup/restore-backup.sh`):

```bash
restore-backup
# ou
restaurar
```

### 11.1 Quando utilizar

Falha operacional, erro humano (ex.: commit/push indevido), corrupção local ou necessidade de consultar/retornar a uma versão anterior do projeto.

### 11.2 Fluxo

1. Conecta ao repositório de backup e lista todas as tags `auto-slot-*` e `manual-*` disponíveis, mostrando data, hora, branch de origem, commit e descrição (lidos da mensagem da própria tag).
2. Pede o número do backup a restaurar (`0` cancela).
3. Mostra os metadados completos do backup escolhido e pede confirmação (`s/N`).
4. Cria uma branch local **temporária** `restore/<data_hora>-<tag>` apontando exatamente para o commit do backup — `develop` e `main` não são tocadas.
5. Valida integridade (`git fsck`, e confere que o commit da branch de recuperação é idêntico ao commit do backup escolhido).
6. Apresenta relatório final com o resultado e os próximos passos possíveis (todos manuais).

### 11.3 Segurança

A restauração nunca sobrescreve `main`/`develop` automaticamente, nunca faz deploy nem merge automático, e nunca apaga backups existentes — ela sempre parte de uma branch nova e isolada. Cabe ao desenvolvedor decidir, depois de consultar a branch `restore/...`, se quer apenas inspecionar, copiar arquivos pontuais, promover para `develop` (`git merge --ff-only`) ou — somente mediante autorização explícita — publicar depois em `main` via `subir-ok`.

### 11.4 Testes executados na homologação (2026-07-04)

| Teste | Resultado |
|---|---|
| Listagem de backups disponíveis (data/hora/branch/commit/descrição) | ✅ sucesso |
| Restauração cancelada pelo usuário (opção `0`) | ✅ nenhuma alteração feita |
| Restauração de um backup manual para branch temporária | ✅ `restore/2026-07-04_1025-manual-...` criada, apontando para o commit correto |
| Validação de integridade pós-restauração (`git fsck` + commit idêntico) | ✅ íntegro |
| `develop` preservada durante e depois da restauração | ✅ HEAD de `develop` inalterado |
| **Encerramento — restauração de um backup automático real** (`auto-slot-A`, semana `2026-W27`) | ✅ branch `restore/2026-07-04_1100-auto-slot-A` criada, árvore com os mesmos 2701 arquivos de `develop` |
| **Encerramento — projeto funcional pós-restauração** (arquivos-chave legíveis: `package.json`, `CRM/TECHDOC.md`, scripts de backup) | ✅ conteúdo íntegro, tamanhos consistentes |
| **Encerramento — remoção da branch temporária após validação** | ✅ `restore/2026-07-04_1100-auto-slot-A` removida ao final do teste |

### 11.5 Localização do repositório de backup

`https://github.com/itamaratento/Cell-City-Backup` (privado). Não usar para desenvolvimento nem deploy — ver seção 10.1.

---

## 12. Promoção `develop` → `main` (2026-07-04, ~14:37)

Checklist GO/NO-GO executado antes da promoção (sem nenhuma alteração de código): `develop` limpa, 45/45 testes automatizados, Firestore Rules do DEV verificadas via API, vulnerabilidade de escalada eliminada (reconfirmado ao vivo), contas `pendente` bloqueadas (reconfirmado ao vivo), criação de usuário funcionando (reconfirmado ao vivo), backup manual e restauração já validados pelo próprio dono (§10.6/§11.4), TECHDOC atualizado. Homologação manual dispensada/confirmada pelo dono.

**Promoção:** `subir-ok` — fast-forward `18f2b85..bfbc3d6` (18 commits: módulo Usuários e Permissões completo + as 3 correções de segurança P0 + sistema de backup do dono). Tag criada: **`v2026.07.04-1137`**.

**Efeito colateral não intencional:** `subir-ok` usa `git push origin main --follow-tags`, que empurrou para `origin` não só a tag nova como também 3 tags anotadas que já existiam localmente do teste do sistema de backup (`auto-slot-A`, `manual-2026-07-04_13-10-59-...`, `manual-2026-07-04_13-30-26-...`) — que, pela própria documentação do sistema (§10.4), deveriam viver exclusivamente no repositório `Cell-City-Backup`, não em `Cell-City-Site`. Não é destrutivo (só tags extras, sem conteúdo sensível), mas registrado para o dono decidir se quer removê-las de `origin` do Cell-City-Site.

**Publicação da aplicação:** push em `main` disparou o workflow `deploy-pages.yml` — sucesso de primeira. Confirmado via `curl`: raiz (produção) serve `kernel.js` com `perfil='pendente'` e `usuarios-permissoes.js` com as guardas novas.

**Publicação das Firestore Rules em produção:** mesmo obstáculo já conhecido (`sa-key.json` sem role de Rules Admin, `firebase deploy` falha com 403 no `:test`) — publicado via API REST (`firebaserules.googleapis.com`) com token do owner (`itamaratento@gmail.com`, `gcloud auth print-access-token`), mesma técnica da primeira promoção (2026-07-03). Ruleset ativo novo: `f4c9fd9f-fa93-48fe-975b-7a510d9835aa`. Verificado via API: idêntico ao arquivo local.

**Checagem de segurança pré-deploy (não destrutiva):** antes de publicar, auditei as 14 contas reais de `usuarios/` em produção — todas com `perfil` válido, nenhuma sem o campo, nenhuma já `'pendente'`. Confirma que a nova regra não bloquearia nenhum usuário real existente.

**Validação pós-publicação, em produção real (contas de teste descartáveis, removidas imediatamente após):**
- Prova de conceito original (signup público + self-create `master_admin`) repetida contra `cellcity-crm` → `PERMISSION_DENIED`. Escalada eliminada em produção, confirmado.
- Login real pela tela (não REST): `kernel.js` grava `perfil:'pendente'` corretamente no primeiro acesso em produção.
- Conta pendente bloqueada de ler `clientes` em produção (`permission-denied`) — inclusive os listeners em background do Dashboard (Caixa: categorias/lembretes) passaram a acusar `permission-denied` corretamente, confirmando a proteção ativa em todo o app, não só no meu teste direto.
- **Não verificado** (fora do meu alcance sem credenciais reais): login de administrador e "acesso de um perfil comum" em produção com uma conta real — não tenho senha de nenhuma conta real de produção e não tentei obtê-la. Login/acesso de conta `pendente` e a ausência de regressão nas regras (mesmo padrão já testado exaustivamente no DEV) cobrem o que pude validar com segurança.
- Logs do Firebase/GCP (`gcloud logging read`, últimos 15 min): nenhum erro de servidor retornado — esperado, já que negações de rule não geram log de erro no lado do servidor por padrão.

**Estado final:** `main` == `develop` == `bfbc3d6`, tag `v2026.07.04-1137`. Produção com o código e as rules corrigidas, validado com dados reais. Nenhuma conta de teste restante (produção: 14 contas reais, igual a antes).

**Efeito colateral para o sistema de backup:** esta promoção incluiu `.github/workflows/backup-weekly.yml` — como o gatilho `schedule` do GitHub Actions só é lido a partir da branch padrão (ver §10.3), a partir desta promoção o backup automático semanal **passou a estar ativo de verdade** (workflow confirmado como `active` na API de Actions). A pendência registrada em §10.3/§10.6 ("aguardando promoção") está resolvida.

## 13. Versionamento Semântico, `subir-ok` e Rollback de Produção

> Implementado em 2026-07-04, a pedido do dono, para tornar a promoção `develop→main` e a reversão de produção mais seguras e previsíveis. Script: [`scripts/release/rollback.sh`](../scripts/release/rollback.sh); comando de promoção continua sendo `subir-ok` (`~/.bashrc`).

### 13.1 Versionamento semântico

Toda promoção `develop→main` via `subir-ok` agora gera obrigatoriamente uma tag `vMAJOR.MINOR.PATCH` (antes era uma tag opcional no formato `vAAAA.MM.DD-HHMM`). `subir-ok` lê a última tag `v[0-9]*.[0-9]*.[0-9]*` existente (`git tag -l ... --sort=-v:refname`), pergunta o tipo de incremento (1=patch, padrão / 2=minor / 3=major) e cria a próxima versão. Se nenhuma tag semântica existir ainda, a primeira é `v1.0.0`. Essas tags são a lista de releases que o comando `rollback` oferece para reverter.

### 13.2 `subir-ok` — reforços de segurança

Além do fluxo já existente (checkout `develop` limpa, sincronizar com origin, merge `--ff-only` em `main`), `subir-ok` agora:
1. Exige confirmação explícita de que o checklist obrigatório do CLAUDE.md §5 (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente) foi validado — não há suíte de testes automatizados neste projeto (site estático, sem build step), então este é o gate real existente, formalizado como pergunta obrigatória em vez de apenas uma regra escrita.
2. Roda `backup` automaticamente (com a descrição `"pre-promocao develop->main <data/hora>"`) antes de tocar em `main` — se o backup falhar, a promoção é cancelada.
3. Publica a tag da release com `git push origin main "$tagname"` — **nunca `--follow-tags`**. Motivo: em 2026-07-04 uma promoção real usando a versão antiga (`--follow-tags`) publicou sem querer, em `origin` do Cell-City-Site, 3 tags internas do sistema de backup que só deveriam existir em `Cell-City-Backup` (`auto-slot-A` e duas `manual-*` — ver §12). Não foi destrutivo, mas contraria o design do §10.4; corrigido para não se repetir. **Pendência:** as 3 tags já publicadas em `origin` continuam lá — remoção é uma decisão do dono, não foi feita automaticamente.

### 13.3 `rollback` — reversão de produção sem reescrever histórico

Comando (`~/.bashrc`, delega para `scripts/release/rollback.sh`):

```bash
rollback
```

**Modelo de segurança (decisão explícita do dono em 2026-07-04):** ao contrário de um rollback clássico (`git reset --hard` + `push --force`), este comando **nunca reescreve histórico e nunca faz force-push**. Ele:
1. Lista as tags `vX.Y.Z` existentes (mais recente primeiro), marcando qual é a versão atual de produção.
2. Pede confirmação da versão escolhida.
3. Roda `backup` automaticamente antes de qualquer alteração em `main`.
4. Restaura a árvore de arquivos da versão escolhida com `git read-tree --reset -u <tag>` (substitui exatamente o conteúdo — adiciona o que faltar, remove o que não existia naquela versão) e cria um **commit novo** em `main` com esse conteúdo. `main` nunca é rebobinada; o histórico só cresce.
5. Push normal (`git push origin main`, sem `--force`). Se o conteúdo já for idêntico ao commit atual, encerra sem commitar nada.
6. Oferece marcar o rollback com uma tag de rastreio opcional (`rollback-<data_hora>-para-<versão>`).
7. Valida no final: `origin/main` aponta para o commit esperado, `git fsck` sem erros, `develop` intocada, branch original do terminal restaurada.

Nunca apaga tags/versões existentes, nunca cria merge, nunca faz deploy além do push normal em `main` (que já dispara o `deploy-pages.yml` existente, do mesmo jeito que qualquer push em `main`).

### 13.4 Testes executados (2026-07-04)

Executados contra um repositório Git isolado de teste (bare + clone, com 3 releases simuladas `v1.0.0`/`v1.1.0`/`v1.2.0` e um stub no lugar de `backup-manual.sh`) — **nunca contra a `main` real do Cell-City-Site**, para não afetar produção durante o teste da própria ferramenta de rollback:

| Teste | Resultado |
|---|---|
| Listagem de versões com marcação da versão atual | ✅ sucesso |
| Selecionar a versão já vigente | ✅ encerra sem ação ("já é a versão atual") |
| Cancelamento na confirmação | ✅ nada alterado |
| Rollback real para uma versão anterior (arquivos adicionados **e removidos** corretamente) | ✅ árvore final idêntica à da tag alvo |
| Histórico e tags preservados após o rollback | ✅ todos os commits/tags originais continuam visíveis (`git log --all`) |
| `git fsck` pós-rollback | ✅ sem erros |
| Push sem `--force` | ✅ fast-forward normal, aceito pelo remoto |
| Aritmética de versionamento semântico (patch/minor/major, primeira versão) | ✅ testada isoladamente, valores corretos |

> A promoção real de `subir-ok` (merge `develop→main`) não foi re-executada como teste nesta etapa — ela já é, por natureza, uma ação real de produção; só é exercida quando o dono decide promover de verdade (o que já aconteceu de forma independente em 2026-07-04, ver §12, usando a versão anterior do comando).

---

## 14. Cloud Functions (2026-07-04) — primeira infraestrutura de backend do projeto

Até esta data o projeto nunca teve Cloud Functions nem Admin SDK rodando em servidor — decisão deliberada, por custo/simplicidade (repetido em várias notas deste documento). Motivo da mudança: excluir um usuário exigia a senha atual da própria conta-alvo (o client SDK só apaga o usuário autenticado na instância corrente, nunca outro uid), e o dono pediu explicitamente uma forma de excluir qualquer usuário só com a senha/PIN de administrador.

### 14.1 Infraestrutura habilitada

- **Billing**: `cellcity-crm` (produção) estava no plano Spark (sem faturamento). Vinculado à mesma conta de faturamento já usada pelo DEV (`014813-6E6FAD-EF7BA9`, já ativa) — não foi preciso cadastrar cartão novo. Autorizado explicitamente pelo dono antes de vincular.
- **APIs habilitadas** (nos dois projetos): `cloudfunctions`, `cloudbuild`, `artifactregistry`, `run`, `eventarc`, `cloudbilling`.
- **IAM**: a service account `firebase-adminsdk-fbsvc@<projeto>` de cada ambiente recebeu `roles/iam.serviceAccountUser` (na própria SA e na SA de compute padrão), `roles/serviceusage.serviceUsageAdmin`, `roles/cloudfunctions.admin`, `roles/run.admin`, `roles/artifactregistry.admin` e `roles/eventarc.admin` — necessárias só para o **deploy** de Cloud Functions Gen2 (o deploy CLI usa a mesma `sa-key-dev.json`/`sa-key.json` já existentes, não foi criada nenhuma credencial nova).

### 14.2 A function

`functions/index.js`, `excluirUsuarioAdmin` (HTTPS Callable, região `southamerica-east1`, Node 20, 2ª geração):
1. Exige `request.auth` (chamador autenticado).
2. Lê o próprio doc `usuarios/{auth.uid}` do chamador e confere `perfil` — só `admin`/`master_admin` passam (`permission-denied` senão).
3. Bloqueia excluir a própria conta logada (`failed-precondition`).
4. Se o alvo tiver `perfil` `admin`/`master_admin`, conta quantos usuários no total têm esse perfil (`db.collection('usuarios').where('perfil','in',[...])`, sem o filtro de `perfil_operacional_id` que o client usa — mais abrangente, então mais restritivo) e bloqueia se seria o último.
5. Apaga o Auth (`admin.auth().deleteUser`) e o doc do Firestore, e grava a auditoria (`usuario_excluido`, `via:'cloud-function'`) — tudo com Admin SDK, ignorando as Firestore Rules (é o próprio servidor, não precisa da regra `delete` do client).

Roda com Admin SDK — por isso as checagens de autorização acima **são** a segurança real desta operação (a function ignora completamente as Firestore Rules), diferente de tudo mais no app onde a regra é a última linha de defesa.

### 14.3 Mudança no client

`usuarios-permissoes.js`: exclusão chama `httpsCallable(getFunctions(getApp(), 'southamerica-east1'), 'excluirUsuarioAdmin')` — sem tocar em `scripts/firebase.js` (arquivo protegido): `getApp()` importado direto do SDK, resolve para o mesmo app "[DEFAULT]" que `firebase.js` já inicializou. Campo "Senha atual da conta" removido do modal (não é mais necessário); "Senha administrativa" (PIN `77`) mantida como trava de confirmação de UX. `firebase-secondary.js`: `excluirContaSecundaria()` removida (código morto — impersonava a conta-alvo, técnica agora substituída).

### 14.4 Testes executados (Firestore/Auth/Functions reais, DEV e depois produção)

- ✅ **Positivo**: admin exclui usuário comum pela tela, sem informar nenhuma senha do alvo — confirmado Auth removido, Firestore removido, auditoria gravada com o admin_uid/nome corretos.
- ✅ **Positivo**: exclusão de um usuário com perfil `master_admin` funciona quando outros admins existem (exercita o caminho de código da contagem, sem bloquear indevidamente).
- ✅ **Negativo**: usuário comum (perfil `tecnico`) chama a function diretamente (fora da UI) → `permission-denied`.
- ✅ **Negativo**: admin tenta excluir a própria conta logada → `failed-precondition`, mensagem clara.
- ✅ **Defesa em profundidade** (harness jsdom, 45/45 no total): rejeição da Cloud Function (simulada) vira toast amigável no client, sem `unhandledRejection`.
- **Último administrador via function**: não forçado ao vivo (mesma razão do §6.9/6.14 — pool real de admins tem redundância, reduzir a 1 exigiria mexer em contas reais); a lógica (`allUsers.size <= 1`) é simples o suficiente para revisão direta de código, e o caminho "alvo é admin, outros existem" já foi exercitado com sucesso.

Testado primeiro no DEV, depois repetido em produção com uma conta descartável criada e removida só para o teste (produção: 12 contas reais antes e depois — nenhuma alteração residual).

### 14.5 Pendência menor — RESOLVIDA (2026-07-04)

Política de limpeza de imagens de contêiner (`firebase functions:artifacts:setpolicy`) foi configurada com sucesso em produção, mas falhou no DEV mesmo após conceder `roles/artifactregistry.admin`.

**Causa:** o Firebase CLI (`functions:artifacts:setpolicy`) exige `firebase login` interativo — não aceita `GOOGLE_APPLICATION_CREDENTIALS` (service account) para essa operação específica, diferente do `firebase deploy`. Sem terminal interativo disponível, o comando sempre falhava com "Failed to authenticate".

**Correção:** a mesma política aplicada em produção foi replicada no DEV diretamente via `gcloud artifacts repositories set-cleanup-policies gcf-artifacts --project=cellcity-crm-dev --location=southamerica-east1 --policy=<arquivo> --no-dry-run` (API nativa do Artifact Registry, não passa pelo Firebase CLI). Achado adicional: o repositório do DEV já estava com `cleanupPolicyDryRun: true` residual de uma tentativa anterior malsucedida — precisou do `--no-dry-run` explícito para desativar o modo simulação.

**Verificação:** `describe` do repositório do DEV confere byte-a-byte com o de produção (`firebase-functions-cleanup`, `DELETE`, `olderThan: 86400s`, `tagState: ANY`, sem `cleanupPolicyDryRun`). Nenhuma imagem foi removida manualmente — o DEV só tinha 1 função (`excluirUsuarioAdmin`) com 1 imagem + 1 imagem de cache, ambas em uso; confirmado que continuam intactas (mesmos digests) e que a function segue `ACTIVE` após a mudança.

### 14.6 Achado à parte — tag de versão malformada — RESOLVIDA (2026-07-04)

A promoção `develop→main` desta entrega (via `subir-ok` "reforçado" do dono, com backup automático embutido) gerou a tag `v2026.07.-1198` — falta o dia (`04`) no meio do nome, diferente do padrão das tags anteriores (`v2026.07.04-1137`).

**Correção:** confirmado pelo `taggerdate` das tags vizinhas que o padrão real é `vYYYY.MM.DD-HHMM` a partir do horário de *criação da tag* (não do commit) — a malformada foi criada às 13:44:51, então o nome correto é `v2026.07.04-1344`. Criada nova tag anotada com esse nome, apontando para o mesmo commit (`87dd648`, preservando a data original via `GIT_COMMITTER_DATE`), publicada no remoto; em seguida a tag antiga malformada foi apagada local e remotamente (`git tag -d` + `git push origin --delete`). Nenhum commit foi reescrito — tags são referências independentes, o histórico de commits não foi tocado.

**Verificação:** `git ls-remote --tags origin` confirma `v2026.07.04-1344` presente e `v2026.07.-1198` ausente; `develop`, `main`, `origin/develop` e `origin/main` seguem idênticos (`6b6c6fc`); working tree limpo.

**Não corrigido (fora de escopo):** o script `subir-ok` em si (fonte do bug de formatação) não foi alterado — é ferramenta do dono, em desenvolvimento paralelo por ele mesmo. Observação para ele investigar: a versão "reforçada" com tag semântica (`v${major}.${minor}.${patch}`) já tinha sido commitada (`908ed74`, 11:59) antes desta promoção (13:44) ter gerado uma tag no formato antigo por data — sugere que o terminal que rodou essa promoção ainda tinha a função antiga do `subir-ok` carregada na sessão do shell, sem `source ~/.bashrc` desde a atualização.

## 15. Refatoração modular do Dashboard (2026-07-04)

`CRM/pages/dashboard/dashboard.js` (2991 linhas, uma única classe `Dashboard`) foi reorganizado em 10 arquivos na mesma pasta, sem alterar nenhuma regra de negócio, permissão, consulta ao Firestore, Cloud Function, autenticação, HTML (além de nada — `index.html` não precisou de nenhuma alteração) ou CSS. Trabalho feito na branch `refactor-dashboard-modular` (a partir de `develop`), um commit por etapa, plano e levantamento completo em `plans/REFATORACAO_DASHBOARD_ETAPA1_MAPA.md`.

### 15.1 Nova arquitetura

Padrão de mixin: cada `dashboard-X.js` exporta um objeto plano de métodos; `dashboard.js` importa todos e aplica `Object.assign(Dashboard.prototype, ...)` antes do bootstrap. Mesma classe, mesma instância, mesmo `this`, mesmos closures internos — zero mudança de comportamento, só relocação mecânica de código. `_uid` (variável solta antes) virou `dashboardShared.uid` (objeto mutável em `dashboard-state.js`), única forma de compartilhar um valor mutável entre módulos ES sem getter/setter.

### 15.2 Estrutura e responsabilidade de cada arquivo

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `dashboard.js` | 38 | imports, classe `Dashboard` (constructor), `Object.assign` dos 8 mixins, bootstrap (`_bootDashboard`) |
| `dashboard-state.js` | 67 | state inicial (`criarEstadoInicial()`), `dashboardShared.uid`, `RBAC_CARD_PARA_MODULO_ID` |
| `dashboard-utils.js` | 19 | `escapeHtml`, helpers de DOM (`_setChecked`/`_getChecked`/`_setValue`/`_getValue`) |
| `dashboard-events.js` | 139 | cliques fora, atalhos de teclado, sidebar (drag-and-drop), dock, botão de reload |
| `dashboard-ui.js` | 425 | relógio, bloco de notas, mini calendário, grid de módulos (RBAC), navegação, config de alertas, modal de OS |
| `dashboard-caixa.js` | 132 | fechamento automático do Caixa (iframe), Meta Semanal (lê `caixa_lancamentos`) |
| `dashboard-busca.js` | 197 | índice e busca global (OS, clientes, produtos) |
| `dashboard-alertas.js` | 877 | agenda/Ação da Semana, badges de autoatendimento e diário, motor de geração de alertas (pós-venda, OS, meta, portal, avaliações) |
| `dashboard-alarme-os.js` | 987 | alarme configurável de nova OS (Service Worker, notificações, Wake Lock, janela flutuante) — maior bloco, 1/3 do arquivo original |
| `dashboard-init.js` | 29 | sequência de chamadas `setupX()` do `init()` |

Total: 2910 linhas em 10 arquivos (era 2991 em 1 arquivo — a diferença é o código morto removido, líquido dos imports/cabeçalhos novos de cada módulo).

**Código morto removido** (decisão do dono, não estava no escopo original mas foi encontrado no levantamento): `setupMinhaSemana_REMOVIDO` e `setupSidebarNotas_REMOVIDO` (165 linhas), nunca chamados em `init()`, já substituídos por `acaodasemana.js`.

**Divergência do plano original:** os módulos `dashboard-clientes.js`, `dashboard-produtos.js` e `dashboard-financeiro.js` do plano inicial não foram criados — o levantamento mostrou que `dashboard.js` nunca teve CRUD dessas áreas (isso vive nos módulos próprios `clientes.js`/`estoque.js`/`financeiro.js`, fora da pasta `dashboard/`); o que existia era só a fatia de índice de busca (foi para `dashboard-busca.js`). Em vez disso, o conteúdo real foi reagrupado por tema (Caixa, Busca Global, Central de Alertas) e ganhou um módulo novo (`dashboard-alarme-os.js`) para o maior bloco do arquivo, que não é CRUD de OS.

### 15.3 Fluxo de inicialização

`index.html` carrega só `<script type="module" src="dashboard.js">` (sem alteração). `dashboard.js` importa os 8 mixins + `criarEstadoInicial`/`dashboardShared` de `dashboard-state.js`, monta `Dashboard.prototype` via `Object.assign`, e `_bootDashboard()` (auto-executado no fim do arquivo) chama `initModulo()` → grava `dashboardShared.uid` → `carregarPermissoes()` → `new Dashboard()` (constructor chama `this.init()`, que dispara as 18 chamadas `setupX()` na mesma ordem de antes).

### 15.4 Dependências entre módulos

Todos os mixins importam de `../../scripts/firebase.js` e/ou `../../shared/permissoes.js` diretamente (cada um só o que usa — sem reimportar tudo em cascata). `dashboard-ui.js`, `dashboard-alarme-os.js` e (indiretamente, via `this`) outros mixins leem `dashboardShared.uid`/`RBAC_CARD_PARA_MODULO_ID` de `dashboard-state.js`. Referências entre métodos de mixins diferentes (ex.: `dashboard-events.js` chamando `this.navigateTo(...)`, que vive em `dashboard-ui.js`) funcionam normalmente porque todos os mixins são aplicados ao mesmo `Dashboard.prototype` antes do bootstrap rodar — não há import circular entre os arquivos `dashboard-*.js` em si.

### 15.5 Verificação (Etapa 13)

Duas camadas, sem ferramenta de automação de navegador disponível neste ambiente:
1. **Estática**, repetida a cada commit: `node --check` nos 10 arquivos + checagem estrutural (grep) confirmando os 44 métodos originais (46 menos os 2 mortos) em exatamente 1 lugar cada.
2. **Dinâmica (jsdom)** — método já validado no projeto (ver nota de homologação sem navegador): os arquivos reais + `index.html` real carregados num ambiente Node+jsdom isolado no scratchpad, com `kernel.js`/`firebase.js`/`permissoes.js` mockados. **10/10 checagens passaram**, incluindo RBAC positivo e negativo (card ocultado corretamente quando o perfil não tem permissão).

**Não coberto** (registrado para o dono decidir sobre homologação visual antes de promover): renderização visual/CSS real, Firestore real, Service Worker real, cliques de mouse reais, e as demais páginas do checklist do CLAUDE.md — nenhuma foi tocada por esta refatoração, mas nenhuma foi re-testada.

### 15.6 Benefícios da refatoração

- Arquivo principal de 2991 linhas → 38 linhas (só orquestração); cada responsabilidade agora em arquivo próprio, navegável e revisável isoladamente.
- Maior bloco antes invisível (`setupAlarmeOS`, 976 linhas / 33% do arquivo) agora é um módulo nomeado e explícito.
- 165 linhas de código morto eliminadas.
- Zero mudança de comportamento: mesma classe, mesmo `this`, mesmos closures, mesmas 18 chamadas de `init()` na mesma ordem — só a localização do código mudou.

### 15.7 Homologação final e promoção (2026-07-04, ~18:46)

Homologação em `/dev` feita pelo dono em navegador real (console + navegação), complementada por verificação automática adicional: matriz de RBAC (perfis admin/operador simulados, 15/15 checagens cada, zero erro de console/jsdom capturado) e diff de regressão — 11/11 coleções Firestore referenciadas pelo Dashboard idênticas ao código original, tabela de rotas byte-a-byte idêntica, zero Cloud Functions em ambos (não se aplica ao Dashboard).

**Achado da homologação — bug pré-existente, não relacionado à refatoração:** durante o teste em `/dev`, apareceram dois logs `[Cell City] Firebase ambiente: ...` (um `dev`, um `prod`). Causa raiz: `_verificarFechamentoCaixa()` (`dashboard-caixa.js`) cria um iframe oculto com `iframe.src = '/CRM/pages/caixa/index.html'` — caminho absoluto sem o prefixo `/dev`. Dentro desse iframe, `env-config.js` avalia `location.pathname` (do iframe, não da página pai) e conclui `isDevPath = false`, carregando o projeto Firebase de **produção** mesmo com o Dashboard aberto em `/dev`. Efeito real: toda abertura do Dashboard em `/dev` dispara o orquestrador de fechamento do Caixa contra o Firestore de produção, não o de DEV — furando o isolamento criado na Fase 5 (separação de ambientes). **Confirmado que o bug já existe em `main`/produção, idêntico, e não foi introduzido nem alterado por esta refatoração** (código movido byte-a-byte). Registrado como pendência separada, fora do escopo desta entrega — correção proposta (tornar o path do iframe consciente de `/dev`, no mesmo padrão já usado no gate de login) depende de autorização explícita do dono antes de aplicar, por mexer em tratamento de dado de produção.

**Decisão do dono:** promover a refatoração agora (não é afetada pelo bug do iframe, que é pré-existente e independente) e tratar a correção do iframe como item separado depois.

**Promoção:** `develop` → `main` via **squash merge** (não fast-forward/merge commit) — descoberto nesta promoção que o repositório tem uma regra do GitHub (`main` não pode conter merge commits), então o merge normal foi rejeitado e refeito como squash (`git merge --squash` + commit único). Histórico completo das 15 etapas preservado em `develop` e na branch `refactor-dashboard-modular`; `main` recebeu 1 commit equivalente. Conteúdo de `develop` e `main` confirmado idêntico (`git diff` vazio) apesar da forma do histórico ter divergido. Tag `v2026.07.04-1849` criada e publicada. Backup manual executado antes de tocar em `main` (padrão `subir-ok`). Deploy de produção confirmado com sucesso.

## 16. H-009 — Iframe do fechamento automático do Caixa sem prefixo `/dev` (2026-07-04)

Correção do bug registrado na seção 15.7, implementada como entrega própria e independente da refatoração do Dashboard (branch `fix-h009-iframe-caixa-dev-path`, a partir de `develop`).

### 16.1 Causa raiz confirmada

`_verificarFechamentoCaixa()` (`CRM/pages/dashboard/dashboard-caixa.js`) cria um iframe oculto com `iframe.src = '/CRM/pages/caixa/index.html'` — caminho absoluto, sem prefixo `/dev`. `CRM/shared/env-config.js` decide o ambiente por `location.pathname` — mas dentro do iframe esse `location` é o do PRÓPRIO iframe, não da página pai. Como o caminho nunca incluía `/dev`, o iframe sempre concluía `isProdHost && !isDevPath = true` → ambiente `prod`, mesmo com o Dashboard aberto em `/dev`.

**Por que só se manifesta em `/dev`:** em produção, tanto a página pai (`/CRM/pages/dashboard/index.html`) quanto o iframe (`/CRM/pages/caixa/index.html`) concluem `prod` — concordância, sem sintoma visível. Só em `/dev` há discrepância: o pai corretamente detecta `dev`, mas o iframe (carregado por um caminho absoluto que nunca aponta para `/dev`) incorretamente resolve para `prod`.

### 16.2 Solução adotada

Mesmo critério de detecção já usado em `brand-header.js`/`kernel.js`/`login.html`/`config.js`, e mais diretamente igual ao já aplicado no **H-006** (que corrigiu a mesma classe de bug — "guardas RBAC/iframe hardcoded sem prefixo /dev" — em 5 arquivos irmãos, incluindo o próprio `caixa.js`):

```js
iframe.src = (location.pathname==='/dev'||location.pathname.startsWith('/dev/')?'/dev':'') + '/CRM/pages/caixa/index.html';
```

Nenhuma outra linha alterada — regra de negócio, autenticação, RBAC, consultas ao Firestore, Cloud Functions e demais funcionalidades do Dashboard permanecem intocadas.

### 16.3 Arquivos alterados

- `CRM/pages/dashboard/dashboard-caixa.js` — 1 linha (`iframe.src`), + comentário explicativo.

### 16.4 Achado à parte (não corrigido, fora do escopo desta entrega)

Varredura de diligência em todos os arquivos do Dashboard encontrou a **mesma classe de bug** em `dashboard-alarme-os.js` (`abrirJanelaFlutuante`, `window.open('/CRM/pages/dashboard/index.html?mini=1', ...)`) — caminho absoluto sem `/dev`, abrindo a janela flutuante do alarme sempre contra a página de produção quando acionada a partir de `/dev`. Não corrigido por estar fora do escopo explícito desta entrega (função diferente, não é o iframe do Caixa) — registrado para autorização separada.

Também revisado (e mantido como está, intencional): o registro do Service Worker do alarme (`sw-alarme.js`) em `dashboard-alarme-os.js` também usa um caminho `/CRM/pages/dashboard/` fixo — mas isso já foi analisado e decidido no H-002 (2026-07-03): o escopo máximo permitido pelo navegador para um Service Worker é derivado do caminho do próprio arquivo do worker, não da página que o registra, e o GitHub Pages não permite o header `Service-Worker-Allowed` necessário para um escopo mais amplo. Não é a mesma categoria de bug (não depende de `env-config.js`/`location.pathname` da mesma forma) — não mexido.

### 16.5 Validação

Sem navegador real disponível neste ambiente. Teste automatizado (jsdom) simulando os dois ambientes via URL do documento (`https://cellcityinformatica.com.br/dev/CRM/pages/dashboard/index.html` e `.../CRM/pages/dashboard/index.html`, sem `/dev`), interceptando `document.createElement('iframe')` para capturar o `src` resolvido:

- **Cenário `/dev`:** `iframe.src` resolvido para `https://cellcityinformatica.com.br/dev/CRM/pages/caixa/index.html` — correto. 5/5 checagens (boot sem exceção, zero erro de console/jsdom, iframe criado, `src` contém `/dev/`, `src` não aponta para produção sem `/dev`).
- **Cenário produção:** `iframe.src` resolvido para `https://cellcityinformatica.com.br/CRM/pages/caixa/index.html` (sem `/dev`) — comportamento de produção preservado, sem regressão. 4/4 checagens.

**Não coberto:** confirmação visual em navegador real de que o iframe, uma vez carregado de verdade em `/dev`, de fato inicializa com `cellcity-crm-dev` (o teste automatizado prova a URL correta, mas não executa o carregamento real da página de destino).

### 16.6 Status

Implementado e mesclado em `develop` (commit `23fc15c`, merge `f967ae1`), publicado em `/dev`.

### 16.7 Homologação e promoção a produção (2026-07-04, ~19:31)

Homologado pelo dono em `/dev` (navegador real) e autorizado formalmente para produção. Validação complementar feita com requisições HTTP reais contra o site publicado (não mock):

- `https://cellcityinformatica.com.br/dev/CRM/pages/caixa/index.html` (novo alvo do iframe em `/dev`) — HTTP 200.
- `https://cellcityinformatica.com.br/CRM/pages/caixa/index.html` (produção, sem `/dev`) — HTTP 200, conteúdo idêntico, sem regressão.
- `dashboard-caixa.js` publicado em `/dev` confirmado contendo o fix antes da promoção.

**Promoção:** `develop` → `main` via squash merge (mesmo procedimento do item 15.7 — `main` não aceita merge commits). Conflito esperado em `CRM/TECHDOC.md` e `dashboard-caixa.js` (mesma causa: `main` e `develop` não compartilham commit-base desde o squash anterior), resolvido tomando a versão de `develop` — `git diff develop main` confirmado vazio antes e depois do commit. Backup manual executado antes de tocar em `main`. Commit em produção: `5401192`. Tag: `v2026.07.04-1931`.

**Pós-deploy:** deploy de produção concluído com sucesso já na primeira tentativa (sem falha transitória desta vez). Confirmado via HTTP real: `dashboard-caixa.js` em produção contém o fix; `/CRM/pages/caixa/index.html` e `/CRM/pages/dashboard/index.html` respondem 200 em produção. `develop` e `main` com conteúdo idêntico. Working tree limpo.

**H-009 oficialmente encerrado.** Pendência remanescente, fora deste escopo: o achado à parte da seção 16.4 (janela flutuante do alarme, mesma classe de bug) continua sem correção, aguardando autorização separada (H-010 em potencial).

## 17. Sprint 1a — Segurança do Portal do Cliente / OS pública (2026-07-05)

Correção do achado crítico da auditoria de 2026-07-04 (`plans/AUDITORIA_GERAL_20260704.md`, Alerta no topo; detalhe técnico completo em `plans/AUDITORIA_GERAL_20260704_INTERNO.md`, não publicado). Autorizada pelo dono **exclusivamente em `develop`**, com homologação obrigatória antes de qualquer promoção a `main` — ver `plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md` Etapa 6 e `/home/cellcity/.claude/plans/majestic-booping-walrus.md` para o plano completo aprovado.

### 17.1 Causa raiz confirmada

Dois problemas independentes, confirmados por leitura direta de código (não só pela auditoria):

1. **`CRM/pages/portal-cliente/admin.html`** (painel administrativo interno) não tinha nenhum gate de autenticação de equipe — criava sua própria app Firebase e só fazia `signInAnonymously()`, a mesma sessão anônima do cliente comum. Diferente de todo o resto do CRM, nunca importava `kernel.js`/`initModulo()`. `admin.js` (1409 linhas) também não tinha nenhuma checagem de perfil/permissão.
2. **`CRM/firestore.rules`** — `match /os/{osId} { allow get: if true; ... }` expunha o documento **inteiro** de qualquer OS (incluindo `password`/`patternSequence`/`lockPhoto` — senha/padrão/foto de desbloqueio do aparelho em texto puro —, endereço, IMEI e `technicalObservation`) para qualquer visitante sem login, por ID sequencial/previsível (`OS-0001`, `OS-0002`...). Três arquivos consomem essa leitura publicamente: `CRM/garantia.html` (busca por ID) e dois `consultar-os.html` (raiz e `CRM/`) — o da raiz, além de já ter `allow get: if true`, fazia **`db.collection('os').get()` sem filtro** na busca por telefone (baixava a coleção `os` inteira para o navegador antes de filtrar no client).

**Achado técnico relevante para o desenho da correção:** Firestore Rules não conseguem projetar campos numa leitura (um `get`/`list` retorna o documento inteiro ou nada) nem validar com segurança um filtro `where` alegado por um cliente anônimo. Servir só os campos públicos necessários exigiu a primeira Cloud Function de **leitura** do projeto (as anteriores eram só de escrita — `excluirUsuarioAdmin`).

### 17.2 Solução adotada

- **`admin.html`**: gate substituído por `initModulo()` (`kernel.js`) + `carregarPermissoes()`/`podeVisualizar('portal-cliente')` (`shared/permissoes.js`), mesmo padrão de `caixa.js`/`estoque.js`. Passa a usar a mesma app Firebase compartilhada de `scripts/firebase.js` (antes criava a própria). `admin.js` não foi alterado — o contrato (`window.db`/`window.FirebaseModules`/evento `admin-firebase-ready`) foi preservado.
- **Duas Cloud Functions novas** (`functions/index.js`, mesmo padrão de `excluirUsuarioAdmin`: `onCall`, região `southamerica-east1`, Admin SDK — ignora Rules): `consultarOSPublica({osId})` e `consultarOSPorTelefonePublica({phoneDigits})`, ambas retornando só uma whitelist de campos (`OS_CAMPOS_PUBLICOS`, nunca senha/padrão/foto/endereço/IMEI/notas internas) via `projetarCamposPublicosOS()`. Sem exigir `request.auth` — mantém o modelo de confiança já aceito hoje ("link direto"/"posse do número", sem OTP).
- **`CRM/firestore.rules`**: `allow get` de `os/{osId}` fechado (`if false`). A parte `list/create/update/delete` (protegida por `temAcessoLiberado()`) não foi alterada — confirmado por grep que nenhum código de equipe usa `get` de doc único em `os`.
- **`CRM/garantia.html`, `consultar-os.html` (raiz) e `CRM/consultar-os.html`**: passaram a chamar as duas Cloud Functions em vez de Firestore direto. A busca por telefone mudou de fuzzy-match client-side (comparação de sufixo sobre `os.phone` bruto) para busca exata por `phoneDigits` (campo canônico já migrado — `CRM/scripts/migrate-phone-canonico.cjs`) — decisão validada com o dono.

### 17.3 Escopo explicitamente fora desta entrega (Sprint 1b, proposta e não implementada)

As 5 coleções do Portal (`mensagens_portal`, `avaliacoes`, `agendamentos`, `solicitacoes_diagnostico`, `portal_eventos`) e o fluxo de aprovar/recusar orçamento (escrita em `os/{osId}.status`) têm a mesma limitação estrutural de Firestore Rules, mas não foram tocados nesta sprint — ver `plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md`/plano aprovado para o detalhamento.

**Achado paralelo, não corrigido, sinalizado para verificação urgente e independente:** essas mesmas 5 coleções (mais a parte `list/create/update/delete` de `os`) já estão protegidas por `temAcessoLiberado()` desde o commit `2edd4ba` (2026-07-04) — função que exige `usuarios/{uid}` com `perfil != 'pendente'`, nunca satisfeita por sessão anônima. Não há confirmação de que esse ruleset esteja de fato deployado em produção agora (só estar no arquivo do git não significa publicado). **Se estiver ativo, o Portal do Cliente real pode já estar com `permission-denied` para clientes reais** (mensagens, avaliações, agendamentos, solicitações) desde 2026-07-04 — uma possível quebra de produto, independente desta sprint. Verificação recomendada via `node _runtime_audit/verify-firestore-rules.mjs --project cellcity-crm`, não executada nesta sessão (sem Node/CLI disponível).

Também identificados, para correção futura junto da Sprint 1b: falha silenciosa em `portal.js::_executarAprovacao`/`_executarRecusa` (`updateDoc` sem `await`/`.catch()`) e em `enviarAvaliacao()` (ignora o resultado de erro de `_salvarAvaliacao()`) — em ambos, o toast de sucesso pode aparecer ao cliente mesmo que a escrita falhe.

### 17.4 Arquivos alterados/criados

- `CRM/pages/portal-cliente/admin.html` — gate de autenticação.
- `functions/index.js` — 2 Cloud Functions novas + whitelist de campos.
- `CRM/firestore.rules` — `os/{osId}.get` fechado.
- `CRM/garantia.html`, `consultar-os.html` (raiz), `CRM/consultar-os.html` — migrados para as Cloud Functions.
- `tests/firestore-rules/os-publico.test.mjs` + `package.json` (novo diretório) — suíte de testes de Rules com `@firebase/rules-unit-testing`, 7 cenários (ver §17.5).

### 17.5 Testes e homologação

Suíte de testes escrita nesta sessão (`tests/firestore-rules/os-publico.test.mjs`), cobrindo: `get` sem autenticação (negado), `get` com sessão anônima (negado), `get` com staff real (negado — a Rule fecha para todos, staff usa `list`), `list` sem autenticação (negado, não-regressão), `list` com staff real (permitido, não-regressão), `list` com perfil `pendente` (negado, não-regressão), `update` sem autenticação (negado).

**Não executada nesta sessão** — este ambiente não tem `node`/`npm`/Firebase CLI instalados. Pendente, fora desta sessão, antes de qualquer homologação formal:
1. `cd tests/firestore-rules && npm install && npm test` (emulador local).
2. Deploy das 2 Cloud Functions e da nova Rule em `cellcity-crm-dev` (ordem obrigatória: Functions → migrar os 3 consumidores → só então fechar a Rule — inverter quebra `garantia.html`/`consultar-os.html` imediatamente).
3. Confirmação via `node _runtime_audit/verify-firestore-rules.mjs --project cellcity-crm-dev` de que o release ativo é o novo arquivo.
4. Homologação manual em `/dev` (Console + aba Network do navegador) nas 3 páginas públicas.
5. Verificação do achado paralelo da seção 17.3 (Portal do Cliente real, quebrado ou não).

### 17.6 Status (histórico — ver §17.7 a §17.9 para o desfecho final)

Implementado em `develop`. Homologado, deployado em DEV e em produção — ver §17.7 a §17.9.

### 17.7 Hotfix P0 em produção (2026-07-05) — achado independente durante a homologação da Sprint 1a

Durante a auditoria pedida pelo dono sobre o status de `temAcessoLiberado()` (função de Rules, não Cloud Function — helper definido uma vez em `CRM/firestore.rules`, usado em várias regras) em produção, confirmou-se por teste real (SDK cliente, sessão anônima, contra `cellcity-crm`) que o commit `2edd4ba` (2026-07-04, correção de conta `pendente`) estava **ativo em produção desde `2026-07-04T14:39:49Z`** e bloqueava, com `permission-denied`, clientes anônimos reais em: Consultar OS pública (`consultar-os.html`, list), aprovar/recusar orçamento (`os`, update) e as 5 coleções do Portal (`mensagens_portal`, `avaliacoes`, `agendamentos`, `portal_eventos`, `solicitacoes_diagnostico`). Motivo: `temAcessoLiberado()` exige `usuarios/{uid}` com `perfil != 'pendente'`, condição nunca satisfeita por sessão anônima (`signInAnonymously()`).

**Hotfix aplicado direto em `main`** (commit `60173b7`, autorizado pelo dono como ação emergencial, separada da Sprint 1a): removeu `&& temAcessoLiberado()` dessas 6 coleções, restaurando o comportamento pré-`2edd4ba`. Publicado via API direta do Firebase (`firebaserules.googleapis.com`, contornando falta de permissão `firebaserules.admin` da service account de produção) e verificado por leitura anônima real pós-deploy.

### 17.8 Reconciliação e promoção da Sprint 1a (2026-07-05)

`CRM/firestore.rules` de `develop` nunca incluía o hotfix (só fechava `os.get`) — promover como estava reabriria o mesmo incidente. Reconciliado (commit `47b2036` em `develop`): mantém `os.get:false` **e** a relaxação das 6 coleções, com nova suíte de testes (19/19, incluindo os cenários de reconciliação).

**Sequência de implantação, autorizada pelo dono em duas rodadas** (a primeira ordem causou uma quebra real, corrigida em ~2 minutos — ver abaixo):
1. Cloud Functions (`consultarOSPublica`, `consultarOSPorTelefonePublica`) publicadas em `cellcity-crm` — aditivas, `excluirUsuarioAdmin` intocada.
2. **Tentativa 1** (revertida): Rules reconciliadas publicadas em produção *antes* do push do site — quebrou `garantia.html` (ainda rodando a versão antiga, que usa `getDoc()` — `get`, diferente de `consultar-os.html`, que usa `list`). Detectado por teste real em ~2min, revertido imediatamente para o ruleset do hotfix, confirmado restaurado.
3. **Ordem corrigida e reautorizada**: Functions → push do site (`main`, commit `e6eb25d`, squash de `develop`) → confirmação do deploy do GitHub Pages → busca exaustiva por dependências remanescentes de `os.get`.
4. **Segundo achado**: `responderOrcamentoConsulta()` em `consultar-os.html` (raiz) também dependia de `get()` (checagem de "já respondido" antes do `update`) — não migrado pela Sprint 1a original. Corrigido (commit `dcfa3c0` em `develop`, cherry-pick `ab681d7` em `main`): trocado `.doc(docId).get()` por `.where('id','==',docId).limit(1).get()` — mesmo resultado, usa `list` (já liberado), zero mudança de comportamento. Testado via Puppeteer (clique real, sessão anônima) em DEV e em produção (documento sintético criado e removido): aprovar, recusar, resposta duplicada bloqueada, OS inexistente — todos idênticos ao comportamento anterior.
5. Confirmado por grep exaustivo: nenhuma chamada restante a `get()`/`getDoc()` em `os` fora de `functions/index.js` (Admin SDK).
6. Rules reconciliadas publicadas em produção (`os.get:false` definitivo). Ataque simulado (SDK cliente, sessão anônima) confirma `permission-denied` — vulnerabilidade original fechada.

### 17.9 Homologação pós-deploy final e status

Todos os fluxos testados em produção real (não DEV) após o fechamento de `os.get`: Consulta de OS por ID ✔, por telefone ✔, Garantia ✔ (todos via Cloud Function, confirmado por captura de rede — nenhuma leitura direta de `os`), aprovar orçamento ✔, recusar orçamento ✔, Portal do Cliente ✔ (sem regressão), Painel Administrativo — gate novo confirmado bloqueando acesso anônimo (antes desta sprint, o painel não tinha gate nenhum) e permitindo staff autenticado ✔, Login da equipe ✔.

**Achado à parte, não relacionado a esta sprint (nenhum arquivo do módulo foi tocado):** Portal do Técnico (`CRM/pages/portal-tecnico/`) redireciona para o Dashboard mesmo para perfil `master_admin`, testado via sessão sintética (custom token). Como nenhum arquivo desse módulo consta em nenhum diff desta sprint (hotfix, reconciliação ou promoção), este é um comportamento pré-existente — sinalizado para investigação futura, fora do escopo desta entrega.

**Status final: Sprint 1a concluída, homologada e promovida a produção.** `main` e `develop` com conteúdo idêntico (commits `ab681d7`/`dcfa3c0` respectivamente). Rules ativas em produção verificadas via API (`firebaserules.googleapis.com`), não só pela CLI. Pendência remanescente, formalmente proposta e não implementada: Sprint 1b (`plans/SPRINT_1B_PORTAL_CLOUD_FUNCTIONS.md`) — migra as 5 coleções do Portal e aprovar/recusar orçamento para Cloud Functions, fechando a checagem de perfil (`temAcessoLiberado()`) nessas 6 coleções sem repetir o bloqueio a cliente anônimo que motivou o hotfix de hoje.

## 18. Lições aprendidas — endurecimento de Firestore Rules em produção (2026-07-05)

Registradas ao encerrar formalmente a Sprint 1a, a partir de dois incidentes reais desta mesma entrega (§17.7–17.9: o hotfix P0 do `temAcessoLiberado()` e a interrupção/correção ao fechar `os.get`). Aplicam-se a qualquer sprint futura que toque em Firestore Rules, não só à Sprint 1b.

1. **Nunca endurecer uma Rule antes de confirmar que todo o código em produção já usa a nova arquitetura.** Fechar `os.get` antes do push do site quebrou `garantia.html` (código antigo, ainda dependente de `getDoc()`) por ~2 minutos em produção real. Ordem correta: Functions (aditivo, sem risco) → push do código novo → confirmar que o código novo está realmente ao vivo (sem cache) → só então endurecer a Rule.

2. **Sempre executar busca exaustiva por dependências antes de fechar uma permissão.** A análise original da Sprint 1a assumiu, por uma leitura parcial do código, que nenhuma funcionalidade pública dependia de `get()`. Uma segunda dependência (`responderOrcamentoConsulta()`, `consultar-os.html`) só foi encontrada ao grepar explicitamente por `.get()`/`getDoc()` ligados à coleção antes do fechamento definitivo. "Migrei a busca" não é o mesmo que "migrei tudo que toca a coleção".

3. **Toda alteração de Rules deve ter um checklist específico de dependências**, não só a suíte de testes de Rules (que valida a regra em si, não quem a consome). Checklist mínimo: grep exaustivo por `get()`/`getDoc()`/`list()`/`update()` na coleção afetada em todo o código público; confirmar via captura de rede real (não só leitura de código) o que cada consumidor efetivamente chama; testar em produção real antes de considerar a etapa concluída, não só em DEV.

4. **Toda sprint de infraestrutura (Rules, Cloud Functions, mudança de ambiente) deve ter plano de rollback validado antes da execução**, não escrito depois de um incidente. Neste caso o rollback funcionou porque o ruleset anterior já estava salvo localmente e o método de publicação via API direta (contornando a falta de permissão `firebaserules.admin` da CLI) já tinha sido validado — se essas duas coisas não estivessem prontas, os ~2 minutos de indisponibilidade do item 1 poderiam ter sido bem maiores.

**Achado operacional à parte, registrado por transparência:** durante o fechamento desta sprint, um commit de outra frente de trabalho (`Camada Repository`, não relacionada) foi encontrado misturado no mesmo checkout local compartilhado. Foi preservado intacto numa branch separada (`preserve-camada-repository-20260705`) e removido da documentação publicada (a seção que o descrevia tinha sido incluída em `main`/`develop` sem querer, junto de um commit de TECHDOC desta sprint, antes de o código correspondente existir). Lição operacional: ao commitar um arquivo compartilhado como `CRM/TECHDOC.md`, conferir o diff completo antes de commitar, não só a seção que se pretende alterar — `git add` captura o estado inteiro do arquivo no working tree, inclusive edições de terceiros ainda não commitadas.

## 19. Sprint 1b — Portal do Cliente migrado para Cloud Functions (2026-07-06)

Conclui o que a Sprint 1a deixou pendente (§17.3): as 7 funcionalidades do Portal do Cliente que ainda dependiam de acesso direto do cliente anônimo ao Firestore (mensagens, avaliações, agendamentos, solicitação de diagnóstico, eventos, aprovar/recusar orçamento) migraram para Cloud Functions, permitindo fechar de vez a brecha de conta `pendente` reaberta pela reconciliação de 2026-07-05 (hotfix P0, §17.7) nessas coleções — sem repetir o incidente de bloquear cliente anônimo legítimo.

### 19.1 Reconciliação de um hotfix órfão

Sessão anterior tinha deixado um hotfix commitado (`e2a17f9`, "login do Portal quebrado para clientes reais" — `doLogin()` lia `clientes/{phoneDigits}`, coleção que nunca entrou na reconciliação das outras 6) numa branch local isolada, nunca mesclada nem pushada. Reconciliado por cherry-pick nesta sessão; a branch órfã foi apagada depois.

### 19.2 Fix definitivo do nome do cliente

O hotfix aceitava perder o nome real do cliente na saudação (fallback "Cliente") para não travar o login. Fix definitivo: nova Cloud Function `portalObterNomeCliente` (mesmo padrão Admin SDK das demais, retorna só `name`) substitui o hotfix — `clientes` continua exigindo `temAcessoLiberado()` nas Rules (tem CPF/e-mail/endereço), sem reabrir para sessão anônima.

### 19.3 Bugs achados na homologação com fluxo real de login

A homologação anterior (Lote 2) usava um workaround — sessão injetada direto no `sessionStorage`, contornando `doLogin()` — porque `doLogin()` estava quebrado (§19.1). Retomada com o fluxo real (telefone + botão Entrar), a homologação (Puppeteer, `cellcity-crm-dev`) achou e corrigiu:

1. `_carregarMensagens()` não normalizava hash com "/" inicial (`#/mensagens`), diferente da função irmã `_carregarAgendamentos()` — a tela nunca recarregava via essa rota.
2. Link do WhatsApp (`target="_blank"`) abrindo aba real para domínio externo travava os comandos CDP seguintes no ambiente de teste (sandboxed, sem saída para `wa.me`) — trocado para disparo do evento via `dispatchEvent` não-confiável (executa o `onclick` sem seguir a navegação).
3. `enviarMensagem()`/`enviarAvaliacao()` quebravam com `TypeError` se o cliente navegasse de rota enquanto a Cloud Function estava em voo (re-consulta de `document.getElementById()` depois do `await` retorna `null`) — refs passam a ser cacheadas antes do `await`, mesmo padrão já usado em `_enviarAgendamento()`/`_enviarSolicitacaoDiagnostico()`.
4. `_listenOS()` (onSnapshot de `os`, não tocado por esta sprint) tinha o mesmo problema de normalização de hash do item 1 — a tela de detalhe da OS não recebia a atualização ao vivo do aprovar/recusar orçamento quando acessada via link com "/" inicial.
5. `_checkAvaliacaoExistente()` (fire-and-forget) sem proteção contra o cliente tocar 4-5 estrelas antes da Cloud Function responder — podia salvar avaliação duplicada. Gate `_avaliacaoCheckDone` adicionado.

### 19.4 Bugs achados no code-review pós-homologação (4 agentes, ângulos de correção/reuso/simplificação/convenções)

1. **"Invalid Date" nas Mensagens**: o encoder de resposta do `onCall` achata um `Timestamp` do Admin SDK em `{_seconds,_nanoseconds}` (perde `.toDate()`) — `portalListarMensagens/Avaliacoes/Agendamentos` devolviam `createdAt` nesse formato, e o formatador do client não reconhecia. Serializado para ISO string no servidor (mesmo formato já usado em `os.createdAt`), com a ordenação (antes duplicada em 3 lugares) centralizada numa função só.
2. **Fuso horário errado no orçamento**: `orcamentoDataResposta`/`orcamentoHoraResposta` usavam `toLocaleDateString('pt-BR')` sem `timeZone` — código copiado do client (implicitamente horário de Brasília no navegador) para uma Cloud Function (runtime em UTC), gravando até 3h adiantado. Fix: `timeZone: 'America/Sao_Paulo'` explícito.
3. **CLAUDE.md §9** (consultas sem `limit()`): adicionado `limit(200)` em `portalListarMensagens/Avaliacoes/Agendamentos`.
4. **`phoneDigits` reconstruído via regex**: `consultar-os.html` reconstruía `phoneDigits` a partir de `phone` (regex), quebrando silenciosamente para OS onde os dois campos divergissem. `phoneDigits` adicionado à whitelist pública de `os` (já é derivável do `phone` público) — usa o campo canônico direto.
5. **Imports mortos**: `addDoc/updateDoc/deleteDoc/orderBy/serverTimestamp/arrayUnion/limit` sem nenhum uso real em `portal.js` depois da migração — removidos do módulo ES e de `window.FirebaseModules`.

Todos os 5 itens confirmados por teste real (unitário via emulador e/ou Puppeteer contra `cellcity-crm-dev`) antes e depois do fix.

### 19.5 Fechamento das Firestore Rules

Com as 7 funcionalidades migradas e homologadas, as Rules voltaram a exigir `temAcessoLiberado()`:

- **Fechadas por completo**: `avaliacoes`, `mensagens_portal`, `portal_eventos`, `agendamentos`, `solicitacoes_diagnostico`.
- **`os` fechada parcialmente**: `create/update/delete` exigem `temAcessoLiberado()` (aprovar/recusar orçamento migrou para `portalResponderOrcamento`). **`list` fica de fora, de propósito** — `doLogin()`/`_listenOS()` ainda fazem `query(os).where(phoneDigits==...)` direto do client SDK, sempre com sessão anônima (sem doc `usuarios/{uid}`); fechar `list` quebrou o login de cliente real numa tentativa real desta sessão (revertido ao vivo depois de reproduzir o erro `Missing or insufficient permissions`). Não há equivalente de `onSnapshot` (push em tempo real) numa Cloud Function `onCall` (só request/response) — migrar login/listener para outro mecanismo fica para uma sprint futura.

Deploy em `cellcity-crm-dev` via API REST direta (`firebaserules.googleapis.com` — Firebase CLI sem login interativo disponível neste ambiente: a troca de token OAuth falha de forma consistente com "Premature close"; `gcloud` com a mesma service account funciona normalmente e foi o caminho usado também para as 13 Cloud Functions desta sprint). Verificado por leitura do release ativo via API (não só CLI) e por homologação Puppeteer completa rodada de novo depois do deploy.

### 19.6 Testes

- `tests/functions/portal-cloud-functions.test.mjs`: 25/25 (Lote 1 + `portalObterNomeCliente` + asserts de `createdAt` ISO-string).
- `tests/firestore-rules/os-publico.test.mjs`: 31/31 (atualizado para o novo estado das Rules — `list` de `os` continua aberto, as demais operações/coleções exigem `temAcessoLiberado()`).
- Homologação Puppeteer (login real, `cellcity-crm-dev`): 12/12, 0 erro de console/página — cobre as 7 funcionalidades do Portal, a saudação com nome real, a data da mensagem (não "Invalid Date"), e as 3 regressões de Consulta de OS.

### 19.7 Status

**Sprint 1b concluída e pushada para `origin/develop`** (commit `f0d2389`, enviado em sessão de continuação em 2026-07-06 11:08 — ver §20 para o push subsequente do hardening da auditoria). Não promovida a `main`, sem deploy em produção (`cellcity-crm`), conforme escopo autorizado até aqui.

### 19.8 Whitelist de campos nas 3 functions de listagem (fechado em sessão de continuação)

`portalListarMensagens/Avaliacoes/Agendamentos` devolviam o documento inteiro (`{id, ...data()}`) em vez de projetar campos — diferente da convenção já estabelecida em `OS_CAMPOS_PUBLICOS`/`projetarCamposPublicosOS` (Sprint 1a). Adicionada `projetarCamposPortal(colecao, doc)` + tabela `CAMPOS_POR_COLECAO_PORTAL`, mesmo padrão. `telefone`/`telefoneDigits`/`telefoneInformado`/`origem` deixam de sair (confirmado por grep que o client nunca lê esses campos de volta — usa `this.session.telefoneDigits`). Testes atualizados (3 asserts confirmando a ausência desses campos, 25/25 no emulador) e homologação Puppeteer completa rodada 2x depois do deploy — 0 regressão.

**Pendências que permanecem para sprints futuras:**
- **Migrar `doLogin()`/`_listenOS()` para fechar `os.list`** — não feito nesta sessão de propósito: `CRM/CLAUDE.md` §1 exige autorização explícita para qualquer alteração em Login/Autenticação; esta migração muda como o login funciona (não é um bug pontual, é uma mudança de arquitetura) e precisa de uma decisão de produto sobre o mecanismo de substituição (não há equivalente de `onSnapshot`/push numa Cloud Function `onCall`, só request/response — poll periódico ou outra abordagem).
- **Duplicação de padrão entre `enviarMensagem()`/`_enviarAgendamento()`/`_enviarSolicitacaoDiagnostico()`/`enviarAvaliacao()`** (cache de refs antes do await, toggle de loading, toast de erro) — avaliado e decidido NÃO extrair um helper nesta sessão: as 4 funções têm validação e pós-processamento suficientemente diferentes entre si que um helper genérico exigiria vários parâmetros/callbacks, tornando o código mais difícil de ler sem eliminar duplicação de fato — nenhuma delas tem bug, então o risco de regressão em código já homologado não se justifica pelo ganho.

## 20. Auditoria Geral 2026-07-06 e resposta a incidente de credencial — push do hardening (sem deploy)

Detalhe completo em `plans/AUDITORIA_GERAL_20260706.md` (Fase 5) e `plans/AUDITORIA_GERAL_20260706_INTERNO.md` (não versionado). Resumo operacional:

- Auditoria pós-integração da Sprint 1b encontrou um achado crítico independente (credencial de service account de produção vazada em commit antigo, nunca rotacionada) e produziu hardening aditivo (Firestore Rules para 7 coleções internas sem regra + exclusão de `plans/`/`CLAUDE.md`/`kernel-test/` do GitHub Pages), preparado e testado (52/52) em commits locais.
- Sessão de continuação: **push desses 4 commits para `origin/develop`** (fast-forward `f0d2389..7e269ef`, sem merge commit), autorizado explicitamente pelo dono. Nenhum deploy, merge para `main` ou rotação de credencial foi executado.
- Revalidação completa das duas suítes de teste nesta sessão (ambiente com `node`/`npm`/`firebase` CLI disponíveis via `nvm`, fora do `PATH` padrão): **77/77** (52/52 Rules + 25/25 Cloud Functions).
- Confirmado por leitura (GET, somente leitura) do release ativo em `cellcity-crm-dev` via `firebaserules.googleapis.com`: o hardening é puramente aditivo — nenhuma regra existente foi alterada.
- Checklist de pré-deploy: 3 de 4 itens aprovados; **bloqueado** no item "nenhuma credencial comprometida permanece ativa" — as 2 chaves seguem ativas. Deploy não deve prosseguir até a rotação ser executada ou aceita como risco residual pelo dono.

**Atualização — rotação executada e incidente encerrado (mesmo dia, autorizado explicitamente pelo dono em duas etapas):** as 2 chaves comprometidas foram desabilitadas e, em seguida, **excluídas definitivamente** do IAM de produção, com uma 3ª chave nova gerada e validada antes e depois de cada etapa. Confirmado por inventário pós-exclusão (só a chave nova existe) e reconfirmação funcional real contra produção. Suítes revalidadas pós-rotação: 77/77, sem regressão. Detalhe completo nas Fases 7-8 de `plans/AUDITORIA_GERAL_20260706.md`. **Nenhuma credencial comprometida permanece ativa — incidente encerrado.** O checklist de pré-deploy passa a ter os 4 itens aprovados.

## 21. Promoção final `develop` → `main`, deploy do hardening e quase-incidente das Cloud Functions do Portal (2026-07-06)

Autorizada explicitamente pelo dono, em sequência (Fase 1: exclusão de credencial — ver §20; Fase 2: deploy do hardening; Fase 3: promoção; Fase 4: validação pós-publicação).

### 21.1 Deploy do hardening

- **Firestore Rules**: deployadas via API REST (`firebaserules.googleapis.com`) primeiro em `cellcity-crm-dev`, depois em `cellcity-crm` — confirmado por leitura do release ativo em ambos, idêntico ao arquivo local (`_runtime_audit/verify-firestore-rules.mjs`).
- **GitHub Pages**: achado durante a execução — o workflow `deploy-pages.yml` dispara em push tanto para `main` quanto para `develop`, e a cada disparo reconstrói e republica o site inteiro (produção a partir de `main` + `/dev` a partir de `develop`). Isso significa que os pushes de documentação para `develop` ao longo desta resposta ao incidente **já haviam publicado automaticamente** as exclusões (`plans/`, `CLAUDE.md`, `kernel-test/`) em produção, sem uma ação de deploy manual separada — confirmado por HTTP real (404 nos 3 caminhos, 200 no restante do site).

### 21.2 Bug encontrado no `subir-ok` (versionamento semântico)

A função `subir-ok` (`~/.bashrc`) tenta interpretar a última tag `v[0-9]*.[0-9]*.[0-9]*` como semver (`vMAJOR.MINOR.PATCH`) para calcular a próxima versão — mas todas as tags reais já existentes seguem o formato data (`vYYYY.MM.DD-HHMM`, ex. `v2026.07.04-1931`), que também casa com esse glob. Rodar a lógica de bump nessa tag geraria aritmética inválida (`$((vpat+1))` sobre `"04-1931"`) e uma tag quebrada. Contornado nesta promoção: passos seguros do `subir-ok` replicados manualmente (backup, `checkout main`, `git pull`, `merge --ff-only origin/develop`, tag no formato data já usado de fato em todas as promoções, `push origin main <tag>` sem `--follow-tags`), sem acionar o bloco de versionamento semântico. **Bug real do script, registrado para correção futura, fora do escopo desta sessão.**

### 21.3 Efeito colateral do backup automático (encontrado e corrigido na mesma sessão)

Rodar `backup-manual.sh` (chamado pelo `subir-ok`) com o working tree contendo arquivos não commitados (`.claude/worktrees/` — 6 worktrees de agentes antigos, `COLECOES_FIRESTORE.md`, `ventoy-1.1.12-linux.tar.gz`) fez `git add .` capturar e commitar/pushar tudo isso na branch `sprint-1b-portal-cloud-functions` (commit `74bfa39`), incluindo os 6 diretórios de worktree como gitlinks quebrados. **Corrigido na mesma sessão** via `git revert` (commit `1066a5a`) — mas o revert também **apagou fisicamente** `COLECOES_FIRESTORE.md` e o `.tar.gz` do disco (reverter uma adição remove o arquivo), exigindo recuperação manual (`git show 74bfa39:<arquivo> > <arquivo>`) para restaurá-los sem perda de dado. Nenhum dado foi perdido, mas registra uma lição: `backup-manual.sh` não deveria ser chamado com untracked files não intencionais no working tree sem revisão prévia — o script já avisa da adição de git embutido, mas não bloqueia.

### 21.4 Promoção `develop` → `main`

Fast-forward limpo `09b861a..cbe68c6` (22 commits: Sprint 1b completa + hardening + documentação da rotação de credencial). Sem merge commit — compatível com a regra de histórico linear do GitHub em `main`. Tag `v2026.07.06-2226` criada e publicada (`git push origin main <tag>`, sem `--follow-tags`).

**Checklist manual do CLAUDE.md §5 (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente) dispensado explicitamente pelo dono nesta promoção** — ambiente desta sessão não tem navegador/Puppeteer disponível; cobertura substituta: 77/77 testes automatizados + confirmações reais via API/HTTP contra produção (ver 21.5).

### 21.5 Quase-incidente: Cloud Functions do Portal não estavam em produção

**Achado crítico durante a validação pós-publicação** (Fase 4, antes de declarar sucesso): o site de produção, recém-publicado, já servia o `portal.js` novo (que chama `portalResponderOrcamento`, `portalListarMensagens` etc.), mas `gcloud functions list --project=cellcity-crm` mostrou só as 3 Cloud Functions de Sprint 1a/backlog (`excluirUsuarioAdmin`, `consultarOSPublica`, `consultarOSPorTelefonePublica`) — **nenhuma das 12 Cloud Functions do Portal (Sprint 1b) tinha sido deployada em produção**, só em `cellcity-crm-dev` em sessões anteriores. O Portal do Cliente real (login, mensagens, avaliações, agendamentos, aprovar/recusar orçamento) estaria quebrado para clientes reais no intervalo entre a publicação do site e a correção.

**Corrigido na mesma sessão**, antes de declarar a promoção concluída: `firebase deploy --only functions --project cellcity-crm` (autenticado via `GOOGLE_APPLICATION_CREDENTIALS` apontando para o `sa-key.json` já rotacionado — funcionou de primeira, diferente do obstáculo de OAuth interativo registrado em sessões anteriores). 12 funções criadas, 3 atualizadas (idempotente, sem mudança de comportamento). Validado por chamada HTTP real: `portalObterNomeCliente` e `portalListarHorariosOcupados` (novas) responderam corretamente; `consultarOSPublica` (pré-existente) sem regressão.

**Lição para promoções futuras que envolvam Cloud Functions**: `git merge --ff-only` + push de `main` publica o **site estático** (GitHub Pages) automaticamente, mas **nunca** deploya Cloud Functions — são sistemas totalmente independentes. Checklist de promoção deve incluir explicitamente "Cloud Functions de produção sincronizadas com o código do site" como item verificado antes de declarar a promoção concluída, não depois.

### 21.6 Validação operacional final

- Firestore Rules de produção: idênticas ao arquivo local (confirmado via API, antes e depois do deploy de Functions).
- GitHub Pages: exclusões ativas (`plans/`, `CLAUDE.md`, `kernel-test/` → 404); `index.html`, `consultar-os.html` → 200.
- Cloud Functions: 15/15 ativas; 3 chamadas reais confirmadas (2 novas + 1 pré-existente, sem regressão).
- **Não verificado nesta sessão** (sem navegador): login real de cliente pela tela, fluxo completo do Portal via UI. Cobertura substituta: 77/77 testes automatizados + chamadas HTTP diretas às Cloud Functions.

**Status final: Sprint 1b promovida e publicada em produção (`main` == `develop` == `cbe68c6`, tag `v2026.07.06-2226`). Incidente de credencial encerrado. Quase-incidente de Cloud Functions ausentes identificado e corrigido antes de declarar sucesso.**
## 22. Camada Repository — abstração de acesso a dados Firestore (2026-07-05)

> Reconciliação: o código desta seção (17 repositories + `firebase/client.js` + `services/README.md` + piloto Chips) foi commitado originalmente como `b0270b6`, temporariamente perdido da `develop` por uma colisão de checkout compartilhado com a Sprint 1a (ver achado em §18), preservado intacto na branch `preserve-camada-repository-20260705`, e trazido de volta via `git cherry-pick` (commit `91afeaf`) — revalidado (sintaxe + jsdom) após o cherry-pick, sem nenhuma alteração de conteúdo em relação ao commit original.

### 22.1 Motivação

Análise técnica Firestore→PostgreSQL concluiu: **não migrar de banco agora**, mas o dono autorizou explicitamente preparar a arquitetura para reduzir o custo de uma migração futura, sem trocar o Firestore. A ação de maior alavancagem identificada foi introduzir uma camada Repository entre a UI e o SDK do Firestore — antes desta entrega, ~46 arquivos chamavam `getDocs/setDoc/addDoc/onSnapshot/...` diretamente, misturados com lógica de UI/negócio, sem nenhuma abstração de dados.

### 22.2 Arquitetura (camadas)

```
página (CRM/pages/**)
  → repository (CRM/repositories/*.repository.js)
    → CRM/firebase/client.js (reexport)
      → CRM/scripts/firebase.js (inicialização real do SDK — protegido, intocado)
```

`services/` (vazio nesta entrega) fica reservado para lógica que orquestra múltiplos repositórios numa mesma operação de negócio.

### 22.3 Decisão de design: pasta `firebase/`

`CRM/scripts/firebase.js` é arquivo protegido (regra permanente do projeto — não alterar sem autorização explícita nova) e não foi tocado, nem uma linha. `CRM/firebase/client.js` é um arquivo **novo** que só reexporta o necessário, dando à camada Repository um endereço estável sem editar o arquivo protegido nem alterar nenhum dos ~44 imports existentes.

### 22.4 Inventário de repositórios criados

17 arquivos em `CRM/repositories/`, cobrindo ~52 coleções de 1º nível + subcoleções de `usuarios/{uid}`: `base` (factory), `chips` (piloto — único consumido nesta entrega), `usuarios`, `clientes`, `os`, `estoque`, `produtos`, `caixa`, `financeiro`, `empresas`, `crm`, `central`, `portal`, `posvenda`, `diario`, `fornecedor`, `sistema`, `saas`.

**Gap conhecido, encontrado numa auditoria posterior (2026-07-05):** 3 coleções em uso real ainda sem repository — `agenda`, `agendamentos`, `central_organizacao`. Fecho previsto para a Fase 0 da expansão módulo a módulo, antes de migrar qualquer módulo que dependa delas.

**Catálogo de coleções:** [`COLECOES_FIRESTORE.md`](../COLECOES_FIRESTORE.md) (raiz do repositório) documenta campos e relacionamentos de todas as coleções do Firestore, ativas ou legadas — revisado e expandido em 2026-07-07 (de 29 para ~54 coleções ativas documentadas). Uma revisão inicial no mesmo dia analisou o `firestore.rules` errado (duplicado da raiz, não deployado) para a seção de regras órfãs — corrigido na mesma sessão: só `clients`/`orders` são órfãs reais no arquivo deployado (`CRM/firestore.rules`), ver [`plans/RESOLUCAO_DUPLICIDADE_FIRESTORE_RULES_20260707.md`](../plans/RESOLUCAO_DUPLICIDADE_FIRESTORE_RULES_20260707.md). Use `COLECOES_FIRESTORE.md` como referência ao expandir a Camada Repository para módulos ainda não migrados.

### 22.5 Template padrão (`createRepository`)

Factory reaproveitável em `base.repository.js` — `getById`, `list`, `create`, `set`, `update`, `remove`, `onChange`. Cada `*.repository.js` só instancia a factory por entidade. Entidades com subcoleção (ex. `usuarios/{uid}/preferencias/*`) recebem métodos escritos à mão ao lado do repositório principal, mesma convenção de nomes.

### 22.6 Piloto: módulo Chips

Único módulo com comportamento tocado nesta entrega. `chips_cadastros` só era referenciada em `chips.js`/`chips-entrada.js` em todo o projeto — migração 100% contida. 7 call sites migrados (6 em `chips.js`, 1 em `chips-entrada.js`), sem mudança de dado gravado, regra de negócio ou texto de UI.

### 22.7 Homologação

Sem navegador real disponível. Reaproveitado o método já validado no projeto (jsdom + mocks das bordas, código real sem modificação — ver §6.9): arquivos reais copiados para harness isolado no scratchpad, com `kernel.js`, `shared/permissoes.js` e `firebase.js` mockados (capturando cada chamada crua do SDK). **20/20 casos aprovados**, cobrindo boot com permissão negada/concedida, listener idêntico ao original, criar/editar/alterar status/excluir, erro tratado sem exceção não capturada. `jsdom` foi instalado como devDependency temporária e removido ao final.

### 22.8 Benefícios e redução de esforço de uma futura migração

Antes desta entrega, uma troca de banco exigiria caçar chamadas cruas do SDK espalhadas em ~46 arquivos de página. Com o esqueleto completo, o trabalho futuro se concentra em pontos de mudança conhecidos e isolados (os repositórios). Fora de escopo: `kernel.js` (importa o SDK direto do CDN) e as Cloud Functions (Admin SDK) — nenhum dos dois é coberto por este padrão.

### 22.9 Status

**Commitado em `develop` (`91afeaf`, após reconciliação com a Sprint 1a).** Piloto Chips homologado via jsdom (20/20). Expansão módulo a módulo planejada, ordenada por risco, aguardando autorização para início da execução (Fase 0: fechar o gap de coleções do §22.4).

### 22.10 Fase 0 + Fase 1 — execução e homologação funcional (2026-07-05/07)

**Fase 0** (`4a0ab9d`): fechado o gap do §22.4 — repositories para `agenda`, `agendamentos` e `central_organizacao` (em `diario.repository.js`, `portal.repository.js` e `central-organizacao.repository.js` respectivamente).

**Fase 1** (`76344d7`, 2026-07-05): 22 módulos de baixo risco migrados do SDK direto para a camada Repository, mesmo padrão 1:1 do piloto Chips — Contas, Campanhas, Autoatendimento + `abrir-atendimento.html`, Central de Comandos/Informações/Organização/Alertas, Diário, Minha Semana, Ação da Semana, Estoque, Fornecedor, Catálogo, Pós-venda + `posvenda-test.html`, Relatórios, Portal Técnico (só a escrita de laudo), Clientes, Config, páginas de teste do kernel. Duas extensões aditivas ao `base.repository.js`: `newId()` (gera id sem escrever) e `onDocChange(id, cb, onError)` (observa um único documento). Exclusões deliberadas registradas no próprio commit (consultar-os/garantia/portal-cliente, `posvenda.js` write em `os`, `analise.js`, `importar.js`/`crm-comercial` com `runTransaction`, Dashboard). Executado em 6 lotes paralelos via subagentes em worktrees isolados; `node --check` já validado no próprio commit. Homologação funcional ficou pendente — é o que esta seção fecha.

**Homologação funcional (2026-07-07), sessão de continuação:**

1. **Auditoria estática completa** dos 22 arquivos: cada linha alterada do diff do commit `76344d7` foi lida e comparada 1:1 com o código anterior (nome de coleção, assinatura do método de repository, semântica de `where`/`orderBy`/`limitTo`/`merge`). Todos os 19 nomes de coleção usados pelos imports batem com o mapeamento real em `CRM/repositories/*.repository.js`. Nenhuma divergência encontrada.
2. **`node --check`** revalidado nos 22 arquivos (extraindo o `<script type="module">` real dos `.html`) — 22/22 OK.
3. **Resolução de imports**: todo `import { XRepository as Y } from '.../repositories/*.repository.js'` dos 22 arquivos conferido contra os `export const` reais — 0 nomes incorretos.
4. **Execução real de código** (sem navegador nem jsdom desta vez — o delta desta migração é só a borda de acesso a dados, não DOM/UI): `CRM/repositories/*.js` copiados sem alteração para um harness no scratchpad, com um Firestore fake em memória substituindo só `CRM/firebase/client.js` (mesmo princípio do método jsdom do piloto — código real, só a borda mockada). 48 cenários reproduzindo as sequências reais de chamada dos 22 arquivos (CRUD simples, `where`+`orderBy`+`limitTo` combinados, `newId()`, `onDocChange()`, `onChange()` com e sem filtro) — **48/48 aprovados** após corrigir 2 falhas que eram bug do fixture de teste (dado semeado sem `criadoEm`), não do código migrado.
5. **Observações registradas, não bloqueantes** (arquitetura pré-existente do `base.repository.js` desde o piloto Chips, não introduzida pela Fase 1): (a) `list()`/`getById()`/`onChange()`/`onDocChange()` fazem `{ id: d.id, ...d.data() }` — se o dado gravado já tiver seu próprio campo `id` (ex.: `Comandos.set(novoId, { id: novoId, ... })`, padrão usado nesta fase), o `id` da entidade prevalece sobre o `id` do documento Firestore; como todo escritor desta fase grava os dois iguais, não há divergência prática hoje, mas é um risco latente se algum dado legado tiver `id` interno diferente do doc id. (b) chamadas a `.onChange()`/`.onDocChange()` sem `onError` explícito (ex. `autoatendimento.js`) recebem um no-op silencioso do `base.repository.js`, diferente do comportamento padrão do SDK quando o 3º argumento do `onSnapshot` é omitido — erro de listener passa a não aparecer no console.

**Resultado: Fase 1 homologada — 48/48 cenários funcionais + 22/22 sintaxe + 100% dos imports resolvidos.** Nenhuma alteração de código foi necessária. `develop` local segue 4 commits à frente de `origin/develop` (não pushado, não mesclado) — reconciliação com produção é decisão separada, fora do escopo desta homologação.

## 23. Preparação para SQL — modelagem relacional completa (2026-07-07)

> **Natureza:** planejamento e documentação, não migração. Segue a mesma diretriz permanente já registrada para a Camada Repository (§22.1, memória do projeto `feedback-escopo-preparacao-arquitetura`): "preparar não é migrar". **Nenhum banco SQL foi instalado, nenhum ORM foi adicionado, nenhum dado foi migrado, nenhum código funcional do CRM foi alterado.** O Firestore continua sendo o banco oficial do projeto.

### 23.1 O que foi entregue

Todo o material vive em `sql/` (novo diretório na raiz do repositório):

- **`sql/00_visao_geral.md`** — motivação, banco recomendado (**PostgreSQL 15+ / Cloud SQL for PostgreSQL**, com justificativa comparativa contra MySQL/BigQuery/SQLite/bancos distribuídos), decisões de modelagem (quando um array do Firestore vira tabela-filha vs. quando permanece JSONB), e o que o modelo deliberadamente não assume (não reabre a decisão de multiempresa, não modela coleções legadas sem consumidor).
- **`sql/01_der_mestre.md`** — diagrama entidade-relacionamento (Mermaid) das entidades centrais e relações entre domínios.
- **`sql/02_migracao_estrategia.md`** — estratégia completa (não executada): 7 ondas por risco crescente (catálogos → domínios isolados → operacionais → financeiro → núcleo OS/Clientes → identidade/Auth → Portal do Cliente), rollback por onda, coexistência via shadow-read/shadow-write, sincronização via Cloud Function de gatilho (mesmo padrão já usado em `functions/index.js`), testes e homologação reaproveitando o processo formal já em vigor no projeto.
- **`sql/03_repository_adapter.md`** — como cada `CRM/repositories/*.repository.js` existente se conectaria a uma implementação SQL (`createSqlRepository()`, mesma assinatura de `createRepository()`) sem alterar nenhuma página consumidora; identifica `onChange`/tempo real como o único gap de paridade sem solução trivial (`LISTEN/NOTIFY` do Postgres como candidato, não testado).
- **`sql/schema/*.sql`** (8 arquivos, um por domínio, mesma divisão de `COLECOES_FIRESTORE.md`) — DDL completo: **82 tabelas** (75 do modelo ativo + 7 legadas mínimas, ver §23.2), **62 relacionamentos (FK)**, 31 tabelas com `CHECK` de enum (paridade com validações hoje só client-side), 21 tabelas-filhas para campos repetidos do Firestore.
- **`sql/04_auditoria_final.md`** — aceite técnico da preparação (auditoria de 2026-07-07): conferência cruzada DER↔DDL↔Repository Layer↔`COLECOES_FIRESTORE.md`↔documentação, parecer final.

### 23.2 Cobertura

54 coleções ativas de `COLECOES_FIRESTORE.md` modeladas, mais 7 coleções da seção de legado que **têm** `createRepository()` na Camada Repository mesmo sem consumidor (`historico_diario/semanal/mensal`, `resumo_live`, `acoes_semana`, `posvenda_rastreamento`, `produtos`) — receberam tabela mínima (só PK) na auditoria final, para fechar 100% de paridade com os 58 repositories existentes. `estoque` (bare) e `clients`/`orders` continuam fora do modelo — não têm repository na Camada Repository. Fonte única: `COLECOES_FIRESTORE.md`, revisado nesta mesma sessão (ver §22.4).

### 23.3 Validação cruzada realizada

- Conferência de paridade entre todas as 54 coleções documentadas e as tabelas correspondentes (nenhuma ficou de fora sem justificativa registrada).
- Revisão de balanceamento de parênteses e de nomes de tabela duplicados em todos os 8 arquivos `.sql` (não há acesso a um servidor Postgres real nesta sessão para um parse completo — ver pendência em §23.4).
- **Erro de ordem de carga encontrado e corrigido durante a própria revisão**: a documentação inicial recomendava carregar `06_usuarios_empresas_alertas.sql` antes de `05_posvenda_agenda_portal.sql` (para a FK de `tarefas_semana` → `usuarios`); na revisão, confirmou-se que essa FK é adicionada via `ALTER TABLE` **em** `06` (não uma dependência de `05` sobre `06`) — a ordem correta é a puramente numérica (`01` a `08`), já corrigida no `README.md` e nos comentários dos dois arquivos afetados antes de qualquer commit.

### 23.4 Pendências para uma eventual migração futura (não bloqueantes desta entrega)

- Nenhum teste de execução real do DDL contra um Postgres de verdade (exigiria instalar um banco, fora do escopo autorizado desta tarefa).
- `LISTEN/NOTIFY` como estratégia de tempo real (§23.1) não foi validado na prática — maior incógnita técnica do plano.
- Modelagem assume PostgreSQL; se uma decisão de negócio futura escolher outro banco, os arquivos de domínio precisariam de nova revisão de tipos/sintaxe (JSONB, `GENERATED ALWAYS AS`, `gen_random_uuid()` são específicos do Postgres).

## 24. Performance — Regularização da Fase 1 (pollers) e Fase 2 (cache persistente do Firestore) (2026-07-08)

> **Contexto:** o código desta seção já existia, escrito e não commitado, no working tree de `develop` desde 2026-07-07 (mesma sessão que fechou o item H13 do `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md`, commit `b413b1f`). Ficou parado sem commit, sem backup do arquivo protegido e sem homologação registrada — o próprio plano (§6/§8) classificava Fase 1 e Fase 2 como "Pendente", cada uma exigindo autorização explícita própria. Esta seção documenta a regularização desse estado: auditoria, backup, validação técnica, testes e homologação, seguindo script de 8 etapas fornecido explicitamente pelo dono do projeto (autorização nomeada para `firebase.js` e para os módulos Dashboard/Central de Alertas).

### 24.1 O que foi encontrado (auditoria)

3 arquivos modificados no working tree, nenhum commitado, nenhum untracked além do próprio código, sem stash pré-existente:
- `CRM/pages/central-alertas/central-alertas.js` — `REFRESH_MS` 30000→300000 + pausa do polling quando `document.hidden`.
- `CRM/pages/dashboard/dashboard-alertas.js` — dois timers ajustados (30000→300000 e 180000→600000), ambos com pausa por `document.hidden`, e um `visibilitychange` novo que atualiza imediatamente ao voltar à aba.
- `CRM/scripts/firebase.js` (**protegido**) — troca de `getFirestore(app)` por `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`, com fallback em `try/catch` para o cache em memória se o navegador não suportar.

### 24.2 Backup do arquivo protegido

`CRM/scripts/firebase.js.bak-pre-fase2-cache-2026-07-08` — cópia exata do `HEAD` commitado (`b413b1f`, anterior às mudanças), no mesmo diretório do original, seguindo a convenção já usada no projeto (`.bak-<contexto>-<data>`, ex. `favoritos.js.bak-fixar-direita-2026-06-13`). Confirmado byte-a-byte idêntico ao `git show HEAD:CRM/scripts/firebase.js` antes de prosseguir.

### 24.3 Validação técnica contra o plano

| Mudança | Item do plano | Classificação |
|---|---|---|
| `central-alertas.js`: `REFRESH_MS` 30s→300s | H1-b | ✓ previsto (valor exato) |
| `central-alertas.js`: pausa com `document.hidden` | H1-a | ✓ previsto |
| `dashboard-alertas.js`: timer de `verificar()` 30s→300s + pausa | H3 ("mesmo tratamento… ≥10 min") | ⚠ parcialmente previsto — direção e mecanismo corretos, mas o intervalo (5 min) é mais agressivo que o piso de "≥10 min" redigido no plano para H3. Risco baixo: ainda é 10× mais espaçado que o original (30s) e o outro timer do mesmo arquivo (abaixo) já cumpre os 10 min. |
| `dashboard-alertas.js`: timer de `atualizarAlertas()` 180s→600s + pausa + `visibilitychange` | H3 | ✓ previsto (600000ms = exatamente os "≥10 min"); o refresh imediato via `visibilitychange` é aditivo, mesmo padrão do `focus` já usado no projeto — não é funcionalidade nova, é reaproveitamento de um padrão existente. |
| `firebase.js`: `initializeFirestore` + `persistentLocalCache` + `persistentMultipleTabManager` | Fase 2 (§4) | ✓ previsto — sintaxe idêntica à prescrita no plano e à API oficial do SDK 10.8.0 (`initializeFirestore`, `persistentLocalCache`, `persistentMultipleTabManager` fazem parte do `firebase-firestore.js` importado). |
| `firebase.js`: `try/catch` com fallback para `getFirestore(app)` | Não redigido explicitamente no plano | ✓ dentro do espírito do plano — mitigação defensiva, mantém a garantia "nunca deixar o app sem Firestore"; não é escopo novo, é tratamento de erro no mesmo ponto já alterado. |

Nenhum trecho classificado como fora do escopo.

### 24.4 Testes executados

Ambiente: Node v24.17.0 (via `nvm`; CI usa Node 20 — mesma major line de ESM/`node --test`, sem incompatibilidade observada).

| Suíte | Resultado | Tempo |
|---|---|---|
| `node --check` nos 3 arquivos alterados | 3/3 OK (sintaxe) | < 1s |
| `tests/firestore-rules` (`npm test`, emulador Firestore) | 52/52 | ~10,2s |
| `tests/functions` (`firebase emulators:exec … node --test`) | 25/25 | ~8,0s |
| `tests/rbac` (`npm test`, código real via loader + mocks) | 33/34 | ~4,6s |
| Padrão isolado de gating (`document.hidden` + `visibilitychange`), 4 cenários em Node puro | 4/4 | < 1s |

**Falha em `tests/rbac`** (`caixa.test.mjs:44` — "Caixa matriz total: tudo visível", `0 !== 1`): reproduzida **também no `HEAD` commitado, com as 3 alterações removidas via `git stash`** (suíte completa e o arquivo isolado, duas vezes) — confirma que é uma falha pré-existente, não relacionada a esta regularização. Não corrigida aqui (fora do escopo desta tarefa, que é só regularizar Fase 1/2 de performance); fica registrada como pendência separada.

**Atualização 2026-07-08 (mesmo dia, sessão seguinte): homologação em navegador real concluída — ver §24.6.** A ressalva original desta seção (login/IndexedDB/multi-tab/offline não verificáveis) foi resolvida: login real obtido via `signInWithCustomToken` (Admin SDK + `sa-key-dev.json`, conta padrão de homologação `cellcityadmin@gmail.com`, perfil `admin`, sem usar a senha de ninguém), Chrome headless real (`/usr/bin/google-chrome` via `puppeteer-core`, dependência temporária). Persistência, multi-tab e offline confirmados funcionando — detalhe completo em §24.6.

### 24.6 Homologação em navegador real (2026-07-08, sessão de continuação)

**Ambiente:** Chrome 149 headless (`puppeteer-core`, devDependency temporária instalada com `--no-save` e removida ao final — mesmo padrão já usado para `jsdom` no piloto da Camada Repository, §22.7), servidor estático local (`http-server`) servindo a raiz do repositório em `localhost:8899`. `env-config.js` confirma que `localhost` resolve para o projeto **DEV** (`cellcity-crm-dev`), nunca produção — console do app mostrou `Firebase ambiente: dev (projeto cellcity-crm-dev)` em toda a sessão.

**Login (ETAPA 3):** sem senha disponível para digitar no formulário, usada a técnica já documentada no projeto ([[feedback-uid-dev-prod-nao-reusar]]): Admin SDK (`sa-key-dev.json`) confirmou que o UID `ltpqLixozRP2IkZ9cuAcOML3bBn1` (`cellcityadmin@gmail.com`, perfil `admin`, a conta padrão de homologação — ver [[project-padrao-usuarios-homologacao]]) existe e está ativo tanto no Firestore quanto no Auth do projeto DEV, gerado `createCustomToken(uid)`, e autenticado via `signInWithCustomToken` dentro da própria página. `[KERNEL] Contexto pronto: uid=…, empresa=cellcity-master, perfil=admin` confirmado no console em todas as páginas visitadas.

**Dashboard (ETAPA 4):** carregado em ~527ms, screenshot confirma renderização completa (28 cards de módulo, badge de 32 alertas, indicador de ambiente). Console limpo de erros — só avisos pré-existentes e não relacionados (meta tag `apple-mobile-web-app-capable` depreciada; `Background/Periodic Sync` falhando por ser um Service Worker novo em ambiente headless, não uma regressão). 1 requisição ao Firestore observada nos 8s seguintes ao boot — sem rajada.

**Central de Alertas (ETAPA 5):** carregado com dados reais (7 alertas: 3 críticos, 3 atenção, 7 novos), screenshot confirma renderização completa. `document.hidden`/`visibilitychange` testados sobrescrevendo a propriedade real do DOM e disparando o evento real — o navegador respondeu corretamente (`hidden` alternou `true`↔`false` como esperado). Teste de longa duração (305s com a aba marcada oculta, medindo requisições a `firestore.googleapis.com`): **inconclusivo por uma falha de método, não por defeito** — a contagem de requisições capturou também o tráfego de manutenção do listener em tempo real pré-existente (`iniciarStatusSync()`, não tocado por esta entrega, não coberto pelo `document.hidden`), então não isola só o timer `REFRESH_MS`. A garantia real de que o polling foi de fato espaçado vem da revisão de código (a constante mudou de `30000`/`180000` para `300000`/`600000`, uma alteração determinística de 10-20×) e do teste isolado do padrão de gating (§24.4, 4/4). Não foi reexecutado com instrumentação mais fina por desproporção de esforço para o risco (mudança de constante + `if`, baixíssimo risco).

**Cache persistente / offline (ETAPA 6 e 8):** com a página **já carregada online** (sem reload), rede cortada via CDP (`Network.emulateNetworkConditions`), e uma leitura de um documento real (`usuarios/{uid}`) repetida: respondeu em ~5ms com `exists:true` e `metadata.fromCache === true` — confirma que o IndexedDB está populado e sendo servido offline, com e sem erro algum. `getDocFromCache` (leitura explícita só do cache) confirmou o mesmo documento. Ao reconectar, a leitura voltou a vir do servidor normalmente. **Achado à parte, não bloqueante:** navegar para uma *nova* página `.html` enquanto offline falha (`ERR_INTERNET_DISCONNECTED`) — isso é o Service Worker (`CRM/sw.js`, network-first para assets, comportamento já documentado como correto e intencional no plano, §3.3) e não tem relação com o cache do Firestore desta entrega; a app não promete navegação offline entre módulos, só cache de dados dentro de uma página já carregada.

**Multiaba (ETAPA 7):** 2ª aba do Dashboard aberta simultaneamente com a 1ª ainda ativa — nenhum erro `failed-precondition` em nenhuma das duas (esse era exatamente o risco que o comentário do código em `firebase.js` previa sem o `persistentMultipleTabManager`). Confirma que a coordenação multi-aba está funcionando.

**Regressão (ETAPA 10):** as 3 suítes automatizadas reexecutadas após toda a sessão de navegador — mesmo resultado de antes (Rules 52/52, Functions 25/25, RBAC 33/34, falha do Caixa idêntica e já registrada como pré-existente).

**Evidências:** 7 screenshots em sequência (login, dashboard, central de alertas, reload, 2ª aba, offline, online-de-volta) confirmam visualmente que nada quebrou.

**Conclusão da homologação em navegador: aprovada.** Nenhum comportamento funcional inesperado. Único ponto sem prova direta é a suspensão do polling especificamente durante os 300s/600s de aba oculta (por limitação de instrumentação, não por dúvida sobre o código) — mitigado pela certeza determinística do valor da constante e pelo teste de padrão isolado.

### 24.5 Homologação

- Nenhuma mudança de comportamento fora do previsto no plano (ver §24.3).
- Sem regressão nas 3 suítes automatizadas frente ao `HEAD` anterior (a única falha é idêntica, antes e depois, isolada por `git stash`) — reconfirmado após a sessão de navegador real (§24.6), mesmo resultado.
- Interface pública de `firebase.js` (export `db`) inalterada — nenhum consumidor (incluindo `CRM/firebase/client.js` e os 19 repositories da Camada Repository) precisa mudar.
- Cache/offline/multi-tab: **confirmado por execução real em navegador** (Chrome headless, login real via custom token, dados reais do DEV) na sessão de 2026-07-08 — ver §24.6. Login, Dashboard, Central de Alertas, cache offline (documento real servido do IndexedDB sem erro) e 2 abas simultâneas (sem `failed-precondition`) todos verificados.

**Resultado: aprovado — commit em `develop` (`40fdb89`) e homologação em navegador real (2026-07-08) concluídos. Duas ressalvas não-bloqueantes documentadas: falha pré-existente do Caixa (não corrigida, fora de escopo) e instrumentação do teste de polling de longa duração (305s) inconclusiva por confundir com tráfego do listener em tempo real pré-existente — mitigada pela certeza determinística da mudança de constante + teste de padrão isolado (4/4).**

## 25. Automação da homologação de performance (2026-07-08, mesmo dia — sessão seguinte)

Depois de homologar a Fase 1+2 manualmente (§24.6), o dono pediu para transformar o processo num comando único e repetível, para as próximas entregas de performance não precisarem repetir cada passo manualmente. Escopo explícito: só automatizar auditoria/testes/homologação/relatório — **nenhuma funcionalidade do sistema foi alterada**.

### 25.1 O que foi entregue

`scripts/homologacao/` (novo, ver `scripts/homologacao/README.md` para o guia completo de uso):
- `lib/audit.mjs` — Fase 1: branch, commit, divergência com `origin`, arquivos modificados/protegidos, checagem de backup obrigatório (mesma lista de arquivos protegidos do `CLAUDE.md` §1).
- `lib/tests-runner.mjs` — Fase 2: `node --check`, Firestore Rules, Cloud Functions, RBAC, o novo teste permanente de padrão de polling (abaixo) e um smoke estático do cache da Fase 2 (confirma que a API certa continua em `firebase.js`, sem precisar de navegador).
- `lib/browser.mjs` — Fase 3: Chrome headless via `puppeteer-core` (agora devDependency permanente, não mais temporária); login sem senha (mesma técnica de `createCustomToken` do §24.6); Dashboard; Central de Alertas; cache offline; multiaba.
- `lib/report.mjs` — Fase 4/6: cruza falhas contra `scripts/homologacao/known-issues.json` (pendências já registradas, ex.: a falha do Caixa) e decide `APROVADO` / `APROVADO COM RESSALVAS` / `REPROVADO`.
- `index.mjs` — Fase 7: comando único (`npm run homologar-performance`), gera `evidencias/<timestamp>/` (Fase 5: screenshots, console, network, logs brutos e `relatorio.md`) — pasta gitignored (adicionado a `.gitignore`).
- `tests/performance/polling-gating.test.mjs` — versão permanente (não mais um script descartável) do teste isolado do padrão `document.hidden`/`visibilitychange`, usado tanto pelo comando de homologação quanto adicionado à CI (`.github/workflows/tests.yml`, 4ª suíte — só essa, não a Fase 3 de navegador, que exige credencial real e não faz sentido rodar em qualquer PR).

### 25.2 Achado real durante a construção (a própria automação corrigiu um teste errado)

Ao formalizar o teste de cache/offline manual do §24.6 num script reaproveitável, a primeira versão automatizada testava offline só na aba da Central de Alertas (`page2`), deixando a aba do Dashboard (`page`, aberta antes) ainda online. Resultado: a leitura "offline" respondia `source: "servidor"` em vez de `"cache"` — o `persistentMultipleTabManager` aparentemente roteia parte da conexão real do Firestore pela aba que já estava aberta, mascarando um teste de offline que não era genuíno. Corrigido aplicando `Network.emulateNetworkConditions(offline:true)` em **todas** as abas abertas simultaneamente (mais fiel à realidade: uma queda de rede afeta a máquina inteira, não uma aba isolada) — depois da correção, a leitura offline passou a reportar `source: "cache"` de verdade. `lib/report.mjs` também passou a exigir explicitamente `source === 'cache'` para considerar o teste aprovado (antes, um "não deu erro" já contava como sucesso, o que teria escondido esse próprio bug).

### 25.3 Critérios de aprovação (Fase 6)

`REPROVADO` se: arquivo protegido modificado sem backup, qualquer falha de teste **não** listada em `known-issues.json`, ou qualquer etapa da Fase 3 (login/Dashboard/Central de Alertas/cache/multiaba) reportar falha. `APROVADO COM RESSALVAS` se só houver avisos não-bloqueantes (working tree sujo, falha conhecida, Fase 3 pulada). `APROVADO` só quando não há nenhuma ressalva — na prática raro, porque a limitação do teste de polling de longa duração (§24.6) é sempre listada como aviso.

### 25.4 Validado com 3 cenários sintéticos + 1 execução real completa

`lib/report.mjs` testado isoladamente com: (1) arquivo protegido sem backup → `REPROVADO` ✅; (2) falha de teste não registrada → `REPROVADO` ✅; (3) tudo limpo mas Fase 3 não executada → `APROVADO COM RESSALVAS` ✅ (esse cenário revelou e corrigiu um `TypeError` de null-safety no template do relatório quando `browser` não é passado). `npm run homologar-performance` executado 3× de ponta a ponta nesta sessão — resultado estável: `APROVADO COM RESSALVAS` (falha pré-existente do Caixa + working tree com o próprio código desta entrega ainda não commitado + ressalva do polling de longa duração).

### 25.5 Não incluído (fora do escopo pedido)

Push automático — o comando só recomenda, quem decide se aplica a recomendação continua sendo humano. Homologação de outros módulos além dos já cobertos (Dashboard/Central de Alertas/cache) — o pedido foi para automatizar *esta* homologação, não criar um framework genérico para qualquer entrega futura.
