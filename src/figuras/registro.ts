/**
 * O registro de figuras publicadas.
 *
 * Uma figura só existe para o site se estiver aqui. `<Figura id="...">` recebe
 * apenas o id e busca todo o resto neste arquivo — assim é impossível publicar
 * um gráfico com fonte escrita na mão no JSX, que é como `FONTE_REDE` acabou
 * indo ao ar sem ano e sem licença.
 *
 * `tests/figuras.test.ts` percorre este registro e reprova qualquer figura sem
 * ano, licença, link, definição de coluna ou caixa declarada.
 */
import focos from "../content/dados/focos-por-uf-ano.json";
import { desenharLinhas } from "./desenho";
import type { Figura, FonteFigura, Linha } from "./tipos";
import { fmtBR } from "./tipos";

/** Lei Complementar nº 124/2007. Mesma lista de `src/content/rede.ts`. */
const AMAZONIA_LEGAL = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"] as const;

const ANOS: number[] = focos.anos;
const POR_UF = focos.focosPorUf as Record<string, Record<string, number>>;

const FONTE_INPE: FonteFigura = {
  titulo: focos.meta.titulo,
  publicador: focos.meta.publicador,
  url: focos.meta.url,
  ano: focos.meta.periodo,
  licenca: focos.meta.licenca,
  nota: focos.meta.notaMetodologica,
};

const COLUNA_ANO = {
  chave: "ano",
  rotulo: "Ano",
  definicao: "Ano civil da detecção, conforme a data de passagem do satélite",
};

/** Soma os focos de um conjunto de UFs num dado ano. */
function somar(ufs: readonly string[], ano: number): number {
  return ufs.reduce((t, uf) => t + (POR_UF[uf]?.[String(ano)] ?? 0), 0);
}

function totalDe(uf: string): number {
  return Object.values(POR_UF[uf] ?? {}).reduce((a, b) => a + b, 0);
}

/**
 * As quatro UFs da Amazônia Legal com maior acumulado na série.
 *
 * Calculado uma vez e congelado: entra nas colunas, no CSV e nas séries do
 * desenho, e essas três coisas precisam sair na mesma ordem. Recalcular a cada
 * chamada convidaria a uma divergência silenciosa entre o cabeçalho do CSV e as
 * linhas abaixo dele.
 */
const MAIORES: string[] = [...AMAZONIA_LEGAL].sort((a, b) => totalDe(b) - totalDe(a)).slice(0, 4);

const CREDITO = `Fonte: ${focos.meta.publicador} · ${focos.meta.periodo} · ${focos.meta.licenca}`;

/** Cores do tema, repetidas aqui porque SVG em arquivo não herda CSS. */
const PALETA = ["#c2410c", "#0f766e", "#7c3aed", "#b45309", "#1d4ed8", "#be123c"];

const focosAmazonia: Figura = {
  id: "focos-amazonia-legal",
  titulo: "Focos de queimada na Amazônia Legal",
  subtitulo:
    "Detecções anuais do satélite de referência do INPE, somadas nos nove estados da Amazônia Legal",
  fonte: FONTE_INPE,
  caixa: { largura: 760, altura: 420 },
  caixaMobile: { largura: 360, altura: 300 },
  colunas: [
    COLUNA_ANO,
    {
      chave: "focos",
      rotulo: "Focos",
      definicao:
        "Número de anomalias térmicas detectadas pelo satélite de referência nos nove estados da Amazônia Legal. Não é área queimada nem incêndio confirmado",
      unidade: "focos",
    },
  ],
  linhas: () => ANOS.map((ano): Linha => ({ ano, focos: somar(AMAZONIA_LEGAL, ano) })),
  desenhar: (linhas, caixa, carimbo = true) => {
    const pontos = linhas.map((l) => ({ x: Number(l.ano), y: Number(l.focos) }));
    const pico = pontos.reduce((a, b) => (b.y > a.y ? b : a));
    const ultimo = pontos[pontos.length - 1];
    // Na caixa estreita as anotações não cabem sem encavalar no traço.
    const estreita = caixa.largura < 500;
    return desenharLinhas(
      {
        titulo: "Focos de queimada na Amazônia Legal",
        subtitulo: "Detecções anuais do satélite de referência do INPE, nos nove estados",
        credito: CREDITO,
        carimbo,
        series: [{ rotulo: "Amazônia Legal", cor: PALETA[0], pontos }],
        notas: estreita
          ? [{ x: pico.x, y: pico.y, texto: String(pico.x) }]
          : [
              { x: pico.x, y: pico.y, texto: `${pico.x}: ${fmtBR(pico.y)}` },
              { x: ultimo.x, y: ultimo.y, texto: `${ultimo.x}: ${fmtBR(ultimo.y)}` },
            ],
      },
      caixa,
    );
  },
};

const focosPorEstado: Figura = {
  id: "focos-estados-amazonia",
  titulo: "Focos de queimada nos estados que mais queimam",
  subtitulo:
    "Detecções anuais do satélite de referência do INPE, nos quatro estados da Amazônia Legal com maior acumulado na série",
  fonte: FONTE_INPE,
  caixa: { largura: 760, altura: 440 },
  caixaMobile: { largura: 360, altura: 320 },
  colunas: [
    COLUNA_ANO,
    ...MAIORES.map((uf) => ({
      chave: uf.toLowerCase(),
      rotulo: uf,
      definicao: `Anomalias térmicas detectadas pelo satélite de referência em ${uf}`,
      unidade: "focos",
    })),
  ],
  linhas: () =>
    ANOS.map((ano): Linha => {
      const l: Linha = { ano };
      for (const uf of MAIORES) l[uf.toLowerCase()] = POR_UF[uf]?.[String(ano)] ?? 0;
      return l;
    }),
  desenhar: (linhas, caixa, carimbo = true) =>
    desenharLinhas(
      {
        titulo: "Focos de queimada nos estados que mais queimam",
        subtitulo: "Detecções anuais do satélite de referência do INPE",
        credito: CREDITO,
        carimbo,
        series: MAIORES.map((uf, i) => ({
          rotulo: uf,
          cor: PALETA[i % PALETA.length],
          pontos: linhas.map((l) => ({ x: Number(l.ano), y: Number(l[uf.toLowerCase()] ?? 0) })),
        })),
      },
      caixa,
    ),
};

export const FIGURAS: Figura[] = [focosAmazonia, focosPorEstado];

export function figuraPorId(id: string): Figura | undefined {
  return FIGURAS.find((f) => f.id === id);
}

/** Números derivados da série, para o texto do site não escrever nada à mão. */
export const FOCOS = {
  anoInicial: ANOS[0],
  anoFinal: ANOS[ANOS.length - 1],
  totalBrasil: Object.keys(POR_UF).reduce((t, uf) => t + totalDe(uf), 0),
  totalAmazoniaLegal: AMAZONIA_LEGAL.reduce((t, uf) => t + totalDe(uf), 0),
  get participacaoAmazonia(): number {
    return Math.round((FOCOS.totalAmazoniaLegal / FOCOS.totalBrasil) * 1000) / 10;
  },
} as const;
