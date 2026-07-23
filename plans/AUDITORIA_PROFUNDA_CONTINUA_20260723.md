# Auditoria profunda contínua (pós F01–F20)

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa de frente:** F01–F20 esgotadas em superfície; este ciclo **aprofunda performance Firestore + consistência entre módulos + exports subutilizados + complexidade** — análises não repetidas 1:1.

**Modo:** somente leitura

---

## 1. Inventário quantificado: `getDocs` sem `limit` (novo)

Método: varredura de `CRM/pages` + `CRM/shared`; janela de 250 chars após `getDocs(` sem `limit(`.

| Métrica | Valor |
|---------|-------|
| Chamadas `getDocs(` | **47** |
| Sem `limit` na janela | **42** (~89%) |

### Top hotspots (novo ranking)

| # | Arquivo | Chamadas sem limit |
|---|---------|-------------------|
| 1 | `financeiro/financeiro.js` | 8 |
| 2 | `dashboard/dashboard-alertas.js` | 6 |
| 3 | `portal-cliente/admin.js` | 6 |
| 4 | `dashboard/dashboard-busca.js` | 4 |
| 5 | `caixa/caixa.js` | 3 |
| 6–8 | auditoria, crm, importar | 2 cada |
| … | saas-admin, fornecedor, chat, backup, … | 1 |

**Descoberta:** o risco de cota não é genérico — concentra-se em **3 arquivos** (~20/42 = 48% das ocorrências).

**Plano (com auth):** backlog “limit/paginação” começando por financeiro → dashboard-alertas → portal admin.

---

## 2. Padrão inconsistente de boot RBAC (novo)

| Padrão | Qtd | Exemplos |
|--------|-----|----------|
| `initModulo` **e** `carregarPermissoes` | 29 | maioria dos módulos de negócio |
| Só `initModulo` | 2 | `saas-admin.js`, `usuarios-permissoes.js` |
| Só `carregarPermissoes` | 0 | — |
| Nenhum dos dois | 34 | helpers/dashboard split/portal fragments |

**Descoberta:** SaaS Admin e Usuários/Permissões **não** chamam `carregarPermissoes` no mesmo padrão dos módulos RBAC — gates provavelmente custom (master_admin). Vale confirmar se há regressão de matriz operacional nesses dois.

---

## 3. Exports `app-config` subutilizados (novo)

Contagem de ocorrências do símbolo em pages+shared+kernel (inclui definição):

| Export | Hits (aprox.) | Interpretação |
|--------|---------------|---------------|
| `STORAGE_KEYS` | 71 | bem adotado |
| `URLS` | 46 | bem adotado |
| `devPrefix` | 27 | parcial |
| `DEFAULT_TENANT_ID` | 19 | OK |
| `FLAGS` | 5 | pouco |
| `ENV` | 5 | pouco |
| `TEMPOS` / `LOGS` / `AUDITORIA` / `CACHE` | 4–5 | fachada quase morta |
| **`PAGINACAO`** | **2** | **praticamente órfão** — irônico dado P1 |

**Descoberta:** existe constante `PAGINACAO` quase sem uso enquanto 42 `getDocs` não paginam — oportunidade de refatoração alinhada.

---

## 4. Complexidade / funções semelhantes

| Arquivo | Linhas |
|---------|--------|
| `os/os.js` | **2736** (outlier) |
| `central-informacoes/informacoes.js` | 1455 |
| `portal-cliente/admin.js` | 1410 |
| `financeiro.js` | 1133 |
| `crm.js` | 1127 |

**Escape HTML triplicado (novo):**
- `CRM/shared/sanitize.js` → `escHtml`
- `dashboard-alertas-panel.js` → `esc` local
- `saas-admin.js` → `esc` local

Oportunidade: unificar em `sanitize.escHtml`.

---

## 5. Listeners / erros (amostra aprofundada)

- `dashboard-alertas-panel.js`: **múltiplos** `onSnapshot` (os, posvenda, agendamentos, diagnóstico, pre_os) — custo contínuo na abertura do painel.
- `dashboard-alarme-os.js`: guarda `unsubscribeFirebase` / `unsubscribeOS` (padrão melhor).
- `catch (e) {}` vazio: vários (localStorage/audio) — aceitável; 39 catches com console.warn/log em pages.

---

## 6. Próxima frente automática (ainda inédita)

→ Comparar **tratamento de erros** e **toasts** entre `os.js` / `financeiro.js` / `caixa.js` (padrão de UX de falha).  
→ Ou mapear **coleções referenciadas no client** vs `firestore.rules` (órfãs / sem UI).

---

## Conclusão deste ciclo

Não repetiu F01–F20. Gerou **descobertas quantitativas novas** (ranking getDocs, boot só-init, PAGINACAO órfã, escape triplo, outlier os.js).
