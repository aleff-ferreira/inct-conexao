/**
 * ============================================================================
 *  Configuração do Relato Anual — o que é constante, o que vem do banco e o
 *  que se carrega sob demanda
 * ============================================================================
 *  TRÊS FONTES, E A ORDEM IMPORTA
 *  ------------------------------
 *   1. `relatorio_ciclos.config` (jsonb, vem do BANCO) — a espinha da proposta:
 *      ids, ligações e os 92 números pactuados. É o que a RLS protege e o que a
 *      tela do LLA compara. Os acessores síncronos daqui (`metasDoCiclo`,
 *      `pactuadosDaMeta`, …) leem DESTE objeto e não custam byte de bundle.
 *   2. `src/content/relato/*.json` (git) — a PROSA: textos das 26 metas, dos 43
 *      objetivos, dos 24 indicadores, a taxonomia conferida, os 28 laboratórios
 *      e a verificação das APIs. Carregado sob demanda (§ "peso" abaixo).
 *   3. Constantes deste arquivo — só o que é enum do banco ou rótulo de tela.
 *      Nenhuma DATA e nenhum NÚMERO PACTUADO é constante aqui: data de ciclo e
 *      de vigência vêm de `relatorio_ciclos`; número pactuado vem do `config`.
 *
 *  PESO — a medição, não a intuição (build real em 04/08/2026)
 *  -----------------------------------------------------------
 *  Medido com `vite build` sobre uma entrada sintética que importa este módulo,
 *  fora de `dist/`. Dois cenários, mesmo compilador:
 *
 *      cenário                                  chunk de entrada      gzip
 *      este arquivo, como está                       6.683 B       3.206 B
 *      os 4 JSON pesados importados estáticos      216.836 B      64.264 B
 *      ------------------------------------------------------------------
 *      diferença no primeiro carregamento                        −61.058 B
 *
 *  E os quatro pesados saem como chunk separado, buscado só quando o loader
 *  correspondente roda:
 *      laboratorios          28.486 B   gzip  7.794 B
 *      apis-metadados        44.684 B   gzip 15.807 B
 *      proposta-inct-2024    70.505 B   gzip 18.661 B
 *      taxonomia             70.830 B   gzip 22.715 B
 *
 *  61 kB gzip é o que se cobraria de QUEM SÓ QUER marcar "participei desta
 *  expedição" — cerca de 19× o custo do módulo inteiro. Então só
 *  `identificacao.json` (1,7 kB gzip dos 3,2 kB do chunk) entra estático: ele
 *  traz o número do processo e o título oficial, que aparecem no rodapé de
 *  todas as telas e no botão de agradecimento. Os outros quatro entram por
 *  `import.meta.glob` sem `eager` — mesmo padrão já validado em
 *  `src/mapa/content.ts` — e viram um chunk separado cada, buscado só quando a
 *  função correspondente é chamada:
 *      • proposta → só quando a tela mostra o TEXTO de uma meta/objetivo;
 *      • taxonomia → só quando o membro abre "ver todos os tipos de produção";
 *      • laboratorios → só na semeadura/conferência da coordenação (a lista que
 *        a Tela 1 usa vem da tabela `laboratorios`, do banco, não daqui);
 *      • apis-metadados → só no painel de diagnóstico das APIs.
 *  Cada loader memoiza a Promise: chamar duas vezes não busca duas vezes.
 * ============================================================================
 */
import identificacaoJson from "../content/relato/identificacao.json";
import type {
  AncoraTipo,
  BolsaDoCiclo,
  CicloConfig,
  Comite,
  ComiteDoCiclo,
  EetDoCiclo,
  IndicadorDoCiclo,
  Idioma,
  LimitesDeAnexo,
  MetaDoCiclo,
  NumeroPactuado,
  ObjetivoDoCiclo,
  PapelNoCiclo,
  PeriodoSituacao,
  RelatorioCiclo,
  TipoFato,
  TipoProducao,
} from "./types";

// ================================================ 1. IDENTIDADE DO INSTITUTO =

export type Identificacao = {
  sigla: string;
  siglaCurta: string;
  tituloPt: string;
  tituloEn: string;
  /** "408474/2024-6" — conferido na linha 6 da proposta submetida. */
  processo: string;
  processoConferido: boolean;
  processoNotaDeConferencia: string;
  chamada: {
    numero: string;
    programa: string;
    orgaosComoNaProposta: string;
    orgaosComoInformado: string;
    divergencia: string;
    /** `true` enquanto a grafia dos órgãos não for conferida na outorga. */
    pendente: boolean;
  };
  vigencia: {
    inicio: string;
    duracaoMeses: number;
    fonte: string;
    /** `null` — a data do Termo de Outorga ainda não é conhecida (§8.2). */
    assinaturaTermoOutorga: string | null;
    notaAssinatura: string;
  };
  temaEstrategico: string;
  temasAderentes: string[];
  instituicaoExecutora: string;
  sedeFisica: string;
  coordenador: string;
  agradecimento: { pt: string; en: string; nota: string };
};

/**
 * Fonte ÚNICA da identidade oficial. Nenhum destes valores deve ser digitado de
 * novo em outro lugar — o número do processo é o único dado deste sistema cujo
 * erro sai de casa (vai para o agradecimento de artigo publicado).
 */
