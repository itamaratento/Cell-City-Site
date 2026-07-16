# Sprint 0 — Certificação de Encerramento (2026-07-16)

**Branch:** develop `d4dbe5c` == origin/develop · working tree limpo · main intocada (`84977dc`)
**Relatórios das fases:** `SPRINT0_FASE1_LIMPEZA_PERFORMANCE_20260716.md` · `SPRINT0_FASE2_HOMOLOGACAO_20260716.md` · este documento (FASE 3)

## Critérios de conclusão (verificação honesta)

| Critério | Status |
|---|---|
| Performance homologada | ✅ Lighthouse real: login 98, garantia 100/100; bateria de performance 4/4. Ressalva: portal 88–94 (DT-18, correção = split do portal.js, pendência declarada da P2.2) |
| Lighthouse aprovado | ✅ com a ressalva acima; páginas autenticadas exigem rodada com credencial (dono) |
| Todos os testes aprovados | 🟡 320/345 nos executáveis: RBAC 173/175 · Rules 105/105 · Integrity 14/14 · Perf 4/4 · **E2E 9/9 (1ª execução real da história)** · Functions 11/25 (pré-exist.) · financeiro-relatorio 2 (pré-exist.) — **zero regressões da Sprint 0** |
| Nenhum erro no console | ✅ E2E capturou `pageerror` em 7 páginas — zero erros JS |
| Working tree limpo | ✅ |
| Commits revisados e enviados | ✅ 20 commits revisados um a um e pushados (squash dispensado: a promoção a main já é squash por regra; história de 2 sessões preservada) |
| Documentação atualizada | ✅ relatórios das 3 fases + TECHDOC §36 (Design System, sessão paralela) + catálogo regenerado. MASTER_ROADMAP/ENGINEERING revisados sem edição (docs estratégicos do dono) — **nota:** a numeração "Sprint 0/Sprint 1 SaaS" desta ordem diverge do MASTER_ROADMAP (6 fases) e o SaaS estava congelado desde o incidente de 07-14; alinhar nomenclatura antes da Sprint 1 |
| Relatório final emitido | ✅ este documento |
| Certificação de encerramento | ✅ **SPRINT 0 ENCERRADA COM RESSALVAS** (listadas abaixo) |

## Pipeline (validado após push real)

- Deploy Pages: ✅ sucesso nos 2 pushes; `/dev` no ar (HTTP 200)
- 🔴→✅ **Achado crítico corrigido:** `deploy-firebase.yml` (P1.1) deployava em **PRODUÇÃO a partir de develop** — o vetor do incidente P0 de 14/07. Nunca executou porque `FIREBASE_SA_KEY` nunca foi configurado (o pipeline P1.1 **nunca funcionou**). Gate `main`-only aplicado (`d4dbe5c`)
- Testes no CI: ❌ pré-existente (falhava antes da Sprint 0; step "Firestore Rules"); leitura do log exige `gh auth` — pendência na máquina do dono

## Pendências herdadas (para a Sprint 1 ou backlog)

1. **Configurar `FIREBASE_SA_KEY`** no GitHub (sem ele não há deploy automático de rules/functions) e decidir deploy DEV por branch.
2. CI "Testes automatizados" vermelho pré-existente — diagnosticar com `gh auth`.
3. `homologar-performance` desatualizado (parser `ℹ`→`#` do Node 22 + falta `--import register-loader` no RBAC).
4. Rodar Fase 3 do homologar-performance + Lighthouse autenticado com credencial de homologação (máquina do dono).
5. Portal: split do portal.js (DT-18) — também resolve o Lighthouse 88–94.
6. Pré-existentes conhecidos: functions rate-limiter nos testes (14), financeiro-relatorio (2), sidebar duplicada no Dashboard (DT-34, módulo protegido).
7. P2.3 restante: ~209 acessos Firestore diretos (plano módulo a módulo já mapeado).
8. Promoção develop→main: **PREPARADA, não executada** (aguarda autorização) — checklist: squash merge (regra do projeto), tag de versão via fluxo `subir-ok`, re-rodar bateria pós-promoção, validar Rules em produção via API (feedback registrado de 07-01).

## Veredito

**Sprint 0 ENCERRADA COM RESSALVAS.** O projeto está **apto a iniciar a Sprint 1 (Arquitetura SaaS)** com duas condições prévias recomendadas: resolver a pendência 1 (secret do pipeline) e a decisão de nomenclatura da pendência da documentação. Nota: o SaaS estava formalmente congelado desde 2026-07-14 e o Plano Diretor de 07-15 assumia single-tenant definitivo — esta ordem de Sprint 1 SaaS reverte aquela premissa; recomenda-se registrar essa decisão em ENGINEERING/MASTER_ROADMAP no kickoff.

---
*Certificação emitida em 2026-07-16, FASE 3 da ordem de encerramento da Sprint 0. Sessões participantes: esta (P2.1/P2.2/P2.3/P2.5/Sprint 0 F1-F3) e sessão paralela (P2.4 Design System).*
