# SCRIPT A2 — Fase 1.3 (Kernel SaaS) — Relatório Técnico

**Data:** 2026-07-16 · **Branch:** `develop` · **Escopo:** exclusivamente Fase 1.3
**Regra respeitada:** nenhuma regra de negócio, Rule, Cloud Function ou
fluxo de autenticação alterado; `shared/session.js` e arquivos protegidos
(`firebase.js`, `auth.js`, `config.js`, `global.css`) intocados (CLAUDE.md §1).

## 1. Método

Leitura integral do kernel real: `scripts/kernel.js`, `scripts/firebase.js`,
`shared/tenant-provider.js`, `shared/tenant-context.js`,
`shared/tenant-resolver.js`, `shared/tenant-query.js`, `firebase/client.js`,
`shared/env-config.js`. Em seguida, mapeamento de TODO ponto de bootstrap
do client: grep exaustivo por `initializeApp(`, `onAuthStateChanged(` e
`<script type="module">` inline em `CRM/**/*.html` (a Fase 1.1 só tinha
auditado `.js`), e verificação individual de cada página/módulo que o
auditor apontava como "sem kernel" para decidir se era gap real ou exceção
legítima.

## 2. Achado central: a Fase 1.1 tinha um ponto cego real

`scripts/arquitetura/auditar.mjs` (criado na F1.1) só lia arquivos `.js`.
Isso escondia:

| # | Achado | Onde |
|---|---|---|
| A2-01 | 3 `initializeApp` reais fora da allowlist documentada | `garantia.html`, `pages/saas-onboarding/index.html`, `pages/portal-cliente/index.html` |
| A2-02 | `onAuthStateChanged` adicional legítimo (auth anônima do cliente) | `pages/portal-cliente/index.html` — total real no client é **4** registros (kernel.js oficial, firebase.js one-shot `authReady`, session.js legado/A1-01, este); não rotulado "2º" para não colidir com a numeração ad-hoc de A1-01 |
| A2-03 | Import absoluto `/CRM/...` real (classe H-008) | `pages/kernel-test/index.html` — resolveria sempre para PRODUÇÃO mesmo em `/dev`, misturando instâncias de `firebase.js` na mesma página de diagnóstico |
| A2-04 | Import CDN morto (nunca chamado) | `pages/kernel-test/index.html` (`onAuthStateChanged` importado e sem uso) |
| A2-05 | 4 módulos inteiros invisíveis à métrica de adoção (0 `.js` próprio — tudo inline) | `kernel-test`, `saas-admin`, `saas-onboarding`, `portal-tecnico` |
| A2-06 | Falso negativo na métrica "usa kernel" (indireto via helper de `shared/`) | `central-modulos` (via `shared/central-modulos.js`), `portal-tecnico` (via `shared/portal-sync.js`), `portal-cliente` (via `admin.html` inline) |

Todos os 3 `initializeApp` (A2-01) e o 2º listener (A2-02) são
**legítimos e necessários**: páginas acessadas por quem não tem conta de
equipe (`usuarios/{uid}.perfil`), sem RBAC, que delegam toda escrita
privilegiada a Cloud Functions (Admin SDK) — mesmo padrão já usado por
`catalogo-publico.js` (já allowlistado desde a F1.1). Nenhum deles foi
alterado; apenas documentados e allowlistados no auditor.

## 3. O que foi corrigido (duplicações/bugs seguros)

1. **`pages/kernel-test/index.html`** — import de `scripts/firebase.js`
   trocado de absoluto (`/CRM/scripts/firebase.js`) para relativo
   (`../../scripts/firebase.js`), eliminando uma instância real da classe
   de bug H-008 na própria ferramenta de diagnóstico do kernel. Import
   morto de `onAuthStateChanged` (CDN, nunca chamado) removido. O
   `import()` dinâmico de `signOut` (linha ~384, usado de propósito para
   encerrar sessão sem o redirect de `logout()`) foi mantido e
   allowlistado — não é duplicação, é a única forma de fazer esse teste
   específico sem uma função que o kernel não expõe.
