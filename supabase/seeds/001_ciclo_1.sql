-- ============================================================================
--  INCT-CONEXAO BIO3TOX · Semente do Ciclo 1 do relato anual
--  Processo CNPq 408474/2024-6 · Chamada nº 46/2024
-- ============================================================================
--  RODE **DEPOIS** de supabase/migrations/005_relatos.sql.
--  Cole no SQL Editor do Supabase (Dashboard → SQL Editor → New query) e execute.
--
--  O QUE FAZ
--   1. Cadastra os 28 Laboratórios Associados.
--   2. Põe labioprot.toxin@gmail.com no roster do ciclo, como coordenação.
--   3. Abre o Ciclo 1 para coleta.
--
--  IDEMPOTENTE: rodar de novo não duplica nem sobrescreve o que você editar
--  depois pela interface. Nenhuma linha toca em tabela das migrações 001-004.
--
--  POR QUE É SEGURO ABRIR AGORA
--  O roster tem UMA pessoa. Toda a autorização deste módulo sai de
--  `ciclo_membros` por RLS: quem não está lá não lê nem escreve nada. O convite
--  geral só sai quando o CGES preencher o mapa de EET e a coordenação importar
--  as 209 pessoas.
--
--  ===== TRÊS COISAS QUE ESTE ARQUIVO NÃO PODE RESOLVER =====
--
--  (a) A PROPOSTA NÃO NOMEIA OS LABORATÓRIOS. Ela identifica cada um pelo líder
--      e pela instituição. Então `sigla` e `nome` abaixo são PROVISÓRIOS,
--      derivados da sigla institucional e do rótulo "INSTITUIÇÃO (UF) — Nome do
--      líder". Servem para o líder se reconhecer na lista; não são nome de
--      laboratório. O CGES deve renomear os 28 pela interface antes do convite.
--
--  (b) `eets` VAZIO nos 28. O vínculo laboratório ↔ etapa estratégica não
--      existe na proposta — conferido por reextração do PDF por coordenada. Sem
--      ele, nada que for declarado se classifica por meta, e a pergunta "a que
--      meta isso pertence?" cairia no colo do pesquisador, que é justamente o
--      que o desenho evita. São 28 linhas que só o CGES preenche.
--      **Enquanto estiver vazio, não dispare o convite geral.**
--
--  (c) SEM ROR e SEM E-MAIL dos líderes. A proposta não traz nenhum dos dois
--      (traz o ID Lattes: 27 dos 28). O ROR é o que faz o Indicador nº 3
--      ser contado em vez de digitado, e o e-mail é por onde o convite sai.
--      Ambos entram pela interface. E 9 dos 28 nomes de líder não puderam ser
--      conferidos contra o edital de IC nem contra a proposta — ver
--      `_meta.nomesSemConferencia` em src/content/relato/laboratorios.json.
-- ============================================================================

begin;

