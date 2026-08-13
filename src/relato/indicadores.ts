/**
 * ============================================================================
 *  Índice H e total de citações — o autopreenchimento da Q14 (Tela 1)
 * ============================================================================
 *  O PEDIDO: "índice H e citações devem ser extraídos automaticamente do Google
 *  Scholar do pesquisador". O que segue é o que a apuração empírica permitiu
 *  construir, e onde ela impôs fronteira. Nada aqui é suposição — cada número
 *  citado nos comentários foi medido em 10/08/2026 (curl, WSL).
 *
 *  1. GOOGLE SCHOLAR NÃO TEM CORS. Medido com e sem cabeçalho `Origin`: o
 *     `access-control-allow-origin` simplesmente não existe na resposta. Este
 *     site é estático e roda no navegador do pesquisador; logo, `fetch` direto
 *     do Scholar é IMPOSSÍVEL — não por política nossa, por mecânica do
 *     navegador. Só com proxy do lado servidor, que é a Edge Function
 *     `supabase/functions/indicadores` (migração 010).
 *
 *  2. O robots.txt DO SCHOLAR DIVIDE O MUNDO EM DOIS (lido em 10/08/2026):
 *         Disallow: /citations?
 *         Allow:    /citations?user=
 *         Disallow: /citations?*cstart=
 *         Disallow: /citations?user=*@   e   /citations?user=*%40
 *     LER UM PERFIL CONHECIDO É PERMITIDO. PROCURAR AUTOR POR NOME NÃO É
 *     (`view_op=search_authors` cai no `Disallow: /citations?`). Esta é a
 *     fronteira dura do módulo: NÃO EXISTE, e não pode passar a existir, busca
 *     de autor por nome no Scholar. Por nome só o OpenAlex responde — e ainda
 *     assim rotulado como incerto (ver `buscarNoOpenAlexPorNome`).
 *     O `Disallow` de `user=*@` é a razão de `extrairScholarId` recusar `@`.
 *
 *  3. O ID DO PERFIL (`user=`) É OPACO E NÃO O TEMOS PARA NINGUÉM dos ~209.
 *     Tentado descobri-lo pelo ORCID: `pub.orcid.org/v3.0/<orcid>/researcher-urls`
 *     é CORS-aberto e funciona, mas veio VAZIO nos 4 pesquisadores reais
 *     testados — ninguém preenche esse campo. Descoberta automática do id NÃO
 *     EXISTE. Por isso o desenho é: a pessoa cola o link do perfil UMA VEZ
 *     (fica em `ciclo_membros.scholar_id`), e daí em diante é automático.
 *
 *  4. O OPENALEX É A REDE DE SEGURANÇA, E ELA FUNCIONA HOJE. CORS aberto
 *     (`access-control-allow-origin: *`), sem chave, e traz
 *     `summary_stats.h_index`, `summary_stats.i10_index` e `cited_by_count`.
 *     A Tela 1 já descobre o ORCID sozinha, então este caminho custa ZERO ação
 *     do pesquisador e ZERO infraestrutura. É o preenchimento automático padrão
 *     quando não há `scholar_id`.
 *
 *  5. AS DUAS FONTES NÃO SÃO A MESMA COISA, E A TELA NUNCA PODE FINGIR QUE SÃO.
 *     O corpus do OpenAlex é menor que o do Scholar, e o h sai menor. Por isso
 *     TODO retorno deste módulo carrega `fonte` e uma frase pronta
 *     (`procedencia`) — "segundo o OpenAlex", "do seu Google Acadêmico,
 *     atualizado em 10/08". Número sem fonte, em relatório de agência, é
 *     passivo: é exatamente o que a coluna `indicadores_fonte` da 010 existe
 *     para impedir.
 *
 *  O CAMPO NUNCA DEIXA DE SER EDITÁVEL. Isto aqui produz SUGESTÃO; quem decide
 *  é o pesquisador, e o que ele sobrescrever vira `indicadores_fonte='manual'`.
 *
 *  NADA NESTE ARQUIVO LANÇA EXCEÇÃO — mesmo princípio de `metadados.ts`: toda
 *  função devolve um objeto com o resultado ou o motivo. Falha de indicador não
 *  pode travar um relatório anual.
 * ============================================================================
 */

import { PERIODO_CICLO_1, type Periodo } from "./validation";
import { anoCruzaJanela, buscarDoiPorTitulo, type OpcoesRede } from "./metadados";

// ==================================================================== tipos

/** Espelha o CHECK de `ciclo_membros.indicadores_fonte` (migração 010). */
export type IndicadoresFonte = "scholar" | "openalex" | "manual";

/**
 * Por que a busca não deu número. `indisponivel` é o caso mais importante e o
 * mais provável no começo: a Edge Function ainda não foi publicada. Ele NÃO é
 * erro — é o sinal para cair no OpenAlex em silêncio.
 */
