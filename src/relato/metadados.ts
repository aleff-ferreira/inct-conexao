/**
 * Resolução de metadados NO NAVEGADOR — sem backend, sem chave, sem proxy.
 *
 * Os vereditos deste módulo não são opinião: estão medidos em
 * `src/content/relato/apis-metadados.json` (apuração de 04/08/2026, curl com
 * `Origin: https://inct-conexao.com.br`). O que ele mandou fazer:
 *
 *  • Crossref é o provedor primário e é EXCELENTE para DOI brasileiro — 4 de 4
 *    DOIs SciELO resolveram com ISSN, veículo, licença e 100% dos autores com
 *    ORCID. O medo de que a cobertura nacional quebrasse o desenho era infundado.
 *  • O `?mailto=` NÃO é cortesia: sem ele o Crossref rebaixa para o public pool
 *    (5 req/s, concorrência 1) e a fila de 3 deste arquivo passaria a violar a
 *    política do serviço. Com ele, polite pool: 10 req/s, concorrência 3.
 *  • 404 do Crossref vem em `text/plain` ("Resource not found."). Confira o
 *    status ANTES de parsear, ou um "não encontrado" vira "erro".
 *  • ORCID é ATALHO, NUNCA ALICERCE: dos 18 pesquisadores brasileiros medidos,
 *    33% têm ZERO trabalhos na janela do Ciclo 1 e 14% dos trabalhos trazem só o
 *    ano. A tela precisa funcionar inteira sem ORCID.
 *  • Lattes é inviável (sem CORS, exige convênio). Não há chamada aqui.
 *
 * PRINCÍPIO ÚNICO DE FALHA (apuração, `degradacao.principio`): nenhuma falha de
 * API produz tela vazia, mensagem técnica ou bloqueio de envio. NADA aqui lança
 * exceção — toda função devolve um objeto com `ok`, e a falha carrega de volta
 * o valor que a pessoa digitou, para a tela abrir os 4 campos manuais já
 * preenchidos. Perder o dado é pior do que perder o autopreenchimento.
 */

import { MENSAGENS, avaliarData, normalizarDoi, normalizarIsbn, PERIODO_CICLO_1, type Periodo, type SituacaoData } from "./validation";
import { chaveAncora, type AncoraTipo } from "./dedupe";

// ================================================================ constantes

/**
 * Identificação no polite pool do Crossref. É o contato público do INCT (o
 * mesmo do rodapé do site): o navegador não pode setar User-Agent, então o
 * parâmetro de query é o único caminho — e, verificado, ele funciona.
 */
export const MAILTO_CROSSREF = "inctconexao@gmail.com";

/** Por provedor, como a apuração recomenda (`cadeiaRecomendada`). */
export const TIMEOUT_MS = 8000;

/** Concorrência 3 — legal apenas dentro do polite pool. Ver MAILTO_CROSSREF. */
export const CONCORRENCIA = 3;

export type ProvedorDoi = "crossref" | "datacite" | "doiorg";
export type Provedor = ProvedorDoi | "openlibrary" | "manual";

/**
 * A ORDEM DA CADEIA, e por que ela é esta.
 *
 * A especificação (§3.3 e §4.3) e a apuração (`cadeiaRecomendada.porTipoDeEntrada.doi`)
 * dizem o mesmo: Crossref → DataCite → doi.org. O briefing desta tarefa pediu
 * doi.org em segundo lugar; ficou registrado como divergência e NÃO foi adotado,
 * por um motivo mecânico: `doi.org` com negociação de conteúdo responde
 * REDIRECIONANDO para o registrante — para DOI Crossref, ele cai em
 * `api.crossref.org`, que é exatamente quem acabou de falhar. Colocá-lo em
 * segundo gasta um salto de rede a mais no caso que já se sabe perdido, e adia o
 * DataCite, que é o único provedor que cobre outro registro (dataset, software,
 * depósito Zenodo/figshare — medido: `10.5281/zenodo.7712765` resolve no
 * DataCite e devolve 404 no Crossref).
 *
 * É um array exportado: quem discordar troca a ordem em uma linha, sem mexer em
 * lógica.
 */
export const CADEIA_DOI: readonly ProvedorDoi[] = ["crossref", "datacite", "doiorg"];

const URL_CROSSREF = "https://api.crossref.org/works/";
const URL_DATACITE = "https://api.datacite.org/dois/";
const URL_DOIORG = "https://doi.org/";
const URL_ORCID = "https://pub.orcid.org/v3.0/";
const URL_ROR = "https://api.ror.org/v2/organizations";
const URL_OPENLIBRARY = "https://openlibrary.org/api/books";

const ACCEPT_JSON = "application/json";
const ACCEPT_CSL = "application/vnd.citationstyles.csl+json";

