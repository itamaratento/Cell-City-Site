# 🧪 VALIDAÇÃO FUNCIONAL DOS RISCOS CRÍTICOS

> **Natureza deste documento:** validação funcional com evidência de execução real, não apenas análise estática. **Nenhuma alteração foi feita no projeto, no Firestore de produção, no código ou em documentos existentes.** Os testes funcionais das Firestore Rules foram executados contra um **emulador local, isolado, fora do diretório do projeto**, usando uma cópia somente-leitura de `CRM/firestore.rules` — nenhum dado real de produção foi tocado, nenhuma credencial de produção foi usada, nenhum usuário real foi acessado. Ver metodologia e confirmação completas ao final.

---

## Nota metodológica importante (leia antes do resto)

O pedido original de validação funcional incluía testar Create/Update/Delete "utilizando usuários autenticados com diferentes perfis" nas 9 coleções — mas isso, se feito contra o Firestore **real** de produção, escreveria dados reais no banco, contradizendo a restrição "NÃO modificar banco de dados" do mesmo pedido. Também não há credenciais de usuários reais de diferentes perfis disponíveis nem apropriadas para uso nesta sessão.

Resolvi essa contradição com o método que o próprio projeto já usa para homologar Rules nas Fases 1 e 2: o **emulador local de Firestore** (`firebase emulators:exec` + `@firebase/rules-unit-testing`), carregado com uma cópia idêntica de `CRM/firestore.rules`. Isso permite simular usuários autenticados com perfis diferentes fazendo Read/Create/Update/Delete reais — só que contra um banco de dados **inteiramente local e descartável**, nunca contra produção. O ambiente Node.js necessário (via `nvm`, já presente na máquina) e o pacote de teste foram instalados isoladamente em `/tmp/.../scratchpad/rules-test/` — fora do diretório do projeto, sem tocar em nenhum arquivo do Cell City.

---

## Resumo executivo

**A hipótese de risco mais importante das auditorias anteriores foi confirmada com evidência de execução real, não mais só análise estática:**

🔴 **As 9 coleções identificadas estão de fato 100% bloqueadas** — testei Read, Create, Update e Delete para 3 perfis simulados diferentes (técnico, financeiro, admin) contra cada uma das 9 coleções: **108 de 108 tentativas foram negadas** com `permission-denied`, sem exceção, independente do perfil. Um usuário autenticado de qualquer perfil não consegue ler nem escrever em `central_organizacao`, `diario_eventos`, `favoritos_usuarios`, `contas_numeros`, `alertas_usuario`, `chips_cadastros`, `catalogo_config`, `notificacoes_saas` ou `auditoria_saas` hoje, nas Rules realmente publicadas em produção.

Como controle de validade do teste, rodei o mesmo conjunto de operações contra 3 coleções-irmãs que **têm** regra (`crm_leads`, `catalogo_produtos`, `diario_registros`): todas as 36 tentativas autenticadas foram **permitidas**, confirmando que o ambiente de teste está correto e que a diferença observada nas 9 coleções é real, não um artefato do teste.

**Isso significa, com alta confiança**: as funcionalidades **Central de Organização, Diário (histórico/timeline), Favoritos, Contas, Cadastro de Chip e Configuração do Catálogo estão hoje quebradas em produção** para qualquer operação de leitura ou escrita — não é uma hipótese, é o comportamento real das Rules ativas, testado.

Sobre credencial e documentação: nenhuma dependência externa nova foi encontrada (não há Cloud Functions nem Firebase Extensions usando a Service Account); a classificação de documentos confirma os achados anteriores, sem mudanças.

---

## 1. Validação das Firestore Rules — evidência de execução

### 1.1 Setup do teste

