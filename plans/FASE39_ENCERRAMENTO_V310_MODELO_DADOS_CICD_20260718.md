# FASE 3.9 — ENCERRAMENTO DA RELEASE v3.1.0 — MODELO DE DADOS + CI/CD

**Data:** 2026-07-18 · **Projeto:** `cellcity-crm` · **develop:** `2fe6973` · **main:** `b7e260d` = tag `v3.1.0`
**Missão:** padronização do modelo de dados + revisão CI/CD + certificação definitiva. **Sem alterações automáticas no modelo de dados** (migração só com aprovação prévia — restrição respeitada: nenhum dado foi alterado).

Método: inventário real do Firestore de produção via REST (contagens por agregação e **apenas chaves de campos** — nenhum valor/PII lido além do necessário), análise estática do código em `develop@2fe6973`, APIs GitHub/Firebase para pipeline e infra.

---

## ENTREGÁVEL 1 — INVENTÁRIO DO MODELO DE DADOS (Fase 1)

**70 coleções raiz com documentos** em produção. Coleções definidas em código/índices mas **vazias não aparecem** na listagem (Firestore só lista coleções com docs): `agendamentos`, `avaliacoes`, `catalogo_produtos`, `chat_mensagens`, `chips_cadastros`, `financeiro_receber`, `financeiro_categorias`, `contas_numeros`, `categorias_caixa`(subconjunto) etc.

### 1.1 Visão de governança (coleções relevantes)

| Coleção | Docs | empresa_id | Padrão de campos | Observação |
|---|---|---|---|---|
| `os` | 37 | ✅ | **EN** (category, clientName, createdAt, defect, model, phone, phoneDigits, status, updatedAt…) | núcleo do sistema, legado EN |
| `clientes` | 35 | ✅ | **EN** (name, phone, phoneDigits, createdAt, history) | nome PT, campos EN |
| `caixa_lancamentos` | 391 | ✅ | **misto** (createdAt/updatedAt/createdBy EN + data/valor/tipo/criadoEm PT + *ISO duplicados) | maior coleção operacional |
| `produtos` | 134 | ✅ | misto (categoria/custo/venda PT + description EN) | ver R6 (×catalogo_produtos) |
| `portal_eventos` | 114 | ✅ | misto (clientName/createdAt EN + telefone/tipo PT) | |
| `posvenda_contatos` | 66 | ✅ | PT (clienteNome, clienteTel, criadoEm, dataContato) | |
| `informacoes` | 57 | ✅ | PT camelCase | |
| `usuarios` | 6 | ✅ | **misto triplo** (createdAt EN + atualizado_em/criado_por snake + nome_exibicao) | |
| `empresas` | 1 | n/a | PT snake_case (nome_fantasia, razao_social, criado_em…) | padrão SaaS |
| `comandos`, `crm_leads`, `estoque_produtos`, `financeiro_*`, `diario_*`, `agenda`, `pre_os`… | — | ✅ | **PT camelCase** (criadoEm/atualizadoEm) | padrão dominante (~80% das coleções) |
| `mensagens_portal` | 5 | ✅ | misto (clientName **e** nome no mesmo doc; telefone/telefoneDigits) | |
| `solicitacoes_diagnostico` | 2 | ✅ | misto (clientName/createdAt + descricaoDefeito/telefone) | |
| **`clients`** | 22 | ❌ | EN | **legada morta** — Rules: `allow read, write: if false` ✅ |
| **`orders`** | 5 | ❌ | EN | **legada morta** — Rules: deny explícito ✅ |
| **`lancamentos_caixa`** | 5 | ❌ | misto | legada (superada por caixa_lancamentos) |
| **`teste_caixa`** | 1 | ❌ | — | lixo de teste em produção |
| +22 coleções de sistema/por-usuário sem empresa_id | — | ❌ | PT | config/preferências/robô — avaliar caso a caso no SaaS |

Inventário completo (70 coleções × campos) colhido nesta sessão; tabela integral no Anexo A ao final deste documento.

### 1.2 Campos usados por camada (levantamento no código)

