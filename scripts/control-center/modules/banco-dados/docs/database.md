# Banco de Dados

Módulo de administração somente-leitura do Firestore/Firebase do Cell City
CRM — CELL CITY CONTROL CENTER, Fase 4 (padrão CCC-F04-001).

## Arquitetura

```
modules/banco-dados/
  menu.sh              — Interface: submenu via _cc_run_submenu, dispatch.
  engine.sh            — Orquestrador: só carrega lib/*.sh.
  lib/
    utils.sh           — Contadores, classificação, config do Firebase
                          (firebase.json/.firebaserc), wrapper de gcloud,
                          menu de Ferramentas, config local do módulo.
    status.sh          — Status do Banco (§4).
    collections.sh     — Coleções: listar/sem Rules/vazias/órfãs/duplicadas (§5).
    indexes.sh         — Índices: declarado × publicado, via gcloud (§6).
    rules.sh           — Firestore Rules: sintaxe, permissões abertas,
                          duplicidade, comparação com o release publicado
                          via firebaserules.googleapis.com (§7).
    functions.sh       — Cloud Functions: declarado (functions/index.js) ×
                          publicado, via gcloud (§8).
    integrity.sh        — Integridade: validação estrutural agregada (§9).
    statistics.sh       — Estatísticas (§10).
    export.sh           — Exportações TXT/Markdown/JSON em _reports/database/ (§11).
    config.sh           — Configurações locais do módulo (§13).
  config/
    local.json          — Preferências do desenvolvedor (gitignored — nunca
                           dado de negócio, nunca versionado).
  docs/
    database.md          — Esta documentação.
```

## Princípio arquitetural: somente leitura

Nenhuma ação deste módulo cria, altera, publica ou remove qualquer
coleção, documento, Rule, índice ou Cloud Function. Toda operação que
toca um projeto Firebase real usa exclusivamente comandos de leitura do
`gcloud` (`describe`/`list`) ou chamadas GET à API
`firebaserules.googleapis.com` — nunca `firebase deploy`, nunca o Admin
SDK com permissão de escrita. Publicação de Rules/índices/Functions
continua sendo exclusivamente `firebase deploy`, fora deste módulo.

**Ambiente sempre explícito** — mesmo princípio já usado pelo módulo
Backup e Recuperação (`_bkp_firebase`): nenhuma operação deduz sozinha se
é `dev` ou `prod`. Toda ação que precisa de um projeto Firebase pergunta
antes (`_cc_bd_escolher_ambiente`).

## Fontes de dados

- **Coleções conhecidas** — união dos blocos `match` de topo em
  `CRM/firestore.rules` (caminho lido de `firebase.json`, nunca
  hardcoded) com a lista cadastrada em `backup-dados.js` (script de
  backup já homologado do projeto).
- **Índices** — compara `CRM/firestore.indexes.json` (declarado) com
  `gcloud firestore indexes composite list` (publicado). Normaliza o
  campo implícito `__name__` que o Firestore acrescenta automaticamente
  quando não declarado no arquivo (evita falso "ausente").
- **Rules** — heurísticas locais (sintaxe, `if true`, duplicidade,
  referência estática) mais uma comparação real com o release ativo via
  `firebaserules.googleapis.com` (mesma técnica já validada neste
  projeto — ver memória "feedback-firestore-rules-verify-api").
- **Cloud Functions** — `exports.*` de `functions/index.js` (declarado) ×
  `gcloud functions list` (publicado).
- **Documentos/uso aproximado** — não mensurável sem Admin SDK com
  Application Default Credentials (não configuradas por padrão neste
  ambiente) ou Cloud Billing API. Reportado honestamente como
  indisponível, nunca estimado.

## Menus

### Principal
```
4 ► Banco de Dados
  1 ► Status do Banco
  2 ► Coleções
  3 ► Índices
  4 ► Firestore Rules
  5 ► Cloud Functions
  6 ► Integridade
  7 ► Estatísticas
  8 ► Exportações
  9 ► Ferramentas
  10 ► Configurações
  11 ► Voltar
  0 ► Sair
```

### Coleções
```
1 ► Listar Coleções
2 ► Localizar Coleções sem Rules
3 ► Localizar Coleções Vazias (requer ADC — indisponível por padrão)
4 ► Localizar Coleções Órfãs (heurística por grep, confirmar manualmente)
5 ► Localizar Coleções Duplicadas (blocos match repetidos em Rules)
0 ► Voltar
```

### Ferramentas
```
1 ► Localizar Coleções Vazias
2 ► Localizar Rules não utilizadas
3 ► Localizar Índices não utilizados
4 ► Localizar Functions órfãs
5 ► Validar Estrutura Firebase
0 ► Voltar
```

Atalhos que reaproveitam as mesmas funções de serviço de Coleções/Rules/
Índices/Functions/Integridade — nenhuma lógica duplicada.

## Achados reais desta homologação (2026-07-11)

- `firestore.indexes.json` existe na raiz do repositório, diferente do
  arquivo oficial (`CRM/firestore.indexes.json`, usado por
  `firebase.json`) — provável artefato desatual. `firestore.rules` na
  raiz, por outro lado, está idêntico ao oficial.
- 4 índices publicados em `dev` não estão declarados no arquivo local
  (candidatos a órfãos ou a fazer merge no arquivo).
- 3 blocos de Rules com `allow ...: if true` — todos documentados no
  próprio arquivo como acesso público intencional e estreito (`config`,
  `pre_os`, `catalogo_config`), não são um achado novo, mas o módulo os
  reporta a cada execução por serem sempre dignos de checagem.
- 15/15 Cloud Functions declaradas em `functions/index.js` publicadas e
  ativas em `dev`, sem drift de runtime.

## Limitações conhecidas (não são defeitos)

- Contagem de documentos e "espaço utilizado" não são mensuráveis sem
  Admin SDK/ADC ou Cloud Billing API — este módulo nunca fabrica uma
  estimativa; reporta a limitação explicitamente.
- "Coleções órfãs" e "Rules não utilizadas" são heurísticas por `grep`
  estático em `CRM/` e `functions/` — não substituem revisão manual antes
  de remover qualquer coleção ou Rule.
- "Índices não utilizados" é uma heurística por `collectionGroup`
  desconhecida — não analisa as queries reais do código.