export const IDENTIFICACAO = identificacaoJson as unknown as Identificacao;

/** Frase-padrão de agradecimento, no idioma da pessoa. */
export function fraseDeAgradecimento(idioma: Idioma = "pt"): string {
  return idioma === "en" ? IDENTIFICACAO.agradecimento.en : IDENTIFICACAO.agradecimento.pt;
}

/**
 * O número do processo a exibir.
 *
 * DIVERGÊNCIA CONHECIDA, e ela é deliberada: a semente da 005 gravou
 * `relatorio_ciclos.processo = NULL` (DECISÃO 4, quando o número era
 * desconhecido). Depois disso a coordenação confirmou `408474/2024-6` e o valor
 * foi conferido na linha 6 da proposta — está em `identificacao.json`. Enquanto
 * a coordenação não rodar o `update` no ciclo, a coluna continua nula e é o
 * arquivo que responde. A ordem é banco → arquivo, nunca o contrário, para que
 * o dia em que o banco for corrigido seja o dia em que ele passa a mandar.
 */
export function processoDoCiclo(ciclo: Pick<RelatorioCiclo, "processo"> | null): string | null {
  if (ciclo?.processo) return ciclo.processo;
  return IDENTIFICACAO.processoConferido ? IDENTIFICACAO.processo : null;
}

/** O botão "copiar agradecimento" só existe se houver número de processo. */
export function podeCopiarAgradecimento(ciclo: Pick<RelatorioCiclo, "processo"> | null): boolean {
  return Boolean(processoDoCiclo(ciclo));
}

// ======================================== 2. ENUMS DO BANCO E SEUS RÓTULOS ==

/** Os 6 papéis de `ciclo_membros.papel`, na ordem em que a Tela 1 os mostra. */
export const PAPEIS: readonly PapelNoCiclo[] = [
  "pesquisador",
  "estudante",
  "tecnico_admin",
  "lla",
  "cges",
  "coordenacao",
] as const;

export const ROTULO_PAPEL: Record<PapelNoCiclo, string> = {
  coordenacao: "Coordenação",
  cges: "Comitê Gestor (CGES)",
  lla: "Líder de Laboratório Associado",
  pesquisador: "Pesquisador(a)",
  estudante: "Estudante",
  tecnico_admin: "Técnico(a) ou administrativo(a)",
};

/** Os 9 fatos coletivos, na ordem das fichas da tela L2. */
export const TIPOS_FATO: readonly TipoFato[] = [
  "expedicao",
  "acao_sociedade",
  "parceria",
  "formacao",
  "bolsista",
  "acervo",
  "dado_software",
  "infraestrutura",
  "politica_publica",
] as const;

export const ROTULO_TIPO_FATO: Record<TipoFato, string> = {
  expedicao: "Expedição científica",
  acao_sociedade: "Ação de divulgação ou educação",
  parceria: "Parceria institucional",
  formacao: "Formação concluída ou em andamento",
  bolsista: "Bolsista",
  acervo: "Incorporação a acervo/coleção",
  dado_software: "Dado ou software publicado",
  infraestrutura: "Infraestrutura instalada",
  politica_publica: "Política pública",
};

/**
 * Espelho do trigger `derivar_comite_do_fato()` (005, seção 6). O banco é quem
 * grava `fatos.comite`; isto serve só para EXIBIR o destino antes de salvar.
 * Se divergir do trigger, o trigger vence.
 */
export const COMITE_POR_TIPO_FATO: Record<TipoFato, Comite> = {
  expedicao: "CEXPECIAL",
  acao_sociedade: "CDIV",
  parceria: "CINTER",
  acervo: "CCCO",
  politica_publica: "CPIE",
  formacao: "CTC",
  bolsista: "CTC",
  dado_software: "CTC",
  infraestrutura: "CTC",
};

/** Os 26 valores de `producoes.tipo` (CHECK da 005), na ordem do CHECK. */
export const TIPOS_PRODUCAO: readonly TipoProducao[] = [
  "livro",
  "capitulo",
  "artigo_periodico",
  "trabalho_anais_completo",
  "trabalho_anais_resumo",
  "trabalho_anais_resumo_expandido",
  "traducao",
  "software_aplicativo",
  "base_dados",
  "patente",
  "desenho_industrial",
  "marca",
  "cultivar",
  "tecnologia_social",
  "processo_nao_patenteavel",
  "manual_protocolo",
  "relatorio_tecnico",
  "material_didatico",
  "curso_formacao",
  "evento_organizado",
  "norma_marco_regulatorio",
  "acervo_curadoria_colecao",
  "carta_mapa",
  "produto_comunicacao",
  "producao_artistica",
  "outro",
] as const;

/**
 * Rótulos curtos. Vocabulário do Lattes onde ele tem elemento próprio (é o que
 * a pessoa já preenche todo ano), e a linha literal do formulário do CNPq onde
 * não tem — a regra que `taxonomia.json` (_meta.regraDeRotulo) documenta.
 */
