-- ============================================================================
-- sql_testes.sql — bateria de comportamento sobre 001..005 no Postgres local.
-- Roda como superusuário para o SETUP e alterna para o papel `authenticated`
-- com `request.jwt.claim.sub` diferente para simular cada sessão (é o que o
-- auth.uid() do dublê lê).
-- ============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\pset pager off

\set U_COORD  '''00000000-0000-0000-0000-0000000000c1'''
\set U_LLA    '''00000000-0000-0000-0000-000000000011'''
\set U_MEMBRO '''00000000-0000-0000-0000-000000000021'''
\set U_OUTRO  '''00000000-0000-0000-0000-000000000031'''
\set U_AVAL   '''00000000-0000-0000-0000-000000000041'''
\set LAB1     '''00000000-0000-0000-0000-00000000a001'''
\set LAB2     '''00000000-0000-0000-0000-00000000a002'''
\set REL_M    '''00000000-0000-0000-0000-00000000d001'''
\set REL_O    '''00000000-0000-0000-0000-00000000d002'''

\echo '### SETUP ############################################################'
insert into auth.users (id, email) values
  (:U_COORD,  'coord@inct.br'),
  (:U_LLA,    'lla@inct.br'),
  (:U_MEMBRO, 'membro@inct.br'),
  (:U_OUTRO,  'outro@inct.br'),
  (:U_AVAL,   'avaliador@inct.br');

-- avaliador da seleção de IC (papel 'avaliador' em profiles, via allowlist)
update public.profiles set role = 'avaliador' where id = :U_AVAL;

update public.relatorio_ciclos set status = 'aberto' where slug = 'ciclo-1';

insert into public.laboratorios (id, ciclo_id, sigla, nome, uf, eets, lla_user_id)
select :LAB1, c.id, 'LLA-01', 'Laboratório de Toxinas', 'RO', array['EET-3'], :U_LLA
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';
insert into public.laboratorios (id, ciclo_id, sigla, nome, uf, eets)
select :LAB2, c.id, 'LLA-02', 'Laboratório de Clima', 'AM', array['EET-1']
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';

insert into public.ciclo_membros (ciclo_id, user_id, nome, email, papel, categoria_picc, laboratorio_id, instituicao_ror)
select c.id, :U_COORD, 'Coordenação', 'coord@inct.br', 'coordenacao', 'Membro do Comitê Gestor', null, '02842cb31'
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';
insert into public.ciclo_membros (ciclo_id, user_id, nome, email, papel, categoria_picc, laboratorio_id, instituicao_ror)
select c.id, :U_LLA, 'Líder 01', 'lla@inct.br', 'lla', 'Líder de Laboratório Associado', :LAB1, '02842cb31'
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';
insert into public.ciclo_membros (ciclo_id, user_id, nome, email, papel, categoria_picc, laboratorio_id, instituicao_ror, orcid, lattes_id)
select c.id, :U_MEMBRO, 'Membro Um', 'membro@inct.br', 'pesquisador', 'Pesquisador', :LAB1, '02842cb31',
       '0000-0002-1825-0097', '1305959204330545'
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';
insert into public.ciclo_membros (ciclo_id, user_id, nome, email, papel, categoria_picc, laboratorio_id, instituicao_ror)
select c.id, :U_OUTRO, 'Membro Outro', 'outro@inct.br', 'pesquisador', 'Pesquisador', :LAB2, '01qg3j296'
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';

\echo ''
\echo '### T01 — trigger irmão vinculou quem entrou pelo link mágico? #########'
-- (usuário criado DEPOIS do roster: o INSERT em auth.users casa o e-mail)
insert into public.ciclo_membros (ciclo_id, nome, email, papel, laboratorio_id)
select c.id, 'Chega Depois', 'depois@inct.br', 'pesquisador', :LAB1
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';
insert into auth.users (email) values ('depois@inct.br');
select case when user_id is not null and primeiro_acesso_em is not null
            then 'OK  vinculado no 1º acesso' else 'FALHOU' end as t01
  from public.ciclo_membros where email = 'depois@inct.br';
select case when (select count(*) from public.profiles where email = 'depois@inct.br') = 1
            then 'OK  handle_new_user do 001 continua funcionando' else 'FALHOU' end as t01b;

