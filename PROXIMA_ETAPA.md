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

## ✅ ESTADO ATUAL (2026-07-04)

### Arquitetura de ambientes
- 🟢 **MAIN** (produção): branch `main` → `https://www.cellcityinformatica.com.br/`
- 🟠 **DEVELOP**: branch `develop` → `https://www.cellcityinformatica.com.br/dev/`
- Publicação exclusivamente via `git push` (workflow GitHub Pages). **Firebase Hosting proibido.**
- ⚠️ **Backend Firebase único** (`cellcity-crm`) para os dois ambientes — separação planejada em [`plans/SEPARACAO_AMBIENTES_DEV_PROD.md`](plans/SEPARACAO_AMBIENTES_DEV_PROD.md), aguardando autorização. **Freeze de alterações de infraestrutura em vigor desde 2026-07-02.**
- Produção migrada do plano Firebase **Spark para Blaze em 2026-07-04** (junto com a criação das Cloud Functions) — a cota diária deixou de travar o sistema; custo direto substitui o risco de indisponibilidade (ver dívida de performance em `GUIA_MANUTENCAO.md`).

### Fase 2 — Integração gradual do RBAC (em andamento)
- Sprint 1 (Dashboard): ✅ aprovado (2026-07-02)
- Sprint 2 (CRM + Agenda): ✅ aprovado (2026-07-02, tag `sprint2-rbac-crm-agenda-aprovado`)
- Sprint 3 (Estoque + Caixa): 🔵 **implementado + verificado (12/12 jsdom) — AGUARDANDO HOMOLOGAÇÃO MANUAL E APROVAÇÃO FORMAL desde 2026-07-02** (`CRM/TECHDOC.md` §7.3)
- Sprints 4 (Financeiro) e 5 (OS): ⚪ não iniciados

### Auditoria geral e encerramento do ciclo de planejamento (2026-07-04)
- Auditoria completa do projeto realizada em 2 sessões complementares: [`plans/AUDITORIA_GERAL_20260704.md`](plans/AUDITORIA_GERAL_20260704.md) (inventário de módulos, banco de dados, arquitetura, segurança, performance) + [`plans/AUDITORIA_EXECUTIVA_GERAL_20260704.md`](plans/AUDITORIA_EXECUTIVA_GERAL_20260704.md) (branches, TECHDOC, plans/, Cloud Functions, PWA, qualidade).
- Consolidação em roadmap oficial: [`plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md`](plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md).
- Ciclo formalmente encerrado em [`plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md`](plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md), que define a ordem oficial das próximas sprints e prepara a Sprint 1 (sem iniciar implementação).
- **Achado crítico de segurança, ainda sem correção:** exposição de dados reais de clientes associada ao fluxo OS/Portal do Cliente — não coberta pela saga de segurança já registrada em `TECHDOC.md` §6.12-6.14. Detalhe técnico redigido nos documentos públicos por política de segurança; registro completo em `plans/AUDITORIA_GERAL_20260704_INTERNO.md` (interno, não publicado). **Passa a ser a Sprint 1 oficial — ver "Próximas Tarefas" abaixo.**
- `MASTER_ROADMAP.md` atualizado nesta rodada: nova seção "Situação em 2026-07-04", e aviso de que o escopo de `empresa_id`/multiempresa das Fases 3 e 6 está desatualizado (multiempresa foi revertido, não restaurado, no rollback de 2026-06-27) — precisa de revisão de escopo dedicada antes de ser iniciado.
- **Nenhum código, dado ou configuração de produção alterado nesta rodada** — só documentação estratégica.

---

## 🎯 PRÓXIMAS TAREFAS (ordem oficial definida em 2026-07-04, ver `plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md` Etapa 3)

1. **Sprint 1 — Segurança do Portal do Cliente / OS pública** — corrigir o achado crítico acima; toca Auth + Firestore Rules, exige autorização explícita do proprietário (`CLAUDE.md` §1) antes de qualquer alteração de código. Preparação (escopo, critérios de aceite, estratégia de testes/homologação) já pronta no documento de encerramento, Etapa 6.
2. **Homologação manual do Sprint 3 RBAC (Estoque + Caixa)** — roteiro em `plans/fase2-sprint3-estoque-caixa-rbac.md`; aprovação formal libera o Sprint 4. Pode correr em paralelo ao item 1 (não compartilha componentes críticos).
3. **Sprint 4 do RBAC — Financeiro** — só após o item 2 aprovado.
4. **Correção dos 3 módulos quebrados** (Análise, Catálogo, Central de Organização) — causa já identificada em cada caso, ver `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md` Etapa 3.
5. **Limpeza do Firestore** — remover doc `usuarios/{uid}` órfão do usuário de teste `eu@cellcity.com.br` (Auth já deletado; uid `kuigLv0DDcQ8o9HHpoMJZYgvPLA2`) + varredura de referências. Pendente desde 2026-07-02, sem mais bloqueio de cota (já em Blaze).
6. **Separação de backend DEV/PROD** — somente com autorização formal; plano pronto com adendos da auditoria.

---

## ⚠️ RISCOS ATUAIS

- 🔴 **Exposição de dados reais de clientes via OS/Portal do Cliente** — incidente ativo, maior risco do projeto até a Sprint 1 ser concluída. Detalhe técnico só no registro interno.
- **Testes no DEVELOP tocam dados de produção** (backend Firebase compartilhado) — tratar todo teste como operação em produção até a separação de backend.
- **Sprint 3 publicado no `develop` sem aprovação formal** desde 2026-07-02 (2 dias) — não fazer merge para `main` antes da homologação manual.
- **`_BACKUPS/`, `plans/` e `CLAUDE.md` publicados ao vivo no GitHub Pages** (confirmado em 2026-07-04 via inspeção do workflow de deploy) — informação operacional interna pública; ver `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md` Etapa 3, item 7.
- Dívida técnica consolidada: ver [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) §5 e `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md` Etapa 1.6 (lista completa, mais extensa que a de `GUIA_MANUTENCAO.md`).

---

*Última atualização: 2026-07-04 — Encerramento formal do ciclo de auditoria geral e planejamento; definição da ordem oficial das próximas sprints; nenhum código alterado.*
