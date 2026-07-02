-- ============================================================================
--  INCT-CONEXAO · Plataforma de Seleções — schema inicial
-- ============================================================================
--  Rode este arquivo UMA vez no SQL Editor do Supabase (Dashboard → SQL).
--  Cria: perfis/papéis, editais (config-driven), inscrições, arquivos,
--  atribuições, avaliações, bucket privado de PDFs e todas as políticas RLS.
--  Depois, promova o administrador (ver docs/plataforma-selecoes.md).
-- ============================================================================

-- ---------------------------------------------------------------- PERFIS ----
-- Um perfil por usuário autenticado. Papel padrão: candidato.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'candidato'
             check (role in ('admin', 'avaliador', 'candidato')),
  created_at timestamptz not null default now()
);

-- E-mails pré-autorizados da comissão: contas novas já nascem com o papel
-- indicado. Gerida pela aba Equipe do portal (#/gestao) — RLS: só admin.
create table if not exists public.staff_allowlist (
  email      text primary key check (email = lower(email)),
  role       text not null default 'avaliador' check (role in ('admin', 'avaliador')),
  created_at timestamptz not null default now()
);
alter table public.staff_allowlist enable row level security;
drop policy if exists allowlist_admin_all on public.staff_allowlist;
create policy allowlist_admin_all on public.staff_allowlist
  for all using (public.is_admin()) with check (public.is_admin());

-- Bootstrap: administradores iniciais.
insert into public.staff_allowlist (email, role) values
  ('labioprot.toxin@gmail.com', 'admin'),
  ('alefffx@gmail.com', 'admin')
on conflict (email) do nothing;

-- Cria o perfil automaticamente no primeiro acesso (link mágico ou senha).
-- O papel vem da allowlist; fora dela, nasce candidato.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  allowed text;
begin
  select role into allowed from public.staff_allowlist where email = lower(new.email);
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(allowed, 'candidato')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: papel do usuário logado (SECURITY DEFINER evita recursão de RLS).
create or replace function public.current_role_of()
returns text
language sql security definer stable set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;

create or replace function public.is_staff()
returns boolean
language sql security definer stable set search_path = public as $$
  select public.current_role_of() in ('admin', 'avaliador');
$$;

create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select public.current_role_of() = 'admin';
$$;

-- --------------------------------------------------------------- EDITAIS ----
-- Cada edital é CONFIGURAÇÃO (critérios, estados/vagas/orientadores, datas).
-- Lançar uma nova seleção = inserir uma linha; nenhum código muda.
create table if not exists public.editais (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  numero      text not null,                     -- ex.: "04/2026"
  titulo      text not null,
  status      text not null default 'rascunho'
              check (status in ('rascunho', 'aberto', 'em_avaliacao', 'homologado', 'arquivado')),
  abre_em     timestamptz not null,
  fecha_em    timestamptz not null,
  config      jsonb not null default '{}'::jsonb, -- critérios, bônus, docs, estados
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint editais_janela check (fecha_em > abre_em)
);

-- ------------------------------------------------------------ INSCRIÇÕES ----
create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  edital_id     uuid not null references public.editais (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  protocolo     text not null unique,
  status        text not null default 'recebida'
                check (status in ('rascunho', 'recebida', 'em_avaliacao', 'aprovada',
                                  'lista_espera', 'nao_aprovada', 'desclassificada')),
  -- dados pessoais
  nome          text not null,
  cpf           text not null,
  email         text not null,
  telefone      text not null default '',
  sexo          text not null default 'nao_informar'
                check (sexo in ('feminino', 'masculino', 'outro', 'nao_informar')),
  -- dados acadêmicos
  instituicao   text not null,
  curso         text not null,
  periodo       text not null,
  coeficiente   text not null default '',
  -- escolha
  estado        text not null,                    -- UF (ex.: "RO")
  orientador    text not null,
  video_url     text not null default '',
  lgpd_aceite   boolean not null default false,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint applications_um_por_edital unique (edital_id, user_id)
);

-- Protocolo legível: INCT-<numero-sem-barra>-NNNN (sequência por edital).
create or replace function public.next_protocolo(p_edital uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  n    int;
  num  text;
begin
  select count(*) + 1 into n from public.applications where edital_id = p_edital;
  select replace(numero, '/', '-') into num from public.editais where id = p_edital;
  return 'INCT-' || coalesce(num, 'ED') || '-' || lpad(n::text, 4, '0');
end; $$;

-- Janela do edital: candidato só cria/edita enquanto o edital está aberto.
create or replace function public.enforce_edital_window()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e record;
begin
  select status, abre_em, fecha_em into e from public.editais where id = new.edital_id;
  if public.is_staff() then
    return new; -- comissão pode ajustar status fora da janela
  end if;
  if e.status is distinct from 'aberto' or now() < e.abre_em or now() > e.fecha_em then
    raise exception 'Inscrições fora do período (edital não está aberto).';
  end if;
  return new;
end; $$;

drop trigger if exists applications_window on public.applications;
create trigger applications_window
  before insert or update on public.applications
  for each row execute function public.enforce_edital_window();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists applications_touch on public.applications;
create trigger applications_touch
  before update on public.applications
  for each row execute function public.touch_updated_at();

drop trigger if exists editais_touch on public.editais;
create trigger editais_touch
  before update on public.editais
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- ARQUIVOS --
create table if not exists public.application_files (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  kind           text not null
                 check (kind in ('carta', 'plano', 'historico', 'lattes')),
  storage_path   text not null,
  file_name      text not null,
  file_size      int  not null default 0,
  created_at     timestamptz not null default now(),
  constraint files_um_por_tipo unique (application_id, kind)
);

-- ------------------------------------------------------------ ATRIBUIÇÕES --
create table if not exists public.assignments (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  evaluator_id   uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  constraint assignments_unica unique (application_id, evaluator_id)
);

-- ------------------------------------------------------------- AVALIAÇÕES --
create table if not exists public.evaluations (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  evaluator_id   uuid not null references auth.users (id) on delete cascade,
  scores         jsonb not null default '{}'::jsonb,  -- {plano: 55, historico: 18, ...}
  total          numeric(6,2) not null default 0,      -- ponderado, SEM bônus
  bonus_pct      numeric(5,2) not null default 0,      -- ex.: 10 = Ciência Delas
  final_score    numeric(6,2) not null default 0,      -- total * (1 + bonus/100)
  parecer        text not null default '',
  submitted      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint evaluations_unica unique (application_id, evaluator_id)
);

drop trigger if exists evaluations_touch on public.evaluations;
create trigger evaluations_touch
  before update on public.evaluations
  for each row execute function public.touch_updated_at();

-- =========================================================== RLS POLICIES ==
alter table public.profiles          enable row level security;
alter table public.editais           enable row level security;
alter table public.applications      enable row level security;
alter table public.application_files enable row level security;
alter table public.assignments       enable row level security;
alter table public.evaluations       enable row level security;

-- profiles: cada um lê o próprio; admin lê/gerencia todos.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles p2 where p2.id = auth.uid()));
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- editais: leitura pública (site mostra o edital); escrita só admin.
drop policy if exists editais_public_read on public.editais;
create policy editais_public_read on public.editais
  for select using (status <> 'rascunho' or public.is_admin());
