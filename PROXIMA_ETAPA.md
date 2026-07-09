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
| [`plans/PORTAL_TECNICO_PLANEJAMENTO.md`](plans/PORTAL_TECNICO_PLANEJAMENTO.md) | Planejamento estratégico do Portal Técnico |

---

## ✅ ESTADO ATUAL (2026-07-09) — MODO ESTABILIDADE

### 🏁 MARCO: DESENVOLVIMENTO PRINCIPAL CONCLUÍDO

Após 22+ sprints consecutivas (Sprints 1a–17, RBAC, Performance, Limpeza), o Cell City CRM atinge **maturidade operacional** com os seguintes marcos reconhecidos:

- ✅ **Arquitetura consolidada** — MPA + ES Modules + Repository Layer + Firebase (Auth/Firestore/Storage/Cloud Functions) + GitHub Pages. Sem build step, sem bundler, sem framework.
- ✅ **34 módulos implementados** — 32 operacionais, 2 placeholders (Estratégia, Em Breve) mantidos como espaço reservado.
- ✅ **RBAC duas camadas** (kernel + operacional) integrado nos 32 módulos ativos.
- ✅ **Firestore Rules com `temAcessoLiberado()`** — bloqueio de contas pendentes em ~45 coleções.
- ✅ **Testes automatizados** — 25 arquivos de teste RBAC, 52 Firestore Rules, 25 Cloud Functions.
- ✅ **CI/CD** — GitHub Actions com deploy, testes e backup semanal.
- ✅ **Separação de ambientes** — MAIN (produção) / DEVELOP (/dev) com backend Firebase independentes.
- ✅ **Camada Repository** — 20 repositórios com factory genérica, Fases 0+1 concluídas.
- ✅ **Performance Fases 0-3** homologadas em navegador real.
- ✅ **Incidente de credencial** encerrado, chaves rotacionadas, hardening aplicado.
- ✅ **Modelagem SQL** concluída (planejamento, sem migração).

### Módulos Operacionais (32/34)

| Núcleo | Suporte | Gestão |
|--------|---------|--------|
| OS, Caixa, Estoque, Financeiro | Portal Cliente, Autoatendimento | Usuários/Permissões |
| Clientes, Fornecedor, Compras | Catálogo, Pós-Venda, Garantia | Relatórios, Análise |
| CRM Comercial, Chat, Diário | Portal Técnico (estrutura) | Auditoria, Config |
| Dashboard, Central Alertas | Central Info/Comandos/Org | Importar, Campanhas |
| Ação da Semana, Minha Semana | Central Módulos, Contas | |

### Arquitetura de ambientes
- 🟢 **MAIN** (produção): branch `main` → `https://www.cellcityinformatica.com.br/`
- 🟠 **DEVELOP**: branch `develop` → `https://www.cellcityinformatica.com.br/dev/` — 45 commits à frente de `origin/develop`
- Publicação exclusivamente via `git push` (workflow GitHub Pages). **Firebase Hosting proibido.**
- Produção no plano Firebase **Blaze** desde 2026-07-04 — sem trava de cota diária.

---

## 📋 POLÍTICA DE NOVOS DESENVOLVIMENTOS

A partir deste marco, novas Sprints serão abertas **apenas** quando atenderem a UM dos critérios abaixo:

1. **Problema encontrado durante uso diário** — bug, regressão ou travamento reportado por operador.
2. **Novo requisito de negócio** — demanda do dono ou da operação que justifique o esforço.
3. **Funcionalidade aprovada no roadmap** — item de backlog com escopo definido e valor de negócio claro.

**Não serão criadas** sprints para:
- ❌ Preencher placeholders sem escopo definido (Estratégia, Em Breve).
- ❌ Adicionar conteúdo ao Portal Técnico (depende de planejamento e aprovação — ver `plans/PORTAL_TECNICO_PLANEJAMENTO.md`).
- ❌ Manter "desenvolvimento contínuo" sem entrega de valor.
- ❌ Refatorar arquitetura consolidada sem motivo operacional.

---

## ⚠️ ITENS PENDENTES (sem previsão)

| Item | Motivo | Desbloqueio |
|------|--------|-------------|
| `os.list` aberto | Migração do `doLogin()`/`_listenOS()` do Portal | Decisão de arquitetura + autorização |
| Performance F4-6 | Escopo queries, listeners, paginação | Demanda operacional que justifique |
| Portal Técnico (conteúdo) | FRP, firmwares, soluções técnicas | Planejamento estratégico + aprovação |
| 17 módulos sem testes RBAC | Cobertura adicional não crítica | Roadmap futuro |
| Políticas de senha (server-side) | Expiração/força validadas no backend | Cloud Function + decisão de negócio |

---

## ⚠️ RISCOS ATUAIS

- 🟡 `develop` **45 commits à frente de `origin/develop`** — risco de divergência. Push pendente.
- 🟡 `os.list` aberto a qualquer sessão autenticada (decisão deliberada, documentada).
- 🟡 Falha no teste `caixa.test.mjs` (`0 !== 1`) — pré-existente, não investigada.
- 🟢 Sem trava de cota (Blaze), sem chave comprometida, sem autoprovisionamento.

---

*Última atualização: 2026-07-09 — Declaração de modo estabilidade. Desenvolvimento principal concluído. Próximas sprints sob demanda.*
