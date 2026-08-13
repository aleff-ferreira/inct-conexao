-- ============================================================================
--  INCT-CONEXAO · 009 — Integração do Google Forms do CTC (32 perguntas)
-- ============================================================================
--  Rode no SQL Editor DEPOIS de 001..008 (a 008 de sigla e a 008 do workshop
--  tocam objetos disjuntos; a ordem entre elas não importa).
--  IDEMPOTENTE: rodável duas vezes sem erro e sem duplicar nada — todo ADD
--  COLUMN é IF NOT EXISTS e o CHECK viaja inline na criação da coluna (na
--  segunda passada a cláusula inteira é pulada).
--
--  O CONTRATO É docs/relato-gforms.md. Das 32 perguntas do "QUESTIONÁRIO PARA
--  PESQUISADORES VINCULADOS AO INCT-CONEXAO" do Comitê Técnico-Científico,
--  11 o formulário já coletava, 8 são derivadas e só ~8 viram campo novo.
--  Este arquivo cria SÓ o que precisa de coluna; o resto ou já existe (005)
--  ou entra no jsonb `relatos.respostas` (seção 4).
--
--  RLS — NENHUMA policy é criada, alterada ou removida aqui. Coluna nova herda
--  a policy da tabela (RLS filtra LINHA, não coluna):
--    • ciclo_membros: o dono edita a própria linha (membros_self_update) e o
--      guarda da 007 barra só papel/email/ciclo/dono/categoria/token/ativo —
--      as quatro colunas novas ficam, de propósito, fora da lista barrada:
--      são exatamente o que a Tela 1 pede que a pessoa preencha.
--    • laboratorios: escrita continua da coordenação (labs_coord_write, 005).
--      dgp_nome/dgp_url são semeados/corrigidos pela coordenação; o LLA CONFERE
--      na tela. Se um dia o LLA precisar editar direto, isso é decisão de
--      política (migração própria), não desta.
--    • producoes: escreve quem tem vínculo com a produção, ou a coordenação
--      (producoes_update, 005) — ver a seção 3 sobre por que isso é o desenho
--      certo para JCR/Qualis.
--    • relatos: o dono e a coordenação (relatos_owner_update, 005).
-- ============================================================================


-- ================================= 1. ciclo_membros — Q6, Q14 e Q31 ========
--  Os quatro campos são DO RESPONDENTE NAQUELE CICLO — por isso moram em
--  ciclo_membros (que é por ciclo) e não em profiles (que é da conta):
--    • ppg            (Q6)  — Programa de Pós-graduação. Texto livre: os PPGs
--                             da rede passam de 15 e não há catálogo conferido;
--                             inventar um enum aqui seria travar o formulário
--                             num dado que ninguém homologou.
--    • indice_h       (Q14) — MANUAL de propósito (decisão 3 do contrato):
--    • total_citacoes (Q14)   OpenAlex daria estimativa, mas diverge do Scholar
--                             que o pesquisador conhece — e o Forms pede o
--                             indicador DELE, da fonte dele. Fingir derivação
--                             seria pior que pedir. Opcionais, nunca travam
--                             envio.
--    • satisfacao     (Q31) — 1..5, o micro-fecho da revisão. É resposta do
--                             ciclo (a mesma pessoa pode responder 2 no Ciclo 1
--                             e 5 no Ciclo 2), o que confirma a tabela.
alter table public.ciclo_membros
  add column if not exists ppg            text,
  add column if not exists indice_h       int
    constraint ciclo_membros_indice_h check (indice_h is null or indice_h >= 0),
  add column if not exists total_citacoes int
    constraint ciclo_membros_citacoes check (total_citacoes is null or total_citacoes >= 0),
  add column if not exists satisfacao     int
    constraint ciclo_membros_satisfacao check (satisfacao is null or satisfacao between 1 and 5);


-- ==================================== 2. laboratorios — Q8 e Q9 (DGP) =======
--  O grupo no Diretório de Grupos de Pesquisa do CNPq. A Q8 DERIVA do
--  laboratório escolhido (a lista de laboratórios já nasceu dos grupos DGP);
--  estas colunas guardam o NOME OFICIAL no espelho do DGP e o LINK do espelho,
--  para a pessoa conferir em vez de digitar.
--    • dgp_nome — pode divergir de `nome` (o DGP tem grafia própria); guardar
--      os dois é o mesmo precedente de categoria_picc × papel: um é o
--      vocabulário do CNPq, o outro é o do sistema.
--    • dgp_url  — o espelho (dgp.cnpq.br/dgp/espelhogrupo/…). O CHECK só exige
--      que seja URL http(s): o DGP não tem formato de id estável documentado, e
--      um regex mais esperto que a realidade viraria migração corretiva.
alter table public.laboratorios
  add column if not exists dgp_nome text,
  add column if not exists dgp_url  text
    constraint laboratorios_dgp_url check (dgp_url is null or dgp_url ~* '^https?://');


