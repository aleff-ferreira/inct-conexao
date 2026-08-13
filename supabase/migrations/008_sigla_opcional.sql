-- ============================================================================
--  INCT-CONEXAO · 008 — sigla de laboratório passa a ser opcional
-- ============================================================================
--  Rode no SQL Editor DEPOIS de 001..007, ANTES da seed 003.
--
--  POR QUE
--  A 005 fixou `sigla text not null` — correto para os 28 Laboratórios
--  Associados formais, que têm todos sigla (ainda que provisória). Mas a
--  expansão de 2026-08 trouxe 70 laboratórios/grupos reais dos quais 25
--  simplesmente NÃO TÊM sigla (herbários, plataformas tecnológicas, grupos de
--  DGP, laboratórios estrangeiros). Inventar sigla para satisfazer o banco
--  seria pôr um dado falso num formulário institucional — o nome identifica.
--
--  O unique (ciclo_id, sigla) continua valendo: no Postgres, NULL não conflita
--  com NULL (NULLS DISTINCT, padrão), então vários laboratórios sem sigla
--  convivem, e duas siglas IGUAIS continuam proibidas. Atenção histórica: ''
--  (string vazia) CONFLITA com '' — foi o erro da primeira versão da seed 003,
--  e é por isso que o gerador converte vazio em NULL, nunca o contrário.
-- ============================================================================

alter table public.laboratorios alter column sigla drop not null;

-- Higiene: se alguma linha já tiver sigla vazia, vira NULL de verdade.
update public.laboratorios set sigla = null where sigla is not null and btrim(sigla) = '';

-- ============================================================================
--  CONFERÊNCIA (deve devolver `f` — a coluna aceita NULL):
--    select attnotnull from pg_attribute
--     where attrelid = 'public.laboratorios'::regclass and attname = 'sigla';
-- ============================================================================
