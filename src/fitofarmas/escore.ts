/**
 * ============================================================================
 *  Escore de intenção — a régua que ordena os participantes
 * ============================================================================
 *  ESTE ARQUIVO NÃO É USADO PELO FORMULÁRIO. O escore que vale é o do servidor
 *  (`escore_intencao_workshop` na migração 008), calculado dentro da RPC e
 *  nunca aceito do cliente: um número de priorização que o navegador escolhe
 *  não prioriza nada.
 *
 *  Então por que ele existe aqui?
 *
 *   1. É a ESPECIFICAÇÃO EXECUTÁVEL da fórmula. `tests/fitofarmas.test.ts` roda
 *      os casos de fronteira contra esta função e, no mesmo arquivo, confere que
 *      os pesos literais do .sql são os mesmos daqui. Sem o par, a fórmula do
 *      banco só seria testável abrindo o SQL Editor.
 *   2. É onde a régua está EXPLICADA. A 008 tem a fórmula; a justificativa de
 *      cada peso está aqui, junto do código que a implementa.
 *
 *  Se um dia a coordenação quiser outra régua, muda-se a função do banco e
 *  re-pontua o histórico inteiro numa instrução — as respostas cruas ficam
 *  guardadas em `workshop_respostas.respostas` exatamente para isso:
 *
 *      update public.workshop_respostas
 *         set escore_intencao = public.escore_intencao_workshop(respostas);
 *
 *  ==========================================================================
 *  POR QUE OS PESOS SÃO ESTES
 *  ==========================================================================
 *  A régua inteira segue um princípio: **pesa mais o que custa mais responder.**
 *
 *   30 pts · COMPROMISSOS      — passo com verbo e prazo. Quem marca "carta de
 *                                anuência" sabe que vai receber a cobrança.
 *   20 pts · APORTES NOMEADOS  — marcar "tenho base de dados" é grátis;
 *                                escrever "Herbário HFSL, 12 mil exsicatas"
 *                                exige ter. 5 pts por aporte NOMEADO contra
 *                                1 pt por aporte apenas marcado.
 *   18 pts · DISPONIBILIDADE   — tempo em unidade de calendário.
 *   12 pts · HORIZONTE         — "já tenho pronto" ≠ "algum dia".
 *    8 pts · DECISÃO           — capacidade institucional de assinar.
 *    8 pts · HISTÓRICO         — comportamento passado. É o melhor preditor
 *                                isolado de comportamento futuro, e é o único
 *                                item que não depende de nenhuma promessa.
 *    8 pts · INICIATIVAS       — o que quer construir junto.
 *    8 pts · INTERESSE         — o portão declarado.
 *    4 pts · CHANCE 1–5        — autodeclaração pura. Quatro pontos em cem, de
 *                                propósito: é a pergunta que todo mundo
 *                                responde bem e que por isso não separa
 *                                ninguém.
 *
 *  Soma dos tetos: 116. O corte em 100 é intencional — chegar ao topo exige
 *  LARGURA (compromisso + ativo + tempo + histórico), não um único item no
 *  máximo. Ninguém tira 100 marcando tudo numa dimensão só.
 * ============================================================================
 */
import type {
  Aporte,
  Compromisso,
  Decisao,
  Disponibilidade,
  Faixa,
  Historico,
  Horizonte,
  Interesse,
  Respostas,
} from "./types";

/** Tetos por dimensão. Somam 116; o resultado é cortado em 100. */
export const TETOS = {
  compromissos: 30,
  aportes: 20,
  disponibilidade: 18,
  horizonte: 12,
  decisao: 8,
  historico: 8,
  iniciativas: 8,
  interesse: 8,
  chance: 4,
} as const;

/**
 * Peso de cada compromisso, por custo real de execução. `depois` vale zero e
 * não é penalidade: é resposta honesta, e punir honestidade ensina a mentir.
 */
export const PESO_COMPROMISSO: Readonly<Record<Compromisso, number>> = {
  carta_intencao: 8,
  coescrever_proposta: 8,
  sediar_atividade: 8,
  gt_redesfito: 7,
  compartilhar_dados: 6,
  indicar_estudantes: 6,
  apresentar_experiencia: 5,
  reuniao_30d: 5,
  depois: 0,
} as const;

export const PESO_DISPONIBILIDADE: Readonly<Record<Disponibilidade, number>> = {
  ate_1_dia_semana: 18,
  ate_1_dia_mes: 14,
  ate_meio_dia_mes: 10,
  ate_2h_mes: 5,
  so_acompanhar: 0,
} as const;

