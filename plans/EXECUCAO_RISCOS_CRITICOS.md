# 🧭 PLANO DE EXECUÇÃO CONTROLADA — RISCOS CRÍTICOS

> **Natureza deste documento:** auditoria, planejamento e preparação de execução. **Nenhuma alteração foi realizada** — nenhuma credencial rotacionada/revogada, nenhuma Firestore Rule alterada, nenhum código, banco de dados ou documento existente modificado, nenhum arquivo excluído, nenhum deploy executado. Ver confirmação explícita ao final.
> Este documento aprofunda [`PLANO_ACAO_RISCOS_CRITICOS.md`](PLANO_ACAO_RISCOS_CRITICOS.md) com o nível de detalhe operacional necessário para uma decisão de execução — a execução em si continua exigindo aprovação formal, item a item, separada deste documento.

---

## Resumo executivo

Este levantamento adiciona duas descobertas relevantes que não estavam nos documentos anteriores:

1. **Só existe uma Service Account no projeto** (`firebase-adminsdk-fbsvc@cellcity-crm.iam.gserviceaccount.com`) — não há outras credenciais de servidor envolvidas. O CI/CD (GitHub Actions, `deploy-pages.yml`) usa OIDC nativo do GitHub Pages, sem nenhuma chave do Google Cloud. `firebase-secondary.js` (Fase 1, Usuários e Permissões) usa uma API key pública de cliente, não uma Service Account — não é um segredo adicional.
2. **A origem da divergência de Firestore Rules agora está mais clara para 5 das 9 coleções em risco.** `central_organizacao`, `diario_eventos`, `favoritos_usuarios`, `alertas_usuario` e `auditoria_saas` **têm regra no arquivo órfão da raiz** (`firestore.rules`), com o padrão idêntico usado no resto do sistema (`allow read, write: if request.auth != null;`). Isso indica que essas 5 regras provavelmente **existiam e foram perdidas** quando `CRM/firestore.rules` foi criado/bifurcado do arquivo da raiz — um esquecimento de migração, não uma decisão consciente. Já as outras 4 (`contas_numeros`, `chips_cadastros`, `catalogo_config`, `notificacoes_saas`) **não existem em nenhum dos dois arquivos** — parecem ser funcionalidades construídas depois que a Rule correspondente nunca chegou a ser escrita.

Nenhuma correção foi implementada nesta etapa. As três seções abaixo (Credenciais, Firestore Rules, Documentação) trazem o diagnóstico completo pedido, prontas para aprovação formal.

---

## ETAPA 1 — Credenciais Google Cloud

### 1.1 Todas as Service Accounts utilizadas pelo projeto

Verificação exaustiva de todas as fontes de credencial de servidor no projeto:

| Fonte verificada | Resultado |
|---|---|
| `.firebaserc` (raiz e `CRM/`) | Um único projeto Firebase: `cellcity-crm`. Nenhuma referência a múltiplos projetos/ambientes. |
| `.github/workflows/deploy-pages.yml` (único workflow de CI/CD) | Usa `id-token: write` — é o OIDC **nativo do GitHub** para publicar no GitHub Pages, não envolve nenhuma credencial do Google Cloud. Confirma a memória do projeto de que a publicação é só via GitHub Pages. |
| `CRM/pages/usuarios-permissoes/firebase-secondary.js` (app Firebase secundário, criado na Fase 1 para não derrubar a sessão do admin ao criar contas) | Usa a mesma **API key pública de cliente** (`AIzaSyD5wQRvcVdweOhVqwd8e08JuzRXOESEbqE`) já usada em `backup-dados.js` — não é uma Service Account, é uma chave de cliente Firebase (por natureza pública, protegida pelas Firestore/Auth Rules, não um segredo). |
| Busca por qualquer outro arquivo `.json` com `"type": "service_account"` no projeto (fora `node_modules`/`_BACKUPS`) | Nenhum encontrado além dos já conhecidos. |

