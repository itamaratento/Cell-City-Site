# CCC-RC-V2.2-WI-001 — Workspace Intelligence — Arquitetura Oficial

| Campo | Valor |
|---|---|
| Projeto | Cell City Control Center — Release Center V2.2 |
| Missão | Módulo **Workspace Intelligence** (análise inteligente do workspace) |
| Autor (Arquitetura • Governança • UX • Fluxo) | Claude |
| Implementador (Bash • Git • Performance) | DeepSeek |
| Data | 2026-07-13 |
| Status | ARQUITETURA APROVADA — pronta para implementação |
| Spec de origem | Recebida do dono em chat (V2.2); este documento é a tradução técnica vinculante |

Este documento é o **contrato de implementação e de revisão técnica**.
A implementação será auditada item a item contra ele. Qualquer desvio
precisa ser justificado por escrito no relatório da Sprint.

---

## 1. Problema e objetivo

Hoje qualquer linha em `git status --porcelain` bloqueia a release
(`_check_workspace_branch`, `scripts/release/release-center.sh:301`),
mesmo quando a alteração pertence a um desenvolvimento paralelo
independente (ex.: Control Center V3 em `scripts/control-center/v3/`).

Objetivo: classificar cada alteração, medir impacto sobre a release
atual e **só bloquear quando necessário** — sem jamais afrouxar a
segurança para arquivos que participam da release. O objetivo NÃO é
ignorar arquivos; é decidir com justificativa técnica e registro.

## 2. Estado atual (fatos verificados, com linha)

| Ponto | Onde | Comportamento hoje |
|---|---|---|
| Check de workspace da release | `scripts/release/release-center.sh:301-331` (`_check_workspace_branch`) | porcelain vazio = PASS; só runtime/logs (`scripts/*/state/*`, `logs/*`, `*.log`) = WARN; resto = `_blocker` |
| Chamadas do check | `release-center.sh:440` (rápida), `:534` (completa), `:559` (turbo), `:781` (certificação) | sempre antes das lanes de suítes |
| Diagnóstico | `release-center.sh:838` (`--explicar-bloqueio`) | acusa "workspace com alterações não commitadas" |
| Validação do marcador | `release-center.sh:979` (`verificar_homologacao_valida`) | exige porcelain 100% vazio, branch develop, commit igual, status GO |
| Entrada silenciosa | `release-center.sh:987` (`--check-homologacao`) | **só exit code**, sem output — contrato do subir-ok |
| `subir()` | `~/.bashrc:119-145` | `git add .` + commit + push — **varre o workspace inteiro**, inclusive trabalho de outra sessão |
| `subir-ok()` | `~/.bashrc:162-165` | porcelain não-vazio = bloqueio direto; depois chama `--check-homologacao` (`~/.bashrc:182`) |
| Control Center → release | `scripts/control-center/modules/release/lib/release.sh:93,108` | injeta `printf '2\n0\n'` / `'3\n0\n'` no menu |
| Marcador de homologação | JSON em `.git/` (commit, opcao, tipo, status, timestamp, branch, versao) | escrito pelo release-center |
| Logs | `.gitignore:2` ignora `logs/` na raiz (exceção só p/ `scripts/control-center/logs/`) | `logs/workspace-analysis/` nascerá ignorado — correto |

## 3. Decisões arquiteturais (vinculantes)

**AD-1 — Default-deny.** Arquivo que não casar com nenhuma regra de
classificação cai em OUTROS com impacto **ALTO** (bloqueia). Falso
positivo custa uma release atrasada; falso negativo custa produção
quebrada. Novo diretório de projeto independente só deixa de bloquear
quando for adicionado explicitamente à tabela de classificação.

**AD-2 — Uma lib, um dono da verdade.** Toda a inteligência vive em
`scripts/control-center/lib/workspace-intelligence.sh` com interface
CLI (Seção 4). `release-center.sh`, `subir` e `subir-ok` **delegam** —
nenhum consumidor reimplementa classificação, nem parcialmente.
Se a lib estiver ausente ou quebrar, todos os gates **falham fechado**
(bloqueiam) com mensagem clara.

**AD-3 — Classificação por prefixo de caminho** (case bash,
primeiro-match, ordem: crítico → específico → genérico). Sem heurística
de conteúdo, sem IA, sem rede. Determinístico e auditável (Seção 5).

