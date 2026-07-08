# 🗂️ PROXIMA_ETAPA.md — MEMÓRIA DO PROJETO (ESTADO ATUAL)

> ⚠️ Leia este arquivo antes de qualquer alteração.
> Para histórico completo, consulte [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md).

---

## 📌 REGRA PERMANENTE DE CONTINUIDADE

### Comando Padrão de Abertura de Sessão

Se o usuário enviar apenas **`CC`** ou **`CONTINUAR`**:

1. **Ler** [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md)
2. **Ler** [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) apenas se necessário
3. **Gerar relatório contendo:**
   - Onde paramos
   - O que foi concluído
   - O que está em andamento
   - O que está pendente
   - Próxima tarefa recomendada
   - Riscos conhecidos
4. ❌ **Não alterar arquivos**
5. ❌ **Não fazer deploy**
6. ❌ **Não executar correções**
7. ⏳ **Aguardar aprovação**

### Ao retornar ao projeto (comando livre)
1. Ler [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md)
2. Apresentar relatório do estado atual
3. **Sem executar alterações** antes da apresentação

### Ao concluir uma tarefa
1. Atualizar [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) (estado atual — sobrescrever)
2. Adicionar registro em [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) (acumulativo — nunca apagar)
3. Informar: *"Arquivos de continuidade atualizados com sucesso."*
4. Aguardar novas instruções

### Modo Somente Leitura
Se a solicitação for **diagnóstico, auditoria, investigação, relatório ou análise**:
- ❌ NÃO atualizar arquivos de continuidade
- ✅ Apenas ler e usar as informações

### Dúvida?
- 🛑 **PARAR** e solicitar confirmação do usuário

---

## 📚 DOCUMENTAÇÃO DE REFERÊNCIA

| Documento | Papel |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Regras permanentes de desenvolvimento |
| [`CRM/TECHDOC.md`](CRM/TECHDOC.md) | Documentação técnica oficial (arquitetura real) |
| [`MASTER_ROADMAP.md`](MASTER_ROADMAP.md) | Planejamento de longo prazo (Fases 1–6) |
| [`GUIA_OPERACAO_AMBIENTES.md`](GUIA_OPERACAO_AMBIENTES.md) | Operação dos ambientes MAIN/DEVELOP |
| [`GUIA_ROLLBACK.md`](GUIA_ROLLBACK.md) | Procedimentos de reversão |
| [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) | Manutenção futura, convenções, dívida técnica |
| [`plans/`](plans/) | Planos e homologações por frente de trabalho |
| [`plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md`](plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md) | Roadmap oficial item a item (auditoria de 2026-07-04) |
| [`plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md`](plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md) | Ordem oficial das próximas sprints |

> ⚠️ Registros antigos deste arquivo (anteriores a 2026-07-02) foram movidos para o papel que sempre foi deles: o histórico está em `HISTORICO_PROJETO.md` e no git. **Atenção:** instruções antigas de "Ativação do SaaS" e `firebase deploy --only hosting` que existiam aqui estão **revogadas** — o experimento multiempresa foi revertido em 2026-06-27 e o Firebase Hosting é proibido (publicação só via GitHub Pages).

---

## ✅ ESTADO ATUAL (2026-07-08)

### Arquitetura de ambientes
- 🟢 **MAIN** (produção): branch `main` → `https://www.cellcityinformatica.com.br/` — commit `cbe68c6`, tag `v2026.07.06-2226`.
- 🟠 **DEVELOP**: branch `develop` → `https://www.cellcityinformatica.com.br/dev/` — sincronizada com `origin/develop` (Camada Repository Fase 0+1 integrada via rebase e publicada), 6 commits à frente de `main`.
- Publicação exclusivamente via `git push` (workflow GitHub Pages). **Firebase Hosting proibido.**
- ✅ **Backend Firebase separado por ambiente** (`cellcity-crm` produção / `cellcity-crm-dev` DEV) — concluído e promovido a produção.
- Produção no plano Firebase **Blaze** desde 2026-07-04 — sem trava de cota diária.

### Sprint 1a — Segurança do Portal do Cliente / OS pública — ✅ CONCLUÍDA (2026-07-05)
Corrigiu o achado crítico então ativo (exposição de dados reais de clientes no fluxo OS/Portal). Homologada e promovida a `main`. Detalhe: `CRM/TECHDOC.md` §17-18.

