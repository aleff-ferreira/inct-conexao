/**
 * ============================================================================
 *  Tipos do Relato Anual da rede (Ciclo 1) — espelho de 005_relatos.sql
 * ============================================================================
 *  REGRA DESTE ARQUIVO: a migração é a verdade. Cada `type` abaixo espelha uma
 *  tabela, uma view ou uma RPC de `supabase/migrations/005_relatos.sql` — com
 *  as colunas que a `009_gforms.sql` acrescentou (integração do Forms do CTC:
 *  ppg/indice_h/total_citacoes/satisfacao, dgp_nome/dgp_url, jcr/qualis e o
 *  jsonb `relatos.respostas`) — coluna a coluna, com os mesmos nomes. Todo `check (x in (...))` do SQL virou união
 *  de literais aqui. Se a migração mudar, este arquivo muda junto — e a ordem é
 *  essa, nunca a inversa.
 *
 *  O QUE **NÃO** ESTÁ AQUI, E POR QUÊ
 *  ----------------------------------
 *   • Datas do ciclo (01/05/2025 → 30/04/2026) e vigência do Termo de Outorga:
 *     são colunas de `relatorio_ciclos`, lidas do banco. Constante de data em
 *     código é a forma mais barata de o sistema mentir depois de uma prorrogação.
 *   • Textos das 26 metas, dos 43 objetivos e dos 24 indicadores: são prosa e
 *     vivem em `src/content/relato/proposta-inct-2024.json` (git), carregados
 *     sob demanda por `config.ts`. O banco guarda só a espinha (ids, ligações e
 *     números pactuados), exatamente como a seção 18 da migração documenta.
 *   • Percentual de meta: NENHUM tipo daqui tem campo de percentual declarado.
 *     A execução é contada pelas views; a projeção é derivada e rotulada como
 *     projeção. O formulário nunca pergunta "quanto da meta você cumpriu".
 *
 *  CONVENÇÕES
 *  ----------
 *   • `date`         → `string` no formato "YYYY-MM-DD".
 *   • `timestamptz`  → `string` ISO-8601 com fuso.
 *   • `uuid`         → `string`.
 *   • `bigint` das views → `number` (o PostgREST serializa como número JSON).
 *   • Coluna anulável no SQL → `| null` aqui (nunca `?`), porque o PostgREST
 *     devolve a chave presente com valor `null`, e não ausente.
 * ============================================================================
 */

// ============================================================ 1. ENUMERAÇÕES =

/** `relatorio_ciclos.status` */
export type CicloStatus = "rascunho" | "aberto" | "em_conferencia" | "consolidado" | "arquivado";

/**
 * `ciclo_membros.papel` — o papel é propriedade do CICLO, não da pessoa.
 * NÃO confundir com `profiles.role` ('admin' | 'avaliador' | 'candidato'), que
 * é da seleção de IC e que este módulo não toca nem consulta.
 */
export type PapelNoCiclo = "coordenacao" | "cges" | "lla" | "pesquisador" | "estudante" | "tecnico_admin";

/** `ciclo_membros.categoria_picc` — as 13 categorias do Quadro Geral do PICC. */
export type CategoriaPicc =
  | "Pesquisador"
  | "Líder de Laboratório Associado"
  | "Colaborador"
  | "Pesquisador Estrangeiro"
  | "Pesquisador Colaborador"
  | "Aluno"
  | "Aluno de Pós-Graduação"
  | "Membro do Comitê Gestor"
  | "Administrativa"
  | "Técnico"
  | "Apoio Técnico"
  | "Técnico de Laboratório"
  | "Vice-Coordenador";

/** `ciclo_membros.idioma` */
export type Idioma = "pt" | "en";

/** `relatos.status` */
export type RelatoStatus = "rascunho" | "enviado" | "em_conferencia" | "conferido";

/** `fatos.tipo` — os 9 fatos coletivos, declarados UMA vez pelo laboratório. */
export type TipoFato =
  | "expedicao"
  | "acao_sociedade"
  | "parceria"
  | "formacao"
  | "bolsista"
  | "acervo"
  | "dado_software"
  | "infraestrutura"
  | "politica_publica";

/** `fatos.status` */
export type StatusFato = "proposto" | "confirmado" | "duplicado_de" | "rejeitado";

/** `fatos.comite` — DERIVADO do tipo por trigger. Nunca perguntado em tela. */
export type Comite = "CEXPECIAL" | "CDIV" | "CINTER" | "CTC" | "CCCO" | "CPIE";

/**
 * `fatos.periodo_situacao` / `producoes.periodo_situacao`.
 * A mecânica da DECISÃO 3: o item fora do período é aceito com a data
 * verdadeira, marcado, e fica FORA de toda contagem até um ciclo cobri-lo.
 */
export type PeriodoSituacao = "no_periodo" | "linha_de_base" | "posterior" | "sem_data";

/** `producoes.ancora_tipo` */
export type AncoraTipo = "doi" | "isbn" | "issn_pagina" | "inpi" | "url_com_captura" | "arquivo_sha256";

