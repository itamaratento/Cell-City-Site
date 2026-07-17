# Homologação Final SaaS — Cell City CRM (2026-07-17)

**Fase:** 1.5 — Certificação Operacional / Revisão Técnica Geral (não é Sprint, não é desenvolvimento)
**Branch analisada:** `develop`, HEAD `67ed998` (15 commits à frente de `origin/develop`, não pushado)
**Modo:** 100% leitura + testes/homologação. Nenhuma funcionalidade criada. Nenhuma refatoração estética. Nenhum deploy. Nenhuma promoção `develop → main`. Nenhuma Sprint aberta.
**Executado em paralelo a:** uma auditoria técnica independente de outra ferramenta (`plans/AUDITORIA_TECNICA_INDEPENDENTE_20260717.md` + versão `_INTERNO` não commitada), cujos achados de segurança são incorporados por referência nas seções 5 e 15-16 deste relatório, para não haver duas fontes divergentes de verdade sobre o mesmo assunto.

---

## 1. Resumo Executivo

A infraestrutura SaaS multiempresa (Sprints 1-4, branch `develop`, ainda não promovida a produção) está **arquiteturalmente consistente na maior parte**, com RBAC funcional e helpers de tenant aplicados às principais coleções. A revisão complementar, porém, confirmou uma exceção crítica em `pre_os`: Rules e duas consultas do Dashboard permitem acesso cross-tenant. Onboarding e aprovação foram validados por leitura e testes automatizados de unidade/RBAC, mas não por fluxo end-to-end real com Cloud Function e Firestore nesta sessão. A suíte executável terminou em **386/390 assertions aprovadas** (98,97%), com as 4 únicas falhas sendo as **mesmas 2 falhas pré-existentes já documentadas** em `financeiro-relatorio.test.mjs` (sem relação com SaaS). Não foi encontrada regressão funcional nova, mas foi encontrada uma vulnerabilidade de isolamento que não possuía cobertura dedicada.

Esta certificação, entretanto, **não pode classificar o projeto como "aprovado para produção" sem ressalva**, por dois motivos concretos, ambos com evidência direta:

1. **1 achado 🔴 Crítico específico do SaaS:** `pre_os` não aplica isolamento por `empresa_id` nas Rules e é consultado sem filtro de tenant em dois componentes do Dashboard. Isso permite leitura, atualização e exclusão cross-tenant de pré-atendimentos por qualquer usuário autenticado e liberado. Pelas regras desta missão, qualquer vazamento entre empresas é crítico e reprova a certificação.
2. **2 achados 🟠 Altos** específicos do SaaS (`develop`) — uma condição insegura em `CRM/firestore.rules` (categoria financeira sem `empresa_id` migrado) e uma lacuna de isolamento em `storage.rules`. Correções para ambos estão presentes no working tree, produzidas por frente concorrente, mas ainda não commitadas nem homologadas por esta missão.
3. **4 achados 🔴 Críticos já ativos hoje em produção** (`main`, publicado em `cellcityinformatica.com.br`), **nenhum causado pelo trabalho de SaaS** — preexistem e afetam o CRM single-tenant atual. Foram encontrados pela auditoria técnica independente paralela. No encerramento, S1 e S4 tinham correção não commitada e S2 tinha apenas mitigação parcial por rate limit; S3 exige ação no GCP.

Ambiente de teste: emulador Firestore bloqueado por limite de `inotify` do host (`ENOSPC`, reproduzido de forma determinística mesmo fora do sandbox padrão da ferramenta) — mesma limitação de ambiente já documentada em certificações anteriores (F1.4, integração 2026-07-16). `tests/firestore-rules/*` e `tests/functions/*` continuam sem execução real do emulador nesta sessão; a lógica das Rules foi validada por leitura direta (linha a linha) em vez de execução.

**Classificação final desta certificação: 🔴 REPROVADO PARA PRODUÇÃO** — ver §20.

---

## 2. Ambiente de Testes

| Item | Valor |
|---|---|
| Node ativo | v22.23.1 (via nvm; `functions/package.json` declara `engines.node: 20` — `EBADENGINE` warning, não bloqueante) |
| npm | 10.9.8 |
| Java (emulador Firestore) | OpenJDK 25.0.3 |
| Chrome | `/usr/bin/google-chrome` disponível |
| `sa-key-dev.json` / `sa-key.json` | presentes no disco, corretamente gitignorados (`git check-ignore` confirma) |
| `fs.inotify.max_user_watches` | 65536 |
| `fs.inotify.max_user_instances` | 128 (esgotado pelos processos do host/IDE — confirmado pelo erro `ENOSPC` reproduzido de forma determinística ao iniciar o emulador Firestore, mesmo com o processo rodando fora do sandbox padrão da ferramenta) |
| Build step | **Não existe** — projeto é site estático (Firebase Hosting, `CRM/` como `public`) + Cloud Functions; não há bundler/transpiler. Confirmado por ausência de script `build` em `package.json`. |
| Suíte RBAC | requer `node --import ./tests/rbac/register-loader.mjs --test *.test.mjs` (loader customizado que intercepta imports de CDN Firebase) — descoberta durante esta sessão: rodar sem esse `--import` produz **falsos positivos em massa** (305 "falhas" por `ERR_UNSUPPORTED_ESM_URL_SCHEME`), corrigido ao usar o comando correto documentado em `CRM/TECHDOC.md:2252` |
| `tests/firestore-rules/*` e `tests/functions/*` | exigem `firebase emulators:exec --only firestore "node --test"` executado a partir do próprio diretório do teste (path relativo `../../CRM/firestore.rules` é resolvido a partir do CWD) |

