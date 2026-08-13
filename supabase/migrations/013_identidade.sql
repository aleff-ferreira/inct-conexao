-- ============================================================================
--  INCT-CONEXAO · 013 — identidade por e-mail pré-autorizado
--                       (gestão nunca se reivindica pela busca de nome)
-- ============================================================================
--  Rode no SQL Editor DEPOIS de 001→012. Funciona antes ou depois das seeds —
--  sem o ciclo-1 a seção 1 apenas insere zero linhas; reaplique depois delas.
--  IDEMPOTENTE: insert com on conflict, create or replace, backfill que só
--  preenche o que está nulo.
--
--  ORDEM INVERSA (a mesma armadilha que o cabeçalho da 006 manda vigiar): este
--  arquivo dá `create or replace` em reivindicar_cadastro (006) e em
--  guard_membro_self (005→006→007). Se algum dia a 006 ou a 007 forem
--  reaplicadas DEPOIS desta, reaplique a 013 em seguida — senão a guarda de
--  papel e as exceções de vínculo somem de novo, em silêncio.
--
--  O INCIDENTE (11/08/2026)
--  ------------------------
--  O coordenador do INCT (andreimarsoares@gmail.com) abriu o painel da
--  coordenação e leu "peça a coordenação para incluir seu e-mail" — ele É a
--  coordenação. Causa: a seed 001 semeou UMA linha de coordenação
--  (labioprot.toxin@gmail.com) e a seed 002 não traz o coordenador, porque ele
--  não está na seção EQUIPE da proposta (equipe.json, _meta.lacunas, campo
--  "coordenador": não existe categoria 'Coordenador' entre as 13 do PICC).
--  O e-mail pessoal dele não tinha linha em ciclo_membros — e TODA a
--  autorização deste módulo sai de lá.
--
--  A DIRETRIZ DO DONO, IMPLEMENTADA
--  --------------------------------
--  "Os e-mails pré-autorizados ou com contas ativas devem ter seu perfil onde
--  irão se identificar, e essa identificação poderá ser utilizada em toda a
--  plataforma." Em termos deste módulo: `ciclo_membros.user_id` É a identidade
--  da plataforma, e ela nasce por DOIS caminhos que não se cruzam:
--
--   1. E-MAIL PRÉ-AUTORIZADO (papéis de gestão: 'coordenacao', 'cges').
--      A linha do roster JÁ CARREGA o e-mail real. O vínculo é automático:
--        • primeiro login de conta nova  → trigger on_auth_user_created_relato
--          (005, seção 15) no INSERT em auth.users;
--        • conta que já existia          → vincular_meu_cadastro() (006),
--          chamada pelo cliente logo depois do login.
--      Ninguém "escolhe ser" gestão numa busca.
--
--   2. BUSCA DE NOME (pesquisadores) — reivindicar_cadastro (006), como sempre
--      foi. A novidade da 013: ela RECUSA linha cujo papel é de gestão (estado
--      novo 'papel_protegido'). Sem essa guarda, qualquer pessoa logada — ou
--      anônima, com um e-mail próprio — escolheria o nome do coordenador na
--      busca, gravaria o próprio e-mail na linha dele e ganharia o painel no
--      primeiro login: escalada de privilégio por autoatendimento. Para
--      pesquisador comum nada muda (o risco residual aceito na 006 continua
--      aceito: papel de pesquisador não dá poder).
--
--  O QUE ESTE ARQUIVO FAZ
--   1. Insere a linha do coordenador no roster do ciclo-1 e casa o user_id se
--      a conta já existir (o padrão "casa quem já tem conta" da seed 001).
--   2. reivindicar_cadastro ganha a guarda 'papel_protegido'.
--   3. guard_membro_self volta a ter as exceções 1 e 2 da 006, que a 007
--      PERDEU ao partir da versão da 005 (a "ordem inversa" acima, ocorrida de
--      fato). Sem elas, vincular_meu_cadastro() e a reivindicação com sessão
--      aberta morrem em "Estes campos do cadastro só a coordenação altera" —
--      e vincular_meu_cadastro() é exatamente o caminho legítimo do e-mail
--      pré-autorizado. A 013 restaura as exceções, mantém o que a 007
--      acrescentou (laboratório livre, com log em relato_eventos) e devolve à
--      lista de campos trancados os dois que a 007 também deixou cair
--      (catalogo_id e email_pendente — identidade de catálogo não é campo de
--      autoatendimento).
--
--  O QUE ELE NÃO FAZ, DE PROPÓSITO
--   • Não mexe no trigger da 005 nem em vincular_meu_cadastro(): os dois já
--     vinculam por e-mail QUALQUER papel, inclusive gestão — conferido linha a
--     linha (nenhum dos dois filtra por papel). O defeito não estava neles,
--     estava no guarda que a 007 regrediu.
--   • Não dispara vínculo de laboratório para o coordenador: o trigger da 012
--     (ciclo_membros_vincula_lla) exige papel = 'lla'; para 'coordenacao' ele
--     retorna sem tocar em nada — provado no harness da 013.
-- ============================================================================


