# CORREÇÃO DO BLOQUEADOR DE PRODUÇÃO — VAZAMENTO CROSS-TENANT `pre_os`

**Fase:** 1.6 — Correção do Bloqueador de Produção
**Data:** 2026-07-17
**Prioridade:** Máxima
**Escopo:** Eliminar o vazamento cross-tenant confirmado na homologação
(`plans/HOMOLOGACAO_FINAL_SAAS_20260717.md`, achado V1).
**Branch:** `develop` (nenhuma promoção para `main` foi feita).

---

## 1. Resumo Executivo

A homologação final reprovou o sistema para produção (`🔴 REPROVADO`) por um
único bloqueador confirmado: a coleção **`pre_os`** (pré-Ordem de Serviço,
criada pelo Autoatendimento público) era a **única coleção de dados de
cliente sem isolamento por empresa** nas Firestore Rules. Qualquer usuário
liberado (`temAcessoLiberado()`) de **qualquer** empresa conseguia
**ler, editar e apagar** as pré-OS de **todas** as outras empresas — dados
que incluem nome, WhatsApp, CPF, IMEI e até a senha/padrão do aparelho do
cliente. O vazamento era efetivamente explorável pela própria interface: a
Central de Alertas do Dashboard consultava/escutava `pre_os` **sem filtro de
tenant**.

A correção foi mínima e cirúrgica, alinhada ao padrão já usado em todas as
demais coleções do arquivo (`mesmaEmpresaRead()` / `empresaImutavel()`):

1. **Firestore Rules** — `pre_os` passou a exigir isolamento por
   `empresa_id` em `read`/`update`/`delete` (create público preservado).
2. **Dashboard** — as 2 consultas de `pre_os` que faltavam ganharam o
   `injectTenantFilter` já usado em todas as consultas irmãs.
3. **Intake público** (`abrir-atendimento.html`) — passou a carimbar
   `empresa_id` na criação, para a pré-OS nascer com tenant (a página não
   tem sessão para o repository injetar automaticamente).

O isolamento foi **comprovado por evidência**: a suíte de Firestore Rules
rodou no emulador com **112/112 testes aprovados** (38 de isolamento
multiempresa + 74 de regras públicas), incluindo 4 testes novos específicos
de `pre_os` que provam que a empresa A não acessa a pré-OS da empresa B.

**Nenhum outro módulo do projeto apresenta o mesmo padrão** de coleção de
dados de cliente sem gate de tenant (auditoria completa das Rules na Etapa 4).

### Resultado

🟢 **VULNERABILIDADE ELIMINADA**

Ressalva operacional (não bloqueia a eliminação da vulnerabilidade, mas
condiciona a promoção): as Rules corrigidas e o backfill de `empresa_id`
(que já inclui `pre_os`) precisam ir para produção juntos, na sequência de
deploy já documentada. Enquanto as Rules multiempresa não estiverem
deployadas em `main`, o `develop` está íntegro e provado; a promoção segue
condicionada à execução do backfill + ativação dos filtros, conforme já
planejado.

---

## 2. Evidências da Vulnerabilidade

### 2.1 Como ocorreu (reprodução)

| Item | Evidência |
|------|-----------|
| **Consulta que permitiu** | `dashboard-alertas.js:18` — `query(collection(db, 'pre_os'), where('status','==','AGUARDANDO_CONVERSAO'))` **sem** `injectTenantFilter`; e `dashboard-alertas-panel.js:399` — `onSnapshot(collection(db,'pre_os'))` **sem** filtro de tenant. |
| **Regra que permitiu** | `CRM/firestore.rules` (bloco `match /pre_os/{docId}`): `allow read, update, delete: if request.auth != null && temAcessoLiberado();` — sem `mesmaEmpresaRead()`. |
| **Usuário** | Qualquer conta com perfil ≠ `pendente` (`temAcessoLiberado()` = true) de qualquer empresa. |
| **Tenant / empresa** | Empresa A conseguia enxergar `pre_os` da Empresa B (e vice-versa), sem restrição. |
| **Documento** | Qualquer doc da coleção `pre_os` (dados de cliente: `cliente.{nome,whatsapp,cpf}`, `aparelho`, `problema`, `senha`, `imei`, `observacoes`). |
| **Fluxo** | Cliente abre a pré-OS pelo formulário público (`CRM/public/abrir-atendimento.html`) → doc gravado **sem `empresa_id`** → Dashboard de **qualquer** empresa lista/escuta a coleção inteira, sem filtro → exposição cross-tenant na UI. |