\echo ''
\echo '### T02 — membro cria relato (rascunho, sem protocolo) #################'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
insert into public.relatos (id, ciclo_id, user_id, membro_id)
select :REL_M, c.id, :U_MEMBRO, m.id
  from public.relatorio_ciclos c
  join public.ciclo_membros m on m.ciclo_id = c.id and m.user_id = :U_MEMBRO
 where c.slug = 'ciclo-1';
select case when status = 'rascunho' and protocolo is null
            then 'OK  rascunho é o estado inicial e NÃO queima protocolo'
            else 'FALHOU: ' || status || ' / ' || coalesce(protocolo,'null') end as t02
  from public.relatos where id = :REL_M;

\echo ''
\echo '### T03 — membro NÃO cria fato coletivo confirmado #####################'
insert into public.fatos (id, ciclo_id, laboratorio_id, tipo, ocorrido_em, titulo, status, payload)
select '00000000-0000-0000-0000-00000000f001', c.id, :LAB1, 'expedicao', '2025-09-01',
       'Expedição ao Rio Machado', 'confirmado', '{"municipio":"1100205","dias":7}'::jsonb
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';
select case when status = 'proposto' and comite = 'CEXPECIAL' and criado_por = :U_MEMBRO
            then 'OK  coergido para proposto; comitê derivado do tipo'
            else 'FALHOU: ' || status || ' / ' || coalesce(comite,'null') end as t03
  from public.fatos where id = '00000000-0000-0000-0000-00000000f001';

\echo ''
\echo '### T04 — LLA confirma; membro adere; adesão é única ###################'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
update public.fatos set status = 'confirmado'
 where id = '00000000-0000-0000-0000-00000000f001';
select case when status = 'confirmado' and confirmado_por = :U_LLA and confirmado_em is not null
            then 'OK  LLA confirmou' else 'FALHOU' end as t04
  from public.fatos where id = '00000000-0000-0000-0000-00000000f001';

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
insert into public.fato_participantes (fato_id, relato_id, user_id)
values ('00000000-0000-0000-0000-00000000f001', :REL_M, :U_MEMBRO);
do $$ begin
  insert into public.fato_participantes (fato_id, relato_id, user_id)
  values ('00000000-0000-0000-0000-00000000f001',
          '00000000-0000-0000-0000-00000000d001',
          '00000000-0000-0000-0000-000000000021');
  raise notice 'FALHOU: adesão duplicada passou';
exception when unique_violation then
  raise notice 'OK  adesão é única por (fato, pessoa) — 5 pessoas, 1 expedição';
end $$;

\echo ''
\echo '### T05 — membro de OUTRO laboratório não enxerga nem adere ############'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000031';
select case when count(*) = 0 then 'OK  fato do LLA-01 invisível para o LLA-02'
            else 'VAZOU: ' || count(*) end as t05
  from public.fatos where id = '00000000-0000-0000-0000-00000000f001';

\echo ''
\echo '### T06 — produção no período, dedupe entre coautores ##################'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
insert into public.producoes (id, ciclo_id, ancora_tipo, ancora_valor, tipo, publicado_em, ancora_resolvida, metadados)
select '00000000-0000-0000-0000-00000000e001', c.id, 'doi', '10.1016/J.TOXICON.2025.108123',
       'artigo_periodico', '2025-11-14', true, '{"title":"Veneno e clima"}'::jsonb
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';
insert into public.producao_vinculos (producao_id, relato_id, origem)
values ('00000000-0000-0000-0000-00000000e001', :REL_M, 'doi_colado');
select case when periodo_situacao = 'no_periodo' and ciclo_competencia_id is not null
            then 'OK  competência resolvida no Ciclo 1' else 'FALHOU: ' || periodo_situacao end as t06
  from public.producoes where id = '00000000-0000-0000-0000-00000000e001';

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000031';
do $$ begin
  insert into public.producoes (ciclo_id, ancora_tipo, ancora_valor, tipo, publicado_em)
  select c.id, 'doi', '10.1016/j.toxicon.2025.108123', 'artigo_periodico', '2025-11-14'
    from public.relatorio_ciclos c where c.slug = 'ciclo-1';
  raise notice 'FALHOU: o mesmo DOI entrou duas vezes (contaria 2× na Tabela A)';
exception when unique_violation then
  raise notice 'OK  dedupe na canônica: mesmo DOI (maiúsculas/minúsculas) é UMA linha';
