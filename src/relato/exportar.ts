/**
 * ============================================================================
 *  Automações do painel da coordenação — CSVs, minuta e envelope JSON
 * ============================================================================
 *  Tudo aqui é PURO exceto `baixarArquivo` (a única função que toca o DOM,
 *  isolada de propósito para a suíte rodar sem navegador). A matéria-prima é
 *  sempre o `DadosDoPainel` que `agregarCiclo` devolveu — nenhuma releitura de
 *  banco, nenhum número recalculado de um jeito diferente do da tela.
 *
 *  AS REGRAS DE HONESTIDADE, APLICADAS AO QUE SAI DAQUI
 *  ----------------------------------------------------
 *   • CSV de produções usa `producao.contadas` — a coleção CANÔNICA (uma linha
 *     por trabalho da rede). Quatro coautores NÃO viram quatro artigos, e item
 *     fora do período NUNCA aparece como contado.
 *   • A minuta é FACTUAL: número, contagem e origem — adjetivo nenhum. O
 *     precedente é `sugerirResultado` (narrativa.ts): "importante", "relevante",
 *     "expressivo", "inovador" e afins são juízo de quem assina o relatório,
 *     não do software. O teste garante a ausência.
 *   • Parcialidade SEMPRE dita: toda seção da minuta e todo CSV carregam
 *     "com N de M relatos recebidos". Número parcial sem rótulo é mentira por
 *     omissão.
 *   • Nenhum percentual de meta: as somas saem como contagem, nunca como "%
 *     da meta" — a regra da spec (docs/relato-anual.md) vale aqui também.
 *   • O envelope JSON encaixa nos tipos `Envelope*` de types.ts §2.1 (o
 *     contrato do relatório de 2027). Campo do painel que não cabe neles NÃO
 *     entra — o formato é contrato, não lixeira.
 *
 *  FORMATO DOS CSVs (o público é o Excel pt-BR da coordenação)
 *  -----------------------------------------------------------
 *  Separador `;`, BOM UTF-8, aspas escapadas (via `csvEscape` de figuras/csv —
 *  a implementação canônica do projeto), datas DD/MM/AAAA e decimal com
 *  vírgula. Cabeçalho de procedência em linhas `#`, porque o CSV viaja: sem a
 *  frase do recorte dentro do arquivo, o número vira órfão numa planilha
 *  alheia.
 * ============================================================================
 */
import { csvEscape } from "../figuras/csv";
import type { DadosDoPainel } from "./agregacao";
import type { ProducaoComVinculos } from "./api";
import { metasDoObjetivo, ROTULO_TIPO_PRODUCAO } from "./config";
import {
  tituloDoCsl,
  veiculoDoCsl,
  type CategoriaFormado,
  type NivelEstudante,
} from "./narrativa";
import type {
  AncoraTipo,
  CicloConfig,
  CicloMembro,
  EnvelopeCiclo,
  EnvelopeEnvio,
  EnvelopeFato,
  EnvelopeLaboratorio,
  EnvelopeMembro,
  EnvelopeProducao,
  EnvelopeRelato,
  Fato,
  Relato,
  RelatorioCiclo,
} from "./types";

// ===================================================== FORMATO pt-BR PURO ===
/**
 * Formatação manual, sem `toLocaleString`: o resultado precisa ser idêntico em
 * navegador, em Node e no teste — depender do ICU embutido de cada ambiente é
 * pedir divergência silenciosa num arquivo que vai ao CNPq.
 */

/** "2025-05-01" → "01/05/2025". Data inválida volta como veio (nunca inventa). */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** 1234567.5 com 2 casas → "1.234.567,50". Milhar com ponto, decimal com vírgula. */
export function numeroBr(n: number, casas = 0): string {
  const sinal = n < 0 ? "-" : "";
  const [inteiro, decimais] = Math.abs(n).toFixed(casas).split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return sinal + agrupado + (decimais ? `,${decimais}` : "");
}

/** Como `numeroBr`, mas preservando as casas decimais que o número tiver (JCR). */
export function numeroBrLivre(n: number): string {
  const casas = String(n).includes(".") ? String(n).split(".")[1].length : 0;
  return numeroBr(n, casas);
}

export function moedaBr(v: number): string {
  return `R$ ${numeroBr(v, 2)}`;
}

