# Sprint 1 F1.4 — Adoção de app-config.js nos módulos de página (Relatório)

**Data:** 2026-07-16
**Branch:** `develop`
**Escopo:** 20 módulos em `CRM/pages/` (sem `shared/`, sem `scripts/`)

---

## Objetivo

Adotar, nos módulos de página, as constantes centralizadas em
`CRM/shared/app-config.js` (`URLS`, `devPrefix`, `STORAGE_KEYS`) introduzidas
na F1.2 e consolidadas na P2.2-B — eliminando a detecção `/dev` duplicada
inline e as chaves de `localStorage`/`sessionStorage` como literais soltos
pelo código. Pendência registrada como "Fase 1.4" no relatório da P2.2-B
(`plans/P2_2_INFRA_RELATORIO.md`).

---

## Padrão aplicado (mecânico, repetido nos 20 arquivos)

```js
import { URLS, devPrefix, STORAGE_KEYS } from '../../shared/app-config.js';
```

- `(location.pathname==='/dev'||location.pathname.startsWith('/dev/')?'/dev':'') + '/CRM/pages/dashboard/index.html'`
  → `URLS.dashboard()`
- `(location.pathname==='/dev'||location.pathname.startsWith('/dev/')?'/dev':'')` (usado em outras montagens de URL)
  → `devPrefix()`
- Chaves literais de `localStorage`/`sessionStorage` (`'cc_os_fav'`,
  `'cc_crm_prefill'`, `'cc_comandos_cache'` etc.) → `STORAGE_KEYS.*`
  correspondente

Nenhuma lógica de negócio, RBAC, UI ou fluxo alterado — só a origem da
constante.

## Arquivos alterados (20)

`acaodasemana.js`, `auditoria.js`, `autoatendimento.js`, `caixa.js`,
`campanhas.js`, `central-alertas.js`, `central-comandos/comandos.js`,
`central-informacoes/informacoes.js`, `chat.js`, `compras.js`,
`crm-comercial/chips-entrada.js`, `crm-comercial/chips.js`,
`crm-comercial/crm.js`, `crm-comercial/entrada.js`, `diario.js`,
`estoque.js`, `financeiro.js`, `fornecedor.js`, `importar.js`, `os/os.js`.

Mais `CRM/shared/modulos.catalogo.json` (regenerado — cada página passa a
listar `app-config.js` como dependência `shared`; contagem de linhas +1 por
import novo).

**Não incluídos neste commit** (frentes concorrentes em andamento na mesma
árvore de trabalho, fora de escopo):
- `CRM/pages/portal-cliente/portal.js`, `portal-auth.js`, `portal-painel.js`
  — divisão do Portal do Cliente em arquivos-irmãos (frente separada,
  retomada depois deste commit).
- `CRM/pages/portal-cliente/admin.js` — diff de 1 linha (fim de arquivo sem
  newline), sem relação com o padrão desta fase; não mexido.
- `CRM/shared/app-config.js`, `CRM/shared/brand-header.js`,
  `CRM/TECHDOC.md` (§41), `plans/P2_2_C_ESTABILIZACAO.md`, `package.json`,
  `PROXIMA_ETAPA.md`, `tests/infra/`, `tests/integrity/integridade.test.mjs`
  — trabalho em andamento de outra sessão (P2.2-C), commitado
  separadamente por quem o produziu.

---

## Testes executados

| Verificação | Resultado |
|-------------|-----------|
| `node --check` nos 20 arquivos | 🟢 OK |
| `npm run auditar-arquitetura` | 🟢 6/6 — grafo acíclico, 0 imports quebrados |
| `tests/rbac` (`npm test`, 175 testes) | 🟢 173/175 — 2 falhas pré-existentes, não relacionadas (ver abaixo) |
| `npm run testar-central-modulos` | 🟢 17/17 (após regenerar catálogo) |
| `tests/integrity/integridade.test.mjs` | 🟡 9/14 — as 5 falhas são 100% sobre `portal.js` (divisão em andamento, frente separada); reproduzidas também com o `portal.js` do HEAD, ou seja, não têm relação com esta entrega |

### Falhas pré-existentes verificadas (não corrigidas aqui, fora de escopo)

- `financeiro-relatorio.test.mjs` — 2 testes (`calcula receita/despesa/saldo
  corretamente`, `expande o resumo com vencidos e pendentes`) falham por
  valores esperados desatualizados no teste (`R$ 4.500`/`R$ 1.499` vs atual
  `R$ 3.000`/`R$ 2.999`). Reproduzido com o `financeiro.js` do HEAD (sem a
  mudança desta fase, via substituição temporária do arquivo) — confirma que
  não é regressão desta entrega. Não está em
  `scripts/homologacao/known-issues.json`; recomenda-se investigar e
  registrar ou corrigir em item separado.

---

## Riscos

1. Mudança puramente mecânica (import + substituição de constante) em 20
   arquivos simultaneamente — foge da regra geral de "1 módulo por vez", mas
   segue o mesmo padrão já usado e aceito na F1.2 (`app-config.js`
   introduzido em 5 arquivos num único commit).
2. `admin.js` ficou com um diff de 1 linha (newline final) não relacionado —
   deixado como está para não misturar com o commit desta fase nem com a
   frente do Portal.

## Pendências

- `brand-header.js` já está sendo migrado para `window.CC_CONFIG` pela
  frente P2.2-C (outra sessão) — não duplicar.
- `TECHDOC.md` — esta fase ainda não tem entrada própria (§42) porque o
  arquivo está com uma adição não commitada de outra sessão (§41, P2.2-C)
  no momento deste commit; adicionar a entrada desta fase depois que aquele
  commit acontecer, para não misturar as duas frentes num único diff de
  `TECHDOC.md`.
- Falha de `financeiro-relatorio.test.mjs` (ver acima) — candidata a virar
  item do `known-issues.json` ou correção pontual.
