# HOMOLOGAÇÃO — Separação de Ambientes DEV × PROD

**Status:** 🟡 PREPARADO — execução só após conclusão das Fases 1–5 do plano
**Data:** 2026-07-02
**Base:** `plans/SEPARACAO_AMBIENTES_DEV_PROD.md` (plano) + auditoria pré-separação de 2026-07-02 (6 lacunas)
**Escopo desta entrega:** somente preparação de homologação — nenhuma alteração de código.

---

## 0. Pré-requisitos para iniciar a homologação

Nenhum caso de teste deve ser executado antes de TODOS os itens abaixo estarem confirmados:

- [ ] Fase 1 concluída: projeto `cellcity-crm-dev` criado (Auth e-mail/senha, Firestore `southamerica-east1`, Storage, CORS aplicado).
- [ ] Fase 2 concluída: rules + índices deployados no DEV **e release ativo conferido via API `firebaserules.googleapis.com`** (o console já confirmou "Publicar" sem efetivar — lição de 2026-07-01).
- [ ] Fase 3 concluída: seed importado no DEV (todas as coleções raiz enumeradas via `listCollections()`, incluindo `usuarios`, `empresas`, `perfis_operacionais`).
- [ ] Fase 4 concluída: usuários de homologação criados no Auth do DEV + docs `usuarios/{uid}` com perfil RBAC e `empresa_id`.
- [ ] Fase 5 concluída e publicada: `env-config.js` + 10 pontos publicados adaptados, bump do `sw.js` (versão atual em produção: `cellcity-crm-v14` → nova versão obrigatória), publicado primeiro em `develop`, depois `main`.
- [ ] Tag `pre-separacao-ambientes` criada nos DOIS branches (pré-condição de rollback — ver seção 5).
- [ ] Auto-commit externo (identificado em 2026-06-30) confirmado desativado.
- [ ] Cota Firestore de produção disponível (Spark: reset ~04:00 BRT). **Não homologar PROD com cota estourada** — falhas de leitura mascaram o resultado real dos testes.
- [ ] Anonymous Auth habilitado no DEV (lacuna nº 2 da auditoria — consultar-OS e Portal usam `signInAnonymously`).
- [ ] Posição registrada sobre cada uma das 6 lacunas da auditoria (ver seção 8): resolvida no escopo, ou aceita formalmente como fora do escopo.

---

## 1. Convenções e ambiente de teste

### 1.1 Matriz de ambientes

| Ambiente | URL | Branch | `projectId` esperado | Bucket esperado |
|---|---|---|---|---|
| 🟢 PROD | `https://cellcityinformatica.com.br/` (e `www.`) | `main` | `cellcity-crm` | bucket padrão do `cellcity-crm` |
| 🟠 DEV | `https://cellcityinformatica.com.br/dev/` | `develop` | `cellcity-crm-dev` | bucket padrão do `cellcity-crm-dev` |
| Local | `localhost` / `file://` | — | `cellcity-crm-dev` (fail-safe) | dev |

Regra de ouro da homologação: **cada caso de teste executado no DEV deve ser conferido também no backend de PROD para provar que NADA refletiu lá** (e vice-versa quando indicado). O isolamento é o objeto do teste, não um efeito colateral.

### 1.2 Usuários de homologação (Auth do DEV, criados na Fase 4)

| Perfil | E-mail |
|---|---|
| Administrador | `cellcityadmin@gmail.com` |
| Atendimento | `cellcityatendimento@gmail.com` |
| Caixa | `cellcitycaixa@gmail.com` |
| Estoque | `cellcityestoque@gmail.com` |
| Financeiro | `cellcityfinanceiro@gmail.com` |
| Técnico | `cellcitytecnico@gmail.com` |
| Gerente | `cellcitygerente@gmail.com` |

Em PROD, usar exclusivamente um usuário administrativo real já existente — **nenhum usuário de teste deve ser criado em PROD** durante a homologação.

### 1.3 Como verificar o `projectId` ativo (usado em quase todos os casos)

Três verificações independentes, no DevTools da página em teste:

1. **Console:** `window.CC_ENV` e `window.CC_FIREBASE_CONFIG.projectId` (páginas com `env-config.js`).
2. **Network:** requisições a `firestore.googleapis.com/v1/projects/<projectId>/...` e a `firebasestorage.googleapis.com/v0/b/<bucket>/...` — o `<projectId>`/`<bucket>` na URL é a prova definitiva de qual backend recebeu a operação.
3. **Console do Firebase:** conferir o dado gravado no projeto esperado E a ausência dele no outro projeto.

### 1.4 Higiene de navegador entre testes

`/` e `/dev` compartilham a MESMA origem → `localStorage`, `sessionStorage`, IndexedDB (persistência do Firebase Auth) e o Service Worker são compartilhados. Para não contaminar resultados:

- Cada bateria por ambiente começa em **aba anônima nova** ou após `DevTools → Application → Clear site data`.
- Após publicar a Fase 5, validar o SW: hard-reload (Ctrl+Shift+R), conferir em `Application → Service Workers` que a versão nova assumiu e que o cache antigo `cellcity-crm-v14` foi removido.
- Chaves conhecidas compartilhadas entre ambientes: `cc_kernel_v1`, `cc_tenant_ctx`, `cc_acesso` (+ preferências de layout). Os casos AUTH-05 e CX-03 testam exatamente esse vazamento.

