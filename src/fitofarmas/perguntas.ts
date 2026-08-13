/**
 * ============================================================================
 *  As perguntas do formulário pré-evento — I Workshop Conexão Fitofarmas
 * ============================================================================
 *  Porto Velho, 25/08/2026 (IESPRO/SESAU) · Cacoal, 27/08/2026.
 *
 *  PARA QUE ESTE FORMULÁRIO EXISTE, EM UMA FRASE
 *  ---------------------------------------------
 *  Separar quem tem INTERESSE de quem tem INTENÇÃO — antes do evento, para que
 *  a coordenação chegue no dia 25 sabendo com quem sentar.
 *
 *  O QUE ELE DELIBERADAMENTE NÃO PERGUNTA
 *  --------------------------------------
 *  Satisfação, conhecimento adquirido e aplicação do conteúdo. O formulário é
 *  respondido ANTES do workshop; perguntar "o que você aprendeu" a quem ainda
 *  não assistiu a nada produz dado falso, e dado falso num instrumento de
 *  priorização é pior que dado nenhum.
 *
 *  A RÉGUA: SINAL CARO vs. AUTODECLARAÇÃO
 *  --------------------------------------
 *  Dizer "tenho muito interesse" não custa nada, e por isso quase todo mundo
 *  diz. As perguntas abaixo estão ordenadas por CUSTO de resposta, e o escore
 *  (§ escore.ts e a função homônima da 008) pesa nessa ordem:
 *
 *    caro   → nomear um ativo concreto ("qual base de dados?", "qual projeto?")
 *    caro   → assumir um passo com verbo e prazo ("carta de anuência em 30 dias")
 *    caro   → declarar poder de decisão (quem não decide sabe que não decide)
 *    médio  → histórico real de colaboração (comportamento passado)
 *    médio  → tempo em unidade de calendário ("1 dia por mês", não "bastante")
 *    barato → escala de 1 a 5 de "chance de participar"  ← vale 4 dos 100 pontos
 *
 *  Por isso a escala de intenção existe e vale quase nada: ela é útil para
 *  conversar com a pessoa, não para classificá-la.
 *
 *  IDS × BANCO. Toda lista daqui tem um `check (… in (…))` gêmeo na
 *  `supabase/migrations/008_workshop_fitofarmas.sql`. `tests/fitofarmas.test.ts`
 *  lê o .sql e falha se os dois divergirem. Ao acrescentar uma opção, mude os
 *  DOIS arquivos na mesma edição.
 *
 *  OVERRIDE POR CONFIGURAÇÃO. `workshop_edicoes.config` (jsonb) pode
 *  sobrescrever título, subtítulo e datas na tela — mesmo padrão de
 *  `EditalConfig` (001) e `narrativa.ts:29`. As OPÇÕES, não: elas são estrutura,
 *  e estrutura que muda por dado vira formulário sem esquema.
 * ============================================================================
 */
import type {
  Aporte,
  CanalContato,
  Compromisso,
  Decisao,
  Disponibilidade,
  Eet,
  Forma,
  Historico,
  Horizonte,
  Iniciativa,
  Interesse,
  Sede,
  Vinculo,
} from "./types";

/** Par `[id, rótulo]`. O id vai ao banco; o rótulo, à tela. */
export type Opcao<T extends string> = readonly [T, string];

/** Ficha com ícone e exemplo — usada onde o exemplo faz a pergunta ser entendida. */
export type Ficha<T extends string> = {
  readonly id: T;
  readonly titulo: string;
  readonly exemplo: string;
};

// ============================================================ 1. O EVENTO ===

/**
 * Os textos de tela. Frases decididas a partir do convite oficial assinado pelo
 * coordenador (ofício de 06/08/2026) e escritas para dizer à pessoa o que fazer
 * em seguida. Trocá-las por texto genérico é regressão de produto, não
 * refatoração.
 *
 * SOBRE AS DATAS: o ofício convida para os dias **25 e 27 de agosto de 2026**
 * (Porto Velho e Cacoal) e é a fonte usada aqui. A arte de "programação
 * completa" que circulou anuncia uma semana de 24 a 28/08 — as duas peças
 * convivem porque a semana inclui visitas e oficinas que não são o workshop.
 * Este formulário pergunta pelos DOIS DIAS DO OFÍCIO, que são os que têm
 * credenciamento. Se a coordenação fechar a semana inteira, mude só o rótulo de
 * `SEDES` e o `config` da edição — nenhum id muda.
 */
