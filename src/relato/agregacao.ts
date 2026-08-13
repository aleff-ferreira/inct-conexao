/**
 * ============================================================================
 *  Agregação do ciclo inteiro — os números do painel da coordenação
 * ============================================================================
 *  `agregarCiclo()` é PURA: recebe os arrays que a seção 8 do `api.ts` lê e
 *  devolve `DadosDoPainel` — sem rede, sem `Date.now()`, sem estado. É a única
 *  função que sabe transformar 209 relatos em métrica, e é testável a seco.
 *  `carregarDadosDoPainel()` é a casca async, e é SÓ isso.
 *
 *  AS REGRAS DE HONESTIDADE (docs/relato-anual.md), TRADUZIDAS EM CÓDIGO
 *  ---------------------------------------------------------------------
 *   • NENHUM percentual de meta declarado sai daqui. Onde há número pactuado
 *     com correspondência DIRETA e documentável, sai o PAR (declarado,
 *     pactuado) — quem lê compara; nós não fingimos medir o que não medimos.
 *     Os pactuados sem correspondência ficam LISTADOS em
 *     `pactuados.semMedicaoAutomatica`, porque sumir com eles seria mentir
 *     por omissão.
 *   • Produção fora do período (`ciclo_competencia_id` nulo) NUNCA entra em
 *     contagem — sai em `foraDoPeriodo`, à parte, como a
 *     `v_itens_fora_do_periodo` faz no banco.
 *   • JCR sai como MEDIANA e faixa, nunca "impacto médio": média de fator de
 *     impacto é distorcida pela cauda e é exatamente o número que uma
 *     auditoria derrubaria.
 *   • Satisfação: média SÓ acompanhada do n ("média de 3 respostas" é uma
 *     informação; "média 4,7" solta é propaganda).
 *   • O ajuste do líder VENCE o contador automático (mesma regra de
 *     `valorDaLinha` que a tela do laboratório usa) e a divergência aparece:
 *     `laboratoriosComAjuste` nunca é escondido.
 *   • Todo o pacote carrega `recorte` — quantos enviaram, quantos estão em
 *     rascunho, quantos calaram. Número parcial sem rótulo de parcialidade é
 *     mentira por omissão; a frase pronta está em `recorte.frase`.
 *
 *  SEM `Date.now()` — de propósito: a hora de geração é da TELA (que a exibe
 *  ao lado do botão de atualizar), não do dado. Mesma entrada, mesma saída.
 * ============================================================================
 */
import { supabase } from "../platform/supabaseClient";
import {
  erroDeRelato,
  listarAdesoesDoCiclo,
  listarFatosDoCiclo,
  listarLaboratorios,
  listarMembrosDoCiclo,
  listarProducoesDoCiclo,
  listarRelatosDoCiclo,
  type ProducaoComVinculos,
} from "./api";
import {
  avisoDoAno1,
  objetivosDoCiclo,
  pactuadoPorChave,
  textoDoPactuado,
  todosOsPactuados,
} from "./config";
import {
  CATEGORIAS_FORMADO,
  DIFICULDADES_OPCOES,
  NIVEIS_ESTUDANTE,
  OPORTUNIDADES_OPCOES,
  contarEstudantesEFormados,
  tituloDoCsl,
  valorDaLinha,
  veiculoDoCsl,
  type CategoriaFormado,
  type ContadoresAjustes,
  type NivelEstudante,
  type OpcaoNarrativa,
  type RespostasComContadores,
} from "./narrativa";
import type {
  CicloMembro,
  Fato,
  FatoParticipante,
  FomentoItem,
  Laboratorio,
  PapelNoCiclo,
  PeriodoSituacao,
  Qualis,
  Relato,
  RelatoArquivo,
  RelatorioCiclo,
  TipoFato,
  TipoProducao,
} from "./types";

// ================================================================ ENTRADA ===

/** Tudo que a agregação precisa — os arrays crus, como o `api.ts` os lê. */
export type EntradaDaAgregacao = {
  ciclo: RelatorioCiclo;
  laboratorios: Laboratorio[];
  membros: CicloMembro[];
  relatos: Relato[];
  producoes: ProducaoComVinculos[];
  fatos: Fato[];
  adesoes: FatoParticipante[];
};

// ========================================================== TIPOS DE SAÍDA ==

/**
 * O rótulo de parcialidade que acompanha TODO número do painel. Sem hora de
 * geração de propósito (função pura) — a tela põe a hora ao exibir.
 */
export type Recorte = {
  cicloId: string;
  cicloSlug: string;
  cicloTitulo: string;
  periodoInicio: string;
  periodoFim: string;
  /** O denominador de tudo: membros ativos no roster. */
  membrosAtivos: number;
  relatosEnviados: number;
  relatosRascunho: number;
  membrosSemRelato: number;
  /** Relatos sem `membro_id` (conta criada fora do roster) — listados, não somidos. */
  relatosSemVinculoNoRoster: number;
  /** A frase pronta: "declarado até agora, N de M…". Toda tela a exibe. */
  frase: string;
};

export type CoberturaPorPapel = {
  papel: PapelNoCiclo;
  convidados: number;
  entraram: number;
  enviaram: number;
  rascunhos: number;
  nadaADeclarar: number;
  silenciosos: number;
};

