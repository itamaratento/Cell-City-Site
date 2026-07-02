# ✅ FASE 3 — VALIDAÇÃO TÉCNICA DO LEVANTAMENTO

> **Natureza deste documento:** validação e verificação independente. Nenhum arquivo de código, configuração, Firestore Rules ou banco de dados foi alterado durante esta revisão — apenas leitura (incluindo uma consulta somente-GET à API `firebaserules.googleapis.com`, prática já estabelecida no projeto para verificar o release ativo real). Ver confirmação explícita ao final.
> Revisa e verifica, item a item, os achados de [`FASE_3_LEVANTAMENTO.md`](FASE_3_LEVANTAMENTO.md), com evidências coletadas de forma independente (não apenas reafirmando o relatório anterior).

---

## Resumo executivo

Dos 7 itens obrigatórios de revisão, **todos foram confirmados como problemas reais**, mas dois tiveram a severidade **revisada para cima** e um teve o escopo **refinado com dados novos que o levantamento original não tinha**:

- **`sa-key.json` — reclassificado de Alto para CRÍTICO.** Não é só um arquivo em disco: a chave **já esteve commitada no histórico do git** (removida via `git filter-branch` em 2026-06-25) e o repositório `itamaratento/Cell-City-Site` é **público no GitHub** (confirmado via API, HTTP 200 sem autenticação). Reescrever o histórico local não garante que a chave nunca tenha sido vista por terceiros nem invalida a credencial — só a rotação no Google Cloud/Firebase IAM resolve isso de fato. Adicionalmente, a própria máquina de desenvolvimento tem uma sessão `gcloud` autenticada usando exatamente essa conta de serviço, confirmando que é uma credencial viva.
- **Divergência de Firestore Rules — escopo corrigido e mais preciso.** A maior parte das coleções citadas no levantamento original (`portal_eventos`, `crm_leads`) na verdade **têm regra no arquivo ativo** — falso alarme parcial do relatório anterior. Mas a verificação direta contra o release ativo real (via API, não só o arquivo em disco) encontrou **3 coleções genuinamente em uso por módulos ativos sem nenhuma regra no ruleset publicado**: `central_organizacao`, `diario_eventos`, `favoritos_usuarios`. Isso é uma descoberta nova, mais grave e mais específica do que o levantamento original relatou.
- Os demais 5 itens (uso de `initModulo()`, referências desatualizadas no roadmap, backups soltos, `listener-manager.js` não adotado, bug do campo "Perfil") foram **confirmados exatamente como descritos**, com evidência de linha de código coletada de forma independente.

Nenhuma correção foi implementada nesta etapa — apenas validação.

---

## 1. `sa-key.json` — chave de service account exposta

**1. Confirmação:** Problema real, e mais grave do que reportado originalmente.

**2. Evidências:**
- Arquivo presente hoje em `sa-key.json` (raiz), 2.376 B, contém `private_key` de `firebase-adminsdk-fbsvc@cellcity-crm.iam.gserviceaccount.com`.
- **Esteve commitado no git**: `git show 4e28be69:sa-key.json` retorna o conteúdo completo da chave privada. Commit `4e28be69` de 2026-06-25 12:16:51.
- **Removido via reescrita de histórico**: commit `0a99f1cd` ("...remove sa-key.json... adicionado ao .gitignore", 2026-06-25 12:56:46) e ref `refs/original/refs/heads/main` confirmam uso de `git filter-branch` para expurgar o arquivo do histórico.
- `origin/main` atual (`4ce7db1`, confirmado via `git fetch` real) **não contém mais** o commit com a chave (`git merge-base --is-ancestor` retorna falso) — a limpeza foi de fato enviada ao GitHub.
- **Repositório é público**: `curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/itamaratento/Cell-City-Site` retorna `200` **sem autenticação**.
- **Credencial ainda está em uso local**: `gcloud auth list` mostra a conta ativa `firebase-adminsdk-fbsvc@cellcity-crm.iam.gserviceaccount.com` autenticada nesta máquina, para o projeto `cellcity-crm`.

