# 📋 DIAGNÓSTICO — ETAPA 4

**Data:** 05/06/2026
**Objetivo:** Mapear fluxo completo: Cliente → Solicitação Diagnóstico → Admin → Botão Criar OS → Tela OS → OS criada automaticamente
**Tipo:** Análise arquitetural (sem implementação)

---

## 1. ARQUIVOS ENVOLVIDOS

| Arquivo | Função | Linhas-chave |
|---------|--------|-------------|
| [`portal.js`](CRM/pages/portal-cliente/portal.js) | Portal do Cliente — envio da solicitação | 1461-1499 |
| [`admin.js`](CRM/pages/portal-cliente/admin.js) | Painel Admin — listagem + botão Criar OS | 622-708 |
| [`os.js`](CRM/pages/os/os.js) | Tela de Ordem de Serviço — criação da OS | 427-459, 800, 1150-1183 |
| [`os/index.html`](CRM/pages/os/index.html) | Página HTML da OS | 1-231 |

---

## 2. COLEÇÕES FIRESTORE ENVOLVIDAS

### `solicitacoes_diagnostico` (origem: Portal)
Coleção onde as solicitações de diagnóstico são armazenadas.

### `os` (destino: OS)
Coleção onde as ordens de serviço são criadas.

### `pre_os` (origem alternativa: Autoatendimento)
Coleção de pré-OS do Autoatendimento — já tem fluxo de conversão implementado.

---

## 3. CAMPOS ENVOLVIDOS

### Campos que o Portal ENVIA (`solicitacoes_diagnostico`)

| Campo | Valor | Onde | Origem |
|-------|-------|------|--------|
| `telefone` | `(XX) XXXXX-XXXX` | [`portal.js:1481`](CRM/pages/portal-cliente/portal.js:1481) | Sessão do cliente |
| `clientName` | Nome do cliente | [`portal.js:1482`](CRM/pages/portal-cliente/portal.js:1482) | Sessão do cliente |
| `descricao` | Texto livre do problema | [`portal.js:1483`](CRM/pages/portal-cliente/portal.js:1483) | Input do cliente |
| `status` | `'pendente'` | [`portal.js:1484`](CRM/pages/portal-cliente/portal.js:1484) | Fixo |
| `respondido` | `false` | [`portal.js:1485`](CRM/pages/portal-cliente/portal.js:1485) | Fixo |
| `origem` | `'portal'` | [`portal.js:1486`](CRM/pages/portal-cliente/portal.js:1486) | Fixo |
| `createdAt` | `serverTimestamp()` | [`portal.js:1487`](CRM/pages/portal-cliente/portal.js:1487) | Firestore |

### Campos que o Admin ENVIA via URL (`_criarOS()`)

| Parâmetro URL | Origem no `solicitacoes_diagnostico` | Linha |
|--------------|--------------------------------------|-------|
| `nome` | `item.clientName \|\| item.nome` | [`admin.js:695`](CRM/pages/portal-cliente/admin.js:695) |
| `telefone` | `item.telefone` | [`admin.js:696`](CRM/pages/portal-cliente/admin.js:696) |
| `equipamento` | `item.tipoEquipamento \|\| item.equipamento` | [`admin.js:697`](CRM/pages/portal-cliente/admin.js:697) |
| `marca` | `item.marca` | [`admin.js:698`](CRM/pages/portal-cliente/admin.js:698) |
| `modelo` | `item.modelo` | [`admin.js:699`](CRM/pages/portal-cliente/admin.js:699) |
| `defeito` | `item.defeito \|\| item.descricao` | [`admin.js:700`](CRM/pages/portal-cliente/admin.js:700) |

**⚠️ Problema:** O Portal NÃO envia `tipoEquipamento`, `equipamento`, `marca`, `modelo`, `defeito`. Esses campos ficarão em branco na URL.

### Campos que a OS EXIGE (obrigatórios) e seus IDs de formulário