**Conclusão: existe uma única Service Account no projeto** — `firebase-adminsdk-fbsvc@cellcity-crm.iam.gserviceaccount.com` (a padrão criada automaticamente pelo Firebase Admin SDK ao ativar o projeto). Não há uma segunda SA "escondida" em CI/CD ou em outro serviço.

### 1.2 Todas as chaves existentes para essa Service Account

Confirmado por comparação direta de `private_key_id` entre os arquivos encontrados em disco (já detalhado no plano anterior, reconfirmado aqui):

| `private_key_id` | Onde está | Status conhecido |
|---|---|---|
| `a3e14f2648ee9dd411feb09097dca77ee105c242` | `Cell-City-Site/sa-key.json`, `TesteBackup/Cell-City-Site/sa-key.json`, credencial ativa no `gcloud` local | **A que vazou no histórico do git** (commit `4e28be69`, 2026-06-25, repositório público) |
| `824bef7c77ad2e0cb81b068cb38df929d483ff36` | `~/Downloads/cellcity-crm-firebase-adminsdk-fbsvc-824bef7c77.json` | Gerada em 2026-06-29 (4 dias após o vazamento), nunca aplicada a nada |

**Não é possível confirmar via API se existem OUTRAS chaves além dessas duas** que só existam no IAM e nunca tenham sido baixadas para este disco — a API `iam.googleapis.com` está desabilitada no projeto e habilitá-la seria uma alteração de configuração, fora do escopo desta etapa (só diagnóstico). **Esta é uma lacuna de informação que só o Console GCP/Firebase resolve** (IAM & Admin → Service Accounts → `firebase-adminsdk-fbsvc` → aba "Keys").

### 1.3 Quais aplicações usam cada credencial

Já verificado no plano anterior e reconfirmado nesta etapa: **nenhum script do projeto usa `sa-key.json`** (`backup-server.js` não usa Firebase Admin; `backup-dados.js` e `firebase-secondary.js` usam a API key pública de cliente; `apply-cors.js` usa o token OAuth do `firebase login`; CI/CD usa OIDC do GitHub). O único uso confirmado é manual, via `gcloud auth activate-service-account`, na máquina de desenvolvimento local.

### 1.4 Quais chaves estão efetivamente em uso

Só a chave **vazada** (`a3e14f26...`) está com uso confirmado — é a que está ativa na sessão `gcloud` local (diretório de credenciais criado em 2026-07-01 13:51). A segunda chave (`824bef7c77...`) não tem nenhum uso confirmado — está parada em `~/Downloads/` desde 2026-06-29 sem nenhuma evidência de ter sido usada por qualquer processo.

### 1.5 Plano de migração para a nova credencial

(Mantido do plano anterior, sem alterações — reafirmado aqui como parte da consolidação pedida.)

1. Verificar manualmente no Console GCP/Firebase quantas chaves existem hoje na Service Account.
2. Avaliar se a chave `824bef7c77...` (já gerada, nunca usada) pode ser promovida a chave oficial, ou se é preferível gerar uma terceira chave nova (mais seguro, já que a `824bef7c77...` também ficou exposta sem proteção em `~/Downloads/` por dias, uma pasta sem controle de acesso ou versionamento).
3. Testar a chave escolhida localmente (`gcloud auth activate-service-account --key-file=<chave>.json` + um comando de leitura simples) antes de revogar qualquer coisa.
4. Manter a chave antiga ativa em paralelo por uma janela curta até confirmar que a nova funciona.
5. Revogar/excluir a chave antiga (`a3e14f26...`) no IAM — este é o passo que efetivamente neutraliza o vazamento do histórico do git.
6. Reautenticar a sessão `gcloud` local com a chave nova.

### 1.6 Checklist de validação pós-rotação

- [ ] Confirmar no Console IAM que a chave `a3e14f26...` foi excluída/desabilitada.
- [ ] Confirmar que não sobra nenhuma cópia de `sa-key.json`/chave antiga nos 3 locais conhecidos (`Cell-City-Site/`, `TesteBackup/Cell-City-Site/`, `~/Downloads/`).
- [ ] Confirmar que `gcloud auth list` mostra só a chave nova (ou nenhuma sessão de SA, se decidido não manter uso local).
- [ ] Testar qualquer fluxo manual que dependa dessa credencial.
- [ ] Confirmar que nada em produção foi afetado (esperado: nada, já que produção não usa essa chave).