export const TEXTO = {
  titulo: "I Workshop Conexão Fitofarmas",
  subtitulo: "Fitoterapia, Plantas Medicinais e Farmácias Vivas na Amazônia Ocidental",
  quando: "25 de agosto (Porto Velho) e 27 de agosto de 2026 (Cacoal)",
  onde: "IESPRO/SESAU, Porto Velho/RO · 08h00 às 17h30",
  realizacao: "NEv RO/IESPRO · INCT-CONEXAO · Fiocruz Rondônia · UNIR · SEMUSA PVH",

  // Os dois parágrafos de abertura ("Você já está inscrito(a)…" e "São cerca
  // de 5 minutos…") foram REMOVIDOS por decisão da coordenação (2026-08-07):
  // o cabeçalho vai direto das datas ao formulário. A estimativa de tempo
  // continua viva na barra de progresso ("faltam ~N min"), que é calculada de
  // `PASSOS` — era o texto fixo, não a barra, que corria o risco de mentir.

  /** Consentimento. É contrato jurídico e de confiança ao mesmo tempo (LGPD). */
  lgpd:
    "Autorizo o INCT-CONEXAO e o NEv RO/IESPRO a usarem estas respostas para organizar o workshop e " +
    "para me procurar sobre colaboração na rede. Não repassamos seus dados a terceiros e você pode " +
    "pedir correção ou exclusão pelo e-mail da coordenação.",

  privacidade:
    "O que você digita fica salvo neste navegador até você enviar. Em computador compartilhado, envie " +
    "ou limpe antes de sair.",

  /** Saída digna de quem só quer acompanhar — sem julgamento e sem funil. */
  atalhoAcompanhar:
    "Perfeito. Como você marcou que quer acompanhar as ações, pulamos as perguntas de colaboração: " +
    "elas não fariam sentido agora. Falta só confirmar o contato.",

  contato: "inctconexao@gmail.com",
} as const;

// ====================================================== 2. IDENTIFICAÇÃO ===

export const VINCULOS: ReadonlyArray<Opcao<Vinculo>> = [
  ["docente_pesquisador", "Docente ou pesquisador(a)"],
  ["pos_graduando", "Pós-graduando(a)"],
  ["graduando", "Graduando(a) ou IC"],
  ["tecnico", "Técnico(a) ou apoio à pesquisa"],
  ["profissional_saude", "Profissional de saúde / SUS"],
  ["gestor_publico", "Gestor(a) público(a)"],
  ["comunidade_associacao", "Comunidade, povo originário ou associação"],
  ["empresa", "Empresa, cooperativa ou setor produtivo"],
  ["estudante_ensino_medio", "Estudante de ensino médio ou técnico"],
  ["outro", "Outro"],
] as const;

/**
 * Siglas mais prováveis num workshop em Rondônia, para o `<datalist>`. É
 * SUGESTÃO, nunca lista fechada: um workshop regional atrai secretaria
 * municipal, associação de moradores e farmácia viva que não estão em catálogo
 * nenhum, e `<select>` fechado ali é dado perdido.
 */
export const INSTITUICOES_SUGERIDAS: readonly string[] = [
  "Fiocruz Rondônia",
  "UNIR (Universidade Federal de Rondônia)",
  "IESPRO",
  "NEv RO/IESPRO",
  "SESAU/RO",
  "SEMUSA Porto Velho",
  "SEDAM/RO",
  "IFRO",
  "IFRO, Campus Cacoal",
  "EMBRAPA Rondônia",
  "Afya / São Lucas",
  "FIMCA",
  "Faculdade Católica de Rondônia",
  "Santa Marcelina",
  "CEPEM",
  "CEMETRON",
  "ECOPORÉ",
  "Centro Cultural Indígena Paiter Wagoh Pakob",
  "UNESP",
  "USP",
  "UFAM",
  "UFAC",
  "UFPA",
  "UFMT",
  "ILMD/Fiocruz Amazônia",
  "Instituto Aggeu Magalhães (IAM/Fiocruz)",
] as const;

/**
 * As 27 unidades da federação. Lista COMPLETA de propósito: o workshop é
 * presencial em Rondônia, mas oferecer só as 18 UFs onde a rede já opera
 * obrigaria quem é de São Paulo a marcar "outro" — e o dado sumiria.
 */
