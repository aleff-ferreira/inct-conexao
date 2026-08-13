-- ============================================================================
-- 03_superadmin.sql — bateria da migração 012 (papel superadmin) no Postgres
-- local. Mesma técnica do 01: superusuário faz o SETUP; `set role
-- authenticated` + `request.jwt.claim.sub` simulam cada sessão (o auth.uid()
-- do dublê lê essa GUC). Rode DEPOIS de 001..012 + seed 001.
-- ============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\pset pager off

\set U_SUPER1 '''00000000-0000-0000-0000-0000000000e1'''
\set U_SUPER2 '''00000000-0000-0000-0000-0000000000e2'''
\set U_ADMIN  '''00000000-0000-0000-0000-0000000000e3'''
\set U_AVAL   '''00000000-0000-0000-0000-0000000000e4'''

\echo '### SETUP ############################################################'
insert into auth.users (id, email) values
  (:U_SUPER1, 'super1@inct.br'),
  (:U_SUPER2, 'super2@inct.br'),
  (:U_ADMIN,  'admin1@inct.br'),
  (:U_AVAL,   'aval1@inct.br');
update public.profiles set role = 'superadmin' where id in (:U_SUPER1, :U_SUPER2);
update public.profiles set role = 'admin'      where id = :U_ADMIN;
update public.profiles set role = 'avaliador'  where id = :U_AVAL;

\echo ''
\echo '### T01 — herança: superadmin responde como admin/staff ###############'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select case when public.is_superadmin() and public.is_admin() and public.is_staff()
            then 'OK  superadmin é admin e staff por herança' else 'FALHOU' end as t01;

\echo ''
\echo '### T02 — admin comum NÃO é superadmin ################################'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
select case when public.is_admin() and not public.is_superadmin()
            then 'OK  admin segue admin, sem virar superadmin' else 'FALHOU' end as t02;

\echo ''
\echo '### T03 — allowlist sumiu do admin (leitura zero, escrita negada) #####'
select case when (select count(*) from public.staff_allowlist) = 0
            then 'OK  admin não lê a allowlist' else 'FALHOU' end as t03a;
do $$
begin
  insert into public.staff_allowlist (email, role) values ('intruso@inct.br', 'avaliador');
  raise exception 'FALHOU: admin conseguiu escrever na allowlist';
exception when insufficient_privilege then
  raise notice 'OK  escrita na allowlist negada ao admin (42501)';
end $$;

\echo ''
\echo '### T04 — admin não troca papel de ninguém (0 linhas via RLS) #########'
update public.profiles set role = 'candidato'
 where id = '00000000-0000-0000-0000-0000000000e4';
reset role;
select case when (select role from public.profiles
                   where id = :U_AVAL) = 'avaliador'
            then 'OK  papel do avaliador intocado — admin perdeu a gerência'
            else 'FALHOU' end as t04;

\echo ''
\echo '### T05 — superadmin gerencia allowlist e papéis ######################'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
insert into public.staff_allowlist (email, role) values ('nova@inct.br', 'superadmin');
select case when (select role from public.staff_allowlist where email = 'nova@inct.br') = 'superadmin'
            then 'OK  superadmin pré-autoriza (inclusive outro superadmin)' else 'FALHOU' end as t05a;
update public.profiles set role = 'admin'
 where id = '00000000-0000-0000-0000-0000000000e4';
select case when (select role from public.profiles
                   where id = '00000000-0000-0000-0000-0000000000e4') = 'admin'
            then 'OK  superadmin promove contas' else 'FALHOU' end as t05b;
-- volta o avaliador ao papel original (T09 depende dele como avaliador)
update public.profiles set role = 'avaliador'
 where id = '00000000-0000-0000-0000-0000000000e4';
delete from public.staff_allowlist where email = 'nova@inct.br';

\echo ''
\echo '### T06 — conta nova da allowlist já nasce superadmin #################'
reset role;
insert into public.staff_allowlist (email, role) values ('nasce.super@inct.br', 'superadmin')
on conflict (email) do update set role = 'superadmin';
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e5', 'nasce.super@inct.br');
select case when (select role from public.profiles where email = 'nasce.super@inct.br') = 'superadmin'
            then 'OK  handle_new_user respeita o papel superadmin' else 'FALHOU' end as t06;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000e5';
delete from public.staff_allowlist where email = 'nasce.super@inct.br';

\echo ''
\echo '### T07 — rebaixar superadmin COM sobra: permitido ####################'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
update public.profiles set role = 'admin'
 where id = '00000000-0000-0000-0000-0000000000e2';
select case when (select role from public.profiles
                   where id = '00000000-0000-0000-0000-0000000000e2') = 'admin'
            then 'OK  rebaixou super2 (ainda restam superadmins)' else 'FALHOU' end as t07;

\echo ''
\echo '### T08 — o ÚLTIMO superadmin não cai #################################'
-- Neste banco de teste os 5 do bootstrap não têm conta (profiles vazios para
-- eles), então super1 é o único superadmin restante — cenário exato da trava.
do $$
begin
  update public.profiles set role = 'candidato'
   where id = '00000000-0000-0000-0000-0000000000e1';
  raise exception 'FALHOU: o último superadmin foi rebaixado';
exception when raise_exception then
  if sqlerrm like '%último SuperAdministrador%' then
    raise notice 'OK  trava segurou o último superadmin';
  else
    raise;
  end if;
end $$;
reset role;
select case when (select role from public.profiles
                   where id = :U_SUPER1) = 'superadmin'
            then 'OK  super1 segue superadmin' else 'FALHOU' end as t08b;

\echo ''
\echo '### T09 — avaliador: nada de allowlist, nada de papéis ################'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e4';
select case when (select count(*) from public.staff_allowlist) = 0
            then 'OK  allowlist invisível fora do superadmin' else 'FALHOU' end as t09;
reset role;

\echo ''
\echo '### FIM — qualquer FALHOU acima é regressão da 012 ####################'
