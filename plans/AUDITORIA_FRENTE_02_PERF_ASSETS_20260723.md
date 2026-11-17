# Frente 2 — Performance (assets / scripts)

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**  
**Motivo:** ângulo novo — **não** recontar getDocs/`.list()`.

---

## Achados

1. **Portal Cliente** lidera carga de scripts: **12× `<script src>`** em `portal-cliente/index.html` (vários módulos portal-*.js). Dashboard: 8.

2. **Shell global em quase todas as páginas:** `theme.js` (41), `brand-header.js` (30), `dock.js` (26), `obs-expand.js` (23) — scripts clássicos repetidos; **preload = 0** em 46 HTML.

3. **`defer`/`async` raros:** só 4 páginas com defer, 3 com async; 44 usam `type=module` (bom para o app), mas o shell clássico bloqueia parse sem defer na maioria.

4. **Payload JS:** `os.js` **~179 KB** (outlier); próximos ~40–60 KB (admin, financeiro, informacoes, crm). Sem code-split/lazy route (arquitetura multipage — esperado).

5. Firebase não aparece como CDN gstatic nos HTML de pages (carregamento via `scripts/firebase.js` / módulos) — positivo vs dual-load CDN.

---

## Oportunidades (auth)

- `defer` em `theme.js` / `brand-header.js` / `dock.js` onde ordem permitir.  
- Portal: agregar ou lazy-load abas (`portal-avaliar` etc.) sob demanda.  
- Não conflitar com dívida de cota Firestore (P1 separado).

---

## Próxima frente

→ **Frente 3 — Arquitetura vs ADRs**.