### Sprint 1b — Portal do Cliente migrado para Cloud Functions — ✅ CONCLUÍDA e **PROMOVIDA A PRODUÇÃO** (2026-07-06)
As 7 funcionalidades restantes do Portal migraram para Cloud Functions; Firestore Rules fechadas para as 5 coleções do Portal + `os` (parcialmente, `list` aberto de propósito). **Promovida a `main` (fast-forward `09b861a..cbe68c6`, tag `v2026.07.06-2226`), com as 12 Cloud Functions do Portal deployadas em produção** (um quase-incidente de deploy incompleto foi encontrado e corrigido antes de declarar sucesso — ver `CRM/TECHDOC.md` §21.5). Detalhe: `CRM/TECHDOC.md` §19-21.

### Incidente de credencial vazada — ✅ ENCERRADO (2026-07-06)
As 2 chaves de service account comprometidas foram desabilitadas e excluídas definitivamente do IAM de produção; nova chave gerada e validada. Hardening adicional (Firestore Rules para coleções internas + exclusão de `plans/`/`CLAUDE.md`/`kernel-test/` do GitHub Pages) deployado. Detalhe: `CRM/TECHDOC.md` §20.

### Camada Repository — Fase 0 + Fase 1 — ✅ CONCLUÍDA e PUBLICADA em `develop` (2026-07-05/07)
Preparação arquitetural (Firestore continua oficial, sem troca de banco). Fase 0 fechou o gap de 3 coleções sem repository; Fase 1 migrou 22 módulos de baixo risco (incluindo `estoque.js`) para o padrão Repository. Homologação funcional concluída (48/48 cenários). Estava órfã em `develop` local (não pushada) por 25 commits de divergência com `origin/develop` (Sprint 1b/hardening) — reconciliada via `git rebase` e publicada em 2026-07-07.

### Fase 2 — Integração gradual do RBAC
- Sprint 1 (Dashboard): ✅ aprovado
- Sprint 2 (CRM + Agenda): ✅ aprovado (tag `sprint2-rbac-crm-agenda-aprovado`)
- Sprint 3 (Estoque + Caixa): 🔵 **implementado (02/07) e re-homologado tecnicamente em 07/07 (34/34 cenários, código atual pós H-006 e pós Camada Repository, zero regressão) — aguardando aprovação formal do usuário** (ver `CRM/TECHDOC.md` §7.3). Nenhum bloqueio técnico real; só falta a decisão do dono do projeto.
- Sprints 4 (Financeiro) e 5 (OS): ⚪ não iniciados — Sprint 4 só pode começar após a aprovação formal do Sprint 3.

### Performance — Fases 1 e 2 do plano de otimização — ✅ REGULARIZADAS e HOMOLOGADAS EM NAVEGADOR REAL (2026-07-08)
Código (escrito em 2026-07-07, sem commit) auditado, com backup do arquivo protegido, validado item a item contra `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md`, testado (Rules 52/52, Functions 25/25, RBAC 33/34 — falha pré-existente não relacionada) e commitado em `develop` (`40fdb89`). Na mesma data, homologação em navegador real (Chrome headless, login via `signInWithCustomToken` com a conta `cellcityadmin@gmail.com` do DEV): Dashboard e Central de Alertas renderizados com dados reais sem erro, cache offline confirmado (documento real servido do IndexedDB sem erro), multiaba confirmado sem `failed-precondition`. Único ponto sem prova direta: supressão do polling durante os 300s/600s de aba oculta (limitação de instrumentação do teste, não dúvida sobre o código — mitigada pela constante determinística `REFRESH_MS` + teste de padrão isolado 4/4). **Aprovado para push a `origin/develop`.** Ver `CRM/TECHDOC.md` §24 e §24.6.

### Preparação para SQL — modelagem relacional concluída e auditada (2026-07-07, planejamento, não migração)
Modelagem relacional completa das 54 coleções ativas do Firestore + 7 tabelas legadas mínimas em `sql/` (82 tabelas, 62 relacionamentos, banco recomendado PostgreSQL/Cloud SQL, DER, estratégia de migração em 7 ondas, plano de adaptação da Camada Repository — 100% de cobertura dos 58 repositories) — ver `CRM/TECHDOC.md` §23, `MASTER_ROADMAP.md` ("Preparação para SQL") e `sql/04_auditoria_final.md` (aceite técnico). **Nenhum banco instalado, nenhum dado migrado, nenhuma migração agendada** — só planejamento, disponível para quando (e se) uma decisão de migração futura for tomada.

---

## 🎯 PRÓXIMAS TAREFAS (ordem recomendada)

