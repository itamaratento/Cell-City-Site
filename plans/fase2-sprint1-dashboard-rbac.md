# PLANEJAMENTO TÉCNICO — FASE 2 | SPRINT 1 (DASHBOARD)

> **Natureza deste documento:** planejamento técnico. Nenhum código, banco de dados ou Firestore Rules foi alterado na sua elaboração.
> Depende do [`MASTER_ROADMAP.md`](../MASTER_ROADMAP.md) (Fase 2 — Integração Gradual do RBAC) já aprovado.
> Este documento precisa ser formalmente aprovado antes de qualquer implementação da Sprint 1.

---

## Nota preliminar — achado durante o levantamento

Antes deste planejamento, foi identificado que `CRM/pages/dashboard/dashboard.js` já continha, no arquivo ao vivo, um protótipo de integração RBAC implementado em 2026-07-01 (fora deste processo formal, sem `shared/permissoes.js`, sem homologação registrada). A pedido do usuário, esse código foi **revertido** para o estado anterior (idêntico ao backup `CRM/pages/dashboard/BACKUP_RBAC_DASHBOARD_2026-07-01/dashboard.js`), preservando a versão ad-hoc em `dashboard.js.backup-antes-revert-RBAC-adhoc-2026-07-01` apenas como referência. Este planejamento parte do estado limpo (pré-RBAC).

---

## 1. Objetivo da Sprint

Aplicar a matriz de permissões de `perfis_operacionais` (construída na Fase 1) ao Dashboard, ocultando cards de módulos do grid principal para perfis operacionais sem permissão de `visualizar`. É o **sprint piloto** da Fase 2: valida o padrão de integração (via `shared/permissoes.js`, novo) que os Sprints 2-5 vão reutilizar.

Entrega concreta: usuário logado com um perfil operacional que tenha `visualizar: false` em um módulo mapeado não vê mais o card correspondente no grid do Dashboard. Usuário sem perfil operacional atribuído, ou com perfil legado `admin`/`master_admin`, continua vendo tudo (comportamento atual, inalterado).

## 2. Escopo

**Entra:**
- Criação de `CRM/shared/permissoes.js` (módulo novo e isolado).
- Leitura de `visualizar` da matriz de `perfis_operacionais` aplicada exclusivamente à seção "MÓDULOS" do grid do Dashboard (`dashboard.js`, seção em torno da linha 1488).
- Ocultação (`display:none`) dos cards cujo módulo mapeado tenha `visualizar === false`.
- Fail-open explícito: qualquer ausência de dado, erro de leitura, ou usuário não migrado (`perfil_operacional_id` vazio) resulta em **mostrar tudo**, nunca ocultar por engano.

**NÃO entra (scope creep a evitar):**
- Ações de `criar`/`editar`/`excluir`/`aprovar` — o Dashboard não tem esses verbos, é só um grid de acesso.
- Qualquer outro módulo (CRM, Agenda, Estoque, Caixa, Financeiro, OS) — isso é Sprints 2-5.
- Alteração de Firestore Rules (não é necessária — ver seção 4).
- Expansão da matriz de `perfis_operacionais` para cobrir os módulos que hoje não têm entrada nela (ver seção 3) — isso é trabalho de Fase 3/4, registrado como pendência, não deste sprint.
- Qualquer redesenho visual do grid ou dos cards.
- Alteração de `kernel.js`, `firebase.js`, `login.html` (arquivos protegidos por CLAUDE.md).

## 3. Levantamento técnico

