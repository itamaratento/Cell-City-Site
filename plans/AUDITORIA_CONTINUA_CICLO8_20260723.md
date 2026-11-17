# Auditoria contínua ciclo 8 — schema dual + cobertura de testes + correções

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** muda de Firestore I/O para **modelo de dados bilingue**, **gaps de teste** e correções pontuais de ciclos anteriores (evitar falso positivo).

**Modo:** somente leitura

---

## 1. Correção ciclo 7 — `posvenda` não lê OS duas vezes no happy path

```js
ordersSnap = await OS.list({ orderByField: "createdAt", direction: "desc" });
} catch {
  ordersSnap = await OS.list(); // só se orderBy falhar (índice)
}
```

É **fallback**, não duplicata paralela. O custo full-collection permanece (1× por load), mas não 2×.

---

## 2. Schema EN/PT coexistente (novo)

Contagens aproximadas de acesso a campo em `CRM/**/*.js`:

| Par | EN | PT | Leitura |
|-----|---:|---:|---------|
| `name` / `nome` | ~38 / 42 files | ~188 / 42 files | PT domina UI; EN ainda vivo |
| `phone` / `telefone` | ~73 / 16 | ~54 / 16 | **EN ainda majoritário** |
| `phoneDigits` / `telefoneDigitos` | ~12 | **0** | só EN |
| `createdAt` / `criadoEm` | ~82 | ~36 | EN majoritário em timestamps |
| `updatedAt` / `atualizadoEm` | ~29 | ~12 | EN majoritário |

`campanhas.js` já faz `(a.name || a.nome)` — padrão de sobrevivência à dualidade.

**Descoberta:** alinhado à ressalva FASE35 (`clientes.name` vs índice `nome`): **timestamps e telefone** estão mais desalinhados que o nome. Qualquer `listarPaginado({ orderByField: 'criadoEm' })` em coleções que gravam `createdAt` falha silenciosamente (docs sem campo).

Resíduo `orders`: literal em `firebase.js` + comentário em posvenda — coleção Rules ainda existe; UI migrou para `os`.

---

## 3. Dashboard × Central — divergência de escopo (semântica)

| Fonte de alerta | Dashboard | Central |
|-----------------|:---------:|:-------:|
| Agenda / OS atrasada / orçamento / pronto | ✅ | ✅ |
| Diário / sticky notes | ✅ (comentários dedicados) | ❌ |
| Financeiro (pagar/receber/fixas) | fraco | ✅ (Fase 4/9) |
| Portal | ✅ | ✅ |

Não são forks do mesmo arquivo (sim 0.18); são **produtos de alerta com coverage diferente** — usuário pode ver pendência financeira só na Central e nota de diário só no Dashboard.

---

## 4. Cobertura de testes — pastas pages sem suite óbvia

Sem arquivo de teste com nome/path alinhado:

`acaodasemana`, `central-modulos`, `central-organizacao`, **`dashboard`**, `em-breve`, `estrategia`, `kernel-test`, **`portal-cliente`**, `portal-tecnico`

**Descoberta:** dois dos maiores consumidores de Firestore (`dashboard` 13 getDocs; `portal-cliente` admin tracking unbounded) estão **fora** da malha de testes nomeada — risco de regressão de cota sem rede de segurança.

(Heurística por nome de arquivo; pode haver testes genéricos — não invalida o gap de suíte dedicada.)

---

## 5. Docs vs realidade (P2.3)

`SPRINT1_F12` afirma `PAGINACAO (já consumida pelo listarPaginado)` — tecnicamente o padrao **importa** `PAGINACAO`, mas **pages não consomem** `listarPaginado`. Homologação P2.3 já dizia “aprovado com ressalvas / meta integral não concluída” — consistente; o drift é marketing de sprint vs adoção.

---

## 6. Próxima frente

- Mapear gravação `createdAt` vs `criadoEm` por coleção (quem escreve o quê).
- Listeners `onChange` sem unsub (já em espera-readonly) → cruzar com páginas sem teste.
- UX: `premium-toast` vs `crm-toast` vs `pv-toast` (CSS tokens).
- Imports dinâmicos / code dead em `functions/`.
