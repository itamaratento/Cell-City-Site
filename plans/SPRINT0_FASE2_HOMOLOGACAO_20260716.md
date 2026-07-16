# Sprint 0 — FASE 2: Homologação Final (2026-07-16)

**HEAD homologado:** commits até esta fase (bateria re-executada após cada correção).
**Ambiente:** sandbox local, Node 22.23.1, Chrome headless real (`/usr/bin/google-chrome`), emulador Firestore.

## Checklist executado

| Item | Resultado | Detalhe |
|---|---|---|
| Lint/Build (node --check em todos os arquivos tocados) | ✅ | zero erros de sintaxe |
| Testes RBAC (jsdom + código real) | ✅ 173/175 | 2 falhas pré-existentes (financeiro-relatorio), não relacionadas |
| Firestore Rules (emulador) | ✅ 105/105 | inclui isolamento multiempresa (tenant) |
| Cloud Functions (emulador) | ⚠️ 11/25 | falhas pré-existentes do rate limiter in-memory entre testes (P0.2); idêntico antes/depois de toda a Sprint 0 |
| Integridade | ✅ 14/14 | invariante das rules invertido: duplicata da raiz agora é PROIBIDA (fonte única CRM/) |
| Performance (polling gating) | ✅ 4/4 | |
| **E2E em browser real** | ✅ **9/9** | **primeira execução verdadeira da suíte** (bug do require corrigido na FASE 1); 2 premissas erradas do teste corrigidas (networkidle0 × Firebase long-poll; grid × gate de auth) |
| Console sem erros | ✅ | `pageerror` capturado em 7 páginas (boot, login, dashboard, OS, caixa, portal, garantia) — zero erros JS |
| Teste de autenticação (gate) | ✅ | E2E validou: Dashboard sem sessão **redireciona para login** |
| Multiempresa | ✅ | Rules de isolamento (105/105) + injeção empresa_id nos repositories (repositories-api 9/9, dentro do RBAC) |
| PWA (estático) | ✅ | manifest com PNGs reais 512/1024; SHELL v19 zero 404; install resiliente |
| Offline | 🟡 | validação estática do SW (SHELL íntegro + estratégia de fetch revisada); teste funcional offline exige browser com SW ativo — pendência manual |
| Smoke Test | ✅ | E2E (9/9) + Integrity (14/14) |

## Lighthouse (real, Chrome headless, servidor local)

| Página | Performance | Best Practices | Meta ≥95 |
|---|---|---|---|
| login.html | **98** | 96 (a11y 91, seo 91) | ✅ |
| garantia.html | **100** | **100** | ✅ |
| portal-cliente | 88–94 (2 runs) | 96 | ❌ — monólito portal.js (DT-18, pendência P2.2) |
| CRM/index.html (boot) | N/A | N/A | redirector instantâneo por design — imensurável |
| Páginas autenticadas (dashboard etc.) | — | — | exigem credencial real; medir via `homologar-performance` Fase 3 com conta de homologação |

**Leitura honesta da meta:** páginas públicas principais atingem/superam 95 (login 98, garantia 100).
O Portal fica 1–7 pontos abaixo, coerente com o monólito de 2.363 linhas já mapeado (DT-18) —
a correção é a divisão do portal.js (pendência declarada da P2.2), não um ajuste cosmético.
"Best Practices acima de 100%" é matematicamente impossível (teto 100); atingido 96–100.

## Ferramenta oficial `homologar-performance` — DESATUALIZADA (achado)

Rodada com `HOMOLOG_SKIP_BROWSER=1` (Fase 3 exige credencial de conta de homologação, indisponível
nesta sessão): resultado **REPROVADO é artefato da própria ferramenta**, não do projeto —
`lib/tests-runner.mjs` (1) parseia a saída do `node --test` no formato antigo `ℹ pass N`, mas o
Node 22 emite `# pass N` → toda suíte vira `null`/falha mesmo passando; (2) invoca a suíte RBAC
sem `--import tests/rbac/register-loader.mjs` (obrigatório desde a criação do loader). As mesmas
suítes passaram na bateria direta desta fase. **Pendência:** atualizar o runner (2 correções pontuais).

## Veredito da FASE 2

**APROVADA COM RESSALVAS** — ressalvas: (1) Lighthouse do Portal abaixo da meta (causa e correção
já mapeadas: DT-18/P2.2); (2) páginas autenticadas e offline funcional pendentes de rodada com
credencial de homologação na máquina do dono; (3) runner oficial de homologação desatualizado;
(4) falhas pré-existentes conhecidas (functions rate-limiter 14, financeiro-relatorio 2).
Nenhuma regressão introduzida pela Sprint 0 em nenhuma suíte.