-- ------------------------------------------------------ 1. LABORATÓRIOS ----
with ciclo as (select id from public.relatorio_ciclos where slug = 'ciclo-1'),
     dados (sigla, nome, instituicao_nome, uf, lla_nome, lla_lattes, ordem) as (
  values
  ('UFT', 'UFT (TO) — Alex Sander Rodrigues Cangussu', 'Universidade Federal do Tocantins', 'TO', 'Alex Sander Rodrigues Cangussu', '5020204291901063', 1),
  ('UNIR-1', 'UNIR (RO) — Alexandre de Almeida e Silva', 'Universidade Federal de Rondônia', 'RO', 'Alexandre de Almeida e Silva', '6440720566226268', 2),
  ('UFOPA', 'UFOPA (PA) — Ana Carla dos Santos Gomes', 'Universidade Federal do Oeste do Pará', 'PA', 'Ana Carla dos Santos Gomes', '7570030284513470', 3),
  ('UNIR-2', 'UNIR (RO) — Carolina Rodrigues da Costa Doria', 'Universidade Federal de Rondônia', 'RO', 'Carolina Rodrigues da Costa Doria', '6716883529427154', 4),
  ('UFGD', 'UFGD (MS) — Charlei Aparecido da Silva', 'Universidade Federal da Grande Dourados', 'MS', 'Charlei Aparecido da Silva', '1949183981749520', 5),
  ('UFMA', 'UFMA (MA) — Eduardo Bezerra de Almeida Junior', 'Universidade Federal do Maranhão', 'MA', 'Eduardo Bezerra de Almeida Junior', '3142116071365323', 6),
  ('UEMA', 'UEMA (MA) — Eliana Campêlo Lago', 'Universidade Estadual do Maranhão', 'MA', 'Eliana Campêlo Lago', '2913451575350769', 7),
  ('UNIR-3', 'UNIR (RO) — Elisabete Lourdes do Nascimento', 'Universidade Federal de Rondônia', 'RO', 'Elisabete Lourdes do Nascimento', '9724703168940206', 8),
  ('USP', 'USP (SP) — Emerson Galvani', 'Universidade de São Paulo', 'SP', 'Emerson Galvani', '2026434763745090', 9),
  ('UNIR-4', 'UNIR (RO) — Estevao Rafael Fernandes', 'Universidade Federal de Rondônia', 'RO', 'Estevão Rafael Fernandes', '9325979084800204', 10),
  ('UFMT', 'UFMT (MT) — Evandro Luiz Dall''Oglio', 'Universidade Federal de Mato Grosso', 'MT', 'Evandro Luiz Dall''Oglio', '0288804659104012', 11),
  ('UFSCar', 'UFSCar (SP) — Flavio Henrique da Silva', 'Universidade Federal de São Carlos', 'SP', 'Flavio Henrique da Silva', '1757309852446263', 12),
  ('UFRR', 'UFRR (RR) — Gabriel Zazeri', 'Universidade Federal de Roraima', 'RR', 'Gabriel Zazeri', '4523821762412955', 13),
  ('UNIFAP', 'UNIFAP (AP) — Irlon Maciel Ferreira', 'Universidade Federal do Amapá', 'AP', 'Irlon Maciel Ferreira', '9897023410899133', 14),
  ('ILMD', 'ILMD (AM) — Luis Andre Morais Mariuba', 'Instituto Leônidas e Maria Deane', 'AM', 'Luis André Morais Mariúba', '4784959431673419', 15),
  ('UNESP-1', 'UNESP (SP) — Margarete Cristiane de Costa Trindade Amorim', 'Universidade Estadual Paulista Júlio de Mesquita Filho', 'SP', 'Margarete Cristiane de Costa Trindade Amorim', '6644811083291335', 16),
  ('UNIR-5', 'UNIR (RO) — Michel Watanabe', 'Universidade Federal de Rondônia', 'RO', 'Michel Watanabe', '2210782014123027', 17),
  ('UFPA', 'UFPA (PA) — Milton Nascimento da Silva', 'Universidade Federal do Pará', 'PA', 'Milton Nascimento da Silva', '6742390457977989', 18),
  ('UNIFESP', 'UNIFESP (SP) — Mirian Akemi Furuie Hayashi', 'Universidade Federal de São Paulo', 'SP', 'Mirian Akemi Furuie Hayashi', '5559309395232147', 19),
  ('UFAM', 'UFAM (AM) — Natacha Cintia Regina Aleixo', 'Universidade Federal do Amazonas', 'AM', 'Natacha Cintia Regina Aleixo', '9509290240626293', 20),
  ('UFS', 'UFS (SE) — Pablo Ariel Martinez', 'Universidade Federal de Sergipe', 'SE', 'Pablo Ariel Martinez', null, 21),
  ('UFSJ', 'UFSJ (MG) — Renata Carolina Zanetti Lofrano', 'Universidade Federal de São João Del-Rei', 'MG', 'Renata Carolina Zanetti Lofrano', '5561482457720983', 22),
  ('FSCBH', 'FSCBH (MG) — Renata Toscano Simões', 'Faculdade Santa Casa BH', 'MG', 'Renata Toscano Simões', '3112803094228207', 23),
  ('UNESP-2', 'UNESP (SP) — Renee Laufer Amorim', 'Universidade Estadual Paulista Júlio de Mesquita Filho', 'SP', 'Renee Laufer Amorim', '9795829022108105', 24),
  ('FIOCRUZ/CE', 'FIOCRUZ/CE (CE) — Roberto Nicolete', 'Fundação Oswaldo Cruz - Ceará', 'CE', 'Roberto Nicolete', '0447073555893530', 25),
  ('UFMG', 'UFMG (MG) — Walter Luís Garrido Cavalcante', 'Universidade Federal de Minas Gerais', 'MG', 'Walter Luís Garrido Cavalcante', '2046394525786539', 26),
  ('UNIR-6', 'UNIR (RO) — Wanderley Rodrigues Bastos', 'Universidade Federal de Rondônia', 'RO', 'Wanderley Rodrigues Bastos', '4028993334703256', 27),
  ('IFRO', 'IFRO (RO) — Xênia de Castro Barbosa', 'Instituto Federal de Educação, Ciência e Tecnologia de Rondônia', 'RO', 'Xênia de Castro Barbosa', '2736450812832214', 28)
)
insert into public.laboratorios
  (ciclo_id, sigla, nome, instituicao_nome, uf, lla_nome, ordem)
