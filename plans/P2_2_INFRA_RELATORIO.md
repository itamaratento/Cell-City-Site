# P2.2-B — Infraestrutura e Padronização (Relatório)

**Data:** 2026-07-16  
**Branch:** `develop`  
**Escopo:** `CRM/shared/` e `CRM/scripts/` (sem alteração de módulos de página)

---

## Objetivo

Consolidar a infraestrutura compartilhada do client após a F1.2 (`app-config.js`): eliminar dependência circular, centralizar constantes (`STORAGE_KEYS`, `COLECOES`, `FLAGS`), padronizar imports e remover código/import morto — sem alterar regras de negócio, UI, RBAC ou fluxos.

---

## Dependência circular eliminada

**Antes (P2.2 transitório):**

```
app-config.js  ──import { areTenantFiltersEnabled }──►  tenant-context.js
       ▲                                                        │
       └──── import { STORAGE_KEYS } ───────────────────────────┘
```

**Depois:**

- `tenant-context.js` importa `STORAGE_KEYS` e `registerTenantFiltersChecker` de `app-config.js`.
- `app-config.js` **não** importa `tenant-context.js`; `FLAGS.filtrosTenant` delega via registro em runtime.
- Grafo permanece **acíclico** (auditor 6/6).

---

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `CRM/shared/app-config.js` | +20 `STORAGE_KEYS`; +`COLECOES`; `registerTenantFiltersChecker()`; removido import estático de `tenant-context`; `window.CC_CONFIG` expõe `COLECOES` |
| `CRM/shared/tenant-context.js` | `STORAGE_KEYS.TENANT_CACHE`; registra checker para `FLAGS.filtrosTenant` |
| `CRM/shared/tenant-resolver.js` | `STORAGE_KEYS.SUPORTE_EMPRESA` (Modo Suporte) |
| `CRM/shared/cc-sync.js` | `COLECOES` + `STORAGE_KEYS.DEVICE_NICK`; removido import morto `devPrefix` |
| `CRM/shared/central-modulos.js` | `STORAGE_KEYS` (modulos); `devPrefix()` no lugar de detecção `/dev` duplicada |
| `CRM/shared/dock.js` | `STORAGE_KEYS` (DOCK_ORDEM, KERNEL_GATE, DOCK_USER) |
| `CRM/shared/favoritos.js` | `STORAGE_KEYS` (FAVORITOS, ULTIMA_TELA); `devPrefix()` em `envUrl()` |
| `CRM/shared/portal-sync.js` | `STORAGE_KEYS`; export `PORTAL_SYNC_KEYS`; doc de uso com imports relativos |
| `CRM/shared/sidebar.js` | Fallback `window.CC_CONFIG` para `STORAGE_KEYS` e `devPrefix()` (script clássico IIFE) |
| `CRM/shared/theme.js` | Fallback `window.CC_CONFIG.STORAGE_KEYS.TEMA` (script clássico síncrono no `<head>`) |
| `CRM/TECHDOC.md` | §40 — registro desta fase |

**Não alterados (outra frente Sprint 2):** `CRM/pages/os/os.js`, `CRM/pages/portal-cliente/portal.js`, `CRM/pages/central-informacoes/informacoes.js`, demais módulos de página.

**Não alterados (protegidos):** `kernel.js`, `firebase.js`, `auth.js`, `config.js`, `global.css`.

---

## STORAGE_KEYS centralizadas (novas entradas)

Chaves migradas de literais espalhados para `app-config.js`:

`DOCK_ORDEM`, `FAVORITOS`, `MODULOS_FAVS`, `MODULOS_CATALOGO`, `MODULOS_LOG`, `SIDEBAR_PREFS`, `COMANDOS_*`, `CATEGORIAS_CACHE`, `MIGRACAO_V1_LOG`, `DIARIO_PANELS`, `PREOS_CACHE`, `TENANT_CACHE`, `DEVICE_NICK`, `PT_TUTORIAIS`, `PT_FAVORITOS`.

Scripts clássicos (`theme.js`, `sidebar.js`) usam literais com **fallback** via `window.CC_CONFIG` quando o módulo `app-config` já foi carregado na página.

---

## COLECOES Firestore

```javascript
COLECOES.CC_LIXEIRA      // 'cc_lixeira'
COLECOES.CC_GDRIVE_LOGS  // 'cc_gdrive_logs'
```

Consumidor: `cc-sync.js` (reexporta `COL_LIXEIRA` / `COL_LOGS` para compatibilidade).

---

## FLAGS padronizadas

| Flag | Fonte |
|------|-------|
| `FLAGS.filtrosTenant()` | Runtime — `tenant-context` via `registerTenantFiltersChecker` |
| `FLAGS.CHAT_ATIVO` | Estática — `false` |
| `FLAGS.SAAS_ONBOARDING_ATIVO` | Estática — `false` |

---

## Imports corrigidos

- Removido import circular `app-config → tenant-context`.
- `portal-sync.js`: exemplo de doc atualizado para imports relativos (H-008).
- `cc-sync.js`: import morto `devPrefix` removido.

---

## Código morto removido

- Import não utilizado `devPrefix` em `cc-sync.js`.
- IIFE redundante com variável `p` não usada em `central-modulos.js` (substituída por `devPrefix()`).
- Imports ESM inválidos appendados por script de migração em arquivos clássicos — **não reaplicados**; `theme.js`/`sidebar.js` mantêm padrão IIFE + `CC_CONFIG`.

---

## Testes executados

| Verificação | Resultado |
|-------------|-----------|
| `npm run auditar-arquitetura` | 🟢 6/6 — grafo acíclico, 0 imports quebrados |
| `node --check` (`CRM/shared/*.js`, `CRM/scripts/*.js`) | 🟢 OK |
| `npm run testar-central-modulos` | 🟡 catálogo JSON desatualizado (efeito colateral da migração de **páginas**, fora deste commit) |
| `tests/integrity/integridade.test.mjs` | ⏸ não concluído — timeout >90s (pré-existente) |

---

## Riscos

1. **Ordem de carregamento:** `theme.js` roda síncrono no `<head>` antes de `app-config`; fallback literal `'cc_theme'` garante compatibilidade — valores idênticos a `STORAGE_KEYS.TEMA`.
2. **FLAGS.filtrosTenant:** retorna `false` até `tenant-context` registrar o checker (comportamento idêntico ao import estático anterior, que só falhava se o módulo não fosse carregado).
3. **Migração de páginas pendente:** ~20 arquivos em `CRM/pages/` com diff local de outra frente — **não incluídos** neste commit.

---

## Pendências (fora P2.2-B)

- Adoção gradual de `app-config.js` nos módulos de página (Fase 1.4).
- `brand-header.js`: ainda usa detecção `/dev` local (candidato a `window.CC_CONFIG.devPrefix()`).
- `session.js` legado (A1-01) — intocado.
- Regenerar `modulos.catalogo.json` após merge das frentes de página.
- Investigar timeout em `tests/integrity/integridade.test.mjs`.

---

## Validação de escopo

Nenhum arquivo proibido foi modificado neste commit:

- ❌ `CRM/pages/os/os.js`
- ❌ `CRM/pages/portal-cliente/portal.js`
- ❌ `CRM/pages/central-informacoes/informacoes.js`
