---
trigger: always_on
description: "Regras permanentes de segurança, backup, proteção de produção e eficiência de custos Firebase/Firestore da Cell City."
---
# Regra Permanente — Segurança e Eficiência Firebase (Cell City)

## 1. Segurança e Proteção de Dados
- Nunca exibir, imprimir, commitar ou registrar em log qualquer token, API key, senha ou chave JSON do Firebase Admin SDK.
- Sempre criar backup datado antes de modificar configurações ou arquivos críticos.
- Nunca alterar `firebase.js`, `auth.js`, `config.js`, `global.css`, `CRM/firestore.rules`, `storage.rules` ou `functions/*` sem autorização explícita.
- Nunca executar deploy em produção (`cellcity-crm`), modificar dados reais do Firestore ou alterar diretamente a branch `main` sem autorização específica.
- Trabalhar sempre isoladamente: máximo 1 módulo por Sprint, em branch dedicada derivada de `develop`.

## 2. Eficiência de Leitura/Escrita Firebase (Plano Spark Prod / Blaze Dev)
- Proibido loops de leitura no Firestore ou reconsultas desnecessárias da mesma coleção.
- Toda query deve usar `limit()`, paginação ou filtro adequado quando aplicável.
- Todo listener `onSnapshot` deve possuir `unsubscribe()` garantido ao sair da tela.
- Proibido polling contínuo quando listener ou cache em memória resolve.
- Proibido upload duplicado ou sem compressão no Firebase Storage.
