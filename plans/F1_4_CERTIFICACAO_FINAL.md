# F1.4 — Certificação Técnica Final

**Data:** 2026-07-16
**Papel:** Revisão Técnica (`CLAUDE.md` §0 / `ENGINEERING.md`)
**Branch:** `develop` (sem push, sem deploy)
**Escopo certificado:**
1. Sprint 1 F1.4 — adoção de `app-config.js` em 20 módulos de página (`fe412c5`)
2. Portal do Cliente — conclusão da divisão em 8 arquivos-irmãos (`c8e4235`, `08c8f3f`)

**Fora de escopo** (auditados e fechados por outras frentes, não reabertos aqui):
P2.2-B/C/D (infraestrutura `shared/`/`scripts/`/`tests/`, `1ff6f1e`/`2e2890b`/`721095d`) e Sprint 3 Onboarding SaaS (`0c3bb81`) — ambos commitados por sessões concorrentes na mesma árvore de trabalho durante esta certificação.

---

## Resumo Executivo

Os dois entregáveis da F1.4 estão **corretos e completos**. A certificação encontrou e corrigiu **1 defeito real** (import morto introduzido pela própria migração F1.4, em 18 dos 20 arquivos) e não encontrou nenhum problema estrutural, de arquitetura, segurança ou regressão nos dois entregáveis. Todas as suítes automatizadas relevantes passam; o Portal do Cliente foi exercido em Chrome headless real (login, as 8 telas de navegação via `Portal.navegar()`, e verificação estrutural do logout).

**Nota sobre nomenclatura:** a missão desta certificação lista `portal-login.js` e `portal-avaliacao.js` entre os arquivos a auditar. Esses nomes não existem — os arquivos reais são `portal-auth.js` (login + listeners) e `portal-avaliar.js` (avaliação), nomes definidos no cabeçalho do próprio `portal.js` por quem iniciou a divisão (frente externa a esta sessão, antes da F1.4). Tratado como divergência de nomenclatura na missão, não como módulo faltante — os 8 arquivos-irmãos cobrem 100% do conteúdo original (ver Fase 2).

---

## Arquivos Analisados

- 20 módulos de página (`CRM/pages/{acaodasemana,auditoria,autoatendimento,caixa,campanhas,central-alertas,central-comandos,central-informacoes,chat,compras,crm-comercial(×4),diario,estoque,financeiro,fornecedor,importar,os}`)
- `CRM/pages/portal-cliente/` — `portal.js` (núcleo) + 8 arquivos-irmãos + `index.html` + `admin.js` (não tocado)
- `CRM/shared/app-config.js` (leitura — fonte da verdade para `STORAGE_KEYS`/`URLS`/`COLECOES`/`FLAGS`/`devPrefix`)
- `CRM/shared/{theme,sidebar,brand-header,dock,favoritos}.js` (leitura — consumidores clássicos/ESM de `app-config.js`)
- `tests/integrity/integridade.test.mjs`, `tests/rbac/*`, `tests/infra/app-config-estabilizacao.test.mjs`
- `CRM/TECHDOC.md`, `PROXIMA_ETAPA.md`, `CRM/ARQUITETURA.md`

## Arquivos Alterados Nesta Certificação

| Arquivo | Alteração |
|---|---|
| 18 dos 20 módulos de página (ver Fase 1) | Import de `app-config.js` reduzido aos símbolos realmente usados (remove `devPrefix`/`STORAGE_KEYS`/`URLS` não referenciados) |
| `plans/F1_4_CERTIFICACAO_FINAL.md` (este arquivo) | Novo |
| `CRM/TECHDOC.md` | +1 seção (§44) registrando esta certificação |

Nenhum outro arquivo alterado. `crm-comercial/crm.js` e `os/os.js` já estavam corretos (usam os 3 símbolos importados) e não precisaram de mudança.

---

## Fase 1 — Auditoria da migração app-config.js

**STORAGE_KEYS / URLS / COLECOES / FLAGS / devPrefix / window.CC_CONFIG:** infraestrutura em `CRM/shared/app-config.js` íntegra — 0 valores duplicados entre as 44 chaves de `STORAGE_KEYS`, 0 chaves órfãs (todas com pelo menos 1 consumidor real, incluindo as 3 `PT_*` registradas como preparação pela P2.2-D). `window.CC_CONFIG` expõe a ponte completa para os 3 scripts clássicos (`theme.js`, `sidebar.js`, `brand-header.js`), cada um com fallback literal idêntico ao valor centralizado.

**🟡 MÉDIO — Import morto introduzido pela própria F1.4 (corrigido).** A migração das 20 páginas usou um padrão uniforme (`import { URLS, devPrefix, STORAGE_KEYS }`) sem verificar, por arquivo, quais símbolos o código de fato passou a usar. Resultado: 18 dos 20 arquivos importavam 1 ou 2 símbolos nunca referenciados no resto do arquivo (ex.: `acaodasemana.js` importava `devPrefix` e `STORAGE_KEYS` mas só usa `URLS`). Não é um bug funcional (imports não usados não quebram nada em runtime), mas é ruído que reduz a clareza do que cada módulo realmente depende. **Corrigido nesta certificação** — cada import foi ajustado para conter exatamente os símbolos usados, verificado por contagem de ocorrências por arquivo e reconfirmado por `node --check` + zero import não usado remanescente.