/** Os 26 valores do CHECK de `producoes.tipo` (005_relatos.sql / §2.3). */
export type TipoProducao =
  | "livro" | "capitulo" | "artigo_periodico" | "trabalho_anais_completo"
  | "trabalho_anais_resumo" | "trabalho_anais_resumo_expandido" | "traducao"
  | "software_aplicativo" | "base_dados" | "patente" | "desenho_industrial"
  | "marca" | "cultivar" | "tecnologia_social" | "processo_nao_patenteavel"
  | "manual_protocolo" | "relatorio_tecnico" | "material_didatico"
  | "curso_formacao" | "evento_organizado" | "norma_marco_regulatorio"
  | "acervo_curadoria_colecao" | "carta_mapa" | "produto_comunicacao"
  | "producao_artistica" | "outro";

// ===================================================================== tipos

export type MotivoFalha = "nao_encontrado" | "rede" | "timeout" | "abortado" | "formato" | "entrada_invalida";

export type AutorMeta = {
  readonly ordem: number;
  readonly nome: string;
  /** Forma `0000-0000-0000-000X`, ou null. Ver `orcidDaApi`. */
  readonly orcid: string | null;
  readonly afiliacao: string | null;
};

export type MetadadosNormalizados = {
  readonly ancoraTipo: AncoraTipo;
  readonly ancoraValor: string;
  readonly titulo: string;
  /** Periódico, livro-mãe ou anais; para dataset, o repositório. */
  readonly veiculo: string;
  readonly editora: string;
  readonly ano: number | null;
  /** Só quando dia, mês e ano são conhecidos — senão o banco usa a convenção do ano. */
  readonly publicadoEm: string | null;
  /** null = o provedor devolveu um tipo que não mapeia no enum fechado; a tela pergunta. */
  readonly tipo: TipoProducao | null;
  /** O tipo cru do provedor, guardado para auditoria da classificação. */
  readonly tipoBruto: string;
  readonly autores: readonly AutorMeta[];
  readonly issn: readonly string[];
  readonly isbn: readonly string[];
  readonly licenca: string | null;
  /** Derivado da licença quando ela existe; null quando não dá para saber (§2.3). */
  readonly acessoAberto: boolean | null;
  /** Insumo da inferência de `ambito`, que é decidida pela coordenação (§2.3.1). */
  readonly paisEditora: string | null;
  readonly url: string | null;
  readonly provedor: Provedor;
  /** CSL-JSON / payload CRU do provedor. É o que vai para `producoes.metadados`. */
  readonly cru: unknown;
};

export type Resolucao =
  | { readonly ok: true; readonly dados: MetadadosNormalizados }
  | {
      readonly ok: false;
      readonly motivo: MotivoFalha;
      readonly mensagem: string;
      /** O que a pessoa digitou, normalizado. A tela manual abre com ele. */
      readonly valorPreservado: string;
      /** Quem foi tentado, na ordem. Vai para o log da coordenação. */
      readonly tentados: readonly Provedor[];
    };

export type OpcoesRede = {
  /** Abortar a busca anterior a cada digitação (regra transversal da apuração). */
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly mailto?: string;
  readonly cadeia?: readonly ProvedorDoi[];
};

// ============================================================ mensagens

/** Literal da apuração (`degradacao.porApi.crossref.acao`). */
export const MSG_DEGRADA_MANUAL = "Não conseguimos buscar os dados agora. O que você digitou foi guardado. Preencha o título e seguimos.";

export function mensagemDeFalha(motivo: MotivoFalha): string {
  switch (motivo) {
    case "nao_encontrado":
      return MENSAGENS.doi;
    case "entrada_invalida":
      return MENSAGENS.doi;
    case "abortado":
      return "";
    default:
      return MSG_DEGRADA_MANUAL;
  }
}

const falha = (motivo: MotivoFalha, valorPreservado: string, tentados: Provedor[]): Resolucao => ({
  ok: false,
  motivo,
  mensagem: mensagemDeFalha(motivo),
  valorPreservado,
  tentados,
});

// ================================================================== rede

type RespostaBruta = { ok: true; dados: unknown } | { ok: false; motivo: MotivoFalha };

/**
 * Um GET com timeout próprio, encadeável ao AbortController de quem chamou.
 *
 * Nunca lança: erro de rede, timeout, aborto e corpo ilegível saem como
 * `motivo`. E NUNCA parseia antes de conferir `res.ok` — o 404 do Crossref é
 * `text/plain`, e `JSON.parse` nele transformaria "não encontrado" em "erro".
 */
async function buscarJson(url: string, o: OpcoesRede, accept: string = ACCEPT_JSON): Promise<RespostaBruta> {
  const controle = new AbortController();
  let porTimeout = false;
  const externo = o.signal;
  if (externo?.aborted) return { ok: false, motivo: "abortado" };

  const repassar = () => controle.abort();
  externo?.addEventListener("abort", repassar);
  const relogio = setTimeout(() => {
    porTimeout = true;
    controle.abort();
  }, o.timeoutMs ?? TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controle.signal, headers: { Accept: accept } });
    if (!res.ok) return { ok: false, motivo: res.status === 404 ? "nao_encontrado" : "rede" };
    try {
      return { ok: true, dados: await res.json() };
    } catch {
      return { ok: false, motivo: "formato" };
    }
  } catch {
    if (porTimeout) return { ok: false, motivo: "timeout" };
    if (externo?.aborted) return { ok: false, motivo: "abortado" };
    return { ok: false, motivo: "rede" };
  } finally {
    clearTimeout(relogio);
    externo?.removeEventListener("abort", repassar);
  }
}

