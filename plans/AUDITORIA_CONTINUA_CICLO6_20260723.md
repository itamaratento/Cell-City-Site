# Auditoria contínua ciclo 6 — API P2.3.2 morta + Central Alertas

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** ciclo 5 mostrou `limitTo` pronto no base repo; agora mede **adoção real** da API P2.3.2 e o custo de quem já usa `.list()`.

**Modo:** somente leitura

---

## 1. `listarPaginado` / API PT: quase zero consumo

| Símbolo | Onde aparece |
|---------|----------------|
| `listarPaginado` | só `base.repository.padrao.js` (+ menção indireta) |
| `listar(` (API PT) | só definição no padrao |
| `PAGINACAO` | `app-config` + padrao (default page size) — **nenhuma page** |
| `limitTo` em pages | **1** uso: `central-alertas.js` → `Avaliacoes.list({ limitTo: 5 })` |

**Descoberta:** a padronização P2.3.2 (envelope `{ok,dados,erro}`, cache, paginação keyset) está **implementada e documentada no próprio arquivo**, mas **não entrou no fluxo de produto**. É dívida de adoção, não de design.

---

## 2. Central de Alertas: `.list()` sem teto (pior que getDocs isolado)

Em um único `Promise.all` (~L152–160):

```text
Agenda.list()                 // sem limit
OS.list()                     // SEM LIMIT — coleção crítica
PosvendaContatos.list()
MensagensPortal.list({ where: lida==false })
Avaliacoes.list({ limitTo: 5 })   // único com teto
FinanceiroPagar.list()        // SEM LIMIT
FinanceiroReceber.list()
FinanceiroFixas.list()
```

**Descoberta:** módulo que **já usa Repository** ainda dispara leituras full-collection em OS + 3 coleções financeiras ao abrir. Paginação da API PT não ajuda até alguém passar `limitTo` / `listarPaginado`.

Isso é mais grave que Financeiro “bypass” isolado: aqui o padrão “correto” (repo) está em uso, mas **sem disciplina de cota**.

---

## 3. Dashboard: 13 `getDocs` — mapa

| Arquivo | Coleções (sem limit aparente no call site) |
|---------|--------------------------------------------|
| `dashboard-alertas.js` | agenda, os, posvenda_contatos, + portal/avaliações/OS status queries |
| `dashboard-busca.js` | os, clientes, estoque_produtos, fallback `produtos` |
| `dashboard-caixa.js` | caixa_lancamentos |
| `dashboard-backup.js` | genérico via FB.getDocs |

Busca do dashboard: **duas** coleções de produto (`estoque_produtos` → `produtos`) — eco da nomenclatura do ciclo 3.

---

## 4. UX toast: IDs/classes divergentes

| Módulo | Markup |
|--------|--------|
| caixa / contas / central-org | `class="toast" id="toast"` |
| OS | `class="premium-toast" id="toast"` |
| CRM | `class="crm-toast" id="crm-toast"` |
| pós-venda | `class="pv-toast" id="toast"` |
| clientes | `class="cfg-toast" id="toast"` |

Alinha com `showToast` clonado (ciclo 2): unificar JS sem unificar CSS/ID ainda fragmenta visual.

---

## 5. Próxima frente

- Contar quantos `.list()` sem `limitTo` existem em pages.
- Comparar `dashboard-alertas.js` × `central-alertas.js` (duplicação de regras de alerta?).
- Docs: P2.3.2 marcada “feita” vs adoção 0.
- A11y de toasts (role=status / aria-live).
