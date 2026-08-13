-- ============================================================================
--  INCT-CONEXAO · 005: Relato anual da rede (Ciclo 1) — coleta, fatos e produção
-- ============================================================================
--  Rode o ARQUIVO INTEIRO de uma vez no SQL Editor. Ordem: 001→002→003→004→005.
--  Roda sobre o banco de PRODUÇÃO da seleção de IC (83 candidaturas homologadas).
--  Nada aqui altera objeto existente: não toca profiles/profiles.role, editais,
--  applications, protocolo_seq, evaluations nem qualquer função do 001..004.
--  Todos os objetos novos são nomes novos (nenhum colide com 001..004).
--
--  O QUE É REUSADO TAL E QUAL DO 001..004
--  --------------------------------------
--   • auth.users, profiles, handle_new_user()  → intocados.
--   • is_admin(), touch_updated_at()           → intocados, reusados.
--   • Configuração em jsonb (padrão `editais`) → espelhado em relatorio_ciclos.
--   • Contador atômico + revoke (padrão 003)   → espelhado, com UMA correção.
--   • Log append-only por trigger SECURITY DEFINER (004) → espelhado.
--   • Bucket privado + storage.foldername(name)[1] = auth.uid() (001) → espelhado.
--
--  ARMADILHA CONHECIDA — is_staff()
--  --------------------------------
--  is_staff() (001) inclui 'avaliador'. Os avaliadores da seleção de IC NÃO
--  podem ler os relatos da rede. **Nenhuma política deste arquivo usa
--  is_staff(), e nenhuma consulta profiles.role.** O papel do relato vive em
--  ciclo_membros e é propriedade do CICLO, não da pessoa.
--
--  AS QUATRO DECISÕES DO DONO QUE ESTE ARQUIVO IMPLEMENTA
--  ------------------------------------------------------
--   1. São 28 Laboratórios Associados (Quadro Geral do PICC). O resumo da
--      proposta diz 26 e o site publica 27 — a divergência é DECLARADA no
--      config (chave `laboratorios`), no precedente de src/content/rede.ts:
--      publicam-se os dois números com a diferença explicada, não se esconde.
--   2. Só o CICLO 1 é criado (2025-05-01 → 2026-04-30). O Ciclo 2 NÃO nasce
--      agora; a seção 17 traz a receita pronta para quando ele for criado.
--   3. Item com data fora do período é ACEITO com a data verdadeira, marcado, e
--      não entra em contagem nenhuma. Ver seção 7 — inclusive o porquê.
--   4. O número do processo do Termo de Outorga NÃO é conhecido:
--      relatorio_ciclos.processo fica NULL e a funcionalidade que depende dele
--      (frase-padrão de agradecimento) fica desabilitada. Não invente número:
--      ele se propaga para a seção de agradecimentos de artigos publicados,
--      onde é permanente e onde o CNPq vai procurar.
-- ============================================================================


-- ================================================== 1. CICLO (configuração) ==
-- Espelha `editais`: o ciclo é CONFIGURAÇÃO. Abrir o relatório do 2º ano =
-- inserir uma linha; nenhum código muda.
--
-- DUAS JANELAS DIFERENTES, e confundi-las é o bug clássico deste tipo de
-- sistema:
--   • periodo_inicio/periodo_fim (date)      = o que é REPORTÁVEL — quando o
--     fato aconteceu. Ciclo 1: 2025-05-01 a 2026-04-30. Já fechou.
--   • abre_em/fecha_em (timestamptz)         = quando se pode ESCREVER. Hoje é
--     2026-08-04, três meses depois do fim do período reportável, e a coleta
--     precisa estar aberta justamente agora.
-- Por isso são quatro colunas e não duas.
create table if not exists public.relatorio_ciclos (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  numero          int  not null unique,               -- 1, 2, … (entra no protocolo)
  titulo          text not null,
  status          text not null default 'rascunho'
                  check (status in ('rascunho','aberto','em_conferencia','consolidado','arquivado')),

  periodo_inicio  date not null,                      -- o que é reportável
  periodo_fim     date not null,
  abre_em         timestamptz not null,               -- quando se pode escrever
  fecha_em        timestamptz not null,

  -- Data de assinatura do Termo de Outorga. Dela derivam os marcos de 24/48
  -- meses e o prazo do REO — NUNCA constante no código. Desconhecida hoje.
  vigencia_inicio date,
  chamada         text not null default '',
  -- DECISÃO 4: desconhecido. NULL enquanto a coordenação não confirmar.
  processo        text,

  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint relatorio_ciclos_periodo  check (periodo_fim > periodo_inicio),
  constraint relatorio_ciclos_janela   check (fecha_em > abre_em),
  -- O processo, quando vier, tem o formato do CNPq (999999/9999-9). O check só
  -- age se a coluna deixar de ser nula: nunca aceita string inventada.
  constraint relatorio_ciclos_processo check (processo is null or processo ~ '^[0-9]{6}/[0-9]{4}-[0-9]$')
);

-- Dois ciclos não podem cobrir a mesma data: senão um mesmo fato teria duas
-- competências e a contagem duplicaria. Bounds fechados nos dois lados ('[]'),
-- porque periodo_fim é o último dia reportável.
do $$
begin
  alter table public.relatorio_ciclos
    add constraint relatorio_ciclos_sem_sobreposicao
    exclude using gist (daterange(periodo_inicio, periodo_fim, '[]') with &&);
exception
  when duplicate_object then null;
  when duplicate_table  then null;
end $$;

drop trigger if exists relatorio_ciclos_touch on public.relatorio_ciclos;
create trigger relatorio_ciclos_touch
  before update on public.relatorio_ciclos
  for each row execute function public.touch_updated_at();


