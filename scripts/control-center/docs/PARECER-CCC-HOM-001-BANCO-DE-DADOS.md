# Parecer Executivo — CCC-HOM-001 (Banco de Dados)

**Padrão:** CCC-HOM-001 (mesmo formato do parecer da Fase 3 — ver
`PARECER-CCC-HOM-001.md`, módulo Backup e Recuperação).

| Campo | Valor |
|---|---|
| Objeto | Módulo **Banco de Dados** do Cell City Control Center |
| Sprint | Fase 4 (especificação CCC-F04-001) |
| Responsável técnico | Claude (Arquiteto/Desenvolvedor do Control Center) |
| Data | 2026-07-11 |
| Branch | `develop` |
| Commit | `54ade5f` (módulo) + commits subsequentes de ajuste (permissões, testes, documentação) |
| Ambiente | Terminal Ubuntu — comando `cellcity`; `gcloud` autenticado (`itamaratento@gmail.com`), sem Firebase CLI logado, sem Application Default Credentials |

## 1. Escopo homologado

Submenu com 10 opções (`1 ► Status do Banco` … `10 ► Configurações`,
`11 ► Voltar`, `0 ► Sair`), acessível via `Control Center › Banco de
Dados` (opção 4 do menu principal). Camadas: Interface (`menu.sh`),
Orquestração (`engine.sh`), Serviço (`lib/utils.sh`, `status.sh`,
`collections.sh`, `indexes.sh`, `rules.sh`, `functions.sh`,
`integrity.sh`, `statistics.sh`, `export.sh`, `config.sh`).

## 2. Princípio arquitetural aplicado

**Somente leitura, sempre.** Nenhuma ação cria, altera, publica ou remove
qualquer coleção, documento, Rule, índice ou Cloud Function. Toda
checagem ao vivo usa exclusivamente `gcloud ... describe`/`list` ou GET
em `firebaserules.googleapis.com` (mesma técnica já usada neste projeto
para verificar o release ativo de Rules — ver memória
"feedback-firestore-rules-verify-api"). Publicar Rules/índices/Functions
continua sendo exclusivamente `firebase deploy`, fora deste módulo —
verificado por teste automatizado que varre todo `lib/*.sh` em busca de
invocação real (não apenas menção em comentário/sugestão) de comandos de
escrita.

Ambiente sempre explícito (mesmo princípio do módulo Backup e
Recuperação): nenhuma ação deduz sozinha se o projeto é `dev` ou `prod`.

## 3. Verificações realizadas

| # | Verificação | Resultado |
|---|---|---|
| 1 | Navegação (entrar/sair do submenu, `Voltar` dinâmico = 11, submenus de Coleções/Exportações/Ferramentas/Configurações) | ✅ |
| 2 | Layout/UX (moldura, breadcrumb, rodapé — componentes já homologados, não alterados) | ✅ |
| 3 | Status do Banco — projeto/ambiente/database/região reais, describe do Firestore via `gcloud` | ✅ |
| 4 | Coleções — Listar/Sem Rules/Vazias/Órfãs/Duplicadas, todas leitura real | ✅ |
| 5 | Índices — comparação declarado × publicado via `gcloud`, normalização do campo implícito `__name__` | ✅ (bug real encontrado e corrigido nesta homologação — ver §4) |
| 6 | Firestore Rules — sintaxe, permissões abertas, duplicidade, comparação com o release publicado via API | ✅ |
| 7 | Cloud Functions — declarado (`functions/index.js`) × publicado via `gcloud` | ✅ (15/15 ativas em dev, sem drift de runtime) |
| 8 | Integridade — arquivos obrigatórios, consistência raiz×CRM/, cobertura de Rules, alcance do gcloud | ✅ |
| 9 | Estatísticas — contagens reais, limitações declaradas honestamente (não estimadas) | ✅ |
| 10 | Exportações — TXT/Markdown/JSON gerados de verdade em `_reports/database/` | ✅ |
| 11 | Ferramentas — atalhos reaproveitam as mesmas funções de serviço, sem lógica duplicada | ✅ |
| 12 | Configurações — persistência em `config/local.json` (escopo isolado), Restaurar Padrões | ✅ |
| 13 | Degradação sem `gcloud`/autenticação — testado com `gcloud` fora do PATH; todas as ações avisam e continuam, nenhuma trava | ✅ |
| 14 | Compatibilidade Ubuntu — testado no terminal real via `cellcity`, `bash -n` + ShellCheck em todos os scripts | ✅ |

