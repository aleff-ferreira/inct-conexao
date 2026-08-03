-- ============================================================================
--  INCT-CONEXAO · Plataforma — 003: protocolo atômico + hardening de abertura
-- ============================================================================
--  Rode UMA vez no SQL Editor do Supabase, DEPOIS de 001 e 002.
--
--  PROBLEMA CORRIGIDO (bloqueador de abertura):
--  next_protocolo (001) gerava o número por `count(*) + 1` SEM lock e era
--  chamado como RPC separada do INSERT. No pico de abertura (~200 candidatos
--  em 18 estados), dois candidatos distintos enviando quase ao mesmo tempo
--  liam o MESMO count, recebiam o MESMO protocolo, e o segundo INSERT violava
--  o UNIQUE de `protocolo` — a inscrição legítima falhava com erro cru do
--  Postgres. Além disso, a RPC era chamável por anônimo, vazando a contagem
--  de inscrições em tempo real.
--
--  SOLUÇÃO: o protocolo passa a nascer NO SERVIDOR, dentro da mesma transação
--  do INSERT, a partir de um contador atômico por edital. `UPDATE ... RETURNING`
--  serializa concorrentes no nível da linha — é impossível dois inserts
--  receberem o mesmo número. Idempotente: reenvio/edição não gera novo número.
-- ============================================================================

-- Contador atômico: uma linha por edital. Sem policies de RLS = inacessível
-- pela API pública; só as funções SECURITY DEFINER abaixo o tocam.
create table if not exists public.protocolo_seq (
  edital_id uuid primary key references public.editais (id) on delete cascade,
  ultimo    int  not null default 0
);
alter table public.protocolo_seq enable row level security;

-- Reserva o próximo número de forma atômica. O INSERT ... ON CONFLICT DO UPDATE
-- ... RETURNING pega um lock de linha por edital: chamadas concorrentes são
-- serializadas e cada uma recebe um valor único e crescente.
create or replace function public.reserve_protocolo(p_edital uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.protocolo_seq (edital_id, ultimo)
  values (p_edital, 1)
  on conflict (edital_id)
    do update set ultimo = public.protocolo_seq.ultimo + 1
  returning ultimo into n;
  return n;
end; $$;

-- Gera o protocolo no BEFORE INSERT da inscrição (mesma transação). Se já vier
-- preenchido (reenvio/edição, ou upsert), mantém o valor — não consome número.
create or replace function public.set_protocolo()
returns trigger
language plpgsql security definer set search_path = public as $$
declare num text; n int;
begin
  if new.protocolo is not null and new.protocolo <> '' then
    return new;
  end if;
  select replace(numero, '/', '-') into num from public.editais where id = new.edital_id;
  n := public.reserve_protocolo(new.edital_id);
  new.protocolo := 'INCT-' || coalesce(num, 'ED') || '-' || lpad(n::text, 4, '0');
  return new;
end; $$;

drop trigger if exists applications_set_protocolo on public.applications;
create trigger applications_set_protocolo
  before insert on public.applications
  for each row execute function public.set_protocolo();

-- Semeia o contador com o máximo já existente (caso haja inscrições de teste),
-- para não repetir números após a migração.
insert into public.protocolo_seq (edital_id, ultimo)
select e.id, count(a.id)
from public.editais e
left join public.applications a on a.edital_id = e.id
group by e.id
on conflict (edital_id) do update
  set ultimo = greatest(public.protocolo_seq.ultimo, excluded.ultimo);

-- Fecha o vazamento de contagem e o griefing do contador: nenhuma dessas
-- funções deve ser chamável por clientes — o protocolo nasce no servidor.
-- IMPORTANTE: revogar de PUBLIC (toda função nasce com EXECUTE para PUBLIC, do
-- qual anon/authenticated herdam) — revogar só de anon/authenticated é inócuo.
-- As triggers rodam como owner (SECURITY DEFINER), então continuam funcionando.
revoke execute on function public.next_protocolo(uuid)    from public, anon, authenticated;
revoke execute on function public.reserve_protocolo(uuid) from public, anon, authenticated;