export const ROTULO_TIPO_PRODUCAO: Record<TipoProducao, string> = {
  livro: "Livro",
  capitulo: "Capítulo de livro",
  artigo_periodico: "Artigo em periódico",
  trabalho_anais_completo: "Trabalho completo em anais",
  trabalho_anais_resumo: "Resumo em anais",
  trabalho_anais_resumo_expandido: "Resumo expandido em anais",
  traducao: "Tradução",
  software_aplicativo: "Software ou aplicativo",
  base_dados: "Base de dados",
  patente: "Patente",
  desenho_industrial: "Desenho industrial",
  marca: "Marca",
  cultivar: "Cultivar",
  tecnologia_social: "Tecnologia social",
  processo_nao_patenteavel: "Processo ou técnica não patenteável",
  manual_protocolo: "Manual ou protocolo",
  relatorio_tecnico: "Relatório técnico",
  material_didatico: "Material didático",
  curso_formacao: "Curso ou oficina ministrada",
  evento_organizado: "Evento organizado",
  norma_marco_regulatorio: "Norma ou marco regulatório",
  acervo_curadoria_colecao: "Acervo ou curadoria de coleção",
  carta_mapa: "Carta ou mapa",
  produto_comunicacao: "Produto de comunicação",
  producao_artistica: "Produção artística",
  outro: "Outro",
};

/**
 * Lista curta da tela: 8 tipos que cobrem ~90% do volume esperado
 * (`taxonomia.json` → recomendacoesDeImplementacao). O resto fica atrás de
 * "ver todos os tipos".
 */
export const TIPOS_PRODUCAO_LISTA_CURTA: readonly TipoProducao[] = [
  "artigo_periodico",
  "trabalho_anais_completo",
  "capitulo",
  "livro",
  "material_didatico",
  "curso_formacao",
  "produto_comunicacao",
  "software_aplicativo",
] as const;

/**
 * Âncora sugerida por tipo (a tela pode oferecer outra: a coluna aceita as 6).
 * Vem de `taxonomia.json` → `tipos[].ancora.tipo`, com duas traduções, porque a
 * taxonomia tem dois valores que o CHECK da 005 não tem:
 *   • `processo_snpc` (cultivar) → `inpi`: o CHECK não tem casa para o SNPC; o
 *     número verdadeiro do registro continua íntegro em `ancora_valor`, que é o
 *     que a auditoria lê. Trocar o CHECK exigiria migração 006.
 *   • `qualquer` (outro) → `url_com_captura`: `outro` exige âncora (§2.3), e a
 *     captura de URL é a única que serve para qualquer coisa.
 */
export const ANCORA_SUGERIDA_POR_TIPO: Record<TipoProducao, AncoraTipo> = {
  artigo_periodico: "doi",
  livro: "isbn",
  capitulo: "doi",
  trabalho_anais_completo: "url_com_captura",
  trabalho_anais_resumo: "url_com_captura",
  trabalho_anais_resumo_expandido: "url_com_captura",
  traducao: "isbn",
  software_aplicativo: "doi",
  base_dados: "doi",
  carta_mapa: "doi",
  relatorio_tecnico: "arquivo_sha256",
  manual_protocolo: "arquivo_sha256",
  material_didatico: "url_com_captura",
  curso_formacao: "url_com_captura",
  evento_organizado: "url_com_captura",
  produto_comunicacao: "url_com_captura",
  tecnologia_social: "arquivo_sha256",
  processo_nao_patenteavel: "arquivo_sha256",
  norma_marco_regulatorio: "url_com_captura",
  acervo_curadoria_colecao: "url_com_captura",
  patente: "inpi",
  desenho_industrial: "inpi",
  marca: "inpi",
  cultivar: "inpi",
  producao_artistica: "url_com_captura",
  outro: "url_com_captura",
};

/**
 * TRADUÇÃO taxonomia (29 ids) → `producoes.tipo` (26 ids do CHECK).
 * Gravar um id da taxonomia direto no banco viola o CHECK; passe sempre por
 * aqui. Cinco ids da taxonomia não têm casa própria no CHECK da 005 e caem em
 * `outro` (a descrição fica em `outro_descricao`, que é obrigatória nesse caso):
 * `prefacio_posfacio`, `produto_tecnologico`, `indicacao_geografica`,
 * `topografia_circuito_integrado` e — por ambiguidade, não por falta de casa —
 * `trabalho_evento`, que aqui vira `trabalho_anais_completo` porque o banco
 * separa completo/resumo/resumo expandido e a taxonomia não.
 */
export const TIPO_PRODUCAO_POR_TAXONOMIA: Record<string, TipoProducao> = {
  artigo_periodico: "artigo_periodico",
  livro: "livro",
  capitulo: "capitulo",
  trabalho_evento: "trabalho_anais_completo",
  texto_jornal_revista: "produto_comunicacao",
  traducao: "traducao",
  prefacio_posfacio: "outro",
  software: "software_aplicativo",
  base_dados: "base_dados",
  carta_mapa: "carta_mapa",
  relatorio_tecnico: "relatorio_tecnico",
  manual_protocolo: "manual_protocolo",
  material_didatico: "material_didatico",
  curso_curta_duracao: "curso_formacao",
  evento_organizado: "evento_organizado",
  produto_comunicacao: "produto_comunicacao",
  tecnologia_social: "tecnologia_social",
  processo_ou_tecnica: "processo_nao_patenteavel",
  produto_tecnologico: "outro",
  norma_marco_regulatorio: "norma_marco_regulatorio",
  acervo: "acervo_curadoria_colecao",
  patente: "patente",
  desenho_industrial: "desenho_industrial",
  marca: "marca",
  cultivar: "cultivar",
  indicacao_geografica: "outro",
  topografia_circuito_integrado: "outro",
  producao_artistica: "producao_artistica",
  outro: "outro",
};

