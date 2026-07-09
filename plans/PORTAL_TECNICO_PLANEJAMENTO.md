# Portal Técnico — Planejamento Estratégico

> Documento de pré-viabilidade. Nenhum código implementado.
> Criado em: 2026-07-09 | Autor: Engenharia Cell City CRM

---

## 1. Funcionalidades com Valor Real

### 1.1 FRP e Contas (bypass de bloqueio)
Técnicos realizam bypass FRP (Google Account), iCloud e contas de fabricante diariamente. Cada consulta externa custa 10-30 minutos de pesquisa.

**Valor:** Eliminar pesquisa externa. Integrar métodos testados e validados pela própria equipe.

### 1.2 Firmwares (arquivos de sistema)
Arquivos de firmware para flash/restauração de aparelhos. Tipicamente arquivos ZIP de 500MB–3GB.

**Valor:** Centralizar downloads. Evitar links quebrados ou sites não confiáveis.

### 1.3 Soluções Técnicas (base de conhecimento)
Problemas comuns por modelo: "Galaxy A12 não liga", "iPhone X travado no logo", "Redmi Note 11 sem rede".

**Valor:** Acelerar diagnóstico. Técnico novato ganha autonomia rapidamente.

### 1.4 Softwares e Ferramentas
Drivers, ferramentas de reparo (Octoplus, Z3X, EMMC), programas de teste de bateria/tela.

**Valor:** Catálogo de ferramentas homologadas com links. Evitar downloads de sites suspeitos.

### 1.5 Tutoriais (já implementado)
Link externo para `tutorials/index.html` — conteúdo existente, apenas integrado.

---

## 2. Manutenção do Conteúdo

### Modelo recomendado: curadoria interna + versionamento git

| Tipo | Fonte | Frequência de atualização | Quem mantém |
|------|-------|---------------------------|-------------|
| FRP/Contas | Técnicos (contribuição interna) | Semanal (métodos mudam rápido) | Técnico sênior designado |
| Soluções Técnicas | Técnicos (relatos de caso resolvido) | Contínuo (conforme surgem) | Qualquer técnico + aprovação |
| Softwares | Links oficiais / ferramentas homologadas | Mensal (novas versões) | Supervisor técnico |
| Firmwares | Download direto de fabricantes / parceiros | Sob demanda | Não manter localmente (link externo) |

**Risco identificado:** Conteúdo desatualizado gera desconfiança e abandono. FRP que não funciona desperdiça mais tempo do que pesquisar. Um processo de curadoria é obrigatório.

### Alternativa mais simples (recomendada para Fase 1):
Utilizar a **Central de Informações** já existente (wiki interna com suporte a documentos, comandos, sites e senhas) como backend do conteúdo técnico. Cada "solução" vira um registro na Central de Informações com categoria específica. O Portal Técnico consumiria esses dados filtrados por categoria. Isso:
- Reutiliza código existente (zero nova coleção Firestore)
- Reutiliza o RBAC já implementado
- Reutiliza o sistema de busca já existente
- Dá manutenção via própria interface do CRM (sem customização nova)

---

## 3. Fontes de Dados

### Internas (disponíveis hoje)
- Central de Informações (coleção `informacoes`) — wiki com sites, senhas, documentos, comandos
- Banco de conhecimento dos técnicos (entrevistas, contribuições manuais)
- Histórico de OS resolvidas (dados de reparos anteriores)

### Externas (dependem de curadoria)
- Sites de fabricante (SamMobile, 4PDA, XDA-Developers) — links, não conteúdo hospedado
- Comunidades técnicas (Telegram, grupos WhatsApp) — conteúdo não estruturado
- Ferramentas pagas (Octoplus, Chimera, UMT) — requer licenciamento

---

## 4. Impacto na Produtividade

| Cenário | Sem Portal Técnico | Com Portal Técnico | Ganho estimado |
|---------|-------------------|-------------------|----------------|
| Buscar método FRP para Galaxy A25 | 15-25 min (Google + YouTube + teste) | 2-5 min (consulta interna + executar) | 10-20 min por ocorrência |
| Encontrar firmware para flash | 10-20 min (buscar link válido) | 2-3 min (link curado) | 8-17 min por ocorrência |
| Diagnóstico de problema comum | 10-30 min (pesquisa + tentativa e erro) | 5-10 min (consulta + aplicar solução) | 5-20 min por ocorrência |
| Técnico novato ganhando autonomia | 3-6 meses de acompanhamento | 1-2 meses + base de consulta | Redução de curva de aprendizado |

**Frequência estimada:** Um técnico realiza 3-8 consultas técnicas por dia. Economia potencial: 30-90 minutos por técnico/dia.

---

## 5. Esforço de Implementação e Manutenção

### Fase 1 — Integração com Central de Informações (recomendada)
**Esforço:** 1 sprint (2-3 dias)
- Adicionar categorias técnicas na Central de Informações (FRP, Soluções, Softwares)
- Criar view filtrada no Portal Técnico consumindo dados da Central de Informações
- UI de busca com tags por categoria

**Manutenção:** Técnicos cadastram conteúdo via interface já existente da Central de Informações. Zero backend novo.

### Fase 2 — Downloads de Firmware (condicional)
**Esforço:** 2-3 sprints
- Servidor de arquivos ou integração com Google Drive/Storage
- Controle de versão de firmware por modelo
- Upload gerenciado com limites de tamanho

**Manutenção:** Storage Firebase (limitado), ou CDN externa. Risco de custo de armazenamento.

### Fase 3 — Curadoria e Qualidade
**Esforço:** Contínuo
- Sistema de votação (funcionou/não funcionou)
- Flag de desatualizado
- Histórico de versões de solução

---

## 6. Dependências Técnicas e Riscos

### Dependências
- **Fase 1:** Nenhuma. Central de Informações já está operacional com initModulo + RBAC + testes.
- **Fase 2:** Firebase Storage ou serviço externo de armazenamento. Cloud Function para validação de upload.
- **Fase 3:** Nenhuma além da UI.

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Conteúdo desatualizado (FRP que não funciona) | Alta | Alto — técnicos perdem confiança e abandonam | Curadoria semanal obrigatória. Flag de "não verificado há >30 dias". |
| Conteúdo externo com copyright (firmwares) | Média | Médio — apenas links, sem hospedagem | Política de não hospedar arquivos com copyright. Apenas links oficiais. |
| Técnicos não contribuem com conteúdo | Média | Alto — base vazia sem valor | Incentivo (gamificação ou meta). Designar responsável pela curadoria. |
| Firmwares ocupam Storage Firebase | Baixa | Médio — custo de armazenamento | Usar Google Drive ou link externo. Firebase Storage só para documentos leves. |
| Duplicação com Central de Informações | Baixa | Baixo — reuso planejado | Categorias dedicadas para conteúdo técnico. |

---

## Recomendação

**Não implementar agora.** O conteúdo técnico (FRP, firmwares, soluções) tem valor real para a operação, mas seu sucesso depende de:
1. Um processo de curadoria definido e atribuído a uma pessoa
2. Conteúdo inicial mínimo (50+ soluções, 10+ métodos FRP) antes do lançamento
3. Engajamento da equipe técnica para manter a base atualizada

Se esses pré-requisitos forem atendidos, a **Fase 1** (reuso da Central de Informações) pode ser implementada em 1 sprint com risco muito baixo, sem nova infraestrutura e sem alteração arquitetural.
