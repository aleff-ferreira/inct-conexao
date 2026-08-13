-- ============================================================================
--  INCT-CONEXAO · 008: I Workshop Conexão Fitofarmas — intenção de colaborar
-- ============================================================================
--  Rode o ARQUIVO INTEIRO de uma vez no SQL Editor do Supabase.
--  ORDEM: 001 → 002 → 003 → 004 → 005 → 006 → 007 → **008** → seeds/003.
--  IDEMPOTENTE: reaplicar não duplica tabela, índice, constraint nem função.
--
--  NÃO TOCA EM NADA DE 001..007. Nenhuma policy, função ou tabela existente é
--  alterada. `public.is_admin()` (001) e `public.touch_updated_at()` (001) são
--  apenas LIDAS. Confirme que as duas existem antes de rodar:
--     select proname from pg_proc where proname in ('is_admin','touch_updated_at');
--
--  ==========================================================================
--  O PROBLEMA QUE ESTE ARQUIVO RESOLVE: ESCREVER SEM SESSÃO
--  ==========================================================================
--  Este é o PRIMEIRO formulário do projeto que grava sem login. Nas sete
--  migrações anteriores não existe UMA policy `for insert to anon`, e não é
--  esquecimento: `create policy … to anon with check (true)` numa tabela
--  entrega a chave anônima — que é pública por design, está no JavaScript do
--  site e qualquer pessoa lê no DevTools — como caneta de escrita direta no
--  PostgREST. Um laço de dez linhas insere dez mil respostas.
--
--  A superfície aqui é a MESMA da 006: uma função `security definer` que anon
--  pode EXECUTAR, sobre tabelas que anon não pode nem enxergar.
--
--      tabela  → RLS ligada, ZERO policies de escrita, `revoke all … from anon`
--      função  → `revoke … from public` e SÓ ENTÃO `grant … to anon`
--
--  Revogar de PUBLIC ANTES é a lição da 003:76-82 — toda função nasce com
--  EXECUTE para PUBLIC, do qual anon e authenticated HERDAM; revogar só de anon
--  é inócuo e dá falsa sensação de fechamento.
--
--  ==========================================================================
--  O ESCORE É DO SERVIDOR
--  ==========================================================================
--  `escore_intencao` é calculado DENTRO da RPC e nunca aceito do cliente. Um
--  número de priorização que o navegador escolhe não prioriza nada. As
--  respostas cruas ficam em `respostas` (jsonb) para que a coordenação possa
--  RE-PONTUAR o histórico inteiro com outra régua, sem reperguntar a ninguém:
--
--      update public.workshop_respostas
--         set escore_intencao = public.escore_intencao_workshop(respostas);
--
--  A régua e a justificativa de cada peso estão em `src/fitofarmas/escore.ts`,
--  que é o gêmeo desta função. `tests/fitofarmas.test.ts` lê o texto DESTE
--  arquivo e falha se os dois divergirem.
--
--  ==========================================================================
--  MODELO DE AMEAÇA ACEITO (mesma régua da 006)
--  ==========================================================================
--  Rede acadêmica, formulário sem dinheiro, janela de poucas semanas. Não há
--  CAPTCHA e não haverá — CAPTCHA num formulário institucional custa mais
--  respostas legítimas do que bloqueia robô. As defesas são proporcionais e
--  TODAS do lado do servidor:
--    (a) UMA resposta por e-mail por edição (índice único) — reenviar CORRIGE,
--        não duplica; inundar exige inventar endereços distintos;
--    (b) isca (honeypot) e tempo mínimo de preenchimento;
--    (c) teto de ESCRITAS por minuto na edição — conta `updated_at`, não
--        `created_at`, senão o ramo de correção passa por baixo do freio;
--    (d) teto de tamanho no jsonb cru e vocabulário fechado em toda coluna de
--        array — o que a tela oferece é o que o banco aceita;
--    (e) toda versão anterior arquivada em `workshop_respostas_versoes`
--        (append-only, por trigger): sobrescrever NUNCA destrói;
--    (f) tudo com carimbo e nada apagável pela API — engano é visível e
--        reversível pela coordenação no SQL Editor.
--
--  O QUE CONTINUA POSSÍVEL, E É ACEITO (não finja que não é):
--  sem login, o e-mail não PROVA nada. Quem tiver a chave anônima e o endereço
--  de outra pessoa pode responder no lugar dela, e quem tiver a lista de
--  convidados pode criar linhas com endereços que ainda não responderam. As
--  duas coisas são inerentes a um formulário aberto e só some com login — que
--  custaria mais respostas do que protege, num público que foi convidado por
--  ofício. O que se pode garantir, e se garante, é que nada disso APAGA nada
--  (defesa (e)), que a resposta da RPC não distingue "já respondeu" de "é a
--  primeira vez" (por isso os três desfeitos de sucesso têm a mesma frase), e
--  que o volume tem freio.
--
--  ==========================================================================
--  APAGAR UMA RESPOSTA (LGPD) — a coordenação, no SQL Editor
--  ==========================================================================
--      delete from public.workshop_respostas
--       where lower(email) = lower('pessoa@exemplo.br')
--         and edicao_id = (select id from public.workshop_edicoes
--                           where slug = 'i-workshop-conexao-fitofarmas');
-- ============================================================================