drop policy if exists editais_admin_write on public.editais;
create policy editais_admin_write on public.editais
  for all using (public.is_admin()) with check (public.is_admin());

-- applications: dono lê/escreve a própria; staff lê; admin escreve (status).
drop policy if exists app_owner_read on public.applications;
create policy app_owner_read on public.applications
  for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists app_owner_insert on public.applications;
create policy app_owner_insert on public.applications
  for insert with check (user_id = auth.uid());
drop policy if exists app_owner_update on public.applications;
create policy app_owner_update on public.applications
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists app_owner_delete on public.applications;
create policy app_owner_delete on public.applications
  for delete using (user_id = auth.uid() and status in ('rascunho', 'recebida'));

-- application_files: segue a inscrição-mãe.
drop policy if exists files_read on public.application_files;
create policy files_read on public.application_files
  for select using (
    public.is_staff()
    or exists (select 1 from public.applications a
               where a.id = application_id and a.user_id = auth.uid())
  );
drop policy if exists files_write on public.application_files;
create policy files_write on public.application_files
  for all using (
    exists (select 1 from public.applications a
            where a.id = application_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.applications a
            where a.id = application_id and a.user_id = auth.uid())
  );

-- assignments: admin gerencia; avaliador vê as suas.
drop policy if exists assignments_read on public.assignments;
create policy assignments_read on public.assignments
  for select using (evaluator_id = auth.uid() or public.is_admin());
drop policy if exists assignments_admin on public.assignments;
create policy assignments_admin on public.assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- evaluations: avaliador escreve a própria; staff lê todas.
drop policy if exists eval_read on public.evaluations;
create policy eval_read on public.evaluations
  for select using (evaluator_id = auth.uid() or public.is_staff());
drop policy if exists eval_insert on public.evaluations;
create policy eval_insert on public.evaluations
  for insert with check (evaluator_id = auth.uid() and public.is_staff());
drop policy if exists eval_update on public.evaluations;
create policy eval_update on public.evaluations
  for update using (evaluator_id = auth.uid() and public.is_staff())
  with check (evaluator_id = auth.uid());

