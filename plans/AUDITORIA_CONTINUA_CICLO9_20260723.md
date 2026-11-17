# Auditoria contínua ciclo 9 — timestamps dual write + toast CSS + CF

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** ciclo 8 detectou dualidade EN/PT; este ciclo mapeia **quem grava** `createdAt` vs `criadoEm`, fragmentação visual de toast e uso das Cloud Functions exportadas.

**Modo:** somente leitura

---

## 1. Quem escreve qual timestamp

### Família `createdAt` (EN)
`os.js` (clientes/OS paths), `importar.js`, `posvenda.js`, `dashboard-alertas-panel.js`, CRM entrada/crm (parcial), saas-admin, usuarios-permissoes, kernel, tenant-provider.

### Família `criadoEm` (PT)
`caixa.js` (5), `diario.js` (4), `financeiro.js` (3), `comandos.js` (3), `informacoes.js`, chat, catalogo, fornecedor, chips…

### Ambos no mesmo arquivo
| Arquivo | createdAt | criadoEm |
|---------|----------:|---------:|
| `os.js` | 3 | 2 |
| `crm.js` / `entrada.js` | 1 | 1–2 |
| `usuarios-permissoes.js` | 1 | 1 |

**Descoberta:** não é só legado vs novo módulo — **OS e CRM gravam os dois nomes** em fluxos diferentes. Paginar por um único campo é inseguro sem normalização na Repository (`orderByField` default por coleção).

---

## 2. Toast CSS: 5 skins, mesma ideia

| Classe | Onde | Nota visual |
|--------|------|-------------|
| `.toast` | caixa, contas, central-org | baseline |
| `.premium-toast` | OS | bottom 20px |
| `.crm-toast` | CRM | **bottom 80px** (dock?) |
| `.pv-toast` | pós-venda | bottom 24px |
| `.cfg-toast` | clientes | bottom 24px |

**Descoberta:** unificar `showToast` sem unificar CSS ainda deixa CRM com toast mais alto (provável conflito com dock) — decisão de UX deliberada ou drift.

---

## 3. Cloud Functions exportadas

16 callables em `functions/index.js` — **todas** têm referência no client e/ou testes. Nenhuma API exportada “morta” neste inventário.

Módulos `lib/config.js`, `lib/empresa.js`, `lib/saas-planos.js` não aparecem no `require` direto do index (podem ser transitivos via `saas.js`/`portal.js`) — micro-frente: confirmar se algum lib ficou órfão.

---

## 4. Índice MODO CONTÍNUO (ciclos 1–9)

1. getDocs/boot/PAGINACAO · 2. toast clone/escape/a11y surface · 3. HTML/logs/innerHTML · 4. complexidade/repo bypass · 5. admin limit gap · 6. P2.3 morta + central · 7. `.list` 97% sem teto · 8. schema dual + testes · 9. write-path timestamps + toast CSS + CF

---

## 5. Próxima frente

- Confirmar requires transitivos dos `functions/lib/*`.
- Diff semântico de 1 regra de alerta (ex.: “pronto não retirado”) dashboard vs central.
- Dead CSS / classes nunca referenciadas (amostra OS/dashboard).
- Revisar `injectTenantFilter` ausente em algum `.list`/getDocs.