**Nota operacional (não é achado de código):** durante esta sessão, algumas operações de sistema (`rsync -a`, dentro de `tests/integrity/integridade.test.mjs`) travaram indefinidamente sob o sandbox padrão da ferramenta de execução (bloqueio silencioso de uma syscall usada pelo modo `--archive` do rsync) e só completaram normalmente (331ms) quando executadas fora do sandbox. Isso **não é um defeito do projeto** — é uma característica do ambiente de execução desta sessão de certificação, documentada aqui para que uma eventual reexecução saiba usar permissões completas ao rodar a suíte de testes.

---

## 3. Auditoria Geral (estrutura, imports, dependências, código morto, duplicações)

| Ferramenta | Resultado |
|---|---|
| `npm run auditar-arquitetura` | 🟢 6/6 eixos — zero import quebrado, zero dependência circular, isolamento página→página respeitado, inicializações do Firebase App restritas a 7 pontos autorizados, imports de CDN restritos a allowlist de 11 arquivos, zero import absoluto fora do padrão |
| `npm run verificar-design-system` | 🟢 — 50 páginas linkam design-system.css+theme.js; 95 tokens `--cc-*` resolvem; 41 CSS balanceados; 0 IDs duplicados; nenhuma página bloqueia zoom |
| `npm run validar-infra-app-config` | 🟢 12/12 |
| `npm run testar-central-modulos` | 🟡 16/17 — **catálogo `CRM/shared/modulos.catalogo.json` desatualizado** (metadado: `geradoEm`/`commitBase` e contador de commits de `saas-admin.js` atrás do HEAD atual). Não é falha funcional (o catálogo runtime funciona), é só um metadado de auditoria defasado. **Não corrigido nesta certificação** — regenerar o catálogo (`node scripts/central-modulos/gerar-catalogo.mjs`) não atende ao critério de "defeito crítico" desta missão (não impede funcionamento, não é falha de segurança, não quebra isolamento/autenticação/Rules/Functions); registrado como pendência de manutenção de rotina. *(Nota de processo: um comando de diagnóstico desta sessão regenerou acidentalmente o arquivo por 1 execução; a alteração foi revertida via `git checkout` antes do encerramento — confirmado `git status` limpo para este arquivo.)* |
| Código morto (achado pela auditoria independente paralela, verificado por referência) | `CRM/repositories/ativar-filtros.js`, `CRM/repositories/tenant.repository.js` (zero import), 2 scripts de seed de uso único, camada `CRM/services/*.js` inteira órfã (imports comentados em `os.js:18-23`), `CRM/firestore.rules.secure` (rascunho do primeiro commit do repositório, nunca referenciado por deploy) |
| Duplicações | `getDeliveryDate()`/`calcDias()` triplicados (`posvenda.js`, `dashboard-alertas.js`, `central-alertas.js`) com uma 4ª cópia corrigida (`portal-garantias.js`) não propagada às outras 3 — bug de falso positivo de garantia ainda ativo nas 3 cópias antigas. Ver detalhe completo na auditoria independente §7. |

---

## 4. Build

```
npm install (raiz):      2,5s — 767 pacotes, 0 vulnerabilidades diretas (9 moderadas transitivas em firebase-admin/gaxios/uuid, correção só via bump major)
npm install (functions): 2,0s — 242 pacotes, EBADENGINE (node 20 exigido, 22 instalado, não bloqueante), 8 vulnerabilidades moderadas (mesma cadeia)
npm run build:           N/A — não existe (site estático + Cloud Functions, sem bundler)
```

Nenhum erro. Nenhum módulo com falha de instalação.

---

## 5. Segurança

**Metodologia:** revisão direta de `CRM/firestore.rules`, `storage.rules`, `functions/*.js`, `functions/lib/*.js`, módulos SaaS (`saas-admin.js`, `saas-onboarding.js`), mais os achados da auditoria técnica independente executada em paralelo nesta mesma janela (mesmo padrão de evidência: arquivo:linha, sem suposição).

