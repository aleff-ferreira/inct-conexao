/**
 * ============================================================================
 *  Temas e camadas do mapa
 * ============================================================================
 *  IMPORTANTE (integridade dos dados): só existem aqui camadas cujos dados são
 *  REAIS e verificáveis — Amazônia Legal (IBGE/LC 124/2007), vagas de IC do
 *  Edital 04/2026 (dado público) e disponibilidade de conteúdo editorial. NÃO
 *  há camadas de vigilância/ambiente sintéticas: enquanto não houver um dado
 *  oficial com origem, resolução e data, a camada não entra (ver backlog no
 *  docs/mapa-interativo.md). Isso cumpre a regra do enunciado de nunca
 *  representar estimativa/inferência como se fosse dado observado.
 * ============================================================================
 */
import type { Fonte, ResumoNotificacoes, Uf } from "./types";
import { ufs } from "./geo";
import {
  ANO_INICIAL, ANO_FINAL, META_FOCOS, LEGENDA_FOCOS, LEGENDA_VARIACAO,
  focosDe, variacaoDe, corDoFoco, corDaVariacao, rotularFocos, type MedidaFocos,
} from "./focos";

/**
 * Acesso mais recente ao TabNet declarado nas fichas de estado.
 *
 * A camada de notificações ia ao ar sem data nenhuma — e dado epidemiológico
 * sem data não se interpreta: a mesma consulta ao TabNet devolve outro número
 * seis meses depois, porque notificação entra com atraso. `tests/figuras.test.ts`
 * mantém esta constante igual à data mais recente das fichas.
 */
export const DATA_ACESSO_TABNET = "2026-07-26";

export type TemaId = "saude" | "ambiente" | "pesquisa" | "comunidades";

/**
 * Vocabulário aceito na URL. Existem como constantes, e não derivados de
 * `construirCamadas`, porque `url.ts` precisa validar sem carregar o módulo de
 * conteúdo inteiro — e porque validação que depende de injeção não é validação.
 *
 * `tests/mapa.test.ts` mantém CAMADA_IDS igual aos ids realmente construídos:
 * lista de validação que envelhece rejeita link legítimo, que é pior do que
 * não validar.
 */
export const CAMADA_IDS: string[] = [
  "amazonia-legal",
  "doencas-notificacoes",
  "vagas-ic-2026",
  "instituicoes",
  "conteudo",
  "focos-calor",
];

/** Seções do painel de estado (StatePanel). */
export const SECAO_IDS: string[] = ["geral", "animais", "doencas", "ambiente", "servicos", "inct"];

export type Tema = { id: TemaId; label: string; descricao: string };

export const TEMAS: Tema[] = [
  { id: "saude", label: "Saúde & Vigilância", descricao: "Animais peçonhentos, doenças tropicais e negligenciadas, serviços de emergência." },
  { id: "ambiente", label: "Ambiente & Clima", descricao: "Biomas, hidrografia, clima e contexto ambiental." },
  { id: "pesquisa", label: "Pesquisa & Rede", descricao: "Instituições, laboratórios, projetos e atividades do INCT-CONEXAO." },
  { id: "comunidades", label: "Comunidades & Território", descricao: "Histórias de campo, educação e ciência cidadã." },
];

export type LegendaItem = { cor: string; rotulo: string; /** padrão para daltônicos */ hachura?: boolean };

export type CamadaTipo = "categorica" | "sequencial";

/**
 * Até onde este número pode ser levado.
 *
 * `comparavel` é um BOOLEANO que o código consulta, e não uma ressalva em
 * prosa — porque prosa não impede `sort()`. Sem ele, uma tabela ordenável
 * permitiria a alguém gerar, e compartilhar por link, a afirmação de que
 * "Tocantins tem mais doenças que o Acre" quando o número de TO é dengue
 * sozinha e o do AC soma quatro doenças. A interface teria fabricado a
 * mentira; o dado não a contém.
 *
 * Regra: ordenar, somar, normalizar e exportar em formato largo exigem
 * `comparavel: true`. Camada categórica nunca é comparável — `amazoniaLegal`
 * devolve 1 tanto para integral quanto para parcial, e um ranking disso seria
 * um ranking de booleanos.
 */
export type Comparabilidade = {
  /** Estágio do dado. A palavra aparece na legenda, nunca só uma cor. */
  maturidade: "consolidada" | "preliminar" | "experimental";
  /** Quantas UFs têm valor medido, de 27. Ausência é fato, não zero. */
  cobertura: { medidas: number; total: number };
  /** Valores podem ser ordenados, somados e comparados entre UFs. */
  comparavel: boolean;
  /** O que este número NÃO mede. Uma frase, exibida junto da legenda. */
  naoMede: string;
};

