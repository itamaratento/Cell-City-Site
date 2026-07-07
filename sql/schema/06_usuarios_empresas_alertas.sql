-- ============================================================
-- Domínio 06: Usuários/Permissões, Empresas (Multiempresa/Tenant), Alertas
-- Fonte: COLECOES_FIRESTORE.md §12-14
-- ============================================================

CREATE TABLE empresas (
  id                TEXT PRIMARY KEY,              -- Firestore: empresa_id, ex.: 'cellcity-master'
  status            TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','bloqueado','cancelado','arquivado')),
  data_vencimento   TIMESTAMPTZ,
  plano             TEXT,
  feature_flags     JSONB NOT NULL DEFAULT '{}'::jsonb  -- único JSONB deliberado deste modelo: flags são por natureza um conjunto dinâmico de booleans, não repetição de entidade — ver justificativa em sql/00_visao_geral.md
);
CREATE TABLE empresas_modulos_ativos (
  empresa_id  TEXT NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
  modulo      TEXT NOT NULL,
  PRIMARY KEY (empresa_id, modulo)
);

CREATE TABLE perfis_operacionais (
  id            TEXT PRIMARY KEY,                  -- slug, ex.: 'tecnico'
  nome          TEXT NOT NULL,
  descricao     TEXT,
  sistema       BOOLEAN NOT NULL DEFAULT false,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por    UUID,                               -- FK para usuarios.id, ver ALTER abaixo (ordem de criação)
  atualizado_em TIMESTAMPTZ
);

-- matriz de permissões (`permissoes` no Firestore: { moduloId: {visualizar,criar,editar,excluir,aprovar} })
-- vira uma linha por (perfil, módulo) em vez de um objeto aninhado —
-- ganha índice e integridade, perde só a leitura "tudo de um perfil" num
-- único documento (JOIN resolve, é a troca clássica documento↔relacional).
CREATE TABLE perfis_operacionais_permissoes (
  perfil_id   TEXT NOT NULL REFERENCES perfis_operacionais (id) ON DELETE CASCADE,
  modulo_id   TEXT NOT NULL,
  visualizar  BOOLEAN NOT NULL DEFAULT false,
  criar       BOOLEAN NOT NULL DEFAULT false,
  editar      BOOLEAN NOT NULL DEFAULT false,
  excluir     BOOLEAN NOT NULL DEFAULT false,
  aprovar     BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (perfil_id, modulo_id)
);

CREATE TABLE usuarios (
  id                    UUID PRIMARY KEY,           -- = Firebase Auth UID na migração real (não gen_random_uuid — precisa bater com o Auth existente)
  nome_exibicao         TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  perfil_legado         TEXT CHECK (perfil_legado IN ('admin','master_admin','usuario','tecnico')),
  perfil_operacional_id TEXT REFERENCES perfis_operacionais (id),
  status                TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  setor                 TEXT,
  telefone              TEXT,
  observacao            TEXT,
  conta_padrao          BOOLEAN DEFAULT false,
  criado_por            UUID REFERENCES usuarios (id),
  empresa_id            TEXT REFERENCES empresas (id),  -- resolução de tenant (ver COLECOES_FIRESTORE.md §13 — vestígio do SaaS revertido, fallback único hoje)
  ultima_alteracao      TIMESTAMPTZ,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE perfis_operacionais ADD CONSTRAINT fk_perfis_criado_por FOREIGN KEY (criado_por) REFERENCES usuarios (id);
ALTER TABLE tarefas_semana ADD CONSTRAINT fk_tarefas_semana_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id);

-- Favoritos/notas/preferências por usuário — 1:1 com usuarios (doc id = uid
-- no Firestore); modelados como tabela satélite em vez de coluna direta em
-- `usuarios` para não misturar dado de "conta" com dado de "preferência
-- de UI", e para poder evoluir (ex.: virar 1:N) sem alterar a tabela núcleo.
CREATE TABLE favoritos_usuarios (
  usuario_id    UUID PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE favoritos_usuarios_itens (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES favoritos_usuarios (usuario_id) ON DELETE CASCADE,
  ordem       INTEGER NOT NULL,
  item_url    TEXT NOT NULL,
  UNIQUE (usuario_id, ordem)
);

CREATE TABLE notas_usuarios (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
  conteudo   TEXT
);

CREATE TABLE usuarios_preferencias (
  -- Firestore: subcoleção usuarios/{uid}/preferencias/{docId} (layout,
  -- módulos favoritos, home) — cada "docId" vira uma linha tipada aqui.
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  chave      TEXT NOT NULL,                  -- 'layout' | 'modulos' | 'home' | outros
  valor      JSONB NOT NULL,                 -- estrutura variável por chave, documentada em código (não em Rules) — mantido JSONB deliberadamente aqui (ver sql/00_visao_geral.md)
  PRIMARY KEY (usuario_id, chave)
);

-- ---------- Alertas / Central de Alertas ----------

CREATE TABLE alertas_usuario (
  id              TEXT PRIMARY KEY,              -- Firestore usa ID composto legível (ex.: crm_lead123_2d) — preservado
  titulo          TEXT NOT NULL,
  descricao       TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('lembrete','os','crm_remarketing')),
  prioridade      TEXT NOT NULL CHECK (prioridade IN ('alta','media','baixa')),
  data_ref        DATE NOT NULL,
  hora            TIME,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido')),
  repeticao       TEXT NOT NULL DEFAULT 'nenhuma' CHECK (repeticao IN ('nenhuma','diaria','semanal','mensal')),
  custom_dias     INTEGER,
  link            TEXT,
  origem          TEXT NOT NULL CHECK (origem IN ('crm','crm_remarketing','os')),
  lead_id         UUID REFERENCES crm_leads (id),
  os_id           TEXT REFERENCES os (id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ
);

CREATE TABLE central_alertas_status (
  usuario_id    UUID PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE central_alertas_status_itens (
  usuario_id  UUID NOT NULL REFERENCES central_alertas_status (usuario_id) ON DELETE CASCADE,
  alerta_id   TEXT NOT NULL,                  -- referência lógica a um id de alerta (não FK rígida — o alerta pode já ter sido apagado)
  status      TEXT NOT NULL CHECK (status = 'lido'),
  marcado_em  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (usuario_id, alerta_id)
);

CREATE TABLE alarme_config (
  usuario_id          UUID PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
  config              JSONB NOT NULL DEFAULT '{}'::jsonb,  -- estrutura definida só pela UI, sem contrato documentado nas Rules — JSONB aceito como pragmático (ver sql/00_visao_geral.md)
  ultima_atualizacao_dispositivo TEXT,
  ultima_atualizacao_ts          TIMESTAMPTZ
);

-- ============================================================
-- Resumo: 9 entidades Firestore (empresas, perfis_operacionais, usuarios,
-- favoritos_usuarios, notas_usuarios, usuarios/preferencias, alertas_usuario,
-- central_alertas_status, alarme_config) → 13 tabelas SQL.
-- ============================================================
