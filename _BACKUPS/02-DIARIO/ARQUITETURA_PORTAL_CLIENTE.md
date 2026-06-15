# ARQUITETURA — Portal do Cliente Cell City

## 1. LOCALIZAÇÃO NO PROJETO

O Portal do Cliente será criado como um módulo dentro da estrutura existente do CRM:

```
CRM/
├── shared/
│   ├── dock.js
│   └── dock.css
├── scripts/
│   └── firebase.js                    ← JÁ EXISTE (Firebase SDK compartilhado)
├── pages/
│   ├── dashboard/                     ← JÁ EXISTE
│   ├── os/                            ← JÁ EXISTE
│   ├── pos-venda/                     ← JÁ EXISTE
│   ├── chat/                          ← JÁ EXISTE (vazio)
│   ├── clientes/                      ← JÁ EXISTE
│   ├── estoque/                       ← JÁ EXISTE
│   ├── caixa/                         ← JÁ EXISTE
│   ├── config/                        ← JÁ EXISTE
│   ├── garantias/                     ← JÁ EXISTE (garantia.html na raiz do CRM)
│   └── portal-cliente/                ← NOVO MÓDULO
│       ├── index.html                 ← Tela de Login (telefone)
│       ├── portal.css                 ← Estilos do Portal
│       ├── portal.js                  ← Lógica principal
│       ├── modulo-os.html             ← Minhas Ordens de Serviço (SPA via JS)
│       ├── modulo-garantias.html      ← Minhas Garantias (SPA via JS)
│       └── modulo-contato.html        ← Contato (SPA via JS)
```

### 2. ACESSO EXTERNO (Site)

Para acesso externo pelo cliente via `www.cellcityinformatica.com.br/portal`:

**Opção recomendada**: Configurar redirecionamento no Firebase Hosting ou no servidor DNS.

No [`firebase.json`](CRM/firebase.json), adicionar:

```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "/portal",
        "destination": "/CRM/pages/portal-cliente/index.html"
      },
      {
        "source": "/portal/**",
        "destination": "/CRM/pages/portal-cliente/index.html"
      }
    ]
  }
}
```

Ou criar arquivo [`portal/index.html`](portal/index.html) na raiz do projeto (fora do CRM) que redireciona ou carrevia o portal em iframe — mas a **regra de ouro** é não duplicar dados, então o ideal é o rewrite direto.

---

## 3. MAPEAMENTO DAS COLEÇÕES DO FIRESTORE

O Portal **reutiliza** as coleções existentes do CRM. Nenhuma coleção nova será criada para dados primários.

### 3.1 Coleções Existentes (Reutilizadas)

| Coleção | Uso no Portal | Campos Principais |
|---------|---------------|-------------------|
| [`os`](CRM/pages/os/os.js:414) | Listar OS do cliente, status, orçamento, aprovação | `id`, `clientName`, `phone`, `model`, `defect`, `status`, `observations`, `timeline[]`, `createdAt`, `updatedAt`, `valorOrcamento` |
| [`clientes`](CRM/pages/os/os.js:322) | Buscar cliente por telefone, nome | `name`, `phone`, `history[]`, `createdAt` |
| [`orders`](CRM/scripts/firebase.js:63) | Fallback (coleção antiga) | Mesma estrutura de `os` |
| [`posvenda_contatos`](CRM/pages/pos-venda/posvenda.js:54) | Histórico de contatos | `osId`, `prazo`, `dataContato` |
| [`posvenda_mensagens`](CRM/pages/pos-venda/posvenda.js:103) | Mensagens template | `5`, `15`, `30` (ID = prazo) |

### 3.2 Coleção de Garantias

Atualmente as garantias são configuradas via `localStorage` (`cc_config_impressao`) ou documento `config/impressao` no Firestore.

**Proposta**: Criar coleção [`garantias`](CRM/pages/os/os.js:564) no Firestore com:

