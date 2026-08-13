-- ============================================================================
--  INCT-CONEXAO · PROPOSTA de migração 005 — Relatórios de execução (ciclo anual)
--  NÃO APLICADA. Especificação para o Aleff revisar e rodar quando decidir.
--  Ordem pretendida: 001 → 002 → 003 → 004 → 005.
-- ============================================================================
--
--  O QUE ESTE ARQUIVO REUSA TAL E QUAL DO 001..004
--  -----------------------------------------------
--   • profiles / staff_allowlist / handle_new_user  → intocados, reusados.
--   • current_role_of() / is_staff() / is_admin()   → intocados, reusados.
--   • touch_updated_at()                            → intocado, reusado.
--   • Tabela de CONFIGURAÇÃO em jsonb (editais)     → espelhada em relatorio_ciclos.
--   • Uma submissão por (ciclo, usuário)            → espelha applications.
--   • Contador atômico + trigger de protocolo (003) → espelhado, com UMA correção
--                                                     (ver "PROTOCOLO" abaixo).
--   • Log append-only por trigger SECURITY DEFINER (004) → espelhado, com uma
--                                                     adaptação de volume.
--   • Bucket privado + storage.foldername(name)[1] = auth.uid() → espelhado.
--
--  ONDE O PADRÃO DO 001 **NÃO** SERVE (as 6 divergências deliberadas)
--  -----------------------------------------------------------------
--   1. applications tem ~20 colunas tipadas (cpf, curso, periodo…). Um relatório
--      de 26 metas + 5 indicadores não cabe em colunas: vira `respostas jsonb`
--      chaveado pelos ids do config do ciclo. Só o que precisa ser filtrado/
--      agregado vira coluna.
--   2. 'rascunho' existe no CHECK do 001 mas NENHUM caminho de UI o escreve
--      (api.ts:73 grava status:'recebida' no insert). Aqui o rascunho é real e
--      é o estado INICIAL.
--   3. Protocolo no BEFORE INSERT (003) queimaria um número por rascunho
--      abandonado. Aqui o número nasce na TRANSIÇÃO para 'enviado'.
--   4. app_owner_update deixa is_admin() reescrever QUALQUER campo da inscrição
--      alheia. Num relatório isso destrói a atribuição ("quem declarou o quê").
--      Aqui um trigger impede que alguém que não é o dono altere `respostas`.
--   5. enforce_edital_window() é tudo-ou-nada. Um relatório precisa de
--      DEVOLUÇÃO: a coordenação reabre um relatório específico sem reabrir o
--      ciclo inteiro.
--   6. application_files tem unique(application_id, kind) = 1 arquivo por tipo.
--      Um relatório tem N comprovações por item; a unicidade passa a ser o
--      caminho no Storage.
-- ============================================================================


-- ============================================================ 1. CICLO =====
-- Espelha `editais`: o ciclo é CONFIGURAÇÃO. Abrir o relatório do 2º ano =
-- inserir uma linha nova; nenhum código muda.
create table if not exists public.relatorio_ciclos (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,                 -- 'relatorio-ano-1-2026'
  numero      text not null,                        -- '01/2026'
  titulo      text not null,
  status      text not null default 'rascunho'
              check (status in ('rascunho','aberto','em_revisao','consolidado','arquivado')),
  abre_em     timestamptz not null,
  fecha_em    timestamptz not null,
  -- config: seções, perguntas, metas (26), indicadores do 1º ano (5),
  -- objetivos específicos (43), EET-1..8, comitês, tipos de produto, bolsas
  -- pactuadas. É o análogo de editais.config.
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint relatorio_ciclos_janela check (fecha_em > abre_em)
);

drop trigger if exists relatorio_ciclos_touch on public.relatorio_ciclos;
create trigger relatorio_ciclos_touch
  before update on public.relatorio_ciclos
  for each row execute function public.touch_updated_at();


