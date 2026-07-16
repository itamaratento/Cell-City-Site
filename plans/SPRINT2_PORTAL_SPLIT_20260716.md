# Portal do Cliente — Divisão por Responsabilidade (P2.2) — Relatório

**Data:** 2026-07-16
**Branch:** `develop`
**Escopo:** `CRM/pages/portal-cliente/` (portal.js + 8 arquivos-irmãos novos), `CRM/pages/portal-cliente/index.html`, `tests/integrity/integridade.test.mjs`

---

## Contexto

Esta frente (P2.2, rotulada no cabeçalho dos arquivos) já estava em andamento
quando esta sessão a encontrou: `portal.js` (2363 linhas) já havia sido
reduzido a um núcleo de 430 linhas (estado + boot + roteamento + dados da
loja + telefone + utilitários + logout), e 2 dos 8 arquivos-irmãos
planejados já existiam (`portal-auth.js`, `portal-painel.js`). Os outros 6
não existiam e `index.html` ainda carregava só `portal.js?v=2.6` — ou seja,
o Portal do Cliente (produção, tela do cliente final) estava **quebrado**
no working tree: login, OS, garantias, avaliação, mensagens, contato e
agendamento não tinham código nenhum carregado. Estado só local
(não commitado, não deployado) — sem impacto em produção, mas precisava ser
concluído ou revertido antes de qualquer commit.

## O que foi feito

Reconstruídos os 6 arquivos-irmãos restantes a partir do conteúdo original
de `portal.js` no HEAD (`git show HEAD:...`), mapeando cada seção
(`// ===== X =====`) para o arquivo correspondente:

| Arquivo | Conteúdo | Linhas |
|---------|----------|--------|
| `portal-os.js` (novo) | Lista de OS, detalhe da OS, orçamento (aprovar/recusar), status steps | 418 |
| `portal-garantias.js` (novo) | Minhas Garantias (vinculadas/ativas), `_emGarantia`, Nota Fiscal | 299 |
| `portal-avaliar.js` (novo) | Avaliação do atendimento (estrelas, Google) | 169 |
| `portal-mensagens.js` (novo) | Fale com a Cell City (histórico + envio) | 140 |
| `portal-contato.js` (novo) | Contato, Como Chegar, Solicitação de Diagnóstico | 235 |
| `portal-agendamento.js` (novo) | Horários disponíveis, Agendar Atendimento | 309 |
| `portal-auth.js` (já existia, corrigido) | Login + Listeners em tempo real — **faltavam `_carregarMensagens()` e `_carregarAgendamentos()`**, achados nesta verificação e adicionados de volta (conteúdo original, sem alteração de lógica) | 276 |
| `portal-painel.js` (já existia, intocado) | Painel principal + Buscar última avaliação | 156 |

`index.html` passou a carregar os 8 arquivos-irmãos logo após `portal.js`
(ordem não é significativa para `Object.assign`, mas segue a ordem de
navegação da tela).

## Verificação de completude

Todo membro de topo do objeto `window.Portal` original (88, incluindo
métodos `async`) foi conferido presente em exatamente um dos 9 arquivos
(núcleo + 8 irmãos) — nenhum perdido, nenhum duplicado. Divergência de
contagem de linhas (2432 novo vs. 2363 original) é só overhead de
cabeçalho/wrapper `Object.assign` dos 8 arquivos novos (~7 linhas cada).

## Achado colateral: suíte de integridade não era split-aware

`tests/integrity/integridade.test.mjs` (committed por outra frente, P2.2-C)
tem 5 testes estruturais sobre `portal.js` (auto-login, Nota Fiscal,
`_STATUS_SEM_GARANTIA`, etc.) que leem só `CRM/pages/portal-cliente/portal.js`
— escritos para o arquivo monolítico, sem saber da divisão. Com o núcleo
gutted, os 5 falhavam (conteúdo correto, só em outro arquivo). Corrigido
adicionando `readPortal()` (lê `portal.js` + todo `portal-*.js` do
diretório via `readdirSync`, não `git ls-files`, pra funcionar mesmo antes
do commit) e trocando os 5 `read('CRM/pages/portal-cliente/portal.js')`
por `readPortal()`. Preserva a intenção original dos testes (guardar contra
regressão das regras de negócio ali documentadas) sem depender de o código
estar num único arquivo.