-- ==================================================== 1. A EDIÇÃO (config) ==
-- Mesma forma de `editais` (001) e `relatorio_ciclos` (005): a janela e os
-- rótulos são DADO, não código. Um II Workshop é uma linha nova, sem deploy.
--
-- DUAS JANELAS DIFERENTES, e confundi-las é o bug clássico:
--   • abre_em/fecha_em  = quando se pode RESPONDER (o que a RPC checa);
--   • as datas do evento vivem em `config`, são texto de tela e não fecham nada.
create table if not exists public.workshop_edicoes (
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
  constraint workshop_edicoes_janela check (fecha_em > abre_em)
);
alter table public.workshop_edicoes enable row level security;

drop trigger if exists workshop_edicoes_touch on public.workshop_edicoes;
create trigger workshop_edicoes_touch
  before update on public.workshop_edicoes
  for each row execute function public.touch_updated_at();

-- Leitura pública da edição publicada — a tela precisa do título e da janela.
-- É SELECT, jamais INSERT: mesmo desenho de `editais_public_read` (001).
drop policy if exists workshop_edicoes_public_read on public.workshop_edicoes;
create policy workshop_edicoes_public_read on public.workshop_edicoes
  for select using (status <> 'rascunho' or public.is_admin());

drop policy if exists workshop_edicoes_admin_write on public.workshop_edicoes;
create policy workshop_edicoes_admin_write on public.workshop_edicoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ============================================== 2. DOIS AUXILIARES DE JSONB ==
-- `jsonb_array_elements_text` LEVANTA EXCEÇÃO se o valor não for array, e o
-- payload vem de um navegador: basta uma versão antiga do site mandando
-- `"aportes": null` para a RPC inteira estourar em vez de recusar com jeito.
-- Estas duas funções são o cinto de segurança, e é por isso que toda leitura
-- de lista neste arquivo passa por `workshop_lista`.
create or replace function public.workshop_lista(j jsonb)
returns jsonb
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end;
$$;

-- O "qual?" de cada aporte cabe em uma linha. CHECK não aceita subconsulta, e
-- por isso a regra vira função imutável — que o CHECK pode chamar.
create or replace function public.workshop_detalhe_ok(j jsonb)
returns boolean
language sql immutable set search_path = public as $$
  select case
    when j is null then true
    when jsonb_typeof(j) <> 'object' then false
    else not exists (
      select 1 from jsonb_each_text(j) as e(k, v)
       where char_length(v) > 140 or char_length(k) > 40
    )
  end;
$$;

-- Todo elemento de `a` está em `v`? É o `check (… in (…))` das colunas ESCALARES
-- aplicado às colunas de ARRAY, e sem ele a promessa escrita em
-- `src/fitofarmas/types.ts` ("toda lista tem um check gêmeo aqui") era falsa
-- para `formas`, `aportes`, `iniciativas` e `compromissos`: um payload forjado
-- com `compromissos: ['qualquer_coisa']` satisfazia `cardinality >= 1` e ia
-- inteiro para a view da coordenação.
--
-- `bool_and` sobre zero linhas devolve NULL — daí o `coalesce(..., true)`, que
-- é o que faz array VAZIO ser válido. E o teste é `x is not null and x = any(v)`,
-- não `a <@ v`: o operador de contenção trata NULL de forma que deixaria
-- `['dado', null]` passar, e `jsonb_array_elements_text` devolve NULL de SQL
-- para um `null` de JSON.
create or replace function public.workshop_subset(a text[], v text[])
returns boolean
language sql immutable set search_path = public as $$
  select coalesce(bool_and(x is not null and x = any(v)), true) from unnest(a) as t(x);
$$;


-- ================================================== 3. O ESCORE (fórmula) ===
-- IMMUTABLE e sem acesso a tabela: é fórmula, não consulta. Fica SEPARADA da
-- RPC exatamente para poder re-pontuar o histórico numa instrução só.
--
-- A RÉGUA, em uma frase: pesa mais o que custa mais responder.
--   30 compromissos (passo com verbo e prazo)   20 aportes NOMEADOS
--   18 disponibilidade  12 horizonte  8 decisão  8 histórico
--    8 iniciativas   8 interesse   4 escala 1–5 (autodeclaração pura)
-- Soma dos tetos = 116, cortada em 100: chegar ao topo exige LARGURA, não um
-- único item no máximo. Gêmea de `src/fitofarmas/escore.ts` — mude as duas.
create or replace function public.escore_intencao_workshop(r jsonb)
returns smallint
language sql immutable set search_path = public as $$
  with
  -- (a) compromissos: soma dos pesos por custo real de execução, teto 30.
  --     'depois' vale zero e NÃO é penalidade: é resposta honesta, e punir
  --     honestidade só ensina a marcar caixa de fachada.
  comp as (
    select least(30, coalesce(sum(p.peso), 0))::int as v
      from jsonb_array_elements_text(public.workshop_lista(r -> 'compromissos')) as t(x)
      join (values
              ('carta_intencao', 8), ('coescrever_proposta', 8), ('sediar_atividade', 8),
              ('gt_redesfito', 7), ('compartilhar_dados', 6), ('indicar_estudantes', 6),
              ('apresentar_experiencia', 5), ('reuniao_30d', 5), ('depois', 0)
           ) as p(id, peso) on p.id = t.x
  ),
  -- (b) aportes: NOMEAR vale 5; apenas marcar vale 1. 'nenhum' nunca conta.
  --     É a distinção que sustenta o instrumento: marcar "tenho base de dados"
  --     é grátis; escrever "Herbário HFSL, 12 mil exsicatas" exige ter.
  ap as (
    select
      count(*) filter (
        where btrim(coalesce(r -> 'aportes_detalhe' ->> t.x, '')) <> ''
      )::int as nomeados,
      count(*)::int as marcados
      from jsonb_array_elements_text(public.workshop_lista(r -> 'aportes')) as t(x)
     where t.x <> 'nenhum'
  ),
  -- (c) iniciativas conjuntas desejadas. 'nenhuma' não é iniciativa.
  ini as (
    select least(8, 2 * count(*))::int as v
      from jsonb_array_elements_text(public.workshop_lista(r -> 'iniciativas')) as t(x)
     where t.x <> 'nenhuma'
  )
  select greatest(0, least(100,
      (select v from comp)
    + (select least(20, nomeados * 5 + (marcados - nomeados) * 1) from ap)
    + (select v from ini)
    -- escala 1–5 → 0 a 4 pontos. Quatro em cem, de propósito: é a pergunta
    -- mais barata do formulário e por isso não pode separar ninguém.
    + least(4, greatest(0, coalesce((r ->> 'chance_1a5')::int, 0) - 1))
    + case r ->> 'disponibilidade'
        when 'ate_1_dia_semana'  then 18
        when 'ate_1_dia_mes'     then 14
        when 'ate_meio_dia_mes'  then 10
        when 'ate_2h_mes'        then 5
        else 0 end
    + case r ->> 'horizonte'
        when 'ja_tenho'    then 12
        when 'ate_6_meses' then 9
        when 'ate_12_meses' then 5
        else 0 end
    + case r ->> 'decisao'
        when 'decido'      then 8
        when 'influencio'  then 5
        when 'preciso_aval' then 3
        else 0 end
    + case r ->> 'historico'
        when 'formal'   then 8
        when 'informal' then 5
        when 'tentei'   then 3
        else 0 end
    + case r ->> 'interesse'
        when 'proposta'  then 8
        when 'colaborar' then 5
        when 'entender'  then 2
        else 0 end
  ))::smallint;
