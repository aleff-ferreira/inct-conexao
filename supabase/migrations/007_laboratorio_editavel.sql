-- ============================================================================
--  INCT-CONEXAO · 007 — o membro pode corrigir o próprio Laboratório Associado
-- ============================================================================
--  Rode no SQL Editor do Supabase DEPOIS de 001→006.
--
--  O QUE MUDA, E POR QUE A REGRA ANTIGA NÃO PROTEGIA NADA
--  -----------------------------------------------------
--  A 005 (`guard_membro_self`) deixava o membro PREENCHER o laboratório quando
--  ele estava vazio, mas proibia TROCAR um já preenchido. A intenção era boa —
--  `meu_laboratorio()` sai dessa coluna, e é ela que decide quais fatos
--  coletivos a pessoa enxerga. Só que a proteção era ilusória: a primeira
--  escolha já era livre, então quem quisesse ver os fatos do laboratório X
--  bastava escolher X de saída. A regra não impedia o acesso; impedia apenas a
--  CORREÇÃO de quem escolheu errado.
--
--  E o custo era real e imediato: a semente `002_equipe.sql` atribui o
--  laboratório a partir do quadro da proposta, com siglas provisórias
--  (UNIR-1, UNIR-2…) e sem o mapa de EET. Ou seja, quase todo mundo chega com
--  a coluna JÁ preenchida — e, na prática, com o campo travado num valor que
--  ninguém conferiu. Foi exatamente o que apareceu em teste: a tela mostrava
--  um input somente-leitura, e o pesquisador não conseguia se corrigir.
--
--  Fica valendo: o membro escolhe e troca o próprio laboratório; toda troca é
--  registrada em `relato_eventos`, que é o que permite à coordenação auditar
--  depois. Papel, categoria, e-mail, dono e ciclo continuam trancados — esses
--  sim mudam permissão, e continuam sendo só da coordenação.
-- ============================================================================

create or replace function public.guard_membro_self()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Sem sessão de usuário final (trigger interno de 1º acesso, service_role,
  -- importação da coordenação pelo SQL Editor) o guarda não se aplica: ele
  -- existe para conter o MEMBRO logado, não o servidor.
  if auth.uid() is null then return new; end if;
  if public.is_coordenacao(new.ciclo_id) then return new; end if;

  -- `papel` é a linha mais importante deste arquivo: `is_coordenacao()` lê
  -- exatamente esta coluna, e sem ela na lista qualquer pessoa do roster viraria
  -- coordenação com um único PATCH do PostgREST.
  if new.email          is distinct from old.email
     or new.user_id     is distinct from old.user_id
     or new.ciclo_id    is distinct from old.ciclo_id
     or new.papel       is distinct from old.papel
     or new.categoria_picc is distinct from old.categoria_picc
     or new.convite_token  is distinct from old.convite_token
     or new.ativo       is distinct from old.ativo then
    raise exception 'Estes campos do cadastro só a coordenação altera.';
  end if;

  -- laboratorio_id: LIVRE para o dono da linha (ver o cabeçalho). Só se
  -- registra a troca, para a coordenação poder auditar.
  -- Colunas conforme a 005: `acao` tem CHECK em (insert|update|delete), então a
  -- natureza da mudança vai em `campos` e o antes/depois em `snapshot`.
  if new.laboratorio_id is distinct from old.laboratorio_id then
    insert into public.relato_eventos (ciclo_id, entidade, entidade_id, acao, campos, por, snapshot)
    values (
      new.ciclo_id, 'ciclo_membros', new.id, 'update', array['laboratorio_id'], auth.uid(),
      jsonb_build_object('de', old.laboratorio_id, 'para', new.laboratorio_id)
    );
  end if;

  return new;
end; $$;

-- ============================================================================
--  CONFERÊNCIA (rode depois; deve devolver `true`)
-- ============================================================================
--  O marcador é o registro de auditoria da troca (`array['laboratorio_id']`),
--  que só existe na versão desta migração — a da 006 não o tem. (A conferência
--  anterior procurava `troca_laboratorio`, string que nunca esteve no corpo da
--  função: devolvia `false` mesmo com a 007 aplicada.)
--  select prosrc like '%array[''laboratorio_id'']%' as guarda_atualizada
--    from pg_proc where proname = 'guard_membro_self';
-- ============================================================================
