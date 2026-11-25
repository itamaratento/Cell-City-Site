# Cell City — Site público + CRM

Sistema de gestão operacional (CRM) para assistência técnica de celulares + site institucional, publicado em `https://www.cellcityinformatica.com.br` via **GitHub Pages**.

- **Stack:** HTML + JavaScript (ES modules nativos, sem build step) + Firebase (Auth, Firestore, Storage — projeto `cellcity-crm`).
- **Ambientes:** 🟢 MAIN (branch `main` → raiz do domínio) e 🟠 DEVELOP (branch `develop` → `/dev`). Publicação exclusivamente via `git push` — **Firebase Hosting é proibido neste projeto**.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`ENGINEERING.md`](ENGINEERING.md) | Constituição e governança do projeto |
| [`docs/AGENT_POLICY.md`](docs/AGENT_POLICY.md) | Política central compartilhada de agentes (hierarquia 1→4, autonomia, limites e relatórios) |
| [`scripts/instalar-politica-antigravity.sh`](scripts/instalar-politica-antigravity.sh) | Instala/atualiza a política global do Antigravity sem sobrescrever outras regras |
| [`AGENTS.md`](AGENTS.md) / [`GEMINI.md`](GEMINI.md) / [`CLAUDE.md`](CLAUDE.md) | Pontos de entrada conciliados para agentes e ferramentas |
| [`.cursor/rules/cell-city.mdc`](.cursor/rules/cell-city.mdc) | Regras permanentes do Cursor (Programador Principal — Nível 1) |
| [`.agents/`](.agents/) | Agentes customizados, regras modulares, workflows e `mcp_config.json` do Antigravity |
| [`scripts/ai-hub/`](scripts/ai-hub/) | Roteador da hierarquia (`hierarchy-router.mjs`), servidor MCP (`cellcity-dev-router`) e template `.env` |
| [`.agents/workflows/delegar-programacao-dp.md`](.agents/workflows/delegar-programacao-dp.md) | Fluxo de delegação de programação (Cursor → DP/DeepSeek → Gemini → Claude Opus) |
| [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) | Estado atual do projeto (ler antes de qualquer alteração) |
| [`CRM/TECHDOC.md`](CRM/TECHDOC.md) | Documentação técnica oficial da arquitetura |
| [`MASTER_ROADMAP.md`](MASTER_ROADMAP.md) | Planejamento de longo prazo (Fases 1–6) |
| [`GUIA_OPERACAO_AMBIENTES.md`](GUIA_OPERACAO_AMBIENTES.md) | Como operar os ambientes MAIN/DEVELOP |
| [`GUIA_ROLLBACK.md`](GUIA_ROLLBACK.md) | Procedimentos de reversão (código, módulos, rules, dados) |
| [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) | Manutenção futura, convenções e dívida técnica conhecida |
| [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) | Histórico acumulativo do projeto |
| [`plans/`](plans/) | Planos, levantamentos e homologações por frente de trabalho |
| [`CHANGELOG.md`](CHANGELOG.md) | Histórico resumido de mudanças |
| [`plans/LIBERACAO_FINAL_PRODUCAO_20260717.md`](plans/LIBERACAO_FINAL_PRODUCAO_20260717.md) | Fase 2.1 — eliminação dos bloqueadores de promoção |
| [`plans/CERTIFICACAO_RELEASE_FINAL_20260717.md`](plans/CERTIFICACAO_RELEASE_FINAL_20260717.md) | Fase 2.2 — certificação técnica da release |