- **Consultas frontend** (`where`): `tipo`(7), `empresa_id`(7 diretos + injeção automática do tenant-repo em TODAS as list/onChange), `status`(4), `createdAt`(4), `phoneDigits`(2), `participantes`(2), `data`(2), `lida`(1). **orderBy**: `createdAt`(6), `timestamp`(3), `criadoEm`(3), `data`(2), `nome_fantasia`, `nome_exibicao` + os 8 call-sites com `orderByField` via repositórios (mapeados na Fase 3.5).
- **Cloud Functions**: consultas por `telefoneDigits`(3), `phoneDigits`, `status`, `perfil`, `empresa_id`, `data`, `contato_email`; payloads gravam `empresa_id`, `telefone`, `createdAt`, `clientName`, `status`, `origem`, `criadoEm`, `nome`, `lida`.
- **Firestore Rules**: `empresa_id`(18 usos via `data.get()` + 1 direto), `perfil`(3), `status`(2), `perfil_operacional_id`(2), `ativo`(1).
- **Índices** (23 em prod, todos READY): 19 do `CRM/firestore.indexes.json` + 4 legados (`portal_eventos` ×2, `avaliacoes` telefone, `mensagens_portal` telefone, `catalogo_produtos` ativo+ordem).

---

## ENTREGÁVEL 2 — MAPEAMENTO PT×EN (Fase 2)

### 2.1 Variantes por conceito (o problema real)

| Conceito | Variantes encontradas | Onde |
|---|---|---|
| Nome do cliente | `name` · `clientName` · `cliente` · `clienteNome` · `nome` | dados: os/clientes/orders (EN); mensagens_portal tem **clientName E nome no mesmo doc**; pre_os/encomendas usam `cliente`; posvenda `clienteNome`; crm_leads/pendencias `nome` |
| Telefone | `phone`/`phoneDigits` · `telefone`/`telefoneDigits` · `telefoneRaw` · `clienteTel` · `telefone1/2` · `whatsapp` | os/clientes EN; portal/crm PT; CFs consultam **ambos** (phoneDigits E telefoneDigits) |
| Criação/atualização | `createdAt/updatedAt` · `criadoEm/atualizadoEm` · `criado_em/atualizado_em` (snake) · duplicatas `*ISO` | **3 convenções simultâneas** + campos espelho ISO |
| Endereço | `endereco/cidade/bairro/cep` (PT, formulário OS e fornecedores) · `address/city/district` | EN só na documentação histórica; dados reais são PT |

### 2.2 Onde cada padrão aparece

- **Só na documentação:** `clientes.nome` (INDICES_MULTIEMPRESA.md e índice — dados reais usam `name`), `agendamentos.telefoneDigits` (doc), address/city/district.
- **Só nos dados (sem código ativo):** campos de `clients`/`orders`/`lancamentos_caixa` (coleções mortas, deny nas Rules), `teste_caixa`.
- **Só no código/índices (coleções ainda vazias):** `avaliacoes`, `chips_cadastros`, `catalogo_produtos`(campo `ordem`), `chat_mensagens.participantes`.
- **Nos índices:** `clientes (empresa_id, nome)` — **aponta para campo inexistente nos dados** (R1, detectada na Fase 3.5); os demais 18 índices do arquivo são consistentes com os dados.
- **Nas Rules:** exclusivamente PT/snake (`empresa_id`, `perfil`, `perfil_operacional_id`) — consistente.
- **Nas consultas:** mistas, refletindo cada coleção (EN p/ os/clientes, PT p/ o resto) — consistentes com os dados **exceto** o caso R1 (nenhuma consulta ativa usa `clientes`+orderBy `nome` hoje).

---

## ENTREGÁVEL 3 — RECOMENDAÇÃO DE PADRÃO OFICIAL (Fase 3)

### 🅰️ RECOMENDAÇÃO: **Português camelCase** como padrão oficial do domínio

| Critério | A) Português | B) Inglês |
|---|---|---|
| Aderência ao existente | **~80% das coleções já são PT**; Rules 100% PT; API da Camada Repository padronizada em PT (P2.3) | só os/clientes/orders + timestamps parciais |
| Custo de migração | migra 2 coleções núcleo + campos residuais (~470 docs no total) | migraria ~50 coleções PT (milhares de docs) + Rules + toda a Camada Repository |
| Manutenção/consistência | linguagem do domínio (OS, caixa, estoque) e da equipe | exigiria tradução mental permanente do domínio |
| APIs/SDKs futuros | irrelevante: nomes de campos Firestore são strings opacas para SDKs | vantagem apenas estética |
| Documentação | já é PT | reescrever tudo |