### 1.7 Plano de rollback

Sem alterações em relação ao plano anterior: como nada em produção depende desta chave, o risco de rollback é baixo. Enquanto a chave antiga não for excluída do IAM, a rotação é reversível trivialmente (não fazer nada = manter o estado atual). Após a exclusão da chave antiga, "rollback" não significa restaurá-la (ela está comprometida e não deveria voltar), e sim gerar uma chave adicional nova se algo inesperado quebrar.

---

## ETAPA 2 — Firestore Rules

### 2.1 Matriz detalhada das 9 coleções em risco

Para cada coleção identificada nos documentos anteriores como usada por módulo ativo sem regra no ruleset publicado, o detalhamento completo pedido:

#### `central_organizacao`
- **Módulo responsável:** `central-organizacao/central.js`
- **Operações:** leitura (`getDoc`) e escrita (`setDoc`)
- **Rule publicada (`CRM/firestore.rules`, ativa em produção):** nenhuma
- **Rule no arquivo órfão da raiz:** `allow read, write: if request.auth != null;` — **existe**, sugere que foi perdida na bifurcação dos arquivos
- **Comportamento esperado:** qualquer usuário autenticado deveria poder ler/gravar (mesmo padrão de praticamente todas as outras coleções do sistema)
- **Comportamento observado:** não testável nesta sessão (ver limitação na seção 2.3)
- **Risco da alteração (ao corrigir):** baixo — é uma regra aditiva simples, réplica exata de um padrão já usado em dezenas de outras coleções
- **Prioridade:** Alta

#### `diario_eventos`
- **Módulo responsável:** `diario/diario.js` (sub-funcionalidade de histórico/timeline; a coleção principal `diario_registros` já tem regra)
- **Operações:** criação (`addDoc`) e leitura (`getDocs`)
- **Rule publicada:** nenhuma
- **Rule no arquivo órfão da raiz:** `allow read, write: if request.auth != null;` — **existe**
- **Comportamento esperado:** mesmo padrão de `diario_registros`, sua coleção-irmã
- **Comportamento observado:** não testável nesta sessão
- **Risco da alteração:** baixo
- **Prioridade:** Alta

#### `favoritos_usuarios`
- **Módulo responsável:** `shared/favoritos.js` — utilitário compartilhado, usado por dashboard, caixa, relatórios e sidebar (maior superfície de todas as 9)
- **Operações:** leitura em tempo real (`onSnapshot`) e escrita (`setDoc`)
- **Rule publicada:** nenhuma
- **Rule no arquivo órfão da raiz:** `allow read, write: if request.auth != null;` — **existe**
- **Comportamento esperado:** mesmo padrão — mas, por ser `favoritos_usuarios/{uid}`, o ideal (não implementado em nenhum dos dois arquivos) seria restringir escrita ao próprio uid, no padrão já usado em `usuarios/{uid}`
- **Comportamento observado:** não testável nesta sessão
- **Risco da alteração:** baixo, mas é a coleção de maior impacto se algo sair errado (usada por vários módulos simultaneamente)
- **Prioridade:** Alta

#### `contas_numeros`
- **Módulo responsável:** `contas/contas.js`
- **Operações:** CRUD completo (`getDocs`, `addDoc`, `updateDoc`, `deleteDoc`)
- **Rule publicada:** nenhuma
- **Rule no arquivo órfão da raiz:** **também não existe** — não é um caso de regra perdida, parece nunca ter sido escrita
- **Comportamento esperado:** padrão `allow read, write: if request.auth != null;`, mas por ter operação de `delete` explícita, vale avaliar se deveria ter uma condição adicional de perfil (a maioria das coleções do projeto não distingue delete de write, mas esta é a única das 9 com exclusão confirmada no código)
- **Comportamento observado:** não testável nesta sessão
- **Risco da alteração:** baixo-médio (é a única das 9 com `delete`, exige mais atenção ao desenhar a regra)
- **Prioridade:** Alta

