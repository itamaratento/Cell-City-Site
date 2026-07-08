# Auditoria Final de Prontidão da Plataforma (Go/No-Go) — 2026-07-08

> Auditoria só de inspeção — nenhuma funcionalidade, regra de negócio ou bug foi corrigido nesta rodada. Objetivo: confirmar se a base está pronta para o início de novos módulos.

**Método:** verificação direta do repositório (reaproveitando `scripts/homologacao/lib/audit.mjs` e `tests-runner.mjs`) + 5 frentes de investigação paralela (segurança, Cloud Functions, Firestore, produção, arquitetura), cada uma lendo o código/config atual, não confiando em documentação antiga sem checar.

---

## Etapa 1 — Estado do repositório: **APROVADO**

- Branch: `develop`. Commit: `20d2b30` ("Automação da homologação de performance"). Working tree limpo, 0 arquivos modificados, 0 protegidos sem backup, 0 stashes.
- `develop` está 1 commit à frente de `origin/develop` (a entrega de automação, ainda não enviada) e 24 commits à frente de `main` (não promovido).
- Tags semânticas presentes (`v2026.07.06-2226` é a mais recente), mais tags de backup manual por sessão.

## Etapa 2 — Arquitetura: **APROVADO COM RESSALVAS**

- 34 módulos em `CRM/pages/`, maioria segue o padrão `index.html` + `.js` + `.css` isolados. Camada Repository (19 arquivos) documentada e coexiste de forma rastreada com SDK direto (ex. `caixa.js` ainda não migrado — decisão registrada, não esquecimento).
- Separação Front-end (sem build step) / Cloud Functions / scripts operacionais está limpa, sem mistura de responsabilidades.
- **Achados de higiene (não bloqueadores):**
  - Site legado pré-CRM ainda ocupa a raiz do repositório (`index.html`, `catalogo.html`, `celular/`, `sistema/`, `imagens/`, `css/`, `js/`, etc.), sem isolamento do CRM atual.
  - Lixo real **commitado** no git: pastas `BACKUP_*` inteiras (`BACKUP_POSVENDA_SAAS_FIX_2026-06-26/`), `firestore.rules.backup*`, `firebase.json.bak_catalogo_2026-06-12`, arquivos de teste vazios, e um arquivo chamado literalmente `how --stat --summary 3dac68a` (saída de um `git log` commitada por engano).
  - Subpastas `BACKUP_*` dentro de módulos ativos (`dashboard/` tem 6, `caixa/`, `crm-comercial/`, `estoque/` etc.) — risco real de alguém copiar o arquivo errado como referência ao criar um módulo novo.
  - TECHDOC diz "17 repositories", hoje são 19 — drift pequeno de documentação.

## Etapa 3 — Segurança: **APROVADO**

- `CRM/firestore.rules` (arquivo real deployado) lido por completo: todas as coleções de negócio exigem `temAcessoLiberado()`; aberturas públicas são deliberadas e documentadas (`config`, `catalogo_config`, `pre_os`, `os.list`). `usuarios/{uid}` trata campos sensíveis corretamente (BL-006 fechada).
- Credenciais: `sa-key.json`/`sa-key-dev.json`/`.env` gitignored e ausentes de `git ls-files`. Nenhuma chave/segredo real encontrado em arquivo rastreado (só Web API keys do Firebase, que não são segredo).
- RBAC (`permissoes.js`) é fail-open por design documentado — a segurança real está nas Rules, não na UI.
- Cloud Functions validam input, autorização e usam whitelist de campos consistentemente.
- `env-config.js` tem fail-safe correto (qualquer dúvida cai em DEV, nunca produção).
- **Riscos baixos, não bloqueadores:** `./firestore.rules` da raiz é cópia órfã desatualizada (risco de deploy acidental se alguém apontar pro arquivo errado); functions públicas do Portal usam só `phoneDigits` como prova de identidade, sem OTP (risco aceito e documentado no próprio código, não é regressão); `global.css` citado no `CLAUDE.md` como arquivo protegido não existe com esse nome (CSS é por módulo) — desalinhamento de documentação, não falha de segurança.
- **Achado importante sobre documentação (não sobre segurança real):** `GUIA_MANUTENCAO.md` item 0 afirma "credencial administrativa vazada, confirmada ainda ATIVA em produção, nunca rotacionada — maior risco do projeto". **Verificado como FALSO no estado atual** — as chaves comprometidas foram desabilitadas e excluídas definitivamente do IAM em 2026-07-06 (`CRM/TECHDOC.md` §20-21, commit `cbe68c6` "Fase 8"). Confirmado por `git log -S`: o texto do item 0 foi escrito no commit `bbafce6` (2026-07-06 12:51), **9 horas antes** da exclusão definitiva (`cbe68c6`, 21:58 do mesmo dia), e nunca foi atualizado depois — é documentação desatualizada, não uma vulnerabilidade ativa. Recomendo corrigir esse texto especificamente (fora do escopo desta auditoria, mas registrado aqui para não gerar pânico futuro por engano).