-- ======================================================= 2. RELATÓRIOS =====
-- Espelha `applications`: uma submissão por (ciclo, usuário).
create table if not exists public.relatorios (
  id            uuid primary key default gen_random_uuid(),
  ciclo_id      uuid not null references public.relatorio_ciclos (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  protocolo     text unique,                        -- NULL enquanto rascunho
  status        text not null default 'rascunho'
                check (status in ('rascunho','enviado','em_revisao','devolvido','consolidado')),

  -- Identificação do declarante. NÃO se pede CPF: não há finalidade legítima
  -- (o INCT não paga bolsa a partir daqui) e a pessoa já está identificada
  -- pelo auth.users + profiles. Coletar CPF aqui é passivo de LGPD sem ganho.
  nome          text not null,
  email         text not null,
  papel_ciclo   text not null
                check (papel_ciclo in ('lider_laboratorio','pesquisador_associado',
                                       'colaborador','coordenacao','estudante_bolsista')),
  instituicao   text not null,
  uf            text not null default '',
  laboratorio   text not null default '',          -- LLA / grupo declarado
  comites       text[] not null default '{}',      -- CEXPECIAL, CCCO, CTC, CDIV, CPIE, CINTER

  -- O corpo do relatório. Chaveado pelos ids do config do ciclo.
  respostas     jsonb not null default '{}'::jsonb,

  lgpd_aceite   boolean not null default false,
  submitted_at  timestamptz,                        -- 1ª submissão (não muda em edição)
  reaberto_ate  timestamptz,                        -- devolução: janela individual
  nota_revisao  text not null default '',           -- da coordenação para o declarante
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint relatorios_um_por_ciclo unique (ciclo_id, user_id)
);
drop trigger if exists relatorios_touch on public.relatorios;
create trigger relatorios_touch
  before update on public.relatorios
  for each row execute function public.touch_updated_at();

create index if not exists relatorios_ciclo_status_idx on public.relatorios (ciclo_id, status);
create index if not exists relatorios_uf_idx           on public.relatorios (ciclo_id, uf);
-- Busca dentro das respostas (a coordenação vai querer "quem citou a meta 12"):
create index if not exists relatorios_respostas_gin    on public.relatorios using gin (respostas);


-- ==================================== 3. PROTOCOLO (padrão do 003, corrigido)
-- Contador atômico por ciclo. Sem policies de RLS = inacessível pela API.
create table if not exists public.relatorio_protocolo_seq (
  ciclo_id uuid primary key references public.relatorio_ciclos (id) on delete cascade,
  ultimo   int  not null default 0
);
alter table public.relatorio_protocolo_seq enable row level security;

-- Mesma técnica do 003: INSERT ... ON CONFLICT DO UPDATE ... RETURNING pega
-- lock de linha, então concorrentes são serializados. NUNCA count(*)+1.
create or replace function public.reserve_relatorio_protocolo(p_ciclo uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.relatorio_protocolo_seq (ciclo_id, ultimo)
  values (p_ciclo, 1)
  on conflict (ciclo_id)
    do update set ultimo = public.relatorio_protocolo_seq.ultimo + 1
  returning ultimo into n;
  return n;
end; $$;

-- DIFERENÇA DELIBERADA em relação ao 003: lá o protocolo nasce no BEFORE
-- INSERT. Aqui o INSERT é um rascunho vazio — se o número nascesse no insert,
-- cada rascunho abandonado queimaria um protocolo e a numeração oficial ficaria
-- cheia de buracos. O número nasce quando o relatório vira 'enviado'.
create or replace function public.set_relatorio_protocolo()
returns trigger
language plpgsql security definer set search_path = public as $$
declare num text; n int;
begin
  if new.status <> 'enviado' then return new; end if;
  if new.protocolo is not null and new.protocolo <> '' then return new; end if;
  select replace(numero, '/', '-') into num from public.relatorio_ciclos where id = new.ciclo_id;
  n := public.reserve_relatorio_protocolo(new.ciclo_id);
  new.protocolo   := 'REL-' || coalesce(num, 'CICLO') || '-' || lpad(n::text, 4, '0');
  new.submitted_at := coalesce(new.submitted_at, now());  -- 1ª submissão, imutável
  return new;
end; $$;

drop trigger if exists relatorios_set_protocolo on public.relatorios;
create trigger relatorios_set_protocolo
  before insert or update on public.relatorios
  for each row execute function public.set_relatorio_protocolo();

-- Mesma lição do 003: revogar de PUBLIC (anon/authenticated herdam de PUBLIC;
-- revogar só deles é inócuo). As triggers rodam como owner e seguem funcionando.
revoke execute on function public.reserve_relatorio_protocolo(uuid) from public, anon, authenticated;


-- ================================ 4. JANELA + INTEGRIDADE DA AUTORIA =======
-- Espelha enforce_edital_window(), com a devolução individual que o 001 não tem.
create or replace function public.enforce_relatorio_window()
returns trigger
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if public.is_staff() then return new; end if;   -- coordenação ajusta status/nota
  select status, abre_em, fecha_em into c from public.relatorio_ciclos where id = new.ciclo_id;

  -- Reabertura individual: relatório devolvido continua editável até reaberto_ate,
  -- mesmo com o ciclo já fechado. É o caso que o padrão do 001 não cobre.
  if tg_op = 'UPDATE' and old.status = 'devolvido'
     and new.reaberto_ate is not null and now() <= new.reaberto_ate then
    return new;
  end if;

  if c.status is distinct from 'aberto' or now() < c.abre_em or now() > c.fecha_em then
    raise exception 'Relatório fora do período (ciclo não está aberto).';
  end if;

  -- Relatório já enviado não volta a rascunho pela mão do declarante.
  if tg_op = 'UPDATE' and old.status = 'enviado' and new.status = 'rascunho' then
    raise exception 'Relatório já enviado: peça a devolução à coordenação para editar.';
  end if;
  return new;
end; $$;

drop trigger if exists relatorios_window on public.relatorios;
create trigger relatorios_window
  before insert or update on public.relatorios
  for each row execute function public.enforce_relatorio_window();

-- ATRIBUIÇÃO: no 001, `app_owner_update` deixa is_admin() reescrever qualquer
-- campo da inscrição alheia. Num relatório isso apagaria em silêncio o que a
-- pessoa declarou — e o relatório do INCT é justamente um documento de autoria.
-- A coordenação move status e escreve nota_revisao; o texto é do declarante.
create or replace function public.guard_relatorio_autoria()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.respostas is distinct from old.respostas and auth.uid() <> old.user_id then
    raise exception 'Somente quem declarou pode alterar o conteúdo do relatório.';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'A autoria do relatório não pode ser transferida.';
  end if;
  return new;
end; $$;

drop trigger if exists relatorios_guard_autoria on public.relatorios;
create trigger relatorios_guard_autoria
  before update on public.relatorios
  for each row execute function public.guard_relatorio_autoria();


-- ================================================= 5. ARQUIVOS/COMPROVAÇÃO ==
-- Espelha application_files SEM o unique(application_id, kind): um relatório
-- tem N comprovações por item, não uma por tipo. A unicidade vira o caminho.
create table if not exists public.relatorio_arquivos (
  id            uuid primary key default gen_random_uuid(),
  relatorio_id  uuid not null references public.relatorios (id) on delete cascade,
  bloco         text not null,          -- id da pergunta/meta no config do ciclo
  storage_path  text not null unique,
  file_name     text not null,
  mime          text not null default 'application/pdf',
  file_size     int  not null default 0,
  created_at    timestamptz not null default now(),
  constraint relatorio_arquivos_tamanho check (file_size <= 2097152)  -- ver orçamento
);
create index if not exists relatorio_arquivos_rel_idx on public.relatorio_arquivos (relatorio_id);


-- ====================================== 6. PRODUTOS (deduplicação da rede) ==
-- 190 pesquisadores vão declarar o MESMO artigo/patente/evento. Contar 4× o
-- mesmo paper infla o relatório ao CNPq. Tabela normalizada + chave de dedup.
-- SEM unique: duas pessoas declararem o mesmo produto é legítimo (coautoria) —
-- o que não se pode é CONTAR duas vezes. A fusão é editorial, da coordenação.
create table if not exists public.relatorio_produtos (
  id            uuid primary key default gen_random_uuid(),
  relatorio_id  uuid not null references public.relatorios (id) on delete cascade,
  ciclo_id      uuid not null references public.relatorio_ciclos (id) on delete cascade,
  tipo          text not null
                check (tipo in ('artigo','capitulo','livro','patente','software',
                                'tese','dissertacao','tcc','evento','curso',
                                'material_divulgacao','protocolo','base_dados','outro')),
  titulo        text not null,
  identificador text not null default '',   -- DOI / ISBN / nº do processo / URL
  ano           int,
  metas         text[] not null default '{}',       -- metas que este produto atende
  objetivos     text[] not null default '{}',       -- objetivos específicos (1..43)
  eet           text[] not null default '{}',       -- EET-1..EET-8
  -- chave normalizada (minúsculas, sem prefixo de resolvedor, sem pontuação):
  chave_dedup   text generated always as (
                  lower(regexp_replace(coalesce(nullif(identificador,''), titulo),
                                       '^https?://(dx\.)?doi\.org/|[^a-z0-9]', '', 'gi'))
                ) stored,
  created_at    timestamptz not null default now()
);
create index if not exists relatorio_produtos_dedup_idx on public.relatorio_produtos (ciclo_id, chave_dedup);
create index if not exists relatorio_produtos_rel_idx   on public.relatorio_produtos (relatorio_id);

-- RLS impede que o pesquisador A enxergue a linha do pesquisador B — então a
-- dedup NÃO pode acontecer no cliente lendo a tabela. Esta RPC devolve APENAS
-- uma contagem: "este DOI já foi declarado por N pessoas da rede". Nunca o nome
-- de quem declarou (isso vazaria produção alheia através do formulário).
create or replace function public.produto_ja_declarado(p_ciclo uuid, p_chave text)
returns int
language sql security definer stable set search_path = public as $$
  select count(distinct relatorio_id)::int
  from public.relatorio_produtos
  where ciclo_id = p_ciclo
    and chave_dedup = lower(regexp_replace(p_chave, '^https?://(dx\.)?doi\.org/|[^a-z0-9]', '', 'gi'));
$$;


-- ========================== 7. LOG APPEND-ONLY (padrão do 004, adaptado) ====
-- O 004 grava o payload INTEIRO (scores jsonb) a cada gravação. Aqui o payload
-- é o relatório inteiro: com autosave, 190 pessoas × dezenas de gravações ×
-- ~40 kB estouraria os 500 MB do plano gratuito só de histórico. Então:
--   • toda gravação  → grava METADADOS (quem, quando, status, campos mudados);
--   • virou 'enviado' → grava o SNAPSHOT completo (é o que vira documento).
create table if not exists public.relatorio_events (
  id            uuid primary key default gen_random_uuid(),
  relatorio_id  uuid not null references public.relatorios (id) on delete cascade,
  actor_id      uuid,                       -- auth.uid() no momento da gravação
  action        text not null check (action in ('insert','update')),
  status        text not null,
  campos        text[] not null default '{}',
  snapshot      jsonb,                      -- só nas transições para 'enviado'
  at            timestamptz not null default now()
);
alter table public.relatorio_events enable row level security;

-- DIFERENÇA em relação ao 004 (que é admin-only): o declarante tem direito de
-- ver o próprio histórico — "o que eu declarei e quando" é a prova dele.
drop policy if exists relev_read on public.relatorio_events;
create policy relev_read on public.relatorio_events
  for select using (
    public.is_admin()
    or exists (select 1 from public.relatorios r
               where r.id = relatorio_id and r.user_id = auth.uid())
  );

create or replace function public.log_relatorio_event()
returns trigger
language plpgsql security definer set search_path = public as $$
declare mudou text[] := '{}';
begin
  if tg_op = 'UPDATE' then
    if new.respostas   is distinct from old.respostas   then mudou := mudou || 'respostas'; end if;
    if new.status      is distinct from old.status      then mudou := mudou || 'status';    end if;
    if new.nota_revisao is distinct from old.nota_revisao then mudou := mudou || 'nota_revisao'; end if;
  end if;
  insert into public.relatorio_events (relatorio_id, actor_id, action, status, campos, snapshot, at)
  values (
    new.id, auth.uid(), lower(tg_op), new.status, mudou,
    case when new.status = 'enviado'
              and (tg_op = 'INSERT' or old.status is distinct from 'enviado')
         then new.respostas else null end,
    now()
  );
  return new;
end; $$;

drop trigger if exists relatorios_log on public.relatorios;
create trigger relatorios_log
  after insert or update on public.relatorios
  for each row execute function public.log_relatorio_event();


-- ============================================================ 8. RLS =======
alter table public.relatorio_ciclos    enable row level security;
alter table public.relatorios          enable row level security;
alter table public.relatorio_arquivos  enable row level security;
alter table public.relatorio_produtos  enable row level security;

-- Ciclos: o config traz as metas pactuadas com o CNPq. DECISÃO PENDENTE — o 001
-- deixa editais legível por ANÔNIMO. Aqui a versão fechada (só autenticado):
drop policy if exists ciclos_read on public.relatorio_ciclos;
create policy ciclos_read on public.relatorio_ciclos
  for select to authenticated
  using (status <> 'rascunho' or public.is_admin());
drop policy if exists ciclos_admin_write on public.relatorio_ciclos;
create policy ciclos_admin_write on public.relatorio_ciclos
  for all using (public.is_admin()) with check (public.is_admin());

-- Relatórios: dono lê/escreve o próprio; staff lê tudo; admin move status.
drop policy if exists rel_owner_read on public.relatorios;
create policy rel_owner_read on public.relatorios
  for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists rel_owner_insert on public.relatorios;
create policy rel_owner_insert on public.relatorios
  for insert with check (user_id = auth.uid());
drop policy if exists rel_owner_update on public.relatorios;
create policy rel_owner_update on public.relatorios
  for update using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());
-- Sem policy de DELETE: relatório entregue não se apaga pela API. Exclusão
-- LGPD é operação manual e registrada da coordenação.

drop policy if exists relarq_read on public.relatorio_arquivos;
create policy relarq_read on public.relatorio_arquivos
  for select using (
    public.is_staff()
    or exists (select 1 from public.relatorios r where r.id = relatorio_id and r.user_id = auth.uid())
  );
drop policy if exists relarq_write on public.relatorio_arquivos;
create policy relarq_write on public.relatorio_arquivos
  for all using (
    exists (select 1 from public.relatorios r where r.id = relatorio_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.relatorios r where r.id = relatorio_id and r.user_id = auth.uid())
  );

drop policy if exists relprod_read on public.relatorio_produtos;
create policy relprod_read on public.relatorio_produtos
  for select using (
    public.is_staff()
    or exists (select 1 from public.relatorios r where r.id = relatorio_id and r.user_id = auth.uid())
  );
drop policy if exists relprod_write on public.relatorio_produtos;
create policy relprod_write on public.relatorio_produtos
  for all using (
    exists (select 1 from public.relatorios r where r.id = relatorio_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.relatorios r where r.id = relatorio_id and r.user_id = auth.uid())
  );


-- ======================================================== 9. STORAGE =======
-- Bucket novo, privado. Mesmo padrão do 001 (pasta = auth.uid()), mas aceita
-- imagem além de PDF (comprovação de campo é foto) e 2 MB por arquivo — ver o
-- orçamento de espaço no relatório da FRENTE 3.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('relatorios', 'relatorios', false, 2097152,
        array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists relatorios_owner_write on storage.objects;
create policy relatorios_owner_write on storage.objects
  for insert with check (
    bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists relatorios_owner_update on storage.objects;
create policy relatorios_owner_update on storage.objects
  for update using (
    bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists relatorios_owner_delete on storage.objects;
create policy relatorios_owner_delete on storage.objects
  for delete using (
    bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists relatorios_read on storage.objects;
create policy relatorios_read on storage.objects
  for select using (
    bucket_id = 'relatorios'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );


-- =================================================== 10. SEED DO CICLO 1 ===
-- Estrutura mínima do config. As 26 metas, os 43 objetivos e os 5 indicadores
-- do 1º ano vêm da FRENTE 1/2 — aqui só o formato.
insert into public.relatorio_ciclos (slug, numero, titulo, status, abre_em, fecha_em, config)
values (
  'relatorio-ano-1-2026', '01/2026',
  'Relatório de Execução — 1º ano do INCT-CONEXAO',
  'rascunho',
  '2026-09-01T00:00:00-04:00',
  '2026-10-15T23:59:59-04:00',
  $json${
    "aviso_ano_1": "Nenhuma das 26 metas tem marco pactuado no 1º ano: o 1º ano é linha de base. O formulário pergunta ANDAMENTO e LINHA DE BASE, não cumprimento de percentual.",
    "indicadores_ano1": [],
    "metas": [],
    "objetivos_especificos": [],
    "eet": [],
    "comites": ["CEXPECIAL","CCCO","CTC","CDIV","CPIE","CINTER"],
    "tipos_produto": ["artigo","capitulo","livro","patente","software","tese",
                      "dissertacao","tcc","evento","curso","material_divulgacao",
                      "protocolo","base_dados","outro"],
    "anexos": { "max_por_relatorio": 3, "max_bytes": 2097152,
                "mimes": ["application/pdf","image/png","image/jpeg","image/webp"] }
  }$json$::jsonb
)
on conflict (slug) do nothing;


-- ============================================================ SANIDADE ====
select 'relatorio_ciclos' as tabela, count(*)::text as linhas from public.relatorio_ciclos
union all select 'relatorios',        count(*)::text from public.relatorios
union all select 'relatorio_events',  count(*)::text from public.relatorio_events
union all select 'triggers',          count(*)::text from pg_trigger
          where tgname in ('relatorios_set_protocolo','relatorios_window',
                           'relatorios_guard_autoria','relatorios_log');
