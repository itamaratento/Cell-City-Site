-- ============================================================
-- Domínio 04: Estoque, Catálogo de Produtos, Fornecedor
-- Fonte: COLECOES_FIRESTORE.md §6-8, §17 (categorias_produtos)
-- ============================================================

CREATE TABLE estoque_produtos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT NOT NULL,
  categoria         TEXT,
  quantidade        INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  quantidade_minima INTEGER NOT NULL DEFAULT 0,
  valor_custo       NUMERIC(12,2),
  valor_venda       NUMERIC(12,2),
  fornecedor        TEXT,
  codigo_barras     TEXT,
  descricao         TEXT,
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_estoque_produtos_quantidade_minima ON estoque_produtos (quantidade) WHERE quantidade <= quantidade_minima;

CREATE TABLE categorias_produtos (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome  TEXT NOT NULL UNIQUE
);

CREATE TABLE catalogo_produtos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias_produtos (id),
  ordem        INTEGER NOT NULL DEFAULT 0,
  preco_promo  NUMERIC(12,2),
  ativo        BOOLEAN NOT NULL DEFAULT true,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalogo_produtos_ordem ON catalogo_produtos (ordem);

CREATE TABLE catalogo_config (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- documento único ("geral") — trava a 1 linha
  whatsapp       TEXT,
  mensagem_template TEXT
);

CREATE TABLE fornecedor_compras (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 1,
  urgencia   TEXT NOT NULL CHECK (urgencia IN ('alta','media','baixa')),
  obs        TEXT,
  status     TEXT CHECK (status = 'feita'),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fornecedor_tendencias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto    TEXT NOT NULL,
  tendencia  TEXT NOT NULL CHECK (tendencia IN ('crescendo','estavel','caindo')),
  prioridade TEXT NOT NULL CHECK (prioridade IN ('alta','media','baixa')),
  obs        TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Resumo: 6 entidades Firestore → 6 tabelas SQL.
-- ============================================================