```javascript
{
  osId: "OS-1054",
  clienteId: "62999999999",
  tipo: "Troca de Tela",
  modelo: "Samsung A15",
  dataInicio: "2026-06-04",
  dataFim: "2026-09-15",
  status: "ativa", // ativa | expirada | cancelada
  createdAt: Timestamp
}
```

### 3.3 Coleção de Mensagens do Cliente (NOVA)

Para o módulo "Falar com a Cell City", será criada a coleção:

[`mensagens_portal`](CRM/pages/portal-cliente/portal.js)

```javascript
{
  id: "auto_id",
  clientePhone: "62999999999",
  clienteNome: "João Silva",
  assunto: "Orçamento",
  mensagem: "Meu aparelho já ficou pronto?",
  lida: false,            // false = pendente no Dashboard
  lidaEm: null,           // timestamp quando lida
  respondida: false,
  resposta: "",
  createdAt: Timestamp,
  origem: "portal"         // "portal" | "crm"
}
```

### 3.4 Coleção de Avaliações (NOVA)

[`avaliacoes`](CRM/pages/portal-cliente/portal.js)

```javascript
{
  id: "auto_id",
  clientePhone: "62999999999",
  clienteNome: "João Silva",
  osId: "OS-1054",
  nota: 5,                // 1 a 5
  comentario: "",         // preenchido se nota <= 3
  encaminhadoGoogle: false, // true se nota >= 4
  createdAt: Timestamp
}
```

---

## 4. FLUXO DE LOGIN

### 4.1 Fluxo

```
Cliente acessa /portal
         ↓
    Tela: "Digite seu telefone"
         ↓
    Cliente digita (62) XXXXX-XXXX
         ↓
    Sistema formata e busca no Firestore:
      - Coleção "clientes" → where("phone", "==", telefone)
      - Coleção "os" → where("phone", "==", telefone)
         ↓
    Cliente encontrado? ──Não──→ "Telefone não encontrado.
                                  Verifique se este número
                                  foi cadastrado em sua OS."
         ↓
    Sim
         ↓
    Salva sessão no sessionStorage:
      { clientePhone, clienteNome, loginAt }
         ↓
    Redireciona para painel principal
```

### 4.2 Validação

- Formatação automática do telefone: `(62) 99999-9999`
- Busca pelo telefone na coleção `clientes` (campo `phone`)
- Se não encontrar, busca na coleção `os` (campo `phone`) para listar OS mesmo sem cadastro
- Se nenhum resultado, exibe mensagem amigável

### 4.3 Sessão

- `sessionStorage.setItem('portal_session', JSON.stringify({ phone, name, loginAt }))`
- Se o usuário fechar a aba, precisa logar novamente (segurança)
- Versão 2: armazenar em `localStorage` com expiry de 7 dias

---

## 5. FLUXO DAS ORDENS DE SERVIÇO

```
Painel Principal
    ↓
"📋 Minhas Ordens de Serviço"
    ↓
Busca: collection("os").where("phone", "==", telefone)
    ↓
Lista todas as OS do cliente (ordenadas por createdAt desc)
    ↓
Exibe card para cada OS:
  • OS-1054
  • Samsung A15
  • Status: 🟢 Pronto para retirada
  • [Acompanhar]
    ↓
Cliente clica [Acompanhar]
    ↓
Exibe Detalhes da OS:
  • Timeline completa
  • Data de entrada
  • Serviço executado
  • Valor aprovado (se houver)
  • Observações
  • Status atual
```

### 5.1 Mapeamento de Status

| Status no CRM | Exibição no Portal | Cor |
|---------------|-------------------|-----|
| `em_analise` | Em análise | 🔵 |
| `aguardando_peca` | Aguardando peça | 🟡 |
| `em_reparo` | Em reparo | 🟠 |
| `orcamento` | Orçamento pendente | 🟣 |
| `pronto` | Pronto para retirada | 🟢 |
| `entregue` | Finalizado | ⚪ |
| `devolvido_orcamento` | Orçamento recusado | 🔴 |

A timeline mostra cada etapa concluída com ✓.

---

## 6. FLUXO DAS GARANTIAS