**3. Classificação de risco: CRÍTICO.** (revisado de Alto para Crítico em relação ao levantamento original, que não checou o histórico do git nem a visibilidade do repositório.)

**4. Impacto técnico e operacional:** se a chave não foi rotacionada, qualquer pessoa que tenha clonado/feito fork do repositório público antes da reescrita de histórico (2026-06-25) — ou que tenha acessado o commit `4e28be69` via cache do GitHub antes da limpeza — pode ter uma credencial de admin do Firebase (`firebase-adminsdk-fbsvc`) com acesso total ao Firestore/Auth do projeto `cellcity-crm`, contornando completamente as Firestore Rules (chaves de service account ignoram Rules).

**5. Dependência com Fases 1/2:** nenhuma. É ortogonal a RBAC e a módulos de negócio.

**6. Quando corrigir:** **Antecipar imediatamente**, fora do escopo/cronograma da Fase 3. Não é uma alteração de código do projeto (é uma ação no Google Cloud Console/IAM), portanto não conflita com a regra do `CLAUDE.md` de "planejamento obrigatório antes de alterar módulos".

**7. Estratégia de correção sugerida:** (a) rotacionar/revogar a chave atual no Console do Google Cloud (IAM & Admin → Service Accounts → `firebase-adminsdk-fbsvc`); (b) gerar uma nova chave e armazená-la fora do diretório do projeto (variável de ambiente ou cofre local, nunca em arquivo dentro do repositório); (c) considerar solicitar ao suporte do GitHub a purga de cache de commits órfãos, embora o risco principal (a validade da chave) só seja eliminado pela rotação.

**8. Esforço/risco de implementação:** esforço baixo (minutos, é uma ação de console), risco de implementação baixo — mas exige atenção porque qualquer script/serviço que hoje usa `sa-key.json` (`backup-server.js`, `apply-cors.js`, sessão `gcloud` local) vai parar de funcionar até ser atualizado com a nova chave.

---

## 2. Divergência entre `firestore.rules` (raiz) e `CRM/firestore.rules`

**1. Confirmação:** Problema real, mas o levantamento original apontou os exemplos errados de coleções em risco. A verificação independente encontrou um subconjunto diferente e mais preciso.

**2. Evidências:**
- `firebase.json` confirma `"rules": "CRM/firestore.rules"` como arquivo de deploy.
- Verificação do **release realmente ativo** via `GET https://firebaserules.googleapis.com/v1/projects/cellcity-crm/releases/cloud.firestore` (mesma prática já estabelecida no projeto após o incidente de 2026-07-01, ver memória `feedback-firestore-rules-verify-api`) retorna o ruleset `63f9ad18-9283-4d7f-86a9-9af3868b16e2`, atualizado em `2026-07-01T17:34:51Z`.
- O conteúdo desse ruleset ativo foi comparado **byte a byte** (`diff`) com `CRM/firestore.rules` local: **idênticos**. Ou seja, `CRM/firestore.rules` é confirmadamente o que está em produção agora — não há divergência entre disco e nuvem.
- `crm_leads` e `portal_eventos` (citados como exemplo de risco no levantamento original): **têm regra tanto na raiz quanto em `CRM/firestore.rules`** (linhas 252 e 282 do arquivo ativo) — **não é um problema real**, foi um falso positivo do relatório anterior.
- As coleções que só existem na raiz (`lancamentos_caixa`, `fornecedores`, `estoque_movimentacoes`, `financeiro_cat_despesas`, `pendencias` como coleção, `backup_historico`, `auditoria_logs` etc.) foram cruzadas com os nomes de coleção **realmente usados no código** (`caixa.js`, `financeiro.js`, `estoque.js`, `fornecedor.js`): os módulos usam nomes diferentes (`caixa_lancamentos`, `financeiro_pagar`, `estoque_produtos`, `fornecedor_compras`) — **todos com regra própria no arquivo ativo**. A lista órfã da raiz é resíduo de um esquema de nomenclatura antigo, não um risco de dados vivos.
- **Achado novo, não reportado antes:** cruzando as coleções órfãs da raiz com todo o código de `CRM/pages/*/*.js` e `CRM/shared/*.js`, três **são de fato usadas por módulos ativos hoje** e **não têm nenhuma regra no ruleset ativo** (confirmado por grep de string exata contra o conteúdo baixado da API, zero ocorrências):
  - `central_organizacao` — `CRM/pages/central-organizacao/central.js:4` (`SECAO_DOC`), lido/escrito via `doc(db, SECAO_DOC, secao)` (linhas 188, 194).
  - `diario_eventos` — `CRM/pages/diario/diario.js:18` (`COL_EVT`), usado via `collection(db, COL_EVT)` (linhas 186, 714).
  - `favoritos_usuarios` — `CRM/shared/favoritos.js:86`, usado via `doc(db, 'favoritos_usuarios', _uid)`.
  - O arquivo `CRM/firestore.rules` **não tem regra `match` para nenhuma dessas três coleções, nem um catch-all genérico** (`match /{document=**}` não existe no arquivo — confirmado, ele termina com dois `match` explícitos de bloqueio para coleções legadas `orders`/`clients`, sem fallback).