### 1.5 Registro de execução

Cada caso recebe: **✅ Aprovado / ❌ Reprovado / ⚠️ Aprovado com ressalva / ⏭️ Não aplicável**, com evidência (screenshot ou log) para ❌ e ⚠️. Modelo de planilha na seção 9.

---

## 2. Checklist funcional

Executar em **ambos** os ambientes (PROD e DEV), conforme regra permanente do projeto (CLAUDE.md §5). A coluna DEV usa os usuários da seção 1.2; a coluna PROD usa usuário real.

| # | Item | PROD | DEV |
|---|---|---|---|
| F-01 | Login e-mail/senha entra e carrega o Dashboard | [ ] | [ ] |
| F-02 | Dashboard: cards e favoritos carregam com dados do ambiente | [ ] | [ ] |
| F-03 | CRM: buscar, criar, editar cliente | [ ] | [ ] |
| F-04 | Ordem de Serviço: criar OS, mudar status, **upload de foto** | [ ] | [ ] |
| F-05 | Caixa: abrir, lançar entrada/saída, fechar | [ ] | [ ] |
| F-06 | Estoque: criar produto, movimentar entrada/saída | [ ] | [ ] |
| F-07 | Financeiro: Layout Diário (8 cards), lançar receita/despesa | [ ] | [ ] |
| F-08 | Portal do Cliente: login por telefone, ver OS, mensagens | [ ] | [ ] |
| F-09 | Autoatendimento (raiz e `/CRM`) abre e consulta | [ ] | [ ] |
| F-10 | Consultar-OS (raiz e `/CRM`) retorna OS existente | [ ] | [ ] |
| F-11 | Garantia (`CRM/garantia.html`) consulta funciona | [ ] | [ ] |
| F-12 | Catálogo público lista produtos | [ ] | [ ] |
| F-13 | Usuários e Permissões: listar usuários e perfis | [ ] | [ ] |
| F-14 | Central de Módulos / favoritos: fixar e desafixar módulo persiste | [ ] | [ ] |
| F-15 | Navegação DEV permanece no `/dev` (nenhum link/redirect cai no `/` de PROD — atenção ao gate do Caixa e paths absolutos `/CRM/...`) | ⏭️ | [ ] |

**Observação sobre F-02/F-03 no DEV:** se a decisão de negócio da Fase 3 foi anonimizar nomes/telefones (LGPD), os dados exibidos devem ser os anonimizados — dado real de cliente aparecendo no DEV é **reprovação do checklist de segurança** (S-07), não aprovação do funcional.

---

## 3. Checklist técnico

| # | Item | Como verificar | OK |
|---|---|---|---|
| T-01 | `/dev` roda com `projectId = cellcity-crm-dev` (Auth+Firestore+Storage do MESMO app) | §1.3 nas 3 frentes | [ ] |
| T-02 | Domínio oficial fora de `/dev` roda com `projectId = cellcity-crm` | §1.3 | [ ] |
| T-03 | `localhost` e `file://` caem no DEV (regra fail-safe) | Abrir módulo local e conferir Network | [ ] |
| T-04 | Nenhum literal de `firebaseConfig` fora do `env-config.js` nos arquivos publicados | `grep -rn "apiKey" --include="*.js" --include="*.html"` excluindo `_BACKUPS`/`node_modules` | [ ] |
| T-05 | SW novo assumiu; cache `cellcity-crm-v14` removido; `firebase.js` servido é o novo | DevTools Application + aba anônima | [ ] |
| T-06 | Rules ativas no DEV = `CRM/firestore.rules` (fonte oficial), conferidas via **API firebaserules** (não pelo console) | `GET https://firebaserules.googleapis.com/v1/projects/cellcity-crm-dev/releases` + comparar conteúdo | [ ] |
| T-07 | Rules ativas em PROD **inalteradas** pela entrega (mesmo release de antes da Fase 5) | Mesma API, projeto `cellcity-crm` | [ ] |
| T-08 | Índices compostos no DEV: `caixa_lancamentos`, `lembretes_pagamento`, `mensagens_portal` em estado **Enabled** | Console Firestore → Indexes (ou API) | [ ] |
| T-09 | Storage rules + CORS aplicados no bucket DEV | Upload via browser sem erro CORS; acesso anônimo negado | [ ] |
| T-10 | Seed completo: nº de coleções raiz no DEV = enumeração `listCollections()` da PROD (incl. `usuarios`, `empresas`, `perfis_operacionais`) | Script Admin SDK com `sa-key-dev.json` | [ ] |
| T-11 | Ferramentas Node (`backup-dados.js`, `inspect-phones.js`) exigem flag `--dev`/`--prod` e **recusam rodar sem flag** | Executar sem flag → erro; com cada flag → projeto correto | [ ] |
| T-12 | Endpoints REST hardcoded (`analise.js:19`, `sw-alarme.js:171`) resolvidos conforme decisão da lacuna nº 1/3 (§8) | Ler código publicado + testar módulo Análise e alarmes do Dashboard no `/dev` | [ ] |
| T-13 | `garantia.html` usa o config do `env-config.js` (não mais o registro estranho `senderId 1068710301995`) | Ler código publicado + Network na página | [ ] |
| T-14 | `.firebaserc` com alias `dev` correto; deploy de rules exige `--project` explícito | Ler arquivo | [ ] |
| T-15 | Console do navegador loga o `projectId` ativo no boot (mitigação prevista no plano, risco nº 1) | Abrir qualquer módulo e ler console | [ ] |
| T-16 | Nenhum erro novo no console (JS error, 403 de rules, index missing) em nenhum módulo do checklist funcional | Acompanhar console durante a seção 2 | [ ] |

