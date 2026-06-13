# 🚀 INSTRUÇÕES DE DEPLOY - GITHUB/FIREBASE

## 📋 RESUMO

Este documento contém as instruções passo-a-passo para:
1. Adicionar os arquivos ao repositório GitHub
2. Fazer commit com mensagem apropriada
3. Fazer push para GitHub
4. Firebase Hosting faz deploy automático

---

## ⚙️ PRÉ-REQUISITOS

- Git instalado e configurado
- Acesso ao repositório: `https://github.com/itamaratento/Cell-City-Site`
- Firebase CLI instalado (opcional, para verificar)

---

## 🔧 PASSO 1: PREPARAR OS ARQUIVOS

Os 4 arquivos gerados estão prontos:

```
1_INDEX_MENU_ATUALIZADO.html    → Será o novo index.html
2_AUTOATENDIMENTO.html          → Novo arquivo: /autoatendimento.html
3_CONSULTAR_OS.html             → Novo arquivo: /consultar-os.html
4_FIREBASE.JSON                 → Atualizado firebase.json
```

### O que cada arquivo faz:

| Arquivo | Função | Ação |
|---------|--------|------|
| `index.html` | Homepage com menu atualizado | Substituir o existente |
| `autoatendimento.html` | Redirecionamento para CRM | Novo arquivo |
| `consultar-os.html` | Estrutura futura | Novo arquivo |
| `firebase.json` | Configura rewrites de URL | Substituir o existente |

---

## 📥 PASSO 2: FAZER DOWNLOAD/COPIAR OS ARQUIVOS

### Opção A: Clone do repositório (recomendado)

```bash
# 1. Clone o repositório
git clone https://github.com/itamaratento/Cell-City-Site.git
cd Cell-City-Site

# 2. Crie um novo branch para esta mudança
git checkout -b feature/autoatendimento-integration
```

### Opção B: Trabalhe no branch existente

```bash
# Se já tem o repositório clonado
cd Cell-City-Site
git pull origin main
```

---

## ✏️ PASSO 3: ADICIONAR OS NOVOS ARQUIVOS

```bash
# 1. Copie o arquivo atualizado
# Substituir o index.html existente com conteúdo de "1_INDEX_MENU_ATUALIZADO.html"
cp 1_INDEX_MENU_ATUALIZADO.html index.html

# 2. Copie o novo arquivo de autoatendimento
cp 2_AUTOATENDIMENTO.html autoatendimento.html

# 3. Copie o novo arquivo de consultar-os
cp 3_CONSULTAR_OS.html consultar-os.html

# 4. Atualize firebase.json
cp 4_FIREBASE.JSON firebase.json

# Verificar que os arquivos foram criados
ls -la index.html autoatendimento.html consultar-os.html firebase.json
```

---

## 🔍 PASSO 4: VERIFICAR MUDANÇAS

```bash
# Ver quais arquivos foram modificados
git status

# Deve mostrar algo como:
# Modified: index.html, firebase.json
# Untracked: autoatendimento.html, consultar-os.html
```

---

## 📝 PASSO 5: FAZER COMMIT

```bash
# 1. Adicionar todos os arquivos ao staging
git add index.html autoatendimento.html consultar-os.html firebase.json

# 2. Fazer commit com mensagem descritiva
git commit -m "Add Autoatendimento integration with friendly URLs

Features:
- Added 'Abrir Atendimento' button in menu and banner
- Added 'Consultar OS' link in menu (future feature)
- Configured Firebase rewrites for /autoatendimento and /consultar-os
- Integrated with shared Firestore database
- No changes to existing CRM logic

Changes:
- Updated index.html with new menu items and buttons
- Created autoatendimento.html (redirects to CRM)
- Created consultar-os.html (future feature structure)
- Updated firebase.json with URL rewrites"

# 3. Verificar commit
git log --oneline -1
```

---

## 🚀 PASSO 6: FAZER PUSH PARA GITHUB

```bash
# 1. Fazer push do branch
git push origin feature/autoatendimento-integration

# OU, se estiver na main branch:
git push origin main

# Verificar que o push foi bem-sucedido
git log -1 --pretty=format:"%H %s"
```

---

## ⏳ PASSO 7: FIREBASE FAZ DEPLOY AUTOMÁTICO

