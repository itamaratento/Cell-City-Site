# Frente 1 — Segurança (segredos + auth Cloud Functions)

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**  
**Motivo:** fila Frentes 1–20; ângulo distinto de fase22 (XSS/CSPRNG).

---

## 1. Segredos hardcoded

| Achado | Veredito |
|--------|----------|
| `CRM/shared/env-config.js` — 2× `apiKey: 'AIza…'` (DEV/PROD) | **Esperado** para Firebase Web SDK (chave de cliente). Risco controlado por restrições de API/HTTP referrer no Console — não é service account. |
| PEM / private key em repo | **Falso positivo** — `auditoria-seguranca.sh` só lista *strings de detecção* |
| `Math.random` p/ senha | **Não** (fase22 cobre); usos restantes = IDs UI (`dock_`, `cp_`) — OK |

Nenhum PEM/SA JSON novo no código de produto nesta varredura.

---

## 2. Auth nas Cloud Functions

| Módulo | Modelo de auth | Controles |
|--------|----------------|-----------|
| `os.js` (consulta pública) | **Sem** Firebase Auth — proposital (substitui `allow get: if true`) | Rate limit; whitelist `OS_CAMPOS_PUBLICOS`; CPF mascarado; phoneDigits na variante por telefone |
| `portal.js` | **Sem** Auth — `phoneDigits` como prova fraca | Rate limit; ownership checks por dígitos; documentado no header |
| `saas.js` onboarding | **Sem** Auth — cadastro público | Rate limit; status `pendente_aprovacao`; sem criar user Auth |
| `admin.js` `excluirUsuarioAdmin` | **Com** Auth | Exige `request.auth`; perfil master_admin / admin |

### Achado (não inventado)

Callables públicas (`os`/`portal`/`saas`) **dependem de rate-limit in-memory + conhecimento de telefone/OS id**. Isso é dívida consciente pós-Sprint 1a/1b (já em TECHDOC), não regressão nova. Vetores residuais: enumeração de OS id (mitigado por projeção) e spam de onboarding (mitigado por pendente_aprovação + rate limit).

`admin.js` é o único caminho privilegiado inspecionado — padrão correto (auth + papel).

---

## 3. Fora de escopo desta frente (já coberto)

XSS OS / fase22 · PIN 1056 · alerta `pronto` — não repetidos.

---

## Próxima frente

→ **Frente 2 — Performance (assets/scripts)**.
