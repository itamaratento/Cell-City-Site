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

> ⚠️ Registros antigos deste arquivo (anteriores a 2026-07-02) foram movidos para o papel que sempre foi deles: o histórico está em `HISTORICO_PROJETO.md` e no git. **Atenção:** instruções antigas de "Ativação do SaaS" e `firebase deploy --only hosting` que existiam aqui estão **revogadas** — o experimento multiempresa foi revertido em 2026-06-27 e o Firebase Hosting é proibido (publicação só via GitHub Pages).

---

## ✅ ESTADO ATUAL (2026-07-02)

### Arquitetura de ambientes
- 🟢 **MAIN** (produção): branch `main` → `https://www.cellcityinformatica.com.br/`
- 🟠 **DEVELOP**: branch `develop` → `https://www.cellcityinformatica.com.br/dev/`
- Publicação exclusivamente via `git push` (workflow GitHub Pages). **Firebase Hosting proibido.**
- ⚠️ **Backend Firebase único** (`cellcity-crm`) para os dois ambientes — separação planejada em [`plans/SEPARACAO_AMBIENTES_DEV_PROD.md`](plans/SEPARACAO_AMBIENTES_DEV_PROD.md), aguardando autorização. **Freeze de alterações de infraestrutura em vigor.**

### Fase 2 — Integração gradual do RBAC (em andamento)
- Sprint 1 (Dashboard): ✅ aprovado (2026-07-02)
- Sprint 2 (CRM + Agenda): ✅ aprovado (2026-07-02, tag `sprint2-rbac-crm-agenda-aprovado`)
- Sprint 3 (Estoque + Caixa): 🔵 **implementado + verificado (12/12 jsdom) — AGUARDANDO HOMOLOGAÇÃO MANUAL E APROVAÇÃO FORMAL** (`CRM/TECHDOC.md` §7.3)
- Sprints 4 (Financeiro) e 5 (OS): ⚪ não iniciados

### Última entrega (2026-07-02) — Documentação técnica
- TECHDOC §9 (Ambientes e Publicação), MASTER_ROADMAP (seção de infraestrutura DEV/PROD + status atualizados) e plano de separação (adendos da auditoria) atualizados.
- Criados: `GUIA_OPERACAO_AMBIENTES.md`, `GUIA_ROLLBACK.md`, `GUIA_MANUTENCAO.md`.
- Inconsistências entre documentos eliminadas (este arquivo reescrito; banners de obsolescência nos docs de deploy antigos; README preenchido).
- **Nenhum código, dado ou configuração alterado.**

---

## 🎯 PRÓXIMAS TAREFAS (ordem de prioridade definida pelo proprietário em 2026-07-02)

1. **Homologação manual do Sprint 3 (Estoque + Caixa)** — roteiro em `plans/fase2-sprint3-estoque-caixa-rbac.md`; aprovação formal libera o Sprint 4.
2. **Limpeza do Firestore** — remover doc `usuarios/{uid}` órfão do usuário de teste `eu@cellcity.com.br` (Auth já deletado; uid `kuigLv0DDcQ8o9HHpoMJZYgvPLA2`) + varredura de referências. Bloqueada pela cota até o reset diário.
3. **Decisão sobre a cota do Firestore** — plano Spark estourando 50k leituras/dia; recomendação de upgrade para Blaze + alertas em [`plans/RELATORIO_COTA_FIRESTORE_20260702.md`](plans/RELATORIO_COTA_FIRESTORE_20260702.md). **Decisão do proprietário.**
4. **Separação de backend DEV/PROD** — somente com autorização formal; plano pronto com adendos da auditoria.

---

## ⚠️ RISCOS ATUAIS

- **Cota Firestore estourando diariamente** (~13:15 BRT em 2026-07-02): CRM e páginas públicas ficam sem dados até ~04:00 BRT. Tende a repetir todo dia até decisão sobre o plano.
- **Testes no DEVELOP tocam dados e cota de produção** (backend compartilhado) — tratar todo teste como operação em produção até a separação.
- **Sprint 3 publicado no `develop` sem aprovação formal** — não fazer merge para `main` antes da homologação manual.
- Dívida técnica consolidada (16+ itens conhecidos): ver [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) §5.

---

*Última atualização: 2026-07-02 — Entrega de documentação técnica (arquitetura DEV/PROD, guias de operação/rollback/manutenção, revisão de consistência).*