**3. Classificação de risco:**
- Coleções órfãs de nomenclatura antiga na raiz (`lancamentos_caixa` etc.): **Baixo** — são apenas dívida de documentação/arquivo morto, não risco de dados.
- **3 coleções ativas sem regra (`central_organizacao`, `diario_eventos`, `favoritos_usuarios`): Alto.** Pelo comportamento padrão do Firestore (negar acesso a qualquer caminho sem `match` correspondente), leituras/escritas nessas coleções deveriam estar sendo **negadas em produção agora**.

**4. Impacto técnico e operacional:** se a ausência de regra realmente resulta em bloqueio, os módulos **Central de Organização**, **Diário** e o sistema de **Favoritos** (usado na home e na sidebar, um recurso central e citado como recém-recriado na memória do projeto) estariam falhando silenciosamente em operações de leitura/escrita — um impacto operacional potencialmente visível para o usuário final. **Isto não foi testado em runtime/console do navegador nesta validação** (ficaria fora do escopo "somente leitura/análise" pedido) — é uma descoberta baseada em análise estática do ruleset ativo, de alta confiança quanto à ausência da regra, mas que precisa de confirmação em runtime (testar as três funcionalidades no navegador ou checar logs de erro do Firestore no Console) antes de qualquer ação corretiva.

**5. Dependência com Fases 1/2:** nenhuma diretamente, mas Firestore Rules é listado como **componente crítico** no `MASTER_ROADMAP.md` — qualquer alteração real na regra deve seguir o mesmo processo rigoroso já validado nas Fases 1/2 (testes automatizados via emulador + verificação do release ativo via API antes e depois do deploy).

**6. Quando corrigir:** **Antecipar a investigação/confirmação em runtime imediatamente** (é só verificação, sem risco). Se confirmado que as três coleções estão de fato bloqueadas, a correção da regra em si deve ser tratada como prioridade máxima e isolada — não precisa esperar o fim da Fase 2, mas deve seguir o processo formal de homologação de Rules do projeto.

**7. Estratégia de correção sugerida:** (a) testar as três funcionalidades diretamente no navegador/produção ou revisar logs de erro do Firestore no Console para confirmar se há `permission-denied`; (b) se confirmado, adicionar as três regras faltantes em `CRM/firestore.rules`, testadas via emulador antes do deploy; (c) paralelamente, arquivar/remover o `firestore.rules` da raiz (não é mais o arquivo de deploy desde que `firebase.json` foi consolidado apontando para `CRM/`) para eliminar a fonte de confusão que gerou esse falso mapeamento em primeiro lugar.

**8. Esforço/risco de implementação:** investigação — esforço baixo, risco zero (é só leitura). Correção da regra, se necessária — esforço baixo (3 blocos `match` novos), risco médio (qualquer alteração em Firestore Rules exige homologação completa, conforme regra permanente do projeto).

---

## 3. Uso do padrão `initModulo()` em todos os módulos