**Arquivos do Dashboard:**
- `CRM/pages/dashboard/dashboard.js` — 2966 linhas. Estrutura: um único `async function _bootDashboard()` chamado após `initModulo()` resolver, contendo ~30 seções internas marcadas por comentários (`// ===== ... =====`): relógio/data, fechamento automático de caixa, bloco de notas, meta semanal, autoatendimento, alerta de diário, agenda inteligente (parsing de horários das notas), alertas/dicas rotativas, mini calendário, busca global, botão de atualização, **seção "MÓDULOS" (linha 1488)** — renderização/interação do grid de cards —, ferramentas da dock lateral, aviso de eventos da agenda, configuração de alertas, alarme de OS nova, cliques fora, atalhos, modal de lista de OS, reordenação da sidebar esquerda.
- `CRM/pages/dashboard/index.html` — 1306 linhas. Contém 21 cards com atributo `data-module`: `auditoria`, `autoatendimento`, `caixa`, `catalogo`, `central-alertas`, `central-comandos`, `central-informacoes`, `central-organizacao`, `clientes`, `compras`, `contas`, `crm-comercial`, `diario`, `estoque`, `financeiro`, `fornecedor`, `impressora`, `os`, `portal-cliente`, `portal-tecnico`, `pos-venda`, `relatorios`.
- `CRM/pages/dashboard/dashboard.css` — sem necessidade de alteração prevista (ocultação via `style.display` inline, já é o padrão usado em outras partes do arquivo).

**Dependências diretas do dashboard.js:** `CRM/scripts/kernel.js` (`initModulo`), `CRM/scripts/firebase.js` (`db`, `doc`, `getDoc`, `setDoc`, `collection`, `getDocs`, `onSnapshot`, `query`, `where`, `orderBy`, `limit`).

**kernel.js (`CRM/scripts/kernel.js`, 252 linhas) — API relevante:**
- `initModulo()` → `Promise<ctx|null>`, `ctx = { user, uid, email, nome, empresaId, perfil }`. **Não inclui** `perfil_operacional_id` — precisa ser lido à parte de `usuarios/{uid}`.
- `getPerfil()`, `getUid()`, `temPermissao(perfilMinimo)` — nível hierárquico do kernel (`master_admin/admin/gerente/tecnico/atendente`), não tem relação com a matriz de `perfis_operacionais`.
- **Correção ao Master Roadmap:** o documento cita `shared/modulo-guard.js` como componente crítico da Fase 2/3, mas `initModulo()` hoje vive diretamente em `CRM/scripts/kernel.js` — `shared/modulo-guard.js` não existe no código ao vivo (só em snapshots de `_BACKUPS/`). Ver recomendação 1.

**Matriz de permissões (`CRM/pages/usuarios-permissoes/usuarios-permissoes.js`):**
- 9 módulos mapeados: `dashboard`, `os`, `caixa`, `estoque`, `financeiro`, `crm`, `agenda`, `relatorios`, `configuracoes`.
- Cada perfil (`perfis_operacionais/{id}.permissoes`) tem, por módulo: `{ visualizar, criar, editar, excluir, aprovar }`.
- 7 perfis seed já existem: Administrador (tudo `true`), Financeiro, Caixa, Estoque, Técnico, Comercial, Atendimento.

**Correspondência entre cards do Dashboard e módulos da matriz:**
| data-module (Dashboard) | moduloId (matriz) | Coberto pela matriz? |
|---|---|---|
| `os` | `os` | ✅ |
| `caixa` | `caixa` | ✅ |
| `estoque` | `estoque` | ✅ |
| `financeiro` | `financeiro` | ✅ |
| `crm-comercial` | `crm` | ✅ |
| `relatorios` | `relatorios` | ✅ |
| `auditoria`, `autoatendimento`, `catalogo`, `central-alertas`, `central-comandos`, `central-informacoes`, `central-organizacao`, `clientes`, `compras`, `contas`, `diario`, `fornecedor`, `impressora`, `portal-cliente`, `portal-tecnico`, `pos-venda` | — | ❌ (sem entrada na matriz hoje) |

Ou seja: **apenas 6 dos 21 cards** podem ser gateados nesta sprint com os dados que já existem. Os outros 15 permanecem sempre visíveis — não é regressão, é o limite real dos dados disponíveis hoje (expandir a matriz é decisão de escopo de fase futura, não deste sprint).