Após fazer push para GitHub, **Firebase Hosting detecta automaticamente**:

1. **GitHub detecta push** → ~30 segundos
2. **Firebase CI/CD ativa** → ~1 minuto
3. **Deploy realizado** → ~2 minutos

**Você NÃO precisa fazer nada!** Firebase faz tudo automaticamente.

### Monitorar deploy:

```bash
# Opção 1: Acessar Firebase Console
# https://console.firebase.google.com/
# Projeto: cellcity-crm
# Aba: Hosting → Histórico de deploy

# Opção 2: Usar Firebase CLI (se instalado)
firebase hosting:channel:list

# Opção 3: Acessar o site em ~3-5 minutos
# https://www.cellcityinformatica.com.br/autoatendimento
```

---

## ✅ PASSO 8: TESTAR URLS AMIGÁVEIS

Após deploy (espere 3-5 minutos):

```
Teste 1: Abrir Atendimento
URL: https://www.cellcityinformatica.com.br/autoatendimento
Resultado esperado: Abre página de carregamento, depois redireciona para CRM

Teste 2: Consultar OS
URL: https://www.cellcityinformatica.com.br/consultar-os
Resultado esperado: Abre página com estrutura futura

Teste 3: Menu no site
Ação: Clicar em "📱 Abrir Atendimento" no menu
Resultado esperado: Leva para /autoatendimento

Teste 4: Menu no site
Ação: Clicar em "🔍 Consultar OS" no menu
Resultado esperado: Leva para /consultar-os
```

---

## ⚠️ TROUBLESHOOTING

### Se as URLs não funcionarem:

**Problema 1: Deploy não foi realizado**
```
Solução: Aguarde mais 5 minutos e tente novamente
Verificar: https://console.firebase.google.com/
```

**Problema 2: Cache do navegador**
```
Solução: Limpar cache (Ctrl+Shift+Delete) e recarregar
Ou: Usar modo incógnito (Ctrl+Shift+N)
```

**Problema 3: Erro no firebase.json**
```
Solução: Verificar sintaxe JSON (validar em jsonlint.com)
Corrigir erros e fazer novo commit/push
```

**Problema 4: Redirecionamento não funciona**
```
Solução: Verificar se autoatendimento.html está sendo servido
Limpar cache do navegador e tentar novamente
```

---

## 📊 VERIFICAÇÃO FINAL

```bash
# Comando para verificar que tudo foi commitado
git log --oneline -5

# Deve mostrar o commit "Add Autoatendimento integration..." no topo

# Verificar arquivos no repositório
ls -la | grep -E "(index|autoatendimento|consultar|firebase)"

# Deve listar:
# index.html
# autoatendimento.html
# consultar-os.html
# firebase.json
```

---

## 🎯 RESUMO RÁPIDO

```bash
# 1. Clonar repositório
git clone https://github.com/itamaratento/Cell-City-Site.git
cd Cell-City-Site

# 2. Copiar arquivos
cp 1_INDEX_MENU_ATUALIZADO.html index.html
cp 2_AUTOATENDIMENTO.html autoatendimento.html
cp 3_CONSULTAR_OS.html consultar-os.html
cp 4_FIREBASE.JSON firebase.json

# 3. Fazer commit
git add .
git commit -m "Add Autoatendimento integration"

# 4. Fazer push
git push origin main

# 5. Aguardar deploy (3-5 minutos)
# 6. Testar URLs
```

---

## ✨ RESULTADO FINAL

Após deploy com sucesso:

✅ URL amigável `/autoatendimento` funciona  
✅ URL amigável `/consultar-os` funciona  
✅ Menu atualizado com novos botões  
✅ Redirecionamento interno oculto  
✅ Mesmo Firestore compartilhado com CRM  
✅ Nenhuma alteração no CRM existente  

---

## 📞 SUPORTE

Se houver problemas:

1. Verificar status de deploy em Firebase Console
2. Limpar cache do navegador (Ctrl+Shift+Delete)
3. Aguardar 5 minutos adicionais
4. Contactar desenvolvedor do CRM se necessário

---

**Data de Criação:** 2 de junho de 2026  
**Versão:** 1.0  
**Status:** Pronto para implementação