#### `alertas_usuario`
- **Módulo responsável:** `crm-comercial/crm.js`
- **Operações:** leitura (`getDoc`) e escrita (`setDoc`)
- **Rule publicada:** nenhuma
- **Rule no arquivo órfão da raiz:** `allow read, write: if request.auth != null;` — **existe**
- **Comportamento esperado:** mesmo padrão de `crm_leads`, coleção-irmã dentro do mesmo módulo (que tem regra)
- **Comportamento observado:** não testável nesta sessão
- **Risco da alteração:** baixo
- **Prioridade:** Média-Alta

#### `chips_cadastros`
- **Módulo responsável:** `crm-comercial/chips.js`, `chips-entrada.js` (módulo de Cadastro de Chip)
- **Operações:** CRUD completo (`addDoc`, `query`, `updateDoc`, `deleteDoc`)
- **Rule publicada:** nenhuma
- **Rule no arquivo órfão da raiz:** **também não existe**
- **Comportamento esperado:** padrão `allow read, write: if request.auth != null;`
- **Comportamento observado:** não testável nesta sessão
- **Risco da alteração:** baixo-médio (CRUD completo, mesma observação de `contas_numeros` sobre o `delete`)
- **Prioridade:** Alta

#### `catalogo_config`
- **Módulo responsável:** `catalogo/catalogo.js` (config do catálogo público, distinta de `catalogo_produtos`, que já tem regra)
- **Operações:** leitura (`getDoc`) e escrita (`setDoc` com merge)
- **Rule publicada:** nenhuma
- **Rule no arquivo órfão da raiz:** **também não existe**
- **Comportamento esperado:** mesmo padrão de `catalogo_produtos`, sua coleção-irmã
- **Comportamento observado:** não testável nesta sessão
- **Risco da alteração:** baixo
- **Prioridade:** Média

#### `notificacoes_saas` e `auditoria_saas`
- **Módulo responsável:** `shared/tenant.js`, importado só por `usuarios-permissoes.js` (feature de "modo suporte" de master admin) — caminho de execução estreito
- **Operações:** só criação (`addDoc`) em ambas
- **Rule publicada:** nenhuma para nenhuma das duas
- **Rule no arquivo órfão da raiz:** `auditoria_saas` **existe** (`allow read, write: if request.auth != null;`); `notificacoes_saas` **não existe** em nenhum dos dois arquivos
- **Comportamento esperado:** padrão `allow read, write: if request.auth != null;`, possivelmente restrito a `master_admin` já que é uma feature de suporte interno
- **Comportamento observado:** não testável nesta sessão
- **Risco da alteração:** muito baixo — impacto restrito a uma única funcionalidade de uso raro
- **Prioridade:** Baixa

### 2.2 Matriz resumida — Coleção × Módulo × Rule × Impacto × Prioridade

| Coleção | Módulo | Operações | Rule na raiz? | Prioridade |
|---|---|---|---|---|
| `favoritos_usuarios` | `shared/favoritos.js` (transversal) | read, write | Sim (perdida) | **Alta** |
| `diario_eventos` | `diario/diario.js` | create, read | Sim (perdida) | **Alta** |
| `central_organizacao` | `central-organizacao/central.js` | read, write | Sim (perdida) | **Alta** |
| `contas_numeros` | `contas/contas.js` | read, create, update, **delete** | Não (nunca existiu) | **Alta** |
| `chips_cadastros` | `crm-comercial/chips.js` | read, create, update, **delete** | Não (nunca existiu) | **Alta** |
| `alertas_usuario` | `crm-comercial/crm.js` | read, write | Sim (perdida) | Média-Alta |
| `catalogo_config` | `catalogo/catalogo.js` | read, write | Não (nunca existiu) | Média |
| `auditoria_saas` | `shared/tenant.js` (uso estreito) | create | Sim (perdida) | Baixa |
| `notificacoes_saas` | `shared/tenant.js` (uso estreito) | create | Não (nunca existiu) | Baixa |

### 2.3 Limitação confirmada: "comportamento observado" não é testável nesta sessão

