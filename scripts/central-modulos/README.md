# Central de Módulos V2 — gerador, testes e homologação

Ferramentas de desenvolvimento da Central de Módulos (Sprint MOD-V2-001).
Este diretório **não vai para o deploy** (o workflow do GitHub Pages exclui
`/scripts/`); o que é publicado é só o `CRM/shared/modulos.catalogo.json`
gerado aqui.

## Como funciona

```
CRM/pages/*/                        ← módulos reais (fonte da descoberta)
CRM/pages/central-modulos/
  modulos.meta.json                 ← enriquecimento opcional (nome, ícone,
                                      grupo, id legado, oculto+motivo)
        │
        ▼  node scripts/central-modulos/gerar-catalogo.mjs
CRM/shared/modulos.catalogo.json    ← catálogo completo: módulos + status
                                      🟢🟡🔴 + health check + diagnósticos +
                                      métricas + anomalias (commitado/publicado)
        │
        ▼  runtime (navegador)
CRM/shared/central-modulos.js       ← carrega o JSON (1 fetch + cache
                                      localStorage), favoritos como antes
CRM/pages/central-modulos/          ← página V2: busca global, filtros,
                                      métricas, detalhes/health por módulo, logs
```

- **Descoberta automática:** pasta nova em `CRM/pages/` = módulo novo no
  catálogo na próxima geração, sem editar lista nenhuma (nome sai do
  `<title>`, grupo cai em "Sem grupo" até ganhar entrada no meta).
- **Nada de lista hardcoded:** o antigo array `RAW_MODULOS` foi eliminado;
  o meta só *enriquece* o que o scanner encontra, nunca cria módulo.
- **Ids legados:** `agenda` (pasta `acaodasemana`) e `central-automacao`
  (pasta `central-organizacao`) são preservados via meta porque favoritos
  já salvos no Firestore referenciam esses ids.
- **Compatibilidade:** `central-modulos.js` mantém a mesma API consumida
  por `shared/menu-favoritos.js`/Dashboard (`TODOS_MODULOS`, `init`,
  `getFavoritos`, `isFavorito`, `toggleFavorito`, evento
  `cc-modulos-changed`) e o mesmo caminho de favoritos no Firestore.

## Comandos

```bash
node scripts/central-modulos/gerar-catalogo.mjs           # gera o catálogo
node scripts/central-modulos/gerar-catalogo.mjs --check   # falha se o JSON estiver desatualizado
node scripts/central-modulos/test-catalogo.mjs            # 17 testes (estrutura, regressão, descoberta)
node scripts/central-modulos/homologar.mjs                # 11 testes em Chrome headless (página real)
```

Rodar o gerador **sempre que criar/alterar módulos** e commitar o JSON
junto. O `--check` existe exatamente para acusar esquecimento.

`homologar.mjs` usa o mesmo Chrome da suíte `homologar-performance`
(`HOMOLOG_CHROME_PATH`, default `/usr/bin/google-chrome`) e intercepta
apenas `scripts/firebase.js`/`scripts/kernel.js` por URL — nenhum arquivo
do repo é alterado durante a homologação.

## Logs

- Gerações: `scripts/central-modulos/logs/geracoes.log` (JSONL, fora do git).
- Página: `localStorage['cc_modulos_log']` (máx. 200 eventos, botão 📜 na UI).
