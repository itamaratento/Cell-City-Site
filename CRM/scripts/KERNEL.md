# KERNEL.md — Documentação Oficial do Kernel

> Sprint 1 — Kernel SaaS, **Fase 1.3** (consolidação). Este documento é a
> fonte oficial de arquitetura de `CRM/scripts/kernel.js`. `CRM/TECHDOC.md`
> §2 continua com o resumo de uso voltado a quem implementa módulos; este
> arquivo aprofunda o ciclo de vida, as dependências e as exceções
> conhecidas e deliberadas ao padrão único de inicialização.
>
> Escopo desta Fase: **consolidação e documentação**, sem alteração de
> regra de negócio, Firestore Rules, Cloud Functions, telas ou fluxos
> funcionais. Ver relatório técnico em
> `plans/RELATORIO_TECNICO_KERNEL_FASE_1_3.md`.

---

## 1. Mandato

`kernel.js` é o **único ponto oficial de inicialização** de módulo do CRM.
Ele resolve, e só ele resolve:

1. **Autenticação** — sessão Firebase Auth (e-mail/senha).
2. **Sessão/usuário** — uid, e-mail, nome de exibição.
3. **Tenant/empresa** — `empresaId` do usuário autenticado.
4. **Perfil de acesso** — `perfil` (RBAC legado, hierarquia fechada).

Ele **não contém regra de negócio de nenhum módulo** — isso é
responsabilidade de cada `pages/<modulo>/<modulo>.js` e da Camada
Repository (`CRM/repositories/`).

## 2. Ciclo de vida (boot único)

```
importação do módulo (top-level, uma vez por página)
        │
        ▼
onAuthStateChanged(auth, cb) registrado — ÚNICO listener global
        │
        │  (Firebase dispara o primeiro estado assim que resolve,
        │   local ou remotamente — sem timeout definido pelo SDK)
        ▼
cb(user)
   ├─ user válido (não anônimo) ──► _buildContext(user)
   │                                   │
   │                                   ├─ getDoc(usuarios/{uid})
   │                                   │    ├─ existe   → usa empresa_id/perfil/nome gravados
   │                                   │    └─ não existe → cria doc (perfil:'pendente', ver §5)
   │                                   └─ falha de leitura → usa defaults, NUNCA lança (fail-safe)
   │                              localStorage['cc_kernel_v1'] = '1'
   │
   └─ sem user / anônimo ──────────► _ctx = null
                                     localStorage.removeItem('cc_kernel_v1')
        │
        ▼
_ready resolve (uma única vez — _readyResolved trava novas resoluções)
        │
        ├─ se _ctx existe → window._ccUid = uid
        │                    window.dispatchEvent(new CustomEvent('kernel-ready', {detail: ctx}))
        │
        ▼
initModulo() (chamado por cada módulo) — Promise.race(_ready, timeout 10s)
   ├─ ctx resolvido → retorna ctx para o módulo
   └─ timeout/sem ctx → location.href = loginUrl() (preserva prefixo /dev) e retorna null
```

Pontos-chave da consolidação (Fase 1.3):

- **Um único `onAuthStateChanged`** por página — nenhum outro módulo deve
  registrar um segundo listener sobre o mesmo `auth` (ver §6, exceções
  documentadas quando isso ocorre fora do domínio do Kernel).
- **Um único `_ready`** (Promise resolvida uma vez) — todo `initModulo()`
  chamado na mesma página aguarda a mesma resolução; não há corrida entre
  chamadas concorrentes de vários trechos do mesmo módulo.
- **Timeout único** (`TIMEOUT_MS = 10_000`) — mesma constante para
  `initModulo()` e `getCtxAsync()`.
- **Falha de leitura do Firestore nunca interrompe o boot** — o usuário
  autenticado sempre recebe um contexto (com defaults seguros), nunca uma
  exceção não tratada.

## 3. API pública (contrato)

| Função | Uso |
|---|---|
| `initModulo()` | Ponto de entrada padrão de todo módulo. Redireciona para `login.html` se não autenticado. |
| `login(email, senha, lembrar)` | Autenticação e-mail/senha; usada pelas telas de login. |
| `logout()` | Encerra sessão e redireciona para `login.html`. |
| `getCtx()` | Contexto síncrono (só após `initModulo()` resolver). |
| `getCtxAsync()` | Como `getCtx()`, mas aguarda a resolução sem redirecionar (diagnóstico). |
| `getUser()` / `getUid()` / `getNome()` / `getPerfil()` | Getters síncronos derivados do contexto. |
| `getEmpresaId()` | Lança erro se chamado antes do boot resolver — força uso correto do padrão `await initModulo()`. |
| `temPermissao(perfilMinimo)` | Hierarquia fechada: `master_admin(100) > admin(80) > gerente(60) > tecnico(40) > atendente(20)`. Qualquer perfil fora da lista (inclusive `'pendente'`) falha em qualquer checagem. |

**Removido nesta Fase (código morto — zero consumidores em todo o
repositório, confirmado por busca completa antes da remoção):**

- `getEmail()` — nenhum módulo, teste ou documentação importava esta
  função; `ctx.email` já está disponível diretamente no objeto de contexto
  retornado por `initModulo()`.
- `AUTH_FLAG` — reexportava a chave de `localStorage` (`'cc_kernel_v1'`)
  para eventual uso por outros módulos ES, mas o gate visual real (ver §4)
  vive em `<script>` clássico no `<head>` de cada página — que não pode
  importar um módulo ES — e por isso sempre usou a string literal
  diretamente, nunca esta constante. Nenhum consumidor real existiu.

