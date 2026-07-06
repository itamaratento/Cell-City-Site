# 🔍 Auditoria Geral — Preparação da Próxima Sprint (2026-07-06)

> Realizada imediatamente após a integração da Sprint 1b em `develop` (commit `f0d2389`), como fase de encerramento técnico e preparação — **somente leitura, nenhum código/Rule/Cloud Function alterado nesta rodada.**
> Detalhe técnico explorável de um achado crítico (item 1) está em `plans/AUDITORIA_GERAL_20260706_INTERNO.md` (interno, não versionado, por política de segurança do projeto — mesma convenção de `plans/AUDITORIA_GERAL_20260704_INTERNO.md`).

## Visão geral do estado atual

Arquitetura: single-tenant, Firebase (Firestore + Auth + Cloud Functions), sem build step, ~34 módulos em `CRM/pages/`, ambientes MAIN/DEVELOP separados (backend Firebase dedicado por ambiente desde a Fase 1 de separação, já promovida a produção). Sprint 1b (Portal do Cliente → Cloud Functions) integrada em `develop`, homologada, 56 testes automatizados aprovados (25 unitários de Cloud Functions + 31 de Firestore Rules).

## Pontos fortes

- Processo de homologação e documentação (TECHDOC, plans/) maduro e consistentemente seguido nas últimas 3 sprints.
- Separação de ambientes DEV/PROD real (backend dedicado, não só código).
- Primeira suíte de testes automatizados do projeto (Sprint 1a/1b) com convenção clara (emulador local, sem depender de login interativo do Firebase CLI).
- Migração do Portal do Cliente para Cloud Functions fechou uma classe inteira de vulnerabilidade (acesso direto anônimo ao Firestore) de forma consistente e testada.

## 🔴 Risco crítico — ação imediata recomendada, fora do escopo desta fase

**Credencial administrativa (service account) vazada em commit antigo de um repositório público permanece ATIVA em produção — nunca rotacionada, conhecida desde 2026-07-03.** Concede acesso completo (bypass de Firestore Rules) ao projeto de produção. Detalhe técnico (ID da chave, commit, comando de remediação) em `plans/AUDITORIA_GERAL_20260706_INTERNO.md`. **Recomendação: tratar como Sprint 0, antes de qualquer outra prioridade abaixo — é uma exposição ativa, não uma dívida técnica.**

## Riscos identificados (por ordem de severidade)

| # | Achado | Severidade | Status |
|---|---|---|---|
| 1 | Credencial admin vazada, ainda ativa | 🔴 Crítico | Ver INTERNO |
| 2 | `plans/` e `CLAUDE.md` publicados ao vivo no GitHub Pages (workflow de deploy não exclui) | 🟠 Alto | Confirmado |
| 3 | 4 coleções usadas no código sem nenhuma Firestore Rule (`alertas_usuario`, `chips_cadastros`, `diario_eventos`, `contas_numeros`) — falham fechado (bug funcional, não vazamento) | 🟠 Alto (funcional) | Confirmado |
| 4 | 9 módulos sem gate de permissão no client (`financeiro`, `fornecedor`, `campanhas`, `clientes`, `config`, `diario`, `importar`, `autoatendimento`, `analise`) — precisa checar se a Rule correspondente cobre o gap | 🟡 Médio (investigar) | Confirmado, não aprofundado |
| 5 | Login sem return-URL — qualquer perfil deslogado que acesse Portal Técnico cai no Dashboard após logar | 🟡 Médio | Confirmado (mais amplo que o achado original) |
| 6 | `dashboard-alarme-os.js` (janela flutuante do alarme) — mesма classe do H-009 (já corrigido no Caixa), ainda sem prefixo `/dev` | 🟡 Médio | Confirmado, não corrigido |
| 7 | `os.list` aberto a qualquer sessão autenticada nas Firestore Rules (decisão deliberada da Sprint 1b — ver TECHDOC §19.5) | 🟡 Médio, aceito | Documentado, pendente de sprint futura |

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

1. **Sprint 0 (fora da numeração normal): rotacionar a credencial vazada** — bloqueia tudo o resto em termos de risco real, mas é puramente infraestrutura (não toca código de produto). Esforço: baixo. Risco de não fazer: crítico e crescente.
2. **Homologação manual + aprovação formal do RBAC Sprint 3 (Estoque+Caixa)** — já implementado e verificado, só falta o passo formal. Esforço: baixo. Bloqueia RBAC Sprint 4/5.
3. **Excluir `plans/`, `CLAUDE.md`, `kernel-test/` do deploy do GitHub Pages** — mudança de infraestrutura (CI), baixo esforço, fecha uma exposição de informação real.
4. **Adicionar Firestore Rules para as 4 coleções sem regra** — baixo esforço, corrige bug funcional confirmado.
5. **Investigar o gap de gate client-side vs. Rules reais nos 9 módulos sem `initModulo()`** — esforço médio (é investigação, não é fix ainda), risco potencialmente alto dependendo do resultado.
6. **RBAC Sprint 4 (Financeiro) e Sprint 5 (OS)** — depende do item 2. Esforço alto (módulos sensíveis).
7. **Limpeza de código morto** (`tenant.js`, `listener-manager.js`, diretórios `BACKUP_*`) — baixo esforço, baixo risco, alto ganho de clareza.
8. **CI mínima**: rodar `npm test` (as 2 suítes existentes) automaticamente em push/PR — baixo esforço, previne regressão silenciosa.
9. **Migrar `doLogin()`/`_listenOS()` do Portal para fechar `os.list`** — pendência formal da Sprint 1b, exige decisão de arquitetura (mecanismo substituto ao onSnapshot). Esforço médio-alto.
10. **Revisão de escopo da Fase 3 do Master Roadmap** (empresa_id/multiempresa desatualizado) — pré-requisito antes de qualquer trabalho de "consolidação de arquitetura".

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
Rules das 4 coleções órfãs     [independente, rápido]
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
| Rules das 4 coleções órfãs | Baixo | Baixo |
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