/** Decimal para célula de CSV: vírgula, sem milhar (célula é dado, não prosa). */
function decimalCsv(v: number | null | undefined, casas?: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  const s = casas === undefined ? String(v) : v.toFixed(casas);
  return s.replace(".", ",");
}

// =========================================================== MONTAGEM CSV ===

/** U+FEFF por código, para nenhum editor conseguir apagar o invisível. */
const BOM = String.fromCharCode(0xfeff);

type Celula = string | number;

function montarCsv(comentarios: string[], colunas: string[], linhas: Celula[][]): string {
  const corpo = [colunas.join(";"), ...linhas.map((l) => l.map((c) => csvEscape(c)).join(";"))];
  return `${BOM}${comentarios.map((c) => `# ${c}`).join("\n")}\n${corpo.join("\n")}\n`;
}

/** As três linhas que TODO CSV daqui carrega: o quê, o período e o recorte. */
function comentariosDoRecorte(d: DadosDoPainel, titulo: string): string[] {
  const r = d.recorte;
  return [
    `${titulo}: ${r.cicloTitulo}`,
    `Período do ciclo: ${dataBr(r.periodoInicio)} a ${dataBr(r.periodoFim)}`,
    r.frase,
  ];
}

const ROTULO_ANCORA: Record<AncoraTipo, string> = {
  doi: "DOI",
  isbn: "ISBN",
  issn_pagina: "ISSN + página",
  inpi: "INPI",
  url_com_captura: "URL com captura",
  arquivo_sha256: "Arquivo (SHA-256)",
};

/**
 * Rótulos dos níveis do Forms (Q10 e Q15–19). Duplicados de MeuLaboratorio.tsx
 * de propósito: importar de lá arrastaria o componente React inteiro para o
 * chunk do exportador.
 */
const ROTULO_NIVEL_ESTUDANTE: Record<NivelEstudante, string> = {
  ICJ: "Iniciação científica júnior (ICJ)",
  IC: "Iniciação científica (IC)",
  AT: "Apoio técnico (AT)",
  DTI: "Desenvolvimento tecnológico e industrial (DTI)",
  MS: "Mestrado (MS)",
  DR: "Doutorado (DR)",
  PD: "Pós-doutorado (PD)",
};

const ROTULO_CATEGORIA_FORMADO: Record<CategoriaFormado, string> = {
  IC: "Iniciação científica (IC e ICJ)",
  TCC: "Graduação (TCC)",
  MS: "Mestrado",
  DR: "Doutorado",
  PD: "Pós-doutorado",
};

/** relato → sigla do laboratório (via membro do roster), para a coluna do CSV. */
function siglaPorRelato(brutos: DadosDoPainel["brutos"]): Map<string, string> {
  const labPorId = new Map(brutos.laboratorios.map((l) => [l.id, l.sigla]));
  const membroPorId = new Map(brutos.membros.map((m) => [m.id, m]));
  const mapa = new Map<string, string>();
  for (const r of brutos.relatos) {
    const membro = r.membro_id ? membroPorId.get(r.membro_id) : undefined;
    const sigla = membro?.laboratorio_id ? labPorId.get(membro.laboratorio_id) : undefined;
    mapa.set(r.id, sigla ?? "sem laboratório identificado");
  }
  return mapa;
}

// ============================================================ EXPORTADORES ==

/**
 * A Tabela A pronta para o Excel: uma linha por trabalho da rede (canônica).
 * A coleção é `producao.contadas` — competência neste ciclo e ao menos um
 * vínculo; fora do período NÃO está aqui, por construção.
 */