**AD-4 — Escala de decisão binária na publicação.** Os 5 níveis de
impacto (NULO/BAIXO/MÉDIO/ALTO/CRÍTICO) existem no relatório e no log,
mas a decisão de publicação é: **≤ BAIXO = pode continuar com
confirmação do operador; ≥ MÉDIO = bloqueio automático.** Isso mantém
o gate silencioso (`--check-homologacao`, que não pode perguntar)
matematicamente coerente com os prompts interativos — nunca existirá
um estado aprovado no prompt e reprovado no gate silencioso.

**AD-5 — Homologação passa a exigir "escopo da release limpo", não
"tree 100% limpa".** `verificar_homologacao_valida` troca o teste da
linha 979 por `wi gate homologacao` (silencioso). Drift de arquivos
externos (ex.: kilo gravando V3 durante a sessão) **não** invalida uma
homologação GO — o gate reanalisa o estado a cada chamada, então
qualquer arquivo bloqueante que surja passa a bloquear na hora.

**AD-6 — Não-interativo nunca pergunta.** Contextos silenciosos
retornam exit code baseado só na análise (≤ BAIXO passa). A decisão
humana acontece — e é logada — nos fluxos interativos que sempre
antecedem: menu do release (opções 1/2/3/8), `subir`, `subir-ok`.
Nunca continuar automaticamente em fluxo interativo: prompt sempre,
default = cancelar.

**AD-7 — `subir` tem semântica própria (commit, não publicação).**
Em `subir`, alteração em arquivo da release é LEGÍTIMA (é assim que se
desenvolve o próprio release-center). O risco em `subir` é outro:
`git add .` varrer trabalho de outra sessão/projeto. Regra: todos os
arquivos em **um único grupo** → comportamento idêntico ao atual (zero
prompt novo); **múltiplos grupos** ou presença de V3/OUTROS → relatório
+ prompt. Staging seletivo está **fora de escopo** (mudaria a semântica
do subir; compat total com V2).

**AD-8 — Cache por estado, não por tempo de sessão.** Chave =
`sha1(git status --porcelain + HEAD)`. Mesma execução reutiliza a
análise (arquivo em `logs/workspace-analysis/cache/`); estado mudou =
chave nova = reanálise. TTL de segurança: 60s. Meta: análise completa
< 2s (Seção 10).

**AD-9 — Compatibilidade absorvente.** A exceção runtime/logs existente
(`release-center.sh:317-325`) vira o grupo RUNTIME com impacto NULO
**sem prompt** (mantém o `_aviso` com a dica de restore). Contratos
v2.1 intocados: numeração do menu 1/2/3/8/0, `--check-homologacao` só
exit code, ordem das lanes, `known_flakes.json`.

**AD-10 — `~/.bashrc` recebe o diff mínimo especificado na Seção 8 e
nada além.** Backup de `~/.bashrc` obrigatório antes (CLAUDE.md §1).
A lógica fica na lib do repo; o bashrc só chama por caminho absoluto
(mesmo padrão da linha 182 atual).

## 4. Interface da lib (CLI)

Arquivo: `scripts/control-center/lib/workspace-intelligence.sh`
(bash puro, `set -uo pipefail`; `python3` permitido só para JSON, mesmo
padrão já usado pelo release-center).

```
wi analisar [--json]          # imprime relatório (Seção 7); exit 0 sempre; grava log
wi gate <contexto>            # decide; exit 0=prosseguir 1=bloqueado 2=cancelado pelo operador
wi porque <arquivo>           # justificativa técnica da classificação de um arquivo; exit 0
```

Contextos de `gate`:

| Contexto | Interativo? | Regra |
|---|---|---|
| `release-rapida` / `release-completa` / `release-turbo` / `certificacao` | sim | ≥ MÉDIO bloqueia; NULO/BAIXO externos → relatório + prompt; limpo/só-RUNTIME → passa sem prompt (RUNTIME mantém aviso) |
| `subir` | sim | AD-7: 1 grupo só → passa sem prompt; multi-grupo ou V3/OUTROS presentes → relatório + prompt |
| `subir-ok` | sim | igual às releases (≥ MÉDIO bloqueia; ≤ BAIXO prompt) |
| `homologacao` | **não** | silencioso: exit 0 sse impacto geral ≤ BAIXO; nunca imprime nada |