## Etapa 4 — Firestore: **APROVADO COM RESSALVAS**

- `CRM/firestore.indexes.json` (o real): só 3 índices compostos. 1 correto e usado (`caixa_lancamentos`), 1 órfão/desalinhado do código atual (`mensagens_portal` indexa campo que a function não usa mais), 1 supérfluo (`lembretes_pagamento` não precisa de índice composto para a query real).
- `COLECOES_FIRESTORE.md` atualizado (2026-07-07), consistente com as 57 coleções reais dos repositories.
- **Backup de DADOS do Firestore é uma pendência real:** `backup-dados.js` cobre só 21 das ~57 coleções ativas (faltam `usuarios`, `perfis_operacionais`, `auditoria_usuarios_permissoes` e outras pós-RBAC), depende de um timer systemd na máquina local do dev, sem redundância cloud. Isso é backup de DADOS, diferente do backup de CÓDIGO (esse sim robusto, automático, semanal, documentado).
- 3 leituras de coleção `os` inteira sem `limit()` em telas de alto tráfego (Dashboard e Central de Alertas) — já mapeadas no plano de performance como Fase 3 (pendente, requer autorização própria).
- Cache persistente (Fase 2 do plano de performance) confirmado presente e já homologado nesta mesma sessão.

## Etapa 5 — Cloud Functions: **APROVADO COM RESSALVAS**

- 15 functions num único `functions/index.js`, organizadas por bloco comentado. Tratamento de erro consistente (`HttpsError` tipado em todas). Nenhuma function obsoleta — todas as 15 têm pelo menos 1 chamador real confirmado.
- **Achado novo: zero logging.** Nenhum `console.log`/`logger` em todo o arquivo — em produção, uma falha silenciosa (erro de índice, timeout) não deixa rastro com contexto de negócio, só o log genérico do runtime.
- Deploy 100% manual, sem gate de CI — o mesmo risco que já causou um quase-incidente real (Sprint 1b, 2026-07-06: 12 functions do Portal ausentes em produção enquanto o site novo já as chamava, pego por sorte antes de declarar sucesso). O risco de recorrência continua existindo hoje.

## Etapa 6 — Performance: **APROVADO COM RESSALVAS**

- Fase 1 (pollers espaçados + pausa por aba oculta) e Fase 2 (cache persistente do Firestore) homologadas em navegador real e já em `origin/develop` (commits `40fdb89`, `f3c3232`).
- Fases 3-6 do plano (`plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md`) seguem pendentes — a maioria exige autorização própria por tocar módulo protegido (Dashboard) ou mudar comportamento funcional. Nenhuma é bloqueadora para começar módulos novos (são otimizações do que já existe).
- `listener-manager.js` é código morto confirmado (0 importadores) — dívida pequena, não bloqueadora.

