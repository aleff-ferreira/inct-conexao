-- ============================================================================
--  Teste de comportamento da migração 015 (exclusão definitiva, superadmin)
--  Roda no harness descartável, na sessão do psql (superusuário do cluster:
--  os grants não entram em jogo aqui; a trava testada é a de PAPEL, dentro
--  das funções). Cada bloco levanta exceção se a expectativa falhar.
-- ============================================================================

-- ---- contas de teste: S (superadmin) e A (admin comum) ---------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f001', 'super.teste@x.br'),
  ('00000000-0000-0000-0000-00000000f002', 'admin.teste@x.br')
on conflict (id) do nothing;

insert into public.profiles (id, email, role) values
  ('00000000-0000-0000-0000-00000000f001', 'super.teste@x.br', 'superadmin'),
  ('00000000-0000-0000-0000-00000000f002', 'admin.teste@x.br', 'admin')
on conflict (id) do update set role = excluded.role;

-- ---- CURSO: inscrição de teste + uma versão arquivada ----------------------
insert into public.curso_inscricoes
  (id, edicao_id, protocolo, nome, email, whatsapp, instituicao, curso_area,
   vinculo, semestre, experiencia, turma_conteudo1, turma_conteudo2,
   respostas, consentimento_lgpd)
select '00000000-0000-0000-0000-00000000f100', e.id, 'CBIO-TESTE-9001',
       'Pessoa de Teste', 'pessoa.teste@x.br', '(69) 99999-9999', 'UNIR',
       'Veterinária', 'grad_vet', '5', 'nenhuma', 'c1_19ago', 'c2_21ago_manha',
       '{}'::jsonb, true
  from public.curso_edicoes e
 where e.slug = 'curso-conexao-bioinformatica'
on conflict (id) do nothing;

insert into public.curso_inscricoes_versoes (inscricao_id, edicao_id, email, respostas)
select '00000000-0000-0000-0000-00000000f100', e.id, 'pessoa.teste@x.br', '{"v":1}'::jsonb
  from public.curso_edicoes e
 where e.slug = 'curso-conexao-bioinformatica';

-- 1. Admin comum NÃO apaga (sem_permissao) e a linha continua lá.
do $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f002', false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  r := public.apagar_inscricao_curso('00000000-0000-0000-0000-00000000f100');
  if r->>'estado' is distinct from 'sem_permissao' or (r->>'ok')::boolean then
    raise exception 'CURSO/admin: esperava sem_permissao, veio %', r;
  end if;
  if not exists (select 1 from public.curso_inscricoes where id = '00000000-0000-0000-0000-00000000f100') then
    raise exception 'CURSO/admin: a recusa apagou a linha!';
  end if;
end $$;

-- 2. Anônimo (sem sub) também não apaga.
do $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '', false);
  r := public.apagar_inscricao_curso('00000000-0000-0000-0000-00000000f100');
  if r->>'estado' is distinct from 'sem_permissao' then
    raise exception 'CURSO/anon: esperava sem_permissao, veio %', r;
  end if;
end $$;

-- 3. Superadmin apaga: linha E versões somem.
do $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f001', false);
  r := public.apagar_inscricao_curso('00000000-0000-0000-0000-00000000f100');
  if not (r->>'ok')::boolean then
    raise exception 'CURSO/super: esperava ok, veio %', r;
  end if;
  if exists (select 1 from public.curso_inscricoes where id = '00000000-0000-0000-0000-00000000f100') then
    raise exception 'CURSO/super: a linha sobreviveu';
  end if;
  if exists (select 1 from public.curso_inscricoes_versoes where inscricao_id = '00000000-0000-0000-0000-00000000f100') then
    raise exception 'CURSO/super: as versões sobreviveram';
  end if;
end $$;

-- 4. Inscrição inexistente devolve nao_encontrada (e não erro).
do $$
declare r jsonb;
begin
  r := public.apagar_inscricao_curso('00000000-0000-0000-0000-00000000f100');
  if r->>'estado' is distinct from 'nao_encontrada' then
    raise exception 'CURSO/repetido: esperava nao_encontrada, veio %', r;
  end if;
end $$;

-- 5. WORKSHOP: a mesma trava de papel (admin comum recusado).
do $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f002', false);
  r := public.apagar_resposta_workshop(gen_random_uuid());
  if r->>'estado' is distinct from 'sem_permissao' then
    raise exception 'WORKSHOP/admin: esperava sem_permissao, veio %', r;
  end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f001', false);
  r := public.apagar_resposta_workshop(gen_random_uuid());
  if r->>'estado' is distinct from 'nao_encontrada' then
    raise exception 'WORKSHOP/super: esperava nao_encontrada, veio %', r;
  end if;
end $$;

-- ---- SELEÇÃO: inscrição completa com avaliações, auditoria e arquivos ------
insert into public.editais (id, slug, numero, titulo, status, abre_em, fecha_em)
values ('00000000-0000-0000-0000-00000000f200', 'edital-teste-015', '99/2026',
        'Edital de Teste', 'em_avaliacao', now() - interval '30 days', now() - interval '1 day')
on conflict (id) do nothing;

insert into public.applications
  (id, edital_id, user_id, protocolo, nome, cpf, email, instituicao, curso,
   periodo, estado, orientador, lgpd_aceite)
values ('00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-00000000f200',
        '00000000-0000-0000-0000-00000000f002', 'IC-TESTE-9001', 'Candidata Teste',
        '000.000.000-00', 'candidata.teste@x.br', 'UNIR', 'Agronomia', '5', 'RO',
        'Prof. Teste', true)
