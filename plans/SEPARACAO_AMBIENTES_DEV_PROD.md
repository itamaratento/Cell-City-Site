# PLANO — Separação de Ambientes DEV × PRODUÇÃO (Firebase)

**Status:** 🟡 EM ANÁLISE — aprovado como necessidade em 2026-07-02, execução aguardando autorização formal; **freeze de alterações de infraestrutura em vigor**. Nenhuma implementação iniciada.
**Prioridades definidas pelo proprietário (2026-07-02):** (1) homologação do Sprint 3 do RBAC, (2) limpeza do Firestore, (3) decisão sobre cota/plano Blaze, (4) este plano — somente com autorização.
**Data:** 2026-07-02 (adendos da auditoria pré-separação incorporados na seção 7)
**Origem:** Auditoria de 2026-07-02 confirmou que MAIN e DEVELOP compartilham o mesmo projeto Firebase (`cellcity-crm`). O seletor 🟢 MAIN / 🟠 DEVELOP troca apenas o código publicado (GitHub Pages `/` vs `/dev`); Auth, Firestore e Storage são únicos. Testes no DEVELOP gravam direto na produção (caso real: usuário `eu@cellcity.com.br` criado no DEVELOP apareceu no MAIN).

---

## 1. Objetivo

Isolar completamente o backend dos dois ambientes: criar o projeto Firebase **`cellcity-crm-dev`** exclusivo para desenvolvimento e fazer o código selecionar automaticamente o projeto correto (DEV ou PRODUÇÃO) pela URL, mantendo o padrão já adotado pelo sistema (mesmo código nos dois branches, ambiente detectado pela URL — como o `brand-header.js` já faz).

## 2. Inventário do estado atual (auditado em 2026-07-02)

### 2.1 Serviços Firebase em uso

| Serviço | Em uso? | Observação |
|---|---|---|
| Authentication | ✅ Sim | Provider e-mail/senha |
| Firestore | ✅ Sim | Região `southamerica-east1`; rules em `CRM/firestore.rules`, índices em `CRM/firestore.indexes.json` |
| Storage | ✅ Sim | Upload de fotos (OS e Central de Informações); `storage.rules` e `cors.json` versionados |
| Cloud Functions | ❌ Não | Nenhuma referência no código |
| FCM / Analytics / Remote Config | ❌ Não | Nenhuma referência no código |
| Hosting | 🚫 Proibido | Publicação é exclusivamente via GitHub Pages |

### 2.2 Pontos com `firebaseConfig` fixo no código (12)

| # | Arquivo | Tipo | Observação |
|---|---|---|---|
| 1 | `CRM/scripts/firebase.js` | Módulo ES | **Arquivo protegido.** Config central de todo o CRM (Auth+Firestore+Storage do mesmo `app`) |
| 2 | `CRM/pages/usuarios-permissoes/firebase-secondary.js` | Módulo ES | App secundário para criar usuários sem deslogar o admin — origem do caso relatado |
| 3 | `autoatendimento.html` (raiz) | SDK compat inline | Página pública |
| 4 | `CRM/autoatendimento.html` | SDK compat inline | Página pública |
| 5 | `consultar-os.html` (raiz) | SDK compat inline | Página pública |
| 6 | `CRM/consultar-os.html` | SDK compat inline | Página pública |
| 7 | `CRM/garantia.html` | inline | Página pública |
| 8 | `CRM/pages/portal-cliente/index.html` | inline | Página pública |
| 9 | `CRM/pages/portal-cliente/admin.html` | inline | |
| 10 | `CRM/pages/catalogo/public/catalogo-publico.js` | inline | Página pública |
| 11 | `backup-dados.js` (raiz) | Ferramenta Node local | Não publicado como app |
| 12 | `_runtime_audit/inspect-phones.js` | Ferramenta Node local | Não publicado como app |

### 2.3 Outros fatos relevantes

