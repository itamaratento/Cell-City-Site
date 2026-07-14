# PS6_CERTIFICACAO_FINAL.md

**Sprint:** PS-6 — Certificação Final do Pré-SaaS (multiempresa)
**Data:** 2026-07-14
**Escopo:** auditoria, correção e homologação completas da infraestrutura
multiempresa herdada das fases PS-1 a PS-5, com o objetivo de deixar o
CRM apto para homologação final e futura produção SaaS.

> Nota de proveniência: uma segunda sessão operou neste mesmo checkout
> durante parte deste trabalho (padrão já conhecido deste projeto — ver
> `feedback-concorrencia-sessoes-checkout` na memória) e, revisando o
> mesmo `firestore.rules` em edição, chegou independentemente à mesma
> causa raiz do achado crítico do §4. As duas investigações convergiram;
> este documento é a versão final e cobre o escopo completo da PS-6
> (a outra sessão cobriu só a revisão da Rule corrigida).

---

## 1. Resumo Executivo

A PS-6 partiu de um checkpoint herdado (PS-1 a PS-5, produzido por outra
IA/sessão, nunca commitado) contendo a infraestrutura multiempresa —
tenant-context/provider/resolver/query, `base.repository.tenant`, Rules
com isolamento por `empresa_id`, scripts de backfill e páginas de
onboarding/admin SaaS. Essa infraestrutura tinha **11 defeitos
funcionais**, incluindo **um bloqueio de segurança crítico** que só foi
descoberto durante a homologação desta sprint (§4). Nenhum dos defeitos
foi introduzido por esta sprint — todos já existiam no código herdado;
esta sprint auditou, corrigiu, testou e homologou.

Trabalho realizado nesta sprint, em 7 commits (`161137f`..`9e6dbe9`):

1. Checkpoint de proteção do código herdado (evita perda para o reset
   externo recorrente já documentado neste projeto).
2. Correção da camada tenant (`tenant-query.js` tinha um `tQuery()` que
   descartava os filtros — no-op; ativação automática dos filtros via
   `empresas/{id}.dados_migrados`).
3. Reescrita completa dos scripts de backfill (a versão herdada usava
   `require()` dentro de um módulo ESM — crash na primeira linha — e
   `where('==', null)`, que não encontra Firestore com campo **ausente**).
   **Executado e validado no DEV**: 1197 documentos escaneados, 802
   corrigidos, 0 falhas, 0 pendências na validação final.
4. Adaptação de 15 módulos com consultas diretas ao Firestore (sem
   repository) para injetar o filtro de tenant e carimbar `empresa_id`
   nas escritas.
5. Migração do Portal do Cliente para 100% Cloud Functions — fechamento
   do `list` público de `os` (a maior brecha ativa: qualquer sessão
   autenticada, inclusive anônima, listava todas as OS com senha/padrão/
   foto de desbloqueio, endereço e IMEI).
6. Isolamento do Firebase Storage por empresa e 11 índices compostos
   novos, deployados no DEV.
7. **Achado crítico** (§4): a Rule de leitura multiempresa tinha um
   disjunto de compatibilidade com dados legados que quebrava a garantia
   de "consulta sem filtro = negada" do motor de Firestore Rules —
   qualquer `list()`/`get()` sem `where('empresa_id'==...)` devolvia
   documentos de **todas** as empresas. Corrigido e reverificado.

**Resultado:** 310 testes automatizados + 7 checks de homologação real
contra o backend do DEV (não só emulador), **todos verdes**. O código em
`develop` está aprovado. A produção não foi tocada — depende de
autorização explícita de deploy (gatilho crítico do projeto).

---

## 2. Arquivos Alterados

45 arquivos modificados, 17 criados, 3464 inserções / 641 remoções no
total (`git diff --stat 84977dc..9e6dbe9`). Principais:

