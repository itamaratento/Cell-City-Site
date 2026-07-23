# Auditoria cruzada entre módulos (ciclo 2 — contínuo)

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** após inventário getDocs/boot/PAGINACAO, esta frente **compara padrões entre módulos** (UX de erro, toasts, clones, coleções, exports mortos) — não repete F01–F20 nem o ranking getDocs.

**Modo:** somente leitura

---

## 1. Tratamento de erro / UX inconsistente

| Módulo | alert | confirm | toast | console.error | try/catch |
|--------|------:|--------:|------:|--------------:|-----------|
| `os.js` | **8** | 4 | 81 | 17 | 39/36 |
| `financeiro.js` | 0 | 5 | 28 | 1 | 17/3 |
| `caixa.js` | 0 | 4 | 26 | 13 | 14/12 |
| `estoque.js` | 0 | 1 | 7 | 0 | 5/5 (`catch` sem binding) |

**Descoberta:** OS ainda usa `alert()` nativo; Financeiro/Caixa já migraram para toast.  
**Residuais `alert(`:** catalogo (11), os (8), dashboard-alertas-panel (7), dashboard-alarme-os (4), saas-admin (3), posvenda (2), +3 arquivos com 1.

**financeiro:** muitos `try` vs poucos `catch` — sugere `.then`/fluxo sem captura simétrica ou try aninhado sem catch no mesmo escopo (vale revisão pontual).

---

## 2. `showToast` clonado (API duplicada)

Definições locais quase idênticas em:
`caixa.js`, `os-ui-utils.js`, `posvenda.js`, `crm.js`, `impressao.js`, `chips*.js`, `entrada.js`.

Padrão comum: `#toast` + `classList.add('show')` + timeout. CRM usa `#crm-toast`.

**Oportunidade:** um `shared/toast.js` + IDs padronizados — reduz divergência UX (duração, null-check).

---

## 3. Clone estrutural: Comandos ↔ Informações

| Função | Similaridade de corpo |
|--------|----------------------:|
| `filtrarPorCategoria` | **1.00** |
| `setViewMode` | **1.00** |
| `montarCategorias` / `montarSelectCategorias` | 0.98 |
| `salvarCategoria` / `abrirFormCategoria` / `aplicarBotoesView` | 0.95–0.97 |
| `toggleFavorito` | 0.80 |

14 nomes de função compartilhados; vários corpos ≥95% iguais.

**Descoberta:** maior candidato a extração compartilhada no CRM (fora Kernel) — risco baixo se isolado em helper de UI de “central *”.

---

## 4. Coleções Rules × literais no client

Nenhuma coleção das Rules está **totalmente** ausente de literais quoted (após corrigir falso negativo do `collection()` direto — o app usa **Repository Layer**).

### Superfície “fina” (1–2 literais) — atenção

| Coleção | Onde |
|---------|------|
| `clients` / `orders` | `firebase.js` (+ `orders` em posvenda) — nomes EN legados? |
| `cc_lixeira` / `cc_gdrive_logs` | só `app-config.js` |
| `_diagnostico_temp` | só `kernel-test` |
| `chat_mensagens` | só `chat.js` |
| `auditoria_saas` / `saas_eventos` | só `saas-auditoria.js` |

Alinhado a exports mortos em `cc-sync.js` (`enviarParaLixeira`, `purgarLixeira`, `COL_LIXEIRA` com **0** usos externos).

---

## 5. Exports / APIs pouco usadas (shared)

| Módulo | Símbolos quase mortos |
|--------|----------------------|
| `app-config.js` | `TEMPOS` (**0**), `PAGINACAO`/`LOGS`/`FLAGS` (≤1) |
| `cc-sync.js` | lixeira quase toda |
| `saas-planos.js` | `temModulo`, `temFeature`, `getFeatureFlags`, `getModulosPorPlano` (0) |
| `session.js` | `loginEmail`/`loginGoogle`/`criarContaEmail`/`onUid` (0 no grep de uso) |
| `permissoes.js` | `podeAprovar`, `getMatrizAtual` (0) |
| `date-utils.js` | `formatDateFull` (0) |

**Nota:** “0 usos” ≠ deletar — pode ser API reservada SaaS; marcar como **candidato a documentação “público interno”** ou remoção após auth.

---

## 6. Acessibilidade (varredura)

| Marcador | Contagem aprox. em CRM |
|----------|------------------------:|
| `aria-*` | 60 |
| `role=` | 7 |
| `tabindex` | 1 |
| `alt=` | 11 |
| `<label` | 482 |

**Descoberta:** formulários têm labels, mas **ARIA/roles quase ausentes** em modais/toasts/alertas — UX de leitores de tela frágil (frente nova vs F-series).

---

## 7. Próxima frente automática (ainda inédita)

1. Mapear **páginas HTML órfãs** (sem link no sidebar/menu).  
2. Comparar **nomenclatura** `estoque` vs `estoque_produtos` vs `produtos`.  
3. Medir **imports órfãos** por arquivo (import declarado, símbolo não usado).  
4. Revisar **logs** (`console.*` vs `LOGS` config).

---