- Ambiente: `firebase emulators:exec --only firestore` com `@firebase/rules-unit-testing` v-mais-recente, Node v24.17.0 (via `nvm`, já presente na máquina).
- Rules carregadas: cópia byte-a-byte de `CRM/firestore.rules` (o arquivo confirmado como ativo em produção nas auditorias anteriores).
- 3 perfis simulados via `authenticatedContext(uid, { perfil })`: `tecnico`, `financeiro`, `admin` — nomes escolhidos para representar a diversidade de perfis operacionais do projeto (`perfis_operacionais`: Administrador, Financeiro, Caixa, Estoque, Técnico, Comercial, Atendimento).
- 1 contexto não autenticado, como controle negativo.
- Para `update`/`delete`, um documento foi pré-semeado via `withSecurityRulesDisabled()` (bypass só para preparar o cenário — não testa a regra em si, só garante que existe um documento para tentar atualizar/excluir).

### 1.2 Resultado — coleções sem regra (achado principal)

| Coleção | técnico | financeiro | admin |
|---|---|---|---|
| `central_organizacao` | read/create/update/delete: **NEGADO** (4/4) | **NEGADO** (4/4) | **NEGADO** (4/4) |
| `diario_eventos` | **NEGADO** (4/4) | **NEGADO** (4/4) | **NEGADO** (4/4) |
| `favoritos_usuarios` | **NEGADO** (4/4) | **NEGADO** (4/4) | **NEGADO** (4/4) |
| `contas_numeros` | **NEGADO** (4/4) | **NEGADO** (4/4) | **NEGADO** (4/4) |
| `alertas_usuario` | **NEGADO** (4/4) | **NEGADO** (4/4) | **NEGADO** (4/4) |
| `chips_cadastros` | **NEGADO** (4/4) | **NEGADO** (4/4) | **NEGADO** (4/4) |
| `catalogo_config` | **NEGADO** (4/4) | **NEGADO** (4/4) | **NEGADO** (4/4) |
| `notificacoes_saas` | **NEGADO** (4/4) | **NEGADO** (4/4) | **NEGADO** (4/4) |
| `auditoria_saas` | **NEGADO** (4/4) | **NEGADO** (4/4) | **NEGADO** (4/4) |

**108 de 108 operações negadas.** Nenhuma variação por perfil — confirma que a ausência de regra bloqueia igualmente todo mundo (não é um problema restrito a um perfil específico).

### 1.3 Resultado — coleções de controle (com regra, prova de que o teste é válido)

| Coleção | técnico | financeiro | admin |
|---|---|---|---|
| `crm_leads` | read/create/update/delete: **PERMITIDO** (4/4) | **PERMITIDO** (4/4) | **PERMITIDO** (4/4) |
| `catalogo_produtos` | **PERMITIDO** (4/4) | **PERMITIDO** (4/4) | **PERMITIDO** (4/4) |
| `diario_registros` | **PERMITIDO** (4/4) | **PERMITIDO** (4/4) | **PERMITIDO** (4/4) |

**36 de 36 operações permitidas** — confirma que o ambiente de teste reflete corretamente a regra `allow read, write: if request.auth != null;` já usada nessas coleções-irmãs, validando a metodologia.

### 1.4 Resultado — sem autenticação (controle negativo)

Todas as 12 coleções (9 sem regra + 3 de controle), sem token de autenticação: **100% negado**, como esperado — mesmo as coleções com regra exigem `auth != null`.

### 1.5 Funcionalidades afetadas (confirmado, não mais hipótese)

| Funcionalidade | Módulo | Operação bloqueada |
|---|---|---|
| Central de Organização | `central-organizacao/central.js` | Leitura e gravação de todas as seções |
| Diário — histórico/timeline de eventos | `diario/diario.js` | Registro e consulta de eventos (a tela principal do Diário, via `diario_registros`, continua funcionando — só o histórico de eventos está quebrado) |
| Favoritos | `shared/favoritos.js` (dashboard, caixa, relatórios, sidebar) | Leitura e gravação dos favoritos do usuário — afeta várias telas simultaneamente |
| Contas | `contas/contas.js` | CRUD completo do módulo |
| CRM Comercial — Alertas | `crm-comercial/crm.js` | Leitura e gravação de alertas de usuário |
| Cadastro de Chip | `crm-comercial/chips.js`, `chips-entrada.js` | CRUD completo do módulo |
| Catálogo — configuração | `catalogo/catalogo.js` | Leitura e gravação da config geral do catálogo (o catálogo de produtos em si, via `catalogo_produtos`, continua funcionando) |
| Modo suporte SaaS (uso raro) | `shared/tenant.js`, via `usuarios-permissoes.js` | Registro de notificações e auditoria de vencimento/suporte |

