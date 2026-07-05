# Sprint 1b — Migração do Portal do Cliente para Cloud Functions

Status: **plano técnico, não implementado.** Não iniciar antes da conclusão formal da Sprint 1a (homologação + promoção a `main` autorizadas pelo dono do projeto).

## 1. Por que existe

A Sprint 1a fechou a exposição pública de `os/{osId}` migrando `garantia.html`/`consultar-os.html` para Cloud Functions com Admin SDK. As mesmas 7 funcionalidades do Portal do Cliente ainda dependem de acesso direto do cliente ao Firestore, protegido só por Firestore Rules — e essas Rules não conseguem distinguir "cliente anônimo legítimo" de "qualquer sessão anônima", porque o modelo de identidade do Portal (telefone + sessão anônima) não existe no `request.auth` do Firebase. Isso já causou um incidente real (ver `CRM/TECHDOC.md` §17 e o hotfix de 2026-07-05: `temAcessoLiberado()` bloqueou clientes anônimos legítimos nas 6 coleções abaixo, porque exige um doc `usuarios/{uid}` que sessão anônima nunca tem).

O hotfix de 2026-07-05 resolveu o sintoma (reverteu a condição para `request.auth != null`, sem checar perfil) mas reabriu a brecha original: uma conta `pendente` (staff autocadastrado, ainda não aprovado) volta a poder ler/escrever essas 6 coleções. Sprint 1b é o que fecha essa brecha **sem** quebrar o cliente anônimo de novo — a Rule deixa de precisar decidir isso, porque o cliente deixa de falar direto com o Firestore.

## 2. Escopo (7 itens, todos hoje em `CRM/pages/portal-cliente/portal.js` + `consultar-os.html` raiz)

| # | Funcionalidade | Coleção(ões) hoje | Operação atual |
|---|---|---|---|
| 1 | Mensagens | `mensagens_portal` | `addDoc` (enviar), `onSnapshot`/`updateDoc` (marcar lida) |
| 2 | Avaliações | `avaliacoes` | `getDocs` (listar próprias), `addDoc` (criar) |
| 3 | Agendamentos | `agendamentos` | `onSnapshot`/`getDocs` (listar), `addDoc` (criar) |
| 4 | Solicitações de diagnóstico | `solicitacoes_diagnostico` | `addDoc` (criar) |
| 5 | Eventos | `portal_eventos` | `addDoc` (registrar) |
| 6 | Aprovação de orçamento | `os/{osId}` | `updateDoc` (portal.js `_executarAprovacao` + `consultar-os.html` `responderOrcamentoConsulta`) |
| 7 | Recusa de orçamento | `os/{osId}` | `updateDoc` (portal.js `_executarRecusa` + `consultar-os.html`) |

## 3. Problema de identidade a resolver primeiro (bloqueia tudo o resto)

Hoje o "login" do cliente é: sessão anônima do Firebase Auth (`signInAnonymously`) + um registro de sessão local (`sessionStorage`/sistema próprio de `portal.js`) amarrado a `telefoneDigits`. Não existe custom claim, nem token assinado provando que aquela sessão anônima específica "é" aquele telefone — qualquer um que descubra/adivinhe um `telefoneDigits` de 11 dígitos pode consultar os dados daquele telefone (mesmo modelo de confiança que `consultarOSPorTelefonePublica` já usa hoje, aceito na Sprint 1a). As novas Cloud Functions devem manter **o mesmo nível de confiança** (telefone como "senha fraca", não pior nem melhor que hoje) — não é escopo desta sprint inventar um mecanismo de posse de telefone (SMS OTP etc.), isso é uma decisão de produto separada.

## 4. Desenho proposto (mesmo padrão da Sprint 1a: `functions/index.js`, Admin SDK, `onCall`, região `southamerica-east1`)

Funções novas (nomes provisórios):