Nenhum literal `'cc_...'` nem detecção `/dev` inline remanescente nas 20 páginas — migração funcionalmente completa.

## Fase 2 — Auditoria do Portal do Cliente

**Módulos perdidos/duplicados:** cross-check dos 88 membros de topo do objeto `window.Portal` original (incluindo `async`) contra a soma dos 9 arquivos atuais (núcleo + 8 irmãos) — **88/88 idênticos**, nenhum perdido, nenhum duplicado. Falso positivo descartado manualmente: a chave `outro` aparece 2x em `portal.js`, mas são 2 constantes locais independentes (`AGENDAMENTO_TIPO_EQUIP`/`AGENDAMENTO_MOTIVO`), não uma colisão de método no objeto `Portal`.

**Imports quebrados:** N/A no sentido ESM — os 8 arquivos são scripts clássicos (`Object.assign(window.Portal, {...})`), carregados via `<script src>` sequencial em `index.html`. `npm run auditar-arquitetura` (que também varre `<script type="module">` inline de `.html`) reporta 🟢 6/6, 0 imports quebrados em todo o client.

**Funções órfãs:** varredura de todos os 88 membros contra o texto completo de núcleo + 8 irmãos + `admin.js` + `os.js` + `index.html` — nenhum membro aparece só na própria linha de definição (todos têm pelo menos 1 call-site).

**Dependência circular / ordem de carga:** os 8 arquivos-irmãos só definem métodos e 2 propriedades estáticas (`STATUS_ORDER`, `_ratingSelected`, `_STATUS_SEM_GARANTIA`) — nenhum lê `window.Portal.*` no momento da própria definição (só dentro de corpos de função, que só executam depois que todo `<script>` já rodou). `index.html` carrega `portal.js` primeiro, os 8 irmãos em seguida, e o `AUTO-INIT` do núcleo só dispara em `DOMContentLoaded` — que só ocorre depois que todo `<script>` síncrono já executou. Sem race de carregamento possível pela própria semântica de parsing do HTML.

---

## Fase 3 — Smoke Tests em Chrome Headless

Servido via `http-server` local, carregado em Chrome headless real (`puppeteer-core`, devDependency já presente).

| Fluxo | Resultado |
|---|---|
| Carregamento da página | 🟢 sem `pageerror`/`console.error`/requisição falhada |
| Login (`renderLogin()` real) | 🟢 card de telefone renderiza |
| Painel (`Portal.navegar('painel')`) | 🟢 |
| OS (`Portal.navegar('os')`) | 🟢 |
| Garantias (`Portal.navegar('garantias')`) | 🟢 |
| Contato (`Portal.navegar('contato')`) | 🟢 |
| Mensagens (`Portal.navegar('mensagens')`) | 🟢 |
| Avaliação (`Portal.navegar('avaliar')`) | 🟢 |
| Agendamento (`Portal.navegar('agendar')`) | 🟢 |
| Como Chegar (`Portal.navegar('como-chegar')`) | 🟢 |
| Logout | 🟢 verificado estruturalmente (ver nota) |

**Nota sobre Logout:** a execução ao vivo trava o Chrome headless porque `logout()` chama `confirm()` nativo (diálogo bloqueante sem handler registrado no harness) — não é um defeito, é uma limitação do ambiente de teste. Verificado por leitura de código: `confirm()` de saída → `unsubscribeOS()` (limpa o poller de 60s) → zera `session`/`currentOS`/`currentMsgs`/`currentAgendamentos` → `sessionStorage.removeItem('portal_session')` → `location.hash = '#/login'`. Comportamento idêntico ao pré-split (função não tocada pela divisão, vive inteira no núcleo).

Regra de negócio crítica (exclusão de garantia por orçamento recusado) exercida ao vivo com dados mockados: OS entregue com `garantiaId` → `_emGarantia() = true` (aparece); OS com `orcamento_recusado` e o mesmo `garantiaId` → `_emGarantia() = false` (não aparece) — idêntico ao comportamento pré-split.

**Limite:** sem Firebase real (rede/emulador) — não cobre autenticação de fato, Cloud Functions, nem gravação. Ver `plans/SPRINT2_PORTAL_SPLIT_20260716.md` para o mesmo limite já registrado.

## Fase 4 — Suítes Automatizadas

| Suíte | Resultado |
|---|---|
| `npm run auditar-arquitetura` | 🟢 6/6 |
| `node --check` (20 páginas + núcleo + 8 irmãos do Portal) | 🟢 OK em todos |
| `tests/integrity/integridade.test.mjs` | 🟢 14/14 |
| `tests/rbac` (`npm test`, 175 testes) | 🟢 173/175 — 2 falhas pré-existentes em `financeiro-relatorio.test.mjs`, reproduzidas no HEAD sem qualquer mudança da F1.4/split (verificado por substituição temporária do arquivo antes de qualquer edição, sessão anterior) |
| `npm run validar-infra-app-config` | 🟢 12/12 |
| `npm run testar-central-modulos` | 🟢 17/17 |