---

## 4. Checklist de segurança

| # | Item | Como verificar | OK |
|---|---|---|---|
| S-01 | `sa-key.json` e `sa-key-dev.json` NÃO rastreados pelo git | `git ls-files \| grep -i "sa-key"` → vazio; `git status` limpo após gerar a chave | [ ] |
| S-02 | Entrada de `sa-key-dev.json` no `.gitignore` criada ANTES da chave existir | Ler `.gitignore` + histórico | [ ] |
| S-03 | Nenhuma credencial nova no histórico de commits da entrega | `git log -p --since=2026-07-02 -- .gitignore *.json \| grep -i "private_key"` → vazio | [ ] |
| S-04 | Rules do DEV NÃO estão em modo teste/aberto (`allow read, write: if true` inexistente) | Conteúdo do release ativo via API (T-06) | [ ] |
| S-05 | Não autenticado não lê Firestore nem Storage do DEV | REST GET sem `Authorization` a uma coleção protegida → 403; download de objeto do bucket sem token → negado | [ ] |
| S-06 | Anonymous Auth do DEV limitado ao que as rules permitem (mesmo comportamento da PROD para consultar-OS/Portal) | Logar anônimo e tentar ler coleção restrita → negado | [ ] |
| S-07 | Decisão LGPD da Fase 3 aplicada: se anonimização foi aprovada, nenhum telefone/nome real no DEV | Amostrar `clientes` no console DEV | [ ] |
| S-08 | Domínios autorizados no Auth DEV: somente `cellcityinformatica.com.br`, `www.` e `localhost` | Console Auth → Settings | [ ] |
| S-09 | Usuários reais de PROD não foram copiados para o Auth do DEV (só os `cellcity<perfil>@gmail.com` + eventuais contas de serviço decididas) | Listar usuários do Auth DEV | [ ] |
| S-10 | Nenhum usuário/documento de teste criado em PROD durante a homologação | Conferir Auth + `usuarios` de PROD ao final da bateria | [ ] |
| S-11 | `_BACKUPS` publicados (132 arquivos com `initializeApp` hardcoded para PROD): posição formal registrada (lacuna nº 5, §8) — risco aceito ou removidos do Pages | Decisão documentada; se removidos, conferir 404 | [ ] |
| S-12 | `firestore.rules` da raiz (stale) não foi deployado por engano em nenhum projeto | Comparar release ativo (T-06/T-07) com `CRM/firestore.rules` | [ ] |
| S-13 | API key de PROD e de DEV são distintas e cada uma aparece só no seu ambiente (a key é pública por natureza, mas não pode cruzar) | Network tab nos dois ambientes | [ ] |

---

## 5. Checklist de rollback

### 5.1 Pré-condições (conferir ANTES de publicar a Fase 5 — sem elas não há rollback seguro)

- [ ] Tag `pre-separacao-ambientes` criada em `main` E `develop`, com push das tags.
- [ ] Backup local dos arquivos protegidos alterados (`firebase.js` etc.), conforme regra permanente.
- [ ] Lista fechada dos commits da Fase 5 (hashes anotados no registro de execução).
- [ ] Working tree limpa e auto-commit externo desativado (um commit estranho no meio quebra o `git revert` limpo).

### 5.2 Gatilhos de rollback (qualquer um dispara)

- Qualquer caso ❌ em PROD nos módulos críticos (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal).
- Evidência de escrita cruzada: operação no `/dev` refletindo em `cellcity-crm` (ou vice-versa).
- Página pública (autoatendimento, consultar-OS, garantia, catálogo) fora do ar ou sem dados em PROD.
- Console de PROD exibindo `projectId` errado em qualquer página.

### 5.3 Procedimento (a mudança é 100% frontend; nenhum dado de PROD é tocado)

- [ ] 1. `git revert` dos commits da Fase 5 no branch afetado (`main` e/ou `develop`) — **não** usar reset/force-push.
- [ ] 2. Novo bump de versão do `CRM/sw.js` no MESMO commit do revert (senão clientes ficam presos no cache da versão revertida).
- [ ] 3. Push → aguardar rebuild do GitHub Pages → conferir no site publicado (aba anônima) que o código antigo voltou.
- [ ] 4. Smoke test PROD: os 8 módulos do CLAUDE.md §5 + as 4 páginas públicas.
- [ ] 5. Conferir `projectId = cellcity-crm` em PROD e ausência de erros no console.
- [ ] 6. Registrar no documento de execução: gatilho, commits revertidos, horário, resultado do smoke test.

