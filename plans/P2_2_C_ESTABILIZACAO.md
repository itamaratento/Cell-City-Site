# P2.2-C — Estabilização e Preparação para Integração

**Data:** 2026-07-16  
**Base:** commit `1ff6f1e` (P2.2-B)  
**Escopo:** `CRM/shared/`, `tests/`, docs — sem módulos de página

---

## Objetivo

Validar e estabilizar a infraestrutura `app-config.js` entregue na P2.2-B, corrigir lacunas em scripts clássicos, adicionar testes automatizados de regressão e preparar o merge da outra frente (migração gradual de páginas).

---

## Problemas encontrados

| # | Problema | Severidade |
|---|----------|------------|
| 1 | `brand-header.js` ainda duplicava detecção `/dev` e URL do dashboard | Média |
| 2 | `window.CC_CONFIG` não expunha `registerTenantFiltersChecker` | Baixa |
| 3 | Teste de integridade `rsync simulado` copiava a árvore de dev inteira (`./`) — timeout >120s | Alta (CI) |
| 4 | Ausência de suíte dedicada a STORAGE_KEYS / FLAGS / CC_CONFIG em `shared/` | Média |
| 5 | `kernel.js` mantém literal `cc_kernel_v1` (protegido — fora do escopo) | Pendência |
| 6 | ~20 arquivos em `CRM/pages/` com diff local da outra frente | Integração |

---

## Problemas corrigidos

### 1. `brand-header.js` — fallback `window.CC_CONFIG`

- `dashboardHref()` usa `URLS.dashboard()` quando disponível.
- `devPathPrefix()` delega a `devPrefix()` com fallback literal.
- Logo passa a alinhar-se a `theme.js` e `sidebar.js`.

### 2. `app-config.js` — ponte CC_CONFIG ampliada

`window.CC_CONFIG` agora inclui `registerTenantFiltersChecker` (paridade com exports ESM).

### 3. Testes de integridade — rsync em fixture mínima

O teste `deploy-pages.yml: rsync simulado` passou a:

1. Criar `site-main/` temporário com stubs dos caminhos críticos.
2. Executar o **mesmo comando rsync** do workflow.
3. Validar sobrevivência de `CRM/pages/` e `CRM/scripts/`.

Tempo: ~57ms (antes: timeout por copiar `node_modules/`).

### 4. Nova suíte `tests/infra/app-config-estabilizacao.test.mjs`

10 testes cobrindo:

- Unicidade de valores em `STORAGE_KEYS`
- Estrutura de `FLAGS` + ausência de import circular
- Registro `registerTenantFiltersChecker` em `tenant-context`
- Chaves obrigatórias em `window.CC_CONFIG`
- Fallback em scripts clássicos (`theme`, `sidebar`, `brand-header`)
- ESM em `shared/` sem literais `cc_*` soltos
- `PORTAL_SYNC_KEYS` e `COLECOES` alinhados
- Compatibilidade documentada kernel ↔ `STORAGE_KEYS.KERNEL_GATE`

Script npm: `npm run validar-infra-app-config`

---

## Validação executada

| Verificação | Resultado |
|-------------|-----------|
| `npm run auditar-arquitetura` | 6/6 — grafo acíclico |
| `npm run validar-infra-app-config` | 10/10 |
| `node --test tests/integrity/integridade.test.mjs` | 14/14 |
| `node --check` (`CRM/shared/*.js`) | OK |

---

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `CRM/shared/brand-header.js` | Fallback `CC_CONFIG` para dashboard e devPrefix |
| `CRM/shared/app-config.js` | `registerTenantFiltersChecker` em `window.CC_CONFIG` |
| `tests/infra/app-config-estabilizacao.test.mjs` | **Novo** — validação P2.2 |
| `tests/integrity/integridade.test.mjs` | Rsync com fixture `site-main/` |
| `package.json` | Script `validar-infra-app-config` |
| `CRM/TECHDOC.md` | §41 |
| `PROXIMA_ETAPA.md` | Estado P2.2 |

---

## Arquivos bloqueados (não alterados)

- `CRM/pages/os/os.js`
- `CRM/pages/portal-cliente/portal.js`
- `CRM/pages/central-informacoes/informacoes.js`
- `CRM/scripts/kernel.js` (protegido — literal `FLAG_AUTH` pendente)
- Demais módulos de página (~20 com diff unstaged)

---

## Pendências para merge da outra frente

1. **Páginas:** diff local em ~20 módulos (`app-config`, `devPrefix`, `STORAGE_KEYS`) — integrar após revisão cruzada; testes de integridade já leem `os.js`/`portal.js` **sem modificá-los**.
2. **`kernel.js`:** migrar `FLAG_AUTH = 'cc_kernel_v1'` → `STORAGE_KEYS.KERNEL_GATE` quando autorizado (CLAUDE.md §1).
3. **`modulos.catalogo.json`:** regenerar após merge das páginas (`npm run gerar-catalogo`).
4. **`PORTAL_SYNC_KEYS`:** export preparado para `portal-tecnico` — consumo na outra frente.

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Ordem de carregamento em scripts clássicos | Fallback literal idêntico a `STORAGE_KEYS` |
| Merge conflituoso em páginas já migradas localmente | Infra estável; páginas fora deste commit |
| Testes de integridade leem arquivos bloqueados | Somente leitura estrutural — não altera arquivos |

---

## Compatibilidade com P2.2-B

- Ciclo `app-config ↔ tenant-context` permanece **eliminado** (auditor 6/6).
- Nenhuma chave `STORAGE_KEYS` renomeada ou removida.
- `FLAGS.filtrosTenant()` inalterado em comportamento.
- Commit incremental sobre `1ff6f1e` — sem regressão de contrato.
