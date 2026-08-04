/**
 * Focos de calor do INPE como camada com eixo de tempo.
 *
 * São 594 pontos reais (27 UFs × 2003–2024) que hoje existem só em dois
 * gráficos abaixo do mapa. Postos no mapa com um controle de ano, respondem a
 * pergunta que nenhuma outra camada responde: *como isso mudou, no meu estado?*
 *
 * O dado já está no chunk do mapa (importado por `figuras/registro`), então a
 * camada custa zero byte novo.
 *
 * TRÊS DECISÕES DE INTEGRIDADE, E O MOTIVO DE CADA UMA
 *
 * 1. ESCALA FIXA entre os anos. Reescalar por ano é a mentira clássica do
 *    controle de tempo: todo ano passa a parecer igual, e a tendência — que é
 *    exatamente o que o controle existe para mostrar — some. Os cortes são
 *    calculados uma vez sobre a série inteira.
 *
 * 2. RAMPA PRÓPRIA. `RAMPA_QUENTE` já é a das notificações de doença. Duas
 *    camadas de fenômenos diferentes com a mesma paleta, no mesmo mapa, é
 *    confusão de leitura — e aqui seria pior, porque insinuaria parentesco
 *    entre queimada e doença que este dado não sustenta.
 *
 * 3. VARIAÇÃO com escala DIVERGENTE e pontas nomeadas em português ("caiu" /
 *    "subiu"), nunca "baixo/alto": em variação, o meio é zero e as pontas são
 *    qualitativamente opostas, não extremos de uma mesma grandeza.
 */
import focos from "../content/dados/focos-por-uf-ano.json";
import type { Uf } from "./types";

const POR_UF = focos.focosPorUf as Record<string, Record<string, number>>;
export const ANOS: number[] = focos.anos;
export const ANO_INICIAL = ANOS[0];
export const ANO_FINAL = ANOS[ANOS.length - 1];
export const META_FOCOS = focos.meta;

/** Focos de uma UF num ano. `null` = a UF não está na série. */
export function focosDe(sigla: string, ano: number): number | null {
  const v = POR_UF[sigla]?.[String(ano)];
  return v == null ? null : v;
}

/**
 * Cortes da escala, calculados sobre a série INTEIRA — não por ano.
 *
 * Usa quantis, e não faixas iguais: a distribuição é muito assimétrica (Pará e
 * Mato Grosso concentram a maior parte), e faixas iguais deixariam 24 estados
 * na mesma cor, transformando o mapa num retrato de dois estados.
 */
function cortesGlobais(): number[] {
  const todos: number[] = [];
  for (const uf of Object.keys(POR_UF)) {
    for (const a of ANOS) {
      const v = POR_UF[uf]?.[String(a)];
      if (v != null && v > 0) todos.push(v);
    }
  }
  todos.sort((a, b) => a - b);
  const q = (p: number) => todos[Math.floor(todos.length * p)];
  return [q(0.4), q(0.65), q(0.85), q(0.95)];
}
export const CORTES = cortesGlobais();

/** Rampa própria: âmbar → vermelho profundo. Não é a das notificações. */
export const RAMPA_FOGO = ["#fdf0d5", "#fbd08a", "#f2994a", "#d1462f", "#8c1d18"];

export function corDoFoco(v: number | null): string | null {
  if (v == null) return null;
  for (let i = 0; i < CORTES.length; i++) if (v <= CORTES[i]) return RAMPA_FOGO[i];
  return RAMPA_FOGO[RAMPA_FOGO.length - 1];
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

export const LEGENDA_FOCOS = [
  { cor: RAMPA_FOGO[0], rotulo: `até ${fmt(CORTES[0])}` },
  { cor: RAMPA_FOGO[1], rotulo: `${fmt(CORTES[0])} a ${fmt(CORTES[1])}` },
  { cor: RAMPA_FOGO[2], rotulo: `${fmt(CORTES[1])} a ${fmt(CORTES[2])}` },
  { cor: RAMPA_FOGO[3], rotulo: `${fmt(CORTES[2])} a ${fmt(CORTES[3])}` },
  { cor: RAMPA_FOGO[4], rotulo: `mais de ${fmt(CORTES[3])}` },
];

/* ---------------------------------------------------------------- variação */

/** Rampa divergente: o meio é ZERO, e as pontas são opostos, não extremos. */
export const RAMPA_VARIACAO = ["#1f6f8b", "#8fc9d4", "#f0efe9", "#f2994a", "#8c1d18"];

/** Variação percentual contra o ano inicial da série. `null` se faltar ponta. */
export function variacaoDe(sigla: string, ano: number, base = ANO_INICIAL): number | null {
  const a = focosDe(sigla, base);
  const b = focosDe(sigla, ano);
  if (a == null || b == null || a === 0) return null;
  return ((b - a) / a) * 100;
}

export function corDaVariacao(v: number | null): string | null {
  if (v == null) return null;
  if (v <= -50) return RAMPA_VARIACAO[0];
  if (v <= -10) return RAMPA_VARIACAO[1];
  if (v < 10) return RAMPA_VARIACAO[2];
  if (v < 50) return RAMPA_VARIACAO[3];
  return RAMPA_VARIACAO[4];
}

export const LEGENDA_VARIACAO = [
  { cor: RAMPA_VARIACAO[0], rotulo: "caiu mais de 50%" },
  { cor: RAMPA_VARIACAO[1], rotulo: "caiu 10% a 50%" },
  { cor: RAMPA_VARIACAO[2], rotulo: "estável (±10%)" },
  { cor: RAMPA_VARIACAO[3], rotulo: "subiu 10% a 50%" },
  { cor: RAMPA_VARIACAO[4], rotulo: "subiu mais de 50%" },
];

export type MedidaFocos = "absoluto" | "variacao";

/** Rótulo do valor para tooltip e tabela, com a unidade sempre junto. */
export function rotularFocos(u: Uf, ano: number, medida: MedidaFocos): string {
  if (medida === "variacao") {
    const v = variacaoDe(u.sigla, ano);
    if (v == null) return "sem base de comparação";
    const sinal = v > 0 ? "+" : "";
    return `${sinal}${v.toFixed(0)}% em relação a ${ANO_INICIAL}`;
  }
  const v = focosDe(u.sigla, ano);
  return v == null ? "sem dado" : `${fmt(v)} focos em ${ano}`;
}