**1. Confirmação:** Problema real, confirmado com números praticamente idênticos ao levantamento original.

**2. Evidências:**
- `grep -rl "initModulo(" CRM/pages/*/*.js` retorna exatamente **12 módulos**: `caixa`, `catalogo`, `central-alertas`, `central-organizacao`, `contas`, `crm-comercial/entrada`, `dashboard`, `minha-semana`, `os`, `pos-venda`, `relatorios`, `usuarios-permissoes`.
- `CRM/scripts/kernel.js:132` confirma `export async function initModulo()` como implementação real (não é `shared/modulo-guard.js`, que não existe — `ls shared/modulo-guard.js` retorna "No such file or directory").
- `find pages -maxdepth 1 -mindepth 1 -type d` conta 35 subpastas em `pages/` (o levantamento original falou em 28 módulos "com JS de página" e 37 pastas totais — a diferença é porque nem toda pasta tem JS de página próprio, ex. `public/`, `scripts/`; não é uma divergência material).

**3. Classificação de risco: Médio.** Não é uma vulnerabilidade em si (as Firestore Rules continuam sendo a barreira real), mas é uma inconsistência de padrão que aumenta a chance de um módulo futuro esquecer completamente o gate de sessão.

**4. Impacto técnico e operacional:** módulos sem `initModulo()` dependem só de uma flag `localStorage` puramente visual (evita "flash" de conteúdo) — não há redirecionamento real se a sessão expirar enquanto o usuário já está na página.

**5. Dependência com Fases 1/2:** **depende do fim da Fase 2.** Padronizar a inicialização de 23 módulos é uma mudança de escopo amplo que tocaria os mesmos arquivos que a Fase 2 está integrando módulo a módulo — fazer as duas coisas em paralelo violaria a regra do próprio projeto de nunca alterar mais de um módulo por vez.

**6. Quando corrigir:** Fase 3, como planejado — não antecipar.

**7. Estratégia de correção sugerida:** já descrita no levantamento original — padronizar em `initModulo()` de `kernel.js` (não criar/restaurar `shared/modulo-guard.js`), um módulo por vez, seguindo o processo de 8 etapas da Fase 2.

**8. Esforço/risco de implementação:** esforço médio-alto (23 módulos), risco médio por módulo individual, mas cumulativamente alto pela quantidade de superfície tocada.

---

## 4. Referências desatualizadas no `MASTER_ROADMAP.md`

**1. Confirmação:** Problema real, confirmado com números de linha exatos, e **um achado adicional** que o levantamento original não tinha citado.

**2. Evidências:**
- `shared/modulo-guard.js` é citado nas linhas **95, 105, 192 e 286** do `MASTER_ROADMAP.md` como se existisse ou fosse o padrão a adotar — não existe na árvore ativa.
- `garantias`, `venda-rapida` e `chips` (como módulo próprio) são citados nas linhas **94 e 115** como módulos a integrar — não existem como módulos reais hoje.
- **Achado novo:** a linha **192** afirma "isolamento por `empresa_id` em 10 módulos principais restaurado em 2026-06-27" — isso **contradiz diretamente** o achado #1 do levantamento (confirmado nesta validação: apenas 1/37 módulo, `caixa`, tem `empresa_id` hoje). É consistente com a própria memória do projeto sobre o rollback da Base Estável 11 ("rollback apagou TODO multiempresa") — ou seja, a linha 192 do roadmap parece ter sido escrita sem considerar esse rollback posterior, ou o texto está simplesmente desatualizado.

**3. Classificação de risco: Alto** (não por vulnerabilidade técnica, mas porque é a base de planejamento de todos os próximos sprints da Fase 3 — decisões tomadas em cima de premissas erradas geram retrabalho real).

**4. Impacto técnico e operacional:** se a Fase 3 começar a ser executada com base nesse texto sem correção, o primeiro sprint provavelmente tentaria "padronizar para `shared/modulo-guard.js`" (arquivo inexistente) ou "começar pelos módulos de menor risco (`chips`, `garantias`, `venda-rapida`)" (módulos inexistentes) — perda de tempo de planejamento já na largada.

