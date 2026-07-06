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

## ✅ ESTADO ATUAL (2026-07-06)

### Arquitetura de ambientes
- 🟢 **MAIN** (produção): branch `main` → `https://www.cellcityinformatica.com.br/` — commit `09b861a`.
- 🟠 **DEVELOP**: branch `develop` → `https://www.cellcityinformatica.com.br/dev/` — commit `f0d2389` (14 commits à frente de `main`, ainda não promovido).
- Publicação exclusivamente via `git push` (workflow GitHub Pages). **Firebase Hosting proibido.**
- ✅ **Backend Firebase separado por ambiente** (`cellcity-crm` produção / `cellcity-crm-dev` DEV) — a separação planejada em `plans/SEPARACAO_AMBIENTES_DEV_PROD.md` foi concluída e promovida a produção. O freeze de infraestrutura relacionado a essa separação **não está mais em vigor**.
- Produção no plano Firebase **Blaze** desde 2026-07-04 — sem trava de cota diária.

### Sprint 1a — Segurança do Portal do Cliente / OS pública — ✅ CONCLUÍDA (2026-07-05)
Corrigiu o achado crítico então ativo (exposição de dados reais de clientes no fluxo OS/Portal). Homologada e promovida a `main`. Detalhe: `CRM/TECHDOC.md` §17-18, `HISTORICO_PROJETO.md` (entrada de 05/07/2026).

### Sprint 1b — Portal do Cliente migrado para Cloud Functions — ✅ CONCLUÍDA e INTEGRADA em `develop` (2026-07-06)
As 7 funcionalidades restantes do Portal (mensagens, avaliações, agendamentos, solicitação de diagnóstico, eventos, aprovar/recusar orçamento) migraram para Cloud Functions; Firestore Rules fechadas para as 5 coleções do Portal + `os` (parcialmente — `list` fica aberto de propósito, ver `CRM/TECHDOC.md` §19.5). 56 testes automatizados (25 unitários + 31 de Rules), homologação Puppeteer com login real (12/12). **Integrada em `develop` via fast-forward, commit `f0d2389`. Não promovida a `main`, sem deploy em produção.** Detalhe: `CRM/TECHDOC.md` §19-19.8, `HISTORICO_PROJETO.md` (entrada de 06/07/2026).

### Fase 2 — Integração gradual do RBAC (em andamento, sem mudança desde 2026-07-02/03)
- Sprint 1 (Dashboard): ✅ aprovado
- Sprint 2 (CRM + Agenda): ✅ aprovado (tag `sprint2-rbac-crm-agenda-aprovado`)
- Sprint 3 (Estoque + Caixa): 🔵 **implementado + verificado (12/12 jsdom) — AINDA aguardando homologação manual e aprovação formal** (parado desde 2026-07-02/03, sem progresso — ver `CRM/TECHDOC.md` §7.3). Nenhuma sprint de segurança do Portal bloqueou este item; ele só não avançou.
- Sprints 4 (Financeiro) e 5 (OS): ⚪ não iniciados

### Auditoria de preparação da próxima Sprint (2026-07-06, pós-integração da 1b)
Auditoria completa somente-leitura: `plans/AUDITORIA_GERAL_20260706.md` (público) + `plans/AUDITORIA_GERAL_20260706_INTERNO.md` (achado explorável, gitignored). **Achado crítico novo, ainda sem correção:** credencial administrativa (service account) vazada em commit de 2026-06-25, confirmada ainda ativa em produção (conhecida desde 2026-07-03, nunca rotacionada) — ver "Riscos Atuais" abaixo. Documentação sincronizada nesta rodada: vários itens deste arquivo e de `GUIA_MANUTENCAO.md` estavam desatualizados desde 2026-07-04 (referenciavam riscos já corrigidos ou etapas já concluídas).

---

## 🎯 PRÓXIMAS TAREFAS (ordem recomendada, ver `plans/AUDITORIA_GERAL_20260706.md` para detalhe/esforço/risco de cada item)

1. **🔴 Rotacionar a credencial vazada** (Sprint 0, fora da numeração normal) — infraestrutura, não toca código de produto; ainda assim exige autorização explícita e planejamento (pode afetar consumidores da chave atual). Detalhe no documento interno.
2. **Homologação manual + aprovação formal do Sprint 3 RBAC (Estoque + Caixa)** — roteiro em `plans/fase2-sprint3-estoque-caixa-rbac.md`; parado há 4 dias sem bloqueio técnico real.
3. **Excluir `plans/`, `CLAUDE.md`, `CRM/pages/kernel-test/` do deploy do GitHub Pages** — mudança de infraestrutura (CI), baixo esforço.
4. **Adicionar Firestore Rules para as 4 coleções sem regra nenhuma** (`alertas_usuario`, `chips_cadastros`, `diario_eventos`, `contas_numeros`) — hoje falham fechado (bug funcional confirmado, não vazamento).
5. **Investigar o gap de gate client-side nos 9 módulos sem `initModulo()`** (`financeiro`, `fornecedor`, `campanhas`, `clientes`, `config`, `diario`, `importar`, `autoatendimento`, `analise`) — checar se a Rule correspondente cobre o gap real de acesso.
6. **Sprint 4 do RBAC — Financeiro** — só após o item 2 aprovado.
7. **Sprint 5 do RBAC — OS** — só após o item 6.
8. **Migrar `doLogin()`/`_listenOS()` do Portal** para poder fechar `os.list` — toca Login, exige autorização explícita (`CLAUDE.md` §1) e decisão de arquitetura própria.
9. **Limpeza de código morto** (`shared/tenant.js`, `shared/listener-manager.js`, diretórios `BACKUP_*` dentro de `CRM/pages/*/`) — baixo risco, a qualquer momento.
10. **CI mínima** (rodar as 2 suítes de teste existentes em push/PR) — baixo esforço, previne regressão silenciosa.

---

## ⚠️ RISCOS ATUAIS

- 🔴 **Credencial administrativa vazada em commit antigo, ainda ATIVA em produção** — conhecida desde 2026-07-03, nunca rotacionada, repositório público. Maior risco do projeto agora. Detalhe técnico só no registro interno (`plans/AUDITORIA_GERAL_20260706_INTERNO.md`).
- 🟠 **`plans/` e `CLAUDE.md` publicados ao vivo no GitHub Pages** (workflow de deploy não exclui) — confirmado ainda presente em 2026-07-06.
- 🟠 **4 coleções sem nenhuma Firestore Rule** — falham fechado hoje (funcional, não exposição), mas indicam módulos possivelmente quebrados em produção.
- 🟡 **Sprint 3 do RBAC publicado no `develop` sem aprovação formal** há 4 dias — não promover para `main` antes da homologação manual.
- 🟡 **9 módulos sem gate de permissão no client** — risco real depende de verificação cruzada com as Rules (não feita ainda).
- 🟡 **`os.list` aberto a qualquer sessão autenticada** (decisão deliberada da Sprint 1b, documentada) — pendente de sprint futura para fechar via migração do login/listener.
- Dívida técnica consolidada: ver [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) §5 e `plans/AUDITORIA_GERAL_20260706.md` (lista completa e priorizada).

---

*Última atualização: 2026-07-06 — Auditoria de preparação da próxima Sprint, pós-integração da Sprint 1b em `develop`; documentação sincronizada com o estado real do projeto; nenhum código alterado.*