**Convenção oficial proposta** (para aprovação):
1. Campos novos: **português, camelCase** (`criadoEm`, `atualizadoEm`, `clienteNome`, `telefoneDigits`).
2. **Proibido** criar novos campos EN, snake_case ou espelhos `*ISO` (usar Timestamp nativo).
3. Identificador de tenant permanece `empresa_id` (exceção snake consolidada — 18 usos em Rules, 23 índices; renomear seria migração total sem ganho).
4. Legados EN (`os`, `clientes`, parcial `caixa_lancamentos`, `portal_*`, `usuarios.createdAt`) ficam **congelados como schema canônico por coleção** (dicionário = Anexo A) até a janela de migração da Fase 5 — **não migrar agora**: risco no módulo mais crítico (OS) sem ganho funcional imediato, contra a Regra 10 do CLAUDE.md.

**NENHUMA migração foi executada nesta fase**, conforme a restrição da missão.

---

## ENTREGÁVEL 4 — ANÁLISE DE IMPACTO (Fase 4)

Se/quando a padronização PT for aplicada aos legados EN:

| Área | Impacto | Itens |
|---|---|---|
| **OS** | ALTO | `os` 37 docs (10 campos EN); `CRM/pages/os/os.js` (~3k linhas); `pos-venda/posvenda.js` (orderBy createdAt); timeline/checklists |
| **Cloud Functions** | ALTO | `functions/os.js` (consultarOSPublica/PorTelefone → phoneDigits/clientName), `functions/portal.js` (clientName/createdAt em 5+ payloads e consultas) |
| **Portal do Cliente** | ALTO | 8 arquivos reconstruídos na F1.4 consomem clientName/createdAt via CFs |
| **CRM/Clientes** | MÉDIO | `clientes` 35 docs (name/phone/phoneDigits/history); cadastro embutido em os.js; CF portalObterNomeCliente |
| **Caixa/Financeiro** | MÉDIO | `caixa_lancamentos` 391 docs (createdAt/updatedAt/createdBy/editHistory); relatórios/dashboard leem esses campos |
| **Índices** | MÉDIO | `os (empresa_id, createdAt)` → `criadoEm`; `clientes (empresa_id, nome→name→nome)`; janela de dupla existência |
| **Firestore Rules** | BAIXO | Rules não referenciam campos EN (só empresa_id/perfil/status) ✅ |
| **Storage Rules** | NULO | não referenciam campos de documentos ✅ |
| **RBAC** | BAIXO | usuarios.createdAt não é usado em autorização |
| **Dashboard/Relatórios** | MÉDIO | leituras de createdAt/clientName em widgets e alertas |
| **Agenda/Estoque** | NULO | já são PT ✅ |
| **Testes** | MÉDIO | tests/functions, tests/firestore-rules, E2E citam campos EN |

## ENTREGÁVEL 4b — PLANO DE MIGRAÇÃO (Fase 5 — **NÃO EXECUTAR** sem aprovação)

Estratégia **expand–contract por coleção** (uma coleção por janela, Regra 7 do CLAUDE.md):

1. **Pré-requisitos:** padrão aprovado (Fase 3); freeze de escrita na coleção-alvo fora do horário comercial; CI verde; `firebase-admin` com SA dedicada.
2. **Backup:** export da coleção via sistema oficial (Cell-City-Backup) + snapshot PITR anotado (PITR ativo desde LIMPEZA/PITR-001).
3. **Dry-run:** script `scripts/migracao/<colecao>-pt.cjs --dry-run` gera relatório campo-a-campo (docs afetados, colisões, valores nulos) **sem escrever**.
4. **Expand:** batch copia campo EN → campo PT no mesmo doc (idempotente, `updateTime` preservado em log); índices PT criados ANTES (ficam READY sem tráfego).
5. **Código dual-read:** repositórios leem PT com fallback EN (1 release de convivência); escrita passa a gravar SÓ PT.
6. **Validação:** agregações count(campo PT)==count(docs); smoke runQuery das consultas reais; E2E.
7. **Contract:** após 1 ciclo estável, batch remove campos EN + drop índices EN + remove fallback.
8. **Rollback:** até o passo 5, basta reverter o código (dados EN intactos); após o contract, restore do backup do passo 2 (janela de risco documentada).
- **Estimativas:** os ≈ 1 janela de 2h (37 docs — o custo é código/testes, não dados); clientes ≈ 1h; caixa_lancamentos ≈ 2h (391 docs + relatórios). Risco geral: MÉDIO com o processo acima; ALTO se feito em lote único (não recomendado).
- **Critérios de sucesso:** zero FAILED_PRECONDITION, zero docs sem campo PT, E2E verde, 1 semana sem regressão antes do contract.