select c.id, d.sigla, d.nome, d.instituicao_nome, d.uf, d.lla_nome, d.ordem
  from dados d cross join ciclo c
on conflict (ciclo_id, sigla) do nothing;

-- ------------------------------------------- 2. A COORDENAÇÃO NO ROSTER ----
-- Sem uma linha aqui, nem a coordenação abre o formulário: a autorização sai de
-- `ciclo_membros`, não de `profiles.role`. O `laboratorio_id` aponta para o
-- primeiro laboratório apenas para que a tela 3 tenha o que mostrar; quem é
-- coordenação enxerga todos de qualquer maneira.
insert into public.ciclo_membros
  (ciclo_id, nome, email, papel, categoria_picc, laboratorio_id, convidado_em)
select c.id,
       'Coordenação INCT-CONEXAO',
       'labioprot.toxin@gmail.com',
       'coordenacao',
       'Membro do Comitê Gestor',
       (select l.id from public.laboratorios l where l.ciclo_id = c.id order by l.ordem limit 1),
       now()
  from public.relatorio_ciclos c
 where c.slug = 'ciclo-1'
on conflict (ciclo_id, email) do nothing;

-- Casa quem JÁ tem conta em auth.users — é o caso de quem já entrou pelo link
-- mágico. Sem isto, `user_id` fica nulo e a RLS recusa o primeiro rascunho com
-- um erro opaco, sem caminho de saída pela tela.
select public.vincular_membros_existentes() as membros_vinculados;

-- --------------------------------------------------- 3. ABRIR O CICLO ------
-- A janela de ENVIO já vem aberta da semente da 005 (2026-08-01 a 2026-12-31).
-- O que falta é o status. O período REPORTÁVEL segue 2025-05-01 a 2026-04-30 —
-- são duas coisas distintas de propósito: uma diz quando se pode escrever, a
-- outra diz o que conta.
update public.relatorio_ciclos set status = 'aberto' where slug = 'ciclo-1';

commit;

-- ------------------------------------------------------- CONFERÊNCIA -------
select (select count(*) from public.laboratorios  l join public.relatorio_ciclos c on c.id = l.ciclo_id where c.slug = 'ciclo-1') as laboratorios,
       (select count(*) from public.ciclo_membros m join public.relatorio_ciclos c on c.id = m.ciclo_id where c.slug = 'ciclo-1') as membros,
       (select count(*) from public.ciclo_membros m join public.relatorio_ciclos c on c.id = m.ciclo_id where c.slug = 'ciclo-1' and m.user_id is not null) as ja_vinculados,
       (select status from public.relatorio_ciclos where slug = 'ciclo-1') as status_do_ciclo,
       (select count(*) from public.laboratorios l join public.relatorio_ciclos c on c.id = l.ciclo_id where c.slug = 'ciclo-1' and cardinality(l.eets) = 0) as labs_sem_eet;
