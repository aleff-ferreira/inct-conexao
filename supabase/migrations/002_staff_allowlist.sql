-- ============================================================================
--  002 · Allowlist da comissão — rode no SQL Editor do projeto EXISTENTE.
--  (Instalações novas já ganham isto pelo 001_platform.sql.)
--  Depois disto: admin cola e-mails na aba Equipe; avaliadores criam a
--  própria conta em #/gestao → "Primeiro acesso? Criar conta".
-- ============================================================================

create table if not exists public.staff_allowlist (
  email      text primary key check (email = lower(email)),
  role       text not null default 'avaliador' check (role in ('admin', 'avaliador')),
  created_at timestamptz not null default now()
);
alter table public.staff_allowlist enable row level security;
drop policy if exists allowlist_admin_all on public.staff_allowlist;
create policy allowlist_admin_all on public.staff_allowlist
  for all using (public.is_admin()) with check (public.is_admin());

-- Bootstrap: administradores iniciais.
insert into public.staff_allowlist (email, role) values
  ('labioprot.toxin@gmail.com', 'admin'),
  ('alefffx@gmail.com', 'admin')
on conflict (email) do nothing;

-- O papel do perfil novo passa a vir da allowlist (fora dela: candidato).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  allowed text;
begin
  select role into allowed from public.staff_allowlist where email = lower(new.email);
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(allowed, 'candidato')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- Verificação: a tabela existe e os admins estão na lista.
select email, role from public.staff_allowlist order by email;