### RBAC / Claims — arquitetura confirmada
Não há custom claims do Firebase Auth. Toda regra de autorização em `CRM/firestore.rules` resolve o perfil do requisitante por `get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data` (`usuarioAtual()`, `firestore.rules:26-28`) — uma leitura de documento por avaliação de regra, deduplicada dentro da mesma avaliação. É uma escolha válida (evita custom claims desatualizadas até o próximo login), com custo de performance já documentado e aceito (ver §11).

### `empresas` (aprovação/rejeição de empresas SaaS) — ✅ corretamente protegido
`allow create, update: if request.auth != null && temAcessoLiberado() && isMasterAdmin();` (`firestore.rules:554`). O gate de UI em `saas-admin.js:241` ("só master_admin") é reforçado, não substituído, pela Rule — confirmado que a Rule é a fronteira real.

### Onboarding público (`saasOnboardingCriarEmpresa`) — ✅ validado
Validação server-side redundante à client-side (nome 2-80 chars, e-mail regex, whatsapp 10-15 dígitos, plano contra whitelist), rate limit aplicado (`aplicarRateLimit(request, 'escrita')`), dedup por e-mail. Nenhuma conta de usuário criada nesta etapa (decisão de escopo documentada) — vínculo usuário↔empresa só na aprovação.

### 🔴 4 achados críticos — já ativos em produção (`main`), não relacionados ao SaaS
Detalhe técnico completo (arquivo:linha, cadeia de exploração) documentado em `plans/AUDITORIA_TECNICA_INDEPENDENTE_20260717_INTERNO.md` (não commitado, por conter mecanismo de exploração de vulnerabilidade ainda não corrigida em repositório público — mesma convenção de redação usada pelo projeto desde 2026-07-04). Resumo (categoria + impacto, sem "como"):

| # | Categoria | Impacto | Em `main` hoje? | Estado da correção observado no working tree de `develop` ao encerrar esta certificação |
|---|---|---|---|---|
| S1 | Stored XSS num fluxo de impressão do módulo de Ordens de Serviço (`CRM/pages/os/os.js`, função `printOS()`) | Execução de script na sessão de um membro da equipe autenticado, a partir de vetor público sem login | **Sim** | 🟡 Correção presente, não commitada: `escHtml()` aplicado a todos os campos interpolados no `document.write`, `window.open` com `noopener`. Não revisada/homologada por esta certificação (fora de escopo revisar trabalho de outra frente). |
| S2 | Cloud Function pública de consulta de OS sem exigir prova de posse, com ID sequencial/previsível | Enumeração de CPF, nome, telefone, defeito e valor de qualquer OS da base | **Sim** | 🟡 Mitigação parcial presente, não commitada: `functions/os.js`/`functions/lib/rate-limit.js` reduzem o limite de `consultarOSPublica` para 8 req/min/IP (era 60, compartilhado com todas as leituras). Eleva o custo de uma raspagem em massa, mas **não corrige a causa raiz** (ainda não exige prova de posse) — continua 🔴 mesmo com a mitigação. |
| S3 | Credencial de service account de produção commitada no histórico git de um repositório hoje público (~40min antes de removida do working tree) | Uso indevido da credencial se a chave antiga não tiver sido revogada no GCP (rotação já confirmada; revogação explícita não verificável só pelo repositório) | **Sim** (histórico git é permanente) | Não aplicável a correção via código — exige ação manual no console do GCP (IAM → Service Accounts → Keys), fora do alcance de qualquer commit. |
| S4 | Dados sensíveis do cliente (incl. credencial física do aparelho) logados no console do navegador, fora do processo de mitigação já aplicado a ~50 casos equivalentes no mesmo projeto (`SEC-CONSOLE-001`) | Exposição de PII/credencial a qualquer um com acesso ao DevTools daquele navegador | **Sim** | 🟡 Correção presente, não commitada: os 2 `console.log(..., d)` que expunham o objeto completo (incl. `senha`/`patternSequence`) em `verificarConversaoPreOS()`/`verificarConversaoPortalOS()` foram removidos de `CRM/pages/os/os.js`. Não revisada/homologada por esta certificação. |

**Nenhum dos 4 foi introduzido pelo trabalho de SaaS** — todos preexistem e afetam o CRM single-tenant já publicado. Nenhum seria encontrado por uma homologação funcional com dados de exemplo bem-comportados (confirmado: esta certificação, que testou fluxos reais, não os teria encontrado por conta própria). **Importante:** as correções acima foram produzidas por uma frente concorrente durante a janela desta certificação, permanecem não commitadas e não foram auditadas/testadas por esta missão — a classificação de severidade de S1/S2/S4 nesta certificação considera o estado commitado (ainda vulnerável), não o estado do working tree em trânsito.