export type Camada = {
  id: string;
  label: string;
  tema: TemaId;
  tipo: CamadaTipo;
  descricao: string;
  fonte: Fonte;
  /** Ver `Comparabilidade`. Obrigatório: camada sem isso não pode ser tabelada. */
  escopo: Comparabilidade;
  /** valor bruto por UF (para tooltip/legenda); null = sem dado. */
  valor: (uf: Uf) => number | null;
  /** cor de preenchimento por UF. */
  cor: (uf: Uf) => string;
  /** legenda (categorias ou faixas), com padrão não-cromático. */
  legenda: LegendaItem[];
  /** texto do valor no tooltip; undefined => sem linha. */
  rotularValor?: (uf: Uf) => string | undefined;
};

/* ---- rampa sequencial teal (na identidade do site: --river) ---- */
const RAMPA_TEAL = ["#e4eff2", "#bfe0e7", "#8fc9d4", "#4ea7b8", "#1f8ca5"];
function faixaTeal(v: number, faixas: number[]): string {
  // faixas = limites superiores; retorna cor da rampa
  for (let i = 0; i < faixas.length; i++) if (v <= faixas[i]) return RAMPA_TEAL[i + 1] ?? RAMPA_TEAL[RAMPA_TEAL.length - 1];
  return RAMPA_TEAL[RAMPA_TEAL.length - 1];
}

/* ---- rampa quente (âmbar → clay) para CARGA/notificações: tom distinto do
   teal "positivo" da rede, sinalizando magnitude de agravos sem alarmismo ---- */
const RAMPA_QUENTE = ["#f7ecdd", "#f2cf9b", "#e7a758", "#d17d34", "#a8511f"];
function faixaQuente(v: number, faixas: number[]): string {
  for (let i = 0; i < faixas.length; i++) if (v <= faixas[i]) return RAMPA_QUENTE[i + 1] ?? RAMPA_QUENTE[RAMPA_QUENTE.length - 1];
  return RAMPA_QUENTE[RAMPA_QUENTE.length - 1];
}
const fmtBR = (n: number) => n.toLocaleString("pt-BR");

/* ============================================================== */
/*  DADOS REAIS                                                    */
/* ============================================================== */

/**
 * Vagas de Iniciação Científica por UF — Edital 04/2026 (Processo Seletivo
 * Simplificado INCT-CONEXAO). Dado público; total = 50 vagas em 18 UFs.
 */
export const VAGAS_IC_2026: Record<string, number> = {
  RO: 15, RR: 2, AM: 5, PA: 4, MA: 2, TO: 1, AP: 3, MT: 2, AL: 2,
  CE: 3, PB: 1, PE: 1, PI: 1, SE: 1, RN: 2, MS: 2, DF: 2, GO: 1,
};

/**
 * Instituições da rede por UF (catálogo de parceiros do INCT-CONEXAO,
 * extraído da proposta CNPq 2024). Rondônia é a sede (19). Total nacional com
 * UF: 65 instituições em 21 unidades (há ainda parceiras estrangeiras).
 */
export const INSTITUICOES_POR_UF: Record<string, number> = {
  AL: 1, AM: 3, AP: 1, CE: 2, DF: 3, MA: 2, MG: 5, MS: 2, MT: 1, PA: 2,
  PB: 2, PE: 1, PR: 2, RJ: 4, RN: 1, RO: 19, RR: 4, RS: 1, SE: 1, SP: 6, TO: 2,
};
/** UF-sede da rede (origem das conexões). */
export const HUB = "RO";

const FONTE_EDITAL: Fonte = {
  titulo: "Edital 04/2026: Processo Seletivo Simplificado INCT-CONEXAO",
  publicador: "INCT-CONEXAO",
  data: "2026-07-01",
};
const FONTE_REDE: Fonte = {
  titulo: "Composição da rede INCT-CONEXAO (proposta CNPq 2024)",
  publicador: "INCT-CONEXAO",
};
const FONTE_IBGE: Fonte = {
  titulo: "Malhas Territoriais e Localidades: Amazônia Legal (LC nº 124/2007)",
  url: "https://www.ibge.gov.br/geociencias/cartas-e-mapas/mapas-regionais/15819-amazonia-legal.html",
  publicador: "IBGE",
};

/* ============================================================== */
/*  CAMADAS                                                        */
/* ============================================================== */

