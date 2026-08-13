-- ============================================================================
-- sql_testes_correcoes.sql — a bateria que FALTAVA: prova que os tres bloqueios
-- apontados pela revisao adversarial estao mesmo fechados.
-- Roda DEPOIS de sql_testes.sql, no mesmo banco (reusa o roster que ele criou).
-- ============================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset pager off

\set U_MEMBRO '''00000000-0000-0000-0000-000000000021'''
\set LAB1     '''00000000-0000-0000-0000-00000000a001'''
\set LAB2     '''00000000-0000-0000-0000-00000000a002'''

\echo ''
\echo '### C01 — ESCALACAO DE PRIVILEGIO: membro vira coordenacao? ###########'
set role authenticated;
select set_config('request.jwt.claim.sub', :U_MEMBRO, false);
-- O ataque exato descrito pela revisao: um PATCH do PostgREST.
update public.ciclo_membros set papel = 'coordenacao' where user_id = auth.uid();
\echo '   ^^^ ACIMA TEM DE APARECER ERRO. Conferindo o papel que ficou gravado:'
reset role;
select papel as papel_apos_o_ataque,
       case when papel = 'pesquisador' then 'OK  escalacao BLOQUEADA'
            else 'FALHA  O MEMBRO VIROU ' || upper(papel) end as veredito
  from public.ciclo_membros where user_id = :U_MEMBRO;

\echo ''
\echo '### C02 — troca de laboratorio ja preenchido (le fatos alheios) #######'
set role authenticated;
select set_config('request.jwt.claim.sub', :U_MEMBRO, false);
update public.ciclo_membros set laboratorio_id = :LAB2 where user_id = auth.uid();
\echo '   ^^^ ACIMA TEM DE APARECER ERRO. Conferindo:'
reset role;
select case when laboratorio_id = :LAB1 then 'OK  continua no proprio laboratorio'
            else 'FALHA  mudou de laboratorio sozinho' end as veredito
  from public.ciclo_membros where user_id = :U_MEMBRO;

\echo ''
\echo '### C03 — PREENCHER laboratorio vazio continua permitido #############'
reset role;
insert into public.auth_users_shim_noop values (1) on conflict do nothing;
\echo '(ignore o erro acima se aparecer: shim opcional)'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000051', 'semlab@inct.br') on conflict do nothing;
insert into public.ciclo_membros (ciclo_id, user_id, nome, email, papel, laboratorio_id)
select c.id, '00000000-0000-0000-0000-000000000051', 'Sem Lab', 'semlab@inct.br', 'pesquisador', null
  from public.relatorio_ciclos c where c.slug = 'ciclo-1'
on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000051', false);
update public.ciclo_membros set laboratorio_id = :LAB1 where user_id = auth.uid();
reset role;
select case when laboratorio_id = :LAB1 then 'OK  preencheu o laboratorio que estava vazio'
            else 'FALHA  nao conseguiu preencher (regressao de usabilidade)' end as veredito
  from public.ciclo_membros where user_id = '00000000-0000-0000-0000-000000000051';

\echo ''
\echo '### C04 — DELETE em relatorio_ciclos pelo cliente (CASCADE apagaria tudo)'
set role authenticated;
select set_config('request.jwt.claim.sub', :U_MEMBRO, false);
delete from public.relatorio_ciclos;
\echo '   ^^^ ACIMA TEM DE APARECER ERRO DE PERMISSAO. Conferindo:'
reset role;
select count(*) as ciclos_vivos,
       case when count(*) > 0 then 'OK  o ciclo continua existindo'
            else 'FALHA  APAGARAM TUDO' end as veredito
  from public.relatorio_ciclos;

\echo ''
\echo '### C05 — receitas operacionais rodam no SQL Editor (auth.uid() nulo) ##'
reset role;
select set_config('request.jwt.claim.sub', '', false);
\echo '-- vincular_membros_existentes(): a receita da secao 19'
select public.vincular_membros_existentes() as vinculados,
       'OK  backfill rodou sem sessao' as veredito;

\echo '-- reivindicar_itens_do_ciclo(): a receita da secao 17'
insert into public.relatorio_ciclos (slug, numero, titulo, status, periodo_inicio, periodo_fim, abre_em, fecha_em)
values ('ciclo-2-teste', 2, 'Ciclo 2', 'rascunho', '2026-05-01', '2027-04-30',
        '2027-05-01T00:00:00-04:00', '2027-12-31T23:59:59-04:00')
on conflict (slug) do nothing;
select * from public.reivindicar_itens_do_ciclo(
  (select id from public.relatorio_ciclos where slug = 'ciclo-2-teste'));
\echo '   ^^^ tem de listar as tabelas, sem erro de permissao'

\echo ''
\echo '### C06 — o guarda ainda deixa a coordenacao trabalhar ################'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
update public.ciclo_membros set papel = 'lla' where user_id = :U_MEMBRO;
reset role;
select case when papel = 'lla' then 'OK  coordenacao ainda promove membro'
            else 'FALHA  coordenacao ficou sem poder' end as veredito
  from public.ciclo_membros where user_id = :U_MEMBRO;
-- devolve como estava
update public.ciclo_membros set papel = 'pesquisador' where user_id = :U_MEMBRO;
