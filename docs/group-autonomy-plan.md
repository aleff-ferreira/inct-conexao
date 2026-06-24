# Autonomia dos líderes de grupo — avaliação e plano

> **STATUS: REFERÊNCIA FUTURA (NÃO ATIVO).** O site hoje é **100% estático, sem
> backend e sem login** — webinars e grupos são editados em `src/webinars/data.ts`
> e publicados via build + upload (ver `HOSTING.md`). Este documento foi preservado
> como **projeto de referência** caso um dia se queira dar aos líderes de grupo
> autonomia self-service (login + edição pelo navegador). Ele descreve um backend
> Supabase multi-tenant (papéis/propriedade por grupo via RLS) que chegou a ser
> implementado e testado, mas foi **removido** a pedido — o SQL completo está inline
> mais abaixo, pronto para retomar. Os arquivos citados (`supabase/schema.sql`,
> `Admin.tsx`, `supabase/SETUP.md`) **não existem mais** no repositório; trate-os
> como pseudo-referências do desenho, não como código atual.

## Veredito curto

- **O login funciona** (autenticação Supabase, gating, CRUD, publicação instantânea — verificado por testes unitários + e2e).
- **O modelo de autorização atual NÃO é suficiente para dar autonomia por grupo.** Hoje há
  uma única tabela `admins`: quem está nela pode **ler e escrever TODOS os webinars**
  (`supabase/schema.sql`, política "admin escreve" → `for all ... using (exists em admins)`,
  **sem nenhum recorte por dono/grupo**).
- **Risco concreto:** se simplesmente adicionarmos os líderes de grupo à tabela `admins`,
  **cada líder poderá editar e apagar os webinars de qualquer outro grupo** (acidental ou
  intencionalmente). Isso não é "autonomia sobre o próprio grupo" — é super-admin global
  compartilhado.

> **Conclusão:** antes de dar acesso a líderes de grupo, é preciso adicionar uma camada de
> **grupos + propriedade (ownership) + papéis (roles)**. É exatamente a feature "descrição
> do grupo" que vem a seguir — ela traz junto o modelo multi-inquilino. O plano abaixo é
> pronto para implementar.

## Modelo alvo

Três papéis de dados:

| Entidade | Para quê |
|---|---|
| `groups` | Cada grupo de pesquisa do INCT: nome, sigla, **descrição**, líder, logo, capa, links, `published`. (É a feature "descrição do grupo".) |
| `profiles` | Liga cada usuário do Auth a um **papel** e ao seu **grupo**. |
| `webinars.group_id` | Dono de cada webinar = um grupo. |

Papéis (`app_role`):
- **`super_admin`** (coordenação central do INCT): gerencia todos os grupos, todos os
  webinars, cria grupos e designa líderes.
- **`group_leader`**: gerencia **apenas o próprio grupo** — a descrição do grupo e os
  webinars do grupo. Não enxerga/edita conteúdo de outros grupos.

## SQL (pronto para colar no Supabase) — substitui o `admins` por `profiles`

```sql
create type public.app_role as enum ('super_admin', 'group_leader');

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  acronym     text,
  description text,              -- a "descrição do grupo"
  leader_name text,
  institution text,
  cover_image text,
  links       jsonb default '[]'::jsonb,
  published   boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table public.profiles (
  id       uuid primary key references auth.users(id) on delete cascade,
  email    text,
  role     public.app_role not null default 'group_leader',
  group_id uuid references public.groups(id) on delete set null
);

alter table public.webinars add column group_id uuid references public.groups(id) on delete set null;

-- Funções SECURITY DEFINER evitam recursão de RLS ao ler profiles dentro das políticas.
create or replace function public.is_super_admin() returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin');
  $$;
create or replace function public.my_group_id() returns uuid
  language sql security definer stable set search_path = public as $$
    select group_id from public.profiles where id = auth.uid();
  $$;

-- RLS: groups
alter table public.groups enable row level security;
create policy "público lê grupos publicados" on public.groups for select using (published = true);
create policy "super admin: grupos (tudo)"   on public.groups for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "líder lê o próprio grupo"      on public.groups for select to authenticated
  using (id = public.my_group_id());
create policy "líder edita o próprio grupo"   on public.groups for update to authenticated
  using (id = public.my_group_id()) with check (id = public.my_group_id());

-- RLS: webinars (substitui as políticas baseadas em admins)
alter table public.webinars enable row level security;
create policy "público lê webinars publicados" on public.webinars for select using (published = true);
create policy "super admin: webinars (tudo)"   on public.webinars for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "líder gerencia webinars do grupo" on public.webinars for all to authenticated
  using (group_id = public.my_group_id())
  with check (group_id = public.my_group_id());   -- impede reatribuir a outro grupo

-- RLS: profiles
alter table public.profiles enable row level security;
create policy "lê o próprio profile"   on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin());
create policy "super admin: profiles"  on public.profiles for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
```