### 5.4 Pós-rollback

- [ ] O projeto `cellcity-crm-dev` NÃO precisa ser excluído (não afeta PROD); decidir manter para nova tentativa ou excluir.
- [ ] Dados eventualmente gravados em PROD por engano durante a falha: inventariar via console/Admin SDK e limpar com script pontual (mesmo procedimento do caso `eu@cellcity.com.br`).
- [ ] Abrir análise de causa raiz antes de qualquer nova tentativa de publicação.

---

## 6. Critérios de aprovação

A homologação é **APROVADA** somente se TODOS os itens abaixo forem verdadeiros:

1. **Isolamento comprovado (critério central):** `/dev` usa `cellcity-crm-dev` para Auth, Firestore E Storage; domínio oficial fora de `/dev` usa `cellcity-crm` — comprovado por Network/console nas 3 frentes (§1.3).
2. **Reprodução do bug original sem contaminação:** usuário criado no `/dev` via Usuários e Permissões (caso RBAC-04) NÃO existe no Auth nem na coleção `usuarios` de PROD.
3. **Zero regressão em PROD:** 100% do checklist funcional (seção 2) ✅ na coluna PROD. Qualquer ❌ em PROD = reprovação imediata + gatilho de rollback.
4. **Checklist técnico:** T-01 a T-11 e T-14 a T-16 ✅. T-12/T-13 podem ser ⚠️ apenas se a lacuna correspondente tiver sido formalmente aceita como fora do escopo (§8) — nunca por esquecimento.
5. **Checklist de segurança:** S-01 a S-10, S-12 e S-13 ✅ obrigatórios. S-11 exige posição formal registrada.
6. **Nenhum literal de `firebaseConfig`** remanescente fora do `env-config.js` nos arquivos publicados (T-04).
7. **DEV funcional:** checklist funcional na coluna DEV com ≥ 100% dos módulos críticos ✅; itens não críticos podem ser ⚠️ com pendência registrada no BACKLOG.
8. **Rollback testável:** pré-condições 5.1 conferidas e anexadas ao registro (tags existem, hashes anotados) — rollback não precisa ser executado, mas precisa estar comprovadamente possível.
9. **Casos de teste (seção 7):** 100% dos casos marcados **[Bloqueante]** ✅; demais casos ❌ viram pendência formal no `plans/BACKLOG.md` com responsável.

Resultado possível: **APROVADO** / **APROVADO COM RESSALVAS** (só ressalvas em itens não bloqueantes, todas registradas) / **REPROVADO** (aciona seção 5).

---

## 7. Casos de teste

Formato: cada caso indica Ambiente, Usuário, Pré-condição, Passos e Resultado esperado. Casos **[Bloqueante]** entram no critério de aprovação nº 9. Salvo indicação contrária, todo caso executado no DEV termina com a contraprova: **conferir no console do projeto `cellcity-crm` que NADA foi criado/alterado lá**.

### 7.1 Auth

**AUTH-01 [Bloqueante] — Login PROD isolado**
- Ambiente: PROD · Usuário: administrativo real.
- Passos: aba anônima → `cellcityinformatica.com.br` → login → DevTools Network.
- Esperado: login OK; requisições `identitytoolkit` e `firestore.googleapis.com` referenciam `cellcity-crm`; console loga `projectId cellcity-crm`.

**AUTH-02 [Bloqueante] — Login DEV isolado**
- Ambiente: DEV · Usuário: `cellcityadmin@gmail.com`.
- Passos: aba anônima → `/dev` → login → Network.
- Esperado: login OK contra `cellcity-crm-dev`; Dashboard carrega com dados do seed.

**AUTH-03 [Bloqueante] — Credencial não cruza ambientes**
- Ambiente: ambos.
- Passos: (a) tentar logar em PROD com `cellcityadmin@gmail.com` (existe só no DEV); (b) tentar logar no `/dev` com um usuário que exista só em PROD.
- Esperado: ambos falham com `auth/user-not-found` (ou equivalente). Se (a) logar, os usuários de homologação vazaram para PROD → reprovação + S-10.

**AUTH-04 — Fail-safe local**
- Ambiente: Local (`localhost` e `file://`).
- Passos: abrir uma página do CRM localmente → Network.
- Esperado: TODAS as chamadas vão para `cellcity-crm-dev`. Uma única chamada a `cellcity-crm` reprova (era o risco nº 1 do plano).

**AUTH-05 [Bloqueante] — Sessões na mesma origem não se misturam**
- Ambiente: ambos, mesma aba/navegador (sem limpar storage — teste do vazamento, exceção deliberada ao §1.4).
- Passos: logar em PROD → na mesma aba navegar para `/dev` → observar sessão → logar no DEV → voltar para `/`.
- Esperado: em nenhum momento uma página exibe dados de um ambiente autenticada com sessão do outro; cada lado exige/usa o login do seu próprio Auth. Comportamentos estranhos de `cc_kernel_v1`/`cc_tenant_ctx` compartilhados: registrar como ⚠️ com evidência (limitação de mesma origem), desde que NÃO haja leitura/escrita cruzada de backend.