export const UFS: readonly string[] = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

/**
 * Fora do Brasil. A rede tem 16 instituições parceiras em 12 países, e sem esta
 * opção o passo 1 era um BECO SEM SAÍDA para elas: o campo é obrigatório, o
 * controle é um `<select>` fechado, e a única alternativa era mentir "RO" ou
 * abandonar o formulário. Duas letras maiúsculas — passa no mesmo
 * `check (uf ~ '^[A-Z]{2}$')` da 008, sem tocar no SQL.
 */
export const UF_EXTERIOR = "EX";

/** O que o `<select>` do passo 1 oferece: as 27 UFs mais a saída do exterior. */
export const OPCOES_UF: ReadonlyArray<Opcao<string>> = [
  ...UFS.map((u) => [u, u] as const),
  [UF_EXTERIOR, "Fora do Brasil"],
];

// ========================================================== 3. O PORTÃO ===

/**
 * A pergunta que muda o CAMINHO. Quatro degraus, do mais barato ao mais caro,
 * e o rótulo de cada um diz o que ele implica — não "baixo/médio/alto", que
 * empurra todo mundo para o meio.
 */
export const INTERESSES: ReadonlyArray<Opcao<Interesse>> = [
  ["acompanhar", "Quero só acompanhar as ações e receber informações"],
  ["entender", "Tenho interesse, mas preciso entender melhor como funciona"],
  ["colaborar", "Quero colaborar em atividades específicas da rede"],
  ["proposta", "Quero integrar a rede e já tenho uma ação concreta para propor"],
] as const;

/** O único valor que encurta o formulário (passos 3 e 4 saem). */
export const INTERESSE_QUE_ENCURTA: Interesse = "acompanhar";

export const SEDES: ReadonlyArray<Opcao<Sede>> = [
  ["porto_velho", "Só 25/08 (Porto Velho)"],
  ["cacoal", "Só 27/08 (Cacoal)"],
  ["ambas", "Nos dois dias"],
  ["so_online", "Só on-line, se houver"],
  ["indefinido", "Ainda não sei"],
] as const;

// ======================================================= 4. ONDE CONTRIBUIR ==

/**
 * Os oito EETs, com o rótulo curto de tela. Os títulos oficiais completos estão
 * na proposta submetida ao CNPq; aqui entram encurtados porque rótulo de
 * checkbox com 35 palavras não é lido — é pulado.
 *
 * ORDEM DELIBERADA: EET-3 e EET-4 vêm primeiro. São os eixos de plantas
 * medicinais e de arranjos ecoprodutivos, o assunto deste workshop; deixá-los
 * em quarto e quinto lugar por fidelidade à numeração faria a lista começar
 * pelo que menos interessa a quem está lendo.
 */
export const EETS: ReadonlyArray<Opcao<Eet>> = [
  ["eet3", "EET-3: Biodiversidade e bioprospecção (plantas medicinais, toxinas)"],
  ["eet4", "EET-4: Bioeconomia e arranjos ecoprodutivos locais (AEPLs)"],
  ["eet6", "EET-6: Biologia estrutural e química medicinal"],
  ["eet8", "EET-8: Políticas públicas e educação em saúde"],
  ["eet7", "EET-7: Formação e redes de pesquisa"],
  ["eet2", "EET-2: Diagnóstico territorial da Amazônia"],
  ["eet1", "EET-1: Clima, ambiente e Saúde Única"],
  ["eet5", "EET-5: Bioinformática e Saúde Pública de Precisão"],
] as const;

/**
 * Teto de 3. Não é economia de tela: quem marca oito eixos não priorizou nada,
 * e a resposta deixa de distinguir. Forçar a escolha É a medida.
 */
export const MAX_EETS = 3;

export const FORMAS: ReadonlyArray<Opcao<Forma>> = [
  ["pesquisa_conjunta", "Pesquisa colaborativa"],
  ["farmacia_viva", "Farmácia Viva / horto medicinal"],
  ["dados_colecoes", "Dados, coleções e herbários"],
  ["infraestrutura", "Laboratório e infraestrutura"],
  ["formacao", "Formação e orientação"],
  ["extensao_comunidades", "Extensão com comunidades"],
  ["producao_aepl", "Produção, cultivo e AEPLs"],
  ["politicas_publicas", "Políticas públicas e regulação"],
  ["captacao", "Captação de recursos e editais"],
  ["articulacao", "Articulação institucional"],
  ["divulgacao", "Divulgação científica"],
] as const;