end $$;
select case when (public.checar_ancora((select id from public.relatorio_ciclos where slug='ciclo-1'),
                                       'doi','https://doi.org/10.1016/j.toxicon.2025.108123') ->> 'existe') = 'true'
            then 'OK  checar_ancora normaliza prefixo de resolvedor e caixa'
            else 'FALHOU: prefixo https://doi.org/ passou batido' end as t06b;
do $$ begin
  insert into public.producoes (ciclo_id, ancora_tipo, ancora_valor, tipo, publicado_em)
  select c.id, 'doi', 'https://doi.org/10.1016/J.Toxicon.2025.108123', 'artigo_periodico', '2025-11-14'
    from public.relatorio_ciclos c where c.slug = 'ciclo-1';
  raise notice 'FALHOU: DOI com prefixo de URL entrou como segundo trabalho';
exception when unique_violation then
  raise notice 'OK  o índice normaliza: DOI colado do navegador é o MESMO trabalho';
end $$;
do $$ begin
  insert into public.producoes (ciclo_id, ancora_tipo, ancora_valor, tipo, ano)
  select c.id, 'isbn', '978-85-333-0227-4', 'livro', 2025
    from public.relatorio_ciclos c where c.slug = 'ciclo-1';
  insert into public.producoes (ciclo_id, ancora_tipo, ancora_valor, tipo, ano)
  select c.id, 'isbn', '9788533302274', 'livro', 2025
    from public.relatorio_ciclos c where c.slug = 'ciclo-1';
  raise notice 'FALHOU: mesmo ISBN com e sem hífen virou dois livros';
exception when unique_violation then
  raise notice 'OK  mesmo ISBN com e sem hífen é UM livro';
end $$;
select public.checar_ancora((select id from public.relatorio_ciclos where slug='ciclo-1'),
                            'doi','10.1016/j.toxicon.2025.108123') as t06c_sem_nome_de_ninguem;

\echo ''
\echo '### T07 — DECISÃO 3: item de junho/2026 é aceito, marcado, e não conta #'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
insert into public.producoes (id, ciclo_id, ancora_tipo, ancora_valor, tipo, publicado_em, metadados)
select '00000000-0000-0000-0000-00000000e002', c.id, 'doi', '10.1000/depois-do-ciclo1',
       'artigo_periodico', '2026-06-15', '{"title":"Saiu em junho de 2026"}'::jsonb
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';
insert into public.producao_vinculos (producao_id, relato_id) values ('00000000-0000-0000-0000-00000000e002', :REL_M);
insert into public.producoes (id, ciclo_id, ancora_tipo, ancora_valor, tipo, publicado_em, metadados)
select '00000000-0000-0000-0000-00000000e003', c.id, 'doi', '10.1000/antes-do-inct',
       'artigo_periodico', '2024-03-01', '{"title":"Linha de base"}'::jsonb
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';
select id, publicado_em, periodo_situacao,
       (ciclo_competencia_id is null) as competencia_nula
  from public.producoes order by publicado_em;
select case when count(*) = 1 then 'OK  só o item do período conta na Tabela A'
            else 'FALHOU: contou ' || count(*) end as t07
  from public.v_producao_por_tipo;
select entidade, data, periodo_situacao, titulo from public.v_itens_fora_do_periodo order by data;

\echo ''
\echo '### T08 — envio: veracidade, resultado, protocolo ######################'
do $$ begin
  update public.relatos set status = 'enviado'
   where id = '00000000-0000-0000-0000-00000000d001';
  raise notice 'FALHOU: enviou sem declaração de veracidade';
exception when check_violation then
  raise notice 'OK  sem declaração de veracidade não há envio';
end $$;
do $$ begin
  update public.relatos set status = 'enviado', declaracao_veracidade = true
   where id = '00000000-0000-0000-0000-00000000d001';
  raise notice 'FALHOU: enviou sem resultado_principal e sem nada_a_declarar';
exception when check_violation then
  raise notice 'OK  resultado_principal (20..600) é exigido no envio';
end $$;
update public.relatos
   set status = 'enviado', declaracao_veracidade = true,
       narrativas = jsonb_build_object(
         'resultado_principal', 'Identificamos duas toxinas novas e treinamos a primeira versão do SIMBAM.',
         'dificuldades', 'Falta de transporte fluvial no período de seca.')
 where id = '00000000-0000-0000-0000-00000000d001';
select case when protocolo = 'CNX-R1-0001' and submitted_at is not null
            then 'OK  protocolo nasce na transição para enviado: ' || protocolo
            else 'FALHOU: ' || coalesce(protocolo,'null') end as t08
  from public.relatos where id = :REL_M;