## 4. Integração RBAC

| Card (data-module) | moduloId | Ação verificada | Tipo | Impacto se `visualizar: false` |
|---|---|---|---|---|
| `os` | `os` | visualizar | leitura | Card "OS" oculto do grid |
| `caixa` | `caixa` | visualizar | leitura | Card "Caixa" oculto do grid |
| `estoque` | `estoque` | visualizar | leitura | Card "Estoque" oculto do grid |
| `financeiro` | `financeiro` | visualizar | leitura | Card "Financeiro" oculto do grid |
| `crm-comercial` | `crm` | visualizar | leitura | Card "CRM" oculto do grid |
| `relatorios` | `relatorios` | visualizar | leitura | Card "Relatórios" oculto do grid |

**Firestore Rules — nenhuma alteração necessária.** Verificado em `CRM/firestore.rules` (arquivo efetivamente deployado, referenciado por `firebase.json` → `"rules": "CRM/firestore.rules"`):
- `match /perfis_operacionais/{perfilId} { allow read: if request.auth != null; ... }` — leitura já liberada a qualquer autenticado.
- `match /usuarios/{uid} { allow read, write: if ... request.auth.uid == uid || ...admin/master_admin }` — cada usuário já pode ler o próprio documento (necessário para obter `perfil_operacional_id`).

Ambas as leituras que este sprint precisa já são permitidas pelas regras atuais.

## 5. shared/permissoes.js

**Responsabilidades:** único ponto de leitura e verificação da matriz de `perfis_operacionais` para o usuário atual. Não é um mecanismo de segurança (isso continua sendo Firestore Rules) — é controle de exibição de UI, para os módulos decidirem o que mostrar.

**API pública proposta (sem implementação nesta etapa):**
- `async function carregarPermissoes(ctx)` → `Promise<Object|null>`. Recebe o `ctx` retornado por `initModulo()`. Resolve uma vez; resultado fica em cache de módulo (memória, não `localStorage` — dado de permissão não deve persistir entre sessões).
- `function podeVisualizar(moduloId)` → `boolean`. Síncrona, usável após `carregarPermissoes()` resolver. `true` se não houver matriz carregada (fail-open) ou se `permissoes[moduloId].visualizar !== false`.
- `function podeCriar(moduloId)`, `podeEditar(moduloId)`, `podeExcluir(moduloId)`, `podeAprovar(moduloId)` — mesma forma, já definidas na API desde a Sprint 1 (não implementadas/usadas ainda) para que os Sprints 2-5 reutilizem a mesma superfície sem precisar redesenhar o módulo.
- `function getMatrizAtual()` → objeto bruto ou `null`, só para diagnóstico.

**Fluxo de carregamento:** chamada única, logo após `initModulo()` resolver — mesmo padrão de sequenciamento já usado pelo restante do kernel. Internamente: se `ctx.perfil` for `admin` ou `master_admin` → `null` (sem restrição, igual ao comportamento hoje); senão lê `usuarios/{uid}.perfil_operacional_id`; se vazio → `null` (usuário ainda não migrado ao RBAC novo); senão lê `perfis_operacionais/{id}.permissoes` e retorna.

**Cache:** em memória, válido durante o tempo de vida da página (reload = releitura). Evita múltiplas leituras de rede quando o mesmo módulo chama `podeVisualizar()` várias vezes (o grid do Dashboard chamaria isso 6 vezes numa única renderização).

**Fallback:** qualquer falha (erro de rede, documento inexistente, permissão negada) → fail-open (retorna `null`/mostra tudo). Nunca fail-closed — mesmo princípio já usado no protótipo ad-hoc revertido e coerente com a filosofia da Fase 1 (nunca bloquear indevidamente por matriz incompleta).

