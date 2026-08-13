/**
 * ============================================================================
 *  Edge Function `indicadores` — o proxy que lê UM perfil do Google Scholar
 * ============================================================================
 *  PRIMEIRA Edge Function deste projeto. Publicação:
 *      supabase functions deploy indicadores --project-ref <ref>
 *  Operação, limites e o que acontece se NÃO for publicada:
 *  ver `docs/relato-indicadores.md`.
 *
 *  POR QUE ELA EXISTE (e não é preguiça de fazer no navegador)
 *  ----------------------------------------------------------
 *  O Google Scholar não manda `access-control-allow-origin`. Medido em
 *  10/08/2026, com e sem cabeçalho `Origin`: o cabeçalho não existe na
 *  resposta. O site é estático e roda no navegador do pesquisador — logo, um
 *  `fetch` do cliente é barrado pelo navegador, sempre. Esta função é o único
 *  lugar de onde a leitura pode partir.
 *
 *  OS LIMITES ÉTICOS, QUE SÃO CÓDIGO E NÃO INTENÇÃO
 *  ------------------------------------------------
 *   1. robots.txt respeitado ao pé da letra. O robots do Scholar diz
 *        Disallow: /citations?        Allow: /citations?user=
 *        Disallow: /citations?*cstart=
 *        Disallow: /citations?user=*@ (e *%40)
 *      Esta função só monta `/citations?user=<id>&hl=pt-BR`. Não pagina
 *      (`cstart`), não busca autor por nome (`view_op=search_authors`, que cai
 *      no Disallow), e o regex do id exclui `@`. NÃO ACRESCENTE BUSCA POR NOME.
 *   2. User-Agent HONESTO: identifica o INCT, com URL e e-mail de contato.
 *      Nenhum disfarce de navegador. Se o Google quiser nos barrar, tem como.
 *   3. CAPTCHA/403/429 => devolve `bloqueado` e para. Não resolve, não contorna,
 *      não insiste. No máximo UMA nova tentativa, e só para falha de rede/5xx,
 *      que é outra coisa.
 *   4. Cache de 7 dias por perfil. São ~209 perfis, uma leitura cada por
 *      semana no pior caso: volume desprezível, e é do interesse de todos.
 *   5. Só o próprio perfil, a pedido do dono. Não há rota de varredura.
 *
 *  A FUNÇÃO NÃO É ABERTA. `verify_jwt` fica LIGADO (o padrão do Supabase): só
 *  chega aqui quem tem sessão no site. Isso é o que a impede de virar um proxy
 *  público para o Scholar — e é uma decisão de segurança, não de conveniência.
 *
 *  SEM DEPENDÊNCIA EXTERNA, de propósito: `fetch` puro contra o PostgREST do
 *  próprio projeto. Uma primeira Edge Function não precisa arrastar um SDK de
 *  CDN — menos superfície, menos surpresa no deploy.
 * ============================================================================
 */

// ============================================================== configuração

/** Contato público do INCT. O mesmo do rodapé do site e do polite pool. */
const UA =
  "INCT-CONEXAO-BIO3TOX/1.0 (+https://inct-conexao.com.br; inctconexao@gmail.com)";

/** Origens que podem chamar. Nada de `*`: a função fala com o nosso site. */
const ORIGENS = [
  "https://inct-conexao.com.br",
  "https://www.inct-conexao.com.br",
  "http://localhost:5173",
  "http://localhost:4173",
];

/** 7 dias. Ver limite ético 4. */
const CACHE_DIAS = 7;
const CACHE_MS = CACHE_DIAS * 24 * 60 * 60 * 1000;

/** Timeout de cada tentativa contra o Scholar. */
const TIMEOUT_MS = 10000;

/** Espera entre a tentativa e a ÚNICA repetição (só para rede/5xx). */
const ESPERA_RETRY_MS = 1500;

const TABELA = "indicadores_cache";

/**
 * Espelho EXATO de `RE_SCHOLAR_ID` em `src/relato/indicadores.ts` e do CHECK
 * `indicadores_cache_formato` na migração 010. Os três andam juntos.
 */
