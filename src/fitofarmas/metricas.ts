/**
 * ============================================================================
 *  Métricas do painel Fitofarmas — funções puras sobre as respostas
 * ============================================================================
 *  TUDO AQUI É PURO: recebe as linhas que a view `workshop_prioridade` devolve
 *  e calcula agregados. Nenhuma função vai à rede, nenhuma toca o DOM — é o que
 *  permite testá-las em `tests/fitofarmas-painel.test.ts` sem montar componente
 *  nem simular Supabase, no padrão de toda a suíte.
 *
 *  A PERGUNTA QUE CADA MÉTRICA RESPONDE está no comentário dela. Métrica sem
 *  pergunta é número de enfeite — e número de enfeite num painel de gestão
 *  ensina a coordenação a ignorar o painel.
 *
 *  OS RÓTULOS VÊM DE `perguntas.ts`. O banco guarda ids (`ate_1_dia_mes`); a
 *  tela mostra rótulos ("Cerca de 1 dia por mês"). A tradução mora aqui para o
 *  painel e o CSV dizerem a MESMA coisa — CSV com id cru vira planilha que só
 *  programador lê.
 * ============================================================================
 */
import {
  APORTES,
  CANAIS,
  COMPROMISSOS,
  DECISOES,
  DISPONIBILIDADES,
  EETS,
  FORMAS,
  HISTORICOS,
  HORIZONTES,
  INICIATIVAS,
  INTERESSES,
  SEDES,
  VINCULOS,
} from "./perguntas";
import { ROTULO_FAIXA } from "./escore";
import type { Faixa } from "./types";

/**
 * Uma linha da view `workshop_prioridade` (migração 008), já com a faixa e a
 * contagem de aportes nomeados calculadas pelo banco. O painel NUNCA recalcula
 * escore nem faixa — a régua é do servidor, e recalculá-la aqui é como a
 * divergência silenciosa começa.
 */
