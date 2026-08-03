/**
 * ============================================================================
 *  Notícias / matérias do INCT-CONEXAO · modelo de conteúdo
 * ============================================================================
 *  Uma matéria = um arquivo JSON em `src/content/noticias/<slug>.json`,
 *  editável no painel (/admin) ou à mão. O corpo do texto é uma LISTA DE
 *  BLOCOS: cada bloco tem um `tipo` e é desenhado por um componente próprio,
 *  com os tokens visuais do site. Assim a redação monta matérias ricas
 *  (fotos, citações, passo a passo, perguntas frequentes) sem escrever HTML e
 *  sem que o site precise interpretar HTML de terceiros.
 * ============================================================================
 */

/** Imagem dentro de uma matéria (arquivo em /public/assets/noticias/<slug>/). */
export type NoticiaImagem = {
  /** Nome do arquivo, ex.: "morcego-detalhe.webp". */
  arquivo: string;
  /** Texto alternativo — obrigatório: descreve a cena para quem não vê a foto. */
  alt: string;
};

/** Um item de "o que vem agora" / linha de tabela simples.
 *  `estado` é opcional e só muda o desenho: "feito" marca a etapa concluída
 *  (com sinal de check); o padrão é etapa ainda pendente. */
export type LinhaTabela = { rotulo: string; valor: string; estado?: "feito" | "pendente" };

/** Bloco do corpo da matéria. */
export type Bloco =
  /** Parágrafos comuns. Separe parágrafos com uma linha em branco (\n\n).
   *  Aceita **negrito**, _itálico_ e [texto](https://link). */
  | { tipo: "texto"; texto: string }
  /** Intertítulo (h2) que divide a matéria em capítulos. */
  | { tipo: "subtitulo"; texto: string }
  /** Uma foto com legenda e crédito. */
  | { tipo: "imagem"; imagem: NoticiaImagem; legenda?: string; credito?: string }
  /** De 2 a 4 fotos em grade, com uma legenda comum.
   *  2 fotos = lado a lado; 3 ou 4 = grade de duas colunas. */
  | { tipo: "galeria"; imagens: NoticiaImagem[]; legenda?: string; credito?: string }
  /** Vídeo servido pelo próprio site (mp4 em /public/assets/noticias/<slug>/).
   *  Não toca sozinho e só baixa o arquivo quando a pessoa aperta play — a
   *  matéria é lida em áreas com internet cara. Vídeo COM FALA precisa de
   *  `transcricao`, senão quem não ouve fica sem a informação (WCAG 1.2). */
  | {
      tipo: "video";
      /** Nome do arquivo .mp4. */
      arquivo: string;
      /** Quadro de capa (.webp), exibido antes do play. */
      poster?: string;
      /** Descreve o vídeo para leitores de tela (vira o nome acessível). */
      descricao: string;
      legenda?: string;
      credito?: string;
      /** Transcrição da fala. Obrigatória quando há voz no vídeo. */
      transcricao?: string;
    }
  /** Citação em destaque. */
  | { tipo: "citacao"; texto: string; autor?: string }
  /** Cartão de destaque com lista (ex.: "Em 30 segundos"). */
  | { tipo: "destaque"; titulo?: string; itens: string[] }
  /** Passo a passo numerado (ex.: como o sistema funciona). */
  | { tipo: "etapas"; titulo?: string; itens: { titulo: string; texto: string }[] }
  /** Tabela rótulo/valor em faixa escura (ex.: "O que vem agora"). */
  | { tipo: "tabela"; titulo?: string; linhas: LinhaTabela[] }
  /** Perguntas frequentes (também vira dados estruturados FAQPage). */
  | { tipo: "faq"; titulo?: string; itens: { pergunta: string; resposta: string }[] };

export type BlocoTipo = Bloco["tipo"];

/** Pessoa que assina / esteve em campo. */
export type Integrante = { nome: string; instituicao?: string };

/** Quem assina a matéria. Os links viram `sameAs` nos dados estruturados. */
export type Autor = {
  nome: string;
  /** Papel na matéria, ex.: "Texto", "Texto e edição". Padrão: "Texto". */
  papel?: string;
  /** Currículo Lattes (CNPq). */
  lattes?: string;
  linkedin?: string;
  /** Outro perfil (ORCID, site pessoal…). */
  url?: string;
};

/** Fonte citável (mesmo formato usado no Mapa Interativo). */
export type Fonte = { titulo: string; url?: string };

export type NoticiaSeo = {
  ogTitle?: string;
  ogDescription?: string;
  /** Arquivo da imagem de compartilhamento (mantenha em .jpg). */
  ogImage?: string;
  keywords?: string[];
};

/** Matéria completa. */
export type Noticia = {
  slug: string;
  /** Título da matéria. */
  titulo: string;
  /** Chapéu / editoria, ex.: "Expedição científica · Rondônia". */
  chapeu?: string;
  /** Linha-fina: um parágrafo que resume a matéria (usado em listas e no SEO). */
  resumo: string;
  /** Data de publicação, AAAA-MM-DD. */
  data: string;
  /** Data da última atualização relevante, AAAA-MM-DD. */
  atualizadoEm?: string;
  /** Onde a história acontece, ex.: "Guajará-Mirim e Nova Mamoré (RO)". */
  local?: string;
  /** Quem assina a matéria. Vazio = assina a instituição. */
  autores?: Autor[];

  /** Foto de topo (arquivo em /public/assets/noticias/<slug>/). */
  imagem?: NoticiaImagem;
  imagemCredito?: string;

  /**
   * Vídeo de fundo do topo, no lugar da foto. É DECORATIVO: sem som, em laço,
   * sem controles, atrás do título, e toca sozinho. Mesmo comportamento do
   * hero da home. O `poster` é a primeira pintura e o fallback se o arquivo
   * falhar; `arquivoMobile`, quando existe, é servido em telas estreitas.
   */
  videoHero?: {
    /** Nome do arquivo .mp4 (sem áudio). */
    arquivo: string;
    /** Versão leve para telas de até 680px. Sem ela, o celular baixa a completa. */
    arquivoMobile?: string;
    /** Quadro de capa (.webp), usado como fallback e primeira pintura. */
    poster: string;
  };

  /** Números de topo (rótulo + valor), a "barra de dados" da matéria. */
  numeros?: LinhaTabela[];

  /** Corpo da matéria. */
  blocos: Bloco[];

  /** Quem esteve em campo / assina o trabalho. */
  equipe?: Integrante[];
  /** Realização, apoio e financiadores, em texto corrido. */
  creditos?: string;
  /** Resumo em inglês, para alcance internacional. */
  resumoIngles?: string;
  fontes?: Fonte[];
  /** Termos para as listas (ex.: ["Saúde Única", "Amazônia"]). */
  tags?: string[];

  seo?: NoticiaSeo;
  /** false = rascunho: some do site sem perder o conteúdo. Padrão: true. */
  publicado?: boolean;
};
