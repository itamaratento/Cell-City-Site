# P2.3 — Homologação da Camada Repository (2026-07-16)

**Escopo desta homologação:** incremento P2.3.1 (auditoria) + P2.3.2 (implementação) executados em 2026-07-16.
**Commits avaliados:** `8de90b3`, `01fb682`, `8ae66a7` (develop, locais — push pendente de autorização).
**Parecer final:** **APROVADO COM RESSALVAS** — incremento aprovado; Sprint P2.3 **não** encerrada (ver §6).

---

## 1. Resumo executivo

A P2.3.2 entregou a **API padronizada da Camada Repository** (12 métodos em português com envelope
`{ok, dados, erro}`, cache opt-in, logging tagueado, paginação keyset e validação), corrigiu um
**bug latente real** na factory tenant (`newId()` retornava objeto onde todos os 8 consumidores
esperam string — criação de categorias/duplicação de comandos/registros do diário falhavam
silenciosamente sob try/catch) e migrou os **primeiros módulos**: o núcleo de persistência do OS
(objeto `DB`) e o pós-venda (primeiro módulo com **zero** acessos diretos).

A meta integral da P2.3 ("toda persistência via repositories") **não** está concluída: restam
**211 chamadas Firestore diretas em 35 arquivos** (eram ~219 em 36). A migração completa está
estimada em 7–9 dias úteis, módulo a módulo.

## 2. Bateria executada (HEAD `8ae66a7`)

| Verificação | Resultado |
|---|---|
| Lint/Build (node --check, todos os arquivos tocados) | ✅ OK |
| Imports/exports (resolução ESM real, ciclos, órfãos) | ✅ OK |
| RBAC (jsdom + código real) | ✅ 173/175 (2 falhas pré-existentes de financeiro-relatorio, não relacionadas) |
| Firestore Rules (emulador) — inclui isolamento tenant | ✅ 105/105 |
| Integrity (smoke) | ✅ 14/14 |
| Performance | ✅ 4/4 |
| Cloud Functions (emulador) | ⚠️ 11/25 — falhas pré-existentes (rate limiter P0.2 se autoaciona entre testes; idêntico antes/depois) |
| CRUD completo + paginação + busca + filtros + ordenação + tenant/empresa_id | ✅ 9/9 (tests/rbac/repositories-api.test.mjs) |
| E2E | ⚠️ 0/9 — bug latente do próprio teste (`require()` em ESM), pré-existente do P1 |

## 3. Checklist da ordem P2.3.3 (verificação honesta)

| Item | Status |
|---|---|
| Nenhuma tela acessa Firestore diretamente | ❌ **35 arquivos / 211 chamadas restantes** (os.js 33→25; posvenda 1→0) |
| Toda persistência passa pelos repositories | 🟡 Parcial — ~20 páginas já usavam; núcleo OS migrado; posvenda 100% |
| Services utilizam apenas repositories | ✅ Os 4 services são funções puras — nenhum toca Firestore |
| Multiempresa preservada | ✅ Injeção/filtro por delegação às factories (mesmo gate `areTenantFiltersEnabled`); Rules de isolamento 105/105 |
| SaaS preservado | ✅ Nenhum arquivo SaaS tocado |
| RBAC preservado | ✅ Nenhum arquivo RBAC tocado; 173/175 |
| Firestore Rules preservadas | ✅ Não alteradas; 105/105 |
| Cloud Functions preservadas | ✅ Não tocadas na P2.3 |
| Logger CCC preservado | ✅ Shell-side intocado (nota: não existe logger CCC no browser — a camada usa logging próprio `[Repo:<colecao>]`, debug via `localStorage cc_repo_debug='1'`) |

## 4. Entregas

**Repositories:** 2 factories + 15 arquivos de declaração = **43 repositórios nomeados** sobre ~43 coleções,
todos agora com a API padronizada via `comApiPadrao()` (aditiva — API legada em inglês intacta,
nenhum consumidor quebrou).

**Métodos padronizados (12):** `listar`, `listarPaginado`, `buscar`, `buscarPorId`, `buscarPorEmpresa`,
`buscarPorFiltro`, `pesquisar`, `criar`, `editar`, `remover`, `contar`, `validar` (+ `limparCache`).

**Arquivos alterados (7):** `base.repository.padrao.js` (novo), `base.repository.js`,
`base.repository.tenant.js`, `os.js`, `posvenda.js`, `firestore-mock.js` (fidelidade ao SDK: `.id`
e operadores `>`/`<`), `repositories-api.test.mjs` (novo, 9 casos).

**Problemas encontrados e corrigidos:**
1. `newId()` tenant retornava objeto — corrigido para string (bug mascarado em produção).
2. Mock sem `.id` no DocumentReference e sem `>`/`<` — corrigido (fidelidade).
3. Contador do OS varria a coleção `metadata` inteira a cada volta à home — agora lê só `metadata/counter` (§9).

**Limitações de design (documentadas no header da padrão):**
- Paginação é keyset **por valor** (`where >/<` + `orderBy` + `limit`): `startAfter`/`getCountFromServer`
  exigiriam alterar o protegido `scripts/firebase.js` (fora de escopo sem autorização).
- `contar()` lê os documentos filtrados (1 leitura/doc) — usar em volumes pequenos ou com `cacheTtlMs`.
- Cache não é invalidado por escritas da API legada — usar TTL curto.

## 5. Pendências (migração módulo a módulo, estimativa 7–9 dias úteis)

| Módulo | Chamadas diretas | Observação |
|---|---|---|
| os.js (fluxos restantes) | 25 | automações agenda/financeiro, caixa, lembretes, timeline |
| financeiro.js | 22 | tem suíte de teste |
| caixa.js | 19 | tem suíte de teste |
| crm.js | 18 | tem suíte de teste |
| portal-cliente/admin.js | 16 | sem teste dedicado |
| usuarios-permissoes.js | 13 | 🔒 módulo protegido — exige autorização |
| dashboard-* | ~28 | 🔒 módulo protegido — exige autorização |
| importar/entrada/compras/auditoria/analise | ~20 | menores |
| shared/ (gdrive-backup, cc-sync, dock, favoritos, central-modulos, permissoes) | ~20 | infra do kernel — cautela |
| ativar-filtros.js, tenant.repository.js | — | código morto multiempresa; candidatos a remoção (decisão do dono) |

## 6. Parecer

**APROVADO COM RESSALVAS.**

- O incremento entregue está íntegro, testado (código real, sem cópias) e sem regressões.
- A Sprint P2.3 **não pode ser oficialmente encerrada**: o critério "toda persistência via
  repositories" está longe de completo (211 chamadas diretas restantes).
- **P2.4 (Padronização CSS)** é tecnicamente independente da P2.3 no mapa de dependências do
  Plano Diretor — o projeto **está apto** a iniciá-la, com duas condições: (1) P2.4 toca
  `global.css`, arquivo protegido pelo CLAUDE.md §1 — exige autorização explícita do dono;
  (2) pela metodologia "um módulo por vez", recomenda-se **não** paralelizar P2.3-restante e P2.4.

---
*Homologação executada em 2026-07-16. Commits locais em develop — push/promoção pendentes de autorização.*