## Etapa 7 — Qualidade: **APROVADO COM RESSALVAS**

Suítes automatizadas executadas nesta auditoria (reaproveitando `scripts/homologacao/lib/tests-runner.mjs`):

| Suíte | Resultado |
|---|---|
| Firestore Rules | 52/52 |
| Cloud Functions | 25/25 |
| RBAC | 33/34 (1 falha pré-existente conhecida e registrada, não corrigida — fora do escopo) |
| Polling gating | 4/4 |

CI mínima ativa, rodando as 4 suítes a cada push/PR. **Cobertura ainda limitada:** 27 dos 34 módulos de `CRM/pages/` não têm nenhum teste automatizado (os 7 cobertos testam só o gate de RBAC, não a lógica funcional completa); 3 das 15 Cloud Functions sem teste; 51 dos 57 blocos de Firestore Rules sem teste (`GUIA_MANUTENCAO.md` item 24).

## Etapa 8 — Documentação: **RESSALVAS SIGNIFICATIVAS**

Os documentos de sessão-a-sessão (`CRM/TECHDOC.md`, `PROXIMA_ETAPA.md`) estão rigorosamente atualizados — mantidos nesta própria sessão até §25/2026-07-08. Porém os documentos de "arquivo"/planejamento ficaram para trás:

- `MASTER_ROADMAP.md`: a seção "Infraestrutura de Ambientes DEV/PROD" ainda diz *"Parcial... freeze de infraestrutura em vigor desde 2026-07-02"*, quando essa separação já foi concluída e promovida a produção há dias. A iniciativa de Performance (que consumiu várias sessões) não aparece em nenhum lugar do roadmap como frente própria.
- `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md`: as tabelas de status ainda classificam Fase 1 e Fase 2 como "Pendente", quando ambas já foram homologadas e enviadas a `origin/develop` (contradiz `CRM/TECHDOC.md` §24/§24.6 e `PROXIMA_ETAPA.md`, que dizem o oposto).
- `GUIA_MANUTENCAO.md` item 0 — ver Etapa 3 (credencial já corrigida, texto não atualizado).

Isso não é risco técnico — é risco de **confusão futura** (alguém lendo só o roadmap concluiria que a separação de ambientes ainda não aconteceu, ou que a Fase 1/2 de performance nunca foi feita). Recomendo uma rodada de sincronização formal antes ou logo depois do início dos módulos novos.

## Etapa 9 — Preparação SQL: **APROVADO**

Modelagem relacional completa (82 tabelas, 62 relacionamentos), auditada e com aceite técnico formal em 2026-07-07 (`sql/04_auditoria_final.md`). Nenhum banco instalado, nenhuma migração agendada — coerente com a decisão de "preparar, não migrar". Não há nenhuma pendência aqui que bloqueie módulos novos (é trabalho para uma decisão de negócio futura, independente).

## Etapa 10 — Produção: **APROVADO COM RESSALVAS**

- Separação DEV/Produção madura e documentada (`GUIA_OPERACAO_AMBIENTES.md`, `GUIA_MANUTENCAO.md`) — backend já separado (`cellcity-crm` / `cellcity-crm-dev`).
- Deploy do site é automático (GitHub Pages); deploy de Cloud Functions é manual sem gate — mesmo risco da Etapa 5.
- Rollback maduro (`GUIA_ROLLBACK.md`, `scripts/release/rollback.sh`), testado em simulação (8/8 cenários) e usado de verdade uma vez em produção (rollback de Rules, ~2min de indisponibilidade, funcionou).
- **Monitoramento: pendência real confirmada.** Não existe nenhum alerta/monitoramento automatizado hoje — só checagens manuais periódicas sugeridas em documentação. Sistema é 100% reativo.
- **Billing: pendência real confirmada.** Produção está no plano Blaze (pay-as-you-go, sem teto automático) desde 2026-07-04. O relatório de cota de 2026-07-02 recomendou orçamento com alertas em 50/90/100% — não encontrada nenhuma confirmação de que esse alerta foi de fato configurado.

