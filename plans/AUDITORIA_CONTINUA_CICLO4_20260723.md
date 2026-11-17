# Auditoria contínua ciclo 4 — complexidade + Repository bypass

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** aprofunda outlier `os.js` e confronta **Repository Layer vs `getDocs` direto** — frente não coberta nos ciclos 1–3.

**Modo:** somente leitura

---

## 1. Complexidade: funções mais longas

| Linhas | Função | Arquivo |
|-------:|--------|---------|
| 192 | `toggleOSEdit` | `os.js:936` |
| 137 | `renderClientForm` | `os.js:2286` |
| 119 | `renderDetail` | `os.js:816` |
| 105 | `salvarInformacao` | `informacoes.js:1235` |
| 95 | `buildDetalheHtml` | `crm.js:536` |
| 86 | `saveOS` | `os.js:583` |
| 80 | `editarAgendamentoPendente` | `posvenda.js:672` |
| 79 | `fecharMes` | `financeiro.js:938` |

`os.js` sozinho: **146** funções declaradas; 5 das 8 maiores do sample estão nele.

**Descoberta:** hotspot de manutenção = edição/detalhe OS — qualquer mudança de schema/RBAC ali tem custo alto.

`portal-cliente/admin.js`: objeto `window.PortalAdmin` (0 `function` clássica) — métrica de “funções” não aplica; arquivo ainda ~1410 linhas.

---

## 2. Repository Layer vs acesso Firestore direto

**18** repositories em `CRM/repositories/` cobrindo a maior parte das coleções de negócio.

### Páginas com `getDocs` **sem** import de repository

| Pasta | getDocs | Tem repo de domínio? |
|-------|--------:|----------------------|
| `dashboard` | 13 | parcial (`sistema`) — não importa |
| `financeiro` | **8** | **sim** (`financeiro.repository.js`) — **bypass total** |
| `portal-cliente` | 6 | **sim** (`portal.repository.js`) — bypass |
| `caixa` | 3 | **sim** (`caixa.repository.js`) — bypass |
| `auditoria` / `importar` / `chat` / `compras` / … | 1–3 | misto |

Evidência `financeiro.js`:

```text
import { … getDocs … } from '../../scripts/firebase.js'
# sem import de financeiro.repository.js
getDocs(query(collection(db, COL_PAGAR), …)) // × várias
```

**Descoberta arquitetural:** a Repository Layer existe, mas **Financeiro / Caixa / Portal Admin** ainda falam Firestore na cara — inconsistência entre módulos “novos” (comandos/informações usam repo) e módulos críticos de cota.

Isso explica parte do ranking getDocs do ciclo 1 e bloqueia `PAGINACAO`/`limit` centralizados no base repository.

---

## 3. Portal Técnico: conteúdo órfão de menu

Subpáginas com peso real (não stubs):

| Path | Tamanho HTML |
|------|-------------:|
| `tutorials/` | ~46 KB |
| `solucoes-tecnicas/` | ~40 KB |
| `central-projeto/` | ~36 KB |
| `softwares/` | ~23 KB |

Index do portal linka CSS compartilhado; **não** aparecem no catálogo de módulos. Provável navegação só via cards do `portal-tecnico/index.html` (deep links) — validar se cards existem (próximo micro-ciclo) ou se são páginas fantasmas.

---

## 4. Nota sobre `admin.js` “limit(100)”

Cabeçalho do arquivo afirma `limit(100) em todas as collections` (otimização v2.4). Ciclo 1 contou getDocs sem `limit` na janela — **possível comentário desatualizado** ou limits via helper. Requer verificação linha-a-linha (ciclo 5).

---

## 5. Próxima frente

- Verificar `limit` real em `portal-cliente/admin.js`.
- Mapear cards/links internos do Portal Técnico.
- Comparar `base.repository.js` API vs o que Financeiro precisaria para migrar.
- Revisar documentação de arquitetura Repository vs prática.
