# P2.2-D — Consolidação da Infraestrutura (Relatório Final)

**Data:** 2026-07-16
**Branch:** `develop`
**Escopo:** `CRM/shared/`, `CRM/scripts/`, `tests/`, docs — sem tocar módulos
de página (regra obrigatória desta sprint).
**Continua:** P2.2-B (`1ff6f1e`) → P2.2-C (`2e2890b`) → **P2.2-D (este commit)**.

---

## 1. Resumo Executivo

Fechamento da P2.2. As Fases 0–2 (leitura completa + auditoria dirigida aos
13 arquivos centrais listados na missão) confirmaram que a infraestrutura
estava, no geral, saudável e consistente com o que P2.2-B/C entregaram: grafo
acíclico, sem imports quebrados, sem caminhos absolutos, sem `STORAGE_KEYS`/
`FLAGS` duplicadas. Os achados reais foram pontuais — 1 export morto, 3
chaves de storage não registradas, 1 duplicação de lógica de detecção de
ambiente — e todos foram corrigidos com alterações pequenas, isoladas e
imediatamente verificadas por teste automatizado. Nenhum módulo de página,
`kernel.js`, Firestore Rules, Cloud Functions, RBAC ou Repository foi tocado.

A infraestrutura de `shared/`/`scripts/`/`tests/` é considerada **fechada**
para a P2.2. O item pendente de maior visibilidade (migração de ~20 páginas
para `app-config.js`, P2.2-A) é de outra frente, já documentado e fora desta
responsabilidade — apenas verificado que não introduz regressão na infra.

---

## 2. Fase 0 — Mapeamento (leitura, sem alteração)

Lidos por completo: os 24 arquivos de `CRM/shared/*.js`, os 4 arquivos de
`CRM/scripts/*.js` (leitura apenas — `kernel.js`/`firebase.js` protegidos) e
os 50 arquivos de `tests/**/*.mjs`. Nenhuma alteração nesta fase.

## 3. Fase 1 — Auditoria dirigida (13 arquivos)

`app-config.js`, `tenant-context.js`, `tenant-provider.js`,
`tenant-resolver.js`, `tenant-query.js`, `portal-sync.js`, `cc-sync.js`,
`sidebar.js`, `theme.js`, `dock.js`, `brand-header.js`, `favoritos.js`,
`central-modulos.js` — leitura linha a linha + `grep` de cada export/import
contra todo `CRM/**/*.{js,html}` para confirmar consumidores reais.

## 4. Fase 2 — Achados

| # | Achado | Categoria | Evidência |
|---|--------|-----------|-----------|
| 1 | `PORTAL_SYNC_KEYS` (`portal-sync.js`) sem consumidor | export morto | `grep PORTAL_SYNC_KEYS` em todo `CRM/` só retorna a própria declaração |
| 2 | `cc_pt_anotacoes`, `cc_pt_casos_bancada`, `cc_pt_softwares` usadas em `portal-tecnico/*.html` sem entrada em `STORAGE_KEYS` | registro incompleto | `grep cc_pt_` nas páginas vs. `STORAGE_KEYS` em `app-config.js` |
| 3 | `brand-header.js::detectEnv()`/`otherEnvUrl()` recalculavam ambiente/origens já expostos por `app-config.js` (`ENV.isProd`, `URLS.ORIGEM_PROD`) | duplicação de helper | comparação direta com `dashboardHref()`/`devPathPrefix()` no mesmo arquivo, já consolidados na P2.2-C |
| 4 | `getTenantName()`, `onTenantChange()` (`tenant-context.js`) sem consumidor | export morto (pré-existente) | `grep` em todo `CRM/` — **não corrigido**, ver §6 |
| 5 | `LOGS`, `AUDITORIA`, `CACHE`, parte de `TEMPOS` (`app-config.js`) sem consumidor fora do próprio arquivo | fachada não adotada (documentada) | `grep` cruzado com TECHDOC §37 — **não corrigido**, ver §6 |

Não encontrados: dependências circulares (confirmado por
`auditar-arquitetura`), dependências ocultas além das já documentadas
(fallback `env-config.js` ↔ `app-config.js`, deliberado e comentado),
`STORAGE_KEYS`/`FLAGS`/`COLECOES` duplicadas por valor, caminhos absolutos em
`shared/`.

---

## 5. Fase 3 — Padronização aplicada

### `CRM/shared/app-config.js`
- **+`URLS.ORIGEM_DEV`** (`'https://www.cellcityinformatica.com.br/dev'`) —
  fonte única ao lado de `ORIGEM_PROD`, para eliminar o literal duplicado em
  `brand-header.js`.
