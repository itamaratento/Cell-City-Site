# SCRIPT A1 — Fase 1.1 (Arquitetura SaaS) — Relatório Técnico

**Data:** 2026-07-16 · **Branch:** `develop` · **Escopo:** exclusivamente Fase 1.1
**Regra respeitada:** nenhuma regra de negócio alterada; arquivos de
autenticação/kernel/Rules intocados (CLAUDE.md §1).

## 1. Método

Auditoria estática de 107 arquivos JS do client (grafo de imports ESM
estático + dinâmico, comentários removidos antes do parse — doc-headers
citam imports de exemplo e geravam falsos positivos), leitura integral do
núcleo (kernel, firebase, firebase/client, tenant-context/provider/resolver/
query, base repositories, services) e verificação cruzada com HTML/SW.
O auditor virou ferramenta permanente: **`npm run auditar-arquitetura`**.

## 2. Resultado das validações

| Validação | Resultado |
|---|---|
| Imports quebrados | **0** |
| Dependências circulares | **0** (grafo acíclico) |
| Isolamento página→página | **100%** (0 imports cruzados entre 29 módulos) |
| `initializeApp` duplicado | **0** fora dos 3 pontos autorizados |
| Import de SDK via CDN | 7 arquivos, todos auditados/allowlist |
| Imports nomeados sem uso | **0** reais (3 falsos positivos investigados um a um) |
| Clean Architecture | camadas respeitadas: pages → services/repositories/shared → kernel → firebase |
| Repository Pattern | composição correta (base pura + decorator API + decorator tenant + pontes nomeadas) |
| Service Layer | existente e correta (4 services puros, sem DOM/Firebase), porém **incipiente** |
| Multiempresa | cadeia kernel→tenant-provider→context íntegra; filtros gateados por `dados_migrados` (PS-6) |
| Acoplamento | fan-in concentrado no núcleo intencional (kernel 36, firebase 32, permissoes 31, sanitize 27) — hub-and-spoke, páginas não se conhecem |

**Conclusão: a arquitetura já está consolidada.** As sprints P2.1–P2.3
(functions por domínio, utilitários extraídos, Camada Repository) e PS-1..6
deixaram o grafo limpo — a Fase 1.1 encontrou **zero** item executável na
lista "eliminar" (código morto/ciclos/imports/duplicação de init) que fosse
seguro e não colidisse com trabalho em voo.

## 3. Problemas encontrados (nenhum corrigível com segurança nesta fase)

| # | Achado | Gravidade | Por que não corrigi |
|---|---|---|---|
| A1-01 | `shared/session.js`: modelo legado "conta única da loja" com 2º `onAuthStateChanged`, fallback de UID compartilhado (`loja-cellcity`) e login Google próprio; usado só por config/Ferramentas | 🟡 arquitetural | arquivo de AUTENTICAÇÃO = protegido (CLAUDE.md §1); exige autorização e teste de login |
| A1-02 | Adoção parcial do Repository: 18/29 módulos; 24 ainda fazem query Firestore direta | 🟡 dívida planejada | é o roadmap incremental oficial (P2.3.x); migração em massa = alto risco |
| A1-03 | `informacoes.js` importa `firebase-storage` direto da CDN em vez de `getFirebaseStorage()` resiliente | 🟢 pontual | **arquivo em edição pela sessão da Fase 1.2 neste momento** — colisão certa |
| A1-04 | Detecção de ambiente `/dev` repetida (kernel `loginUrl`, brand-header `detectEnv`, sw-alarme `ccProjectId`, gates inline) | 🟢 duplicação | Fase 1.2 (app-config.js) já está centralizando — duplicar o esforço criaria conflito |
| A1-05 | `repositories/ativar-filtros.js` é script operacional de console vivendo na camada de dados | 🟢 organização | mover/renomear é proibido sem autorização; documentado |
| A1-06 | `toast()` duplicado em 14 módulos (dívida já registrada no TECHDOC) | 🟢 conhecida | consolidação = mudança cross-module de UI; alinhar com P2.4-B1 |
| A1-07 | `scripts/init-posvenda-*.js` são seeds one-shot já executados servidos publicamente | 🟢 higiene | inofensivos (sem segredos); remoção pede confirmação do dono |

## 4. Melhorias realizadas

1. **`npm run auditar-arquitetura`** (`scripts/arquitetura/auditar.mjs`) —
   transforma as 5 invariantes em verificação automatizada permanente:
   qualquer PR futuro que quebre import, crie ciclo, acople páginas,
   duplique `initializeApp` ou contorne o hub do SDK **falha na auditoria**.
2. **`CRM/ARQUITETURA.md`** — arquitetura oficial documentada (camadas,
   cadeia real de bootstrap, padrão Repository por composição, regras de
   import, exceções com justificativa, proibições para código novo).
   Decisões implícitas viraram regra explícita — inclusive por que NÃO há
   barrel exports nem aliases (ESM de browser sem build).
3. **TECHDOC §37** — registro da fase.

## 5. Riscos

- **Sessão concorrente na Fase 1.2** editando 6 arquivos não commitados
  (app-config.js + os.js + os-photo-storage.js + informacoes.js +
  base.repository.padrao.js + tenant-resolver.js). Todos os meus commits
  usam pathspec explícito; nenhum arquivo dela foi tocado. A1-03/A1-04
  ficam sob responsabilidade da 1.2.
- SaaS multiempresa continua **congelado** para promoção (incidente PS-6 de
  07-14); nada nesta fase mexe em Rules, filtros ou promoção.
- O auditor usa parser regex (sem AST) — suficiente para as invariantes,
  mas strings contendo `/*` podem confundir a remoção de comentários em
  análises futuras mais finas.

## 6. Recomendações (ordem sugerida)

1. **Fase 1.2 termina** a centralização de config (resolve A1-04, A1-03).
2. Autorizar migração de config/Ferramentas para o kernel e aposentar
   `session.js` (A1-01) — elimina o último `onAuthStateChanged` paralelo.
3. Continuar P2.3.x: Caixa e Financeiro são os módulos de maior valor ainda
   fora do Repository (A1-02).
4. `shared/toast.js` alinhado ao Design System P2.4 (A1-06 + P2.4-B1).
5. Plugar `auditar-arquitetura` + `verificar-design-system` no fluxo de
   release (Release Center) como gate de qualidade.

## 7. Checklist da Fase 1.1

- [x] Auditoria completa (bootstrap, kernel, providers, tenant-*, services,
      repositories, shared, modules, imports, aliases, barrels, DI)
- [x] Clean Architecture / SOLID / Repository / Service Layer / Multiempresa
      validados com evidência
- [x] Código morto: varrido — 0 itens reais (2 falsos positivos documentados)
- [x] Dependências circulares: 0
- [x] Imports desnecessários: 0 reais
- [x] Inicializações duplicadas: 0 fora das autorizadas
- [x] Arquitetura consolidada e DOCUMENTADA (ARQUITETURA.md)
- [x] Verificação automatizada permanente (npm run auditar-arquitetura)
- [x] Relatório técnico + riscos + recomendações
- [x] Commits organizados, sem push, sem deploy
- [ ] Itens A1-01..A1-07 — aguardam autorização/fases seguintes
