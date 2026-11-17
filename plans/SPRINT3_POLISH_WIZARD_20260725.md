# Sprint 3 — Polish do Wizard de Onboarding SaaS · 2026-07-25

**Status:** ✅ CONCLUÍDA (código + testes + docs)
**Autorização:** dono do projeto, confirmada via `AskUserQuestion` após mensagem
formatada como "AUTORIZAÇÃO OFICIAL" (mesmo padrão de script já visto em sessões
anteriores — confirmação exigida antes de iniciar, ver `feedback-protocolo-espera-controlada`).
**Papel:** Desenvolvimento (`ENGINEERING.md` §"Papéis de Engenharia") — commit em
`develop`, sem promoção a `main` nesta Sprint.
**Branch:** `develop`
**Backup pré-mudança:** `_BACKUPS/20-PRE-SPRINT3-POLISH-WIZARD-20260725/`

## Escopo (grounded, não inventado)

`CRM/TECHDOC.md` §55 (encerramento da Sprint 2) lista **"redesign do wizard"**
como item explicitamente fora do escopo da S2. `plans/SPRINT2_CADASTRO_EMPRESAS_ENCERRAMENTO_20260723.md`
sugere como próxima etapa "polish do wizard / UX onboarding". Este ciclo
implementa esse item — só ele, sem tocar em usuários/convites, CNPJ/billing,
e-mail de boas-vindas ou promoção a produção (permanecem fora de escopo,
candidatos a S4 ou itens pontuais).

## Entrega

| Item | Resultado |
|------|-----------|
| Enter no teclado avança o passo atual (antes só clique) | ✅ |
| Foco automático no primeiro campo ao carregar e a cada troca de passo | ✅ |
| Região de erro com `role="alert"` + `aria-live="assertive"` + foco automático | ✅ |
| Indicador de passos com `aria-current="step"` + `aria-label`/`aria-valuenow` dinâmicos | ✅ |
| `maxlength` nativo alinhado aos limites já validados em JS (nome/responsável 80, e-mail 120) | ✅ |
| Teste de UI do wizard (jsdom), inexistente antes deste ciclo | ✅ 10/10 |

## Arquivos alterados

- `CRM/pages/saas-onboarding/index.html`
- `CRM/pages/saas-onboarding/saas-onboarding.js`
- `tests/onboarding/saas-onboarding-wizard.test.mjs` (novo)
- `tests/onboarding/package.json` + `package-lock.json` (novo — jsdom escopado,
  mesmo padrão de `tests/rbac/`/`tests/storage-rules/`)
- `.github/workflows/tests.yml` (novo step de CI)
- `CRM/TECHDOC.md` §56
- `PROXIMA_ETAPA.md`

## O que NÃO mudou (deliberado)

- Nenhuma funcionalidade de negócio nova (sem CNPJ, sem convite de usuário,
  sem billing) — fora do "polish do wizard" por definição documentada.
- `saas-onboarding-validacao.js` não foi tocado — a heurística de foco no erro
  usa a região de erro (`#s-erro`), não o campo específico, para não expandir
  o contrato da função de validação compartilhada (evita risco nos 11 testes
  existentes de `saas-onboarding-validacao.test.mjs`).
- Sem máscara de digitação no campo WhatsApp — avaliado e descartado por risco/
  complexidade desproporcional ao ganho (cursor/backspace em input mask é
  fonte comum de bugs); normalização já ocorre via `digitosTelefone()`.
- Sem `<form>`/`type="submit"` — Enter-to-advance implementado via listener de
  `keydown` isolado, preservando 100% os `onclick` existentes (menor risco).

## Testes

```bash
node --test tests/onboarding/saas-onboarding-wizard.test.mjs       # 10/10 (novo)
node --test tests/onboarding/saas-onboarding-validacao.test.mjs    # 11/11 (regressão)
node --test tests/integrity/integridade.test.mjs \
             tests/integrity/seguranca-fase22.test.mjs \
             tests/integrity/cota-limites.test.mjs                 # 34/34 (regressão)
cd tests/rbac && node --import ./register-loader.mjs --test *.test.mjs  # 182/182 (regressão)
cd tests/kernel && npm test                                        # 27/27 (regressão)
npm run auditar-arquitetura                                        # 🟢 íntegra
```

Zero regressão encontrada em nenhuma suíte executada.

## Residuais (não bloqueantes, não pertencem a este ciclo)

| Item | Nota |
|------|------|
| E2E onboard → approve → login / emulador CF | mesma restrição de ambiente já registrada na S2 |
| BL-007 deploy Functions nodejs22 | config ok; falta deploy (achei backup `_BACKUPS/19-PRE-BL007-DEPLOY-20260725/` de hoje 08:13, não commitado — sinal de atividade de outra sessão, não investigado pois fora do escopo desta Sprint) |
| BL-009 / BL-010 | decisão de custo / ação manual GitHub — sem dependência com este ciclo |
| Máscara de input no WhatsApp | avaliado e descartado (ver acima) — não é bloqueio, é decisão |

## Avaliação para Sprint 4

`PROXIMA_ETAPA.md` já registrava "S4 usuários" como próxima série (criação de
usuário/convite pelo operador, hoje só possível via `saas-admin` manual). Essa
sprint tem escopo próprio, não documentado em detalhe suficiente para começar
sem nova rodada de levantamento (mesmo cuidado que motivou a leitura de
`TECHDOC.md`/`SPRINT2_CADASTRO_EMPRESAS_ENCERRAMENTO_20260723.md` antes desta
Sprint 3). **Recomendação:** não iniciar S4 automaticamente — depende de
autorização explícita, com o mesmo nível de levantamento de escopo documentado
feito aqui.