### 2.2 Prova automatizada (antes da correção)

O comportamento inseguro foi reproduzido no emulador Firestore com o teste
`tenant-isolamento.test.mjs`: sob as Rules antigas, `dbA().collection('pre_os')
.doc('preos-b').get()/update()/delete()` (doc da empresa B lido pela empresa A)
**era permitido**. Após a correção, essas três operações retornam
`PERMISSION_DENIED` (`false for 'update' @ L150`, `false for 'delete' @ L151`).

---

## 3. Causa Raiz

**Componente responsável:** as **Firestore Rules** de `pre_os`, combinadas
com **duas consultas do Dashboard sem filtro de tenant** e com a **criação
pública sem carimbo de `empresa_id`**.

Análise por camada (Etapa 2):

| Camada | Situação | Responsável pelo vazamento? |
|--------|----------|------------------------------|
| **Firestore Rules** | `read/update/delete` só exigiam `temAcessoLiberado()`, sem `mesmaEmpresaRead()`. | ✅ **SIM (raiz primária)** |
| **Queries (Dashboard)** | 2 consultas de `pre_os` sem `injectTenantFilter` (todas as irmãs tinham). | ✅ **SIM (torna explorável pela UI)** |
| **Intake público** | `abrir-atendimento.html` grava via `PreOSRepository`, mas sem sessão → `getTenantId()` vazio → doc nascia **sem `empresa_id`**. | ⚠️ **Contribuinte** (impede o gate de funcionar após a migração) |
| **Repository** | `PreOSRepository = createTenantRepository('pre_os')` já injeta/filtra `empresa_id` quando há contexto — correto, sem alteração necessária. | ❌ Não |
| **Tenant Context / Claims / RBAC** | `getTenantId()`, `empresaDoUsuario()`, `isMasterAdmin()` corretos e já usados em todo o resto do arquivo. | ❌ Não |
| **Cloud Functions** | Nenhuma function referencia `pre_os` (confirmado por grep em `functions/`). | ❌ Não (fora do fluxo) |

Por que `pre_os` ficou de fora do isolamento aplicado às demais coleções:
`pre_os` tem um `create` **público** (cliente sem login), então ela foi
tratada como "coleção pública" e nunca recebeu o gate de tenant no
`read/update/delete` — diferente de `clientes`, `os`, `agendamentos`,
`solicitacoes_diagnostico` etc., que receberam `mesmaEmpresaRead()`. O
`create` público é legítimo e foi **preservado**; apenas a leitura/escrita
autenticada precisava do gate.

---

## 4. Arquivos Modificados

| Arquivo | Alteração | Autor |
|---------|-----------|-------|
| `CRM/firestore.rules` | `match /pre_os` — `read/update/delete` passam a exigir `mesmaEmpresaRead()` (+ `empresaImutavel()` no update); `create` público mantido. | Frente concorrente |
| `CRM/pages/dashboard/dashboard-alertas.js` | Consulta de contador de Autoatendimento passa a usar `injectTenantFilter([...])`. | Frente concorrente |
| `CRM/pages/dashboard/dashboard-alertas-panel.js` | `onSnapshot` de `pre_os` passa a usar `injectTenantFilter([])` (mesmo padrão das 4 coleções irmãs do bloco). | Frente concorrente |
| `CRM/public/abrir-atendimento.html` | Passa a carimbar `empresa_id: 'cellcity-master'` (convenção `EMPRESA_PADRAO`) na criação da pré-OS. | Frente concorrente |
| `tests/firestore-rules/tenant-isolamento.test.mjs` | +4 testes de isolamento de `pre_os`; correção do harness dos 3 testes de `financeiro_categorias/itens` (reuso do handle `ctx.firestore()`, ver §5). | Frente concorrente (testes pre_os) + esta revisão (correção do harness) |