- `.firebaserc` (raiz e CRM) aponta só para `cellcity-crm` — precisará de alias `dev`.
- `sa-key.json` (service account de produção) está corretamente no `.gitignore`, **não** vai para o repositório público.
- `CRM/sw.js` (service worker) **não** contém firebaseConfig, mas cacheia JS — exige bump de versão no rollout.
- `detectEnv()` do `brand-header.js` considera qualquer URL sem `/dev` como MAIN — inclusive `localhost` e `file://`. Para o backend isso é inseguro (teste local gravaria em produção); a regra proposta na seção 3 corrige isso.

## 3. Arquitetura proposta

### 3.1 Novo projeto Firebase

- **`cellcity-crm-dev`**, plano Spark (gratuito), Firestore na mesma região `southamerica-east1`.
- Serviços habilitados: Authentication (e-mail/senha), Firestore, Storage. Nada além disso.
- Domínios autorizados no Auth: `cellcityinformatica.com.br`, `www.cellcityinformatica.com.br` (o `/dev` é servido pelo MESMO domínio) e `localhost`.
- Service account própria (`sa-key-dev.json`), guardada localmente e adicionada ao `.gitignore` **antes** de ser criada.

### 3.2 Seleção de ambiente em runtime (regra fail-safe)

Fonte única de verdade em um novo arquivo `CRM/shared/env-config.js` (script clássico que define `window.CC_ENV` e `window.CC_FIREBASE_CONFIG`), consumível tanto por `<script src>` (páginas compat) quanto por `import` de efeito colateral (módulos ES):

```js
// Regra: só é PRODUÇÃO quando está no domínio oficial E fora de /dev.
// Qualquer outro contexto (prefixo /dev, localhost, file://, preview) usa DEV.
const host = location.hostname;
const isProdHost = host === 'www.cellcityinformatica.com.br' || host === 'cellcityinformatica.com.br';
const isDevPath  = location.pathname === '/dev' || location.pathname.startsWith('/dev/');
window.CC_ENV = (isProdHost && !isDevPath) ? 'prod' : 'dev';
window.CC_FIREBASE_CONFIG = window.CC_ENV === 'prod' ? CONFIG_PROD : CONFIG_DEV;
```

Pontos-chave:

- **Fail-safe:** em caso de dúvida (localhost, arquivo local, host desconhecido), o padrão é DEV — o erro possível passa a ser "teste não achou dados", nunca "teste sujou a produção".
- `CRM/scripts/firebase.js` importa `env-config.js` e inicializa **um único `app`** com o config selecionado; Auth, Firestore e Storage derivam todos desse mesmo `app` (como já ocorre hoje) — garantia de que os serviços nunca se misturam entre ambientes.
- `firebase-secondary.js` passa a ler o mesmo `window.CC_FIREBASE_CONFIG` — usuário criado no DEV nasce no Auth do DEV.
- As 8 páginas standalone (itens 3–10 da tabela) carregam `env-config.js` antes do `initializeApp` e usam `window.CC_FIREBASE_CONFIG` no lugar do literal.
- Ferramentas Node (itens 11–12) recebem chave `--dev`/`--prod` explícita (sem detecção automática, para operação consciente).
- O `detectEnv()` do `brand-header.js` (indicador visual) **não muda nesta entrega** — segue detectando pela URL para o pill; a unificação visual com `CC_ENV` fica para depois, minimizando o raio da mudança.

## 4. Etapas de implementação

> As Fases 1–4 não tocam nenhum arquivo do sistema — zero risco para a produção. Somente a Fase 5 altera código, e só começa com o TECHDOC (seção 5) aprovado.

**Fase 1 — Infraestrutura do projeto DEV** (console Firebase; requer conta do proprietário)
1. Criar projeto `cellcity-crm-dev`.
2. Habilitar Auth (e-mail/senha) + domínios autorizados (3.1).
3. Criar Firestore em `southamerica-east1` e o bucket padrão do Storage.
4. Aplicar CORS do bucket com o `cors.json` existente.
5. Gerar `sa-key-dev.json` (guardar fora do git; conferir `.gitignore` antes).

