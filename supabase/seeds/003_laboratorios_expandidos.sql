-- ============================================================================
--  INCT-CONEXAO · seed 003 — expansao da lista de laboratorios (70 novos)
-- ============================================================================
--  Rode no SQL Editor DEPOIS de 001..007 e das seeds 001 e 002.
--
--  DECISAO DA COORDENACAO (2026-08-08): todos os laboratorios levantados pela
--  busca entram — confirmados, provaveis e indicios. A lista e um cardapio de
--  selecao: o pesquisador escolhe o seu, e o que ninguem escolher nao aparece
--  em relato nenhum. Origem e confianca de cada linha:
--  src/content/relato/laboratorios.json.
--
--  IDEMPOTENTE por uuid deterministico (uuid5 do slug) + on conflict (id).
--  Siglas vazias viraram NULL no gerador: o Postgres NAO trata '' como NULL, e
--  duas '' colidem no unique (ciclo_id, sigla) — foi exatamente o erro da
--  primeira versao desta seed. NULL nao conflita com NULL; '' conflita com ''.
--
--  `lla_nome` = lider encontrado na busca; `lla_user_id` fica NULO — nenhum
--  destes ganha poder de conferencia (a fila L3 continua so dos 28 formais).
--  `ordem` >= 200 mantem os 28 originais no topo.
-- ============================================================================

insert into public.laboratorios
  (id, ciclo_id, sigla, nome, instituicao_nome, uf, lla_nome, ordem)