export function csvProducoes(d: DadosDoPainel): string {
  const siglas = siglaPorRelato(d.brutos);
  const foraProducoes = d.foraDoPeriodo.filter((i) => i.entidade === "producao").length;
  const comentarios = [
    ...comentariosDoRecorte(d, "Produções do ciclo (canônica)"),
    "Uma linha por trabalho da rede: coautoria interna NÃO duplica a linha.",
    `Produção com data fora do período não entra nesta lista (${foraProducoes} item(ns) na fila à parte do painel).`,
  ];
  const linhas: Celula[][] = d.producao.contadas.map(({ producao, vinculos }) => {
    const labs = [...new Set(vinculos.map((v) => siglas.get(v.relato_id) ?? "sem laboratório identificado"))].sort();
    return [
      ROTULO_ANCORA[producao.ancora_tipo],
      producao.ancora_valor,
      ROTULO_TIPO_PRODUCAO[producao.tipo],
      tituloDoCsl(producao.metadados) ?? "",
      veiculoDoCsl(producao.metadados) ?? "",
      producao.ano ?? "",
      producao.ambito ?? "não definido",
      producao.qualis ?? "",
      decimalCsv(producao.jcr),
      labs.join(", "),
    ];
  });
  return montarCsv(
    comentarios,
    ["ancora_tipo", "ancora", "tipo", "titulo", "veiculo", "ano", "ambito", "qualis", "jcr", "laboratorios_envolvidos"],
    linhas,
  );
}

/**
 * Estudantes e RH formado da rede, linha a linha, com o contado automático E o
 * valor final lado a lado — a divergência (ajuste do líder) nunca é escondida.
 */
export function csvPessoasRh(d: DadosDoPainel): string {
  const rh = d.rh;
  const comentarios = [
    ...comentariosDoRecorte(d, "Estudantes e RH formado (rede inteira)"),
    "valor_final = ajuste declarado pelo líder quando existe; senão, o contado automático dos fatos.",
    `Laboratórios com algum ajuste do líder: ${rh.laboratoriosComAjuste} de ${rh.laboratoriosComFatos} com fatos declarados.`,
  ];
  if (rh.bolsasSemNivel.length) {
    comentarios.push(
      `Modalidades de bolsa ativas sem nível de estudante, fora da soma: ${rh.bolsasSemNivel.join(", ")}.`,
    );
  }
  if (rh.formacoesForaDosNiveis) {
    comentarios.push(`Formações fora dos níveis do formulário, fora da soma: ${rh.formacoesForaDosNiveis}.`);
  }
  const linhas: Celula[][] = [
    ...rh.estudantes.map((l) => [
      "Estudantes ativos",
      l.chave,
      ROTULO_NIVEL_ESTUDANTE[l.chave],
      l.contadoAutomatico,
      l.valorFinal,
      l.laboratoriosComAjuste,
      l.porQueNao ?? "",
    ]),
    ...rh.formados.map((l) => [
      "RH formado no período",
      l.chave,
      ROTULO_CATEGORIA_FORMADO[l.chave],
      l.contadoAutomatico,
      l.valorFinal,
      l.laboratoriosComAjuste,
      l.porQueNao ?? "",
    ]),
  ];
  return montarCsv(
    comentarios,
    ["grupo", "codigo", "categoria", "contado_automatico", "valor_final", "laboratorios_com_ajuste", "observacao"],
    linhas,
  );
}

/**
 * Fomento processo a processo. Corrente e complementar SEPARADOS (complementar
 * é captação nova — o argumento de renovação); item sem valor sai com a célula
 * vazia e fica fora das somas do cabeçalho, nunca vira NaN.
 */
export function csvFomento(d: DadosDoPainel): string {
  const f = d.fomento;
  const comentarios = [
    ...comentariosDoRecorte(d, "Fomento declarado nos relatos"),
    `Relatos com fomento: ${f.relatosComFomento}. Total corrente: ${moedaBr(f.totalCorrenteBrl)}; total complementar ao INCT (captação nova): ${moedaBr(f.totalComplementarBrl)}.`,
    `Itens sem valor declarado: ${f.itensSemValor}, fora das somas. Os valores são estimativas declaradas pelos próprios membros.`,
  ];
  const linhas: Celula[][] = f.processos.map((p) => [
    p.agencia,
    p.processo,
    p.titulo,
    p.complementar ? "complementar ao INCT (captação nova)" : "projeto corrente",
    p.valorBrl === null ? "" : decimalCsv(p.valorBrl, 2),
  ]);
  return montarCsv(comentarios, ["agencia", "processo", "titulo", "tipo", "valor_brl"], linhas);
}

// ================================================================= MINUTA ===

export type SecaoDaMinuta = { id: string; titulo: string; texto: string; fonte: string };

function contar(n: number, singular: string, plural: string): string {
  return `${numeroBr(n)} ${n === 1 ? singular : plural}`;
}