Toda invocação de `gate` grava log (Seção 9), inclusive a silenciosa.
Prompt em contexto interativo sem TTY (stdin fechado) = **cancelar**
(fail closed), nunca continuar.

## 5. Tabela de classificação (ordem de avaliação — primeiro match vence)

O caminho avaliado é o path do porcelain (col. 4+). Renames (`R `)
avaliam **os dois** paths e vale o pior resultado.

| # | Padrão (prefixo/glob) | Grupo | Impacto |
|---|---|---|---|
| 1 | `scripts/release/*` | RELEASE CENTER | **CRÍTICO** |
| 2 | `scripts/control-center/modules/release/*` | RELEASE CENTER | **CRÍTICO** |
| 3 | `scripts/backup/*` | FERRAMENTAS (backup) | **CRÍTICO** |
| 4 | `firestore.rules*`, `storage.rules` | RULES | **CRÍTICO** |
| 5 | `functions/*` | FUNCTIONS | **CRÍTICO** |
| 6 | `tests/rbac/*`, `tests/firestore-rules/*`, `tests/functions/*`, `tests/integrity/*`, `tests/performance/*` | TESTES (suítes da release) | **CRÍTICO** |
| 7 | `.github/*` | CONFIGURAÇÃO (CI/workflow) | **CRÍTICO** |
| 8 | `package.json`, `package-lock.json`, `.gitignore`, `CNAME` | CONFIGURAÇÃO (compartilhada) | **CRÍTICO** |
| 9 | `scripts/control-center/lib/workspace-intelligence.sh`, `scripts/control-center/config/*` | FERRAMENTAS (config CC) | **MÉDIO** |
| 10 | `scripts/control-center/v3/*`, `scripts/control-center/modules/noc-v3/*`, `tests/control-center/v3/*`, `plans/v3/*` | CONTROL CENTER V3 | **NULO** |
| 11 | `scripts/control-center/*` | FERRAMENTAS (Control Center) | **MÉDIO** |
| 12 | `scripts/*` | FERRAMENTAS | **MÉDIO** |
| 13 | `CRM/*` | CRM | **ALTO** |
| 14 | `saas/*` (reservado — não existe hoje) | SAAS | **ALTO** |
| 15 | `index.html`, `css/*`, `js/*`, `pages/*`, `imagens/*`, `assets/*`, `catalogo/*`, `celular/*`, `impressora/*`, `notebook/*`, `sistema/*`, `tracking/*`, `videos/*` | SITE | **ALTO** |
| 16 | `tests/control-center/*` | TESTES (isolados) | **BAIXO** |
| 17 | `tests/*` | TESTES | **MÉDIO** |
| 18 | `plans/*`, `docs/*`, `*.md` (qualquer nível) | DOCUMENTAÇÃO | **BAIXO** |
| 19 | `scripts/*/state/*`, `logs/*`, `*.log` | RUNTIME | **NULO** (sem prompt; mantém aviso+restore, AD-9) |
| 20 | *(qualquer outro)* | OUTROS | **ALTO** (AD-1) |

Notas de governança:

- A linha 19 replica a exceção atual — precisa continuar aceitando
  exatamente os mesmos paths que hoje (`release-center.sh:317`).
- CRM/SITE/SAAS bloqueiam porque a homologação testa a **working
  tree**, mas o `subir-ok` publica o **commit**: sujeira nesses grupos
  tornaria o GO não-representativo do que vai ao ar.
- A exceção do item 9 sobre o próprio `workspace-intelligence.sh`:
  fica MÉDIO (bloqueia publicação) de propósito — o guardião alterado
  e não commitado jamais pode se autovalidar.
- CLAUDE.md/ENGINEERING.md são `*.md` → DOCUMENTAÇÃO/BAIXO. Correto:
  não participam do artefato executável nem das suítes.

## 6. Análise de dependências (bounded, ≤ 2s)

Executada **somente** para arquivos que ficaram com impacto ≤ BAIXO
(nos demais o bloqueio já está decidido). Três verificações, todas
agregadas (nunca um subprocesso por arquivo):

1. **Lista curada** — se o path alterado constar de
   `scripts/control-center/config/wi-dependencias.conf` (novo arquivo
   de config: um path por linha, comentários com `#`), impacto sobe
   para ALTO. Semente inicial: vazia — a lista existe para o dono/
   revisor promover exceções descobertas sem editar código.
