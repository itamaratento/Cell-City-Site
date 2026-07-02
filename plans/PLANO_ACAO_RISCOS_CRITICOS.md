# 🚨 PLANO DE AÇÃO — RISCOS CRÍTICOS (Fase 3)

> **Natureza deste documento:** diagnóstico e planejamento. Nenhuma alteração foi executada — nenhuma credencial foi rotacionada, nenhuma Firestore Rule foi alterada, nenhum código ou documento existente foi modificado. Ver confirmação explícita ao final.
> Aprofunda os riscos críticos identificados em [`FASE_3_VALIDACAO.md`](FASE_3_VALIDACAO.md) com diagnóstico técnico suficiente para uma decisão de correção formal — a execução em si requer aprovação explícita, separada deste documento.

---

## Resumo executivo

Os três diagnósticos desta etapa **pioraram, não confirmaram apenas**, a avaliação de risco anterior:

1. **Credencial exposta**: encontrei **duas chaves distintas** da mesma service account (`firebase-adminsdk-fbsvc@cellcity-crm.iam.gserviceaccount.com`) espalhadas em 3 locais no disco local. A chave vazada no histórico do git (`a3e14f26...`) **continua sendo a chave ativa** usada pelo `gcloud` nesta máquina hoje. Uma segunda chave (`824bef7c77...`), gerada em 2026-06-29 — 4 dias depois do vazamento, provavelmente numa tentativa de rotação — está esquecida em `~/Downloads/`, nunca aplicada ao projeto nem à sessão local. **Isto sugere uma rotação iniciada e nunca concluída.**
2. **Firestore Rules**: a matriz completa "Coleção × Módulo × Rule" encontrou **9 coleções** usadas por código ativo sem nenhuma regra no ruleset em produção — não as 3 identificadas por amostragem na validação anterior. Inclui `chips_cadastros` (módulo de Cadastro de Chip) e `contas_numeros`.
3. **Documentação**: `PROXIMA_ETAPA.md` contém uma **instrução operacional ativa** ("próxima tarefa: executar Setup Master, migração e `firebase deploy`") apontando para o modelo SaaS/multiempresa que foi **revertido** no rollback de 2026-06-27. Se alguém (humano ou IA, em outro terminal) seguir esse documento sem saber que está obsoleto, o resultado seria tentar reativar uma arquitetura descontinuada.

Nenhuma correção foi implementada. As seções abaixo detalham evidência, risco, plano de mitigação e checklist para cada item, prontos para aprovação formal antes da execução.

---

## PRIORIDADE 1 — Credencial do Google Cloud

### 1.1 Onde a credencial é utilizada

**Busca exaustiva em código do projeto**: `grep -rln "sa-key\|GOOGLE_APPLICATION_CREDENTIALS"` em todo `.js`/`.json`/`.sh`/`.env*`/`.yml` do projeto (excluindo `node_modules`/`_BACKUPS`) — **zero ocorrências**. Também não há menção em `~/.bashrc`, `~/.profile`, `~/.zshrc`, nem na variável de ambiente atual do processo.

**Os 3 scripts Node do projeto não usam `sa-key.json`:**
- `backup-server.js` — não usa Firebase Admin, é só um servidor HTTP local para servir backups.
- `backup-dados.js` — usa `firebase/app` (SDK client, não admin), autentica via `signInAnonymously`.
- `apply-cors.js` — usa o token OAuth do `firebase login` (arquivo `~/.config/configstore/firebase-tools.json`), não `sa-key.json`.
- `_runtime_audit/inspect-phones.js` — também usa o SDK client com API key pública, não a service account.

**Conclusão: nenhum script ou aplicação do próprio projeto depende de `sa-key.json`.** O único uso confirmado é manual: alguém rodou `gcloud auth activate-service-account --key-file=sa-key.json` nesta máquina (confirmado abaixo).

### 1.2 Aplicações, scripts e serviços dependentes