/** `true` quando o valor é um dos 26 aceitos pelo CHECK de `producoes.tipo`. */
export function ehTipoDeProducao(valor: string): valor is TipoProducao {
  return (TIPOS_PRODUCAO as readonly string[]).includes(valor);
}

// ----------------------------------------- DECISÃO 3: o texto da tela -------
/**
 * O que a tela DIZ sobre um item cuja data está fora do período do ciclo.
 * Centralizado porque as duas telas (membro e laboratório) precisam dizer a
 * mesma coisa: o item é aceito com a data verdadeira, não conta agora, e fica
 * guardado. Rejeitar criaria incentivo a adulterar a data — que é exatamente o
 * dado que o CNPq vai auditar.
 */
export const MENSAGEM_PERIODO_SITUACAO: Record<PeriodoSituacao, string> = {
  no_periodo: "",
  linha_de_base:
    "Isso é de antes do INCT começar: guardamos como linha de base. Não entra na contagem deste ciclo.",
  posterior:
    "Essa data é depois do período deste relatório. Guardamos com a data verdadeira, para o próximo relatório. Não entra na contagem agora.",
  sem_data: "Sem data, o item fica fora da contagem. Você pode enviar assim mesmo e completar depois.",
};

export const ROTULO_PERIODO_SITUACAO: Record<PeriodoSituacao, string> = {
  no_periodo: "No período",
  linha_de_base: "Linha de base",
  posterior: "Para o próximo relatório",
  sem_data: "Sem data",
};

// ============================== 3. ACESSORES DO `config` (síncronos, 0 byte) =
/**
 * Todos aceitam `CicloConfig | null | undefined` e devolvem vazio em vez de
 * estourar: a coluna tem `default '{}'` e um Ciclo 2 pode nascer sem espinha.
 */

export function metasDoCiclo(config: CicloConfig | null | undefined): MetaDoCiclo[] {
  return config?.metas ?? [];
}

export function metaPorNumero(config: CicloConfig | null | undefined, n: number): MetaDoCiclo | null {
  return metasDoCiclo(config).find((m) => m.n === n) ?? null;
}

export function objetivosDoCiclo(config: CicloConfig | null | undefined): ObjetivoDoCiclo[] {
  return config?.objetivos ?? [];
}

/**
 * Objetivos 1..5 (biometeorologia/SIMBAM) não pertencem a meta nenhuma — só
 * existem via o Indicador nº 1, que é justamente de 1º ano. É por isso que a
 * navegação nunca pode ser organizada por metas.
 */
export function objetivosSemMeta(config: CicloConfig | null | undefined): number[] {
  return config?.objetivos_sem_meta ?? [];
}

/** As metas ligadas a um objetivo (o mapa homologado, nunca inferido). */
export function metasDoObjetivo(config: CicloConfig | null | undefined, objetivo: number): MetaDoCiclo[] {
  return metasDoCiclo(config).filter((m) => m.objetivos.includes(objetivo));
}

/** Objetivos filtrados pela missão do CNPq ("Pesquisa", "Internacionalização"…). */
export function objetivosDaMissao(config: CicloConfig | null | undefined, missao: string): ObjetivoDoCiclo[] {
  return objetivosDoCiclo(config).filter((o) => o.missao === missao);
}

export function missoes(config: CicloConfig | null | undefined): string[] {
  return [...new Set(objetivosDoCiclo(config).map((o) => o.missao))];
}

export function indicadoresDoCiclo(config: CicloConfig | null | undefined): IndicadorDoCiclo[] {
  return config?.indicadores ?? [];
}

export function indicadoresDoAno(config: CicloConfig | null | undefined, ano: number): IndicadorDoCiclo[] {
  return indicadoresDoCiclo(config).filter((i) => i.ano === ano);
}

/**
 * Os 5 indicadores que vencem no 1º ano — os únicos com marco neste ciclo.
 * Usa `indicadores_ano_1` quando existe (é a lista curada da semente) e cai
 * para o filtro por `ano` quando não.
 */
export function indicadoresDoAno1(config: CicloConfig | null | undefined): number[] {
  const curada = config?.indicadores_ano_1;
  if (curada?.length) return curada;
  return indicadoresDoAno(config, 1).map((i) => i.n);
}

/** Os números pactuados de UMA meta (a `chave` é o `numero_pactuado_key`). */
export function pactuadosDaMeta(config: CicloConfig | null | undefined, meta: number): NumeroPactuado[] {
  return metaPorNumero(config, meta)?.pactuados ?? [];
}

/** As 92 quantidades pactuadas, achatadas, cada uma sabendo sua meta. */
export function todosOsPactuados(
  config: CicloConfig | null | undefined,
): Array<NumeroPactuado & { meta: number }> {
  return metasDoCiclo(config).flatMap((m) => m.pactuados.map((p) => ({ ...p, meta: m.n })));
}

