-- ============================================================
-- Domínio 03: Caixa / Financeiro
-- Fonte: COLECOES_FIRESTORE.md §5
-- Nota: `empresa_id` (campo opcional no Firestore, vestígio do SaaS
-- revertido) foi mantido como coluna, mas sem FK/constraint — ver
-- discussão em sql/00_visao_geral.md sobre a decisão de não modelar
-- `empresas` como tabela-pai obrigatória enquanto o sistema for single-tenant.
-- ============================================================

CREATE TABLE categorias_caixa (
  id          TEXT PRIMARY KEY,                 -- Firestore: doc id = nome da categoria
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('entrada','saida','servico')),
  status      TEXT NOT NULL CHECK (status IN ('ativo','inativo')),
  empresa_id  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE caixa_lancamentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT NOT NULL CHECK (tipo IN ('entrada','saida','servico')),
  descricao     TEXT NOT NULL,
  categoria_id  TEXT REFERENCES categorias_caixa (id),
  valor         NUMERIC(12,2) NOT NULL,
  custo         NUMERIC(12,2) NOT NULL DEFAULT 0,
  lucro         NUMERIC(12,2) GENERATED ALWAYS AS (valor - custo) STORED,
  data_ref      DATE NOT NULL,
  ano           SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM data_ref)) STORED,
  obs           TEXT,
  empresa_id    TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ
);
CREATE INDEX idx_caixa_lancamentos_data ON caixa_lancamentos (data_ref);
CREATE INDEX idx_caixa_lancamentos_categoria ON caixa_lancamentos (categoria_id);

CREATE TABLE lembretes_pagamento (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor   TEXT NOT NULL,
  descricao    TEXT NOT NULL,
  quantidade   NUMERIC(10,2) NOT NULL DEFAULT 1,
  valor        NUMERIC(12,2) NOT NULL,
  vencimento   DATE,
  observacao   TEXT,
  empresa_id   TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE financeiro_categorias (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome  TEXT NOT NULL UNIQUE
);

CREATE TABLE financeiro_receber (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao     TEXT NOT NULL,
  vencimento    DATE NOT NULL,
  valor         NUMERIC(12,2) NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pendente','pago')),
  obs           TEXT,
  origem        TEXT CHECK (origem = 'os'),
  os_id         TEXT REFERENCES os (id),          -- FK cruzada para 01_core_os_clientes_crm.sql — carregar esse arquivo primeiro
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE financeiro_pagar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao     TEXT NOT NULL,
  categoria_id  UUID REFERENCES financeiro_categorias (id),
  vencimento    DATE,
  valor         NUMERIC(12,2) NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pendente','pago')),
  obs           TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE financeiro_fixas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao     TEXT NOT NULL,
  categoria_id  UUID REFERENCES financeiro_categorias (id),
  valor         NUMERIC(12,2) NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pendente','pago')),
  obs           TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Resumo: 7 entidades Firestore → 7 tabelas SQL (sem tabelas-filhas
-- neste domínio — nenhum campo repetido documentado).
-- ============================================================