2. **Reverse-grep no escopo da release** — um único `grep -lF` com os
   basenames dos arquivos alterados sobre `scripts/release/*.sh`,
   `scripts/control-center/modules/release/**` e `~/.bashrc`
   (funções `subir`/`subir-ok`). Hit = o pipeline referencia o arquivo
   alterado → impacto **ALTO**, motivo registrado com o consumidor.
3. **Forward-scan** — nos arquivos alterados (só os ≤ BAIXO, que são
   poucos), um grep agregado por `source|\.\s|require\(|import ` cujo
   alvo resolva para os grupos CRÍTICOS da Seção 5 → impacto **ALTO**.

Dependência indireta além de 1 nível **não** é perseguida em runtime
(custo O(repo) incompatível com 2s); é coberta pela combinação
default-deny (AD-1) + lista curada (item 1) + revisão técnica.

## 7. UX — relatório e prompts (formato vinculante)

`wi analisar` (e o relatório dentro dos gates interativos):

```
==================================================
 WORKSPACE ANALYZER — Release Center V2.2
==================================================
 Release Center      0 alterações
 CRM                 0 alterações
 Site                0 alterações
 SaaS                0 alterações
 Control Center V3   4 alterações
 Testes              0 alterações
 Documentação        1 alteração
 Configuração        0 alterações
 Ferramentas         0 alterações
 Runtime             0 alterações
 Outros              0 alterações
==================================================
 Impacto Geral       NULO
 Decisão sugerida    Pode continuar.
==================================================
```

Regras: grupos zerados podem ser omitidos com `--json` mas aparecem no
TXT; impacto geral = pior impacto encontrado; "Decisão sugerida" ∈
{"Pode continuar." (≤ BAIXO) | "Bloquear." (≥ MÉDIO)}.

Prompt (contextos interativos, quando ≤ BAIXO e há alterações externas):

```
⚠ Foram encontradas alterações locais.

  Projeto:  Control Center V3
  Impacto:  NULO
  Motivo:   não participa do fluxo atual da Release.

  Essas alterações NÃO fazem parte da Release atual.

  1 - Continuar
  2 - Ver relatório completo
  3 - Cancelar
```

- `2` mostra o relatório completo (com a lista de arquivos e o motivo
  por arquivo) e **volta ao prompt**.
- Enter vazio, entrada inválida ou stdin sem TTY = `3` (cancelar).
- Bloqueio (≥ MÉDIO) **não tem prompt**: mensagem no padrão `_blocker`
  já existente — Motivo + Como resolver — nomeando arquivo, grupo e
  quem o consome (quando a Seção 6 souber).

## 8. Fluxo — integração ponto a ponto

Cada consumidor chama a lib por caminho absoluto derivado de
`$REPO_DIR` (release-center) ou hardcoded (bashrc, padrão da linha 182).

1. **`_check_workspace_branch`** (`release-center.sh:301`): mantém o
   bloco de branch; o bloco de workspace (linhas 313-330) passa a:
   `wi gate <contexto-da-opção>` → exit 0 = `_pass` (ou `_aviso` no
   caso RUNTIME/decisão do operador, com o texto do motivo), exit 1 =
   `_blocker`, exit 2 = aborta a operação como cancelada pelo operador.
   O contexto vem da opção do menu (1→release-rapida, 2→release-completa,
   3→certificacao, 8→release-turbo).
2. **`--explicar-bloqueio`** (`release-center.sh:838`): troca o teste
   porcelain pela análise; a explicação nomeia grupo/arquivos/motivo
   em vez do genérico "workspace com alterações não commitadas".
3. **`verificar_homologacao_valida`** (`release-center.sh:979`): troca
   `[ -z "$(git status --porcelain)" ] || return 1` por
   `wi gate homologacao || return 1` (AD-5, AD-6). Os demais testes
   (branch, commit, GO) ficam como estão.
4. **Marcador de homologação**: ao registrar, acrescentar o bloco
   `"workspace": {"fingerprint": "<sha1>", "impacto": "<nivel>",
   "grupos_externos": [...], "decisao": "operador|limpo"}` — auditoria,
   não validação (a validade é sempre reanálise ao vivo, AD-5).
5. **`subir`** (`~/.bashrc`, antes do `git add .` da linha 142):

   ```bash
   if ! "$HOME/Músicas/projetos/Cell-City-Site/scripts/control-center/lib/workspace-intelligence.sh" gate subir; then
     echo "Operação cancelada."
     return 1
   fi
   ```