```
Painel Principal
    ↓
"🛡️ Minhas Garantias"
    ↓
Busca no Firestore:
  collection("garantias").where("clienteId", "==", telefone)
    ↓
Exibe cards de garantia:
  • 🟢 Troca de Tela - Samsung A15
  • Garantia até: 15/09/2026
  • 72 dias restantes
    ↓
Cálculo de dias restantes:
  const dias = Math.ceil((dataFim - hoje) / 86400000)
    ↓
Se dias <= 0 → exibir "Garantia expirada" em vermelho
Se dias <= 30 → exibir "⚠️ Vence em breve" em amarelo
```

### 6.1 Origem dos Dados

As garantias podem ser:
1. **Registradas manualmente** no módulo de Garantias do CRM
2. **Vinculadas a OS** com status "entregue" + campo `garantiaAte`
3. **Importadas** da configuração de impressão (`config/impressao`)

O Portal priorizará a coleção `garantias` no Firestore.

---

## 7. FLUXO DE AVALIAÇÃO

```
Painel Principal
    ↓
"⭐ Avaliar Atendimento"
    ↓
Exibe 5 estrelas clicáveis
    ↓
Cliente seleciona:
    ↓
Nota >= 4? ──Sim──→ "Obrigado! Sua opinião é muito importante."
    │                   ↓
    │               "🌟 Avaliar no Google"
    │                   ↓
    │               Abre URL: https://g.page/r/CELLCITY/review
    │                   ↓
    │               Salva no Firestore: avaliacoes { nota, encaminhadoGoogle: true }
    │
    └──Não (nota <= 3)──→ "Como podemos melhorar?"
                            ↓
                        Campo de comentário
                            ↓
                        Cliente escreve → [Enviar]
                            ↓
                        Salva no Firestore: avaliacoes { nota, comentario }
                            ↓
                        Gera alerta no Dashboard:
                          "🔴 Nova avaliação 3 estrelas de João Silva"
```

---

## 8. FLUXO DE MENSAGENS (Falar com a Cell City)

```
Painel Principal
    ↓
"💬 Falar com a Cell City"
    ↓
Exibe formulário:
  • Assunto: [input]
  • Mensagem: [textarea]
  • [ENVIAR]
    ↓
Cliente preenche e clica [ENVIAR]
    ↓
Salva no Firestore: collection("mensagens_portal").add({...})
    ↓
Gera ALERTA no Dashboard:
  • card "🔴 Portal do Cliente (1)"
  • Exibe na Central de Mensagens
    ↓
CRM:
  • Dashboard.js escuta onSnapshot("mensagens_portal", where("lida","==",false))
  • Conta mensagens não lidas
  • Exibe badge no card do Portal
    ↓
Funcionário clica no alerta:
  • Abre painel de mensagens pendentes
  • Pode responder direto no CRM
  • Marca como lida
```

### 8.1 Integração com Dashboard

No [`dashboard.js`](CRM/pages/dashboard/dashboard.js), adicionar:

```javascript
// Dentro de setupAlerts() ou gerarAlertas()
const msgSnap = await getDocs(
  query(collection(db, "mensagens_portal"), where("lida", "==", false))
);
if (msgSnap.size > 0) {
  alertas.push({
    icon: '💬',
    cat: 'critico',
    title: `Portal do Cliente (${msgSnap.size})`,
    sub: `${msgSnap.size} mensagem(ns) não lida(s)`,
    detail: 'Clientes enviaram mensagens pelo Portal. Acesse para responder.'
  });
}
```

### 8.2 Badge no Card do Dashboard

Adicionar ao HTML do Dashboard:

```html
<div class="module-card" data-module="portal-cliente">
  <div class="module-icon">👤</div>
  <div class="module-info">
    <h3>Portal do Cliente</h3>
    <p class="module-sub">Mensagens de clientes</p>
  </div>
  <div class="module-indicator">
    <span class="portal-badge" id="portal-badge" style="display:none;">0</span>
  </div>
</div>
```