/**
 * O que a pessoa pode PÔR na rede. Cada ficha marcada abre um campo de uma
 * linha; é o campo, não a marcação, que vale ponto de verdade.
 */
export const APORTES: ReadonlyArray<Ficha<Aporte>> = [
  {
    id: "infraestrutura",
    titulo: "Laboratório, equipamento ou estrutura",
    exemplo: "ex.: CLAE, casa de vegetação, sala de secagem, viveiro",
  },
  {
    id: "dados",
    titulo: "Base de dados, coleção ou herbário",
    exemplo: "ex.: herbário, banco de germoplasma, série histórica, extratoteca",
  },
  {
    id: "projeto",
    titulo: "Projeto ou pesquisa em andamento",
    exemplo: "ex.: dissertação, projeto de extensão, ensaio clínico, TCC",
  },
  {
    id: "rede",
    titulo: "Rede, associação ou GT que eu integro",
    exemplo: "ex.: redesFITO, associação de produtores, conselho, câmara técnica",
  },
  {
    id: "financiamento",
    titulo: "Financiamento vigente ou edital aprovado",
    exemplo: "ex.: FAPERO, CNPq, emenda parlamentar, PDCT",
  },
  {
    id: "equipe",
    titulo: "Equipe ou estudantes disponíveis",
    exemplo: "ex.: 3 mestrandos, técnicos de campo, agentes de saúde",
  },
  {
    id: "territorio",
    titulo: "Acesso a território, comunidade ou serviço",
    exemplo: "ex.: UBS, aldeia parceira, RESEX, feira, horto municipal",
  },
  {
    id: "nenhum",
    titulo: "Nada disso por enquanto",
    exemplo: "Resposta legítima. Ninguém precisa chegar trazendo alguma coisa.",
  },
] as const;

/** Marcar esta ficha limpa as outras: é a saída digna, e não convive com elas. */
export const APORTE_EXCLUSIVO: Aporte = "nenhum";

/** Uma linha, não um parágrafo. O sinal está em NOMEAR, não em descrever. */
export const MAX_DETALHE = 140;

/** O rótulo do "qual?" de cada aporte. Genérico não faz ninguém responder. */
export const PERGUNTA_DO_APORTE: Readonly<Record<Exclude<Aporte, "nenhum">, string>> = {
  infraestrutura: "Qual estrutura?",
  dados: "Qual base, coleção ou herbário?",
  projeto: "Qual projeto?",
  rede: "Qual rede ou associação?",
  financiamento: "Qual financiamento?",
  equipe: "Quantas pessoas e de que perfil?",
  territorio: "Qual território ou serviço?",
} as const;

// ==================================================== 5. O QUE VOCÊ ASSUME ==

export const INICIATIVAS: ReadonlyArray<Opcao<Iniciativa>> = [
  ["projeto_pesquisa", "Projeto de pesquisa conjunto"],
  ["farmacia_viva_implantacao", "Implantar Farmácia Viva ou horto"],
  ["submissao_edital", "Submeter proposta a edital"],
  ["formacao_curso", "Curso, oficina ou capacitação"],
  ["produto", "Produto ou tecnologia (fitoterápico, protocolo, sistema)"],
  ["politica_nota", "Política pública, nota técnica ou diretriz"],
  ["banco_dados", "Banco de dados ou coleção compartilhada"],
  ["publicacao", "Publicação conjunta"],
  ["nenhuma", "Nenhuma por enquanto"],
] as const;

export const INICIATIVA_EXCLUSIVA: Iniciativa = "nenhuma";

/**
 * Tempo em unidade de CALENDÁRIO. "Bastante", "razoável" e "pouco" significam
 * coisas diferentes para um professor com 20h de aula e para um gestor — e
 * nenhuma delas cabe numa agenda.
 */
export const DISPONIBILIDADES: ReadonlyArray<Opcao<Disponibilidade>> = [
  ["so_acompanhar", "Sem tempo dedicado, só acompanhar"],
  ["ate_2h_mes", "Até 2 horas por mês"],
  ["ate_meio_dia_mes", "Até meio dia por mês"],
  ["ate_1_dia_mes", "Cerca de 1 dia por mês"],
  ["ate_1_dia_semana", "1 dia por semana ou mais"],
] as const;

