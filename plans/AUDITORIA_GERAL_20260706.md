# 🔍 Auditoria Geral — Preparação da Próxima Sprint (2026-07-06)

> Realizada imediatamente após a integração da Sprint 1b em `develop` (commit `f0d2389`). Começou como auditoria somente-leitura e evoluiu para resposta formal a um incidente de segurança confirmado (achado crítico abaixo) — as Fases 3-4 dessa resposta (auditoria de exposição + hardening) resultaram em correções **preparadas, testadas e já pushadas para `origin/develop`** (Fase 5, ver seção própria) — **ainda não deployadas** (Rules/GitHub Pages) nem promovidas a `main`, e a rotação definitiva de credencial permanece não executada, ambas aguardando autorização explícita.
> Detalhe técnico explorável do achado crítico está em `plans/AUDITORIA_GERAL_20260706_INTERNO.md` (interno, não versionado, mesma convenção de `plans/AUDITORIA_GERAL_20260704_INTERNO.md`).

## Visão geral do estado atual

Arquitetura: single-tenant, Firebase (Firestore + Auth + Cloud Functions), sem build step, ~34 módulos em `CRM/pages/`, ambientes MAIN/DEVELOP separados (backend Firebase dedicado por ambiente desde a Fase 1 de separação, já promovida a produção). Sprint 1b (Portal do Cliente → Cloud Functions) integrada em `develop`, homologada, 56 testes automatizados aprovados (25 unitários de Cloud Functions + 31 de Firestore Rules).

## Pontos fortes

- Processo de homologação e documentação (TECHDOC, plans/) maduro e consistentemente seguido nas últimas 3 sprints.
- Separação de ambientes DEV/PROD real (backend dedicado, não só código).
- Primeira suíte de testes automatizados do projeto (Sprint 1a/1b) com convenção clara (emulador local, sem depender de login interativo do Firebase CLI).
- Migração do Portal do Cliente para Cloud Functions fechou uma classe inteira de vulnerabilidade (acesso direto anônimo ao Firestore) de forma consistente e testada.

## 🔴 Risco crítico — resposta a incidente em andamento

**Credencial administrativa (service account) de PRODUÇÃO vazada em commit antigo de repositório público permanecia ATIVA — nunca rotacionada, conhecida desde 2026-07-03.** ~~Ambas ainda ativas e sem expiração~~ **RESOLVIDO (Fases 7-8): as 2 chaves foram DESABILITADAS e depois EXCLUÍDAS DEFINITIVAMENTE em 2026-07-06**, autorizado explicitamente pelo dono, com uma 3ª chave nova gerada e validada em seu lugar. A service account tem papéis de administrador de Cloud Functions, Cloud Run, Firebase Auth e Admin SDK completo (bypass de todas as Firestore Rules) — nível de acesso mais amplo do que se sabia antes desta auditoria, o que tornava este achado ainda mais crítico. Detalhe técnico completo em `plans/AUDITORIA_GERAL_20260706_INTERNO.md`. **Incidente encerrado — nenhuma credencial comprometida permanece ativa no IAM.**

Agravante encontrado e já corrigido nesta sessão: os documentos que descreviam esse incidente desde 2026-07-02 (`plans/PLANO_ACAO_RISCOS_CRITICOS.md`, `plans/EXECUCAO_RISCOS_CRITICOS.md`) continham o ID exato da chave vazada em texto plano e estavam publicamente acessíveis via GitHub Pages (confirmado HTTP 200 antes da correção) — reclassificados para `_INTERNO.md` e desrastreados.

## Riscos identificados (por ordem de severidade)

