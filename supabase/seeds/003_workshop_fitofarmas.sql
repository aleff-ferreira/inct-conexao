-- ============================================================================
--  INCT-CONEXAO · seed 003: a edição do I Workshop Conexão Fitofarmas
-- ============================================================================
--  Rode DEPOIS de `migrations/008_workshop_fitofarmas.sql`.
--  IDEMPOTENTE: rodar de novo ATUALIZA a linha, não cria uma segunda.
--
--  ==========================================================================
--  ATENÇÃO ÀS DUAS COISAS QUE SE CONFUNDEM AQUI
--  ==========================================================================
--   • `abre_em` / `fecha_em` = quando se pode RESPONDER o formulário. É o que a
--     RPC checa, e é o que fecha a porta.
--   • As datas DO EVENTO vivem em `config` e são texto de tela: mudá-las não
--     abre nem fecha nada.
--
--  FUSO: Rondônia é UTC−04:00 e NÃO tem horário de verão. Todo carimbo aqui
--  leva o offset `-04` explícito. NUNCA use `Z` nem timestamp sem offset — é a
--  mesma armadilha documentada no `public/admin/config.yml` dos webinars, e o
--  efeito é o formulário fechar quatro horas antes do que a coordenação pensa.
--
--  A FONTE DAS DATAS é o ofício de convite assinado pelo coordenador
--  (06/08/2026): "nos dias 25 e 27 de agosto de 2026, em Porto Velho e Cacoal",
--  com confirmação de presença até 24 de agosto.
--
--  DECISÃO SOBRE O FECHAMENTO, para ser revista pela coordenação sem medo:
--  o formulário fecha em 27/08 às 08h00, o início da atividade de Cacoal — e
--  não em 24/08, o prazo de confirmação de presença. São coisas diferentes:
--  confirmar presença é logística, e este formulário é PREPARAÇÃO DE REDE. Uma
--  resposta que chega no dia 25 continua sendo pré-evento para quem vai a
--  Cacoal, e continua útil para o GT do dia 28. Para fechar antes, basta:
--
--      update public.workshop_edicoes
--         set fecha_em = '2026-08-24 23:59:00-04'
--       where slug = 'i-workshop-conexao-fitofarmas';
--
--  PARA ENCERRAR o formulário a qualquer momento (o site passa a mostrar o
--  aviso, sem deploy):
--
--      update public.workshop_edicoes set status = 'encerrado'
--       where slug = 'i-workshop-conexao-fitofarmas';
-- ============================================================================

insert into public.workshop_edicoes (slug, titulo, status, abre_em, fecha_em, config)
values (
  'i-workshop-conexao-fitofarmas',
  'I Workshop Conexão Fitofarmas',
  'aberto',
  '2026-08-06 00:00:00-04',
  '2026-08-27 08:00:00-04',
  jsonb_build_object(
    'subtitulo',  'Fitoterapia, Plantas Medicinais e Farmácias Vivas na Amazônia Ocidental',
    'quando',     '25 de agosto (Porto Velho) e 27 de agosto de 2026 (Cacoal)',
    'onde',       'IESPRO/SESAU — Porto Velho/RO · 08h00 às 17h30',
    'realizacao', 'NEv RO/IESPRO · INCT-CONEXAO · Fiocruz Rondônia · UNIR · SEMUSA PVH',
    'contato',    'inctconexao@gmail.com',
    'dias', jsonb_build_array(
      jsonb_build_object('id', 'porto_velho', 'data', '2026-08-25', 'cidade', 'Porto Velho',
                         'local', 'IESPRO/SESAU'),
      jsonb_build_object('id', 'cacoal',      'data', '2026-08-27', 'cidade', 'Cacoal',
                         'local', 'a definir')
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
  from public.workshop_edicoes
 where slug = 'i-workshop-conexao-fitofarmas';