**Fase 2 — Rules e índices**
1. Adicionar alias `dev: cellcity-crm-dev` ao `.firebaserc`.
2. `firebase deploy --only firestore:rules,firestore:indexes,storage --project dev` (mesmos arquivos versionados da produção).
3. **Verificar o release ativo via API `firebaserules.googleapis.com`** — o console já confirmou "Publicar" sem efetivar (lição registrada em 2026-07-01).

**Fase 3 — Carga inicial (seed)**
1. Enumerar TODAS as coleções raiz da produção via Admin SDK `listCollections()` (a lista fixa do `backup-dados.js` tem 21 coleções e **não inclui** `usuarios`, `empresas` e outras do multiempresa/RBAC).
2. Exportar produção → JSON (evolução do `backup-dados.js`) e importar no DEV com script Admin SDK usando `sa-key-dev.json`.
3. Decisão de negócio embutida: **anonimizar ou não** nomes/telefones de clientes no DEV (LGPD). Recomendação: anonimizar telefones e sobrenomes; estrutura e volumes reais são mantidos.

**Fase 4 — Usuários de homologação no DEV**
1. Recriar no Auth do DEV os usuários padrão `cellcity<perfil>@gmail.com` (um por perfil operacional).
2. Criar os docs `usuarios/{uid}` correspondentes com perfil RBAC e `empresa_id`, espelhando a produção.

**Fase 5 — Adequação do código** (única fase que toca arquivos do sistema; TECHDOC na seção 5)
1. Criar `CRM/shared/env-config.js`.
2. Alterar os 10 pontos publicados (itens 1–10 da tabela 2.2) para consumir o config selecionado.
3. Adicionar flag `--dev/--prod` às 2 ferramentas Node.
4. Bump da versão do cache no `CRM/sw.js`.
5. Publicar primeiro no branch `develop` (/dev), validar, depois `main`.

**Fase 6 — Validação e encerramento** (checklist na seção 5.7)

## 5. TECHDOC — Alteração de arquivos protegidos (Fase 5)

### 5.1 Objetivo da alteração
Fazer `firebase.js` (e os demais 9 pontos publicados) selecionarem automaticamente o projeto Firebase correto (DEV/PROD) conforme a URL, com fonte única de configuração e fallback seguro para DEV.

### 5.2 Arquivos que serão modificados
- **Novo:** `CRM/shared/env-config.js`
- **Protegido:** `CRM/scripts/firebase.js` (somente o bloco `firebaseConfig` → leitura do config selecionado; nenhuma mudança nas exportações)
- `CRM/pages/usuarios-permissoes/firebase-secondary.js`
- `autoatendimento.html`, `CRM/autoatendimento.html`, `consultar-os.html`, `CRM/consultar-os.html`, `CRM/garantia.html`, `CRM/pages/portal-cliente/index.html`, `CRM/pages/portal-cliente/admin.html`, `CRM/pages/catalogo/public/catalogo-publico.js`
- `CRM/sw.js` (apenas bump de versão de cache)
- `backup-dados.js`, `_runtime_audit/inspect-phones.js` (flag explícita de ambiente)
- Backup prévio de cada arquivo crítico, conforme regra permanente.

### 5.3 Módulos impactados
Todos os que usam Firebase — na prática o sistema inteiro. Em **produção o comportamento é idêntico** (config selecionado = o atual); a mudança funcional real só existe no `/dev`, `localhost` e `file://`. Atenção especial às páginas públicas usadas por clientes finais: autoatendimento, consultar-OS, portal do cliente, catálogo público.