on conflict (id) do nothing;

insert into public.evaluations (application_id, evaluator_id, total, final_score)
values ('00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-00000000f001', 80, 88)
on conflict (application_id, evaluator_id) do nothing;

insert into public.evaluation_events (application_id, evaluator_id, action)
values ('00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-00000000f001', 'insert');

insert into storage.buckets (id, name) values ('inscricoes', 'inscricoes')
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name)
values ('inscricoes', '00000000-0000-0000-0000-00000000f002/edital-teste-015/carta.pdf');

insert into public.application_files (application_id, kind, storage_path, file_name)
values ('00000000-0000-0000-0000-00000000f201', 'carta',
        '00000000-0000-0000-0000-00000000f002/edital-teste-015/carta.pdf', 'carta.pdf')
on conflict (application_id, kind) do nothing;

-- Simulação de ataque: um registro de arquivo apontando para a pasta de
-- OUTRA pessoa. A RPC NÃO pode devolver esse caminho na lista de remoção.
insert into public.application_files (application_id, kind, storage_path, file_name)
values ('00000000-0000-0000-0000-00000000f201', 'plano',
        '99999999-9999-9999-9999-999999999999/outro-edital/plano.pdf', 'plano.pdf')
on conflict (application_id, kind) do nothing;

-- 6. Admin comum recusado; superadmin apaga tudo do BANCO; a lista de PDFs
--    devolvida tem SÓ a pasta do dono; o storage fica para a Storage API.
do $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f002', false);
  r := public.apagar_inscricao_selecao('00000000-0000-0000-0000-00000000f201');
  if r->>'estado' is distinct from 'sem_permissao' then
    raise exception 'SELECAO/admin: esperava sem_permissao, veio %', r;
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f001', false);
  r := public.apagar_inscricao_selecao('00000000-0000-0000-0000-00000000f201');
  if not (r->>'ok')::boolean then
    raise exception 'SELECAO/super: esperava ok, veio %', r;
  end if;
  if jsonb_array_length(r->'arquivos') is distinct from 1 then
    raise exception 'SELECAO/super: esperava SO o caminho do dono em arquivos, veio %', r->'arquivos';
  end if;
  if r->'arquivos'->>0 is distinct from '00000000-0000-0000-0000-00000000f002/edital-teste-015/carta.pdf' then
    raise exception 'SELECAO/super: caminho errado em arquivos: %', r->'arquivos';
  end if;
  if exists (select 1 from public.applications where id = '00000000-0000-0000-0000-00000000f201') then
    raise exception 'SELECAO/super: a inscrição sobreviveu';
  end if;
  if exists (select 1 from public.evaluations where application_id = '00000000-0000-0000-0000-00000000f201') then
    raise exception 'SELECAO/super: avaliações sobreviveram';
  end if;
  if exists (select 1 from public.evaluation_events where application_id = '00000000-0000-0000-0000-00000000f201') then
    raise exception 'SELECAO/super: auditoria sobreviveu';
  end if;
  if exists (select 1 from public.application_files where application_id = '00000000-0000-0000-0000-00000000f201') then
    raise exception 'SELECAO/super: registros de arquivo sobreviveram';
  end if;
  -- A RPC NÃO toca storage.objects (quem apaga o arquivo de verdade é a
  -- Storage API, no cliente): o metadado tem de continuar aqui.
  if not exists (select 1 from storage.objects
                  where bucket_id = 'inscricoes'
                    and name = '00000000-0000-0000-0000-00000000f002/edital-teste-015/carta.pdf') then
    raise exception 'SELECAO/super: a RPC apagou storage.objects, e nao devia';
  end if;
end $$;

-- 7. A policy de storage do superadmin funciona: com RLS aplicada, um
--    admin comum que NÃO é dono da pasta não apaga; o superadmin apaga.
--    (O f002 é o dono da pasta e PODE apagar pelo policy de dono da 001;
--    por isso o "não pode" é testado com um terceiro usuário, f003.)
--    (No Supabase real o papel authenticated já tem o grant de tabela em
--    storage.objects; o dublê não o traz, então o teste o espelha aqui.)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f003', 'admin2.teste@x.br')
on conflict (id) do nothing;
insert into public.profiles (id, email, role) values
  ('00000000-0000-0000-0000-00000000f003', 'admin2.teste@x.br', 'admin')
on conflict (id) do update set role = excluded.role;

grant select, delete on storage.objects to authenticated;
set role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f003', false);
  delete from storage.objects
   where bucket_id = 'inscricoes'
     and name = '00000000-0000-0000-0000-00000000f002/edital-teste-015/carta.pdf';
end $$;
reset role;
do $$
begin
  if not exists (select 1 from storage.objects
                  where bucket_id = 'inscricoes'
                    and name = '00000000-0000-0000-0000-00000000f002/edital-teste-015/carta.pdf') then
    raise exception 'STORAGE/admin: admin comum apagou objeto do bucket (policy larga demais)';
  end if;
end $$;
set role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f001', false);
  delete from storage.objects
   where bucket_id = 'inscricoes'
     and name = '00000000-0000-0000-0000-00000000f002/edital-teste-015/carta.pdf';
end $$;
reset role;
do $$
begin
  if exists (select 1 from storage.objects
              where bucket_id = 'inscricoes'
                and name = '00000000-0000-0000-0000-00000000f002/edital-teste-015/carta.pdf') then
    raise exception 'STORAGE/super: a policy inscricoes_superadmin_delete nao permitiu o delete';
  end if;
end $$;

select 'TESTE-015: todas as expectativas passaram' as resultado;