### 🟠 2 achados altos — específicos do SaaS (`develop`), bloqueantes para promoção
| # | Achado | Arquivo | Correção não commitada observada no working tree? |
|---|---|---|---|
| A1 | Disjunto `empresa_id == null → allow` reintroduzido em `financeiro_categorias/{catId}/itens/{itemId}` — mesmo padrão que o próprio arquivo, no mesmo commit, documenta ter removido de `mesmaEmpresaRead()` por ser inseguro | `CRM/firestore.rules:235-240` | 🟡 Sim — disjunto `== null` removido, mesmo padrão seguro-por-padrão do resto do arquivo. Não commitada, não testada por esta certificação (emulador bloqueado por `ENOSPC`, §2). |
| A2 | `storage.rules`: `delete` em paths legados (`os/{osId}/**`, `docs/**`) permitido para qualquer usuário autenticado, sem checar `empresa_id`/perfil | `storage.rules:39-49` | 🟡 Sim — `delete` restrito a `empresaDoUsuario() == 'cellcity-master'` em ambos os paths legados. Não commitada, não testada por esta certificação. |

Impacto de A1/A2 (estado commitado, vigente): **nulo hoje** (só 1 empresa real); **vazamento/exclusão cross-tenant real** se o SaaS for promovido sem corrigir antes. As correções presentes no working tree (não commitadas) parecem, por leitura direta, resolver a causa raiz de ambos — mas não foram testadas contra o emulador nesta sessão (mesma limitação de `ENOSPC` de §2) nem revisadas formalmente por esta certificação, então A1/A2 permanecem classificados como abertos até commit + teste + revisão.

### 🔴 Vazamento cross-tenant confirmado em `pre_os`

`CRM/firestore.rules:139-142` permite `read, update, delete` em `pre_os` a qualquer usuário autenticado com acesso liberado, sem `mesmaEmpresaRead()`, `empresaImutavel()` ou verificação equivalente. O problema é exercitado pelo próprio client: `CRM/pages/dashboard/dashboard-alertas.js:18` consulta `pre_os` sem `injectTenantFilter()`, e `CRM/pages/dashboard/dashboard-alertas-panel.js:399-401` registra listener sem filtro e renderiza nome, equipamento e descrição do problema.

O efeito é direto: um funcionário de uma empresa pode visualizar e manipular pré-atendimentos pertencentes a outra empresa. Não é risco teórico nem apenas defesa em profundidade; Rules e consultas estão simultaneamente abertas. **Classificação: crítica e bloqueante**, conforme a regra explícita desta missão para qualquer vazamento entre tenants. Não havia correção presente no working tree quando este complemento foi incorporado.

### 🟡 Observação menor
`gerarSenhaTemp()` (`CRM/pages/saas-admin/saas-admin.js:42-47`) usa `Math.random()` (não criptográfico) para a senha temporária do admin. Entropia nominal alta, risco prático baixo. Recomendação: `crypto.getRandomValues()`.

### Verificado e considerado saudável
CSRF não aplicável (sem sessão por cookie, 100% Firebase Auth); nenhum secret adicional no working tree; `saas-admin.js` escapa HTML corretamente em todas as interpolações revisadas; padrão de Firebase secundário para criar conta de admin não expõe credencial adicional; escalada de privilégio histórica (BL-006) confirmada corrigida (`firestore.rules:478-488`); nenhum uso de `eval`/`new Function` em todo o projeto.

### Políticas de senha
`tests/rbac/usuarios-politicas-senha.test.mjs`: **10/10 PASS**. A UI armazena configurações de força, `expiracao_dias` e `historico_qtd`, mas somente a força é validada — e apenas no client da tela de usuários. Expiração e histórico não são aplicados por nenhum outro código; não há enforcement backend nem troca obrigatória no primeiro login. A senha temporária é comunicada manualmente pelo `master_admin` (sem envio automático). Portanto, o teste confirma o comportamento implementado da UI, não uma política de senha integralmente imposta pelo sistema.

---

## 6. Multiempresa

Escopo: `develop` (SaaS não promovido). Nas coleções cobertas pelos helpers, o isolamento está corretamente ancorado nas Firestore Rules (avaliadas contra `usuarios/{uid}` no servidor, não em estado do client). Contudo, essa garantia não é universal: `pre_os` ficou fora do padrão e transforma consultas client sem filtro em vazamento real.

- **Uma empresa acessa dados de outra?** **Sim — confirmado em `pre_os`** (§5): Rules sem tenant gate + duas consultas/listeners do Dashboard sem filtro. Classificação crítica.
- **Consulta sem filtro de tenant?** Nenhuma nos repositórios revisados; e mesmo que existisse, a Rule cobre.
- **Function vulnerável a cross-tenant?** Indiretamente — Cloud Functions públicas aceitam `empresaId` do próprio cliente sem verificar existência (`functions/lib/empresa.js:8-14`); impacto nulo hoje (1 empresa real), amplifica S2 se o SaaS for promovido com múltiplas empresas.
- **`empresa_id` imutável em update?** Confirmado (`empresaImutavel()`, `firestore.rules:93-98`).

---

## 7. Onboarding

