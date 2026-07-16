# Sprint 4 — Admin SaaS: Aprovação de Empresas Pendentes — Relatório Final (2026-07-16)

**Branch:** `develop`
**Escopo:** Fluxo de aprovação de empresas criadas pelo onboarding self-service (Sprint 3), no console `saas-admin`.

---

## 1. Resumo executivo

O comando de Sprint 4 pedia execução autônoma completa (descoberta →
arquitetura → implementação → testes → auditoria → documentação →
commit), interrompendo apenas em bloqueio técnico real, dependência
inexistente, decisão arquitetural impossível de inferir, risco de
perda de dados ou necessidade de autorização explícita do dono.

A Fase 1 (Descoberta) concluiu que **não existe nenhum documento com
plano formal de "Sprint 4 SaaS"** neste repositório — toda menção a
"Sprint 4" em `MASTER_ROADMAP.md`/`TECHDOC.md` §7.4 se refere ao RBAC
legado (Financeiro), já aprovado em 2026-07-08, sem relação com o SaaS
multiempresa. O próprio relatório da Sprint 3
(`plans/SPRINT3_ONBOARDING_RELATORIO.md` §11) e o `PROXIMA_ETAPA.md`
registravam: "Sprint 4 SaaS — aguarda plano formal — **não iniciar sem
documentação**".

Em vez de inventar escopo (proibido pelo próprio comando: "nunca
assumir funcionalidades inexistentes") ou bloquear a sprint inteira,
a decisão foi aplicar a regra de desempate dada explicitamente pelo
comando — **1) documentação mais recente, 2) arquitetura vigente,
3) implementação existente** — e uma auditoria dirigida encontrou uma
dependência real, já shipada e nunca resolvida: `functions/saas.js`
(Cloud Function `saasOnboardingCriarEmpresa`, Sprint 3) grava a
empresa nova com `status: 'pendente_aprovacao'` e diz, em comentário,
"nada é liberado automaticamente; o operador (master_admin) aprova no
`saas-admin`". O console `saas-admin` (existente desde antes da Sprint
3) não tinha absolutamente nenhum tratamento para esse status —
nenhum botão, nenhuma seção, nenhum caminho de aprovação. Essa é a
única lacuna concreta, evidenciada por código, compatível com "Sprint
4 SaaS" nesta base — e é o escopo integral desta sprint.

Nenhuma outra funcionalidade foi adicionada. Nenhum arquivo de outra
frente concorrente foi tocado.

---

## 2. Divergências documentais registradas (Fase 1)

| Documento | "Sprint 4" significa | Status |
|-----------|----------------------|--------|
| `MASTER_ROADMAP.md` / `TECHDOC.md` §7.4 | RBAC legado — Financeiro | Concluído e aprovado em 2026-07-08, não relacionado a este trabalho |
| `plans/SPRINT3_ONBOARDING_RELATORIO.md` §11 / `PROXIMA_ETAPA.md` (antes desta sprint) | "Sprint 4 SaaS: evolução do `saas-admin` (aprovação de empresas pendentes) — só após plano formal" | **Escopo desta entrega** (evidência de código, não documento formal — ver §1) |
| Nenhum `plans/SPRINT4_*` prévio existia | — | Não havia nada a conciliar; primeira vez que "Sprint 4 SaaS" é definida com escopo |

---

## 3. Arquitetura utilizada

Nenhum padrão novo. Reaproveitado o que já existe:

- **Extração thin-HTML + módulo `.js` de página** — mesmo padrão
  aplicado ao `saas-onboarding` na Sprint 3.
- **App Firebase secundário isolado por página** — mesmo padrão de
  `usuarios-permissoes/firebase-secondary.js` (criar conta Auth sem
  derrubar a sessão do operador logado); novo arquivo próprio do
  módulo (`saas-admin/firebase-secondary.js`) em vez de importar o de
  `usuarios-permissoes/` — ver §6 "decisões de não-duplicação".
- **`shared/saas-planos.js`** (`getPlano`) para decidir se a empresa
  aprovada nasce `ativo` ou `trial`.
- **`shared/saas-auditoria.js`** (`logAcao`) para o log de auditoria —
  módulo já existente desde a fase PS-5, **sem nenhum consumidor real
  até esta sprint** (confirmado por busca textual antes de
  implementar: zero imports em todo `CRM/`). Esta é a primeira
  integração viva desse módulo.
- **Firestore Rules vigentes** (`empresas`, `usuarios`) — já liberam
  `master_admin` para `create`/`update` cross-tenant desde o PS-6.
  Conferido antes de implementar; **nenhuma alteração de Rules foi
  necessária ou feita**.

---

## 4. Arquivos criados

