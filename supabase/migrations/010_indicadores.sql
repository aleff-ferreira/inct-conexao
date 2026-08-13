-- ============================================================================
--  INCT-CONEXAO · 010 — Índice H e citações com PROCEDÊNCIA (Q14 automática)
-- ============================================================================
--  Rode no SQL Editor DEPOIS de 001..009.
--  IDEMPOTENTE: rodável duas vezes sem erro e sem duplicar nada — todo ADD
--  COLUMN é IF NOT EXISTS (o CHECK viaja inline e a cláusula inteira é pulada
--  na segunda passada), a tabela é CREATE TABLE IF NOT EXISTS e cada policy é
--  precedida do seu DROP POLICY IF EXISTS, como na 005.
--
--  O QUE MUDA EM RELAÇÃO À 009, E POR QUE
--  --------------------------------------
--  A 009 criou `ciclo_membros.indice_h` e `.total_citacoes` declarando-os
--  MANUAIS de propósito: "OpenAlex daria estimativa, mas diverge do Scholar que
--  o pesquisador conhece". Aquilo continua verdade — o que mudou é que agora
--  existe uma forma de trazer o número DO SCHOLAR, e não uma estimativa.
--  A apuração empírica (10/08/2026, curl) que autorizou a mudança:
--    • o Scholar NÃO manda `access-control-allow-origin` — o navegador não
--      pode ler; só um proxy de servidor pode (a Edge Function `indicadores`);
--    • o robots.txt do Scholar diz `Allow: /citations?user=` e
--      `Disallow: /citations?` — LER PERFIL CONHECIDO É PERMITIDO, BUSCAR
--      AUTOR POR NOME NÃO É. Daí o desenho: a pessoa cola o link do perfil UMA
--      VEZ (é `scholar_id`), e a partir daí é automático;
--    • o id `user=` é opaco e não o temos para ninguém dos ~209. Tentou-se
--      descobri-lo pelo ORCID (`pub.orcid.org/.../researcher-urls`, CORS-ok):
--      veio VAZIO nos 4 pesquisadores reais testados. Descoberta automática do
--      id não existe — por isso a coluna é preenchida pela pessoa;
--    • o OpenAlex é CORS-aberto e responde por ORCID (que a Tela 1 já
--      descobre): é a rede de segurança que funciona HOJE, sem infra nenhuma.
--
--  A COLUNA MAIS IMPORTANTE DESTE ARQUIVO É `indicadores_fonte`.
--  As duas bases NÃO dão o mesmo número (corpus diferente; o h do OpenAlex sai
--  menor), e um relatório de agência com "h = 52" sem dizer de onde veio é
--  passivo: não se sabe se é comparável ao do colega da linha de cima, e não há
--  como reproduzir a apuração. Guardar a procedência custa duas colunas e é o
--  que transforma um número solto em dado auditável.
--
--  RLS — nenhuma policy EXISTENTE é criada, alterada ou removida aqui.
--    • ciclo_membros: as três colunas novas herdam a policy da tabela (RLS
--      filtra LINHA, não coluna). O guarda `guard_membro_self` (005, reescrito
--      pela 007) barra uma LISTA FECHADA de campos — email, user_id, ciclo_id,
--      papel, categoria_picc, convite_token, ativo — e as novas ficam, de
--      propósito, FORA dela: são exatamente o que a Tela 1 pede que a pessoa
--      preencha sobre si mesma. Nenhuma delas muda permissão.
--    • indicadores_cache: tabela NOVA, com policy NOVA (seção 2).
-- ============================================================================


-- ============================ 1. ciclo_membros — o id e a procedência =======
--  Três colunas, todas do RESPONDENTE NAQUELE CICLO (por isso aqui, e não em
--  `profiles`), todas opcionais, nenhuma travando envio:
--
--    • scholar_id — o `user=` do perfil no Google Acadêmico. A pessoa cola o
--      LINK; o cliente (`extrairScholarId`) extrai o id e é o id que chega
--      aqui. O CHECK é o mesmo regex de `src/relato/indicadores.ts`
--      (RE_SCHOLAR_ID) e de `supabase/functions/indicadores/index.ts` — OS TRÊS
--      ANDAM JUNTOS. A faixa 8..20 é contenção proporcional: os ids observados
--      têm 12 caracteres (`JicYPdAAAAAJ`), mas o Google nunca documentou a
--      largura, e um CHECK mais esperto que a realidade vira migração
--      corretiva. O alfabeto base64url exclui `@` — o que não é coincidência:
--      o robots.txt tem `Disallow: /citations?user=*@`, e o CHECK torna
--      impossível gravar um id que não poderíamos ler sem violar o robots.
--      SEM UNIQUE, de propósito: dois membros com o mesmo perfil é erro de
--      digitação, não fraude — e um UNIQUE aqui faria a segunda pessoa receber
--      "violação de restrição" numa tela em que ela só queria colar um link.
--      A duplicata aparece no painel da coordenação, que é onde se resolve.
--
--    • indicadores_fonte — 'scholar' | 'openalex' | 'manual'. Ver o cabeçalho.
--      Sem DEFAULT: nulo significa "ninguém declarou de onde veio", que é
--      exatamente o estado dos dados da 009 já preenchidos à mão antes desta
--      migração. Inventar `default 'manual'` os re-rotularia retroativamente
--      com uma certeza que não temos.
--
--    • indicadores_atualizado_em — QUANDO o número foi apurado (a leitura do
--      Scholar), não quando a linha foi salva. É o que permite a tela dizer
--      "do seu Google Acadêmico, atualizado em 10/08" — e o que denuncia um h
--      de dois ciclos atrás.
alter table public.ciclo_membros
  add column if not exists scholar_id text
    constraint ciclo_membros_scholar_id
      check (scholar_id is null or scholar_id ~ '^[A-Za-z0-9_-]{8,20}$'),
  add column if not exists indicadores_fonte text
    constraint ciclo_membros_indicadores_fonte
      check (indicadores_fonte is null or indicadores_fonte in ('scholar','openalex','manual')),
  add column if not exists indicadores_atualizado_em timestamptz;


