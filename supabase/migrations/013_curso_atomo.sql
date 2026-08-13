-- ============================================================================
--  INCT-CONEXAO · 013: Curso "Do átomo à ação biológica" — inscrições
-- ============================================================================
--  Rode o ARQUIVO INTEIRO de uma vez no SQL Editor do Supabase.
--  ORDEM: 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 →
--         011 → 012 → **013** → seeds/004.
--  IDEMPOTENTE: reaplicar não duplica tabela, índice, constraint nem função.
--
--  NÃO TOCA EM NADA DE 001..012. Nenhuma policy, função ou tabela existente é
--  alterada. `public.is_admin()` (001) e `public.touch_updated_at()` (001) são
--  apenas LIDAS. Confirme que as duas existem antes de rodar:
--     select proname from pg_proc where proname in ('is_admin','touch_updated_at');
--
--  ==========================================================================
--  MESMA SUPERFÍCIE DA 008: ESCREVER SEM SESSÃO
--  ==========================================================================
--  Este é o formulário de inscrição do curso, público e sem login (a pessoa
--  chega por link/QR de divulgação). A régua de segurança é a MESMA da 008 —
--  uma função `security definer` que anon pode EXECUTAR, sobre tabelas que anon
--  não pode nem enxergar:
--
--      tabela  → RLS ligada, ZERO policies de escrita, `revoke all … from anon`
--      função  → `revoke … from public` e SÓ ENTÃO `grant … to anon`
--
--  A diferença para a 008: aqui NÃO há escore. Inscrição de curso é registro,
--  não medição de intenção — não existe número a esconder de quem responde nem
--  régua a proteger. O que existe é a mesma proteção proporcional: uma inscrição
--  por e-mail (reenviar CORRIGE, não duplica), isca+tempo, freio de escritas por
--  minuto, teto de tamanho no jsonb cru, e histórico append-only.
--
--  ==========================================================================
--  MODELO DE AMEAÇA ACEITO (mesma régua da 006/008)
--  ==========================================================================
--  Rede acadêmica, formulário sem dinheiro, janela de poucas semanas. Sem
--  CAPTCHA de propósito. Defesas TODAS do lado do servidor:
--    (a) UMA inscrição por e-mail por edição (índice único) — reenviar CORRIGE;
--    (b) isca (honeypot) e tempo mínimo de preenchimento;
--    (c) teto de ESCRITAS por minuto na edição — conta `updated_at`, não
--        `created_at`, senão o ramo de correção passa por baixo do freio;
--    (d) teto de tamanho no jsonb cru e vocabulário fechado em toda coluna
--        segmentada — o que a tela oferece é o que o banco aceita;
--    (e) toda versão anterior arquivada em `curso_inscricoes_versoes`
--        (append-only, por trigger): sobrescrever NUNCA destrói;
--    (f) tudo com carimbo e nada apagável pela API.
--
--  O QUE CONTINUA POSSÍVEL, E É ACEITO: sem login, o e-mail não PROVA nada.
--  Igual à 008 — a resposta da RPC não distingue "já se inscreveu" de "primeira
--  vez" (os desfechos de sucesso têm a mesma frase) e o histórico impede que uma
--  sobrescrita destrua o que existia.
--
--  ==========================================================================
--  APAGAR UMA INSCRIÇÃO (LGPD) — a coordenação, no SQL Editor
--  ==========================================================================
--      delete from public.curso_inscricoes
--       where lower(email) = lower('pessoa@exemplo.br')
--         and edicao_id = (select id from public.curso_edicoes
--                           where slug = 'curso-conexao-bioinformatica');
-- ============================================================================


-- ==================================================== 1. A EDIÇÃO (config) ==
-- Mesma forma de `workshop_edicoes` (008): a JANELA e os rótulos são DADO, não
-- código. Uma segunda oferta do curso é uma linha nova, sem deploy.
--
-- DUAS JANELAS DIFERENTES, e confundi-las é o bug clássico:
--   • abre_em/fecha_em  = quando se pode INSCREVER (o que a RPC checa);
--   • as datas das TURMAS vivem em `src/curso/conteudo.ts` (texto de tela) e no
--     `config` — não fecham nada.
create table if not exists public.curso_edicoes (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  titulo     text not null,
  status     text not null default 'rascunho'
             check (status in ('rascunho','aberto','encerrado','arquivado')),
  abre_em    timestamptz not null,
  fecha_em   timestamptz not null,
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curso_edicoes_janela check (fecha_em > abre_em)
);
alter table public.curso_edicoes enable row level security;