-- ============================================================== STORAGE ====
-- Bucket privado para os PDFs. Caminho: <user_id>/<edital_slug>/<kind>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inscricoes', 'inscricoes', false, 2097152, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists inscricoes_owner_write on storage.objects;
create policy inscricoes_owner_write on storage.objects
  for insert with check (
    bucket_id = 'inscricoes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists inscricoes_owner_update on storage.objects;
create policy inscricoes_owner_update on storage.objects
  for update using (
    bucket_id = 'inscricoes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists inscricoes_owner_delete on storage.objects;
create policy inscricoes_owner_delete on storage.objects
  for delete using (
    bucket_id = 'inscricoes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists inscricoes_read on storage.objects;
create policy inscricoes_read on storage.objects
  for select using (
    bucket_id = 'inscricoes'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

-- ========================================================= SEED: 04/2026 ===
insert into public.editais (slug, numero, titulo, status, abre_em, fecha_em, config)
values (
  'selecao-ic-2026',
  '04/2026',
  'Seleção de Bolsistas de Iniciação Científica (IC/CNPq)',
  'aberto',
  '2026-07-06T00:00:00-04:00',
  '2026-07-19T23:59:59-04:00',
  $json$
  {
    "bolsa": "R$ 700,00/mês · 12 meses",
    "criterios": [
      { "key": "plano",       "label": "Adequação e coerência do Plano de Trabalho com os EET e objetivos específicos do INCT-CONEXAO", "peso": 6, "max": 60 },
      { "key": "alinhamento", "label": "Alinhamento do Plano de Atividades à linha de pesquisa e ao(à) orientador(a) pretendido(a)",    "peso": 1, "max": 10 },
      { "key": "historico",   "label": "Histórico Escolar (Coeficiente de Rendimento Acadêmico)",                                       "peso": 1, "max": 10 },
      { "key": "lattes",      "label": "Currículo Lattes",                                                                              "peso": 1, "max": 10 },
      { "key": "video",       "label": "Vídeo de Apresentação/Carta de Intenção direcionada ao(à) orientador(a) pretendido(a)",         "peso": 1, "max": 10 }
    ],
    "bonus": { "label": "Ação Afirmativa \"Ciência Delas\"", "percent": 10, "aplicaSe": "sexo=feminino" },
    "regraGenero": "Havendo candidatas suficientes, a lista final terá ao menos 50% de mulheres.",
    "documentos": [
      { "kind": "carta",     "label": "Carta de intenção (até 4.000 caracteres, PDF)" },
      { "kind": "plano",     "label": "Plano de Atividades (até 6.000 caracteres, PDF)" },
      { "kind": "historico", "label": "Histórico escolar + comprovante de matrícula (PDF)" },
      { "kind": "lattes",    "label": "Currículo Lattes atualizado (PDF)" }
    ],
    "estados": [
      { "uf": "RO", "nome": "Rondônia",            "vagas": 15, "instituicoes": "FIOCRUZ RO, UNIR, IFRO, Afya São Lucas, IESPRO, FIMCA, FAAr, FCR, ECOPORÉ, CEPEM, CEMETRON, CCIPWP",
        "orientadores": ["Adnilson de Almeida Silva", "Adriana Cristina da Silva Nunes", "Alexandre de Almeida e Silva", "Anderson Makoto Kayano", "Andreimar Martins Soares", "Angelo Laurence Covatti Terra", "Antonio Coutinho Neto", "Antônio Laffayete Pires da Silveira", "Arlindo Gonzaga Branco Junior", "Carolina Bioni Garcia Teles", "Chicoepab Suruí Dias", "Dorisvalder Dias Nunes", "Edney Costa Souza", "Elieth Afonso de Mesquita", "Elisabete Lourdes do Nascimento", "Estevão Rafael Fernandes", "Gean Carla da Silva Sganderla", "Graziela Tosini Tejas", "João Paulo Assis Gobo", "Kayena Delaix Zaqueo", "Leidiane Amorim Soares", "Luís Marcelo Aranha Camargo", "Marcela Alvares Oliveira", "Marcela Milrea Araújo Barros", "Marcelo Lucian Ferronato", "Marcos Barros Luiz", "Maria Aurea Pinheiro de Almeida Silveira", "Michel Watanabe", "Mônica Pereira Lima Cunha", "Osvanda Silva de Moura", "Paulo Vilela Cruz", "Rafaela Diniz Sousa", "Reginaldo Martins da Silva de Souza", "Rodrigo Simões Silva", "Ronaldo de Almeida", "Rubiani de Cassia Pagotto", "Saymon de Albuquerque", "Sergio de Almeida Basano", "Sérgio Nunes de Jesus", "Wanderley Rodrigues Bastos", "William Cristian da Silva Pizzaia", "Wilson Gómez Manrique", "Xênia de Castro Barbosa"] },
      { "uf": "RR", "nome": "Roraima",             "vagas": 2,  "instituicoes": "UFRR",
        "orientadores": ["Cléria Mendonça de Moraes", "Fabiana Nakashima", "Gabriel Zazeri"] },
      { "uf": "AM", "nome": "Amazonas",            "vagas": 5,  "instituicoes": "UFAM, FIOCRUZ AM, IFAM, INPA",
        "orientadores": ["Henrique Pereira", "João Cândido André da Silva Neto", "Juliane Corrêa Glória", "Késsia Caroline Souza Alves", "Luis André Morais Mariúba", "Marcelo Rodrigues dos Anjos", "Maria Edilene Martins de Almeida", "Natacha Cintia Regina Aleixo", "Priscila Ferreira de Aquino", "Rafael Ademir Oliveira de Andrade", "Renato Abreu de Lima", "Rudson de Jesus Holanda"] },
      { "uf": "PA", "nome": "Pará",                "vagas": 4,  "instituicoes": "UFPA, UFOPA",
        "orientadores": ["Ana Carla dos Santos Gomes", "Consuelo Yumiko Yoshioka e Silva", "Lucas Vaz Peres", "Milton Nascimento da Silva", "Paulo Wender Portal Gomes", "Raphael Pablo Tapajós Silva", "Wandson Braamcamp de Souza Pinheiro", "Wilson Sabino"] },
      { "uf": "MA", "nome": "Maranhão",            "vagas": 2,  "instituicoes": "UFMA, UEMA",
        "orientadores": ["Eduardo Bezerra de Almeida Junior", "Eliana Campêlo Lago"] },
      { "uf": "TO", "nome": "Tocantins",           "vagas": 1,  "instituicoes": "UFT",
        "orientadores": ["Alex Sander Rodrigues Cangussu"] },
      { "uf": "AP", "nome": "Amapá",               "vagas": 3,  "instituicoes": "UNIFAP",
        "orientadores": ["Irlon Maciel Ferreira", "Lorane Izabel da Silva Hage Melim", "Rodrigo Alves Soares Cruz"] },
      { "uf": "MT", "nome": "Mato Grosso",         "vagas": 2,  "instituicoes": "UFMT",
        "orientadores": ["Evandro Luiz Dall'Oglio", "Leonardo Gomes de Vasconcelos"] },
      { "uf": "AL", "nome": "Alagoas",             "vagas": 2,  "instituicoes": "UFAL",
        "orientadores": ["Dimas de Barros Santiago", "José Francisco de Oliveira Júnior", "Micejane da Silva Costa", "Washington Luiz Félix Correia Filho"] },
      { "uf": "CE", "nome": "Ceará",               "vagas": 3,  "instituicoes": "UFC, FIOCRUZ CE",
        "orientadores": ["Alice Maria Costa Martins", "Roberta Jeane Bezerra Jorge", "Roberto Nicolete", "Robson Waldemar Ávila"] },
      { "uf": "PB", "nome": "Paraíba",             "vagas": 1,  "instituicoes": "UEPB",
        "orientadores": ["Karla Patrícia de Oliveira Luna"] },
      { "uf": "PE", "nome": "Pernambuco",          "vagas": 1,  "instituicoes": "FIOCRUZ PE",
        "orientadores": ["Norma Lucena Cavalcanti Licinio da Silva"] },
      { "uf": "PI", "nome": "Piauí",               "vagas": 1,  "instituicoes": "FIOCRUZ PI",
        "orientadores": ["Antonio Marques Junior"] },
      { "uf": "SE", "nome": "Sergipe",             "vagas": 1,  "instituicoes": "UFS",
        "orientadores": ["Pablo Ariel Martinez"] },
      { "uf": "RN", "nome": "Rio Grande do Norte", "vagas": 2,  "instituicoes": "UFRN",
        "orientadores": ["David Mendes", "Francisco Jablinski Castelhano", "Monica Cristina Damião Mendes"] },
      { "uf": "MS", "nome": "Mato Grosso do Sul",  "vagas": 2,  "instituicoes": "UFGD",
        "orientadores": ["Amanda Trindade Amorim", "Bruno de Souza Lima", "Charlei Aparecido da Silva", "Lorrane Barbosa Alves", "Patricia Silva Ferreira", "Rafael Brugnolli Medeiros"] },
      { "uf": "DF", "nome": "Distrito Federal",    "vagas": 2,  "instituicoes": "UnB, FIOCRUZ BSB",
        "orientadores": ["Jorge Otávio Maia Barreto", "Osmindo Rodrigues Pires Júnior"] },
      { "uf": "GO", "nome": "Goiás",               "vagas": 1,  "instituicoes": "UFJ",
        "orientadores": ["Mirian Machado Mendes"] }
    ]
  }
  $json$::jsonb
)
on conflict (slug) do nothing;