- **`gcloud` CLI local**: `gcloud auth list` mostra a conta `firebase-adminsdk-fbsvc@cellcity-crm.iam.gserviceaccount.com` como ativa. O diretório de credenciais (`~/.config/gcloud/legacy_credentials/firebase-adminsdk-fbsvc@.../`) foi criado em **2026-07-01 13:51** (hoje) — alguém ativou essa credencial manualmente hoje, antes desta sessão de auditoria.
- **Nenhum cron job** (`crontab -l` vazio) nem **serviço systemd** (`systemctl list-units` sem nada relacionado a "cell/backup/firebase") depende dela.
- Uso é 100% manual/ad-hoc via `gcloud`, não automatizado.

### 1.3 Mais de uma chave ativa?

**Confirmado: existem pelo menos duas chaves distintas em disco**, com `private_key_id` diferentes:

| Local | `private_key_id` | Data do arquivo |
|---|---|---|
| `Cell-City-Site/sa-key.json` (projeto ativo) | `a3e14f2648ee9dd411feb09097dca77ee105c242` | 2026-06-25 11:43 |
| `TesteBackup/Cell-City-Site/sa-key.json` (cópia antiga do projeto) | `a3e14f2648ee9dd411feb09097dca77ee105c242` | 2026-06-25 11:43 (mesma chave) |
| `~/Downloads/cellcity-crm-firebase-adminsdk-fbsvc-824bef7c77.json` | `824bef7c77ad2e0cb81b068cb38df929d483ff36` | **2026-06-29 20:58** |
| Credencial ativa no `gcloud` local (`legacy_credentials/.../adc.json`) | `a3e14f2648ee9dd411feb09097dca77ee105c242` (a **vazada**) | ativada 2026-07-01 13:51 |

O nome do arquivo em `~/Downloads/` (`...-824bef7c77.json`) é exatamente o padrão que o Console do Firebase usa ao gerar uma nova chave para download — **forte indício de que uma rotação foi iniciada em 2026-06-29** (4 dias após o vazamento), mas:
- a chave nova nunca substituiu `sa-key.json` no projeto;
- a sessão `gcloud` local continua usando a chave **antiga/vazada**, não a nova;
- não há evidência de que a chave antiga tenha sido revogada no IAM (não foi possível confirmar via API — ver limitação abaixo).

**Não foi possível confirmar programaticamente, via `gcloud iam service-accounts keys list`, quantas chaves estão de fato ativas no IAM** — a API IAM não está habilitada no projeto (`cellcity-crm`) e habilitá-la seria uma ação de alteração de configuração de projeto, fora do escopo desta etapa (somente diagnóstico). **Recomenda-se verificar manualmente**: Console Firebase/GCP → IAM & Admin → Service Accounts → `firebase-adminsdk-fbsvc@cellcity-crm.iam.gserviceaccount.com` → aba "Keys", para listar todas as chaves ativas e suas datas de criação.

### 1.4 Impacto da rotação da credencial

- **Zero impacto em produção/usuários finais**: o site e o CRM em produção são servidos estaticamente (GitHub Pages) e autenticam usuários via Firebase Auth client-side — nada disso depende desta service account.
- **Impacto local/operacional**: qualquer fluxo manual que dependa da sessão `gcloud` ativa hoje (ex: consultas administrativas ad-hoc, como as feitas nesta própria auditoria via `firebaserules.googleapis.com`) vai falhar até a sessão ser reautenticada com uma chave válida.
- Nenhum script do projeto quebra (confirmado no item 1.1).

### 1.5 Plano de rotação sem indisponibilidade (proposto, não executado)