### 1.6 Dependências entre coleções afetadas

Nenhuma das 9 coleções depende de outra dentro do mesmo grupo — são todas independentes entre si. Mas 3 delas (`diario_eventos`, `catalogo_config`, `crm_leads`→controle) são **sub-funcionalidades de módulos que parcialmente funcionam** (a coleção principal do módulo tem regra, só uma parte específica não tem) — ou seja, o sintoma em produção provavelmente não é "o módulo inteiro não abre", e sim "uma função específica dentro do módulo falha silenciosamente" (histórico do Diário, config do Catálogo), o que é mais difícil de notar do que um módulo inteiro fora do ar.

### 1.7 Riscos confirmados vs. descartados

**Confirmados (com evidência de execução, não mais hipótese):**
- As 9 coleções estão de fato bloqueadas para todas as operações, para todos os perfis testados.
- A causa é puramente ausência de regra (`match` block) — não é uma condição de autenticação mal escrita nem uma restrição de perfil específica.

**Descartados/refinados nesta etapa:**
- A hipótese de que o bloqueio poderia variar por perfil (ex: só bloquear "técnico" mas permitir "admin") — **descartada**: o bloqueio é uniforme, todo perfil autenticado é negado igualmente.
- A hipótese de que poderia haver alguma regra "catch-all" não detectada na análise estática que permitisse acesso por outro caminho — **descartada**: o teste real confirma bloqueio total, consistente com a análise estática anterior.

---

## 2. Validação da Credencial

Sem nenhuma alteração de chave, reconfirmação e complemento do diagnóstico anterior:

### 2.1 Onde a Service Account é utilizada

Reconfirmado (sem mudanças em relação a `EXECUCAO_RISCOS_CRITICOS.md`): nenhum script do projeto usa `sa-key.json`; o único uso é manual, via `gcloud` local.

### 2.2 Dependência externa não identificada anteriormente?

Verificação adicional feita nesta etapa: `firebase.json` (raiz e `CRM/`) **não têm** seção `"functions"`; não existe pasta `functions/` no projeto; não há `extensions.json` nem qualquer configuração de Firebase Extensions. **Nenhuma dependência externa nova foi encontrada** — não há Cloud Functions nem Extensions que possam estar usando essa Service Account de forma não documentada.

### 2.3 Pontos que deverão ser atualizados durante a rotação (consolidado)

| Local | Ação necessária |
|---|---|
| `Cell-City-Site/sa-key.json` | Excluir após confirmar nova chave |
| `TesteBackup/Cell-City-Site/sa-key.json` | Excluir |
| `~/Downloads/cellcity-crm-firebase-adminsdk-fbsvc-824bef7c77.json` | Excluir ou mover para local protegido |
| Sessão `gcloud` local (`legacy_credentials/firebase-adminsdk-fbsvc@.../`) | Reautenticar com a nova chave |
| Código do projeto | Nenhuma ação — confirmado que nada depende de `sa-key.json` |
| Cloud Functions / Extensions | Nenhuma ação — confirmado que não existem |

### 2.4 Checklist de validação pós-rotação

- [ ] Chave antiga (`a3e14f26...`) revogada/excluída no IAM.
- [ ] `sa-key.json` removido dos 3 locais conhecidos.
- [ ] `gcloud auth list` mostra só a chave nova.
- [ ] Teste manual de qualquer fluxo administrativo local que dependa da credencial.
- [ ] Confirmação de que produção não foi afetada (esperado, já que nada em produção usa essa chave).

---

## 3. Validação da Documentação

Classificação final — **Válido / Precisa atualização / Deve ser arquivado** — sem editar nenhum arquivo:

| Documento | Classificação | Justificativa |
|---|---|---|
| **`PROXIMA_ETAPA.md`** | **Deve ser arquivado** (ou reescrito do zero) | Contém instrução operacional ativa para reativar o modelo SaaS/multiempresa revertido em 2026-06-27. Não é um caso de "atualizar um trecho" — a seção mais recente do documento (24/06/2026) inteira está desalinhada com o estado atual, e o rodapé (08/06/2026) mostra que o resto do arquivo é ainda mais antigo. Risco de uso indevido por terceiros/IA sem contexto é alto o suficiente para justificar arquivamento em vez de correção pontual. |
| **`HISTORICO_PROJETO.md`** | **Deve ser arquivado** (como está) **ou receber aviso explícito de obsolescência no topo** | Parado em 14/06/2026, sem qualquer aviso. A seção "ARQUITETURA DO PROJETO" descreve Firebase Hosting (proibido hoje), iframes (não é o padrão atual) e 19 módulos (hoje são 35) como se fosse o estado atual. É um documento de valor histórico genuíno, mas perigoso se lido como referência de arquitetura vigente. |
| **`ARQUITETURA_PORTAL_CLIENTE.md`** | **Precisa atualização** (ou nota de "documento de planejamento pré-implementação") | Já se apresenta como plano prospectivo (não como estado atual), o que reduz o risco — mas como não há nenhuma nota apontando para o que foi de fato implementado, alguém pode confundir. Adicionar uma nota no topo já resolveria a maior parte do risco, sem precisar reescrever o documento inteiro. |
| **`MASTER_ROADMAP.md`** | **Precisa atualização** | Linhas 94, 95, 105, 115, 192, 286 — já detalhado em `FASE_3_VALIDACAO.md`. É o documento mais importante de planejamento ativo do projeto — deveria ser o primeiro a ser corrigido entre os "precisa atualização". |
| **`CRM/TECHDOC.md`** | **Válido** (divergência mínima) | Só a omissão de 3 módulos (`dashboard`, `central-modulos`, `estrategia`) na lista de catálogo — correção pontual de uma linha, não compromete a confiabilidade geral do documento. |
| **`README.md`** (raiz e `CRM/`) | **Válido** (não aplicável) | Conteúdo trivial (`# cellcity-crm`), não há afirmação a validar. |
| `plans/fase2-sprint1-dashboard-rbac.md` | **Válido** | Já contém as correções sobre `modulo-guard.js` e divergência de Rules. |
| `plans/FASE_3_LEVANTAMENTO.md`, `FASE_3_VALIDACAO.md`, `PLANO_ACAO_RISCOS_CRITICOS.md`, `EXECUCAO_RISCOS_CRITICOS.md` | **Válido** | São as próprias auditorias corretivas recentes (2026-07-01) que este documento complementa. |

---

## Matriz de riscos — confirmados vs. descartados (consolidado das 3 seções)

**Confirmados com evidência de execução real:**
- 9 coleções bloqueadas para todas as operações e todos os perfis (Seção 1) — antes "hipótese de alta confiança", agora **fato testado**.
- Nenhuma dependência externa oculta da credencial (Cloud Functions/Extensions) — descarta um risco que ainda não tinha sido verificado.

**Confirmados por análise (não foi possível testar em runtime real, mas evidência estática é forte):**
- Chave vazada ainda ativa localmente; segunda chave gerada e esquecida (Seção 2, sem mudança desde o plano anterior).
- `PROXIMA_ETAPA.md` com instrução ativa perigosa (Seção 3).

**Descartados:**
- Bloqueio das 9 coleções variar por perfil de usuário — descartado, o bloqueio é uniforme.
- Existência de rota alternativa (regra catch-all não detectada) que permitisse acesso às 9 coleções por outro caminho — descartado pelo teste real.
- Cloud Functions ou Extensions usando a Service Account de forma não documentada — descartado, não existem.

---

## Recomendações