## Etapa 11 — Pendências (bloqueadores vs. não-bloqueadores)

### Bloqueadores técnicos reais para começar módulos novos
**Nenhum encontrado.**

### Não-bloqueadores — severidade alta (dívida real, recomenda-se tratar em paralelo)
1. Zero monitoramento/alertas de produção (sistema 100% reativo).
2. Billing Blaze sem teto/alerta de gasto confirmado.
3. Deploy de Cloud Functions manual, sem gate de CI (já causou 1 quase-incidente real).
4. Backup de dados do Firestore incompleto (21/57 coleções) e sem redundância cloud.
5. 27 de 34 módulos sem nenhum teste automatizado.

### Severidade média
6. `MASTER_ROADMAP.md` e `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md` desatualizados frente ao estado real.
7. `GUIA_MANUTENCAO.md` item 0 (credencial) desatualizado — risco de confusão/pânico futuro.
8. Cloud Functions sem nenhum log — caixa-preta em produção.
9. Índices Firestore desalinhados (1 órfão, 1 supérfluo).
10. 3 leituras de `os` inteira sem `limit()` em telas de alto tráfego (já mapeado, Fase 3 do plano de performance).

### Severidade baixa (higiene)
11. Lixo commitado na raiz e dentro de módulos (`BACKUP_*`, `.bak`, arquivo de erro operacional, testes vazios).
12. Site legado pré-CRM ainda coexistindo sem isolamento.
13. `firestore.rules` órfã na raiz (risco de deploy acidental).
14. Pendências formais já conhecidas do RBAC (Sprint 3 aguardando aprovação formal; Sprints 4/5 não iniciados).

---

## Etapa 12 — Parecer Final

**Percentual estimado de preparação: ~85%**
(Repositório 100% · Arquitetura 85% · Segurança 95% · Firestore 80% · Cloud Functions 80% · Performance 60% · Qualidade 70% · Documentação 75% · Preparação SQL 100% · Produção 75% — média ponderada, estimativa qualitativa, não uma métrica formal.)

1. **A preparação pode ser considerada concluída?** Sim, para o propósito de iniciar módulos de produto novos. Não no sentido absoluto — há dívida operacional real (monitoramento, backup de dados, cobertura de teste) que continua em aberto e deveria ter tratamento formal próprio, em paralelo.
2. **Existe bloqueador técnico antes dos módulos?** Não foi encontrado nenhum.
3. **A arquitetura suporta os próximos módulos?** Sim — o padrão de módulo (HTML+JS+CSS isolados, Camada Repository, RBAC, gate de auth) é claro, replicável e documentado. A única fricção real é o volume de lixo/histórico acumulado, que exige atenção para não copiar um arquivo `BACKUP_*` como referência.
4. **Há riscos críticos não tratados?** Nenhum no sentido de exploração ativa ou vazamento — a auditoria de segurança não encontrou bloqueador. Há riscos operacionais reais não tratados (monitoramento zero, billing sem teto, backup de dados parcial, deploy de functions sem gate) que merecem virar itens formais de trabalho.
5. **A base está pronta para evoluir?** Sim, com a ressalva de que os documentos de planejamento de mais alto nível (roadmap, plano de performance) precisam de uma sincronização antes que a distância entre "o que o roadmap diz" e "o que já foi feito" fique difícil de rastrear.
6. **Recomenda iniciar imediatamente os módulos?** Sim.

## Recomendação final

# **GO**

Com a recomendação de abrir, em paralelo (não bloqueando o início dos módulos), uma frente pequena de saneamento operacional: monitoramento básico, alerta de billing, sincronização de `MASTER_ROADMAP.md`/planos, e correção do texto desatualizado sobre a credencial no `GUIA_MANUTENCAO.md`. Nenhum desses itens impede tecnicamente começar hoje.