/**
 * `producoes.tipo` — os 26 valores do CHECK da migração 005.
 *
 * ATENÇÃO: `src/content/relato/taxonomia.json` traz 29 tipos com ids
 * PARCIALMENTE DIFERENTES (`software`, `trabalho_evento`, `curso_curta_duracao`,
 * `acervo`, …). O banco é a restrição real: gravar um id da taxonomia que não
 * esteja nesta união viola o CHECK. A tradução taxonomia → banco está em
 * `config.ts` (`TIPO_PRODUCAO_POR_TAXONOMIA`), com os casos sem correspondência
 * declarados lá.
 */
export type TipoProducao =
  | "livro"
  | "capitulo"
  | "artigo_periodico"
  | "trabalho_anais_completo"
  | "trabalho_anais_resumo"
  | "trabalho_anais_resumo_expandido"
  | "traducao"
  | "software_aplicativo"
  | "base_dados"
  | "patente"
  | "desenho_industrial"
  | "marca"
  | "cultivar"
  | "tecnologia_social"
  | "processo_nao_patenteavel"
  | "manual_protocolo"
  | "relatorio_tecnico"
  | "material_didatico"
  | "curso_formacao"
  | "evento_organizado"
  | "norma_marco_regulatorio"
  | "acervo_curadoria_colecao"
  | "carta_mapa"
  | "produto_comunicacao"
  | "producao_artistica"
  | "outro";

/** `producoes.ambito` — INFERIDO pelo sistema, nunca perguntado (§2.3.1). */
export type AmbitoProducao = "nacional" | "internacional";

/** `producoes.ambito_origem` */
export type AmbitoOrigem = "inferido" | "coordenacao";

/** `producao_vinculos.origem` — auditoria de como o item entrou. */
export type OrigemVinculo = "orcid" | "doi_colado" | "manual" | "importado";

/** `producao_vinculos.menciona_apoio` — default 'nao_sei'; NÃO trava o envio. */
export type MencionaApoio = "sim" | "nao" | "nao_sei";

/** `relato_arquivos.uso` */
export type UsoArquivo = "comprovante" | "imagem_publicavel";

/**
 * `relato_arquivos.mime` — o CHECK da 011 acrescentou o .docx (o "documento
 * com dados da pesquisa" que a coordenação baixa para o relatório anual).
 * REGRAS DA 011 que o cliente espelha: docx só com `uso='comprovante'` e teto
 * próprio de 10 MB (`anexos.max_bytes_docx` do config); os demais seguem em
 * 1 MB. O .doc legado (application/msword) NÃO entra — salve como .docx.
 */
export type MimeArquivo =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** `relato_eventos.entidade` */
export type EntidadeEvento = "relato" | "fato" | "adesao" | "producao_vinculo";

/** `relato_eventos.acao` */
export type AcaoEvento = "insert" | "update" | "delete";

/**
 * `producoes.qualis` — o CHECK da 009. União das DUAS escalas Qualis: a
 * vigente (A1..A4, B1..B4, C) e a anterior (que tinha B5), porque é a anterior
 * que muita gente ainda cita de memória. Ver a seção 3 da 009 para o porquê de
 * o campo ser manual, opcional e morar na CANÔNICA (não no vínculo).
 */
export type Qualis = "A1" | "A2" | "A3" | "A4" | "B1" | "B2" | "B3" | "B4" | "B5" | "C";

// =========================================== 2. CONFIG DO CICLO (jsonb) =====
/**
 * `relatorio_ciclos.config` — a espinha da proposta semeada na seção 18 da 005.
 * TODOS os campos são opcionais de propósito: a coluna tem `default '{}'` e um
 * Ciclo 2 pode nascer vazio. Use os acessores de `config.ts`, que devolvem
 * lista vazia em vez de estourar.
 */
export type MetaProgresso = {
  /** "2º ano" | "4º ano" | "5º ano" — como está escrito na proposta. */
  prazo: string;
  /** "35%" — string, porque é assim que a proposta pactua. */
  percentual: string;
};

/** Uma das 92 quantidades pactuadas. `chave` é o `numero_pactuado_key`. */
export type NumeroPactuado = {
  /** Ex.: "M07.3". É por ela que a execução é somada. */
  chave: string;
  oQue: string;
  /** Piso pactuado; `null` = piso aberto ("até 50 expedições"). */
  min: number | null;
  /** Teto pactuado; `null` = teto aberto ("pelo menos 5 AEPLs"). */
  max: number | null;
  unidade: string;
};

export type MetaDoCiclo = {
  n: number;
  /** Objetivos (1..43) associados, do mapa homologado pelo CGES. */
  objetivos: number[];
  progresso: MetaProgresso[];
  pactuados: NumeroPactuado[];
};

export type ObjetivoDoCiclo = {
  n: number;
  /** "Pesquisa", "Formação de Recursos Humanos", … — a missão do CNPq. */
  missao: string;
};

export type IndicadorDoCiclo = {
  n: number;
  /** Ano em que o indicador vence (1..5). */
  ano: number;
};

export type EetDoCiclo = { codigo: string; titulo: string };
export type ComiteDoCiclo = { sigla: string; nome: string };
export type CategoriaPiccContagem = { categoria: string; quantidade: number };
export type BolsaDoCiclo = { sigla: string; modalidade: string; quotas: number; meses: number };