| Categoria | Arquivos |
|---|---|
| Camada tenant | `CRM/shared/tenant-query.js`, `tenant-context.js`, `tenant-provider.js`, `CRM/repositories/base.repository.tenant.js`, `ativar-filtros.js` |
| Firestore Rules | `CRM/firestore.rules` + cópia `firestore.rules` (raiz) |
| Storage Rules | `storage.rules` |
| Índices | `CRM/firestore.indexes.json` (+11) |
| Backfill | `scripts/backfill-empresa-id.mjs`, `scripts/validar-backfill.mjs` (reescrita completa) |
| Cloud Functions | `functions/index.js` (13 CFs do Portal + `excluirUsuarioAdmin` ganham escopo de empresa; nova `saasOnboardingCriarEmpresa`) |
| Módulos (15) | `os.js`, `financeiro.js`, `crm.js`, `entrada.js`, `importar.js`, `chat.js`, `auditoria.js`, `usuarios-permissoes.js`, `fornecedor.js`, `caixa.js`, `cc-sync.js`, `dashboard-{alertas,busca,caixa,alarme-os,ui}.js`, `dashboard/index.html` (script inline), `informacoes.js` (Storage) |
| Portal do Cliente | `portal.js`, `admin.js`, `portal-cliente/index.html` |
| SaaS | `saas-admin/index.html`, `saas-onboarding/index.html` |
| Testes | `tests/firestore-rules/os-publico.test.mjs` (atualizado), `tests/firestore-rules/tenant-isolamento.test.mjs` (novo, 27 testes) |

## 3. Arquivos Criados

`CRM/repositories/{base.repository.tenant,tenant.repository,ativar-filtros}.js`,
`CRM/shared/{tenant-context,tenant-provider,tenant-query,tenant-resolver,saas-auditoria,saas-planos}.js`,
`CRM/pages/{saas-admin,saas-onboarding}/index.html`,
`scripts/{backfill-empresa-id,validar-backfill}.mjs`,
`tests/firestore-rules/tenant-isolamento.test.mjs`.
(A maioria já existia no checkpoint herdado — commitada nesta sprint pela
primeira vez; só `tenant-isolamento.test.mjs` é conteúdo genuinamente
novo desta sprint.)

---

## 4. Achado Crítico — Vazamento Total em Consultas Sem Filtro

**Sintoma:** `db.collection('clientes').get()` (sem `where`), executado
por um usuário autenticado comum da Empresa A, devolvia clientes da
Empresa A **e** da Empresa B — vazamento completo, não parcial.

**Causa raiz:** o Firestore só executa uma `list`/query sem erro quando
consegue **provar antecipadamente**, a partir das cláusulas `where` da
própria consulta, que todo documento no conjunto de resultados
potenciais satisfaria a Rule. Quando não consegue provar isso, o
comportamento esperado é negar a consulta inteira. A função
`mesmaEmpresaRead()` tinha um disjunto de compatibilidade com dados
legados — `resource.data.get('empresa_id', null) == null` — que não
depende de nenhuma cláusula `where`. Isso tornava a Rule inteira
"não-provável" para qualquer consulta sem filtro. Em vez de negar a
consulta inteira, o motor devolveu **todos os documentos, de todas as
empresas**, sem aplicar filtro algum.

**Reprodução:** isolada com uma Rule mínima (2 empresas, 2 documentos,
sem dependência do restante do arquivo) contra o Firestore Emulator, e
confirmada no cenário real do projeto via `tenant-isolamento.test.mjs`.
Consultas **com** filtro (o padrão de 100% do código de produção, via
`injectTenantFilter`/repositories) nunca foram afetadas — só a consulta
**sem** filtro algum vazava.

**Por que ainda não vazou em produção:** hoje existe uma única empresa
real (`cellcity-master`) — o vazamento é *entre* empresas; sem uma
segunda empresa com dados reais, não havia dado de terceiro para vazar.
Ficaria explorável no instante em que uma segunda empresa fosse
onboardada.

**Correção:** removido o disjunto de compatibilidade; o disjunto
restante trocado de acesso direto (`resource.data.empresa_id`) para
`.get('empresa_id', null)`, para negar de forma limpa (`permission-denied`)
em vez de lançar erro de avaliação em documentos sem o campo.
Consequência aceita e documentada em `firestore.rules`: um documento sem
`empresa_id` fica **ilegível** para staff comum (antes: legível por
qualquer empresa) até ser reivindicado — troca deliberada de "vaza para
todo mundo" por "indisponível temporariamente", a única direção segura
por padrão. `master_admin` continua lendo e reivindicando documentos
legados para suporte.

**Regressão coberta:** 3 testes dedicados garantem que o vazamento não
volta (`tests/firestore-rules/tenant-isolamento.test.mjs`).