| # | Achado | Severidade | Status |
|---|---|---|---|
| 1 | Credencial admin vazada | 🔴 Crítico → ✅ Resolvido | **Excluída definitivamente (Fase 8)** — incidente encerrado |
| 2 | `plans/` e `CLAUDE.md` publicados ao vivo no GitHub Pages (incluindo, até esta correção, o ID da chave vazada em texto plano) | 🟠 Alto → ✅ Resolvido | **Publicado em produção (Fase 9)** — confirmado 404 via HTTP real |
| 3 | 7 coleções usadas no código sem nenhuma Firestore Rule (achado desta sessão + mapeamento exaustivo de 2026-07-02 nunca executado) — falhavam fechado (bug funcional, não vazamento) | 🟠 Alto (funcional) → ✅ Resolvido | **Deployado em DEV e PROD (Fase 9)** — confirmado via API |
| 4 | 9 módulos sem gate de permissão no client (`financeiro`, `fornecedor`, `campanhas`, `clientes`, `config`, `diario`, `importar`, `autoatendimento`, `analise`) — precisa checar se a Rule correspondente cobre o gap | 🟡 Médio (investigar) | Confirmado, não aprofundado |
| 5 | Login sem return-URL — qualquer perfil deslogado que acesse Portal Técnico cai no Dashboard após logar | 🟡 Médio | Confirmado (mais amplo que o achado original) |
| 6 | `dashboard-alarme-os.js` (janela flutuante do alarme) — mesма classe do H-009 (já corrigido no Caixa), ainda sem prefixo `/dev` | 🟡 Médio | Confirmado, não corrigido |
| 7 | `os.list` aberto a qualquer sessão autenticada nas Firestore Rules (decisão deliberada da Sprint 1b — ver TECHDOC §19.5) | 🟡 Médio, aceito | Documentado, pendente de sprint futura |

## ✅ Hardening já preparado nesta sessão (commitado localmente, aguardando autorização para deploy/push)

| Commit local | O quê | Testado |
|---|---|---|
| `bbafce6` | Sincronização de documentação (HISTORICO_PROJETO, PROXIMA_ETAPA, MASTER_ROADMAP, GUIA_MANUTENCAO) | N/A (doc) |
| `4bc8f43` | Rules para 4 coleções órfãs + exclusão de `plans/`/`CLAUDE.md`/`kernel-test/` do GitHub Pages | 43/43 Rules |
| `e6475fb` | Reclassificação dos 2 docs com key ID exposto + Rules para 3 coleções adicionais | 52/52 Rules |

Nada disso foi deployado em DEV/PROD nem pushado para `origin` — são mudanças prontas para revisão e autorização.

## Dívida técnica

### Testes e qualidade
- **34 de 34 módulos** de `CRM/pages/` sem nenhuma cobertura de teste automatizado (só o backend do Portal do Cliente é testado).
- **3 de 15 Cloud Functions** sem teste (`excluirUsuarioAdmin`, `consultarOSPublica`, `consultarOSPorTelefonePublica`).
- **51 de 57 blocos `match` do Firestore Rules** sem teste automatizado.
- **Nenhuma CI** executa os testes existentes — `npm test` é 100% manual; nada impede um bug ser mesclado sem rodar a suíte.

### Código morto / duplicação
- `CRM/shared/tenant.js` e `CRM/shared/listener-manager.js` — confirmado zero importadores reais, seguros para remover.
- Dezenas de diretórios/arquivos `BACKUP_*`/`.BACKUP_*` dentro de `CRM/pages/*/` e `CRM/shared/` (não em `_BACKUPS/`) — servidos no webroot por não haver build step; candidatos a relocação/remoção.
- `firestore.rules`/`firestore.indexes.json` da raiz do repo divergem do arquivo oficial (`CRM/firestore.rules`) — fonte duplicada, risco de alguém editar o arquivo errado.
- `firebase.json` ainda contém seção `hosting`, apesar de o Hosting ser proibido pelo projeto (publicação é só via GitHub Pages).
- `CRM/pages/kernel-test/` ainda rastreado e publicado.
- Inconsistência de nomenclatura: pasta `pos-venda/` (com hífen) vs. arquivo principal `posvenda.js` e coleções `posvenda_*` (sem hífen).

### Arquitetura
- Padrão de inicialização de módulo (`kernel.js::initModulo()`) não é universal — ~10 módulos seguem o padrão, ~9 não usam nenhum gate client-side (ver item 4 dos riscos).
- Fase 3 do `MASTER_ROADMAP.md` (consolidação `empresa_id`/multiempresa) descreve uma arquitetura já revertida (rollback de 2026-06-27) — precisa de revisão de escopo dedicada antes de ser retomada (aviso já registrado desde 2026-07-04, ainda não resolvido).

### Já corrigido (documentação desatualizada, precisa sincronizar)
- Backend único MAIN/DEVELOP → **separado**, em produção.
- Cota Firestore Spark → **migrado para Blaze**.
- `kernel.js` perfil default `'admin'` para conta nova → **corrigido**, default é `'pendente'` (fail-closed).
- Sessões anônimas do Portal listando dados de outros clientes → **corrigido** pela Sprint 1b.
- Doc órfão `usuarios/{uid}` de teste → **removido**.

