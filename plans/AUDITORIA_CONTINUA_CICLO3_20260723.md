# Auditoria contínua ciclo 3 — HTML, nomenclatura, logs, XSS surface

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** muda de frente após cruzamento de erros/toasts/clones; agora **navegação órfã**, **naming de coleções**, **política de logs vs realidade**, **innerHTML**.

**Modo:** somente leitura

---

## 1. Páginas HTML fora do hub de navegação

Fontes de link: `modulos.catalogo.json` + `sidebar.js` + `dashboard-ui.js`.

| Status | Path | Nota |
|--------|------|------|
| ORPHAN | `catalogo/public/index.html` | entrada pública — link externo (`URLS.CATALOGO_PUBLICO_PROD` / `catalogo.html`), não hub CRM |
| ORPHAN | `portal-tecnico/{central-projeto,softwares,solucoes-tecnicas,tutorials}/` | sub-rotas sem URL no catálogo; só o index do portal-técnico está linkado |
| WEAK | `crm-comercial/{chips,chips-entrada,entrada}.html` | satélites do CRM comercial (navegação interna) |
| WEAK | `kernel-test/modulo-test.html` | harness de teste |
| WEAK | `portal-cliente/index.html` | fora do catálogo de módulos internos (entrada cliente) |

**Descoberta:** subpáginas do Portal Técnico podem estar **mortas ou só acessíveis por path direto** — risco de feature half-shipped ou deep-link sem menu.

---

## 2. Nomenclatura estoque / produtos (inconsistência)

| Literal | Literais | Papel aparente |
|---------|----------|----------------|
| `estoque_produtos` | 11 / 8 files | coleção operacional principal |
| `estoque` | 13 / 6 files | id de módulo RBAC/sidebar + coleção Rules legada? |
| `produtos` | 3 | backup/busca/repo |
| `catalogo_produtos` | 2 | catálogo público |
| `categorias_produtos` | 2 | import/repo |

**Descoberta:** três eixos (`estoque` / `estoque_produtos` / `produtos` / `catalogo_*`) coexistindo — aumenta risco de query na coleção errada e de Rules “largas” sem UI.

---

## 3. Logs: config morta vs `console.*` vivo

| Sinal | Valor |
|-------|------:|
| `console.*` em `CRM/pages` | **358** (log 125 / warn 131 / error 102) |
| Top arquivo | `dashboard-alarme-os.js` (**65**) |
| Usos de `LOGS` fora `app-config` | **2** (`cc-sync`, `usuarios-permissoes`) |
| `debugAtivo` | 4 |
| `TEMPOS` (app-config) | **0** usos |

**Descoberta:** Sprint 1.2 criou fachada `LOGS`/`TEMPOS`/`PAGINACAO` quase sem adoção; telemetria real = `console.*` cru, concentrado em alarme OS + portal + OS.

---

## 4. Superfície `innerHTML` (XSS / sanitização)

Top: `os.js` (21), `financeiro.js` (20), `crm.js` (15), `relatorios.js` (14), admin portal / diário / informacoes (12).

Já existe `sanitize.escHtml`, mas escape local duplicado (ciclo 1) e muitos `innerHTML` sem auditoria linha-a-linha nesta passagem.

**Plano (auth):** varrer top-5 arquivos com checklist “dado de usuário → innerHTML”.

---

## 5. Próxima frente (inédita)

- Complexidade ciclomática / funções > N linhas nos outliers (`os.js`, `informacoes.js`).
- Comparar padrões Repository (`createTenantRepository`) vs `getDocs` direto residual.
- Revisar CSS/UX de toast/modal entre módulos.
- Documentação oficial vs `MASTER_ROADMAP` stale (sem reabrir F-docs).

---