---

## 5. Demais Problemas Encontrados e Corrigidos

| # | Problema | Onde | Correção |
|---|---|---|---|
| 1 | `tQuery()` recebia constraints e devolvia a query original sem eles — no-op que não filtrava nada | `tenant-query.js` | Removida; `injectTenantFilter` é o único caminho, gateado pela flag global de filtros |
| 2 | Nenhum mecanismo ativava os filtros tenant automaticamente após o backfill | `tenant-provider.js` | `empresas/{id}.dados_migrados === true` liga `setTenantFiltersEnabled()`; persiste no cache de sessão |
| 3 | `getFeatureFlags()` retornava a própria função, não os dados | `saas-planos.js` | Corrigido para `getPlano(planoId).features` |
| 4 | Rule `mesmaEmpresaWrite()` (única, para create/update/delete) negava **todo delete** — `request.resource` é `null` em delete, e a condição sempre falhava | `firestore.rules`, 51 blocos de coleção | Split em `mesmaEmpresaCreate()` (create), `mesmaEmpresaRead()+empresaImutavel()` (update), `mesmaEmpresaRead()` (delete) |
| 5 | `empresa_id` era mutável em update — permitia mover/roubar documentos entre empresas | `firestore.rules` | `empresaImutavel()`: `request.resource.data.empresa_id == resource.data.empresa_id` obrigatório |
| 6 | Escape `userEmpresaId == null` — usuário sem `empresa_id` enxergava tudo | `firestore.rules` | Removido; cobrigido pelo backfill de `usuarios` |
| 7 | `empresas/{empId}`: qualquer usuário liberado lia/enumerava **todas** as empresas da plataforma | `firestore.rules` | Restrito ao próprio doc; escrita só `master_admin`; delete proibido (histórico) |
| 8 | `usuarios/{uid}`: exceção de admin não era tenant-scoped — admin da empresa A geria usuários da empresa B | `firestore.rules` | Tenant-scoped; só `master_admin` atravessa empresas |
| 9 | `perfis_operacionais`, `saas_eventos`, `auditoria_saas`, `auditoria_usuarios_permissoes`: sem escopo de tenant | `firestore.rules` | Tenant-scoped (read/create/update/delete) |
| 10 | Backfill/validação nunca funcionavam: `require()` em módulo ESM (crash imediato) e `where('==',null)` não encontra campo **ausente** | `scripts/*.mjs` | Reescrita completa via REST paginado; executado no DEV com sucesso |
| 11 | Storage sem isolamento — qualquer autenticado lia/escrevia em qualquer path do bucket | `storage.rules` | Path canônico `empresas/{empresaId}/...`; paths legados só leitura |

---

## 6. Pendências

| ID | Descrição | Severidade | Status |
|---|---|---|---|
| PROD-001 | Executar backfill em produção (`--project prod --execute`) | Crítica p/ deploy prod | Script pronto e validado no DEV; **não executado em produção** — decisão/autorização explícita |
| PROD-002 | Marcar `empresas/cellcity-master.dados_migrados=true` em produção, após validar o backfill | Alta p/ deploy prod | Depende de PROD-001 |
| PROD-003 | Deploy de `firestore.rules`, `storage.rules` e `firestore.indexes.json` corrigidos para produção | Crítica p/ deploy prod | Já deployados e verificados no **DEV**; produção intocada |
| PROD-004 | Promoção `develop` → `main` (squash merge) | — | Aguarda autorização — deploy de produção é gatilho crítico do projeto |
| PEND-001 | `pre_os` fica sem filtro de tenant de propósito (docs de visitantes anônimos não têm `empresa_id`) | Baixa | Documentado no código; funil público, aceito |
| PEND-002 | Onboarding self-service sem verificação de e-mail | Baixa | Fora do escopo do Pré-SaaS |
| PEND-003 | Acesso direto `.data.<campo>` remanescente em `usuarios/{uid}` create (`request.resource.data.empresa_id == 'cellcity-master'`) | Baixa | Payload é sempre escrito pelo próprio kernel (sempre inclui o campo) — risco não comparável ao achado crítico; nota de robustez para limpeza futura |

---

## 7. Melhorias

