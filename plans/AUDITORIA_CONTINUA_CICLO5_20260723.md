# Auditoria contínua ciclo 5 — correção portal admin + API repo

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** ciclo 4 apontou dúvida sobre `limit(100)` em `admin.js`; esta frente **verifica evidência** e confronta com `base.repository` — descoberta nova, não repetição.

**Modo:** somente leitura

---

## 1. `portal-cliente/admin.js`: comentário vs código

| Área | Tem `limit(100)`? | Evidência |
|------|-------------------|-----------|
| Listeners `onSnapshot` (mensagens, avaliações, diagnóstico, agendamentos) | **Sim** | queries ~L265–286 |
| `_buscarResumoTracking` / stats `portal_eventos` | **Não** | `where('tipo','==','acesso'|'clique_*')` **sem** `limit` nem filtro de data no servidor |

Trecho crítico: carrega **todos** os eventos `acesso` do tenant e filtra “hoje” no cliente; idem cliques WhatsApp/Maps (só `snap.size`).

**Descoberta:** o header “limit(100) em todas as collections” está **desatualizado / incompleto**. O crescimento de `portal_eventos` vira custo linear a cada abertura do painel de tracking — pior que um `getDocs` pontual sem limit em coleção pequena.

Ciclo 1 (42 getDocs sem limit na janela) **não era falso positivo** para portal admin: os 6 hits batem com tracking/estatísticas, não com os listeners já limitados.

---

## 2. Financeiro: zero `limit(` no arquivo

`financeiro.js`: **nenhuma** ocorrência de `limit(` — 8× `getDocs` sem teto.

Enquanto isso, `base.repository.js` já expõe:

```js
buildQuery({ …, limitTo = null })
// list(opts) → getDocs(buildQuery(opts))
```

**Descoberta:** a ferramenta de paginação **já existe na Repository Layer**; Financeiro/Caixa simplesmente **não a usam** (bypass). Migrar não exige inventar API — só adotar `list({ limitTo: PAGINACAO.… })` + eventualmente `listarPaginado` do `comApiPadrao`.

---

## 3. Portal Técnico (correção ciclo 3)

Subpáginas **não são órfãs de navegação**: `portal-tecnico/index.html` tem cards `onclick` → `tutorials/`, `solucoes-tecnicas/`, `central-projeto/`, `softwares/`.

São órfãs apenas do **catálogo de módulos** (esperado para hub aninhado). Ciclo 3 ORPHAN → reclassificar como **hub interno OK**.

---

## 4. Índice vivo deste modo contínuo (2026-07-23)

| Artefato | Frente |
|----------|--------|
| `AUDITORIA_PROFUNDA_CONTINUA_20260723.md` | getDocs ranking, boot RBAC, PAGINACAO órfã, escape triplo |
| `AUDITORIA_CRUZADA_MODULOS_20260723.md` | alert/toast, clone comandos↔info, exports mortos, a11y |
| `AUDITORIA_CONTINUA_CICLO3_20260723.md` | HTML hub, naming estoque, console vs LOGS, innerHTML |
| `AUDITORIA_CONTINUA_CICLO4_20260723.md` | funções longas, repo bypass |
| `AUDITORIA_CONTINUA_CICLO5_20260723.md` | admin limit gap, repo API pronta |

---

## 5. Próxima frente

- Inspecionar `comApiPadrao` / `listarPaginado` — quem já consome?
- Dashboard (13 getDocs): quais coleções e se há listener duplicado com alertas.
- Documentação `ENGINEERING.md` / arquitetura Repository vs prática Financeiro.
- UX toast CSS: `#toast` vs `#crm-toast` inconsistência visual.