/**
 * A automação que mais poupa a coordenação: seções de texto FACTUAL prontas
 * para colar no relatório do CNPq. Cada número vem do `DadosDoPainel` (o mesmo
 * da tela) e cada seção diz em `fonte` de onde ele saiu. Sem adjetivo, sem
 * percentual de meta, e com a parcialidade dita DENTRO do texto — se a
 * coordenação colar a frase sozinha, o rótulo viaja junto.
 */
export function minutaDoRelatorio(d: DadosDoPainel): SecaoDaMinuta[] {
  const r = d.recorte;
  const abertura = `Com ${numeroBr(r.relatosEnviados)} de ${numeroBr(r.membrosAtivos)} relatos recebidos`;
  const fonteBase = `${numeroBr(r.relatosEnviados)} relatos enviados de ${numeroBr(r.membrosAtivos)} esperados`;
  const secoes: SecaoDaMinuta[] = [];
  const tipoFato = (tipo: string) => d.fatos.porTipo.find((t) => t.tipo === tipo);

  // ------------------------------------------- produção bibliográfica/técnica
  {
    const p = d.producao;
    const porTipo = p.porTipo.map((t) => `${ROTULO_TIPO_PRODUCAO[t.tipo]}: ${numeroBr(t.itens)}`).join("; ");
    const artigos = p.porTipo.find((t) => t.tipo === "artigo_periodico")?.itens ?? 0;
    let texto =
      `${abertura}, a rede declarou ${contar(p.totalContado, "produção", "produções")} com competência ` +
      `neste ciclo, contadas pela âncora única: cada trabalho conta uma vez, mesmo com coautores em ` +
      `laboratórios diferentes.`;
    if (p.totalContado) texto += ` Por tipo: ${porTipo}.`;
    if (p.compartilhadas) {
      texto += ` ${contar(p.compartilhadas, "produção envolve", "produções envolvem")} dois ou mais relatos da rede.`;
    }
    if (artigos) {
      const comQualis = artigos - p.artigosSemQualis;
      const qualisTxt = p.qualis.map((q) => `${q.faixa}: ${numeroBr(q.itens)}`).join("; ");
      texto += ` Dos ${numeroBr(artigos)} artigos em periódico, ${numeroBr(comQualis)} têm Qualis informado`;
      if (qualisTxt) texto += ` (${qualisTxt})`;
      texto += ` e ${numeroBr(p.jcr.artigosComJcr)} têm JCR informado`;
      if (p.jcr.mediana !== null) {
        texto += ` (mediana ${numeroBrLivre(p.jcr.mediana)}, mínimo ${numeroBrLivre(p.jcr.minimo ?? 0)}, máximo ${numeroBrLivre(p.jcr.maximo ?? 0)})`;
      }
      texto += `.`;
    }
    if (d.foraDoPeriodo.length) {
      texto += ` Itens com data fora do período: ${numeroBr(d.foraDoPeriodo.length)} (listados à parte, fora destas contagens).`;
    }
    secoes.push({
      id: "producao",
      titulo: "Produção bibliográfica e técnica",
      texto,
      fonte:
        `Produções com competência no ciclo e ao menos um vínculo, contadas pela âncora única (canônica); ` +
        `Qualis e JCR são declarações manuais na canônica; JCR resumido pela mediana, nunca pela média; ${fonteBase}.`,
    });
  }

  // --------------------------------------------------------- formação de RH
  {
    const rh = d.rh;
    const est = rh.estudantes.map((l) => `${ROTULO_NIVEL_ESTUDANTE[l.chave]}: ${numeroBr(l.valorFinal)}`).join("; ");
    const form = rh.formados
      .filter((l) => l.contavel)
      .map((l) => `${ROTULO_CATEGORIA_FORMADO[l.chave]}: ${numeroBr(l.valorFinal)}`)
      .join("; ");
    let texto =
      `${abertura}, os fatos de formação e de bolsa declarados pelos laboratórios somam, na rede: ` +
      `estudantes ativos: ${est}. Pessoas formadas no período: ${form}.`;
    const tcc = rh.formados.find((l) => l.chave === "TCC");
    if (tcc && !tcc.contavel) {
      texto += ` A categoria Graduação (TCC) não tem contagem automática`;
      texto += tcc.valorFinal ? `; os líderes declararam ${numeroBr(tcc.valorFinal)} à mão.` : `.`;
    }
    if (rh.laboratoriosComAjuste) {
      texto +=
        ` Em ${numeroBr(rh.laboratoriosComAjuste)} de ${contar(rh.laboratoriosComFatos, "laboratório com fatos declarados", "laboratórios com fatos declarados")}, ` +
        `o líder ajustou os contadores automáticos; o valor ajustado prevalece nas somas acima.`;
    }
    if (rh.formacoesForaDosNiveis) {
      texto += ` ${contar(rh.formacoesForaDosNiveis, "formação fora dos níveis do formulário fica", "formações fora dos níveis do formulário ficam")} fora destas somas.`;
    }
    if (rh.bolsasSemNivel.length) {
      texto += ` Modalidades de bolsa ativas sem nível de estudante, fora da soma: ${rh.bolsasSemNivel.join(", ")}.`;
    }
    secoes.push({
      id: "rh",
      titulo: "Formação de recursos humanos",
      texto,
      fonte:
        `Fatos de formação e bolsa confirmados com competência no ciclo, somados laboratório a laboratório ` +
        `com o ajuste do líder aplicado quando declarado; ${fonteBase}.`,
    });
  }

  // ------------------------------------- expedições e ações com a sociedade
  {
    const exp = tipoFato("expedicao");
    const acao = tipoFato("acao_sociedade");
    const adesoes = (exp?.adesoes ?? 0) + (acao?.adesoes ?? 0);
    let texto =
      `${abertura}, os laboratórios registraram ${contar(exp?.itens ?? 0, "expedição científica", "expedições científicas")} ` +
      `e ${contar(acao?.itens ?? 0, "ação de divulgação ou educação", "ações de divulgação ou educação")} confirmadas ` +
      `com competência neste ciclo, com ${contar(adesoes, "adesão de membro", "adesões de membros")}.`;
    if (acao?.pessoasAlcancadasEstimado) {
      texto += ` As ações declaram alcance de aproximadamente ${numeroBr(acao.pessoasAlcancadasEstimado)} pessoas (estimativa dos próprios laboratórios).`;
    }
    if (d.fatos.propostosPendentes) {
      texto += ` ${contar(d.fatos.propostosPendentes, "proposta de fato aguarda", "propostas de fatos aguardam")} confirmação dos líderes; propostas não entram nestas contagens.`;
    }
    secoes.push({
      id: "expedicoes-sociedade",
      titulo: "Expedições e ações com a sociedade",
      texto,
      fonte:
        `Fatos confirmados com competência no ciclo (cada evento conta uma vez, com N participantes); ` +
        `pessoas alcançadas são estimativa declarada; ${fonteBase}.`,
    });
  }

  // -------------------------------------------------------- parcerias e rede
  {
    const parc = tipoFato("parceria");
    let texto =
      `${abertura}, foram confirmadas ${contar(parc?.itens ?? 0, "parceria institucional", "parcerias institucionais")} no ciclo. ` +
      `Somando o quadro de membros ativos e as parcerias confirmadas, a rede reúne ${contar(d.rede.instituicoesComRor, "instituição", "instituições")} ` +
      `com ROR distinto, em ${contar(d.rede.paises.length, "país", "países")}` +
      (d.rede.paises.length ? ` (${d.rede.paises.join(", ")})` : "") +
      ` e ${contar(d.rede.ufs.length, "unidade da federação", "unidades da federação")}.`;
    if (d.rede.membrosSemRor) {
      texto += ` ${contar(d.rede.membrosSemRor, "membro ativo está", "membros ativos estão")} sem ROR de instituição informado.`;
    }
    secoes.push({
      id: "parcerias-rede",
      titulo: "Parcerias e rede de instituições",
      texto,
      fonte: `Fatos de parceria confirmados e quadro de membros ativos; instituições contadas por ROR declarado, nunca digitado; ${fonteBase}.`,
    });
  }

  // --------------------------------------------------------- fomento captado
  {
    const f = d.fomento;
    let texto =
      `${abertura}, ${contar(f.relatosComFomento, "relato declarou", "relatos declararam")} fomento: ` +
      `${moedaBr(f.totalCorrenteBrl)} em projetos correntes e ${moedaBr(f.totalComplementarBrl)} em financiamento ` +
      `complementar ao INCT (captação nova), somados separadamente.`;
    if (f.itensSemValor) {
      texto += ` ${contar(f.itensSemValor, "item sem valor declarado fica", "itens sem valor declarado ficam")} fora das somas.`;
    }
    const top = f.porAgencia.slice(0, 3);
    if (top.length) {
      texto += ` Agências com maior valor declarado: ${top.map((a) => `${a.agencia} (${moedaBr(a.valorCorrenteBrl + a.valorComplementarBrl)})`).join("; ")}.`;
    }
    texto += ` Os valores são estimativas declaradas pelos próprios membros.`;
    secoes.push({
      id: "fomento",
      titulo: "Fomento captado",
      texto,
      fonte: `Respostas de fomento dos relatos (Q12 e Q21 do formulário); somas apenas dos itens com valor declarado; ${fonteBase}.`,
    });
  }

  // ---------------------------------------------------- dificuldades (contagens)
  {
    const marcadas = d.dificuldades.filter((o) => o.relatos > 0);
    const zeradas = d.dificuldades.filter((o) => o.relatos === 0);
    let texto: string;
    if (!marcadas.length) {
      texto = `${abertura}, nenhuma dificuldade foi marcada até agora.`;
    } else {
      texto =
        `${abertura}, as dificuldades marcadas foram: ` +
        marcadas.map((o) => `${o.rotulo}: ${contar(o.relatos, "relato", "relatos")}`).join("; ") +
        `.`;
    }
    if (zeradas.length) {
      texto += ` Nenhum relato marcou: ${zeradas.map((o) => o.rotulo).join("; ")}.`;
    }
    secoes.push({
      id: "dificuldades",
      titulo: "Dificuldades relatadas",
      texto,
      fonte: `Categorias marcadas nas narrativas dos relatos (opções fechadas, contadas por id); ${fonteBase}.`,
    });
  }

  // ---------------------------------------------------------------- extensão
  {
    const e = d.extensao;
    let texto = `${abertura}, ${contar(e.relatosComExtensao, "relato declarou", "relatos declararam")} projeto de extensão vinculado.`;
    if (e.produtosPorTipo.length) {
      texto += ` Produtos declarados por tipo: ${e.produtosPorTipo.map((p) => `${ROTULO_TIPO_PRODUCAO[p.tipo]}: ${numeroBr(p.itens)}`).join("; ")}.`;
    } else {
      texto += ` Nenhum produto de extensão foi declarado até agora.`;
    }
    secoes.push({
      id: "extensao",
      titulo: "Extensão",
      texto,
      fonte: `Respostas de extensão dos relatos (Q28 a Q30 do formulário); ${fonteBase}.`,
    });
  }

  return secoes;
}