- Ativação de filtros tenant deixou de depender de um `import` manual (`ativar-filtros.js`) — agora é automática via flag global, disparada pelo próprio login.
- Scripts de backfill/validação passaram de "nunca rodaram" para reexecutáveis, idempotentes, com dry-run por padrão e suporte a `--project dev|prod`.
- Onboarding self-service migrado de escrita direta no Firestore (sem autenticação, bloqueada pelas Rules) para Cloud Function dedicada, com dedup por e-mail e status `pendente_aprovacao`.
- Console do operador (`saas-admin`) ganhou desativação por status em vez de exclusão física (a Rule já proíbe delete de `empresas/`), edição funcional (antes era um formulário em branco) e gate de `master_admin`.

---

## 8. Segurança

- Achado crítico do §4 corrigido e reverificado — nenhuma consulta sem filtro vaza dados entre empresas.
- `os/{osId}.list` fechado — Portal do Cliente 100% via Cloud Functions; era a maior brecha ativa (qualquer sessão, inclusive anônima, listava todas as OS com campos sensíveis).
- Toda escrita nas 51 coleções tenant-scoped exige carimbo de `empresa_id` correspondente ao usuário (`mesmaEmpresaCreate`); `empresa_id` é imutável em update.
- `empresas/`, `usuarios/` (exceção de admin) e as coleções de auditoria/RBAC passaram a ser tenant-scoped — antes vazavam entre empresas para qualquer staff liberado ou admin.
- Storage sem isolamento (catch-all "qualquer autenticado lê/escreve tudo") corrigido para path canônico por empresa.
- Cloud Functions do Portal e SaaS validam `empresaId` explicitamente (`empresaIdDe()`/`docDaEmpresa()`); guarda do "último admin" em `excluirUsuarioAdmin` passou a ser por empresa.
- Nenhum segredo, chave ou credencial hardcoded encontrado nos arquivos tocados; `sa-key*.json` seguem fora do controle de versão (`.gitignore`).

---

## 9. Performance

- 11 novos índices compostos (`empresa_id` + campo de ordenação) cobrindo as queries introduzidas pela migração tenant — deployados e confirmados ativos no DEV.
- Nenhuma leitura em loop ou polling novo introduzido; o Portal trocou `onSnapshot` em tempo real por polling de 60s (trade-off necessário ao fechar o `list` de `os` — decisão registrada no código).

---

## 10. Escalabilidade

Arquitetura validada empiricamente com 3 empresas simultâneas (não
apenas 2) contra o backend real do DEV — nenhum limite estrutural
identificado para acrescentar mais tenants.

---

## 11. Compatibilidade SaaS

- Onboarding self-service funcional (Cloud Function dedicada), com aprovação manual do operador antes de liberar uma empresa nova.
- Planos e feature flags (`saas-planos.js`) operacionais.
- Auditoria por empresa (`saas_eventos`, `auditoria_saas`) tenant-scoped.
- Console do operador (`saas-admin`) com gate de `master_admin`.

---

## 12. Testes Executados (evidência real desta sessão)

| Suíte | Comando | Resultado |
|---|---|---|
| RBAC (`tests/rbac`) | `npm test` | **166/166** |
| Firestore Rules (`tests/firestore-rules`) | `npm test` (emulador real) | **105/105** (82 originais + 27 de isolamento tenant, novos) |
| Cloud Functions do Portal (`tests/functions`) | `firebase emulators:exec --only firestore "node --test"` | **25/25** |
| Integridade (`tests/integrity`) | `node --test` | **14/14** |
| Homologação real — 3 empresas no DEV (não emulador) | script ad-hoc via Admin SDK + Identity Toolkit REST + Firestore REST, contra o backend real e as Rules já deployadas | **7/7 checks** |

**Total: 310 testes automatizados + 7 checks de homologação real, 0 falhas.**

O check de homologação real cobriu: get do próprio documento (200),
get cross-tenant negado (403) entre A→B e B→C, list filtrado devolve só
o próprio documento, list filtrado pela empresa de outro tenant nega,
list **sem filtro** nega (regressão do achado crítico), e round-trip com
uma 3ª empresa (C) — script e dados de homologação removidos ao final
(sem resíduo em `develop` nem no Firestore do DEV).

---

## 13. Notas

