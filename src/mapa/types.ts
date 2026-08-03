/**
 * ============================================================================
 *  Mapa Interativo · tipos de domínio
 * ============================================================================
 *  Dois mundos de dados:
 *    1. GEOMETRIA (Uf/GeoData) — vem do artefato oficial do IBGE
 *       `geo/br-uf.json`, gerado por `scripts/build-geodata.mjs`. NÃO é editável
 *       no painel; atualiza-se rodando o script.
 *    2. CONTEÚDO EDITORIAL (EstadoConteudo e aninhados) — vem de
 *       `src/content/mapa/estados/<uf>.json`, editável no painel Sveltia (/admin)
 *       ou à mão. Um arquivo por estado.
 * ============================================================================
 */

/** Uma unidade federativa projetada (geometria oficial do IBGE). */
export type Uf = {
  sigla: string;
  nome: string;
  codigoIbge: number;
  regiao: string;
  regiaoSigla: string;
  /** "integral" | "parcial" na Amazônia Legal; null se fora dela. */
  amazoniaLegal: "integral" | "parcial" | null;
  /** Caminho SVG (viewBox de `meta.viewBox`). */
  path: string;
  /** Centroide [x, y] no mesmo espaço do viewBox (para rótulos e fly-to). */
  centroid: [number, number];
  /** Caixa envolvente [x0, y0, x1, y1]. */
  bbox: [number, number, number, number];
};

export type GeoMeta = {
  fonte: string;
  urlMalha: string;
  urlMetadados: string;
  qualidade: string;
  projecao: string;
  viewBox: string;
  geradoEm: string;
  licenca: string;
  amazoniaLegalBase: string;
};

export type GeoData = { meta: GeoMeta; ufs: Uf[] };

/* ------------------------------------------------------------------ */
/*  Conteúdo editorial por estado                                      */
/* ------------------------------------------------------------------ */

/** Confiança de ocorrência/veracidade — nunca apresentar inferência como fato. */
export type Confianca = "confirmado" | "provavel" | "incerto";

/** Fonte citável (registro de proveniência). */
export type Fonte = {
  titulo: string;
  url?: string;
  publicador?: string;
  /** AAAA-MM-DD do acesso/publicação, quando conhecido. */
  data?: string;
};

/** Metadados de curadoria comuns a registros publicáveis. */
export type Curadoria = {
  /** false = rascunho: some do site sem perder o conteúdo. Padrão: true. */
  publicado?: boolean;
  /** Marca o registro como exemplo de demonstração (não verificado para produção). */
  demonstracao?: boolean;
  revisadoPor?: string;
  /** AAAA-MM-DD da última revisão científica. */
  revisadoEm?: string;
  fontes?: Fonte[];
};

/** Animal peçonhento (referência de identificação e prevenção). */
export type AnimalPeconhento = Curadoria & {
  nomeComum: string;
  nomeCientifico: string;
  /** serpente | escorpião | aranha | himenóptero | … */
  grupo: string;
  identificacao?: string;
  /** Confiança de ocorrência NO ESTADO. */
  ocorrencia: Confianca;
  distribuicao?: string;
  prevencao?: string[];
  primeirosSocorros?: string[];
  naoFazer?: string[];
  /** Nome de arquivo em /public/assets (foto CREDITADA, nunca gerada por IA). */
  imagem?: string;
  imagemCredito?: string;
  imagemAlt?: string;
};

/** Dado epidemiológico com procedência (nunca um número solto). */
/**
 * O que a camada de notificações precisa saber sobre uma UF.
 *
 * Antes só o número era injetado, e por isso a camada descrevia a própria
 * cobertura em prosa escrita à mão: dizia "Acre e Amapá" enquanto pintava
 * quatro estados, e carimbava "(desde 2018)" em Maranhão e Tocantins, cujas
 * séries começam em 2016. Passando também `desde`, a camada deriva as duas
 * coisas do dado e não tem como divergir dele.
 */
export type ResumoNotificacoes = {
  valor: number;
  /** Ano inicial do acumulado; null se nenhuma ficha declara período. */
  desde: number | null;
};