Tentei três abordagens de diagnóstico somente-leitura para confirmar se essas coleções estão de fato bloqueadas em produção, sem sucesso:

1. **Consultar Cloud Logging por eventos `permission-denied`** (`gcloud logging read`) — retornou `PERMISSION_DENIED`: a Service Account disponível não tem permissão de leitura de logs neste projeto.
2. **Testar leitura via API REST do Firestore com o token da Service Account** — descartado propositalmente: credenciais de Service Account/Admin SDK **contornam as Firestore Rules por padrão** (é um comportamento documentado do Firebase), então esse teste sempre teria sucesso independente de existir regra ou não — não simula a experiência real de um usuário do app.
3. **Testar leitura anônima (sem token)** — não é conclusivo: tanto uma coleção "sem regra" (nega tudo por padrão) quanto uma coleção "com regra exigindo `auth != null`" (nega acesso anônimo) retornam o mesmo erro 403 — não diferenciam os dois casos.

**A única forma confiável de confirmar "comportamento observado" é:** (a) testar manualmente essas 6 telas (Central de Organização, Diário, Favoritos, Contas, Cadastro de Chip, Catálogo → Config) logado como usuário real no navegador, observando o console/erros; ou (b) obter permissão de Cloud Logging (`roles/logging.viewer`) para uma conta com esse acesso e consultar os logs do Firestore filtrados por essas coleções. Nenhuma das duas foi feita nesta etapa (fora do escopo de leitura autorizado).

---

## ETAPA 3 — Documentação

Classificação de cada documento operacional principal, sem editar nenhum arquivo:

| Documento | Classificação | Trechos que precisam revisão |
|---|---|---|
| **`PROXIMA_ETAPA.md`** | **Obsoleto** (para a seção mais recente) | Bloco "🎯 PRÓXIMA TAREFA — Ativação do SaaS" (topo, datado 24/06/2026): instrução ativa para executar Setup Master + migração + `firebase deploy` do modelo SaaS/multiempresa revertido em 27/06/2026. Seção "⚠️ RISCOS ATUAIS" e "📌 Pendências gerais" repetem a mesma premissa. Rodapé ("Última atualização: 08/06/2026") não bate com o bloco do topo — precisa de revisão completa, não só um trecho. |
| **`HISTORICO_PROJETO.md`** | **Obsoleto** (seção de arquitetura, sem aviso) | Documento parado em 14/06/2026. Seção "ARQUITETURA DO PROJETO" (linhas 22-219) sem aviso de obsolescência: linha 26 (caminho Windows antigo), linhas 71-79 (afirma Firebase Hosting — hoje proibido, é GitHub Pages), linha 114 (afirma carregamento via iframe — não é o padrão atual), tabela de módulos (linhas 91-111, lista 19 de 35), linhas 118-138 (`garantias` como coleção "planejada", nunca implementada assim). |
| **`ARQUITETURA_PORTAL_CLIENTE.md`** | **Parcialmente desatualizado** (mas documento se identifica como plano pré-implementação, não como estado atual) | Linha 23 (`pages/garantias/` como "já existe" — não existe), seção 3.2 (coleção `garantias` dedicada — nunca implementada), seção 16 (estrutura de arquivos por módulo HTML — implementação real é SPA única), seção 4.3 linha 174 (menciona `localStorage` com expiry — implementação real usa só `sessionStorage`). |
| **`MASTER_ROADMAP.md`** | **Parcialmente desatualizado** (já detalhado em `FASE_3_VALIDACAO.md`, reafirmado aqui) | Linhas 94, 95, 105, 115 (`shared/modulo-guard.js` e módulos `garantias`/`venda-rapida`/`chips` inexistentes), linha 192 (afirma 10 módulos com `empresa_id` restaurado — hoje é 1), linha 286. |
| **`CRM/TECHDOC.md`** | **Atualizado** (divergência mínima) | Linha 177: lista de catálogo de módulos omite `dashboard`, `central-modulos` e `estrategia` — a ausência de `dashboard` é a mais notável por ser o módulo central do sistema. |
| **`README.md`** (raiz) e **`CRM/README.md`** | **Não aplicável** | Ambos contêm apenas `# cellcity-crm` (uma linha) — não são documentos operacionais com afirmações a validar, não há o que classificar. |