## Prioridades recomendadas para a próxima Sprint

1. **Autorizar a execução do plano de rotação da credencial** (Sprint 0) — plano pronto, só a decisão de executar falta. Esforço: baixo. Risco de não fazer: crítico e crescente.
2. **Autorizar push/deploy do hardening já preparado** (GitHub Pages + Firestore Rules das 7 coleções) — commits locais prontos, testados, aguardando só autorização.
3. **Homologação manual + aprovação formal do RBAC Sprint 3 (Estoque+Caixa)** — já implementado e verificado, só falta o passo formal. Esforço: baixo. Bloqueia RBAC Sprint 4/5.
4. **Investigar o gap de gate client-side vs. Rules reais nos 9 módulos sem `initModulo()`** — esforço médio (é investigação, não é fix ainda), risco potencialmente alto dependendo do resultado.
5. **RBAC Sprint 4 (Financeiro) e Sprint 5 (OS)** — depende do item 3. Esforço alto (módulos sensíveis).
6. **Limpeza de código morto** (`tenant.js`, `listener-manager.js`, diretórios `BACKUP_*`) — baixo esforço, baixo risco, alto ganho de clareza.
7. **CI mínima**: rodar `npm test` (as 2 suítes existentes) automaticamente em push/PR — baixo esforço, previne regressão silenciosa.
8. **Migrar `doLogin()`/`_listenOS()` do Portal para fechar `os.list`** — pendência formal da Sprint 1b, exige decisão de arquitetura (mecanismo substituto ao onSnapshot). Esforço médio-alto.
9. **Revisão de escopo da Fase 3 do Master Roadmap** (empresa_id/multiempresa desatualizado) — pré-requisito antes de qualquer trabalho de "consolidação de arquitetura".

## Ordem técnica sugerida (dependências)

```
Sprint 0 (credencial)          [independente, urgente]
   │
Sprint 0.5 (GitHub Pages)      [independente]
   │
Homologação RBAC Sprint 3      [independente, já pronto]
   │
   ├── RBAC Sprint 4 (Financeiro)
   │        │
   │        └── RBAC Sprint 5 (OS)
   │
Rules das 7 coleções órfãs — JÁ PREPARADO [aguarda autorização p/ deploy]
   │
Investigação dos 9 módulos     [pode rodar em paralelo com RBAC]
sem gate client-side
   │
Limpeza de código morto        [independente, a qualquer momento]
   │
CI mínima                      [independente, a qualquer momento]
   │
Migração os.list/login         [maior esforço, decisão de arquitetura própria]
   │
Revisão de escopo Fase 3        [pré-requisito para consolidação futura]
```

## Estimativa qualitativa de esforço

| Item | Esforço | Risco de execução |
|---|---|---|
| Rotacionar credencial | Baixo | Médio (pode quebrar consumidores da chave atual se não migrados primeiro) |
| Excluir docs do Pages | Baixo | Baixo |
| Homologação RBAC Sprint 3 | Baixo | Baixo |
| Rules das 7 coleções órfãs (já preparado) | Baixo | Baixo |
| Investigar gate dos 9 módulos | Médio (investigação) | Baixo |
| RBAC Sprint 4 (Financeiro) | Alto | Médio-Alto (módulo sensível) |
| RBAC Sprint 5 (OS) | Alto | Alto (maior dependência cruzada do sistema) |
| Limpeza de código morto | Baixo | Baixo |
| CI mínima | Baixo | Baixo |
| Migrar login/listener (fechar os.list) | Médio-Alto | Médio (toca Login, exige autorização explícita) |
| Revisão de escopo Fase 3 | Médio (planejamento) | Baixo |

## Recomendações para evolução do sistema

- Tratar a rotação de credencial como item isolado e urgente, não como parte de uma sprint de produto — é resposta a incidente, não desenvolvimento.
- Formalizar CI antes de crescer mais a base de testes — hoje o esforço de escrever testes não é protegido contra regressão de alguém simplesmente não rodar `npm test`.
- Adotar `initModulo()`/`kernel.js` como padrão obrigatório para módulos novos a partir de agora, e tratar os 9 módulos legados como dívida a ser paga gradualmente (não em bloco) — mesmo princípio de "um módulo por vez" já usado no RBAC.
- Antes de qualquer nova funcionalidade em Financeiro/OS, fechar RBAC Sprints 4/5 — evita construir sobre controle de acesso incompleto.
- Revisar a Fase 3 do Master Roadmap antes de tratá-la como próxima fase "natural" — o escopo documentado não corresponde à arquitetura real do sistema.