const RE_SCHOLAR_ID = /^[A-Za-z0-9_-]{8,20}$/;

/**
 * Espelho de `RE_HOST_SCHOLAR` em `src/relato/indicadores.ts`. `?user=` é nome
 * de parâmetro banal: sem esta checagem, uma URL de OUTRO domínio com `?user=`
 * viraria um id que iria ao Scholar e voltaria com o h de outra pessoa.
 */
const RE_HOST_SCHOLAR = /^scholar\.google\.[a-z]{2,}(?:\.[a-z]{2,})?$/i;

type Motivo = "bloqueado" | "nao_encontrado" | "invalido" | "erro";

// ================================================================= 1. CORS

function cabecalhosCors(origem: string | null): Record<string, string> {
  const permitida = origem && ORIGENS.includes(origem) ? origem : ORIGENS[0];
  return {
    "access-control-allow-origin": permitida,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(corpo: unknown, origem: string | null, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhosCors(origem), "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Erro do domínio SEMPRE com HTTP 200. O cliente distingue o caso pelo campo
 * `motivo`; devolver 4xx faria `supabase.functions.invoke` sinalizar
 * `error`, e o cliente leria "função indisponível" — que é outra coisa, e
 * levaria ao OpenAlex quando o certo era dizer "esse perfil não existe".
 */
function falha(motivo: Motivo, origem: string | null): Response {
  return json({ ok: false, motivo }, origem);
}

// ==================================================== 2. PARSING (DUPLICADO)
/**
 * ⚠ CÓPIA LITERAL de `parsearPerfilScholar` em `src/relato/indicadores.ts`.
 * Deno não compartilha módulo com o bundle do Vite (aquele arquivo importa o
 * cliente Supabase, que só existe sob `import.meta.env`), e publicar um pacote
 * só para 40 linhas de regex seria infraestrutura maior que o problema.
 * AS DUAS CÓPIAS DEVEM ANDAR JUNTAS: mexeu lá, mexa aqui.
 *
 * O HTML real (2 perfis públicos, 10/08/2026) ensinou três coisas:
 *  • 6 células `<td class="gsc_rsb_std">`, nesta ordem: citações_total,
 *    citações_desde, h_total, h_desde, i10_total, i10_desde.
 *  • os nomes de classe TAMBÉM aparecem no CSS embutido da página — todo regex
 *    ancora na TAG, nunca no nome da classe solto;
 *  • a afiliação é o PRIMEIRO `<div class="gsc_prf_il">` (os outros dois têm
 *    `id=`) e contém `<a>` dentro.
 */
type PerfilScholar = {
  nome: string | null;
  afiliacao: string | null;
  citacoes: number | null;
  h_index: number | null;
  i10: number | null;
  citacoes_recentes: number | null;
  h_index_recente: number | null;
  i10_recente: number | null;
};

/** Espelho de `hostColado` em `src/relato/indicadores.ts`. */
function hostColado(t: string): string | null {
  const comBarras = t.match(/(?:[a-z][a-z0-9+.-]*:)?\/\/([^/?#\s"']+)/i);
  const cru = comBarras
    ? comBarras[1]
    : (t.match(/^([a-z0-9][a-z0-9.-]*\.[a-z]{2,})(?=[/?#])/i)?.[1] ?? null);
  if (!cru) return null;
  const semUserinfo = cru.slice(cru.lastIndexOf("@") + 1);
  return semUserinfo.split(":")[0].toLowerCase() || null;
}

function extrairScholarId(texto: string): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;

  // 1) Se há um ENDEREÇO no que foi colado, ele tem de ser do Google Acadêmico.
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

function parsearPerfilScholar(html: string): PerfilScholar | null {
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

function inteiroDe(v: string): number | null {
  const d = (v ?? "").replace(/[^\d]/g, "");
  if (!d) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

function textoLimpo(v: string | undefined): string | null {
  if (!v) return null;
  const t = decodificarEntidades(v.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return t || null;
}

function decodificarEntidades(s: string): string {
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

// =============================================== 2b. ARTIGOS (DUPLICADO)
/**
 * ⚠ CÓPIA LITERAL de `parsearArtigosScholar` (e das duas auxiliares abaixo) em
 * `src/relato/indicadores.ts`. A MESMA página de perfil que traz a tabela de
 * indicadores lista os artigos; com `&pagesize=100&sortby=pubdate` ela devolve
 * até 100 itens numa carga só, do mais recente para o mais antigo (`sortby` e
 * `pagesize` NÃO acrescentam `cstart`, então a carga cabe no `Allow` do
 * robots.txt). AS DUAS CÓPIAS DEVEM ANDAR JUNTAS: mexeu lá, mexa aqui.
 *
 * O HTML real (perfil público, 12/08/2026) ensinou a forma de cada linha:
 *  • cada artigo é um `<tr class="gsc_a_tr">`;
 *  • o título é o `<a class="gsc_a_at">` — e vem TRUNCADO com `&#8230;` (→ `…`)
 *    quando é longo, o que `truncado` registra sem esconder;
 *  • há dois `<div class="gs_gray">`: o primeiro são os autores, o segundo o
 *    veículo (com o ano repetido dentro de um `<span class="gs_oph">`, que é
 *    removido para não sujar o veículo);
 *  • o ano fica em `<span class="gsc_a_h …">AAAA` na coluna `gsc_a_y`;
 *  • o link do item é relativo (`/citations?…`) e é tornado absoluto.
 * NÃO HÁ DOI na lista do perfil — por isso cada item entra como CANDIDATO.
 */
type ArtigoDoScholar = {
  titulo: string;
  veiculo: string;
  autores: string;
  ano: number | null;
  link: string | null;
  truncado: boolean;
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

function parsearArtigosScholar(html: string): ArtigoDoScholar[] {
  if (!html) return [];
  const artigos: ArtigoDoScholar[] = [];
  const linhas = html.matchAll(/<tr class="gsc_a_tr">([\s\S]*?)<\/tr>/g);
  for (const linha of linhas) {
    const artigo = lerLinhaArtigo(linha[1]);
    if (artigo) artigos.push(artigo);
  }
  return artigos;
}

// ================================================== 3. LEITURA DO SCHOLAR

type Leitura =
  | { ok: true; perfil: PerfilScholar; artigos: ArtigoDoScholar[] }
  | { ok: false; motivo: Motivo; repetivel: boolean };

/**
 * A PÁGINA VEM EM ISO-8859-1, não em UTF-8.
 * Medido: `content-type: text/html; charset=ISO-8859-1` com `hl=pt-BR`.
 * Um `await res.text()` ingênuo devolve mojibake — e o campo que quebra é
 * justamente o NOME do pesquisador brasileiro ("João", "Conceição"). Por isso
 * se lê `arrayBuffer` e se decodifica com o charset declarado no cabeçalho.
 */
async function decodificarCorpo(res: Response): Promise<string> {
  const buf = await res.arrayBuffer();
  const ct = res.headers.get("content-type") ?? "";
  const charset = (ct.match(/charset=([\w-]+)/i)?.[1] ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    // Charset exótico: latin1 erra menos que utf-8 numa página do Google.
    return new TextDecoder("iso-8859-1").decode(buf);
  }
}

/** Marcadores de bloqueio. Encontrou um? Devolve `bloqueado` e PARA. */
function pareceBloqueio(html: string): boolean {
  return (
    /id="gs_captcha_c"/i.test(html) ||
    /\/sorry\/index/i.test(html) ||
    /unusual traffic|tr[aá]fego incomum/i.test(html) ||
    /g-recaptcha|recaptcha\/api/i.test(html)
  );
}

async function lerPerfil(id: string, comArtigos: boolean): Promise<Leitura> {
  // Com `comArtigos`, a MESMA página traz a tabela de indicadores E a lista de
  // até 100 artigos (o índice H é lido igual, só há mais parsing). `pagesize` e
  // `sortby` não acrescentam `cstart`, então a carga cabe no `Allow` do robots.
  const url = comArtigos
    ? `https://scholar.google.com/citations?user=${encodeURIComponent(id)}&hl=pt-BR&pagesize=100&sortby=pubdate`
    : `https://scholar.google.com/citations?user=${encodeURIComponent(id)}&hl=pt-BR`;
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controle.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html", "accept-language": "pt-BR,pt;q=0.9" },
    });

    // 404 = o id não existe (medido: `user=ZZZZZZZZZZZZ` devolve 404 com a
    // página de erro genérica do Google). Não é bloqueio e não se repete.
    if (res.status === 404) return { ok: false, motivo: "nao_encontrado", repetivel: false };
    // 403/429 são a resposta do Google a quem ele quer conter. Acatar é o
    // comportamento correto; repetir seria exatamente o que ele está pedindo
    // para não fazer.
    if (res.status === 403 || res.status === 429) {
      return { ok: false, motivo: "bloqueado", repetivel: false };
    }
    if (!res.ok) return { ok: false, motivo: "erro", repetivel: res.status >= 500 };

    const html = await decodificarCorpo(res);
    if (pareceBloqueio(html)) return { ok: false, motivo: "bloqueado", repetivel: false };

    const perfil = parsearPerfilScholar(html);
    // HTTP 200, sem CAPTCHA e sem a tabela: ou a página mudou, ou é uma
    // interstitial que não reconhecemos. Nos dois casos o honesto é
    // `bloqueado` — nunca preencher com null e deixar a tela achar que leu.
    if (!perfil) return { ok: false, motivo: "bloqueado", repetivel: false };

    const artigos = comArtigos ? parsearArtigosScholar(html) : [];
    return { ok: true, perfil, artigos };
  } catch {
    // Timeout ou rede: é nossa falha, não recusa do Google. Repetível.
    return { ok: false, motivo: "erro", repetivel: true };
  } finally {
    clearTimeout(relogio);
  }
}

/** UMA repetição, só para falha de rede/5xx, com espera. Nunca para bloqueio. */
async function lerPerfilComUmaRepeticao(id: string, comArtigos: boolean): Promise<Leitura> {
  const primeira = await lerPerfil(id, comArtigos);
  if (primeira.ok || !primeira.repetivel) return primeira;
  await new Promise((r) => setTimeout(r, ESPERA_RETRY_MS));
  return lerPerfil(id, comArtigos);
}

// ========================================================== 4. CACHE (7 dias)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function cabecalhosRest(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    "content-type": "application/json",
    ...extra,
  };
}

/**
 * O `dados` é jsonb: quando a leitura pediu artigos, eles viajam DENTRO dele
 * (`dados.artigos`). A resposta do índice H ignora esse campo; a resposta com
 * artigos só serve o cache quando ele existe (senão vai à rede buscá-los).
 */
type DadosCache = PerfilScholar & { artigos?: ArtigoDoScholar[] };
type LinhaCache = { scholar_id: string; dados: DadosCache; buscado_em: string };

/** `null` quando não há linha, quando não há credencial, ou quando o REST falha. */
async function lerCache(id: string): Promise<LinhaCache | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/${TABELA}?scholar_id=eq.${encodeURIComponent(id)}&select=scholar_id,dados,buscado_em`;
    const res = await fetch(url, { headers: cabecalhosRest() });
    if (!res.ok) return null;
    const linhas = (await res.json()) as LinhaCache[];
    return Array.isArray(linhas) && linhas.length ? linhas[0] : null;
  } catch {
    return null;
  }
}

/**
 * Grava (ou regrava) o perfil. Falha de gravação NÃO derruba a resposta: o
 * pesquisador já tem o número dele; perder o cache custa uma leitura a mais na
 * semana que vem, e é o menor dos males.
 */
async function gravarCache(id: string, dados: DadosCache): Promise<string> {
  const agora = new Date().toISOString();
  if (!SUPABASE_URL || !SERVICE_KEY) return agora;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${TABELA}?on_conflict=scholar_id`, {
      method: "POST",
      headers: cabecalhosRest({ prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ scholar_id: id, dados, buscado_em: agora }),
    });
  } catch {
    /* ver comentário acima */
  }
  return agora;
}

function fresco(buscadoEm: string): boolean {
  const t = Date.parse(buscadoEm);
  return Number.isFinite(t) && Date.now() - t < CACHE_MS;
}

function resposta(
  dados: DadosCache,
  atualizadoEm: string,
  doCache: boolean,
  origem: string | null,
  comArtigos: boolean,
): Response {
  return json(
    {
      ok: true,
      fonte: "scholar",
      h_index: dados.h_index,
      citacoes: dados.citacoes,
      i10: dados.i10,
      nome: dados.nome,
      afiliacao: dados.afiliacao,
      atualizado_em: atualizadoEm,
      do_cache: doCache,
      // `artigos` só entra quando foi pedido; `undefined` some no JSON.stringify.
      artigos: comArtigos ? (Array.isArray(dados.artigos) ? dados.artigos : []) : undefined,
    },
    origem,
  );
}

// ============================================================ 5. O HANDLER

Deno.serve(async (req: Request): Promise<Response> => {
  const origem = req.headers.get("origin");

  // Preflight: o navegador manda OPTIONS antes do POST com `authorization`.
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhosCors(origem) });
  if (req.method !== "POST") return falha("invalido", origem);

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return falha("invalido", origem);
  }

  const bruto = (corpo as { scholar_id?: unknown })?.scholar_id;
  // Aceita o id cru OU a URL inteira do perfil — a pessoa cola o que tem na
  // mão. A validação é a mesma nos dois casos.
  const id = typeof bruto === "string" ? extrairScholarId(bruto) : null;
  if (!id) return falha("invalido", origem);

  // `comArtigos:true` pede a MESMA página do perfil com a lista de até 100
  // artigos junto (`pagesize=100&sortby=pubdate`). Ausente ou qualquer outro
  // valor = só a tabela de indicadores, como sempre foi.
  const comArtigos = (corpo as { comArtigos?: unknown } | null)?.comArtigos === true;

  // 1. Cache primeiro, SEMPRE. Só se sai para a rede com cache velho ou vazio.
  //    Um cache fresco serve o índice H em qualquer caso; serve os ARTIGOS só
  //    quando os tem — pedido de artigos contra um cache que só guardou o H vai
  //    à rede buscá-los.
  const emCache = await lerCache(id);
  if (emCache && fresco(emCache.buscado_em) && (!comArtigos || Array.isArray(emCache.dados.artigos))) {
    return resposta(emCache.dados, emCache.buscado_em, true, origem, comArtigos);
  }

  // 2. Scholar.
  const leitura = await lerPerfilComUmaRepeticao(id, comArtigos);
  if (leitura.ok) {
    // Os artigos entram no `dados` (jsonb) só quando foram lidos. Sem eles, uma
    // lista já cacheada é PRESERVADA: refrescar o índice H não apaga os artigos.
    const dados: DadosCache = { ...leitura.perfil };
    if (comArtigos) dados.artigos = leitura.artigos;
    else if (emCache && Array.isArray(emCache.dados.artigos)) dados.artigos = emCache.dados.artigos;
    const agora = await gravarCache(id, dados);
    return resposta(dados, agora, false, origem, comArtigos);
  }

  // 3. Não deu. Se existe cache VELHO, ele vale mais que nada: o h de sete
  //    dias atrás é o mesmo h de hoje em 99% dos casos, e devolvê-lo rotulado
  //    com a data verdadeira é honesto — a tela mostra "atualizado em DD/MM".
  //    Isso também tira pressão do Scholar num dia em que ele já nos barrou.
  if (emCache) return resposta(emCache.dados, emCache.buscado_em, true, origem, comArtigos);

  return falha(leitura.motivo, origem);
});