**AUTH-06 — Anonymous Auth no DEV**
- Ambiente: DEV · Usuário: nenhum (anônimo).
- Pré-condição: Anonymous habilitado no DEV (pré-requisito §0).
- Passos: abrir `/dev/consultar-os.html` e o Portal do Cliente `/dev` → consultar uma OS do seed.
- Esperado: `signInAnonymously` resolve no `cellcity-crm-dev` e a consulta retorna dado do seed.

**AUTH-07 — Google provider (config/Ferramentas)**
- Ambiente: DEV · Usuário: `cellcityadmin@gmail.com`.
- Passos: acionar o fluxo que usa `GoogleAuthProvider` (session.js → config/Ferramentas, ex.: backup Google Drive).
- Esperado: popup do Google referencia o projeto DEV e conclui, OU limitação formalmente registrada (lacuna nº 2, §8). Não pode falhar silenciosamente.

**AUTH-08 — Logout limpo por ambiente**
- Ambiente: ambos.
- Passos: logout no DEV → conferir que PROD (outra aba anônima com sessão própria) permanece logado; e vice-versa.
- Esperado: logout de um ambiente não derruba nem corrompe a sessão do outro.

### 7.2 Firestore

**FS-01 [Bloqueante] — Escrita DEV não reflete em PROD**
- Ambiente: DEV · Usuário: `cellcityadmin@gmail.com`.
- Passos: criar cliente `HOMOLOG FS-01 <data/hora>` no CRM do `/dev` → console Firebase dos DOIS projetos.
- Esperado: doc existe em `cellcity-crm-dev/clientes`; coleção `clientes` de `cellcity-crm` sem nenhum doc novo.

**FS-02 [Bloqueante] — Escrita PROD não reflete em DEV**
- Ambiente: PROD · Usuário: real.
- Passos: editar um campo inócuo de um cliente real (ex.: observação, e reverter em seguida) → conferir DEV.
- Esperado: alteração só em `cellcity-crm`; DEV intacto.

**FS-03 [Bloqueante] — Rules ativas no DEV**
- Ambiente: DEV (API).
- Passos: `GET https://firebaserules.googleapis.com/v1/projects/cellcity-crm-dev/releases` (token via `gcloud auth print-access-token` ou sa-key-dev) → baixar o conteúdo do ruleset ativo → diff com `CRM/firestore.rules`.
- Esperado: release ativo idêntico ao arquivo versionado oficial (NÃO ao `firestore.rules` stale da raiz).

**FS-04 [Bloqueante] — Índices compostos operantes no DEV**
- Ambiente: DEV · Usuário: `cellcityadmin@gmail.com`.
- Passos: exercitar as queries que dependem dos índices: Caixa com filtro de período (`caixa_lancamentos`), lembretes de pagamento (`lembretes_pagamento`), mensagens do Portal (`mensagens_portal`) → console aberto.
- Esperado: nenhuma `FAILED_PRECONDITION: The query requires an index`.

**FS-05 — Endpoints REST hardcoded**
- Ambiente: DEV.
- Passos: abrir módulo Análise (`/dev/CRM/pages/analise/`) e o alarme do Dashboard → Network filtrado por `firestore.googleapis.com`.
- Esperado (conforme decisão da lacuna nº 1/3): requisições REST apontam para `cellcity-crm-dev`; OU módulo formalmente marcado fora do escopo com pendência no BACKLOG. Requisição REST do `/dev` batendo em `projects/cellcity-crm` sem decisão registrada = ❌.

**FS-06 — Seed íntegro**
- Ambiente: DEV (Admin SDK, `--dev`).
- Passos: script de conferência: nº de coleções raiz e contagem de docs por coleção DEV × export de origem.
- Esperado: todas as coleções da enumeração presentes (incl. `usuarios`, `empresas`, `perfis_operacionais`); contagens compatíveis com o export (diferenças justificadas pela anonimização/limpeza, se houver).

**FS-07 — Cota DEV independente**
- Ambiente: DEV.
- Passos: durante a bateria, se o Spark do DEV estourar (`RESOURCE_EXHAUSTED`), conferir PROD no mesmo instante.
- Esperado: PROD segue lendo normalmente. (Caso não ocorra estouro, marcar ⏭️ — não provocar esgotamento de propósito.)

### 7.3 Storage

**ST-01 [Bloqueante] — Upload de foto da OS no bucket certo**
- Ambiente: DEV · Usuário: `cellcitytecnico@gmail.com` (ou admin).
- Passos: criar OS `HOMOLOG ST-01` no `/dev` → anexar foto → Network + console Storage dos dois projetos.
- Esperado: objeto no bucket do `cellcity-crm-dev`; bucket de PROD sem objeto novo; foto reabre na própria OS (URL de download do bucket DEV).

**ST-02 [Bloqueante] — Upload em PROD inalterado**
- Ambiente: PROD · Usuário: real.
- Passos: anexar foto em OS real (ou Central de Informações) → conferir bucket.
- Esperado: objeto no bucket de PROD; comportamento idêntico ao pré-entrega.