### Observação sobre os documentos já corrigidos por auditorias recentes

`plans/fase2-sprint1-dashboard-rbac.md` já contém, na própria seção de recomendações, a correção sobre `shared/modulo-guard.js` e a divergência de Firestore Rules — está **atualizado**. `plans/FASE_3_LEVANTAMENTO.md` e `FASE_3_VALIDACAO.md` são, eles próprios, as auditorias que corrigem o `MASTER_ROADMAP.md` — não precisam de nova revisão.

---

## Matriz de riscos consolidada (as 3 etapas)

| Item | Risco | Confirmado nesta etapa? |
|---|---|---|
| Chave `a3e14f26...` (vazada) ainda ativa no `gcloud` local | Crítico | Sim, reconfirmado |
| Chave `824bef7c77...` (rotação incompleta) sem proteção em `~/Downloads/` | Alto | Sim, reconfirmado |
| Existência de chaves adicionais só no IAM (não baixadas) | Desconhecido | Não — limitação de acesso à API IAM |
| 9 coleções sem regra no ruleset ativo | Alto | Sim, com detalhamento por coleção nesta etapa |
| 5 dessas 9 regras existiam no arquivo órfão da raiz (perdidas na bifurcação) | Alto — indica causa raiz de processo, não só falta de atenção pontual | **Novo nesta etapa** |
| `PROXIMA_ETAPA.md` com instrução ativa para reativar SaaS revertido | Crítico (documental) | Sim, reconfirmado |
| `HISTORICO_PROJETO.md` desatualizado sem aviso | Médio | Sim, reconfirmado |

## Plano detalhado de execução (proposto — aguarda aprovação)

**Fase A — Investigação final (sem nenhuma alteração, pode ocorrer imediatamente):**
1. Verificar no Console GCP/Firebase quantas chaves existem na Service Account (resolve a lacuna da seção 1.2).
2. Testar manualmente as 6 telas afetadas (seção 2.3) para confirmar comportamento observado, ou obter acesso de Cloud Logging.

**Fase B — Credencial (após aprovação, independente do resto):**
3. Executar o plano de rotação da seção 1.5, na ordem descrita.

**Fase C — Firestore Rules (após aprovação, depende da Fase A confirmar o bloqueio real):**
4. Escrever as 9 regras faltantes em `CRM/firestore.rules`, priorizando as 5 com evidência de terem existido antes (`favoritos_usuarios`, `diario_eventos`, `central_organizacao`, `alertas_usuario`, `auditoria_saas`) e depois as 4 novas (`contas_numeros`, `chips_cadastros`, `catalogo_config`, `notificacoes_saas`), dando atenção especial às duas com `delete` (`contas_numeros`, `chips_cadastros`).
5. Testar via emulador (`@firebase/rules-unit-testing`) antes do deploy.
6. Fazer o deploy e confirmar o release ativo via API `firebaserules.googleapis.com` (não confiar só no Console).

**Fase D — Documentação (após aprovação, pode ocorrer em paralelo às Fases B/C):**
7. Corrigir `PROXIMA_ETAPA.md` (prioridade documental máxima — risco de reativação acidental do SaaS).
8. Corrigir `HISTORICO_PROJETO.md` e `MASTER_ROADMAP.md`.
9. Corrigir a lista de módulos do `TECHDOC.md`.
10. Adicionar nota de "documento de planejamento, não estado atual" no topo de `ARQUITETURA_PORTAL_CLIENTE.md`.

## Plano de rollback

- **Credencial:** ver seção 1.7 — risco baixo, reversível trivialmente enquanto a chave antiga não for excluída.
- **Firestore Rules:** salvar o ruleset ativo atual (via a mesma API já usada nesta auditoria) antes de qualquer deploy; se a regra nova causar regressão em algum dos 9 módulos ou em qualquer um dos módulos já testados (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente), republicar o ruleset salvo imediatamente.
- **Documentação:** toda correção documental é reversível via git; recomenda-se commitar as correções de documentação separadamente das correções de código/Rules.

