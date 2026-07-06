# 🔧 GUIA DE MANUTENÇÃO FUTURA — Cell City CRM

> **Criado em:** 2026-07-02
> **Público-alvo:** quem for evoluir ou dar manutenção no sistema em qualquer sessão futura (humano ou assistente).
> Documentos relacionados: [`CLAUDE.md`](CLAUDE.md) (regras permanentes) · [`GUIA_OPERACAO_AMBIENTES.md`](GUIA_OPERACAO_AMBIENTES.md) · [`GUIA_ROLLBACK.md`](GUIA_ROLLBACK.md) · [`MASTER_ROADMAP.md`](MASTER_ROADMAP.md) · [`CRM/TECHDOC.md`](CRM/TECHDOC.md)

---

## 1. Antes de qualquer alteração

1. Ler [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) (estado atual) e as regras permanentes em [`CLAUDE.md`](CLAUDE.md).
2. Verificar se a mudança toca **componente crítico/protegido** (§7 abaixo) — se sim, exige autorização explícita + TECHDOC prévio.
3. Verificar se o recurso já existe (reaproveitamento antes de criar do zero — inclusive nos backups).
4. Apresentar o planejamento obrigatório: objetivo, arquivos, módulos afetados, riscos, estratégia.
5. Conferir se há **freeze** vigente (em 2026-07-02: freeze de alterações de infraestrutura Firebase até autorização formal).

## 2. Processo padrão de entrega (8 etapas)

Validado na Fase 1 e replicado em todos os sprints da Fase 2 — vale para qualquer entrega:

**Planejamento → Implementação → Testes unitários → Homologação → Correções → Atualização do TECHDOC → Aprovação formal → Liberação.**

Regras que acompanham o processo:

- **Um módulo por vez** — nunca integração simultânea (lição do incidente de 2026-06-27).
- **Backup antes** de alterar qualquer arquivo crítico (padrões de nome no [`GUIA_ROLLBACK.md`](GUIA_ROLLBACK.md) §3).
- **Tag git** ao aprovar um marco (ex.: `sprint2-rbac-crm-agenda-aprovado`).
- **Homologação sem browser**: método validado com Node + jsdom + mocks isolados executando o código real (usado nos Sprints 2 e 3 do RBAC) — útil quando não há Puppeteer/Playwright disponível. A homologação manual em navegador real continua obrigatória antes da aprovação formal.
- **Testes de regressão obrigatórios** ao final: Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente.
- **Relatório de entrega no chat** conforme template do [`CRM/TECHDOC.md`](CRM/TECHDOC.md) §5.

## 3. Mapa da documentação — o que atualizar quando

| Documento | Papel | Quando atualizar |
|---|---|---|
| [`CRM/TECHDOC.md`](CRM/TECHDOC.md) | Documentação técnica oficial (arquitetura real do sistema) | Toda entrega que muda arquitetura, módulo, coleção ou regra |
| [`MASTER_ROADMAP.md`](MASTER_ROADMAP.md) | Planejamento de fases (1–6) — nunca reescrever decisões, só registrar evolução | Ao concluir/aprovar cada fase ou sprint |
| [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) | Estado atual (sobrescrever) | Ao concluir qualquer tarefa |
| [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) | Histórico acumulativo (**nunca apagar registros**) | Ao concluir qualquer tarefa (novo registro ao final) |
| [`plans/`](plans/) | Planos, levantamentos, homologações por tema/sprint | Ao planejar/encerrar cada frente |
| [`plans/BACKLOG.md`](plans/BACKLOG.md) | Backlog formal — itens só saem via processo formal | Ao registrar/atender um item |
| Guias (`GUIA_*.md`) | Operação, rollback, manutenção | Quando o processo operacional mudar (ex.: separação de backend) |
| [`CLAUDE.md`](CLAUDE.md) | Regras permanentes | Somente por decisão do proprietário |

## 4. Convenções do projeto

- **Publicação:** só via `git push` → GitHub Pages; **Firebase Hosting proibido** ([`GUIA_OPERACAO_AMBIENTES.md`](GUIA_OPERACAO_AMBIENTES.md) §2).
- **Branches:** `develop` (ambiente `/dev`) → merge para `main` (produção) após aprovação.
- **Firestore Rules:** fonte oficial em `CRM/firestore.rules`; após todo deploy, **verificar o release ativo via API** `firebaserules.googleapis.com` (o Console não é confiável para isso — incidente 2026-07-01).
- **Sem build step:** HTML + ES modules nativos; cada módulo é uma pasta em `CRM/pages/<modulo>/` com `index.html`, `<modulo>.js`, `<modulo>.css`; bootstrap via `initModulo()` de `CRM/scripts/kernel.js`.
- **RBAC:** verificação de permissões via `CRM/shared/permissoes.js` (`carregarPermissoes`, `podeVisualizar`, `podeCriar`, …) — padrão dos Sprints 1–3; regras de fail-open documentadas no TECHDOC §7.
- **Usuários de homologação:** e-mails `cellcity<perfil>@gmail.com` (um por perfil operacional; sufixo numérico se precisar de mais de um). Dados de teste devem ser identificáveis e removidos após a homologação.
- **Service Worker:** bump da constante `CACHE` em `CRM/sw.js` sempre que arquivos cacheados relevantes mudarem.
- **Credenciais:** `sa-key.json` (produção) fica só no working tree local, gitignored; conferir `git status` após qualquer operação que gere chaves. A futura `sa-key-dev.json` deve entrar no `.gitignore` **antes** de ser criada.
- **Datas:** documentação usa datas absolutas (YYYY-MM-DD), nunca "hoje/ontem".

