# Auditorias continuidade — Frentes 1 a 5 (somente leitura)

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · Sem alteração de produto

---

## Frente 1 — Segurança ✅

### Achados novos / refinados

| ID | Achado | Pri | Evidência |
|----|--------|-----|-----------|
| S1 | `catalogo_config/{docId}` com `allow get: if true` | 🟡 Intencional (catálogo público) | `firestore.rules:767-769` |
| S2 | Web API keys Firebase em `env-config.js` / `backup-dados.js` | 🔵 Esperado (não são segredo Admin) | arquivos rastreados |
| S3 | `sa-key*.json` em disco, gitignored; **não** tracked | 🟡 Risco local de máquina | `.gitignore` 87–88; `git ls-files` limpo |
| S4 | XSS residual: `innerHTML` + interpolação em várias UIs | 🟡 | portal-*, os.js, saas-onboarding resumo, posvenda |
| S5 | Portal/OS pública via CF + rate limit | 🟢 | `functions/portal.js`, `os.js`, `lib/rate-limit.js` |
| S6 | Senha temp SaaS com `crypto.getRandomValues` | 🟢 | `saas-admin.js:42-48` |
| S7 | BL-011 Rules ≠ matriz | 🟡 Dívida ADR A | já documentado |
| S8 | Storage sem bucket | 🟠 | BL-009 |

**Plano de correção (só com auth):** revisar escape em `saas-onboarding` resumo e portais; política de rotação SA local; BL-007/009.

---

## Frente 2 — Performance ✅

| ID | Achado | Pri | Arquivos |
|----|--------|-----|----------|
| P1 | `getDocs` sem `limit` em listas operacionais | 🟠 | financeiro, dashboard-busca, dashboard-alertas, dashboard-caixa, saas-admin, importar, chat, fornecedor |
| P2 | ~67 usos de `onSnapshot`/listeners | 🟡 | verificar unsubscribe por tela (não auditado linha a linha neste ciclo) |
| P3 | 27 páginas ainda com Firestore direto (fora repository) | 🟡 | audit arquitetura |
| P4 | Node 20 CF | 🔴 | BL-007 |

**Plano:** paginação/`limit` nos hotspots; completar migração repository; BL-007.

---

## Frente 3 — Arquitetura ✅

Reexecução: `node scripts/arquitetura/auditar.mjs` → **🟢 Arquitetura íntegra** (6/6).

| Métrica | Valor |
|---------|-------|
| Fan-in kernel / firebase / permissoes / app-config | 41 / 33 / 32 / 29 |
| Páginas | 33 |
| Com kernel | 32 (exceção: saas-onboarding) |
| Com repository (transitivo) | 20 |
| Firestore direto | 27 |

Sem ciclo acíclico / imports quebrados neste HEAD.

---

## Frente 4 — Firestore ✅

| ID | Achado | Pri |
|----|--------|-----|
| F1 | Padrão dominante: auth + `temAcessoLiberado` + tenant | 🟢 |
| F2 | Único `get: if true` restante auditado: `catalogo_config` | 🟡 documentado |
| F3 | OS get público fechado (Sprint 1a) | 🟢 |
| F4 | Queries client sem limit (custo) | 🟠 = P1 |
| F5 | BL-011 sem matriz nas Rules | 🟡 ADR A |

---

## Frente 5 — Cloud Functions ✅

| ID | Achado | Pri |
|----|--------|-----|
| CF1 | 16 exports Gen2 `onCall` | 🟢 |
| CF2 | Rate limit em portal/os/saas | 🟢 |
| CF3 | Runtime **nodejs20** | 🔴 BL-007 |
| CF4 | Deps: admin ^12.6 / functions ^6.0 (lock 12.7 / 6.6) | 🟢 OK base |
| CF5 | Onboarding dedup e-mail sem transação (corrida) | 🟡 já em homologação SaaS |

---

## Próxima frente automática

→ **6 — Front-end**