---

## 9. FLUXO DE APROVAÇÃO DE ORÇAMENTO

```
Detalhes da OS
    ↓
Status = "orcamento"?
    ↓
Sim → Exibe card de aprovação:
  • Troca de Tela
  • R$ 180,00
  • [👍 Aprovar]    [👎 Recusar]
    ↓
Cliente clica [Aprovar]:
    ↓
1. Atualiza OS no Firestore:
   updateDoc(doc(db, "os", osId), {
     status: "em_reparo",
     orcamentoAprovado: true,
     orcamentoAprovadoEm: serverTimestamp(),
     orcamentoAprovadoPor: clienteNome
   })
2. Adiciona na timeline:
   "Orçamento aprovado pelo cliente"
3. Gera alerta no Dashboard:
   "💰 Orçamento aprovado - OS-1054"
    ↓
Cliente clica [Recusar]:
    ↓
1. Atualiza OS:
   updateDoc(doc(db, "os", osId), {
     status: "orcamento_recusado",
     orcamentoAprovado: false,
     orcamentoRecusadoEm: serverTimestamp()
   })
2. Adiciona na timeline:
   "Orçamento recusado pelo cliente"
3. Gera alerta no Dashboard
```

---

## 10. ESTRUTURA DO PAINEL PRINCIPAL (Pós-login)

```
┌─────────────────────────────────────────┐
│  CELL CITY · Portal do Cliente           │
│  ───────────────────────────────────    │
│  Olá, João Silva                         │
│                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ 📋   │ │ 🛡️   │ │ ⭐   │ │ 🌟   │   │
│  │Minhas│ │Minhas│ │Avaliar│ │Avaliar│   │
│  │  OS  │ │Garant│ │Atend. │ │ Google│   │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ 💬   │ │ 📞   │ │ 📍   │ │ 🕒   │   │
│  │ Falar│ │Contat│ │Loca. │ │Horário│   │
│  │Cell C│ │      │ │      │ │      │   │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│                                          │
│  Versão 2 Em Breve:                      │
│  🎁 Cupons 📢 Promoções 📸 Fotos        │
│  🛒 Catálogo 🎟️ Fidelidade              │
└─────────────────────────────────────────┘
```

---

## 11. INTEGRAÇÃO COM DASHBOARD E CENTRAL DE ALERTAS

### 11.1 Eventos que disparam alertas no Dashboard

| Evento | Origem | Destino | Prioridade |
|--------|--------|---------|------------|
| Nova mensagem no Portal | `mensagens_portal` | Dashboard badge + Central Alertas | Crítica |
| Nova avaliação (<=3 estrelas) | `avaliacoes` | Dashboard badge | Crítica |
| Orçamento aprovado | `os` (update) | Dashboard badge | Atenção |
| Orçamento recusado | `os` (update) | Dashboard badge | Informação |

### 11.2 Escuta Realtime no Dashboard

```javascript
// No dashboard.js, dentro de setupAlerts() ou método dedicado
function setupPortalListener() {
  const q = query(
    collection(db, "mensagens_portal"),
    where("lida", "==", false)
  );
  onSnapshot(q, (snap) => {
    const badge = document.getElementById('portal-badge');
    if (badge) {
      const total = snap.size;
      badge.textContent = total;
      badge.style.display = total > 0 ? 'flex' : 'none';
    }
  });
}
```

---

## 12. VERSÃO 2 — Preparação

Sem implementação agora, mas a estrutura deve prever:

### 12.1 Cupons
- Coleção futura: `cupons`
- Campos: `codigo`, `clientePhone`, `desconto`, `validade`, `usado`

### 12.2 Promoções
- Coleção futura: `promocoes`
- Campos: `titulo`, `descricao`, `imagem`, `dataInicio`, `dataFim`

### 12.3 Fotos do Serviço
- Já existem no campo `photos` da coleção `os`
- Basta exibir no Portal na tela de detalhes da OS

### 12.4 Notificações Automáticas
- Futuro: enviar notificações via WhatsApp quando status da OS mudar