-- segundo relato: numeração sequencial, sem buraco por rascunho abandonado
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000031';
insert into public.relatos (id, ciclo_id, user_id, membro_id, status, declaracao_veracidade, nada_a_declarar)
select :REL_O, c.id, :U_OUTRO, m.id, 'enviado', true, true
  from public.relatorio_ciclos c
  join public.ciclo_membros m on m.ciclo_id = c.id and m.user_id = :U_OUTRO
 where c.slug = 'ciclo-1';
select case when protocolo = 'CNX-R1-0002'
            then 'OK  "nada a declarar" envia sem campo obrigatório: ' || protocolo
            else 'FALHOU: ' || coalesce(protocolo,'null') end as t08b
  from public.relatos where id = :REL_O;

\echo ''
\echo '### T09 — a cadeia de leitura membro → LLA → coordenação ###############'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000031';
select case when count(*) = 1 then 'OK  membro vê só o próprio relato' else 'VAZOU: ' || count(*) end as t09_membro
  from public.relatos;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select case when count(*) = 1 then 'OK  LLA vê o relato do próprio laboratório (1 de 2)'
            else 'FALHOU/VAZOU: ' || count(*) end as t09_lla from public.relatos;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select case when count(*) = 2 then 'OK  coordenação vê tudo' else 'FALHOU: ' || count(*) end as t09_coord
  from public.relatos;

\echo ''
\echo '### T10 — A ARMADILHA: avaliador da seleção de IC NÃO lê relato ########'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000041';
select public.is_staff() as is_staff_do_avaliador,
       (select count(*) from public.relatos)   as relatos_visiveis,
       (select count(*) from public.fatos)     as fatos_visiveis,
       (select count(*) from public.producoes) as producoes_visiveis;

\echo ''
\echo '### T11 — anônimo não enxerga nada deste módulo ########################'
reset role;
set role anon;
do $$ begin
  perform 1 from public.relatos;
  raise notice 'FALHOU: anon leu relatos';
exception when insufficient_privilege then raise notice 'OK  anon sem privilégio em relatos';
end $$;
do $$ begin
  perform 1 from public.editais;
  raise notice 'OK  o site público continua lendo editais (001 intacto)';
exception when insufficient_privilege then raise notice 'FALHOU: quebrou o 001';
end $$;

\echo ''
\echo '### T12 — auditoria append-only ########################################'
reset role;
select entidade, acao, (snapshot is not null) as tem_snapshot,
       (snapshot_sha256 is not null) as tem_hash, (por is not null) as tem_autor
  from public.relato_eventos order by at, entidade limit 12;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
do $$ begin
  insert into public.relato_eventos (entidade, entidade_id, acao) values ('relato', gen_random_uuid(), 'insert');
  raise notice 'FALHOU: log não é append-only';
exception
  when insufficient_privilege then raise notice 'OK  ninguém insere no log pela API (sem privilégio)';
  when others then raise notice 'OK  ninguém insere no log pela API (%)', sqlerrm;
end $$;

\echo ''
\echo '### T13 — Ciclo 2: uma chamada reivindica o que estava esperando #######'
reset role;
insert into public.relatorio_ciclos
  (slug, numero, titulo, status, periodo_inicio, periodo_fim, abre_em, fecha_em, chamada)
values ('ciclo-2', 2, 'Ciclo 2', 'aberto', '2026-05-01', '2027-04-30',
        now(), '2027-06-30T23:59:59-04:00', 'nº 46/2024');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select * from public.reivindicar_itens_do_ciclo((select id from public.relatorio_ciclos where slug='ciclo-2'));
reset role;
select p.ancora_valor, p.periodo_situacao, c.slug as competencia
  from public.producoes p left join public.relatorio_ciclos c on c.id = p.ciclo_competencia_id
 order by p.publicado_em;

\echo ''
\echo '### T14 — dois ciclos não podem cobrir a mesma data ####################'
do $$ begin
  insert into public.relatorio_ciclos
    (slug, numero, titulo, status, periodo_inicio, periodo_fim, abre_em, fecha_em)
  values ('ciclo-x', 9, 'Sobreposto', 'rascunho', '2026-04-01', '2026-06-30', now(), now() + interval '1 day');
  raise notice 'FALHOU: períodos sobrepostos entraram (item contaria em 2 ciclos)';
