-- ============================================================================
--  INCT-CONEXAO BIO3TOX · Semente da EQUIPE — as 209 pessoas da proposta
--  Processo CNPq 408474/2024-6 · Chamada nº 46/2024
-- ============================================================================
--  RODE **DEPOIS** de:
--     supabase/migrations/005_relatos.sql
--     supabase/migrations/006_identificacao.sql   ← usa as colunas dela
--     supabase/seeds/001_ciclo_1.sql              ← usa os 28 laboratórios
--  Cole no SQL Editor do Supabase (Dashboard → SQL Editor → New query).
--
--  IDEMPOTENTE. Rodar de novo não duplica ninguém e — o que importa mais — não
--  desfaz identificação nenhuma: o conflito é resolvido por `do nothing` sobre
--  (ciclo_id, catalogo_id), então quem já informou o e-mail dele continua
--  exatamente como estava. Nenhuma linha aqui toca tabela das migrações 001-004.
--
--  ==========================================================================
--  O QUE ESTE ARQUIVO FAZ
--  ==========================================================================
--  Põe no roster do Ciclo 1 (public.ciclo_membros) as 209 pessoas registradas
--  na seção EQUIPE da proposta submetida, para que cada uma se ENCONTRE na
--  busca da Tela 1 e assuma o próprio cadastro. Os dados vêm de
--  src/content/relato/equipe.json — extração por coordenada do PDF, conferida
--  contra o Quadro Geral do PICC (fecha exatamente nas 13 categorias).
--
--  A DIVISÃO É A MESMA DA 005 (seção 18), e é ela que explica o que está aqui:
--    • BANCO = identificadores e ligações — o que a RLS protege e o que as
--      contagens agregam: nome, categoria PICC, instituição, UF, país, Lattes.
--    • BUNDLE = o resto do catálogo (titulação, bolsa, áreas de atuação,
--      responsabilidade no projeto, horas/semana), que a Tela 1 usa para
--      PRÉ-PREENCHER o formulário antes de existir sessão. Nada disso vira
--      coluna: ciclo_membros não tem onde guardar, e não há consulta que leia.
--
--  ==========================================================================
--  O E-MAIL: NINGUÉM INVENTA ENDEREÇO
--  ==========================================================================
--  A proposta NÃO traz o e-mail de nenhuma das 209 pessoas — traz 190 links de
--  Lattes e zero contatos. E `ciclo_membros.email` é NOT NULL e único por
--  ciclo. Então cada linha nasce com um endereço de reserva, derivado do id do
--  catálogo:
--
--        <id-do-catalogo>@pendente.inct-conexao.invalid
--
--  `.invalid` é TLD reservado pela RFC 2606: não resolve, não recebe mensagem,
--  não existe risco de disparo por engano. `email_pendente = true` marca essas
--  linhas, e um CHECK da 006 amarra as duas coisas nos dois sentidos.
--  Quem preenche o endereço de verdade é a PRÓPRIA PESSOA, pela RPC
--  `public.reivindicar_cadastro(...)` — ver o cabeçalho da 006.
--
--  `convidado_em` fica NULO nas 209: **ninguém foi convidado por e-mail**.
--  Isso é proposital e é a trava contra disparo acidental — qualquer rotina de
--  convite deve filtrar por `convidado_em is null and not email_pendente`.
--
--  ==========================================================================
--  `papel` NÃO VEM DA CATEGORIA QUANDO A CATEGORIA DÁ PODER
--  ==========================================================================
--  `categoria_picc` guarda a categoria ORIGINAL do Quadro Geral do PICC, que é
--  o vocabulário do CNPq. `papel` é o do sistema, e é ele que a autorização lê.
--  O colapso está no CASE abaixo, com UMA exceção deliberada:
--
--    'Membro do Comitê Gestor' (8) e 'Vice-Coordenador' (1) entram como
--    'pesquisador', **não** como 'cges'/'coordenacao'.
--
--  Motivo: `is_coordenacao()` lê exatamente `ciclo_membros.papel`, e quem é
--  coordenação lê TODOS os relatos, o roster inteiro, o log de auditoria e os
--  anexos. Como a identificação é auto-declarada (a pessoa se acha na busca e
--  informa o e-mail), semear papel privilegiado seria entregar a chave da rede
--  a quem clicasse primeiro naquele nome. Poder se concede à mão, depois de a
--  pessoa entrar e ser reconhecida:
--
--    update public.ciclo_membros set papel = 'cges'
--     where ciclo_id = (select id from public.relatorio_ciclos where slug = 'ciclo-1')
--       and catalogo_id = 'nome-da-pessoa-no-catalogo'
--       and user_id is not null;   -- só depois do primeiro acesso
--
--  ==========================================================================
--  PASSO QUE FICA PARA DEPOIS (e que ninguém deve esquecer)
--  ==========================================================================
--  `is_lla_de()` não olha `papel`: ela olha `laboratorios.lla_user_id`. Esta
--  semente liga os 28 líderes ao laboratório deles (`ciclo_membros.laboratorio_id`),
--  mas NÃO pode preencher `lla_user_id` — ele só existe depois que o líder
--  entra. Assim que os líderes tiverem entrado, rode:
--
--    update public.laboratorios l
--       set lla_user_id = m.user_id
--      from public.ciclo_membros m
--     where m.ciclo_id = l.ciclo_id and m.laboratorio_id = l.id
--       and m.papel = 'lla' and m.user_id is not null and l.lla_user_id is null;
--
--  Sem esse passo, o líder entra como membro comum e a fila de conferência do
--  laboratório (Tela L3) fica vazia para ele.
--
--  ==========================================================================
--  O QUE ESTE ARQUIVO NÃO TEM — e por quê
--  ==========================================================================
--  (a) SEM LABORATÓRIO para as 181 pessoas que não são líder. A proposta não
--      vincula pessoa a laboratório associado: ela vincula pessoa a INSTITUIÇÃO.
--      Adivinhar pela instituição erraria em UNIR (6 laboratórios), USP e UNESP
--      (2 cada) — e o campo governa `meu_laboratorio()`, isto é, quais fatos
--      coletivos a pessoa enxerga. Fica NULO: a Tela 1 pergunta, e o guarda da
--      005 permite PREENCHER o que está vazio (trocar depois, não).
--  (b) SEM ROR. A proposta não traz. É o ROR que faz o Indicador nº 3 ser
--      contado em vez de digitado; entra pela interface, por instituição.
--  (c) SEM ORCID. Idem — é perguntado na Tela 1, com validação de dígito.
--  (d) SEM E-MAIL (acima).
--  (e) 20 pessoas SEM LATTES: 10 porque a linha 'URL DO CURRÍCULO' vem vazia na
--      proposta e 10 porque o link veio truncado na origem (sem o id). Ficou
--      NULO em vez de inventado. Ver `_meta.lacunas` em equipe.json.
--
--  ==========================================================================
--  CONTAGEM SEMEADA, POR CATEGORIA PICC (soma 209 = Quadro Geral)
--  ==========================================================================
--   Pesquisador                       74
--   Líder de Laboratório Associado    28
--   Colaborador                       23
--   Pesquisador Estrangeiro           22
--   Pesquisador Colaborador           21
--   Aluno                             13
--   Aluno de Pós-Graduação             9
--   Membro do Comitê Gestor            8
--   Administrativa                     5
--   Técnico                            3
--   Apoio Técnico                      1
--   Técnico de Laboratório             1
--   Vice-Coordenador                   1
--
--  PAÍS → ISO-3166-1 alpha-2 (único campo derivado; 187 são 'Brasil'):
--   Argentina        → AR
--   Brasil           → BR
--   Chile            → CL
--   Colômbia         → CO
--   Costa Rica       → CR
--   Equador          → EC
--   Espanha          → ES
--   Estados Unidos   → US
--   França           → FR
--   Guiana           → GY
--   Inglaterra       → GB
--   México           → MX
--   Panamá           → PA
--   Paraguai         → PY
--   Peru             → PE
--   Portugal         → PT
--   Duas escolhas não são mecânicas e ficam declaradas: 'Inglaterra' → GB
--   (o ISO 3166-1 não tem código para a Inglaterra; o país é o Reino Unido) e
--   'Guiana' → GY (a instituição declarada na proposta para a única pessoa
--   nesse país é a University of Guyana — Guiana, não Guiana Francesa).
--
--  MAPA LÍDER → LABORATÓRIO: os 28 nomes de `laboratorios.lla_nome`
--  (seeds/001_ciclo_1.sql) casaram com o catálogo por nome sem acento — os 28,
--  sem ambiguidade — e 27 deles casaram TAMBÉM pelo ID Lattes.
--  O 28º (UFS, Pablo Ariel Martinez) não tem Lattes na proposta; casou só pelo
--  nome. A sigla vai gravada em cada registro, no campo "lab", para que a
--  ligação seja auditável linha a linha e não dependa de comparar acentos em
--  tempo de execução.
-- ============================================================================