**Integração com kernel.js:** `shared/permissoes.js` apenas consome a API pública já existente do kernel (recebe `ctx` explicitamente ou usa `getUid()`/`getPerfil()`) — não altera `kernel.js`, não adiciona `onAuthStateChanged` extra, seguindo o mesmo isolamento que `usuarios-permissoes.js` já pratica.

## 6. Arquivos

**Serão modificados:**
- `CRM/shared/permissoes.js` — **novo arquivo**.
- `CRM/pages/dashboard/dashboard.js` — import de `shared/permissoes.js`, chamada de `carregarPermissoes(ctx)` logo após `initModulo()`, aplicação de `podeVisualizar(moduloId)` só na seção "MÓDULOS" (linha ~1488-1498).

**Não poderão ser alterados:**
- `CRM/scripts/kernel.js`, `CRM/scripts/firebase.js`, `CRM/login.html` — protegidos por CLAUDE.md.
- `CRM/firestore.rules` — não é necessário (seção 4).
- `CRM/pages/dashboard/index.html`, `dashboard.css` — não deveria ser necessário (ocultação via `style.display` inline).
- `CRM/pages/usuarios-permissoes/*` — fonte da matriz, não faz parte da integração.
- Qualquer outro módulo de negócio (CRM, Agenda, Estoque, Caixa, Financeiro, OS) — fora do escopo deste sprint.

## 7. Riscos

| Alteração | Risco | Motivo |
|---|---|---|
| Criar `shared/permissoes.js` | **Baixo** | Arquivo novo e isolado; não modifica nada existente. |
| Importar e chamar em `dashboard.js` | **Médio** | Toca o módulo mais usado do sistema (tela de entrada de todo usuário); erro de posicionamento na sequência do `_bootDashboard()` pode atrasar ou quebrar o boot do grid. |
| Leitura extra de `usuarios/{uid}` e `perfis_operacionais/{id}` no boot do Dashboard | **Baixo** | Rules já permitem; mas é mais uma leitura de rede no módulo de maior tráfego — mesma classe de risco do bug de condição de corrida já registrado na Fase 1 (coluna "Perfil" travada em "—"). |
| Firestore Rules | **Não aplicável** | Nenhuma alteração prevista neste sprint. |

## 8. Estratégia de implementação

1. Criar `shared/permissoes.js` isolado, sem tocar em `dashboard.js`. Testar contra dados reais de `perfis_operacionais` (ex.: via página de diagnóstico `kernel-test`, que já existe no projeto).
2. Backup de `dashboard.js` antes de qualquer edição (convenção já usada no projeto: `dashboard.js.backup-<motivo>-<data>`).
3. Importar `shared/permissoes.js` em `dashboard.js`; chamar `carregarPermissoes(ctx)` logo após `initModulo()` resolver, antes da seção "MÓDULOS" renderizar.
4. Aplicar `podeVisualizar(moduloId)` apenas nos 6 cards mapeados (seção 4); os outros 15 permanecem sempre visíveis.
5. Testar com os 7 perfis seed + um usuário sem `perfil_operacional_id` (fail-open esperado) + um usuário com perfil legado `admin`.

## 9. Estratégia de rollback

Backup de `dashboard.js` tirado antes do passo 3 (acima) é o ponto de retorno. Qualquer regressão detectada na homologação (card sumindo para quem deveria ver, aparecendo indevidamente, ou erro de console no boot do Dashboard) interrompe o sprint e reverte `dashboard.js` para o backup imediatamente anterior — nunca "corrigir em produção". Como `shared/permissoes.js` é um arquivo novo e isolado, seu rollback é apenas removê-lo e reverter o import em `dashboard.js`.

## 10. Estratégia de homologação