-- ============================ 3. producoes — Q13 (JCR e Qualis) =============
--  NA CANÔNICA, NÃO NO VÍNCULO — a decisão pedida, com a justificativa:
--  JCR (fator de impacto) e Qualis são propriedade do TRABALHO (do periódico
--  onde ele saiu), não da atribuição. `producoes` é uma linha por trabalho na
--  rede inteira; `producao_vinculos` é uma linha por (trabalho, relato). Se os
--  campos morassem no vínculo, 4 coautores da rede produziriam 4 cópias do
--  mesmo JCR, livres para divergir — e a Tabela A leria qual? Na canônica o
--  valor existe UMA vez, e a RLS da 005 (producoes_update, intocada) já dá a
--  regra de escrita certa: quem tem vínculo com a produção corrige, o coautor
--  que confirmar coautoria depois também, a coordenação sempre.
--
--  MANUAIS E OPCIONAIS (decisão 2 do contrato): não há base pública gratuita e
--  confiável de Qualis consultável do navegador, e o JCR é proprietário da
--  Clarivate. Fingir derivação seria pior que pedir. A tela só os mostra,
--  recolhidos, em artigo_periodico.
--
--  SEM CHECK de tipo, de propósito: só fazem sentido em `artigo_periodico`
--  (JCR é de periódico indexado; Qualis avalia periódico), mas amarrar por
--  CHECK está errado duas vezes — a coordenação pode querer registrar o Qualis
--  de um anais (a CAPES pontua evento em várias áreas), e um item reclassificado
--  de tipo depois de preenchido não pode ficar preso num CHECK. O par
--  (recolhido na tela + comentário aqui) é a contenção proporcional.
alter table public.producoes
  add column if not exists jcr    numeric(6,3)
    constraint producoes_jcr check (jcr is null or jcr >= 0),
  -- União das DUAS escalas Qualis: a vigente (A1..A4, B1..B4, C) e a anterior
  -- (que tinha B5). A anterior entra porque é a que muita gente ainda cita de
  -- memória; recusar 'B5' aqui só produziria o dado na coluna errada.
  add column if not exists qualis text
    constraint producoes_qualis check (qualis is null or qualis in
      ('A1','A2','A3','A4','B1','B2','B3','B4','B5','C'));


-- ===================== 4. relatos.respostas — Q12, Q20, Q21, Q28..Q30 =======
--  A 005 deu ao relato UM jsonb: `narrativas` — cujo contrato declarado é
--  "os nomes são os do PICC 5.7.2, colável no sistema do CNPq". Fomento e
--  extensão NÃO são PICC 5.7.2; misturá-los ali quebraria esse contrato.
--  Por isso o jsonb das respostas do Forms é uma coluna NOVA, e não uma nova
--  família de chaves dentro de `narrativas`.
--
--  Financiamento, projetos e extensão NÃO viram tabela nem coluna própria:
--  são texto estruturado que a coordenação LÊ (ninguém agrega soma de fomento
--  por SQL neste ciclo), e tabela que ninguém consulta é custo sem retorno.
--
--  AS CHAVES (o espelho TypeScript é `RespostasRelato` em src/relato/types.ts;
--  a validação de forma é do cliente — o banco garante só o teto de tamanho):
--
--    objetivos_confirmados : int[]           — Q20. Os objetivos (1..43) que a
--        pessoa CONFIRMOU após a pré-marcação derivada dos EETs do laboratório
--        (mapa OBJETIVOS_POR_EET em src/relato/config.ts). Guarda-se o resultado
--        confirmado, não a sugestão: a derivação é reproduzível, a confirmação
--        é o dado.
--    fomento               : FomentoItem[]   — Q12 + Q21. Cada item:
--        { agencia?, processo?, titulo?, valor_brl?, inicio?, fim?,
--          complementar? (true = financiamento complementar da Q21;
--                         false/ausente = projeto corrente da Q12) }
--    extensao              : objeto          — Q28..Q30:
--        { tem? (Q28), titulo?, instituicao?, responsavel?, periodo_inicio?,
--          periodo_fim?, coordenador? (Q29), produtos?: TipoProducao[] (Q30 —
--          reusa a taxonomia de produção da 005, nada de vocabulário novo) }
--
--  Q32 (anexo do relatório anual em PDF) NÃO ganha chave: o sistema É o
--  relatório; quem quiser anexa como `relato_arquivos` com uso='comprovante',
--  que já existe desde a 005.
--
--  O snapshot de auditoria da 005 (`log_relato_evento`) grava to_jsonb(new) na
--  transição para 'enviado' — a coluna nova entra no snapshot sem mexer em
--  nada.
alter table public.relatos
  add column if not exists respostas jsonb not null default '{}'::jsonb
    -- Mesmo teto do workshop (008): autosave grava a linha inteira; 64 kB é
    -- mais do que qualquer resposta honesta e menos do que um abuso.
    constraint relatos_respostas_teto check (length(respostas::text) <= 65536);
-- Sem índice GIN, de propósito: são ~209 relatos por ciclo e nenhuma consulta
-- do painel filtra por dentro de `respostas` — o GIN de `narrativas` na 005 já
-- foi generoso; repetir aqui seria manutenção de índice sem leitura que o use.


-- ============================================================ SANIDADE ====
--  Deve devolver 9 linhas, todas com `existe = true`. Rode também a migração
--  DUAS vezes: a segunda passada não pode dar erro (prova da idempotência).
select c.tabela || '.' || c.coluna as checagem,
       exists (select 1 from information_schema.columns i
                where i.table_schema = 'public'
                  and i.table_name  = c.tabela
                  and i.column_name = c.coluna) as existe
  from (values
    ('ciclo_membros','ppg'),
    ('ciclo_membros','indice_h'),
    ('ciclo_membros','total_citacoes'),
    ('ciclo_membros','satisfacao'),
    ('laboratorios','dgp_nome'),
    ('laboratorios','dgp_url'),
    ('producoes','jcr'),
    ('producoes','qualis'),
    ('relatos','respostas')
  ) as c(tabela, coluna);
