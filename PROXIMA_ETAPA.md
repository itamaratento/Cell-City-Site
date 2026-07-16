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

## ✅ ESTADO ATUAL (2026-07-11) — MODO ESTABILIDADE

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

## 🚦 PRÓXIMA TAREFA — Homologação da release v2026.07.10

**Deploy das Firestore Rules corrigidas** (TECHDOC §30.1) em
`cellcity-crm-dev` (DEV) e `cellcity-crm` (PROD), seguindo
`plans/CHECKLIST_DEPLOY_RULES_20260710.md`. Até esse deploy, os módulos
**Compras**, **Fechamento Mensal (Financeiro)** e **Cadastro de
Fornecedores** continuam indisponíveis em runtime (deny-by-default).
Verificar o release ativo via API após publicar (nunca confiar só no
console — ver GUIA_MANUTENCAO).

---

## ✅ CORRIGIDO NA SPRINT ATUAL

| Item | Correção |
|------|----------|
| `dashboard-alarme-os.js` path absoluto sem `/dev` (GUIA item 21) | Mesmo padrão do H-009: prefixo dinâmico adicionado ao `window.open()` |
| `saas.repository.js` órfão (GUIA item 23) | Removido — 4 exports com zero imports, herança do multiempresa revertido |
| Card da Agenda ausente no Dashboard (GUIA item 12, TECHDOC §7.2) | Card `data-module="acaodasemana"` adicionado ao grid + RBAC mapping `'acaodasemana': 'agenda'` |
| `_runtime_audit/`, `sql/`, `pages/`, `scripts/`, `sistema/` publicados no Pages (item 5) | Adicionados ao `--exclude` do `deploy-pages.yml` |
| Matriz RBAC com apenas 9 gates gerenciáveis (16 gates fail-open) | `MODULOS` em usuarios-permissoes.js ampliado de 9 → 25 entries, incluindo `analise`, `compras`, `chat`, `central-alertas`, `diario`, `fornecedor`, `pos-venda`, `minha-semana`, etc. `configuracoes` renomeado para `config` (alinhado com IDs reais). |
| Link 'Ver todas as mensagens' no Portal — dead-end que só exibia `alert()` | Removido — todo histórico já é exibido na tela, link não levava a lugar nenhum |
| Textos do Portal do Cliente com acentos faltando (orcamento, aprovacao, observacao, opcao, urgencia, peca, amanha, sera) | 8 correções em modais e toasts de orçamento + mensagem 'OS não encontrada' → 'Ordem de serviço não encontrada.' |

## ⚠️ ITENS PENDENTES (sem previsão)

| Item | Motivo | Desbloqueio |
|------|--------|-------------|
| `os.list` aberto | Migração do `doLogin()`/`_listenOS()` do Portal | Decisão de arquitetura + autorização |
| Performance F4-6 | Escopo queries, listeners, paginação | Demanda operacional que justifique |
| Portal Técnico (conteúdo) | FRP, firmwares, soluções técnicas | Planejamento estratégico + aprovação |
| 17 módulos sem testes RBAC | Cobertura adicional não crítica | Roadmap futuro |
| Políticas de senha (server-side) | Expiração/força validadas no backend | Cloud Function + decisão de negócio |
| ~~IDs de gate fora da matriz RBAC~~ | ✅ Ampliado: `MODULOS` com 25 entries — todos os gates gerenciáveis via UI | Sprint S1-2026.07.11 concluída — ver CORRIGIDO acima |
| Módulo Chat DESATIVADO | Sem uso operacional (TECHDOC §31) | Reativação em minutos: `CHAT_ENABLED=true` |

---

## ⚠️ RISCOS ATUAIS

- 🔴 Rules corrigidas **ainda não deployadas** — 3 módulos da release quebrados em runtime até o deploy (ver Próxima Tarefa).
- 🟡 `os.list` aberto a qualquer sessão autenticada (decisão deliberada, documentada).
- 🟢 `develop` == `main` == `origin` — push e promoção concluídos em 2026-07-10.
- 🟢 Suítes verdes: RBAC 153/153 · Rules 73/73 · Functions 25/25 · Performance 4/4 (falha antiga do caixa.test corrigida em 3ca6763).
- 🟢 Sem trava de cota (Blaze), sem chave comprometida, sem autoprovisionamento.

---

## ✅ FASE 15 (2026-07-13) — REVISÃO TÉCNICA FINAL E HOMOLOGAÇÃO GERAL

- Revisão independente concluída (Claude, papel Revisão Técnica): **V2 certificada** e **Fundação V3 homologada com correções** — parecer completo em `CRM/TECHDOC.md` §35.
- Suítes completas: **457/457** (RBAC 166 · Control Center 158 · Rules 73 · Functions 25 · Catálogo 17 · Integridade 14 · Performance 4).
- Fundação V3 commitada em develop (fc4eb18) com 5 correções da revisão; testes obsoletos do Control Center corrigidos (b41326f).
- Nota: `estrategia/` permanece **oculto** no catálogo (regra "sem placeholders") — corrige o registro anterior.

### 🚦 PRÓXIMA TAREFA
1. Dono decide: push de `develop` → origin e eventual promoção a `main` (deploy é operação de produção — fora da alçada da revisão).
2. Iniciar **V3-F2 — Health Engine operacional** (implementar os 19 checkers restantes), conforme `plans/v3/CCC-V3.0-ARCH-001` §8.
3. Verificar workflows CI (backup semanal / tests) — status não verificável desta sessão.

---

## ✅ P2.2 — INFRAESTRUTURA app-config (2026-07-16)

| Fase | Commit | Status |
|------|--------|--------|
| P2.2-B — Padronização shared | `1ff6f1e` | ✅ Concluída |
| P2.2-C — Estabilização + testes | (este commit) | ✅ Concluída |
| P2.2-A — Migração de páginas | diff local unstaged | ⏳ Outra frente |

**Validação permanente:** `npm run auditar-arquitetura` (6/6) · `npm run validar-infra-app-config` (10/10) · `node --test tests/integrity/integridade.test.mjs` (14/14).

**Arquivos bloqueados (outra frente):** `os.js`, `portal.js`, `informacoes.js` — não alterar na infra.

**Próximo passo recomendado:** merge/rebase da frente de páginas sobre `develop` após P2.2-C; regenerar catálogo; migrar `kernel.js` → `STORAGE_KEYS.KERNEL_GATE` quando autorizado.

Relatórios: `plans/P2_2_INFRA_RELATORIO.md` · `plans/P2_2_C_ESTABILIZACAO.md`

---

*Última atualização: 2026-07-16 (P2.2-C) — Infra app-config estabilizada; frente de páginas pendente de merge.*