Checklist obrigatório antes da aprovação formal:
- [ ] Login com cada um dos 7 perfis seed (Administrador, Financeiro, Caixa, Estoque, Técnico, Comercial, Atendimento): cards visíveis batem exatamente com a matriz `permissoes` daquele perfil.
- [ ] Usuário sem `perfil_operacional_id` (não migrado): todos os 21 cards visíveis (fail-open).
- [ ] Usuário com perfil legado `admin`/`master_admin`: todos os cards visíveis, independentemente de `perfil_operacional_id`.
- [ ] Simulação de falha de leitura (doc de `perfis_operacionais` inacessível em ambiente de teste): todos os cards continuam visíveis, zero erro fatal no console.
- [ ] Os 15 cards fora da matriz (seção 3) permanecem sempre visíveis, para todos os perfis testados.
- [ ] Zero erro de console no boot do Dashboard (comparado a um baseline antes da mudança).
- [ ] Zero regressão nas demais ~29 seções do `_bootDashboard()` (relógio, fechamento de caixa, bloco de notas, meta semanal, autoatendimento, diário, agenda, alertas, mini calendário, busca global, atalhos, modal de OS, sidebar).
- [ ] Verificação do release ativo de Firestore Rules via API (`firebaserules.googleapis.com`), mesmo sem mudança esperada nas Rules — regra permanente desde o incidente da Fase 1.
- [ ] Testes obrigatórios do projeto (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente — conforme CLAUDE.md).

## 11. Critérios de aprovação

Todos os itens do checklist da seção 10 aprovados; `shared/permissoes.js` com API estável e já pronta para reuso no Sprint 2 (CRM/Agenda) sem precisar de redesenho; `CRM/TECHDOC.md` atualizado com o resultado real; aprovação formal registrada antes de iniciar o Sprint 2.

## 12. Estimativa

- **Complexidade:** Média — lógica de leitura/gate é simples, mas é a primeira integração real do RBAC em um módulo de produção crítico (piloto da Fase 2).
- **Impacto:** Alto — Dashboard é a tela de entrada de todo usuário do sistema; qualquer regressão é visível imediatamente para 100% dos usuários.
- **Tempo estimado:** 1 a 2 sessões de desenvolvimento (criação de `shared/permissoes.js` + integração + homologação com os 7 perfis).
- **Risco geral:** Médio — mitigado pelo fail-open obrigatório e pelo escopo restrito aos 6 cards já mapeados na matriz.

## 13. Recomendações

Achados arquiteturais registrados durante o levantamento, para tratamento em fases apropriadas — **nada aqui deve ser implementado agora:**

1. O Master Roadmap (Fase 2/3) cita `shared/modulo-guard.js` como componente crítico, mas `initModulo()` hoje vive direto em `CRM/scripts/kernel.js`; `shared/modulo-guard.js` não existe no código ao vivo (só em snapshots de `_BACKUPS/`). Corrigir essa referência no Roadmap na próxima revisão.
2. A matriz de `perfis_operacionais` cobre 9 módulos, mas o grid do Dashboard tem 21 cards — 15 sem entrada na matriz. Expandir a matriz para cobrir esses módulos é trabalho de Fase 3/4; registrar como pendência formal, não deste sprint.
3. Existem dois arquivos de Firestore Rules no repositório: `firestore.rules` (raiz) e `CRM/firestore.rules`. Apenas o segundo é referenciado por `firebase.json` e efetivamente deployado — o primeiro parece um resquício desatualizado. Vale limpeza formal na Fase 3 (arquivo sensível, não mexer agora).
4. Um protótipo ad-hoc de RBAC já havia sido implementado diretamente em `dashboard.js` antes deste planejamento, fora do processo formal, e foi revertido a pedido do usuário (backup preservado em `dashboard.js.backup-antes-revert-RBAC-adhoc-2026-07-01`). A lógica dele é equivalente à proposta aqui e pode servir de referência de implementação — mas `shared/permissoes.js` deve ser a fonte oficial daqui em diante, não uma versão embutida no módulo.

---

*Este documento aguarda aprovação formal. Nenhuma implementação deve iniciar antes dela.*