**5. Dependência com Fases 1/2:** nenhuma — é só documentação.

**6. Quando corrigir:** **Antecipar imediatamente.** É edição de um `.md`, zero risco técnico.

**7. Estratégia de correção sugerida:** atualizar as linhas 94, 95, 105, 115, 192 e 286 do `MASTER_ROADMAP.md` para refletir os achados verificados desta validação (arquivo `kernel.js`/`initModulo()` no lugar de `modulo-guard.js`, lista de módulos real no lugar de `chips`/`garantias`/`venda-rapida`, e remover/corrigir a afirmação de 10 módulos restaurados).

**8. Esforço/risco de implementação:** esforço muito baixo, risco zero.

> Nota: por restrição explícita desta etapa ("NÃO reorganizar arquivos" / "apenas leitura, validação e documentação"), essa correção **não foi aplicada** ao `MASTER_ROADMAP.md` nesta validação — está registrada aqui como recomendação pendente.

---

## 5. Organização dos backups fora da pasta `_BACKUPS/`

**1. Confirmação:** Problema real, contagens confirmadas por amostragem independente.

**2. Evidências:**
- `find CRM/shared -maxdepth 1 -type f \( -iname "*.BACKUP*" -o -iname "*.bak*" \) | wc -l` retorna **14** — bate exatamente com o número reportado originalmente para `shared/`.
- Confirmado que a pasta órfã `BACKUP_POSVENDA_SAAS_FIX_2026-06-26/` na raiz continua sem nenhuma referência em `.js`/`.html`/`.json`/`.md` do projeto (a única menção encontrada é o próprio `FASE_3_LEVANTAMENTO.md`, que a cita como achado — não é uma referência funcional).

**3. Classificação de risco: Baixo.** Higiene de repositório, não afeta funcionamento.

**4. Impacto técnico e operacional:** nenhum funcional; impacto é em clareza/manutenibilidade — desenvolvedores futuros (humanos ou IA) podem editar a cópia errada de `favoritos.js`/`brand-header.js` por engano.

**5. Dependência com Fases 1/2:** nenhuma.

**6. Quando corrigir:** pode ser **antecipado** (baixo risco) ou feito no início da Fase 3 — tanto faz, não é bloqueante.

**7. Estratégia de correção sugerida:** mover os 33 arquivos + 3 pastas para dentro de `_BACKUPS/` (preserva o histórico sem apagar nada) em vez de deletar diretamente.

**8. Esforço/risco de implementação:** esforço baixo, risco baixo (é só mover arquivos, não editar código).

---

## 6. Situação do `listener-manager.js`

**1. Confirmação:** Problema real, confirmado.

**2. Evidências:**
- `grep -rl "registerListener\|unregisterAll\|unregisterListener" CRM/pages/*/*.js CRM/shared/*.js | grep -v listener-manager.js` retorna **vazio** — nenhum módulo chama essas funções.
- Contagem independente de `onSnapshot(` fora de `listener-manager.js`: **31** ocorrências (o levantamento original contou 32 — diferença de 1, imaterial, provavelmente um critério de exclusão de arquivo ligeiramente diferente entre as duas contagens).

**3. Classificação de risco: Baixo-Médio** (dívida arquitetural, não bug ativo).

**4. Impacto técnico e operacional:** nenhum problema visível hoje; risco latente de listeners não cancelados ao navegar entre páginas, aumentando leituras do Firestore ao longo do tempo.

**5. Dependência com Fases 1/2:** nenhuma direta, mas faz sentido combinar com a padronização de `initModulo()` (item 3), que também depende do fim da Fase 2.

**6. Quando corrigir:** Fase 3 — combinar com o item 3 para tocar cada módulo uma única vez.

**7. Estratégia de correção sugerida:** adotar `listener-manager.js` nos 31 pontos ao mesmo tempo em que cada módulo for padronizado com `initModulo()`, ou decidir formalmente removê-lo se a equipe optar por não adotá-lo.

**8. Esforço/risco de implementação:** esforço médio, risco baixo (mudança mecânica, mesma assinatura de callback).