1. **Aprovação formal do Sprint 3 RBAC (Estoque + Caixa)** — evidência técnica completa (34/34, sem regressão); decisão do dono do projeto é o único item pendente antes de liberar o Sprint 4.
2. **Sprint 4 do RBAC — Financeiro** — só após o item 1 aprovado; atenção redobrada a aprovações, exclusões e trilha de auditoria.
3. **Sprint 5 do RBAC — OS** — só após o item 2.
4. **Investigar o gap de gate client-side nos 9 módulos sem `initModulo()`** (`financeiro`, `fornecedor`, `campanhas`, `clientes`, `config`, `diario`, `importar`, `autoatendimento`, `analise`) — checar se a Rule correspondente cobre o gap real de acesso.
5. **Migrar `doLogin()`/`_listenOS()` do Portal** para poder fechar `os.list` — toca Login, exige autorização explícita (`CLAUDE.md` §1) e decisão de arquitetura própria.
6. **Limpeza de código morto** (`shared/tenant.js`, `shared/listener-manager.js`, diretórios `BACKUP_*` dentro de `CRM/pages/*/`) — baixo risco, a qualquer momento. Parcial: `estoque.js::descontarEstoque()` (código morto, achado na auditoria de performance de 2026-07-07) já removido.
7. ✅ **RESOLVIDO** ~~CI mínima (rodar as suítes de teste existentes em push/PR)~~ — `.github/workflows/tests.yml` criado e rodando em push/PR (Firestore Rules 52/52 + Cloud Functions 25/25 + RBAC persistido 34/34 = 111/111).
8. **Resolver a duplicidade do `firestore.rules`** (raiz vs. `CRM/firestore.rules`, o arquivo real deployado) — achado de 2026-07-07, plano de remoção preparado em `plans/RESOLUCAO_DUPLICIDADE_FIRESTORE_RULES_20260707.md`, ainda não executado.
9. **Executar as fases restantes do plano de performance** (`plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md` §8) — Fases 1 (pollers) e 2 (cache persistente) regularizadas e homologadas em navegador real em 2026-07-08 (ver item acima e `CRM/TECHDOC.md` §24/§24.6), aprovadas para push. Fases 3-6 (escopo de queries, higiene de listeners, paginação, demais hotspots incluindo Financeiro H11/H12) seguem pendentes, cada uma como sprint própria com autorização explícita nomeando o módulo.

---

## ⚠️ RISCOS ATUAIS

- 🟡 **Sprint 3 do RBAC publicado no `develop` sem aprovação formal** — tecnicamente pronto e re-verificado duas vezes (02/07 e 07/07), sem bloqueio técnico; não promover para `main` antes da aprovação.
- 🟡 **9 módulos sem gate de permissão no client** — risco real depende de verificação cruzada com as Rules (não feita ainda).
- 🟡 **`os.list` aberto a qualquer sessão autenticada** (decisão deliberada da Sprint 1b, documentada) — pendente de sprint futura para fechar via migração do login/listener.
- 🟡 **Dois arquivos `firestore.rules` paralelos no repositório** (raiz, duplicado e nunca deployado, vs. `CRM/firestore.rules`, o real) desde o primeiro commit do projeto — sem risco de segurança confirmado, mas gera confusão em auditorias (já causou uma análise equivocada em 2026-07-07, corrigida no mesmo dia).
- 🟡 **Falha pré-existente em `tests/rbac/caixa.test.mjs`** ("Caixa matriz total: tudo visível") — achada em 2026-07-08 durante a regularização da Fase 1/2 de performance, reproduzida também no `HEAD` sem essas mudanças (não é regressão desta entrega). Não investigada/corrigida ainda — pendência nova, sem sprint própria definida.
- ✅ ~~Cache persistente do Firestore (Fase 2) sem validação em navegador real~~ — **resolvido em 2026-07-08**: homologado em Chrome real (login via custom token, dados do DEV) — cache offline, multiaba e boot visual de Dashboard/Central de Alertas confirmados sem erro. Ver `CRM/TECHDOC.md` §24.6.
- 🟡 **Supressão do polling durante aba oculta (300s/600s) sem prova direta por instrumentação de rede** — o teste de 305s com a aba oculta capturou também o tráfego do listener em tempo real pré-existente (`iniciarStatusSync()`), não isolando só o timer novo. Risco baixo: a mudança de constante (`30000`→`300000`/`600000`) é determinística e o padrão de gating foi validado isoladamente (4/4). Não bloqueia o push; reavaliar só se surgir evidência de leitura excessiva em produção.
- Dívida técnica consolidada: ver [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) §5.

---

*Última atualização: 2026-07-08 — Fases 1+2 do plano de performance regularizadas, commitadas (`40fdb89`) e homologadas em navegador real (Chrome, login DEV real); aprovado para push a `origin/develop`. Ver §24 e §24.6 do TECHDOC.*