Nenhuma das duas remoções altera comportamento observável: qualquer código
que dependesse delas já estaria quebrado antes desta Fase.

## 4. Gate visual (HTML, fora do módulo ES)

Cada `pages/<modulo>/index.html` tem, no `<head>`, um `<script>` clássico
(não-módulo) que verifica `localStorage.getItem('cc_kernel_v1') === '1'`
antes de exibir o conteúdo, evitando "flash" da tela protegida antes do
redirect. **Isso não é o mecanismo de segurança** — é só UX; a segurança
real está no Firebase Auth + Firestore Rules.

**Achado registrado (não corrigido nesta Fase — fora do escopo):** a
string `'cc_kernel_v1'` está duplicada como literal em ~34 arquivos
`index.html`, em vez de vir de uma fonte única. Corrigi-la exigiria editar
telas de múltiplos módulos simultaneamente, o que viola a regra desta
Sprint ("não modificar telas ou fluxos funcionais", "nunca alterar mais de
um módulo por vez"). Fica registrado como candidato a uma Fase futura,
dedicada e autorizada especificamente para isso.

## 5. Tenant / `empresaId`

O sistema opera hoje em **modelo single-tenant** (uma única loja/empresa,
`EMPRESA_ID = 'cellcity-master'`). O campo `empresaId` no contexto do
Kernel existe desde a concepção do módulo e é lido de
`usuarios/{uid}.empresa_id` quando presente — mas a maioria das coleções
de negócio (`os`, `clientes`, `posvenda_contatos`, `mensagens_portal`,
`avaliacoes`, `agenda`, entre outras) **não filtra por `empresa_id`** hoje.

Uma tentativa anterior de multiempresa (SaaS) foi **revertida** em
2026-06-27 (rollback documentado) e não foi refeita — ver
`CRM/TECHDOC.md` §1, `plans/SPRINT_V2_INIT_001_INICIALIZACAO_ARQUITETURA.md`
§1.2. Reabrir multiempresa é uma decisão de arquitetura/negócio fora do
escopo desta Fase 1.3 (que é só consolidação do que já existe) — nenhuma
Firestore Rule, `empresaId` de negócio ou fluxo funcional foi alterado
aqui.

## 6. Exceções documentadas ao padrão único (decisão registrada, não bug)

Nem todo ponto de autenticação do repositório passa por `kernel.js` — e
isso é **intencional** nos três casos abaixo, cada um com um domínio
diferente do CRM interno:

| Componente | Por que não usa `kernel.js` |
|---|---|
| `CRM/shared/session.js` | Alimenta exclusivamente a tela "Conta de Sincronização" (`pages/config/index.html`), um recurso legado de sincronização entre aparelhos (Google/e-mail) anterior ao Kernel atual, independente do RBAC de módulos. Mantém seu próprio `onAuthStateChanged` sobre o mesmo `auth` do Firebase — o SDK suporta múltiplos listeners sem conflito, mas é uma segunda árvore de estado de sessão, não duplicação do Kernel. Fora do escopo desta Fase (seria alteração de tela/fluxo funcional de um módulo específico, não do Kernel). |
| `CRM/pages/usuarios-permissoes/firebase-secondary.js` | Segunda instância do Firebase App (`usuarios-permissoes-secondary`), com seu próprio `Auth`, usada para criar contas/redefinir senha de terceiros **sem** encerrar a sessão do admin logado — já documentada em `CRM/TECHDOC.md` §6.9. |
| `CRM/pages/portal-cliente/*` | Portal do Cliente é uma superfície **pública**, sem sessão de staff — usa código de OS/telefone, não Firebase Auth de funcionário. Não é um módulo do CRM interno e nunca passou por `kernel.js`. |

Nenhuma das três é "dívida técnica" de Kernel — são domínios de
autenticação distintos, cada um resolvendo um problema diferente do que o
Kernel resolve (sessão de staff do CRM interno).

## 7. Testes automatizados

`tests/kernel/` (Fase 1.3) testa o **código real** de `kernel.js` (sem
cópia, via `tests/kernel/loader.mjs`), cobrindo:

- boot único (`onAuthStateChanged` registrado exatamente uma vez);
- `initModulo()` com e sem sessão, dentro e fora de `/dev`;
- sessão anônima nunca constrói contexto;
- carregamento de sessão/tenant (`empresaId`, `perfil`, `nome`) a partir do
  Firestore, inclusive primeiro acesso (`perfil:'pendente'`) e falha de
  leitura (fail-safe, sem exceção);
- hierarquia completa de `temPermissao()`;
- `login()`/`logout()` (persistência, encerramento de sessão anônima
  antes do login real, `ultimo_acesso`);
- smoke test ponta a ponta (boot → sessão → tenant → permissão → logout).

Ver `tests/kernel/package.json` (descrição da suíte) e o relatório técnico
em `plans/RELATORIO_TECNICO_KERNEL_FASE_1_3.md` para o resultado da
execução.

## 8. O que esta Fase deliberadamente NÃO fez

Por regra explícita da Sprint ("trabalhar exclusivamente na Fase 1.3",
"não modificar telas ou fluxos funcionais", "nunca alterar mais de um
módulo por vez"):

- Não migrou nem tocou `CRM/shared/session.js` (§6).
- Não alterou o gate HTML duplicado em ~34 telas (§4).
- Não reabriu multiempresa/SaaS (§5).
- Não alterou `_buildContext()`, `login()`, `logout()`, `temPermissao()`
  nem qualquer lógica de autenticação/autorização — só a documentação e a
  remoção de duas exportações mortas (§3).
- Não tocou Firestore Rules, Cloud Functions nem nenhuma tela de módulo.