- **+3 `STORAGE_KEYS`**: `PT_ANOTACOES`, `PT_CASOS_BANCADA`, `PT_SOFTWARES`
  (valores idênticos aos literais já em uso nas páginas de
  `portal-tecnico/` — registro, sem migrar as páginas).

### `CRM/shared/brand-header.js`
- `detectEnv()` passa a preferir `window.CC_CONFIG.ENV.isProd` quando
  disponível (mesmo padrão de fallback de `dashboardHref()`/`devPathPrefix()`
  já introduzido na P2.2-C); fallback local idêntico ao anterior.
- `otherEnvUrl()` passa a preferir `URLS.ORIGEM_PROD`/`ORIGEM_DEV` de
  `window.CC_CONFIG`; `MAIN_ORIGIN`/`DEV_ORIGIN` locais tornam-se apenas o
  fallback de carregamento síncrono (documentado em comentário).

### `CRM/shared/portal-sync.js`
- Removido o export `PORTAL_SYNC_KEYS` (zero consumidores) e o import de
  `STORAGE_KEYS` que ficaria morto na sequência. `syncPortalKeys()`
  (função real, usada nas 4 páginas de `portal-tecnico/`) inalterada.

Nenhuma outra alteração de comportamento — todas as mudanças são substituição
de fonte de uma constante/detecção já equivalente, com fallback preservando
o valor anterior byte a byte.

---

## 6. Pendências registradas (não corrigidas — decisão consciente)

| Item | Por que não foi corrigido |
|------|---------------------------|
| `getTenantName()`/`onTenantChange()` sem consumidor (`tenant-context.js`) | API pública pré-existente (não introduzida em P2.2) de um módulo core de alto fan-in (via `tenant-provider.js` → `kernel.js`, protegido). Risco de quebrar um consumidor não encontrado por análise estática (import dinâmico, script inline) desproporcional ao ganho de remover ~10 linhas. |
| `LOGS`/`AUDITORIA`/`CACHE`/parte de `TEMPOS` sem consumidor externo | Decisão arquitetural já revisada e documentada na F1.2 (`TECHDOC.md` §37) como preparação de adoção gradual — reverter unilateralmente extrapolaria o papel de Desenvolvimento desta sprint (`CLAUDE.md` §0/§4). |
| `CRM/shared/modulos.catalogo.json` desatualizado (`testar-central-modulos` 16/17) | Efeito da migração de 20 páginas para `app-config.js` feita por outra frente (`plans/SPRINT1_F14_ADOCAO_PAGINAS_20260716.md`), que já registrou essa mesma pendência. Regenerar aqui misturaria as duas frentes num só diff. |
| `kernel.js::FLAG_AUTH` ainda literal `cc_kernel_v1` | Arquivo protegido (`CLAUDE.md` §1) — mesma pendência da P2.2-C, aguarda autorização explícita. |
| `os.js`, `portal.js`/`portal-auth.js`/`portal-painel.js`, `informacoes.js` com diff local (outra frente) | Fora da responsabilidade desta sprint por regra explícita da missão — apenas lidos/verificados, nunca alterados. |

---

## 7. Fase 5 — Testes novos

`tests/infra/app-config-estabilizacao.test.mjs`: de 8 para **12 testes**.
Adicionados:
1. `portal-sync: sem export morto (PORTAL_SYNC_KEYS removido...)` — garante
   que o export não seja reintroduzido sem um consumidor real, e que o import
   de `STORAGE_KEYS` não fique morto.
2. `portal-tecnico: toda chave cc_pt_* usada nas páginas está registrada em
   STORAGE_KEYS` — varre todo `CRM/pages/portal-tecnico/**/*.html` e cruza
   com `app-config.js` (evita nova chave "esquecida" no futuro).
3. `app-config: URLS.ORIGEM_DEV é fonte única (brand-header consome com
   fallback)` — trava a consolidação de ambiente feita nesta fase.

---

## 8. Fase 4/7 — Testes executados e auditoria final