Fluxo de 3 passos (empresa → plano → confirmação) rastreado em `CRM/pages/saas-onboarding/saas-onboarding.js` + `CRM/shared/saas-onboarding-validacao.js`. Validação client-side espelhada no server (`functions/saas.js`). `tests/onboarding/saas-onboarding-validacao.test.mjs`: **10/10 PASS**. Esse teste cobre somente validações puras; não houve execução end-to-end do wizard contra a callable nesta sessão.

Empresa nasce `pendente_aprovacao`; nenhuma conta de usuário é criada nesta etapa (decisão deliberada documentada no cabeçalho de `functions/saas.js:14-16`); vínculo usuário↔empresa só ocorre na aprovação pelo `master_admin`. Verificação de e-mail não está implementada. Há três lacunas adicionais: ausência de timeout client-side; promessa na tela de sucesso de envio de e-mail com instruções (`CRM/pages/saas-onboarding/index.html:78`) sem implementação correspondente; deduplicação por e-mail em `functions/saas.js:49-58` feita como `query` seguida de `set()` sem transação, sujeita a corrida e criação duplicada em submissões simultâneas.

---

## 8. Admin SaaS

`CRM/pages/saas-admin/saas-admin.js`: listagem, aprovação, rejeição, edição e desativação funcionam no desenho atual. **Não existe Cloud Function de aprovação/rejeição:** o client cria a conta Auth por app Firebase secundário, grava `usuarios/{uid}` e atualiza `empresas/{id}` diretamente. A segurança real depende das Firestore Rules com `isMasterAdmin()`; o gate de UI é apenas complementar. Isso é funcional hoje, mas deixa o fluxo sensível sem segunda validação por Admin SDK. Auditoria é registrada por `logAcao()`.

Também não há filtros, busca ou paginação (`getDocs` sem `limit()`), ação dedicada de suspensão nem entrega automática da senha temporária ao cliente. O texto do onboarding promete instruções por e-mail, mas a aprovação apenas mostra a senha uma vez ao operador.

`tests/rbac/saas-admin.test.mjs`: incluído na suíte RBAC completa (386/390 assertions globais aprovadas — ver §13).

---

## 9. Login

Firebase Auth (`CRM/scripts/firebase.js`) + carregamento de contexto (perfil, `empresa_id`) via leitura do doc `usuarios/{uid}` no `kernel.js`, sem custom claims (mesma arquitetura do §5). Logout limpa sessão via `signOut`. RBAC aplicado tanto client-side (gates de UI) quanto server-side (Rules) — dupla camada. Usuário criado pela aprovação do SaaS loga normalmente com a senha temporária comunicada pelo master_admin (sem fluxo de "primeiro acesso" dedicado nem troca obrigatória).

---

## 10. Firestore

Índices compostos (`CRM/firestore.indexes.json`) cobrem as queries reais em uso; time evita deliberadamente índices novos onde possível (ordena no servidor em `functions/portal.js:99-104,171-172`). Dois achados de documentação (não de Rule/segurança): `saas_eventos` e `crm_templates` têm Rule real e consumidor ativo mas não aparecem em `COLECOES_FIRESTORE.md`; `notificacoes_saas` está documentada como ativa mas é código morto sem Rule nenhuma (referenciada só por módulo já removido) — diferente das demais coleções legadas, que o documento já marca corretamente como inativas.

---

## 11. Cloud Functions

16 functions exportadas em `functions/index.js`, **todas `onCall`** (região `southamerica-east1`), nenhuma `onRequest`/HTTP pura, nenhum trigger Firestore (`onDocumentCreated`/etc.). Nenhum `timeoutSeconds`/`maxInstances` explícito (defaults do Firebase). Não existe callable para aprovação/rejeição de empresa ou criação do primeiro administrador; esse fluxo é client-side e protegido por Rules.

- Validação de entrada consistente em toda function pública revisada.
- Whitelisting de campos de saída (nenhuma function devolve o documento inteiro fora do whitelisted).
- `portalResponderOrcamento`/`portalMarcarMensagemLida` exigem `phoneDigits` do payload = gravado no documento antes de escrever.
- `excluirUsuarioAdmin`: verificação de perfil, tenant-scoping, proteção contra excluir o último admin da empresa.
- Rate limiting em memória por instância (`functions/lib/rate-limit.js`), não distribuído — limitação autodocumentada, insuficiente isoladamente contra S2 (§5).
- Idempotência: `saasOnboardingCriarEmpresa` consulta duplicidade por e-mail, mas a checagem e a escrita não são transacionais; chamadas simultâneas podem criar empresas duplicadas. `portalCriarAgendamento`/`portalCriarAvaliacao` também não têm proteção contra duplo-clique/retry.

---

## 12. Performance

Documentado, sem otimização (fora do escopo desta missão):