// ======================================================== ENVELOPE §2.1 =====
/**
 * O export JSON do ciclo inteiro, montado ESTRITAMENTE com os tipos
 * `Envelope*` de types.ts §2.1 — o contrato com o relatório de 2027. Métrica
 * agregada do painel NÃO entra (não há tipo para ela no §2.1, e o envelope não
 * é lixeira); quem quiser números agregados usa os CSVs e a minuta.
 *
 * O que fica de fora, e por quê:
 *  • Relato sem `membro_id` (conta criada fora do roster): `EnvelopeMembro`
 *    exige os dados do roster — sem eles o item não cabe no tipo. A existência
 *    desses relatos continua DITA em `recorte.relatosSemVinculoNoRoster`.
 *  • Laboratório sem relato de LLA identificável: `EnvelopeLaboratorio` exige
 *    `envio` e `governanca` reais — inventar um envio "rascunho" para um relato
 *    que não existe seria fabricar dado.
 *  • `snapshot_sha256`: mora em `relato_eventos`, que não está nos brutos —
 *    sai `null`, nunca um hash recalculado aqui.
 *  • Produção fora do período ENTRA, mas marcada (`periodo_situacao`): o §2.1
 *    tem o campo exatamente para isso — exportada como dado, nunca como contado.
 */

