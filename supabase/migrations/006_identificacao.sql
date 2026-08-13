-- ============================================================================
--  INCT-CONEXAO · 006: Identificação do pesquisador (catálogo + reivindicação)
-- ============================================================================
--  Rode o ARQUIVO INTEIRO de uma vez no SQL Editor.
--  ORDEM: 001 → 002 → 003 → 004 → 005 → **006** → seeds/001_ciclo_1.sql →
--         seeds/002_equipe.sql.  A semente 002 usa as colunas criadas aqui e
--         NÃO roda antes desta migração.
--  IDEMPOTENTE: reaplicar não duplica coluna, índice, constraint nem função.
--
--  ATENÇÃO À ORDEM INVERSA: a seção 2 deste arquivo faz `create or replace` em
--  public.guard_membro_self(), que nasceu na 005. Se algum dia você reaplicar a
--  005 DEPOIS desta, reaplique a 006 em seguida — senão a versão da 005 volta e
--  o vínculo de quem já tinha conta para de funcionar (falha explícita, com a
--  mensagem "Estes campos do cadastro só a coordenação altera", nunca em
--  silêncio).
--
--  ==========================================================================
--  O PROBLEMA QUE ESTE ARQUIVO RESOLVE
--  ==========================================================================
--  A Tela 1 do relato deixou de supor que a pessoa chegou pelo LINK DE CONVITE
--  com a linha do roster já conhecida. Agora ela se ENCONTRA numa busca — as
--  209 pessoas da seção EQUIPE da proposta submetida, catálogo que viaja no
--  bundle (src/content/relato/equipe.json) — e informa o e-mail em que quer
--  receber o link mágico.
--
--  A busca é do BUNDLE e não do banco por uma razão de projeto, não de gosto:
--  antes de ter sessão, a RLS da 005 — corretamente — não devolve UMA LINHA
--  sequer de ciclo_membros. A única superfície que este módulo expõe sem sessão
--  é a RPC deste arquivo, e ela recebe um id de catálogo por vez.
--
--  ==========================================================================
--  POR QUE EXISTE E-MAIL PLACEHOLDER (e por que ele é `.invalid`)
--  ==========================================================================
--  A proposta submetida NÃO traz o e-mail de ninguém: traz 190 links de Lattes
--  e nenhum contato. E `ciclo_membros.email` é NOT NULL e único por ciclo.
--  Esperar que a coordenação levantasse 209 endereços seria um bloqueio ANTES
--  do disparo — então as 209 linhas nascem com um endereço de reserva:
--
--        <id-do-catalogo>@pendente.inct-conexao.invalid
--
--  `.invalid` é TLD reservado pela RFC 2606: nunca resolve, nunca recebe
--  mensagem, não existe risco de disparar e-mail para lugar nenhum por engano.
--  O endereço é derivado do id do catálogo, então é único por construção e a
--  semente é idempotente sem inventar endereço de ninguém.
--
--  A coluna `email_pendente` diz, sem interpretação, se o endereço da linha é
--  de reserva ou é de verdade — e um CHECK amarra as duas coisas nos dois
--  sentidos, de modo que é impossível marcar um e-mail real como pendente ou
--  deixar um placeholder passando por real.
--
--  ==========================================================================
--  AS TRÊS MEDIDAS DE HIGIENE (decisão do dono, 05/08/2026)
--  ==========================================================================
--  O risco residual é conhecido e aceito: alguém poderia escolher o nome de
--  outra pessoa na busca. É rede acadêmica fechada, o formulário não move
--  dinheiro, o relato é assinado com declaração de veracidade e protocolo, e os
--  fatos coletivos ainda passam pela conferência do líder do laboratório. O que
--  este arquivo garante é que qualquer engano seja VISÍVEL e REVERSÍVEL:
--
--   (a) VÍNCULO DE UMA VEZ SÓ. Assim que a linha ganha e-mail real (ou user_id),
--       ela não é reivindicada de novo. A segunda pessoa recebe o e-mail
--       mascarado de quem chegou primeiro — o conflito aparece ALTO.
--   (b) REGISTRO NO LOG. Toda tentativa que toca uma linha do roster entra em
--       relato_eventos (entidade = 'membro'), com data, id do catálogo, e-mail
--       informado e desfecho. A coordenação lê tudo.
--   (c) A COORDENAÇÃO DESFAZ. O SQL está logo abaixo.
--
--  ==========================================================================
--  DESFAZER UM VÍNCULO  — a coordenação, no SQL Editor do Supabase
--  ==========================================================================
--  Solta a linha e a devolve ao estado "ninguém reivindicou ainda", de modo que
--  a pessoa CERTA possa se identificar. Uma instrução só; as três colunas mudam
--  juntas porque o CHECK exige coerência entre elas.
--
--    update public.ciclo_membros
--       set email              = catalogo_id || '@pendente.inct-conexao.invalid',
--           email_pendente     = true,
--           user_id            = null,
--           primeiro_acesso_em = null,
--           reivindicado_em    = null
--     where ciclo_id    = (select id from public.relatorio_ciclos where slug = 'ciclo-1')
--       and catalogo_id = 'nome-da-pessoa-no-catalogo';   -- id de equipe.json
--
--  Depois disso a pessoa errada continua com CONTA no sistema (auth.users não é
--  tocado — apagar conta alheia não é operação de desfazer vínculo), mas não é
--  mais membro do ciclo: sem linha no roster, a RLS não devolve nada. Se ela
--  tiver criado um relato, ele continua existindo com o user_id dela; decida o
--  que fazer com o relato ANTES de soltar a linha:
--
--    select r.id, r.status, r.protocolo, m.nome, m.catalogo_id
--      from public.relatos r
--      join public.ciclo_membros m on m.id = r.membro_id
--     where m.catalogo_id = 'nome-da-pessoa-no-catalogo';
--
--  VER QUEM REIVINDICOU O QUÊ (e o que foi recusado):
--
--    select e.at,
--           e.status                        as desfecho,
--           e.snapshot ->> 'catalogo_id'     as catalogo_id,
--           e.snapshot ->> 'email_informado' as email_informado,
--           m.nome
--      from public.relato_eventos e
--      left join public.ciclo_membros m on m.id = e.entidade_id
--     where e.entidade = 'membro'
--     order by e.at desc;
--
--  QUEM AINDA NÃO SE IDENTIFICOU (o denominador do lembrete):
--
--    select count(*) filter (where email_pendente)      as nao_identificados,
--           count(*) filter (where not email_pendente)  as identificados,
--           count(*) filter (where user_id is not null) as ja_entraram
--      from public.ciclo_membros
--     where ciclo_id = (select id from public.relatorio_ciclos where slug = 'ciclo-1');
-- ============================================================================