## Fase 5 — Push do hardening e revalidação (2026-07-06, sessão de continuação)

Sessão de continuação, autorizada a fazer push do hardening (commits `bbafce6`, `4bc8f43`, `e6475fb`, `7e269ef`) mas **não** autorizada a rotacionar credenciais, promover a `main` ou fazer deploy — nenhuma dessas três foi executada.

1. **Push**: os 4 commits foram enviados via fast-forward para `origin/develop` (`f0d2389..7e269ef`), a pedido explícito do dono. Sem merge commit, sem conflito.
2. **Revalidação dos testes** (ambiente desta sessão não tinha `node`/`npm`/`firebase` no `PATH` por padrão — disponíveis via `nvm`, `~/.nvm/versions/node/v22.23.1/`): as duas suítes existentes foram reexecutadas do zero via emulador local, **77/77 aprovados** (52/52 Rules + 25/25 Cloud Functions) — não é reaproveitamento do número já registrado no TECHDOC, é execução nova desta sessão.
3. **Rules confirmadas puramente aditivas**: leitura do release ativo de `cellcity-crm-dev` via `firebaserules.googleapis.com` (GET, somente leitura) mostrou o ruleset publicado em produção-DEV mais recente (`updateTime: 2026-07-06T13:11:02Z`, anterior às 4 commits de hardening) — `diff` contra `CRM/firestore.rules` local confirma que a única diferença são os blocos `match` novos das 7 coleções órfãs + comentários; nenhuma regra existente foi alterada ou removida.
4. **Checklist de pré-deploy do script de autonomia — resultado**: 3 de 4 itens aprovados (Rules compilam sem erro — confirmado pela própria subida do emulador; Cloud Functions operacionais — confirmado pelos testes de unidade contra os handlers reais; RBAC íntegro e sem regressão — confirmado pelos 77 casos, incluindo os de não-regressão). **1 item reprovado, bloqueante**: a credencial comprometida (service account de produção, 2 chaves `USER_MANAGED` sem expiração) segue ativa — tentativa de confirmação independente via `gcloud iam service-accounts keys list` contra a service account de produção retornou `PERMISSION_DENIED` (a credencial ativa nesta sessão, de DEV, não tem permissão sobre IAM de produção) — reforça que a rotação exige a conta do próprio dono (`itamaratento@gmail.com`, já autenticada localmente) ou uma role adicional, não pode ser feita por esta sessão sem elevação de acesso.
5. **Conclusão desta fase**: deploy segue **bloqueado** pelo próprio critério do checklist (item 4 falhou) — não seria executado mesmo que autorizado neste momento, até a rotação da credencial ser resolvida ou explicitamente aceita como risco residual pelo dono.

## Fase 6 — Planos de deploy e rollback (preparados, não executados)

Documentados agora para que a execução, quando autorizada, seja mecânica — sem decisões de desenho pendentes no momento do deploy.

### Plano de deploy

**Pré-requisito bloqueante:** rotação (ou aceite formal do risco residual) das 2 chaves da service account de produção — sem isso, o próprio checklist de pré-deploy reprova.

1. Deploy das Firestore Rules (aditivas: 7 coleções órfãs) em `cellcity-crm-dev` primeiro, via API REST direta (`firebaserules.googleapis.com`) — mesmo caminho já usado nos deploys anteriores desta sprint, já que o Firebase CLI não tem login interativo disponível neste ambiente.
2. Confirmar por leitura (GET) do release ativo que o ruleset publicado é o esperado (mesma checagem já feita nesta sessão para o estado pré-deploy).
3. Smoke test manual dos 9 módulos afetados pelas novas regras (Diário, Central de Alertas, Cadastro de Chip, Contas e Pendências, Central de Organização, rotina de backup do Dashboard, Catálogo) com staff aprovado — confirmar leitura/escrita OK e nenhum `permission-denied` novo.
4. Repetir 1-3 em produção (`cellcity-crm`) só depois de DEV validado.
5. Exclusão de `plans/`, `CLAUDE.md` e `CRM/pages/kernel-test/` do artefato do GitHub Pages (`.github/workflows/deploy-pages.yml`) — só surte efeito depois que esse workflow existir em `main` (portanto depende do merge `develop → main`, fora do escopo autorizado agora).
6. Ordem entre 1-4 e 5 é independente (podem ser feitos em qualquer ordem relativa entre si), mas ambos dependem do pré-requisito bloqueante acima.