$$;


-- ==================================================== 4. AS RESPOSTAS =======
-- Colunas para o que a coordenação vai FILTRAR e ORDENAR; jsonb para o resto.
-- Não é redundância: `respostas` é o cru (para re-pontuar), as colunas são o
-- que sustenta índice, constraint e a view de priorização.
create table if not exists public.workshop_respostas (
  id           uuid primary key default gen_random_uuid(),
  edicao_id    uuid not null references public.workshop_edicoes (id) on delete cascade,
  protocolo    text unique,

  -- identificação mínima. SÓ o que é preciso para CHAMAR a pessoa depois.
  -- Nunca CPF, nunca endereço, nunca data de nascimento (mesma linha da 005).
  nome         text not null constraint workshop_respostas_nome
                 check (char_length(btrim(nome)) between 3 and 140),
  email        text not null constraint workshop_respostas_email
                 check (email = lower(email) and char_length(email) <= 254),
  telefone     text check (telefone is null or char_length(telefone) <= 32),
  instituicao  text not null constraint workshop_respostas_instituicao
                 check (char_length(btrim(instituicao)) between 2 and 160),
  uf           text check (uf is null or uf ~ '^[A-Z]{2}$'),
  lattes       text check (lattes is null or char_length(lattes) <= 200),
  orcid        text check (orcid is null or orcid ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$'),

  -- ---- segmentação. Cada lista é gêmea de uma união em src/fitofarmas/types.ts
  vinculo      text not null check (vinculo in (
                 'docente_pesquisador','pos_graduando','graduando','tecnico',
                 'profissional_saude','gestor_publico','comunidade_associacao',
                 'empresa','estudante_ensino_medio','outro')),
  interesse    text not null check (interesse in (
                 'acompanhar','entender','colaborar','proposta')),
  sede         text not null check (sede in (
                 'porto_velho','cacoal','ambas','so_online','indefinido')),

  -- Cada lista tem TETO de cardinalidade e VOCABULÁRIO fechado. Os dois são
  -- necessários: o teto impede que um payload forjado grave um array de dez mil
  -- elementos, e o vocabulário impede que ele grave dez elementos inventados.
  eets         text[] not null default '{}'
               constraint workshop_respostas_eets_teto check (cardinality(eets) <= 3)
               constraint workshop_respostas_eets_valores check (public.workshop_subset(eets,
                 array['eet1','eet2','eet3','eet4','eet5','eet6','eet7','eet8'])),
  formas       text[] not null default '{}'
               constraint workshop_respostas_formas_teto check (cardinality(formas) <= 11)
               constraint workshop_respostas_formas_valores check (public.workshop_subset(formas,
                 array['pesquisa_conjunta','infraestrutura','dados_colecoes','formacao',
                       'extensao_comunidades','politicas_publicas','producao_aepl',
                       'farmacia_viva','divulgacao','captacao','articulacao'])),
  aportes      text[] not null default '{}'
               constraint workshop_respostas_aportes_teto check (cardinality(aportes) <= 8)
               constraint workshop_respostas_aportes_valores check (public.workshop_subset(aportes,
                 array['infraestrutura','dados','projeto','rede','financiamento',
                       'equipe','territorio','nenhum'])),
  iniciativas  text[] not null default '{}'
               constraint workshop_respostas_iniciativas_teto check (cardinality(iniciativas) <= 9)
               constraint workshop_respostas_iniciativas_valores check (public.workshop_subset(iniciativas,
                 array['projeto_pesquisa','submissao_edital','publicacao','formacao_curso',
                       'produto','farmacia_viva_implantacao','politica_nota','banco_dados',
                       'nenhuma'])),
  compromissos text[] not null default '{}'
               constraint workshop_respostas_compromissos_teto check (cardinality(compromissos) <= 9)
               constraint workshop_respostas_compromissos_valores check (public.workshop_subset(compromissos,
                 array['reuniao_30d','gt_redesfito','carta_intencao','indicar_estudantes',
                       'compartilhar_dados','coescrever_proposta','sediar_atividade',
                       'apresentar_experiencia','depois'])),

  -- o "qual?" de cada aporte: a resposta CARA, a que não se dá sem ter.
  aportes_detalhe jsonb not null default '{}'::jsonb
               constraint workshop_respostas_detalhe
               check (public.workshop_detalhe_ok(aportes_detalhe)),

  -- ---- as perguntas que medem intenção, e não entusiasmo
  --  Nulas quando a pessoa marcou interesse='acompanhar': o caminho curto NÃO
  --  faz estas perguntas, e preencher com um valor inventado seria fabricar
  --  resposta. `workshop_respostas_caminho` abaixo é quem garante a coerência.
  disponibilidade text check (disponibilidade in (
                    'so_acompanhar','ate_2h_mes','ate_meio_dia_mes',
                    'ate_1_dia_mes','ate_1_dia_semana')),
  horizonte       text check (horizonte in (
                    'ja_tenho','ate_6_meses','ate_12_meses','sem_prazo')),
  decisao         text check (decisao in ('decido','influencio','preciso_aval','nao_sei')),
  historico       text check (historico in ('formal','informal','tentei','nao')),
  chance_1a5      smallint check (chance_1a5 is null or chance_1a5 between 1 and 5),

  comentario   text check (comentario is null or char_length(comentario) <= 600),
  canal        text not null check (canal in ('email','whatsapp','telefone')),

  -- O cru, para re-pontuar depois sem reperguntar a ninguém.
  -- TETO DE TAMANHO: sem ele, o ramo de correção da RPC aceita reescrever esta
  -- linha com um jsonb de vários MB, quantas vezes quiser — o freio de
  -- enxurrada só conta linhas NOVAS. 64 kB é ~20× o maior payload real (o
  -- formulário inteiro preenchido dá ~2,5 kB) e ~0 para quem quer inchar tabela.
  -- `pg_column_size` é STABLE e não serve em CHECK; `length(::text)` é imutável.
  respostas    jsonb not null default '{}'::jsonb
               constraint workshop_respostas_cru_teto
               check (length(respostas::text) <= 65536),
  -- calculado NA RPC, jamais aceito do cliente
  escore_intencao smallint not null default 0
                  check (escore_intencao between 0 and 100),

  consentimento_lgpd boolean not null check (consentimento_lgpd),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Coerência do caminho curto: quem NÃO marcou 'acompanhar' respondeu as
  -- quatro perguntas de compromisso; quem marcou não respondeu nenhuma delas.
  -- Sem esta constraint, um cliente adulterado mandaria interesse='acompanhar'
  -- com disponibilidade='ate_1_dia_semana' e o escore contaria 18 pontos que
  -- ninguém deu.
  constraint workshop_respostas_caminho check (
    (interesse = 'acompanhar'
       and disponibilidade is null and horizonte is null
       and decisao is null and historico is null)
    or
    (interesse <> 'acompanhar'
       and disponibilidade is not null and horizonte is not null
       and decisao is not null and historico is not null
       and chance_1a5 is not null
       and cardinality(compromissos) >= 1)
  )
);
alter table public.workshop_respostas enable row level security;

drop trigger if exists workshop_respostas_touch on public.workshop_respostas;
create trigger workshop_respostas_touch
  before update on public.workshop_respostas
  for each row execute function public.touch_updated_at();

-- UMA resposta por e-mail por edição. É o anti-inundação e, ao mesmo tempo, o
-- que deixa a pessoa CORRIGIR o que enviou: a RPC cai no ramo de update e o
-- protocolo é preservado.
create unique index if not exists workshop_respostas_email_unico
  on public.workshop_respostas (edicao_id, lower(email));

-- O índice da priorização: "quem devo procurar primeiro" é a única consulta
-- que a coordenação vai fazer todo dia.
create index if not exists workshop_respostas_escore_idx
  on public.workshop_respostas (edicao_id, escore_intencao desc, created_at);

-- Freio de enxurrada (defesa (c)): conta o que entrou no último minuto.
create index if not exists workshop_respostas_recentes_idx
  on public.workshop_respostas (edicao_id, created_at desc);

-- SÓ a coordenação lê. NENHUMA policy de INSERT, UPDATE ou DELETE existe neste
-- arquivo — o que não tem policy não se faz pela API. Quem escreve é a RPC da
-- seção 6, que é `security definer` e por isso não passa por RLS.
drop policy if exists workshop_respostas_admin_read on public.workshop_respostas;
create policy workshop_respostas_admin_read on public.workshop_respostas
  for select to authenticated using (public.is_admin());


-- ============================================ 4b. O HISTÓRICO (append-only) ==
-- A CORREÇÃO POR E-MAIL É UMA SOBRESCRITA, e num formulário sem login o e-mail
-- não prova nada: quem souber o endereço de outra pessoa pode reenviar por ela
-- e substituir o que ela respondeu. Não dá para impedir sem login — mas dá para
-- impedir que a sobrescrita DESTRUA. Toda versão anterior fica aqui antes de
-- ser trocada, e a coordenação restaura no SQL Editor.
--
-- Mesmo desenho do log da 004 e do `relato_eventos` da 005: gravado por trigger
-- SECURITY DEFINER, RLS ligada, leitura só de admin, e NENHUMA policy de
-- escrita — nem a RPC escreve aqui diretamente. Append-only de verdade.
create table if not exists public.workshop_respostas_versoes (
  id          uuid primary key default gen_random_uuid(),
  resposta_id uuid not null references public.workshop_respostas (id) on delete cascade,
  edicao_id   uuid not null,
  email       text not null,
  respostas   jsonb not null,
  escore_intencao smallint not null,
  substituida_em  timestamptz not null default now()
);
alter table public.workshop_respostas_versoes enable row level security;

create index if not exists workshop_respostas_versoes_idx
  on public.workshop_respostas_versoes (resposta_id, substituida_em desc);

drop policy if exists workshop_versoes_admin_read on public.workshop_respostas_versoes;
create policy workshop_versoes_admin_read on public.workshop_respostas_versoes
  for select to authenticated using (public.is_admin());

create or replace function public.workshop_arquivar_versao()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Só arquiva quando o CONTEÚDO muda. Reenvio idêntico (a pessoa tocou duas
  -- vezes em "Enviar") não gera versão nova — senão o histórico vira ruído.
  if old.respostas is distinct from new.respostas then
    insert into public.workshop_respostas_versoes
      (resposta_id, edicao_id, email, respostas, escore_intencao)
    values (old.id, old.edicao_id, old.email, old.respostas, old.escore_intencao);
  end if;
  return new;
end; $$;

drop trigger if exists workshop_respostas_versionar on public.workshop_respostas;
create trigger workshop_respostas_versionar
  before update on public.workshop_respostas
  for each row execute function public.workshop_arquivar_versao();


-- ============================================ 5. PROTOCOLO (padrão do 003) ==
-- Contador atômico por edição. RLS ligada e SEM policy = inacessível pela API.
-- Tabela e não `sequence`: sequence não é transacional e uma tentativa recusada
-- queimaria número. NUNCA `count(*) + 1` — foi a corrida que a 003 existe para
-- corrigir: dois envios simultâneos liam a mesma contagem e o segundo falhava.
create table if not exists public.workshop_protocolo_seq (
  edicao_id uuid primary key references public.workshop_edicoes (id) on delete cascade,
  ultimo    int  not null default 0
);
alter table public.workshop_protocolo_seq enable row level security;

create or replace function public.reserve_protocolo_workshop(p_edicao uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- `insert … on conflict do update … returning` pega lock de linha por edição:
  -- chamadas concorrentes são serializadas e cada uma recebe valor único.
  insert into public.workshop_protocolo_seq (edicao_id, ultimo)
  values (p_edicao, 1)
  on conflict (edicao_id)
    do update set ultimo = public.workshop_protocolo_seq.ultimo + 1
  returning ultimo into n;
  return n;
end; $$;


-- ================================================ 6. O REGISTRO (a RPC) =====
--  A ÚNICA superfície deste módulo aberta a quem não tem sessão.
--
--  RECEBE   o slug da edição e um jsonb com as respostas.
--  GRAVA    uma linha nova, ou CORRIGE a da mesma pessoa (casada pelo e-mail).
--  DEVOLVE  jsonb — NUNCA exceção para desfecho previsto: exceção vira 400
--           opaco no PostgREST e a tela perde a chance de dizer o que houve.
--
--  DESFECHOS (`estado`), todos com `mensagem` pronta para a tela:
--    'recebido'         ok=true   — gravou. Vem com `protocolo`.
--    'atualizado'       ok=true   — já havia resposta deste e-mail; corrigimos.
--    'fora_da_janela'   ok=false
--    'email_invalido'   ok=false  — vem com `campo`, para a tela focar o certo.
--    'dados_invalidos'  ok=false  — alguma constraint recusou.
--
--  O QUE ELA NÃO FAZ, DE PROPÓSITO:
--   • não cria conta, não devolve sessão, não envia e-mail;
--   • não revela se um e-mail "já existe": 'atualizado' e 'recebido' têm o
--     mesmo peso de informação para quem não é dono do endereço, e NENHUM dado
--     anterior volta na resposta — quem chutar endereços alheios não descobre
--     quem respondeu nem o que respondeu;
--   • não aceita `escore_intencao` do cliente: ele é calculado aqui.
create or replace function public.registrar_intencao_workshop(
  p_edicao_slug text,
  p_respostas   jsonb,
  p_isca        text default '',       -- honeypot: humano nunca preenche
  p_ms          int  default 999999)   -- ms desde a abertura do formulário
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_edicao   uuid;
  v_email    text;
  v_escore   smallint;
  v_prot     text;
  v_existe   uuid;
  v_recentes int;
  v_curto    boolean;
  n int;
begin
  -- ---- 0. a isca e o relógio ---------------------------------------------
  -- Robô que preencheu o campo escondido, ou que respondeu 22 perguntas em
  -- menos de 4 segundos, recebe ok=true e NADA é gravado. É deliberado: dizer
  -- "recusado" ensina o robô a corrigir e voltar. Nenhum humano cai aqui — o
  -- campo é `aria-hidden`, fora do foco e fora da tela.
  if coalesce(btrim(p_isca), '') <> '' or coalesce(p_ms, 0) < 4000 then
    return jsonb_build_object('ok', true, 'estado', 'recebido',
      'protocolo', null,
      'mensagem', 'Recebemos a sua resposta. Obrigado!');
  end if;

  -- ---- 1. a edição aberta -------------------------------------------------
  select e.id into v_edicao
    from public.workshop_edicoes e
   where e.slug = p_edicao_slug
     and e.status = 'aberto'
     and now() between e.abre_em and e.fecha_em;

  if v_edicao is null then
    return jsonb_build_object('ok', false, 'estado', 'fora_da_janela',
      'mensagem', 'As respostas para este workshop não estão abertas agora. '
               || 'Confira a página do evento ou escreva para a coordenação.');
  end if;

  -- ---- 2. freio de enxurrada (defesa (c)) ---------------------------------
  -- 40 escritas no mesmo minuto não é um workshop enchendo: é um laço. O limite
  -- é alto o suficiente para o pico real (o e-mail sai para ~200 pessoas de uma
  -- vez) e baixo o suficiente para custar caro a quem insiste.
  --
  -- CONTA `updated_at`, NÃO `created_at`, e a diferença é o buraco inteiro:
  -- `touch_updated_at` (001) só mexe em `updated_at`, então um atacante que
  -- inserisse UMA linha e depois só a reescrevesse jamais aumentaria a contagem
  -- de `created_at` — reescrita ilimitada, com o freio ligado e cego.
  select count(*) into v_recentes
    from public.workshop_respostas r
   where r.edicao_id = v_edicao
     and r.updated_at > now() - interval '1 minute';
  if v_recentes >= 40 then
    return jsonb_build_object('ok', false, 'estado', 'dados_invalidos',
      'mensagem', 'Estamos recebendo muitas respostas ao mesmo tempo. '
               || 'Espere um minuto e toque em enviar de novo — nada foi perdido.');
  end if;

  -- ---- 3. o e-mail --------------------------------------------------------
  -- Conservadora de propósito e IGUAL à do cliente (src/fitofarmas/validation.ts):
  -- tela que aceita o que o banco recusa devolve erro genérico no envio, depois
  -- de tudo preenchido. `.invalid` é reservado pela RFC 2606 e nunca entrega.
  v_email := lower(btrim(coalesce(p_respostas ->> 'email', '')));
  if length(v_email) > 254
     or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$'
     or v_email like '%.invalid' then
    return jsonb_build_object('ok', false, 'estado', 'email_invalido',
      'campo', 'email',
      'mensagem', 'Confira o endereço: ele não parece um e-mail válido.');
  end if;

  -- ---- 4. o caminho curto, e a PODA que ele exige -------------------------
  -- Quem marcou 'acompanhar' não respondeu as perguntas de colaboração. Gravar
  -- NULL nelas é a única forma honesta — e a constraint `..._caminho` recusa
  -- qualquer mistura das duas coisas.
  --
  -- A PODA, e por que ela é do SERVIDOR:
  -- quem preencheu o formulário inteiro e depois voltou para dizer "na verdade
  -- só quero acompanhar" continua com os eixos, os aportes e os compromissos no
  -- estado do navegador. A tela apaga isso (`escolherInteresse` em
  -- FormularioPreEvento.tsx), mas a tela não é autoridade: sem a poda aqui, um
  -- cliente desatualizado — ou adulterado de propósito — grava um respondente
  -- 'acompanhar' carregando cinco compromissos, e o escore conta 30 pontos que
  -- a pessoa RETIROU. Podar antes de pontuar resolve os dois casos de uma vez,
  -- porque `respostas` (o cru guardado para re-pontuar) sai daqui já limpo.
  v_curto := coalesce(p_respostas ->> 'interesse', '') = 'acompanhar';

  if v_curto then
    p_respostas := p_respostas
      - 'eets' - 'formas' - 'aportes' - 'aportes_detalhe'
      - 'iniciativas' - 'compromissos'
      - 'disponibilidade' - 'horizonte' - 'decisao' - 'historico' - 'chance_1a5';
  end if;

  -- ---- 5. o escore, aqui e só aqui ---------------------------------------
  v_escore := public.escore_intencao_workshop(p_respostas);

  -- ---- 6. grava ou corrige ------------------------------------------------
  select r.id, r.protocolo into v_existe, v_prot
    from public.workshop_respostas r
   where r.edicao_id = v_edicao and lower(r.email) = v_email
   for update;

  if v_existe is not null then
    update public.workshop_respostas set
      nome            = btrim(p_respostas ->> 'nome'),
      telefone        = nullif(btrim(coalesce(p_respostas ->> 'telefone', '')), ''),
      instituicao     = btrim(p_respostas ->> 'instituicao'),
      uf              = nullif(upper(btrim(coalesce(p_respostas ->> 'uf', ''))), ''),
      lattes          = nullif(btrim(coalesce(p_respostas ->> 'lattes', '')), ''),
      orcid           = nullif(btrim(coalesce(p_respostas ->> 'orcid', '')), ''),
      vinculo         = p_respostas ->> 'vinculo',
      interesse       = p_respostas ->> 'interesse',
      sede            = p_respostas ->> 'sede',
      eets            = array(select jsonb_array_elements_text(public.workshop_lista(p_respostas -> 'eets'))),
      formas          = array(select jsonb_array_elements_text(public.workshop_lista(p_respostas -> 'formas'))),
      aportes         = array(select jsonb_array_elements_text(public.workshop_lista(p_respostas -> 'aportes'))),
      iniciativas     = array(select jsonb_array_elements_text(public.workshop_lista(p_respostas -> 'iniciativas'))),
      compromissos    = array(select jsonb_array_elements_text(public.workshop_lista(p_respostas -> 'compromissos'))),
      aportes_detalhe = coalesce(p_respostas -> 'aportes_detalhe', '{}'::jsonb),
      disponibilidade = case when v_curto then null else p_respostas ->> 'disponibilidade' end,
      horizonte       = case when v_curto then null else p_respostas ->> 'horizonte' end,
      decisao         = case when v_curto then null else p_respostas ->> 'decisao' end,
      historico       = case when v_curto then null else p_respostas ->> 'historico' end,
      chance_1a5      = case when v_curto then null
                             else nullif(p_respostas ->> 'chance_1a5', '0')::smallint end,
      comentario      = nullif(btrim(coalesce(p_respostas ->> 'comentario', '')), ''),
      canal           = p_respostas ->> 'canal',
      respostas       = p_respostas,
      escore_intencao = v_escore,
      -- SEM ESTA LINHA o consentimento só era exigido no INSERT: um payload com
      -- "lgpd": false era recusado para e-mail novo (o CHECK barra o false) e
      -- ACEITO para e-mail que já respondeu — a linha continuava afirmando um
      -- consentimento que aquele envio não trouxe.
      consentimento_lgpd = coalesce((p_respostas ->> 'lgpd')::boolean, false)
     where id = v_existe;

    -- RESPOSTA IDÊNTICA À DO INSERT, e isso é segurança, não descuido.
    -- Uma mensagem "Atualizamos a sua resposta" transforma esta RPC — que
    -- qualquer pessoa com a chave anônima executa — num ORÁCULO: percorrendo a
    -- lista de convidados, um terceiro descobria quem já havia respondido. O
    -- desfecho volta com o mesmo `estado`, o mesmo texto e o protocolo da linha;
    -- quem acabou de corrigir sabe que corrigiu porque acabou de fazê-lo.
    return jsonb_build_object('ok', true, 'estado', 'recebido',
      'protocolo', v_prot,
      'mensagem', 'Recebemos a sua resposta. Guarde o protocolo abaixo.');
  end if;

  n := public.reserve_protocolo_workshop(v_edicao);
  v_prot := 'WFF-' || lpad(n::text, 4, '0');

  insert into public.workshop_respostas (
    edicao_id, protocolo, nome, email, telefone, instituicao, uf, lattes, orcid,
    vinculo, interesse, sede, eets, formas, aportes, iniciativas, compromissos,
    aportes_detalhe, disponibilidade, horizonte, decisao, historico, chance_1a5,
    comentario, canal, respostas, escore_intencao, consentimento_lgpd)
  values (
    v_edicao, v_prot,
    btrim(p_respostas ->> 'nome'),
    v_email,
    nullif(btrim(coalesce(p_respostas ->> 'telefone', '')), ''),
    btrim(p_respostas ->> 'instituicao'),
    nullif(upper(btrim(coalesce(p_respostas ->> 'uf', ''))), ''),
    nullif(btrim(coalesce(p_respostas ->> 'lattes', '')), ''),
    nullif(btrim(coalesce(p_respostas ->> 'orcid', '')), ''),
    p_respostas ->> 'vinculo',
    p_respostas ->> 'interesse',
    p_respostas ->> 'sede',
    array(select jsonb_array_elements_text(public.workshop_lista(p_respostas -> 'eets'))),
    array(select jsonb_array_elements_text(public.workshop_lista(p_respostas -> 'formas'))),
    array(select jsonb_array_elements_text(public.workshop_lista(p_respostas -> 'aportes'))),
    array(select jsonb_array_elements_text(public.workshop_lista(p_respostas -> 'iniciativas'))),
    array(select jsonb_array_elements_text(public.workshop_lista(p_respostas -> 'compromissos'))),
    coalesce(p_respostas -> 'aportes_detalhe', '{}'::jsonb),
    case when v_curto then null else p_respostas ->> 'disponibilidade' end,
    case when v_curto then null else p_respostas ->> 'horizonte' end,
    case when v_curto then null else p_respostas ->> 'decisao' end,
    case when v_curto then null else p_respostas ->> 'historico' end,
    case when v_curto then null else nullif(p_respostas ->> 'chance_1a5', '0')::smallint end,
    nullif(btrim(coalesce(p_respostas ->> 'comentario', '')), ''),
    p_respostas ->> 'canal',
    p_respostas,
    v_escore,
    coalesce((p_respostas ->> 'lgpd')::boolean, false));

  return jsonb_build_object('ok', true, 'estado', 'recebido',
    'protocolo', v_prot,
    'mensagem', 'Recebemos a sua resposta. Guarde o protocolo abaixo.');

exception
  -- A tela já validou antes; estas exceções só acontecem com cliente
  -- desatualizado ou adulterado. Devolvê-las como DESFECHO evita o 400 opaco
  -- do PostgREST — e, no caso de quem adulterou, não conta o que falhou.
  -- `numeric_value_out_of_range` (22003) está na lista porque `chance_1a5: 40000`
  -- passa ileso pelo escore (que usa `::int`) e só estoura no `::smallint` da
  -- gravação — fora do handler, isso virava um 400 cru do PostgREST.
  when check_violation or not_null_violation or invalid_text_representation
    or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'estado', 'dados_invalidos',
      'mensagem', 'Alguma resposta ficou fora do esperado. '
               || 'Recarregue a página e envie de novo, por favor.');
  when unique_violation then
    -- Corrida de dois envios simultâneos do mesmo e-mail: o segundo perde a
    -- inserção mas a resposta do primeiro está gravada. Não é erro da pessoa —
    -- e a frase é a mesma dos outros desfechos de sucesso, pelo mesmo motivo de
    -- não virar oráculo de "este e-mail já respondeu".
    return jsonb_build_object('ok', true, 'estado', 'recebido',
      'protocolo', null,
      'mensagem', 'Recebemos a sua resposta.');
end; $$;


-- ============================================ 7. A VISÃO DA COORDENAÇÃO =====
-- "Com quem eu sento no dia 25?" — a única consulta que importa todo dia.
-- View e não coluna: a faixa é INTERPRETAÇÃO do escore, e interpretação muda
-- sem migração. Só admin lê (a view herda a RLS de `workshop_respostas`).
create or replace view public.workshop_prioridade as
  select
    r.id, r.edicao_id, e.slug as edicao, r.protocolo,
    r.nome, r.email, r.telefone, r.canal, r.instituicao, r.uf, r.lattes, r.orcid,
    r.vinculo, r.interesse, r.sede,
    r.escore_intencao,
    case
      when r.escore_intencao >= 70 then 'prioritario'
      when r.escore_intencao >= 45 then 'promissor'
      when r.escore_intencao >= 25 then 'acompanhar'
      else 'informativo'
    end as faixa,
    r.eets, r.formas, r.aportes, r.aportes_detalhe,
    r.iniciativas, r.compromissos,
    r.disponibilidade, r.horizonte, r.decisao, r.historico, r.chance_1a5,
    -- Quantos ativos a pessoa NOMEOU. É o número que separa "diz que tem" de
    -- "tem": aparece no painel ao lado do escore, para a coordenação conferir.
    (select count(*) from jsonb_each_text(r.aportes_detalhe) as d(k, v)
      where btrim(v) <> '') as aportes_nomeados,
    r.comentario, r.created_at, r.updated_at
  from public.workshop_respostas r
  join public.workshop_edicoes e on e.id = r.edicao_id
 order by r.escore_intencao desc, r.created_at;

-- `security_invoker` é o que faz a view respeitar a RLS de quem consulta em vez
-- da do dono. Sem isto, a view seria um buraco: qualquer authenticated leria
-- tudo. (Postgres 15+; o Supabase está acima disso.)
alter view public.workshop_prioridade set (security_invoker = on);


-- ============================================================== 8. GRANTS ====
-- A lição da 003/005/006: revogar de PUBLIC primeiro (anon e authenticated
-- HERDAM de PUBLIC; revogar só deles é inócuo) e só então conceder a quem deve.
revoke execute on function public.registrar_intencao_workshop(text, jsonb, text, int) from public;
grant  execute on function public.registrar_intencao_workshop(text, jsonb, text, int) to anon, authenticated;

-- Estas três NÃO são para o público. `escore_intencao_workshop` exposta deixaria
-- qualquer pessoa descobrir a régua por tentativa e erro — e, sabendo a régua,
-- marcar as caixas certas. `reserve_protocolo_workshop` exposta queima números.
revoke execute on function public.reserve_protocolo_workshop(uuid)      from public, anon, authenticated;
revoke execute on function public.escore_intencao_workshop(jsonb)       from public, anon, authenticated;
revoke execute on function public.workshop_lista(jsonb)                 from public, anon, authenticated;
revoke execute on function public.workshop_detalhe_ok(jsonb)            from public, anon, authenticated;
revoke execute on function public.workshop_subset(text[], text[])       from public, anon, authenticated;
revoke execute on function public.workshop_arquivar_versao()            from public, anon, authenticated;

grant select on public.workshop_edicoes to anon, authenticated;
grant select on public.workshop_respostas to authenticated;           -- a policy filtra
grant select on public.workshop_prioridade to authenticated;          -- idem, via view
grant select on public.workshop_respostas_versoes to authenticated;   -- idem

revoke all    on public.workshop_respostas          from anon;
revoke all    on public.workshop_respostas_versoes  from anon;
revoke all    on public.workshop_protocolo_seq      from anon, authenticated;
revoke all    on public.workshop_prioridade         from anon;
revoke insert, update, delete on public.workshop_respostas         from anon, authenticated;
revoke insert, update, delete on public.workshop_respostas_versoes from anon, authenticated;
revoke insert, update, delete on public.workshop_edicoes           from anon;


-- ============================================================ 9. SANIDADE ====
-- Rode este bloco DEPOIS de aplicar e LEIA o resultado. Sem teste automatizado
-- de RLS neste repositório, é a única prova de que o fechamento funcionou.
select 'anon EXECUTA registrar_intencao (deve ser true)' as checagem,
       has_function_privilege('anon','public.registrar_intencao_workshop(text,jsonb,text,int)','execute')::text as valor
union all select 'anon LÊ workshop_respostas (deve ser false)',
       has_table_privilege('anon','public.workshop_respostas','select')::text
union all select 'anon INSERE em workshop_respostas (deve ser false)',
       has_table_privilege('anon','public.workshop_respostas','insert')::text
union all select 'anon LÊ workshop_prioridade (deve ser false)',
       has_table_privilege('anon','public.workshop_prioridade','select')::text
union all select 'anon EXECUTA o escore (deve ser false)',
       has_function_privilege('anon','public.escore_intencao_workshop(jsonb)','execute')::text
union all select 'anon LÊ workshop_edicoes (deve ser true)',
       has_table_privilege('anon','public.workshop_edicoes','select')::text
union all select 'anon LÊ o histórico de versões (deve ser false)',
       has_table_privilege('anon','public.workshop_respostas_versoes','select')::text
union all select 'policies de ESCRITA em workshop_respostas (deve ser 0)',
       (select count(*)::text from pg_policies
         where schemaname = 'public' and tablename = 'workshop_respostas' and cmd <> 'SELECT')
union all select 'policies de ESCRITA no histórico (deve ser 0 — é append-only por trigger)',
       (select count(*)::text from pg_policies
         where schemaname = 'public' and tablename = 'workshop_respostas_versoes' and cmd <> 'SELECT')
union all select 'view respeita a RLS de quem consulta (deve conter security_invoker=on)',
       coalesce((select array_to_string(reloptions, ',') from pg_class
                  where relname = 'workshop_prioridade'), '(sem opções)')
union all select 'edições cadastradas (0 até rodar seeds/003)',
       (select count(*)::text from public.workshop_edicoes)
union all select 'respostas recebidas',
       (select count(*)::text from public.workshop_respostas);