1. Verificar no Console GCP/Firebase quantas chaves existem hoje na service account `firebase-adminsdk-fbsvc@cellcity-crm.iam.gserviceaccount.com`.
2. Se a chave `824bef7c77...` (a de 2026-06-29) ainda existir e estiver ativa no IAM, ela já pode ser promovida a chave "oficial" — não seria necessário gerar uma terceira. Testá-la localmente antes de revogar qualquer coisa.
3. Se preferir uma chave nova (recomendado, já que a `824bef7c77...` também ficou exposta sem proteção em `~/Downloads/` por dias): gerar uma nova chave via Console.
4. **Não revogar a chave antiga (`a3e14f26...`) imediatamente** — mantê-la ativa em paralelo por uma janela curta (ex: algumas horas) só até confirmar que a nova chave funciona para o(s) uso(s) manual(is) que o usuário tiver.
5. Após confirmar que a nova chave funciona: revogar/excluir a chave antiga (`a3e14f26...`) no IAM — essa é a etapa que efetivamente neutraliza o vazamento do histórico do git.
6. Atualizar a sessão `gcloud` local: `gcloud auth revoke firebase-adminsdk-fbsvc@cellcity-crm.iam.gserviceaccount.com` seguido de `gcloud auth activate-service-account --key-file=<nova_chave>.json`.

### 1.6 Arquivos, variáveis e configurações a atualizar

| Ação | Local |
|---|---|
| Excluir (após confirmar nova chave funcional) | `Cell-City-Site/sa-key.json` |
| Excluir | `TesteBackup/Cell-City-Site/sa-key.json` (cópia antiga do projeto, mesma chave vazada) |
| Excluir ou proteger (mover para local não sincronizado/indexado) | `~/Downloads/cellcity-crm-firebase-adminsdk-fbsvc-824bef7c77.json` |
| Reautenticar | Sessão `gcloud` local (`legacy_credentials/firebase-adminsdk-fbsvc@.../`) |
| Nenhuma alteração necessária | Código do projeto (`backup-server.js`, `backup-dados.js`, `apply-cors.js`, `_runtime_audit/`) — nenhum usa `sa-key.json` |

Nenhum arquivo do projeto sob controle de versão precisa ser tocado (já que `sa-key.json` está no `.gitignore` e não é referenciado em nenhum script versionado).

### 1.7 Plano de rollback

Como nenhum processo automatizado depende desta chave, o risco de rollback é baixo. Se a rotação causar algum problema inesperado (ex: algum uso manual não documentado que dependia da chave antiga):
1. A chave antiga só deve ser **excluída do IAM** depois de confirmado que a nova funciona (passo 4 do plano acima) — enquanto ambas coexistem, não há necessidade de rollback.
2. Se, mesmo assim, algo quebrar após a exclusão da chave antiga: gerar uma chave nova adicional imediatamente (o processo de geração é instantâneo e não exige aprovação de terceiros) — não é necessário "restaurar" a chave excluída, já que ela foi comprometida e não deveria voltar a ser usada de qualquer forma.

### 1.8 Checklist de validação após a rotação (quando aprovada)

- [ ] Confirmar no Console IAM que a chave `a3e14f26...` foi excluída/desabilitada.
- [ ] Confirmar que `sa-key.json` não existe mais em nenhum dos 3 locais listados.
- [ ] Confirmar que `gcloud auth list` mostra a nova chave (ou nenhuma sessão de service account ativa, se não for mais necessária).
- [ ] Testar qualquer fluxo manual que o usuário costuma rodar com essa credencial, para garantir que não quebrou.
- [ ] Confirmar que nenhum teste do site/CRM em produção foi afetado (não deveria, pois nada em produção usa essa chave).

---

## PRIORIDADE 2 — Firestore Rules

### 2.1 Comparação: `CRM/firestore.rules` vs regras publicadas

Reconfirmado nesta etapa (consistente com a validação anterior): `firebase.json` aponta `"rules": "CRM/firestore.rules"` como arquivo de deploy. A auditoria anterior já havia confirmado, via `GET https://firebaserules.googleapis.com/v1/projects/cellcity-crm/releases/cloud.firestore`, que o ruleset ativo em produção é **byte-a-byte idêntico** a `CRM/firestore.rules` local — ou seja, não há dúvida sobre qual arquivo é a fonte da verdade.

### 2.2 Matriz completa "Coleção × Módulo × Rule"