export type LimitesDeAnexo = {
  max_por_relato: number;
  /** Teto dos anexos NÃO-docx (pdf/jpeg/png): 1 MB por padrão. */
  max_bytes: number;
  max_imagens_por_item: number;
  mimes: string[];
  /**
   * 011 — teto PRÓPRIO do .docx (10485760 na semente). Opcional porque um
   * config anterior à 011 não o tem; `enviarArquivo` usa o default da
   * migração quando ausente. É condicional por mime no CHECK do banco — o
   * file_size_limit do bucket é global e NÃO segura pdf/jpeg/png em 1 MB.
   */
  max_bytes_docx?: number;
};

export type CicloConfig = {
  schema?: string;
  fonte?: { arquivo?: string; sha256?: string; bytes?: number; nota?: string };
  /** O aviso que a tela do LLA precisa exibir antes de qualquer número. */
  aviso_ano_1?: string;
  laboratorios?: {
    oficial?: number;
    fonte_oficial?: string;
    divergencias?: Record<string, number>;
    nota?: string;
  };
  papeis?: PapelNoCiclo[];
  categorias_picc?: CategoriaPiccContagem[];
  categorias_picc_total?: number;
  comites?: ComiteDoCiclo[];
  eets?: EetDoCiclo[];
  objetivos?: ObjetivoDoCiclo[];
  /** Objetivos 1..5 (biometeorologia/SIMBAM) não pertencem a meta nenhuma. */
  objetivos_sem_meta?: number[];
  metas?: MetaDoCiclo[];
  indicadores?: IndicadorDoCiclo[];
  indicadores_ano_1?: number[];
  bolsas?: BolsaDoCiclo[];
  /** Espelho do trigger `derivar_comite_do_fato()`. */
  fato_comite?: Partial<Record<TipoFato, Comite>>;
  anexos?: Partial<LimitesDeAnexo>;
  processo_confirmado?: boolean;
  processo_nota?: string;
  /**
   * Lista literal de veículos de divulgação do formulário do CNPq (item 7.3).
   * AUSENTE na semente: nenhuma fonte conferida traz a lista literal. Enquanto
   * não vier da coordenação, a tela usa `planoDivulgacao.acoes` da proposta
   * como sugestão + campo livre. Ver `config.ts`.
   */
  veiculos_divulgacao?: string[];
};

// ================================================== 3. LINHAS DAS TABELAS ===

/** `public.relatorio_ciclos` */
export type RelatorioCiclo = {
  id: string;
  slug: string;
  numero: number;
  titulo: string;
  status: CicloStatus;
  /** Período REPORTÁVEL (quando o fato aconteceu). */
  periodo_inicio: string;
  periodo_fim: string;
  /** Janela de ENVIO (quando se pode escrever). São coisas diferentes. */
  abre_em: string;
  fecha_em: string;
  /** Data do Termo de Outorga. `null` enquanto a coordenação não confirmar. */
  vigencia_inicio: string | null;
  chamada: string;
  /** `null` na semente (DECISÃO 4). Ver `processoDoCiclo()` em `config.ts`. */
  processo: string | null;
  config: CicloConfig;
  created_at: string;
  updated_at: string;
};