/**
 * Constrói as camadas. `temContéudo(uf)` é injetado pelo módulo de conteúdo
 * para não criar dependência circular (layers ← content ← layers).
 */
export function construirCamadas(
  temConteudo: (sigla: string) => boolean,
  notificacoesDe: (sigla: string) => ResumoNotificacoes | null = () => null,
  /* A camada de focos tem eixo de tempo: o ano e a medida entram aqui em vez de
     virarem estado interno da camada, para que ela continue sendo uma função
     pura do dado — que é o que permite ao build gerar a versão estática. */
  tempo: { ano?: number; medida?: MedidaFocos } = {},
): Camada[] {
  const CINZA = "#dfe8e2";
  const ano = tempo.ano ?? ANO_FINAL;
  const medida = tempo.medida ?? "absoluto";

  /* Cobertura e período da lente de doenças, DERIVADOS das fichas.
     Antes eram prosa: a descrição dizia "Acre e Amapá" enquanto o mapa pintava
     quatro estados, e o rótulo carimbava "(desde 2018)" mesmo onde a série
     começa em 2016. Descrever um dado que muda é como o erro nasce; derivar
     dele é a única defesa que não depende de alguém lembrar. */
  const comNotificacao = ufs
    .map((u) => ({ uf: u, r: notificacoesDe(u.sigla) }))
    .filter((x): x is { uf: Uf; r: ResumoNotificacoes } => x.r != null);
  const nomesCobertos = comNotificacao.map((x) => `${x.uf.nome} (${x.uf.sigla})`);
  const anosIniciais = comNotificacao.map((x) => x.r.desde).filter((a): a is number => a != null);
  const periodoCoberto = anosIniciais.length
    ? Math.min(...anosIniciais) === Math.max(...anosIniciais)
      ? `acumuladas desde ${Math.min(...anosIniciais)}`
      : `acumuladas a partir de ${Math.min(...anosIniciais)} ou ${Math.max(...anosIniciais)}, conforme o estado`
    : "período conforme a ficha de cada estado";
  const listaCoberta = nomesCobertos.length
    ? `${nomesCobertos.slice(0, -1).join(", ")}${nomesCobertos.length > 1 ? " e " : ""}${nomesCobertos[nomesCobertos.length - 1]}`
    : "nenhum estado ainda";

  const amazoniaLegal: Camada = {
    escopo: {
      maturidade: "consolidada",
      cobertura: { medidas: 27, total: 27 },
      // Categórica: `valor` devolve 1 para integral E para parcial. Ordenar
      // isso produziria um ranking de booleanos, e o Maranhão apareceria igual
      // ao Amazonas.
      comparavel: false,
      naoMede: "É um recorte legal de planejamento (LC nº 124/2007), não a extensão do bioma nem da floresta em pé.",
    },
    id: "amazonia-legal",
    label: "Amazônia Legal",
    tema: "ambiente",
    tipo: "categorica",
    descricao: "Recorte oficial da Amazônia Legal (Lei Complementar nº 124/2007). Maranhão entra parcialmente (oeste do meridiano 44°O).",
    fonte: FONTE_IBGE,
    valor: (u) => (u.amazoniaLegal ? 1 : 0),
    cor: (u) => (u.amazoniaLegal === "integral" ? "#2f7a52" : u.amazoniaLegal === "parcial" ? "#8bc0a0" : CINZA),
    legenda: [
      { cor: "#2f7a52", rotulo: "Amazônia Legal (integral)" },
      { cor: "#8bc0a0", rotulo: "Parcial (Maranhão)", hachura: true },
      { cor: CINZA, rotulo: "Demais unidades" },
    ],
    rotularValor: (u) => (u.amazoniaLegal ? `Amazônia Legal (${u.amazoniaLegal})` : "Fora da Amazônia Legal"),
  };

  const vagas: Camada = {
    escopo: {
      maturidade: "consolidada",
      cobertura: { medidas: totalUfsComVagas, total: 27 },
      comparavel: true,
      naoMede: "É a oferta prevista no edital, não as bolsas efetivamente implementadas — a distribuição realizada difere.",
    },
    id: "vagas-ic-2026",
    label: "Vagas de IC (Edital 04/2026)",
    tema: "pesquisa",
    tipo: "sequencial",
    descricao: "Bolsas de Iniciação Científica ofertadas por UF no processo seletivo 2026 (50 vagas em 18 unidades). Dado público do edital.",
    fonte: FONTE_EDITAL,
    valor: (u) => VAGAS_IC_2026[u.sigla] ?? null,
    cor: (u) => {
      const v = VAGAS_IC_2026[u.sigla];
      if (v == null) return CINZA;
      return faixaTeal(v, [1, 2, 4, 15]);
    },
    legenda: [
      { cor: RAMPA_TEAL[1], rotulo: "1 vaga" },
      { cor: RAMPA_TEAL[2], rotulo: "2 vagas" },
      { cor: RAMPA_TEAL[3], rotulo: "3 a 4 vagas" },
      { cor: RAMPA_TEAL[4], rotulo: "5 a 15 vagas" },
      { cor: CINZA, rotulo: "Sem oferta neste edital" },
    ],
    rotularValor: (u) => {
      const v = VAGAS_IC_2026[u.sigla];
      return v == null ? "Sem vagas neste edital" : `${v} vaga${v > 1 ? "s" : ""} de IC`;
    },
  };

  const instituicoes: Camada = {
    escopo: {
      maturidade: "consolidada",
      cobertura: { medidas: totalUfsComInstituicoes, total: 27 },
      comparavel: true,
      naoMede: "Conta instituições cadastradas no catálogo da rede, não pesquisadores, laboratórios nem volume de atividade.",
    },
    id: "instituicoes",
    label: "Instituições da rede",
    tema: "pesquisa",
    tipo: "sequencial",
    descricao: "Número de instituições parceiras por UF na proposta da rede (sede em Rondônia, com 19). Total: 65 instituições nacionais em 21 unidades, além de parceiras estrangeiras.",
    fonte: FONTE_REDE,
    valor: (u) => INSTITUICOES_POR_UF[u.sigla] ?? null,
    cor: (u) => {
      const v = INSTITUICOES_POR_UF[u.sigla];
      if (v == null) return CINZA;
      return faixaTeal(v, [1, 2, 5, 20]);
    },
    legenda: [
      { cor: RAMPA_TEAL[1], rotulo: "1 instituição" },
      { cor: RAMPA_TEAL[2], rotulo: "2 instituições" },
      { cor: RAMPA_TEAL[3], rotulo: "3 a 5" },
      { cor: RAMPA_TEAL[4], rotulo: "6 ou mais" },
      { cor: CINZA, rotulo: "Sem registro no catálogo" },
    ],
    rotularValor: (u) => {
      const v = INSTITUICOES_POR_UF[u.sigla];
      return v == null ? "Sem instituição no catálogo" : `${v} instituiç${v > 1 ? "ões" : "ão"} da rede`;
    },
  };

  const conteudo: Camada = {
    escopo: {
      maturidade: "consolidada",
      cobertura: { medidas: ufs.filter((u) => temConteudo(u.sigla)).length, total: 27 },
      // Categórica (tem ficha / não tem). E o que ela mede é o nosso trabalho
      // editorial, não o território.
      comparavel: false,
      naoMede: "Mede o andamento do cadastro editorial deste site. Ausência de ficha NÃO significa ausência de risco ou de atividade.",
    },
    id: "conteudo",
    label: "Conteúdo disponível",
    tema: "pesquisa",
    tipo: "categorica",
    descricao: "Estados que já têm ficha editorial publicada no mapa. Ausência NÃO significa ausência de risco ou de atividade, apenas que o conteúdo ainda não foi cadastrado.",
    fonte: {
      titulo: "Registros editoriais do mapa (src/content/mapa)",
      publicador: "INCT-CONEXAO",
      // Camada de conteúdo próprio, mas data igual importa: ela informa quantos
      // estados já têm ficha, e esse número muda a cada publicação.
      data: DATA_ACESSO_TABNET,
    },
    valor: (u) => (temConteudo(u.sigla) ? 1 : 0),
    cor: (u) => (temConteudo(u.sigla) ? "#1f8ca5" : CINZA),
    legenda: [
      { cor: "#1f8ca5", rotulo: "Ficha publicada" },
      { cor: CINZA, rotulo: "Em preparação" },
    ],
    rotularValor: (u) => (temConteudo(u.sigla) ? "Ficha publicada" : "Ficha em preparação"),
  };

  const doencas: Camada = {
    escopo: {
      maturidade: "preliminar",
      cobertura: { medidas: comNotificacao.length, total: 27 },
      /* NÃO comparável, e esta é a decisão mais importante do bloco: os totais
         somam conjuntos DIFERENTES de doenças em cada estado. Tocantins traz
         88.065 de dengue sozinha; o Acre traz 79.324 somando quatro doenças.
         Ordenar produziria "TO pior que AC", que o dado não sustenta. */
      comparavel: false,
      naoMede: "Notificação não é caso confirmado, e o total soma conjuntos diferentes de doenças em cada estado — os números não se comparam entre UFs. A malária fica de fora (é acompanhada pelo SIVEP-Malária, não pelo SINAN).",
    },
    id: "doencas-notificacoes",
    label: "Doenças (notificações)",
    tema: "saude",
    tipo: "sequencial",
    descricao:
      `Notificações de doenças tropicais no SINAN (TabNet DataSUS), ${periodoCoberto}. ` +
      `Disponível para ${listaCoberta}; demais estados em preparação. A malária não entra (é notificada no ` +
      "SIVEP-Malária, sistema à parte). Notificação não é o mesmo que caso confirmado, e o número reflete " +
      "também a intensidade da vigilância, então a comparação entre estados é apenas indicativa.",
    fonte: {
      titulo: "Doenças de notificação compulsória (SINAN) via TabNet",
      publicador: "DataSUS · Ministério da Saúde",
      url: "https://datasus.saude.gov.br/informacoes-de-saude-tabnet/",
      data: DATA_ACESSO_TABNET,
    },
    valor: (u) => notificacoesDe(u.sigla)?.valor ?? null,
    cor: (u) => {
      const v = notificacoesDe(u.sigla)?.valor;
      if (v == null) return CINZA;
      return faixaQuente(v, [5000, 20000, 50000]);
    },
    legenda: [
      { cor: RAMPA_QUENTE[1], rotulo: "até 5 mil" },
      { cor: RAMPA_QUENTE[2], rotulo: "5 mil a 20 mil" },
      { cor: RAMPA_QUENTE[3], rotulo: "20 mil a 50 mil" },
      { cor: RAMPA_QUENTE[4], rotulo: "mais de 50 mil" },
      { cor: CINZA, rotulo: "Sem dado (em preparação)" },
    ],
    rotularValor: (u) => {
      const r = notificacoesDe(u.sigla);
      if (r == null) return "Notificações em preparação";
      return `${fmtBR(r.valor)} notificações${r.desde ? ` (desde ${r.desde})` : ""}`;
    },
  };

  /**
   * Focos de calor do INPE — a única camada do mapa com eixo de tempo.
   *
   * É a série mais forte do projeto: 594 pontos, satélite de referência, e uma
   * nota metodológica que a própria fonte escreve. Ela entra no fim da lista
   * porque é a mais recente, não porque é a menos importante.
   */
  const focosCalor: Camada = {
    id: "focos-calor",
    label: `Focos de calor (${ano})`,
    tema: "ambiente",
    tipo: "sequencial",
    descricao:
      `Detecções de anomalia térmica pelo satélite de referência do INPE em ${ano}, por unidade federativa. ` +
      `A série cobre ${ANO_INICIAL} a ${ANO_FINAL}; use o controle de ano para percorrê-la. ` +
      "A escala de cor é a mesma em todos os anos — sem isso, cada ano pareceria igual e a tendência sumiria.",
    fonte: {
      titulo: META_FOCOS.titulo,
      publicador: META_FOCOS.publicador,
      url: META_FOCOS.url,
      data: META_FOCOS.geradoEm,
    },
    escopo: {
      maturidade: "consolidada",
      cobertura: { medidas: 27, total: 27 },
      // Mesmo satélite, mesmo horário de passagem, mesma contagem: comparável
      // entre estados E entre anos. É a única camada do mapa de que isso vale.
      comparavel: true,
      naoMede: META_FOCOS.notaMetodologica,
    },
    valor: (u) => (medida === "variacao" ? variacaoDe(u.sigla, ano) : focosDe(u.sigla, ano)),
    cor: (u) =>
      (medida === "variacao"
        ? corDaVariacao(variacaoDe(u.sigla, ano))
        : corDoFoco(focosDe(u.sigla, ano))) ?? CINZA,
    legenda: medida === "variacao" ? LEGENDA_VARIACAO : LEGENDA_FOCOS,
    rotularValor: (u) => rotularFocos(u, ano, medida),
  };

  return [amazoniaLegal, doencas, vagas, instituicoes, conteudo, focosCalor];
}

/** Total de vagas (para textos). */
export const totalVagasIc = Object.values(VAGAS_IC_2026).reduce((a, b) => a + b, 0);
export const totalUfsComVagas = Object.keys(VAGAS_IC_2026).length;
export const totalAmazoniaLegal = ufs.filter((u) => u.amazoniaLegal).length;
export const totalInstituicoes = Object.values(INSTITUICOES_POR_UF).reduce((a, b) => a + b, 0);
export const totalUfsComInstituicoes = Object.keys(INSTITUICOES_POR_UF).length;