-- ==================================================== 2. LABORATÓRIOS (28) ==
-- Os Laboratórios Associados. DECISÃO 1: são 28.
-- Esta migração NÃO semeia as linhas — os dados vêm de
-- src/content/relato/laboratorios.json, produzido em paralelo. Receita de
-- semeadura na seção 19 deste arquivo.
create table if not exists public.laboratorios (
  id               uuid primary key default gen_random_uuid(),
  ciclo_id         uuid not null references public.relatorio_ciclos (id) on delete cascade,
  sigla            text not null,
  nome             text not null,
  instituicao_nome text not null default '',
  -- ROR id NU (sem https://ror.org/). Nunca texto livre: é dele que saem país e
  -- UF, e é ele que faz o Indicador 3 ser contado e não digitado.
  instituicao_ror  text,
  uf               text,
  municipio_ibge   text,
  eets             text[] not null default '{}',      -- EET-1..EET-8, preenchido pelo CGES
  objetivos        int[]  not null default '{}',      -- 1..43, herdados pelos itens
  lla_user_id      uuid references auth.users (id) on delete set null,
  lla_nome         text not null default '',
  lla_email        text,
  curador_acervo   boolean not null default false,    -- ramifica a ficha de acervo (§4.1)
  ativo            boolean not null default true,
  ordem            int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint laboratorios_sigla_por_ciclo unique (ciclo_id, sigla),
  constraint laboratorios_ror check (instituicao_ror is null or instituicao_ror ~ '^0[a-z0-9]{8}$'),
  constraint laboratorios_uf  check (uf is null or uf ~ '^[A-Z]{2}$'),
  constraint laboratorios_lla_email check (lla_email is null or lla_email = lower(lla_email))
);
create index if not exists laboratorios_ciclo_idx on public.laboratorios (ciclo_id, ativo);
create index if not exists laboratorios_lla_idx   on public.laboratorios (lla_user_id);

drop trigger if exists laboratorios_touch on public.laboratorios;
create trigger laboratorios_touch
  before update on public.laboratorios
  for each row execute function public.touch_updated_at();


-- =========================================== 3. ROSTER (papel é do CICLO) ==
-- ciclo_membros é o denominador do painel de cobertura (§5.5 da especificação)
-- e a origem de TODA autorização deste módulo.
--
-- O papel é propriedade do CICLO, não da pessoa: a mesma pessoa pode ser LLA no
-- Ciclo 1 e não no Ciclo 2. Por isso ele mora aqui, e NÃO em profiles.role —
-- que continua ('admin','avaliador','candidato'), validado em produção com 83
-- candidaturas, e que este arquivo não toca.
--
-- categoria_picc guarda a categoria ORIGINAL do Quadro Geral do PICC (13
-- valores, 209 pessoas) porque é ela que o CNPq conhece; `papel` é o colapso em
-- 6 valores que ramifica tela. Os dois convivem: um é o vocabulário do CNPq, o
-- outro é o do sistema.
create table if not exists public.ciclo_membros (
  id                 uuid primary key default gen_random_uuid(),
  ciclo_id           uuid not null references public.relatorio_ciclos (id) on delete cascade,
  user_id            uuid references auth.users (id) on delete set null,  -- nulo até o 1º acesso
  nome               text not null,
  email              text not null check (email = lower(email)),
  categoria_picc     text check (categoria_picc in (
                       'Pesquisador','Líder de Laboratório Associado','Colaborador',
                       'Pesquisador Estrangeiro','Pesquisador Colaborador','Aluno',
                       'Aluno de Pós-Graduação','Membro do Comitê Gestor','Administrativa',
                       'Técnico','Apoio Técnico','Técnico de Laboratório','Vice-Coordenador')),
  papel              text not null default 'pesquisador'
                     check (papel in ('coordenacao','cges','lla','pesquisador','estudante','tecnico_admin')),
  laboratorio_id     uuid references public.laboratorios (id) on delete set null,
  instituicao_ror    text,
  instituicao_nome   text not null default '',
  uf                 text,
  pais_iso2          text not null default 'BR',
  lattes_id          text,
  orcid              text,
  idioma             text not null default 'pt' check (idioma in ('pt','en')),
  -- Chave OPACA do pré-preenchimento por link (#/meu-ano?m=<token>).
  -- NÃO autentica: a sessão vem do link mágico do Supabase no mesmo clique.
  convite_token      uuid not null default gen_random_uuid(),
  convidado_em       timestamptz,
  primeiro_acesso_em timestamptz,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint ciclo_membros_email_unico unique (ciclo_id, email),
  constraint ciclo_membros_token_unico unique (convite_token),
  constraint ciclo_membros_lattes check (lattes_id is null or lattes_id ~ '^[0-9]{16}$'),
  constraint ciclo_membros_orcid  check (orcid is null or orcid ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$'),
  constraint ciclo_membros_ror    check (instituicao_ror is null or instituicao_ror ~ '^0[a-z0-9]{8}$'),
  constraint ciclo_membros_uf     check (uf is null or uf ~ '^[A-Z]{2}$'),
  constraint ciclo_membros_pais   check (pais_iso2 ~ '^[A-Z]{2}$')
);
create unique index if not exists ciclo_membros_user_unico
  on public.ciclo_membros (ciclo_id, user_id) where user_id is not null;
create index if not exists ciclo_membros_lab_idx   on public.ciclo_membros (ciclo_id, laboratorio_id);
create index if not exists ciclo_membros_papel_idx on public.ciclo_membros (ciclo_id, papel);
create index if not exists ciclo_membros_orcid_idx on public.ciclo_membros (ciclo_id, orcid) where orcid is not null;

drop trigger if exists ciclo_membros_touch on public.ciclo_membros;
create trigger ciclo_membros_touch
  before update on public.ciclo_membros
  for each row execute function public.touch_updated_at();


-- ============================================ 4. HELPERS SECURITY DEFINER ===
-- Mesma técnica do 001 (current_role_of/is_staff/is_admin): a política chama uma
-- função SECURITY DEFINER em vez de fazer subconsulta, porque subconsulta em
-- política sobre tabela que também tem política gera RECURSÃO de RLS.
-- Definidas ANTES de qualquer policy que as use.

-- Papel da pessoa logada NAQUELE ciclo (nulo se não é do roster).
create or replace function public.papel_no_ciclo(p_ciclo uuid)
returns text
language sql security definer stable set search_path = public as $$
  select papel from public.ciclo_membros
   where ciclo_id = p_ciclo and user_id = auth.uid() and ativo
   limit 1;
$$;

-- Coordenação/CGES daquele ciclo. is_admin() entra porque é ele quem semeia o
-- roster antes de existir qualquer coordenação cadastrada (bootstrap).
-- NÃO usa is_staff(): avaliador da seleção de IC não é coordenação do relato.
create or replace function public.is_coordenacao(p_ciclo uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select public.is_admin()
      or coalesce(public.papel_no_ciclo(p_ciclo) in ('coordenacao','cges'), false);
$$;

-- Variante sem ciclo, para onde não há linha (políticas de storage.objects).
create or replace function public.is_coordenacao_geral()
returns boolean
language sql security definer stable set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.ciclo_membros
                  where user_id = auth.uid() and ativo
                    and papel in ('coordenacao','cges'));
$$;

-- É LLA daquele laboratório? (o vínculo é a coluna lla_user_id, não o papel.)
create or replace function public.is_lla_de(p_lab uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.laboratorios l
     where l.id = p_lab
       and (l.lla_user_id = auth.uid()
            or public.is_coordenacao(l.ciclo_id))
  );
$$;

-- Laboratório da pessoa logada naquele ciclo.
create or replace function public.meu_laboratorio(p_ciclo uuid)
returns uuid
language sql security definer stable set search_path = public as $$
  select laboratorio_id from public.ciclo_membros
   where ciclo_id = p_ciclo and user_id = auth.uid() and ativo
   limit 1;
$$;

create or replace function public.sou_membro_do_ciclo(p_ciclo uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.ciclo_membros
                  where ciclo_id = p_ciclo and user_id = auth.uid() and ativo);
$$;

-- Ciclo congelado: consolidado/arquivado não recebe mais escrita de membro.
create or replace function public.ciclo_congelado(p_ciclo uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select status in ('consolidado','arquivado')
                     from public.relatorio_ciclos where id = p_ciclo), true);
$$;

-- ---- competência temporal (a mecânica da DECISÃO 3, ver seção 7) -----------
-- Ciclo cujo PERÍODO REPORTÁVEL contém a data. NULL = nenhum ciclo cobre.
create or replace function public.ciclo_da_data(p_data date)
returns uuid
language sql security definer stable set search_path = public as $$
  select id from public.relatorio_ciclos
   where p_data between periodo_inicio and periodo_fim
   order by numero
   limit 1;
$$;

-- 'no_periodo'    → conta no ciclo devolvido por ciclo_da_data()
-- 'linha_de_base' → anterior ao início do INCT; é "o que já existia" (§5.4)
-- 'posterior'     → posterior ao fim do último ciclo existente; AGUARDA ciclo
--                   futuro. É o caso de tudo que aconteceu entre 2026-05-01 e
--                   hoje (2026-08-04).
create or replace function public.situacao_da_data(p_data date)
returns text
language sql security definer stable set search_path = public as $$
  select case
    when p_data is null then 'sem_data'
    when public.ciclo_da_data(p_data) is not null then 'no_periodo'
    when p_data < (select min(periodo_inicio) from public.relatorio_ciclos) then 'linha_de_base'
    else 'posterior'
  end;
$$;


-- ================================================== 5. RELATOS (submissão) ==
-- Um por (ciclo, pessoa). Espelha `applications`, com UMA diferença essencial:
-- no 001 'rascunho' existe no CHECK mas nenhum caminho de UI o escreve
-- (api.ts grava 'recebida' já no insert). AQUI o rascunho é real e é o estado
-- INICIAL — a pessoa abre, escreve metade, fecha e volta em três semanas.
create table if not exists public.relatos (
  id                    uuid primary key default gen_random_uuid(),
  ciclo_id              uuid not null references public.relatorio_ciclos (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,
  membro_id             uuid references public.ciclo_membros (id) on delete set null,
  protocolo             text unique,                 -- NULL enquanto rascunho (seção 9)
  status                text not null default 'rascunho'
                        check (status in ('rascunho','enviado','em_conferencia','conferido')),
  nada_a_declarar       boolean not null default false,
  narrativas            jsonb   not null default '{}'::jsonb,
  declaracao_veracidade boolean not null default false,
  cessao_imagem         boolean not null default false,
  submitted_at          timestamptz,                 -- 1ª submissão; não muda em edição
  -- ≠ user_id quando a coordenação preenche em nome de alguém. A tela do
  -- titular exibe "Registrado por X em nome de Y" (§6.2 da especificação).
  preenchido_por        uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint relatos_um_por_ciclo unique (ciclo_id, user_id),
  -- Enviar tem efeito jurídico: sem declaração de veracidade não existe envio.
  constraint relatos_veracidade check (status = 'rascunho' or declaracao_veracidade),
  -- A saída de dignidade ("não tive nada a relatar") NUNCA pode desembocar num
  -- campo obrigatório. Por isso o `nada_a_declarar or …`.
  constraint relatos_resultado check (
    status = 'rascunho' or nada_a_declarar
    or char_length(coalesce(narrativas ->> 'resultado_principal', '')) between 20 and 600)
);
create index if not exists relatos_ciclo_status_idx on public.relatos (ciclo_id, status);
create index if not exists relatos_membro_idx       on public.relatos (membro_id);
create index if not exists relatos_narrativas_gin   on public.relatos using gin (narrativas);

drop trigger if exists relatos_touch on public.relatos;
create trigger relatos_touch
  before update on public.relatos
  for each row execute function public.touch_updated_at();


-- ======================================= 6. FATO COLETIVO + ADESÃO (o eixo) =
-- ESTA SEPARAÇÃO É O CORAÇÃO DO DESENHO.
-- Expedição, ação de divulgação, parceria, bolsista e formação são coletivos
-- por natureza. Se cada membro puder CRIAR um registro desses, cinco pessoas na
-- mesma expedição produzem cinco expedições — e a Meta 7 pactua "até 50
-- expedições". Deduplicação por DOI resolve artigo; não resolve nada disso.
-- Logo: o LABORATÓRIO declara o fato UMA vez; o membro apenas ADERE.
create table if not exists public.fatos (
  id                    uuid primary key default gen_random_uuid(),
  ciclo_id              uuid not null references public.relatorio_ciclos (id) on delete cascade,
  laboratorio_id        uuid not null references public.laboratorios (id) on delete cascade,
  tipo                  text not null check (tipo in (
                          'expedicao','acao_sociedade','parceria','formacao','bolsista',
                          'acervo','dado_software','infraestrutura','politica_publica')),
  ocorrido_em           date not null,               -- precisão de mês aceita: dia 1
  titulo                text not null check (char_length(titulo) between 3 and 140),
  payload               jsonb not null default '{}'::jsonb,
  status                text not null default 'proposto'
                        check (status in ('proposto','confirmado','duplicado_de','rejeitado')),
  duplicado_de          uuid references public.fatos (id) on delete set null,
  observacao_revisao    text not null default '',    -- volta ao membro quando rejeitado
  -- DERIVADO por trigger a partir do tipo. Ninguém pergunta a que comitê algo
  -- pertence (§4.2 da especificação).
  comite                text,
  eets                  text[] not null default '{}',
  objetivos             int[]  not null default '{}',
  criado_por            uuid references auth.users (id) on delete set null,
  confirmado_por        uuid references auth.users (id) on delete set null,
  confirmado_em         timestamptz,
  -- competência temporal (seção 7)
  ciclo_competencia_id  uuid references public.relatorio_ciclos (id) on delete set null,
  periodo_situacao      text not null default 'no_periodo'
                        check (periodo_situacao in ('no_periodo','linha_de_base','posterior','sem_data')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint fatos_duplicado_coerente check (
    (status = 'duplicado_de') = (duplicado_de is not null)),
  constraint fatos_nao_duplica_de_si  check (duplicado_de is distinct from id),
  constraint fatos_confirmacao        check (status <> 'confirmado' or confirmado_por is not null),
  constraint fatos_sem_futuro         check (ocorrido_em <= current_date + 1)
);
create index if not exists fatos_lab_idx        on public.fatos (laboratorio_id, tipo);
create index if not exists fatos_competencia_idx on public.fatos (ciclo_competencia_id, tipo)
  where status = 'confirmado';
create index if not exists fatos_fila_idx       on public.fatos (ciclo_id, status);
create index if not exists fatos_payload_gin    on public.fatos using gin (payload);

drop trigger if exists fatos_touch on public.fatos;
create trigger fatos_touch
  before update on public.fatos
  for each row execute function public.touch_updated_at();

-- A ADESÃO. Uma linha, sem payload. É a diferença entre "5 pessoas
-- participaram de 1 expedição" e "5 expedições".
create table if not exists public.fato_participantes (
  id            uuid primary key default gen_random_uuid(),
  fato_id       uuid not null references public.fatos (id) on delete cascade,
  relato_id     uuid references public.relatos (id) on delete set null,
  user_id       uuid not null references auth.users (id) on delete cascade,
  papel_no_fato text,
  aderido_em    timestamptz not null default now(),
  -- Adesão é ÚNICA por (fato, pessoa): garantido pelo schema, não por convenção.
  constraint fato_participantes_unico unique (fato_id, user_id)
);
create index if not exists fato_part_user_idx   on public.fato_participantes (user_id);
create index if not exists fato_part_relato_idx on public.fato_participantes (relato_id);

-- GARANTIA DE SCHEMA nº 1: membro NÃO cria fato coletivo confirmado.
-- Não é convenção de tela nem só política de RLS: é trigger no servidor. Quem
-- não é o LLA daquele laboratório (nem coordenação) tem o status COERGIDO para
-- 'proposto' e não consegue confirmar nem carimbar autoria alheia.
-- Coergir em vez de recusar é deliberado: a proposta do membro é dado útil e vai
-- para a fila do LLA (tela L3), em vez de virar erro e sumir.
create or replace function public.guard_fato_coletivo()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pode_confirmar boolean;
begin
  -- Manutenção pelo SQL Editor / service_role (auth.uid() nulo) não é membro
  -- nem LLA de coisa nenhuma, e cairia em "Só o(a) líder do laboratório
  -- confirma ou altera fatos". O guarda existe para conter o cliente logado.
  if auth.uid() is null then return new; end if;
  pode_confirmar := public.is_lla_de(new.laboratorio_id);

  if tg_op = 'INSERT' then
    new.criado_por := coalesce(auth.uid(), new.criado_por);
    if not pode_confirmar then
      new.status         := 'proposto';   -- coerção, não exceção
      new.confirmado_por := null;
      new.confirmado_em  := null;
    end if;
  else
    -- laboratório e autoria não se transferem
    if new.laboratorio_id is distinct from old.laboratorio_id and not pode_confirmar then
      raise exception 'Fato coletivo não muda de laboratório.';
    end if;
    new.criado_por := old.criado_por;
    if not pode_confirmar then
      -- membro só mexe na PRÓPRIA proposta enquanto ela não foi confirmada
      if old.criado_por is distinct from auth.uid() or old.status <> 'proposto' then
        raise exception 'Só o(a) líder do laboratório confirma ou altera fatos do laboratório.';
      end if;
      new.status         := 'proposto';
      new.confirmado_por := old.confirmado_por;
      new.confirmado_em  := old.confirmado_em;
    end if;
  end if;

  if new.status = 'confirmado' and new.confirmado_por is null then
    new.confirmado_por := auth.uid();
    new.confirmado_em  := coalesce(new.confirmado_em, now());
  end if;
  if new.status <> 'confirmado' then
    new.confirmado_em := case when new.status = 'confirmado' then new.confirmado_em else null end;
  end if;
  return new;
end; $$;

drop trigger if exists fatos_guard_coletivo on public.fatos;
create trigger fatos_guard_coletivo
  before insert or update on public.fatos
  for each row execute function public.guard_fato_coletivo();

-- Comitê derivado do tipo (§2.4). CINTER e CCCO vencem os empates da tabela.
create or replace function public.derivar_comite_do_fato()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.comite := case new.tipo
    when 'expedicao'        then 'CEXPECIAL'
    when 'acao_sociedade'   then 'CDIV'
    when 'parceria'         then 'CINTER'
    when 'acervo'           then 'CCCO'
    when 'politica_publica' then 'CPIE'
    else 'CTC'                      -- formacao, bolsista, dado_software, infraestrutura
  end;
  return new;
end; $$;

drop trigger if exists fatos_comite on public.fatos;
create trigger fatos_comite
  before insert or update of tipo on public.fatos
  for each row execute function public.derivar_comite_do_fato();


-- ================================================= 7. FORA DO PERÍODO ======
--  DECISÃO 3 — POR QUE ACEITAR EM VEZ DE REJEITAR
--  ---------------------------------------------
--  Hoje é 2026-08-04: três meses DEPOIS do fim do período do Ciclo 1
--  (2026-04-30). Um pesquisador vai querer declarar um artigo de junho de 2026.
--  Se o sistema REJEITAR pela data, o caminho de menor resistência para ele não
--  é desistir — é ADULTERAR A DATA para caber na janela. O sistema estaria
--  produzindo, com as próprias mãos, a corrupção exata do dado que o CNPq vai
--  auditar em 2027, e o rastro seria indistinguível de um dado correto.
--
--  Então o item é ACEITO com a data verdadeira, MARCADO, e não entra em
--  contagem nenhuma do Ciclo 1. Não há perda de dado e não há incentivo a
--  mentir na data. A mecânica são duas colunas:
--
--    ciclo_id             = onde foi DECLARADO  (atribuição; sempre o ciclo
--                           corrente da coleta)
--    ciclo_competencia_id = ciclo cujo PERÍODO contém a data do fato
--                           (contagem). NULL enquanto nenhum ciclo cobrir.
--
--  TODA contagem roda por ciclo_competencia_id. Um item de junho/2026 nasce com
--  ciclo_competencia_id NULL e periodo_situacao='posterior': existe, é visível
--  ao dono, está fora de todo agregado, e fica aguardando o Ciclo 2.
--  Quando o Ciclo 2 for criado, UMA chamada reivindica todos eles — seção 17.

create or replace function public.resolver_competencia_fato()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.ciclo_competencia_id := public.ciclo_da_data(new.ocorrido_em);
  new.periodo_situacao     := public.situacao_da_data(new.ocorrido_em);
  return new;
end; $$;

drop trigger if exists fatos_competencia on public.fatos;
create trigger fatos_competencia
  before insert or update of ocorrido_em on public.fatos
  for each row execute function public.resolver_competencia_fato();


-- ============================== 8. PRODUÇÃO (âncora + dedupe entre coautores)
-- producoes é CANÔNICA: uma linha por trabalho na rede inteira. A unicidade
-- vive aqui, nunca no vínculo — é o que impede que 4 coautores da rede virem 4
-- artigos na Tabela A do CNPq.
--
-- NÃO existe coluna `criado_por` aqui, e é de propósito: a tabela é legível por
-- qualquer membro do ciclo (ela é a base do dedupe), então guardar o autor da
-- declaração nela vazaria "quem declarou o quê" para a rede inteira via
-- PostgREST. A atribuição mora em producao_vinculos, que é restrita ao dono,
-- ao LLA e à coordenação.
create table if not exists public.producoes (
  id                    uuid primary key default gen_random_uuid(),
  ciclo_id              uuid not null references public.relatorio_ciclos (id) on delete cascade,
  ancora_tipo           text not null check (ancora_tipo in (
                          'doi','isbn','issn_pagina','inpi','url_com_captura','arquivo_sha256')),
  ancora_valor          text not null check (char_length(ancora_valor) between 3 and 500),
  ancora_resolvida      boolean not null default false,  -- escrito pelo SISTEMA
  tipo                  text not null check (tipo in (
                          'livro','capitulo','artigo_periodico','trabalho_anais_completo',
                          'trabalho_anais_resumo','trabalho_anais_resumo_expandido','traducao',
                          'software_aplicativo','base_dados','patente','desenho_industrial',
                          'marca','cultivar','tecnologia_social','processo_nao_patenteavel',
                          'manual_protocolo','relatorio_tecnico','material_didatico',
                          'curso_formacao','evento_organizado','norma_marco_regulatorio',
                          'acervo_curadoria_colecao','carta_mapa','produto_comunicacao',
                          'producao_artistica','outro')),
  outro_descricao       text not null default '',
  -- ambito NUNCA é perguntado ao respondente (§2.3.1): é inferido do país da
  -- editora e homologado uma vez pela coordenação, com uma regra só.
  ambito                text check (ambito is null or ambito in ('nacional','internacional')),
  ambito_origem         text not null default 'inferido'
                        check (ambito_origem in ('inferido','coordenacao')),
  convidado             boolean not null default false,
  ano                   int check (ano is null or ano between 1990 and 2100),
  publicado_em          date,
  acesso_aberto         boolean,
  -- cache do CSL-JSON no momento da resolução: gerar o relatório em 2027 não
  -- pode depender de reconsultar 800 DOIs em API externa.
  metadados             jsonb not null default '{}'::jsonb,
  -- data usada para competência. Quando só o ANO é conhecido, convenciona-se o
  -- meio do ano (documentado, não inventado caso a caso).
  data_referencia       date generated always as (coalesce(publicado_em, make_date(ano, 7, 1))) stored,
  ciclo_competencia_id  uuid references public.relatorio_ciclos (id) on delete set null,
  periodo_situacao      text not null default 'no_periodo'
                        check (periodo_situacao in ('no_periodo','linha_de_base','posterior','sem_data')),
  primeiro_declarado_em timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint producoes_outro check (tipo <> 'outro' or char_length(outro_descricao) >= 3)
);
-- A DEDUPLICAÇÃO. A normalização vive na CHAVE, nunca na coluna: o valor
-- original digitado é preservado para exibição e conferência.
-- Ela está aqui, e não só no cliente, de propósito: se a normalização morasse
-- em validation.ts, um único caminho de UI que esquecesse de chamá-la
-- (colar-vários, importação, backfill administrativo) produziria duas linhas
-- para o mesmo trabalho e a Tabela A do CNPq contaria dois artigos. Contagem não
-- pode depender de disciplina de cliente.
--   • doi e afins → tira o prefixo do resolvedor (https://doi.org/, doi:) e
--                   baixa a caixa; hífens são preservados (fazem parte do DOI).
--   • isbn        → fica só dígitos e X (o mesmo ISBN com e sem hífen é um).
-- A MESMA expressão aparece em checar_ancora(); se mudar aqui, mude lá.
-- (Expressão literal, e não uma função auxiliar, porque índice sobre função
--  quebra em silêncio se alguém der `create or replace` na função depois.)
create unique index if not exists producoes_ancora_unica
  on public.producoes (
    ciclo_id, ancora_tipo,
    lower(case when ancora_tipo = 'isbn'
               then regexp_replace(ancora_valor, '[^0-9Xx]', '', 'g')
               else regexp_replace(ancora_valor, '^\s*(https?://(dx\.)?doi\.org/|doi:)\s*', '', 'i')
          end));
create index if not exists producoes_competencia_idx on public.producoes (ciclo_competencia_id, tipo);
create index if not exists producoes_metadados_gin   on public.producoes using gin (metadados);

drop trigger if exists producoes_touch on public.producoes;
create trigger producoes_touch
  before update on public.producoes
  for each row execute function public.touch_updated_at();

-- ATENÇÃO ao ler este trigger: `data_referencia` é coluna GENERATED, e coluna
-- gerada é calculada DEPOIS dos triggers BEFORE — dentro daqui ela ainda é
-- NULL. Por isso a data é recalculada com a mesma fórmula, em vez de lida da
-- coluna. Se a fórmula mudar em algum dia, mude nos DOIS lugares.
create or replace function public.resolver_competencia_producao()
returns trigger
language plpgsql security definer set search_path = public as $$
declare d date;
begin
  d := coalesce(new.publicado_em,
                case when new.ano is not null then make_date(new.ano, 7, 1) end);
  new.ciclo_competencia_id := public.ciclo_da_data(d);
  new.periodo_situacao     := public.situacao_da_data(d);
  return new;
end; $$;

drop trigger if exists producoes_competencia on public.producoes;
create trigger producoes_competencia
  before insert or update of publicado_em, ano on public.producoes
  for each row execute function public.resolver_competencia_producao();

-- O VÍNCULO: é aqui que mora a atribuição. A contagem roda na canônica.
create table if not exists public.producao_vinculos (
  id             uuid primary key default gen_random_uuid(),
  producao_id    uuid not null references public.producoes (id) on delete cascade,
  relato_id      uuid not null references public.relatos (id) on delete cascade,
  origem         text not null default 'manual'
                 check (origem in ('orcid','doi_colado','manual','importado')),
  menciona_apoio text not null default 'nao_sei'
                 check (menciona_apoio in ('sim','nao','nao_sei')),
  objetivos      int[] not null default '{}',
  publicavel     boolean not null default true,
  confirmado_em  timestamptz not null default now(),
  constraint producao_vinculos_unico unique (producao_id, relato_id)
);
create index if not exists producao_vinculos_relato_idx on public.producao_vinculos (relato_id);

-- Cache dos coautores devolvidos pelo Crossref. Alimenta o "você é coautor
-- deste?" e mede a colaboração INTERNA da rede, que é o Indicador nº 3.
create table if not exists public.producao_autores (
  id             uuid primary key default gen_random_uuid(),
  producao_id    uuid not null references public.producoes (id) on delete cascade,
  ordem          int not null default 0,
  nome           text not null default '',
  orcid          text,
  is_membro_rede boolean not null default false,
  user_id        uuid references auth.users (id) on delete set null,
  constraint producao_autores_ordem unique (producao_id, ordem),
  constraint producao_autores_orcid check (orcid is null or orcid ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$')
);
create index if not exists producao_autores_orcid_idx on public.producao_autores (orcid) where orcid is not null;

-- RPC do dedupe. Devolve se a âncora já existe e o título — NUNCA o nome de
-- quem declarou. O nome só aparece depois que o segundo confirma a coautoria,
-- e aí vem de producao_autores, não daqui. Isso é vazamento de informação, e se
-- resolve no banco, não com texto de tela.
create or replace function public.checar_ancora(p_ciclo uuid, p_tipo text, p_valor text)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare r record;
begin
  if not public.sou_membro_do_ciclo(p_ciclo) then
    raise exception 'Sem permissão para consultar este ciclo.';
  end if;
  -- MESMA normalização do índice producoes_ancora_unica (e usa o índice).
  select p.id, p.tipo, p.ano, p.metadados ->> 'title' as titulo,
         exists (select 1 from public.producao_vinculos v where v.producao_id = p.id) as ja_declarado
    into r
    from public.producoes p
   where p.ciclo_id = p_ciclo and p.ancora_tipo = p_tipo
     and lower(case when p.ancora_tipo = 'isbn'
                    then regexp_replace(p.ancora_valor, '[^0-9Xx]', '', 'g')
                    else regexp_replace(p.ancora_valor, '^\s*(https?://(dx\.)?doi\.org/|doi:)\s*', '', 'i')
               end)
       = lower(case when p_tipo = 'isbn'
                    then regexp_replace(p_valor, '[^0-9Xx]', '', 'g')
                    else regexp_replace(p_valor, '^\s*(https?://(dx\.)?doi\.org/|doi:)\s*', '', 'i')
               end);
  if not found then
    return jsonb_build_object('existe', false);
  end if;
  return jsonb_build_object(
    'existe', true, 'producao_id', r.id, 'tipo', r.tipo, 'ano', r.ano,
    'titulo', coalesce(r.titulo, ''), 'ja_declarado_por_membro', r.ja_declarado);
end; $$;


-- ============================ 9. PROTOCOLO (padrão do 003, com UMA correção) =
-- Contador atômico por ciclo. RLS ligada e SEM policy = inacessível pela API.
-- É uma TABELA e não um SEQUENCE de propósito: sequence não é transacional, e
-- o trigger de janela (seção 10) roda DEPOIS deste, em ordem alfabética de
-- nome. Com sequence, uma tentativa de envio recusada pela janela deixaria um
-- número queimado; com contador em tabela, o rollback devolve o número. Foi a
-- mesma escolha do 003 e continua valendo aqui.
create table if not exists public.relato_protocolo_seq (
  ciclo_id uuid primary key references public.relatorio_ciclos (id) on delete cascade,
  ultimo   int  not null default 0
);
alter table public.relato_protocolo_seq enable row level security;

-- Mesma técnica do 003: INSERT ... ON CONFLICT DO UPDATE ... RETURNING pega
-- lock de linha, então concorrentes são serializados e é impossível dois
-- receberem o mesmo número. NUNCA count(*)+1 — foi exatamente a corrida que o
-- 003 existe para corrigir (dois candidatos liam o mesmo count no pico de
-- abertura e o segundo INSERT quebrava no UNIQUE).
create or replace function public.reserve_protocolo_relato(p_ciclo uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.relato_protocolo_seq (ciclo_id, ultimo)
  values (p_ciclo, 1)
  on conflict (ciclo_id)
    do update set ultimo = public.relato_protocolo_seq.ultimo + 1
  returning ultimo into n;
  return n;
end; $$;

-- A CORREÇÃO em relação ao 003: lá o protocolo nasce no BEFORE INSERT, o que
-- serve porque a inscrição já nasce 'recebida'. Aqui o INSERT é um rascunho
-- vazio: numerar no insert QUEIMA um número por rascunho abandonado e a
-- numeração oficial fica cheia de buracos que ninguém sabe explicar em
-- auditoria. O número nasce na TRANSIÇÃO para 'enviado'.
-- Formato: CNX-R1-0001.
create or replace function public.set_protocolo_relato()
returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; num int;
begin
  -- protocolo emitido não muda e não some
  if tg_op = 'UPDATE' and old.protocolo is not null then
    new.protocolo    := old.protocolo;
    new.submitted_at := old.submitted_at;
    return new;
  end if;
  if new.status <> 'enviado' or new.protocolo is not null then
    return new;
  end if;
  select numero into num from public.relatorio_ciclos where id = new.ciclo_id;
  n := public.reserve_protocolo_relato(new.ciclo_id);
  new.protocolo    := 'CNX-R' || coalesce(num::text, '0') || '-' || lpad(n::text, 4, '0');
  new.submitted_at := coalesce(new.submitted_at, now());
  return new;
end; $$;

drop trigger if exists relatos_set_protocolo on public.relatos;
create trigger relatos_set_protocolo
  before insert or update on public.relatos
  for each row execute function public.set_protocolo_relato();

-- Mesma lição do 003: revogar de PUBLIC (anon/authenticated herdam de PUBLIC;
-- revogar só deles é inócuo). O trigger roda como owner e segue funcionando.
revoke execute on function public.reserve_protocolo_relato(uuid) from public, anon, authenticated;


-- ================================================== 10. JANELA DE ENVIO =====
-- Análogo ao enforce_edital_window() do 001, com a diferença que a
-- especificação exige: rascunho e edição de item são LIVRES o ano inteiro (é o
-- modelo Researchfish — a pessoa registra o artigo quando ele sai). A janela
-- barra APENAS a transição para 'enviado'.
create or replace function public.enforce_relato_window()
returns trigger
language plpgsql security definer set search_path = public as $$
declare c record; tem_imagem boolean;
begin
  -- Sem sessão (SQL Editor / service_role) a janela não se aplica: é assim que
  -- a coordenação reabre um relato enviado, que é justamente o que a mensagem
  -- de erro logo abaixo manda a pessoa pedir.
  if auth.uid() is null then return new; end if;
  select status, abre_em, fecha_em into c
    from public.relatorio_ciclos where id = new.ciclo_id;

  if public.is_coordenacao(new.ciclo_id) then
    return new;                       -- válvula de "preencher em nome de"
  end if;

  if c.status in ('consolidado','arquivado') then
    raise exception 'Este ciclo já foi consolidado: fale com a coordenação.';
  end if;

  if tg_op = 'UPDATE' and old.status in ('enviado','em_conferencia','conferido')
     and new.status = 'rascunho' then
    raise exception 'Relato já enviado: peça a reabertura à coordenação.';
  end if;

  if new.status = 'enviado' and (tg_op = 'INSERT' or old.status is distinct from 'enviado') then
    if c.status is distinct from 'aberto' or now() < c.abre_em or now() > c.fecha_em then
      raise exception 'Fora da janela de envio deste ciclo (o rascunho continua salvo).';
    end if;
    -- Cessão de imagem é obrigatória APENAS se houver imagem publicável.
    select exists (select 1 from public.relato_arquivos a
                    where a.relato_id = new.id and a.uso = 'imagem_publicavel')
      into tem_imagem;
    if tem_imagem and not new.cessao_imagem then
      raise exception 'Há imagem anexada: é preciso autorizar o uso das imagens para enviar.';
    end if;
  end if;
  return new;
end; $$;

-- ATRIBUIÇÃO (requisito de auditoria do CNPq): no 001, app_owner_update deixa
-- is_admin() reescrever QUALQUER campo da inscrição alheia. Num relato isso
-- apagaria em silêncio o que a pessoa declarou — e o relato é justamente um
-- documento de autoria, assinado com declaração de veracidade. A coordenação
-- move status e preenche em nome de; quando o faz, fica registrado em
-- preenchido_por e no log da seção 11.
create or replace function public.guard_relato_autoria()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'A autoria do relato não pode ser transferida.';
  end if;
  if new.ciclo_id is distinct from old.ciclo_id then
    raise exception 'O relato não muda de ciclo.';
  end if;
  if auth.uid() is not null and auth.uid() is distinct from old.user_id then
    new.preenchido_por := auth.uid();
  end if;
  return new;
end; $$;

drop trigger if exists relatos_window on public.relatos;
create trigger relatos_window
  before insert or update on public.relatos
  for each row execute function public.enforce_relato_window();

drop trigger if exists relatos_guard_autoria on public.relatos;
create trigger relatos_guard_autoria
  before update on public.relatos
  for each row execute function public.guard_relato_autoria();


-- ================================== 11. AUDITORIA (padrão do 004, adaptado) =
-- O 004 grava o payload inteiro a cada gravação. Aqui o payload é o relato
-- inteiro e há autosave: 209 pessoas × dezenas de gravações × ~40 kB estouraria
-- o plano gratuito só de histórico. Então:
--   • toda gravação  → METADADOS (quem, quando, status, campos mudados);
--   • virou 'enviado'→ SNAPSHOT completo + sha256 (é o que vira documento).
-- Inserção EXCLUSIVAMENTE por trigger SECURITY DEFINER: append-only de fato,
-- porque não existe policy de insert/update/delete nesta tabela.
create table if not exists public.relato_eventos (
  id              uuid primary key default gen_random_uuid(),
  ciclo_id        uuid references public.relatorio_ciclos (id) on delete cascade,
  relato_id       uuid references public.relatos (id) on delete cascade,
  entidade        text not null,        -- 'relato' | 'fato' | 'adesao' | 'producao_vinculo'
  entidade_id     uuid not null,
  acao            text not null check (acao in ('insert','update','delete')),
  status          text,
  campos          text[] not null default '{}',
  -- quem GRAVOU. Diferente do dono quando a coordenação preenche por alguém.
  por             uuid,
  snapshot        jsonb,
  snapshot_sha256 text,
  at              timestamptz not null default now()
);
alter table public.relato_eventos enable row level security;
create index if not exists relato_eventos_relato_idx on public.relato_eventos (relato_id, at desc);
create index if not exists relato_eventos_ent_idx    on public.relato_eventos (entidade, entidade_id, at desc);

create or replace function public.log_relato_evento()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec        jsonb;
  ant        jsonb;
  ent        text;
  v_relato   uuid;
  v_ciclo    uuid;
  mudou      text[] := '{}';
  snap       jsonb  := null;
  virou      boolean := false;
begin
  if tg_op = 'DELETE' then rec := to_jsonb(old); else rec := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then ant := to_jsonb(old); end if;

  ent := case tg_table_name
           when 'relatos'            then 'relato'
           when 'fatos'              then 'fato'
           when 'fato_participantes' then 'adesao'
           when 'producao_vinculos'  then 'producao_vinculo'
           else tg_table_name end;

  if ent = 'relato' then
    v_relato := (rec ->> 'id')::uuid;
    v_ciclo  := (rec ->> 'ciclo_id')::uuid;
    virou    := (rec ->> 'status') = 'enviado'
                and (tg_op = 'INSERT' or coalesce(ant ->> 'status','') is distinct from 'enviado');
    if virou then
      snap := rec;
    end if;
  else
    v_relato := nullif(rec ->> 'relato_id', '')::uuid;
    v_ciclo  := nullif(rec ->> 'ciclo_id', '')::uuid;
    snap     := rec;                       -- fato/adesão/vínculo são pequenos
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}')
      into mudou
      from jsonb_object_keys(rec) k
     where (rec -> k) is distinct from (ant -> k)
       and k not in ('updated_at');
  end if;

  insert into public.relato_eventos
    (ciclo_id, relato_id, entidade, entidade_id, acao, status, campos, por,
     snapshot, snapshot_sha256, at)
  values
    (v_ciclo, v_relato, ent, (rec ->> 'id')::uuid, lower(tg_op), rec ->> 'status',
     mudou, auth.uid(), snap,
     case when snap is null then null
          else encode(sha256(convert_to(snap::text, 'UTF8')), 'hex') end,
     now());

  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists relatos_log on public.relatos;
create trigger relatos_log
  after insert or update on public.relatos
  for each row execute function public.log_relato_evento();

drop trigger if exists fatos_log on public.fatos;
create trigger fatos_log
  after insert or update on public.fatos
  for each row execute function public.log_relato_evento();

drop trigger if exists fato_participantes_log on public.fato_participantes;
create trigger fato_participantes_log
  after insert or delete on public.fato_participantes
  for each row execute function public.log_relato_evento();

drop trigger if exists producao_vinculos_log on public.producao_vinculos;
create trigger producao_vinculos_log
  after insert or delete on public.producao_vinculos
  for each row execute function public.log_relato_evento();


-- ======================================== 12. COMPROVAÇÕES (arquivos) =======
-- Espelha application_files SEM o unique(application_id, kind): no 001 é UM
-- arquivo por tipo; um relato tem N comprovações por item. A unicidade vira o
-- caminho no Storage.
create table if not exists public.relato_arquivos (
  id           uuid primary key default gen_random_uuid(),
  relato_id    uuid references public.relatos (id) on delete cascade,
  fato_id      uuid references public.fatos (id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null default '',
  sha256       text,
  mime         text not null default 'application/pdf'
               check (mime in ('application/pdf','image/jpeg','image/png')),
  bytes        int not null default 0 check (bytes >= 0 and bytes <= 1048576),
  uso          text not null default 'comprovante'
               check (uso in ('comprovante','imagem_publicavel')),
  created_at   timestamptz not null default now(),
  constraint relato_arquivos_dono check (num_nonnulls(relato_id, fato_id) = 1),
  constraint relato_arquivos_sha  check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists relato_arquivos_relato_idx on public.relato_arquivos (relato_id);
create index if not exists relato_arquivos_fato_idx   on public.relato_arquivos (fato_id);

-- Teto de 12 arquivos por relato (orçamento de storage do plano gratuito).
create or replace function public.guard_relato_arquivos()
returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.relato_id is null then return new; end if;
  select count(*) into n from public.relato_arquivos where relato_id = new.relato_id;
  if n >= 12 then
    raise exception 'Limite de 12 arquivos por relato atingido.';
  end if;
  return new;
end; $$;

drop trigger if exists relato_arquivos_limite on public.relato_arquivos;
create trigger relato_arquivos_limite
  before insert on public.relato_arquivos
  for each row execute function public.guard_relato_arquivos();


-- ============================================================ 13. RLS ======
alter table public.relatorio_ciclos   enable row level security;
alter table public.laboratorios       enable row level security;
alter table public.ciclo_membros      enable row level security;
alter table public.relatos            enable row level security;
alter table public.fatos              enable row level security;
alter table public.fato_participantes enable row level security;
alter table public.producoes          enable row level security;
alter table public.producao_vinculos  enable row level security;
alter table public.producao_autores   enable row level security;
alter table public.relato_arquivos    enable row level security;

-- ---- ciclos: config traz metas pactuadas com o CNPq → só autenticado.
drop policy if exists ciclos_read on public.relatorio_ciclos;
create policy ciclos_read on public.relatorio_ciclos
  for select to authenticated
  using (status <> 'rascunho' or public.is_coordenacao(id));
-- is_coordenacao_geral() e não is_coordenacao(id), por causa de um ovo-e-galinha
-- real: um ciclo recém-criado ainda não tem roster, logo NINGUÉM é coordenação
-- "dele" — com a versão por ciclo, criar o Ciclo 2 seria impossível para quem
-- não fosse admin do 001.
drop policy if exists ciclos_coord_write on public.relatorio_ciclos;
create policy ciclos_coord_write on public.relatorio_ciclos
  for all to authenticated
  using (public.is_coordenacao_geral()) with check (public.is_coordenacao_geral());

-- ---- laboratórios: todo membro precisa achar o próprio na lista.
drop policy if exists labs_read on public.laboratorios;
create policy labs_read on public.laboratorios
  for select to authenticated
  using (public.sou_membro_do_ciclo(ciclo_id));
drop policy if exists labs_coord_write on public.laboratorios;
create policy labs_coord_write on public.laboratorios
  for all to authenticated
  using (public.is_coordenacao(ciclo_id)) with check (public.is_coordenacao(ciclo_id));

-- ---- roster: eu, meu LLA, a coordenação. Ninguém mais.
drop policy if exists membros_read on public.ciclo_membros;
create policy membros_read on public.ciclo_membros
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_coordenacao(ciclo_id)
    or (laboratorio_id is not null and laboratorio_id = public.meu_laboratorio(ciclo_id))
    or (laboratorio_id is not null and public.is_lla_de(laboratorio_id))
  );
drop policy if exists membros_self_update on public.ciclo_membros;
create policy membros_self_update on public.ciclo_membros
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists membros_coord_write on public.ciclo_membros;
create policy membros_coord_write on public.ciclo_membros
  for all to authenticated
  using (public.is_coordenacao(ciclo_id)) with check (public.is_coordenacao(ciclo_id));

-- O membro confere o cadastro na Tela 1 ("está certo?") e completa o que falta
-- (ORCID, idioma). Ele NÃO reescreve o que o CNPq conhece, não muda de dono e
-- — sobretudo — NÃO mexe no próprio papel. RLS não filtra coluna: isso é
-- trigger.
--
-- POR QUE `papel` É A LINHA MAIS IMPORTANTE DESTE ARQUIVO
-- `is_coordenacao()` lê exatamente `ciclo_membros.papel`. Numa versão anterior
-- deste guarda, `papel` não estava na lista de campos barrados, e a policy
-- `membros_self_update` permite que a pessoa atualize a própria linha. As duas
-- coisas juntas davam escalação de privilégio com UM PATCH do PostgREST:
--   update ciclo_membros set papel = 'coordenacao' where user_id = auth.uid()
-- Qualquer uma das 209 pessoas do roster passaria a ler todos os relatos, o
-- roster inteiro (nome, e-mail, Lattes, ORCID), o log de auditoria e os anexos
-- do bucket — e a reescrever relato alheio já assinado com declaração de
-- veracidade. Se algum dia alguém precisar afrouxar isto, entenda o que está
-- afrouxando.
create or replace function public.guard_membro_self()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Sem sessão de usuário final (trigger interno de 1º acesso, service_role,
  -- importação da coordenação pelo SQL Editor) o guarda não se aplica: ele
  -- existe para conter o MEMBRO logado, não o servidor. Sem esta linha, o
  -- trigger irmão da seção 15 não consegue gravar user_id no primeiro acesso.
  if auth.uid() is null then return new; end if;
  if public.is_coordenacao(new.ciclo_id) then return new; end if;
  if new.email          is distinct from old.email
     or new.user_id     is distinct from old.user_id
     or new.ciclo_id    is distinct from old.ciclo_id
     or new.papel       is distinct from old.papel
     or new.categoria_picc is distinct from old.categoria_picc
     or new.convite_token  is distinct from old.convite_token
     or new.ativo       is distinct from old.ativo then
    raise exception 'Estes campos do cadastro só a coordenação altera.';
  end if;
  -- Laboratório: o membro PREENCHE quando está vazio (o roster pode chegar
  -- incompleto e a Tela 1 pede que ele complete), mas não TROCA o que já está
  -- lá. Trocar daria leitura dos fatos coletivos de qualquer outro laboratório,
  -- porque `meu_laboratorio()` também sai desta coluna. Correção de laboratório
  -- já preenchido passa pela coordenação.
  if old.laboratorio_id is not null
     and new.laboratorio_id is distinct from old.laboratorio_id then
    raise exception 'Para corrigir o laboratório já cadastrado, fale com a coordenação.';
  end if;
  return new;
end; $$;

drop trigger if exists ciclo_membros_guard on public.ciclo_membros;
create trigger ciclo_membros_guard
  before update on public.ciclo_membros
  for each row execute function public.guard_membro_self();

-- ---- relatos: a cadeia membro → LLA → coordenação (p. 37 da proposta).
drop policy if exists relatos_read on public.relatos;
create policy relatos_read on public.relatos
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_coordenacao(ciclo_id)
    or exists (select 1 from public.ciclo_membros m
                where m.id = relatos.membro_id
                  and m.laboratorio_id is not null
                  and public.is_lla_de(m.laboratorio_id))
  );
drop policy if exists relatos_owner_insert on public.relatos;
create policy relatos_owner_insert on public.relatos
  for insert to authenticated
  with check ((user_id = auth.uid() and public.sou_membro_do_ciclo(ciclo_id))
              or public.is_coordenacao(ciclo_id));
drop policy if exists relatos_owner_update on public.relatos;
create policy relatos_owner_update on public.relatos
  for update to authenticated
  using (user_id = auth.uid() or public.is_coordenacao(ciclo_id))
  with check (user_id = auth.uid() or public.is_coordenacao(ciclo_id));
-- Sem policy de DELETE: relato entregue não se apaga pela API. Exclusão por
-- pedido de LGPD é operação manual e registrada da coordenação.

-- ---- fatos: leitura pelo laboratório; escrita pelo LLA. O membro insere
-- proposta (o trigger da seção 6 força status='proposto').
drop policy if exists fatos_read on public.fatos;
create policy fatos_read on public.fatos
  for select to authenticated
  using (
    laboratorio_id = public.meu_laboratorio(ciclo_id)
    or public.is_lla_de(laboratorio_id)
    or public.is_coordenacao(ciclo_id)
  );
drop policy if exists fatos_insert on public.fatos;
create policy fatos_insert on public.fatos
  for insert to authenticated
  with check (
    not public.ciclo_congelado(ciclo_id)
    and (laboratorio_id = public.meu_laboratorio(ciclo_id)
         or public.is_lla_de(laboratorio_id))
  );
drop policy if exists fatos_update on public.fatos;
create policy fatos_update on public.fatos
  for update to authenticated
  using (
    (not public.ciclo_congelado(ciclo_id)
     and (public.is_lla_de(laboratorio_id)
          or (criado_por = auth.uid() and status = 'proposto')))
    or public.is_coordenacao(ciclo_id)
  )
  with check (public.is_lla_de(laboratorio_id)
              or criado_por = auth.uid()
              or public.is_coordenacao(ciclo_id));
drop policy if exists fatos_delete on public.fatos;
create policy fatos_delete on public.fatos
  for delete to authenticated
  using (public.is_lla_de(laboratorio_id) and status in ('proposto','rejeitado'));

-- ---- adesão: eu marco e desmarco a MINHA participação. Ninguém marca por mim
-- (exceto o LLA/coordenação montando a lista da expedição).
drop policy if exists adesao_read on public.fato_participantes;
create policy adesao_read on public.fato_participantes
  for select to authenticated
  using (exists (select 1 from public.fatos f
                  where f.id = fato_id
                    and (f.laboratorio_id = public.meu_laboratorio(f.ciclo_id)
                         or public.is_lla_de(f.laboratorio_id)
                         or public.is_coordenacao(f.ciclo_id))));
drop policy if exists adesao_write on public.fato_participantes;
create policy adesao_write on public.fato_participantes
  for insert to authenticated
  with check (exists (select 1 from public.fatos f
                       where f.id = fato_id
                         and not public.ciclo_congelado(f.ciclo_id)
                         and (
                           (user_id = auth.uid()
                            and f.laboratorio_id = public.meu_laboratorio(f.ciclo_id))
                           or public.is_lla_de(f.laboratorio_id))));
drop policy if exists adesao_delete on public.fato_participantes;
create policy adesao_delete on public.fato_participantes
  for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.fatos f
                     where f.id = fato_id and public.is_lla_de(f.laboratorio_id)));

-- ---- produções: legível por qualquer membro do ciclo — é a base do dedupe.
-- A tabela não tem coluna de declarante justamente por isso (ver seção 8).
drop policy if exists producoes_read on public.producoes;
create policy producoes_read on public.producoes
  for select to authenticated
  using (public.sou_membro_do_ciclo(ciclo_id));
drop policy if exists producoes_insert on public.producoes;
create policy producoes_insert on public.producoes
  for insert to authenticated
  with check (public.sou_membro_do_ciclo(ciclo_id) and not public.ciclo_congelado(ciclo_id));
drop policy if exists producoes_update on public.producoes;
create policy producoes_update on public.producoes
  for update to authenticated
  using (
    public.is_coordenacao(ciclo_id)
    or exists (select 1 from public.producao_vinculos v
               join public.relatos r on r.id = v.relato_id
                where v.producao_id = producoes.id and r.user_id = auth.uid())
  )
  with check (
    public.is_coordenacao(ciclo_id)
    or exists (select 1 from public.producao_vinculos v
               join public.relatos r on r.id = v.relato_id
                where v.producao_id = producoes.id and r.user_id = auth.uid())
  );

-- ---- vínculo: é a atribuição. Só o dono do relato, o LLA dele e a coordenação.
drop policy if exists vinculos_read on public.producao_vinculos;
create policy vinculos_read on public.producao_vinculos
  for select to authenticated
  using (exists (select 1 from public.relatos r
                  where r.id = relato_id
                    and (r.user_id = auth.uid()
                         or public.is_coordenacao(r.ciclo_id)
                         or exists (select 1 from public.ciclo_membros m
                                     where m.id = r.membro_id
                                       and m.laboratorio_id is not null
                                       and public.is_lla_de(m.laboratorio_id)))));
drop policy if exists vinculos_write on public.producao_vinculos;
create policy vinculos_write on public.producao_vinculos
  for all to authenticated
  using (exists (select 1 from public.relatos r
                  where r.id = relato_id
                    and (r.user_id = auth.uid() or public.is_coordenacao(r.ciclo_id))))
  with check (exists (select 1 from public.relatos r
                       where r.id = relato_id
                         and (r.user_id = auth.uid() or public.is_coordenacao(r.ciclo_id))));

-- ---- coautores: metadados bibliográficos públicos, cacheados. Leitura para
-- membro do ciclo; escrita para quem pode escrever a produção.
drop policy if exists autores_read on public.producao_autores;
create policy autores_read on public.producao_autores
  for select to authenticated
  using (exists (select 1 from public.producoes p
                  where p.id = producao_id and public.sou_membro_do_ciclo(p.ciclo_id)));
drop policy if exists autores_write on public.producao_autores;
create policy autores_write on public.producao_autores
  for all to authenticated
  using (exists (select 1 from public.producoes p
                  where p.id = producao_id and public.sou_membro_do_ciclo(p.ciclo_id)))
  with check (exists (select 1 from public.producoes p
                       where p.id = producao_id and public.sou_membro_do_ciclo(p.ciclo_id)));

-- ---- arquivos: seguem o relato ou o fato.
drop policy if exists arquivos_read on public.relato_arquivos;
create policy arquivos_read on public.relato_arquivos
  for select to authenticated
  using (
    exists (select 1 from public.relatos r
             where r.id = relato_id
               and (r.user_id = auth.uid() or public.is_coordenacao(r.ciclo_id)))
    or exists (select 1 from public.fatos f
                where f.id = fato_id
                  and (public.is_lla_de(f.laboratorio_id) or public.is_coordenacao(f.ciclo_id)))
  );
drop policy if exists arquivos_write on public.relato_arquivos;
create policy arquivos_write on public.relato_arquivos
  for all to authenticated
  using (
    exists (select 1 from public.relatos r where r.id = relato_id and r.user_id = auth.uid())
    or exists (select 1 from public.fatos f where f.id = fato_id and public.is_lla_de(f.laboratorio_id))
  )
  with check (
    exists (select 1 from public.relatos r where r.id = relato_id and r.user_id = auth.uid())
    or exists (select 1 from public.fatos f where f.id = fato_id and public.is_lla_de(f.laboratorio_id))
  );

-- ---- eventos: o declarante tem direito de ver o próprio histórico ("o que eu
-- declarei e quando" é a prova dele); a coordenação vê tudo. Ninguém insere,
-- atualiza ou apaga — não há policy para isso, e o trigger é SECURITY DEFINER.
drop policy if exists eventos_read on public.relato_eventos;
create policy eventos_read on public.relato_eventos
  for select to authenticated
  using (
    public.is_coordenacao(ciclo_id)
    or exists (select 1 from public.relatos r where r.id = relato_id and r.user_id = auth.uid())
  );

-- ---- GRANTS explícitos (não confiar no default privileges do projeto).
grant select, insert, update on public.relatos, public.fatos, public.producoes,
      public.producao_autores, public.ciclo_membros to authenticated;
grant select, insert, update, delete on public.fato_participantes,
      public.producao_vinculos, public.relato_arquivos to authenticated;
grant delete on public.fatos to authenticated;
grant select on public.relatorio_ciclos, public.laboratorios, public.relato_eventos to authenticated;
-- Escrita de ciclo e de laboratório: INSERT e UPDATE (governados por RLS, só
-- coordenação), NUNCA DELETE. `relatorio_ciclos` é pai de tudo com ON DELETE
-- CASCADE: um único `delete from relatorio_ciclos` levaria junto relatos,
-- roster, laboratórios, fatos, produções e o próprio log de auditoria. Aposentar
-- um ciclo é `status = 'arquivado'`, não apagar. Exclusão de verdade só por
-- service_role, fora do alcance do navegador.
grant insert, update on public.relatorio_ciclos, public.laboratorios to authenticated;
revoke delete, truncate on public.relatorio_ciclos, public.laboratorios from authenticated;
-- O contador de protocolo não é tocável por cliente nenhum (RLS ligada e sem
-- policy já bastaria; o revoke é o cinto por cima do suspensório).
revoke all on public.relato_protocolo_seq from anon, authenticated;
-- Nada deste módulo é legível por anônimo. O site público continua lendo
-- `editais` normalmente — esta linha não afeta o 001.
revoke all on public.relatorio_ciclos, public.laboratorios, public.ciclo_membros,
      public.relatos, public.fatos, public.fato_participantes, public.producoes,
      public.producao_vinculos, public.producao_autores, public.relato_arquivos,
      public.relato_eventos from anon;


-- ========================================================= 14. STORAGE =====
-- Bucket novo, privado, no padrão do 001 (pasta = auth.uid()).
-- Caminho: <auth.uid()>/<ciclo_slug>/<item_id>/<n>.<ext>
-- Diferenças em relação a `inscricoes`: aceita imagem (comprovação de campo é
-- foto) e o teto é 1 MB por arquivo, com compressão no cliente — o orçamento é
-- 209 pessoas × até 12 arquivos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('relatos', 'relatos', false, 1048576,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nome com `_bucket_` para não confundir com as policies homônimas da TABELA
-- public.relatos: são objetos diferentes em tabelas diferentes, e quem for
-- depurar RLS às 23h agradece.
drop policy if exists relatos_bucket_write on storage.objects;
create policy relatos_bucket_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'relatos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists relatos_bucket_update on storage.objects;
create policy relatos_bucket_update on storage.objects
  for update to authenticated
  using (bucket_id = 'relatos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists relatos_bucket_delete on storage.objects;
create policy relatos_bucket_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'relatos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Leitura: o dono e a coordenação. O LLA vê a FICHA da comprovação (linha em
-- relato_arquivos), não o binário — o caminho no Storage não carrega o
-- laboratório, e inferir isso por prefixo seria adivinhação. Se a conferência
-- exigir o arquivo, a coordenação gera URL assinada.
drop policy if exists relatos_bucket_read on storage.objects;
create policy relatos_bucket_read on storage.objects
  for select to authenticated
  using (bucket_id = 'relatos'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or public.is_coordenacao_geral()));


-- =============================================== 15. VÍNCULO NO 1º ACESSO ==
-- O roster nasce ANTES de qualquer login (209 linhas importadas da seção EQUIPE
-- da proposta). Quando a pessoa entra pelo link mágico, casa-se lower(email) e
-- gravam-se user_id + primeiro_acesso_em — é o mesmo mecanismo do
-- staff_allowlist, mas em trigger IRMÃO: handle_new_user() (001/002) NÃO é
-- tocada, porque ela está validada em produção e reescrevê-la para acrescentar
-- comportamento seria mexer no caminho de login de todo mundo.
create or replace function public.vincular_membro_do_ciclo()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.ciclo_membros
     set user_id            = new.id,
         primeiro_acesso_em = coalesce(primeiro_acesso_em, now())
   where lower(email) = lower(new.email)
     and user_id is null;
  return new;
end; $$;

drop trigger if exists on_auth_user_created_relato on auth.users;
create trigger on_auth_user_created_relato
  after insert on auth.users
  for each row execute function public.vincular_membro_do_ciclo();

-- Quem JÁ tem conta (por exemplo, quem participou da seleção de IC) não passa
-- por INSERT em auth.users. Este backfill é idempotente e pode ser repetido
-- depois de cada importação de roster.
create or replace function public.vincular_membros_existentes()
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- `auth.uid()` é NULO no SQL Editor do Supabase e em qualquer conexão
  -- service_role — que é exatamente de onde este backfill é executado, conforme
  -- a receita da seção 19. Sem esta guarda, a função falha com "Só administrador
  -- executa o backfill" justamente na mão de quem tem mais poder que um
  -- administrador. Sem sessão = servidor = autorizado; com sessão, exige admin.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Só administrador executa o backfill de vínculo.';
  end if;
  with casados as (
    update public.ciclo_membros m
       set user_id            = u.id,
           primeiro_acesso_em = coalesce(m.primeiro_acesso_em, now())
      from auth.users u
     where m.user_id is null and lower(u.email) = m.email
    returning 1)
  select count(*) into n from casados;
  return n;
end; $$;


-- ============================================================ 16. VIEWS ====
-- Views, nunca colunas: número que se digita é número que diverge.
-- security_invoker = true (PG15+) é OBRIGATÓRIO: sem ele a view roda com os
-- direitos do DONO e devolve a rede inteira para qualquer autenticado,
-- furando toda a RLS acima.

-- A saída mais importante do ciclo (§5.5): sem ela, um número baixo é ambíguo
-- entre baixa produção e baixa resposta.
create or replace view public.v_cobertura with (security_invoker = true) as
select m.ciclo_id,
       m.laboratorio_id,
       count(*)                                                      as convidados,
       count(*) filter (where m.primeiro_acesso_em is not null)       as entraram,
       count(*) filter (where r.status in ('enviado','em_conferencia','conferido')) as enviaram,
       count(*) filter (where r.nada_a_declarar)                      as nada_a_declarar,
       count(*) filter (where r.id is null)                           as silenciosos
  from public.ciclo_membros m
  left join public.relatos r on r.membro_id = m.id
 where m.ativo
 group by m.ciclo_id, m.laboratorio_id;

-- Tabela A do CNPq. Conta na CANÔNICA (uma linha por trabalho), com pelo menos
-- um vínculo declarado, e SÓ o que tem competência no ciclo.
create or replace view public.v_producao_por_tipo with (security_invoker = true) as
select p.ciclo_competencia_id as ciclo_id, p.tipo, p.ambito,
       count(*)                                          as itens,
       count(*) filter (where p.ancora_resolvida)        as com_ancora_resolvida
  from public.producoes p
 where p.ciclo_competencia_id is not null
   and exists (select 1 from public.producao_vinculos v where v.producao_id = p.id)
 group by p.ciclo_competencia_id, p.tipo, p.ambito;

-- Fatos coletivos confirmados, por tipo. Alimenta Metas 3/7/23 e os
-- Indicadores 4 e 5 — uma expedição conta UMA vez, com N participantes.
create or replace view public.v_fatos_por_tipo with (security_invoker = true) as
select f.ciclo_competencia_id as ciclo_id, f.tipo, f.comite,
       count(*)                                     as itens,
       count(distinct f.laboratorio_id)             as laboratorios,
       coalesce(sum((f.payload ->> 'pessoas_alcancadas')::int)
                filter (where f.payload ? 'pessoas_alcancadas'), 0) as pessoas_alcancadas_estimado,
       (select count(*) from public.fato_participantes fp
         where fp.fato_id in (select id from public.fatos g
                               where g.tipo = f.tipo
                                 and g.ciclo_competencia_id is not distinct from f.ciclo_competencia_id
                                 and g.status = 'confirmado')) as adesoes
  from public.fatos f
 where f.status = 'confirmado' and f.ciclo_competencia_id is not null
 group by f.ciclo_competencia_id, f.tipo, f.comite;

-- Indicador 3: instituições e países contados a partir do ROR declarado —
-- ninguém digita "13 países". Contando por baixo, o número apurado tende a vir
-- MENOR que o do resumo da proposta; a diferença se explica, não se maquia.
create or replace view public.v_rede_instituicoes with (security_invoker = true) as
select ciclo_id, instituicao_ror, pais_iso2, uf, count(*) as pessoas, 'roster' as origem
  from public.ciclo_membros
 where ativo and instituicao_ror is not null
 group by ciclo_id, instituicao_ror, pais_iso2, uf
union all
select f.ciclo_competencia_id, f.payload ->> 'ror_id',
       coalesce(f.payload ->> 'pais_iso2', 'BR'), null, count(*), 'parceria'
  from public.fatos f
 where f.tipo = 'parceria' and f.status = 'confirmado'
   and f.ciclo_competencia_id is not null
   and f.payload ? 'ror_id'
 group by 1, 2, 3;

-- A FILA DA DECISÃO 3: o que foi declarado com data verdadeira e está fora de
-- qualquer período. Não entra em contagem; espera o próximo ciclo (seção 17).
create or replace view public.v_itens_fora_do_periodo with (security_invoker = true) as
select 'producao'::text as entidade, p.id, p.ciclo_id, p.data_referencia as data,
       p.periodo_situacao, p.tipo::text as tipo, left(coalesce(p.metadados ->> 'title',''), 140) as titulo
  from public.producoes p
 where p.ciclo_competencia_id is null
union all
select 'fato', f.id, f.ciclo_id, f.ocorrido_em, f.periodo_situacao, f.tipo, f.titulo
  from public.fatos f
 where f.ciclo_competencia_id is null;

grant select on public.v_cobertura, public.v_producao_por_tipo, public.v_fatos_por_tipo,
      public.v_rede_instituicoes, public.v_itens_fora_do_periodo to authenticated;


-- ============================= 17. REIVINDICAÇÃO PELO CICLO SEGUINTE =======
-- A OUTRA METADE DA DECISÃO 3. Criar o Ciclo 2 (quando a coordenação decidir,
-- NÃO agora) e rodar UMA chamada: tudo que estava esperando entra na contagem
-- do ciclo novo, com a data verdadeira que a pessoa declarou lá em 2026.
--
--   insert into public.relatorio_ciclos
--     (slug, numero, titulo, status, periodo_inicio, periodo_fim, abre_em, fecha_em, chamada, config)
--   values ('ciclo-2', 2, 'Relato Anual INCT-CONEXAO — Ciclo 2 (2º ano)', 'aberto',
--           '2026-05-01', '2027-04-30', now(), '2027-06-30T23:59:59-04:00',
--           'MCTI/CNPq/SECTICS/MS/CAPES/FAPs nº 46/2024', '{}'::jsonb);
--   select * from public.reivindicar_itens_do_ciclo(
--            (select id from public.relatorio_ciclos where slug = 'ciclo-2'));
create or replace function public.reivindicar_itens_do_ciclo(p_ciclo uuid)
returns table (tabela text, itens bigint)
language plpgsql security definer set search_path = public as $$
begin
  -- is_coordenacao_geral() pelo mesmo ovo-e-galinha da policy dos ciclos: quem
  -- reivindica para o Ciclo 2 é a coordenação do Ciclo 1, que ainda não está no
  -- roster do 2.
  -- Idem ao backfill: no SQL Editor auth.uid() é nulo. Sem sessão = servidor.
  if auth.uid() is not null
     and not (public.is_coordenacao(p_ciclo) or public.is_coordenacao_geral()) then
    raise exception 'Só a coordenação reivindica itens para um ciclo.';
  end if;
  return query
  with per as (
    select periodo_inicio, periodo_fim from public.relatorio_ciclos where id = p_ciclo
  ), p as (
    update public.producoes s
       set ciclo_competencia_id = p_ciclo, periodo_situacao = 'no_periodo'
      from per
     where s.ciclo_competencia_id is null
       and s.data_referencia between per.periodo_inicio and per.periodo_fim
    returning 1
  ), f as (
    update public.fatos s
       set ciclo_competencia_id = p_ciclo, periodo_situacao = 'no_periodo'
      from per
     where s.ciclo_competencia_id is null
       and s.ocorrido_em between per.periodo_inicio and per.periodo_fim
    returning 1
  )
  select 'producoes'::text, count(*) from p
  union all
  select 'fatos'::text,     count(*) from f;
end; $$;

revoke execute on function public.reivindicar_itens_do_ciclo(uuid) from public, anon;
grant  execute on function public.reivindicar_itens_do_ciclo(uuid) to authenticated;


-- ================================================ 18. SEED — SÓ O CICLO 1 ==
--  DECISÃO 2: uma linha só. O Ciclo 2 NÃO nasce agora (receita na seção 17).
--
--  status = 'rascunho' de propósito: enquanto a coordenação não revisar o
--  config e disparar os convites, nenhum membro enxerga o ciclo (policy
--  ciclos_read). ABRIR A COLETA = UMA linha:
--      update public.relatorio_ciclos set status = 'aberto' where slug = 'ciclo-1';
--
--  O QUE VAI NO config, E POR QUÊ SÓ A ESPINHA
--  -------------------------------------------
--  src/content/relato/proposta-inct-2024.json tem 92 kB. Semear os 92 kB aqui
--  dentro seria: (a) uma migração ilegível, que ninguém revisa de fato e cujo
--  diff é inútil; (b) uma SEGUNDA cópia de um arquivo que já está versionado em
--  git, livre para divergir em silêncio; (c) prosa (43 objetivos com texto
--  integral, 26 descrições de meta) que NENHUMA consulta do banco lê.
--  Então a divisão é explícita e verificável:
--     • BANCO  = identificadores, ligações e números pactuados — o que o SQL
--                agrega, o que a RLS protege e o que a tela do LLA compara.
--     • GIT    = a prosa (textos das metas, dos objetivos e dos indicadores),
--                carregada pelo cliente do próprio bundle.
--  O sha256 do arquivo-fonte fica gravado abaixo: se alguém editar a proposta
--  extraída sem reemitir a espinha, dá para provar a divergência em 1 consulta.
--
--  As 26 metas viram {n, objetivos, progresso, pactuados[{chave,oQue,min,max}]}.
--  A `chave` (M07.3) é o numero_pactuado_key por onde a execução é somada.
--  Os objetivos 1..5 (biometeorologia/SIMBAM) NÃO pertencem a meta nenhuma —
--  estão em `objetivos_sem_meta`. É por isso que a navegação nunca pode ser
--  organizada por metas: perderia o eixo inteiro no ano em que ele é cobrado
--  (Indicador nº 1, de 1º ano).
insert into public.relatorio_ciclos
  (slug, numero, titulo, status, periodo_inicio, periodo_fim, abre_em, fecha_em,
   vigencia_inicio, chamada, processo, config)
values (
  'ciclo-1', 1,
  'Relato Anual INCT-CONEXAO — Ciclo 1 (1º ano do projeto)',
  'rascunho',
  '2025-05-01',                                  -- período reportável: início
  '2026-04-30',                                  -- período reportável: fim (já passou)
  '2026-08-01T00:00:00-04:00',                   -- janela de ENVIO: abre
  '2026-12-31T23:59:59-04:00',                   -- janela de ENVIO: fecha
  null,                                          -- vigencia_inicio: Termo de Outorga (§8.2) — desconhecida
  'MCTI/CNPq/SECTICS/MS/CAPES/FAPs nº 46/2024',
  null,                                          -- DECISÃO 4: processo desconhecido, fica NULO
  $json$
{
  "schema": "inct-relato/1",
  "fonte": {
    "arquivo": "src/content/relato/proposta-inct-2024.json",
    "sha256": "02e8e0ed411765f9d631c00f5cf22accd1eeb4f4f0f5e4a40637811b27110412",
    "bytes": 92410,
    "nota": "Espinha: ids, ligacoes e numeros pactuados. A prosa (textos das 26 metas, dos 43 objetivos e dos 24 indicadores) fica no arquivo versionado em git e e carregada pelo cliente. O sha256 acima prova se as duas versoes divergiram."
  },
  "aviso_ano_1": "Nenhuma das 26 metas tem marco pactuado no 1o ano: os marcos sao de 2o, 4o e 5o ano. O Ciclo 1 mede LINHA DE BASE e ANDAMENTO. Todo percentual exibido e projecao informativa contra o marco do 2o ano, nunca cumprimento de meta.",
  "laboratorios": {
    "oficial": 28,
    "fonte_oficial": "Quadro Geral do PICC (categoria 'Lider de Laboratorio Associado')",
    "divergencias": {"resumo_da_proposta":26,"publicado_no_site_rede_ts":27},
    "nota": "Decisao do dono: 28. Os outros numeros nao sao escondidos — sao declarados aqui e explicados na pagina, no mesmo precedente de src/content/rede.ts (81 catalogadas x 86 na proposta)."
  },
  "papeis": ["coordenacao","cges","lla","pesquisador","estudante","tecnico_admin"],
  "categorias_picc": [
    {"categoria":"Pesquisador","quantidade":74},
    {"categoria":"Líder de Laboratório Associado","quantidade":28},
    {"categoria":"Colaborador","quantidade":23},
    {"categoria":"Pesquisador Estrangeiro","quantidade":22},
    {"categoria":"Pesquisador Colaborador","quantidade":21},
    {"categoria":"Aluno","quantidade":13},
    {"categoria":"Aluno de Pós-Graduação","quantidade":9},
    {"categoria":"Membro do Comitê Gestor","quantidade":8},
    {"categoria":"Administrativa","quantidade":5},
    {"categoria":"Técnico","quantidade":3},
    {"categoria":"Apoio Técnico","quantidade":1},
    {"categoria":"Técnico de Laboratório","quantidade":1},
    {"categoria":"Vice-Coordenador","quantidade":1}
  ],
  "categorias_picc_total": 209,
  "comites": [
    {"sigla":"CEXPECIAL","nome":"Comitê de Expedições Científicas na Amazônia Legal"},
    {"sigla":"CCCO","nome":"Comitê de Clima e Comunidades Originárias"},
    {"sigla":"CTC","nome":"Comitê Técnico-Científico"},
    {"sigla":"CDIV","nome":"Comitê de Divulgação e Comunicação Científica"},
    {"sigla":"CPIE","nome":"Comitê de Políticas Públicas, Inovação e Empreendedorismo"},
    {"sigla":"CINTER","nome":"Comitê de Internacionalização"}
  ],
  "eets": [
    {
      "codigo": "EET-1",
      "titulo": "Investigação, monitoramento e análise das interações entre o clima, o meio ambiente e a sociedade e seus impactos sobre a saúde única da população na Amazônia Legal"
    },
    {
      "codigo": "EET-2",
      "titulo": "Levantamentos e Análises de dados Climáticos, Socioterritoriais, Etnobotânicos, Etnoecológicos, Ecotoxicológicos e Epidemiológicos com potencial Diagnóstico Situacional da Amazônia Legal"
    },
    {
      "codigo": "EET-3",
      "titulo": "Estudo da Biodiversidade, Bioprospecção e Biotecnologia de Venenos/Toxinas, Plantas Medicinais e Biomoléculas de Interesse presentes no Bioma Amazônico"
    },
    {
      "codigo": "EET-4",
      "titulo": "Estimulo da Bioeconomia, Empreendedorismo, Inovação e Políticas Públicas em CT&I aplicadas aos arranjos ecoprodutivos locais (AEPL) de Plantas Medicinais e Toxinas na Amazônia"
    },
    {
      "codigo": "EET-5",
      "titulo": "Bioinformática e Tecnologias de Saúde Pública de Precisão (SPP) Aplicadas ao Enfrentamento dos Acidentes com Animais Peçonhentos/Venenosos e Mudanças Climáticas"
    },
    {
      "codigo": "EET-6",
      "titulo": "Biologia Estrutural, Química Medicinal, Bioensaios e Ensaios in vitro e in silico aplicados às Plantas Medicinais, Toxinas e Biomoléculas"
    },
    {
      "codigo": "EET-7",
      "titulo": "Formação de Pessoas, Redes de Pesquisa e Divulgação Científica na Amazônia Legal fortalecendo as áreas de Biotecnologia, Biodiversidade, Biometeorologia e Bioeconomia"
    },
    {
      "codigo": "EET-8",
      "titulo": "Ações Estratégicas de Políticas Informadas por Evidências e de Educação Ambiental, Científica e em Saúde junto às Comunidades Originárias e Sociedade Amazônica"
    }
  ],
  "objetivos": [
    {"n":1,"missao":"Pesquisa"},
    {"n":2,"missao":"Pesquisa"},
    {"n":3,"missao":"Pesquisa"},
    {"n":4,"missao":"Pesquisa"},
    {"n":5,"missao":"Pesquisa"},
    {"n":6,"missao":"Pesquisa"},
    {"n":7,"missao":"Pesquisa"},
    {"n":8,"missao":"Pesquisa"},
    {"n":9,"missao":"Pesquisa"},
    {"n":10,"missao":"Pesquisa"},
    {"n":11,"missao":"Pesquisa"},
    {"n":12,"missao":"Pesquisa"},
    {"n":13,"missao":"Pesquisa"},
    {"n":14,"missao":"Pesquisa"},
    {"n":15,"missao":"Pesquisa"},
    {"n":16,"missao":"Transferência de Conhecimentos para a Sociedade"},
    {"n":17,"missao":"Transferência de Conhecimentos para a Sociedade"},
    {"n":18,"missao":"Pesquisa"},
    {"n":19,"missao":"Pesquisa"},
    {"n":20,"missao":"Pesquisa"},
    {"n":21,"missao":"Pesquisa"},
    {"n":22,"missao":"Pesquisa"},
    {"n":23,"missao":"Pesquisa"},
    {"n":24,"missao":"Pesquisa"},
    {"n":25,"missao":"Transferência de Conhecimento para o Setor empresarial e/ou para o Setor Público"},
    {"n":26,"missao":"Pesquisa"},
    {"n":27,"missao":"Pesquisa"},
    {"n":28,"missao":"Pesquisa"},
    {"n":29,"missao":"Pesquisa"},
    {"n":30,"missao":"Transferência de Conhecimento para o Setor empresarial e/ou para o Setor Público"},
    {"n":31,"missao":"Transferência de Conhecimentos para a Sociedade"},
    {"n":32,"missao":"Transferência de Conhecimentos para a Sociedade"},
    {"n":33,"missao":"Transferência de Conhecimento para o Setor empresarial e/ou para o Setor Público"},
    {"n":34,"missao":"Formação de Recursos Humanos"},
    {"n":35,"missao":"Divulgação científica e popularização da ciência"},
    {"n":36,"missao":"Divulgação científica e popularização da ciência"},
    {"n":37,"missao":"Transferência de Conhecimento para o Setor empresarial e/ou para o Setor Público"},
    {"n":38,"missao":"Transferência de Conhecimento para o Setor empresarial e/ou para o Setor Público"},
    {"n":39,"missao":"Formação de Recursos Humanos"},
    {"n":40,"missao":"Internacionalização"},
    {"n":41,"missao":"Transferência de Conhecimento para o Setor empresarial e/ou para o Setor Público"},
    {"n":42,"missao":"Divulgação científica e popularização da ciência"},
    {"n":43,"missao":"Transferência de Conhecimentos para a Sociedade"}
  ],
  "objetivos_sem_meta": [1,2,3,4,5],
  "metas": [
    {
      "n": 1,
      "objetivos": [9,38,39,40,41],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {
          "chave": "M01.1",
          "oQue": "caracterização analítica espaço-temporal das condições biometeorológicas da Amazônia Legal",
          "min": 1,
          "max": 1,
          "unidade": "caracterização"
        }
      ]
    },
    {
      "n": 2,
      "objetivos": [38,39,40,41,43],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {
          "chave": "M02.1",
          "oQue": "mapeamento da incidência de doenças cardiovasculares, respiratórias (DCNTs) e DTNs",
          "min": 1,
          "max": 1,
          "unidade": "mapeamento"
        }
      ]
    },
    {
      "n": 3,
      "objetivos": [38,40,41,43],
      "progresso": [{"prazo":"2º ano","percentual":"60%"},{"prazo":"4º ano","percentual":"100%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M03.1","oQue":"estações de qualidade do ar instaladas","min":8,"max":8,"unidade":"estação"},
        {"chave":"M03.2","oQue":"estações meteorológicas instaladas","min":14,"max":14,"unidade":"estação"}
      ]
    },
    {
      "n": 4,
      "objetivos": [37,38,39,40,41,43],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [{"chave":"M04.1","oQue":"modelo preditivo da interação clima e saúde humana implementado e validado","min":1,"max":1,"unidade":"modelo"}]
    },
    {
      "n": 5,
      "objetivos": [6,38,39,40,41,42,43],
      "progresso": [{"prazo":"2º ano","percentual":"20%"},{"prazo":"4º ano","percentual":"80%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M05.1","oQue":"plataforma de bioprognose desenvolvida","min":1,"max":1,"unidade":"plataforma"},
        {"chave":"M05.2","oQue":"usuários alcançados pela plataforma","min":1000,"max":null,"unidade":"usuário"}
      ]
    },
    {
      "n": 6,
      "objetivos": [7],
      "progresso": [{"prazo":"2º ano","percentual":"45%"},{"prazo":"4º ano","percentual":"90%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M06.1","oQue":"cadastros realizados","min":4,"max":9,"unidade":"cadastro"},
        {"chave":"M06.2","oQue":"autorizações solicitadas (SISBIO, CEP, CEUA, SISGEN, FUNAI)","min":4,"max":9,"unidade":"autorização"},
        {"chave":"M06.3","oQue":"banco amazônico de material genético criado","min":1,"max":1,"unidade":"banco"}
      ]
    },
    {
      "n": 7,
      "objetivos": [11,12,13,14,15],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M07.1","oQue":"expedições científicas realizadas","min":null,"max":50,"unidade":"expedição"},
        {"chave":"M07.2","oQue":"comunidades tradicionais visitadas","min":null,"max":10,"unidade":"comunidade"},
        {"chave":"M07.3","oQue":"Unidades de Conservação (UC) acessadas","min":3,"max":6,"unidade":"UC"},
        {"chave":"M07.4","oQue":"inquéritos/questionários socioterritoriais e epidemiológicos aplicados","min":1000,"max":1000,"unidade":"inquérito"},
        {"chave":"M07.5","oQue":"conhecimentos tradicionais identificados","min":18,"max":36,"unidade":"conhecimento"}
      ]
    },
    {
      "n": 8,
      "objetivos": [7,8,12,14,16,18,30,33],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M08.1","oQue":"espécies de animais peçonhentos com limites taxonômicos determinados","min":4,"max":10,"unidade":"espécie"},
        {"chave":"M08.2","oQue":"análises genômicas realizadas","min":2,"max":5,"unidade":"análise"},
        {"chave":"M08.3","oQue":"Modelos de Distribuição Dinâmicos (MDD) mensais gerados","min":1,"max":2,"unidade":"modelo"}
      ]
    },
    {
      "n": 9,
      "objetivos": [7,11,12,16,17,31,32,35,36,37,42],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M09.1","oQue":"lideranças comunitárias contatadas","min":6,"max":12,"unidade":"liderança"},
        {"chave":"M09.2","oQue":"lideranças governamentais contatadas","min":2,"max":4,"unidade":"liderança"},
        {"chave":"M09.3","oQue":"boas práticas de detecção/evitação documentadas","min":6,"max":10,"unidade":"boa prática"},
        {"chave":"M09.4","oQue":"comunidades locais com usos medicinais/rituais/culinários documentados","min":6,"max":12,"unidade":"comunidade"}
      ]
    },
    {
      "n": 10,
      "objetivos": [7,8,11,12,13,16,17,22,28,29,32,35,36,38],
      "progresso": [{"prazo":"2º ano","percentual":"45%"},{"prazo":"4º ano","percentual":"90%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M10.1","oQue":"coletas de amostras vegetais realizadas","min":15,"max":30,"unidade":"coleta"},
        {"chave":"M10.2","oQue":"novos tratamentos e/ou terapias desenvolvidos","min":2,"max":4,"unidade":"tratamento"}
      ]
    },
    {
      "n": 11,
      "objetivos": [10,11,18,22],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M11.1","oQue":"aumento de dados epidemiológicos","min":10,"max":20,"unidade":"%"},
        {"chave":"M11.2","oQue":"aumento do quantitativo de venenos/toxinas, extratos e/ou frações","min":15,"max":30,"unidade":"%"}
      ]
    },
    {
      "n": 12,
      "objetivos": [7,11,13,14,18,22,28,29,39,40,43],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M12.1","oQue":"grupos de pesquisa do INCT-CONEXAO destinatários","min":15,"max":25,"unidade":"grupo"},
        {"chave":"M12.2","oQue":"venenos catalogados/enviados","min":6,"max":8,"unidade":"veneno"},
        {"chave":"M12.3","oQue":"extratos catalogados/enviados","min":15,"max":25,"unidade":"extrato"},
        {"chave":"M12.4","oQue":"frações e/ou substâncias isoladas catalogadas/enviadas","min":12,"max":24,"unidade":"fração"}
      ]
    },
    {
      "n": 13,
      "objetivos": [19,20,21,24,25,26,28,29,43],
      "progresso": [{"prazo":"2º ano","percentual":"30%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M13.1","oQue":"estudos ômicos (venômica e/ou antivenômica)","min":2,"max":4,"unidade":"estudo"},
        {"chave":"M13.2","oQue":"alvos moleculares de parasitas produzidos","min":2,"max":4,"unidade":"alvo"},
        {"chave":"M13.3","oQue":"anticorpos e/ou toxinas recombinantes produzidos","min":1,"max":2,"unidade":"item"},
        {"chave":"M13.4","oQue":"peptídeos sintéticos produzidos","min":3,"max":6,"unidade":"peptídeo"},
        {"chave":"M13.5","oQue":"nanoencapsulamentos e/ou biossensores preparados","min":2,"max":4,"unidade":"item"}
      ]
    },
    {
      "n": 14,
      "objetivos": [16,17,32,37,38,41,43],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M14.1","oQue":"levantamento para implantação/reativação de AEPLs","min":1,"max":1,"unidade":"levantamento"},
        {"chave":"M14.2","oQue":"mapeamento para implantação/reativação de AEPLs","min":1,"max":1,"unidade":"mapeamento"},
        {"chave":"M14.3","oQue":"AEPLs de plantas medicinais implantados/reativados","min":5,"max":null,"unidade":"AEPL"},
        {"chave":"M14.4","oQue":"núcleo da RedesÓLEOS da Amazônia implementado","min":1,"max":1,"unidade":"núcleo"}
      ]
    },
    {
      "n": 15,
      "objetivos": [16,31,32,34,37,39,40,42],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M15.1","oQue":"cursos de capacitação ofertados a agricultores, produtores e empresários","min":10,"max":18,"unidade":"curso"},
        {"chave":"M15.2","oQue":"oficinas sobre Bioeconomia e Empreendedorismo","min":9,"max":18,"unidade":"oficina"},
        {"chave":"M15.3","oQue":"oficinas e minicursos de Boas Práticas de Fabricação (BPF)","min":5,"max":10,"unidade":"oficina"}
      ]
    },
    {
      "n": 16,
      "objetivos": [32,33,38,41,43],
      "progresso": [{"prazo":"2º ano","percentual":"25%"},{"prazo":"4º ano","percentual":"50%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M16.1","oQue":"Sínteses de Evidências ou Revisões Sistemáticas elaboradas","min":1,"max":2,"unidade":"síntese"},
        {"chave":"M16.2","oQue":"minuta de Diretriz de Políticas Públicas apresentada","min":1,"max":1,"unidade":"minuta"}
      ]
    },
    {
      "n": 17,
      "objetivos": [30,33,43],
      "progresso": [{"prazo":"2º ano","percentual":"25%"},{"prazo":"4º ano","percentual":"50%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [{"chave":"M17.1","oQue":"aplicativo (app) de predição por IA criado — Ofídio-Venom-Saúde-IA (OVS-IA)","min":1,"max":1,"unidade":"aplicativo"}]
    },
    {
      "n": 18,
      "objetivos": [17,30,33,38],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M18.1","oQue":"diálogos em 2 dimensões realizados","min":2,"max":4,"unidade":"diálogo"},
        {"chave":"M18.2","oQue":"processos de tomada de decisão apoiados","min":2,"max":4,"unidade":"processo"}
      ]
    },
    {
      "n": 19,
      "objetivos": [21,28,43],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M19.1","oQue":"Concentrações Inibitórias determinadas (IC50 e CIM)","min":12,"max":20,"unidade":"determinação"},
        {"chave":"M19.2","oQue":"Concentrações Bactericidas Mínimas (CBM) determinadas","min":12,"max":20,"unidade":"determinação"},
        {"chave":"M19.3","oQue":"Índices de Seletividade (IS) determinados","min":12,"max":20,"unidade":"índice"},
        {"chave":"M19.4","oQue":"parasitas testados","min":3,"max":6,"unidade":"parasita"},
        {"chave":"M19.5","oQue":"bactérias testadas (incluindo cepas resistentes)","min":6,"max":12,"unidade":"bactéria"},
        {"chave":"M19.6","oQue":"linhagens de células normais testadas","min":4,"max":6,"unidade":"linhagem"},
        {"chave":"M19.7","oQue":"linhagens tumorais testadas","min":6,"max":12,"unidade":"linhagem"},
        {"chave":"M19.8","oQue":"mecanismos de ação estudados","min":3,"max":6,"unidade":"mecanismo"},
        {"chave":"M19.9","oQue":"potenciais inibidores testados","min":3,"max":6,"unidade":"inibidor"}
      ]
    },
    {
      "n": 20,
      "objetivos": [28,29,39,40,43],
      "progresso": [{"prazo":"2º ano","percentual":"25%"},{"prazo":"4º ano","percentual":"50%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M20.1","oQue":"extratos de plantas amazônicas ou toxinas avaliados em zebrafish","min":4,"max":8,"unidade":"extrato"},
        {"chave":"M20.2","oQue":"compostos selecionados caracterizados in vitro","min":2,"max":8,"unidade":"composto"},
        {"chave":"M20.3","oQue":"testes de toxicidade determinados (in vitro e/ou in vivo)","min":12,"max":24,"unidade":"teste"},
        {"chave":"M20.4","oQue":"venenos/toxinas submetidos a toxicidade aguda e subaguda","min":6,"max":12,"unidade":"veneno/toxina"}
      ]
    },
    {
      "n": 21,
      "objetivos": [19,20,21,22,23,28,29,43],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M21.1","oQue":"atividades enzimáticas e/ou farmacológicas realizadas","min":12,"max":24,"unidade":"atividade"},
        {"chave":"M21.2","oQue":"compostos provenientes de venenos, toxinas, óleos e extratos","min":6,"max":12,"unidade":"composto"},
        {"chave":"M21.3","oQue":"nanoencapsulamentos caracterizados e formulados","min":3,"max":6,"unidade":"nanoencapsulamento"},
        {"chave":"M21.4","oQue":"compostos ativos nanoencapsulados","min":3,"max":6,"unidade":"composto"},
        {"chave":"M21.5","oQue":"testes biológicos e/ou farmacológicos","min":2,"max":4,"unidade":"teste"}
      ]
    },
    {
      "n": 22,
      "objetivos": [23,26,27,43],
      "progresso": [{"prazo":"2º ano","percentual":"25%"},{"prazo":"4º ano","percentual":"50%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M22.1","oQue":"Modelos Estruturais produzidos","min":4,"max":8,"unidade":"modelo"},
        {"chave":"M22.2","oQue":"interações moleculares produzidas","min":6,"max":12,"unidade":"interação"},
        {"chave":"M22.3","oQue":"alvos moleculares","min":2,"max":4,"unidade":"alvo"},
        {"chave":"M22.4","oQue":"potenciais inibidores","min":6,"max":12,"unidade":"inibidor"},
        {"chave":"M22.5","oQue":"modelagens matemáticas realizadas","min":1,"max":3,"unidade":"modelagem"},
        {"chave":"M22.6","oQue":"simulações de processos de extração de óleos vegetais (ASPEN-HYSYS)","min":2,"max":4,"unidade":"simulação"}
      ]
    },
    {
      "n": 23,
      "objetivos": [16,31,39],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M23.1","oQue":"alunos de iniciação científica (ICJ e IC) formados","min":18,"max":36,"unidade":"aluno"},
        {"chave":"M23.2","oQue":"alunos de mestrado formados","min":9,"max":18,"unidade":"aluno"},
        {"chave":"M23.3","oQue":"alunos de doutorado formados","min":9,"max":12,"unidade":"aluno"},
        {"chave":"M23.4","oQue":"líderes de comunidades originárias/tradicionais capacitados","min":9,"max":18,"unidade":"líder"},
        {"chave":"M23.5","oQue":"integrantes de comunidades originárias/tradicionais capacitados","min":90,"max":180,"unidade":"pessoa"},
        {"chave":"M23.6","oQue":"profissionais capacitados","min":270,"max":540,"unidade":"profissional"},
        {"chave":"M23.7","oQue":"alunos/professores capacitados","min":900,"max":2700,"unidade":"pessoa"},
        {"chave":"M23.8","oQue":"gestores em Saúde, Ambiente, Educação e CT&I capacitados","min":45,"max":90,"unidade":"gestor"}
      ]
    },
    {
      "n": 24,
      "objetivos": [34,35,37,39,40,42],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M24.1","oQue":"programas de pós-graduação (PPG-SS) integrados","min":9,"max":18,"unidade":"PPG"},
        {"chave":"M24.2","oQue":"Grupos de Pesquisa da Amazônia Legal integrados","min":9,"max":18,"unidade":"grupo"},
        {"chave":"M24.3","oQue":"outros PPGs no Brasil e no exterior integrados","min":12,"max":12,"unidade":"PPG"},
        {"chave":"M24.4","oQue":"Rede Internacional de Pesquisa e Conhecimento de Excelência consolidada","min":1,"max":1,"unidade":"rede"},
        {"chave":"M24.5","oQue":"pesquisadores na rede","min":170,"max":null,"unidade":"pesquisador"},
        {"chave":"M24.6","oQue":"países na rede","min":15,"max":15,"unidade":"país"},
        {"chave":"M24.7","oQue":"estados da Amazônia representados","min":9,"max":9,"unidade":"estado"}
      ]
    },
    {
      "n": 25,
      "objetivos": [35,41,42,43],
      "progresso": [{"prazo":"2º ano","percentual":"25%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M25.1","oQue":"materiais de educação em saúde, ambiental e científica compartilhados","min":15,"max":30,"unidade":"material"},
        {"chave":"M25.2","oQue":"diálogos interculturais promovidos","min":6,"max":12,"unidade":"diálogo"},
        {"chave":"M25.3","oQue":"compêndio de conhecimentos científicos e tradicionais produzido","min":1,"max":1,"unidade":"compêndio"}
      ]
    },
    {
      "n": 26,
      "objetivos": [9,11,14,16,17,36,37,42,43],
      "progresso": [{"prazo":"2º ano","percentual":"35%"},{"prazo":"4º ano","percentual":"70%"},{"prazo":"5º ano","percentual":"100%"}],
      "pactuados": [
        {"chave":"M26.1","oQue":"Projeto Casa Verde desenvolvido","min":1,"max":1,"unidade":"projeto"},
        {"chave":"M26.2","oQue":"Projeto Smartscópio desenvolvido","min":1,"max":1,"unidade":"projeto"},
        {"chave":"M26.3","oQue":"levantamento da biodiversidade íctica na bacia Amazônica realizado","min":1,"max":1,"unidade":"levantamento"}
      ]
    }
  ],
  "indicadores": [
    {"n":1,"ano":1},
    {"n":2,"ano":1},
    {"n":3,"ano":1},
    {"n":4,"ano":1},
    {"n":5,"ano":1},
    {"n":6,"ano":2},
    {"n":7,"ano":2},
    {"n":8,"ano":2},
    {"n":9,"ano":2},
    {"n":10,"ano":3},
    {"n":11,"ano":3},
    {"n":12,"ano":3},
    {"n":13,"ano":3},
    {"n":14,"ano":3},
    {"n":15,"ano":4},
    {"n":16,"ano":4},
    {"n":17,"ano":4},
    {"n":18,"ano":4},
    {"n":19,"ano":4},
    {"n":20,"ano":5},
    {"n":21,"ano":5},
    {"n":22,"ano":5},
    {"n":23,"ano":5},
    {"n":24,"ano":5}
  ],
  "indicadores_ano_1": [1,2,3,4,5],
  "bolsas": [
    {"sigla":"IC","modalidade":"Iniciação Científica - IC","quotas":18,"meses":12},
    {"sigla":"ITI-A","modalidade":"ITI A","quotas":18,"meses":12},
    {"sigla":"SET-C","modalidade":"SET-C","quotas":3,"meses":12},
    {"sigla":"SET-B","modalidade":"SET-B","quotas":2,"meses":24},
    {"sigla":"ADC-1A","modalidade":"ADC-1A","quotas":2,"meses":36},
    {"sigla":"DTI-A","modalidade":"DTI-A","quotas":6,"meses":36},
    {"sigla":"DTI-B","modalidade":"DTI-B","quotas":8,"meses":24},
    {"sigla":"DTI-C","modalidade":"DTI-C","quotas":8,"meses":24},
    {"sigla":"SET-F","modalidade":"SET-F","quotas":2,"meses":12},
    {"sigla":"EXP-3","modalidade":"EXP - 3","quotas":3,"meses":12},
    {"sigla":"EV-1","modalidade":"EV-1","quotas":8,"meses":6},
    {"sigla":"PDJ","modalidade":"Pós-Doutorado Junior - PDJ","quotas":2,"meses":12},
    {"sigla":"ADC-1C","modalidade":"ADC-1C","quotas":6,"meses":24},
    {"sigla":"SET-E","modalidade":"SET-E","quotas":1,"meses":24},
    {"sigla":"SET-G","modalidade":"SET-G","quotas":2,"meses":12},
    {"sigla":"EXP-1","modalidade":"EXP - 1","quotas":3,"meses":12},
    {"sigla":"EV-3","modalidade":"EV-3","quotas":6,"meses":6}
  ],
  "fato_comite": {
    "expedicao": "CEXPECIAL",
    "acao_sociedade": "CDIV",
    "parceria": "CINTER",
    "formacao": "CTC",
    "bolsista": "CTC",
    "acervo": "CCCO",
    "dado_software": "CTC",
    "infraestrutura": "CTC",
    "politica_publica": "CPIE"
  },
  "anexos": {"max_por_relato":12,"max_bytes":1048576,"max_imagens_por_item":3,"mimes":["application/pdf","image/jpeg","image/png"]},
  "processo_confirmado": false,
  "processo_nota": "O numero do processo do Termo de Outorga NAO e conhecido (nenhuma ocorrencia na proposta). Enquanto relatorio_ciclos.processo for nulo, o botao de copiar a frase-padrao de agradecimento fica DESABILITADO: esse numero vai para a secao de agradecimentos de artigos publicados, onde e permanente."
}
$json$::jsonb
)
on conflict (slug) do nothing;