export type CoberturaPorLaboratorio = {
  /** `null` agrega quem ainda não tem laboratório atribuído. */
  laboratorioId: string | null;
  sigla: string;
  nome: string;
  convidados: number;
  entraram: number;
  enviaram: number;
  rascunhos: number;
  nadaADeclarar: number;
  silenciosos: number;
};

export type ProducaoPorTipo = {
  tipo: TipoProducao;
  itens: number;
  nacionais: number;
  internacionais: number;
  /** Âmbito ainda não homologado pela coordenação — não é "nacional por padrão". */
  ambitoNaoDefinido: number;
  comAncoraResolvida: number;
};

export type DistribuicaoQualis = { faixa: Qualis; itens: number };

/** Mediana e faixa — NUNCA "impacto médio" (a média mente com cauda). */
export type ResumoJcr = {
  artigosComJcr: number;
  artigosSemJcr: number;
  mediana: number | null;
  minimo: number | null;
  maximo: number | null;
};

export type PeriodicoContado = { periodico: string; itens: number };

export type ProducaoDaRede = {
  /** Só o que CONTA: competência neste ciclo E pelo menos um vínculo. */
  contadas: ProducaoComVinculos[];
  totalContado: number;
  /** Itens com 2+ vínculos: coautorias internas que contam UMA vez. */
  compartilhadas: number;
  porTipo: ProducaoPorTipo[];
  /** Distribuição Qualis dos artigos contados (campo manual e opcional da 009). */
  qualis: DistribuicaoQualis[];
  artigosSemQualis: number;
  jcr: ResumoJcr;
  /** Top periódicos por `container-title` do CSL, decrescente (até 10). */
  topPeriodicos: PeriodicoContado[];
};

export type ItemForaDoCiclo = {
  entidade: "producao" | "fato";
  id: string;
  data: string | null;
  situacao: PeriodoSituacao;
  tipo: string;
  titulo: string;
};

export type LinhaRhAgregada<C extends string> = {
  chave: C;
  /** Somado dos fatos confirmados no período, rede inteira. */
  contadoAutomatico: number;
  /** Com o ajuste de cada líder aplicado (o ajuste VENCE o automático). */
  valorFinal: number;
  /** Em quantos laboratórios o líder sobrepôs ESTA linha. */
  laboratoriosComAjuste: number;
  contavel: boolean;
  porQueNao?: string;
};

export type RhDaRede = {
  estudantes: LinhaRhAgregada<NivelEstudante>[];
  formados: LinhaRhAgregada<CategoriaFormado>[];
  /** Modalidades de bolsa ativas sem nível de estudante (ITI, SET…) — listadas, não somidas. */
  bolsasSemNivel: string[];
  formacoesForaDosNiveis: number;
  /** Laboratórios cujo líder declarou QUALQUER ajuste — a divergência aparece. */
  laboratoriosComAjuste: number;
  laboratoriosComFatos: number;
};

export type FomentoPorAgencia = {
  agencia: string;
  processosCorrente: number;
  processosComplementar: number;
  valorCorrenteBrl: number;
  valorComplementarBrl: number;
  itensSemValor: number;
};

export type FomentoProcesso = {
  agencia: string;
  processo: string;
  titulo: string;
  valorBrl: number | null;
  complementar: boolean;
};

export type FomentoDaRede = {
  relatosComFomento: number;
  porAgencia: FomentoPorAgencia[];
  processos: FomentoProcesso[];
  /** Corrente ≠ complementar, SEPARADOS: o complementar é captação nova — o argumento de renovação. */
  totalCorrenteBrl: number;
  totalComplementarBrl: number;
  /** Itens sem valor declarado: fora das somas (nunca NaN), mas contados aqui. */
  itensSemValor: number;
};

export type ExtensaoDaRede = {
  relatosComExtensao: number;
  produtosPorTipo: Array<{ tipo: TipoProducao; itens: number }>;
};

export type ObjetivoConfirmacoes = { numero: number; relatosConfirmaram: number };

export type ObjetivosDaRede = {
  /** Um por objetivo do `config` (todos, inclusive os com zero). */
  confirmacoes: ObjetivoConfirmacoes[];
  /** O buraco que a coordenação precisa ver ANTES do relatório. */
  semNenhumaConfirmacao: number[];
  relatosQueResponderam: number;
};

export type SatisfacaoDaRede = {
  respondentes: number;
  distribuicao: Array<{ nota: number; membros: number }>;
  /** `null` quando ninguém respondeu — nunca divisão por zero. */
  media: number | null;
  /** Sempre com o n: "média de 3 respostas" é informação; "média 4,7" solta não é. */
  rotulo: string;
};

export type OpcaoContada = { id: string; rotulo: string; relatos: number };

export type PactuadoMedido = {
  chave: string;
  meta: number;
  oQue: string;
  unidade: string;
  /** Texto do pactuado ("até 50 expedições"), via `textoDoPactuado`. */
  pactuado: string;
  min: number | null;
  max: number | null;
  /** A contagem nossa — exibida AO LADO do pactuado, nunca como percentual. */
  declarado: number;
  /** Como o número foi obtido — a medição precisa ser contestável. */
  comoFoiMedido: string;
};

export type PactuadoSemMedicao = {
  chave: string;
  meta: number;
  oQue: string;
  unidade: string;
  pactuado: string;
};

