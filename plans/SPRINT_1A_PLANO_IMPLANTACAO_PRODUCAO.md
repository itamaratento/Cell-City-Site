# Sprint 1a — Plano de Implantação em Produção

Status: **plano técnico, aguardando aprovação. Nenhuma ação de promoção foi executada.**

## 0. Achado bloqueante — precisa ser resolvido ANTES de qualquer promoção

`CRM/firestore.rules` de `develop` (Sprint 1a) **não inclui o hotfix `60173b7`** aplicado em `main` em 2026-07-05. Comparando o conteúdo real das duas branches (`git diff main develop -- CRM/firestore.rules`):

```diff
 match /os/{osId} {
-  allow get:                           if true;
-  allow list, create, update, delete:  if request.auth != null;
+  allow get:                           if false;
+  allow list, create, update, delete:  if request.auth != null && temAcessoLiberado();
 }
 ...
 match /avaliacoes/{docId} {
-  allow read, write:                   if request.auth != null;
+  allow read, write:                   if request.auth != null && temAcessoLiberado();
 }
 (mesma troca em mensagens_portal, portal_eventos, agendamentos, solicitacoes_diagnostico)
```

Se `develop` for promovida como está hoje, a promoção **fecha `os.get`** (correto, resolve a exposição de dados) **mas reintroduz `temAcessoLiberado()`** nas mesmas 6 coleções que o hotfix relaxou — porque a Sprint 1a nunca tocou essa parte da regra (só mexeu na linha `get`). Efeito prático: aprovar/recusar orçamento (usa `update` em `os`, não migrado para Cloud Function) e as 5 coleções do Portal (mensagens/avaliações/agendamentos/eventos/solicitações, também não migradas — são Sprint 1b) **voltariam a dar `permission-denied` para cliente anônimo**, reabrindo o mesmo incidente de hoje, só que desta vez causado pela própria promoção da Sprint 1a.

**Pré-requisito obrigatório, antes do item 1 do checklist abaixo:** reconciliar `CRM/firestore.rules` em `develop` — manter `os.get: if false` (Sprint 1a) **e** manter a relaxação do hotfix em `os` (list/create/update/delete) e nas 5 coleções do Portal, até que a Sprint 1b feche essa brecha da forma definitiva (Cloud Functions). Esse ajuste precisa passar pela mesma suíte de testes (`tests/firestore-rules`) e ser homologado em DEV antes de entrar no pacote de promoção.

---

## 1. Checklist de implantação (ordem obrigatória)

- [ ] **0.** Reconciliar `CRM/firestore.rules` em `develop` (ver achado acima). Rodar `tests/firestore-rules` (7 casos atuais + cenários novos para as 6 coleções relaxadas). Deploy em `cellcity-crm-dev`, verificado via `firebaserules.googleapis.com`.
- [ ] **1.** Confirmar que as 2 Cloud Functions (`consultarOSPublica`, `consultarOSPorTelefonePublica`) continuam `ACTIVE` em DEV (já confirmado nesta sessão) e re-homologar rapidamente se houve qualquer mudança de código desde então.
- [ ] **2.** Deploy das mesmas 2 Cloud Functions em **produção** (`cellcity-crm`, `--only functions:consultarOSPublica,functions:consultarOSPorTelefonePublica`). Não toca `excluirUsuarioAdmin` (confirmado aditivo, zero linhas removidas do código existente). Confirmar `ACTIVE` via `gcloud functions list --project cellcity-crm --v2`.
- [ ] **3.** Deploy do `CRM/firestore.rules` reconciliado (item 0) em produção — mesma técnica já validada nesta sessão (API direta, contornando a falta de permissão de `:test` na CLI — ver Risco R2). Verificar via API que o ruleset ativo bate byte a byte com o arquivo do commit que será promovido.
- [ ] **4.** Só agora dar `git push origin main` do squash-merge de `develop` → `main` (por convenção do projeto, sempre squash, nunca `--ff-only`/merge normal — ver memória "main sem merge commit").
- [ ] **5.** Acompanhar o workflow `Deploy Pages (main + develop)` até `completed/success`. Se falhar (já ocorreu 2x nesta sessão, causa transitória de infraestrutura do GitHub, não do nosso conteúdo), re-disparar via `rerun-failed-jobs` e confirmar sucesso antes de seguir.
- [ ] **6.** Homologação pós-deploy em produção (mesma bateria já usada no hotfix): Consultar OS por ID e por telefone, Garantia, Portal do Cliente, Login da equipe, Painel Administrativo — **mas desta vez confirmando que Consultar OS/Garantia usam Cloud Functions na aba Network** (é isso que muda de verdade nesta promoção).
- [ ] **7.** Confirmar por leitura direta (sessão anônima real) que as 5 coleções do Portal e o `update` de `os` (orçamento) continuam respondendo `OK` — não regrediram por causa da reconciliação do item 0.
- [ ] **8.** Atualizar `CRM/TECHDOC.md` (próxima seção) registrando a promoção, e o `plans/SPRINT_1B_PORTAL_CLOUD_FUNCTIONS.md` como próximo passo formal para fechar a brecha residual das 6 coleções.