### 5.4 Dependências
- Fases 1–4 concluídas (projeto DEV pronto, rules/índices ativos, seed e usuários de homologação criados) — senão o `/dev` publica quebrado.
- Firebase CLI autenticado com acesso aos dois projetos.
- Confirmação de que o auto-commit externo identificado em 2026-06-30 está desativado (risco de publicar mudança parcial).
- Node via nvm (v22) para as ferramentas locais.

### 5.5 Riscos envolvidos
| Risco | Severidade | Mitigação |
|---|---|---|
| Detecção errada de ambiente → DEV gravando em PROD | 🔴 Alta | Regra fail-safe (default DEV); log do `projectId` ativo no console; critério de aceite nº 2 reproduz o bug original |
| SW servindo `firebase.js` antigo em cache após publicação | 🟠 Média | Bump de versão do `sw.js` no mesmo commit; validação com hard-reload e aba anônima |
| Regressão nas páginas públicas (compat SDK) | 🟠 Média | Alteração mínima (só a origem do config); checklist inclui as 4 páginas públicas nos 2 ambientes |
| Auto-commit externo publicando estado intermediário | 🟠 Média | Confirmar desativação antes de iniciar; trabalhar com working tree limpa |
| Cota Spark do projeto DEV esgotando em testes intensos | 🟡 Baixa | Aceitável em dev; documentar; considerar Blaze futuramente |
| Vazamento de `sa-key-dev.json` no repo público | 🔴 Alta | Entrada no `.gitignore` criada ANTES da chave; conferir `git status` após gerar |

### 5.6 Estratégia de rollback
- A mudança é 100% frontend e não altera nenhum dado de produção → rollback = `git revert` do(s) commit(s) da Fase 5 + push (GitHub Pages republica) + novo bump do `sw.js`.
- Criar tag `pre-separacao-ambientes` nos dois branches antes de publicar.
- O projeto `cellcity-crm-dev` pode ser abandonado/excluído sem nenhum efeito sobre a produção.

### 5.7 Checklist de validação
Em **ambos** os ambientes (produção e `/dev`), conforme regra permanente do projeto:
- [ ] Login
- [ ] Dashboard
- [ ] CRM
- [ ] Ordem de Serviço (incluindo upload de foto → conferir bucket correto)
- [ ] Caixa
- [ ] Estoque
- [ ] Financeiro
- [ ] Portal do Cliente
- [ ] Autoatendimento, Consultar-OS, Garantia e Catálogo público
- [ ] Console do navegador exibe o `projectId` esperado em cada ambiente
- [ ] `localhost`/`file://` conecta no DEV
- [ ] Usuário criado no `/dev` (módulo Usuários e Permissões) **não** existe no Auth nem na coleção `usuarios` da produção — reprodução do caso `eu@cellcity.com.br`
- [ ] Rules ativas no DEV conferidas via `firebaserules.googleapis.com`

### 5.8 Critérios de aceite
1. `/dev` usa `cellcity-crm-dev` para Auth, Firestore e Storage; domínio oficial fora de `/dev` usa `cellcity-crm` — comprovado pelo `projectId` em runtime.
2. O cenário do bug original, reproduzido no DEV, **não** reflete nada na produção.
3. Nenhum literal de `firebaseConfig` remanescente fora do `env-config.js` nos arquivos publicados.
4. Todos os itens do checklist 5.7 aprovados nos dois ambientes.
5. Nenhuma credencial (sa-key de qualquer ambiente) rastreada pelo git.

## 6. Achados paralelos da auditoria (fora do escopo deste plano, mas urgentes)

