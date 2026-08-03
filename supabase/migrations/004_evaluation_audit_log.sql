-- ============================================================================
--  INCT-CONEXAO · Plataforma — 004: log append-only de avaliações (auditoria)
-- ============================================================================
--  Rode o ARQUIVO INTEIRO de uma vez no SQL Editor. Ordem: 001→002→003→004.
--
--  CONTEXTO: a avaliação é ABERTA (todo avaliador pontua qualquer inscrição —
--  avaliadores são escassos). Como não há restrição de escrita, a integridade
--  é verificada DEPOIS. Mas a tabela `evaluations` guarda só o VALOR ATUAL (o
--  upsert sobrescreve), então um avaliador poderia reescrever a própria nota
--  antes de qualquer auditoria e apagar o rastro.
--
--  ESTE LOG resolve isso: toda gravação de avaliação (insert OU update) grava
--  uma linha imutável em `evaluation_events`. Assim a auditoria enxerga o
--  HISTÓRICO (quantas vezes mudou, quando, e se mudou depois de outra
--  avaliação ter sido enviada) — não só o estado final mutável. NÃO é uma
--  restrição: ninguém é impedido de avaliar; apenas se registra o que ocorreu.
-- ============================================================================

create table if not exists public.evaluation_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  evaluator_id   uuid not null references auth.users (id) on delete cascade,
  action         text not null check (action in ('insert', 'update')),
  scores         jsonb not null default '{}'::jsonb,
  total          numeric(6,2) not null default 0,
  bonus_pct      numeric(5,2) not null default 0,
  final_score    numeric(6,2) not null default 0,
  submitted      boolean not null default false,
  at             timestamptz not null default now()
);
alter table public.evaluation_events enable row level security;

-- Só admin lê (dados de integridade). Ninguém insere/edita via API pública:
-- as inserções vêm exclusivamente do trigger SECURITY DEFINER abaixo.
drop policy if exists evev_admin_read on public.evaluation_events;
create policy evev_admin_read on public.evaluation_events
  for select using (public.is_admin());

-- Registra cada gravação de avaliação. SECURITY DEFINER: roda como owner, então
-- insere no log mesmo sem policy de INSERT (append-only garantido pelo trigger).
create or replace function public.log_evaluation_event()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.evaluation_events
    (application_id, evaluator_id, action, scores, total, bonus_pct, final_score, submitted, at)
  values
    (new.application_id, new.evaluator_id, lower(tg_op), new.scores, new.total,
     new.bonus_pct, new.final_score, new.submitted, now());
  return new;
end; $$;

drop trigger if exists evaluations_log on public.evaluations;
create trigger evaluations_log
  after insert or update on public.evaluations
  for each row execute function public.log_evaluation_event();

-- Sanidade: a tabela existe (começa vazia) e o trigger está instalado.
select 'evaluation_events (linhas)' as checagem, count(*)::text as valor
  from public.evaluation_events
union all
select 'trigger evaluations_log', count(*)::text
  from pg_trigger where tgname = 'evaluations_log';