// ============================================================== leitura CSL

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function lista(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** CSL usa ora string, ora array de string, para o mesmo campo. */
function texto(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && v.length && typeof v[0] === "string") return v[0].trim();
  return "";
}

function textos(v: unknown): string[] {
  if (typeof v === "string") return [v.trim()];
  return lista(v).filter((x): x is string => typeof x === "string").map((x) => x.trim());
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** `issued.date-parts[0]` = [ano, mês?, dia?]. */
function dataDeDateParts(v: unknown): { ano: number | null; iso: string | null } {
  const partes = lista(obj(v)["date-parts"])[0];
  const nums = lista(partes).filter((n): n is number => typeof n === "number");
  if (!nums.length) return { ano: null, iso: null };
  const ano = nums[0];
  if (nums.length >= 3) return { ano, iso: `${ano}-${p2(nums[1])}-${p2(nums[2])}` };
  return { ano, iso: null };
}

/**
 * ORCID como as APIs devolvem: `http://orcid.org/0000-...`, `https://...`, ou já
 * nu. Sai na forma que a constraint `producao_autores_orcid` aceita.
 *
 * O checksum NÃO é exigido aqui de propósito: um ORCID depositado errado pelo
 * editor é dado de auditoria, e como o casamento de coautoria é comparação
 * literal, um dígito errado simplesmente nunca casa com o ORCID de um membro.
 * Recusá-lo só faria o insert falhar por um erro de terceiro.
 */
export function orcidDaApi(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = v.replace(/^https?:\/\/(www\.)?orcid\.org\//i, "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (!/^[0-9]{15}[0-9X]$/.test(d)) return null;
  return (d.match(/.{4}/g) ?? []).join("-");
}

function autoresDeCsl(v: unknown): AutorMeta[] {
  return lista(v).map((a, i) => {
    const o = obj(a);
    const nome = [texto(o.given), texto(o.family)].filter(Boolean).join(" ") || texto(o.name) || texto(o.literal);
    const afiliacao = texto(obj(lista(o.affiliation)[0]).name) || null;
    return { ordem: i, nome, orcid: orcidDaApi(o.ORCID ?? o.orcid), afiliacao };
  });
}

function licencaDeCsl(v: unknown): string | null {
  const itens = lista(v).map(obj);
  if (!itens.length) return null;
  const vor = itens.find((l) => texto(l["content-version"]) === "vor");
  return texto((vor ?? itens[0]).URL) || null;
}

/**
 * `acesso_aberto` é `boolean|null` (§2.3): só afirmamos `true` quando a licença
 * é Creative Commons. Licença de editora não significa fechado, e chutar `false`
 * produziria número errado num campo que ninguém vai reconferir.
 */
function acessoAbertoDaLicenca(url: string | null): boolean | null {
  if (!url) return null;
  return /creativecommons\.org/i.test(url) ? true : null;
}

const TIPO_CROSSREF: Record<string, TipoProducao> = {
  "journal-article": "artigo_periodico",
  "book-chapter": "capitulo",
  "book-part": "capitulo",
  "book-section": "capitulo",
  book: "livro",
  monograph: "livro",
  "edited-book": "livro",
  "reference-book": "livro",
  "proceedings-article": "trabalho_anais_completo",
  dataset: "base_dados",
  database: "base_dados",
  report: "relatorio_tecnico",
  "report-component": "relatorio_tecnico",
  standard: "norma_marco_regulatorio",
};

const TIPO_DATACITE: Record<string, TipoProducao> = {
  Dataset: "base_dados",
  Software: "software_aplicativo",
  Book: "livro",
  BookChapter: "capitulo",
  ConferencePaper: "trabalho_anais_completo",
  JournalArticle: "artigo_periodico",
  Report: "relatorio_tecnico",
  Standard: "norma_marco_regulatorio",
  Model: "software_aplicativo",
};

/**
 * Sem chute: o que não estiver no mapa volta `null` e a tela pergunta. Mapear
 * "posted-content" (preprint) ou "component" para `outro` encheria a Tabela A
 * do CNPq com linhas que o revisor teria de desfazer uma a uma — e `outro` ainda
 * exigiria `outro_descricao`, que só a pessoa sabe escrever.
 */
export function tipoDoCrossref(bruto: string): TipoProducao | null {
  return TIPO_CROSSREF[bruto] ?? null;
}

export function tipoDoDataCite(bruto: string): TipoProducao | null {
  return TIPO_DATACITE[bruto] ?? null;
}

// ============================================== normalizadores por provedor

function deCsl(csl: unknown, doi: string, provedor: Provedor): MetadadosNormalizados {
  const m = obj(csl);
  const licenca = licencaDeCsl(m.license);
  const emissao = dataDeDateParts(m.issued ?? m.published ?? m["published-print"] ?? m["published-online"]);
  return {
    ancoraTipo: "doi",
    ancoraValor: doi,
    titulo: texto(m.title),
    veiculo: texto(m["container-title"]) || texto(m["short-container-title"]),
    editora: texto(m.publisher),
    ano: emissao.ano,
    publicadoEm: emissao.iso,
    tipo: tipoDoCrossref(texto(m.type)),
    tipoBruto: texto(m.type),
    autores: autoresDeCsl(m.author),
    issn: textos(m.ISSN),
    isbn: textos(m.ISBN),
    licenca,
    acessoAberto: acessoAbertoDaLicenca(licenca),
    paisEditora: texto(m["publisher-location"]) || null,
    url: texto(m.URL) || null,
    provedor,
    cru: csl,
  };
}

function deDataCite(payload: unknown, doi: string): MetadadosNormalizados {
  const at = obj(obj(obj(payload).data).attributes);
  const titulo = texto(obj(lista(at.titles)[0]).title);
  const tipoBruto = texto(obj(at.types).resourceTypeGeneral);
  const autores: AutorMeta[] = lista(at.creators).map((c, i) => {
    const o = obj(c);
    const ids = lista(o.nameIdentifiers).map(obj);
    const orcidBruto = ids.find((n) => /orcid/i.test(texto(n.nameIdentifierScheme)));
    return {
      ordem: i,
      nome: texto(o.name) || [texto(o.givenName), texto(o.familyName)].filter(Boolean).join(" "),
      orcid: orcidDaApi(orcidBruto ? texto(orcidBruto.nameIdentifier) : null),
      afiliacao: texto(obj(lista(o.affiliation)[0]).name) || (typeof lista(o.affiliation)[0] === "string" ? String(lista(o.affiliation)[0]) : null),
    };
  });
  const emitido = lista(at.dates).map(obj).find((d) => texto(d.dateType) === "Issued");
  const dataIso = /^\d{4}-\d{2}-\d{2}$/.test(texto(emitido?.date)) ? texto(emitido?.date) : null;
  const licenca = texto(obj(lista(at.rights)[0]).rightsUri) || null;
  const anoBruto = at.publicationYear;
  return {
    ancoraTipo: "doi",
    ancoraValor: doi,
    titulo,
    veiculo: texto(obj(at.container).title) || texto(at.publisher),
    editora: texto(at.publisher),
    ano: typeof anoBruto === "number" ? anoBruto : Number(texto(anoBruto)) || null,
    publicadoEm: dataIso,
    tipo: tipoDoDataCite(tipoBruto),
    tipoBruto,
    autores,
    issn: [],
    isbn: [],
    licenca,
    acessoAberto: acessoAbertoDaLicenca(licenca),
    paisEditora: null,
    url: texto(at.url) || null,
    provedor: "datacite",
    cru: payload,
  };
}

function deOpenLibrary(payload: unknown, isbn: string): MetadadosNormalizados | null {
  const raiz = obj(payload);
  const chave = Object.keys(raiz)[0];
  // ISBN inexistente devolve HTTP 200 com corpo `{}` — teste o corpo, nunca o
  // status (armadilha medida na apuração).
  if (!chave) return null;
  const livro = obj(raiz[chave]);
  const ano = Number((texto(livro.publish_date).match(/\b(1[89]\d{2}|20\d{2})\b/) ?? [])[0]) || null;
  return {
    ancoraTipo: "isbn",
    ancoraValor: isbn,
    titulo: texto(livro.title),
    veiculo: "",
    editora: texto(obj(lista(livro.publishers)[0]).name),
    ano,
    publicadoEm: null,
    tipo: "livro",
    tipoBruto: "book",
    autores: lista(livro.authors).map((a, i) => ({ ordem: i, nome: texto(obj(a).name), orcid: null, afiliacao: null })),
    issn: [],
    isbn: [isbn],
    licenca: null,
    acessoAberto: null,
    paisEditora: null,
    url: texto(livro.url) || null,
    provedor: "openlibrary",
    cru: payload,
  };
}

// =================================================================== cache

/**
 * Cache de sessão por âncora. O cache que importa de verdade é o do SERVIDOR
 * (`producoes.metadados`, o CSL cru gravado junto do item): gerar o relatório em
 * 2027 não pode depender de reconsultar 800 DOIs numa API externa que hoje é
 * grátis e amanhã pode não ser — o OpenAlex já virou regime de créditos.
 */
const cache = new Map<string, MetadadosNormalizados>();

export function limparCacheMetadados(): void {
  cache.clear();
}

export function tamanhoDoCacheMetadados(): number {
  return cache.size;
}

const chaveCache = (tipo: AncoraTipo, valor: string) => `${tipo}:${chaveAncora(tipo, valor)}`;

// ============================================================== resolvedores

async function porCrossref(doi: string, o: OpcoesRede): Promise<Resolucao> {
  const mailto = o.mailto ?? MAILTO_CROSSREF;
  const url = `${URL_CROSSREF}${encodeURIComponent(doi)}?mailto=${encodeURIComponent(mailto)}`;
  const r = await buscarJson(url, o);
  if (!r.ok) return falha(r.motivo, doi, ["crossref"]);
  const msg = obj(r.dados).message;
  if (!msg) return falha("formato", doi, ["crossref"]);
  return { ok: true, dados: deCsl(msg, doi, "crossref") };
}

async function porDataCite(doi: string, o: OpcoesRede): Promise<Resolucao> {
  const r = await buscarJson(`${URL_DATACITE}${encodeURIComponent(doi)}`, o);
  if (!r.ok) return falha(r.motivo, doi, ["datacite"]);
  const at = obj(obj(obj(r.dados).data).attributes);
  if (!Object.keys(at).length) return falha("formato", doi, ["datacite"]);
  return { ok: true, dados: deDataCite(r.dados, doi) };
}

async function porDoiOrg(doi: string, o: OpcoesRede): Promise<Resolucao> {
  const r = await buscarJson(`${URL_DOIORG}${encodeURIComponent(doi)}`, o, ACCEPT_CSL);
  if (!r.ok) return falha(r.motivo, doi, ["doiorg"]);
  const csl = obj(r.dados);
  if (!Object.keys(csl).length) return falha("formato", doi, ["doiorg"]);
  return { ok: true, dados: deCsl(csl, doi, "doiorg") };
}

const RESOLVEDORES: Record<ProvedorDoi, (doi: string, o: OpcoesRede) => Promise<Resolucao>> = {
  crossref: porCrossref,
  datacite: porDataCite,
  doiorg: porDoiOrg,
};

/**
 * A cadeia inteira para um DOI. Só desiste quando todos os provedores
 * desistiram — e, mesmo aí, devolve o DOI normalizado para a tela manual.
 *
 * Aborto do chamador (nova digitação) interrompe a cadeia na hora: continuar
 * gastaria cota resolvendo um DOI que a pessoa já apagou.
 */
export async function resolverDoi(bruto: string, o: OpcoesRede = {}): Promise<Resolucao> {
  const doi = normalizarDoi(bruto);
  if (!/^10\.\d{4,9}\/\S+$/.test(doi)) return falha("entrada_invalida", doi, []);

  const emCache = cache.get(chaveCache("doi", doi));
  if (emCache) return { ok: true, dados: emCache };

  const cadeia = o.cadeia ?? CADEIA_DOI;
  const tentados: Provedor[] = [];
  let ultimo: MotivoFalha = "nao_encontrado";

  for (const provedor of cadeia) {
    tentados.push(provedor);
    const r = await RESOLVEDORES[provedor](doi, o);
    if (r.ok) {
      cache.set(chaveCache("doi", doi), r.dados);
      return r;
    }
    if (r.motivo === "abortado") return falha("abortado", doi, tentados);
    ultimo = r.motivo;
  }
  return falha(ultimo, doi, tentados);
}

// ==================================== casamento por título (candidato Scholar)
/**
 * O Google Acadêmico lista artigos SEM DOI e com o título TRUNCADO. Para trazer
 * um item do Scholar para dentro do sistema — que deduplica por DOI — é preciso
 * DESCOBRIR o DOI, e a única âncora disponível é título + ano. Este bloco faz
 * isso pelo Crossref (`query.bibliographic` + filtro de data), e é DELIBERADAMENTE
 * conservador: um DOI afirmado por engano vira um trabalho de OUTra pessoa na
 * Tabela A do CNPq. Match fraco NÃO casa — o item fica sem DOI e a pessoa
 * confirma. Toda a lógica de decisão é PURA (`casarTituloAno`), testável a seco.
 */

const URL_CROSSREF_BUSCA = "https://api.crossref.org/works";

/** Limiar de similaridade para dar por casado um título NÃO truncado. */
export const LIMIAR_TITULO = 0.9;

/**
 * Prefixo mínimo (em caracteres já normalizados) para casar um título TRUNCADO.
 * Curto demais casaria "Estudo da..." com qualquer coisa; 20 é o piso seguro.
 */
export const MIN_PREFIXO_TRUNCADO = 20;

/** Um candidato do Crossref, reduzido ao que decide o casamento. */
export type CandidatoCrossref = {
  readonly doi: string;
  readonly titulo: string;
  readonly ano: number | null;
};

export type CasamentoTitulo = {
  readonly doi: string;
  readonly titulo: string;
  readonly ano: number | null;
  /** 0..1. Igualdade exata e prefixo de truncado valem 1. */
  readonly score: number;
};

/** Minúsculas, sem acento, só alfanumérico separado por um espaço. */
export function normalizarTitulo(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Similaridade de Dice sobre PALAVRAS (coeficiente 2·|A∩B| / (|A|+|B|)). Robusta
 * a reordenação e a uma palavra a mais ou a menos; não é sensível a pontuação
 * porque `normalizarTitulo` já a removeu.
 */
export function similaridadeTitulo(a: string, b: string): number {
  const ta = normalizarTitulo(a).split(" ").filter(Boolean);
  const tb = normalizarTitulo(b).split(" ").filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  const disponivel = new Map<string, number>();
  for (const w of tb) disponivel.set(w, (disponivel.get(w) ?? 0) + 1);
  let inter = 0;
  for (const w of ta) {
    const n = disponivel.get(w) ?? 0;
    if (n > 0) {
      inter += 1;
      disponivel.set(w, n - 1);
    }
  }
  return (2 * inter) / (ta.length + tb.length);
}

/**
 * A DECISÃO, pura: o melhor candidato que passa da barra, ou `null`.
 *  • ano tem de bater (tolerância de 1 ano — online vs. impresso);
 *  • título truncado casa por PREFIXO (o que o Scholar mostrou é começo do real)
 *    e só com prefixo longo o bastante (`MIN_PREFIXO_TRUNCADO`);
 *  • título inteiro casa por igualdade normalizada (score 1) ou similaridade de
 *    Dice ≥ `LIMIAR_TITULO`.
 */
export function casarTituloAno(
  titulo: string,
  ano: number | null,
  candidatos: readonly CandidatoCrossref[],
  truncado = false,
): CasamentoTitulo | null {
  const alvo = normalizarTitulo(titulo);
  if (!alvo) return null;

  let melhor: CasamentoTitulo | null = null;
  for (const c of candidatos) {
    if (!c.doi) continue;
    if (ano !== null && c.ano !== null && Math.abs(c.ano - ano) > 1) continue;

    const cand = normalizarTitulo(c.titulo);
    let score: number;
    if (truncado) {
      score = alvo.length >= MIN_PREFIXO_TRUNCADO && cand.startsWith(alvo) ? 1 : 0;
    } else {
      score = cand === alvo ? 1 : similaridadeTitulo(titulo, c.titulo);
    }

    if (score >= LIMIAR_TITULO && (!melhor || score > melhor.score)) {
      melhor = { doi: c.doi, titulo: c.titulo, ano: c.ano, score };
    }
  }
  return melhor;
}

/**
 * Busca no Crossref por título e devolve o DOI do casamento FORTE, ou `null`.
 * O filtro de data no servidor restringe a janela; `casarTituloAno` decide.
 * Nunca lança (o `buscarJson` já degrada toda falha em `null`).
 */
export async function buscarDoiPorTitulo(
  titulo: string,
  ano: number | null,
  o: OpcoesRede & { truncado?: boolean } = {},
): Promise<CasamentoTitulo | null> {
  const consulta = (titulo ?? "").replace(/[…\.]+$/g, "").trim();
  if (consulta.length < 6) return null;

  const mailto = o.mailto ?? MAILTO_CROSSREF;
  const url =
    `${URL_CROSSREF_BUSCA}?query.bibliographic=${encodeURIComponent(consulta)}` +
    `&rows=5&select=DOI,title,issued&mailto=${encodeURIComponent(mailto)}` +
    (ano !== null ? `&filter=from-pub-date:${ano - 1}-01-01,until-pub-date:${ano + 1}-12-31` : "");

  const r = await buscarJson(url, o);
  if (!r.ok) return null;

  const itens: CandidatoCrossref[] = lista(obj(obj(r.dados).message).items).map((it) => {
    const m = obj(it);
    return { doi: normalizarDoi(texto(m.DOI)), titulo: texto(m.title), ano: dataDeDateParts(m.issued).ano };
  });
  return casarTituloAno(titulo, ano, itens, o.truncado === true);
}

/** Livro por ISBN. Conveniência: a validação do dígito já rodou em validation.ts. */
export async function resolverIsbn(bruto: string, o: OpcoesRede = {}): Promise<Resolucao> {
  const isbn = normalizarIsbn(bruto);
  if (isbn.length !== 10 && isbn.length !== 13) return falha("entrada_invalida", isbn, []);

  const emCache = cache.get(chaveCache("isbn", isbn));
  if (emCache) return { ok: true, dados: emCache };

  const url = `${URL_OPENLIBRARY}?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
  const r = await buscarJson(url, o);
  if (!r.ok) return falha(r.motivo, isbn, ["openlibrary"]);
  const dados = deOpenLibrary(r.dados, isbn);
  if (!dados) return falha("nao_encontrado", isbn, ["openlibrary"]);
  cache.set(chaveCache("isbn", isbn), dados);
  return { ok: true, dados };
}

// ============================================================ fila de 3

/**
 * Fila de concorrência. Mantém a ordem do resultado igual à da entrada — a tela
 * mostra a lista na ordem em que a pessoa colou, não na ordem em que a rede
 * respondeu.
 */
export async function executarComConcorrencia<T, R>(
  itens: readonly T[],
  limite: number,
  tarefa: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados = new Array<R>(itens.length);
  let proximo = 0;
  const trabalhador = async (): Promise<void> => {
    for (;;) {
      const i = proximo++;
      if (i >= itens.length) return;
      resultados[i] = await tarefa(itens[i], i);
    }
  };
  const n = Math.max(1, Math.min(limite, itens.length));
  await Promise.all(Array.from({ length: n }, trabalhador));
  return resultados;
}

export type ItemLote = { readonly entrada: string; readonly resultado: Resolucao };

/**
 * "Colar vários de uma vez" (Tela 2). Concorrência 3, que é o que o polite pool
 * do Crossref permite; 9 DOIs em lotes de 3 levaram 4,1 s na medição real.
 */
export async function resolverLote(dois: readonly string[], o: OpcoesRede = {}): Promise<ItemLote[]> {
  return executarComConcorrencia(dois, CONCORRENCIA, async (entrada) => ({
    entrada,
    resultado: await resolverDoi(entrada, o),
  }));
}

// ==================================================================== ORCID

export type PrecisaoData = "dia" | "mes" | "ano" | "nenhuma";

export type TrabalhoOrcid = {
  readonly putCode: number | null;
  readonly titulo: string;
  readonly veiculo: string;
  readonly tipoBruto: string;
  readonly doi: string | null;
  readonly ano: number | null;
  readonly mes: number | null;
  readonly dia: number | null;
  readonly precisao: PrecisaoData;
  /** Data usada para competência — mesma convenção do banco (ver abaixo). */
  readonly dataCompetencia: string | null;
  readonly situacao: SituacaoData;
  /**
   * Ano solto cujo ano civil cruza a janela: pode ser de dentro ou de fora, e
   * ninguém sabe. Vai para a tela ROTULADO e PRÉ-DESMARCADO — a pessoa decide.
   * Medido: 14% dos trabalhos do ORCID trazem só o ano.
   */
  readonly ambiguo: boolean;
};

export type ListaOrcid =
  | { readonly ok: true; readonly trabalhos: readonly TrabalhoOrcid[] }
  | { readonly ok: false; readonly motivo: MotivoFalha; readonly mensagem: string };

function numeroDe(v: unknown): number | null {
  const o = obj(v);
  const valor = o.value ?? v;
  if (typeof valor === "number") return valor;
  if (typeof valor === "string" && /^\d+$/.test(valor)) return Number(valor);
  return null;
}

/**
 * Trabalhos declarados no ORCID da pessoa.
 *
 * Conta GROUP, não work-summary: o mesmo trabalho aparece uma vez por fonte que
 * o declarou, e somar summaries infla o "encontramos N produções suas" —
 * exatamente o número que a pessoa vai usar para julgar se o sistema presta.
 *
 * `Accept: application/json` é OBRIGATÓRIO: sem ele a API devolve XML.
 *
 * A janela NÃO filtra no servidor (a rota não aceita filtro de data); o filtro é
 * do cliente, e é deliberadamente inclusivo — ver `ambiguo`.
 */
export async function trabalhosDoOrcid(
  orcid: string,
  periodo: Periodo = PERIODO_CICLO_1,
  o: OpcoesRede = {},
): Promise<ListaOrcid> {
  const id = orcid.trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, "");
  if (!/^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$/i.test(id)) {
    return { ok: false, motivo: "entrada_invalida", mensagem: MENSAGENS.orcidFormato };
  }
  const r = await buscarJson(`${URL_ORCID}${id}/works`, o);
  if (!r.ok) return { ok: false, motivo: r.motivo, mensagem: r.motivo === "nao_encontrado" ? "" : MSG_DEGRADA_MANUAL };

  const grupos = lista(obj(r.dados).group);
  const trabalhos = grupos.map((g) => lerGrupoOrcid(g, periodo)).filter((t): t is TrabalhoOrcid => t !== null);
  return { ok: true, trabalhos };
}

function lerGrupoOrcid(grupo: unknown, periodo: Periodo): TrabalhoOrcid | null {
  const g = obj(grupo);
  const resumo = obj(lista(g["work-summary"])[0]);
  if (!Object.keys(resumo).length) return null;

  const ids = lista(obj(g["external-ids"])["external-id"]).map(obj);
  const doiBruto = ids.find((x) => texto(x["external-id-type"]).toLowerCase() === "doi");
  const doi = doiBruto ? normalizarDoi(texto(doiBruto["external-id-value"])) : null;

  const data = obj(resumo["publication-date"]);
  const ano = numeroDe(data.year);
  const mes = numeroDe(data.month);
  const dia = numeroDe(data.day);

  const precisao: PrecisaoData = ano === null ? "nenhuma" : dia !== null && mes !== null ? "dia" : mes !== null ? "mes" : "ano";

  /*
   * Convenção de competência, idêntica à de `resolver_competencia_producao()` no
   * 005: dia conhecido → a data; só mês → dia 1 (e como a janela do Ciclo 1 é
   * alinhada ao mês — 01/05 a 30/04 — precisão de mês NÃO é ambígua); só ano →
   * meio do ano, que é a convenção documentada do banco.
   */
  const dataCompetencia =
    precisao === "dia" ? `${ano}-${p2(mes as number)}-${p2(dia as number)}`
    : precisao === "mes" ? `${ano}-${p2(mes as number)}-01`
    : precisao === "ano" ? `${ano}-07-01`
    : null;

  const avaliacao = dataCompetencia ? avaliarData(dataCompetencia, periodo, "9999-12-31") : null;
  const ambiguo = precisao === "ano" && ano !== null && anoCruzaJanela(ano, periodo);

  return {
    putCode: numeroDe(resumo["put-code"]),
    titulo: texto(obj(obj(resumo.title).title).value),
    veiculo: texto(obj(resumo["journal-title"]).value),
    tipoBruto: texto(resumo.type),
    doi: doi || null,
    ano,
    mes,
    dia,
    precisao,
    dataCompetencia,
    situacao: avaliacao ? avaliacao.situacao : "sem_data",
    ambiguo,
  };
}

/** O ano civil tem algum dia dentro da janela? (então "2025" sozinho é dúvida) */
export function anoCruzaJanela(ano: number, periodo: Periodo): boolean {
  return `${ano}-12-31` >= periodo.inicio && `${ano}-01-01` <= periodo.fim;
}

export type SeparacaoOrcid = {
  readonly noPeriodo: readonly TrabalhoOrcid[];
  /** Ano solto que pode ser de dentro: mostrar rotulado e pré-desmarcado. */
  readonly ambiguos: readonly TrabalhoOrcid[];
  readonly fora: readonly TrabalhoOrcid[];
};

export function separarPorPeriodo(trabalhos: readonly TrabalhoOrcid[]): SeparacaoOrcid {
  const noPeriodo: TrabalhoOrcid[] = [];
  const ambiguos: TrabalhoOrcid[] = [];
  const fora: TrabalhoOrcid[] = [];
  for (const t of trabalhos) {
    if (t.ambiguo) ambiguos.push(t);
    else if (t.situacao === "no_periodo") noPeriodo.push(t);
    else fora.push(t);
  }
  return { noPeriodo, ambiguos, fora };
}

export type CandidatoOrcid = {
  readonly orcid: string;
  readonly nome: string;
  readonly instituicoes: readonly string[];
};

/**
 * "Não lembro o meu ORCID" (Tela 1). Sintaxe Solr/Lucene — consulta livre por
 * nome completo funciona pior.
 *
 * A apuração avisa: `institution-name` veio VAZIO no teste real, então a tela de
 * desambiguação não pode contar com a instituição para a pessoa se reconhecer.
 * Com sobrenome brasileiro comum a lista vem longa e sem critério de desempate —
 * mostre também os títulos recentes de cada candidato antes da escolha.
 */
export async function buscarOrcidPorNome(nome: string, o: OpcoesRede = {}): Promise<{ ok: true; candidatos: CandidatoOrcid[] } | { ok: false; motivo: MotivoFalha }> {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return { ok: true, candidatos: [] };
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  const q = `given-names:${primeiro} AND family-name:${ultimo}`;
  const r = await buscarJson(`${URL_ORCID}expanded-search/?q=${encodeURIComponent(q)}&rows=20`, o);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  const candidatos = lista(obj(r.dados)["expanded-result"]).map((c) => {
    const x = obj(c);
    return {
      orcid: texto(x["orcid-id"]),
      nome: [texto(x["given-names"]), texto(x["family-names"])].filter(Boolean).join(" ") || texto(x["credit-name"]),
      instituicoes: textos(x["institution-name"]),
    };
  });
  return { ok: true, candidatos };
}

// ====================================================================== ROR

export type CandidatoRor = {
  /** Id NU, sem `https://ror.org/` — é como o banco guarda. */
  readonly rorId: string;
  readonly nome: string;
  readonly pais: string | null;
  /**
   * UF QUE O ROR DIZ — e que precisa de confirmação humana. Medido: a FIOCRUZ
   * Rondônia não tem registro ROR e a busca resolve para a sede no RJ. Derivar a
   * UF do ROR classificaria a instituição-sede do próprio INCT como RJ, e o
   * Indicador 3 conta ESTADOS. A UF é campo declarado; isto é sugestão.
   */
  readonly ufSugerida: string | null;
  readonly cidade: string | null;
};

/**
 * Busca de instituição. Devolve LISTA, sempre — nunca escolha automática: a v1
 * do ROR devolveu 11.610 resultados para uma consulta com uma resposta só.
 * Aceitar o primeiro é como acertar por sorte e errar em silêncio.
 */
export async function buscarRor(consulta: string, o: OpcoesRede = {}): Promise<{ ok: true; candidatos: CandidatoRor[] } | { ok: false; motivo: MotivoFalha }> {
  const termo = consulta.trim();
  if (termo.length < 3) return { ok: true, candidatos: [] };
  const r = await buscarJson(`${URL_ROR}?query=${encodeURIComponent(termo)}`, o);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  const candidatos = lista(obj(r.dados).items).map((it) => {
    const x = obj(it);
    const nomes = lista(x.names).map(obj);
    const display = nomes.find((n) => textos(n.types).includes("ror_display")) ?? nomes[0];
    const local = obj(obj(lista(x.locations)[0]).geonames_details);
    return {
      rorId: texto(x.id).replace(/^https?:\/\/ror\.org\//i, ""),
      nome: texto(display?.value),
      pais: texto(local.country_code) || null,
      ufSugerida: texto(local.country_subdivision_code) || null,
      cidade: texto(local.name) || null,
    };
  });
  return { ok: true, candidatos };
}
