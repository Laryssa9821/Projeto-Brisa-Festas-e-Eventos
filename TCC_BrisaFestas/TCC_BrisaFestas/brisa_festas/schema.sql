PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clientes (
  id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT
);

CREATE TABLE IF NOT EXISTS servicos (
  id_servico INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_servico TEXT NOT NULL,
  descricao TEXT,
  valor_unitario REAL,
  disponibilidade INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS funcionarios (
  id_funcionario INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_completo TEXT NOT NULL,
  apelido TEXT,
  cpf TEXT,
  data_nascimento TEXT,
  genero TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cargo TEXT,
  salario REAL,
  tipo_contrato TEXT,
  disponibilidade TEXT,
  habilidades_especiais TEXT,
  tamanho_uniforme TEXT,
  observacoes_logistica TEXT
);

CREATE TABLE IF NOT EXISTS evento_adm (
  id_evento INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_evento TEXT,
  tipo_evento TEXT,
  id_cliente INTEGER,
  data_evento TEXT,
  hora_inicio TEXT,
  hora_termino TEXT,
  data_criacao TEXT DEFAULT (datetime('now')),
  data_modificacao TEXT,
  id_local INTEGER,
  local_externo_endereco TEXT,
  valor_orcamento_inicial REAL,
  valor_contrato_final REAL,
  status_pagamento TEXT,
  custos_adicionais REAL DEFAULT 0,
  valor_lucro_liquido REAL DEFAULT 0,
  status_evento TEXT,
  feedback_cliente TEXT,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_usuario TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  cpf TEXT,
  is_admin INTEGER DEFAULT 0,
  criado_em TEXT DEFAULT (datetime('now'))
);

