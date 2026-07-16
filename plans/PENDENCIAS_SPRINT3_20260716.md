# Pendências pós-Sprint 3 / F1.4 — Resolução

**Data:** 2026-07-16
**Branch:** `develop` (sem push, sem deploy)
**Origem:** 3 itens pendentes listados em `plans/SPRINT3_ONBOARDING_RELATORIO.md`
§11 e em `plans/F1_4_CERTIFICACAO_FINAL.md` (Riscos), tratados a pedido
explícito do dono em vez de iniciar um Sprint 4 SaaS sem plano formal
(ver decisão em `CRM/ARQUITETURA.md` §5 — SaaS/multiempresa continua
congelado desde o incidente P0 de 2026-07-14).

---

## 1. `CRM/ARQUITETURA.md` §6 — Portal do Cliente desatualizado ✅ resolvido

A tabela de exceções (§6) e o inventário de `onAuthStateChanged` (§2.1)
ainda descreviam `portal.js` como um único script clássico. Atualizados
para citar os 8 arquivos-irmãos (`portal-auth.js`, `portal-painel.js`,
`portal-os.js`, `portal-garantias.js`, `portal-avaliar.js`,
`portal-mensagens.js`, `portal-contato.js`, `portal-agendamento.js`),
todos carregados via `<script src>` sequencial e estendendo
`window.Portal` via `Object.assign` — mesma descrição já usada em
`plans/SPRINT2_PORTAL_SPLIT_20260716.md`.

## 2. `tests/functions/saas-onboarding.test.mjs` — não executado (ambiente)

Tentativa de execução via `firebase emulators:exec --only firestore`:
**porta 8080 já ocupada** por outro processo Java ativo na máquina
(`lsof -i :8080` → PID de outra sessão, não identificável como minha).
Diferente do bloqueio anterior registrado no relatório do Sprint 3 (que
era `fs.inotify.max_user_watches` esgotado) — o limite atual da máquina
é 65536 (padrão), não é mais o gargalo; o gargalo agora é contenção de
porta com outra sessão concorrente rodando na mesma máquina.

**Não executado, deliberadamente:**
- Não matei o processo na porta 8080 — pode ser trabalho legítimo de
  outra sessão em andamento (mesmo cuidado já registrado em
  `feedback-concorrencia-sessoes-checkout`, memória do projeto).
- Não editei `firebase.json` (arquivo compartilhado, sem seção
  `emulators` hoje) para mudar a porta padrão — alteraria configuração
  usada por qualquer outra sessão que rode emuladores nesta árvore.
- Não usei `sudo` para nada — não seria a causa desta vez, e mesmo assim
  seria fora do escopo de mudança de código.

**Impacto:** nenhum no restante do trabalho. A lógica testada por este
arquivo (dedup via Firestore real, escrita de `saas_eventos`) já está
coberta indiretamente por `saas-onboarding-validacao.test.mjs`
(validação pura, sem emulador) — mesma conclusão já registrada no
relatório do Sprint 3. Pendência de reexecução permanece — recomenda-se
rodar quando a máquina não tiver outra sessão ocupando a porta 8080, ou
em CI.

## 3. Homologação manual do wizard de onboarding ✅ resolvido (client-side)

Servido localmente (`http-server`) e testado em Chrome headless real
(`puppeteer-core`). Fluxo exercido via `window.Onboarding` (a mesma API
pública que os botões da tela chamam via `onclick`):

| Cenário | Resultado |
|---|---|
| Avançar do Passo 1 com todos os campos vazios | 🟢 bloqueado — "Informe o nome da empresa (2 a 80 caracteres)." |
| Avançar do Passo 1 com e-mail inválido | 🟢 bloqueado — "Informe um e-mail válido." |
| Avançar do Passo 1 com dados válidos | 🟢 avança ao Passo 2; `<select>` de planos populado com as 4 opções (trial/básico/profissional/enterprise), padrão `enterprise`, texto de preço preenchido |
| Avançar do Passo 2 (plano) | 🟢 avança ao Passo 3; resumo mostra nome da empresa, responsável e e-mail digitados corretamente |
| Voltar do Passo 3 para o Passo 2 | 🟢 |
| Carregamento da página | 🟢 sem `pageerror`/`console.error` |

**Deliberadamente não exercido:** o clique em "✅ Criar Conta"
(`Onboarding.finalizar()`), que chama a Cloud Function real
`saasOnboardingCriarEmpresa`. `env-config.js` garante que qualquer
acesso fora do domínio oficial (incluindo `localhost`) resolve para o
projeto `cellcity-crm-dev`, nunca produção — mas mesmo assim executar
isso criaria uma empresa real na coleção `empresas` do Firestore de
DEV e poderia disparar efeitos colaterais (e-mail, provisionamento).
Homologação da integração real com a Cloud Function fica para quando
houver ambiente de emulador disponível (ver item 2) ou decisão
explícita do dono para testar contra o projeto DEV real.

---

## Resumo

| Item | Status |
|---|---|
| `ARQUITETURA.md` §6 desatualizado | ✅ Corrigido |
| `saas-onboarding.test.mjs` (Cloud Function + Firestore real) | ⏳ Ainda pendente — porta 8080 ocupada por outra sessão nesta máquina |
| Homologação do wizard (client-side) | ✅ Concluída — 6/6 cenários corretos, 0 erros |
| Homologação do wizard (Cloud Function real) | ⏳ Não executada deliberadamente (ver item 3) |

Nenhum arquivo de produção, credencial, Rule, Cloud Function, RBAC ou
infraestrutura alterado.