export function pactuadoPorChave(
  config: CicloConfig | null | undefined,
  chave: string,
): (NumeroPactuado & { meta: number }) | null {
  return todosOsPactuados(config).find((p) => p.chave === chave) ?? null;
}

/**
 * Como se escreve um número pactuado sem inventar precisão: piso aberto
 * ("até 50"), teto aberto ("pelo menos 5") e faixa ("de 18 a 36") são coisas
 * diferentes e a proposta pactua as três.
 */
export function textoDoPactuado(p: NumeroPactuado): string {
  const { min, max, unidade } = p;
  if (min !== null && max !== null && min === max) return `${min} ${unidade}`;
  if (min !== null && max !== null) return `de ${min} a ${max} ${unidade}`;
  if (min !== null) return `pelo menos ${min} ${unidade}`;
  if (max !== null) return `até ${max} ${unidade}`;
  return unidade;
}

export function eetsDoCiclo(config: CicloConfig | null | undefined): EetDoCiclo[] {
  return config?.eets ?? [];
}

export function comitesDoCiclo(config: CicloConfig | null | undefined): ComiteDoCiclo[] {
  return config?.comites ?? [];
}

/** As 17 modalidades de bolsa (inclui SET-G, EXP-1 e EV-3, que listas parciais omitem). */
export function bolsasDoCiclo(config: CicloConfig | null | undefined): BolsaDoCiclo[] {
  return config?.bolsas ?? [];
}

/** Comitê de destino de um fato: o `config` manda; a constante é a rede de segurança. */
export function comiteDoTipoDeFato(config: CicloConfig | null | undefined, tipo: TipoFato): Comite {
  return config?.fato_comite?.[tipo] ?? COMITE_POR_TIPO_FATO[tipo];
}

/** Limites de anexo, com os defaults da migração quando o `config` é omisso. */
export function limitesDeAnexo(config: CicloConfig | null | undefined): LimitesDeAnexo {
  const a = config?.anexos;
  return {
    max_por_relato: a?.max_por_relato ?? 12,
    max_bytes: a?.max_bytes ?? 1048576,
    max_imagens_por_item: a?.max_imagens_por_item ?? 3,
    mimes: a?.mimes ?? ["application/pdf", "image/jpeg", "image/png"],
  };
}

/**
 * O aviso que precisa aparecer antes de qualquer número: nenhuma das 26 metas
 * vence no 1º ano. Todo percentual exibido é projeção informativa.
 */
export function avisoDoAno1(config: CicloConfig | null | undefined): string {
  return (
    config?.aviso_ano_1 ??
    "Nenhuma das 26 metas tem marco pactuado no 1º ano: os marcos são de 2º, 4º e 5º ano. " +
      "Este ciclo mede linha de base e andamento. Todo percentual exibido é projeção informativa."
  );
}

/**
 * Veículos de divulgação (payload de `acao_sociedade`). A lista literal do
 * formulário do CNPq NÃO foi encontrada em nenhuma fonte conferida; enquanto a
 * coordenação não a colocar em `config.veiculos_divulgacao`, a tela oferece as
 * 13 ações do PCDC-CONEXAO (proposta, seção plano de divulgação) como sugestão
 * MAIS um campo livre. Devolver vazio aqui é o sinal de "use a sugestão".
 */
export function veiculosDeDivulgacao(config: CicloConfig | null | undefined): string[] {
  return config?.veiculos_divulgacao ?? [];
}

// ------------------------------------------------- janelas e competência ----

/** A janela de ENVIO (≠ período reportável). Espelha `enforce_relato_window()`. */
export function janelaDeEnvioAberta(ciclo: RelatorioCiclo | null, agora: Date = new Date()): boolean {
  if (!ciclo) return false;
  return ciclo.status === "aberto" && agora >= new Date(ciclo.abre_em) && agora <= new Date(ciclo.fecha_em);
}

/** Ciclo congelado: não recebe mais escrita de membro. Espelha `ciclo_congelado()`. */
export function cicloCongelado(ciclo: RelatorioCiclo | null): boolean {
  return !ciclo || ciclo.status === "consolidado" || ciclo.status === "arquivado";
}

/**
 * Espelho CLIENTE de `situacao_da_data()`, para dar resposta imediata enquanto
 * a pessoa digita a data. O SERVIDOR é a autoridade: os triggers
 * `resolver_competencia_*` recalculam na gravação, e é o valor deles que conta.
 * Aqui só conhecemos UM ciclo, então "posterior" significa "depois deste".
 */
export function situacaoDaData(ciclo: RelatorioCiclo | null, data: string | null): PeriodoSituacao {
  if (!ciclo || !data) return "sem_data";
  if (data >= ciclo.periodo_inicio && data <= ciclo.periodo_fim) return "no_periodo";
  return data < ciclo.periodo_inicio ? "linha_de_base" : "posterior";
}

/** Data no futuro não passa no CHECK `fatos_sem_futuro`. */
export function dataNoFuturo(data: string, agora: Date = new Date()): boolean {
  return data > agora.toISOString().slice(0, 10);
}

