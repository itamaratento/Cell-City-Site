# 🌐 GUIA DE OPERAÇÃO DOS AMBIENTES — Cell City CRM

> **Criado em:** 2026-07-02
> **Público-alvo:** quem opera o dia a dia dos ambientes (publicar, testar, validar).
> Documentos relacionados: [`GUIA_ROLLBACK.md`](GUIA_ROLLBACK.md) · [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) · [`CRM/TECHDOC.md`](CRM/TECHDOC.md) (§9) · [`plans/SEPARACAO_AMBIENTES_DEV_PROD.md`](plans/SEPARACAO_AMBIENTES_DEV_PROD.md)

---

## 1. Visão geral dos ambientes

| | 🟢 MAIN (Produção) | 🟠 DEVELOP (Desenvolvimento) |
|---|---|---|
| **URL** | `https://www.cellcityinformatica.com.br/` | `https://www.cellcityinformatica.com.br/dev/` |
| **Branch git** | `main` | `develop` |
| **Hospedagem** | GitHub Pages (repo `itamaratento/Cell-City-Site`) | GitHub Pages (mesmo deployment, subpasta `/dev`) |
| **Backend Firebase** | `cellcity-crm` | ⚠️ **`cellcity-crm` — O MESMO da produção** |
| **Indicador na interface** | Pill `🟢 ONLINE \| MAIN` | Pill `🟠 ONLINE \| DEVELOP` |

### ⚠️ A regra mais importante deste guia

**Hoje os dois ambientes compartilham o MESMO projeto Firebase (`cellcity-crm`): Auth, Firestore e Storage são únicos.** O que separa MAIN de DEVELOP é apenas o **código publicado**. Consequências práticas:

- Qualquer dado criado/alterado/excluído em teste no DEVELOP **afeta a produção** (caso real: usuário `eu@cellcity.com.br` criado no DEVELOP apareceu no MAIN).
- Testes intensos no DEVELOP **consomem a cota de leituras da produção** (plano Spark, 50k leituras/dia — ver [`plans/RELATORIO_COTA_FIRESTORE_20260702.md`](plans/RELATORIO_COTA_FIRESTORE_20260702.md)).
- Enquanto a separação de backend não for implementada ([`plans/SEPARACAO_AMBIENTES_DEV_PROD.md`](plans/SEPARACAO_AMBIENTES_DEV_PROD.md), aguardando autorização), **trate todo teste no DEVELOP como operação em produção**: use dados descartáveis identificáveis (padrão de e-mail QA — ver [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) §4), limpe depois, e nunca rode testes destrutivos.

---

## 2. Como a publicação funciona

**Publicação é exclusivamente via `git push` para o GitHub. Firebase Hosting é PROIBIDO neste projeto** (decisão formal — nunca rodar `firebase deploy --only hosting`).

O workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) roda a cada push em `main` **ou** `develop`:

```
push em main OU develop
        │
        ▼
GitHub Actions (job "build")
  ├─ checkout do branch main    → copiado para a RAIZ do site
  ├─ checkout do branch develop → copiado para /dev
  └─ monta _site/ (+ .nojekyll)
        │
        ▼
GitHub Actions (job "deploy") → GitHub Pages
        │
        ▼
www.cellcityinformatica.com.br  (main na raiz, develop em /dev)
```

Pontos de atenção:

- **Um push em qualquer branch republica os DOIS ambientes** (o workflow sempre monta raiz + `/dev` juntos). Isso é inofensivo quando o outro branch não mudou, mas significa que o deploy nunca é "só do dev".
- O deploy usa `concurrency: group pages` — um push novo **cancela** o deploy em andamento do anterior.
- O Firestore **não** participa desse fluxo: Rules e índices têm deploy próprio (seção 5).

---

## 3. Fluxo de trabalho padrão

1. **Desenvolver no branch `develop`** (nunca direto no `main`), seguindo as regras permanentes do projeto ([`CLAUDE.md`](CLAUDE.md)): backup antes de alterar arquivo crítico, um módulo por vez.
2. `git push origin develop` → aguardar o workflow do Pages concluir.
3. **Validar em `https://www.cellcityinformatica.com.br/dev/`** — checklist mínimo de regressão: Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente.
4. Somente após homologação/aprovação formal: **merge `develop` → `main`** e push.
5. Validar a produção na raiz do domínio.
6. Atualizar a documentação da entrega (TECHDOC + relatório no chat, conforme [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md)).

### Verificando o status de um deploy

- Aba **Actions** do repositório no GitHub, workflow "Deploy Pages (main + develop)".
- Ou via CLI: `gh run list --workflow deploy-pages.yml --limit 5`
- Confirmação final: abrir a URL do ambiente e conferir a mudança (com hard-reload — seção 6).

---

## 4. Seletor de ambiente na interface

O cabeçalho padrão ([`CRM/shared/brand-header.js`](CRM/shared/brand-header.js)) exibe um pill clicável com o ambiente atual e permite alternar entre eles (com confirmação):

- A detecção é **sempre pela URL** (`detectEnv()`: pathname começando com `/dev` = DEVELOP; caso contrário MAIN). Não há nenhuma constante hardcoded por branch — o mesmo código roda nos dois ambientes.
- ⚠️ Limitação conhecida: `localhost` e `file://` são detectados como **MAIN** pelo pill, e o backend usado é **sempre a produção** (enquanto não existir o `env-config.js` do plano de separação). Ver seção 7.

---

## 5. Operações no Firebase (backend)

### 5.1 Deploy de Firestore Rules / índices