export type PactuadosDoCiclo = {
  medidos: PactuadoMedido[];
  /** A honestidade é parte do contrato: o que não medimos fica listado, não somido. */
  semMedicaoAutomatica: PactuadoSemMedicao[];
  /** O aviso do 1º ano (nenhuma meta vence agora) — exibir antes de qualquer número. */
  aviso: string;
};

export type IndicadoresDeMembros = {
  membrosAtivos: number;
  comIndiceH: number;
  comCitacoes: number;
  comScholarId: number;
  /** Procedência dos números (010): scholar/openalex/manual/sem_fonte. */
  porFonte: Array<{ fonte: "scholar" | "openalex" | "manual" | "sem_fonte"; membros: number }>;
};

export type FatoPorTipo = {
  tipo: TipoFato;
  itens: number;
  laboratorios: number;
  adesoes: number;
  /** Estimativa (soma de `pessoas_alcancadas`). Exibir "aproximadamente". */
  pessoasAlcancadasEstimado: number;
};

export type FatosDaRede = {
  porTipo: FatoPorTipo[];
  confirmadosNoCiclo: number;
  /** Propostas aguardando o LLA — não contam até serem confirmadas. */
  propostosPendentes: number;
};

export type RedeDeInstituicoes = {
  /** Contado por ROR declarado — nunca digitado. */
  instituicoesComRor: number;
  paises: string[];
  ufs: string[];
  membrosSemRor: number;
};

/** O pacote completo que a tela recebe. Campo a campo no contrato da tarefa. */
export type DadosDoPainel = {
  recorte: Recorte;
  coberturaPorPapel: CoberturaPorPapel[];
  coberturaPorLaboratorio: CoberturaPorLaboratorio[];
  producao: ProducaoDaRede;
  foraDoPeriodo: ItemForaDoCiclo[];
  rh: RhDaRede;
  fomento: FomentoDaRede;
  extensao: ExtensaoDaRede;
  objetivos: ObjetivosDaRede;
  satisfacao: SatisfacaoDaRede;
  dificuldades: OpcaoContada[];
  oportunidades: OpcaoContada[];
  pactuados: PactuadosDoCiclo;
  indicadores: IndicadoresDeMembros;
  fatos: FatosDaRede;
  rede: RedeDeInstituicoes;
  /**
   * A entrada crua, intacta — é dela que `exportar.ts` monta CSVs e o
   * envelope §2.1 sem refazer leitura nenhuma (e respeitando `producao.
   * contadas` para nunca exportar item fora do período como se contasse).
   */
  brutos: EntradaDaAgregacao;
};

// ======================================================== FUNÇÕES INTERNAS ==

const STATUS_ENVIADO: ReadonlyArray<Relato["status"]> = ["enviado", "em_conferencia", "conferido"];

const ORDEM_QUALIS: readonly Qualis[] = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "B5", "C"];

const PAPEIS_ORDEM: readonly PapelNoCiclo[] = [
  "coordenacao",
  "cges",
  "lla",
  "pesquisador",
  "estudante",
  "tecnico_admin",
];

function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