// ================================ 4. CONTEÚDO SOB DEMANDA (chunk separado) ===

/** `proposta-inct-2024.json` — a PROSA da proposta (72,6 kB minificados). */
export type PropostaObjetivo = { numero: number; texto: string; missao: string };
export type PropostaMeta = {
  numero: number;
  descricao: string;
  descricaoLinhasOriginais: string[];
  objetivosAssociados: number[];
  objetivosAssociadosAmbiguo: boolean;
  progresso: Array<{ prazo: string; percentual: string }>;
  /** Sem `chave`: a chave (M07.3) é atribuída na semente do ciclo, por ordem. */
  numerosPactuados: Array<{ oQue: string; min: number | null; max: number | null; unidade: string }>;
};
export type PropostaIndicador = { numero: number; ano: number; descricao: string };
export type PropostaBolsa = {
  modalidade: string;
  sigla: string;
  quantidade: number;
  duracaoMeses: number;
  mensalidadeBRL: number;
  subtotalBRL: number;
};
export type PropostaInct = {
  _meta: Record<string, unknown>;
  objetivoGeral: string;
  objetivosEspecificos: PropostaObjetivo[];
  metas: PropostaMeta[];
  indicadores: PropostaIndicador[];
  eets: EetDoCiclo[];
  governanca: Record<string, unknown>;
  bolsas: PropostaBolsa[];
  bolsasTotais: { modalidades: number; quotas: number; valorTotalBRL: number };
  orcamento: Record<string, unknown>;
  numerosDaRede: Record<string, unknown>;
  planoDivulgacao: { sigla: string; orcamento: string; acoes: string[] };
  achadosCriticos: string[];
  inconsistenciasNaProposta: string[];
};

/** `taxonomia.json` — os 29 tipos conferidos em fonte primária (73,3 kB). */
export type TaxonomiaTipo = {
  id: string;
  rotulo: string;
  rotuloCurto: string;
  grupo: "bibliografica" | "tecnica" | "propriedade_intelectual" | "artistica" | "outro";
  ancora: { tipo: string; obrigatoria: boolean; apiPublica: boolean };
  ancoraDetalhe?: Record<string, unknown>;
  exemplos?: string[];
  mapeamentoCnpq?: { tabela?: string; linha?: string; confirmado?: boolean; observacao?: string };
  mapeamentoLattes?: Record<string, unknown> | null;
  mapeamentoCapesPtt?: Record<string, unknown> | null;
  confianca: string;
  relevanciaConexao?: string;
  subtipos?: unknown;
  camposObrigatorios?: string[];
  camposRecomendados?: string[];
};
export type Taxonomia = {
  _meta: Record<string, unknown>;
  mapeamentoTabelaA: Record<string, unknown>;
  mapeamentoTabelaB: Record<string, unknown>;
  mapeamentoTabelasCD: Record<string, unknown>;
  patente: Record<string, unknown>;
  tipos: TaxonomiaTipo[];
  colisoesComOsFatos: Record<string, unknown>;
  resolucaoDeAncoras: Record<string, unknown>;
  naoConfirmado: unknown[];
  recomendacoesDeImplementacao: string[];
};

/**
 * `laboratorios.json` — os 28 Laboratórios Associados (semente, 30 kB).
 * A LISTA QUE A TELA USA VEM DO BANCO (`laboratorios`), não daqui: o CGES
 * corrige nome, sigla e EETs pela tela L1, e o banco é quem guarda a correção.
 * Este arquivo é a fonte de SEMEADURA e de conferência ("achamos 28?").
 */
export type LaboratorioSemente = {
  id: string;
  sigla: string | null;
  nome: string | null;
  /** Rótulo provisório montado como "UFT (TO) — Fulano": não é o nome oficial. */
  rotulo: string;
  rotuloProvisorio: boolean;
  lla: string;
  llaGrafiaVariante: string | null;
  llaLattesId: string | null;
  instituicao: string;
  instituicaoSigla: string;
  uf: string;
  regiao: string;
  amazoniaLegal: boolean;
  eets: string[];
  confianca: string;
  camposAusentes: string[];
  fonte: Record<string, unknown>;
};
export type LaboratoriosSemente = {
  _meta: Record<string, unknown>;
  laboratorios: LaboratorioSemente[];
  lacunas: Array<Record<string, unknown>>;
};

/** `apis-metadados.json` — a verificação ao vivo das APIs (45,3 kB). */
export type ApiVerificada = {
  nome: string;
  endpoint: string;
  usoNoFormulario: string;
  corsLiberado: boolean;
  precisaChave: boolean;
  limiteTaxa?: Record<string, unknown>;
  formatoResposta?: string;
  coberturaBrasileira?: string;
  ressalvas?: string[];
  veredito: "usavel-no-navegador" | "usavel-com-ressalva" | "inviavel";
};
export type ApisMetadados = {
  _meta: Record<string, unknown>;
  resumoExecutivo: Record<string, unknown>;
  apis: ApiVerificada[];
  amostras: Array<Record<string, unknown>>;
  medicaoOrcidBrasileiro: Record<string, unknown>;
  degradacao: {
    principio: string;
    porApi: Record<string, { quandoFalha?: string; acao?: string; nunca?: string }>;
    regrasTransversais: string[];
  };
  achadosCriticos: Array<Record<string, unknown>>;
  correcoesAEspecificacao: Array<Record<string, unknown>>;
  cadeiaRecomendada: {
    porTipoDeEntrada: Record<string, string[]>;
    concorrencia: number;
    timeoutPorProvedorMs: number;
    exigeMailtoNoCrossref: boolean;
    observacao?: string;
  };
  reprodutibilidade: Record<string, unknown>;
};