1. **Cota do Firestore de produção esgotada em 2026-07-02 (~13:30 BRT):** toda leitura via Admin SDK retornou `RESOURCE_EXHAUSTED: Quota exceeded` de forma persistente. A API de billing nunca foi habilitada no projeto, o que indica plano Spark — se confirmado, **o CRM em produção fica sem ler o banco até o reset diário (~04:00 BRT)** sempre que a cota de 50k leituras/dia estourar. Recomendação: verificar o plano no console e avaliar upgrade para Blaze com alerta de orçamento.
2. **Limpeza do usuário de teste:** `eu@cellcity.com.br` já foi **removido do Firebase Auth** (2026-07-02, uid `kuigLv0DDcQ8o9HHpoMJZYgvPLA2` conferido antes do delete). A remoção do doc na coleção `usuarios` + varredura de referências nas demais coleções está **pendente** exclusivamente por causa da cota esgotada; script pronto para rodar após o reset.

## 7. Adendos — Auditoria pré-separação (2026-07-02)

Auditoria técnica read-only realizada em 2026-07-02, em paralelo à elaboração deste plano, encontrou **6 lacunas que devem entrar no escopo antes da execução** (principalmente da Fase 5):

1. **Dois endpoints REST hardcoded fora da tabela 2.2:** `CRM/pages/analise/analise.js` (linha ~19) e `CRM/pages/dashboard/sw-alarme.js` (linha ~171) chamam `firestore.googleapis.com/v1/projects/cellcity-crm/...` diretamente — e **sem header `Authorization`** (as Rules exigem auth; o módulo Análise possivelmente já está quebrado hoje). A Fase 5 precisa incluí-los na adequação (são 12 + 2 = 14 pontos de config/projeto fixo).
2. **Providers de Auth no projeto DEV:** o plano previa só e-mail/senha, mas o sistema usa `signInAnonymously` (consultar-os ×2, portal-cliente index + admin) e `GoogleAuthProvider` (`shared/session.js` → Configurações/Ferramentas). O `cellcity-crm-dev` precisa de **Anonymous Auth habilitado** (e Google, se o fluxo de Ferramentas for testado no DEV) — ajustar a Fase 1, item 2.
3. **`sw-alarme.js` roda em contexto de Service Worker:** `window.CC_FIREBASE_CONFIG` não existe lá — o `env-config.js` clássico (que define `window.*`) **não resolve para SWs**. A Fase 5 precisa de uma solução específica para esse contexto (ex.: derivar o ambiente de `self.location` dentro do próprio SW).
4. **`garantia.html` usa credenciais de OUTRO registro de app** (senderId `1068710301995` ≠ `645609867368`, bucket `.appspot.com`): a unificação via `env-config.js` muda o app usado pela página — validar a página de garantia explicitamente na Fase 6.
5. **`_BACKUPS/` publicados no GitHub Pages:** 1032 arquivos html/js versionados, 132 com `initializeApp` apontando para produção — código antigo publicamente acessível rodando contra o banco de produção, que **continuará hardcoded após a separação** (os backups não serão adequados). Decidir: excluir do artefato publicado (workflow), remover do repo, ou aceitar o risco documentado.
6. **Rules/índices duplicados e divergentes:** `firestore.rules` da raiz está desatualizado (ainda contém coleções SaaS pré-rollback) e difere da fonte oficial `CRM/firestore.rules` (a que o `firebase.json` referencia); `firestore.indexes.json` da raiz está vazio vs. 4 índices reais no de `CRM/`. Ao criar o projeto DEV (Fase 2), usar **exclusivamente** os arquivos de `CRM/` e avaliar a remoção dos da raiz.

**Outros achados registrados (avaliar na Fase 5/6):**
- 74 arquivos com paths absolutos `/CRM/` + `LOGIN_URL='/CRM/login.html'` no `kernel.js` → no ambiente `/dev`, redirects de navegação/SW podem apontar para a produção.
- `localStorage`/`sessionStorage` (`cc_kernel_v1`, `cc_tenant_ctx`, `cc_acesso`, preferências) compartilhados entre `/` e `/dev` (mesma origem) — estados vazam entre ambientes.
- `firebase.json` ainda contém a seção `hosting`, apesar de o Firebase Hosting ser proibido no projeto — resquício a limpar.
- `CRM/pages/kernel-test/` publicado nos dois ambientes.