Mapeamento exaustivo (não apenas amostragem) de todas as coleções de primeiro nível referenciadas em `CRM/pages/*/*.js` e `CRM/shared/*.js`, cruzadas contra os blocos `match` de `CRM/firestore.rules`:

**Coleções usadas por módulo ativo SEM nenhuma regra correspondente (achado principal desta etapa):**

| Coleção | Módulo(s) que usam | Risco |
|---|---|---|
| `central_organizacao` | `central-organizacao/central.js` | Alto |
| `diario_eventos` | `diario/diario.js` (histórico/timeline do Diário) | Alto |
| `favoritos_usuarios` | `shared/favoritos.js` (usado por dashboard, caixa, relatórios, sidebar) | Alto — é utilitário compartilhado, maior superfície |
| `contas_numeros` | `contas/contas.js` | Alto |
| `alertas_usuario` | `crm-comercial/crm.js` | Médio |
| `chips_cadastros` | `crm-comercial/chips.js`, `chips-entrada.js` (módulo de Cadastro de Chip) | Alto |
| `catalogo_config` | `catalogo/catalogo.js` (config do catálogo, distinta de `catalogo_produtos`, que tem regra) | Médio |
| `notificacoes_saas` | `shared/tenant.js` (função `_registrarVencimento`) | Baixo — só executa se `usuarios-permissoes.js` acionar o "modo suporte" |
| `auditoria_saas` | `shared/tenant.js` (função `logAuditoria`, mesma via de acesso acima) | Baixo — mesma ressalva |

**Nota sobre as duas últimas**: `shared/tenant.js` é importado por exatamente **1 módulo** (`usuarios-permissoes.js`, para uma funcionalidade específica de "modo suporte" de master admin) — não é código totalmente morto como uma leitura rápida sugeriria, mas o caminho de execução é estreito (só aciona se um master admin usar essa função específica).

**Coleções com regra mas sem uso confirmado no código** (podem ser legado real, ou usadas de um jeito que a busca não capturou — tratar como "não confirmado", não como "certamente morto"): `historico_diario`, `historico_semanal`, `historico_mensal`, `resumo_live`, `acoes_semana`, `posvenda_rastreamento`, `estoque` (distinta de `estoque_produtos`, que é a usada de fato), `_diagnostico_temp`.

**Resumo numérico**: 36 coleções com regra no arquivo ativo; 42 coleções usadas no código **com** regra; **9 coleções usadas no código sem regra**; 8 coleções com regra sem uso confirmado (possível limpeza futura, não é risco).

### 2.3 Funcionalidades que dependem dessas coleções

- **Central de Organização** (`central_organizacao`) — módulo de organização de tarefas/setores.
- **Diário** (`diario_eventos`) — histórico/linha do tempo de eventos do módulo Diário (a coleção principal `diario_registros` tem regra; só a sub-funcionalidade de eventos não tem).
- **Favoritos** (`favoritos_usuarios`) — usado na home e sidebar, recurso transversal usado por praticamente todo usuário logado.
- **Contas e Pendências** (`contas_numeros`) — módulo de gestão de contas/pendências.
- **CRM Comercial — Alertas** (`alertas_usuario`) — alertas dentro do módulo de CRM comercial.
- **Cadastro de Chip** (`chips_cadastros`) — módulo específico documentado na memória do projeto.
- **Catálogo — configuração** (`catalogo_config`) — configurações do catálogo público.
- **Modo suporte SaaS** (`notificacoes_saas`, `auditoria_saas`) — funcionalidade estreita dentro de Usuários e Permissões.

### 2.4 Avaliação de impacto de uma futura correção