| Medição | Valor |
|---|---|
| `npm install` (raiz) | 2,5s |
| `npm install` (functions) | 2,0s |
| `npm run build` | N/A (sem build step) |
| `auditar-arquitetura` | poucos segundos |
| `validar-infra-app-config` (12 testes) | 95ms |
| Suíte completa (`tests/**/*.test.mjs`, node --test, 525 assertions) | 4min25s (265s) |
| Suíte `control-center` isolada (158 assertions, scripts shell reais) | ~5-8min (maior parte do tempo total da suíte — já esperado, documentado desde a certificação de integração anterior) |
| `usuarios-politicas-senha.test.mjs` isolado | 6,9s |
| Tentativa de start do emulador Firestore | ~2,5s até falhar com `ENOSPC` |
| `temAcessoLiberado()` | +1 leitura Firestore por operação em praticamente toda coleção de negócio — custo aceito conscientemente (`TECHDOC.md §6.14`), risco relembrado pelo histórico de estouro de cota de 2026-07-02 |

---

## 13. Regressão

Suíte completa executada com o loader correto (`node --import ./tests/rbac/register-loader.mjs --test tests/**/*.test.mjs`, fora do sandbox padrão da ferramenta para não sofrer os falsos hangs de `rsync`/emulador documentados em §2):

```
# tests 525
# suites 18
# pass 386
# fail 139
# duration_ms 265366
```

Dos 139 "fail": **135 são exclusivamente os testes que exigem o emulador Firestore** (`tests/firestore-rules/os-publico.test.mjs`: 75; `tests/firestore-rules/tenant-isolamento.test.mjs`: 32; `tests/functions/portal-cloud-functions.test.mjs`: 25; `tests/functions/saas-onboarding.test.mjs`: 5 — não executáveis nesta sessão por `ENOSPC`, ver §2) e **4 são as mesmas 2 falhas pré-existentes já documentadas** em `tests/rbac/financeiro-relatorio.test.mjs` (contadas 2x por causa do wrapper de suíte no relatório TAP).

**Excluindo os bloqueios de ambiente: 386 passaram / 390 executáveis (99%), com as 4 falhas restantes sendo 100% conhecidas e pré-existentes. Nenhuma regressão nova encontrada** em Sprint 1, Sprint 2, Sprint 3, Sprint 4, Portal, CRM, Financeiro, Agenda, Estoque, OS, Dashboard, Usuários, Permissões.

| Suíte | Resultado |
|---|---|
| `tests/rbac/*` (48 arquivos) | ✅ sem regressão nova (2 falhas conhecidas em `financeiro-relatorio`) |
| `tests/control-center/*` | ✅ 158/158 |
| `tests/integrity/integridade.test.mjs` | ✅ (após rodar fora do sandbox padrão — rsync interno travava sob restrição de syscall do sandbox, não é defeito do teste) |
| `tests/e2e/basic-structure.test.mjs` | ✅ (Puppeteer real, Chrome headless) |
| `tests/infra/app-config-estabilizacao.test.mjs` | ✅ 12/12 |
| `tests/onboarding/saas-onboarding-validacao.test.mjs` | ✅ 10/10 |
| `tests/performance/polling-gating.test.mjs` | ✅ |
| `tests/firestore-rules/*`, `tests/functions/*` | ⏸️ bloqueado por ambiente (`ENOSPC`), não é falha de código — Rules validadas por leitura de código (§5, §6) |

---

## 14. Evidências

Todas as citações arquivo:linha estão inline nas seções 5-11. Logs brutos desta sessão: saída completa de `node --test` salva localmente durante a execução (`/tmp/test-full-output-3.txt`, não persistido no repositório — artefato de sessão). Auditoria técnica independente complementar: `plans/AUDITORIA_TECNICA_INDEPENDENTE_20260717.md` (pública) e `plans/AUDITORIA_TECNICA_INDEPENDENTE_20260717_INTERNO.md` (gitignorada, detalhe técnico completo dos achados 🔴/🟠).

---

## 15. Problemas Encontrados

Consolidado (ver detalhe nas seções correspondentes):

