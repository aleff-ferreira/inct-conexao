-- ============================================================================
--  INCT-CONEXAO · 012 — vínculo automático do líder ao laboratório (lla_user_id)
-- ============================================================================
--  Rode no SQL Editor DEPOIS de 001→011. Funciona antes ou depois das seeds
--  001/002 e do patch de nomes — o backfill e a sanidade apenas encontram
--  menos linhas se rodarem antes.
--
--  O PROBLEMA QUE ESTA MIGRAÇÃO RESOLVE
--  ------------------------------------
--  Quem decide o acesso ao Formulário do Laboratório é
--  `laboratorios.lla_user_id`: `is_lla_de()` (005, seção 4) olha ESSA coluna,
--  não o papel. A seed 002 dá aos 28 líderes o papel 'lla' e o laboratório da
--  proposta, mas `lla_user_id` só pode existir depois que o líder ENTRA — e o
--  passo manual prometido no cabeçalho da seed ("assim que os líderes tiverem
--  entrado, rode…") dependia de alguém lembrar de rodá-lo. Resultado real em
--  10/08/2026: a coluna está vazia nos 28, e o líder identificado cai na tela
--  de membro comum. Esta migração torna o vínculo automático (trigger) e o
--  executa uma vez para quem já se identificou antes dela (backfill).
--
--  POR QUE O GATILHO SÓ ESCUTA `user_id` — A ARMADILHA QUE ELE NÃO PODE ABRIR
--  --------------------------------------------------------------------------
--  A 007 deixa o membro trocar o próprio `laboratorio_id` livremente. Um
--  gatilho ingênuo — "sempre que um líder apontar para um laboratório sem
--  dono, grava" — deixaria um líder já identificado TROCAR de laboratório e
--  herdar a liderança de outro laboratório cujo `lla_user_id` ainda está
--  nulo. Por isso o vínculo só acontece NO MOMENTO em que `user_id` passa de
--  nulo a não-nulo — a identificação da 006 (`reivindicar_cadastro` + link
--  mágico, `vincular_meu_cadastro`, ou o trigger irmão da 005 no INSERT em
--  auth.users). Nesse instante `nome` e `laboratorio_id` ainda são os
--  importados da proposta, porque linha não reivindicada é inalcançável pelo
--  membro (RLS `membros_self_update` exige user_id = auth.uid(), e a linha
--  ainda não tem dono).
--
--  A TRIPLA COINCIDÊNCIA exigida para gravar:
--   1. papel = 'lla'            — travado pela `guard_membro_self` (007): só a
--                                 coordenação altera papel;
--   2. laboratorio_id = l.id    — o laboratório atribuído na PROPOSTA
--                                 (seed 002, campo "lab"), não um que a pessoa
--                                 tenha escolhido depois;
--   3. l.lla_nome = m.nome      — a grafia do líder confere com a do
--                                 laboratório (patch de nomes = grafia
--                                 canônica).
--
--  E DUAS RECUSAS deliberadas:
--   • NUNCA sobrescreve `lla_user_id` não-nulo — atribuição manual da
--     coordenação vence sempre, inclusive contra re-identificações;
--   • NÃO escuta UPDATE de `nome` nem de `laboratorio_id` — renomear-se ou
--     trocar de laboratório DEPOIS de identificado não redispara nada.
--
--  IDEMPOTENTE: create or replace + drop trigger if exists; o backfill só
--  preenche o que está nulo. Rodar de novo não muda nada.
-- ============================================================================


-- ================================================= 1. O GATILHO DO VÍNCULO ==
-- SECURITY DEFINER porque quem dispara é o próprio membro ao se identificar, e
-- a RLS de `laboratorios` (005) não dá UPDATE a membro comum — o vínculo é uma
-- consequência administrativa da identificação, não um poder da pessoa.
create or replace function public.vincular_lla_ao_laboratorio()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Só no instante em que a linha GANHA dono: INSERT já com user_id (importação
  -- da coordenação) ou UPDATE nulo → não-nulo (identificação da 006). Uma linha
  -- que já tinha dono não redispara — é isso que fecha a troca de conta e o
  -- PATCH que reenvia o próprio user_id junto com um laboratorio_id alheio.
  if new.user_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.user_id is not null then return new; end if;

  -- Tripla coincidência (ver cabeçalho). `ativo` porque linha desativada não
  -- autoriza nada; `ciclo_id` por consistência — o laboratório tem de ser do
  -- mesmo ciclo da linha do roster.
  if new.papel <> 'lla' or not new.ativo or new.laboratorio_id is null then
    return new;
  end if;

  update public.laboratorios l
     set lla_user_id = new.user_id
   where l.id       = new.laboratorio_id
     and l.ciclo_id = new.ciclo_id
     and l.lla_nome = new.nome          -- grafia divergente NÃO vincula: a
                                        -- sanidade no fim denuncia esses casos
     and l.lla_user_id is null;         -- não-nulo = decisão manual; não se toca
  return new;
end; $$;

-- Função de trigger não é chamável via RPC (o Postgres recusa fora de trigger),
-- mas a revogação segue a higiene da 003/005/006: superfície mínima.
revoke execute on function public.vincular_lla_ao_laboratorio() from public, anon, authenticated;

drop trigger if exists ciclo_membros_vincula_lla on public.ciclo_membros;
create trigger ciclo_membros_vincula_lla
  after insert or update of user_id on public.ciclo_membros
  for each row execute function public.vincular_lla_ao_laboratorio();


-- ========== 1b. GRAFIA — os dois acentos que a proposta perdeu no roster =====
-- O catálogo (equipe.json, _meta.divergenciasDeGrafia) documenta que a lista
-- revisada por humano VENCE em divergência de grafia — e para estes dois
-- líderes a proposta perdeu acentos que o laboratório (lla_nome, patch de
-- nomes) tem certos. Sem esta normalização, a tripla coincidência do gatilho
-- nunca casaria para eles e o vínculo automático cobriria 26/28.
-- Hardcoded de propósito: explícito, auditável, sem depender da extensão
-- unaccent; idempotente (a segunda passada casa zero linhas). O guard da 007
-- não bloqueia: `nome` não está na lista de colunas travadas.
update public.ciclo_membros
   set nome = 'Estevão Rafael Fernandes'
 where nome = 'Estevao Rafael Fernandes' and papel = 'lla';
update public.ciclo_membros
   set nome = 'Luis André Morais Mariúba'
 where nome = 'Luis Andre Morais Mariuba' and papel = 'lla';

-- ============================== 2. BACKFILL — líderes que já se identificaram
-- O mesmo update do gatilho, com as MESMAS guardas (inclusive a grafia): quem
-- se identificou antes da 012 e depois trocou de laboratório ou de nome fica
-- de fora — exatamente como ficaria se o gatilho existisse desde o início.
-- Idempotente: `lla_user_id is null` faz a segunda passada preencher zero.
with preenchidos as (
  update public.laboratorios l
     set lla_user_id = m.user_id
    from public.ciclo_membros m
   where m.ciclo_id       = l.ciclo_id
     and m.laboratorio_id = l.id
     and m.papel          = 'lla'
     and m.ativo
     and m.user_id is not null
     and l.lla_nome = m.nome
     and l.lla_user_id is null
  returning l.id
)
select count(*) as "lla_user_id preenchidos por este backfill" from preenchidos;


-- ================================================================ 3. SANIDADE
-- (a) Dos laboratórios FORMAIS (ordem < 200, os 28 da proposta): quantos têm
--     `lla_nome` com correspondência EXATA no roster (mesmo laboratório, papel
--     'lla', mesma grafia). Cada linha fora disso é um líder que NÃO será
--     vinculado automaticamente — melhor denunciar aqui do que falhar em
--     silêncio quando o líder entrar.
--     SAÍDA ESPERADA na base semeada (seeds 001/002 + patch de nomes): com a
--     normalização da seção 1b, **28 de 28 casam** e a lista abaixo volta
--     VAZIA. (Antes da 1b eram 26/28 — LabLat e DCDIA, acento perdido no
--     roster.) Qualquer linha na lista é novidade: investigue antes de seguir.
select count(*) filter (where existe_correspondencia)     as "formais com grafia casada",
       count(*) filter (where not existe_correspondencia) as "formais SEM correspondência exata",
       count(*)                                           as "laboratórios formais"
  from (select l.id,
               exists (select 1 from public.ciclo_membros m
                        where m.ciclo_id = l.ciclo_id
                          and m.laboratorio_id = l.id
                          and m.papel = 'lla' and m.ativo
                          and m.nome = l.lla_nome) as existe_correspondencia
          from public.laboratorios l
         where l.ordem < 200 and l.ativo) s;

-- A LISTA do que não casou — grafia divergente entre proposta (roster) e
-- laboratório. Para cada linha: ou a coordenação corrige a grafia de um dos
-- lados ANTES de o líder entrar, ou preenche `lla_user_id` à mão DEPOIS
-- (update public.laboratorios set lla_user_id = <user_id do membro> where id = <lab>).
select l.sigla,
       l.lla_nome                                     as "lla_nome (laboratorios)",
       coalesce(m.nome, '(nenhum membro papel=lla aponta para este laboratório)')
                                                      as "nome (ciclo_membros)",
       case when m.user_id is not null then 'JÁ IDENTIFICADO — vincule à mão'
            else 'ainda não entrou' end               as situacao
  from public.laboratorios l
  left join public.ciclo_membros m
    on m.ciclo_id = l.ciclo_id and m.laboratorio_id = l.id
   and m.papel = 'lla' and m.ativo
 where l.ordem < 200 and l.ativo
   -- o MESMO critério da contagem acima (not exists de correspondência exata),
   -- para que a lista tenha exatamente as linhas que a contagem chama de "SEM":
   -- um laboratório que TEM o par exato não entra, mesmo que um segundo membro
   -- 'lla' divergente também aponte para ele.
   and not exists (select 1 from public.ciclo_membros x
                    where x.ciclo_id = l.ciclo_id and x.laboratorio_id = l.id
                      and x.papel = 'lla' and x.ativo and x.nome = l.lla_nome)
 order by l.ordem;

-- (b) O estado da coluna depois do backfill: quantos formais já têm dono.
--     (No dia da aplicação, igual ao nº de líderes que já se identificaram.)
select count(*) filter (where lla_user_id is not null) as "formais com lla_user_id preenchido",
       count(*) filter (where lla_user_id is null)     as "formais ainda sem dono"
  from public.laboratorios
 where ordem < 200 and ativo;

-- (c) O trigger existe e escuta as colunas certas (esperado: 1 linha,
--     colunas = {user_id}).
select t.tgname,
       (select array_agg(a.attname order by a.attname)
          from unnest(t.tgattr::int2[]) as col
          join pg_attribute a on a.attrelid = t.tgrelid and a.attnum = col) as colunas_escutadas
  from pg_trigger t
 where t.tgname = 'ciclo_membros_vincula_lla';
