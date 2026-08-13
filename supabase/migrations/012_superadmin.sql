-- ============================================================================
--  012 · SuperAdministrador — papel acima de admin + gerência de contas
--        exclusiva (painel "Administração de Contas", #/gestao?area=contas)
-- ============================================================================
--  O QUE MUDA
--   1. Novo papel 'superadmin' nos CHECKs de profiles e staff_allowlist.
--   2. A gerência de contas (allowlist de pré-autorização + troca de papéis)
--      sai do alcance do admin comum: as políticas de ESCRITA dessas tabelas
--      passam a exigir superadmin. Admin continua LENDO profiles (a Auditoria
--      precisa casar avaliador→nome; a policy profiles_self_read da 001 já
--      cobre a leitura via is_admin()).
--   3. is_admin() passa a incluir 'superadmin'. Esse é o único ponto de
--      acoplamento com o resto do site — e é deliberado: TODA autorização de
--      edição do site desagua em is_admin() (editais, inscrições, workshop da
--      008, e o Relatório Anual via is_coordenacao()/is_coordenacao_geral()
--      da 005, que chamam is_admin() por dentro). Um superadmin herda tudo
--      que admin/coordenação pode editar, sem tocar em nenhuma outra policy.
--   4. Trava anti-bloqueio: o ÚLTIMO superadmin não pode ser rebaixado —
--      sem ela, um engano na tabela de papéis deixaria o site sem ninguém
--      capaz de gerir contas.
--   5. Bootstrap: os 5 e-mails da coordenação (decisão de 2026-08-11) viram
--      superadmin — na allowlist (contas futuras já nascem certas) e nos
--      perfis existentes (promoção imediata, qualquer que seja o papel atual).
--
--  IDEMPOTENTE: rodar de novo não duplica nem quebra nada.
-- ============================================================================

-- ------------------------------------------------ 1. CHECKs de papel -------
-- Os CHECKs da 001 nasceram sem nome (auto: *_role_check). Trocamos por
-- constraints NOMEADAS para que reaplicar esta migração seja drop+add limpo.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_role_valida;
alter table public.profiles add constraint profiles_role_valida
  check (role in ('superadmin', 'admin', 'avaliador', 'candidato'));

alter table public.staff_allowlist drop constraint if exists staff_allowlist_role_check;
alter table public.staff_allowlist drop constraint if exists staff_allowlist_role_valida;
alter table public.staff_allowlist add constraint staff_allowlist_role_valida
  check (role in ('superadmin', 'admin', 'avaliador'));

-- --------------------------------------------------------- 2. Helpers ------
create or replace function public.is_superadmin()
returns boolean
language sql security definer stable set search_path = public as $$
  select public.current_role_of() = 'superadmin';
$$;

-- Herança: superadmin É admin em todo lugar que pergunta is_admin().
create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select public.current_role_of() in ('superadmin', 'admin');
$$;

create or replace function public.is_staff()
returns boolean
language sql security definer stable set search_path = public as $$
  select public.current_role_of() in ('superadmin', 'admin', 'avaliador');
$$;

-- ------------------------- 3. Gerência de contas: só superadmin escreve ----
-- allowlist: era is_admin() (001/002); agora leitura E escrita só superadmin.
-- Para admin/avaliador a tabela simplesmente devolve zero linhas — o painel
-- de contas nem aparece para eles, e o dado acompanha.
drop policy if exists allowlist_admin_all on public.staff_allowlist;
drop policy if exists allowlist_superadmin_all on public.staff_allowlist;
create policy allowlist_superadmin_all on public.staff_allowlist
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- profiles: a policy profiles_admin_all (001) dava INSERT/UPDATE/DELETE a
-- admin — é exatamente o poder que migra para o superadmin. A leitura de
-- todos os perfis pelo admin segue viva em profiles_self_read (001), que já
-- tem `or public.is_admin()` no USING do SELECT.
drop policy if exists profiles_admin_all on public.profiles;
drop policy if exists profiles_superadmin_all on public.profiles;
create policy profiles_superadmin_all on public.profiles
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- ------------------- 4. Trava: nunca rebaixar o ÚLTIMO superadmin ----------
-- Vale para QUALQUER caminho de escrita (painel, SQL Editor, service_role):
-- trigger roda por baixo da RLS. DELETE fica de fora de propósito — apagar
-- conta no Dashboard do Supabase cascateia auth.users→profiles e não pode
-- travar; o risco real de bloqueio é o rebaixamento por engano, não a
-- exclusão deliberada da conta.
create or replace function public.protege_ultimo_superadmin()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'superadmin' and new.role is distinct from 'superadmin' then
    if not exists (select 1 from public.profiles
                    where role = 'superadmin' and id <> old.id) then
      raise exception 'Este é o último SuperAdministrador — promova outra conta antes de rebaixá-lo.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protege_ultimo_superadmin on public.profiles;
create trigger trg_protege_ultimo_superadmin
  before update of role on public.profiles
  for each row execute function public.protege_ultimo_superadmin();

-- ------------------------------------------------------- 5. Bootstrap ------
-- Os únicos e-mails com status de SuperAdministrador (coordenação, 2026-08-11).
-- on conflict DO UPDATE (não "do nothing"): quem já estava na allowlist com
-- outro papel — alefffx estava como avaliador — sobe junto.
insert into public.staff_allowlist (email, role) values
  ('labioprot.toxin@gmail.com', 'superadmin'),
  ('alefffx@gmail.com',         'superadmin'),
  ('andreimarsoares@gmail.com', 'superadmin'),
  ('akayano@gmail.com',         'superadmin'),
  ('mateus.sousa@fiocruz.br',   'superadmin')
on conflict (email) do update set role = 'superadmin';

-- Perfis já criados sobem agora (mateus.sousa ainda não tem conta: quando
-- criar, nasce superadmin pela allowlist — handle_new_user da 002).
update public.profiles set role = 'superadmin'
 where lower(email) in ('labioprot.toxin@gmail.com', 'alefffx@gmail.com',
                        'andreimarsoares@gmail.com', 'akayano@gmail.com',
                        'mateus.sousa@fiocruz.br')
   and role <> 'superadmin';

-- -------------------------------------------------------- 6. Sanidade ------
-- Esperado: 5 linhas, todas ok = true.
select * from (values
  ('is_superadmin() existe',
     to_regprocedure('public.is_superadmin()') is not null),
  ('allowlist tem exatamente os 5 superadmins',
     (select count(*) = 5 from public.staff_allowlist where role = 'superadmin')),
  ('check de profiles aceita superadmin',
     exists (select 1 from pg_constraint
              where conname = 'profiles_role_valida' and contype = 'c')),
  ('escrita da allowlist exige superadmin',
     exists (select 1 from pg_policies where tablename = 'staff_allowlist'
               and policyname = 'allowlist_superadmin_all')),
  ('trava do último superadmin armada',
     exists (select 1 from pg_trigger
              where tgname = 'trg_protege_ultimo_superadmin' and not tgisinternal))
) as sanidade(item, ok);