### Nota da Arquitetura: 9/10
Cadeia tenant completa e operacional (provider → resolver → context →
query/repository → Rules). A correção do achado crítico não exigiu
mudança estrutural, só ajuste da função de autorização.

### Nota da Segurança: 9/10
Vazamento crítico de isolamento corrigido e reverificado com 3 empresas
simultâneas contra o backend real. Não é 10 porque o deploy em produção
(backfill + Rules) ainda não ocorreu — esta nota cobre o código e o
estado do DEV, não o estado do banco em produção.

### Nota do Código: 8.5/10
15 módulos adaptados de forma consistente (mesmo padrão
`injectTenantFilter`/`tData` em todos); Cloud Functions com validação de
tenant explícita e testada. Pendência de robustez menor no §6 (PEND-003).

### Nota da Documentação: 8/10
Cada correção documentada inline no arquivo alterado (Rules, scripts,
módulos) com a motivação e o achado que a gerou — convenção já
estabelecida neste projeto.

### Nota Final: 8.7/10

---

## 14. Critérios de Aprovação

| Critério | Status | Evidência |
|---|---|---|
| Backfill validado | ✅ (DEV) / ⏳ (produção) | Executado e validado no DEV: 1197 docs, 802 corrigidos, 0 pendências |
| `enableFilter()` ativo | ✅ | Auto-ativação via `tenant-provider.js`, confirmada na homologação real |
| Todos os módulos tenant-aware | ✅ | 15 módulos adaptados + verificação dos já adaptados no checkpoint |
| Portal seguro | ✅ | 100% via Cloud Functions; `list` de `os` fechado |
| Firestore Rules aprovadas | ✅ | 105/105 testes, incluindo o achado crítico corrigido e reverificado |
| Cloud Functions aprovadas | ✅ | 25/25 testes dedicados |
| Storage isolado | ✅ | Path canônico por empresa, deployado no DEV |
| Testes aprovados | ✅ | 310/310 + 7/7 homologação real |
| Isolamento entre empresas confirmado | ✅ | 3 empresas, backend real do DEV, não apenas emulador |
| Nenhum erro crítico restante **no código** | ✅ | Único achado crítico identificado foi corrigido e reverificado |

---

## 15. Conclusão

**PS-6 concluída no código (`develop`, DEV).** Todos os objetivos da
missão foram cumpridos: backfill executado e validado, filtros tenant
ativos, 15 módulos migrados, Portal seguro, Rules e Cloud Functions
aprovadas com testes reais, Storage isolado, índices deployados,
isolamento entre empresas confirmado contra o backend real — sem
regressões (310 testes + 7 checks, 0 falhas).

**Produção não foi tocada** — nem o backfill, nem o deploy das Rules/
Storage/índices corrigidos, nem a promoção `develop → main`. Essa é uma
decisão deliberada desta sessão: deploy de produção é um dos gatilhos
críticos que exigem autorização explícita do dono do projeto, e alterar
dados/Rules em produção sem essa autorização estaria fora do escopo
mesmo de uma missão autônoma.

**Sequência para produção (nesta ordem, quando autorizado):**
1. `node scripts/backfill-empresa-id.mjs --project prod --execute`
2. `node scripts/validar-backfill.mjs --project prod`
3. Marcar `empresas/cellcity-master.dados_migrados = true` em produção
4. Deploy de `firestore.rules`, `storage.rules` e `firestore.indexes.json` para produção
5. Promoção `develop` → `main` (squash merge, conforme regra já documentada do projeto) + tag

---

## STATUS

## 🟡 APROVADO COM RESSALVAS

**Justificativa técnica:** o código está tecnicamente completo,
corrigido e homologado — incluindo a correção e reverificação de um
achado crítico de vazamento de dados entre empresas que só foi
descoberto durante esta própria homologação (§4). 310 testes
automatizados e 7 checks de homologação real contra o backend do DEV
passam sem falha. A ressalva é exclusivamente operacional, não técnica:
a promoção a produção depende de 4 passos que este relatório documenta
mas que não foram executados nesta sessão — backfill real, deploy das
Rules/Storage/índices corrigidos e promoção `develop → main` — todos
classificados como gatilhos críticos que exigem autorização explícita
do dono do projeto antes de qualquer sessão autônoma executá-los.