Adicionar um bloco `match` por coleção faltante é uma alteração **aditiva e isolada** (não modifica nenhuma regra existente) — o risco de regressão em módulos já funcionando é baixo, desde que cada regra nova siga o padrão de autenticação já usado nas regras vizinhas (ex: `if request.auth != null` + checagem de perfil, consistente com o padrão do restante do arquivo). Ainda assim, por tocar Firestore Rules — componente crítico do projeto — a correção deve passar pelo processo formal já estabelecido: testes via emulador (`@firebase/rules-unit-testing`) antes do deploy, e verificação do release ativo via API depois do deploy (não confiar só na confirmação visual do Console).

**Ainda não confirmado em runtime** se essas 9 coleções estão de fato causando falhas visíveis hoje (permissão negada) — isso não foi testado nesta etapa (ficaria fora do escopo de "somente leitura"). Recomenda-se, antes de escrever qualquer regra nova, checar os logs de erro do Firestore no Console (Firestore → Uso → aba de erros, ou monitorar o console do navegador ao usar Central de Organização, Diário, Favoritos, Contas, Chips e Catálogo) para confirmar quais dessas 9 estão realmente bloqueadas em produção agora.

---

## PRIORIDADE 3 — Documentação

### 3.1 `PROXIMA_ETAPA.md` — CRÍTICO

O documento apresenta, na seção "🎯 PRÓXIMA TAREFA — Ativação do SaaS" (datada de 24/06/2026), uma **instrução operacional ativa**: executar Setup Master, rodar a migração multiempresa e `firebase deploy --only firestore:rules,hosting` do modelo SaaS/multiempresa. Essa arquitetura **foi revertida no rollback de 2026-06-27** — `shared/modulo-guard.js` e as páginas `CRM/pages/saas/{setup,migration,homolog}.html` citadas nessa instrução não existem mais no código ativo. O rodapé do arquivo ("Última atualização: 08/06/2026") não bate com o bloco do topo (24/06/2026), evidenciando que o documento foi editado por cima sem revisar o restante.

**Risco**: se alguém — humano ou uma IA em outro terminal, sem o contexto desta auditoria — ler esse documento e seguir a "próxima tarefa" literalmente, tentaria reativar uma arquitetura já descontinuada, incluindo rodar `firebase deploy` de Rules antigas sobre o sistema atual.

### 3.2 `HISTORICO_PROJETO.md` — Alto

Documento parado em 14/06/2026, mas a seção "ARQUITETURA DO PROJETO" (linhas 22-219) se apresenta sem aviso de obsolescência. Divergências confirmadas: caminho Windows antigo (`b:/cell-City/`), afirma que o site é servido via **Firebase Hosting** (contradiz a proibição registrada na memória do projeto — hoje é GitHub Pages), afirma que módulos carregam via **iframe** (não é o padrão atual), lista só 19 módulos (hoje são 35), e cita `garantias` como coleção Firestore "planejada" (nunca foi implementada assim — garantia vive como campos dentro do documento `os`).

### 3.3 `ARQUITETURA_PORTAL_CLIENTE.md` — Médio

Documento de planejamento pré-implementação (04/06/2026), nunca marcado como superado. A estrutura de arquivos e a coleção `garantias` dedicada que descreve nunca foram implementadas dessa forma — a implementação real usa uma SPA (`portal.js`/`admin.js`) e campos dentro do documento `os`, não os arquivos/coleção descritos no plano.

### 3.4 `CRM/TECHDOC.md` — Baixo

Documento mais alinhado ao estado real (recriado 2026-06-30, atualizado 2026-07-01). Única divergência: a lista de "Catálogo de módulos" (linha 177) omite `dashboard`, `central-modulos` e `estrategia`, sendo a omissão de `dashboard` a mais notável por ser o módulo central do sistema.

### 3.5 Demais documentos revisados