**ST-03 — CORS do bucket DEV**
- Ambiente: DEV.
- Passos: o próprio ST-01 com console aberto.
- Esperado: nenhum erro CORS; upload e download via browser funcionam a partir de `cellcityinformatica.com.br`.

**ST-04 — Storage rules do DEV**
- Ambiente: DEV, não autenticado.
- Passos: tentar baixar a URL do objeto do ST-01 sem token/sem estar logado (conforme modelo de rules vigente).
- Esperado: mesmo comportamento de PROD (negado quando as rules exigem auth). DEV mais permissivo que PROD = ❌ em S-05.

### 7.4 RBAC

**RBAC-01 [Bloqueante] — Reprodução do bug original (caso `eu@cellcity.com.br`)**
- Ambiente: DEV · Usuário: `cellcityadmin@gmail.com`.
- Passos: em `/dev` → Usuários e Permissões → criar `cellcityatendimento01@gmail.com` com perfil operacional Atendimento → conferir: (a) Auth do DEV; (b) `usuarios` do DEV; (c) **Auth de PROD**; (d) **`usuarios` de PROD**.
- Esperado: existe em (a) e (b); NÃO existe em (c) nem (d). É o critério de aceite nº 2 do plano — o `firebase-secondary.js` agora lê `CC_FIREBASE_CONFIG`.

**RBAC-02 [Bloqueante] — Admin vê tudo**
- Ambiente: DEV · Usuário: `cellcityadmin@gmail.com`.
- Passos: abrir Dashboard e navegar pelos módulos.
- Esperado: perfil `admin`/`master_admin` sem nenhuma restrição de matriz (comportamento legado preservado).

**RBAC-03 — Perfil restrito no Dashboard (Sprint 1)**
- Ambiente: DEV · Usuário: `cellcitycaixa@gmail.com`.
- Pré-condição: doc `usuarios/{uid}` com `perfil_operacional_id` → perfil Caixa na matriz `perfis_operacionais` (seed da Fase 4).
- Passos: login → grid de módulos do Dashboard.
- Esperado: apenas cards com `visualizar: true` para o perfil Caixa; nenhum erro de console.

**RBAC-04 — Guardas de Estoque e Caixa (Sprint 3)**
- Ambiente: DEV · Usuários: `cellcityestoque@gmail.com` e `cellcitycaixa@gmail.com`, cruzados.
- Passos: `cellcityestoque` tenta abrir Caixa (inclusive via URL direta/iframe); `cellcitycaixa` tenta abrir Estoque.
- Esperado: bloqueio conforme matriz (guarda de iframe do Caixa ativa); acesso pelo próprio perfil funciona.

**RBAC-05 — Fail-open de usuário não migrado**
- Ambiente: DEV · Usuário: um usuário de homologação SEM `perfil_operacional_id` (criar via RBAC-01, se preciso).
- Passos: login → Dashboard.
- Esperado: vê tudo (fail-open explícito do Sprint 1 — ausência de dado nunca oculta módulo).

**RBAC-06 — Rules bloqueiam escalada**
- Ambiente: DEV · Usuário: `cellcityatendimento@gmail.com`.
- Passos: via console JS da página, tentar `setDoc` no próprio doc `usuarios/{uid}` elevando o perfil, e escrever em `perfis_operacionais`.
- Esperado: `permission-denied` nas duas tentativas (rules do DEV = PROD; RBAC de UI não é o mecanismo de segurança).

### 7.5 Portal do Cliente

**POR-01 [Bloqueante] — Login por telefone no DEV**
- Ambiente: DEV · Usuário: anônimo (cliente).
- Pré-condição: cliente do seed com telefone conhecido (se anonimizado, usar o telefone anonimizado documentado pela Fase 3 + `phoneDigits` canônico).
- Passos: `/dev` Portal → informar telefone → abrir painel.
- Esperado: acha o cliente no `cellcity-crm-dev`, lista as OS do seed; Network só referencia o projeto DEV.

**POR-02 [Bloqueante] — Portal PROD inalterado**
- Ambiente: PROD · Usuário: cliente real (telefone de teste interno já existente em PROD).
- Passos: fluxo completo: login por telefone → ver OS → enviar mensagem → apagar a mensagem de teste depois.
- Esperado: idêntico ao pré-entrega; mensagem gravada em `mensagens_portal` de PROD.

**POR-03 — Admin do Portal**
- Ambiente: DEV · Usuário: `cellcityadmin@gmail.com`.
- Passos: `/dev` → `portal-cliente/admin.html` → solicitações, mensagens, estatísticas.
- Esperado: telas populadas com dados do seed; ações administrativas gravam só no DEV.

**POR-04 — Mensagens ponta a ponta no DEV**
- Ambiente: DEV.
- Passos: cliente (POR-01) envia mensagem → admin (POR-03) responde → cliente vê a resposta.
- Esperado: ciclo completo dentro do DEV; índice de `mensagens_portal` exercitado sem erro (cruza com FS-04).

### 7.6 Dashboard