### 12.5 Catálogo de Acessórios
- Coleção futura: `catalogo`
- Campos: `nome`, `descricao`, `preco`, `imagem`, `estoque`

---

## 13. DEPENDÊNCIAS DO CRM

### 13.1 Arquivos que precisarão ser modificados

| Arquivo | Modificação |
|---------|-------------|
| [`CRM/pages/dashboard/index.html`](CRM/pages/dashboard/index.html) | Adicionar card "Portal do Cliente" na grid |
| [`CRM/pages/dashboard/dashboard.js`](CRM/pages/dashboard/dashboard.js) | Adicionar listener de mensagens, badge, alertas |
| [`CRM/pages/dashboard/dashboard.js`](CRM/pages/dashboard/dashboard.js) | Adicionar rota `portal-cliente` no `navigateTo()` |
| [`CRM/pages/dashboard/dashboard.js`](CRM/pages/dashboard/dashboard.js) | Adicionar à busca global (módulo) |
| [`CRM/shared/dock.js`](CRM/shared/dock.js) | Adicionar link externo para o Portal (opcional) |
| [`CRM/firebase.json`](CRM/firebase.json) | Adicionar rewrite para `/portal` |

### 13.2 Nenhuma dependência de bibliotecas externas

O Portal utilizará o mesmo Firebase SDK já configurado em [`CRM/scripts/firebase.js`](CRM/scripts/firebase.js).

---

## 14. RISCOS E CONSIDERAÇÕES

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Cliente com telefone não cadastrado | Alto | Exibir mensagem amigável + sugerir contato via WhatsApp |
| Múltiplos clientes com mesmo telefone | Médio | Listar todas as OS do telefone, exibir "selecione seu nome" |
| OS sem campo `phone` populado | Alto | Buscar também pelo nome (fallback) |
| Garantias sem coleção dedicada | Médio | Criar coleção `garantias` e migrar dados existentes |
| Dados sensíveis expostos | Médio | Validar regras do Firestore (só leitura do próprio telefone) |
| Performance com muitas OS | Baixo | Paginação na consulta (limite 20 OS) |

---

## 15. REGRAS DO FIRESTORE (SEGURANÇA)

Para o Portal, as regras do Firestore precisarão permitir:

```javascript
// Permitir leitura apenas do próprio telefone
match /os/{docId} {
  allow read: if request.auth != null;  // Já existe
}

match /clientes/{docId} {
  allow read: if request.auth != null;  // Já existe
}

match /garantias/{docId} {
  allow read: if request.auth != null;
}

match /mensagens_portal/{docId} {
  allow read, write: if request.auth != null;
  // Idealmente: allow write: if resource.data.clientePhone == request.auth.uid
}

match /avaliacoes/{docId} {
  allow read, write: if request.auth != null;
}
```

---

## 16. ESTRUTURA DE PASTAS (ÁRVORE COMPLETA)

```
/CRM/pages/portal-cliente/
├── index.html              ← Tela de login (telefone)
├── portal.css              ← Estilos do Portal
├── portal.js               ← Lógica principal (login, sessão, navegação)
├── painel.html             ← Painel principal (cards de módulos)
├── modulo-os.html          ← Lista de OS do cliente
├── modulo-os-detalhe.html  ← Detalhes de uma OS
├── modulo-garantias.html   ← Lista de garantias
├── modulo-avaliar.html     ← Avaliação de atendimento
├── modulo-mensagem.html    ← Falar com a Cell City
├── modulo-historico.html   ← Histórico de serviços
├── modulo-contato.html     ← Contato, WhatsApp, mapa, horário
└── modulo-orcamento.html   ← Aprovação de orçamento

Estrutura SPA (Single Page Application):
  - index.html carrega portal.js
  - portal.js gerencia toda a navegação via hash (#/os, #/garantias, etc.)
  - Conteúdo renderizado dinamicamente na div #app-content
```

---

**Documento criado em: 04/06/2026**
**Autor: Roo · Cell City CRM**