-- ============================ 19. COMO SEMEAR OS 28 LABORATÓRIOS ===========
--  Esta migração NÃO semeia `laboratorios`: os dados vêm de
--  src/content/relato/laboratorios.json (produzido em paralelo). Semeadura em
--  UMA instrução, idempotente, a partir do JSON colado inteiro. Rode no SQL
--  Editor trocando só o bloco entre $lab$ … $lab$:
--
--    with entrada as (select $lab$ [ {"sigla":"LLA-01","nome":"…",
--         "instituicao_nome":"…","instituicao_ror":"02842cb31","uf":"RO",
--         "eets":["EET-3"],"objetivos":[11,12],"lla_nome":"…",
--         "lla_email":"…","curador_acervo":false} , … ] $lab$::jsonb as j)
--    insert into public.laboratorios
--      (ciclo_id, sigla, nome, instituicao_nome, instituicao_ror, uf, eets,
--       objetivos, lla_nome, lla_email, curador_acervo, ordem)
--    select c.id, e ->> 'sigla', e ->> 'nome',
--           coalesce(e ->> 'instituicao_nome',''), e ->> 'instituicao_ror',
--           e ->> 'uf',
--           coalesce(array(select jsonb_array_elements_text(e -> 'eets')), '{}'),
--           coalesce(array(select jsonb_array_elements_text(e -> 'objetivos'))::int[], '{}'),
--           coalesce(e ->> 'lla_nome',''), lower(e ->> 'lla_email'),
--           coalesce((e ->> 'curador_acervo')::boolean, false),
--           (ord - 1)
--      from entrada, jsonb_array_elements((select j from entrada)) with ordinality t(e, ord),
--           public.relatorio_ciclos c
--     where c.slug = 'ciclo-1'
--    on conflict (ciclo_id, sigla) do update
--      set nome = excluded.nome, instituicao_nome = excluded.instituicao_nome,
--          instituicao_ror = excluded.instituicao_ror, uf = excluded.uf,
--          eets = excluded.eets, objetivos = excluded.objetivos,
--          lla_nome = excluded.lla_nome, lla_email = excluded.lla_email;
--
--  CONFERÊNCIA OBRIGATÓRIA depois de semear (DECISÃO 1: são 28):
--    select count(*) = 28 as tem_28, count(*) as achou
--      from public.laboratorios l join public.relatorio_ciclos c on c.id = l.ciclo_id
--     where c.slug = 'ciclo-1' and l.ativo;
--
--  O roster de 209 pessoas (ciclo_membros) segue a mesma forma, com
--  on conflict (ciclo_id, email) do update. Depois de importar, rode
--    select public.vincular_membros_existentes();
--  para casar quem já tem conta da seleção de IC.