## 5. Registro consolidado de dívida técnica conhecida

> Revisado em 2026-07-06 ([`plans/AUDITORIA_GERAL_20260706.md`](plans/AUDITORIA_GERAL_20260706.md)) — vários itens abaixo, mantidos aqui desde 2026-07-02/04, já foram corrigidos por sprints posteriores (Sprint 1a, Sprint 1b, migração Blaze, separação DEV/PROD); marcados explicitamente como ✅ **RESOLVIDO** em vez de removidos, para preservar o rastro histórico. Itens conhecidos **ainda não corrigidos** não devem ser "consertados de passagem" — cada um exige processo formal próprio.

### 🔴 Crítico, ainda sem correção
0. **Credencial administrativa (service account) vazada em commit antigo (2026-06-25), confirmada ainda ATIVA em produção** — repositório público, conhecida desde 2026-07-03, nunca rotacionada. Maior risco do projeto. Detalhe técnico e comando de remediação em `plans/AUDITORIA_GERAL_20260706_INTERNO.md` (gitignored).

### Infraestrutura / ambientes
1. ✅ **RESOLVIDO** ~~Backend único para MAIN e DEVELOP~~ — separado e em produção (`cellcity-crm` / `cellcity-crm-dev`, confirmado via `CRM/shared/env-config.js`).
2. ✅ **RESOLVIDO** ~~Cota Firestore (Spark) estourando diariamente~~ — produção migrada para Blaze em 2026-07-04. Amplificação de leitura em si (item 16 abaixo) continua como dívida de performance, não de disponibilidade.
3. **`firestore.rules`/`firestore.indexes.json` da raiz desatualizados** (divergem da fonte oficial `CRM/…`) — confirmado ainda presente em 2026-07-06; remover/sincronizar exige processo formal.
4. **`firebase.json` ainda contém seção `hosting`** apesar de o Hosting ser proibido — confirmado ainda presente; remoção pendente de autorização.
5. **`plans/`, `CLAUDE.md` e `CRM/pages/kernel-test/` publicados ao vivo no GitHub Pages** — confirmado ainda presente em 2026-07-06 (o workflow `deploy-pages.yml` não exclui esses caminhos do `rsync`). `_BACKUPS/` **não** é publicado (está gitignored, não chega a ser copiado no checkout do Actions) — parte deste item está resolvida, a outra não.
6. **Backup de dados com cobertura parcial**: `backup-dados.js` não exporta `usuarios`, `perfis_operacionais`, `auditoria_usuarios_permissoes` e outras coleções pós-RBAC. Não reverificado em 2026-07-06.
7. **74 arquivos com paths absolutos `/CRM/`** (+ `LOGIN_URL` no kernel): no ambiente `/dev`, navegação e SW podem apontar para a produção. Vários casos individuais já corrigidos (H-003 a H-009); não confirmado se a lista completa foi zerada.
8. **`localStorage` compartilhado entre `/` e `/dev`** (mesma origem) — não reverificado em 2026-07-06.