type EnvelopeDoCiclo = {
  ciclo: EnvelopeCiclo;
  relatos: EnvelopeRelato[];
  laboratorios: EnvelopeLaboratorio[];
};

function envelopeCiclo(c: RelatorioCiclo): EnvelopeCiclo {
  return {
    slug: c.slug,
    numero: c.numero,
    periodo_inicio: c.periodo_inicio,
    periodo_fim: c.periodo_fim,
    vigencia_inicio: c.vigencia_inicio,
    chamada: c.chamada,
    processo: c.processo,
  };
}

function envelopeMembro(m: CicloMembro): EnvelopeMembro {
  return {
    membro_id: m.id,
    nome: m.nome,
    email: m.email,
    categoria_picc: m.categoria_picc,
    papel: m.papel,
    laboratorio_id: m.laboratorio_id,
    instituicao_ror: m.instituicao_ror,
    instituicao_nome: m.instituicao_nome,
    pais_iso2: m.pais_iso2,
    uf: m.uf,
    lattes_id: m.lattes_id,
    orcid: m.orcid,
    idioma: m.idioma,
    ppg: m.ppg,
    indice_h: m.indice_h,
    total_citacoes: m.total_citacoes,
    satisfacao: m.satisfacao,
    indicadores_fonte: m.indicadores_fonte,
    indicadores_atualizado_em: m.indicadores_atualizado_em,
  };
}