-- ============================================== 1. COLUNAS DA IDENTIFICAÇÃO ==
-- catalogo_id  → chave estável do registro em src/content/relato/equipe.json
--                (slug do nome: 'aldani-braz-carvalho'). É por ele que a tela,
--                SEM SESSÃO, aponta para a linha do roster. Não é segredo: o
--                catálogo inteiro viaja no bundle do site.
-- email_pendente → o endereço da linha é de reserva (`.invalid`), não é real.
-- reivindicado_em → quando a pessoa informou o e-mail dela. Diferente de
--                primeiro_acesso_em (quando de fato entrou) e de convidado_em
--                (quando a coordenação disparou convite — que nestas 209 linhas
--                é NULO de propósito: ninguém foi convidado por e-mail ainda).
alter table public.ciclo_membros add column if not exists catalogo_id     text;
alter table public.ciclo_membros add column if not exists email_pendente  boolean not null default false;
alter table public.ciclo_membros add column if not exists reivindicado_em timestamptz;

-- Formato do id: o mesmo slug que equipe.json gera. Barra id inventado.
do $$
begin
  alter table public.ciclo_membros
    add constraint ciclo_membros_catalogo_formato
    check (catalogo_id is null or catalogo_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
exception when duplicate_object then null;
end $$;

-- A AMARRA NOS DOIS SENTIDOS. `email_pendente` não é um rótulo que alguém
-- lembra de manter: ele é EQUIVALENTE a "o endereço está no domínio de
-- reserva". Assim é impossível (a) marcar como pendente um e-mail real — o que
-- deixaria a linha reivindicável de novo por qualquer um — e (b) deixar um
-- placeholder passando por endereço real, que é o que faria a coordenação
-- disparar convite para o vazio.
do $$
begin
  alter table public.ciclo_membros
    add constraint ciclo_membros_email_pendente_coerente
    check (email_pendente = (email like '%@pendente.inct-conexao.invalid'));
exception when duplicate_object then null;
end $$;

-- Linha com endereço de reserva NUNCA tem dono. Se um dia alguém tentar casar
-- user_id numa linha ainda não reivindicada, o banco recusa.
do $$
begin
  alter table public.ciclo_membros
    add constraint ciclo_membros_pendente_sem_dono
    check (not email_pendente or user_id is null);
exception when duplicate_object then null;
end $$;

-- Um registro do catálogo pertence a UMA linha por ciclo. É este índice que faz
-- o "vínculo de uma vez só" ser garantia de schema, e não convenção de tela.
create unique index if not exists ciclo_membros_catalogo_unico
  on public.ciclo_membros (ciclo_id, catalogo_id) where catalogo_id is not null;

-- Filtro do painel "quem ainda não se identificou".
create index if not exists ciclo_membros_pendente_idx
  on public.ciclo_membros (ciclo_id) where email_pendente;


-- ==================== 2. GUARDA DO AUTOCADASTRO (SUBSTITUI A VERSÃO DA 005) ==
--  ESTA FUNÇÃO SUBSTITUI public.guard_membro_self() DA 005. O corpo abaixo é o
--  da 005 palavra por palavra, MAIS DUAS exceções — e mais dois campos novos na
--  lista do que só a coordenação altera (catalogo_id e email_pendente). Editar
--  a cópia que está na 005 não tem efeito nenhum: a versão vigente é ESTA.
--
--    EXCEÇÃO 1 — a pessoa assume a linha que já traz o e-mail verificado dela
--                (é o que vincular_meu_cadastro() faz, seção 6).
--    EXCEÇÃO 2 — a linha sai do e-mail de reserva para o e-mail informado
--                (é o que reivindicar_cadastro() faz, seção 5, quando quem
--                chama já tem sessão aberta).
--
--  POR QUE A EXCEÇÃO 1 EXISTE
--  O vínculo roster ↔ conta acontece, na 005, por um trigger em `auth.users`
--  que só dispara no INSERT — ou seja, só para quem NUNCA teve conta neste
--  projeto. Quem já tem (a coordenação, o pessoal da seleção de IC) entra pelo
--  link mágico sem gerar INSERT nenhum: a conta autentica, mas a linha do
--  roster continua com user_id nulo e a RLS recusa o primeiro rascunho com um
--  erro opaco e sem saída pela tela. É exatamente a armadilha que a própria 005
--  descreve na seção 15 — e ela também vale para o caminho de DESFAZER acima:
--  depois que a coordenação solta uma linha, a pessoa certa reivindica, e se
--  ela já tiver conta ficaria travada para sempre.
--
--  O QUE A EXCEÇÃO 1 PERMITE — e por que ela não afrouxa nada
--  Somente: assumir uma linha SEM DONO cujo e-mail já gravado é EXATAMENTE o
--  e-mail verificado da conta que está pedindo. Nada mais muda na linha (papel,
--  categoria, laboratório, e-mail, token e ativo têm de vir idênticos). Ou
--  seja: a pessoa só recebe o que já receberia pelo link mágico se a conta
--  dela ainda não existisse. `papel` continua intocável — a escalação de
--  privilégio que a 005 descreve segue barrada, e é bom reler aquele bloco
--  antes de mexer em qualquer linha daqui.
create or replace function public.guard_membro_self()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Sem sessão de usuário final (trigger interno de 1º acesso, service_role,
  -- importação da coordenação pelo SQL Editor) o guarda não se aplica: ele
  -- existe para conter o MEMBRO logado, não o servidor. Sem esta linha, o
  -- trigger irmão da seção 15 da 005 não consegue gravar user_id no primeiro
  -- acesso.
  if auth.uid() is null then return new; end if;
  if public.is_coordenacao(new.ciclo_id) then return new; end if;

  -- ---- EXCEÇÃO 1 DA 006 (ver o bloco acima) -------------------------------
  -- Assumir a PRÓPRIA linha, quando ela está sem dono e já traz o e-mail
  -- verificado desta conta. É o que public.vincular_meu_cadastro() faz.
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

  -- ---- EXCEÇÃO 2 DA 006: a reivindicação com sessão aberta ----------------
  -- A linha sai do e-mail de reserva para o e-mail informado pela pessoa, e
  -- NADA MAIS muda. Existe porque quem JÁ ESTÁ AUTENTICADO também usa a tela
  -- de identificação — é o caso de quem veio da seleção de IC, ou de quem
  -- voltou depois de a coordenação desfazer um vínculo — e, dentro da RPC,
  -- auth.uid() não é nulo. Sem esta exceção, `reivindicar_cadastro()` estoura
  -- com "só a coordenação altera" justamente para essas pessoas, e o erro sai
  -- cru na tela em vez de virar um desfecho tratado.
  --
  -- NÃO abre porta pela API, e a razão é a RLS, não a boa vontade: a policy
  -- `membros_self_update` (005) exige `user_id = auth.uid()`, e linha ainda não
  -- reivindicada tem user_id NULO — um PATCH direto do PostgREST não alcança
  -- linha nenhuma. Quem passa por aqui é a função SECURITY DEFINER, que já fez
  -- a checagem de "vínculo de uma vez só" e registrou no log.
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
  -- -------------------------------------------------------------------------

  if new.email          is distinct from old.email
     or new.user_id     is distinct from old.user_id
     or new.ciclo_id    is distinct from old.ciclo_id
     or new.papel       is distinct from old.papel
     or new.categoria_picc is distinct from old.categoria_picc
     or new.convite_token  is distinct from old.convite_token
     or new.ativo       is distinct from old.ativo
     -- acrescentados pela 006: identidade do catálogo e estado do e-mail não
     -- são campos de autoatendimento. Quem os move é a RPC (SECURITY DEFINER,
     -- sem sessão) ou a coordenação.
     or new.catalogo_id    is distinct from old.catalogo_id
     or new.email_pendente is distinct from old.email_pendente then
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


-- ==================================================== 3. MÁSCARA DE E-MAIL ===
-- 'maria.silva@ufam.edu.br' → 'm•••@ufam.edu.br'. O domínio fica inteiro de
-- propósito: é ele que faz a pessoa certa se reconhecer ("ah, foi no meu e-mail
-- institucional") sem entregar o endereço de ninguém a quem só digitou um nome.
-- NÃO é exposta como RPC (revoke no fim do arquivo): só a função de
-- reivindicação a usa, e só no desfecho 'ja_vinculado'.
create or replace function public.mascarar_email(p_email text)
returns text
language sql immutable set search_path = public as $$
  select case
    when p_email is null or position('@' in p_email) < 2 then '•••'
    else left(p_email, 1) || '•••@' || split_part(p_email, '@', 2)
  end;
$$;


-- ================================================= 4. LOG DA REIVINDICAÇÃO ===
-- Medida (b). Append-only pelo mesmo caminho do resto do módulo: relato_eventos
-- não tem policy de insert, então NINGUÉM escreve nela pela API — só funções
-- SECURITY DEFINER. Esta aqui é interna e não recebe grant para anon nem para
-- authenticated: se recebesse, qualquer um poderia forjar entradas no log de
-- auditoria, que é justamente o instrumento com que a coordenação desfaz
-- engano.
create or replace function public.log_reivindicacao(
  p_ciclo    uuid,
  p_membro   uuid,
  p_catalogo text,
  p_email    text,
  p_estado   text)
returns void
language plpgsql security definer set search_path = public as $$
declare snap jsonb;
begin
  snap := jsonb_build_object(
    'catalogo_id',     p_catalogo,
    'email_informado', p_email,
    'estado',          p_estado,
    'em',              now());
  insert into public.relato_eventos
    (ciclo_id, relato_id, entidade, entidade_id, acao, status, campos, por,
     snapshot, snapshot_sha256, at)
  values
    (p_ciclo, null, 'membro', p_membro, 'update', p_estado,
     case when p_estado = 'reivindicado'
          then array['email','email_pendente','reivindicado_em']
          else '{}'::text[] end,
     auth.uid(), snap,
     encode(sha256(convert_to(snap::text, 'UTF8')), 'hex'), now());
end; $$;


-- ==================================================== 5. A REIVINDICAÇÃO =====
--  A ÚNICA superfície deste módulo aberta a quem não tem sessão.
--
--  RECEBE   o id do catálogo (equipe.json) e o e-mail que a pessoa informou.
--  GRAVA    o e-mail na linha do roster — SOMENTE se ela ainda não tiver dono
--           nem endereço real.
--  DEVOLVE  jsonb, NUNCA exceção para desfecho previsto: exceção vira 400 opaco
--           no PostgREST e a tela perde a chance de dizer o que aconteceu.
--
--  DESFECHOS (`estado`), todos com `mensagem` pronta para a tela:
--    'reivindicado'       ok=true   — gravou. A tela pode disparar o link mágico.
--    'ja_seu'             ok=true   — a linha já está com ESTE mesmo e-mail
--                                     (segunda chamada, "não recebi o link").
--    'ja_vinculado'       ok=false  — outra pessoa chegou primeiro. Vem com
--                                     `email_mascarado` para o conflito aparecer.
--    'email_em_uso'       ok=false  — este e-mail já é de OUTRA linha do ciclo.
--    'email_invalido'     ok=false
--    'nao_encontrado'     ok=false  — id fora do catálogo, ou linha inativa.
--    'ciclo_indisponivel' ok=false  — nenhum ciclo aberto agora.
--
--  QUAL CICLO: o aberto (status='aberto' e agora dentro de abre_em/fecha_em).
--  Com mais de um aberto, o de maior `numero`. `p_ciclo_slug` fixa um ciclo
--  específico quando a tela quiser ser explícita.
--
--  O QUE ELA NÃO FAZ, DE PROPÓSITO:
--   • não envia e-mail — o link mágico é `supabase.auth.signInWithOtp` no
--     cliente, imediatamente depois de um retorno com ok=true;
--   • não cria conta, não devolve sessão e não devolve NADA sobre a linha além
--     do nome (que já estava no bundle) e do e-mail mascarado no conflito;
--   • não conta se um e-mail "existe" no sistema.
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


-- ============================================ 6. VÍNCULO DE QUEM JÁ TEM CONTA
-- A outra metade do primeiro acesso. Chamar UMA vez logo depois do login, antes
-- de ler o roster:
--
--    await supabase.rpc('vincular_meu_cadastro');
--
-- Casa a linha do roster que traz o e-mail VERIFICADO desta conta e ainda está
-- sem dono. É o mesmo efeito do trigger `on_auth_user_created_relato` da 005,
-- para quem não passa por INSERT em auth.users porque a conta já existia.
--
-- Chamar de novo não faz nada (as linhas já têm user_id) e não devolve erro.
-- Quem não tem linha nenhuma recebe vinculados=0 — que é a resposta certa, e
-- não um erro: a tela então mostra o caminho da identificação.
create or replace function public.vincular_meu_cadastro()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text; v_n int := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'estado', 'sem_sessao', 'vinculados', 0,
      'mensagem', 'É preciso estar autenticado.');
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if v_email is null or v_email = '' then
    return jsonb_build_object('ok', false, 'estado', 'sem_email', 'vinculados', 0,
      'mensagem', 'Esta conta não tem e-mail verificado.');
  end if;

  update public.ciclo_membros m
     set user_id            = auth.uid(),
         primeiro_acesso_em = coalesce(m.primeiro_acesso_em, now())
   where m.user_id is null
     and m.ativo
     and not m.email_pendente
     and m.email = v_email
     -- Um user_id por ciclo (índice ciclo_membros_user_unico). Se esta conta já
     -- tem linha naquele ciclo, não se cria uma segunda — o UPDATE apenas pula.
     and not exists (select 1 from public.ciclo_membros o
                      where o.ciclo_id = m.ciclo_id and o.user_id = auth.uid());
  get diagnostics v_n = row_count;

  return jsonb_build_object('ok', true, 'estado', 'ok', 'vinculados', v_n);
end; $$;


-- ============================================================== 7. GRANTS ====
-- Mesma lição da 003/005: revogar de PUBLIC (anon e authenticated herdam de
-- PUBLIC; revogar só deles é inócuo) e só então conceder a quem deve.
revoke execute on function public.reivindicar_cadastro(text, text, text) from public;
grant  execute on function public.reivindicar_cadastro(text, text, text) to anon, authenticated;

revoke execute on function public.vincular_meu_cadastro() from public, anon;
grant  execute on function public.vincular_meu_cadastro() to authenticated;

-- Internas: nem anônimo nem autenticado chamam. `log_reivindicacao` escreveria
-- no log de auditoria; `mascarar_email` viraria um oráculo de e-mail alheio se
-- combinada com qualquer outra leitura.
revoke execute on function public.log_reivindicacao(uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.mascarar_email(text) from public, anon, authenticated;


-- ============================================================ 8. SANIDADE ====
select 'colunas novas em ciclo_membros (esperado 3)' as checagem,
       count(*)::text as valor
  from information_schema.columns
 where table_schema = 'public' and table_name = 'ciclo_membros'
   and column_name in ('catalogo_id', 'email_pendente', 'reivindicado_em')
union all select 'funções novas (esperado 4)',
       (select count(*)::text from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('reivindicar_cadastro','vincular_meu_cadastro',
                             'mascarar_email','log_reivindicacao'))
union all select 'anon chama reivindicar_cadastro (deve ser true)',
       has_function_privilege('anon', 'public.reivindicar_cadastro(text,text,text)', 'execute')::text
union all select 'anon chama log_reivindicacao (deve ser false)',
       has_function_privilege('anon', 'public.log_reivindicacao(uuid,uuid,text,text,text)', 'execute')::text
union all select 'anon chama mascarar_email (deve ser false)',
       has_function_privilege('anon', 'public.mascarar_email(text)', 'execute')::text
union all select 'anon chama vincular_meu_cadastro (deve ser false)',
       has_function_privilege('anon', 'public.vincular_meu_cadastro()', 'execute')::text
union all select 'anon lê ciclo_membros direto (deve ser false)',
       has_table_privilege('anon', 'public.ciclo_membros', 'select')::text
union all select 'linhas com e-mail de reserva',
       (select count(*)::text from public.ciclo_membros where email_pendente);
