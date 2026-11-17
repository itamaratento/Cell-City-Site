# Auditoria contínua ciclo 7 — `.list()` sem teto + a11y live regions

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** quantifica adoção de `limitTo` em **todas** as pages (ciclo 6 era amostra Central Alertas) + checa ARIA live em toasts.

**Modo:** somente leitura

---

## 1. Inventário completo: `.list(` nas pages

| Métrica | Valor |
|---------|------:|
| Chamadas `.list(` | **29** |
| Com `limitTo` / limit | **1** (3%) |
| Sem teto | **28** (97%) |

### Hotspots (sem limit)

| Arquivo | Calls sem limit | Risco |
|---------|----------------:|-------|
| `central-alertas.js` | 7 | OS + 3× financeiro full |
| `posvenda.js` | 4 | OS.list **duas vezes** + contatos + msgs |
| `fornecedor.js` / `estoque.js` | 3 | estoque+produtos |
| `comandos.js` | 3 | OK em volume baixo típico |
| **`os.js`** | 2 | `OSRepository.list()` + `ClientesRepository.list()` — **boot carrega tudo** |
| diario / autoatendimento / catalogo / contas / campanhas | 1–2 | campanhas: **todos os clientes** |

**Descoberta:** o problema de cota **não é só getDocs bypass** — a Repository Layer, quando usada, chama `.list()` sem `limitTo` em 97% dos casos. P2.3.2 não falhou na implementação; falhou na **disciplina de chamada**.

`posvenda.js` L91+L94: **dois** `OS.list()` próximos — possível leitura duplicada da mesma coleção no mesmo fluxo.

---

## 2. Dashboard Alertas × Central Alertas

- Similaridade textual prefixo 8k: **0.18** (implementações distintas).
- Vocabulário de negócio sobreposto (atrasado/orçamento/pronto/portal/agenda).
- Central puxa **financeiro** com peso alto; dashboard quase não.

**Descoberta:** duas UIs de “alertas” com **regras paralelas**, não um motor compartilhado — risco de divergência (ex.: OS atrasada conta em um e não no outro).

---

## 3. Acessibilidade: regiões ao vivo

Varredura `aria-live` / `role="status"` em CRM: **0 arquivos**.

Toasts (`#toast`, `#crm-toast`, etc.) atualizam texto via JS sem anunciar a leitores de tela.

**Descoberta:** gap a11y concreto e barato de corrigir (auth): `role="status" aria-live="polite"` nos containers de toast.

---

## 4. Próxima frente

- Confirmar duplicata `OS.list()` em posvenda (mesmo load).
- Extrair lista de regras de alerta dashboard vs central (diff semântico).
- Revisar `campanhas.js` → `Clientes.list()` sem filtro.
- Docs oficiais: menção P2.3 “completa” vs adoção.