6. **`subir-ok`** (`~/.bashrc`, substituindo APENAS as linhas 162-165):

   ```bash
   if ! "$HOME/Músicas/projetos/Cell-City-Site/scripts/control-center/lib/workspace-intelligence.sh" gate subir-ok; then
     echo "❌ Promoção bloqueada pelo Workspace Intelligence (veja o relatório acima)."
     return 1
   fi
   ```

   O restante do `subir-ok` (fetch, push pendente, `--check-homologacao`
   na linha 182, checklist, versionamento) fica **intocado**. A cadeia
   fica: prompt interativo (decisão do operador, logada) → gate
   silencioso do marcador (consistente por AD-4).

7. **Reuso na mesma execução**: os múltiplos pontos que hoje chamam
   `_check_workspace_branch` na mesma release reutilizam o cache AD-8
   automaticamente (mesma chave de estado) — sem análise repetida.

## 9. Log (auditoria)

Diretório: `logs/workspace-analysis/` (raiz — já nasce gitignored,
`.gitignore:2`). Por análise/gate, dois arquivos com o mesmo stem
`YYYYMMDD-HHMMSS-<contexto>`:

- `.json`:

  ```json
  {
    "timestamp": "2026-07-13T16:20:00-03:00",
    "contexto": "release-completa",
    "commit": "9e0cf45…", "branch": "develop",
    "duracao_ms": 412,
    "arquivos": [
      {"path": "scripts/control-center/v3/noc.sh", "status": "??",
       "grupo": "CONTROL CENTER V3", "impacto": "NULO",
       "motivo": "não participa do fluxo atual da Release",
       "dependencias": []}
    ],
    "resumo": {"por_grupo": {"CONTROL CENTER V3": 4}, "impacto_geral": "NULO"},
    "decisao": {"resultado": "continuar", "por": "operador",
                "justificativa": "alterações externas à release, impacto NULO"}
  }
  ```

- `.txt`: espelho legível (o próprio relatório da Seção 7 + lista de
  arquivos + decisão + quem decidiu).

`decisao.por` ∈ {`operador`, `automatico-limpo`, `automatico-bloqueio`,
`automatico-silencioso`}. Retenção: manter os últimos 200 pares;
excedente é apagado pelo próprio script (mais antigo primeiro).

## 10. Performance (orçamento: 2s)

- 1× `git status --porcelain` (única chamada git obrigatória).
- Classificação: loop bash puro com `case` — zero subprocesso por arquivo.
- Dependências: no máximo 3 `grep` agregados (Seção 6), e somente
  quando existem arquivos ≤ BAIXO.
- JSON: 1× `python3` no final (padrão já aceito no release-center).
- Cache AD-8 evita reanálise dentro da mesma execução e entre
  subir-ok → --check-homologacao (estado idêntico = mesma chave).
- Teste de performance obrigatório: workspace com 50 arquivos sujos
  simulados deve analisar em < 2s (asserção no teste 9 da Seção 11).

## 11. Testes (obrigatórios para aceite)

Arquivo: `tests/control-center/workspace-intelligence.test.mjs`
(padrão dos testes .mjs existentes). Cada cenário monta um repositório
git **temporário** (scratch/tmp — nunca o repo real), copia a lib,
cria os arquivos do cenário e chama o CLI afirmando exit code, grupo,
impacto e log gerado. Prompts são testados injetando stdin
(`printf '1\n'` / `'3\n'` / stdin fechado).

| # | Cenário | Resultado exigido |
|---|---|---|
| 1 | Workspace limpo | gate exit 0 sem prompt; relatório zerado |
| 2 | Só V3 (`scripts/control-center/v3/x.sh` untracked) | NULO; prompt; `1`→exit 0, `3`/Enter/sem-TTY→exit 2; log registra decisão e quem decidiu |
| 3 | CRM sujo (`CRM/os.js` modificado) | ALTO; exit 1 sem prompt; motivo cita grupo CRM |
| 4 | Misto V3 + CRM | pior caso vence: ALTO; exit 1 |
| 5 | Dependência compartilhada (arquivo ≤ BAIXO referenciado por `scripts/release/*.sh` fixture) | elevado a ALTO; exit 1; motivo nomeia o consumidor |
| 6 | Falso positivo (`README.md` modificado) | DOCUMENTAÇÃO/BAIXO; prompt; nunca bloqueio automático |
| 7 | Falso negativo (arquivo novo em raiz, ex.: `foo.xyz`) | OUTROS/ALTO; exit 1 (default-deny AD-1) |
| 8 | Órfãos runtime (`logs/x.log`, `scripts/x/state/y`) | RUNTIME/NULO; sem prompt; aviso com dica de restore (compat AD-9) |
| 9 | Performance (50 arquivos mistos) | análise < 2s |
| 10 | `gate homologacao` silencioso | zero output em stdout/stderr; exit 0 p/ cenário 2, exit 1 p/ cenário 3 |
| 11 | Lib chamada com contexto desconhecido | exit 1 (fail closed) |

