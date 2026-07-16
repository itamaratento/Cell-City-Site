# Sprint 1 — Fase 1.2: Configuração Global (2026-07-16)

**Entrega:** `CRM/shared/app-config.js` — fonte única de configuração do client. Detalhe técnico: `CRM/TECHDOC.md §37`.

## Checklist da ordem

| Item | Status | Como |
|---|---|---|
| Configuração centralizada | ✅ | `app-config.js`: ENV, URLS, TENANT, TEMPOS, PAGINACAO, CACHE, STORAGE_KEYS, LOGS, AUDITORIA, FLAGS |
| Feature Flags organizadas | ✅ | Fachada única `FLAGS`: runtime delega à fonte governante (tenant-context); estáticas (CHAT_ATIVO, SAAS_ONBOARDING_ATIVO) centralizadas; saas-planos.js intocado até o kickoff SaaS |
| Ambientes padronizados | ✅ | `ENV`/`devPrefix()` consomem o `window.CC_ENV` do env-config.js (que segue como seletor de boot — decisão deliberada, não redundância). Ambientes reais: **production** (domínio oficial), **development** (`/dev` + localhost, fail-safe). **Homolog não existe como deploy** — homologação roda em emulador/browser local; criar um 3º ambiente é decisão de infra do dono, não desta fase |
| firebase config | ✅ por referência | Vive em env-config.js/firebase.js (protegido) — centralizado por CONSUMO, não movido |
| timeout / paginação / cache / logs / auditoria / limites | ✅ | TEMPOS, PAGINACAO (já consumida pelo listarPaginado), CACHE, LOGS (cc_repo_debug), AUDITORIA.COLECOES |
| Duplicações eliminadas | ✅ parcial | `DEFAULT_TENANT_ID`: 3 literais migrados p/ fonte única; URL do portal (os.js) e chave de debug (repository) centralizados; registro `STORAGE_KEYS` criado (migração dos ~30 literais é gradual — regra: chave nova nasce no registro) |
| Arquivos redundantes | ✅ | Nenhum novo; env-config.js mantido de propósito (boot clássico) |

## Arquivos alterados (8)

`app-config.js` (novo) · `tenant-resolver.js` (constante importada+reexportada) · `os-photo-storage.js`, `informacoes.js` (DEFAULT_TENANT_ID) · `os.js` (URLS.portalCliente + PORTAL_CLIENTE_PROD) · `base.repository.padrao.js` (PAGINACAO + STORAGE_KEYS.DEBUG_REPO) · `integridade.test.mjs` (invariante do portal atualizado p/ guardar as duas pontas) · `TECHDOC.md` (§37)

## Validação

RBAC 173/175 (2 pré-exist.) · Integrity 14/14 · **E2E browser real 9/9** · sintaxe OK em todos.

## Pendências da fase (adoção gradual, sem risco)

1. Migrar os ~30 literais `cc_*` restantes para `STORAGE_KEYS` (módulo a módulo).
2. Migrar as ~22 detecções `/dev` restantes para `devPrefix()` (idem).
3. Scripts clássicos (brand-header, dock) → `window.CC_CONFIG` quando forem tocados.
4. `sw-alarme.js` (Dashboard, protegido) mantém detecção própria — SW não tem `window`.
5. Adicionar `app-config.js` ao SHELL do sw.js no próximo bump (entra pelo fechamento de imports automaticamente).