## Checklist de validação (consolidado das 3 etapas)

- [ ] Chave antiga (`a3e14f26...`) revogada no IAM e removida dos 3 locais em disco.
- [ ] Confirmado (Console ou via novo teste de API, se a permissão for concedida) quantas chaves existem/existiam na Service Account.
- [ ] As 6 funcionalidades afetadas testadas manualmente após a correção das Rules, sem erro `permission-denied` no console do navegador.
- [ ] Release ativo do Firestore confirmado via API pós-deploy, idêntico ao `CRM/firestore.rules` do repositório.
- [ ] Testes de Rules via emulador executados e aprovados antes do deploy em produção.
- [ ] Zero regressão nos módulos de teste obrigatório do `CLAUDE.md` (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente).
- [ ] `PROXIMA_ETAPA.md` sem nenhuma instrução ativa apontando para arquitetura revertida.
- [ ] `HISTORICO_PROJETO.md`, `MASTER_ROADMAP.md` e `TECHDOC.md` corrigidos e consistentes entre si.

## Critérios para aprovação da execução

Antes de qualquer execução (Fases B, C ou D), recomenda-se que o usuário confirme explicitamente, item a item:

1. **Credencial:** aprovar o momento da rotação (não há janela tecnicamente arriscada, pode ser a qualquer momento) e decidir se reaproveita a chave `824bef7c77...` ou gera uma nova.
2. **Firestore Rules:** aprovar se a correção deve esperar a confirmação do "comportamento observado" (Fase A, item 2) ou se deve prosseguir direto com a hipótese de que as 9 coleções estão bloqueadas (risco: escrever regra para algo que já funcionava por outro caminho não identificado — improvável, mas não 100% descartado sem o teste).
3. **Documentação:** aprovar se a correção é uma reescrita completa de `PROXIMA_ETAPA.md`/`HISTORICO_PROJETO.md` ou apenas a remoção/marcação dos trechos obsoletos identificados.
4. Confirmar que cada fase (B, C, D) será tratada como uma entrega isolada, testada e revertível independentemente — consistente com a regra permanente do projeto de nunca alterar mais de um módulo/componente crítico por vez.

---

## Metodologia

Diagnóstico realizado com: verificação de `.firebaserc`, workflows de CI/CD e todos os arquivos JavaScript que inicializam Firebase/Firebase Admin no projeto (busca por Service Accounts adicionais); comparação de `private_key_id` entre os 3 arquivos de chave encontrados em disco; tentativa de consulta ao Cloud Logging (negada por permissão, documentada como limitação); extração linha a linha das operações Firestore (`getDoc`/`setDoc`/`addDoc`/`updateDoc`/`deleteDoc`/`onSnapshot`) para cada uma das 9 coleções em risco, em `CRM/pages/*/*.js` e `CRM/shared/*.js`; comparação de cada uma dessas 9 coleções contra o arquivo órfão `firestore.rules` da raiz para determinar se a regra já existiu antes; releitura direta de `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md`, `ARQUITETURA_PORTAL_CLIENTE.md`, `CRM/TECHDOC.md` e ambos os `README.md` para classificação.

## ✅ Confirmação de que nenhuma alteração foi realizada

Todas as operações desta etapa foram de **leitura**: leitura de arquivos e código-fonte, comparação de conteúdo entre arquivos, uma tentativa de `gcloud logging read` que **falhou por permissão** (nenhuma tentativa foi feita de conceder permissão ou habilitar API adicional), e nenhuma chamada que escreva, modifique ou delete qualquer recurso do Google Cloud, Firestore, ou do sistema de arquivos do projeto. **Nenhuma credencial foi rotacionada ou revogada, nenhuma Firestore Rule foi alterada, nenhum código foi modificado, nenhum arquivo foi excluído, nenhum documento existente foi editado, e nenhum deploy foi executado.** A única criação foi este próprio documento (`plans/EXECUCAO_RISCOS_CRITICOS.md`).
