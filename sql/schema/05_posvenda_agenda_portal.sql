-- ============================================================
-- Domínio 05: Pós-Venda, Agenda/Ação da Semana/Minha Semana, Portal do Cliente
-- Fonte: COLECOES_FIRESTORE.md §9-11
-- Requer 01_core_os_clientes_crm.sql carregado antes (FK para os, clientes).
-- A FK de tarefas_semana para usuarios é adicionada depois, em
-- 06_usuarios_empresas_alertas.sql (ALTER TABLE) — este arquivo cria a
-- tabela sem essa FK, então roda numa ordem puramente numérica (01..08),
-- sem precisar do 06 antes.
-- ============================================================

-- ---------- Pós-Venda ----------

CREATE TABLE posvenda_mensagens (
  prazo_dias SMALLINT PRIMARY KEY CHECK (prazo_dias IN (5,15,30)),
  mensagem   TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ
);

CREATE TABLE posvenda_contatos (
  id             TEXT PRIMARY KEY,                 -- Firestore: `${osId}_${prazo}` — mantido como PK natural
  os_id          TEXT NOT NULL REFERENCES os (id),
  client_name    TEXT NOT NULL,
  phone          TEXT NOT NULL,
  model          TEXT,
  prazo_dias     SMALLINT NOT NULL REFERENCES posvenda_mensagens (prazo_dias),
  emoji          TEXT,
  resultado      TEXT,
  data_contato   DATE,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  deleted_at     TIMESTAMPTZ,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ
);
CREATE INDEX idx_posvenda_contatos_os ON posvenda_contatos (os_id);

-- ---------- Agenda / Ação da Semana / Minha Semana ----------

CREATE TABLE agenda (
  id                     DATE PRIMARY KEY,          -- Firestore: doc id = data ISO (chave canônica, órfãos de recorrência descartados na migração)
  cor                    TEXT NOT NULL CHECK (cor IN ('amarelo','verde','azul','vermelho')),
  alerta_hora            TIME,
  alerta_dashboard       BOOLEAN NOT NULL DEFAULT false,
  recorrencia            TEXT NOT NULL DEFAULT 'nenhuma' CHECK (recorrencia IN ('nenhuma','semanal','mensal','anual')),
  recorrencia_parar_em   DATE,
  texto_cor              TEXT CHECK (texto_cor IN ('preto','branco')),
  atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE agenda_notas (
  id        BIGSERIAL PRIMARY KEY,
  agenda_id DATE NOT NULL REFERENCES agenda (id) ON DELETE CASCADE,
  ordem     INTEGER NOT NULL,
  texto     TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (agenda_id, ordem)
);
CREATE TABLE agenda_recorrencia_excluir (
  agenda_id     DATE NOT NULL REFERENCES agenda (id) ON DELETE CASCADE,
  data_excluida DATE NOT NULL,
  PRIMARY KEY (agenda_id, data_excluida)
);

CREATE TABLE agendamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  telefone        TEXT NOT NULL,
  email           TEXT,
  modelo_aparelho TEXT,
  defeito         TEXT,
  data_preferida  DATE,
  periodo         TEXT CHECK (periodo IN ('manha','tarde')),
  observacoes     TEXT,
  status          TEXT NOT NULL CHECK (status IN ('aguardando','confirmado','cancelado','concluido')),
  origem          TEXT CHECK (origem IN ('portal','presencial')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ
);

-- tarefas_semana: PK = uid do usuário (ver 06_usuarios_empresas_alertas.sql).
-- Criada sem a FK para usuarios (adicionada via ALTER em 06, depois que
-- esta tabela já existe) — evita dependência circular entre os arquivos.
CREATE TABLE tarefas_semana (
  usuario_id    UUID PRIMARY KEY,                   -- FK para usuarios.id, ver ALTER em 06_usuarios_empresas_alertas.sql
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tarefas_semana_itens (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    UUID NOT NULL REFERENCES tarefas_semana (usuario_id) ON DELETE CASCADE,
  texto         TEXT NOT NULL,
  prioridade    TEXT CHECK (prioridade IN ('alta','media','baixa')),
  dia           TEXT
);

-- ---------- Portal do Cliente ----------

CREATE TABLE mensagens_portal (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT,
  phone       TEXT NOT NULL,
  texto       TEXT NOT NULL,
  lida        BOOLEAN NOT NULL DEFAULT false,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mensagens_portal_lida ON mensagens_portal (lida) WHERE NOT lida;

CREATE TABLE avaliacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota        SMALLINT CHECK (nota BETWEEN 1 AND 5),
  comentario  TEXT,
  client_name TEXT,
  os_id       TEXT REFERENCES os (id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_avaliacoes_criado_em ON avaliacoes (criado_em DESC);

CREATE TABLE solicitacoes_diagnostico (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status        TEXT NOT NULL CHECK (status IN ('pendente','convertido','respondido')),
  os_id         TEXT REFERENCES os (id),
  respondido    BOOLEAN DEFAULT false,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE os ADD CONSTRAINT fk_os_solicitacao FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_diagnostico (id);

CREATE TABLE portal_eventos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL,                  -- 'acesso' | 'clique_whatsapp' | 'clique_maps' | outros (sem enum fechado — Cloud Function aceita lista aberta)
  telefone    TEXT,                            -- mascarado na origem (Cloud Function)
  client_name TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_eventos_tipo ON portal_eventos (tipo, criado_em DESC);

-- ============================================================
-- Resumo: 9 entidades Firestore → 14 tabelas SQL (5 filhas de arrays:
-- agenda_notas, agenda_recorrencia_excluir, tarefas_semana_itens).
-- ============================================================