| ID do input | Campo na OS | Obrigatório? | Origem |
|------------|-------------|-------------|--------|
| `f-nome` | `clientName` | ✅ **Sim** | [`os.js:434`](CRM/pages/os/os.js:434) |
| `f-telefone` | `phone` | ✅ **Sim** | [`os.js:434`](CRM/pages/os/os.js:434) |
| `f-modelo` | `model` | ✅ **Sim** | [`os.js:434`](CRM/pages/os/os.js:434) |
| `f-defeito` | `defect` | ✅ **Sim** | [`os.js:434`](CRM/pages/os/os.js:434) |
| `f-marca` | `brand` | ❌ Opcional | — |
| `f-imei` | `imei` | ❌ Opcional | — |
| `f-valor` | `valor` | ❌ Opcional | — |
| `f-tecnico` | `technician` | ❌ Opcional | — |
| `f-senha` | `password` | ❌ Opcional | — |
| `f-obs` | `observations` | ❌ Opcional | — |
| `lock-type` | `lockType` | ❌ Opcional | — |
| `f-garantia` | `prazoGarantia` | ❌ Opcional (default 90) | — |

**Campos obrigatórios que podem ser pré-preenchidos:**
- ✅ `f-nome` = `clientName` da solicitação
- ✅ `f-telefone` = `telefone` da solicitação
- ✅ `f-defeito` = `descricao` da solicitação

**Campos obrigatórios SEM correspondência:**
- ❌ `f-modelo` — **NÃO é enviado pelo Portal** (o cliente só descreve o problema em texto livre)

---

## 4. FLUXO ATUAL (O QUE ACONTECE HOJE)

```
Cliente
  │
  ▼
[Portal] Preenche descricao (texto livre do problema)
  │
  ▼  addDoc('solicitacoes_diagnostico')
[Firestore] Coleção: solicitacoes_diagnostico
  │  Campos salvos: telefone, clientName, descricao, status='pendente', origem='portal'
  │
  ▼  onSnapshot() ← Tempo real
[Admin] renderSolicitacoes() exibe:
  │  - Nome: ✅ clientName
  │  - Telefone: ✅ telefone
  │  - Equipamento: ❌ "—" (não enviado)
  │  - Marca: ❌ vazio (não enviado)
  │  - Modelo: ❌ vazio (não enviado)
  │  - Defeito: ✅ descricao (exibe em "Defeito")
  │  - Botão "📋 Criar OS"
  │
  ▼  _criarOS(firestoreId)
[Admin] Monta URL:
  │  ../os/index.html?nome=X&telefone=Y&equipamento=&marca=&modelo=&defeito=Z
  │
  ▼  window.open(url, '_blank')
[Tela OS] Abre nova aba com CRM/pages/os/index.html
  │
  ▼  init() → verificarConversaoPreOS()
  │  Lê sessionStorage.getItem('cc_dados_preos')
  │  ❌ NÃO existe (só existe no fluxo do Autoatendimento)
  │  ❌ NÃO lê parâmetros da URL
  │
  ▼  startOS() ← chamado sem categoria
  │  🔴 Limpa TODOS os campos do formulário
  │  🔴 Ignora completamente os parâmetros da URL
  │
  └── Resultado: Técnico vê formulário EM BRANCO
```

---

## 5. FLUXO DESEJADO (ETAPA 4)

```
Cliente
  │
  ▼
[Portal] Campos adicionais necessários:
  │  - equipamento (select: Celular/Notebook/Impressora)
  │  - marca (opcional)
  │  - modelo (opcional)
  │  - descricao (obrigatório, já existe)
  │
  ▼  addDoc('solicitacoes_diagnostico')
[Firestore] Campos adicionais:
  │  tipoEquipamento, marca, modelo
  │
  ▼  onSnapshot()
[Admin] Exibe campos completos
  │
  ▼  Clica "Criar OS"
[Admin → OS] Mecanismo de ponte:
  │
  │  OPÇÃO A: Salvar no sessionStorage antes de abrir
  │  ─────────────────────────────────────────────────
  │  admin.js: sessionStorage.setItem('cc_dados_portal_os', JSON.stringify({...}))
  │  os.js: verificarConversaoPortalOS() lê do sessionStorage
  │  → Similar ao fluxo verificarConversaoPreOS()
  │
  │  OPÇÃO B: Abrir com categoria + dados na URL
  │  ──────────────────────────────────────────
  │  admin.js: window.open(`../os/index.html#criar?cat=celular&...`)
  │  os.js: lê location.hash ou parâmetros
  │
  ▼  Formulário pré-preenchido com:
  │  - Nome: ✅ clientName
  │  - Telefone: ✅ telefone
  │  - Equipamento: ✅ tipoEquipamento (define categoria)
  │  - Marca: ✅ marca
  │  - Modelo: ✅ modelo
  │  - Defeito: ✅ descricao
  │  - Observações: "Solicitação via Portal do Cliente"
  │
  ▼  Técnico revisa e clica Salvar