---

## ENTREGÁVEL 5 — REVISÃO DO CI/CD (Fases 6 e 7)

### Fase 6 — Pipeline (4 workflows)

| Workflow | Estado | Achados |
|---|---|---|
| `deploy-firebase.yml` | 🟡 correto, porém **inoperante** | Gate `if: github.ref == main` ✅ (vetor do incidente PS-6 removido); `permissions: contents: read` ✅ mínimo; `workflow_dispatch` ✅; auth `google-github-actions/auth@v2` com `credentials_json: FIREBASE_SA_KEY` — **secret nunca configurado** ⇒ nenhum deploy via CI jamais ocorreu (todos os deploys da v3.1.0 saíram por fora do pipeline) |
| `deploy-pages.yml` | 🟢 | verde em todos os pushes recentes (main e develop) |
| `tests.yml` | 🟡 | **verde na develop** (2× hoje: 990086d, 2fe6973, com emulador p/ rules); **vermelho na main** por artefato do compare.sh (fix validado desde Fase 3.4 §1b, aguarda autorização) |
| `backup-weekly.yml` | 🔴 | **3 falhas consecutivas em 2026-07-12** (via `BACKUP_DEPLOY_KEY` ssh); nenhum run desde então (cron só domingos) — próximo domingo é 07-19, sem correção falhará de novo |

**Recomendação de autenticação (R3):** substituir a chave de service account por **Workload Identity Federation** (OIDC GitHub → GCP): elimina credencial de longa duração no GitHub — mitigação estrutural para um projeto que **já teve SA key vazada** (auditoria 07-03). Requer (operador ou autorização p/ esta sessão executar via gcloud): criar Workload Identity Pool + provider GitHub, conceder `roles/firebase.admin`+`roles/datastore.indexAdmin`+`roles/cloudfunctions.developer` à SA de deploy com `principalSet` restrito a `itamaratento/Cell-City-Site:ref:refs/heads/main`, e trocar o step de auth para `workload_identity_provider`/`service_account`. Alternativa rápida: configurar o secret `FIREBASE_SA_KEY` (inferior — chave estática).

### Fase 7 — Checklist CI/CD (evidências desta sessão)

| Item | Status | Evidência |
|---|---|---|
| Lint | 🟡 parcial | Shell: ShellCheck zerado (Sprint P5/P6). **JS: sem linter configurado** |
| Build | ✅ N/A | arquitetura sem build step (decisão de projeto) |
| Testes | ✅ | CI develop verde 2× hoje (unit+rules c/ emulador); E2E 9/9 (Sprint 0) |
| Firestore Rules | ✅ | prod byte-idêntico à v3.1.0 (Fase 3.5) |
| Storage Rules | ✅ | prod byte-idêntico ao `storage.rules` do repo (verificado hoje, ruleset de 11:23Z) |
| Functions | ✅ | 16/16 ACTIVE |
| Indexes | ✅ | 23/23 READY |
| Deploy | 🔴 | **via CI: nunca validado** (secret ausente) — manual funcionou |
| Smoke | ✅ | 9/9 consultas reais (Fase 3.5) + smoke HTTP 16/16 (Fase 3.8, sessão paralela) |
| Rollback | 🟡 | mecanismo `rollback`+tags+backup oficial existe e foi exercitado p/ Rules (incidente 07-14); **nunca ensaiado p/ functions/indexes** |

---

## ENTREGÁVEL 6 — VALIDAÇÃO FINAL (Fase 8)

