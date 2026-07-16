# Sprint 0 — FASE 1: Performance e Limpeza (2026-07-16)

**Escopo:** encerramento da Sprint 0 conforme ordem do dono — otimizações e limpeza sem alterar regra de negócio. Commit único.

## Arquivos removidos (verificação de referências antes de cada um)

| Arquivo | Motivo |
|---|---|
| `4_FIREBASE.JSON` | Config da era Firebase Hosting (proibido desde 06/2026) |
| `deploy.sh` | Script da mesma era; pipeline atual é deploy-pages/deploy-firebase.yml |
| `firestore.rules` (raiz) | Duplicata byte-idêntica; fonte oficial é `CRM/firestore.rules` (firebase.json) |
| `firestore.rules.backup`, `firestore.rules.backup_saas_2026-06-24` | Backups avulsos; histórico oficial no git |
| `assets/logo-large.png` (raiz) | Duplicata de CRM/assets (zero referências) |
| `CRM/pages/pos-venda/posvenda-test.html` | Arquivo de teste em pasta publicada (achado da auditoria V2) |

> Nota: estes itens já haviam sido removidos na P2.5 e foram **restaurados por engano** pelo
> commit `4c99975` da sessão concorrente ("varridos acidentalmente" — não eram acidente).
> Esta remoção é **deliberada** — Plano Diretor §9, risco zero, referências verificadas.

**Mantido deliberadamente:** `CRM/pages/kernel-test/` — registrado em `modulos.meta.json` como
ferramenta interna de diagnóstico, oculta e **já excluída do deploy** pelo deploy-pages.yml. Não é órfão.

## Imports mortos (varredura em 113 JS do CRM)

- `config/config.js`: `initModulo`, `carregarPermissoes`, `podeVisualizar` — importados e nunca
  chamados. **Observação de segurança anotada (não corrigida aqui por ser regra de negócio):**
  a página Config não tem gate RBAC — comportamento hoje documentado pelo próprio teste
  (`tests/rbac/config.test.mjs`: "config não tem gate RBAC"). Decidir na Sprint 1 se o gate deve existir.
- `compras.js`: `where` sem uso.
- Resultado final: **zero imports mortos** no CRM (revarredura pós-fix).

## Assets / PWA

- `CRM/assets/logo.png` e `logo-large.png` eram **JPEG com extensão .png** (manifest declara
  `image/png`) — agora são PNG reais: 512×512 (49 KB) e 1024×1024 (148 KB), gerados por
  downscale LANCZOS do original 1254×1254. Nenhum HTML/manifest precisou mudar (mesmos caminhos).
- Nenhum arquivo >300 KB restante no payload publicado.

## Service Worker / Offline

- Bump `v18 → v19` (conteúdo de assets pré-cacheados mudou — força re-precache).
- SHELL v19 validado: **zero 404** (todas as 105 entradas existem em disco).
- Install permanece resiliente (`allSettled`, desde v17) — um arquivo movido não derruba o SW.
- Compatibilidade offline: estratégia de fetch inalterada (network-first com fallback a cache
  para /CRM/, cache-first para fonts, passthrough para Firebase).

## Correção de infraestrutura de teste

- `tests/e2e/basic-structure.test.mjs`: `require('fs')` dentro de módulo ES lançava
  `ReferenceError` engolido pelo catch — todo caminho de Chrome reportava falso "Chrome not
  found" **desde a criação do teste (P1.6)**; a suíte E2E nunca tinha rodado de verdade.
  Corrigido com `accessSync` importado. (Resultados reais da suíte: ver relatório da FASE 2.)

## Métricas

| Métrica | Antes da FASE 1 | Depois |
|---|---|---|
| Imports mortos no CRM | 4 símbolos em 2 arquivos | 0 |
| Arquivos órfãos (raiz + publicados) | 7 | 0 |
| Ícones PWA | JPEG mascarado, 1254² p/ slots 192/512/1024 | PNG reais 512/1024 |
| SHELL do SW com 404 | 0 (desde v17) | 0 (revalidado no v19) |
| E2E executável | não (bug desde P1.6) | sim |