exception when exclusion_violation then raise notice 'OK  EXCLUDE barrou sobreposição de períodos';
end $$;

\echo ''
\echo '### T15 — data futura e limites de arquivo ############################'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
do $$ begin
  insert into public.fatos (ciclo_id, laboratorio_id, tipo, ocorrido_em, titulo)
  select c.id, '00000000-0000-0000-0000-00000000a001', 'expedicao', current_date + 30, 'Ainda não aconteceu'
    from public.relatorio_ciclos c where c.slug = 'ciclo-1';
  raise notice 'FALHOU: aceitou fato no futuro';
exception when check_violation then raise notice 'OK  "essa data ainda não chegou"';
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
do $$ begin
  insert into public.relato_arquivos (relato_id, storage_path, mime, bytes, uso)
  values ('00000000-0000-0000-0000-00000000d001', 'x/y/z/1.pdf', 'application/pdf', 5000000, 'comprovante');
  raise notice 'FALHOU: aceitou arquivo acima de 1 MB';
exception when check_violation then raise notice 'OK  teto de 1 MB por arquivo';
end $$;

\echo ''
\echo '### T16 — 001..004 continuam funcionando (não-regressão) ###############'
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000051', 'candidato@x.br');
-- A janela do edital 04/2026 fechou em 19/07/2026 e hoje é 04/08/2026: o
-- enforce_edital_window() do 001 recusa inscrição nova, corretamente. Para
-- provar que o CAMINHO continua íntegro, entra-se como staff (que o 001 isenta).
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000041';
insert into public.applications (edital_id, user_id, nome, cpf, email, instituicao, curso, periodo, estado, orientador)
select e.id, '00000000-0000-0000-0000-000000000051', 'Candidata Teste', '00000000000',
       'candidato@x.br', 'UNIR', 'Biomedicina', '5', 'RO', 'Andreimar Martins Soares'
  from public.editais e where e.slug = 'selecao-ic-2026';
select case when protocolo like 'INCT-04-2026-%' then 'OK  protocolo do 003 intacto: ' || protocolo
            else 'FALHOU: ' || protocolo end as t16
  from public.applications where email = 'candidato@x.br';
insert into public.evaluations (application_id, evaluator_id, scores, total, final_score)
select a.id, '00000000-0000-0000-0000-000000000041', '{"plano":50}'::jsonb, 50, 50
  from public.applications a where a.email = 'candidato@x.br';
select case when count(*) = 1 then 'OK  log de avaliação do 004 intacto' else 'FALHOU' end as t16b
  from public.evaluation_events;
select case when (select count(*) from public.profiles where role = 'avaliador') >= 1
            then 'OK  profiles.role intocado (admin|avaliador|candidato)' else 'FALHOU' end as t16c;

\echo ''
\echo '### T17 — nenhuma política nova usa is_staff() #########################'
select count(*) as politicas_novas_com_is_staff
  from pg_policies
 where schemaname = 'public'
   and tablename in ('relatorio_ciclos','laboratorios','ciclo_membros','relatos','fatos',
                     'fato_participantes','producoes','producao_vinculos','producao_autores',
                     'relato_arquivos','relato_eventos')
   and (coalesce(qual,'') || coalesce(with_check,'')) like '%is_staff%';

\echo ''
\echo '### T18 — cobertura (o painel que diz se o número é baixo por quê) ####'
\echo '--- como COORDENAÇÃO (a view roda com security_invoker: RLS vale) ---'
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select coalesce(l.sigla,'(sem lab)') as lab, v.convidados, v.entraram, v.enviaram,
       v.nada_a_declarar, v.silenciosos
  from public.v_cobertura v left join public.laboratorios l on l.id = v.laboratorio_id
 order by 1;
\echo '--- o MESMO select como membro comum: não enxerga a rede inteira ---'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
select coalesce(sum(v.convidados),0) as convidados_visiveis_ao_membro from public.v_cobertura v;

\echo ''
\echo '### T19 — competência por ANO quando não há data completa #############'
insert into public.producoes (ciclo_id, ancora_tipo, ancora_valor, tipo, ano)
select c.id, 'inpi', 'BR102025000001-2', 'patente', 2025
  from public.relatorio_ciclos c where c.slug = 'ciclo-1';
select ancora_valor, ano, data_referencia, periodo_situacao
  from public.producoes where ancora_tipo = 'inpi';