export const PESO_HORIZONTE: Readonly<Record<Horizonte, number>> = {
  ja_tenho: 12,
  ate_6_meses: 9,
  ate_12_meses: 5,
  sem_prazo: 0,
} as const;

export const PESO_DECISAO: Readonly<Record<Decisao, number>> = {
  decido: 8,
  influencio: 5,
  preciso_aval: 3,
  nao_sei: 0,
} as const;

export const PESO_HISTORICO: Readonly<Record<Historico, number>> = {
  formal: 8,
  informal: 5,
  tentei: 3,
  nao: 0,
} as const;

export const PESO_INTERESSE: Readonly<Record<Interesse, number>> = {
  proposta: 8,
  colaborar: 5,
  entender: 2,
  acompanhar: 0,
} as const;

/** Aporte NOMEADO (com "qual?" preenchido) contra aporte apenas marcado. */
export const PESO_APORTE_NOMEADO = 5;
export const PESO_APORTE_MARCADO = 1;
/** Por iniciativa desejada. `nenhuma` não entra na conta (ver `escoreDe`). */
export const PESO_INICIATIVA = 2;

const somar = (n: number, teto: number): number => (n > teto ? teto : n);

/**
 * Calcula o escore 0–100. Espelho exato de `public.escore_intencao_workshop`.
 *
 * TOLERANTE A CAMPO FALTANDO de propósito: recebe o jsonb cru, que pode vir de
 * uma edição anterior do formulário com menos perguntas. Chave desconhecida
 * vale zero, nunca lança.
 */
export function escoreDe(r: Partial<Respostas>): number {
  const lista = <T>(v: readonly T[] | undefined): readonly T[] => (Array.isArray(v) ? v : []);

  // --- compromissos: soma dos pesos, teto 30
  const compromissos = somar(
    lista(r.compromissos).reduce((soma, c) => soma + (PESO_COMPROMISSO[c] ?? 0), 0),
    TETOS.compromissos,
  );

  // --- aportes: nomear vale 5×; só marcar vale 1×. `nenhum` nunca conta.
  const marcados = lista(r.aportes).filter((a): a is Aporte => a !== "nenhum");
  const detalhe = r.aportes_detalhe ?? {};
  const nomeados = marcados.filter((a) => (detalhe[a] ?? "").trim().length > 0);
  const aportes = somar(
    nomeados.length * PESO_APORTE_NOMEADO +
      (marcados.length - nomeados.length) * PESO_APORTE_MARCADO,
    TETOS.aportes,
  );

  // --- iniciativas: `nenhuma` não é iniciativa e não pontua.
  const iniciativas = somar(
    lista(r.iniciativas).filter((i) => i !== "nenhuma").length * PESO_INICIATIVA,
    TETOS.iniciativas,
  );

  // --- escala 1–5: (n − 1) pontos, ou seja, 0 a 4. Não respondida = 0.
  const chance = somar(Math.max(0, (r.chance_1a5 ?? 0) - 1), TETOS.chance);

  const total =
    compromissos +
    aportes +
    iniciativas +
    chance +
    (r.disponibilidade ? (PESO_DISPONIBILIDADE[r.disponibilidade] ?? 0) : 0) +
    (r.horizonte ? (PESO_HORIZONTE[r.horizonte] ?? 0) : 0) +
    (r.decisao ? (PESO_DECISAO[r.decisao] ?? 0) : 0) +
    (r.historico ? (PESO_HISTORICO[r.historico] ?? 0) : 0) +
    (r.interesse ? (PESO_INTERESSE[r.interesse] ?? 0) : 0);

  return Math.max(0, Math.min(100, Math.round(total)));
}

/**
 * Cortes da faixa. Mesmos números da view `workshop_prioridade` da 008.
 *
 * NUNCA MOSTRADA A QUEM RESPONDE. Devolver "você é prioritário" convida ao
 * jogo — a próxima pessoa descobre quais caixas marcar e o instrumento morre.
 * A faixa existe para a coordenação decidir a quem escrever primeiro.
 */
export const CORTES = { prioritario: 70, promissor: 45, acompanhar: 25 } as const;

export function faixaDe(escore: number): Faixa {
  if (escore >= CORTES.prioritario) return "prioritario";
  if (escore >= CORTES.promissor) return "promissor";
  if (escore >= CORTES.acompanhar) return "acompanhar";
  return "informativo";
}

/** Rótulo da faixa para o painel da coordenação. */
export const ROTULO_FAIXA: Readonly<Record<Faixa, string>> = {
  prioritario: "Prioritário: procurar antes do evento",
  promissor: "Promissor: convidar para o GT",
  acompanhar: "Acompanhar: manter na lista de contatos",
  informativo: "Informativo: só quer receber notícias",
} as const;
