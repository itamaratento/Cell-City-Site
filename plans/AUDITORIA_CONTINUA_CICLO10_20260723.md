# Auditoria contínua ciclo 10 — regra “pronto” divergente + tenant gaps

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** diff semântico concreto dashboard × central (prometido no ciclo 8/9) + leituras sem tenant na janela.

**Modo:** somente leitura · **achado de produto** (não só higiene)

---

## 1. Bug/inconsistência: status legado `pronto` no alerta “não retirados”

Comentário no dashboard (contagem):

```text
'concluido' = novo fluxo; 'pronto' = OS antigas
if (os.status === 'concluido' || os.status === 'pronto') osPronto++;
```

Mas o alerta **APARELHOS NÃO RETIRADOS**:

| Superfície | Filtro efetivo |
|------------|----------------|
| Dashboard | `where('status','==','concluido')` — **só concluido** |
| Central | `if (os.status !== 'concluido') return` — **só concluido** |

**Descoberta:** OS antigas com `status === 'pronto'` entram na **contagem** de “prontos” em um fluxo, mas **não geram** o alerta de não-retirados (>3 dias) em nenhum dos dois painéis. Regra de negócio documentada no comentário **não está aplicada** no alerta.

Cópia quase literal do bloco (timeline `→ Concluído`, fallback `updatedAt`, limiar **> 3 dias**) — clone com drift só no título/detail/link; o bug do status legado é **compartilhado**.

---

## 2. Orçamentos: limiar alinhado

Ambos: status `orcamento` | `orcamento_enviado`, `dias > 2` via `updatedAt`. Dashboard faz query filtrada; Central filtra em memória sobre `OS.list()` full — mesmo critério, custo diferente.

---

## 3. `getDocs` sem `injectTenantFilter` na janela (amostra)

| Local | Nota |
|-------|------|
| `financeiro.js` subcoleção `…/itens` | path sob categoria já tenant? verificar Rules |
| `saas-admin.js` | coleção global de empresas — esperado |
| `catalogo/public` | catálogo público — esperado |
| `chat.js` / `compras.js` / `dashboard-backup.js` | **revisar** se `q` já embute tenant fora da janela |

Não é veredito de vazamento cross-tenant sem ler a query completa — é **lista de suspeitos** para auth de segurança.

---

## 4. CSS OS “não referenciado” (heurística frágil)

~30 classes em `os.css` sem string literal em html/js — muitas `status-*` provavelmente montadas por concatenação (`status-${x}`). **Não** marcar como mortas sem AST. `orc-opcao*` / `orc-resposta*` merecem checagem (UI portal de orçamento?).

---

## 5. `functions/lib/*`

Todos usados via `admin.js` / `os.js` / `portal.js` / `saas.js` — **nenhum lib órfão**.

---

## 6. Próxima frente

- Confirmar no código OS quais status legados ainda são gravados (`pronto` vs `concluido`).
- Diff da regra de pós-venda 5/15/30 entre dashboard e central.
- Suspeitos tenant: ler `chat.js` / `compras.js` queries completas.
- MASTER_ROADMAP / docs stale (sem repetir F-series).
