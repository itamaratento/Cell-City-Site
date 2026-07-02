# 🔎 CONFERÊNCIA FINAL DA MATRIZ DE COLEÇÕES

> **Natureza deste documento:** conferência final, somente leitura. Nenhum código, Firestore Rule, banco de dados ou documento existente foi alterado. Ver confirmação ao final.
> Fecha a lacuna de cobertura que o agente de mapeamento anterior havia sinalizado explicitamente (não cobriu `<script>` inline em `.html` nem nomes de coleção montados dinamicamente) — e essa lacuna **continha um achado real**.

---

## Resumo executivo

A conferência encontrou **1 coleção adicional** que as auditorias anteriores não tinham capturado: **`backup_logs`**, referenciada só dentro de um `<script>` inline em `CRM/pages/dashboard/index.html` (não em nenhum arquivo `.js`), usada para registrar o log de rotação de backups do dashboard. Ela **não tem regra** em `CRM/firestore.rules`. Isso eleva a contagem de coleções ativas sem regra de **9 para 10**.

Fora esse achado, a conferência **confirma** a lista anterior: nenhuma outra coleção de primeiro nível ficou fora da auditoria, não há scripts de seed/migração no projeto, e não há nomes de coleção montados dinamicamente além dos já conhecidos (todos os `collection(db, ...)` usam string literal ou constante resolvível estaticamente).

**Conclusão da conferência: a auditoria precisa ser complementada** — não com uma nova investigação ampla, mas com a inclusão pontual de `backup_logs` na lista de correção já planejada.

---

## 1. Coleções referenciadas no código — cobertura completa desta vez

Diferente da varredura anterior (que cobria só `pages/*/*.js` e `shared/*.js`), esta conferência also verificou:
- **`<script>` inline em `.html`** (não `src=`) em todas as páginas do CRM e do site institucional que referenciam Firestore — encontrou 6 arquivos com chamadas Firestore inline: `pages/dashboard/index.html`, `autoatendimento.html`, `pages/central-organizacao/index.html`, `pages/portal-cliente/index.html`, `garantia.html`, `consultar-os.html`. Só o primeiro tinha uma coleção não capturada antes (`backup_logs`); os demais usam coleções já mapeadas (`os`, `posvenda_contatos`, etc.).
- **Nomes de coleção montados dinamicamente** (`collection(db, \`...${var}\`)`) — busca não encontrou nenhum caso de nome de coleção de primeiro nível montado por template literal com variável; o único padrão desse tipo no projeto é para subcoleções já conhecidas e documentadas (`financeiro_categorias/{catId}/itens`), que não é uma coleção de primeiro nível e portanto não entra nesta matriz.
- **Scripts de seed/migração** — busca por `*seed*.js`/`*migrat*.js` em todo o projeto (fora `node_modules`/`_BACKUPS`) não encontrou nenhum arquivo — o projeto não tem scripts de seed/migração ativos hoje.

## 2. Lista completa das coleções sem regra (atualizada: 10, não mais 9)

| # | Coleção | Onde é usada | Novo nesta conferência? |
|---|---|---|---|
| 1 | `central_organizacao` | `pages/central-organizacao/central.js` | Não |
| 2 | `diario_eventos` | `pages/diario/diario.js` | Não |
| 3 | `favoritos_usuarios` | `shared/favoritos.js` | Não |
| 4 | `contas_numeros` | `pages/contas/contas.js` | Não |
| 5 | `alertas_usuario` | `pages/crm-comercial/crm.js` | Não |
| 6 | `chips_cadastros` | `pages/crm-comercial/chips.js`, `chips-entrada.js` | Não |
| 7 | `catalogo_config` | `pages/catalogo/catalogo.js` | Não |
| 8 | `notificacoes_saas` | `shared/tenant.js` | Não |
| 9 | `auditoria_saas` | `shared/tenant.js` | Não |
| **10** | **`backup_logs`** | **`pages/dashboard/index.html`** (`<script>` inline, array `COLECOES`, linha ~1082; gravação via `addDoc` na função de rotação de backup, linha ~1173) | **Sim — achado desta conferência** |

Confirmado que as demais 5 coleções do mesmo array `COLECOES` do dashboard (`os`, `caixa_lancamentos`, `clientes`, `agendamentos`, `pre_os`, `estoque_produtos`, `posvenda_contatos`, `solicitacoes_diagnostico`, `produtos`, `diario_registros`, `informacoes`) **têm** regra — só `backup_logs`, a última do array, ficou de fora.

## 3. Diferenças encontradas entre código, Rules, documentação e levantamentos anteriores

### 3.1 Coleção usada que ficou fora da auditoria
**Sim: `backup_logs`.** Motivo raiz: as auditorias anteriores buscaram `collection(db, ...)`/`doc(db, ...)` apenas em arquivos `.js`; `backup_logs` só aparece dentro de um `<script>` inline em `index.html`, sem equivalente em `dashboard.js`. Esse é exatamente o tipo de lacuna que o agente da matriz anterior havia sinalizado como não coberta por sua varredura — e ela era real.

### 3.2 Coleções nas Rules que não são mais utilizadas
**Sim, confirmado nesta conferência (re-teste, não é achado novo):**
- `historico_diario`, `historico_semanal`, `historico_mensal`, `resumo_live`, `acoes_semana`, `posvenda_rastreamento` — têm regra em `CRM/firestore.rules`, mas **nenhuma ocorrência** em código ativo (`.js`/`.html`, fora de backups).
- `estoque` — tem regra, mas a única ocorrência do literal `'estoque'` em código ativo é como **identificador de módulo** (`{ id: 'estoque', title: 'Estoque' }` em `dashboard.js`, `sidebar.js` etc.), nunca como `collection(db, 'estoque')`. A coleção real de produtos de estoque é `estoque_produtos`, que tem sua própria regra. **A regra `match /estoque/` está morta** — confirmado, não é suposição.