-- ============================== 1. A LINHA DO COORDENADOR (e-mail real) =====
-- Grafia e dados do catálogo (BuscaPesquisador.tsx, EXTRAS — a entrada que a
-- própria tela criou porque a proposta não tem linha de coordenação):
-- id 'andreimar-martins-soares', FIOCRUZ/RO. categoria_picc fica NULA porque é
-- o que o catálogo declara — não existe 'Coordenador' entre as 13 categorias
-- do PICC, e inventar uma seria dado falso no vocabulário do CNPq.
-- catalogo_id preenchido de propósito: se alguém escolher o nome dele na
-- busca, a RPC ENCONTRA a linha e recusa com 'papel_protegido' — em vez de
-- responder 'nao_encontrado' e mandar a pessoa "falar com a coordenação".
-- laboratorio_id aponta para o primeiro laboratório pelo mesmo motivo da seed
-- 001: a tela 3 precisa de algo para mostrar; coordenação enxerga todos.
insert into public.ciclo_membros
  (ciclo_id, catalogo_id, nome, email, papel, categoria_picc,
   instituicao_nome, uf, laboratorio_id, convidado_em)
select c.id,
       'andreimar-martins-soares',
       'Andreimar Martins Soares',
       'andreimarsoares@gmail.com',
       'coordenacao',
       null,
       'Fundação Oswaldo Cruz Rondônia',
       'RO',
       (select l.id from public.laboratorios l where l.ciclo_id = c.id order by l.ordem limit 1),
       now()
  from public.relatorio_ciclos c
 where c.slug = 'ciclo-1'
   -- cinto além do on conflict: o índice parcial (ciclo_id, catalogo_id) da
   -- 006 também é único, e conflito fora do alvo do ON CONFLICT viraria erro.
   and not exists (select 1 from public.ciclo_membros m
                    where m.ciclo_id = c.id
                      and m.catalogo_id = 'andreimar-martins-soares')
on conflict (ciclo_id, email) do nothing;

-- Casa quem JÁ tem conta em auth.users (padrão da seed 001, ~linha 104): se o
-- coordenador já entrou alguma vez — pela seleção de IC ou pelo /admin —,
-- user_id é preenchido AGORA e o painel abre no próximo login, sem depender de
-- nenhum passo do cliente. Idempotente: só preenche user_id nulo.
select public.vincular_membros_existentes() as membros_vinculados_pela_013;