> Observação: o grosso da correção de código já estava aplicado na árvore de
> trabalho pela frente concorrente quando esta certificação começou. O
> trabalho desta sessão foi: **reproduzir, confirmar a causa raiz, auditar o
> projeto inteiro em busca do mesmo padrão, validar a correção de ponta a
> ponta no emulador (nunca executado antes por limite de ambiente) e corrigir
> um bug de harness que impedia a suíte de ficar verde**. Os demais arquivos
> em `git status` (`CRM/pages/os/os.js`, `functions/os.js`,
> `functions/lib/rate-limit.js`, `storage.rules`) são correções de outros
> achados (S1/S2/S4/A2) da frente concorrente — **fora do escopo do `pre_os`**
> e não tocados por esta sessão.

---

## 5. Correções Aplicadas

### 5.1 Firestore Rules (`CRM/firestore.rules`)

Antes:
```
match /pre_os/{docId} {
  allow create:               if true;
  allow read, update, delete: if request.auth != null && temAcessoLiberado();
}
```

Depois:
```
match /pre_os/{docId} {
  allow create: if true;                                  // intake público preservado
  allow read:   if request.auth != null && temAcessoLiberado() && mesmaEmpresaRead();
  allow update: if request.auth != null && temAcessoLiberado() && mesmaEmpresaRead() && empresaImutavel();
  allow delete: if request.auth != null && temAcessoLiberado() && mesmaEmpresaRead();
}
```

- `mesmaEmpresaRead()` → empresa A não lê/lista/exclui pré-OS da empresa B;
  `master_admin` atravessa (suporte).
- `empresaImutavel()` → impede mover/roubar a pré-OS entre empresas em update
  (ex.: marcar `CONVERTIDA`/`VISUALIZADO` só na própria empresa).

### 5.2 Dashboard — filtro de tenant nas consultas

- `dashboard-alertas.js` → `query(collection(db,'pre_os'), ...injectTenantFilter([where('status','==','AGUARDANDO_CONVERSAO')]))`.
- `dashboard-alertas-panel.js` → `FB.query(FB.collection(db,'pre_os'), ...injectTenantFilter([]))`.

Ambos passam a se comportar exatamente como as consultas irmãs (`os`,
`posvenda_contatos`, `agendamentos`, `solicitacoes_diagnostico`,
`diario_registros`).

### 5.3 Intake público (`abrir-atendimento.html`)

A pré-OS passa a nascer carimbada:
```js
const dados = {
  id: novoId,
  empresa_id: 'cellcity-master', // EMPRESA_PADRAO (functions/lib/empresa.js)
  cliente: { ... }, aparelho: { ... }, problema, ...
};
await PreOS.set(novoId, dados);
```
Mesma convenção de todo endpoint público sem sessão (`empresaIdDe()` →
default `cellcity-master`). Garante que a pré-OS continue **legível pela
equipe da própria empresa** depois que os filtros de tenant forem ativados
(pós-backfill), em vez de virar um doc órfão invisível.

### 5.4 Correção do harness de teste (esta sessão)

Três testes de `financeiro_categorias/itens` (adicionados pela frente
concorrente para o achado A1) chamavam `ctx.firestore()` **duas vezes** dentro
do mesmo callback `withSecurityRulesDisabled`, o que trava as settings do SDK
(`Firestore has already been started and its settings can no longer be
changed`) e derrubava o *seed* antes de a regra ser avaliada — falha de
harness, **não** de regra. Corrigido reusando um único handle
(`const seed = ctx.firestore()`), deixando a suíte 100% verde.

---

## 6. Testes Executados

Ambiente: Node v22.23.1; emulador Firestore `cloud-firestore-emulator-v1.21.0`
(porta 8080) carregando o `CRM/firestore.rules` real.

| Suíte | Resultado |
|-------|-----------|
| `tests/firestore-rules/tenant-isolamento.test.mjs` (emulador) | **38/38** ✅ |
| `tests/firestore-rules/os-publico.test.mjs` (emulador) | **74/74** ✅ |
| `tests/rbac/autoatendimento` + `central-alertas` + `central-alertas-financeiro` | **13/13** ✅ |
| `tests/rbac/**` (suíte RBAC completa) | **179/181** ✅ (2 falhas pré-existentes) |
| `tests/infra/**` + `tests/onboarding/**` + `tests/performance/**` | **26/26** ✅ |