/** Valor monetário utilizável: número finito ≥ 0. Qualquer outra coisa NÃO soma. */
function valorBrlValido(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function contarOpcoes(
  listas: Array<string[] | undefined>,
  opcoes: readonly OpcaoNarrativa[],
): OpcaoContada[] {
  const porId = new Map<string, number>();
  for (const lista of listas) {
    for (const id of lista ?? []) porId.set(id, (porId.get(id) ?? 0) + 1);
  }
  const conhecidos = new Set(opcoes.map((o) => o.id));
  const saida: OpcaoContada[] = opcoes.map((o) => ({
    id: o.id,
    rotulo: o.rotulo,
    relatos: porId.get(o.id) ?? 0,
  }));
  // Id fora da lista (config futuro, dado antigo): aparece com o próprio id
  // como rótulo — sumir com ele seria perder resposta dada.
  for (const [id, n] of porId) {
    if (!conhecidos.has(id)) saida.push({ id, rotulo: id, relatos: n });
  }
  return saida;
}

function tituloDaProducao(p: ProducaoComVinculos): string {
  return tituloDoCsl(p.producao.metadados) ?? p.producao.ancora_valor;
}

// ============================================================== AGREGAÇÃO ===

export function agregarCiclo(entrada: EntradaDaAgregacao): DadosDoPainel {
  const { ciclo, laboratorios, membros, relatos, producoes, fatos, adesoes } = entrada;

  const ativos = membros.filter((m) => m.ativo);
  const relatoPorMembro = new Map<string, Relato>();
  for (const r of relatos) {
    if (r.membro_id) relatoPorMembro.set(r.membro_id, r);
  }

  // ------------------------------------------------------------- recorte ----
  const relatosEnviados = relatos.filter((r) => STATUS_ENVIADO.includes(r.status)).length;
  const relatosRascunho = relatos.filter((r) => r.status === "rascunho").length;
  const membrosSemRelato = ativos.filter((m) => !relatoPorMembro.has(m.id)).length;
  const relatosSemVinculoNoRoster = relatos.filter((r) => !r.membro_id).length;

  const recorte: Recorte = {
    cicloId: ciclo.id,
    cicloSlug: ciclo.slug,
    cicloTitulo: ciclo.titulo,
    periodoInicio: ciclo.periodo_inicio,
    periodoFim: ciclo.periodo_fim,
    membrosAtivos: ativos.length,
    relatosEnviados,
    relatosRascunho,
    membrosSemRelato,
    relatosSemVinculoNoRoster,
    frase:
      `Declarado até agora: ${relatosEnviados} de ${ativos.length} membros enviaram o relato` +
      ` (${relatosRascunho} em rascunho, ${membrosSemRelato} sem relato).` +
      ` Números parciais: a coleta segue aberta.`,
  };

  // ------------------------------------------------------------ cobertura ---
  function linhaDeCobertura(grupo: CicloMembro[]) {
    let entraram = 0;
    let enviaram = 0;
    let rascunhos = 0;
    let nadaADeclarar = 0;
    let silenciosos = 0;
    for (const m of grupo) {
      if (m.primeiro_acesso_em) entraram += 1;
      const r = relatoPorMembro.get(m.id);
      if (!r) {
        silenciosos += 1;
        continue;
      }
      if (STATUS_ENVIADO.includes(r.status)) enviaram += 1;
      if (r.status === "rascunho") rascunhos += 1;
      if (r.nada_a_declarar) nadaADeclarar += 1;
    }
    return { convidados: grupo.length, entraram, enviaram, rascunhos, nadaADeclarar, silenciosos };
  }

  const coberturaPorPapel: CoberturaPorPapel[] = PAPEIS_ORDEM.filter((papel) =>
    ativos.some((m) => m.papel === papel),
  ).map((papel) => ({ papel, ...linhaDeCobertura(ativos.filter((m) => m.papel === papel)) }));

  const labsOrdenados = [...laboratorios].sort((a, b) => a.ordem - b.ordem);
  const coberturaPorLaboratorio: CoberturaPorLaboratorio[] = labsOrdenados.map((lab) => ({
    laboratorioId: lab.id,
    sigla: lab.sigla,
    nome: lab.nome,
    ...linhaDeCobertura(ativos.filter((m) => m.laboratorio_id === lab.id)),
  }));
  const semLab = ativos.filter((m) => !m.laboratorio_id);
  if (semLab.length) {
    coberturaPorLaboratorio.push({
      laboratorioId: null,
      sigla: "",
      nome: "Sem laboratório atribuído",
      ...linhaDeCobertura(semLab),
    });
  }

  // ------------------------------------------------------------- produção ---
  // A regra da v_producao_por_tipo, espelhada: conta na CANÔNICA, com pelo
  // menos um vínculo, e SÓ com competência NESTE ciclo. Fora do período não
  // entra em contagem nenhuma — vai para `foraDoPeriodo`.
  const contadas = producoes.filter(
    (p) => p.producao.ciclo_competencia_id === ciclo.id && p.vinculos.length > 0,
  );

  const porTipoMapa = new Map<TipoProducao, ProducaoPorTipo>();
  for (const { producao } of contadas) {
    const atual =
      porTipoMapa.get(producao.tipo) ??
      ({
        tipo: producao.tipo,
        itens: 0,
        nacionais: 0,
        internacionais: 0,
        ambitoNaoDefinido: 0,
        comAncoraResolvida: 0,
      } as ProducaoPorTipo);
    atual.itens += 1;
    if (producao.ambito === "nacional") atual.nacionais += 1;
    else if (producao.ambito === "internacional") atual.internacionais += 1;
    else atual.ambitoNaoDefinido += 1;
    if (producao.ancora_resolvida) atual.comAncoraResolvida += 1;
    porTipoMapa.set(producao.tipo, atual);
  }
  const porTipo = [...porTipoMapa.values()].sort((a, b) => b.itens - a.itens);

  const artigos = contadas.filter((p) => p.producao.tipo === "artigo_periodico");
  const qualis: DistribuicaoQualis[] = ORDEM_QUALIS.map((faixa) => ({
    faixa,
    itens: artigos.filter((a) => a.producao.qualis === faixa).length,
  })).filter((l) => l.itens > 0);
  const artigosSemQualis = artigos.filter((a) => !a.producao.qualis).length;

  const jcrValores = artigos
    .map((a) => a.producao.jcr)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const jcr: ResumoJcr = {
    artigosComJcr: jcrValores.length,
    artigosSemJcr: artigos.length - jcrValores.length,
    mediana: mediana(jcrValores),
    minimo: jcrValores.length ? Math.min(...jcrValores) : null,
    maximo: jcrValores.length ? Math.max(...jcrValores) : null,
  };

  const porPeriodico = new Map<string, number>();
  for (const { producao } of contadas) {
    const veiculo = veiculoDoCsl(producao.metadados);
    if (veiculo) porPeriodico.set(veiculo, (porPeriodico.get(veiculo) ?? 0) + 1);
  }
  const topPeriodicos: PeriodicoContado[] = [...porPeriodico.entries()]
    .map(([periodico, itens]) => ({ periodico, itens }))
    .sort((a, b) => b.itens - a.itens || a.periodico.localeCompare(b.periodico))
    .slice(0, 10);

  const producao: ProducaoDaRede = {
    contadas,
    totalContado: contadas.length,
    compartilhadas: contadas.filter((p) => p.vinculos.length > 1).length,
    porTipo,
    qualis,
    artigosSemQualis,
    jcr,
    topPeriodicos,
  };

  // ------------------------------------------------------- fora do período --
  // Espelho da v_itens_fora_do_periodo: competência NULA = fora de todo
  // período conhecido. Lista à parte; nunca soma.
  const foraDoPeriodo: ItemForaDoCiclo[] = [
    ...producoes
      .filter((p) => p.producao.ciclo_competencia_id === null)
      .map((p) => ({
        entidade: "producao" as const,
        id: p.producao.id,
        data: p.producao.data_referencia,
        situacao: p.producao.periodo_situacao,
        tipo: p.producao.tipo as string,
        titulo: tituloDaProducao(p),
      })),
    ...fatos
      .filter((f) => f.ciclo_competencia_id === null)
      .map((f) => ({
        entidade: "fato" as const,
        id: f.id,
        data: f.ocorrido_em,
        situacao: f.periodo_situacao,
        tipo: f.tipo as string,
        titulo: f.titulo,
      })),
  ];

  // ------------------------------------------------------------------- RH ---
  // REUSA `contarEstudantesEFormados` (narrativa.ts) laboratório a
  // laboratório, aplica o ajuste do líder daquele laboratório (o ajuste
  // VENCE) e soma a rede. O recorte de fatos é o MESMO da Conferência do
  // laboratório: confirmados, com competência neste ciclo.
  const fatosNoCiclo = fatos.filter(
    (f) => f.status === "confirmado" && f.ciclo_competencia_id === ciclo.id,
  );
  const fatosPorLab = new Map<string, Fato[]>();
  for (const f of fatosNoCiclo) {
    const lista = fatosPorLab.get(f.laboratorio_id) ?? [];
    lista.push(f);
    fatosPorLab.set(f.laboratorio_id, lista);
  }

  function ajustesDoLaboratorio(labId: string): ContadoresAjustes | undefined {
    // O relato que carrega os ajustes é o do LÍDER: membro com papel 'lla'
    // naquele laboratório, ou (rede de segurança) o dono apontado em
    // `laboratorios.lla_user_id`.
    const lider = membros.find((m) => m.laboratorio_id === labId && m.papel === "lla" && m.ativo);
    let relatoDoLider = lider ? relatoPorMembro.get(lider.id) : undefined;
    if (!relatoDoLider) {
      const lab = laboratorios.find((l) => l.id === labId);
      if (lab?.lla_user_id) relatoDoLider = relatos.find((r) => r.user_id === lab.lla_user_id);
    }
    return (relatoDoLider?.respostas as RespostasComContadores | undefined)?.contadores;
  }

  const estudantesAgregado = new Map<NivelEstudante, LinhaRhAgregada<NivelEstudante>>(
    NIVEIS_ESTUDANTE.map((chave) => [
      chave,
      { chave, contadoAutomatico: 0, valorFinal: 0, laboratoriosComAjuste: 0, contavel: true },
    ]),
  );
  const formadosAgregado = new Map<CategoriaFormado, LinhaRhAgregada<CategoriaFormado>>(
    CATEGORIAS_FORMADO.map((chave) => [
      chave,
      { chave, contadoAutomatico: 0, valorFinal: 0, laboratoriosComAjuste: 0, contavel: true },
    ]),
  );
  const bolsasSemNivel = new Set<string>();
  let formacoesForaDosNiveis = 0;
  let laboratoriosComAjuste = 0;

  for (const [labId, fatosDoLab] of fatosPorLab) {
    const contagem = contarEstudantesEFormados(fatosDoLab);
    const ajustes = ajustesDoLaboratorio(labId);
    if (ajustes && (Object.keys(ajustes.estudantes ?? {}).length || Object.keys(ajustes.formados ?? {}).length)) {
      laboratoriosComAjuste += 1;
    }
    for (const linha of contagem.estudantes) {
      const alvo = estudantesAgregado.get(linha.chave);
      if (!alvo) continue;
      const ajuste = ajustes?.estudantes?.[linha.chave];
      alvo.contadoAutomatico += linha.contado;
      alvo.valorFinal += valorDaLinha(linha.contado, ajuste);
      if (ajuste) alvo.laboratoriosComAjuste += 1;
    }
    for (const linha of contagem.formados) {
      const alvo = formadosAgregado.get(linha.chave);
      if (!alvo) continue;
      const ajuste = ajustes?.formados?.[linha.chave];
      alvo.contadoAutomatico += linha.contado;
      alvo.valorFinal += valorDaLinha(linha.contado, ajuste);
      if (ajuste) alvo.laboratoriosComAjuste += 1;
      if (!linha.contavel) {
        alvo.contavel = false;
        if (linha.porQueNao) alvo.porQueNao = linha.porQueNao;
      }
    }
    for (const m of contagem.bolsasSemNivel) bolsasSemNivel.add(m);
    formacoesForaDosNiveis += contagem.formacoesForaDosNiveis;
  }
  // TCC não é contável mesmo sem nenhum fato — a linha explica em vez de fingir zero.
  const linhaTcc = formadosAgregado.get("TCC");
  if (linhaTcc && fatosPorLab.size === 0) {
    const modelo = contarEstudantesEFormados([]).formados.find((l) => l.chave === "TCC");
    linhaTcc.contavel = false;
    if (modelo?.porQueNao) linhaTcc.porQueNao = modelo.porQueNao;
  }

  const rh: RhDaRede = {
    estudantes: NIVEIS_ESTUDANTE.map((c) => estudantesAgregado.get(c)!),
    formados: CATEGORIAS_FORMADO.map((c) => formadosAgregado.get(c)!),
    bolsasSemNivel: [...bolsasSemNivel].sort(),
    formacoesForaDosNiveis,
    laboratoriosComAjuste,
    laboratoriosComFatos: fatosPorLab.size,
  };

  // -------------------------------------------------------------- fomento ---
  const porAgencia = new Map<string, FomentoPorAgencia>();
  const processos: FomentoProcesso[] = [];
  let relatosComFomento = 0;
  let totalCorrenteBrl = 0;
  let totalComplementarBrl = 0;
  let itensSemValor = 0;

  for (const r of relatos) {
    const itens: FomentoItem[] = Array.isArray(r.respostas?.fomento) ? r.respostas.fomento : [];
    if (itens.length) relatosComFomento += 1;
    for (const item of itens) {
      const agencia = (item.agencia ?? "").trim() || "Agência não informada";
      const complementar = item.complementar === true;
      const valor = valorBrlValido(item.valor_brl) ? item.valor_brl : null;
      const linha =
        porAgencia.get(agencia) ??
        ({
          agencia,
          processosCorrente: 0,
          processosComplementar: 0,
          valorCorrenteBrl: 0,
          valorComplementarBrl: 0,
          itensSemValor: 0,
        } as FomentoPorAgencia);
      if (complementar) linha.processosComplementar += 1;
      else linha.processosCorrente += 1;
      if (valor === null) {
        linha.itensSemValor += 1;
        itensSemValor += 1;
      } else if (complementar) {
        linha.valorComplementarBrl += valor;
        totalComplementarBrl += valor;
      } else {
        linha.valorCorrenteBrl += valor;
        totalCorrenteBrl += valor;
      }
      porAgencia.set(agencia, linha);
      processos.push({
        agencia,
        processo: (item.processo ?? "").trim(),
        titulo: (item.titulo ?? "").trim(),
        valorBrl: valor,
        complementar,
      });
    }
  }

  const fomento: FomentoDaRede = {
    relatosComFomento,
    porAgencia: [...porAgencia.values()].sort(
      (a, b) =>
        b.valorCorrenteBrl + b.valorComplementarBrl - (a.valorCorrenteBrl + a.valorComplementarBrl) ||
        a.agencia.localeCompare(b.agencia),
    ),
    processos,
    totalCorrenteBrl,
    totalComplementarBrl,
    itensSemValor,
  };

  // ------------------------------------------------------------- extensão ---
  const relatosComExtensao = relatos.filter((r) => r.respostas?.extensao?.tem === true);
  const produtosExtensao = new Map<TipoProducao, number>();
  for (const r of relatosComExtensao) {
    for (const tipo of r.respostas.extensao?.produtos ?? []) {
      produtosExtensao.set(tipo, (produtosExtensao.get(tipo) ?? 0) + 1);
    }
  }
  const extensao: ExtensaoDaRede = {
    relatosComExtensao: relatosComExtensao.length,
    produtosPorTipo: [...produtosExtensao.entries()]
      .map(([tipo, itens]) => ({ tipo, itens }))
      .sort((a, b) => b.itens - a.itens),
  };

  // ------------------------------------------------------------ objetivos ---
  const universo = objetivosDoCiclo(ciclo.config).map((o) => o.n);
  const universoFinal = universo.length ? universo : Array.from({ length: 43 }, (_, i) => i + 1);
  const confirmacoesPorObjetivo = new Map<number, number>();
  let relatosQueResponderam = 0;
  for (const r of relatos) {
    const confirmados = Array.isArray(r.respostas?.objetivos_confirmados)
      ? r.respostas.objetivos_confirmados
      : [];
    if (confirmados.length) relatosQueResponderam += 1;
    for (const n of new Set(confirmados)) {
      confirmacoesPorObjetivo.set(n, (confirmacoesPorObjetivo.get(n) ?? 0) + 1);
    }
  }
  const confirmacoes: ObjetivoConfirmacoes[] = universoFinal.map((numero) => ({
    numero,
    relatosConfirmaram: confirmacoesPorObjetivo.get(numero) ?? 0,
  }));
  // Número confirmado fora do universo do config (defensivo): aparece também.
  for (const [numero, n] of confirmacoesPorObjetivo) {
    if (!universoFinal.includes(numero)) confirmacoes.push({ numero, relatosConfirmaram: n });
  }
  const objetivos: ObjetivosDaRede = {
    confirmacoes,
    semNenhumaConfirmacao: confirmacoes
      .filter((c) => c.relatosConfirmaram === 0)
      .map((c) => c.numero)
      .sort((a, b) => a - b),
    relatosQueResponderam,
  };

  // ----------------------------------------------------------- satisfação ---
  const notas = ativos
    .map((m) => m.satisfacao)
    .filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
  const media = notas.length ? notas.reduce((s, v) => s + v, 0) / notas.length : null;
  const satisfacao: SatisfacaoDaRede = {
    respondentes: notas.length,
    distribuicao: [1, 2, 3, 4, 5].map((nota) => ({
      nota,
      membros: notas.filter((v) => v === nota).length,
    })),
    media,
    rotulo:
      notas.length === 0
        ? "Ninguém respondeu a pergunta de satisfação até agora."
        : `Média de ${notas.length} resposta${notas.length === 1 ? "" : "s"}, ` +
          `${ativos.length - notas.length} de ${ativos.length} membros ainda não responderam.`,
  };

  // --------------------------------------- dificuldades e oportunidades -----
  const dificuldades = contarOpcoes(
    relatos.map((r) => r.narrativas?.dificuldades_categorias),
    DIFICULDADES_OPCOES,
  );
  const oportunidades = contarOpcoes(
    relatos.map((r) => r.narrativas?.oportunidades_categorias),
    OPORTUNIDADES_OPCOES,
  );

  // ---------------------------------------------------------------- fatos ---
  const adesoesPorFato = new Map<string, number>();
  for (const a of adesoes) adesoesPorFato.set(a.fato_id, (adesoesPorFato.get(a.fato_id) ?? 0) + 1);

  const fatosPorTipoMapa = new Map<TipoFato, FatoPorTipo>();
  for (const f of fatosNoCiclo) {
    const linha =
      fatosPorTipoMapa.get(f.tipo) ??
      ({ tipo: f.tipo, itens: 0, laboratorios: 0, adesoes: 0, pessoasAlcancadasEstimado: 0 } as FatoPorTipo);
    linha.itens += 1;
    linha.adesoes += adesoesPorFato.get(f.id) ?? 0;
    const alcancadas = (f.payload as Record<string, unknown>).pessoas_alcancadas;
    if (typeof alcancadas === "number" && Number.isFinite(alcancadas)) {
      linha.pessoasAlcancadasEstimado += alcancadas;
    }
    fatosPorTipoMapa.set(f.tipo, linha);
  }
  for (const [tipo, linha] of fatosPorTipoMapa) {
    linha.laboratorios = new Set(
      fatosNoCiclo.filter((f) => f.tipo === tipo).map((f) => f.laboratorio_id),
    ).size;
  }
  const fatosDaRede: FatosDaRede = {
    porTipo: [...fatosPorTipoMapa.values()].sort((a, b) => b.itens - a.itens),
    confirmadosNoCiclo: fatosNoCiclo.length,
    propostosPendentes: fatos.filter((f) => f.status === "proposto").length,
  };

  // ----------------------------------------------------------------- rede ---
  const rors = new Set<string>();
  const paises = new Set<string>();
  const ufs = new Set<string>();
  let membrosSemRor = 0;
  for (const m of ativos) {
    if (m.instituicao_ror) rors.add(m.instituicao_ror);
    else membrosSemRor += 1;
    if (m.pais_iso2) paises.add(m.pais_iso2);
    if (m.uf) ufs.add(m.uf);
  }
  for (const f of fatosNoCiclo) {
    if (f.tipo !== "parceria") continue;
    const payload = f.payload as Record<string, unknown>;
    if (typeof payload.ror_id === "string" && payload.ror_id) rors.add(payload.ror_id);
    const pais = typeof payload.pais_iso2 === "string" && payload.pais_iso2 ? payload.pais_iso2 : "BR";
    paises.add(pais);
  }
  const rede: RedeDeInstituicoes = {
    instituicoesComRor: rors.size,
    paises: [...paises].sort(),
    ufs: [...ufs].sort(),
    membrosSemRor,
  };

  // ------------------------------------------------------------ pactuados ---
  // SÓ correspondências DIRETAS e defensáveis viram par (declarado, pactuado).
  // Tudo o mais fica em `semMedicaoAutomatica` — inventar mapeamento
  // produção→meta que não existe nos dados seria a mentira mais cara deste
  // módulo. NENHUM percentual é calculado aqui.
  const config = ciclo.config;
  const medidos: PactuadoMedido[] = [];

  function medir(chave: string, declarado: number, comoFoiMedido: string): void {
    const p = pactuadoPorChave(config, chave);
    if (!p) return;
    medidos.push({
      chave: p.chave,
      meta: p.meta,
      oQue: p.oQue,
      unidade: p.unidade,
      pactuado: textoDoPactuado(p),
      min: p.min,
      max: p.max,
      declarado,
      comoFoiMedido,
    });
  }

  const formadosFinais = new Map(rh.formados.map((l) => [l.chave, l.valorFinal]));
  medir(
    "M07.1",
    fatosNoCiclo.filter((f) => f.tipo === "expedicao").length,
    "Contagem dos fatos do tipo expedição confirmados com competência neste ciclo (uma expedição conta uma vez, com N participantes).",
  );
  medir(
    "M23.1",
    formadosFinais.get("IC") ?? 0,
    "Formações concluídas no período nos níveis ICJ e IC (somados, como a própria meta pactua) com os ajustes declarados pelos líderes aplicados.",
  );
  medir(
    "M23.2",
    formadosFinais.get("MS") ?? 0,
    "Formações de mestrado concluídas no período, com os ajustes declarados pelos líderes aplicados.",
  );
  medir(
    "M23.3",
    formadosFinais.get("DR") ?? 0,
    "Formações de doutorado concluídas no período, com os ajustes declarados pelos líderes aplicados.",
  );
  medir(
    "M24.6",
    rede.paises.length,
    "Países distintos declarados no roster (país da instituição) e nas parcerias confirmadas, contados, nunca digitados. Tende a vir MENOR que o resumo da proposta; a diferença se explica, não se maquia.",
  );

  const chavesMedidas = new Set(medidos.map((m) => m.chave));
  const semMedicaoAutomatica: PactuadoSemMedicao[] = todosOsPactuados(config)
    .filter((p) => !chavesMedidas.has(p.chave))
    .map((p) => ({
      chave: p.chave,
      meta: p.meta,
      oQue: p.oQue,
      unidade: p.unidade,
      pactuado: textoDoPactuado(p),
    }));

  const pactuados: PactuadosDoCiclo = {
    medidos,
    semMedicaoAutomatica,
    aviso: avisoDoAno1(config),
  };

  // ----------------------------------------------------------- indicadores --
  const comNumero = ativos.filter((m) => m.indice_h !== null || m.total_citacoes !== null);
  const fontes: Array<"scholar" | "openalex" | "manual" | "sem_fonte"> = [
    "scholar",
    "openalex",
    "manual",
    "sem_fonte",
  ];
  const indicadores: IndicadoresDeMembros = {
    membrosAtivos: ativos.length,
    comIndiceH: ativos.filter((m) => m.indice_h !== null).length,
    comCitacoes: ativos.filter((m) => m.total_citacoes !== null).length,
    comScholarId: ativos.filter((m) => m.scholar_id !== null).length,
    porFonte: fontes
      .map((fonte) => ({
        fonte,
        membros: comNumero.filter((m) => (m.indicadores_fonte ?? "sem_fonte") === fonte).length,
      }))
      .filter((l) => l.membros > 0),
  };

  return {
    recorte,
    coberturaPorPapel,
    coberturaPorLaboratorio,
    producao,
    foraDoPeriodo,
    rh,
    fomento,
    extensao,
    objetivos,
    satisfacao,
    dificuldades,
    oportunidades,
    pactuados,
    indicadores,
    fatos: fatosDaRede,
    rede,
    brutos: entrada,
  };
}

// ============================================================ CASCA ASYNC ===

/**
 * Lê o ciclo inteiro (seção 8 do `api.ts` — tudo paginado) e agrega. Não checa
 * papel: a RLS decide. Se quem chama não é coordenação/CGES, as leituras voltam
 * recortadas ao próprio (sem erro) — por isso a TELA barra pelo papel ANTES de
 * chamar isto, como o PainelRelatorio já faz. Erros de RLS/rede chegam como
 * exceção já traduzida por `erroDeRelato` (api.ts).
 */
export async function carregarDadosDoPainel(ciclo: RelatorioCiclo): Promise<DadosDoPainel> {
  const [laboratorios, membros, relatos, producoes, fatos, adesoes] = await Promise.all([
    listarLaboratorios(ciclo.id),
    listarMembrosDoCiclo(ciclo.id),
    listarRelatosDoCiclo(ciclo.id),
    listarProducoesDoCiclo(ciclo.id),
    listarFatosDoCiclo(ciclo.id),
    listarAdesoesDoCiclo(ciclo.id),
  ]);
  return agregarCiclo({ ciclo, laboratorios, membros, relatos, producoes, fatos, adesoes });
}

// ======================================= DOCUMENTOS ANEXADOS AOS RELATOS ===
/**
 * Todos os arquivos anexados a RELATOS deste ciclo — a leitura que faz o anexo
 * deixar de ser buraco negro: sem esta lista, o documento .docx que o
 * pesquisador subiu (011) existiria no bucket e a coordenação não teria como
 * achá-lo nem baixá-lo.
 *
 * Está aqui, e não em `api.ts`, porque `listarArquivos` de lá lê por
 * relato/fato (a tela do membro) e esta leitura é do PAINEL — mesmo padrão das
 * demais leituras de ciclo inteiro que alimentam a agregação. A RLS
 * (`arquivos_read`, 005) decide o alcance: para a coordenação voltam todos os
 * arquivos do ciclo; para os demais, só os próprios.
 *
 * PAGINADA como a seção 8 do `api.ts`: o PostgREST corta em 1000 linhas SEM
 * ERRO, e 209 pessoas × até 12 anexos passam disso com folga. O `!inner` em
 * `relatos` é só filtro de ciclo e é descartado da saída; anexos de FATOS não
 * entram — o pedido é o documento do relato individual.
 */
export async function listarArquivosDosRelatosDoCiclo(cicloId: string): Promise<RelatoArquivo[]> {
  const PAGINA = 1000;
  const linhas: RelatoArquivo[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase()
      .from("relato_arquivos")
      .select("*, relatos!inner(ciclo_id)")
      .eq("relatos.ciclo_id", cicloId)
      .order("id", { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(erroDeRelato(error));
    const bloco = (data ?? []) as Array<RelatoArquivo & { relatos?: unknown }>;
    for (const linha of bloco) {
      const { relatos: _filtro, ...arquivo } = linha;
      linhas.push(arquivo as RelatoArquivo);
    }
    if (bloco.length < PAGINA) return linhas;
  }
}