2. **`scripts/arquitetura/auditar.mjs`** — reescrito para:
   - extrair e auditar `<script type="module">` inline de `.html` nos
     mesmos 5 invariantes da F1.1 (imports quebrados, ciclos, isolamento
     página→página, `initializeApp`, CDN allowlist);
   - **novo invariante 6**: nenhum import absoluto `/CRM/...` (H-008) —
     enforcement automático de uma regra que já existia só como
     documentação (`CRM/ARQUITETURA.md` regra #6 desde a F1.1);
   - métrica de adoção kernel/Repository recalculada por
     **alcançabilidade transitiva no grafo** (busca exaustiva com pilha —
     função `alcancaveis()`, correção pós-auditoria: era rotulada "BFS" na
     primeira versão deste relatório, mas usa `pop()`/LIFO, isto é, DFS;
     irrelevante para o RESULTADO — o conjunto alcançável é o mesmo
     independente da ordem de visita — só a nomenclatura estava errada),
     não mais regex no próprio arquivo — corrige A2-05/A2-06 sem esconder
     nada por trás de um número que parecia bom mas media a coisa errada;
   - métrica "acesso direto ao Firestore" mantida em 1º grau
     deliberadamente (ver §5, risco).
3. **`CRM/ARQUITETURA.md`** — nova seção §2.1 (a segunda cadeia de
   bootstrap pública, fechada e completa: as 4 páginas e por que cada
   uma existe fora do kernel), §6 estendida com as 4 novas exceções, §4
   com a nota sobre o invariante 6 e a cobertura de `.html`.
4. **`CRM/TECHDOC.md`** §39.

## 4. Validação

```
npm run auditar-arquitetura
→ 🟢 Arquitetura íntegra (6/6 invariantes, 0 violações)
   módulos de página: 33 (era 29) · usam kernel: 32/33 · usam repository: 20/33
   acesso direto ao Firestore (1º grau): 27/33 · sem kernel: saas-onboarding (exceção documentada)

node --test tests/integrity/integridade.test.mjs   → 14/14 ✅
cd tests/rbac && npm test                          → 173/175 (2 pré-existentes em
                                                       financeiro-relatorio.test.mjs,
                                                       não relacionados a esta fase —
                                                       mesmos 2 já reportados na F1.2)
```

## 5. Riscos

- O parser do auditor continua regex (sem AST), agora também sobre HTML —
  suficiente para os 6 invariantes, mas um `<script type="module">` cujo
  corpo contenha a string literal `</script>` (ex.: dentro de uma
  template string) cortaria a extração cedo. Nenhuma ocorrência hoje
  (verificado manualmente nos 14 blocos encontrados).
- `pages/portal-cliente/index.html` usa `<script type="importmap">` para
  mapear `firebase/app` etc. para a CDN — o auditor não resolve
  importmap, então essa CDN específica fica **fora** do invariante 5 (não
  é falha de segurança: é a mesma allowlist de qualquer forma, só não é
  verificada automaticamente por esse caminho). Documentado como
  limitação conhecida, mesmo espírito da nota já existente na F1.1 sobre
  o parser regex.
- Métrica "acesso direto ao Firestore" foi deliberadamente MANTIDA em 1º
  grau (não transitiva): testei a versão transitiva primeiro e ela subia
  para ~32/33 (quase todo módulo "alcança" `firebase.js` via `kernel.js`),
  o que destrói o propósito do indicador (sinalizar módulos que ainda
  fazem Firestore cru em vez de Repository). Registrado aqui para quem
  for mexer nessa métrica de novo não repetir o mesmo engano.
- Nenhuma Rule, Cloud Function ou arquivo de autenticação foi tocado;
  `session.js` (A1-01, achado da F1.1) continua fora de escopo — decisão
  de aposentá-lo exige autorização explícita e teste de login, não é
  autônoma mesmo em modo acelerado.

## 6. Recomendações (ordem sugerida)

1. Nenhuma ação obrigatória — a Fase 1.3 fechou a lacuna que motivou sua
   abertura (auditor cego a `.html`) e não deixou item pendente novo.
2. Itens herdados da F1.1 continuam de pé na mesma ordem: session.js
   (A1-01, exige autorização), Caixa/Financeiro → Repository (A1-02,
   roadmap P2.3.x), `toast()` ×14 (A1-06, alinhar com P2.4-B1).
3. Se algum dia `portal-cliente/index.html` trocar o importmap por CDN
   direto (como `garantia.html`), a allowlist do invariante 5 já cobre —
   nenhuma mudança necessária no auditor.

## 7. Checklist da Fase 1.3

- [x] Leitura integral do kernel, firebase, tenant-*, firebase/client
- [x] Mapeamento exaustivo de todo `initializeApp`/`onAuthStateChanged`/
      bootstrap do client (`.js` E `.html` inline)
- [x] Cada "módulo sem kernel" investigado individualmente (gap real vs.
      exceção legítima vs. falso negativo de métrica)
- [x] Bug real corrigido (H-008 em kernel-test/index.html) — único
      código de produção/diagnóstico alterado nesta fase
- [x] Import morto removido
- [x] Auditor estendido (6 invariantes, HTML-aware, métrica por
      alcançabilidade transitiva)
- [x] `auditar-arquitetura`: 🟢 0 violações
- [x] Integrity: 14/14 · RBAC: 173/175 (2 pré-existentes, não
      relacionados)
- [x] `CRM/ARQUITETURA.md` + `CRM/TECHDOC.md` §39 atualizados
- [x] Nenhuma regra de negócio, Rule, Cloud Function ou autenticação
      alterada; `session.js` e arquivos protegidos intocados
- [x] Commit único, sem push, sem deploy