## 2. Plano de rollback

| Camada | Como reverter | Tempo estimado |
|---|---|---|
| Firestore Rules (prod) | Republicar o ruleset anterior salvo localmente (`rules-prod-live-postfix.txt`, o que está ativo agora, com o hotfix) via a mesma API direta já validada — não depende do Firebase CLI. | < 1 min, efeito imediato |
| Cloud Functions (prod) | `gcloud functions delete consultarOSPublica consultarOSPorTelefonePublica --project cellcity-crm --gen2 --region southamerica-east1` — são aditivas, apagar não afeta `excluirUsuarioAdmin` nem nada mais. | ~1-2 min |
| Site (HTML/JS, `main`) | `git revert` do commit de squash-merge (não `reset --hard`, para não reescrever histórico já publicado) + novo `git push origin main`. Aciona novo ciclo do workflow do Pages. | ~2-5 min (rebuild do Pages) |
| Geral | Projeto já tem mecanismo próprio de rollback (ver memória "Versionamento e Rollback") — `rollback` sem reescrever histórico, a partir das tags `vX.Y.Z` que `subir-ok` gera automaticamente. Usar esse fluxo para o lado do site; Rules/Functions do Firebase ficam fora dele (não são versionadas por tag Git) e seguem as duas linhas acima. | — |

**Gatilho de rollback:** qualquer um dos testes do item 6/7 do checklist falhar, ou aparecer erro real de cliente (não simulado) nas primeiras horas após a promoção.

## 3. Estimativa de indisponibilidade

**Zero indisponibilidade programada**, se a ordem do checklist for seguida (Functions → Rules → site). Cada camada, isoladamente:

- Firestore Rules: propagação global em segundos, sem reinício de serviço. Não há janela de "serviço fora do ar" — só uma janela curta (segundos) em que a regra nova já vale mas o código antigo/novo pode estar temporariamente inconsistente entre si, mitigada pela ordem do checklist.
- Cloud Functions: deploy de função nova não afeta funções existentes; não há downtime de `excluirUsuarioAdmin`.
- GitHub Pages: o site publicado continua servindo a última versão **até** o novo deploy terminar com sucesso — não existe "meio caminho" visível para o visitante. O único risco é a falha transitória do job `deploy` (já vista 2x hoje) — nesse caso, o site continua no ar com a versão anterior enquanto se re-dispara o job; não é indisponibilidade, é atraso na publicação (minutos).

**Se a ordem for invertida** (ex.: publicar o site antes das Functions existirem em prod), aí sim há indisponibilidade real e visível: Consultar OS/Garantia quebram com erro "function not found" para todo usuário, até as Functions serem deployadas — daí a ordem ser obrigatória, não sugestiva.

