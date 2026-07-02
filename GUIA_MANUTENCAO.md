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

Itens conhecidos, **não corrigidos**, com onde estão documentados. Nenhum deve ser "consertado de passagem" — cada um exige processo formal próprio.

### Infraestrutura / ambientes
1. **Backend único para MAIN e DEVELOP** — separação planejada e aguardando autorização ([`plans/SEPARACAO_AMBIENTES_DEV_PROD.md`](plans/SEPARACAO_AMBIENTES_DEV_PROD.md), incluindo os 6 adendos da auditoria de 2026-07-02: endpoints REST hardcoded em `analise.js` e `sw-alarme.js`, Anonymous/Google Auth necessários no DEV, config em contexto de Service Worker, `garantia.html` com credenciais de outro registro de app, `_BACKUPS` publicados com config de produção, rules/índices duplicados raiz × CRM).
2. **Cota Firestore (Spark) estourando diariamente** por amplificação de leitura — recomendação: Blaze + alertas + auditoria de leituras por módulo ([`plans/RELATORIO_COTA_FIRESTORE_20260702.md`](plans/RELATORIO_COTA_FIRESTORE_20260702.md)).
3. **`firestore.rules`/`firestore.indexes.json` da raiz desatualizados** (divergem da fonte oficial `CRM/…`) — remover/sincronizar exige processo formal.
4. **`firebase.json` ainda contém seção `hosting`** apesar de o Hosting ser proibido — resquício; remoção pendente de autorização.
5. **`_BACKUPS/` e `kernel-test/` publicados no GitHub Pages** (código antigo público apontando para o banco de produção).
6. **Backup de dados com cobertura parcial**: `backup-dados.js` não exporta `usuarios`, `perfis_operacionais`, `auditoria_usuarios_permissoes` e outras coleções pós-RBAC.
7. **74 arquivos com paths absolutos `/CRM/`** (+ `LOGIN_URL` no kernel): no ambiente `/dev`, navegação e SW podem apontar para a produção.
8. **`localStorage` compartilhado entre `/` e `/dev`** (mesma origem) — estados de sessão/preferências vazam entre ambientes.

### Aplicação
9. **`kernel.js` assume `perfil='admin'` por padrão** para UID sem doc `usuarios/{uid}` — qualquer conta nova que logue sem passar pelo módulo de Usuários vira admin (TECHDOC §6.7).
10. **Condição de corrida na coluna "Perfil"** da aba Usuários (TECHDOC §6.7; pendência oficial da Fase 2).
11. **Iframe de fechamento do Caixa no Dashboard dispara sem efeito** a cada carga (orquestrador removido em 30/06; TECHDOC §7.3).
12. **Card da Agenda no Dashboard não é ocultado** por `podeVisualizar('agenda')` (TECHDOC §7.2).
13. **Sessões anônimas do Portal podem listar `avaliacoes`/`mensagens_portal` de outros clientes** (TECHDOC §3.8 — limitação conhecida das Rules públicas do Portal).
14. **Módulo Análise possivelmente quebrado** (REST sem Authorization com Rules exigindo auth — achado da auditoria de 2026-07-02).
15. **Doc `usuarios/{uid}` órfão do usuário de teste `eu@cellcity.com.br`** (Auth já deletado; limpeza do Firestore pendente por cota).
16. **Amplificação de leitura nos módulos** (coleções inteiras recarregadas por navegação; cache local persistente e `limit()`/paginação não implementados).

### Pendências formais da Fase 2 (RBAC)
17. Sprint 3 (Estoque+Caixa) aguardando **homologação manual e aprovação formal**; Sprints 4 (Financeiro) e 5 (OS) não iniciados.
18. Rastreamento de último acesso; senha via Admin SDK; atualização de permissões em tempo real (pendências da Fase 1 → TECHDOC §6.8).

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