1. **A correção das 9 Firestore Rules deixa de ser condicional** — a auditoria anterior recomendava confirmar o bloqueio antes de escrever a regra; isso já foi feito com evidência real. Pode seguir direto para a Fase C do `EXECUCAO_RISCOS_CRITICOS.md` (escrever as regras, testar via emulador — mesmo método usado aqui —, deploy, verificar via API).
2. **Priorizar a correção de `favoritos_usuarios`** entre as 9 — é a de maior superfície (usada por múltiplos módulos simultaneamente) e uma das 5 com evidência de que a regra existia antes (arquivo órfão da raiz).
3. **Tratar `PROXIMA_ETAPA.md` como arquivamento, não só atualização** — dado o risco de reativação acidental do SaaS, uma correção pontual de trechos é mais arriscada (pode deixar outros trechos igualmente perigosos passarem despercebidos) do que arquivar o documento inteiro e, se necessário, recriar um "próxima etapa" novo e correto.
4. Manter o script de teste (`/tmp/.../scratchpad/rules-test/test.cjs`) como referência — ele já está pronto para ser reaproveitado (com a nova versão das Rules) como parte do processo de homologação formal quando a correção for implementada.

## Checklist para execução das correções (próxima etapa, após aprovação)

- [ ] Escrever as 9 regras faltantes em uma cópia de trabalho de `CRM/firestore.rules`.
- [ ] Rodar o mesmo teste desta validação (emulador + `@firebase/rules-unit-testing`) contra a versão corrigida, confirmando que as 9 coleções passam a permitir acesso autenticado e que nenhuma das coleções de controle regride.
- [ ] Deploy da regra corrigida.
- [ ] Confirmar o release ativo via API `firebaserules.googleapis.com` (não confiar só no Console).
- [ ] Testar manualmente as 6 funcionalidades afetadas em produção.
- [ ] Zero regressão nos módulos de teste obrigatório do `CLAUDE.md`.
- [ ] Rotacionar a credencial (Seção 2), independente do cronograma das Rules.
- [ ] Arquivar/reescrever `PROXIMA_ETAPA.md`; atualizar `MASTER_ROADMAP.md`.

---

## Metodologia

Testes funcionais executados com `firebase-tools` (via Node v24.17.0, instalado localmente através do `nvm` já presente na máquina, sem privilégios de root) rodando `firebase emulators:exec --only firestore` com uma cópia read-only de `CRM/firestore.rules`, e `@firebase/rules-unit-testing` para simular 3 perfis de usuário autenticado + 1 contexto não autenticado, testando Read/Create/Update/Delete em 9 coleções-alvo + 3 coleções de controle (108 + 36 = 144 operações testadas, mais 48 no controle não autenticado). Todo o ambiente de teste (`node_modules`, script, cópia das rules) foi criado em `/tmp/.../scratchpad/rules-test/`, fora do diretório do projeto. O emulador foi encerrado automaticamente ao final da execução (`firebase emulators:exec` desliga o processo assim que o script termina). Validação da credencial: verificação adicional de `firebase.json`/`functions/`/`extensions.json` em ambas as raízes do projeto. Validação de documentação: releitura e classificação final dos documentos já revisados nas etapas anteriores.

## ✅ Confirmação de que nenhuma alteração foi realizada

**No projeto Cell City** (`/home/cellcity/Músicas/projetos/Cell-City-Site`): nenhum arquivo de código, configuração, Firestore Rules ou documento existente foi criado, editado ou removido, com exceção da criação deste documento (`plans/VALIDACAO_FUNCIONAL_RISCOS.md`).

**No Firestore de produção**: nenhuma operação foi executada — todos os testes de Create/Update/Delete rodaram exclusivamente contra o emulador local em `127.0.0.1:8080`, um processo temporário e isolado, sem nenhuma credencial de produção e sem nenhuma conexão com o projeto `cellcity-crm` real. Nenhum dado de produção foi lido, criado, alterado ou excluído.

**Fora do projeto**: foi instalado Node.js (via `nvm`, gerenciador já presente na máquina, sem uso de `sudo`) e criado um diretório de teste isolado em `/tmp/.../scratchpad/rules-test/` — nenhuma dessas ações alterou o sistema operacional globalmente, nem exigiu privilégios administrativos, nem tocou em qualquer arquivo do projeto ou de outros projetos do usuário.

**Nenhuma credencial foi rotacionada, nenhuma Firestore Rule de produção foi alterada, nenhum deploy foi executado.**