**DSH-01 [Bloqueante] — Boot completo nos dois ambientes**
- Ambiente: ambos.
- Passos: login → aguardar Dashboard estabilizar → console.
- Esperado: cards, favoritos e indicadores com dados do ambiente correto; sem erro de `tenantReady`/`getEmpresaId`; `projectId` logado correto.

**DSH-02 — Preferências por ambiente**
- Ambiente: DEV · Usuário: `cellcityadmin@gmail.com`.
- Passos: fixar um módulo nos favoritos → conferir `usuarios/{uid}/preferencias/modulos` nos dois projetos.
- Esperado: doc só no DEV. (Nota: o espelho em `localStorage` é compartilhado entre `/` e `/dev` — anotar ⚠️ se houver eco visual em PROD, sem escrita cruzada de backend.)

**DSH-03 — Alarmes (`sw-alarme.js`)**
- Ambiente: DEV.
- Passos: ativar/aguardar o alarme do Dashboard → Network do Service Worker (DevTools → Application → Service Workers → inspect).
- Esperado: conforme decisão da lacuna nº 3 (§8): REST do SW aponta para DEV, OU pendência formal registrada. SW do `/dev` consultando `projects/cellcity-crm` sem decisão = ❌.

**DSH-04 — Pill de ambiente coerente**
- Ambiente: ambos.
- Passos: comparar o pill 🟢 MAIN / 🟠 DEVELOP do `brand-header` com o `projectId` real (§1.3).
- Esperado: 🟠 sempre junto de `cellcity-crm-dev`; 🟢 sempre junto de `cellcity-crm`. (O `detectEnv()` visual não muda nesta entrega, mas não pode contradizer o backend nas URLs oficiais.)

### 7.7 CRM

**CRM-01 [Bloqueante] — CRUD de cliente no DEV**
- Ambiente: DEV · Usuário: `cellcityatendimento@gmail.com`.
- Passos: criar cliente `HOMOLOG CRM-01` com telefone → conferir `phoneDigits` no doc → editar → buscar pelo telefone → excluir.
- Esperado: ciclo completo no `cellcity-crm-dev`; busca canônica por telefone funciona; PROD intacta.

**CRM-02 [Bloqueante] — CRM PROD inalterado**
- Ambiente: PROD · Usuário: real.
- Passos: buscar cliente existente por nome e por telefone; abrir ficha.
- Esperado: idêntico ao pré-entrega.

**CRM-03 — Vínculo cliente ↔ OS no DEV**
- Ambiente: DEV.
- Passos: no cliente do CRM-01 (antes de excluir), criar OS vinculada → abrir a ficha do cliente.
- Esperado: OS aparece no histórico do cliente; ambos os docs no DEV.

**CRM-04 — Agenda/RBAC do CRM (Sprint 2)**
- Ambiente: DEV · Usuário: perfil sem permissão de CRM (ex.: `cellcityestoque@gmail.com`).
- Passos: tentar acessar CRM/agenda.
- Esperado: bloqueio conforme matriz do Sprint 2.

### 7.8 Caixa

**CX-01 [Bloqueante] — Ciclo do Caixa no DEV**
- Ambiente: DEV · Usuário: `cellcitycaixa@gmail.com`.
- Passos: abrir caixa → lançar entrada e saída `HOMOLOG CX-01` → fechar caixa → conferir `caixa_lancamentos` nos dois projetos.
- Esperado: lançamentos e fechamento só no DEV; totais corretos; queries de período sem erro de índice (FS-04).

**CX-02 [Bloqueante] — Caixa PROD inalterado**
- Ambiente: PROD · Usuário: real (perfil com acesso a Caixa).
- Passos: abrir o módulo, conferir movimentos do dia e filtros de período.
- Esperado: idêntico ao pré-entrega; sem lançamentos fantasma vindos da homologação.

**CX-03 [Bloqueante] — Gate do Caixa no `/dev` não vaza para PROD**
- Ambiente: DEV.
- Contexto: `caixa/index.html` redireciona para o path absoluto `/CRM/login.html` quando `cc_kernel_v1 ≠ '1'` — em `/dev` esse absoluto aponta para a PROD (achado da auditoria).
- Passos: aba anônima (storage limpo) → acessar direto `/dev/CRM/pages/caixa/` sem logar → observar o redirect; depois logar no DEV e repetir.
- Esperado: usuário nunca é parado numa página de login de PROD a partir do fluxo DEV; após login DEV, Caixa abre no DEV. Redirect caindo em `/CRM/login.html` de PROD: ❌ em F-15, com decisão registrada (lacuna "paths absolutos", §8).

**CX-04 — Guarda de iframe (Sprint 3)**
- Ambiente: DEV · Usuário: `cellcityatendimento@gmail.com` (sem permissão de Caixa).
- Passos: URL direta e tentativa via iframe.
- Esperado: bloqueado pela guarda; sem dados visíveis.

### 7.9 Estoque

**EST-01 [Bloqueante] — CRUD de produto no DEV**
- Ambiente: DEV · Usuário: `cellcityestoque@gmail.com`.
- Passos: criar produto `HOMOLOG EST-01` → entrada de 5 un. → saída de 2 → conferir saldo (3) → conferir coleções nos dois projetos.
- Esperado: produto e movimentos só no DEV; saldo consistente.