function envelopeEnvio(r: Relato): EnvelopeEnvio {
  return {
    protocolo: r.protocolo,
    status: r.status,
    nada_a_declarar: r.nada_a_declarar,
    declaracao_veracidade: r.declaracao_veracidade,
    cessao_imagem: r.cessao_imagem,
    submitted_at: r.submitted_at,
    snapshot_sha256: null, // mora em relato_eventos; nunca recalculado aqui
    preenchido_por: r.preenchido_por,
  };
}

/** Metas derivadas dos objetivos do vínculo, pelo mapa homologado do config. */
function metasDerivadas(config: CicloConfig, objetivos: number[]): number[] {
  const metas = new Set<number>();
  for (const o of objetivos) for (const m of metasDoObjetivo(config, o)) metas.add(m.n);
  return [...metas].sort((a, b) => a - b);
}

function fatoEstimado(f: Fato): boolean {
  const p = f.payload as Record<string, unknown>;
  return typeof p.pessoas_alcancadas === "number" || typeof p.pessoas_equipe === "number";
}

export function envelopeDoCiclo(d: DadosDoPainel): unknown {
  const { ciclo, laboratorios, membros, relatos, producoes, fatos, adesoes } = d.brutos;
  const config = ciclo.config;

  const membroPorId = new Map(membros.map((m) => [m.id, m]));
  const membroPorUserId = new Map(membros.filter((m) => m.user_id).map((m) => [m.user_id as string, m]));
  const relatoPorMembro = new Map<string, Relato>();
  for (const r of relatos) if (r.membro_id) relatoPorMembro.set(r.membro_id, r);

  const nomeDoRelato = (relatoId: string): string | null => {
    const r = relatos.find((x) => x.id === relatoId);
    const m = r?.membro_id ? membroPorId.get(r.membro_id) : undefined;
    return m?.nome ?? null;
  };

  const envelopeProducao = (p: ProducaoComVinculos, relatoId: string): EnvelopeProducao | null => {
    const vinculo = p.vinculos.find((v) => v.relato_id === relatoId);
    if (!vinculo) return null;
    const coautores = [
      ...new Set(
        p.vinculos
          .filter((v) => v.id !== vinculo.id)
          .map((v) => nomeDoRelato(v.relato_id))
          .filter((n): n is string => n !== null),
      ),
    ].sort();
    return {
      producao_id: p.producao.id,
      ancora_tipo: p.producao.ancora_tipo,
      ancora_valor: p.producao.ancora_valor,
      ancora_resolvida: p.producao.ancora_resolvida,
      origem: vinculo.origem,
      tipo: p.producao.tipo,
      ambito: p.producao.ambito,
      convidado: p.producao.convidado,
      ano: p.producao.ano,
      publicado_em: p.producao.publicado_em,
      menciona_apoio: vinculo.menciona_apoio,
      acesso_aberto: p.producao.acesso_aberto,
      objetivos: vinculo.objetivos,
      metas_derivadas: metasDerivadas(config, vinculo.objetivos),
      // Não há mapa produção→indicador homologado nos dados: lista vazia em
      // vez de palpite — a coordenação preenche quando o mapa existir.
      indicadores: [],
      publicavel: vinculo.publicavel,
      periodo_situacao: p.producao.periodo_situacao,
      jcr: p.producao.jcr,
      qualis: p.producao.qualis,
      metadados: p.producao.metadados,
      coautores_na_rede: coautores,
    };
  };

  const adesoesPorFato = new Map<string, string[]>();
  for (const a of adesoes) {
    const nome = membroPorUserId.get(a.user_id)?.nome ?? a.user_id;
    const lista = adesoesPorFato.get(a.fato_id) ?? [];
    lista.push(nome);
    adesoesPorFato.set(a.fato_id, lista);
  }

  const envelopeFato = (f: Fato): EnvelopeFato => ({
    fato_id: f.id,
    tipo: f.tipo,
    laboratorio_id: f.laboratorio_id,
    ocorrido_em: f.ocorrido_em,
    titulo: f.titulo,
    status: f.status,
    eets: f.eets,
    objetivos: f.objetivos,
    comite: f.comite,
    periodo_situacao: f.periodo_situacao,
    participantes: adesoesPorFato.get(f.id) ?? [],
    payload: f.payload,
    estimado: fatoEstimado(f),
  });

  const cicloEnv = envelopeCiclo(ciclo);

  const relatosEnv: EnvelopeRelato[] = [];
  for (const r of relatos) {
    const membro = r.membro_id ? membroPorId.get(r.membro_id) : undefined;
    if (!membro) continue; // fora do roster: não cabe no tipo; dito no recorte
    relatosEnv.push({
      schema: "inct-relato/1",
      ciclo: cicloEnv,
      membro: envelopeMembro(membro),
      producoes: producoes
        .map((p) => envelopeProducao(p, r.id))
        .filter((p): p is EnvelopeProducao => p !== null),
      adesoes: adesoes
        .filter((a) => a.relato_id === r.id)
        .map((a) => ({ fato_id: a.fato_id, papel_no_fato: a.papel_no_fato, aderido_em: a.aderido_em })),
      fatos_propostos: fatos
        .filter((f) => f.status === "proposto" && f.criado_por !== null && f.criado_por === r.user_id)
        .map(envelopeFato),
      narrativas: r.narrativas,
      respostas: r.respostas,
      envio: envelopeEnvio(r),
    });
  }

  const laboratoriosEnv: EnvelopeLaboratorio[] = [];
  for (const lab of laboratorios) {
    // O relato que assina pelo laboratório: o do LLA do roster, ou (rede de
    // segurança) o do dono apontado em `lla_user_id` — a MESMA regra da
    // agregação, para envelope e painel nunca divergirem.
    const lider = membros.find((m) => m.laboratorio_id === lab.id && m.papel === "lla" && m.ativo);
    let relatoDoLider = lider ? relatoPorMembro.get(lider.id) : undefined;
    if (!relatoDoLider && lab.lla_user_id) {
      relatoDoLider = relatos.find((r) => r.user_id === lab.lla_user_id);
    }
    if (!relatoDoLider) continue; // sem envio real não se fabrica envelope
    laboratoriosEnv.push({
      schema: "inct-relato-lab/1",
      ciclo: cicloEnv,
      laboratorio: lab,
      equipe: membros.filter((m) => m.laboratorio_id === lab.id && m.ativo).map(envelopeMembro),
      fatos: fatos.filter((f) => f.laboratorio_id === lab.id).map(envelopeFato),
      governanca: relatoDoLider.narrativas.governanca ?? {},
      narrativas: relatoDoLider.narrativas,
      envio: envelopeEnvio(relatoDoLider),
    });
  }

  const envelope: EnvelopeDoCiclo = { ciclo: cicloEnv, relatos: relatosEnv, laboratorios: laboratoriosEnv };
  return envelope;
}

// ============================================================== DOWNLOAD ====

/**
 * A única função com DOM do módulo, isolada de propósito (a suíte roda sem
 * navegador e não a testa). Blob + `revokeObjectURL` no fim: esquecer o revoke
 * vaza memória a cada clique.
 */
export function baixarArquivo(nome: string, conteudo: string, mime: string): void {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
