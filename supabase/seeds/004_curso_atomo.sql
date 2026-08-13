-- ============================================================================
--  INCT-CONEXAO · seed 004: a edição do curso "Do átomo à ação biológica"
-- ============================================================================
--  Rode DEPOIS de `migrations/013_curso_atomo.sql`.
--  IDEMPOTENTE: rodar de novo ATUALIZA a linha, não cria uma segunda.
--
--  ==========================================================================
--  DUAS COISAS QUE SE CONFUNDEM
--  ==========================================================================
--   • `abre_em` / `fecha_em` = quando se pode INSCREVER. É o que a RPC checa.
--   • As datas das TURMAS vivem em `src/curso/conteudo.ts` (texto de tela) e no
--     `config` abaixo — mudá-las não abre nem fecha nada.
--
--  FUSO: Rondônia é UTC−04:00 e NÃO tem horário de verão. Todo carimbo leva o
--  offset `-04` explícito. NUNCA use `Z` nem timestamp sem offset — o efeito é a
--  inscrição fechar quatro horas antes do que a coordenação pensa.
--
--  AS DATAS DO CURSO (IFRO Campus Jaru):
--    Conteúdo 1 — Estruturas 3D, visualização molecular e IA
--        19/08/2026 14h–17h30  ou  20/08/2026 14h–17h30 (escolher UMA)
--    Conteúdo 2 — Docking, interpretação molecular e ADMET
--        21/08/2026 08h–11h30  ou  21/08/2026 14h–17h30 (escolher UMA)
--    Cada participante monta um percurso de 7 horas (3h30 + 3h30).
--
--  A inscrição fecha em 21/08 às 08h00 (início da última turma). Para fechar
--  antes, ou encerrar a qualquer momento (o site passa a mostrar o aviso, sem
--  deploy):
--      update public.curso_edicoes set fecha_em = '2026-08-18 23:59:00-04'
--       where slug = 'curso-conexao-bioinformatica';
--      update public.curso_edicoes set status = 'encerrado'
--       where slug = 'curso-conexao-bioinformatica';
-- ============================================================================

insert into public.curso_edicoes (slug, titulo, status, abre_em, fecha_em, config)
values (
  'curso-conexao-bioinformatica',
  'CONEXAO-BIOINFORMÁTICA: Do átomo à ação biológica',
  'aberto',
  '2026-08-11 00:00:00-04',
  '2026-08-21 08:00:00-04',
  jsonb_build_object(
    'subtitulo',  'Bioinformática estrutural, IA, docking e ADMET para Veterinária, Agronomia e docentes',
    'onde',       'IFRO Campus Jaru, Jaru/RO · laboratório de informática',
    'realizacao', 'INCT-CONEXAO · IFRO Campus Jaru · PPP/FAPERO',
    'contato',    'inctconexao@gmail.com',
    -- Teto de vagas por turma (dia teórico / turno prático). A coordenação muda
    -- este número aqui e reaplica o seed, sem deploy — a RPC e `curso_vagas` leem
    -- daqui. 40 por turma = até 80 na teoria e 80 na prática (cada pessoa faz 1+1).
    'max_por_turma', 40,
    'turmas', jsonb_build_array(
      jsonb_build_object('id','c1_19ago','conteudo',1,'data','2026-08-19',
                         'inicio','14:00','fim','17:30'),
      jsonb_build_object('id','c1_20ago','conteudo',1,'data','2026-08-20',
                         'inicio','14:00','fim','17:30'),
      jsonb_build_object('id','c2_21ago_manha','conteudo',2,'data','2026-08-21',
                         'inicio','08:00','fim','11:30'),
      jsonb_build_object('id','c2_21ago_tarde','conteudo',2,'data','2026-08-21',
                         'inicio','14:00','fim','17:30')
    )
  )
)
on conflict (slug) do update set
  titulo   = excluded.titulo,
  status   = excluded.status,
  abre_em  = excluded.abre_em,
  fecha_em = excluded.fecha_em,
  config   = excluded.config;


-- ------------------------------------------------------------- conferência --
select slug, status, titulo,
       to_char(abre_em  at time zone 'America/Porto_Velho', 'DD/MM/YYYY HH24:MI') as abre,
       to_char(fecha_em at time zone 'America/Porto_Velho', 'DD/MM/YYYY HH24:MI') as fecha,
       (now() between abre_em and fecha_em) as aceitando_agora
  from public.curso_edicoes
 where slug = 'curso-conexao-bioinformatica';
