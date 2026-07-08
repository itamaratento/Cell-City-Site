# Homologação de Performance — comando único

Automatiza o processo de homologação usado nas entregas da Fase 1 (pollers)
e Fase 2 (cache persistente do Firestore) do
`plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md` (ver `CRM/TECHDOC.md` §24),
para que as próximas entregas relacionadas a performance sigam o mesmo
processo sem repetir manualmente cada passo.

**Escopo:** só audita, testa, homologa em navegador e documenta. Não altera
nenhum arquivo do sistema.

## Uso

```bash
npm run homologar-performance
```

Gera uma pasta nova em `evidencias/<timestamp>/` com:

```
evidencias/<timestamp>/
  relatorio.md          — relatório final (o mesmo formato usado no CRM/TECHDOC.md §24.6)
  screenshots/           — capturas de cada etapa do navegador
  console/                — log de console de cada página visitada
  network/                — requisições ao Firestore observadas por página
  logs/
    audit.json            — saída bruta da Fase 1
    tests.json            — saída bruta da Fase 2
    browser.json          — saída bruta da Fase 3
```

Ao final, imprime `RECOMENDAÇÃO FINAL: APROVADO | APROVADO COM RESSALVAS | REPROVADO`
e sai com código `1` se for `REPROVADO` (útil para travar um script maior).

## O que cada fase faz

1. **Auditoria** (`lib/audit.mjs`) — branch, commit, divergência com
   `origin`, arquivos modificados/não rastreados, arquivos protegidos
   (`firebase.js`/`auth.js`/`config.js`/`global.css`, mesma lista do
   `CLAUDE.md` §1) alterados sem backup.
2. **Testes** (`lib/tests-runner.mjs`) — `node --check` nos `.js`
   modificados, Firestore Rules, Cloud Functions do Portal, RBAC, o teste
   isolado de padrão de polling (`tests/performance/polling-gating.test.mjs`)
   e um smoke estático do cache da Fase 2 (confirma que a API
   `initializeFirestore`/`persistentLocalCache`/`persistentMultipleTabManager`
   continua presente em `firebase.js`).
3. **Navegador real** (`lib/browser.mjs`) — Chrome headless via
   `puppeteer-core`: login (sem senha — ver seção "Login" abaixo), Dashboard,
   Central de Alertas (`document.hidden`/`visibilitychange` reais), cache
   offline (lê um documento real, corta a rede via CDP, confirma
   `fromCache: true`, reconecta), 2ª aba simultânea (confirma ausência de
   `failed-precondition`).
4. **Relatório e aprovação** (`lib/report.mjs`) — cruza falhas de teste
   contra `known-issues.json` (pendências já registradas, não bloqueantes) e
   aplica os critérios de aprovação.

## Login sem senha

A Fase 3 nunca usa a senha de ninguém. Usa a mesma técnica já documentada
neste projeto (memória `feedback-uid-dev-prod-nao-reusar`): via
`sa-key-dev.json` (Admin SDK), resolve o UID da conta de homologação pelo
e-mail, **confirma que o doc `usuarios/{uid}` existe no projeto DEV alvo**
(evita reusar UID de outro ambiente) e gera um `createCustomToken`. A conta
padrão é `cellcityadmin@gmail.com` (perfil `admin` — ver memória
`project-padrao-usuarios-homologacao`), configurável via
`HOMOLOG_TEST_EMAIL`.

## Variáveis de ambiente (todas opcionais)

| Variável | Default | Uso |
|---|---|---|
| `HOMOLOG_SKIP_BROWSER` | _(vazio)_ | `1` pula a Fase 3 inteira (sem Chrome/credencial disponível) |
| `HOMOLOG_SA_KEY_PATH` | `./sa-key-dev.json` | service account do projeto DEV |
| `HOMOLOG_FIREBASE_PROJECT` | `cellcity-crm-dev` | **nunca aponte para produção** |
| `HOMOLOG_TEST_EMAIL` | `cellcityadmin@gmail.com` | conta de homologação (precisa já existir no DEV) |
| `HOMOLOG_CHROME_PATH` | `/usr/bin/google-chrome` | binário do Chrome/Chromium |
| `HOMOLOG_SERVE_PORT` | `8899` | porta do servidor estático local (serve a raiz do repo) |

## Pendências conhecidas (`known-issues.json`)

Lista de falhas de teste **pré-existentes e já investigadas**, que não devem
bloquear a aprovação de uma entrega que não as causou. Formato:

```json
{ "suite": "rbac", "test": "nome exato do teste", "reason": "...", "since": "YYYY-MM-DD", "ref": "onde foi documentado" }
```

Uma falha só é tratada como "conhecida" se o nome do teste bater
exatamente. Qualquer falha nova gera `REPROVADO` — a ideia é impedir que uma
pendência antiga vire desculpa para esconder uma regressão nova.

## O que este comando NÃO faz

- Não decide sozinho se deve dar `push` — isso continua sendo decisão de
  quem está conduzindo a entrega, lendo o `relatorio.md` gerado.
- Não roda dentro da CI (`.github/workflows/tests.yml`) — só a Fase 2 (sem
  Fase 3) está na CI, porque a Fase 3 exige credencial do DEV e Chrome real,
  que não fazem sentido rodar automaticamente em qualquer PR.
- Não altera nenhuma funcionalidade do sistema.