[Tela OS] saveOS() → addDoc('os', {...})
  │
  ▼  Opcional: marcar solicitacao_diagnostico como convertida
[Admin] atualiza status da solicitação para 'convertido' + vincula OS ID
```

---

## 6. DIFERENÇAS ENCONTRADAS

| Aspecto | Estado Atual | Estado Desejado |
|---------|-------------|-----------------|
| **Portal: campos da solicitação** | Só `descricao` (texto livre) | Adicionar `tipoEquipamento`, `marca`, `modelo` |
| **Admin → OS: passagem de dados** | URL params (ignorados pela OS) | sessionStorage ou hash |
| **OS: leitura de dados externos** | Só `sessionStorage('cc_dados_preos')` | Novo storage key `cc_dados_portal_os` |
| **OS: categoria** | Fixa `'celular'` no startOS() | Deve vir da solicitação |
| **OS: origem** | Não tem campo de origem | Adicionar `origem: 'portal'` |
| **Vinculação OS ↔ Solicitação** | Não existe | Adicionar campo `solicitacaoId` na OS + marcar solicitação como convertida |

---

## 7. O QUE FALTA IMPLEMENTAR

### 7.1. Portal — Adicionar campos na solicitação
**Arquivo:** [`portal.js`](CRM/pages/portal-cliente/portal.js)
- Adicionar campos no formulário `renderContato()` (ou criar tela dedicada):
  - `tipoEquipamento` (select: Celular, Notebook, Impressora)
  - `marca` (input opcional)
  - `modelo` (input opcional)
- Atualizar `_enviarSolicitacaoDiagnostico()` para enviar esses campos

### 7.2. Admin — Melhorar exibição da solicitação
**Arquivo:** [`admin.js`](CRM/pages/portal-cliente/admin.js)
- Os campos `tipoEquipamento`, `marca`, `modelo` já são lidos em `renderSolicitacoes()` (linhas 657-659)
- Serão exibidos automaticamente quando o Portal passar a enviá-los

### 7.3. Admin → OS — Criar mecanismo de ponte
**Arquivo:** [`admin.js`](CRM/pages/portal-cliente/admin.js)
- Em `_criarOS()` (linha 690), salvar dados no sessionStorage antes de abrir a página:
  ```javascript
  sessionStorage.setItem('cc_dados_portal_os', JSON.stringify({
      clienteNome: item.clientName,
      clienteWhatsapp: item.telefone,
      aparelhoMarca: item.marca,
      aparelhoModelo: item.modelo,
      tipoEquipamento: item.tipoEquipamento,
      defeito: item.descricao,
      origem: 'portal',
      solicitacaoId: firestoreId
  }));
  ```

### 7.4. OS.js — Criar função de conversão para Portal
**Arquivo:** [`os.js`](CRM/pages/os/os.js)
- Criar `verificarConversaoPortalOS()` similar a `verificarConversaoPreOS()`:
  - Ler `sessionStorage.getItem('cc_dados_portal_os')`
  - Chamar `startOS(tipoEquipamento)` com a categoria correta
  - Preencher todos os campos do formulário
  - Adicionar `origem: 'portal'` no objeto OS ao salvar
  - Marcar solicitação como convertida (similar ao fluxo `preOSPendente`)

### 7.5. OS.js — Adicionar campo `origem` no saveOS
**Arquivo:** [`os.js`](CRM/pages/os/os.js)
- Linha 440-444: Adicionar `origem: 'portal'` ou `origem: 'admin'` ao objeto OS

### 7.6. OS.js — Adicionar campo `solicitacaoId` no saveOS
**Arquivo:** [`os.js`](CRM/pages/os/os.js)
- Vincular a OS criada com a solicitação original

---

## 8. QUANTIDADE ESTIMADA DE ALTERAÇÕES

| Arquivo | Alterações | Tipo | Complexidade |
|---------|-----------|------|-------------|
| [`portal.js`](CRM/pages/portal-cliente/portal.js) | +3 campos no form, +3 campos no payload | Adição | Baixa |
| [`portal.css`](CRM/pages/portal-cliente/portal.css) | +estilos para novos campos (select, inputs) | Adição | Baixa |
| [`admin.js`](CRM/pages/portal-cliente/admin.js) | +sessionStorage no _criarOS() | Adição | Baixa |
| [`os.js`](CRM/pages/os/os.js) | +nova função de conversão (~30 linhas) + alterar saveOS (~5 linhas) + chamar no init() | Adição | Média |
| **Total** | **~5 arquivos** | **~80-120 linhas** | **Média** |

---

## 9. RISCOS

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Criar OS vazia** (situação atual) | Alta | Alto | Implementar ponte sessionStorage |
| **Perder dados da solicitação** (descricao não ir para defeito) | Média | Alto | Mapear campos corretamente |
| **Duplicidade** (criar OS sem marcar solicitação como concluída) | Média | Médio | Vincular via `solicitacaoId` + atomicidade |
| **Categoria errada na OS** (sempre celular) | Alta | Médio | Passar `tipoEquipamento` no sessionStorage |
| **Sobrescrever dados do Autoatendimento** (mesma chave sessionStorage) | Baixa | Alto | Usar chave DIFERENTE (`cc_dados_portal_os` vs `cc_dados_preos`) |
| **Campos obrigatórios da OS em branco** (modelo é obrigatório) | Alta | Alto | Adicionar campo modelo no Portal OU tornar opcional na OS |
| **Conflito com saveOS existente** (preOSPendente) | Baixa | Médio | Tratar fluxos separadamente (portalOS Pendente + preOSPendente) |

---

## 10. GRAU DE COMPLEXIDADE

**Classificação: MÉDIO**

**Justificativa:**
- O fluxo já existe parcialmente (o Autoatendimento já faz conversão similar → serve de modelo)
- O padrão de sessionStorage como ponte já está estabelecido e testado
- A maior mudança está no Portal (adicionar campos) e na OS (nova função de conversão)
- Não há necessidade de novas coleções Firestore
- O risco principal é garantir que os campos obrigatórios da OS (`modelo`) sejam preenchidos

---

## 11. RESUMO EXECUTIVO

```
FLUXO ATUAL:
  Portal → [descricao apenas] → Admin → [URL params ignorados] → OS em branco 🔴

FLUXO DESEJADO:
  Portal → [descricao + equipamento + marca + modelo] → Admin → [sessionStorage] → OS pré-preenchida ✅
```

**Principais achados:**
1. O botão "Criar OS" monta a URL com parâmetros, mas a página OS **não lê parâmetros de URL**
2. Existe um mecanismo de conversão funcional via `sessionStorage` (fluxo Autoatendimento → OS) que pode ser **reutilizado como padrão**
3. O Portal precisa coletar `tipoEquipamento` para definir a categoria da OS (celular/notebook/impressora)
4. O campo `modelo` é obrigatório na OS — precisa ser adicionado ao formulário do Portal ou tornado opcional na validação
5. A OS atual não tem campo `origem` — importante para rastrear que veio do Portal

**Total estimado de alterações:** ~80-120 linhas em 5 arquivos.

---

*Relatório gerado em 05/06/2026 • Apenas diagnóstico — nenhuma implementação realizada*
