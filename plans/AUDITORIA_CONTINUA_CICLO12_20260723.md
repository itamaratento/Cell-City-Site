# Auditoria contínua ciclo 12 — STATUS_LEGACY só rótulo + XSS surface OS

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** fecha a dúvida do ciclo 11 sobre `STATUS_LEGACY` e aprofunda `innerHTML` em `os.js` (função/arquivo outlier).

**Modo:** somente leitura

---

## 1. `STATUS_LEGACY` **não** canônica status no Firestore

```js
const STATUS_LEGACY = {
  pronto: 'Concluído',  // ← string de RÓTULO, não key 'concluido'
  …
};
// uso: return STATUS_LEGACY[status] || status || '';  // label para UI
```

Alertas **não** importam esse mapa. Continuam comparando `os.status === 'concluido'`.

**Descoberta refinada (ciclo 10→12):** o problema não é “mapa existe e alertas ignoram a normalização de key” — o mapa **nunca normaliza key**, só texto. Docs com `status: 'pronto'` no banco:

1. Aparecem com label “Concluído” na UI OS (via mapa).
2. **Não** entram no `where('status','==','concluido')` do dashboard.
3. Contagem dual `concluido||pronto` nos alertas tenta cobrir (1) mas o alerta de não-retirados **não**.

Isso é inconsistência de produto mensurável se ainda houver OS `pronto` em PROD (só dado real confirma volume).

---

## 2. `os.js` `innerHTML`: ~7 templates com interpolação sem `esc`/`escHtml` na janela

Exemplos heurísticos (linha aprox.):

| Área | Risco |
|------|--------|
| checklist / photos | IDs e URLs em template |
| stats chips | `orders.length` (baixo) |
| client tags | **`${t}` sem esc** — tag editável? |
| modais | markup grande |

Já há ~5 sites com esc na janela — padrão **inconsistente dentro do mesmo arquivo**.

**Oportunidade (auth):** obrigar `escHtml` em todo `innerHTML` com dado de cliente/OS; alinhar ao `sanitize.js` (ciclo 1 escape triplo).

---

## 3. Compras como padrão positivo (ciclo 11)

`limit(500)` + `injectTenantFilter` em compras vs financeiro **0× limit** — referência interna para backlog de cota.

---

## 4. Índice ciclos 1–12 (modo contínuo)

Performance Firestore → padrões cruzados → docs/HTML → complexidade/repo → admin gap → API P2.3 morta → `.list` 97% → schema dual → timestamps/toast/CF → regra pronto → pós-venda/docs → STATUS_LEGACY/XSS OS.

---

## 5. Próxima frente

- Volume: script de estimativa impossível sem Firestore; marcar como **hipótese** até auth de leitura PROD/DEV.
- Diff `orcamento` legado nos alertas (query inclui `orcamento` + `orcamento_enviado` — melhor que pronto).
- CSS tokens / design-system vs CSS por página.
- `cr-toast` em compras (mais um ID de toast).