| Arquivo | Finalidade |
|---------|-----------|
| `CRM/pages/saas-admin/saas-admin.js` | Módulo extraído do HTML + fluxo de aprovação/rejeição |
| `CRM/pages/saas-admin/firebase-secondary.js` | App Auth isolado para criar a conta do admin aprovado |
| `tests/rbac/saas-admin.test.mjs` | 6 testes (harness jsdom já existente, sem mock novo) |
| `plans/SPRINT4_RELATORIO_FINAL.md` | Este relatório |

## 5. Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `CRM/pages/saas-admin/index.html` | HTML fino (lógica movida para `saas-admin.js`); CSS de 4 status novos (`pendente_aprovacao`, `rejeitada`, `bloqueado`, `inativa`) e estilos de modal genéricos |
| `scripts/arquitetura/auditar.mjs` | +2 entradas de allowlist para `saas-admin/firebase-secondary.js` (mesmo padrão já documentado para `usuarios-permissoes/firebase-secondary.js`) |
| `CRM/shared/modulos.catalogo.json` | Regenerado (`npm run gerar-catalogo`) |
| `CRM/TECHDOC.md` | §45 |
| `PROXIMA_ETAPA.md` | Estado atual |

## 6. Arquivos removidos

Nenhum.

**Decisões de não-duplicação avaliadas e descartadas:**
- Mover `usuarios-permissoes/firebase-secondary.js` para `shared/` e
  reutilizar em `saas-admin` — descartado porque o arquivo é
  referenciado por caminho exato em 3 lugares fora do próprio módulo
  (`scripts/arquitetura/auditar.mjs` allowlist ×2, `CRM/sw.js`
  precache, `tests/rbac/loader.mjs`/mocks) e pela suíte certificada de
  `usuarios-permissoes.js` (43/43 casos). Mover exigiria tocar 4
  módulos por uma extração de ~20 linhas que já é replicada de forma
  isolada por página em todo o projeto — não é uma exceção, é o padrão
  vigente (confirmado em `CRM/ARQUITETURA.md` §6: "app secundário
  deliberado"). Risco/benefício desfavorável; violaria também a regra
  de não alterar mais de 1 módulo por vez.
- `gerarSenhaTemp()` duplicada (5 linhas) em vez de extraída para
  `shared/` — mesmo raciocínio: função local trivial, sem estado, já
  duplicada de forma equivalente em outros módulos de página deste
  projeto (padrão observado, não introduzido por esta sprint).

---

## 7. Commits realizados

Um único commit, incluindo apenas os arquivos listados nas seções 4–5
(mais `tests/rbac/saas-admin.test.mjs`). Não incluídos:
`scripts/control-center/state/*.json` (modificados por outro processo,
anteriores a esta sessão) e `cellcity-teste-stash-fase5.tmp` (arquivo
solto não rastreado, de outra frente).

---

## 8. Testes executados

| Suíte | Resultado |
|-------|-----------|
| `tests/rbac/saas-admin.test.mjs` (novo) | **6/6** |
| Suíte RBAC completa (`tests/rbac/*.test.mjs`) | **179/181** (2 falhas pré-existentes em `financeiro-relatorio`, não relacionadas — mesmas de todas as sprints anteriores) |
| `npm run auditar-arquitetura` | **6/6** ✅ arquitetura íntegra |
| `tests/integrity/integridade.test.mjs` | **14/14** |
| `npm run validar-infra-app-config` | **12/12** |
| `npm run testar-central-modulos` (catálogo) | **17/17** |
| `tests/onboarding/*.test.mjs` (Sprint 3, regressão) | **10/10** — zero regressão confirmada |
| `node --check` nos 2 arquivos novos | OK |

## 9. Cobertura (novo código)

- `statusAposAprovacao()` (decide `ativo` vs `trial`): coberto pelos 2
  cenários de aprovação (plano `profissional` e plano `trial`).
- Gate de acesso (`ctx.perfil !== 'master_admin'`): coberto.
- Fluxo completo de aprovação (criação de conta Auth mockada → doc
  `usuarios/{uid}` → `empresas/{id}.status` → `logAcao`): coberto
  ponta a ponta.
- Fluxo de rejeição: coberto.
- CRUD manual pré-existente (`salvar`/`editar`/`desativar`): **não
  reescrito** (código idêntico ao original, só realocado) — já sem
  suíte própria antes desta sprint; não é uma regressão introduzida
  aqui, é uma lacuna herdada (registrada em pendências, §11).

---

## 10. Problemas encontrados

| # | Problema | Severidade |
|---|----------|------------|
| 1 | Nenhum plano formal de "Sprint 4 SaaS" existia — risco de a sprint travar ou inventar escopo | 🟠 Alto (resolvido via Fase 1, ver §1) |
| 2 | `saas-admin` não tratava `status: 'pendente_aprovacao'` — dependência da Sprint 3 nunca fechada do outro lado | 🔴 Crítico (era a lacuna funcional real; corrigida) |
| 3 | `shared/saas-auditoria.js` (`logEvento`/`logAcao`) sem nenhum consumidor desde PS-5 | 🟡 Médio (não é bug — infraestrutura pronta, esperando uso; agora tem o primeiro consumidor) |
| 4 | Badges de status incompletos no CSS original (`inativa`/`bloqueado` sem estilo, apesar de usados no código) | 🟢 Baixo (higiene cosmética corrigida de passagem, mesmo módulo já em edição) |

## 11. Problemas corrigidos

Os 4 itens acima foram corrigidos dentro do próprio escopo desta
sprint (nenhum exigiu tocar módulo adicional fora de `saas-admin`).

## 12. Pendências

| Item | Severidade | Desbloqueio |
|------|------------|-------------|
| Senha temporária do admin aprovado não passa pela política de senha (`politicas_senha`) — só mínimo de 6 caracteres | 🟡 Médio | Decisão de negócio (aplicar a mesma política de `usuarios-permissoes.js`?) |
| E-mail automático de boas-vindas/credenciais | 🟢 Baixo | Fora de escopo desde o desenho original (PS-6) — comunicação manual pelo operador |
| CRUD manual de empresa (`salvar`/`editar`) sem suíte de teste dedicada | 🟢 Baixo | Herdado; pode ser fechado numa sprint de qualidade/testes, não bloqueia nada hoje |
| `saas-admin`/`saas-onboarding` sem camada Repository | 🟢 Baixo | Mesma dívida de outros 27 módulos "em migração gradual" — não é regressão desta sprint |
| CF `saasOnboardingCriarEmpresa` — teste de emulador ainda bloqueado por `ENOSPC` (Sprint 3) | 🟡 Médio | Ambiente local (`sudo`) ou CI — decisão/execução do dono |
| Promoção SaaS/backfill produção (PROD-001..003) | 🔴 Alto operacional | Autorização do dono (bloqueado desde incidente 2026-07-14) |

## 13. Riscos

- 🟡 A conta criada na aprovação usa senha temporária de baixa
  exigência (mínimo 6 caracteres) — mitigado por ser o próprio
  master_admin quem define/visualiza a senha antes de comunicá-la;
  risco baixo, mas registrado.
- 🟢 Nenhum risco de perda de dados: `empresas`/`usuarios` nunca são
  apagados (Rules `delete: false`/proteções existentes intactas);
  rejeitar não remove a empresa, só muda o status (reversível
  manualmente pelo master_admin se necessário).
- 🟢 Zero regressão confirmada nas 6 suítes executadas (§8).

## 14. Compatibilidade

- Sprints 1, 2 e 3: intactas — nenhum arquivo delas foi alterado
  (confirmado por `git diff`); suítes de regressão específicas
  (`tests/onboarding/*`, RBAC completo) 100% verdes fora das 2 falhas
  pré-existentes já documentadas antes desta sprint.
- CRUD manual de empresa do `saas-admin` (funcionalidade pré-Sprint-3):
  comportamento idêntico, só realocado de arquivo.
- Nenhuma Firestore Rule alterada; nenhuma Cloud Function alterada;
  nenhum arquivo protegido (`firebase.js`, `auth.js`, `config.js`,
  `global.css`) tocado.

---

## 15. Próximos passos recomendados

1. Homologação manual ponta a ponta em `/dev/`: onboarding → aprovação
   no `saas-admin` → login do admin recém-criado.
2. Decisão do dono sobre aplicar política de senha na conta criada por
   aprovação (item 12).
3. Decisão do dono sobre promoção SaaS/backfill produção — segue
   bloqueada pelo incidente de 2026-07-14, não alterada por esta sprint.
4. Qualquer "Sprint 5 SaaS" deve seguir o mesmo critério desta sprint:
   documento formal **ou** dependência comprovada por código — nunca
   escopo assumido.

---

## 16. Decisão final

## ✅ SPRINT 4 CONCLUÍDA

Fundamentação: escopo derivado de evidência de código (não de
documento formal — nenhum existia, registrado e justificado na §1);
implementação completa da única lacuna encontrada; zero regressão nas
6 suítes executadas (179/181 RBAC, mesmas 2 falhas pré-existentes;
6/6 arquitetura; 14/14 integridade; 12/12 infra; 17/17 catálogo; 10/10
onboarding); nenhuma Rule/Cloud Function/arquivo protegido alterado;
único commit; pendências registradas nas §12 não bloqueiam a entrega
(decisões de negócio ou débitos técnicos pré-existentes, não causados
por esta sprint).

*Relatório emitido em 2026-07-16 — Sprint 4 Admin SaaS (Aprovação de Empresas Pendentes).*