### 3.3 Coleções utilizadas apenas por código legado/teste
- `_diagnostico_temp` — usada só em `pages/kernel-test/index.html`, uma página de diagnóstico/teste interno do kernel, não um módulo de negócio. Tem regra própria (`match /{document}` específico, não verificado se aberta ou restrita — fora do escopo desta conferência pontual). Não é um módulo alcançável por usuários finais no fluxo normal do sistema.
- Nenhuma outra coleção foi encontrada em uso exclusivo de arquivos `.BACKUP*`/`.bak*` que não apareça também em código ativo — ou seja, não há "coleção fantasma" mantida só por causa de um arquivo de backup solto.

### 3.4 Consistência com os levantamentos anteriores
`FASE_3_LEVANTAMENTO.md`, `FASE_3_VALIDACAO.md`, `PLANO_ACAO_RISCOS_CRITICOS.md`, `EXECUCAO_RISCOS_CRITICOS.md` e `VALIDACAO_FUNCIONAL_RISCOS.md` citam consistentemente as mesmas 9 coleções entre si (sem contradição interna) — a lacuna do `backup_logs` é uma omissão por cobertura incompleta de busca, não uma contradição entre os documentos.

## 4. Confirmação da cobertura da auditoria

| Fonte verificada | Cobertura nesta conferência |
|---|---|
| Coleções referenciadas no código (`.js`) | ✅ Já coberta nas auditorias anteriores, reconfirmada |
| Coleções referenciadas em `<script>` inline (`.html`) | ✅ **Cobertura nova nesta conferência** — encontrou `backup_logs` |
| Coleções nas Firestore Rules | ✅ Extraída lista completa, cruzada com uso real |
| Scripts de seed/migração | ✅ Verificado — não existem no projeto |
| Nomes de coleção dinâmicos/concatenados | ✅ Verificado — nenhum caso de coleção de primeiro nível montada dinamicamente |
| Documentação/levantamentos anteriores | ✅ Comparado — consistentes entre si, só desatualizados quanto ao total (9 → 10) |

## 5. Recomendação final

1. **Atualizar a contagem de coleções sem regra de 9 para 10** nos próximos passos de execução — incluir `backup_logs` junto às outras 9 na correção de `CRM/firestore.rules` (mesma prioridade das demais: regra aditiva simples, `allow read, write: if request.auth != null;`, mesmo padrão do resto do array `COLECOES` do dashboard).
2. Ao rodar o teste do emulador novamente (reaproveitando o script já criado em `/tmp/.../scratchpad/rules-test/`), incluir `backup_logs` na lista `SEM_REGRA` antes de validar a correção.
3. Considerar, à parte da correção de segurança: avaliar remover as 6 regras confirmadas mortas (`historico_diario`, `historico_semanal`, `historico_mensal`, `resumo_live`, `acoes_semana`, `posvenda_rastreamento`, `estoque`) do `CRM/firestore.rules` como limpeza de dívida técnica — baixo risco, mas fora do escopo crítico desta auditoria (nenhuma delas representa exposição de dados, é o oposto: regra sem coleção correspondente).
4. Nenhuma nova busca ampla é necessária além desta — a cobertura agora inclui `.js` e `.html` inline, scripts de seed/migração (inexistentes) e nomes dinâmicos (inexistentes para coleções de primeiro nível).

### Respostas diretas às 4 perguntas do escopo

- **Existe alguma coleção utilizada que ficou fora da auditoria?** Sim — `backup_logs` (agora incluída).
- **Existe alguma coleção nas Rules que não é mais utilizada?** Sim — 7 confirmadas mortas (`historico_diario`, `historico_semanal`, `historico_mensal`, `resumo_live`, `acoes_semana`, `posvenda_rastreamento`, `estoque`).
- **Existe alguma coleção utilizada apenas por código legado?** Não no sentido de "arquivo de backup" — mas `_diagnostico_temp` é usada só por uma página de teste/diagnóstico interno (`kernel-test`), não por um módulo de negócio.
- **A lista atual pode ser considerada completa?** **Sim, com a inclusão de `backup_logs`** — a lista final e completa de coleções ativas sem regra é de **10 itens**.

---

## Metodologia

Busca por `<script>` inline (sem `src=`) em todos os `.html` de `CRM/pages/*/`, raiz do CRM e raiz do site institucional, filtrados por presença de chamadas Firestore; extração de nomes de coleção literais desses blocos; busca por template literals com variável em chamadas `collection(db, ...)` em todo `.js`/`.html` ativo; busca por arquivos de seed/migração em todo o projeto; re-verificação cruzada de cada coleção presente em `CRM/firestore.rules` sem uso confirmado, para distinguir uso real de falso positivo (ex.: `estoque` como identificador de módulo vs. nome de coleção).

## ✅ Confirmação de que nenhuma alteração foi realizada

Todas as operações desta conferência foram de leitura (`grep`, `find`, leitura de arquivos). **Nenhum código, Firestore Rule, banco de dados ou documento existente foi alterado.** A única criação foi este documento (`plans/CONFERENCIA_FINAL_COLECOES.md`).