- `RELATORIO_HOMOLOGACAO_ETAPA3.md` e `DIAGNOSTICO_ETAPA4.md` (dentro de `portal-cliente/`): documentos pontuais já superados pela implementação, sem se apresentarem como estado atual — divergência baixa, natureza histórica esperada.
- `plans/fase2-portal-admin.md`: plano superado por implementação mais ampla (ganhou aba "Agendamentos" não prevista), sem contradição factual.
- `plans/fase2-sprint1-dashboard-rbac.md`: o mais preciso de todos — já contém, na própria seção de recomendações, a correção sobre `shared/modulo-guard.js` não existir e a divergência de Firestore Rules.
- `plans/FASE_3_LEVANTAMENTO.md`, `FASE_3_VALIDACAO.md`: pequena divergência residual de contagem (37 vs 35 pastas de módulo; 12 vs 13 módulos com `initModulo()`) — variação esperada em projeto com desenvolvimento ativo diário, não é inconsistência grave.
- `plans/MELHORIA_CONTINUAR_PAREI.md`, `plans/MELHORIAS_OS.md`: fora do escopo temático (não tratam de arquitetura de dados/auth/multiempresa).

### 3.6 Impacto operacional da desatualização documental

O risco real não é a desatualização em si, mas o fato de `PROXIMA_ETAPA.md` se apresentar como **instrução ativa** em vez de histórico — qualquer processo (humano ou agente de IA) que confie nesse documento sem cruzar com o `MASTER_ROADMAP.md`/`TECHDOC.md` atuais corre o risco de reintroduzir a arquitetura SaaS já abandonada.

---

## Avaliação de risco consolidada

| Item | Risco | Urgência |
|---|---|---|
| Chave vazada (`a3e14f26...`) ainda ativa no `gcloud` local | **Crítico** | Imediata |
| Segunda chave (`824bef7c77...`) esquecida sem proteção em `~/Downloads/` | **Alto** | Imediata |
| `PROXIMA_ETAPA.md` instruindo reativação do SaaS revertido | **Crítico** (para planejamento/execução futura) | Imediata (correção documental) |
| 9 coleções ativas sem Firestore Rule | **Alto** | Alta — precisa confirmação em runtime antes da correção |
| `HISTORICO_PROJETO.md` desatualizado (Firebase Hosting, iframe, 19 vs 35 módulos) | Médio | Baixa (é rotulado como histórico, mas sem aviso de obsolescência) |
| `ARQUITETURA_PORTAL_CLIENTE.md` divergente do implementado | Baixo-Médio | Baixa (é plano pré-implementação) |
| `TECHDOC.md` — 3 módulos ausentes do catálogo | Baixo | Baixa |

## Ordem recomendada de execução (após aprovação formal)

1. **Verificar manualmente no Console GCP/Firebase** quantas chaves existem hoje na service account e suas datas — insumo necessário antes de decidir qual chave promover ou se gerar uma nova.
2. **Rotacionar a credencial** seguindo o plano da seção 1.5, incluindo remover as 3 cópias locais de `sa-key.json`/chave e reautenticar o `gcloud`.
3. **Confirmar em runtime** (navegador/console) se as 9 coleções da seção 2.2 estão de fato bloqueadas hoje.
4. **Escrever e homologar as regras faltantes** para as coleções confirmadas como bloqueadas, seguindo o processo formal (emulador + verificação via API pós-deploy).
5. **Corrigir `PROXIMA_ETAPA.md`** para remover/marcar como obsoleta a instrução de reativação do SaaS (maior risco documental).
6. **Corrigir `HISTORICO_PROJETO.md`, `ARQUITETURA_PORTAL_CLIENTE.md` e a lista de módulos do `TECHDOC.md`**, e as linhas do `MASTER_ROADMAP.md` já apontadas na validação anterior.

## Dependências entre os itens

- A rotação da credencial (item 1) **não depende de nada** — pode ser feita imediatamente e isoladamente.
- A confirmação em runtime das 9 coleções (item 3) **não depende da rotação da chave** — são investigações independentes, podem ocorrer em paralelo.
- A escrita das regras novas (item 4) **depende da confirmação do item 3** — não faz sentido escrever regra para coleção cujo bloqueio não foi confirmado como real.
- As correções documentais (itens 5-6) **não dependem de nada técnico** — podem ocorrer a qualquer momento, mas fazem mais sentido depois de itens 1-4 estarem resolvidos, para que a documentação corrigida já reflita o estado final.