-- ============================================================ SANIDADE ====
select 'relatorio_ciclos (linhas)'      as checagem, count(*)::text as valor from public.relatorio_ciclos
union all select 'ciclo-1 processo (deve ser vazio)',
       coalesce((select processo from public.relatorio_ciclos where slug = 'ciclo-1'), '(nulo)')
union all select 'ciclo-1 período reportável',
       (select periodo_inicio::text || ' → ' || periodo_fim::text
          from public.relatorio_ciclos where slug = 'ciclo-1')
union all select 'ciclo-1 janela de envio',
       (select abre_em::text || ' → ' || fecha_em::text
          from public.relatorio_ciclos where slug = 'ciclo-1')
union all select 'metas no config',
       (select jsonb_array_length(config -> 'metas') ::text from public.relatorio_ciclos where slug = 'ciclo-1')
union all select 'números pactuados no config',
       (select count(*)::text from public.relatorio_ciclos c,
               jsonb_array_elements(c.config -> 'metas') m,
               jsonb_array_elements(m -> 'pactuados') p
         where c.slug = 'ciclo-1')
union all select 'laboratórios esperados (config)',
       (select config #>> '{laboratorios,oficial}' from public.relatorio_ciclos where slug = 'ciclo-1')
union all select 'laboratórios semeados (esperado 0 agora)',
       (select count(*)::text from public.laboratorios)
union all select 'tabelas novas', (select count(*)::text from pg_tables
       where schemaname = 'public' and tablename in (
         'relatorio_ciclos','laboratorios','ciclo_membros','relatos','fatos',
         'fato_participantes','producoes','producao_vinculos','producao_autores',
         'relato_arquivos','relato_eventos','relato_protocolo_seq'))
union all select 'triggers novos', (select count(*)::text from pg_trigger where tgname in (
         'relatos_set_protocolo','relatos_window','relatos_guard_autoria','relatos_log',
         'fatos_guard_coletivo','fatos_comite','fatos_competencia','fatos_log',
         'producoes_competencia','ciclo_membros_guard','on_auth_user_created_relato'))
union all select 'políticas novas', (select count(*)::text from pg_policies
       where schemaname = 'public' and tablename in (
         'relatorio_ciclos','laboratorios','ciclo_membros','relatos','fatos',
         'fato_participantes','producoes','producao_vinculos','producao_autores',
         'relato_arquivos','relato_eventos'));