---

## 7. Bug conhecido do campo "Perfil"

**1. Confirmação:** Problema real, causa raiz confirmada com leitura direta do código (não apenas grep).

**2. Evidências (lidas diretamente em `CRM/pages/usuarios-permissoes/usuarios-permissoes.js`, linhas 211–232):**
```js
onSnapshot(query(collection(db, 'usuarios'), ...), (snap) => {
  usuarios = snap.docs...;
  renderUsuarios();      // linha 216 — usa `perfis` para resolver o nome
  renderDashboard();
}, ...);

onSnapshot(collection(db, 'perfis_operacionais'), (snap) => {
  perfis = snap.docs...;
  renderPerfis();             // linha 222
  renderPermissoesSelect();   // linha 223
  renderDashboard();           // linha 224
  // ⚠ renderUsuarios() NÃO é chamado aqui
}, ...);
```
`renderUsuarios()` (linha 283) resolve o nome do perfil via `perfis.find(p => p.id === u.perfil_operacional_id)` (linha 292), com fallback `'—'`. Se o snapshot de `usuarios` chegar antes do de `perfis_operacionais` (ordem não garantida pelo Firestore), a tabela renderiza com `perfis = []` e nunca é re-renderizada quando `perfis` é populado depois — confirma exatamente a causa raiz descrita no levantamento original.

**3. Classificação de risco: Médio.** Bug de UI (coluna incorreta), não é falha de segurança nem perda de dados.

**4. Impacto técnico e operacional:** usuários administradores podem ver a coluna "Perfil" como "—" para todos os usuários após um cold start da página, até interagir com o campo de busca (que força um novo `renderUsuarios()`).

**5. Dependência com Fases 1/2:** é uma pendência formal já registrada na Fase 1 (módulo já homologado e aprovado). Corrigir não depende de nada da Fase 2.

**6. Quando corrigir:** **Antecipar.** É um fix isolado de poucas linhas, em um único módulo já estável, sem tocar Rules nem schema — de baixíssimo risco de regressão.

**7. Estratégia de correção sugerida:** adicionar `renderUsuarios()` à lista de chamadas dentro do listener de `perfis_operacionais` (linha ~224), ou centralizar num único dispatcher de re-render acionado por qualquer um dos dois listeners.

**8. Esforço/risco de implementação:** esforço muito baixo (1 linha), risco muito baixo — mas por tocar um módulo já homologado, deve seguir o teste manual descrito no `CLAUDE.md` (verificar login/dashboard não regridem, mesmo sendo mudança pontual).

---

## 8. Demais inconsistências

Nenhuma inconsistência adicional relevante foi encontrada além das já documentadas no levantamento original e verificadas acima. Um ponto de atenção adicional identificado durante esta validação (não um "achado" novo, mas uma observação de processo): a comparação entre o ruleset ativo (via API) e o arquivo local `CRM/firestore.rules` mostrou que estão **sincronizados agora** — ou seja, o incidente de release desatualizado descrito na Fase 1 (`feedback-firestore-rules-verify-api`) não está se repetindo hoje; a prática de verificação via API que o projeto adotou está funcionando.

---

## Classificação de risco consolidada

| # | Item | Risco | Antecipar ou Fase 3? |
|---|---|---|---|
| 1 | `sa-key.json` exposta (histórico git + repo público) | **Crítico** | Antecipar — imediato |
| 2b | 3 coleções ativas sem regra (`central_organizacao`, `diario_eventos`, `favoritos_usuarios`) | **Alto** | Antecipar a investigação; corrigir a regra assim que confirmado |
| 4 | Premissas desatualizadas do `MASTER_ROADMAP.md` (incl. achado novo da linha 192) | **Alto** (para o planejamento) | Antecipar — imediato |
| 3 | `initModulo()` inconsistente entre módulos | Médio | Fase 3 (depende do fim da Fase 2) |
| 6 | `listener-manager.js` não adotado | Baixo-Médio | Fase 3 (combinar com item 3) |
| 7 | Bug do campo "Perfil" | Médio | Antecipar — fix isolado e pontual |
| 5 | Backups soltos fora de `_BACKUPS/` | Baixo | Antecipar ou início da Fase 3, indiferente |
| 2a | Coleções órfãs de nomenclatura antiga no `firestore.rules` da raiz | Baixo | Fase 3 (arquivar o arquivo da raiz) |

