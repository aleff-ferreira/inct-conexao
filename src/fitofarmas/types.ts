/**
 * ============================================================================
 *  Tipos do formulário pré-evento — I Workshop Conexão Fitofarmas
 * ============================================================================
 *  Toda escolha do formulário é um literal de união, nunca `string`. O motivo
 *  não é elegância: os ids destas uniões são a MESMA lista que os
 *  `check (… in (…))` da migração 008 e as chaves de peso da função
 *  `escore_intencao_workshop`. Um id digitado diferente no cliente não quebra o
 *  build — vira uma resposta que o banco recusa no envio, na frente da pessoa,
 *  depois de quatro minutos de preenchimento. `tests/fitofarmas.test.ts` lê o
 *  texto do .sql e compara com estas listas justamente para que a divergência
 *  apareça no `npm test`, e não no dia do evento.
 *
 *  IDS SEM ACENTO E PARA SEMPRE. O id é chave de agregação entre edições do
 *  workshop; o rótulo é texto de tela e pode ser reescrito à vontade. Trocar um
 *  id depois de a primeira resposta entrar significa perder a comparação.
 * ============================================================================
 */

/** Vínculo principal de quem responde. Define o vocabulário do resto da tela. */
export type Vinculo =
  | "docente_pesquisador"
  | "pos_graduando"
  | "graduando"
  | "tecnico"
  | "profissional_saude"
  | "gestor_publico"
  | "comunidade_associacao"
  | "empresa"
  | "estudante_ensino_medio"
  | "outro";

/** Em qual dia a pessoa pretende estar. 25/08 Porto Velho · 27/08 Cacoal. */
export type Sede = "porto_velho" | "cacoal" | "ambas" | "so_online" | "indefinido";

/**
 * O PORTÃO do formulário. É a única pergunta que muda o CAMINHO: quem marca
 * `acompanhar` não recebe os passos 3 e 4 — perguntar a alguém que já disse
 * "só quero receber notícias" quanta infraestrutura ele cede é o jeito mais
 * rápido de conseguir uma resposta inventada.
 */
export type Interesse = "acompanhar" | "entender" | "colaborar" | "proposta";

/** Os oito Eixos Estruturantes e Transversais da proposta (EET-1…EET-8). */
export type Eet = "eet1" | "eet2" | "eet3" | "eet4" | "eet5" | "eet6" | "eet7" | "eet8";

/** COMO a pessoa poderia contribuir. Multi-escolha, sem limite. */
export type Forma =
  | "pesquisa_conjunta"
  | "infraestrutura"
  | "dados_colecoes"
  | "formacao"
  | "extensao_comunidades"
  | "politicas_publicas"
  | "producao_aepl"
  | "farmacia_viva"
  | "divulgacao"
  | "captacao"
  | "articulacao";

/**
 * O que a pessoa pode PÔR na rede. Cada aporte marcado abre um campo de uma
 * linha ("qual?"), e é esse campo — não a marcação — que carrega o sinal:
 * escrever "Herbário HFSL, 12 mil exsicatas" custa esforço e conhecimento;
 * marcar uma caixa não custa nada. O escore pesa os dois de forma diferente.
 */
export type Aporte =
  | "infraestrutura"
  | "dados"
  | "projeto"
  | "rede"
  | "financiamento"
  | "equipe"
  | "territorio"
  | "nenhum";

/** O que a pessoa gostaria de CONSTRUIR junto. */
export type Iniciativa =
  | "projeto_pesquisa"
  | "submissao_edital"
  | "publicacao"
  | "formacao_curso"
  | "produto"
  | "farmacia_viva_implantacao"
  | "politica_nota"
  | "banco_dados"
  | "nenhuma";

/** Tempo que a pessoa consegue dedicar. Em unidade de calendário, não em %. */
export type Disponibilidade =
  | "so_acompanhar"
  | "ate_2h_mes"
  | "ate_meio_dia_mes"
  | "ate_1_dia_mes"
  | "ate_1_dia_semana";