| # | Problema | Severidade | Escopo | Correção não commitada observada em `develop`? |
|---|---|---|---|---|
| S1 | Stored XSS em `printOS()` | 🔴 Crítico (commitado) | Produção (`main`), pré-existente | Sim — `escHtml()`+`noopener` |
| S2 | `consultarOSPublica` sem prova de posse | 🔴 Crítico (commitado) | Produção (`main`), pré-existente | Parcial — rate limit mais restrito, causa raiz não resolvida |
| S3 | Service account key no histórico git público | 🔴 Crítico | Produção (`main`), pré-existente, histórico | Não aplicável (ação fora do repositório) |
| S4 | Senha/padrão de desbloqueio logados no console | 🔴 Crítico (commitado) | Produção (`main`), pré-existente | Sim — 2 `console.log` removidos |
| V1 | `pre_os` sem isolamento nas Rules e no Dashboard | 🔴 Crítico | SaaS (`develop`), vazamento cross-tenant confirmado | Não |
| A1 | Disjunto inseguro em Rules de `financeiro_categorias/itens` | 🟠 Alto (commitado) | SaaS (`develop`), bloqueante p/ promoção — correção não commitada presente |
| A2 | `storage.rules`: delete sem gate de tenant em paths legados | 🟠 Alto (commitado) | SaaS (`develop`) + parcialmente hoje — correção não commitada presente |
| M1 | Deduplicação do onboarding sem transação | 🟡 Médio | Corrida pode criar empresas duplicadas |
| M2 | Políticas de senha sem enforcement backend/expiração/histórico efetivos | 🟡 Médio | Configuração parcialmente cosmética |
| M3 | Aprovação/criação do primeiro admin inteiramente client-side | 🟡 Médio | Rules protegem hoje, mas sem segunda camada Admin SDK |
| B1 | Self-XSS no resumo do onboarding | 🔵 Baixo | Input do próprio usuário interpolado em `innerHTML` |
| B2 | Promessa de e-mail de instruções sem implementação | 🔵 Baixo | Divergência de UX/documentação |
| — | Catálogo de módulos com metadado desatualizado | 🟢 Baixo | Manutenção de rotina |
| — | `gerarSenhaTemp()` com PRNG não criptográfico | 🟡 Médio | SaaS |
| — | `getDeliveryDate()`/`calcDias()` triplicados, bug de falso positivo em 3/4 cópias | 🟡 Médio | CRM (pré-existente) |
| — | 2 falhas pré-existentes em `financeiro-relatorio.test.mjs` | 🟡 Médio (conhecido) | CRM (pré-existente, rastreado) |

---

## 16. Correções Realizadas Nesta Certificação

**Nenhuma.** Esta certificação seguiu o escopo de leitura/homologação/teste. Alterações observadas em `CRM/pages/os/os.js`, `functions/os.js`, `functions/lib/rate-limit.js`, `CRM/firestore.rules`, `storage.rules` e testes associados foram produzidas por uma frente concorrente, não por esta certificação. Esta missão apenas documentou o estado encontrado. O vazamento crítico de `pre_os` permaneceu sem correção observada ao incorporar os pareceres complementares.

---

## 17. Pendências

- Corrigir imediatamente o isolamento de `pre_os` nas Rules e nas duas consultas/listeners do Dashboard; criar testes negativos entre tenants para read/update/delete/list. **Bloqueante absoluto.**
- Corrigir A1 e A2 e homologar as correções concorrentes antes de promover o SaaS a produção.
- Corrigir S1-S4 na produção atual, independentemente da decisão sobre SaaS (não são causados pelo SaaS, mas afetam o sistema já publicado). **Nota:** ao encerrar esta certificação, há correções para S1 e S4 (e mitigação para S2) já presentes no working tree de `develop`, ainda não commitadas — recomenda-se que quem exercer o papel de Revisão Técnica avalie, teste e commite (ou rejeite) esse trabalho formalmente, em vez de deixá-lo pendente sem dono. S2 precisa, adicionalmente, de uma correção de causa raiz (exigir prova de posse, não só rate limit mais restrito) para deixar de ser 🔴.
- Confirmar explicitamente no console do Google Cloud (IAM → Service Accounts → Keys) que a key ID vazada (S3) está revogada, não apenas substituída.
- Reexecutar `tests/firestore-rules/*` e `tests/functions/*` num ambiente sem limite de `inotify` esgotado (CI ou máquina dedicada) para validação end-to-end real das Rules via emulador — a validação desta certificação foi por leitura de código, não por execução.
- Regenerar `CRM/shared/modulos.catalogo.json` (rotina, não crítico).
- `MASTER_ROADMAP.md` está desatualizado sobre o estado do multiempresa (descreve como "código morto" algo que foi integralmente reconstruído entre 07-14 e 07-16) — atualização recomendada, sem urgência.

---

## 18. Riscos Residuais

- Enquanto `pre_os` não estiver isolado e coberto por teste negativo cross-tenant, o SaaS está **reprovado para produção**. A falha permite acesso efetivo a dados de outra empresa.
- Enquanto A1/A2 não forem corrigidos de forma commitada, testada e revisada, o SaaS também não deve ser promovido.
- S1-S4 são explorações que dependem de leitura adversarial de código ou acesso ao histórico público do repositório — não seriam detectados por nenhum teste funcional adicional, só por correção direta.
- Rate limiting das Cloud Functions não é distribuído — mitigação parcial contra abuso automatizado em escala (relevante especialmente para S2 e para o onboarding público).
- Ambiente de CI (`tests.yml`) não cobre hoje todas as suítes já certificadas manualmente (`tests/onboarding/`, `tests/e2e/`, `validar-infra-app-config`, catálogo de módulos, 3 suítes de `control-center`) — regressão nessas áreas não seria pega automaticamente antes do merge.

---

## 19. Checklist de Produção