## Fase 5 — Código Morto, Listeners, Memory Leaks, Race Conditions

- **Imports mortos:** 1 achado (ver Fase 1), corrigido.
- **Exports mortos:** nenhum introduzido pela F1.4/split — auditoria de `shared/` já fechada pela P2.2-D (fora de escopo desta certificação, não reaberta).
- **Listeners duplicados:** `_listenOS()` tem 2 call-sites (boot com sessão restaurada, e pós-login) — comportamento pré-existente, protegido por guarda (`if (this.unsubscribeOS) this.unsubscribeOS()` antes de criar novo `setInterval`), preservado verbatim pela divisão. `addEventListener` em `renderLogin()`/`renderAgendar()` são recriados a cada render junto com o elemento DOM pai (`innerHTML` substituído) — sem acúmulo.
- **Memory leaks:** nenhum novo. O poller de 60s (`setInterval` em `_listenOS`) não é interrompido ao trocar de tela (SPA sem unmount real) — comportamento documentado e deliberado no código original (comentário: "custo de leitura menor que o listener"), não uma regressão desta entrega.
- **Race conditions:** nenhuma nova. As race conditions já documentadas no código (`_checkAvaliacaoExistente()` fire-and-forget, refs de DOM cacheadas antes de `await` em `enviarMensagem()`/`_enviarAgendamento()`) são comportamento pré-existente, movido verbatim para os arquivos-irmãos — mesmo texto de comentário explicando cada uma.
- **Regressões:** nenhuma detectada — todas as suítes que cobriam o comportamento pré-split continuam verdes (após o ajuste em `readPortal()`, já commitado em `08c8f3f`, que tornou a suíte de integridade ciente da divisão).

---

## Riscos

| Risco | Severidade | Detalhe |
|---|---|---|
| Sem teste funcional com Firebase real no Portal | 🟡 MÉDIO | Login de cliente de fato, Cloud Functions e gravação não exercidos (mock apenas) — recomenda-se teste manual com telefone real antes de promover a produção |
| 2 falhas pré-existentes em `financeiro-relatorio.test.mjs` | 🟢 BAIXO | Não relacionadas a esta entrega, não corrigidas (fora de escopo), candidatas a `known-issues.json` |
| `admin.js` com diff de 1 linha (newline final) não relacionado | 🟢 BAIXO | Não incluído em nenhum commit desta ou de entregas anteriores — inofensivo |
| `modulos.catalogo.json` — dependência de regeneração manual | 🟢 BAIXO | Já regenerado e commitado em `c8e4235`; nenhuma ação pendente |

## Pendências (não bloqueantes)

- Teste funcional do Portal com Firebase real (ver Riscos).
- `financeiro-relatorio.test.mjs` (2 falhas pré-existentes) — registrar em `scripts/homologacao/known-issues.json` ou corrigir em item separado.

## Compatibilidade

- Nenhuma alteração de RBAC, Firestore Rules, Cloud Functions, arquitetura de auth/kernel, ou infraestrutura.
- Nenhum arquivo protegido (`firebase.js`, `auth.js`, `config.js`, `global.css`) tocado.
- `ARQUITETURA.md` §6 ainda descreve `portal.js` como script clássico único que "consome via `window.*`" — continua tecnicamente verdadeiro (o núcleo ainda é o ponto de entrada clássico), mas não menciona os 8 irmãos. Não corrigido nesta certificação por estar fora do escopo direto da F1.4 (é doc de arquitetura, não de página) — sinalizado como pendência de documentação para quem fechar a frente do Portal formalmente.

---

## Classificação dos Achados

| # | Achado | Severidade | Status |
|---|---|---|---|
| 1 | Imports mortos em 18/20 páginas migradas (F1.4) | 🟡 MÉDIO | ✅ Corrigido nesta certificação |
| 2 | `ARQUITETURA.md` §6 não menciona os 8 arquivos-irmãos do Portal | 🟢 BAIXO | ⏳ Pendência de documentação, não bloqueante |
| 3 | 2 falhas pré-existentes em `financeiro-relatorio.test.mjs` | 🟢 BAIXO | ⏳ Fora de escopo, já registrado em relatórios anteriores |
| 4 | Sem teste funcional com Firebase real no Portal | 🟡 MÉDIO | ⏳ Recomendado antes de produção, não bloqueante para integração em `develop` |

Nenhum achado 🔴 CRÍTICO ou 🟠 ALTO.

---

## DECISÃO FINAL

# ✅ APROVADO PARA INTEGRAÇÃO

Ambos os entregáveis (F1.4 e divisão do Portal do Cliente) estão corretos, completos e sem regressão. O único defeito real encontrado (imports mortos) foi corrigido nesta própria certificação. As pendências remanescentes são de baixo/médio risco, não bloqueantes, e já estão documentadas para acompanhamento — nenhuma delas justifica reprovar ou condicionar a integração em `develop`.