/** Quando. "Já tenho algo pronto" é outra coisa que "algum dia". */
export type Horizonte = "ja_tenho" | "ate_6_meses" | "ate_12_meses" | "sem_prazo";

/**
 * Poder de decisão. É a pergunta que separa entusiasmo de capacidade: quem
 * quer muito e não pode assinar nada precisa de um caminho diferente (levar a
 * proposta à chefia) de quem decide sozinho.
 */
export type Decisao = "decido" | "influencio" | "preciso_aval" | "nao_sei";

/**
 * ÂNCORA COMPORTAMENTAL. Comportamento passado prevê comportamento futuro
 * melhor do que qualquer intenção declarada — é por isso que esta pergunta
 * existe e pesa tanto quanto a escala de 1 a 5 inteira.
 */
export type Historico = "formal" | "informal" | "tentei" | "nao";

/**
 * PRÓXIMOS PASSOS CONCRETOS. Cada item é uma coisa que a pessoa aceita fazer,
 * com verbo e prazo. É o compromisso mais barato de dar e o mais caro de
 * fingir: quem marca "providenciar carta de anuência da minha instituição"
 * sabe que vai receber um e-mail cobrando a carta.
 */
export type Compromisso =
  | "reuniao_30d"
  | "gt_redesfito"
  | "carta_intencao"
  | "indicar_estudantes"
  | "compartilhar_dados"
  | "coescrever_proposta"
  | "sediar_atividade"
  | "apresentar_experiencia"
  | "depois";

/** Por onde a coordenação deve procurar quem tem potencial. */
export type CanalContato = "email" | "whatsapp" | "telefone";

/** 0 = não respondeu. O terceiro estado existe e não vira 3. */
export type Escala1a5 = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * O estado inteiro do formulário. É também, palavra por palavra, o jsonb que
 * vai para `workshop_respostas.respostas` — o cru guardado para que a
 * coordenação possa RE-PONTUAR com outra régua sem reperguntar a ninguém.
 */
export type Respostas = {
  // ---------------------------------------------------- 1. quem é você
  nome: string;
  email: string;
  telefone: string;
  instituicao: string;
  uf: string;
  vinculo: Vinculo | "";
  lattes: string;
  orcid: string;

  // ------------------------------------------- 2. seu interesse na rede
  interesse: Interesse | "";
  sede: Sede | "";

  // -------------------------------------- 3. onde você pode contribuir
  eets: Eet[];
  formas: Forma[];
  aportes: Aporte[];
  /** `aporte -> "qual?"`. Só as chaves marcadas em `aportes` são gravadas. */
  aportes_detalhe: Partial<Record<Aporte, string>>;

  // ------------------------------------------- 4. o que você assume
  iniciativas: Iniciativa[];
  disponibilidade: Disponibilidade | "";
  horizonte: Horizonte | "";
  decisao: Decisao | "";
  historico: Historico | "";
  compromissos: Compromisso[];
  chance_1a5: Escala1a5;

  // --------------------------------------------- 5. revisão e envio
  comentario: string;
  canal: CanalContato | "";
  lgpd: boolean;
};

/** Desfechos que a RPC 008 devolve. Nenhum deles é exceção. */
export type EstadoEnvio =
  | "recebido"
  | "atualizado"
  | "fora_da_janela"
  | "email_invalido"
  | "dados_invalidos"
  | "indisponivel"
  | "falha";

/**
 * A resposta do envio, já traduzida. União discriminada e não `throw`: quem
 * chegou por QR code, em pé no corredor, não se recupera de um `Error`.
 */
export type ResultadoEnvio = {
  readonly ok: boolean;
  readonly estado: EstadoEnvio;
  readonly protocolo: string | null;
  readonly mensagem: string;
  /** Preenchido em `dados_invalidos`: a tela move o foco para este campo. */
  readonly campo?: string;
};

/** Faixa de priorização derivada do escore. Nunca mostrada a quem responde. */
export type Faixa = "prioritario" | "promissor" | "acompanhar" | "informativo";
