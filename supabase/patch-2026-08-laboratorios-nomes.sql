-- ============================================================================
--  INCT-CONEXAO · patch 2026-08-07: nomes reais dos Laboratórios Associados
-- ============================================================================
--  Rode DEPOIS de seeds/001_ciclo_1.sql (em banco novo ou já semeado — tanto
--  faz: os updates casam por `lla_nome` e são idempotentes). Pode rodar antes
--  OU depois de seeds/003_laboratorios_expandidos.sql.
--
--  POR QUE `and ordem < 200` EM TODO WHERE: este patch nomeia os 28
--  laboratórios FORMAIS (seed 001, ordem 1..28). A seed 003 acrescenta
--  laboratórios extras (ordem >= 200) e dois líderes aparecem dos dois lados —
--  Alex Sander Rodrigues Cangussu (UFT/LabVac formal + empresa Antigen) e
--  Carolina Rodrigues da Costa Doria (UNIR/LIP formal + Grupo de Estudos da
--  Biodiversidade). Sem o guard, o WHERE por `lla_nome` casa as duas linhas e
--  põe a mesma sigla nas duas — violação do unique (ciclo_id, sigla). Foi o
--  erro "duplicate key ... laboratorios_sigla_por_ciclo, sigla LabVac" num
--  banco reconstruído do zero.
--
--  POR QUE UM PATCH, E NÃO EDITAR O SEED: o seed usa `on conflict (ciclo_id,
--  sigla) do nothing`, e a sigla é exatamente o que este patch corrige. Um
--  seed com siglas novas, rodado num banco semeado com as antigas, não
--  conflitaria com nada — e os 28 laboratórios virariam 55.
--
--  DE ONDE VÊM OS NOMES: verificação de 2026-08-07, uma por LLA, contra a
--  proposta CNPq (PDF) e fontes web primárias (página do próprio laboratório,
--  dgp.cnpq.br, espelhos do Lattes). Fontes e citações literais registro a
--  registro em src/content/relato/laboratorios.json (campo 'verificacao').
--  27 laboratórios nomeados; Gabriel Zazeri (UFRR) segue com o rótulo
--  institucional — nenhuma fonte nomeou a unidade dele.
-- ============================================================================

update public.laboratorios set nome = 'Laboratório de Biomoléculas e Vacinas', sigla = 'LabVac'
 where lla_nome = 'Alex Sander Rodrigues Cangussu' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Bioecologia de Insetos', sigla = 'LaBEIn'
 where lla_nome = 'Alexandre de Almeida e Silva' and ordem < 200;
update public.laboratorios set nome = 'Grupo de Pesquisa Ciências Atmosféricas na Amazônia', sigla = 'GP.CAA'
 where lla_nome = 'Ana Carla dos Santos Gomes' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Ictiologia e Pesca', sigla = 'LIP'
 where lla_nome = 'Carolina Rodrigues da Costa Doria' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Geografia Física', sigla = 'LGF'
 where lla_nome = 'Charlei Aparecido da Silva' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Estudos Botânicos', sigla = 'LEB'
 where lla_nome = 'Eduardo Bezerra de Almeida Junior' and ordem < 200;
update public.laboratorios set nome = 'Grupo de Inovação em Biotecnologia e Nanosaúde (BIONANO)', sigla = 'BIONANO'
 where lla_nome = 'Eliana Campêlo Lago' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Limnologia e Microbiologia', sigla = 'LABLIM'
 where lla_nome = 'Elisabete Lourdes do Nascimento' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Climatologia e Biogeografia (Departamento de Geografia, FFLCH-USP)', sigla = 'LCB'
 where lla_nome = 'Emerson Galvani' and ordem < 200;
update public.laboratorios set nome = 'Laboratório Amazônico de Estudos em América Latina', sigla = 'LabLat'
 where lla_nome = 'Estevão Rafael Fernandes' and ordem < 200;
update public.laboratorios set nome = 'Central Analítica do Laboratório de Pesquisas em Química de Produtos Naturais e Novas Metodologias Sintéticas em Química Orgânica', sigla = 'CALPQPN'
 where lla_nome = 'Evandro Luiz Dall''Oglio' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Biologia Molecular', sigla = 'LBM'
 where lla_nome = 'Flavio Henrique da Silva' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Biocatálise e Síntese Orgânica Aplicada', sigla = 'BIORG'
 where lla_nome = 'Irlon Maciel Ferreira' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Diagnóstico e Controle de Doenças Infecciosas na Amazônia', sigla = 'DCDIA'
 where lla_nome = 'Luis André Morais Mariúba' and ordem < 200;
update public.laboratorios set nome = 'Grupo de Pesquisa Interações na Superfície Terrestre, Água e Atmosfera (GAIA)', sigla = 'GAIA'
 where lla_nome = 'Margarete Cristiane de Costa Trindade Amorim' and ordem < 200;
update public.laboratorios set nome = 'Grupo de Estudos e Pesquisas em Geoprocessamento e Hidrossedimentologia na Amazônia'
 where lla_nome = 'Michel Watanabe' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Cromatografia Líquida', sigla = 'LABCROL'
 where lla_nome = 'Milton Nascimento da Silva' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Neurofarmacologia Molecular (FarmoLAB) — Departamento de Farmacologia, Escola Paulista de Medicina (EPM), UNIFESP', sigla = 'FarmoLAB'
 where lla_nome = 'Mirian Akemi Furuie Hayashi' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Hidrogeografia, Climatologia e Análise Ambiental da Amazônia', sigla = 'HIDROGEO'
 where lla_nome = 'Natacha Cintia Regina Aleixo' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Pesquisas Integrativas em Biodiversidade', sigla = 'PIBi Lab'
 where lla_nome = 'Pablo Ariel Martinez' and ordem < 200;
update public.laboratorios set nome = 'Núcleo de Pesquisas em Polímeros, Oleoquímicos, Emulsões, Nanotecnologia e Compósitos', sigla = 'POLNECON'
 where lla_nome = 'Renata Carolina Zanetti Lofrano' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Biologia Molecular e Biomarcadores da Faculdade Santa Casa BH'
 where lla_nome = 'Renata Toscano Simões' and ordem < 200;
update public.laboratorios set nome = 'Grupo de Pesquisa Biomarcadores preditivos do câncer: estudo comparativo'
 where lla_nome = 'Renee Laufer Amorim' and ordem < 200;
update public.laboratorios set nome = 'Plataforma de Nanotecnologia da Fiocruz Ceará'
 where lla_nome = 'Roberto Nicolete' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Farmacologia da Junção Neuromuscular e Toxinologia', sigla = 'LFJT'
 where lla_nome = 'Walter Luís Garrido Cavalcante' and ordem < 200;
update public.laboratorios set nome = 'Laboratório de Biogeoquímica Ambiental Wolfgang C. Pfeiffer', sigla = 'LBGQA-WCP'
 where lla_nome = 'Wanderley Rodrigues Bastos' and ordem < 200;
update public.laboratorios set nome = 'Núcleo de Estudos Históricos e Literários', sigla = 'NEHLI'
 where lla_nome = 'Xênia de Castro Barbosa' and ordem < 200;

-- ------------------------------------------------------------- conferência --
-- Só os 28 formais (os que este patch toca); a lista da seed 003 fica de fora.
select sigla, nome, lla_nome
  from public.laboratorios l
  join public.relatorio_ciclos c on c.id = l.ciclo_id and c.slug = 'ciclo-1'
 where l.ordem < 200
 order by l.ordem;