-- ================================ 2. indicadores_cache — 7 dias por perfil ==
--  POR QUE CACHE, E POR QUE NO BANCO
--  A Edge Function é o único caminho até o Scholar, e o Scholar é um serviço de
--  terceiro que não nos deve nada. Sem cache, cada abertura da Tela 1 seria uma
--  leitura — e "abrir a tela de novo" é o gesto mais comum que existe. Com
--  cache de 7 dias são ~209 leituras por semana no PIOR caso (uma por perfil),
--  volume desprezível para eles e para nós. O cache não é otimização: é a
--  contrapartida de quem lê a página de outra pessoa.
--  No BANCO e não em memória porque Edge Function é efêmera: cada invocação
--  pode cair numa instância nova, e um cache de processo teria taxa de acerto
--  próxima de zero justamente no caso que importa (209 pessoas distintas).
--
--  `dados` guarda o PERFIL INTEIRO parseado (as 6 células, nome e afiliação),
--  não só h e citações: a leitura já foi paga: descartar as outras quatro
--  células obrigaria a uma nova leitura no dia em que o CTC pedir o i10 — que é
--  a pergunta óbvia seguinte à Q14.
--
--  A CHAVE É O PERFIL, NÃO A PESSOA. `scholar_id` é a pk e não há FK para
--  `ciclo_membros`: o cache é sobre um documento público lido, não sobre um
--  membro. Dois ciclos, dois membros ou uma reinscrição compartilham a mesma
--  linha — e apagar um membro não pode apagar o cache de um perfil que outra
--  pessoa também consulta.
create table if not exists public.indicadores_cache (
  scholar_id text primary key
    constraint indicadores_cache_formato check (scholar_id ~ '^[A-Za-z0-9_-]{8,20}$'),
  -- Mesmo teto do padrão da casa (relatos.respostas, 009): 8 kB é mais que
  -- qualquer perfil honesto e menos que um abuso.
  dados      jsonb not null
    constraint indicadores_cache_teto check (length(dados::text) <= 8192),
  buscado_em timestamptz not null default now()
);
alter table public.indicadores_cache enable row level security;

-- Sem índice em `buscado_em`, de propósito: o único acesso é
-- `where scholar_id = $1` (a pk), e a expiração é comparada NO CLIENTE da
-- função, sobre a linha já lida. Índice que nenhuma consulta usa é manutenção
-- sem retorno — o mesmo argumento da 009 sobre o GIN.

-- ---- RLS: LER pode qualquer autenticado; ESCREVER, ninguém.
--  A leitura é liberada para `authenticated` porque o conteúdo é um recorte de
--  uma página PÚBLICA do Google Acadêmico — não há nada aqui que já não esteja
--  na web aberta —, e porque um dia a tela pode querer mostrar o número em
--  cache sem acordar a função. Restringir por dono seria teatro: a chave é o id
--  de um perfil público, não a identidade de um membro.
--
--  A ESCRITA NÃO TEM POLICY NENHUMA, e isso é a regra, não o esquecimento: com
--  RLS ligada e nenhuma policy de INSERT/UPDATE, todo INSERT vindo do
--  navegador falha. Quem grava é a Edge Function com a `service_role`, que
--  passa POR CIMA da RLS por definição. Se houvesse policy de escrita para
--  `authenticated`, qualquer pessoa logada poderia PATCHear o cache e plantar
--  o h que quisesse no perfil de um colega — o número entraria na tela dele
--  rotulado "do seu Google Acadêmico", que é o pior rótulo possível para um
--  dado forjado.
drop policy if exists indicadores_cache_read on public.indicadores_cache;
create policy indicadores_cache_read on public.indicadores_cache
  for select to authenticated
  using (true);

-- GRANTS explícitos (não confiar no default privileges do projeto), e SÓ
-- select: sem o grant de insert/update, nem uma policy futura criada por
-- engano abriria a escrita pelo PostgREST.
grant select on public.indicadores_cache to authenticated;
revoke insert, update, delete on public.indicadores_cache from authenticated;
revoke all on public.indicadores_cache from anon;


-- ============================================================ SANIDADE ====
--  Deve devolver 5 linhas, todas com `existe = true` — as 3 colunas novas de
--  `ciclo_membros`, a tabela de cache e a policy de leitura. Rode também a
--  migração DUAS vezes: a segunda passada não pode dar erro (idempotência).
select 'ciclo_membros.scholar_id' as checagem,
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='ciclo_membros'
                  and column_name='scholar_id') as existe
union all
select 'ciclo_membros.indicadores_fonte',
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='ciclo_membros'
                  and column_name='indicadores_fonte')
union all
select 'ciclo_membros.indicadores_atualizado_em',
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='ciclo_membros'
                  and column_name='indicadores_atualizado_em')
union all
select 'tabela indicadores_cache',
       exists (select 1 from information_schema.tables
                where table_schema='public' and table_name='indicadores_cache')
union all
select 'policy indicadores_cache_read',
       exists (select 1 from pg_policies
                where schemaname='public' and tablename='indicadores_cache'
                  and policyname='indicadores_cache_read');

--  E a conferência que importa mais que as cinco de cima — a tabela de cache
--  NÃO pode ter policy de escrita. Deve devolver 0.
--  select count(*) as policies_de_escrita from pg_policies
--    where schemaname='public' and tablename='indicadores_cache' and cmd <> 'SELECT';