/* Sem `eager`: cada arquivo vira um chunk buscado só quando o loader roda.
   Mesmo padrão de src/mapa/content.ts, onde a medição mostrou que carregar
   conteúdo editorial de quem nunca o abre é o desperdício mais fácil de
   cometer e o mais fácil de evitar. */
const arquivoProposta = import.meta.glob<{ default: PropostaInct }>(
  "../content/relato/proposta-inct-2024.json",
);
const arquivoTaxonomia = import.meta.glob<{ default: Taxonomia }>("../content/relato/taxonomia.json");
const arquivoLaboratorios = import.meta.glob<{ default: LaboratoriosSemente }>(
  "../content/relato/laboratorios.json",
);
const arquivoApis = import.meta.glob<{ default: ApisMetadados }>("../content/relato/apis-metadados.json");

/**
 * Memoiza a Promise: chamar duas vezes não busca duas vezes.
 * A rejeição NÃO é memoizada — um chunk que falhou por queda de rede precisa
 * poder ser tentado de novo, senão a tela fica quebrada até o F5, que é
 * exatamente o modo de falha que a especificação manda tratar como estado.
 */
function carregador<T>(
  mapa: Record<string, () => Promise<{ default: T }>>,
  nome: string,
): () => Promise<T> {
  let promessa: Promise<T> | null = null;
  return () => {
    if (!promessa) {
      const entrada = Object.values(mapa)[0];
      if (!entrada) {
        return Promise.reject(new Error(`Conteúdo do relato ausente no pacote: ${nome}.`));
      }
      promessa = entrada()
        .then((m) => m.default)
        .catch((e: unknown) => {
          promessa = null;
          throw e;
        });
    }
    return promessa;
  };
}

export const carregarProposta = carregador(arquivoProposta, "proposta-inct-2024.json");
export const carregarTaxonomia = carregador(arquivoTaxonomia, "taxonomia.json");
export const carregarLaboratoriosSemente = carregador(arquivoLaboratorios, "laboratorios.json");
export const carregarApisMetadados = carregador(arquivoApis, "apis-metadados.json");

// -------------------------------- helpers sobre o conteúdo sob demanda ------

/** Texto integral de um objetivo específico (1..43). */
export async function textoDoObjetivo(n: number): Promise<string | null> {
  const p = await carregarProposta();
  return p.objetivosEspecificos.find((o) => o.numero === n)?.texto ?? null;
}

/** Texto integral de uma meta (1..26). */
export async function textoDaMeta(n: number): Promise<string | null> {
  const p = await carregarProposta();
  return p.metas.find((m) => m.numero === n)?.descricao ?? null;
}

/** Texto integral de um indicador (1..24). */
export async function textoDoIndicador(n: number): Promise<string | null> {
  const p = await carregarProposta();
  return p.indicadores.find((i) => i.numero === n)?.descricao ?? null;
}

/** As 13 ações do PCDC-CONEXAO — sugestão de veículo enquanto a lista do CNPq não vier. */
export async function acoesDeDivulgacaoSugeridas(): Promise<string[]> {
  const p = await carregarProposta();
  return p.planoDivulgacao.acoes;
}

/** A ficha conferida de um tipo de produção (rótulo longo, âncora, mapeamentos). */
export async function fichaDoTipoDeProducao(tipo: TipoProducao): Promise<TaxonomiaTipo | null> {
  const t = await carregarTaxonomia();
  const idNaTaxonomia = Object.entries(TIPO_PRODUCAO_POR_TAXONOMIA).find(([, v]) => v === tipo)?.[0];
  if (!idNaTaxonomia) return null;
  return t.tipos.find((x) => x.id === idNaTaxonomia) ?? null;
}

/** Os 28 laboratórios da semente (conferência da coordenação: `length === 28`). */
export async function laboratoriosDaSemente(): Promise<LaboratorioSemente[]> {
  const l = await carregarLaboratoriosSemente();
  return l.laboratorios;
}

/** A cadeia de resolução testada ao vivo (ordem dos provedores, timeout, concorrência). */
export async function cadeiaDeResolucao(): Promise<ApisMetadados["cadeiaRecomendada"]> {
  const a = await carregarApisMetadados();
  return a.cadeiaRecomendada;
}

/** O que a tela faz quando uma API falha — texto já decidido, não improvisado. */
export async function degradacaoDaApi(
  chave: string,
): Promise<{ quandoFalha?: string; acao?: string; nunca?: string } | null> {
  const a = await carregarApisMetadados();
  return a.degradacao.porApi[chave] ?? null;
}