export type RespostaPainel = {
  readonly id: string;
  readonly protocolo: string | null;
  readonly nome: string;
  readonly email: string;
  readonly telefone: string | null;
  readonly canal: string;
  readonly instituicao: string;
  readonly uf: string | null;
  readonly lattes: string | null;
  readonly orcid: string | null;
  readonly vinculo: string;
  readonly interesse: string;
  readonly sede: string;
  readonly escore_intencao: number;
  readonly faixa: Faixa;
  readonly eets: readonly string[];
  readonly formas: readonly string[];
  readonly aportes: readonly string[];
  readonly aportes_detalhe: Readonly<Record<string, string>>;
  readonly iniciativas: readonly string[];
  readonly compromissos: readonly string[];
  readonly disponibilidade: string | null;
  readonly horizonte: string | null;
  readonly decisao: string | null;
  readonly historico: string | null;
  readonly chance_1a5: number | null;
  readonly aportes_nomeados: number;
  readonly comentario: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

// ================================================================ 1. RÓTULOS

/** Rótulo de um id em qualquer lista de `perguntas.ts`; o id cru se não achar. */
export function rotuloDe(
  lista: ReadonlyArray<readonly [string, string]>,
  id: string | null | undefined,
): string {
  if (!id) return "não informado";
  return lista.find(([v]) => v === id)?.[1] ?? id;
}

/** Título da ficha de aporte (as fichas têm forma `{id, titulo}`, não tupla). */
export function tituloDoAporte(id: string): string {
  return APORTES.find((a) => a.id === id)?.titulo ?? id;
}

// =============================================================== 2. MÉTRICAS

export type Contagem = { readonly id: string; readonly rotulo: string; readonly total: number };

export type Metricas = {
  /** Quantas pessoas responderam. */
  readonly total: number;
  /** Quantas voltaram para corrigir (updated_at > created_at). */
  readonly corrigidas: number;
  /** Escore médio — um número para acompanhar a "temperatura" da campanha. */
  readonly escoreMedio: number;
  /** "Com quem eu sento?" — a contagem por faixa, na ordem da régua. */
  readonly porFaixa: readonly Contagem[];
  /** Logística: quantas pessoas esperar em cada dia. `ambas` conta nos dois. */
  readonly dia25PortoVelho: number;
  readonly dia27Cacoal: number;
  readonly soOnline: number;
  readonly semDiaDefinido: number;
  /** Quem é o público — por vínculo, do maior para o menor. */
  readonly porVinculo: readonly Contagem[];
  /** Onde a rede vai crescer — eixos mais marcados. */
  readonly porEet: readonly Contagem[];
  /** O que as pessoas toparam ASSUMIR — o dado mais acionável do formulário. */
  readonly porCompromisso: readonly Contagem[];
  /** Ativos nomeados (com o "qual?" preenchido): o sinal caro, somado. */
  readonly aportesNomeados: number;
  /** Quantas pessoas já colaboraram com a rede (formal ou informal). */
  readonly jaColaboraram: number;
};

const ORDEM_FAIXAS: readonly Faixa[] = ["prioritario", "promissor", "acompanhar", "informativo"];

function contar(
  ids: readonly string[],
  rotular: (id: string) => string,
): Contagem[] {
  const mapa = new Map<string, number>();
  for (const id of ids) mapa.set(id, (mapa.get(id) ?? 0) + 1);
  return [...mapa.entries()]
    .map(([id, total]) => ({ id, rotulo: rotular(id), total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

export function calcularMetricas(linhas: readonly RespostaPainel[]): Metricas {
  const total = linhas.length;
  const somaEscore = linhas.reduce((s, l) => s + l.escore_intencao, 0);

  return {
    total,
    corrigidas: linhas.filter((l) => l.updated_at > l.created_at).length,
    escoreMedio: total ? Math.round(somaEscore / total) : 0,
    porFaixa: ORDEM_FAIXAS.map((f) => ({
      id: f,
      rotulo: ROTULO_FAIXA[f],
      total: linhas.filter((l) => l.faixa === f).length,
    })),
    // `ambas` conta NOS DOIS dias — a pergunta da métrica é "quantas cadeiras",
    // e quem vai aos dois ocupa cadeira nos dois.
    dia25PortoVelho: linhas.filter((l) => l.sede === "porto_velho" || l.sede === "ambas").length,
    dia27Cacoal: linhas.filter((l) => l.sede === "cacoal" || l.sede === "ambas").length,
    soOnline: linhas.filter((l) => l.sede === "so_online").length,
    semDiaDefinido: linhas.filter((l) => l.sede === "indefinido").length,
    porVinculo: contar(
      linhas.map((l) => l.vinculo),
      (id) => rotuloDe(VINCULOS, id),
    ),
    porEet: contar(
      linhas.flatMap((l) => l.eets),
      (id) => rotuloDe(EETS, id),
    ),
    porCompromisso: contar(
      linhas.flatMap((l) => l.compromissos),
      (id) => rotuloDe(COMPROMISSOS, id),
    ),
    aportesNomeados: linhas.reduce((s, l) => s + (l.aportes_nomeados ?? 0), 0),
    jaColaboraram: linhas.filter((l) => l.historico === "formal" || l.historico === "informal").length,
  };
}

// ================================================================ 3. FILTROS

export type Filtros = {
  readonly busca: string;
  readonly faixa: Faixa | "";
  readonly sede: string;
};

/** Sem acento e minúsculas — mesma régua da busca do resultado de IC. */
function chave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function filtrarLinhas(
  linhas: readonly RespostaPainel[],
  filtros: Filtros,
): RespostaPainel[] {
  const termo = chave(filtros.busca.trim());
  return linhas.filter((l) => {
    if (filtros.faixa && l.faixa !== filtros.faixa) return false;
    if (filtros.sede && l.sede !== filtros.sede) return false;
    if (!termo) return true;
    return (
      chave(l.nome).includes(termo) ||
      chave(l.instituicao).includes(termo) ||
      chave(l.email).includes(termo) ||
      chave(l.protocolo ?? "").includes(termo)
    );
  });
}

// ==================================================================== 4. CSV

/**
 * As linhas prontas para `toCsv` (platform/api.ts) — cabeçalho em português e
 * TODO id traduzido para rótulo. O CSV é o que a coordenação abre no Excel e
 * repassa a quem nunca viu este código: id cru ali é dado perdido.
 *
 * Os aportes saem como "Título: detalhe" (ex.: "Base de dados: Herbário HFSL")
 * porque é o par que carrega o sinal — o título sozinho é só uma caixa marcada.
 */
export function linhasParaCsv(
  linhas: readonly RespostaPainel[],
): Array<Record<string, string | number | null>> {
  return linhas.map((l) => ({
    Protocolo: l.protocolo ?? "",
    Nome: l.nome,
    "E-mail": l.email,
    Telefone: l.telefone ?? "",
    "Canal preferido": rotuloDe(CANAIS, l.canal),
    "Instituição": l.instituicao,
    UF: l.uf ?? "",
    Lattes: l.lattes ?? "",
    ORCID: l.orcid ?? "",
    "Vínculo": rotuloDe(VINCULOS, l.vinculo),
    "Interesse na rede": rotuloDe(INTERESSES, l.interesse),
    "Dia do evento": rotuloDe(SEDES, l.sede),
    Escore: l.escore_intencao,
    Faixa: ROTULO_FAIXA[l.faixa] ?? l.faixa,
    Eixos: l.eets.map((e) => rotuloDe(EETS, e)).join(" | "),
    "Formas de contribuição": l.formas.map((f) => rotuloDe(FORMAS, f)).join(" | "),
    Aportes: l.aportes
      .map((a) => {
        const detalhe = (l.aportes_detalhe[a] ?? "").trim();
        return detalhe ? `${tituloDoAporte(a)}: ${detalhe}` : tituloDoAporte(a);
      })
      .join(" | "),
    "Aportes nomeados": l.aportes_nomeados,
    Iniciativas: l.iniciativas.map((i) => rotuloDe(INICIATIVAS, i)).join(" | "),
    Compromissos: l.compromissos.map((c) => rotuloDe(COMPROMISSOS, c)).join(" | "),
    Disponibilidade: rotuloDe(DISPONIBILIDADES, l.disponibilidade),
    Prazo: rotuloDe(HORIZONTES, l.horizonte),
    "Poder de decisão": rotuloDe(DECISOES, l.decisao),
    "Colaboração anterior": rotuloDe(HISTORICOS, l.historico),
    "Chance (1 a 5)": l.chance_1a5 ?? "",
    "Comentário": l.comentario ?? "",
    "Enviada em": l.created_at,
    "Atualizada em": l.updated_at,
  }));
}