drop trigger if exists curso_edicoes_touch on public.curso_edicoes;
create trigger curso_edicoes_touch
  before update on public.curso_edicoes
  for each row execute function public.touch_updated_at();

-- Leitura pública da edição publicada — a tela precisa do título e da janela.
-- É SELECT, jamais INSERT (mesmo desenho de `workshop_edicoes_public_read`).
drop policy if exists curso_edicoes_public_read on public.curso_edicoes;
create policy curso_edicoes_public_read on public.curso_edicoes
  for select using (status <> 'rascunho' or public.is_admin());

drop policy if exists curso_edicoes_admin_write on public.curso_edicoes;
create policy curso_edicoes_admin_write on public.curso_edicoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- Nota: a 008 (Fitofarmas) traz um auxiliar `workshop_lista` para parsear
-- colunas de array no jsonb com segurança. Este módulo NÃO tem colunas de array
-- (o percurso são duas colunas escalares com CHECK), então o auxiliar não existe
-- aqui de propósito — não há lista a parsear.


-- ==================================================== 3. AS INSCRIÇÕES =======
-- Colunas para o que a coordenação vai FILTRAR, ORDENAR e EXPORTAR; jsonb para
-- o cru. As duas TURMAS escolhidas são colunas (com vocabulário fechado) porque
-- são o dado que organiza as salas e os certificados de 7 horas.
create table if not exists public.curso_inscricoes (
  id           uuid primary key default gen_random_uuid(),
  edicao_id    uuid not null references public.curso_edicoes (id) on delete cascade,
  protocolo    text unique,

  -- identificação mínima. SÓ o que é preciso para CHAMAR e CERTIFICAR a pessoa.
  -- Nunca CPF, nunca endereço, nunca data de nascimento (mesma linha da 005/008).
  nome         text not null constraint curso_inscricoes_nome
                 check (char_length(btrim(nome)) between 3 and 140),
  email        text not null constraint curso_inscricoes_email
                 check (email = lower(email) and char_length(email) <= 254),
  -- WhatsApp é OBRIGATÓRIO neste formulário (o retorno da coordenação sai por
  -- ele): não-nulo e com teto de tamanho.
  whatsapp     text not null constraint curso_inscricoes_whatsapp
                 check (char_length(btrim(whatsapp)) between 8 and 32),
  instituicao  text not null constraint curso_inscricoes_instituicao
                 check (char_length(btrim(instituicao)) between 2 and 160),
  curso_area   text not null constraint curso_inscricoes_curso_area
                 check (char_length(btrim(curso_area)) between 2 and 120),

  -- ---- segmentação. Cada lista é gêmea de uma união em src/curso/types.ts
  vinculo      text not null check (vinculo in (
                 'grad_vet','grad_agro','grad_outro','pos_graduando',
                 'docente','tecnico','outro')),
  -- Semestre: '1'..'10' para graduandos; 'concluido' e 'nao_se_aplica' cobrem
  -- pós, docentes e técnicos sem forçar um número que não existe para eles.
  semestre     text not null check (semestre in (
                 '1','2','3','4','5','6','7','8','9','10',
                 'concluido','nao_se_aplica')),
  experiencia  text not null check (experiencia in (
                 'nenhuma','basica','intermediaria','avancada')),

  -- ---- O PERCURSO: uma oferta de cada conteúdo, 7 horas no total.
  --  Conteúdo 1 (Estruturas 3D, visualização molecular e IA): 19 ou 20/08, tarde.
  --  Conteúdo 2 (Docking, interpretação molecular e ADMET): 21/08, manhã ou tarde.
  --  As duas são NOT NULL: inscrição sem percurso completo não é inscrição.
  turma_conteudo1 text not null check (turma_conteudo1 in ('c1_19ago','c1_20ago')),
  turma_conteudo2 text not null check (turma_conteudo2 in ('c2_21ago_manha','c2_21ago_tarde')),

  -- Necessidades de acessibilidade: opcional, texto curto. É o que permite à
  -- organização preparar a sala (intérprete, mesa acessível, material ampliado).
  acessibilidade text check (acessibilidade is null or char_length(acessibilidade) <= 600),

  -- O cru, para reprocessar sem reperguntar. TETO DE TAMANHO (mesma lição da
  -- 008): sem ele, o ramo de correção aceita reescrever com um jsonb de vários
  -- MB, e o freio de enxurrada só conta linhas NOVAS. 32 kB é ~15× o payload
  -- real e ~0 para quem quer inchar a tabela.
  respostas    jsonb not null default '{}'::jsonb
               constraint curso_inscricoes_cru_teto
               check (length(respostas::text) <= 32768),

  consentimento_lgpd boolean not null check (consentimento_lgpd),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.curso_inscricoes enable row level security;

drop trigger if exists curso_inscricoes_touch on public.curso_inscricoes;
create trigger curso_inscricoes_touch
  before update on public.curso_inscricoes
  for each row execute function public.touch_updated_at();

-- UMA inscrição por e-mail por edição. É o anti-duplicação e, ao mesmo tempo, o
-- que deixa a pessoa CORRIGIR o que enviou: a RPC cai no ramo de update e o
-- protocolo é preservado.
create unique index if not exists curso_inscricoes_email_unico
  on public.curso_inscricoes (edicao_id, lower(email));

-- Índice de listagem: a coordenação lê "quem se inscreveu, na ordem que chegou".
create index if not exists curso_inscricoes_lista_idx
  on public.curso_inscricoes (edicao_id, created_at desc);

-- Freio de enxurrada (defesa (c)): conta o que entrou no último minuto.
create index if not exists curso_inscricoes_recentes_idx
  on public.curso_inscricoes (edicao_id, updated_at desc);

-- SÓ a coordenação lê. NENHUMA policy de INSERT/UPDATE/DELETE — o que não tem
-- policy não se faz pela API. Quem escreve é a RPC (seção 5), `security definer`.
drop policy if exists curso_inscricoes_admin_read on public.curso_inscricoes;
create policy curso_inscricoes_admin_read on public.curso_inscricoes
  for select to authenticated using (public.is_admin());


-- ============================================ 3b. O HISTÓRICO (append-only) ==
-- A CORREÇÃO POR E-MAIL É UMA SOBRESCRITA e, sem login, o e-mail não prova nada.
-- Não dá para impedir a sobrescrita sem login — mas dá para impedir que ela
-- DESTRUA. Toda versão anterior fica aqui antes de ser trocada. Mesmo desenho da
-- 008: gravado por trigger SECURITY DEFINER, RLS ligada, leitura só de admin, e
-- NENHUMA policy de escrita.
create table if not exists public.curso_inscricoes_versoes (
  id          uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references public.curso_inscricoes (id) on delete cascade,
  edicao_id   uuid not null,
  email       text not null,
  respostas   jsonb not null,
  substituida_em timestamptz not null default now()
);
alter table public.curso_inscricoes_versoes enable row level security;

create index if not exists curso_inscricoes_versoes_idx
  on public.curso_inscricoes_versoes (inscricao_id, substituida_em desc);

drop policy if exists curso_versoes_admin_read on public.curso_inscricoes_versoes;
create policy curso_versoes_admin_read on public.curso_inscricoes_versoes
  for select to authenticated using (public.is_admin());

create or replace function public.curso_arquivar_versao()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Só arquiva quando o CONTEÚDO muda. Reenvio idêntico não gera versão nova.
  if old.respostas is distinct from new.respostas then
    insert into public.curso_inscricoes_versoes
      (inscricao_id, edicao_id, email, respostas)
    values (old.id, old.edicao_id, old.email, old.respostas);
  end if;
  return new;
end; $$;

drop trigger if exists curso_inscricoes_versionar on public.curso_inscricoes;
create trigger curso_inscricoes_versionar
  before update on public.curso_inscricoes
  for each row execute function public.curso_arquivar_versao();


-- ============================================ 4. PROTOCOLO (padrão do 003) ==
-- Contador atômico por edição. RLS ligada e SEM policy = inacessível pela API.
-- NUNCA `count(*) + 1` (corrida). `insert … on conflict do update … returning`
-- pega lock de linha por edição e serializa chamadas concorrentes.
create table if not exists public.curso_protocolo_seq (
  edicao_id uuid primary key references public.curso_edicoes (id) on delete cascade,
  ultimo    int  not null default 0
);
alter table public.curso_protocolo_seq enable row level security;

create or replace function public.reserve_protocolo_curso(p_edicao uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.curso_protocolo_seq (edicao_id, ultimo)
  values (p_edicao, 1)
  on conflict (edicao_id)
    do update set ultimo = public.curso_protocolo_seq.ultimo + 1
  returning ultimo into n;
  return n;
end; $$;


-- ============================================ 4b. AS VAGAS (leitura pública) ==
-- Quantas vagas restam em cada turma. Devolve SÓ CONTAGENS agregadas — nenhum
-- dado pessoal —, então pode ser executada por quem não tem sessão: é o "X vagas
-- restantes" que o formulário mostra. SECURITY DEFINER para contar sobre a tabela
-- que anon não enxerga; STABLE porque só lê.
--
-- O teto por turma vem de `config->>'max_por_turma'` (default 40): a coordenação
-- muda o limite sem deploy, e a RPC de registro lê o MESMO teto — são gêmeos.
-- Devolve { "max": 40, "ocupacao": { "c1_19ago": 12, ... } }; turma ausente = 0.
create or replace function public.curso_vagas(p_edicao_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  with e as (
    -- Mesma visibilidade da policy de leitura de `curso_edicoes` (seção 1): não
    -- responde por edição em rascunho, mesmo sendo SECURITY DEFINER. `curso_vagas`
    -- não pode virar um oráculo que confirma slug/teto de edição não publicada.
    select id, coalesce((config ->> 'max_por_turma')::int, 40) as maxpt
      from public.curso_edicoes where slug = p_edicao_slug and status <> 'rascunho'
  ),
  oc as (
    select t as turma, count(*)::int as ocupados
      from (
        select r.turma_conteudo1 as t from public.curso_inscricoes r
          where r.edicao_id = (select id from e)
        union all
        select r.turma_conteudo2 from public.curso_inscricoes r
          where r.edicao_id = (select id from e)
      ) s
     group by t
  )
  select jsonb_build_object(
    'max', coalesce((select maxpt from e), 40),
    'ocupacao', coalesce((select jsonb_object_agg(turma, ocupados) from oc), '{}'::jsonb)
  );
$$;


-- ================================================ 5. O REGISTRO (a RPC) =====
--  A ÚNICA superfície deste módulo aberta a quem não tem sessão.
--
--  RECEBE   o slug da edição e um jsonb com os campos da inscrição.
--  GRAVA    uma linha nova, ou CORRIGE a da mesma pessoa (casada pelo e-mail).
--  DEVOLVE  jsonb — NUNCA exceção para desfecho previsto: exceção vira 400
--           opaco no PostgREST e a tela perde a chance de dizer o que houve.
--
--  DESFECHOS (`estado`), todos com `mensagem` pronta para a tela:
--    'recebido'         ok=true   — gravou/corrigiu. Vem com `protocolo`.
--    'fora_da_janela'   ok=false
--    'email_invalido'   ok=false  — vem com `campo`, para a tela focar o certo.
--    'dados_invalidos'  ok=false  — alguma constraint recusou.
--    'turma_lotada'     ok=false  — a turma escolhida atingiu o teto de vagas;
--                                   vem com `campo` (turma_conteudo1/2) para focar.
create or replace function public.registrar_inscricao_curso(
  p_edicao_slug text,
  p_dados       jsonb,
  p_isca        text default '',       -- honeypot: humano nunca preenche
  p_ms          int  default 999999)   -- ms desde a abertura do formulário
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_edicao   uuid;
  v_email    text;
  v_prot     text;
  v_existe   uuid;
  v_recentes int;
  v_max      int;
  v_t1       text;
  v_t2       text;
  v_t1_old   text;
  v_t2_old   text;
  v_oc       int;
  n int;
begin
  -- ---- 0. a isca e o relógio ---------------------------------------------
  -- Robô que preencheu o campo escondido, ou respondeu em menos de 4 s, recebe
  -- ok=true e NADA é gravado (dizer "recusado" ensina o robô a corrigir).
  if coalesce(btrim(p_isca), '') <> '' or coalesce(p_ms, 0) < 4000 then
    return jsonb_build_object('ok', true, 'estado', 'recebido',
      'protocolo', null,
      'mensagem', 'Recebemos a sua inscrição. Obrigado!');
  end if;

  -- ---- 1. a edição aberta -------------------------------------------------
  select e.id into v_edicao
    from public.curso_edicoes e
   where e.slug = p_edicao_slug
     and e.status = 'aberto'
     and now() between e.abre_em and e.fecha_em;

  if v_edicao is null then
    return jsonb_build_object('ok', false, 'estado', 'fora_da_janela',
      'mensagem', 'As inscrições para este curso não estão abertas agora. '
               || 'Confira a página do curso ou escreva para a coordenação.');
  end if;

  -- Teto por turma (default 40), lido da config — gêmeo do que `curso_vagas` usa.
  v_max := coalesce((select (config ->> 'max_por_turma')::int
                       from public.curso_edicoes where id = v_edicao), 40);
  v_t1  := p_dados ->> 'turma_conteudo1';
  v_t2  := p_dados ->> 'turma_conteudo2';

  -- ---- 2. freio de enxurrada (defesa (c)) ---------------------------------
  -- CONTA `updated_at`, NÃO `created_at` (mesma armadilha da 008): senão um
  -- atacante insere UMA linha e a reescreve à vontade sem mexer no freio.
  select count(*) into v_recentes
    from public.curso_inscricoes r
   where r.edicao_id = v_edicao
     and r.updated_at > now() - interval '1 minute';
  if v_recentes >= 40 then
    return jsonb_build_object('ok', false, 'estado', 'dados_invalidos',
      'mensagem', 'Estamos recebendo muitas inscrições ao mesmo tempo. '
               || 'Espere um minuto e toque em confirmar de novo. Nada foi perdido.');
  end if;

  -- ---- 3. o e-mail --------------------------------------------------------
  -- Conservadora e IGUAL à do cliente (src/curso/validation.ts). `.invalid` é
  -- reservado pela RFC 2606 e nunca entrega.
  v_email := lower(btrim(coalesce(p_dados ->> 'email', '')));
  if length(v_email) > 254
     or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$'
     or v_email like '%.invalid' then
    return jsonb_build_object('ok', false, 'estado', 'email_invalido',
      'campo', 'email',
      'mensagem', 'Confira o endereço: ele não parece um e-mail válido.');
  end if;

  -- ---- 4. capacidade e escrita --------------------------------------------
  -- Trava por edição: serializa as contagens de vaga entre chamadas concorrentes,
  -- para dois envios simultâneos não estourarem o teto de 40 na mesma turma. Dura
  -- até o fim da transação (a própria chamada) e é liberada no commit.
  perform pg_advisory_xact_lock(hashtext('curso_vagas'), hashtext(p_edicao_slug));

  select r.id, r.protocolo, r.turma_conteudo1, r.turma_conteudo2
    into v_existe, v_prot, v_t1_old, v_t2_old
    from public.curso_inscricoes r
   where r.edicao_id = v_edicao and lower(r.email) = v_email
   for update;

  -- Teto por turma: só barra quem CONSOME uma vaga nova (inscrição nova, ou quem
  -- TROCA de horário). Quem reenvia mantendo o mesmo horário nunca é barrado —
  -- senão corrigir o próprio nome numa turma cheia ficaria impossível. Conta os
  -- OUTROS (`id is distinct from v_existe`): com v_existe nulo, conta todos.
  if v_existe is null or v_t1 is distinct from v_t1_old then
    select count(*) into v_oc from public.curso_inscricoes r
     where r.edicao_id = v_edicao and r.turma_conteudo1 = v_t1
       and r.id is distinct from v_existe;
    if v_oc >= v_max then
      return jsonb_build_object('ok', false, 'estado', 'turma_lotada',
        'campo', 'turma_conteudo1',
        'mensagem', 'As vagas da aula teórica que você escolheu se esgotaram. '
                 || 'Volte a "Monte seu percurso" e escolha o outro dia. O resto '
                 || 'do formulário continua guardado.');
    end if;
  end if;

  if v_existe is null or v_t2 is distinct from v_t2_old then
    select count(*) into v_oc from public.curso_inscricoes r
     where r.edicao_id = v_edicao and r.turma_conteudo2 = v_t2
       and r.id is distinct from v_existe;
    if v_oc >= v_max then
      return jsonb_build_object('ok', false, 'estado', 'turma_lotada',
        'campo', 'turma_conteudo2',
        'mensagem', 'As vagas da aula prática que você escolheu se esgotaram. '
                 || 'Volte a "Monte seu percurso" e escolha o outro turno. O resto '
                 || 'do formulário continua guardado.');
    end if;
  end if;

  if v_existe is not null then
    update public.curso_inscricoes set
      nome            = btrim(p_dados ->> 'nome'),
      whatsapp        = btrim(p_dados ->> 'whatsapp'),
      instituicao     = btrim(p_dados ->> 'instituicao'),
      curso_area      = btrim(p_dados ->> 'curso_area'),
      vinculo         = p_dados ->> 'vinculo',
      semestre        = p_dados ->> 'semestre',
      experiencia     = p_dados ->> 'experiencia',
      turma_conteudo1 = p_dados ->> 'turma_conteudo1',
      turma_conteudo2 = p_dados ->> 'turma_conteudo2',
      acessibilidade  = nullif(btrim(coalesce(p_dados ->> 'acessibilidade', '')), ''),
      respostas       = p_dados,
      -- SEM ESTA LINHA o consentimento só era exigido no INSERT (mesma lição da
      -- 008): um payload "lgpd": false era ACEITO para e-mail que já existia.
      consentimento_lgpd = coalesce((p_dados ->> 'lgpd')::boolean, false)
     where id = v_existe;

    -- RESPOSTA IDÊNTICA À DO INSERT (mesma lição da 008): "Atualizamos" viraria
    -- oráculo de "este e-mail já se inscreveu" para quem tem a chave anônima.
    return jsonb_build_object('ok', true, 'estado', 'recebido',
      'protocolo', v_prot,
      'mensagem', 'Recebemos a sua inscrição. Guarde o protocolo abaixo.');
  end if;

  n := public.reserve_protocolo_curso(v_edicao);
  v_prot := 'CBIO-' || lpad(n::text, 4, '0');

  insert into public.curso_inscricoes (
    edicao_id, protocolo, nome, email, whatsapp, instituicao, curso_area,
    vinculo, semestre, experiencia, turma_conteudo1, turma_conteudo2,
    acessibilidade, respostas, consentimento_lgpd)
  values (
    v_edicao, v_prot,
    btrim(p_dados ->> 'nome'),
    v_email,
    btrim(p_dados ->> 'whatsapp'),
    btrim(p_dados ->> 'instituicao'),
    btrim(p_dados ->> 'curso_area'),
    p_dados ->> 'vinculo',
    p_dados ->> 'semestre',
    p_dados ->> 'experiencia',
    p_dados ->> 'turma_conteudo1',
    p_dados ->> 'turma_conteudo2',
    nullif(btrim(coalesce(p_dados ->> 'acessibilidade', '')), ''),
    p_dados,
    coalesce((p_dados ->> 'lgpd')::boolean, false));

  return jsonb_build_object('ok', true, 'estado', 'recebido',
    'protocolo', v_prot,
    'mensagem', 'Recebemos a sua inscrição. Guarde o protocolo abaixo.');

exception
  -- A tela já validou antes; estas exceções só acontecem com cliente
  -- desatualizado ou adulterado. Devolvê-las como DESFECHO evita o 400 opaco.
  when check_violation or not_null_violation or invalid_text_representation
    or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'estado', 'dados_invalidos',
      'mensagem', 'Alguma resposta ficou fora do esperado. '
               || 'Recarregue a página e envie de novo, por favor.');
  when unique_violation then
    -- Corrida de dois envios simultâneos do mesmo e-mail: o segundo perde a
    -- inserção mas o primeiro está gravado. A frase é a dos desfechos de
    -- sucesso, pelo mesmo motivo de não virar oráculo.
    return jsonb_build_object('ok', true, 'estado', 'recebido',
      'protocolo', null,
      'mensagem', 'Recebemos a sua inscrição.');
end; $$;


-- ============================================ 6. A VISÃO DA COORDENAÇÃO =====
-- A lista de inscritos, já com o slug da edição. Só admin lê (a view herda a RLS
-- de `curso_inscricoes` porque é `security_invoker`).
create or replace view public.curso_inscritos as
  select
    r.id, r.edicao_id, e.slug as edicao, r.protocolo,
    r.nome, r.email, r.whatsapp, r.instituicao, r.curso_area,
    r.vinculo, r.semestre, r.experiencia,
    r.turma_conteudo1, r.turma_conteudo2,
    r.acessibilidade, r.created_at, r.updated_at
  from public.curso_inscricoes r
  join public.curso_edicoes e on e.id = r.edicao_id
 order by r.created_at desc;

-- `security_invoker` faz a view respeitar a RLS de quem consulta (Postgres 15+).
alter view public.curso_inscritos set (security_invoker = on);


-- ============================================================== 7. GRANTS ====
-- A lição da 003/005/006/008: revogar de PUBLIC primeiro (anon e authenticated
-- HERDAM de PUBLIC) e só então conceder a quem deve.
revoke execute on function public.registrar_inscricao_curso(text, jsonb, text, int) from public;
grant  execute on function public.registrar_inscricao_curso(text, jsonb, text, int) to anon, authenticated;

-- `curso_vagas` devolve só contagens agregadas (o "X vagas restantes" público).
revoke execute on function public.curso_vagas(text) from public;
grant  execute on function public.curso_vagas(text) to anon, authenticated;

-- As internas NÃO são para o público.
revoke execute on function public.reserve_protocolo_curso(uuid)  from public, anon, authenticated;
revoke execute on function public.curso_arquivar_versao()        from public, anon, authenticated;

grant select on public.curso_edicoes to anon, authenticated;
grant select on public.curso_inscricoes to authenticated;        -- a policy filtra
grant select on public.curso_inscritos to authenticated;         -- idem, via view
grant select on public.curso_inscricoes_versoes to authenticated;-- idem

revoke all    on public.curso_inscricoes         from anon;
revoke all    on public.curso_inscricoes_versoes from anon;
revoke all    on public.curso_protocolo_seq      from anon, authenticated;
revoke all    on public.curso_inscritos          from anon;
revoke insert, update, delete on public.curso_inscricoes         from anon, authenticated;
revoke insert, update, delete on public.curso_inscricoes_versoes from anon, authenticated;
revoke insert, update, delete on public.curso_edicoes            from anon;


-- ============================================================ 8. SANIDADE ====
-- Rode este bloco DEPOIS de aplicar e LEIA o resultado.
select 'anon EXECUTA registrar_inscricao_curso (deve ser true)' as checagem,
       has_function_privilege('anon','public.registrar_inscricao_curso(text,jsonb,text,int)','execute')::text as valor
union all select 'anon EXECUTA curso_vagas (deve ser true)',
       has_function_privilege('anon','public.curso_vagas(text)','execute')::text
union all select 'anon LÊ curso_inscricoes (deve ser false)',
       has_table_privilege('anon','public.curso_inscricoes','select')::text
union all select 'anon INSERE em curso_inscricoes (deve ser false)',
       has_table_privilege('anon','public.curso_inscricoes','insert')::text
union all select 'anon LÊ curso_inscritos (deve ser false)',
       has_table_privilege('anon','public.curso_inscritos','select')::text
union all select 'anon LÊ curso_edicoes (deve ser true)',
       has_table_privilege('anon','public.curso_edicoes','select')::text
union all select 'anon LÊ o histórico de versões (deve ser false)',
       has_table_privilege('anon','public.curso_inscricoes_versoes','select')::text
union all select 'policies de ESCRITA em curso_inscricoes (deve ser 0)',
       (select count(*)::text from pg_policies
         where schemaname = 'public' and tablename = 'curso_inscricoes' and cmd <> 'SELECT')
union all select 'view respeita a RLS de quem consulta (deve conter security_invoker=on)',
       coalesce((select array_to_string(reloptions, ',') from pg_class
                  where relname = 'curso_inscritos'), '(sem opções)')
union all select 'edições cadastradas (0 até rodar seeds/004)',
       (select count(*)::text from public.curso_edicoes)
union all select 'inscrições recebidas',
       (select count(*)::text from public.curso_inscricoes);