Pontos-chave de segurança:
- As políticas permissivas se **somam** (OR): um `super_admin` casa a política "tudo"; um
  `group_leader` casa só as do próprio grupo. Um usuário sem perfil não escreve nada.
- O `with check (group_id = my_group_id())` impede um líder de **criar/mover** um webinar
  para o grupo de outro.
- `is_super_admin()`/`my_group_id()` são `security definer` para não recursar nas políticas
  de `profiles`.

## Mudanças no app (próxima implementação)

1. **`store.ts`**
   - `useSession()` passa a expor `{ role, groupId }` (lido de `profiles`).
   - Novas leituras públicas: `useGroups()` / `useGroup(slug)` (REST, igual aos webinars).
   - CRUD de grupos (`saveGroup`) e o webinar CRUD setando `group_id` (líder = automático;
     super-admin = escolhe).
2. **`Admin.tsx`** vira **ciente de papel**:
   - **Líder de grupo:** vê só os webinars do seu grupo + um editor "Meu grupo" (descrição,
     capa, links). O `group_id` é definido automaticamente (escondido) ao criar webinar.
   - **Super-admin:** vê tudo + gestão de grupos + designação de líderes (criar usuário no
     Auth e gravar `profiles.role/group_id`).
3. **Público — nova seção "Grupos"** (a descrição dos grupos): um hub `/#/grupos` + páginas
   `/#/grupos/<slug>`, reaproveitando o mesmo padrão visual do hub/evento de webinars. Cada
   webinar pode linkar para o grupo dono.
4. **`router.ts`**: adicionar rotas `#/grupos` e `#/grupos/<slug>`.

## Caminho de migração (incremental, baixo risco)

1. **Fase 1 — fundação multi-grupo:** criar `groups`/`profiles`, adicionar `webinars.group_id`,
   trocar as políticas RLS de `admins` para o modelo acima, migrar o operador atual para
   `profiles` como `super_admin`. (Os webinars existentes ficam sem grupo / pertencentes ao
   super-admin até serem atribuídos.)
2. **Fase 2 — descrição dos grupos (público + admin):** seção pública "Grupos" + editor do
   grupo no admin. Entrega a "descrição do grupo".
3. **Fase 3 — autonomia dos líderes:** UI do admin ciente de papel; criar os usuários dos
   líderes e atribuí-los aos grupos. A partir daí cada líder entra e gerencia só o seu grupo.

## Decisões em aberto (para alinhar antes de implementar)

- **Um líder = um grupo, ou vários?** O modelo acima assume 1 grupo por líder. Para vários,
  troca-se `profiles.group_id` por uma tabela `group_members(group_id, user_id)` e as funções
  passam a retornar um conjunto de grupos. (Recomendo começar com 1:1 e evoluir se preciso.)
- **Webinar precisa pertencer a um grupo?** Sugiro permitir webinars "institucionais"
  (sem grupo, só super-admin) além dos webinars de grupo.
- **Quem cria contas de líder?** Recomendo: só super-admin (via painel), mantendo o cadastro
  público desligado.
- **Recuperação de senha:** se os líderes forem se autoatender, configurar SMTP próprio no
  Supabase (o e-mail embutido é só de teste, ~2/h) — ver `HOSTING.md`.