A fonte oficial é **`CRM/firestore.rules`** e **`CRM/firestore.indexes.json`** (o `firebase.json` aponta para eles). Os arquivos `firestore.rules`/`firestore.indexes.json` da **raiz** estão desatualizados — não usar (dívida técnica registrada no [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) §5).

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 5.2 Verificação obrigatória pós-deploy de Rules (regra permanente)

O Console do Firebase **já confirmou "Publicar" sem efetivar o release** (incidente de 2026-07-01). Toda alteração de Rules deve ser confirmada consultando a API diretamente:

```bash
TOKEN=$(gcloud auth print-access-token)
# Release ativo:
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebaserules.googleapis.com/v1/projects/cellcity-crm/releases/cloud.firestore"
# Conteúdo do ruleset apontado pelo release:
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebaserules.googleapis.com/v1/<rulesetName retornado acima>"
```

Conferir que o `rulesetName` do release corresponde ao conteúdo recém-publicado — nunca confiar apenas na confirmação visual do Console.

### 5.3 O que NUNCA fazer

- ❌ `firebase deploy --only hosting` (ou deploy completo) — Hosting é proibido; a publicação é só via GitHub Pages.
- ❌ Alterar dados do Firestore de produção "para testar".
- ❌ Alterar Rules sem backup do arquivo anterior e sem verificação via API.
- ❌ Alterações de infraestrutura (projetos, planos de cobrança, provedores de Auth) sem autorização formal — **freeze de infraestrutura em vigor desde 2026-07-02**.

---

## 6. Service Worker e cache

O CRM tem Service Worker ([`CRM/sw.js`](CRM/sw.js), cache atual `cellcity-crm-v14`) que **cacheia JS/CSS/HTML**. Implicações operacionais:

- Mudanças em arquivos cacheados podem não aparecer imediatamente para usuários que já visitaram o site. Em mudanças relevantes de shell/scripts, **fazer bump da constante `CACHE`** no `sw.js` no mesmo commit.
- Para validar um deploy: usar **hard-reload** (Ctrl+Shift+R) e/ou aba anônima; em caso de dúvida, DevTools → Application → Service Workers → "Update"/"Unregister".
- MAIN e DEVELOP estão na **mesma origem** — o SW e o `localStorage` (`cc_kernel_v1`, `cc_acesso`, preferências etc.) são compartilhados entre `/` e `/dev`. Um logout/estado alterado num ambiente pode refletir no outro.

---

## 7. Desenvolvimento local

- Abrir os HTML via `file://` ou servidor local funciona, **mas conecta na produção** (`cellcity-crm`) — o config do Firebase é fixo no código hoje.
- Portanto: teste local = teste em produção, com as mesmas cautelas da seção 1.
- Ferramentas Node locais (`backup-dados.js`, `_runtime_audit/*.js`) usam `sa-key.json` (service account de produção, **gitignored** — conferir com `git status` que nunca aparece como novo arquivo). Node é via nvm (`~/.nvm/versions/node/`), não está no PATH padrão do sistema.
- Após a separação de ambientes, a regra fail-safe do `env-config.js` inverterá isso: localhost/file → DEV por padrão (ver plano, seção 3.2).

---

## 8. Rotinas automáticas em execução

| Rotina | Quando | O que faz |
|---|---|---|
| `cc-backup-dados.timer` (systemd de usuário) | Diário 23:00 | Roda `backup-dados.js` → exporta coleções do Firestore para JSON em `~/Músicas/backups/dados/` |
| `cc-backup-codigo.timer` (systemd de usuário) | Domingo 22:00 | Roda `~/Músicas/backup.sh` → ZIP do código em `~/Músicas/backups/` |
| Workflow Pages | A cada push | Republica os dois ambientes |

Logs das rotinas de backup: `~/Músicas/backups/cron.log` e `~/Músicas/backups/historico.log`.

> ⚠️ Limitação conhecida do `backup-dados.js`: a lista de coleções é **fixa (21 coleções)** e não inclui `usuarios`, `perfis_operacionais` e outras do RBAC — ver dívida técnica no [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) §5.

---

## 9. Cota do Firestore (situação operacional)

O projeto está no plano **Spark** (gratuito): 50.000 leituras/dia, com **bloqueio duro** ao estourar (todo o CRM fica sem dados até o reset diário ~04:00 BRT). Em 01/07 e 02/07 a cota estourou por amplificação de leitura do próprio CRM. Enquanto o upgrade para Blaze não for decidido:

- Evitar sessões longas com Dashboard aberto em múltiplas abas (auto-refresh consome cota).
- Evitar testes de carga/varreduras no DEVELOP (mesma cota da produção).
- Sintoma de cota estourada: telas vazias + erros `429 RESOURCE_EXHAUSTED` no console do navegador.
- Detalhes e recomendações: [`plans/RELATORIO_COTA_FIRESTORE_20260702.md`](plans/RELATORIO_COTA_FIRESTORE_20260702.md).

---

## 10. O que muda quando a separação de backend for implementada

O plano aprovado como necessidade (aguardando autorização de execução) cria o projeto `cellcity-crm-dev` e o seletor de config em runtime (`CRM/shared/env-config.js`). Quando isso acontecer:

- DEVELOP, localhost e file:// passarão a usar Auth/Firestore/Storage **do projeto DEV** — testes deixarão de tocar a produção.
- Este guia deverá ser atualizado (seções 1, 5, 7 e 9) como parte da Fase 6 do plano.
- Fases, riscos, checklist de validação e critérios de aceite: [`plans/SEPARACAO_AMBIENTES_DEV_PROD.md`](plans/SEPARACAO_AMBIENTES_DEV_PROD.md) (incluindo os adendos da auditoria de 2026-07-02).
