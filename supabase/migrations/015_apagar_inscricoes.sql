-- ============================================================================
--  INCT-CONEXAO · 015: exclusão DEFINITIVA de inscrições (LGPD), superadmin
-- ============================================================================
--  Decisão do dono (13/08/2026): os painéis de inscrição ganham um botão de
--  exclusão COMPLETA, exclusivo de SuperAdministradores. Nada de lixeira,
--  nada de marcação de "apagado": atender um pedido de exclusão da LGPD
--  significa não guardar cópia nenhuma do dado pessoal.
--
--  POR QUE RPCs, E NÃO POLICIES DE DELETE
--  --------------------------------------
--  As tabelas de inscrição seguem a régua das migrações 008/013: RLS ligada e
--  NENHUMA policy de escrita; toda escrita passa por RPC `security definer`.
--  Dar policy de DELETE a superadmin abriria a porta a apagamentos parciais
--  (a linha sem as versões, o registro sem os arquivos). A RPC apaga o
--  conjunto inteiro numa transação só, ou nada.
--
--  O QUE CADA UMA APAGA
--  --------------------
--   · apagar_inscricao_curso(id):   curso_inscricoes + versões (FK cascade).
--     A vaga volta a contar como livre na hora (curso_vagas conta linhas).
--   · apagar_resposta_workshop(id): workshop_respostas + versões (FK cascade).
--   · apagar_inscricao_selecao(id): applications + evaluations +
--     evaluation_events + application_files no banco, e DEVOLVE os caminhos
--     dos PDFs (restritos à pasta do dono) para o cliente removê-los pela
--     Storage API com a policy de superadmin criada aqui. A CONTA do
--     candidato (auth/profiles) fica: conta é assunto da área Contas, e a
--     pessoa pode ter outras inscrições.
--
--  RASTRO SEM DADO PESSOAL: cada exclusão emite `raise log` com o protocolo e
--  o uid de quem apagou. Vai para o log do Postgres (Dashboard, Logs), não
--  para tabela nenhuma: rastreabilidade de operação sem guardar o dado.
--
--  Idempotente: `create or replace` em tudo; rodar de novo não muda nada.
-- ============================================================================


-- ============================================= 1. CURSO (CONEXAO-BIOINFORMÁTICA)
create or replace function public.apagar_inscricao_curso(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prot  text;
begin
  if not public.is_superadmin() then
    return jsonb_build_object('ok', false, 'estado', 'sem_permissao',
      'mensagem', 'A exclusão definitiva é exclusiva de SuperAdministradores.');
  end if;

  select r.protocolo into v_prot from public.curso_inscricoes r where r.id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'estado', 'nao_encontrada',
      'mensagem', 'Esta inscrição não existe mais. Recarregue a lista.');
  end if;

  -- As versões arquivadas caem junto: curso_inscricoes_versoes.inscricao_id
  -- referencia curso_inscricoes com ON DELETE CASCADE (migração 013). O
  -- trigger de versionamento só dispara em UPDATE, então o DELETE não deixa
  -- cópia nova para trás.
  delete from public.curso_inscricoes where id = p_id;

  raise log 'apagar_inscricao_curso: % apagada por %', coalesce(v_prot, p_id::text), auth.uid();
  return jsonb_build_object('ok', true, 'estado', 'apagada',
    'mensagem', 'Inscrição apagada por completo. A vaga voltou a contar como livre.');
end; $$;

revoke all on function public.apagar_inscricao_curso(uuid) from public;
revoke all on function public.apagar_inscricao_curso(uuid) from anon;
grant execute on function public.apagar_inscricao_curso(uuid) to authenticated;


-- ============================================= 2. FITOFARMAS (pré-evento) ==
create or replace function public.apagar_resposta_workshop(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prot  text;
begin
  if not public.is_superadmin() then
    return jsonb_build_object('ok', false, 'estado', 'sem_permissao',
      'mensagem', 'A exclusão definitiva é exclusiva de SuperAdministradores.');
  end if;

  select r.protocolo into v_prot from public.workshop_respostas r where r.id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'estado', 'nao_encontrada',
      'mensagem', 'Esta resposta não existe mais. Recarregue a lista.');
  end if;

  -- workshop_respostas_versoes.resposta_id tem ON DELETE CASCADE (migração
  -- 008): as versões arquivadas caem junto, e o trigger de versionamento só
  -- dispara em UPDATE.
  delete from public.workshop_respostas where id = p_id;

  raise log 'apagar_resposta_workshop: % apagada por %', coalesce(v_prot, p_id::text), auth.uid();
  return jsonb_build_object('ok', true, 'estado', 'apagada',
    'mensagem', 'Resposta apagada por completo, versões incluídas.');
end; $$;

revoke all on function public.apagar_resposta_workshop(uuid) from public;
revoke all on function public.apagar_resposta_workshop(uuid) from anon;
grant execute on function public.apagar_resposta_workshop(uuid) to authenticated;