Total das suítes reexecutadas: **330/332 aprovados**.

### 6.1 Testes novos de `pre_os` (todos aprovados)

```
ok 34 - pre_os: cliente cria sem login (create público, comportamento preservado)
ok 35 - pre_os: empresa A lê/atualiza a própria pré-OS → permitido
ok 36 - pre_os: empresa A lê/atualiza/exclui pré-OS da empresa B → NEGADO (achado crítico corrigido)
ok 37 - pre_os: empresa A lista com filtro da própria empresa → permitido; sem filtro → negado
```

---

## 7. Regressão

- **RBAC:** 179/181. As **2 falhas são pré-existentes** e não relacionadas ao
  `pre_os` — `Relatório Mensal — renderRelatorio` e `Relatório Mensal —
  atualizarResumoCompleto` (módulo `financeiro-relatorio`), já documentadas
  como baseline em sprints anteriores.
- **Autoatendimento / Central de Alertas** (módulos que consomem `pre_os`):
  13/13 ✅ — nenhuma regressão introduzida pelos filtros de tenant.
- **infra / onboarding / performance:** 26/26 ✅.
- **`tests/control-center/**`:** não reexecutado nesta sessão — a suíte trava
  no sandbox (spawna módulos shell/subprocessos pesados), **limitação de
  ambiente já conhecida e documentada na certificação anterior**, não
  regressão. Não toca `pre_os`.
- **`tests/functions/**` (emulador de Functions), `tests/integrity`,
  `tests/e2e`:** não reexecutados (limites de ambiente já documentados:
  inotify/`emulators:exec`/rsync no sandbox). Nenhum deles exercita `pre_os`
  (confirmado: nenhuma Cloud Function referencia a coleção).

---

## 8. Firestore Rules

Revalidação completa no emulador (read / write / update / delete / list /
queries / subcoleções / claims / tenant / empresa_id):

- **`pre_os`**: create público OK; read/update/delete isolados por
  `empresa_id`; `master_admin` atravessa; lista sem filtro negada
  (fail-closed); lista com filtro da própria empresa permitida.
- **Auditoria completa das demais coleções (Etapa 4):** todas as coleções de
  dados de cliente/negócio usam `mesmaEmpresaRead()`/`mesmaEmpresaCreate()`/
  `empresaImutavel()`. **`pre_os` era a única exceção — agora corrigida.**
- **Exceções remanescentes (não são dados de cliente, decisões
  documentadas):**
  - `metadata/{docId}` — `read/write: temAcessoLiberado()`: contador global de
    numeração de OS, sem PII; risco baixo, já documentado.
  - `alarme_config/{docId}` — `read/write: temAcessoLiberado()`: preferência
    de alarme, sem PII; risco baixo, já documentado.
  - `config/{docId}` e `catalogo_config/{docId}` — `get: true` público por
    design (garantia.html / catálogo público).
  - Coleções por-uid (`central_alertas_status`, `favoritos_usuarios`,
    `usuarios/{uid}/preferencias`, `_diagnostico_temp`) — escopo por dono,
    corretas.
  - `orders`, `clients` — legadas, `if false` (bloqueadas).

Nenhuma dessas remanescentes é um vazamento cross-tenant de dados de cliente.

---

## 9. Multiempresa

Isolamento comprovado por evidência no emulador, com **três tenants**
(`empresa-a`, `empresa-b`, `cellcity-master`):

- Empresa A **nunca** acessa dados da Empresa B (clientes, OS, usuários,
  config, financeiro/itens, **pré-OS**) — get/list/update/delete negados.
- Empresa B **nunca** acessa dados da Empresa A (simétrico).
- `master_admin` (operador da plataforma) atravessa empresas para suporte,
  como previsto.
- CREATE sempre carimbado com a empresa do autor; forja de `empresa_id`
  negada; `empresa_id` imutável em update (não dá para doar/roubar docs).
- Lista **sem** filtro de empresa → negada (isolamento "não-provável",
  fail-closed) para toda coleção tenant-scoped, inclusive `pre_os`.