## Concorrência observada durante o trabalho

Em pelo menos 2 momentos, arquivos não commitados desta sessão
(`CRM/shared/modulos.catalogo.json` uma vez, `CRM/pages/portal-cliente/portal.js`
uma vez — voltou às 2363 linhas originais) foram revertidos por um processo
externo (outra sessão de IA ativa na mesma árvore de trabalho, mesmo padrão
já registrado em memória — sessões concorrentes no checkout). Em ambos os
casos havia cópia de segurança em `/tmp` e o conteúdo foi restaurado sem
perda. Este relatório e o commit correspondente foram produzidos o mais
rápido possível após a última restauração para minimizar a janela de
conflito.

## Testes executados (estado final)

| Verificação | Resultado |
|-------------|-----------|
| `node --check` nos 9 arquivos (núcleo + 8 irmãos) | 🟢 OK |
| Cross-check de membros (88/88, incl. `async`) | 🟢 idêntico ao original, sem perdas/duplicatas |
| `npm run auditar-arquitetura` | 🟢 6/6 |
| `tests/integrity/integridade.test.mjs` | 🟢 14/14 (5 corrigidos por esta entrega — ver achado acima) |
| `tests/rbac` (`npm test`, 175 testes) | 🟢 173/175 — 2 falhas pré-existentes em `financeiro-relatorio.test.mjs`, não relacionadas (mesmas já registradas no relatório da F1.4) |
| `npm run testar-central-modulos` | 🟢 17/17 (catálogo regenerado) |

## Verificação em navegador real (Chrome headless, pós-commit)

Servida a página via `http-server` local e carregada em Chrome headless
(`puppeteer-core`, já devDependency do projeto):

- Página carrega sem `pageerror`/`console.error`/requisição falhada; os 8
  `Object.assign` executam e `window.Portal` fica com as 21 chaves
  amostradas (uma de cada arquivo) como `function`.
- Tela de login renderiza de fato (`renderLogin()` real, não mock) —
  `#app-content` mostra o card de telefone.
- Sessão + dados mockados em memória (sem rede/Firebase real): as 9 telas
  (`renderPainel`, `renderOSList`, `renderOSDetalhe`, `renderGarantias`,
  `renderAvaliar`, `renderMensagens`, `renderContato`, `renderComoChegar`,
  `renderAgendar`) foram chamadas diretamente — todas retornam HTML não
  vazio, nenhuma lança exceção.
- Regra de negócio protegida pelos testes de integridade exercida ao vivo
  (não só por regex): OS entregue com `garantiaId` aparece em Garantias
  (`_emGarantia` → `true`); OS com `orcamento_recusado` e o mesmo
  `garantiaId` não aparece (`_emGarantia` → `false`) — comportamento
  idêntico ao pré-split.

**Limite desta verificação:** sem Firebase real (rede/emulador), não cobre
autenticação de fato (`doLogin` → Cloud Function), listeners de polling
(`_fetchOS`/`_carregarMensagens`/`_carregarAgendamentos`) nem gravação
(aprovar orçamento, enviar mensagem/avaliação/agendamento). Recomenda-se
teste manual com telefone real antes de promover para produção.

## Não testado nesta entrega

- Fluxo funcional completo com Firebase real (login de cliente de fato,
  Cloud Functions, gravação no Firestore) — ver limite acima.
- `financeiro-relatorio.test.mjs` (2 falhas pré-existentes, fora de
  escopo) — mesma pendência já registrada em
  `plans/SPRINT1_F14_ADOCAO_PAGINAS_20260716.md`.

## Riscos

1. Reconstrução de ~1550 linhas de HTML/JS por extração de seções do
   arquivo original — mitigado pelo cross-check de membros (88/88) e pelos
   14/14 testes estruturais, mas não substitui teste funcional em
   navegador.
2. `admin.js` (`CRM/pages/portal-cliente/admin.js`) tem um diff de 1 linha
   (fim de arquivo sem newline) não relacionado a este split — não
   incluído neste commit, mesma decisão já tomada na F1.4.