**EST-02 [Bloqueante] — Estoque PROD inalterado**
- Ambiente: PROD · Usuário: real.
- Passos: buscar produto existente, conferir saldo e histórico de movimentação.
- Esperado: idêntico ao pré-entrega.

**EST-03 — RBAC do Estoque (Sprint 3)**
- Ambiente: DEV · Usuário: `cellcityfinanceiro@gmail.com` (sem permissão de Estoque).
- Passos: tentar abrir o módulo.
- Esperado: bloqueio conforme matriz.

**EST-04 — Integração Estoque ↔ venda/OS no DEV**
- Ambiente: DEV · Usuário: `cellcityadmin@gmail.com`.
- Passos: consumir o produto EST-01 numa OS ou venda (fluxo que baixa estoque hoje).
- Esperado: baixa refletida no DEV; nenhum movimento em PROD.

### 7.10 Financeiro

**FIN-01 [Bloqueante] — Layout Diário no DEV**
- Ambiente: DEV · Usuário: `cellcityfinanceiro@gmail.com`.
- Passos: abrir Financeiro → conferir os 8 cards do Layout Diário → mudar o dia/período.
- Esperado: cards calculados com dados do seed DEV; sem erro de console/índice.

**FIN-02 [Bloqueante] — Lançamentos no DEV**
- Ambiente: DEV.
- Passos: lançar receita e despesa `HOMOLOG FIN-02` → conferir cards recalculados → conferir coleções financeiras nos dois projetos.
- Esperado: docs só no DEV; totais dos cards batem com os lançamentos.

**FIN-03 [Bloqueante] — Financeiro PROD inalterado**
- Ambiente: PROD · Usuário: real.
- Passos: abrir Layout Diário do dia corrente e de um dia anterior.
- Esperado: valores idênticos ao pré-entrega (comparar com print tirado ANTES da publicação da Fase 5 — providenciar na preparação).

**FIN-04 — Integração Caixa → Financeiro no DEV**
- Ambiente: DEV.
- Passos: conferir se os lançamentos do CX-01 aparecem/compõem os cards do Financeiro (conforme integração vigente).
- Esperado: consistência entre módulos dentro do DEV.

**FIN-05 — RBAC do Financeiro**
- Ambiente: DEV · Usuário: `cellcitycaixa@gmail.com` (sem permissão de Financeiro, conforme matriz).
- Passos: tentar abrir o módulo.
- Esperado: bloqueio conforme matriz; acesso do `cellcityfinanceiro` funciona.

---

## 8. Rastreabilidade — 6 lacunas da auditoria pré-separação (2026-07-02)

Cada lacuna precisa de posição formal ANTES da homologação (resolvida na Fase 5 ou aceita como pendência com item no BACKLOG). A homologação verifica a posição, não decide por ela.

| Nº | Lacuna | Caso(s) que verificam | Posição registrada? |
|---|---|---|---|
| 1 | REST hardcoded `analise.js:19` (sem Authorization — módulo possivelmente já quebrado) | T-12, FS-05 | [ ] |
| 2 | Auth providers além de e-mail/senha: Anonymous (consultar-os ×2, portal) e Google (session.js) | §0, AUTH-06, AUTH-07 | [ ] |
| 3 | `sw-alarme.js` roda em Service Worker — `window.CC_FIREBASE_CONFIG` não existe nesse contexto | T-12, DSH-03 | [ ] |
| 4 | `garantia.html` com apiKey/appId/senderId de OUTRO registro (senderId 1068710301995) | T-13, F-11 | [ ] |
| 5 | `_BACKUPS` publicados no Pages: 132 arquivos com `initializeApp` hardcoded em PROD | S-11 | [ ] |
| 6 | Rules/índices duplicados: `firestore.rules` raiz (stale) ≠ `CRM/firestore.rules` (oficial) | T-06, T-07, S-12 | [ ] |
| + | Paths absolutos `/CRM/...` (74 arquivos) + `LOGIN_URL` do kernel → navegação do `/dev` caindo em PROD | F-15, CX-03 | [ ] |
| + | `localStorage` compartilhado entre `/` e `/dev` (mesma origem) | AUTH-05, DSH-02, CX-03 | [ ] |

---

## 9. Registro de execução (modelo)

```
HOMOLOGAÇÃO — SEPARAÇÃO DE AMBIENTES — EXECUÇÃO
Data/hora início: ____-__-__ __:__  |  Executor: ____________
Commits da Fase 5 (hashes): ____________
Tag pre-separacao-ambientes: main [ ]  develop [ ]
Print do Financeiro PROD pré-entrega anexado: [ ]

| Caso | Resultado (✅/❌/⚠️/⏭️) | Evidência | Observação |
|------|------------------------|-----------|------------|
| ...  |                        |           |            |

Lacunas §8 com posição registrada: [ ] todas
Resultado final: APROVADO / APROVADO COM RESSALVAS / REPROVADO
Ressalvas → BACKLOG: ____________
Assinatura (responsável pela aprovação): ____________
```

---

*Documento gerado em 2026-07-02 como preparação de homologação. Nenhum arquivo de código foi alterado.*