| Item | Status | Evidência |
|---|---|---|
| Firestore Rules deployadas (produção atual, `main`) | ✅ Sim, mas **não as de `develop`** | `git diff main develop -- CRM/firestore.rules` = 778 linhas de diferença; multiempresa segue "congelado" fora de produção (`PRODUCAO_READINESS.md`, incidente P0 2026-07-14) |
| Storage Rules deployadas | ✅ (versão de `main`, sem os paths canônicos multiempresa) | idem |
| Cloud Functions deployadas | ✅ (só as de `main`) — `functions/saas.js` **não existe em `main`**, confirmado (`git show main:functions/saas.js` → not found) | `saasOnboardingCriarEmpresa` não está em produção hoje |
| Índices sincronizados | ✅ | `CRM/firestore.indexes.json` sem lacuna óbvia identificada |
| Secrets válidos (`FIREBASE_SA_KEY` do workflow de deploy) | ⚠️ **Não verificável nesta sessão** — comentário no próprio `.github/workflows/deploy-firebase.yml:6-8` registra que o secret "nunca foi configurado" até a correção do gate de 2026-07-16; sem acesso a `gh secret list` neste ambiente para confirmar estado atual | Recomenda-se confirmação manual |
| APIs válidas | ✅ (sem indício de quebra) | — |
| Service Accounts válidas | ⚠️ Rotacionada, revogação da antiga não confirmada (S3) | ver §5, §15 |
| Backup atualizado | ✅ Backup automático semanal ativo (workflow confirmado `active` desde a promoção que incluiu `backup-weekly.yml`) | `CRM/TECHDOC.md:886` |
| Plano de rollback documentado | ✅ | `PROXIMA_ETAPA.md`, relatórios de Sprint individuais têm seção de rollback |
| Monitoramento ativo | 🟡 Parcial — Central de Alertas (nível de aplicação) existe; nenhum APM/uptime de infraestrutura externo identificado | — |
| Auditoria ativa | ✅ | `logAcao()`/`shared/saas-auditoria.js` usado em todas as ações de admin SaaS; `auditoria_saas` |
| Versionamento correto | ✅ | Gate `if: github.ref == 'refs/heads/main'` no workflow de deploy impede repetição do incidente P0 (rules de `develop` publicadas em produção) |

**Nenhum deploy foi executado por esta certificação.** Todos os itens acima são verificação, não ação.

---

## 20. Parecer Técnico Final

**Arquitetura:** estruturalmente consistente (`auditar-arquitetura` 🟢 6/6), mas isso não certifica segurança de dados. **Isolamento multiempresa:** reprovado por vazamento confirmado em `pre_os`; A1/A2 permanecem bloqueantes até homologação. **Segurança:** 4 riscos críticos na produção atual, 1 risco crítico específico do SaaS e 2 riscos altos específicos do SaaS. **Regressões funcionais:** nenhuma nova, além das 2 falhas conhecidas em `financeiro-relatorio.test.mjs`. **Testes:** 386/390 executáveis aprovados; os testes de Rules/Functions via emulador foram bloqueados por `inotify`, e justamente não havia teste dedicado cobrindo o gap de `pre_os`.

**Sobre onboarding, aprovação, login e admin:** os fluxos são coerentes por revisão estática e testes unitários/RBAC, mas a homologação end-to-end real não foi concluída nesta sessão. Permanecem lacunas de timeout, promessa de e-mail sem implementação, corrida na deduplicação do onboarding, aprovação inteiramente client-side, ausência de paginação e políticas de senha sem enforcement backend.

### Classificação final

# 🔴 REPROVADO PARA PRODUÇÃO

**Condições mínimas para nova certificação:**
- Corrigir `pre_os` em Rules e client, provar negação de read/update/delete/list entre pelo menos três tenants e reexecutar a suíte com emulador.
- Commitar, revisar e testar formalmente A1/A2.
- Independentemente da decisão sobre SaaS: levar o mesmo ciclo (commit + teste + revisão formal) para S1, S2 e S4 na produção atual (`main`) — correções/mitigações já existem no working tree, mas S2 ainda precisa de uma correção de causa raiz além do rate limit mais restrito. S3 exige ação direta no GCP, fora do repositório. São pendências de segurança do sistema já publicado, não bloqueiam nem são bloqueadas pela decisão sobre SaaS, mas devem ser tratadas com prioridade máxima por afetarem usuários reais hoje.

Nenhuma promoção de branch, deploy ou abertura de Sprint foi realizada por esta certificação. A decisão sobre a próxima etapa oficial do projeto cabe a quem exerce o papel de Estratégia, com base neste relatório e no relatório da auditoria técnica independente complementar.

---

*Esta certificação não alterou nenhum arquivo de código, Rules, configuração ou dependência do projeto — apenas este relatório foi criado. Nenhuma Sprint foi aberta. Nenhum deploy, merge ou promoção de branch foi executado.*