- `main` = `b7e260d` = tag anotada `v3.1.0` ✅ · tags anteriores íntegras (v3.0.0, v1.1.1, v1.1.0).
- `develop` = `2fe6973`, **5 commits à frente** (4 docs de release + `bb4905d` fix dos 5 índices).
- **Diferença material registrada:** os índices de PRODUÇÃO refletem o `firestore.indexes.json` da **develop** (`bb4905d`) — a `main` ainda tem o arquivo sem os 5 índices. Drift main×prod até a próxima promoção. **Recomendação:** promover develop→main (squash, regra do repo) na próxima janela autorizada.
- **Sessões concorrentes:** trabalho **não commitado** no working tree desta máquina (Fases 3.6–4.0: 4 relatórios + CHANGELOG/PROXIMA_ETAPA modificados) — backup preventivo feito em scratchpad; risco do reset externo enquanto não commitado. Esta sessão não commitou arquivos alheios (protocolo pathspec).

## Fase 9 — Documentação

- `CRM/repositories/INDICES_MULTIEMPRESA.md`: **atualizado nesta fase** para refletir os índices REAIS (19 arquivo + 4 legados) e a pendência R1 — antes documentava índices aspiracionais inexistentes.
- `CHANGELOG.md`: **não tocado** — está modificado pela sessão concorrente; a entrada da Fase 3.9 deve ser adicionada quando aquele trabalho for commitado (registrado como pendência R8).
- Dicionário de dados: Anexo A deste documento (base para o futuro `DICIONARIO_DADOS.md` pós-aprovação do padrão).

---

## ENTREGÁVEL 7 — PARECER TÉCNICO (Fase 10)

### Resumo executivo
A v3.1.0 está **operacional e íntegra em produção** (Rules, Storage, 23 índices, 16 CFs, smoke 9/9). O modelo de dados é **funcional porém tri-padrão** (EN/PT-camel/PT-snake) com o núcleo (`os`, `clientes`) em EN legado; nenhuma inconsistência causa defeito ativo hoje — a única mina armada (R1) está mapeada e desarmável por decisão. O CI **valida** mas **não deploya**: todos os deploys da release saíram por fora do pipeline — este é o principal risco de processo remanescente.

### Pendências classificadas

| # | Pendência | Severidade | Ação |
|---|---|---|---|
| R3 | CI sem credencial de deploy (secret ausente; recomendação: **WIF**) | 🔴 **ALTA** | operador (ou autorizar sessão a configurar WIF via gcloud) |
| R4 | Deploy via CI nunca validado ponta-a-ponta | 🔴 **ALTA** | após R3: workflow_dispatch na main + validação |
| R7 | Backup semanal do GitHub Actions falhando (3× em 07-12; próximo cron 07-19) | 🔴 **ALTA** | investigar `BACKUP_DEPLOY_KEY`/repo destino antes de domingo |
| R1 | Índice+doc `clientes (empresa_id, nome)` × dados usam `name` | 🟡 MÉDIA | decidir junto com padrão (Fase 3): trocar índice p/ `name` OU migrar dados na janela |
| R5 | Fix tests.yml/compare.sh da main (main sempre vermelha dessensibiliza o CI) | 🟡 MÉDIA | autorizar reaplicação (validado desde Fase 3.4) |
| R6 | `catalogo_produtos` VAZIO em prod enquanto `produtos` tem 134 docs — catálogo público possivelmente exibindo nada | 🟡 MÉDIA | verificar funcionalmente o módulo Catálogo; possível migração produtos→catalogo_produtos pendente |
| R8 | Trabalho das Fases 3.6–4.0 não commitado (exposto ao reset externo) | 🟡 MÉDIA | commitar na sessão de origem (backup preventivo já em scratchpad) |
| R2 | Padrão de dados tri-convenção (decisão formal pendente) | 🟡 MÉDIA | aprovar recomendação da Fase 3 (PT camelCase + dicionário) |
| R9 | Coleções mortas em prod (`clients` 22, `orders` 5, `lancamentos_caixa` 5, `teste_caixa` 1) — deny nas Rules ✅, mas contêm PII histórica | 🟢 BAIXA | expurgo/arquivamento em janela própria com backup |
| R10 | Sem linter JS; promoção develop→main pendente (drift indexes.json) | 🟢 BAIXA | ESLint em sprint de qualidade; promover na próxima janela |