-- ============================================= 3. PROCESSO SELETIVO ========
--  A mais delicada: a inscrição carrega avaliações da comissão, o log de
--  auditoria e PDFs no bucket `inscricoes`. A RPC apaga TUDO que é banco numa
--  transação e DEVOLVE os caminhos dos PDFs; quem remove os arquivos é o
--  CLIENTE, pela Storage API, com a policy de superadmin criada logo abaixo.
--  Por que não apagar storage.objects por SQL: isso removeria só o METADADO,
--  os bytes ficariam órfãos no backend do Storage, e a promessa LGPD viraria
--  mentira. A Storage API remove arquivo e metadado juntos.
--  SALVAGUARDA (revisão adversarial de 13/08): `storage_path` é coluna que o
--  próprio candidato grava; um malicioso poderia apontá-la para o PDF de
--  OUTRA pessoa. Por isso a lista devolvida é RESTRITA à pasta do dono da
--  inscrição (user_id/...), e é só ela que o cliente remove.
create or replace function public.apagar_inscricao_selecao(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prot   text;
  v_owner  uuid;
  v_paths  text[];
begin
  if not public.is_superadmin() then
    return jsonb_build_object('ok', false, 'estado', 'sem_permissao',
      'mensagem', 'A exclusão definitiva é exclusiva de SuperAdministradores.');
  end if;

  select a.protocolo, a.user_id into v_prot, v_owner
    from public.applications a where a.id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'estado', 'nao_encontrada',
      'mensagem', 'Esta inscrição não existe mais. Recarregue a lista.');
  end if;

  -- Só a pasta do dono: caminho fora de `user_id/` não entra na lista.
  select coalesce(array_agg(f.storage_path), '{}'::text[])
    into v_paths
    from public.application_files f
   where f.application_id = p_id
     and f.storage_path like v_owner::text || '/%';

  -- Filhos primeiro, explicitamente: não dependemos de cascade que as
  -- migrações 001 a 004 (fora deste repositório) podem não ter declarado.
  delete from public.evaluation_events where application_id = p_id;
  delete from public.evaluations       where application_id = p_id;
  delete from public.application_files where application_id = p_id;
  delete from public.applications      where id = p_id;

  raise log 'apagar_inscricao_selecao: % apagada por % (% pdf(s) a remover via Storage API)',
    coalesce(v_prot, p_id::text), auth.uid(), coalesce(cardinality(v_paths), 0);
  return jsonb_build_object('ok', true, 'estado', 'apagada',
    'arquivos', to_jsonb(v_paths),
    'mensagem', 'Inscrição, avaliações, auditoria e registros de arquivo apagados do banco.');
end; $$;

revoke all on function public.apagar_inscricao_selecao(uuid) from public;
revoke all on function public.apagar_inscricao_selecao(uuid) from anon;
grant execute on function public.apagar_inscricao_selecao(uuid) to authenticated;

-- A policy que permite ao SUPERADMIN remover os PDFs pela Storage API (é a
-- API, não o SQL, que apaga arquivo E metadado). Restrita ao bucket
-- `inscricoes`; a trava de papel é a mesma is_superadmin() das RPCs.
drop policy if exists inscricoes_superadmin_delete on storage.objects;
create policy inscricoes_superadmin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'inscricoes' and public.is_superadmin());


-- ============================================= SANIDADE ====================
--  Esperado: 8 linhas, todas ok = true. As três funções existem; anon NÃO
--  executa NENHUMA das três; authenticated executa as três (a trava de
--  superadmin é DENTRO da função, o grant só abre a porta da chamada); e a
--  policy de storage do superadmin está de pé.
select 'apagar_inscricao_curso existe' as verificacao,
       to_regprocedure('public.apagar_inscricao_curso(uuid)') is not null as ok
union all
select 'apagar_resposta_workshop existe',
       to_regprocedure('public.apagar_resposta_workshop(uuid)') is not null
union all
select 'apagar_inscricao_selecao existe',
       to_regprocedure('public.apagar_inscricao_selecao(uuid)') is not null
union all
select 'anon NAO executa curso',
       not has_function_privilege('anon', 'public.apagar_inscricao_curso(uuid)', 'execute')
union all
select 'anon NAO executa workshop',
       not has_function_privilege('anon', 'public.apagar_resposta_workshop(uuid)', 'execute')
union all
select 'anon NAO executa selecao',
       not has_function_privilege('anon', 'public.apagar_inscricao_selecao(uuid)', 'execute')
union all
select 'authenticated executa as tres',
       has_function_privilege('authenticated', 'public.apagar_inscricao_curso(uuid)', 'execute')
   and has_function_privilege('authenticated', 'public.apagar_resposta_workshop(uuid)', 'execute')
   and has_function_privilege('authenticated', 'public.apagar_inscricao_selecao(uuid)', 'execute')
union all
select 'policy de storage do superadmin existe',
       exists (select 1 from pg_policies
                where schemaname = 'storage' and tablename = 'objects'
                  and policyname = 'inscricoes_superadmin_delete');
