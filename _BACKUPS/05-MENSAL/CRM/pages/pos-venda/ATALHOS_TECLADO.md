# ⌨️ ATALHOS DE TECLADO — PÓS-VENDA

Versão: 1.0  
Data: 2026-06-02

---

## 🎯 ATALHOS DISPONÍVEIS

### V — Copiar Telefone
- **Atalho:** Pressione `V`
- **Função:** Copia apenas o telefone do cliente
- **Feedback:** Toast "✅ Telefone copiado"
- **Uso:** Colar no WhatsApp, formulários, etc.

### B — Copiar Mensagem
- **Atalho:** Pressione `B`
- **Função:** Copia a mensagem conforme o prazo (5/15/30 dias)
- **Substitui automaticamente:** `{{nome}}` e `{{modelo}}`
- **Feedback:** Toast "✅ Mensagem copiada"
- **Uso:** Colar no WhatsApp para enviar ao cliente

### N — Copiar Tudo
- **Atalho:** Pressione `N`
- **Função:** Copia nome + telefone + mensagem em um bloco
- **Formato:**
  ```
  Marivalda
  (62) 98111-1111

  Olá Marivalda, como está o funcionamento do iPhone 12? Precisa de ajuda?
  ```
- **Feedback:** Toast "✅ Telefone + mensagem copiados"
- **Uso:** Colar tudo de uma vez no WhatsApp

---

## 🖱️ BOTÕES VISUAIS

Além dos atalhos, há 3 botões visíveis no card de cada atendimento:

| Botão | Atalho | Função |
|-------|--------|--------|
| 📞 Telefone | V | Copia apenas telefone |
| 💬 Mensagem | B | Copia mensagem do prazo |
| 📋 Tudo | N | Copia nome + telefone + mensagem |

**Dica:** Passe o mouse sobre o botão para ver o atalho correspondente.

---

## 📋 REGRAS DOS ATALHOS

### ✅ O que Funciona

- ✅ Atalhos funcionam quando um card está em **hover** (mouse sobre ele)
- ✅ Atalhos não interferem em inputs ou formulários
- ✅ Se estiver digitando em um campo, os atalhos são ignorados

### ❌ O que NÃO Funciona

- ❌ Atalhos não funcionam se nenhum card está em hover
- ❌ Atalhos são ignorados dentro de inputs, textareas ou formulários
- ❌ Atalhos não funcionam na aba "Histórico"

---

## 🔄 FLUXO OPERACIONAL

### Antes (5 cliques)
```
1. Clica "Copiar Mensagem"
2. Clica "Copiar Telefone"
3. Alt+Tab → WhatsApp
4. Ctrl+V (colar mensagem)
5. Ctrl+V (colar telefone)
```

### Depois (3 passos)
```
1. Pressiona N → copia tudo
2. Alt+Tab → WhatsApp
3. Ctrl+V → pronto!
```

---

## 💡 EXEMPLOS DE USO

### Exemplo 1: Usar Atalho
```
1. Abrir Pós-venda → ver lista de clientes
2. Passar mouse sobre um cliente (card em hover)
3. Pressionar N
4. Toast: "✅ Telefone + mensagem copiados"
5. Alt+Tab → WhatsApp
6. Ctrl+V → tudo pronto para enviar
```

### Exemplo 2: Usar Botões
```
1. Abrir Pós-venda → ver clientes pendentes
2. Clicar botão 📋 Tudo no card desejado
3. Toast: "✅ Telefone + mensagem copiados"
4. Alt+Tab → WhatsApp
5. Ctrl+V → enviar
```

### Exemplo 3: Separado (Telefone + Mensagem)
```
1. Pressionar V → copia telefone
2. Colar no WhatsApp (procurar contato)
3. Voltar (Alt+Tab)
4. Pressionar B → copia mensagem
5. Colar e enviar
```

---

## 🧪 TESTAR OS ATALHOS

1. **Abrir Pós-venda**
   - Menu CRM → Pós-venda
   - Aguardar carregamento

2. **Passar mouse sobre um cliente**
   - O card deve ficar em hover (destaque visual)

3. **Pressionar V, B ou N**
   - Toast deve aparecer confirmando

4. **Abrir WhatsApp (outra aba)**
   - Não precisa fechar Pós-venda

5. **Ctrl+V**
   - Dados devem colar corretamente

---

## 📞 SUPORTE

Se os atalhos não funcionarem:

1. **Verificar se está em hover:** Passe o mouse sobre o card
2. **Verificar se não está em input:** Clique fora de qualquer campo
3. **Recarregar página:** F5 ou Ctrl+R
4. **Verificar console:** F12 → Console (procurar erros)

---

## 🔮 FUTURO

Próximas melhorias planejadas:

- [ ] Estatísticas: Mensagens enviadas (hoje/semana/mês)
- [ ] Controle de Envio: Marcar como enviado
- [ ] Histórico de rastreamento: Data/hora/usuário
- [ ] Atalho customizável: Usuário escolhe suas próprias teclas

---

**Versão:** 1.0  
**Criado:** 2026-06-02  
**Atualizado:** 2026-06-02