### Critérios de encerramento definitivo — status

| Critério | Status |
|---|---|
| Modelo de dados oficialmente definido | 🟡 recomendação emitida, **aguarda aprovação** (R2) |
| Documentação consistente | 🟡 INDICES atualizado; CHANGELOG pendente (R8) |
| Índices consistentes | ✅ (23/23 READY; R1 é a única divergência, mapeada) |
| Consultas consistentes | ✅ (todas cobertas por índice; smoke 9/9) |
| Pipeline configurado | 🟡 estrutura correta, **sem credencial** (R3) |
| GitHub Actions funcionando | 🟡 tests/pages ✅; deploy 🔴; backup 🔴 (R7) |
| Deploy automatizado validado | 🔴 (R4) |
| Smoke aprovado | ✅ |
| Sem erros críticos | ✅ (nenhuma pendência CRÍTICA aberta) |

### Conclusão

**🟡 RELEASE v3.1.0: CERTIFICADA E OPERACIONAL — ENCERRAMENTO DEFINITIVO AINDA NÃO ATINGIDO.**
O encerramento requer, nesta ordem: (1) aprovação do padrão de dados (R2 — decisão do dono sobre a recomendação PT); (2) R3+R4 — credencial de deploy (preferindo WIF) e um deploy CI validado; (3) R7 antes de domingo; (4) promoção develop→main. R1/R5/R6 entram na primeira sprint pós-encerramento. Nenhuma dessas ações foi executada automaticamente — todas aguardam autorização, conforme a restrição da missão.

---

## ANEXO A — Dicionário de dados bruto (70 coleções, campos observados em amostra)

*(chaves de campos apenas; contagens por agregação; amostra de até 3 docs/coleção — campos opcionais podem não aparecer)*

Ver arquivo de inventário gerado na sessão; reproduzido aqui os 20 primeiros para referência rápida — a íntegra segue no relatório de sessão:

```
acoes_semana(2): acoes, atualizadoEm, empresa_id
agenda(20): alertaDashboard, alertaHora, atualizadoEm, cor, data, empresa_id, notas, recorrencia…
alarme_config(6, SEM empresa_id): alarmes, anotacao, ativo, atualizadoEm, dias, dispositivo…
alertas_usuario(39): categoria, comandoId, criadoEm, empresa_id, prioridade, repeticao, status, tipo…
assinaturas(1): acao, criado_em, empresa_id, nome, plano, status, valor
auditoria_logs(10, SEM empresa_id): acao, antes, criadoEm, depois, documentoId, modulo, usuario
auditoria_saas(7): acao, detalhes, em_suporte, empresa_id, perfil, timestamp, usuario_id, usuario_nome
auditoria_usuarios_permissoes(35): acao, admin_nome, admin_uid, alvo_nome, alvo_uid, empresa_id, timestamp
caixa_lancamentos(391): ano, categoria, createdAt, createdAtISO, createdBy, criadoEm, custo, data, dataISO…
clientes(35): createdAt, empresa_id, history, name, phone, phoneDigits
clients(22, MORTA): history, name, phone
comandos(33): blocos, categoria, conteudo, criadoEm, criadoEmISO, empresa_id, favorito, titulo…
crm_leads(4): aparelho, criadoEm, empresa_id, lockType, nome, osId, status, telefone, valor…
empresas(1): atualizado_em, dados_migrados, data_cadastro, is_master, nome_fantasia, plano, razao_social, status
estoque_produtos(35): categoria, custo, descricao, empresa_id, nome, quantidade, quantidadeMinima, venda…
informacoes(57): categoria, conteudo, criadoEm, empresa_id, favorito, titulo, url…
mensagens_portal(5): clientName, createdAt, empresa_id, lida, nome, origem, telefone, telefoneDigits, texto
os(37): category, clientName, createdAt, defect, empresa_id, entryChecklist, model, password, phone, phoneDigits, photos, status, timeline, updatedAt…
usuarios(6): ativo, atualizado_em, createdAt, criado_por, email, empresa_id, nome, nome_exibicao, perfil, permissoes_modulos…
produtos(134): categoria, categoriaID, custo, description, empresa_id, importadoDe, venda
```