begin;

-- ------------------------------------------------- 1. AS 209 DA PROPOSTA ----
with ciclo as (
  select id from public.relatorio_ciclos where slug = 'ciclo-1'
),
entrada as (
  select $equipe$
[
{"id":"aldani-braz-carvalho","nome":"Aldani Braz Carvalho","categoria":"Colaborador","instituicao":"Fundação Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"1305959204330545"},
{"id":"alice-maria-costa-martins","nome":"Alice Maria Costa Martins","categoria":"Colaborador","instituicao":"Universidade Federal do Ceará","uf":"CE","pais":"BR","lattes":"7532334620264577"},
{"id":"antonio-coutinho-neto","nome":"Antonio Coutinho Neto","categoria":"Colaborador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"2544969941465695"},
{"id":"avenilson-gomes-da-trindade","nome":"Avenilson Gomes da Trindade","categoria":"Colaborador","instituicao":"Governo do Estado de Rondônia","uf":"RO","pais":"BR","lattes":"9964372026528960"},
{"id":"caio-coutinho-de-souza","nome":"Caio Coutinho de Souza","categoria":"Colaborador","instituicao":"Instituto Leônidas e Maria Deane","uf":"AM","pais":"BR","lattes":"5202386176640563"},
{"id":"caio-ismael-de-jesus-lasmar","nome":"Caio Ismael de Jesus Lasmar","categoria":"Colaborador","instituicao":"Fundação Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"6960687155163122"},
{"id":"deigna-lais-oliviak","nome":"Deigna Lais Oliviak","categoria":"Colaborador","instituicao":"Governo do Estado de Rondônia","uf":"RO","pais":"BR","lattes":"4074148081089019"},
{"id":"fabianne-araujo-gomes-dos-santos-alves","nome":"Fabianne Araújo Gomes dos Santos Alves","categoria":"Colaborador","instituicao":"Fundação Rondônia","uf":"RO","pais":"BR","lattes":"0437896314110869"},
{"id":"francisco-ivam-castro-do-nascimento","nome":"Francisco Ivam Castro do Nascimento","categoria":"Colaborador","instituicao":"Fundação Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"4778551969102332"},
{"id":"gabrielli-antonucci","nome":"Gabrielli Antonucci","categoria":"Colaborador","instituicao":"Prefeitura Municipal de Ji-Paraná","uf":"RO","pais":"BR","lattes":"8604965551017661"},
{"id":"igor-jose-boggione-santos","nome":"Igor José Boggione Santos","categoria":"Colaborador","instituicao":"Universidade Federal de São João Del-Rei","uf":"MG","pais":"BR","lattes":"9821155579435444"},
{"id":"jaina-rodrigues-evangelista","nome":"Jaina Rodrigues Evangelista","categoria":"Colaborador","instituicao":"Fundação Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"8141605096022749"},
{"id":"jefferson-ribeiro-da-rocha","nome":"Jefferson Ribeiro da Rocha","categoria":"Colaborador","instituicao":"Governo do Estado de Rondônia","uf":"RO","pais":"BR","lattes":"4000534431467708"},
{"id":"keoma-dias-pires-cangussu","nome":"Keoma Dias Pires Cangussu","categoria":"Colaborador","instituicao":"Antigen Desenvolvimento de Tecnologias de Vacinas e Serviços LTDA","uf":"TO","pais":"BR","lattes":"7613272823630123"},
{"id":"lais-de-souza-miranda","nome":"Laís de Souza Miranda","categoria":"Colaborador","instituicao":"Centro Universitário São Lucas","uf":"RO","pais":"BR","lattes":"9563782895380647"},
{"id":"marcela-milrea-araujo-barros","nome":"Marcela Milrea Araújo Barros","categoria":"Colaborador","instituicao":"Governo do Estado de Rondônia","uf":"RO","pais":"BR","lattes":"7115766333830560"},
{"id":"marco-antonio-ribeiro-de-menezes-lagos","nome":"Marco Antonio Ribeiro de Menezes Lagos","categoria":"Colaborador","instituicao":"Governo do Estado de Rondônia","uf":"RO","pais":"BR","lattes":"1759683803500265"},
{"id":"marcos-roberto-de-mattos-fontes","nome":"Marcos Roberto de Mattos Fontes","categoria":"Colaborador","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"4320362411241786"},
{"id":"marlei-novaes-de-sousa","nome":"Marlei Novaes de Sousa","categoria":"Colaborador","instituicao":"Centro Universitário São Lucas","uf":"RO","pais":"BR","lattes":"6641417402000690"},
{"id":"monique-cocco-teixeira","nome":"Monique Cocco Teixeira","categoria":"Colaborador","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"3033236138196271"},
{"id":"paulo-afonso-granjeiro","nome":"Paulo Afonso Granjeiro","categoria":"Colaborador","instituicao":"Universidade Federal de São João Del-Rei","uf":"MG","pais":"BR","lattes":"3487127981793274"},
{"id":"roberto-ataide-batalha-de-araujo","nome":"Roberto Ataide Batalha de Araujo","categoria":"Colaborador","instituicao":"Faculdades Integradas Aparício Carvalho","uf":"RO","pais":"BR","lattes":"1456266757809026"},
{"id":"valeria-machado-emiliano","nome":"Valéria Machado Emiliano","categoria":"Colaborador","instituicao":"Universidade de São Paulo","uf":"SP","pais":"BR","lattes":"6639959862942691"},
{"id":"bernardo-bruno-dias-baracho","nome":"Bernardo Bruno Dias Baracho","categoria":"Aluno","instituicao":"Universidade Federal do Rio Grande do Norte","uf":"RN","pais":"BR","lattes":"4587668574060435"},
{"id":"ester-de-moura-costa","nome":"Ester De Moura Costa","categoria":"Aluno","instituicao":"Universidade Federal do Rio Grande do Norte","uf":"RN","pais":"BR","lattes":"6168244948668136"},
{"id":"gisele-guimaraes-de-oliveira","nome":"Gisele Guimarães de Oliveira","categoria":"Aluno","instituicao":"Universidade Federal de Roraima","uf":"RR","pais":"BR","lattes":"5731358832160231"},
{"id":"glenda-natalia-bezerra-passos","nome":"Glenda Natália Bezerra Passos","categoria":"Aluno","instituicao":"Universidade Federal de Rodônia","uf":"RO","pais":"BR","lattes":"8387535682092002"},
{"id":"igor-vinicius-barbosa-duchini","nome":"Igor Vinícius Barbosa Duchini","categoria":"Aluno","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"9924325626656771"},
{"id":"italo-jaques-figueiredo-maia","nome":"Italo Jaques Figueiredo Maia","categoria":"Aluno","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"2146649208908883"},
{"id":"jose-augusto-ferreira-neto","nome":"José Augusto Ferreira Neto","categoria":"Aluno","instituicao":"Universidade Federal do Rio Grande do Norte","uf":"RN","pais":"BR","lattes":"0401494432064481"},
{"id":"kelvy-rosalvo-alencar-cardoso","nome":"Kelvy Rosalvo Alencar Cardoso","categoria":"Aluno","instituicao":"Universidade Federal de Alagoas","uf":"AL","pais":"BR","lattes":"6470726395279711"},
{"id":"mateus-farias-de-souza","nome":"Mateus Farias de Souza","categoria":"Aluno","instituicao":"Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia","uf":"RO","pais":"BR","lattes":"5834687386187545"},
{"id":"suyane-da-costa-oliveira","nome":"Suyane da Costa Oliveira","categoria":"Aluno","instituicao":"Centro Universitário São Lucas","uf":"RO","pais":"BR","lattes":"0082465789710337"},
{"id":"wagner-jefferson-rodrigues-da-silva","nome":"Wagner Jefferson Rodrigues da Silva","categoria":"Aluno","instituicao":"Universidade Federal do Rio Grande do Norte","uf":"RN","pais":"BR","lattes":"7660351039948494"},
{"id":"william-miyakava","nome":"William Miyakava","categoria":"Aluno","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"5666828990964134"},
{"id":"yldslan-soares-damasceno","nome":"Yldslan Soares Damasceno","categoria":"Aluno","instituicao":"Universidade Federal do Rio Grande do Norte","uf":"RN","pais":"BR","lattes":"0186972370111183"},
{"id":"anderson-antonio-molina-da-silva","nome":"Anderson Antonio Molina da Silva","categoria":"Aluno de Pós-Graduação","instituicao":"Universidade Federal da Grande Dourados","uf":"MS","pais":"BR","lattes":"1330206850070407"},
{"id":"beatriz-da-silva-lima","nome":"Beatriz da Silva Lima","categoria":"Aluno de Pós-Graduação","instituicao":"Universidade Federal do Amazonas","uf":"AM","pais":"BR","lattes":"9323224646425121"},
{"id":"daiana-cristina-batista-floresta","nome":"Daiana Cristina Batista Floresta","categoria":"Aluno de Pós-Graduação","instituicao":"Fundação Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"3459580462769477"},
{"id":"elania-barros-da-silva","nome":"Elania Barros da Silva","categoria":"Aluno de Pós-Graduação","instituicao":"Universidade Federal de Alagoas","uf":"AL","pais":"BR","lattes":"3461897839363844"},
{"id":"fernanda-cano-de-andrade-marques","nome":"Fernanda Cano de Andrade Marques","categoria":"Aluno de Pós-Graduação","instituicao":"Universidade Federal da Grande Dourados","uf":"MS","pais":"BR","lattes":"3035296856761692"},
{"id":"giovana-dias-garcia","nome":"Giovana Dias Garcia","categoria":"Aluno de Pós-Graduação","instituicao":"Universidade Federal da Grande Dourados","uf":"MS","pais":"BR","lattes":"1341703430337494"},
{"id":"heverton-schneider","nome":"Heverton Schneider","categoria":"Aluno de Pós-Graduação","instituicao":"Universidade Federal da Grande Dourados","uf":"MS","pais":"BR","lattes":"9543610492496798"},
{"id":"luis-flavio-de-araujo","nome":"Luis Flávio de Araújo","categoria":"Aluno de Pós-Graduação","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"0114037144799516"},
{"id":"marlucia-de-aquino-pereira","nome":"Marlúcia de Aquino Pereira","categoria":"Aluno de Pós-Graduação","instituicao":"Universidade Federal do Rio Grande do Norte","uf":"RN","pais":"BR","lattes":"7927958960513566"},
{"id":"ana-paula-de-azevedo-dos-santos","nome":"Ana Paula de Azevedo dos Santos","categoria":"Pesquisador Colaborador","instituicao":"Centro Universitário São Lucas","uf":"RO","pais":"BR","lattes":"1484034198638245"},
{"id":"anderson-maciel-de-lima","nome":"Anderson Maciel de Lima","categoria":"Pesquisador Colaborador","instituicao":"Faculdades Associadas de Ariquemes","uf":"RO","pais":"BR","lattes":"3694778069792771"},
{"id":"antonio-laffayete-pires-da-silveira","nome":"Antônio Laffayete Pires da Silveira","categoria":"Pesquisador Colaborador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"4256751725691657"},
{"id":"arlindo-gonzaga-branco-junior","nome":"Arlindo Gonzaga Branco Junior","categoria":"Pesquisador Colaborador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"3286105295450000"},
{"id":"chicoepab-surui-dias","nome":"Chicoepab Suruí Dias","categoria":"Pesquisador Colaborador","instituicao":"Associação Gabgir do Povo Indígena Paiter Surui","uf":"RO","pais":"BR","lattes":"0357402349200861"},
{"id":"cesar-luiz-da-silva-guimaraes","nome":"César Luiz da Silva Guimarães","categoria":"Pesquisador Colaborador","instituicao":"Instituto Brasileiro do Meio Ambiente e dos Recursos Naturais Renováveis","uf":"DF","pais":"BR","lattes":"7061870658928953"},
{"id":"fabricio-gatagon-surui","nome":"Fabricio Gatagon-Suruí","categoria":"Pesquisador Colaborador","instituicao":"Associação Gabgir do Povo Indígena Paiter Surui","uf":"RO","pais":"BR","lattes":"7849109960865206"},
{"id":"jefferson-pereira-caldas-dos-santos","nome":"Jefferson Pereira Caldas dos Santos","categoria":"Pesquisador Colaborador","instituicao":"Fundação Oswaldo Cruz","uf":"RJ","pais":"BR","lattes":"7351161123957784"},
{"id":"kayena-delaix-zaqueo","nome":"Kayena Delaix Zaqueo","categoria":"Pesquisador Colaborador","instituicao":"Instituto Federal de Rondônia - Campus de Colorado do Oeste","uf":"RO","pais":"BR","lattes":"4216831020096011"},
{"id":"malu-messias","nome":"Malu Messias","categoria":"Pesquisador Colaborador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"6352993606080779"},
{"id":"marcelo-lucian-ferronato","nome":"Marcelo Lucian Ferronato","categoria":"Pesquisador Colaborador","instituicao":"Ação Ecológica Guaporé","uf":"RO","pais":"BR","lattes":"7843921080156608"},
{"id":"marcos-barros-luiz","nome":"Marcos Barros Luiz","categoria":"Pesquisador Colaborador","instituicao":"Instituto Federal de Educação Ciência e Tecnologia de Rondônia","uf":"RO","pais":"BR","lattes":"2160591502844896"},
{"id":"narcisio-costa-bigio","nome":"Narcísio Costa Bigio","categoria":"Pesquisador Colaborador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"1180140934249426"},
{"id":"paulo-ricardo-dell-armelina-rocha","nome":"Paulo Ricardo Dell'Armelina Rocha","categoria":"Pesquisador Colaborador","instituicao":"Centro Universitário São Lucas","uf":"RO","pais":"BR","lattes":"6079014165946662"},
{"id":"rafaela-diniz-sousa","nome":"Rafaela Diniz Sousa","categoria":"Pesquisador Colaborador","instituicao":"Centro Universitário São Lucas","uf":"RO","pais":"BR","lattes":"3577367760914649"},
{"id":"renata-santos-rodrigues","nome":"Renata Santos Rodrigues","categoria":"Pesquisador Colaborador","instituicao":"Universidade Federal de Uberlândia","uf":"MG","pais":"BR","lattes":"2516569970975669"},
{"id":"ronald-sodre-martins","nome":"Ronald Sodre Martins","categoria":"Pesquisador Colaborador","instituicao":"Instituto Chico Mendes de Conservação da Biodiversidade","uf":"DF","pais":"BR","lattes":"7436266068361112"},
{"id":"sergio-de-almeida-basano","nome":"Sergio de Almeida Basano","categoria":"Pesquisador Colaborador","instituicao":"Centro de Pesquisa em Medicina Tropical de Rondônia","uf":"RO","pais":"BR","lattes":"4802820578036724"},
{"id":"tassia-rafaella-costa","nome":"Tassia Rafaella Costa","categoria":"Pesquisador Colaborador","instituicao":"Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia","uf":"RO","pais":"BR","lattes":"9523155473412511"},
{"id":"viviane-pereira-bacarin","nome":"Viviane Pereira Bacarin","categoria":"Pesquisador Colaborador","instituicao":"Faculdades Associadas de Ariquemes","uf":"RO","pais":"BR","lattes":"8479338520893669"},
{"id":"yasmin-vergani-araujo","nome":"Yasmin Vergani Araujo","categoria":"Pesquisador Colaborador","instituicao":"Fundação Rondônia","uf":"RO","pais":"BR","lattes":"0617428822661515"},
{"id":"adnilson-de-almeida-silva","nome":"Adnilson de Almeida Silva","categoria":"Pesquisador","instituicao":"Fundação Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"1636594441225024"},
{"id":"adriana-cristina-da-silva-nunes","nome":"Adriana Cristina da Silva Nunes","categoria":"Pesquisador","instituicao":"Fundação Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"1107147892852610"},
{"id":"aleff-ferreira-francisco","nome":"Aleff Ferreira Francisco","categoria":"Pesquisador","instituicao":"Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia","uf":"RO","pais":"BR","lattes":"6740177714494876"},
{"id":"alessandro-donaire-de-santana","nome":"Alessandro Donaire de Santana","categoria":"Pesquisador","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"7168795224643066"},
{"id":"amanda-trindade-amorim","nome":"Amanda Trindade Amorim","categoria":"Pesquisador","instituicao":"Universidade Federal da Grande Dourados","uf":"MS","pais":"BR","lattes":"4211583011965886"},
{"id":"anderson-makoto-kayano","nome":"Anderson Makoto Kayano","categoria":"Pesquisador","instituicao":"Centro de Pesquisa em Medicina Tropical de Rondônia","uf":"RO","pais":"BR","lattes":"9089138319657407"},
{"id":"andre-rodrigues-da-cunha-barreto-vianna","nome":"André Rodrigues da Cunha Barreto Vianna","categoria":"Pesquisador","instituicao":"Universidade Federal do Paraná","uf":"PR","pais":"BR","lattes":"4686710449601127"},
{"id":"andrea-novais-moreno-amaral","nome":"Andréa Novais Moreno Amaral","categoria":"Pesquisador","instituicao":"Pontifícia Universidade Católica do Paraná","uf":"PR","pais":"BR","lattes":"4267363260096710"},
{"id":"angelo-jose-magro","nome":"Angelo José Magro","categoria":"Pesquisador","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"0059017255172730"},
{"id":"angelo-laurence-covatti-terra","nome":"Angelo Laurence Covatti Terra","categoria":"Pesquisador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"5432685912072439"},
{"id":"ariane-frassoni-dos-santos-de-mattos","nome":"Ariane Frassoni dos Santos de Mattos","categoria":"Pesquisador","instituicao":"Instituto Nacional de Pesquisas Espaciais","uf":"SP","pais":"BR","lattes":"9897358688381968"},
{"id":"bruno-de-souza-lima","nome":"Bruno de Souza Lima","categoria":"Pesquisador","instituicao":"Universidade Federal da Grande Dourados","uf":"MS","pais":"BR","lattes":"5609440742548710"},
{"id":"carlos-alexandre-henrique-fernandes","nome":"Carlos Alexandre Henrique Fernandes","categoria":"Pesquisador","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"0031905467649970"},
{"id":"cassio-arthur-wollmann","nome":"Cássio Arthur Wollmann","categoria":"Pesquisador","instituicao":"Universidade Federal de Santa Maria","uf":"RS","pais":"BR","lattes":"9512055876805245"},
{"id":"daniel-carvalho-pimenta","nome":"Daniel Carvalho Pimenta","categoria":"Pesquisador","instituicao":"Instituto Butantan","uf":"SP","pais":"BR","lattes":"2791913950833163"},
{"id":"danielle-cardozo-frasca-teixeira","nome":"Danielle Cardozo Frasca Teixeira","categoria":"Pesquisador","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"7165991581840732"},
{"id":"david-mendes","nome":"David Mendes","categoria":"Pesquisador","instituicao":"Universidade Federal do Rio Grande do Norte","uf":"RN","pais":"BR","lattes":"4411895644401494"},
{"id":"dimas-de-barros-santiago","nome":"Dimas de Barros Santiago","categoria":"Pesquisador","instituicao":"Universidade Federal de Alagoas","uf":"AL","pais":"BR","lattes":"1856356565073613"},
{"id":"douglas-siqueira-de-almeida-chaves","nome":"Douglas Siqueira de Almeida Chaves","categoria":"Pesquisador","instituicao":"Universidade Federal Rural do Rio de Janeiro","uf":"RJ","pais":"BR","lattes":"1864237318361425"},
{"id":"elieth-afonso-de-mesquita","nome":"Elieth Afonso de Mesquita","categoria":"Pesquisador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"3664332709495119"},
{"id":"fabiana-nakashima","nome":"Fabiana Nakashima","categoria":"Pesquisador","instituicao":"Universidade Federal de Roraima","uf":"RR","pais":"BR","lattes":"9715943105309778"},
{"id":"fabio-de-oliveira-sanches","nome":"Fabio de Oliveira Sanches","categoria":"Pesquisador","instituicao":"Universidade Federal de Juiz de Fora","uf":"MG","pais":"BR","lattes":"8393955035468390"},
{"id":"fabio-luiz-teixeira-goncalves","nome":"Fábio Luiz Teixeira Gonçalves","categoria":"Pesquisador","instituicao":"Universidade de São Paulo","uf":"SP","pais":"BR","lattes":"9690116209410158"},
{"id":"gean-carla-da-silva-sganderla","nome":"Gean Carla da Silva Sganderla","categoria":"Pesquisador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"6739056486617246"},
{"id":"gisele-picolo","nome":"Gisele Picolo","categoria":"Pesquisador","instituicao":"Instituto Butantan","uf":"SP","pais":"BR","lattes":"3526656219218763"},
{"id":"graziela-tosini-tejas","nome":"Graziela Tosini Tejas","categoria":"Pesquisador","instituicao":"Instituto Federal de Educação Ciência e Tecnologia de Rondônia","uf":"RO","pais":"BR","lattes":"9511031028069209"},
{"id":"haroldo-fraga-de-campos-velho","nome":"Haroldo Fraga de Campos Velho","categoria":"Pesquisador","instituicao":"Instituto Nacional de Pesquisas Espaciais","uf":"SP","pais":"BR","lattes":"5142426481528206"},
{"id":"jakeline-baratto","nome":"Jakeline Baratto","categoria":"Pesquisador","instituicao":"Universidade de São Paulo","uf":"SP","pais":"BR","lattes":"0554980052816155"},
{"id":"jessica-norberto-rocha","nome":"Jessica Norberto Rocha","categoria":"Pesquisador","instituicao":"Fundação Centro de Ciências e Educação Superior à Distância do Estado do RJ","uf":"RJ","pais":"BR","lattes":"9146559931407210"},
{"id":"jones-montenegro-da-silva","nome":"Jones Montenegro da Silva","categoria":"Pesquisador","instituicao":"Instituto Federal de Roraima","uf":"RR","pais":"BR","lattes":"4701582072086750"},
{"id":"jorge-otavio-maia-barreto","nome":"Jorge Otávio Maia Barreto","categoria":"Pesquisador","instituicao":"Fundação Oswaldo Cruz - Diretoria Regional de Brasília","uf":"DF","pais":"BR","lattes":"6645888812991827"},
{"id":"jose-francisco-de-oliveira-junior","nome":"José Francisco de Oliveira Júnior","categoria":"Pesquisador","instituicao":"Universidade Federal de Alagoas","uf":"AL","pais":"BR","lattes":"7026272780442852"},
{"id":"juliana-aparecida-anochi","nome":"Juliana Aparecida Anochi","categoria":"Pesquisador","instituicao":"Instituto Nacional de Pesquisas Espaciais","uf":"SP","pais":"BR","lattes":"2720072834057575"},
{"id":"juliane-correa-gloria","nome":"Juliane Corrêa Glória","categoria":"Pesquisador","instituicao":"Instituto Leônidas e Maria Deane","uf":"AM","pais":"BR","lattes":"8812249617761291"},
{"id":"karla-patricia-de-oliveira-luna","nome":"Karla Patrícia de Oliveira Luna","categoria":"Pesquisador","instituicao":"Universidade Estadual da Paraíba","uf":"PB","pais":"BR","lattes":"3043580578707915"},
{"id":"kessia-caroline-souza-alves","nome":"Késsia Caroline Souza Alves","categoria":"Pesquisador","instituicao":"Instituto Leônidas e Maria Deane","uf":"AM","pais":"BR","lattes":"6702263433510376"},
{"id":"leidiane-amorim-soares","nome":"Leidiane Amorim Soares","categoria":"Pesquisador","instituicao":"Fundação Rondônia","uf":"RO","pais":"BR","lattes":"4102934680517945"},
{"id":"lorrane-barbosa-alves","nome":"Lorrane Barbosa Alves","categoria":"Pesquisador","instituicao":"Universidade Federal da Grande Dourados","uf":"MS","pais":"BR","lattes":"7929365947112687"},
{"id":"lucas-vaz-peres","nome":"Lucas Vaz Peres","categoria":"Pesquisador","instituicao":"Universidade Federal do Oeste do Pará","uf":"PA","pais":"BR","lattes":"0492582888795669"},
{"id":"marcela-alvares-oliveira","nome":"Marcela Alvares Oliveira","categoria":"Pesquisador","instituicao":"Faculdades Integradas Aparício Carvalho","uf":"RO","pais":"BR","lattes":"9346965102777187"},
{"id":"maria-aurea-pinheiro-de-almeida-silveira","nome":"Maria Aurea Pinheiro de Almeida Silveira","categoria":"Pesquisador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"2335579486048242"},
{"id":"maria-cristina-celuppi","nome":"Maria Cristina Celuppi","categoria":"Pesquisador","instituicao":"Universidade de São Paulo","uf":"SP","pais":"BR","lattes":"9806332874122434"},
{"id":"maria-edilene-martins-de-almeida","nome":"Maria Edilene Martins de Almeida","categoria":"Pesquisador","instituicao":"Instituto Leônidas e Maria Deane","uf":"AM","pais":"BR","lattes":"9637683978812335"},
{"id":"marina-piacenti-da-silva","nome":"Marina Piacenti da Silva","categoria":"Pesquisador","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"7134236583427308"},
{"id":"micejane-da-silva-costa","nome":"Micejane da Silva Costa","categoria":"Pesquisador","instituicao":"Universidade Federal de Alagoas","uf":"AL","pais":"BR","lattes":"8327740316993381"},
{"id":"monica-cristina-damiao-mendes","nome":"Monica Cristina Damiao Mendes","categoria":"Pesquisador","instituicao":"Universidade Federal do Rio Grande do Norte","uf":"RN","pais":"BR","lattes":"3222239663338873"},
{"id":"monica-pereira-lima-cunha","nome":"Mônica Pereira Lima Cunha","categoria":"Pesquisador","instituicao":"Fundação Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"7304754015970927"},
{"id":"norma-lucena-cavalcanti-licinio-da-silva","nome":"Norma Lucena Cavalcanti Licinio da Silva","categoria":"Pesquisador","instituicao":"Instituto Aggeu Magalhães","uf":"PE","pais":"BR","lattes":"7341938714365067"},
{"id":"nadia-gilma-beserra-de-lima","nome":"Nádia Gilma Beserra de Lima","categoria":"Pesquisador","instituicao":"Universidade de São Paulo","uf":"SP","pais":"BR","lattes":"6672666349878514"},
{"id":"osmindo-rodrigues-pires-junior","nome":"Osmindo Rodrigues Pires Júnior","categoria":"Pesquisador","instituicao":"Universidade de Brasília","uf":"DF","pais":"BR","lattes":"3040017553449056"},
{"id":"osvanda-silva-de-moura","nome":"Osvanda Silva de Moura","categoria":"Pesquisador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"6645304551883488"},
{"id":"patricia-silva-ferreira","nome":"Patricia Silva Ferreira","categoria":"Pesquisador","instituicao":"Universidade Federal da Grande Dourados","uf":"MS","pais":"BR","lattes":"9245693947308946"},
{"id":"paulo-vilela-cruz","nome":"Paulo Vilela Cruz","categoria":"Pesquisador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"2767238488997600"},
{"id":"paulo-wender-portal-gomes","nome":"Paulo Wender Portal Gomes","categoria":"Pesquisador","instituicao":"Universidade Federal do Pará","uf":"PA","pais":"BR","lattes":"6102293278640224"},
{"id":"priscila-ferreira-de-aquino","nome":"Priscila Ferreira de Aquino","categoria":"Pesquisador","instituicao":"Instituto Leônidas e Maria Deane","uf":"AM","pais":"BR","lattes":"0927444246880817"},
{"id":"priscilla-venancio-ikefuti","nome":"Priscilla Venâncio Ikefuti","categoria":"Pesquisador","instituicao":"Universidade Estadual do Maranhão","uf":"MA","pais":"BR","lattes":"0938933637779008"},
{"id":"rafael-ademir-oliveira-de-andrade","nome":"Rafael Ademir Oliveira de Andrade","categoria":"Pesquisador","instituicao":"Centro Universitário São Lucas","uf":"RO","pais":"BR","lattes":"3790116411091463"},
{"id":"rafael-brugnolli-medeiros","nome":"Rafael Brugnolli Medeiros","categoria":"Pesquisador","instituicao":"Universidade Federal da Grande Dourados","uf":"MS","pais":"BR","lattes":"4983120676722029"},
{"id":"raphael-pablo-tapajos-silva","nome":"Raphael Pablo Tapajós Silva","categoria":"Pesquisador","instituicao":"Universidade Federal do Oeste do Pará","uf":"PA","pais":"BR","lattes":"3925768576575087"},
{"id":"reginaldo-martins-da-silva-de-souza","nome":"Reginaldo Martins da Silva de Souza","categoria":"Pesquisador","instituicao":"Instituto Federal de Educação Ciência e Tecnologia de Rondônia","uf":"RO","pais":"BR","lattes":"6030930058307437"},
{"id":"roberta-jeane-bezerra-jorge","nome":"Roberta Jeane Bezerra Jorge","categoria":"Pesquisador","instituicao":"Universidade Federal do Ceará","uf":"CE","pais":"BR","lattes":"5616845340608352"},
{"id":"robson-waldemar-avila","nome":"Robson Waldemar Ávila","categoria":"Pesquisador","instituicao":"Universidade Federal do Ceará","uf":"CE","pais":"BR","lattes":"2072684176575855"},
{"id":"rodrigo-alves-soares-cruz","nome":"Rodrigo Alves Soares Cruz","categoria":"Pesquisador","instituicao":"Universidade Federal do Amapá","uf":"AP","pais":"BR","lattes":"5290132421152870"},
{"id":"rodrigo-ligabue-braun","nome":"Rodrigo Ligabue Braun","categoria":"Pesquisador","instituicao":"Fundação Universidade Federal de Ciências da Saúde de Porto Alegre","uf":"RS","pais":"BR","lattes":"7505794953041744"},
{"id":"rodrigo-simoes-silva","nome":"Rodrigo Simões Silva","categoria":"Pesquisador","instituicao":"Instituto Federal de Rondônia - Campus Jaru","uf":"RO","pais":"BR","lattes":"6907591478449966"},
{"id":"ronaldo-de-almeida","nome":"Ronaldo de Almeida","categoria":"Pesquisador","instituicao":"Fundação Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"9982051066384373"},
{"id":"rubiani-de-cassia-pagotto","nome":"Rubiani de Cassia Pagotto","categoria":"Pesquisador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"1582973611190117"},
{"id":"saymon-de-albuquerque","nome":"Saymon de Albuquerque","categoria":"Pesquisador","instituicao":"Centro Universitário São Lucas","uf":"RO","pais":"BR","lattes":"7130569683759838"},
{"id":"selene-elifio-esposito","nome":"Selene Elifio Esposito","categoria":"Pesquisador","instituicao":"Pontifícia Universidade Católica do Paraná","uf":"PR","pais":"BR","lattes":"5929535323455233"},
{"id":"sergio-nunes-de-jesus","nome":"Sérgio Nunes de Jesus","categoria":"Pesquisador","instituicao":"Instituto Federal de Rondônia - Campus Cacoal","uf":"RO","pais":"BR","lattes":"9648583745536616"},
{"id":"wandson-braamcamp-de-souza-pinheiro","nome":"Wandson Braamcamp de Souza Pinheiro","categoria":"Pesquisador","instituicao":"Universidade Federal do Pará","uf":"PA","pais":"BR","lattes":"8867866033296703"},
{"id":"washington-luiz-felix-correia-filho","nome":"Washington Luiz Félix Correia Filho","categoria":"Pesquisador","instituicao":"Universidade Federal de Alagoas","uf":"AL","pais":"BR","lattes":"7596712599262929"},
{"id":"william-cristian-da-silva-pizzaia","nome":"William Cristian da Silva Pizzaia","categoria":"Pesquisador","instituicao":"Faculdades Associadas de Ariquemes","uf":"RO","pais":"BR","lattes":"5255638248194088"},
{"id":"wilson-gomez-manrique","nome":"Wilson Gómez Manrique","categoria":"Pesquisador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR"},
{"id":"edney-costa-souza","nome":"Edney Costa Souza","categoria":"Administrativa","instituicao":"Faculdade Católica de Rondônia","uf":"RO","pais":"BR","lattes":"2378354468519638"},
{"id":"gildazio-pereira-da-silva-junior","nome":"Gildázio Pereira da Silva Júnior","categoria":"Administrativa","instituicao":"Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia","uf":"RO","pais":"BR","lattes":"0422309916542191"},
{"id":"ilton-monteiro-alves","nome":"Ilton Monteiro Alves","categoria":"Administrativa","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"9709696233513751"},
{"id":"joao-candido-andre-da-silva-neto","nome":"João Cândido André da Silva Neto","categoria":"Administrativa","instituicao":"Universidade Federal do Amazonas","uf":"AM","pais":"BR","lattes":"6693264591240467"},
{"id":"raylan-araujo-da-silva","nome":"Raylan Araújo da Silva","categoria":"Administrativa","instituicao":"Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia","uf":"RO","pais":"BR","lattes":"7988380918815575"},
{"id":"carlos-henrique-gomes-martins","nome":"Carlos Henrique Gomes Martins","categoria":"Membro do Comitê Gestor","instituicao":"Universidade Federal de Uberlândia","uf":"MG","pais":"BR","lattes":"8076024656192550"},
{"id":"carolina-bioni-garcia-teles","nome":"Carolina Bioni Garcia Teles","categoria":"Membro do Comitê Gestor","instituicao":"Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia","uf":"RO","pais":"BR","lattes":"8279471785523666"},
{"id":"cleria-mendonca-de-moraes","nome":"Cléria Mendonça de Moraes","categoria":"Membro do Comitê Gestor","instituicao":"Universidade Federal de Roraima","uf":"RR","pais":"BR","lattes":"4518337589148307"},
{"id":"consuelo-yumiko-yoshioka-e-silva","nome":"Consuelo Yumiko Yoshioka e Silva","categoria":"Membro do Comitê Gestor","instituicao":"Universidade Federal do Pará","uf":"PA","pais":"BR","lattes":"8337688339279747"},
{"id":"dorisvalder-dias-nunes","nome":"Dorisvalder Dias Nunes","categoria":"Membro do Comitê Gestor","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"7319692127609590"},
{"id":"lorane-izabel-da-silva-hage-melim","nome":"Lorane Izabel da Silva Hage Melim","categoria":"Membro do Comitê Gestor","instituicao":"Universidade Federal do Amapá","uf":"AP","pais":"BR","lattes":"2855597663270186"},
{"id":"luis-marcelo-aranha-camargo","nome":"Luís Marcelo Aranha Camargo","categoria":"Membro do Comitê Gestor","instituicao":"Universidade de São Paulo","uf":"SP","pais":"BR","lattes":"0766735065718186"},
{"id":"rudson-de-jesus-holanda","nome":"Rudson de Jesus Holanda","categoria":"Membro do Comitê Gestor","instituicao":"Universidade Federal do Amazonas","uf":"AM","pais":"BR","lattes":"3277542005309012"},
{"id":"emannuel-bezerra-cavalcante-da-silva","nome":"Emannuel Bezerra Cavalcante da Silva","categoria":"Apoio Técnico","instituicao":"Universidade Federal do Rio Grande do Norte","uf":"RN","pais":"BR","lattes":"2401299936583841"},
{"id":"rogerio-rozolen-alves","nome":"Rogério Rozolen Alves","categoria":"Técnico de Laboratório","instituicao":"Universidade de São Paulo","uf":"SP","pais":"BR","lattes":"1672788165411371"},
{"id":"aaron-gomez-arguello","nome":"Aarón Gómez Argüello","categoria":"Pesquisador Estrangeiro","instituicao":"Universidad de Costa Rica","pais":"CR"},
{"id":"alberto-balderas-martinez","nome":"Alberto Balderas Martínez","categoria":"Pesquisador Estrangeiro","instituicao":"Universidad Autónoma del Estado de México","pais":"MX"},
{"id":"ana-fidelina-gomez-garay","nome":"Ana Fidelina Gómez Garay","categoria":"Pesquisador Estrangeiro","instituicao":"Centro para el Desarrollo de la Investigación Científica","pais":"PY"},
{"id":"ana-luisa-novo-de-oliveira","nome":"Ana Luísa Novo de Oliveira","categoria":"Pesquisador Estrangeiro","instituicao":"Universidade do Porto","pais":"PT"},
{"id":"aristides-quintero-rueda","nome":"Aristides Quintero Rueda","categoria":"Pesquisador Estrangeiro","instituicao":"Universidad de Panama","pais":"PA"},
{"id":"carolina-leticia-zilli-vieira","nome":"Carolina Letícia Zilli Vieira","categoria":"Pesquisador Estrangeiro","instituicao":"Harvard University","pais":"US","lattes":"1784557010448923"},
{"id":"cristiane-bregge-da-silva","nome":"Cristiane Bregge da Silva","categoria":"Pesquisador Estrangeiro","instituicao":"Universidad Nacional Costa Rica","pais":"CR","lattes":"8464495806421454"},
{"id":"dan-erick-vivas-ruiz","nome":"Dan Erick Vivas Ruiz","categoria":"Pesquisador Estrangeiro","instituicao":"Universidad Nacional Mayor de San Marcos","pais":"PE"},
{"id":"felix","nome":"Felix","categoria":"Pesquisador Estrangeiro","instituicao":"Universidad de Chile","pais":"CL"},
{"id":"fernando-albericio","nome":"Fernando Alberício","categoria":"Pesquisador Estrangeiro","instituicao":"Universitat de Barcelona","pais":"ES"},
{"id":"fernando-henrique-de-sales","nome":"Fernando Henrique de Sales","categoria":"Pesquisador Estrangeiro","instituicao":"San Diego State University","pais":"US","lattes":"0854355524271089"},
{"id":"franck-raphael-molina","nome":"Franck Raphael Molina","categoria":"Pesquisador Estrangeiro","instituicao":"Centre National de la Recherche Scientifique","pais":"FR"},
{"id":"gerard-lambeau","nome":"Gérard Lambeau","categoria":"Pesquisador Estrangeiro","instituicao":"Centre National de la Recherche Scientifique","pais":"FR"},
{"id":"hatem-kallel","nome":"Hatem Kallel","categoria":"Pesquisador Estrangeiro","instituicao":"University Of Guyana","pais":"GY"},
{"id":"jorge-javier-alfonso-ruiz-diaz","nome":"Jorge Javier Alfonso Ruiz Diaz","categoria":"Pesquisador Estrangeiro","instituicao":"Centro para el Desarrollo de la Investigación Científica","pais":"PY"},
{"id":"jose-rafael-de-almeida","nome":"José Rafael de Almeida","categoria":"Pesquisador Estrangeiro","instituicao":"Universidad Regional Amazónica","pais":"EC","lattes":"3089670656458982"},
{"id":"laura-cristina-ana-leiva","nome":"Laura Cristina Ana Leiva","categoria":"Pesquisador Estrangeiro","instituicao":"Universidad Nacional Del Nordeste","pais":"AR"},
{"id":"leonel-ives-montealegre-sanchez","nome":"Leonel Ives Montealegre Sánchez","categoria":"Pesquisador Estrangeiro","instituicao":"Universidad Autónoma de Occidente de Cali","pais":"CO"},
{"id":"luciano-sebastian-fusco","nome":"Luciano Sebastian Fusco","categoria":"Pesquisador Estrangeiro","instituicao":"Universidad Nacional Del Nordeste","pais":"AR"},
{"id":"nils-wed","nome":"Nils Wed","categoria":"Pesquisador Estrangeiro","instituicao":"European Centre For Medium Range Weather Forecasts","pais":"GB"},
{"id":"sebastien-larreche","nome":"Sebastién Larreché","categoria":"Pesquisador Estrangeiro","instituicao":"Université Paris-Cité","pais":"FR"},
{"id":"vania-maria-martim-braga","nome":"Vânia Maria Martim Braga","categoria":"Pesquisador Estrangeiro","instituicao":"Imperial College London - Silwood Park Campus","pais":"GB"},
{"id":"joao-paulo-assis-gobo","nome":"João Paulo Assis Gobo","categoria":"Vice-Coordenador","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"6216803824187190"},
{"id":"denise-roberta-borges-rosada","nome":"Denise Roberta Borges Rosada","categoria":"Técnico","instituicao":"Claretiano Centro Universitário","uf":"SP","pais":"BR","lattes":"3784477659507918"},
{"id":"luiz-henrique-anzaloni-pedrosa","nome":"Luiz Henrique Anzaloni Pedrosa","categoria":"Técnico","instituicao":"Universidade de São Paulo","uf":"SP","pais":"BR","lattes":"5878169783821955"},
{"id":"luiz-herman-soares-gil","nome":"Luiz Herman Soares Gil","categoria":"Técnico","instituicao":"Instituto de Pesquisas em Patologias Tropicais de Rondônia","uf":"RO","pais":"BR","lattes":"8637818261254445"},
{"id":"alex-sander-rodrigues-cangussu","nome":"Alex Sander Rodrigues Cangussu","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal do Tocantins","uf":"TO","pais":"BR","lattes":"5020204291901063","lab":"UFT"},
{"id":"alexandre-de-almeida-e-silva","nome":"Alexandre de Almeida e Silva","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"6440720566226268","lab":"UNIR-1"},
{"id":"ana-carla-dos-santos-gomes","nome":"Ana Carla dos Santos Gomes","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal do Oeste do Pará","uf":"PA","pais":"BR","lattes":"7570030284513470","lab":"UFOPA"},
{"id":"carolina-rodrigues-da-costa-doria","nome":"Carolina Rodrigues da Costa Doria","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"6716883529427154","lab":"UNIR-2"},
{"id":"charlei-aparecido-da-silva","nome":"Charlei Aparecido da Silva","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal da Grande Dourados","uf":"MS","pais":"BR","lattes":"1949183981749520","lab":"UFGD"},
{"id":"eduardo-bezerra-de-almeida-junior","nome":"Eduardo Bezerra de Almeida Junior","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal do Maranhão","uf":"MA","pais":"BR","lattes":"3142116071365323","lab":"UFMA"},
{"id":"eliana-campelo-lago","nome":"Eliana Campêlo Lago","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Estadual do Maranhão","uf":"MA","pais":"BR","lattes":"2913451575350769","lab":"UEMA"},
{"id":"elisabete-lourdes-do-nascimento","nome":"Elisabete Lourdes do Nascimento","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"9724703168940206","lab":"UNIR-3"},
{"id":"emerson-galvani","nome":"Emerson Galvani","categoria":"Líder de Laboratório Associado","instituicao":"Universidade de São Paulo","uf":"SP","pais":"BR","lattes":"2026434763745090","lab":"USP"},
{"id":"estevao-rafael-fernandes","nome":"Estevão Rafael Fernandes","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"9325979084800204","lab":"UNIR-4"},
{"id":"evandro-luiz-dall-oglio","nome":"Evandro Luiz Dall'Oglio","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de Mato Grosso","uf":"MT","pais":"BR","lattes":"0288804659104012","lab":"UFMT"},
{"id":"flavio-henrique-da-silva","nome":"Flavio Henrique da Silva","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de São Carlos","uf":"SP","pais":"BR","lattes":"1757309852446263","lab":"UFSCar"},
{"id":"gabriel-zazeri","nome":"Gabriel Zazeri","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de Roraima","uf":"RR","pais":"BR","lattes":"4523821762412955","lab":"UFRR"},
{"id":"irlon-maciel-ferreira","nome":"Irlon Maciel Ferreira","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal do Amapá","uf":"AP","pais":"BR","lattes":"9897023410899133","lab":"UNIFAP"},
{"id":"luis-andre-morais-mariuba","nome":"Luis André Morais Mariúba","categoria":"Líder de Laboratório Associado","instituicao":"Instituto Leônidas e Maria Deane","uf":"AM","pais":"BR","lattes":"4784959431673419","lab":"ILMD"},
{"id":"margarete-cristiane-de-costa-trindade-amorim","nome":"Margarete Cristiane de Costa Trindade Amorim","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"6644811083291335","lab":"UNESP-1"},
{"id":"michel-watanabe","nome":"Michel Watanabe","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"2210782014123027","lab":"UNIR-5"},
{"id":"milton-nascimento-da-silva","nome":"Milton Nascimento da Silva","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal do Pará","uf":"PA","pais":"BR","lattes":"6742390457977989","lab":"UFPA"},
{"id":"mirian-akemi-furuie-hayashi","nome":"Mirian Akemi Furuie Hayashi","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de São Paulo","uf":"SP","pais":"BR","lattes":"5559309395232147","lab":"UNIFESP"},
{"id":"natacha-cintia-regina-aleixo","nome":"Natacha Cintia Regina Aleixo","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal do Amazonas","uf":"AM","pais":"BR","lattes":"9509290240626293","lab":"UFAM"},
{"id":"pablo-ariel-martinez","nome":"Pablo Ariel Martinez","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de Sergipe","uf":"SE","pais":"BR","lab":"UFS"},
{"id":"renata-carolina-zanetti-lofrano","nome":"Renata Carolina Zanetti Lofrano","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de São João Del-Rei","uf":"MG","pais":"BR","lattes":"5561482457720983","lab":"UFSJ"},
{"id":"renata-toscano-simoes","nome":"Renata Toscano Simões","categoria":"Líder de Laboratório Associado","instituicao":"Faculdade Santa Casa BH","uf":"MG","pais":"BR","lattes":"3112803094228207","lab":"FSCBH"},
{"id":"renee-laufer-amorim","nome":"Renee Laufer Amorim","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Estadual Paulista Júlio de Mesquita Filho","uf":"SP","pais":"BR","lattes":"9795829022108105","lab":"UNESP-2"},
{"id":"roberto-nicolete","nome":"Roberto Nicolete","categoria":"Líder de Laboratório Associado","instituicao":"Fundação Oswaldo Cruz - Ceará","uf":"CE","pais":"BR","lattes":"0447073555893530","lab":"FIOCRUZ/CE"},
{"id":"walter-luis-garrido-cavalcante","nome":"Walter Luís Garrido Cavalcante","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de Minas Gerais","uf":"MG","pais":"BR","lattes":"2046394525786539","lab":"UFMG"},
{"id":"wanderley-rodrigues-bastos","nome":"Wanderley Rodrigues Bastos","categoria":"Líder de Laboratório Associado","instituicao":"Universidade Federal de Rondônia","uf":"RO","pais":"BR","lattes":"4028993334703256","lab":"UNIR-6"},
{"id":"xenia-de-castro-barbosa","nome":"Xênia de Castro Barbosa","categoria":"Líder de Laboratório Associado","instituicao":"Instituto Federal de Educação Ciência e Tecnologia de Rondônia","uf":"RO","pais":"BR","lattes":"2736450812832214","lab":"IFRO"}
]
$equipe$::jsonb as j
),
pessoas as (
  select e ->> 'id'                        as catalogo_id,
         e ->> 'nome'                      as nome,
         e ->> 'categoria'                 as categoria_picc,
         coalesce(e ->> 'instituicao', '') as instituicao_nome,
         e ->> 'uf'                        as uf,
         coalesce(e ->> 'pais', 'BR')      as pais_iso2,
         e ->> 'lattes'                    as lattes_id,
         e ->> 'lab'                       as lab_sigla
    from entrada, jsonb_array_elements(entrada.j) as e
)
insert into public.ciclo_membros
  (ciclo_id, catalogo_id, nome, email, email_pendente, categoria_picc, papel,
   laboratorio_id, instituicao_nome, uf, pais_iso2, lattes_id, convidado_em, ativo)
select c.id,
       p.catalogo_id,
       p.nome,
       -- e-mail de reserva: RFC 2606 (.invalid nunca resolve). Ver cabeçalho.
       p.catalogo_id || '@pendente.inct-conexao.invalid',
       true,
       p.categoria_picc,
       case p.categoria_picc
         when 'Líder de Laboratório Associado' then 'lla'
         when 'Aluno'                          then 'estudante'
         when 'Aluno de Pós-Graduação'         then 'estudante'
         when 'Administrativa'                 then 'tecnico_admin'
         when 'Técnico'                        then 'tecnico_admin'
         when 'Apoio Técnico'                  then 'tecnico_admin'
         when 'Técnico de Laboratório'         then 'tecnico_admin'
         -- Comitê Gestor e Vice-Coordenador entram SEM poder, de propósito:
         -- ver "papel NÃO VEM DA CATEGORIA QUANDO A CATEGORIA DÁ PODER".
         when 'Membro do Comitê Gestor'        then 'pesquisador'
         when 'Vice-Coordenador'               then 'pesquisador'
         else 'pesquisador'   -- Pesquisador, Colaborador, Pesq. Estrangeiro,
       end,                   -- Pesquisador Colaborador
       l.id,                  -- só os 28 líderes têm laboratório aqui
       p.instituicao_nome,
       p.uf,
       p.pais_iso2,
       p.lattes_id,
       null,                  -- convidado_em: NINGUÉM foi convidado por e-mail
       true
  from pessoas p
  cross join ciclo c
  left join public.laboratorios l
    on l.ciclo_id = c.id and l.sigla = p.lab_sigla
on conflict (ciclo_id, catalogo_id) where catalogo_id is not null do nothing;

-- ------------------------------------------------------- 2. QUEM JÁ TEM CONTA
-- Casa quem já existe em auth.users (coordenação, pessoal da seleção de IC).
-- Como nenhuma das 209 linhas tem e-mail real ainda, o esperado AGORA é 0 — o
-- vínculo de verdade acontece quando cada pessoa se identifica. Rodar aqui é de
-- graça e mantém a receita igual à do seed 001.
select public.vincular_membros_existentes() as membros_vinculados;

commit;

-- ------------------------------------------------------------ CONFERÊNCIA ---
-- Os números que têm de bater. Qualquer linha fora do esperado é para investigar
-- ANTES de anunciar o formulário à rede.
select 'pessoas no roster do ciclo-1'            as checagem,
       (select count(*)::text from public.ciclo_membros m
          join public.relatorio_ciclos c on c.id = m.ciclo_id
         where c.slug = 'ciclo-1')                            as valor,
       '210 (as 209 da proposta + a linha da coordenação)'    as esperado
union all select 'vindas do catálogo (catalogo_id não nulo)',
       (select count(*)::text from public.ciclo_membros m
          join public.relatorio_ciclos c on c.id = m.ciclo_id
         where c.slug = 'ciclo-1' and m.catalogo_id is not null), '209'
union all select 'com e-mail de reserva (não identificadas)',
       (select count(*)::text from public.ciclo_membros m
          join public.relatorio_ciclos c on c.id = m.ciclo_id
         where c.slug = 'ciclo-1' and m.email_pendente), '209 (cai a cada identificação)'
union all select 'convidadas por e-mail',
       (select count(*)::text from public.ciclo_membros m
          join public.relatorio_ciclos c on c.id = m.ciclo_id
         where c.slug = 'ciclo-1' and m.catalogo_id is not null
           and m.convidado_em is not null), '0'
union all select 'líderes ligados ao laboratório',
       (select count(*)::text from public.ciclo_membros m
          join public.relatorio_ciclos c on c.id = m.ciclo_id
         where c.slug = 'ciclo-1' and m.papel = 'lla' and m.laboratorio_id is not null), '28'
union all select 'com ID Lattes',
       (select count(*)::text from public.ciclo_membros m
          join public.relatorio_ciclos c on c.id = m.ciclo_id
         where c.slug = 'ciclo-1' and m.catalogo_id is not null
           and m.lattes_id is not null), '189'
union all select 'fora do Brasil (pais_iso2 <> BR)',
       (select count(*)::text from public.ciclo_membros m
          join public.relatorio_ciclos c on c.id = m.ciclo_id
         where c.slug = 'ciclo-1' and m.catalogo_id is not null
           and m.pais_iso2 <> 'BR'), '22'
union all select 'com papel privilegiado vindo do catálogo',
       (select count(*)::text from public.ciclo_membros m
          join public.relatorio_ciclos c on c.id = m.ciclo_id
         where c.slug = 'ciclo-1' and m.catalogo_id is not null
           and m.papel in ('coordenacao','cges')), '0 (poder se concede à mão)'
union all select 'nomes repetidos no roster (possível pessoa em dobro)',
       (select coalesce(count(*)::text, '0') from (
          select 1 from public.ciclo_membros m
            join public.relatorio_ciclos c on c.id = m.ciclo_id
           where c.slug = 'ciclo-1'
           group by lower(m.nome) having count(*) > 1) d), '0';

-- Contagem por categoria PICC — tem de reproduzir o Quadro Geral do PICC.
select m.categoria_picc, m.papel, count(*) as pessoas
  from public.ciclo_membros m
  join public.relatorio_ciclos c on c.id = m.ciclo_id
 where c.slug = 'ciclo-1' and m.catalogo_id is not null
 group by m.categoria_picc, m.papel
 order by count(*) desc, m.categoria_picc;