-- =========== 2. REIVINDICAÇÃO PROIBIDA PARA GESTÃO ('papel_protegido') ======
-- SUBSTITUI public.reivindicar_cadastro() da 006. O corpo é o da 006 palavra
-- por palavra, MAIS a guarda de papel logo depois de achar a linha (passo 3½).
-- Todo o resto do contrato — assinatura, desfechos, mensagens, log — continua
-- idêntico: o cliente (interpretarReivindicacao, BuscaPesquisador.tsx) lê
-- `estado`, e os estados antigos não mudam.
--
-- POR QUE A GUARDA VEM ANTES DA CHECAGEM DE "JÁ VINCULADO": a linha de gestão
-- carrega e-mail real desde a semeadura, então sem a guarda o desfecho seria
-- 'ja_vinculado' — que devolve o e-mail MASCARADO. Máscara de e-mail de
-- pesquisador é aceitável (rede fechada, decisão da 006); máscara do e-mail
-- pessoal do coordenador para qualquer um que digitar o nome dele, não.
-- 'papel_protegido' não devolve máscara nenhuma e não altera nada.
--
--  DESFECHOS (`estado`) — contrato completo, com o novo:
--    'reivindicado'       ok=true   — gravou. A tela pode disparar o link mágico.
--    'ja_seu'             ok=true   — a linha já está com ESTE mesmo e-mail.
--    'ja_vinculado'       ok=false  — outra pessoa chegou primeiro (+ máscara).
--    'papel_protegido'    ok=false  — NOVO (013): a linha é de gestão
--                                     (coordenacao/cges); gestão vincula pelo
--                                     e-mail pré-autorizado, nunca por nome.
--                                     Nada é alterado; a tentativa vai ao log.
--    'email_em_uso'       ok=false  — este e-mail já é de OUTRA linha do ciclo.
--    'email_invalido'     ok=false
--    'nao_encontrado'     ok=false  — id fora do catálogo, ou linha inativa.
--    'ciclo_indisponivel' ok=false  — nenhum ciclo aberto agora.
create or replace function public.reivindicar_cadastro(
  p_catalogo_id text,
  p_email       text,
  p_ciclo_slug  text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ciclo uuid;
  v_id    text;
  v_email text;
  m       public.ciclo_membros%rowtype;
begin
  v_id    := lower(btrim(coalesce(p_catalogo_id, '')));
  v_email := lower(btrim(coalesce(p_email, '')));

  -- ---- 1. o ciclo aberto ---------------------------------------------------
  select c.id into v_ciclo
    from public.relatorio_ciclos c
   where (p_ciclo_slug is null or c.slug = p_ciclo_slug)
     and c.status = 'aberto'
     and now() between c.abre_em and c.fecha_em
   order by c.numero desc
   limit 1;

  if v_ciclo is null then
    return jsonb_build_object(
      'ok', false, 'estado', 'ciclo_indisponivel',
      'mensagem', 'A coleta do relato anual não está aberta no momento. Fale com a coordenação.');
  end if;

  -- ---- 2. o e-mail informado ----------------------------------------------
  -- Validação deliberadamente conservadora: o portão de verdade é o link
  -- mágico (quem não recebe a mensagem não entra). Isto aqui só evita lixo.
  -- O domínio de reserva é recusado explicitamente: ninguém "reivindica" com o
  -- endereço placeholder.
  if length(v_email) > 254
     or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$'
     or v_email like '%.invalid' then
    return jsonb_build_object(
      'ok', false, 'estado', 'email_invalido',
      'mensagem', 'Confira o endereço: ele não parece um e-mail válido.');
  end if;

  -- ---- 3. a linha do catálogo, TRAVADA ------------------------------------
  -- `for update` serializa duas pessoas clicando ao mesmo tempo na mesma linha:
  -- a segunda só lê depois do commit da primeira, e aí já vê email_pendente
  -- falso. Sem o lock, as duas passariam pela checagem e a última gravação
  -- venceria em silêncio — que é exatamente o conflito silencioso que o
  -- desenho manda evitar.
  select * into m
    from public.ciclo_membros
   where ciclo_id = v_ciclo and catalogo_id = v_id and ativo
   for update;

  if not found then
    return jsonb_build_object(
      'ok', false, 'estado', 'nao_encontrado',
      'mensagem', 'Não encontramos este cadastro na equipe do projeto. '
               || 'Procure seu nome na busca e escolha uma das opções da lista; '
               || 'se ele não estiver lá, fale com a coordenação.');
  end if;

  -- ---- 3½. A GUARDA DA 013: papel de gestão NUNCA se reivindica por nome ---
  -- `papel_no_ciclo()`/`is_coordenacao()` leem exatamente `papel`: entregar
  -- esta linha a quem digitou um nome seria entregar o painel, o roster
  -- inteiro e todos os relatos. O caminho legítimo da gestão é o e-mail
  -- pré-autorizado que a linha já carrega (trigger da 005 no primeiro login;
  -- vincular_meu_cadastro() para conta existente). Nada é alterado; o log
  -- registra a tentativa como as demais (medida (b) da 006).
  if m.papel in ('coordenacao', 'cges') then
    perform public.log_reivindicacao(v_ciclo, m.id, v_id, v_email, 'papel_protegido');
    return jsonb_build_object(
      'ok', false, 'estado', 'papel_protegido',
      'nome', m.nome,
      'mensagem', 'Este cadastro é de um papel de gestão, e papéis de gestão vinculam '
               || 'pelo e-mail pré-autorizado — não pela busca de nome. Se este cadastro '
               || 'é seu, entre com o e-mail já cadastrado pela coordenação; '
               || 'em dúvida, fale com a coordenação — o pedido ficou registrado.');
  end if;

  -- ---- 4. medida (a): vínculo de uma vez só -------------------------------
  if m.user_id is not null or not m.email_pendente then
    if m.email = v_email then
      -- Mesma pessoa, segunda tentativa. Não é conflito: é "não recebi o
      -- link". Devolver 'ja_vinculado' aqui mostraria à pessoa a máscara do
      -- e-mail dela mesma e a mandaria falar com a coordenação sem motivo.
      perform public.log_reivindicacao(v_ciclo, m.id, v_id, v_email, 'ja_seu');
      return jsonb_build_object(
        'ok', true, 'estado', 'ja_seu',
        'membro_id', m.id, 'nome', m.nome, 'email', m.email,
        'mensagem', 'Este cadastro já está no seu e-mail.');
    end if;
    perform public.log_reivindicacao(v_ciclo, m.id, v_id, v_email, 'ja_vinculado');
    return jsonb_build_object(
      'ok', false, 'estado', 'ja_vinculado',
      'nome', m.nome,
      'email_mascarado', public.mascarar_email(m.email),
      'mensagem', 'Este cadastro já foi vinculado a ' || public.mascarar_email(m.email)
               || '. Se você é esta pessoa, use aquele endereço para entrar; '
               || 'se não, fale com a coordenação — o pedido ficou registrado.');
  end if;

  -- ---- 5. o e-mail já é de outra linha do MESMO ciclo ---------------------
  -- Checagem explícita antes do UPDATE só para dar mensagem boa; o UNIQUE
  -- (ciclo_id, email) continua sendo quem garante, e o handler abaixo cobre a
  -- corrida entre a checagem e a gravação.
  if exists (select 1 from public.ciclo_membros o
              where o.ciclo_id = v_ciclo and o.id <> m.id and o.email = v_email) then
    perform public.log_reivindicacao(v_ciclo, m.id, v_id, v_email, 'email_em_uso');
    return jsonb_build_object(
      'ok', false, 'estado', 'email_em_uso',
      'mensagem', 'Este e-mail já está em outro cadastro deste ciclo. '
               || 'Use outro endereço ou fale com a coordenação.');
  end if;

  -- ---- 6. grava ------------------------------------------------------------
  begin
    update public.ciclo_membros
       set email           = v_email,
           email_pendente  = false,
           reivindicado_em = now()
     where id = m.id;
  exception when unique_violation then
    perform public.log_reivindicacao(v_ciclo, m.id, v_id, v_email, 'email_em_uso');
    return jsonb_build_object(
      'ok', false, 'estado', 'email_em_uso',
      'mensagem', 'Este e-mail já está em outro cadastro deste ciclo. '
               || 'Use outro endereço ou fale com a coordenação.');
  end;

  perform public.log_reivindicacao(v_ciclo, m.id, v_id, v_email, 'reivindicado');
  return jsonb_build_object(
    'ok', true, 'estado', 'reivindicado',
    'membro_id', m.id, 'nome', m.nome, 'email', v_email,
    'mensagem', 'Pronto. Seu cadastro está vinculado a ' || v_email || '.');
end; $$;

-- `create or replace` preserva a ACL, mas reafirmar custa nada e protege contra
-- uma futura reaplicação fora de ordem (higiene da 003/005/006).
revoke execute on function public.reivindicar_cadastro(text, text, text) from public;
grant  execute on function public.reivindicar_cadastro(text, text, text) to anon, authenticated;


-- ====== 3. GUARDA DO AUTOCADASTRO — a união 006 + 007 (SUBSTITUI a da 007) ===
-- A 007 reescreveu guard_membro_self() PARTINDO DA VERSÃO DA 005 e, sem
-- perceber, apagou as exceções 1 e 2 da 006 e as travas de catalogo_id e
-- email_pendente — a "ordem inversa" que o cabeçalho da 006 manda vigiar,
-- ocorrida de fato. Consequência concreta: com sessão aberta,
-- vincular_meu_cadastro() (o caminho legítimo do e-mail pré-autorizado — o do
-- coordenador e de qualquer conta que já existia) e reivindicar_cadastro()
-- morriam no UPDATE com "Estes campos do cadastro só a coordenação altera".
-- Esta versão é a SOMA, sem perder nada de nenhuma:
--   • da 006: exceções 1 e 2 + travas de catalogo_id/email_pendente;
--   • da 007: laboratorio_id livre para o dono da linha, com log.
create or replace function public.guard_membro_self()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Sem sessão de usuário final (trigger interno de 1º acesso, service_role,
  -- importação da coordenação pelo SQL Editor) o guarda não se aplica: ele
  -- existe para conter o MEMBRO logado, não o servidor.
  if auth.uid() is null then return new; end if;
  if public.is_coordenacao(new.ciclo_id) then return new; end if;

  -- ---- EXCEÇÃO 1 (006, restaurada): assumir a PRÓPRIA linha ----------------
  -- A linha está SEM DONO e o e-mail já gravado nela é EXATAMENTE o e-mail
  -- verificado da conta que pede — é o que vincular_meu_cadastro() faz. Vale
  -- para QUALQUER papel, inclusive gestão: é justamente o vínculo por e-mail
  -- pré-autorizado da 013. Não afrouxa nada: a pessoa só recebe o que já
  -- receberia pelo link mágico se a conta ainda não existisse, e NADA MAIS na
  -- linha pode vir alterado (papel continua intocável).
  if old.user_id is null
     and new.user_id = auth.uid()
     and not coalesce(old.email_pendente, false)
     and new.email          is not distinct from old.email
     and new.email_pendente is not distinct from old.email_pendente
     and new.ciclo_id       is not distinct from old.ciclo_id
     and new.papel          is not distinct from old.papel
     and new.categoria_picc is not distinct from old.categoria_picc
     and new.convite_token  is not distinct from old.convite_token
     and new.catalogo_id    is not distinct from old.catalogo_id
     and new.laboratorio_id is not distinct from old.laboratorio_id
     and new.ativo          is not distinct from old.ativo
     and old.email = (select lower(u.email) from auth.users u where u.id = auth.uid())
  then
    return new;
  end if;

  -- ---- EXCEÇÃO 2 (006, restaurada): reivindicação com sessão aberta --------
  -- A linha sai do e-mail de reserva para o e-mail informado, e NADA MAIS
  -- muda. Quem JÁ ESTÁ AUTENTICADO também usa a tela de identificação (veio da
  -- seleção de IC, ou voltou depois de a coordenação desfazer um vínculo) e,
  -- dentro da RPC, auth.uid() não é nulo. NÃO abre porta pela API: a policy
  -- membros_self_update (005) exige user_id = auth.uid(), e linha não
  -- reivindicada tem user_id NULO — PATCH direto não alcança linha nenhuma.
  -- Quem passa por aqui é a RPC SECURITY DEFINER, que já checou o "vínculo de
  -- uma vez só", já recusou papel de gestão (013) e já registrou no log.
  if old.email_pendente
     and not new.email_pendente
     and old.user_id is null
     and new.user_id is null
     and new.email <> old.email
     and new.ciclo_id       is not distinct from old.ciclo_id
     and new.papel          is not distinct from old.papel
     and new.categoria_picc is not distinct from old.categoria_picc
     and new.convite_token  is not distinct from old.convite_token
     and new.catalogo_id    is not distinct from old.catalogo_id
     and new.laboratorio_id is not distinct from old.laboratorio_id
     and new.ativo          is not distinct from old.ativo
  then
    return new;
  end if;

  -- ---- as travas (005 + as duas da 006 que a 007 deixou cair) --------------
  -- `papel` continua sendo a linha mais importante: is_coordenacao() lê
  -- exatamente esta coluna, e sem ela na lista qualquer pessoa do roster
  -- viraria coordenação com um único PATCH do PostgREST.
  if new.email          is distinct from old.email
     or new.user_id     is distinct from old.user_id
     or new.ciclo_id    is distinct from old.ciclo_id
     or new.papel       is distinct from old.papel
     or new.categoria_picc is distinct from old.categoria_picc
     or new.convite_token  is distinct from old.convite_token
     or new.ativo       is distinct from old.ativo
     or new.catalogo_id    is distinct from old.catalogo_id
     or new.email_pendente is distinct from old.email_pendente then
    raise exception 'Estes campos do cadastro só a coordenação altera.';
  end if;

  -- ---- laboratorio_id: LIVRE para o dono da linha, com log (007) -----------
  if new.laboratorio_id is distinct from old.laboratorio_id then
    insert into public.relato_eventos (ciclo_id, entidade, entidade_id, acao, campos, por, snapshot)
    values (
      new.ciclo_id, 'ciclo_membros', new.id, 'update', array['laboratorio_id'], auth.uid(),
      jsonb_build_object('de', old.laboratorio_id, 'para', new.laboratorio_id)
    );
  end if;

  return new;
end; $$;


-- ============================================================ 4. SANIDADE ====
-- Esperado: 6 linhas, todas ok = true (as duas primeiras exigem seeds/ciclo-1;
-- num banco ainda sem o ciclo elas acusam false até as seeds rodarem).
select * from (values
  ('linha do coordenador no roster do ciclo-1 (papel coordenacao)',
     exists (select 1 from public.ciclo_membros m
               join public.relatorio_ciclos c on c.id = m.ciclo_id
              where c.slug = 'ciclo-1'
                and m.catalogo_id = 'andreimar-martins-soares'
                and m.email = 'andreimarsoares@gmail.com'
                and m.papel = 'coordenacao' and m.ativo)),
  ('linha do coordenador nao esta pendente (e-mail real desde a semeadura)',
     exists (select 1 from public.ciclo_membros
              where catalogo_id = 'andreimar-martins-soares'
                and not email_pendente)),
  ('reivindicar_cadastro recusa papeis de gestao (papel_protegido)',
     (select prosrc like '%papel_protegido%'
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'reivindicar_cadastro')),
  ('guarda restaurada: excecao 1 da 006 (vinculo por e-mail de conta existente)',
     (select prosrc like '%lower(u.email)%'
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'guard_membro_self')),
  ('guarda restaurada: catalogo_id/email_pendente trancados de novo',
     (select prosrc like '%new.email_pendente is distinct from old.email_pendente%'
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'guard_membro_self')),
  ('guarda mantem a 007 (laboratorio livre, com log)',
     (select prosrc like '%array[''laboratorio_id'']%'
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'guard_membro_self'))
) as sanidade(item, ok);

-- Os papéis protegidos que existem HOJE no roster — cada linha abaixo é um
-- cadastro que a busca de nome NÃO entrega mais a ninguém:
select c.slug, m.nome, m.email, m.papel,
       (m.user_id is not null) as ja_vinculado
  from public.ciclo_membros m
  join public.relatorio_ciclos c on c.id = m.ciclo_id
 where m.papel in ('coordenacao', 'cges')
 order by c.slug, m.papel, m.nome;

-- A recusa, por extenso (chamada de exemplo — descomente para ver o jsonb):
--   select public.reivindicar_cadastro('andreimar-martins-soares', 'qualquer@exemplo.com');
-- → {"ok": false, "estado": "papel_protegido", "nome": "Andreimar Martins Soares",
--    "mensagem": "Este cadastro é de um papel de gestão, e papéis de gestão
--                 vinculam pelo e-mail pré-autorizado — não pela busca de nome. …"}
-- E a linha continua intacta (nada foi gravado); a tentativa fica em
-- relato_eventos (entidade = 'membro', status = 'papel_protegido').