select v.id, c.id, v.sigla, v.nome, v.instituicao_nome, v.uf, v.lla_nome, v.ordem
from (values
  ('f31370f2-ce9a-5a82-ae4b-4cd130d1e180'::uuid, 'LEDS', 'Laboratório Especial de Dor e Sinalização (LEDS)', 'Instituto Butantan', 'SP', 'Gisele Picolo', 200),
  ('cef7a95e-b143-5bee-a5c2-2b4c17d4ac49'::uuid, null, 'Laboratório de Bioquímica e Biofísica', 'Instituto Butantan', 'SP', 'Daniel Carvalho Pimenta', 201),
  ('af3a88bd-ff0b-55ae-970d-edef38d37ca0'::uuid, null, 'Laboratório de Biofísica Molecular Estrutural (Laboratory of Structural Molecular Biophysics)', 'Universidade Estadual Paulista Júlio de Mesquita Filho — Instituto de Biociências de Botucatu (IBB)', 'SP', 'Marcos Roberto de Mattos Fontes', 202),
  ('85f6fc82-a356-5ceb-b3f4-250d0cb7850a'::uuid, 'LAC', 'Laboratório Associado de Computação e Matemática Aplicada (LAC)', 'Instituto Nacional de Pesquisas Espaciais', 'SP', '', 203),
  ('be63626c-8a8f-54b6-8f44-7fc697001553'::uuid, 'LEA', 'Laboratório de Ensaios Antimicrobianos (LEA)', 'Universidade Federal de Uberlândia — Instituto de Ciências Biomédicas (ICBIM)', 'MG', 'Carlos Henrique Gomes Martins', 204),
  ('1765971c-0671-5b0f-84bf-713afe5b43c5'::uuid, 'LaBiTox', 'Laboratório de Bioquímica e Toxinas Animais (LaBiTox)', 'Universidade Federal de Uberlândia — Instituto de Biotecnologia (IBTEC)', 'MG', 'Renata Santos Rodrigues', 205),
  ('f59565ee-c784-55ae-b3c7-470c060626ce'::uuid, 'LFBioN', 'Laboratório de Farmacognosia (LFBioN)', 'Universidade Federal Rural do Rio de Janeiro — Departamento de Ciências Farmacêuticas', 'RJ', 'Douglas Siqueira de Almeida Chaves', 206),
  ('dc121be4-f4e0-5bf9-9b00-093ddbee1a12'::uuid, 'LabCAA', 'Laboratório de Climatologia e Análise Ambiental (LabCAA)', 'Universidade Federal de Juiz de Fora — Departamento de Geociências', 'MG', 'Fabio de Oliveira Sanches', 207),
  ('8e148922-2764-50c4-aee6-c92ca7440e4d'::uuid, null, 'Base de Pesquisa do ICB-USP em Monte Negro / Núcleo Avançado de Pesquisa de Monte Negro (ICB5)', 'Universidade de São Paulo — Instituto de Ciências Biomédicas (ICB)', 'SP', 'Luís Marcelo Aranha Camargo', 208),
  ('a3a68e62-77fc-58e7-9f0c-f84b177ab4ec'::uuid, 'MCCAC', 'Grupo de Pesquisa Museus e Centros de Ciências Acessíveis (MCCAC)', 'Fundação Centro de Ciências e Educação Superior à Distância do Estado do Rio de Janeiro', 'RJ', 'Jessica Norberto Rocha', 209),
  ('6b4f2711-3814-56b4-b8df-12cbc8b97014'::uuid, null, 'Laboratório de Materiais Avançados e Nanotecnologia (Grupo de Física Aplicada à Medicina e Nanotecnologia)', 'Universidade Estadual Paulista Júlio de Mesquita Filho — Faculdade de Ciências, Câmpus de Bauru (Depto de Física)', 'SP', '', 210),
  ('56a99503-fa39-5dd6-abf3-3ea2fbe58e35'::uuid, null, 'Grupo/Laboratório de Biotecnologia (Bioquímica de Proteínas e Biomateriais) — UFSJ', 'Universidade Federal de São João del-Rei', 'MG', 'Paulo Afonso Granjeiro', 211),
  ('a4e150b0-f597-5260-a7de-3a1c9fa97df5'::uuid, null, 'IAG/USP — Departamento de Ciências Atmosféricas (INCLINE / LAPAt)', 'Universidade de São Paulo — Instituto de Astronomia, Geofísica e Ciências Atmosféricas (IAG)', 'SP', '', 212),
  ('4b7279b1-9626-5d3c-a42c-a9e623aa5c33'::uuid, 'LABGEMBB', 'Laboratório de Genética Molecular "Prof. Dr. Bernardo Beiguelman"', 'Universidade Federal de Rondônia', 'RO', 'Rubiani de Cassia Pagotto', 213),
  ('27257c2d-2b3a-50de-8984-760f1037f1d6'::uuid, 'LabHis', 'Laboratório de Histoanálise', 'Universidade Federal de Rondônia', 'RO', 'Elieth Afonso de Mesquita', 214),
  ('9106a71c-3bc1-5510-be79-3d2526fce120'::uuid, 'LaBDIn', 'Laboratório de Biologia e Diversidade de Insetos', 'Universidade Federal de Rondônia', 'RO', 'Maria Aurea Pinheiro de Almeida Silveira', 215),
  ('45140e3c-c67f-50ba-b9c1-df1df87c85d9'::uuid, 'LabMasto', 'Laboratório de Mastozoologia e Vertebrados Terrestres', 'Universidade Federal de Rondônia', 'RO', 'Malu Messias', 216),
  ('fd2ef13b-67d2-5743-a872-f4b0acdd0f56'::uuid, 'RON', 'Herbário Rondoniense "João Geraldo Kuhlmann"', 'Universidade Federal de Rondônia', 'RO', 'Narcísio Costa Bigio', 217),
  ('ea37c13f-6ba4-5000-8134-52501129babd'::uuid, 'LABOGEOPA', 'Laboratório de Geografia e Planejamento Ambiental', 'Universidade Federal de Rondônia', 'RO', 'Dorisvalder Dias Nunes', 218),
  ('c46c293d-0983-5e06-beb6-01d9ce6d044e'::uuid, 'GEOPLAM', 'Geografia e Planejamento Ambiental', 'Universidade Federal de Rondônia', 'RO', 'Dorisvalder Dias Nunes', 219),
  ('280d0ea5-1342-54db-9754-8a143348f626'::uuid, 'BIOCLAM', 'Grupo de Pesquisas em Bioclimatologia e Mudanças Climáticas na Amazônia', 'Universidade Federal de Rondônia', 'RO', 'João Paulo Assis Gobo', 220),
  ('40e9165b-b082-5725-b617-b5d118e27173'::uuid, 'GENTEH', 'Grupo de Pesquisa Geografia, Natureza e Territorialidades Humanas', 'Universidade Federal de Rondônia', 'RO', 'Adnilson de Almeida Silva', 221),
  ('8b31c7db-4b62-5b44-bd48-33deea35be40'::uuid, 'CIBEBI', 'Centro Interdepartamental de Biologia Experimental e Biotecnologia', 'Universidade Federal de Rondônia', 'RO', 'Adriana Cristina da Silva Nunes', 222),
  ('020521db-b85b-5a8c-bd30-5540cceab1f1'::uuid, 'GEP-HIST', 'Grupo de Estudos e Pesquisas em Histoanálises', 'Universidade Federal de Rondônia', 'RO', 'Elieth Afonso de Mesquita', 223),
  ('e56e5e5a-34b9-563e-91d5-0ab1088012f9'::uuid, null, 'Grupo de Estudos da Biodiversidade da Amazônia Sul-Ocidental', 'Universidade Federal de Rondônia', 'RO', 'Carolina Rodrigues da Costa Doria', 224),
  ('b50211a9-9f61-5fb6-86c8-05900a51ae23'::uuid, 'CEGEA', 'Centro de Estudos Geográficos e Sócio-Ambientais da Amazônia Aziz Ab''Saber', 'Universidade Federal de Rondônia', 'RO', '', 225),
  ('dd886f57-7e7e-5dd0-b06e-f1608c3e057d'::uuid, null, 'Laboratório de Patologia Animal', 'Universidade Federal de Rondônia — Campus de Rolim de Moura', 'RO', '', 226),
  ('d4592f32-50d7-5335-84ba-2145e873e304'::uuid, 'CEBio', 'Centro de Estudos de Biomoléculas Aplicadas à Saúde', 'Fundação Oswaldo Cruz Rondônia (mantido em conjunto com a Universidade Federal de Rondônia)', 'RO', 'Leonardo de Azevedo Calderon', 227),
  ('0ea90d59-641f-54b0-8425-53b142e144a4'::uuid, 'LABIOPROT', 'Laboratório de Biotecnologia de Proteínas e Compostos Bioativos', 'Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia', 'RO', '', 228),
  ('c477a6d2-d716-555a-86d2-dbe24516e58f'::uuid, null, 'Plataforma de Bioensaios em Malária e Leishmanioses', 'Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia', 'RO', 'Carolina Bioni Garcia Teles', 229),
  ('f70f5ae6-8a9f-5576-b293-1f93f9a230f8'::uuid, null, 'Laboratório de Entomologia', 'Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia (origem no IPEPATRO)', 'RO', '', 230),
  ('7220482e-369d-5d78-95fd-7c058c43736e'::uuid, null, 'Laboratório de Engenharia de Anticorpos', 'Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia', 'RO', '', 231),
  ('b84edace-a959-51c9-9ad1-587c14e8889f'::uuid, 'CEPEM', 'Centro de Pesquisa em Medicina Tropical de Rondônia', 'Centro de Pesquisa em Medicina Tropical de Rondônia (unidade de saúde, ensino e pesquisa da Secretaria de Estado da Saúde - SESAU/RO)', 'RO', '', 232),
  ('77c6ce54-54ba-58b7-a7e0-8a71718d5b94'::uuid, null, 'Núcleo de Inovação em Restauração de Ecossistemas', 'Ação Ecológica Guaporé', 'RO', '', 233),
  ('35dbee22-bdad-55f6-8efb-6e1c729d9f68'::uuid, 'Antigen', 'Laboratório Antigen (Antigen Desenvolvimento de Tecnologias de Vacinas e Serviços LTDA)', 'Antigen Desenvolvimento de Tecnologias de Vacinas e Serviços LTDA', 'TO', 'Alex Sander Rodrigues Cangussu', 234),
  ('8d427ccf-5a62-58cc-b881-a117f775c662'::uuid, null, 'Observatório Atmosférico da Amazônia', 'Universidade Federal do Oeste do Pará', 'PA', 'Lucas Vaz Peres', 235),
  ('e9330186-cc2b-5a68-8f91-b5648b3b286a'::uuid, 'ATMOS', 'Laboratório de Física e Química da Atmosfera', 'Universidade Federal do Oeste do Pará', 'PA', '', 236),
  ('273f0b33-a842-5f7a-b493-f9a4b2c671ab'::uuid, 'CIMAZON', 'Centro Integrado de Metabolômica da Amazônia', 'Universidade Federal do Pará', 'PA', 'Paulo Wender Portal Gomes', 237),
  ('df93ca57-4cdd-5873-b115-16b8a022498f'::uuid, 'PharMedChem', 'PharMedChem — grupo de pesquisa em Química Farmacêutica e Medicinal', 'Universidade Federal do Amapá', 'AP', 'Lorane Izabel da Silva Hage Melim', 238),
  ('1790529c-4df2-5e55-b9e6-484ae95bb918'::uuid, 'NanoFito', 'Laboratório de Nanobiotecnologia Fitofarmacêutica', 'Universidade Federal do Amapá', 'AP', '', 239),
  ('5a9fb618-2f1b-5f26-b6e7-a86cbb53b7fb'::uuid, 'DMAIS', 'Laboratório de Diversidade Microbiana da Amazônia com Importância para a Saúde', 'Instituto Leônidas e Maria Deane (Fiocruz Amazônia)', 'AM', '', 240),
  ('99b7887f-799e-547d-8039-d893d4a86fe3'::uuid, 'GPBIOMED', 'Grupo de Pesquisa em Biologia Química, Produtos Naturais e Medicinais', 'Universidade Federal de Roraima', 'RR', 'Cléria Mendonça de Moraes', 241),
  ('287d3d53-9ea5-5c92-a8b6-5e2002f6f8dc'::uuid, null, 'Laboratório de Venenos e Toxinas Animais', 'Universidade Federal do Ceará', 'CE', 'Alice Maria Costa Martins', 242),
  ('886da35c-0f3b-5b8a-a183-c9d7b54511d9'::uuid, 'LAFAVET', 'Laboratório de Farmacologia de Venenos, Toxinas e Lectinas', 'Universidade Federal do Ceará', 'CE', 'Helena Serra Azul Monteiro', 243),
  ('d9f59ba3-2b05-51d0-a389-af321dd75bd0'::uuid, 'NUROF-UFC', 'Núcleo Regional de Ofiologia da UFC', 'Universidade Federal do Ceará', 'CE', 'Robson Waldemar Ávila', 244),
  ('81abb977-3907-5532-ad58-3caac6567337'::uuid, 'LabVenom', 'LabVenom — Laboratório de Venômica', 'Universidade Estadual da Paraíba', 'PB', 'Karla Patrícia de Oliveira Luna', 245),
  ('9ec9a864-493d-54b2-a6bf-f210a3f7873d'::uuid, 'LIG', 'Laboratório de Imunogenética', 'Instituto Aggeu Magalhães (Fiocruz Pernambuco)', 'PE', 'Norma Lucena Cavalcanti Licinio da Silva', 246),
  ('2853d1bd-d10b-55cf-8c10-dca2671c6c58'::uuid, 'LAMMA', 'Laboratório de Meteorologia Aplicada e Meio Ambiente', 'Universidade Federal de Alagoas', 'AL', 'José Francisco de Oliveira Júnior', 247),
  ('eee60bd6-1ebb-594b-b53a-5062f8e9df5a'::uuid, 'LEAC', 'Laboratório de Estudos Avançados do Clima', 'Universidade Federal do Rio Grande do Norte', 'RN', 'David Mendes', 248),
  ('6eedb1b2-0031-50a1-9bf9-733d3c2872b2'::uuid, 'LACAS', 'Laboratório de Climatologia em Ambientes Subtropicais', 'Universidade Federal de Santa Maria', 'RS', 'Cássio Arthur Wollmann', 249),
  ('1f69e1bd-c69a-591c-96bc-5d1895b1f09b'::uuid, 'LEM', 'Laboratório Experimental Multiusuário', 'Pontifícia Universidade Católica do Paraná', 'PR', 'Selene Elifio-Esposito', 250),
  ('58a4bdcd-9161-5af4-a90a-e48c92d9305d'::uuid, null, 'Laboratório de Toxinologia', 'Universidade de Brasília', 'DF', 'Osmindo Rodrigues Pires Júnior', 251),
  ('4866c7b0-5f07-5d4a-bada-f789a0f8c72e'::uuid, 'LAMMASU', 'Laboratório de Modelagem Molecular Aplicada à Saúde Única', 'Fundação Universidade Federal de Ciências da Saúde de Porto Alegre', 'RS', 'Rodrigo Ligabue-Braun', 252),
  ('a9e94861-206a-5ba9-bd04-10b3c76a1f34'::uuid, 'CEPAM', 'Centro Nacional de Pesquisa e Conservação da Biodiversidade Amazônica', 'Instituto Chico Mendes de Conservação da Biodiversidade', 'DF', '', 253),
  ('a50f260a-e3ff-5404-8e9b-c832b924a2e8'::uuid, 'IPMC', 'Physiopathologie moléculaire des phospholipases A2 et de leurs médiateurs — Institut de Pharmacologie Moléculaire et Cellulaire (IPMC)', 'Centre National de la Recherche Scientifique', null, 'Gérard Lambeau', 254),
  ('6bfaca76-0a7c-5266-bf4f-722d78ebc913'::uuid, 'Sys2Diag', 'Sys2Diag — Modélisation et Ingénierie des Systèmes Complexes Biologiques pour le Diagnostic (UMR 9005 CNRS/ALCEDIAG)', 'Centre National de la Recherche Scientifique', null, 'Franck Raphael Molina', 255),
  ('44a09d32-9553-53b0-9ac6-749e734fc204'::uuid, 'LabInPro', 'Laboratorio de Investigación en Proteínas', 'Universidad Nacional del Nordeste', null, 'Laura Cristina Ana Leiva', 256),
  ('c9aabc5d-8e77-55c0-ae7d-733e19d87e49'::uuid, 'ICP', 'Serpentario do Instituto Clodomiro Picado', 'Universidad de Costa Rica', null, 'Aarón Gómez Argüello', 257),
  ('32579491-11b1-5ee6-84b7-455541a673fb'::uuid, null, 'Biomolecules Discovery Group', 'Universidad Regional Amazónica Ikiam', null, '', 258),
  ('78a20cb0-a8fb-500b-977d-e851fec76538'::uuid, 'GI-TOXIVEN', 'Laboratorio de Biología Molecular / Grupo de Investigación en Toxinas de Origen Animal y sus Antivenenos (GI-TOXIVEN), Facultad de Ciencias Biológicas', 'Universidad Nacional Mayor de San Marcos', null, '', 259),
  ('0384aaaf-0a86-53ad-845c-1b8cce00ffd2'::uuid, 'CEIITOXQUIA', 'Centro de Información e Investigaciones Toxicológicas y Químicas Aplicadas', 'Universidad Autónoma de Chiriquí', null, 'Aristides Quintero Rueda', 260),
  ('a1e3e3b2-2d08-5720-9f76-57764ae2be70'::uuid, 'LAQV/REQUIMTE', 'LAQV@REQUIMTE — Departamento de Química e Bioquímica, Faculdade de Ciências', 'Universidade do Porto', null, '', 261),
  ('34428d60-5c2e-5722-b1f8-8e0757e88d01'::uuid, null, 'Climate Lab — Department of Geography', 'San Diego State University', null, 'Fernando de Sales', 262),
  ('c4c46f2c-8c86-5aa5-af2b-21b828cff1bd'::uuid, null, 'Department of Environmental Health (programa Exposure, Epidemiology and Risk)', 'Harvard T.H. Chan School of Public Health', null, '', 263),
  ('0f853235-e1cd-5700-9083-68fa8c3d1507'::uuid, 'CEDIC', 'Centro para el Desarrollo de la Investigación Científica', 'Centro para el Desarrollo de la Investigación Científica', null, '', 264),
  ('c9fc4129-8db8-5fb7-b7b1-017e83432754'::uuid, 'TBIP', 'Tropical Biome and Immunophysiopathology (UMR TBIP / CIIL)', 'Université de Guyane', null, '', 265),
  ('5fc72c25-7e20-53cc-a3f3-8f4808d44461'::uuid, 'UMR-S 1144', 'Service de biologie médicale, HIA Bégin — UMR-S 1144, Université Paris Cité', 'Université Paris-Cité', null, '', 266),
  ('0654aa45-3052-5023-98a1-d6bcd43e3346'::uuid, null, 'Earth System Modelling Section / Destination Earth — Forecast Department', 'European Centre for Medium-Range Weather Forecasts', null, '', 267),
  ('f28e553c-c156-5c32-9884-7c9096cdcb46'::uuid, 'NHLI', 'National Heart and Lung Institute, Faculty of Medicine', 'Imperial College London', null, '', 268),
  ('d432f14e-32e2-5900-9b99-6adbc8672f19'::uuid, null, 'Urra Lab — Laboratory of Metabolic Plasticity and Bioenergetics, Instituto de Ciencias Biomédicas (ICBM), Facultad de Medicina', 'Universidad de Chile', null, 'Félix A. Urra', 269)
) as v(id, sigla, nome, instituicao_nome, uf, lla_nome, ordem)
cross join (select id from public.relatorio_ciclos where slug = 'ciclo-1') c
on conflict (id) do nothing;

-- Conferencia (esperado: total = 28 + 70):
--   select count(*) from public.laboratorios;