| Verificação | Resultado |
|---|---|
| `node --check` (todo `shared/` + `scripts/`) | 🟢 OK, 0 erros de sintaxe |
| `npm run auditar-arquitetura` | 🟢 6/6 — grafo acíclico, 0 imports quebrados/absolutos (fan-in de `app-config.js`: 29 → 28, reflexo do import morto removido) |
| `npm run validar-infra-app-config` | 🟢 12/12 |
| `node --test tests/integrity/integridade.test.mjs` | 🟡 9/14 — as 5 falhas são 100% sobre `portal.js` (divisão em `portal-auth.js`/`portal-painel.js` em andamento por outra frente, diff local não commitado); reproduzido idêntico independentemente de qualquer alteração desta sessão — **não é regressão de P2.2-D** |
| RBAC completo (`node --import tests/rbac/register-loader.mjs --test tests/rbac/*.test.mjs`) | 🟡 173/175 — 2 falhas pré-existentes em `financeiro-relatorio.test.mjs` (mesmas da F1.2/F1.4, valores de teste desatualizados, não relacionadas) |
| `npm run testar-central-modulos` | 🟡 16/17 — catálogo desatualizado pela migração de páginas (outra frente), pendência já registrada lá |
| `firestore-rules/`, `functions/`, `control-center/`, `e2e/`, `performance/` | ⏸️ Não exercidas nesta sessão — ambiente com memória/swap saturados por processos acumulados ao longo da sessão (não relacionado ao código); nenhuma dessas suítes importa os 3 arquivos alterados aqui. Recomenda-se reexecutar na Revisão Técnica. |

**Auditoria final (Fase 7):** grafo acíclico ✅; 0 imports mortos (o único
encontrado — `portal-sync.js`→`STORAGE_KEYS`— foi removido) ✅; 0 exports
mortos introduzidos por esta ou por sprints anteriores da própria P2.2 ✅ (os
2 exports pré-existentes de `tenant-context.js` são anteriores a P2.2 e foram
conscientemente mantidos, ver §6); 0 constantes/`STORAGE_KEYS`/`FLAGS`
duplicadas por valor ✅; 0 regressões nas suítes executadas (falhas restantes
são 100% pré-existentes e documentadas) ✅.

---

## 9. Arquivos alterados

| Arquivo | Natureza | Linhas |
|---|---|---|
| `CRM/shared/app-config.js` | +`URLS.ORIGEM_DEV`, +3 `STORAGE_KEYS` | +6 |
| `CRM/shared/brand-header.js` | consolidação `detectEnv`/`otherEnvUrl` via `CC_CONFIG` | ~8 linhas alteradas |
| `CRM/shared/portal-sync.js` | remoção de export/import morto | −8 |
| `tests/infra/app-config-estabilizacao.test.mjs` | +3 testes novos, 1 teste substituído | +24 |
| `CRM/TECHDOC.md` | +§42 | +1 seção |
| `PROXIMA_ETAPA.md` | atualização de status P2.2 | ~15 linhas |
| `plans/P2_2_D_RELATORIO_FINAL.md` | novo | arquivo novo |

Nenhum arquivo de `CRM/pages/`, `CRM/scripts/kernel.js`, Firestore Rules,
Cloud Functions, RBAC ou Repository foi alterado.

---

## 10. Riscos

1. **Baixo** — todas as alterações são substituição de fonte com fallback
   idêntico ao valor anterior (comportamento observável inalterado) ou
   remoção de código sem consumidor comprovado por grep em todo o client.
2. **Baixo** — suítes de `firestore-rules/`/`functions/`/`control-center/`/
   `e2e/`/`performance/` não foram exercidas nesta sessão por indisponibilidade
   momentânea de recursos do ambiente (não relacionado ao código alterado,
   que não é importado por nenhuma delas). Recomenda-se rodá-las na Revisão
   Técnica antes de promover para `main`.
3. **Nenhum novo risco de segurança, RBAC, Firestore Rules ou Cloud Functions**
   — nenhum desses domínios foi tocado.

## 11. Pendências (consolidado)

Ver tabela da §6 — nenhuma delas bloqueia o fechamento da P2.2-D; todas são
de outra frente/responsabilidade ou decisões arquiteturais já revisadas em
sprint anterior.

## 12. Compatibilidade com P2.2-B e P2.2-C

- **P2.2-B:** ciclo `app-config ↔ tenant-context` eliminado por aquela
  sprint permanece eliminado (verificado no teste 2 do arquivo de infra e no
  `auditar-arquitetura`); todas as `STORAGE_KEYS`/`COLECOES` introduzidas lá
  permanecem intactas e agora mais completas (+3 chaves de `portal-tecnico`).
- **P2.2-C:** o padrão de fallback `window.CC_CONFIG` com literal local
  introduzido em `theme.js`/`sidebar.js`/`brand-header.js` (`dashboardHref`/
  `devPathPrefix`) foi **estendido** ao restante de `brand-header.js`
  (`detectEnv`/`otherEnvUrl`), sem alterar a API pública nem os testes que já
  passavam. A suíte `tests/infra/app-config-estabilizacao.test.mjs` criada
  ali permanece 100% válida — apenas 1 teste foi substituído (o export que
  ele validava foi removido por ser morto) e 3 novos foram adicionados.
- Nenhuma incompatibilidade encontrada entre as três fases.