export type MotivoIndicadores =
  | "bloqueado"        // CAPTCHA, 403 ou 429 do Scholar. Nunca se contorna.
  | "nao_encontrado"   // 404: o id não existe (ou o perfil ficou privado).
  | "invalido"         // o texto colado não tem um id de perfil dentro.
  | "indisponivel"     // função não publicada, plataforma off, rede caiu.
  | "sem_identificador"// nem ORCID nem scholar_id: não há o que buscar.
  | "erro";

/** O que a Edge Function devolve quando dá certo. */
export type IndicadoresScholar = {
  readonly h_index: number | null;
  readonly citacoes: number | null;
  readonly i10: number | null;
  readonly nome: string | null;
  readonly afiliacao: string | null;
  /** ISO. Quando o Scholar foi LIDO — não quando a tela perguntou. */
  readonly atualizado_em: string | null;
  readonly do_cache: boolean;
};

export type RespostaScholar =
  | { readonly ok: true; readonly dados: IndicadoresScholar }
  | { readonly ok: false; readonly motivo: MotivoIndicadores };

export type IndicadoresOpenAlex = {
  readonly h_index: number | null;
  readonly citacoes: number | null;
  readonly i10: number | null;
  readonly nome: string | null;
  readonly afiliacao: string | null;
};

/** O retorno da orquestração. `fonte: null` = não houve número nenhum. */
export type Indicadores = {
  readonly fonte: IndicadoresFonte | null;
  readonly h_index: number | null;
  readonly citacoes: number | null;
  readonly i10: number | null;
  readonly nome: string | null;
  readonly afiliacao: string | null;
  readonly atualizado_em: string | null;
  readonly do_cache: boolean;
  /**
   * `true` só quando o número veio de casamento por NOME (homônimo comprovado:
   * ver `buscarNoOpenAlexPorNome`). A orquestração automática nunca produz
   * `true` — ela só usa ORCID e scholar_id, que são identificadores.
   */
  readonly incerto: boolean;
  readonly motivo: MotivoIndicadores | null;
  /** Frase pronta para a tela. Nunca vazia. */
  readonly procedencia: string;
};

export type OpcoesIndicadores = {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly mailto?: string;
};

// =============================================================== constantes

/**
 * Contato do polite pool do OpenAlex — o mesmo do rodapé do site e o mesmo já
 * usado no Crossref (`MAILTO_CROSSREF` em metadados.ts). Sem ele o OpenAlex
 * rebaixa para o pool comum; com ele, identifica quem está chamando, que é o
 * comportamento honesto e o que a política do serviço pede.
 */
export const MAILTO = "inctconexao@gmail.com";

/** A Edge Function é servidor: 12 s, não os 8 s das APIs diretas. */
export const TIMEOUT_MS = 12000;

const URL_OPENALEX = "https://api.openalex.org";

/** O nome da função no Supabase. Trocar aqui e no `deploy` é a mesma coisa. */
export const FUNCAO_EDGE = "indicadores";

/**
 * Formato do id de perfil do Scholar. Os ids observados têm 12 caracteres
 * (`JicYPdAAAAAJ`, `kukA0LcAAAAJ`), mas a faixa 8..20 é a contenção
 * proporcional: rejeita lixo colado sem apostar numa largura que o Google
 * nunca documentou. O alfabeto é base64url — e é ele que exclui `@`, que o
 * robots.txt manda não buscar. O MESMO regex está no CHECK da 010 e na Edge
 * Function; os três precisam andar juntos.
 */
export const RE_SCHOLAR_ID = /^[A-Za-z0-9_-]{8,20}$/;

/**
 * Os hosts de onde um `user=` significa alguma coisa: o Google Acadêmico em
 * qualquer domínio regional (`scholar.google.com`, `.com.br`, `.co.uk`).
 * QUALQUER OUTRO HOST É RECUSA, e a razão é a mesma da regra de ouro deste
 * arquivo: `?user=` é um nome de parâmetro banal, que aparece em URL de meia
 * internet. Sem esta checagem, colar
 * `https://outrosite.exemplo/perfil?user=ABCDEFGH` produziria o id `ABCDEFGH`,
 * que iria ao Scholar e voltaria com o h DE OUTRA PESSOA — rotulado "do seu
 * Google Acadêmico". Um id errado é pior que nenhum.
 */
export const RE_HOST_SCHOLAR = /^scholar\.google\.[a-z]{2,}(?:\.[a-z]{2,})?$/i;

/**
 * O host que está dentro do texto colado, ou `null` quando não há endereço
 * nenhum ali (id cru, `citations?user=…` sem domínio). Aceita `//host` sem
 * esquema e `host/caminho` sem `//`, descarta userinfo (`a@host`) e porta.
 */