export type NotificacaoDado = {
  /** Número de notificações registradas. */
  valor: number;
  /** Período coberto, ex.: "acumulado desde 2018". */
  periodo: string;
  /** Sistema/fonte do dado, ex.: "SINAN · TabNet DataSUS". */
  sistema: string;
  /**
   * false = o número NÃO representa a carga real e fica de fora de totais e
   * rankings (ex.: malária no SINAN, que na Amazônia é acompanhada pelo
   * SIVEP-Malária). Padrão: true. Sempre acompanhar de `nota` explicando.
   */
  representativo?: boolean;
  /** Ressalva importante — ex.: malária usa o SIVEP-Malária, não o SINAN. */
  nota?: string;
  fonte?: Fonte;
};

/** Doença tropical / negligenciada / zoonótica. */
export type Doenca = Curadoria & {
  nome: string;
  agente?: string;
  transmissao?: string;
  vetoresReservatorios?: string;
  /** Notificações registradas (dado observado, com período e fonte). */
  notificacoes?: NotificacaoDado;
  prevencao?: string[];
  /** Texto curto de "como reconhecer" (sintomas gerais). EDUCATIVO. */
  comoReconhecer?: string;
  /** Sinais de alerta — EDUCATIVO, jamais diagnóstico. */
  sinaisAlerta?: string[];
  /** Primeiros cuidados / o que fazer (nunca prescrição de medicamento). */
  tratamento?: string[];
  /** Como os serviços de saúde geralmente manejam — alto nível, sem dose/prescrição. */
  manejoServicos?: string;
};

/** Camada/indicador ambiental factual do estado. */
export type Ambiente = Curadoria & {
  biomas?: string[];
  hidrografia?: string;
  clima?: string;
  resumo?: string;
};

/** Serviço/telefone oficial de emergência ou toxicológico. */
export type Servico = {
  nome: string;
  contato: string;
  nota?: string;
  url?: string;
};

/** Atividade do INCT-CONEXAO / instituição parceira no estado. */
export type AtividadeInct = {
  titulo: string;
  /** instituição | laboratório | projeto | publicação | expedição */
  tipo: string;
  detalhe?: string;
  confianca: Confianca;
  url?: string;
};

/** Registro editorial completo de um estado. */
export type EstadoConteudo = Curadoria & {
  /** UF em minúsculas (== nome do arquivo). */
  uf: string;
  /** Frase-resumo do estado (visão geral). */
  resumo?: string;
  /** Destaque curto para o preview no mapa. */
  destaque?: string;
  animais?: AnimalPeconhento[];
  doencas?: Doenca[];
  ambiente?: Ambiente;
  servicos?: Servico[];
  atividadesInct?: AtividadeInct[];
};

/** Um capítulo do modo narrativo. */
export type Capitulo = {
  id: string;
  titulo: string;
  /**
   * Posição na história. Estava nos quatro JSONs e no CMS desde sempre, mas
   * faltava aqui — e `content.ts` a lia por cast estrutural, com `?? 0`. Um
   * capítulo criado pelo CMS sem `ordem` ia calado para antes do primeiro.
   */
  ordem?: number;
  /** Parágrafos separados por \n\n. */
  texto: string;
  /** UF em foco (fly-to). Vazio = visão nacional. */
  foco?: string;
  /** UFs a destacar além do foco. */
  destaques?: string[];
  /** Camada temática a ativar ao entrar no capítulo. */
  camada?: string;
  /**
   * Enquadramento inicial da câmera: "brasil", "amazonia-legal" ou o nome de
   * uma região. Resolvido por `enquadramentoDe()` em `geo.ts`.
   *
   * SOBREPÕE `foco`: em `BrazilMap`, `overrideTarget` vence `selecionada ?? foco`.
   * Declarar os dois é ambíguo, e `tests/mapa.test.ts` reprova.
   *
   * Existe porque `regionViewBox("Norte")` deixa Mato Grosso e Maranhão de fora
   * — e são justamente os dois que o capítulo da Amazônia Legal cita pelo nome.
   */
  enquadrar?: string;
  fontes?: Fonte[];
};