## 4. Arquivos que seriam promovidos (`main` ← `develop`, diff real de conteúdo hoje)

```
CRM/TECHDOC.md                              (documentação, +51 linhas)
CRM/consultar-os.html                       (migra busca para Cloud Functions)
CRM/firestore.rules                         (fecha os.get; PRECISA da reconciliação do item 0 antes de promover)
CRM/garantia.html                           (migra busca para Cloud Functions)
CRM/pages/portal-cliente/admin.html         (gate real de autenticação de equipe)
consultar-os.html                           (raiz — mesma migração, 2ª cópia)
functions/index.js                          (+2 Cloud Functions novas, aditivo, excluirUsuarioAdmin intocado)
tests/firestore-rules/os-publico.test.mjs   (suíte nova, 7 testes)
tests/firestore-rules/package.json          (script corrigido)
tests/firestore-rules/package-lock.json     (lockfile novo)
```

10 arquivos, nenhum removido. Nenhum módulo crítico (Login, Dashboard, Caixa, Estoque, Financeiro) tocado.

## 5. Matriz de riscos

| # | Risco | Severidade | Probabilidade | Mitigação |
|---|---|---|---|---|
| R1 | `firestore.rules` de `develop` reabre o incidente de hoje nas 6 coleções (achado da seção 0) | **Alta** | Certa, se promovido sem reconciliar | Reconciliar e homologar em DEV antes de promover (item 0 do checklist) — bloqueante |
| R2 | SA de produção não tem `roles/firebaserules.admin`; `firebase deploy --only firestore:rules` falha na checagem `:test` da CLI | Média | Certa (já ocorreu 2x) | Usar a API direta (`rulesets.create` + `releases.update`) já validada nesta sessão; alternativa: pedir para o dono conceder a role antes da janela de deploy |
| R3 | Workflow `Deploy Pages` falha de forma transitória (infra do GitHub, não do conteúdo) | Média | Já ocorreu 2x hoje | Monitorar o run pós-push; re-disparar via API (`rerun-failed-jobs`) se necessário |
| R4 | Duas cópias de `consultar-os.html` (raiz e `CRM/`) divergirem no futuro por alguém editar só uma | Baixa | Baixa | Já confirmado que o diff atual cobre as duas; deixar registrado como ponto de atenção para manutenção futura |
| R5 | Cloud Function nova quebra `excluirUsuarioAdmin` | Baixa | Muito baixa | Diff confirma zero linhas alteradas no corpo da função existente — só aditivo |
| R6 | Runtime Node.js 20 das Functions está deprecated (aviso visto no deploy de DEV) | Baixa | — | Não bloqueia esta promoção; registrar como débito técnico para atualizar `functions/package.json` (`engines.node`) depois |
| R7 (residual, já aceito) | `admin.html` autentica qualquer perfil de equipe (nenhum `perfil_operacional` tem entrada `portal-cliente`, fail-open) | Baixa | Contínua | Já é comportamento consistente com o resto do CRM; fora do escopo da Sprint 1a corrigir sozinha |
| R8 (residual, já aceito) | Mesmo após a promoção, as 6 coleções continuam com a checagem de perfil relaxada (conta `pendente` pode ler/escrever) até a Sprint 1b | Média | Contínua até Sprint 1b | Já é a decisão tomada no hotfix de hoje; Sprint 1b é o fechamento definitivo |

## 6. Ordem final resumida

```
Reconciliar+homologar Rules em DEV
        ↓
Deploy Functions em PROD (aditivo, sem risco)
        ↓
Deploy Rules reconciliadas em PROD (API direta)
        ↓
git push origin main (squash-merge)
        ↓
Confirmar workflow Pages = success
        ↓
Homologação pós-deploy completa em PROD
        ↓
Atualizar TECHDOC + confirmar Sprint 1b como próximo item formal
```