### Plano de rollback

1. Snapshot do ruleset ativo pré-deploy já capturado nesta sessão (leitura via API, guardado localmente) — serve de base para reverter caso o deploy cause `permission-denied` inesperado em produção real.
2. Se qualquer um dos 9 módulos apresentar regressão: republicar o ruleset anterior via a mesma API (`firebaserules.googleapis.com`), mesmo método já validado no hotfix P0 de 2026-07-05 (§17.7 do TECHDOC) — reversível em minutos, sem downtime.
3. Rollback do workflow do GitHub Pages: revert simples do commit em `main` (sem force-push) — o artefato publicado volta a incluir os arquivos excluídos até o próximo deploy.
4. **Fora do escopo deste rollback**: a rotação de credencial em si não tem "desfazer" simples uma vez que as chaves antigas sejam excluídas (não apenas desabilitadas) — por isso o plano de rotação já documentado no INTERNO usa desabilitação com janela de confirmação antes da exclusão definitiva, item específico a tratar separadamente quando essa etapa for autorizada.

## Fase 7 — Rotação de credencial executada (2026-07-06, autorizada explicitamente pelo dono)

Executada com a conta do dono (`itamaratento@gmail.com`, único acesso com permissão de IAM sobre a service account de produção — a conta de serviço não tem permissão sobre suas próprias chaves, confirmado por `PERMISSION_DENIED` numa tentativa inicial).

1. **Inventário confirmado**: exatamente as 2 chaves `USER_MANAGED` sem expiração já catalogadas no INTERNO, mais 4 `SYSTEM_MANAGED` (auto-rotacionadas pelo Google, fora do escopo, não tocadas).
2. **Dependências confirmadas por grep**: nenhuma Cloud Function em produção usa essa chave (identidade de runtime própria, sem `GOOGLE_APPLICATION_CREDENTIALS`/`keyFile` no código). Só 2 scripts administrativos ad-hoc (`_runtime_audit/list-prod-collections.mjs`, `_runtime_audit/seed-dev-export.mjs`) leem `sa-key.json` do disco — não fazem parte de nenhum serviço rodando.
3. **3ª chave gerada** para `firebase-adminsdk-fbsvc@cellcity-crm.iam.gserviceaccount.com`, validada com uma leitura real (GET) contra a API de produção antes de tocar nas antigas.
4. **`sa-key.json` local substituído** pelo conteúdo da chave nova (arquivo gitignorado, nunca commitado) — os 2 scripts administrativos continuam funcionando sem alteração de código.
5. **As 2 chaves comprometidas foram DESABILITADAS** (não excluídas) — confirmado por inventário (`disabled: True` em ambas) e por uma tentativa real de autenticação com a chave antiga, que falhou (`invalid_grant`). A chave nova segue funcionando (confirmado de novo, depois da desabilitação).
6. **Revalidação completa pós-rotação**: as duas suítes de teste reexecutadas do zero, **77/77** (52/52 Rules + 25/25 Functions) — sem regressão. Cloud Functions de produção não foram afetadas (nunca dependeram desta chave).
7. **Exclusão definitiva executada** (mesma sessão de continuação, autorização explícita do dono): após reconfirmar as 3 pré-checagens (chave nova funcional, nenhum serviço usa as antigas — incluindo verificação adicional de `.github/workflows/backup-weekly.yml`, que usa SSH deploy key e não tem nenhuma relação com Firebase — e ausência de erro de autenticação), as 2 chaves antigas foram excluídas definitivamente do IAM. Inventário pós-ação confirma que só a chave nova existe; chave nova confirmada funcional depois da exclusão. **Incidente de credencial encerrado de forma definitiva.**

**Achado novo, fora do escopo desta rotação**: `.github/workflows/deploy-pages.yml` (hardening desta auditoria, ainda não deployado) exclui `plans/`, `CLAUDE.md` e `CRM/pages/kernel-test/` do GitHub Pages, mas **não exclui `CRM/TECHDOC.md`**, que é servido publicamente hoje (confirmado pela lista de exclusões do workflow) e continuará sendo mesmo depois deste hardening. Nenhum ID de chave real ou material de chave privada foi encontrado em `CRM/TECHDOC.md` ou neste documento (confirmado por grep) — mas o gap de exclusão em si é um achado a avaliar numa próxima iteração do hardening.