/** `public.laboratorios` — os 28 Laboratórios Associados. */
export type Laboratorio = {
  id: string;
  ciclo_id: string;
  sigla: string;
  nome: string;
  instituicao_nome: string;
  /** ROR id NU, sem `https://ror.org/` (`^0[a-z0-9]{8}$`). */
  instituicao_ror: string | null;
  uf: string | null;
  municipio_ibge: string | null;
  /**
   * Q8/Q9 do Forms (009) — o grupo no Diretório de Grupos de Pesquisa do CNPq.
   * `dgp_nome` é o nome OFICIAL no espelho do DGP (pode divergir de `nome`, e
   * guardar os dois é deliberado); `dgp_url` é o link do espelho, para a
   * pessoa CONFERIR em vez de digitar. Escrita: coordenação (RLS da 005).
   */
  dgp_nome: string | null;
  dgp_url: string | null;
  /** "EET-1".."EET-8" — preenchido pelo CGES. */
  eets: string[];
  /** 1..43 — herdados pelos itens declarados. */
  objetivos: number[];
  lla_user_id: string | null;
  lla_nome: string;
  lla_email: string | null;
  /** Ramifica a ficha de acervo (§4.1). */
  curador_acervo: boolean;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

/** `public.ciclo_membros` — o roster e o denominador da cobertura. */
export type CicloMembro = {
  id: string;
  ciclo_id: string;
  /** `null` até o primeiro acesso (o trigger da seção 15 casa por e-mail). */
  user_id: string | null;
  nome: string;
  /** Sempre minúsculo (CHECK `email = lower(email)`). */
  email: string;
  categoria_picc: CategoriaPicc | null;
  papel: PapelNoCiclo;
  laboratorio_id: string | null;
  instituicao_ror: string | null;
  instituicao_nome: string;
  uf: string | null;
  pais_iso2: string;
  /** Exatamente 16 dígitos. */
  lattes_id: string | null;
  /** `0000-0000-0000-000X`. */
  orcid: string | null;
  /** Q6 (009) — Programa de Pós-graduação. Texto livre: não há catálogo homologado. */
  ppg: string | null;
  /**
   * Q14 (009) — índice H e total de citações. Nasceram manuais; a **010** os
   * faz preencherem-se sozinhos (a decisão 3 do relato-gforms foi revogada pelo
   * dono: "extraídos automaticamente do Google Scholar"). Continuam editáveis e
   * nunca travam envio. CHECK `>= 0` no banco.
   */
  indice_h: number | null;
  total_citacoes: number | null;
  /** Q31 (009) — satisfação com o INCT neste ciclo, 1..5 (CHECK no banco). */
  satisfacao: number | null;
  /**
   * 010 — o perfil do Google Acadêmico, colado UMA vez pela pessoa. Formato
   * `[A-Za-z0-9_-]{8,20}` (CHECK no banco): o mesmo regex do cliente e da Edge
   * Function, e é ele que torna impossível gravar um id que só poderíamos ler
   * violando o robots.txt do Scholar.
   */
  scholar_id: string | null;
  /**
   * 010 — DE ONDE veio o par (indice_h, total_citacoes). `null` = ninguém
   * declarou, o estado verdadeiro das linhas anteriores à 010.
   *
   * A procedência é coluna, e não detalhe de tela, porque o índice H do Google
   * Acadêmico é maior que o do OpenAlex (corpus diferente): número sem fonte,
   * dentro de um relatório que vai ao CNPq, é passivo.
   */
  indicadores_fonte: "scholar" | "openalex" | "manual" | null;
  indicadores_atualizado_em: string | null;
  idioma: Idioma;
  /** Chave OPACA do pré-preenchimento por link. NÃO autentica. */
  convite_token: string;
  convidado_em: string | null;
  primeiro_acesso_em: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * `relatos.narrativas` (jsonb). Os nomes são os do PICC 5.7.2, para que o texto
 * seja colável no sistema do CNPq em 2027 sem reescrita.
 */
export type Narrativas = {
  /** 20–600 caracteres. Obrigatório para enviar, salvo `nada_a_declarar`. */
  resultado_principal?: string;
  /** Vai direto ao Comitê Gestor: não passa pelo LLA e não é publicado. */
  dificuldades?: string;
  oportunidades?: string;
  /**
   * As versões MARCÁVEIS de dificuldades/oportunidades (ids de
   * `narrativa.ts`). Existem porque prosa não se tabula: com ids, a
   * coordenação conta "atraso de recursos apareceu em N dos 209 relatos" sem
   * ler prosa nenhuma. O texto livre virou o detalhe opcional. Moram no mesmo
   * jsonb `respostas` — nenhuma migração foi necessária.
   */
  dificuldades_categorias?: string[];
  oportunidades_categorias?: string[];
  /** Pré-preenchido com `resultado_principal`; é o Indicador nº 2. */
  texto_nao_especialistas?: string;
  /** Os quatro campos de 1.200 caracteres ficam no formulário do LABORATÓRIO. */
  impacto_estado_da_arte?: string;
  contribuicao_inovacao?: string;
  contribuicao_formacao_rh?: string;
  contribuicao_difusao?: string;
  /** Item 12.1.2.c do REO. */
  justificativa_discrepancia?: string;
  /**
   * A pergunta única e opcional da saída de dignidade ("nada a declarar").
   * Nunca obrigatória — quem declarou que não teve nada não pode ser obrigado
   * a descrever seu resultado mais importante.
   */
  o_que_faltou?: string;
  /**
   * §2.8 — as quatro perguntas do formulário oficial, só do LLA.
   * A 005 não criou tabela de laboratório-relato; elas moram aqui, no relato
   * de quem é LLA, porque é ele quem assina a declaração de veracidade.
   */
  governanca?: Governanca;
};

/** §2.8 — só no formulário do laboratório. */
export type Governanca = {
  alterou_objetivos_metas?: boolean;
  alterou_objetivos_metas_detalhe?: string;
  alterou_cronograma?: boolean;
  alterou_cronograma_detalhe?: string;
  alterou_equipe?: boolean;
  equipe_inclusoes?: number;
  equipe_exclusoes?: number;
  mecanismos_de_interacao?: string;
  dificuldades_na_rede?: string;
};

/**
 * `relatos.respostas` (jsonb NOVO da 009) — as respostas do Forms do CTC que
 * não são narrativa PICC nem viram coluna: fomento (Q12+Q21), extensão
 * (Q28..Q30) e os objetivos confirmados (Q20). É coluna separada de
 * `narrativas` de propósito: o contrato de `narrativas` é "nomes do PICC
 * 5.7.2, colável no CNPq", e fomento/extensão não são PICC 5.7.2.
 * Validação de forma é do cliente; o banco garante só o teto de 64 kB.
 */
export type FomentoItem = {
  /** Agência de fomento (CNPq, CAPES, FAPs, internacional…). Texto livre. */
  agencia?: string;
  /** Número do processo, como a agência escreve. */
  processo?: string;
  titulo?: string;
  /** Valor aproximado em reais. Estimativa: exibir como estimativa. */
  valor_brl?: number;
  /** "YYYY-MM-DD" (precisão de mês aceita: dia 1). */
  inicio?: string;
  fim?: string;
  /**
   * `true` = financiamento COMPLEMENTAR ao INCT (Q21);
   * `false`/ausente = projeto corrente citado na Q12.
   */
  complementar?: boolean;
};

/** Q28..Q30 — o projeto de extensão. Tudo opcional; quem não tem passa direto. */
export type ExtensaoResposta = {
  /** Q28 — Sim/Não. O detalhe abaixo só aparece (e só vale) com `true`. */
  tem?: boolean;
  titulo?: string;
  instituicao?: string;
  responsavel?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
  /** Q29 — quem coordena o projeto. */
  coordenador?: string;
  /** Q30 — produtos do projeto; REUSA a taxonomia de produção da 005. */
  produtos?: TipoProducao[];
};

export type RespostasRelato = {
  /**
   * Q20 — os objetivos (1..43) CONFIRMADOS pela pessoa depois da pré-marcação
   * derivada dos EETs do laboratório (`objetivosDosEets` em config.ts).
   * Guarda-se a confirmação, não a sugestão: a derivação é reproduzível; a
   * confirmação é o dado.
   */
  objetivos_confirmados?: number[];
  fomento?: FomentoItem[];
  extensao?: ExtensaoResposta;
};

/** `public.relatos` — um por (ciclo, pessoa). */
export type Relato = {
  id: string;
  ciclo_id: string;
  user_id: string;
  membro_id: string | null;
  /** `null` enquanto rascunho; emitido na transição para 'enviado'. */
  protocolo: string | null;
  status: RelatoStatus;
  nada_a_declarar: boolean;
  narrativas: Narrativas;
  /** 009 — fomento, extensão e objetivos confirmados (ver `RespostasRelato`). */
  respostas: RespostasRelato;
  declaracao_veracidade: boolean;
  cessao_imagem: boolean;
  submitted_at: string | null;
  /** ≠ `user_id` quando a coordenação preencheu em nome de alguém. */
  preenchido_por: string | null;
  created_at: string;
  updated_at: string;
};

// -------------------------------------------------- payloads dos 9 fatos ---
/**
 * `fatos.payload` por tipo (§2.4). Três chaves são LIDAS POR SQL e não podem
 * ser renomeadas sem mexer nas views da migração:
 *   • `pessoas_alcancadas` (acao_sociedade) → `v_fatos_por_tipo`
 *   • `ror_id` e `pais_iso2` (parceria)     → `v_rede_instituicoes`
 */

/** Meta 7. Aviso fixo na tela: nada de nome, foto ou dado de pessoa da comunidade. */
export type PayloadExpedicao = {
  /** Código IBGE do município (7 dígitos), como manda §2.4. */
  municipio?: string;
  /** Nome do município, só para exibir — a contagem usa o código. */
  municipio_nome?: string;
  uf?: string;
  comunidade?: string;
  dias?: number;
  /** Estimativa; sai do export rotulado como estimativa. */
  pessoas_equipe?: number;
  /** Nº do parecer: CEP/CONEP, SISBIO, SISGEN, CGEN. Nunca o dado da pessoa. */
  autorizacao?: string;
};

export type PublicoAlvo =
  | "ensino_basico"
  | "ensino_fundamental"
  | "ensino_medio"
  | "ensino_superior"
  | "publico_geral"
  | "profissionais_setoriais"
  | "comunidade_tradicional";

/** Indicador 5 / item 7.3. */
export type PayloadAcaoSociedade = {
  /** Lista do CNPq quando vier no `config`; texto livre enquanto não vier. */
  veiculo?: string[];
  publico_alvo?: PublicoAlvo[];
  /** LIDO PELA VIEW `v_fatos_por_tipo`. Estimativa: exibir "aproximadamente". */
  pessoas_alcancadas?: number;
  url?: string;
  /** Código IBGE do município. */
  municipio?: string;
  municipio_nome?: string;
};

export type NaturezaParceria =
  | "acordo_formal"
  | "coautoria"
  | "visita_tecnica"
  | "intercambio"
  | "projeto_conjunto"
  | "fornecimento_amostras"
  | "empresa"
  | "org_publica_social";

/** Indicador 3 / item 3.1. */
export type PayloadParceria = {
  /** OBRIGATÓRIO e nunca texto livre. LIDO PELA VIEW `v_rede_instituicoes`. */
  ror_id?: string;
  /** Derivado do ROR. LIDO PELA VIEW (default 'BR' quando ausente). */
  pais_iso2?: string;
  instituicao_nome?: string;
  natureza?: NaturezaParceria;
  objetivo_resumido?: string;
};

export type NivelFormacao = "ic_junior" | "ic" | "mestrado" | "doutorado" | "pos_doc" | "tecnica" | "comunitaria";
export type SituacaoFormacao = "em_andamento" | "concluida_no_periodo" | "interrompida";

/** Tabela B / item 6.3 / Meta 23. Declarado pelo ORIENTADOR, nunca pelo aluno. */
export type PayloadFormacao = {
  nome?: string;
  nivel?: NivelFormacao;
  situacao?: SituacaoFormacao;
  data_defesa?: string;
  instituicao_ror?: string;
  uf?: string;
  codigo_ppg_capes?: string;
  titulo_trabalho?: string;
  /** Impossível de reconstituir depois; por isso se coleta já no ano 1. */
  situacao_atual_egresso?: string;
};

export type SituacaoBolsa = "implantada" | "em_curso" | "concluida" | "cancelada" | "nao_implantada";

/** Manual PICC 5.7.2.2. `modalidade` é uma das 17 siglas do `config.bolsas`. */
export type PayloadBolsista = {
  modalidade?: string;
  situacao?: SituacaoBolsa;
  inicio?: string;
  fim?: string;
  /** `ciclo_membros.id` do orientador (escolhido da lista, não digitado). */
  orientador_id?: string;
  avaliacao_desempenho?: string;
};

/** Indicador 4. Só para laboratório com `curador_acervo = true`. */
export type PayloadAcervo = {
  sigla_colecao?: string;
  o_que_foi_incorporado?: string;
  registros?: number;
  faixa_tombo?: string;
  sisgen?: string;
};

/** Indicador 1 (o único que vence no 1º ano). */
export type PayloadDadoSoftware = {
  doi_ou_url?: string;
  nome?: string;
  repositorio?: string;
};

/** Meta 3 — 14 estações meteorológicas, 8 de qualidade do ar. */
export type PayloadInfraestrutura = {
  o_que?: string;
  onde_instalada?: string;
  multiusuaria?: boolean;
};

/** Item 6.2, quadro B. */
export type PayloadPoliticaPublica = {
  instrumento?: string;
  orgao?: string;
  situacao?: string;
};

/** O mapa tipo → payload. É a fonte da narrowing de `FatoDe<T>`. */
export type PayloadPorTipoFato = {
  expedicao: PayloadExpedicao;
  acao_sociedade: PayloadAcaoSociedade;
  parceria: PayloadParceria;
  formacao: PayloadFormacao;
  bolsista: PayloadBolsista;
  acervo: PayloadAcervo;
  dado_software: PayloadDadoSoftware;
  infraestrutura: PayloadInfraestrutura;
  politica_publica: PayloadPoliticaPublica;
};

export type FatoPayload = PayloadPorTipoFato[TipoFato];

/** `public.fatos` — o fato coletivo, declarado UMA vez pelo laboratório. */
export type Fato = {
  id: string;
  ciclo_id: string;
  laboratorio_id: string;
  tipo: TipoFato;
  /** Precisão de mês é aceita: use dia 1. Nunca futuro. */
  ocorrido_em: string;
  /** 3–140 caracteres. */
  titulo: string;
  payload: FatoPayload;
  status: StatusFato;
  duplicado_de: string | null;
  /** Comentário da rejeição — volta ao membro que propôs. */
  observacao_revisao: string;
  /** DERIVADO por trigger a partir do tipo. Nunca envie este campo. */
  comite: Comite | null;
  eets: string[];
  objetivos: number[];
  criado_por: string | null;
  confirmado_por: string | null;
  confirmado_em: string | null;
  /** DERIVADO por trigger da data. `null` = fora de todo período (DECISÃO 3). */
  ciclo_competencia_id: string | null;
  periodo_situacao: PeriodoSituacao;
  created_at: string;
  updated_at: string;
};

/** Fato com o payload já estreitado pelo tipo. */
export type FatoDe<T extends TipoFato> = Omit<Fato, "tipo" | "payload"> & {
  tipo: T;
  payload: PayloadPorTipoFato[T];
};

/** Guarda de tipo: `if (ehFatoDe(f, "expedicao")) f.payload.dias` compila. */
export function ehFatoDe<T extends TipoFato>(fato: Fato, tipo: T): fato is FatoDe<T> {
  return fato.tipo === tipo;
}

/** `public.fato_participantes` — a adesão. Uma linha, sem payload. */
export type FatoParticipante = {
  id: string;
  fato_id: string;
  relato_id: string | null;
  user_id: string;
  papel_no_fato: string | null;
  aderido_em: string;
};

/**
 * Cache do CSL-JSON no momento da resolução (`producoes.metadados`).
 * Campos conhecidos tipados; o resto continua acessível como `unknown` — o
 * Crossref devolve dezenas de chaves e descartá-las na gravação seria perder o
 * dado que gera o anexo de referências de 2027.
 */
export type AutorCsl = {
  given?: string;
  family?: string;
  name?: string;
  ORCID?: string;
  sequence?: string;
  affiliation?: Array<{ name?: string }>;
};

export type MetadadosCsl = {
  title?: string | string[];
  "container-title"?: string | string[];
  ISSN?: string[];
  ISBN?: string[];
  DOI?: string;
  URL?: string;
  publisher?: string;
  "publisher-location"?: string;
  volume?: string;
  issue?: string;
  page?: string;
  issued?: { "date-parts"?: number[][] };
  type?: string;
  license?: Array<{ URL?: string; "content-version"?: string }>;
  author?: AutorCsl[];
  [chave: string]: unknown;
};

/**
 * `public.producoes` — CANÔNICA: uma linha por trabalho na rede inteira.
 * NÃO tem coluna de declarante, e é de propósito: a tabela é legível por
 * qualquer membro do ciclo (base do dedupe), então "quem declarou o quê"
 * vazaria para a rede. A atribuição vive em `producao_vinculos`.
 */
export type Producao = {
  id: string;
  ciclo_id: string;
  ancora_tipo: AncoraTipo;
  ancora_valor: string;
  /** Escrito pelo SISTEMA quando a API resolveu. Nunca pelo usuário. */
  ancora_resolvida: boolean;
  tipo: TipoProducao;
  /** Obrigatório (≥3 caracteres) quando `tipo = 'outro'`. */
  outro_descricao: string;
  ambito: AmbitoProducao | null;
  ambito_origem: AmbitoOrigem;
  convidado: boolean;
  ano: number | null;
  publicado_em: string | null;
  acesso_aberto: boolean | null;
  /**
   * Q13 (009) — JCR (fator de impacto) e Qualis, MANUAIS e OPCIONAIS (decisão
   * 2 do relato-gforms: não há base pública confiável; fingir derivação seria
   * pior que pedir). Moram na CANÔNICA porque são propriedade do TRABALHO —
   * os N coautores compartilham o mesmo valor; no vínculo seriam N cópias
   * livres para divergir. Só fazem sentido em `artigo_periodico`; a tela os
   * mostra recolhidos e SÓ nesse tipo (sem CHECK de tipo no banco — ver 009).
   */
  jcr: number | null;
  qualis: Qualis | null;
  metadados: MetadadosCsl;
  /** Coluna GERADA: `coalesce(publicado_em, make_date(ano, 7, 1))`. */
  data_referencia: string | null;
  ciclo_competencia_id: string | null;
  periodo_situacao: PeriodoSituacao;
  primeiro_declarado_em: string;
  created_at: string;
  updated_at: string;
};

/** `public.producao_vinculos` — onde mora a atribuição. */
export type ProducaoVinculo = {
  id: string;
  producao_id: string;
  relato_id: string;
  origem: OrigemVinculo;
  menciona_apoio: MencionaApoio;
  objetivos: number[];
  /** Separa o que pode virar site do que é interno. */
  publicavel: boolean;
  confirmado_em: string;
};

/** `public.producao_autores` — cache dos coautores; mede o Indicador nº 3. */
export type ProducaoAutor = {
  id: string;
  producao_id: string;
  ordem: number;
  nome: string;
  orcid: string | null;
  is_membro_rede: boolean;
  user_id: string | null;
};

/** `public.relato_arquivos` */
export type RelatoArquivo = {
  id: string;
  relato_id: string | null;
  fato_id: string | null;
  storage_path: string;
  file_name: string;
  sha256: string | null;
  mime: MimeArquivo;
  bytes: number;
  uso: UsoArquivo;
  created_at: string;
};

/** `public.relato_eventos` — log append-only (só trigger escreve). */
export type RelatoEvento = {
  id: string;
  ciclo_id: string | null;
  relato_id: string | null;
  entidade: EntidadeEvento;
  entidade_id: string;
  acao: AcaoEvento;
  status: string | null;
  campos: string[];
  /** Quem GRAVOU (≠ dono quando a coordenação preencheu por alguém). */
  por: string | null;
  snapshot: Record<string, unknown> | null;
  snapshot_sha256: string | null;
  at: string;
};

// =============================================== 4. RPC (retornos tipados) ==

/**
 * Retorno de `checar_ancora(p_ciclo, p_tipo, p_valor)`.
 * NUNCA traz o nome de quem declarou — só o fato de já existir. O nome só
 * aparece depois que o segundo confirma a coautoria, e aí vem de
 * `producao_autores`. Isso é contenção de vazamento, e é por RPC, não por
 * texto de tela.
 */
export type ChecagemAncora =
  | { existe: false }
  | {
      existe: true;
      producao_id: string;
      tipo: TipoProducao;
      ano: number | null;
      titulo: string;
      ja_declarado_por_membro: boolean;
    };

/** Retorno de `reivindicar_itens_do_ciclo(p_ciclo)` (coordenação). */
export type ReivindicacaoLinha = { tabela: string; itens: number };

// ==================================================== 5. VIEWS (conferência) =

/**
 * `v_cobertura` — a saída mais importante do ciclo. Sem ela, número baixo é
 * ambíguo entre baixa produção e baixa resposta.
 */
export type CoberturaLinha = {
  ciclo_id: string;
  /** `null` agrega quem ainda não tem laboratório atribuído. */
  laboratorio_id: string | null;
  convidados: number;
  entraram: number;
  enviaram: number;
  nada_a_declarar: number;
  silenciosos: number;
};

/** `v_producao_por_tipo` — as linhas da Tabela A do CNPq. */
export type ProducaoPorTipoLinha = {
  ciclo_id: string;
  tipo: TipoProducao;
  ambito: AmbitoProducao | null;
  itens: number;
  com_ancora_resolvida: number;
};

/** `v_fatos_por_tipo` — uma expedição conta UMA vez, com N participantes. */
export type FatosPorTipoLinha = {
  ciclo_id: string;
  tipo: TipoFato;
  comite: Comite | null;
  itens: number;
  laboratorios: number;
  /** Estimativa. Exibir sempre com a palavra "aproximadamente". */
  pessoas_alcancadas_estimado: number;
  adesoes: number;
};

/** `v_rede_instituicoes` — Indicador 3, contado por ROR, nunca digitado. */
export type RedeInstituicaoLinha = {
  ciclo_id: string;
  instituicao_ror: string | null;
  pais_iso2: string | null;
  uf: string | null;
  pessoas: number;
  origem: "roster" | "parceria";
};

/** `v_itens_fora_do_periodo` — a fila da DECISÃO 3. */
export type ItemForaDoPeriodo = {
  entidade: "producao" | "fato";
  id: string;
  ciclo_id: string;
  data: string | null;
  periodo_situacao: PeriodoSituacao;
  tipo: string;
  titulo: string;
};

// ============================================== 6. ENVELOPE DE EXPORTAÇÃO ===
/**
 * §2.1 — o que o botão "Exportar JSON" cospe e o que o relatório de 2027 vai
 * ler. Versionado: nunca mude `schema` sem migrar.
 */
export type EnvelopeCiclo = {
  slug: string;
  numero: number;
  periodo_inicio: string;
  periodo_fim: string;
  vigencia_inicio: string | null;
  chamada: string;
  processo: string | null;
};

export type EnvelopeMembro = {
  membro_id: string;
  nome: string;
  email: string;
  categoria_picc: CategoriaPicc | null;
  papel: PapelNoCiclo;
  laboratorio_id: string | null;
  instituicao_ror: string | null;
  instituicao_nome: string;
  pais_iso2: string;
  uf: string | null;
  lattes_id: string | null;
  orcid: string | null;
  idioma: Idioma;
  /**
   * 009 (Q6/Q14/Q31) — opcionais no envelope para não quebrar exportadores
   * escritos antes da 009; quem gera o export novo os inclui.
   */
  ppg?: string | null;
  indice_h?: number | null;
  total_citacoes?: number | null;
  satisfacao?: number | null;
  /**
   * 010 — a procedência viaja JUNTO com os números no export. Exportar
   * `indice_h` sem `indicadores_fonte` seria entregar à agência um número cuja
   * base ninguém consegue mais reconstituir.
   */
  indicadores_fonte?: "scholar" | "openalex" | "manual" | null;
  indicadores_atualizado_em?: string | null;
};

/** §2.3 — a produção como sai no export (canônica + vínculo, já juntos). */
export type EnvelopeProducao = {
  producao_id: string;
  ancora_tipo: AncoraTipo;
  ancora_valor: string;
  ancora_resolvida: boolean;
  origem: OrigemVinculo;
  tipo: TipoProducao;
  ambito: AmbitoProducao | null;
  convidado: boolean;
  ano: number | null;
  publicado_em: string | null;
  menciona_apoio: MencionaApoio;
  acesso_aberto: boolean | null;
  objetivos: number[];
  /** CALCULADO pela coordenação a partir do mapa objetivo→meta. */
  metas_derivadas: number[];
  indicadores: number[];
  publicavel: boolean;
  periodo_situacao: PeriodoSituacao;
  /** 009 (Q13) — opcionais no envelope; ver o comentário em `Producao`. */
  jcr?: number | null;
  qualis?: Qualis | null;
  metadados: MetadadosCsl;
  coautores_na_rede: string[];
};

/** §2.5 */
export type EnvelopeAdesao = {
  fato_id: string;
  papel_no_fato: string | null;
  aderido_em: string;
};

/** §2.4 no formato do export. */
export type EnvelopeFato = {
  fato_id: string;
  tipo: TipoFato;
  laboratorio_id: string;
  ocorrido_em: string;
  titulo: string;
  status: StatusFato;
  eets: string[];
  objetivos: number[];
  comite: Comite | null;
  periodo_situacao: PeriodoSituacao;
  participantes: string[];
  payload: FatoPayload;
  /** Números de pessoas são estimativa e saem marcados como tal. */
  estimado: boolean;
};

/** §2.7 */
export type EnvelopeEnvio = {
  protocolo: string | null;
  status: RelatoStatus;
  nada_a_declarar: boolean;
  declaracao_veracidade: boolean;
  cessao_imagem: boolean;
  submitted_at: string | null;
  snapshot_sha256: string | null;
  preenchido_por: string | null;
};

/** §2.1 — export do formulário individual. */
export type EnvelopeRelato = {
  schema: "inct-relato/1";
  ciclo: EnvelopeCiclo;
  membro: EnvelopeMembro;
  producoes: EnvelopeProducao[];
  adesoes: EnvelopeAdesao[];
  fatos_propostos: EnvelopeFato[];
  narrativas: Narrativas;
  /** 009 — fomento/extensão/objetivos confirmados; opcional no envelope. */
  respostas?: RespostasRelato;
  envio: EnvelopeEnvio;
};

/** §2.1 — export do formulário do laboratório. */
export type EnvelopeLaboratorio = {
  schema: "inct-relato-lab/1";
  ciclo: EnvelopeCiclo;
  laboratorio: Laboratorio;
  equipe: EnvelopeMembro[];
  fatos: EnvelopeFato[];
  governanca: Governanca;
  narrativas: Narrativas;
  envio: EnvelopeEnvio;
};