## Plano de rollback (consolidado)

- **Credencial**: nenhum rollback necessário se a chave antiga só for excluída depois de confirmar a nova (ver 1.7).
- **Firestore Rules**: qualquer alteração deve manter uma cópia do ruleset ativo atual (via a mesma API `firebaserules.googleapis.com` usada nesta auditoria) antes do deploy; se a nova regra causar regressão, reverter é republicar o ruleset anterior salvo — mesmo padrão já usado nas Fases 1 e 2 do projeto.
- **Documentação**: sem risco técnico; qualquer edição é reversível via git (as correções documentais devem ser commitadas separadamente das correções de código/Rules, para facilitar reversão isolada se necessário).

## Checklist de validação após cada correção

**Após rotação da credencial:** ver checklist completo na seção 1.8.

**Após confirmação/correção das Firestore Rules:**
- [ ] Testar manualmente Central de Organização, Diário, Favoritos, Contas, Cadastro de Chip e Catálogo (config) em produção após a correção.
- [ ] Verificar console do navegador sem erros `permission-denied` nessas 6 áreas.
- [ ] Verificar via API `firebaserules.googleapis.com` que o release ativo corresponde ao novo `CRM/firestore.rules` após o deploy (não confiar só no Console).
- [ ] Rodar a suíte de testes de Rules via emulador (mesmo padrão da Fase 1/2) antes do deploy em produção.
- [ ] Confirmar zero regressão nos módulos já testados obrigatoriamente pelo `CLAUDE.md` (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente).

**Após correção documental:**
- [ ] Confirmar que `PROXIMA_ETAPA.md` não contém mais nenhuma instrução ativa apontando para o modelo SaaS revertido.
- [ ] Confirmar que `HISTORICO_PROJETO.md` e `ARQUITETURA_PORTAL_CLIENTE.md` recebem uma nota de "documento histórico/superado" no topo, caso não sejam totalmente reescritos.
- [ ] Confirmar que a lista de módulos do `TECHDOC.md` inclui `dashboard`, `central-modulos` e `estrategia`.

---

## Metodologia

Diagnóstico realizado com uma combinação de verificação direta (histórico do git, `gcloud auth list`, busca em disco por cópias da chave, comparação de `private_key_id` entre os arquivos encontrados) e duas auditorias somente-leitura em paralelo: uma para a matriz exaustiva "Coleção × Módulo × Rule" (varredura de todos os `CRM/pages/*/*.js` e `CRM/shared/*.js` cruzada contra `CRM/firestore.rules`), outra para a revisão de consistência de `CRM/TECHDOC.md`, `HISTORICO_PROJETO.md`, `PROXIMA_ETAPA.md`, `ARQUITETURA_PORTAL_CLIENTE.md` e demais documentos de `plans/` contra o estado real do código. Nenhuma chamada de API foi feita além de leituras (GET): `firebaserules.googleapis.com` (release ativo, já usada na validação anterior) e a API pública do GitHub (visibilidade do repositório, já usada na validação anterior — não repetida nesta etapa).

## ✅ Confirmação de que nenhuma alteração foi realizada

Durante este diagnóstico, todas as operações foram de **leitura**: buscas em disco (`find`, `grep`), leitura de arquivos de configuração e credenciais (sem modificá-los), comandos `git log`/`git show` (leitura de histórico), `gcloud auth list` (consulta de sessão, não altera nada), e uma tentativa de `gcloud iam service-accounts keys list` que **falhou por falta de API habilitada — nenhuma tentativa foi feita de habilitar essa API**, respeitando a restrição de não alterar configuração do projeto. **Nenhuma credencial foi rotacionada, nenhuma Firestore Rule foi alterada, nenhum código foi modificado, nenhum documento existente foi editado e nenhum deploy foi executado.** A única criação foi este próprio documento (`plans/PLANO_ACAO_RISCOS_CRITICOS.md`).