**Residual conhecido, não limpo nesta sessão** (fora do escopo dos 7 passos, mas registrado por transparência): cópias adicionais da chave agora desabilitada (`a3e14f26...`) mencionadas no INTERNO em `~/TesteBackup/` e em snapshots antigos de `_BACKUPS/` — já inofensivas após a desabilitação, mas ainda pendentes de limpeza física por higiene.

## Fase 8 — Exclusão definitiva das chaves e encerramento técnico do incidente (2026-07-06)

Autorizada explicitamente pelo dono como continuação da Fase 7, com pré-checagem obrigatória antes da ação irreversível.

1. **Pré-checagens (as 3 exigidas antes de qualquer exclusão)**: chave nova confirmada funcional (GET real contra produção, HTTP 200); nenhum serviço usa as chaves antigas — reconfirmado por grep, incluindo uma varredura adicional não feita antes desta fase (`.github/workflows/backup-weekly.yml` e `scripts/backup/backup-automatic.sh`, que usam SSH deploy key para replicar o repositório, sem nenhuma relação com Firebase/Admin SDK); autenticação local limpa (só `itamaratento@gmail.com` ativa, sem erros).
2. **As 2 chaves comprometidas foram excluídas definitivamente** do IAM (`gcloud iam service-accounts keys delete`).
3. **Confirmado por inventário pós-ação**: só a chave nova (`...9dba0f`) aparece como `USER_MANAGED` na service account de produção — as 2 antigas não existem mais, em lugar nenhum.
4. **Chave nova reconfirmada funcional** depois da exclusão (nova leitura real contra produção, HTTP 200).

**Encerramento técnico da rotação**: o incidente de credencial vazada (conhecido desde 2026-07-03, achado crítico desta auditoria) está **resolvido de forma definitiva e irreversível** — não existe mais nenhuma chave comprometida ativa, desabilitada ou de qualquer forma presente no IAM do projeto de produção. Pendência remanescente, de baixo risco e puramente cosmética (as chaves em si não têm mais validade): limpeza física das cópias locais residuais (`TesteBackup/`, `_BACKUPS/` antigos, `~/Downloads/`) — registrada como item de backlog, não bloqueia o encerramento do incidente.

## Fase 9 — Deploy do hardening, promoção para main e encerramento da Sprint (2026-07-06)

Detalhe operacional completo em `CRM/TECHDOC.md` §21. Resumo:

1. Firestore Rules (7 coleções órfãs) deployadas em `cellcity-crm-dev` e `cellcity-crm`, confirmadas idênticas ao arquivo local via API.
2. GitHub Pages: achado que os pushes de documentação para `develop` já vinham publicando automaticamente as exclusões em produção (o workflow reconstrói o site inteiro a cada push, em qualquer um dos 2 branches) — confirmado 404 real em `plans/`, `CLAUDE.md`, `kernel-test/`.
3. Promoção `develop → main`: fast-forward limpo `09b861a..cbe68c6`, tag `v2026.07.06-2226`. Checklist manual do CLAUDE.md §5 dispensado explicitamente pelo dono (sem navegador disponível nesta sessão).
4. **Quase-incidente identificado e corrigido antes de declarar sucesso**: as 12 Cloud Functions do Portal (Sprint 1b) nunca tinham sido deployadas em produção (só em DEV) — o site novo já as chamava. Corrigido com `firebase deploy --only functions --project cellcity-crm`; validado por 3 chamadas HTTP reais (2 novas + 1 pré-existente, sem regressão).
5. Efeitos colaterais encontrados e corrigidos na própria sessão: bug de versionamento no `subir-ok` (contornado manualmente) e uma captura acidental de arquivos não relacionados pelo `backup-manual.sh` (revertida; 2 arquivos apagados fisicamente pelo revert foram recuperados do histórico do git sem perda de dado).

**Status final da Sprint 1b: promovida e publicada em produção com sucesso.** Incidente de credencial encerrado. Hardening ativo em DEV e PROD. Nenhuma pendência crítica de segurança em aberto. Pendências não-críticas remanescentes: exposição de `CRM/TECHDOC.md` no GitHub Pages (achado novo, backlog), limpeza de cópias residuais de chave (cosmético), commits órfãos de "Camada Repository" em `develop` local (fora do escopo desta Sprint), bug de versionamento do `subir-ok` (fora do escopo desta Sprint).