// ================= 5. DERIVAÇÃO DE OBJETIVOS PELOS EETs (Q20 do Forms/CTC) ==
/**
 * A Q20 do Forms pede "a quais dos 43 objetivos você contribuiu". A decisão do
 * contrato (docs/relato-gforms.md, decisão 1): DERIVAR E CONFIRMAR — a tela
 * pré-marca os objetivos ligados aos EETs do laboratório e mostra SÓ esses,
 * nunca os 43 crus; a pessoa desmarca o que não for e o resultado confirmado
 * vai para `relatos.respostas.objetivos_confirmados` (009).
 *
 * DE ONDE VEM O MAPA — E O SEU ESTATUTO
 * -------------------------------------
 * A proposta submetida NÃO traz mapa objetivo↔EET (docs/relato-anual.md §4.2
 * avisa isso com todas as letras). O mapa abaixo é CURADORIA EDITORIAL: cada
 * um dos 43 objetivos foi lido contra os títulos das 8 EETs e associado às
 * etapas cujo escopo o cobre. Três salvaguardas o tornam defensável:
 *   1. ele NUNCA grava nada sozinho — só pré-marca; o dado que persiste é a
 *      confirmação humana (`objetivos_confirmados`), mesmo precedente da
 *      decisão "derivar E confirmar";
 *   2. na dúvida, o objetivo entrou em MAIS de uma EET (sobra desmarcável é
 *      mais barata que falta invisível — o que não aparece não é confirmado);
 *   3. o objetivo 43 ("produzir conhecimentos, produtos e publicações") é
 *      transversal por texto e entrou nas 8 — toda EET publica.
 * PENDÊNCIA DECLARADA: como o mapa meta→objetivo (§8.8 do relato-anual), este
 * mapa deve ser homologado pelo CGES; até lá é sugestão de tela, não fato.
 */
export const OBJETIVOS_POR_EET: Record<string, readonly number[]> = {
  // Clima × ambiente × sociedade × saúde única (bloco biometeorologia/SIMBAM)
  "EET-1": [1, 2, 3, 4, 5, 6, 43],
  // Levantamentos e bancos de dados (climáticos, socioterritoriais, etno-, epidemiológicos)
  "EET-2": [9, 10, 11, 12, 13, 14, 15, 43],
  // Biodiversidade, bioprospecção e biotecnologia de venenos/toxinas e plantas
  "EET-3": [7, 8, 11, 12, 18, 19, 20, 21, 22, 23, 43],
  // Bioeconomia, empreendedorismo, inovação e políticas públicas nos AEPLs
  "EET-4": [17, 25, 32, 33, 34, 35, 37, 38, 43],
  // Bioinformática e Saúde Pública de Precisão (MDDEs, IA, bioprognose)
  "EET-5": [5, 6, 27, 30, 43],
  // Biologia estrutural, química medicinal, bioensaios in vitro/in silico
  "EET-6": [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 43],
  // Formação de pessoas, redes de pesquisa e divulgação científica
  "EET-7": [31, 34, 35, 39, 40, 42, 43],
  // Políticas informadas por evidências e educação junto às comunidades
  "EET-8": [16, 17, 31, 33, 36, 38, 41, 43],
};

/** Um objetivo derivado: número, texto integral e a EET que o trouxe. */
export type ObjetivoDerivado = { numero: number; texto: string; eet: string };

export type DerivacaoDeObjetivos = {
  /**
   * `false` = nada a derivar (laboratório sem EET — o CGES ainda não preencheu
   * — ou códigos desconhecidos): a tela cai no modo "mostre todos os 43".
   */
  derivavel: boolean;
  objetivos: ObjetivoDerivado[];
};

/**
 * Os NÚMEROS derivados, síncrono e sem custo de chunk — para pré-marcar antes
 * de o texto chegar. Quando um objetivo pertence a mais de uma EET escolhida,
 * vale a primeira na ordem EET-1..EET-8 (ordem do array de entrada não manda:
 * `laboratorios.eets` vem do banco sem ordem garantida).
 */
export function numerosDosObjetivosDosEets(eets: readonly string[]): Map<number, string> {
  const porNumero = new Map<number, string>();
  const conhecidas = Object.keys(OBJETIVOS_POR_EET).filter((c) => eets.includes(c));
  for (const eet of conhecidas) {
    for (const n of OBJETIVOS_POR_EET[eet]) {
      if (!porNumero.has(n)) porNumero.set(n, eet);
    }
  }
  return porNumero;
}

/**
 * A DERIVAÇÃO da Q20, completa: números + texto integral (chunk da proposta,
 * carregado sob demanda) + a EET responsável. Pura no sentido que importa —
 * mesma entrada, mesma saída; sem efeito colateral — e assíncrona porque o
 * texto dos objetivos vive no chunk `proposta-inct-2024.json` (§ PESO acima).
 */
export async function objetivosDosEets(eets: readonly string[]): Promise<DerivacaoDeObjetivos> {
  const porNumero = numerosDosObjetivosDosEets(eets);
  if (porNumero.size === 0) return { derivavel: false, objetivos: [] };
  const p = await carregarProposta();
  const objetivos = [...porNumero.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, eet]) => ({
      numero,
      texto: p.objetivosEspecificos.find((o) => o.numero === numero)?.texto ?? "",
      eet,
    }));
  return { derivavel: true, objetivos };
}