### Aplicação
9. ✅ **RESOLVIDO** ~~`kernel.js` assume `perfil='admin'` por padrão~~ — corrigido em 2026-07-04; default atual é `'pendente'` (fail-closed), confirmado por leitura direta do código em 2026-07-06.
10. **Condição de corrida na coluna "Perfil"** da aba Usuários — não reverificado em 2026-07-06 (TECHDOC §6.7; pendência oficial da Fase 2).
11. **Iframe de fechamento do Caixa no Dashboard dispara sem efeito** a cada carga — não reverificado em 2026-07-06 (TECHDOC §7.3).
12. **Card da Agenda no Dashboard não é ocultado** por `podeVisualizar('agenda')` — não reverificado em 2026-07-06 (TECHDOC §7.2).
13. ✅ **RESOLVIDO** ~~Sessões anônimas do Portal podem listar `avaliacoes`/`mensagens_portal` de outros clientes~~ — corrigido pela Sprint 1b (Cloud Functions filtram por `phoneDigits`; Rules exigem `temAcessoLiberado()` para acesso direto).
14. **Módulo Análise possivelmente quebrado** (REST sem Authorization) — confirmado em 2026-07-06 que `analise.js` não usa `initModulo()`/nenhum gate de auth (consistente com o achado original, mas causa raiz exata não reconfirmada).
15. ✅ **RESOLVIDO** ~~Doc `usuarios/{uid}` órfão do usuário de teste~~ — confirmado removido do Firestore de produção em 2026-07-06.
16. **Amplificação de leitura nos módulos** (coleções inteiras recarregadas por navegação; cache local persistente e `limit()`/paginação não implementados) — não reverificado em 2026-07-06; ver `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md`.
19. **NOVO (2026-07-06): 4 coleções sem nenhuma Firestore Rule** (`alertas_usuario`, `chips_cadastros`, `diario_eventos`, `contas_numeros`) — sem catch-all no arquivo, falham fechado (bug funcional, não vazamento).
20. **NOVO (2026-07-06): 9 módulos sem nenhum gate de permissão no client** (`financeiro`, `fornecedor`, `campanhas`, `clientes`, `config`, `diario`, `importar`, `autoatendimento`, `analise`) — não usam `initModulo()`/`kernel.js`. Risco real depende de verificação cruzada com as Rules dessas coleções (não feita ainda).
21. **NOVO (2026-07-06): `dashboard-alarme-os.js`** (janela flutuante do alarme) tem a mesma classe de bug do H-009 (já corrigido no Caixa) — `window.open()` com path absoluto sem prefixo `/dev`.
22. **NOVO (2026-07-06): Login sem suporte a return-URL** — qualquer perfil deslogado que acesse Portal Técnico cai no Dashboard após logar, não no Portal Técnico (achado original descrevia isso como específico de `master_admin`; na verdade é genérico, afeta qualquer perfil).
23. **NOVO (2026-07-06): código morto confirmado** — `CRM/shared/tenant.js` e `CRM/shared/listener-manager.js` (zero importadores reais); diversos diretórios/arquivos `BACKUP_*` dentro de `CRM/pages/*/` e `CRM/shared/` (servidos no webroot por não haver build step).
24. **NOVO (2026-07-06): zero cobertura de teste em 34 de 34 módulos** de `CRM/pages/` (só o backend do Portal do Cliente é testado); 3 de 15 Cloud Functions sem teste; 51 de 57 blocos de Firestore Rules sem teste; nenhuma CI executa os testes existentes.

### Pendências formais da Fase 2 (RBAC)
17. Sprint 3 (Estoque+Caixa) **ainda** aguardando **homologação manual e aprovação formal** — parado desde 2026-07-02/03, sem progresso, sem bloqueio técnico real. Sprints 4 (Financeiro) e 5 (OS) não iniciados.
18. Rastreamento de último acesso; senha via Admin SDK; atualização de permissões em tempo real (pendências da Fase 1 → TECHDOC §6.8) — não reverificado em 2026-07-06.

### Pendência formal da Sprint 1b
25. **`os.list` aberto a qualquer sessão autenticada** nas Firestore Rules (decisão deliberada, documentada em `CRM/TECHDOC.md` §19.5) — fechar exige migrar `doLogin()`/`_listenOS()` do Portal para um mecanismo sem dependência de `onSnapshot` direto no client; toca Login, exige autorização explícita.

## 6. Monitoramento periódico recomendado

| O quê | Como | Frequência sugerida |
|---|---|---|
| Cota de leituras Firestore | Console Firebase → Firestore → Uso (ou Cloud Monitoring) | Diária enquanto Spark |
| Workflow do Pages verde | Aba Actions / `gh run list` | A cada push |
| Backups rodando | `systemctl --user list-timers` + datas em `~/Músicas/backups/dados/` | Semanal |
| Release ativo das Rules | API `firebaserules.googleapis.com` | Após cada deploy de rules |
| Credenciais fora do git | `git status` (nenhuma `sa-key*.json` rastreada) | Após operações com chaves |
| Auto-commits estranhos no repo | `git log` (houve auto-commit externo identificado em 2026-06-30) | Ao iniciar sessões de trabalho |

## 7. Componentes críticos/protegidos (autorização explícita obrigatória)

- Login / Autenticação (`CRM/login.html`, `CRM/scripts/kernel.js`)
- `CRM/scripts/firebase.js`, `auth.js`, `config.js`, `global.css`
- Firestore Rules e índices
- Dashboard e ferramentas compartilhadas (`CRM/shared/*` de uso global)
- Qualquer alteração de infraestrutura Firebase (projetos, planos, provedores de Auth) — freeze vigente
- Proibido sem autorização: renomear arquivos, mover pastas, alterar imports globais, trocar estrutura HTML, modificar o Firestore diretamente

## 8. Onde está o plano de longo prazo

A sequência oficial de evolução (Fases 1–6: RBAC → consolidação → evolução funcional → automação → escalabilidade) está no [`MASTER_ROADMAP.md`](MASTER_ROADMAP.md). Regra de ouro: **nenhuma fase inicia antes da aprovação formal da anterior**, e o roadmap é atualizado com o resultado real ao fim de cada fase — nunca reescrito para apagar decisões.