Além destes: rodar a suíte completa existente do Control Center e a
release opção 2 de ponta a ponta num workspace limpo (zero regressão).

## 12. Documentação a atualizar (na mesma entrega)

| Doc | O quê |
|---|---|
| `scripts/control-center/README.md` | nova lib na tabela de delegação; fluxo, critérios e exemplos (limpo / só-V3 / bloqueio) |
| `scripts/control-center/CHANGELOG.md` | entrada V2.2 — Workspace Intelligence |
| `ENGINEERING.md` | parágrafo curto no fluxo de release: workspace analisado por contexto; decisão sempre do operador; ALTO/CRÍTICO nunca publica |
| Este documento (plans/) | é a ARCHITECTURE exigida pela spec; corrigir aqui se a implementação divergir com justificativa aceita |

## 13. Invariantes de segurança (a revisão reprova se violar qualquer um)

1. Nenhum arquivo ≥ MÉDIO é publicável — sem prompt que permita, sem
   flag que contorne, sem variável de ambiente de escape.
2. Nenhuma continuação automática em fluxo interativo: sempre prompt,
   default cancelar, sem-TTY cancela.
3. `--check-homologacao` continua mudo (só exit code) — contrato do
   subir-ok.
4. Menu 1/2/3/8/0 do release-center inalterado (consumido por
   `release.sh:93,108`).
5. Lib ausente/ilegível/sintaxe inválida ⇒ todos os gates bloqueiam
   (fail closed).
6. Toda decisão (inclusive automática) gera log JSON+TXT com
   justificativa e autor da decisão.
7. `~/.bashrc`: apenas os diffs da Seção 8, com backup prévio.
8. Proibido nesta Sprint: push, tag, publicação, modificar
   V3/CRM/SaaS/Rules/Functions, alterar ordem/conteúdo das suítes,
   tocar em `known_flakes.json`.

## 14. Critérios de aceitação (checklist da revisão técnica)

- [ ] Workspace analisado por contexto (4 contextos de release + subir + subir-ok + homologacao)
- [ ] Dependências detectadas (3 mecanismos da Seção 6)
- [ ] Impacto calculado por arquivo + geral (pior caso)
- [ ] Relatório e prompts no formato da Seção 7
- [ ] Bloqueios apenas quando necessários (cenário só-V3 não bloqueia; CRM bloqueia)
- [ ] Nenhum falso negativo conhecido (default-deny testado — teste 7)
- [ ] Compatibilidade total com V2.1 (menu, contratos, exceção runtime, flakes)
- [ ] Nenhuma regressão (suíte completa + release opção 2 ponta a ponta)
- [ ] Testes 1-11 aprovados
- [ ] Documentação da Seção 12 atualizada
- [ ] Logs JSON+TXT auditáveis em logs/workspace-analysis/
- [ ] Performance < 2s comprovada

## 15. Riscos conhecidos e mitigação

| Risco | Mitigação |
|---|---|
| Classificação errada libera arquivo que afeta a release | default-deny (AD-1) + reverse-grep (Seção 6.2) + lista curada + testes 5/7 |
| Prompt novo confundir o operador acostumado ao bloqueio seco | UX da Seção 7 nomeia projeto, impacto e motivo; opção 2 mostra tudo |
| Sessões concorrentes alterarem o workspace entre prompt e gate | gates reanalisam o estado ao vivo a cada chamada (AD-5); cache é por hash do estado, não por tempo |
| Edição do `~/.bashrc` quebrar o shell do dono | diff mínimo especificado, backup obrigatório, `bash -n` no arquivo após editar |
| Análise lenta em workspace grande | orçamento da Seção 10 + teste 9 |