Cobertura direta dos critérios da Etapa 6: CRUD, pesquisa, listagem,
Dashboard (consultas de `pre_os` agora filtradas), e ausência de Cloud
Functions no fluxo.

---

## 10. Evidências Pós-Correção

Rodada limpa (emulador reiniciado, dados zerados), `tenant-isolamento.test.mjs`:

```
1..38
# tests 38
# pass 38
# fail 0
```

`os-publico.test.mjs`:

```
1..74
# tests 74
# pass 74
# fail 0
```

Log do motor de Rules durante o teste 36 (empresa A tentando escrever na
pré-OS da empresa B), confirmando o fechamento:

```
PERMISSION_DENIED: false for 'update' @ L150, false for 'delete' @ L151
```

(L150/L151 = as novas linhas `update`/`delete` de `pre_os` em
`CRM/firestore.rules`.)

---

## 11. Riscos Residuais

| # | Risco | Severidade | Mitigação / Observação |
|---|-------|-----------|------------------------|
| R1 | As Rules multiempresa (incl. `pre_os`) ainda **não estão deployadas em produção** (`main`) — diff grande entre `main` e `develop`. | 🟠 Alto até deploy | Seguir a sequência já documentada: backfill de `empresa_id` (já inclui `pre_os`) → `validar-backfill` → `dados_migrados=true` → deploy das Rules. Enquanto isso, `main` continua single-tenant (uma empresa só), sem exposição cross-tenant real em produção. |
| R2 | Pré-OS **legadas** (criadas antes desta correção) não têm `empresa_id`. | 🟡 Médio | Cobertas pelo `scripts/backfill-empresa-id.mjs` (a coleção `pre_os` já está na lista). Pós-backfill ficam legíveis pela empresa dona; pré-backfill ficam fail-closed (negadas), nunca vazadas. |
| R3 | `create` de `pre_os` é público (`if true`) — um agente malicioso pode injetar uma pré-OS *spam* na fila de uma empresa. | 🟢 Baixo | Não é vazamento de leitura; é o mesmo modelo de confiança do intake público do Portal (`empresaIdDe`). Fora do escopo deste bloqueador. |
| R4 | `tests/control-center`, `tests/functions`, `tests/integrity`, `tests/e2e` não reexecutados (limite de ambiente). | 🟢 Baixo | Nenhum exercita `pre_os`; limites de ambiente já documentados. Recomenda-se reexecução em CI/ambiente sem restrição de inotify/sandbox. |
| R5 | Exceções `metadata`/`alarme_config` (`temAcessoLiberado()` sem tenant). | 🟢 Baixo | Sem PII de cliente; decisões já documentadas. Não são o bloqueador desta fase. |

---

## 12. Parecer Técnico

O vazamento cross-tenant que reprovou a homologação foi **reproduzido,
compreendido, isolado à sua causa raiz e corrigido de forma mínima**, no
mesmo padrão de isolamento já consolidado no resto do projeto. A correção foi
**comprovada por evidência automatizada** contra as Firestore Rules reais no
emulador (112/112 testes de Rules aprovados, incluindo 4 específicos de
`pre_os`), e a auditoria completa das Rules confirmou que **nenhum outro
módulo apresenta o mesmo padrão** de coleção de dados de cliente sem gate de
tenant.

A regressão nos módulos afetados e nas suítes reexecutáveis não acusou nada
novo (as 2 únicas falhas RBAC são baseline pré-existente do módulo de
Relatório Mensal, sem relação com `pre_os`).

### Conclusão

🟢 **VULNERABILIDADE ELIMINADA**

### Condição de promoção

A **eliminação da vulnerabilidade** está comprovada no código/Rules de
`develop`. A **promoção para `main`** permanece condicionada — como já
planejado — à execução coordenada do backfill de `empresa_id` + ativação dos
filtros de tenant + deploy das Rules. **Nenhuma promoção para `main` foi
realizada nesta fase.** Até que as Rules multiempresa estejam deployadas e o
backfill validado em produção, o parecer de prontidão de produção do sistema
como um todo permanece condicionado a essa sequência (os demais achados
S1–S4/A2 tratados pela frente concorrente seguem seu próprio fluxo de
verificação).