## Ordem recomendada de correção

1. **Rotacionar `sa-key.json`** (crítico, independente de tudo o resto).
2. **Investigar em runtime** se `central_organizacao`, `diario_eventos` e `favoritos_usuarios` estão de fato bloqueados em produção; corrigir a regra se confirmado.
3. **Corrigir o `MASTER_ROADMAP.md`** com as premissas verificadas neste documento e no levantamento.
4. **Corrigir o bug do campo "Perfil"** (fix pontual, baixo risco).
5. **Mover os backups soltos para `_BACKUPS/`** (higiene, pode ser feito a qualquer momento).
6. **Aguardar o fim da Fase 2** para então executar, na Fase 3: padronização de `initModulo()` + adoção de `listener-manager.js` (combinados) e, por último, o rollout de `empresa_id` módulo a módulo.

## Conclusão executiva

Dos 7 achados obrigatórios revisados, todos se confirmaram como problemas reais — nenhum foi refutado integralmente. Dois tiveram a severidade elevada em relação ao levantamento original (`sa-key.json`, de Alto para Crítico; e uma parte da divergência de Firestore Rules, de "risco genérico" para "3 coleções especificamente identificadas sem regra, verificadas contra o release ativo real via API"). Um achado do levantamento original (coleções `portal_eventos`/`crm_leads` como exemplo de risco) foi **refutado** nesta validação — ambas têm regra própria no arquivo ativo. Um achado novo foi descoberto durante a validação (linha 192 do `MASTER_ROADMAP.md`, que afirma incorretamente que 10 módulos já têm `empresa_id` restaurado).

Os itens 1 (chave exposta), 2 (coleções sem regra), 4 (roadmap desatualizado) e 7 (bug do Perfil) são recomendados para correção imediata, antecipada em relação ao cronograma formal da Fase 3, por serem de baixo risco de regressão e não dependerem da conclusão da Fase 2. Os itens 3 e 6 (padronização de `initModulo()` e adoção do `listener-manager.js`) devem permanecer no escopo da Fase 3 propriamente dita, respeitando a dependência explícita do encerramento da Fase 2 já estabelecida no `MASTER_ROADMAP.md`.

## Metodologia

Validação realizada com verificação direta e independente (não delegada) de cada achado, incluindo: leitura de código-fonte linha a linha (`usuarios-permissoes.js`, `central.js`, `diario.js`, `favoritos.js`, `kernel.js`); inspeção do histórico completo do git (`git log --all`, `git show`, `refs/original/`, `git merge-base`); consulta à visibilidade pública do repositório via API do GitHub (requisição GET não autenticada); consulta ao release ativo real das Firestore Rules via API `firebaserules.googleapis.com` (usando sessão `gcloud` já autenticada na máquina) com comparação byte a byte contra o arquivo local; e contagens independentes via `grep`/`find` para os itens quantitativos (backups, `onSnapshot`, módulos com `initModulo()`).

## ✅ Confirmação de que nenhuma alteração foi realizada

Durante esta validação, todas as operações foram de **leitura**: comandos `git log`/`git show`/`git fetch`/`git merge-base` (o `fetch` atualiza apenas referências remotas locais do git, não o código-fonte nem a working tree), leitura de arquivos, requisições HTTP `GET` (API pública do GitHub e API `firebaserules.googleapis.com`). **Nenhum arquivo de código-fonte, configuração, Firestore Rules ou banco de dados foi modificado, criado, movido ou removido**, com uma única exceção: a criação deste próprio documento (`plans/FASE_3_VALIDACAO.md`). Nenhuma correção foi implementada. O `MASTER_ROADMAP.md`, o `FASE_3_LEVANTAMENTO.md` e todos os demais arquivos do projeto permanecem exatamente como estavam antes desta validação.