function hostColado(t: string): string | null {
  const comBarras = t.match(/(?:[a-z][a-z0-9+.-]*:)?\/\/([^/?#\s"']+)/i);
  const cru = comBarras
    ? comBarras[1]
    : (t.match(/^([a-z0-9][a-z0-9.-]*\.[a-z]{2,})(?=[/?#])/i)?.[1] ?? null);
  if (!cru) return null;
  const semUserinfo = cru.slice(cru.lastIndexOf("@") + 1);
  return semUserinfo.split(":")[0].toLowerCase() || null;
}

// ============================================ 1. LÓGICA PURA (testável a seco)

/**
 * O id do perfil a partir do que a pessoa colou. Aceita:
 *   • a URL inteira, com querystring em qualquer ordem e `&amp;` de copiar-colar
 *     de HTML: `https://scholar.google.com/citations?hl=pt-BR&user=ABC12345`
 *   • a URL de qualquer domínio regional (`scholar.google.com.br`, `.co.uk`…)
 *   • o id cru: `ABC12345`
 * Devolve `null` para qualquer coisa que não caiba em `RE_SCHOLAR_ID` — inclui,
 * de propósito, ids com `@` (o `Disallow: /citations?user=*@` do robots.txt) —
 * e para qualquer endereço que NÃO seja do Google Acadêmico, mesmo que traga um
 * `?user=` com cara certa (ver `RE_HOST_SCHOLAR`).
 *
 * PURA: mesma entrada, mesma saída, sem rede.
 */
export function extrairScholarId(texto: string): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;

  // 1) Se há um ENDEREÇO no que foi colado, ele tem de ser do Google Acadêmico.
  //    Sem host (id cru, `citations?user=…`) segue adiante — ver `hostColado`.
  const host = hostColado(t);
  if (host && !RE_HOST_SCHOLAR.test(host)) return null;

  // 2) Tem `user=` em algum lugar? Então é URL (ou pedaço de uma). Pega o
  //    PRIMEIRO `user=`, tolerando `&amp;` e separadores bagunçados.
  const naUrl = t.replace(/&amp;/gi, "&").match(/[?&#]user=([^&#\s"']+)/i);
  if (naUrl) {
    const cru = decodeURIComponentSeguro(naUrl[1]);
    return RE_SCHOLAR_ID.test(cru) ? cru : null;
  }

  // 3) Não tem `user=`: só aceitamos se o texto INTEIRO for o id. Vasculhar uma
  //    URL qualquer atrás de um token com cara de id acharia `citations` e
  //    `scholar` — e um id errado é pior que nenhum, porque produz o número de
  //    outra pessoa sem nenhum sinal na tela.
  return RE_SCHOLAR_ID.test(t) ? t : null;
}

function decodeURIComponentSeguro(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v; // `%` solto: devolve como veio e deixa o regex reprovar.
  }
}

/** O que sai de um perfil do Scholar lido. `null` em qualquer campo ausente. */
export type PerfilScholar = {
  readonly nome: string | null;
  readonly afiliacao: string | null;
  /** Coluna "Todas" da tabela de indicadores. */
  readonly citacoes: number | null;
  readonly h_index: number | null;
  readonly i10: number | null;
  /** Coluna "Desde 20XX" — guardada porque é grátis; a Q14 usa a de cima. */
  readonly citacoes_recentes: number | null;
  readonly h_index_recente: number | null;
  readonly i10_recente: number | null;
};

/**
 * O parser do HTML do perfil. PURA — recebe string, devolve objeto.
 *
 * ⚠ ESTA FUNÇÃO ESTÁ DUPLICADA, LITERALMENTE, EM
 *   `supabase/functions/indicadores/index.ts`. Deno não compartilha módulo com
 *   o bundle do Vite (este arquivo importa `../platform/supabaseClient`, que só
 *   existe sob `import.meta.env`), e um pacote publicado só para 40 linhas de
 *   regex seria infraestrutura maior que o problema. AS DUAS CÓPIAS DEVEM
 *   ANDAR JUNTAS: mexeu aqui, mexa lá, e rode a prova com HTML real.
 *
 * O QUE O HTML REAL ENSINOU (medido em 2 perfis públicos, 10/08/2026):
 *  • A tabela sai em `<td class="gsc_rsb_std">N</td>`, SEIS células, nesta
 *    ordem: [citações_total, citações_desde, h_total, h_desde, i10_total,
 *    i10_desde]. Conferido: Hinton 1070076/607406, 194/133, 539/397.
 *  • Os nomes de classe TAMBÉM aparecem no CSS embutido da própria página
 *    (`.gsc_rsb_std{text-align:right}`). Por isso todo regex daqui ancora na
 *    TAG (`<td class=`, `<div class=`), nunca no nome da classe solto — um
 *    `indexOf("gsc_rsb_std")` casa com a folha de estilo e lê lixo.
 *  • A afiliação é o PRIMEIRO `<div class="gsc_prf_il">` — os outros dois divs
 *    da mesma classe trazem `id=` (`gsc_prf_ivh` = e-mail confirmado,
 *    `gsc_prf_int` = interesses) e por isso não casam com o `">` exigido logo
 *    após a classe. Ela contém `<a>` dentro ("Emeritus Prof. …, <a>University
 *    of Toronto</a>"), então as tags são removidas e o texto é remontado.
 */
export function parsearPerfilScholar(html: string): PerfilScholar | null {
  if (!html) return null;

  const celulas = [...html.matchAll(/<td class="gsc_rsb_std">\s*([\d.,\s]+?)\s*<\/td>/g)].map((m) =>
    inteiroDe(m[1]),
  );

  // 6 células = layout normal (duas colunas). 3 = só a coluna "Todas", que
  // nunca foi observado mas é inequívoco se acontecer. Qualquer outra
  // contagem é HTML que não entendemos — e devolver null aqui é o que faz a
  // Edge Function reportar 'bloqueado' em vez de inventar número.
  let citacoes: number | null = null;
  let h_index: number | null = null;
  let i10: number | null = null;
  let citacoes_recentes: number | null = null;
  let h_index_recente: number | null = null;
  let i10_recente: number | null = null;

  if (celulas.length >= 6) {
    [citacoes, citacoes_recentes, h_index, h_index_recente, i10, i10_recente] = celulas;
  } else if (celulas.length === 3) {
    [citacoes, h_index, i10] = celulas;
  } else {
    return null;
  }

  const nomeBruto = html.match(/id="gsc_prf_in"[^>]*>([\s\S]*?)<\//);
  const afiliacaoBruta = html.match(/<div class="gsc_prf_il">([\s\S]*?)<\/div>/);

  return {
    nome: textoLimpo(nomeBruto?.[1]),
    afiliacao: textoLimpo(afiliacaoBruta?.[1]),
    citacoes,
    h_index,
    i10,
    citacoes_recentes,
    h_index_recente,
    i10_recente,
  };
}

/** Dígitos de uma célula. Separador de milhar não foi observado; é defesa. */
function inteiroDe(v: string): number | null {
  const d = (v ?? "").replace(/[^\d]/g, "");
  if (!d) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

/** Tira tags, resolve entidades e normaliza espaço. `""` vira `null`. */
function textoLimpo(v: string | undefined): string | null {
  if (!v) return null;
  const t = decodificarEntidades(v.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return t || null;
}

/** As entidades que o Scholar realmente emite, mais a forma numérica. */
export function decodificarEntidades(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&"); // por último, senão `&amp;lt;` viraria `<`
}

// ======================================= ARTIGOS DO PERFIL (parser puro)
/**
 * A MESMA página de perfil que traz a tabela de indicadores lista os ARTIGOS.
 * Com `&pagesize=100&sortby=pubdate` (montado na Edge Function) ela devolve até
 * 100 itens numa carga só, do mais recente para o mais antigo — e `sortby`/
 * `pagesize` NÃO acrescentam `cstart`, então a carga cabe no `Allow` do
 * robots.txt. Este parser é o que a prova a seco roda; a Edge Function tem a
 * cópia que roda em produção.
 *
 * ⚠ `parsearArtigosScholar`, `lerLinhaArtigo` e `absolutizarScholar` estão
 *   DUPLICADAS, LITERALMENTE, em `supabase/functions/indicadores/index.ts`, pelo
 *   mesmo motivo de `parsearPerfilScholar`: Deno não compartilha módulo com o
 *   bundle do Vite. AS DUAS CÓPIAS DEVEM ANDAR JUNTAS — `tests/relato-scholar-
 *   artigos.test.ts` compara as duas caractere a caractere.
 *
 * O QUE O HTML REAL ENSINOU (perfil público, 12/08/2026):
 *  • cada artigo é um `<tr class="gsc_a_tr">`;
 *  • o título é o `<a class="gsc_a_at">` — e vem TRUNCADO com `&#8230;` (→ `…`)
 *    quando é longo, o que `truncado` registra sem esconder;
 *  • há dois `<div class="gs_gray">`: o primeiro são os autores, o segundo o
 *    veículo (com o ano repetido dentro de um `<span class="gs_oph">`, removido
 *    para não sujar o veículo);
 *  • o ano fica em `<span class="gsc_a_h …">AAAA` na coluna `gsc_a_y`;
 *  • o link do item é relativo (`/citations?…`) e é tornado absoluto.
 * NÃO HÁ DOI na lista do perfil — por isso cada item entra como CANDIDATO a
 * confirmar (ver `resolverArtigoADoi`).
 */
export type ArtigoDoScholar = {
  readonly titulo: string;
  readonly veiculo: string;
  readonly autores: string;
  readonly ano: number | null;
  readonly link: string | null;
  /** `true` quando o título veio cortado com reticência: casa por PREFIXO. */
  readonly truncado: boolean;
};

function absolutizarScholar(href: string): string {
  return href.startsWith("/") ? `https://scholar.google.com${href}` : href;
}

function lerLinhaArtigo(bloco: string): ArtigoDoScholar | null {
  const tituloMarcado = bloco.match(/<a [^>]*class="gsc_a_at"[^>]*>([\s\S]*?)<\/a>/);
  const titulo = textoLimpo(tituloMarcado?.[1]) ?? "";
  if (!titulo) return null;
  const truncado = /…$/.test(titulo);
  const href = bloco.match(/<a href="([^"]*)"[^>]*class="gsc_a_at"/)?.[1] ?? null;
  const link = href ? absolutizarScholar(decodificarEntidades(href)) : null;
  const cinzas = [...bloco.matchAll(/<div class="gs_gray">([\s\S]*?)<\/div>/g)].map((g) => g[1]);
  const autores = textoLimpo(cinzas[0]) ?? "";
  const veiculoCru = (cinzas[1] ?? "").replace(/<span class="gs_oph">[\s\S]*?<\/span>/g, "");
  const veiculo = textoLimpo(veiculoCru) ?? "";
  const anoTexto = bloco.match(/<span class="gsc_a_h[^"]*">\s*(\d{4})/)?.[1];
  const ano = anoTexto ? Number(anoTexto) : null;
  return { titulo, veiculo, autores, ano, link, truncado };
}

export function parsearArtigosScholar(html: string): ArtigoDoScholar[] {
  if (!html) return [];
  const artigos: ArtigoDoScholar[] = [];
  const linhas = html.matchAll(/<tr class="gsc_a_tr">([\s\S]*?)<\/tr>/g);
  for (const linha of linhas) {
    const artigo = lerLinhaArtigo(linha[1]);
    if (artigo) artigos.push(artigo);
  }
  return artigos;
}

/**
 * A frase que a tela mostra ao lado do número. É aqui, e só aqui, que se decide
 * como cada fonte é NOMEADA — o requisito de nunca apresentar OpenAlex como se
 * fosse Scholar vira uma função, não uma disciplina de quem escreve JSX.
 */
export function fraseDeProcedencia(
  fonte: IndicadoresFonte | null,
  atualizadoEm: string | null,
  incerto = false,
): string {
  const quando = dataCurta(atualizadoEm);
  switch (fonte) {
    case "scholar":
      return quando
        ? `do seu Google Acadêmico, atualizado em ${quando}`
        : "do seu Google Acadêmico";
    case "openalex":
      return incerto
        ? "segundo o OpenAlex, por semelhança de nome: confira se é você"
        : "segundo o OpenAlex (a base é menor que a do Google Acadêmico, e o número costuma ser mais baixo)";
    case "manual":
      return "informado por você";
    default:
      return "não conseguimos buscar agora: preencha a partir do seu perfil";
  }
}

/** `2026-08-10T14:41:53Z` → `10/08`. Entrada inválida some sem estardalhaço. */
export function dataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** O objeto de "não deu" — sempre com fonte declarada (aqui, `null`). */
export function semIndicadores(motivo: MotivoIndicadores): Indicadores {
  return {
    fonte: null,
    h_index: null,
    citacoes: null,
    i10: null,
    nome: null,
    afiliacao: null,
    atualizado_em: null,
    do_cache: false,
    incerto: false,
    motivo,
    procedencia: fraseDeProcedencia(null, null),
  };
}

// =================================================================== 2. REDE

type RespostaBruta = { ok: true; dados: unknown } | { ok: false; motivo: MotivoIndicadores };

/**
 * GET com timeout próprio, encadeável ao AbortController da tela. Nunca lança.
 *
 * Não reusa o `buscarJson` de `metadados.ts` de propósito: aquele é privado
 * daquele módulo e fala em `MotivoFalha` (o vocabulário de resolução de DOI).
 * Exportá-lo para cá acoplaria dois módulos que só se parecem por fora.
 */
async function buscarJson(url: string, o: OpcoesIndicadores): Promise<RespostaBruta> {
  const controle = new AbortController();
  const externo = o.signal;
  if (externo?.aborted) return { ok: false, motivo: "indisponivel" };

  const repassar = () => controle.abort();
  externo?.addEventListener("abort", repassar);
  const relogio = setTimeout(() => controle.abort(), o.timeoutMs ?? TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controle.signal, headers: { Accept: "application/json" } });
    if (res.status === 404) return { ok: false, motivo: "nao_encontrado" };
    if (!res.ok) return { ok: false, motivo: "indisponivel" };
    try {
      return { ok: true, dados: await res.json() };
    } catch {
      return { ok: false, motivo: "erro" };
    }
  } catch {
    return { ok: false, motivo: "indisponivel" };
  } finally {
    clearTimeout(relogio);
    externo?.removeEventListener("abort", repassar);
  }
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** ORCID nu, na forma `0000-0000-0000-000X`, ou `null`. */
export function normalizarOrcid(bruto: string): string | null {
  const id = (bruto ?? "").trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, "").toUpperCase();
  return /^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$/.test(id) ? id : null;
}

function deAutorOpenAlex(dados: unknown): IndicadoresOpenAlex {
  const a = obj(dados);
  const stats = obj(a.summary_stats);
  const instituicoes = Array.isArray(a.last_known_institutions) ? a.last_known_institutions : [];
  return {
    h_index: num(stats.h_index),
    citacoes: num(a.cited_by_count),
    i10: num(stats.i10_index),
    nome: str(a.display_name),
    afiliacao: str(obj(instituicoes[0]).display_name),
  };
}

/**
 * OpenAlex POR ORCID — o caminho que funciona HOJE, do navegador, sem infra.
 *
 * A rota aceita o ORCID como IRI dentro do caminho, sem escapar as barras:
 * `/authors/https://orcid.org/0000-...` (medido: 200 com o registro, 404 sem).
 * Por isso o id entra concatenado e não por `encodeURIComponent` — escapá-lo
 * produz 404 em todos os casos.
 *
 * `null` = não há autor com esse ORCID no OpenAlex, ou a rede falhou. Os dois
 * casos levam ao mesmo lugar (campo manual), então não vale distingui-los aqui.
 */
export async function buscarNoOpenAlexPorOrcid(
  orcid: string,
  o: OpcoesIndicadores = {},
): Promise<IndicadoresOpenAlex | null> {
  const id = normalizarOrcid(orcid);
  if (!id) return null;
  const mailto = encodeURIComponent(o.mailto ?? MAILTO);
  const r = await buscarJson(`${URL_OPENALEX}/authors/https://orcid.org/${id}?mailto=${mailto}`, o);
  if (!r.ok) return null;
  const dados = deAutorOpenAlex(r.dados);
  return registroVazio(dados) ? null : dados;
}

/**
 * REGISTRO-TOCO: existe no OpenAlex, responde 200, e não sabe nada.
 *
 * Medido num membro real da rede: o ORCID 0000-0001-8160-2027 devolve 200 com
 * `works_count: 2`, `cited_by_count: 0`, `h_index: 0` — o OpenAlex simplesmente
 * não conhece a produção dela. Zero NÃO é `null`, então sem esta guarda a Tela 1
 * gravaria `indice_h = 0` e `total_citacoes = 0` rotulados "segundo o OpenAlex",
 * e a pessoa abriria a tela com dois zeros já preenchidos sob um rótulo de
 * procedência que soa autoritativo.
 *
 * A assimetria que decide: campo VAZIO faz a pergunta; zero preenchido a
 * RESPONDE — errado, e dentro de um relatório que vai ao CNPq. O falso negativo
 * (quem de fato tem h = 0) custa digitar "0" à mão, e aí a fonte fica 'manual',
 * que é a verdade. O falso positivo custa um número errado num documento
 * federal. Por isso zero-em-tudo é tratado como ausência de registro útil.
 */
function registroVazio(d: IndicadoresOpenAlex): boolean {
  return (d.h_index ?? 0) === 0 && (d.citacoes ?? 0) === 0;
}

export type CandidatoOpenAlex = IndicadoresOpenAlex & {
  /** ORCID nu do candidato, quando o OpenAlex o conhece. É o desempate. */
  readonly orcid: string | null;
};

/**
 * OpenAlex POR NOME — devolve LISTA, nunca resposta.
 *
 * NÃO É USADO PELA ORQUESTRAÇÃO, e a razão é um homônimo medido: buscando
 * "Ana Maria Moura da Silva", o 1º resultado é a pesquisadora certa
 * (h = 52) e o 2º é OUTRA PESSOA — "Antônio Augusto Moura da Sílva" (h = 56).
 * Aceitar o primeiro seria acertar por sorte; aceitar o de h mais alto seria
 * errar de propósito. Quem usar isto mostra a lista e deixa a pessoa escolher,
 * e o resultado sai marcado `incerto` (ver `fraseDeProcedencia`).
 *
 * No Scholar isto não tem equivalente e não pode ter: busca de autor por nome
 * é `view_op=search_authors`, que o robots.txt proíbe.
 */
export async function buscarNoOpenAlexPorNome(
  nome: string,
  o: OpcoesIndicadores = {},
): Promise<readonly CandidatoOpenAlex[]> {
  const termo = (nome ?? "").trim();
  if (termo.length < 4) return [];
  const mailto = encodeURIComponent(o.mailto ?? MAILTO);
  const url = `${URL_OPENALEX}/authors?search=${encodeURIComponent(termo)}&per-page=5&mailto=${mailto}`;
  const r = await buscarJson(url, o);
  if (!r.ok) return [];
  const lista = Array.isArray(obj(r.dados).results) ? (obj(r.dados).results as unknown[]) : [];
  return lista.map((a) => ({
    ...deAutorOpenAlex(a),
    orcid: str(obj(a).orcid) ? normalizarOrcid(String(obj(a).orcid)) : null,
  }));
}

/**
 * Os 4 motivos que a Edge Function tem permissão de devolver. Qualquer outra
 * coisa (versão nova da função, resposta corrompida) é `erro` — jamais um
 * motivo inventado que a tela não saiba traduzir.
 */
const MOTIVOS_DA_FUNCAO: readonly string[] = ["bloqueado", "nao_encontrado", "invalido", "erro"];

function motivoDaFuncao(v: unknown): MotivoIndicadores {
  const m = typeof v === "string" ? v : "";
  return MOTIVOS_DA_FUNCAO.includes(m) ? (m as MotivoIndicadores) : "erro";
}

/**
 * GOOGLE SCHOLAR, via Edge Function. A fonte PREFERIDA — é o número que o
 * pesquisador reconhece como dele.
 *
 * O import do cliente Supabase é DINÂMICO e isso é deliberado, duas vezes:
 *  • `supabaseClient.ts` lê `import.meta.env` no topo, o que quebraria fora do
 *    Vite — e a prova do parser roda em Node puro, contra HTML real;
 *  • quem não tem `scholar_id` (a maioria, no começo) nunca paga o chunk.
 *
 * NUNCA ESTOURA. Função não publicada (404 do gateway), plataforma sem `.env`,
 * rede caída: tudo vira `indisponivel`, e a orquestração cai no OpenAlex sem
 * uma palavra na tela. É esse silêncio que permite entregar isto ANTES de a
 * função existir.
 */
export async function buscarNoScholar(
  scholarId: string,
  o: OpcoesIndicadores = {},
): Promise<RespostaScholar> {
  const id = extrairScholarId(scholarId);
  if (!id) return { ok: false, motivo: "invalido" };

  try {
    const { platformEnabled, supabase } = await import("../platform/supabaseClient");
    if (!platformEnabled) return { ok: false, motivo: "indisponivel" };

    const { data, error } = await supabase().functions.invoke(FUNCAO_EDGE, {
      body: { scholar_id: id },
    });
    // `error` cobre 4xx/5xx do gateway (função não publicada = 404) e falha de
    // rede. Nos dois casos o certo é o OpenAlex, não uma mensagem técnica.
    if (error) return { ok: false, motivo: "indisponivel" };

    const r = obj(data);
    if (r.ok !== true) return { ok: false, motivo: motivoDaFuncao(r.motivo) };
    return {
      ok: true,
      dados: {
        h_index: num(r.h_index),
        citacoes: num(r.citacoes),
        i10: num(r.i10),
        nome: str(r.nome),
        afiliacao: str(r.afiliacao),
        atualizado_em: str(r.atualizado_em),
        do_cache: r.do_cache === true,
      },
    };
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }
}

// ========================================= 2c. ARTIGOS via Edge Function

export type RespostaArtigos = {
  readonly artigos: readonly ArtigoDoScholar[];
  /** Por que a lista veio vazia, quando veio. `null` = leitura bem-sucedida. */
  readonly motivo: MotivoIndicadores | null;
};

/**
 * Um artigo cru do JSON da Edge Function, revalidado na fronteira da rede: o
 * corpo é `unknown` até aqui, e um item sem título não vira candidato.
 */
function normalizarArtigo(v: unknown): ArtigoDoScholar | null {
  const a = obj(v);
  const titulo = str(a.titulo);
  if (!titulo) return null;
  return {
    titulo,
    veiculo: str(a.veiculo) ?? "",
    autores: str(a.autores) ?? "",
    ano: num(a.ano),
    link: str(a.link),
    truncado: a.truncado === true,
  };
}

/**
 * A LISTA DE ARTIGOS do Google Acadêmico, filtrada ao período do ciclo.
 *
 * Chama a MESMA Edge Function do índice H, com `comArtigos:true` — a página do
 * perfil, lida uma vez, traz as duas coisas. O filtro por ano é do cliente
 * (`anoCruzaJanela`), inclusivo nas bordas: a lista do Scholar vem ordenada do
 * mais recente, então o período de um ano cabe no topo sem paginar.
 *
 * NUNCA ESTOURA e NUNCA cai em busca por nome (o `scholar_id` é identificador,
 * não consulta): bloqueio, plataforma desligada ou função ausente devolvem lista
 * VAZIA com o motivo — e a Tela 2 degrada em silêncio para o ORCID/OpenAlex.
 * Item sem ano é descartado: sem ano não há como situá-lo na janela.
 */
export async function buscarArtigosDoScholar(
  scholarId: string,
  periodo: Periodo = PERIODO_CICLO_1,
  o: OpcoesIndicadores = {},
): Promise<RespostaArtigos> {
  const id = extrairScholarId(scholarId);
  if (!id) return { artigos: [], motivo: "invalido" };

  try {
    const { platformEnabled, supabase } = await import("../platform/supabaseClient");
    if (!platformEnabled) return { artigos: [], motivo: "indisponivel" };

    const { data, error } = await supabase().functions.invoke(FUNCAO_EDGE, {
      body: { scholar_id: id, comArtigos: true },
    });
    if (error) return { artigos: [], motivo: "indisponivel" };

    const r = obj(data);
    if (r.ok !== true) return { artigos: [], motivo: motivoDaFuncao(r.motivo) };

    const crus = Array.isArray(r.artigos) ? r.artigos : [];
    const artigos = crus
      .map(normalizarArtigo)
      .filter((a): a is ArtigoDoScholar => a !== null && a.ano !== null && anoCruzaJanela(a.ano, periodo));
    return { artigos, motivo: null };
  } catch {
    return { artigos: [], motivo: "indisponivel" };
  }
}

/**
 * O DOI de um artigo do Scholar, quando (e só quando) o Crossref o confirma.
 *
 * A lista do perfil NÃO traz DOI, e o sistema deduplica por DOI (a âncora). Por
 * isso cada item entra como CANDIDATO: casa-se por título + ano no Crossref
 * (`buscarDoiPorTitulo`, em `metadados.ts`), e o casamento só vale se for FORTE
 * — título truncado casa por prefixo, título inteiro por alta similaridade, e o
 * ano tem de bater (tolerância de 1 ano). Match fraco devolve `null`: melhor
 * deixar o item sem DOI e a pessoa confirmar do que afirmar o DOI de outro
 * trabalho. Sem ano não há como confirmar — devolve `null` na hora, sem rede.
 *
 * NUNCA ESTOURA: qualquer falha de rede vira `null` (a cadeia de `metadados.ts`
 * já é toda à prova de exceção).
 */
export async function resolverArtigoADoi(
  artigo: ArtigoDoScholar,
  o: OpcoesRede = {},
): Promise<string | null> {
  if (!artigo.titulo || artigo.ano === null) return null;
  const casamento = await buscarDoiPorTitulo(artigo.titulo, artigo.ano, { ...o, truncado: artigo.truncado });
  return casamento ? casamento.doi : null;
}

// =========================================================== 3. ORQUESTRAÇÃO

export type EntradaIndicadores = {
  readonly orcid?: string | null;
  readonly scholarId?: string | null;
};

/**
 * A regra inteira, em uma função: Scholar primeiro quando há id, OpenAlex como
 * rede de segurança, fonte SEMPRE declarada, exceção NUNCA.
 *
 * Por que o Scholar vem primeiro mesmo custando um salto no servidor: é o
 * número que a Q14 pede ("o indicador DELE, da fonte dele"). O OpenAlex é
 * correto e é menor — bom o bastante para poupar digitação, errado o bastante
 * para nunca ser apresentado como se fosse o outro.
 *
 * Quando o Scholar diz `bloqueado`, o OpenAlex responde no lugar e o `motivo`
 * do bloqueio SOBREVIVE no retorno — a tela pode dizer "hoje não conseguimos
 * falar com o Google Acadêmico" sem perder o número que conseguiu.
 */
export async function obterIndicadores(
  entrada: EntradaIndicadores,
  o: OpcoesIndicadores = {},
): Promise<Indicadores> {
  const scholarId = entrada.scholarId ? extrairScholarId(entrada.scholarId) : null;
  const orcid = entrada.orcid ? normalizarOrcid(entrada.orcid) : null;
  if (!scholarId && !orcid) return semIndicadores("sem_identificador");

  let motivoScholar: MotivoIndicadores | null = null;

  if (scholarId) {
    const r = await buscarNoScholar(scholarId, o);
    if (r.ok) {
      return {
        fonte: "scholar",
        h_index: r.dados.h_index,
        citacoes: r.dados.citacoes,
        i10: r.dados.i10,
        nome: r.dados.nome,
        afiliacao: r.dados.afiliacao,
        atualizado_em: r.dados.atualizado_em,
        do_cache: r.dados.do_cache,
        incerto: false,
        motivo: null,
        procedencia: fraseDeProcedencia("scholar", r.dados.atualizado_em),
      };
    }
    motivoScholar = r.motivo;
  }

  if (orcid) {
    const oa = await buscarNoOpenAlexPorOrcid(orcid, o);
    if (oa) {
      const agora = new Date().toISOString();
      return {
        fonte: "openalex",
        h_index: oa.h_index,
        citacoes: oa.citacoes,
        i10: oa.i10,
        nome: oa.nome,
        afiliacao: oa.afiliacao,
        atualizado_em: agora,
        do_cache: false,
        incerto: false,
        // O motivo do Scholar viaja junto: o número é do OpenAlex, mas a tela
        // pode explicar POR QUE não é do Scholar.
        motivo: motivoScholar,
        procedencia: fraseDeProcedencia("openalex", agora),
      };
    }
  }

  return semIndicadores(motivoScholar ?? "nao_encontrado");
}

/**
 * O patch para `ciclo_membros` — a única forma correta de gravar um indicador.
 *
 * Existe para que nenhuma tela consiga gravar `indice_h` sem gravar a
 * PROCEDÊNCIA junto: `indicadores_fonte` e `indicadores_atualizado_em` (010)
 * são o que separa "83 citações" de "83 citações, do Google Acadêmico, em
 * 10/08/2026" — e só a segunda forma sobrevive a uma pergunta do CNPq.
 *
 * Quando a pessoa DIGITA por cima, a tela chama isto com `fonte: 'manual'`.
 */
export function patchDeIndicadores(
  ind: Pick<Indicadores, "h_index" | "citacoes" | "fonte" | "atualizado_em">,
): {
  indice_h: number | null;
  total_citacoes: number | null;
  indicadores_fonte: IndicadoresFonte | null;
  indicadores_atualizado_em: string | null;
} {
  return {
    indice_h: ind.h_index,
    total_citacoes: ind.citacoes,
    indicadores_fonte: ind.fonte,
    indicadores_atualizado_em: ind.atualizado_em ?? new Date().toISOString(),
  };
}