Suíte automatizada: **12 testes novos, 12 aprovados** (`tests/control-center/estrutura.test.mjs`,
seção "Fase 4 — Banco de Dados"). Cobrem arquitetura, garantia de
somente-leitura, navegação, cancelamento, e as 10 seções do menu.

## 4. Achados e ações

- **Bug real (corrigido durante a homologação):** a comparação de
  índices declarados × publicados aplicava uma assinatura que não
  considerava o campo `__name__` implícito que o Firestore acrescenta
  automaticamente quando o arquivo local não o declara explicitamente —
  todo índice declarado sem `__name__` aparecia incorretamente como
  "ausente" mesmo já publicado. Corrigido normalizando ambos os lados da
  comparação (`lib/indexes.sh`, `_cc_bd_indice_assinatura`).
- **Achado real (informativo, não corrigido — fora do escopo somente-leitura):**
  `firestore.indexes.json` existe na raiz do repositório, diferente do
  arquivo oficial (`CRM/firestore.indexes.json`, usado por
  `firebase.json`) — provável artefato desatualizado. `firestore.rules`
  na raiz, por outro lado, está idêntico ao oficial. Reportado pelo
  módulo a cada execução (seções Índices e Integridade).
- **Achado real (informativo):** 4 índices publicados em `dev` não
  constam no arquivo declarado (candidatos a órfãos ou a incluir no
  arquivo).
- **Achado real (já revisado, não é vulnerabilidade nova):** 3 blocos de
  Rules com `allow ...: if true` — todos documentados no próprio arquivo
  como acesso público intencional e de escopo estreito (`config`,
  `pre_os`, `catalogo_config`). O módulo reporta a localização exata
  (arquivo:linha) a cada execução, por serem sempre dignos de checagem.
- **Limitação documentada (não é defeito):** contagem de documentos e
  "uso aproximado" não são mensuráveis sem Admin SDK com Application
  Default Credentials (não configuradas neste ambiente) ou Cloud Billing
  API — reportado assim, explicitamente, nunca estimado.

## 5. Riscos residuais

- "Coleções órfãs" e "Rules não utilizadas" são heurísticas por `grep`
  estático em `CRM/` e `functions/` — podem ter falsos positivos/negativos
  (não substituem revisão manual antes de remover qualquer coleção ou
  Rule).
- "Índices não utilizados" (Ferramentas) é heurística por
  `collectionGroup` desconhecida — não analisa as queries reais do
  código.
- Checagens ao vivo (Índices/Rules/Functions/Status) dependem de
  `gcloud` instalado e autenticado; degradam para aviso quando ausente,
  mas o relatório fica parcial nesse cenário (documentado na tela e nos
  testes).
- O comando `_cc_run_submenu` pausa automaticamente após despachar um
  item — como Coleções/Exportações/Ferramentas/Configurações abrem um
  submenu próprio, sair de volta ao menu principal exige um ENTER extra
  (comportamento herdado do motor genérico, não uma regressão introduzida
  por este módulo — mesmo efeito ocorreria em qualquer módulo futuro que
  combine as duas camadas).

## 6. Observação sobre o checkout compartilhado

Durante esta Sprint foram observados múltiplos eventos de `git reset`
no reflog do repositório, que reverteram `modules/banco-dados/menu.sh`
para o placeholder da Fase 1 por duas vezes (arquivo restaurado ambas as
vezes) e também afetaram `config/modules.conf`/`README.md` de outra
sessão em desenvolvimento paralelo (módulos Manutenção e Branches e
Sincronização). Nenhum arquivo deste módulo foi perdido — o commit
`54ade5f` foi feito assim que a Fase 4 ficou funcional, exatamente para
proteger o trabalho contra novos resets. Ver
[[feedback-concorrencia-sessoes-checkout]] na memória.

## 7. Veredito

**APROVADO para `develop`.** Não promovido para `main` — fora do escopo
desta Sprint, sem instrução explícita para tal.

---
*Ver também `PARECER-CCC-HOM-001.md` (Fase 3, Backup e Recuperação) —
mesmo padrão, primeiro registro do formato.*