export const HORIZONTES: ReadonlyArray<Opcao<Horizonte>> = [
  ["ja_tenho", "Já tenho algo pronto para propor"],
  ["ate_6_meses", "Nos próximos 6 meses"],
  ["ate_12_meses", "Em até 12 meses"],
  ["sem_prazo", "Sem prazo definido"],
] as const;

/**
 * Poder de decisão. Separa entusiasmo de capacidade — e diz à coordenação a que
 * porta bater: quem "leva e defende internamente" precisa de material para
 * levar, não de convite.
 */
export const DECISOES: ReadonlyArray<Opcao<Decisao>> = [
  ["decido", "Decido por mim ou pela minha equipe"],
  ["influencio", "Não decido, mas levo e defendo internamente"],
  ["preciso_aval", "Preciso de aval da chefia ou da instituição"],
  ["nao_sei", "Não sei dizer"],
] as const;

/** Âncora comportamental: o que já foi feito, não o que se pretende fazer. */
export const HISTORICOS: ReadonlyArray<Opcao<Historico>> = [
  ["formal", "Sim, com projeto, convênio ou publicação"],
  ["informal", "Sim, de modo informal"],
  ["tentei", "Não, mas já tentei aproximação"],
  ["nao", "Não"],
] as const;

/**
 * Os próximos passos. Cada um tem verbo e prazo, e é isto que os torna
 * mensuráveis: em outubro dá para conferir, um a um, quem fez o que marcou.
 * `depois` existe para quem não quer se comprometer AGORA e é preferível a uma
 * marcação de fachada — por isso vale zero, e não penalidade.
 */
export const COMPROMISSOS: ReadonlyArray<Opcao<Compromisso>> = [
  ["reuniao_30d", "Participar de uma reunião de alinhamento em até 30 dias"],
  ["gt_redesfito", "Entrar no GT de implantação da redesFITO em Rondônia"],
  ["carta_intencao", "Providenciar carta de intenção da minha instituição"],
  ["coescrever_proposta", "Coescrever uma proposta para edital"],
  ["compartilhar_dados", "Compartilhar dados, material ou coleção"],
  ["indicar_estudantes", "Indicar estudante(s) para atividades da rede"],
  ["sediar_atividade", "Sediar ou organizar uma atividade"],
  ["apresentar_experiencia", "Apresentar minha experiência num encontro da rede"],
  ["depois", "Prefiro definir depois do workshop"],
] as const;

export const COMPROMISSO_EXCLUSIVO: Compromisso = "depois";

/**
 * A escala. Cinco pontos com rótulo textual em cada um — "3" sozinho não
 * significa nada e cada pessoa inventa a sua régua. Vale 4 dos 100 pontos do
 * escore, de propósito: é a pergunta mais barata de responder do formulário.
 */
export const PONTOS_CHANCE = [
  { valor: 1, rotulo: "Quase nula" },
  { valor: 2, rotulo: "Baixa" },
  { valor: 3, rotulo: "Média" },
  { valor: 4, rotulo: "Alta" },
  { valor: 5, rotulo: "Certa" },
] as const;

export const CANAIS: ReadonlyArray<Opcao<CanalContato>> = [
  ["email", "E-mail"],
  ["whatsapp", "WhatsApp"],
  ["telefone", "Telefone"],
] as const;

// ============================================================ 6. OS PASSOS ==

/**
 * Os cinco passos e o tempo estimado de cada um. É o que a barra de progresso
 * soma, e ela mostra MINUTOS e não porcentagem porque "60% concluído" não
 * responde à única pergunta que a pessoa faz — "quanto falta?".
 *
 * A barra é o ÚNICO lugar que anuncia duração (o parágrafo de abertura que
 * também a anunciava saiu em 2026-08-07). Se um texto fixo de duração voltar
 * um dia, ele tem de bater com a soma destes números.
 */
export const PASSOS = [
  { id: 1, titulo: "Quem é você", minutos: 1 },
  { id: 2, titulo: "Seu interesse na rede", minutos: 1 },
  { id: 3, titulo: "Onde você pode contribuir", minutos: 1 },
  { id: 4, titulo: "O que você assume", minutos: 1 },
  { id: 5, titulo: "Revisão e envio", minutos: 1 },
] as const;

export const TOTAL_PASSOS = PASSOS.length;

/** Passos que somem quando a pessoa marcou "só acompanhar". */
export const PASSOS_DE_COLABORACAO: readonly number[] = [3, 4];