- `portalListarMensagens({ phoneDigits })` / `portalEnviarMensagem({ phoneDigits, texto })` / `portalMarcarMensagemLida({ phoneDigits, msgId })`
- `portalListarAvaliacoes({ phoneDigits })` / `portalCriarAvaliacao({ phoneDigits, nota, comentario })`
- `portalListarAgendamentos({ phoneDigits })` / `portalCriarAgendamento({ phoneDigits, ... })`
- `portalCriarSolicitacaoDiagnostico({ phoneDigits, ... })`
- `portalRegistrarEvento({ phoneDigits, tipo, ... })`
- `portalResponderOrcamento({ osId, phoneDigits, resposta })` — substitui as 4 implementações atuais (2 em `portal.js`, 2 em `consultar-os.html`) por uma função só; valida server-side que `phoneDigits` bate com `os.phoneDigits` antes de aceitar a resposta (proteção que hoje não existe: qualquer sessão anônima aprovava/recusava qualquer OS).

Cada função:
1. Valida `request.data` (tipos, tamanho, formato de telefone via `normalizePhoneDigitsServer`, já existente em `functions/index.js`).
2. Não confia em `request.auth` para identidade — usa só `phoneDigits` do payload, igual ao padrão já aceito em `consultarOSPorTelefonePublica`.
3. Aplica whitelist de campos na resposta (mesmo padrão de `OS_CAMPOS_PUBLICOS`/`projetarCamposPublicosOS`), evitando devolver campos internos.
4. Escreve/lê via Admin SDK, ignorando Firestore Rules — as Rules dessas 6 coleções voltam a ficar fechadas para acesso direto de fora.

## 5. Rules — estado final (depois da migração)

Depois que o client code das 7 funcionalidades usar só as novas Functions, as 6 coleções (`os` — só a parte `list/create/update/delete`, `avaliacoes`, `mensagens_portal`, `portal_eventos`, `agendamentos`, `solicitacoes_diagnostico`) podem voltar a exigir `temAcessoLiberado()` (ou até ficar `if false` para tudo que não for `get` de doc já coberto por Function), fechando de vez a brecha que o hotfix de 2026-07-05 reabriu deliberadamente — sem repetir o erro de bloquear cliente anônimo, porque ele deixa de tocar o Firestore direto.

## 6. Ordem de execução (mesma disciplina da Sprint 1a — 1 módulo por vez, nada pula etapa)

1. Escrever as 7 Cloud Functions em `functions/index.js`.
2. Escrever/estender testes (Rules-unit-testing para o estado final das 6 coleções; testes de unidade das Functions, ex. `firebase-functions-test` ou chamada direta simulando payloads válidos/inválidos).
3. Rodar suíte de testes local (emulador) — 0 falhas antes de seguir.
4. Deploy das Functions em `cellcity-crm-dev` (não mexe em Rules ainda).
5. Migrar `portal.js` + `consultar-os.html` (raiz) para chamar as novas Functions em vez de Firestore direto.
6. Homologar em `/dev` as 7 funcionalidades + regressão das telas já cobertas pela Sprint 1a (mesmo método: Chrome headless real + captura de Network, confirmando que não sobra nenhuma leitura/escrita direta de cliente anônimo nessas 6 coleções).
7. Deploy das Rules fechadas em `cellcity-crm-dev`, verificado via API (`firebaserules.googleapis.com`), não só pela CLI.
8. Push para `origin/develop`, confirmar `/dev` funcionando ao vivo.
9. Só então pedir autorização para promover a `main` — nessa promoção, o hotfix de 2026-07-05 é substituído pelo fechamento definitivo das 6 coleções.

## 7. Riscos e pontos em aberto para decisão do dono do projeto

- **Abuso/spam**: como essas Functions aceitam `phoneDigits` sem prova de posse, alguém pode automatizar criação de avaliações/mensagens/agendamentos falsos em nome de qualquer telefone. Hoje esse risco já existe (Firestore Rules também não provam posse), então não é uma regressão — mas migrar para Functions é o momento natural de decidir se vale adicionar rate-limiting (ex. App Check, ou limite por IP/telefone) — **decisão de produto, fora do escopo mecânico desta migração**.
- **Custo**: mais 10 invocações de Cloud Functions por interação típica do cliente no Portal (hoje é leitura/escrita direta, "grátis" em termos de Functions). Dentro do padrão já aceito na Sprint 1a (TECHDOC §13), mas vale mencionar já que o projeto tem histórico de estouro de cota (memória do projeto).
- **`consultar-os.html` tem 3 cópias** (raiz, e os specificados no diff da Sprint 1a) — confirmar se as 3 devem migrar juntas ou se alguma é órfã antes de tocar.
