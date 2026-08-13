/**
 * ============================================================================
 *  Índice H e citações automáticos (Q14) — a prova a seco
 * ============================================================================
 *  Cobre `src/relato/indicadores.ts`: o que é PURO (extração do id, parsing do
 *  perfil, as frases de procedência) e o que QUEBRA (bloqueio do Scholar, perfil
 *  inexistente, plataforma desligada, as duas fontes fora do ar).
 *
 *  NENHUM TESTE AQUI TOCA A REDE, de propósito: a suíte roda offline e no CI, e
 *  um teste que depende do Google Acadêmico não é um teste — é um alarme que
 *  toca quando o Google está de mau humor. O HTML é fixture (recorte fiel do
 *  perfil real lido em 10/08/2026), o Supabase é módulo mockado e o `fetch` é
 *  stub. As chamadas REAIS foram feitas fora da suíte e estão registradas em
 *  `docs/relato-indicadores.md`.
 *
 *  A FRONTEIRA QUE ESTE ARQUIVO GUARDA: o robots.txt do Scholar permite LER um
 *  perfil conhecido (`Allow: /citations?user=`) e proíbe PROCURAR autor por nome
 *  (`view_op=search_authors` cai no `Disallow: /citations?`). Há teste explícito
 *  de que nenhuma URL montada pela orquestração vai para o Scholar por nome.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";

/**
 * O cliente Supabase é mockado porque `buscarNoScholar` o importa
 * DINAMICAMENTE (`await import("../platform/supabaseClient")`) e o módulo real
 * lê `import.meta.env` — com um `.env` presente, um teste sem mock sairia
 * chamando a Edge Function de verdade.
 */
const supa = vi.hoisted(() => ({
  habilitado: true,
  invoke: vi.fn(async (_nome: string, _opcoes: unknown): Promise<{ data: unknown; error: unknown }> => ({
    data: null,
    error: null,
  })),
}));

vi.mock("../src/platform/supabaseClient", () => ({
  get platformEnabled() {
    return supa.habilitado;
  },
  supabase: () => ({ functions: { invoke: supa.invoke } }),
}));

import {
  extrairScholarId,
  parsearPerfilScholar,
  fraseDeProcedencia,
  dataCurta,
  normalizarOrcid,
  semIndicadores,
  patchDeIndicadores,
  obterIndicadores,
  buscarNoScholar,
  buscarNoOpenAlexPorOrcid,
  RE_SCHOLAR_ID,
} from "../src/relato/indicadores";

// ======================================================== fixtures de HTML

/**
 * Recorte FIEL do perfil público lido em 10/08/2026 (`user=JicYPdAAAAAJ`,
 * `hl=pt-BR`) — nome, afiliação, a tabela inteira e, de propósito, o CSS
 * embutido que também contém a string `gsc_rsb_std`. É esse CSS que torna o
 * teste interessante: um parser que procurasse o NOME DA CLASSE solto leria a
 * folha de estilo; o nosso ancora na TAG `<td class=`.
 */
const HTML_PERFIL = `<!doctype html><html><head><style>
.gsc_rsb_std{text-align:right}.gsc_rsb_std,.gs_el_ph .gsc_rsb_std{padding-right:16px}
</style></head><body>
<div id="gsc_prf"><div id="gsc_prf_i"><div id="gsc_prf_in">Geoffrey Hinton</div></div>
<div class="gsc_prf_il">Emeritus Prof. Computer Science, <a href="/citations?view_op=view_org&amp;hl=pt-BR&amp;org=8515235176732148308" class="gsc_prf_ila">University of Toronto</a></div>
<div class="gsc_prf_il" id="gsc_prf_ivh">E-mail confirmado em cs.toronto.edu</div>
<div class="gsc_prf_il" id="gsc_prf_int"><a class="gsc_prf_inta gs_ibl">machine learning</a></div></div>
<table id="gsc_rsb_st"><thead><tr><th class="gsc_rsb_sth"></th><th class="gsc_rsb_sth">Todos</th><th class="gsc_rsb_sth">Desde 2021</th></tr></thead><tbody>
<tr><td class="gsc_rsb_sc1"><a class="gsc_rsb_f gs_ibl" title="Este é o número de citações de todas as publicações.">Citações</a></td><td class="gsc_rsb_std">1070076</td><td class="gsc_rsb_std">607406</td></tr>
<tr><td class="gsc_rsb_sc1"><a class="gsc_rsb_f gs_ibl" title="Índice h é o maior número h.">Índice h</a></td><td class="gsc_rsb_std">194</td><td class="gsc_rsb_std">133</td></tr>
<tr><td class="gsc_rsb_sc1"><a class="gsc_rsb_f gs_ibl" title="Índice i10 é o número de publicações com, no mínimo, 10 citações.">Índice i10</a></td><td class="gsc_rsb_std">539</td><td class="gsc_rsb_std">397</td></tr>
</tbody></table></body></html>`;

/** O mesmo perfil com o nome cheio de entidades — o caso brasileiro. */
const HTML_ENTIDADES = HTML_PERFIL.replace(
  ">Geoffrey Hinton<",
  ">Jo&#227;o da Concei&ccedil;&atilde;o &amp; Silva<",
).replace(">Jo&#227;o da Concei&ccedil;&atilde;o &amp; Silva<", ">Jo&#227;o da Concei&#231;&#227;o &amp; Silva<");

/** A página de bloqueio: HTTP 200, sem tabela nenhuma. */
const HTML_CAPTCHA = `<!doctype html><html><head><title>https://scholar.google.com/citations?user=…</title></head>
<body><div id="gs_captcha_c"><div class="g-recaptcha" data-sitekey="6Ld_ad8"></div>
<p>Nossos sistemas detectaram tráfego incomum na sua rede de computadores.</p>
<form action="/sorry/index" method="get"></form></div></body></html>`;

// ================================================= 1. extrairScholarId (puro)

describe("extrairScholarId — o que é aceito como perfil, e o que não é", () => {
  it("aceita a URL completa do perfil", () => {
    expect(extrairScholarId("https://scholar.google.com/citations?user=JicYPdAAAAAJ")).toBe(
      "JicYPdAAAAAJ",
    );
  });

  it("aceita o `user=` depois de `hl=` (a ordem da querystring não importa)", () => {
    expect(extrairScholarId("https://scholar.google.com/citations?hl=pt-BR&user=JicYPdAAAAAJ")).toBe(
      "JicYPdAAAAAJ",
    );
    expect(extrairScholarId("https://scholar.google.com/citations?user=JicYPdAAAAAJ&hl=pt-BR")).toBe(
      "JicYPdAAAAAJ",
    );
  });

  it("para no fragmento `#` — o que vem depois não é o id", () => {
    expect(
      extrairScholarId("https://scholar.google.com/citations?user=JicYPdAAAAAJ#d=gsc_md_hist"),
    ).toBe("JicYPdAAAAAJ");
  });

  it("aceita `&amp;` — o que sai de um copiar-colar de HTML", () => {
    expect(
      extrairScholarId("https://scholar.google.com/citations?hl=pt-BR&amp;user=JicYPdAAAAAJ"),
    ).toBe("JicYPdAAAAAJ");
  });

  it("aceita domínio regional e sem esquema (`scholar.google.com.br/...`)", () => {
    expect(extrairScholarId("https://scholar.google.com.br/citations?user=kukA0LcAAAAJ")).toBe(
      "kukA0LcAAAAJ",
    );
    expect(extrairScholarId("scholar.google.co.uk/citations?user=kukA0LcAAAAJ")).toBe(
      "kukA0LcAAAAJ",
    );
    expect(extrairScholarId("scholar.google.com/citations?user=kukA0LcAAAAJ")).toBe("kukA0LcAAAAJ");
  });

  it("aceita o id cru, com espaço em volta", () => {
    expect(extrairScholarId("JicYPdAAAAAJ")).toBe("JicYPdAAAAAJ");
    expect(extrairScholarId("  JicYPdAAAAAJ  ")).toBe("JicYPdAAAAAJ");
  });

  /**
   * O TESTE MAIS IMPORTANTE DESTE BLOCO. `?user=` é nome de parâmetro banal.
   * Aceitar um `user=` de OUTRO domínio produziria um id que iria ao Scholar e
   * voltaria com o h de OUTRA PESSOA — rotulado "do seu Google Acadêmico", que
   * é o pior rótulo possível para um número errado.
   */
  it("RECUSA URL de outro domínio, mesmo com um `user=` de aparência perfeita", () => {
    expect(extrairScholarId("https://exemplo-malicioso.com/citations?user=JicYPdAAAAAJ")).toBeNull();
    expect(extrairScholarId("https://www.researchgate.net/profile?user=JicYPdAAAAAJ")).toBeNull();
    expect(extrairScholarId("http://scholar.google.com.evil.test/citations?user=JicYPdAAAAAJ")).toBeNull();
    expect(extrairScholarId("https://scholar.google.com@evil.test/citations?user=JicYPdAAAAAJ")).toBeNull();
    expect(extrairScholarId("veja em https://evil.test/citations?user=JicYPdAAAAAJ")).toBeNull();
  });

  it("recusa `@` no id — o `Disallow: /citations?user=*@` do robots.txt", () => {
    expect(extrairScholarId("https://scholar.google.com/citations?user=fulano@usp.br")).toBeNull();
    expect(extrairScholarId("https://scholar.google.com/citations?user=fulano%40usp.br")).toBeNull();
  });

  it("recusa lixo, vazio e só espaço", () => {
    expect(extrairScholarId("")).toBeNull();
    expect(extrairScholarId("   ")).toBeNull();
    expect(extrairScholarId("não faço ideia de qual é o meu")).toBeNull();
    expect(extrairScholarId("https://scholar.google.com/citations?hl=pt-BR")).toBeNull();
    expect(extrairScholarId("https://scholar.google.com/citations")).toBeNull();
  });

  it("recusa id curto demais e longo demais (a faixa 8..20 de RE_SCHOLAR_ID)", () => {
    expect(extrairScholarId("ABC123")).toBeNull();
    expect(extrairScholarId("A".repeat(21))).toBeNull();
    expect(RE_SCHOLAR_ID.test("JicYPdAAAAAJ")).toBe(true);
  });

  it("é idempotente: o id extraído, remontado em URL, volta igual", () => {
    const id = extrairScholarId("https://scholar.google.com/citations?user=JicYPdAAAAAJ&hl=pt-BR");
    expect(id).not.toBeNull();
    expect(extrairScholarId(`https://scholar.google.com/citations?user=${id}&hl=pt-BR`)).toBe(id);
  });
});

// ================================================ 2. parsearPerfilScholar (puro)

describe("parsearPerfilScholar — contra o HTML de fixture", () => {
  it("lê as SEIS células na ordem [cit, cit_desde, h, h_desde, i10, i10_desde]", () => {
    const p = parsearPerfilScholar(HTML_PERFIL);
    expect(p).not.toBeNull();
    expect(p).toEqual({
      nome: "Geoffrey Hinton",
      afiliacao: "Emeritus Prof. Computer Science, University of Toronto",
      citacoes: 1070076,
      citacoes_recentes: 607406,
      h_index: 194,
      h_index_recente: 133,
      i10: 539,
      i10_recente: 397,
    });
  });

  /**
   * A leitura é POSICIONAL — o parser não olha os rótulos. Este teste é o que
   * ancora a posição na realidade: se um dia o Google trocar a ordem das linhas,
   * é aqui que se descobre, e não num relatório com o i10 no lugar do h.
   */
  it("os rótulos da fixture confirmam a ordem que o parser assume", () => {
    const rotulos = [...HTML_PERFIL.matchAll(/<td class="gsc_rsb_sc1">[\s\S]*?>([^<]+)<\/a>/g)].map(
      (m) => m[1],
    );
    expect(rotulos).toEqual(["Citações", "Índice h", "Índice i10"]);
  });

  it("não confunde o CSS embutido (que também diz `gsc_rsb_std`) com dado", () => {
    expect(HTML_PERFIL).toContain(".gsc_rsb_std{text-align:right}");
    expect(parsearPerfilScholar(HTML_PERFIL)?.citacoes).toBe(1070076);
  });

  it("pega a PRIMEIRA `gsc_prf_il` (afiliação), não o e-mail nem os interesses", () => {
    const p = parsearPerfilScholar(HTML_PERFIL);
    expect(p?.afiliacao).toBe("Emeritus Prof. Computer Science, University of Toronto");
    expect(p?.afiliacao).not.toMatch(/E-mail|machine learning/);
  });

  it("decodifica entidades no nome — o caso brasileiro", () => {
    expect(parsearPerfilScholar(HTML_ENTIDADES)?.nome).toBe("João da Conceição & Silva");
  });

  it("aceita o layout de uma coluna só (3 células) sem inventar as recentes", () => {
    const umaColuna = `<table><tr><td class="gsc_rsb_sc1">Citações</td><td class="gsc_rsb_std">120</td></tr>
      <tr><td class="gsc_rsb_sc1">Índice h</td><td class="gsc_rsb_std">7</td></tr>
      <tr><td class="gsc_rsb_sc1">Índice i10</td><td class="gsc_rsb_std">4</td></tr></table>`;
    const p = parsearPerfilScholar(umaColuna);
    expect(p?.citacoes).toBe(120);
    expect(p?.h_index).toBe(7);
    expect(p?.i10).toBe(4);
    expect(p?.citacoes_recentes).toBeNull();
    expect(p?.h_index_recente).toBeNull();
  });

  // ---- O QUE NÃO PODE VIRAR NÚMERO ----------------------------------------

  it("CAPTCHA devolve null — nunca um número errado", () => {
    expect(parsearPerfilScholar(HTML_CAPTCHA)).toBeNull();
  });

  it("HTML vazio, string vazia e página sem tabela devolvem null", () => {
    expect(parsearPerfilScholar("")).toBeNull();
    expect(parsearPerfilScholar("<html><body>404. That's an error.</body></html>")).toBeNull();
    expect(parsearPerfilScholar(HTML_PERFIL.replace(/gsc_rsb_std/g, "outra_classe"))).toBeNull();
  });

  it("contagem de células que não é 3 nem >=6 devolve null (HTML que não entendemos)", () => {
    const truncado = `<td class="gsc_rsb_std">120</td><td class="gsc_rsb_std">7</td>`;
    expect(parsearPerfilScholar(truncado)).toBeNull();
    const cinco = truncado + `<td class="gsc_rsb_std">1</td><td class="gsc_rsb_std">2</td><td class="gsc_rsb_std">3</td>`;
    expect(parsearPerfilScholar(cinco)).toBeNull();
  });
});

// ============================== 2b. as duas cópias do parser andando juntas

/**
 * O PARSER É DUPLICADO — e é o único jeito. `src/relato/indicadores.ts` entra no
 * bundle do Vite; `supabase/functions/indicadores/index.ts` roda em Deno, que
 * não compartilha módulo com ele (o arquivo do cliente importa
 * `supabaseClient`, que só existe sob `import.meta.env`). Os dois comentários
 * pedem, em maiúsculas, que as cópias andem juntas.
 *
 * ISTO AQUI É O QUE TORNA O PEDIDO EXECUTÁVEL. Sem este teste, a única garantia
 * seria a disciplina de quem edita — e a cópia que roda em produção (a do Deno)
 * é justamente a que NENHUM outro teste alcança: o `parsearPerfilScholar` do
 * cliente é tree-shaken do bundle, porque em produção quem lê HTML é a função.
 * Se as duas divergirem, os testes de fixture continuariam verdes provando a
 * cópia errada. Aqui elas são comparadas caractere a caractere.
 */
describe("as duas cópias do parser (cliente e Edge Function) são idênticas", () => {
  const fonteCliente = readFileSync(
    new URL("../src/relato/indicadores.ts", import.meta.url),
    "utf8",
  );
  const fonteDeno = readFileSync(
    new URL("../supabase/functions/indicadores/index.ts", import.meta.url),
    "utf8",
  );

  /**
   * O CÓDIGO da função, do cabeçalho até o `}` de coluna zero, sem comentários
   * e com espaço normalizado. Comentários ficam de fora de propósito: a cópia do
   * Deno explica coisas que a do cliente não precisa explicar (e vice-versa), e
   * o que tem de ser idêntico é o comportamento, não a prosa.
   * O corte de `//` exige espaço antes — sem isso, o `\/\/` dentro do regex de
   * `hostColado` seria confundido com um comentário e truncaria a função.
   */
  function corpoDaFuncao(fonte: string, nome: string): string {
    const re = new RegExp(`^(?:export )?function ${nome}\\([\\s\\S]*?\\n\\}`, "m");
    const achado = fonte.match(re);
    if (!achado) throw new Error(`função ${nome} não encontrada`);
    return achado[0]
      .replace(/^export /, "")
      .replace(/(^|\s)\/\/.*$/gm, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function literalDaConstante(fonte: string, nome: string): string {
    const achado = fonte.match(new RegExp(`^(?:export )?const ${nome} = (.+);$`, "m"));
    if (!achado) throw new Error(`constante ${nome} não encontrada`);
    return achado[1];
  }

  for (const nome of [
    "extrairScholarId",
    "hostColado",
    "decodeURIComponentSeguro",
    "parsearPerfilScholar",
    "inteiroDe",
    "textoLimpo",
    "decodificarEntidades",
  ]) {
    it(`${nome} é o mesmo código nos dois arquivos`, () => {
      expect(corpoDaFuncao(fonteDeno, nome)).toBe(corpoDaFuncao(fonteCliente, nome));
    });
  }

  it("RE_SCHOLAR_ID e RE_HOST_SCHOLAR são os mesmos regex nos dois arquivos", () => {
    for (const nome of ["RE_SCHOLAR_ID", "RE_HOST_SCHOLAR"]) {
      expect(literalDaConstante(fonteDeno, nome)).toBe(literalDaConstante(fonteCliente, nome));
    }
  });

  /**
   * O CHECK da migração 010 é o TERCEIRO lugar onde o formato do id vive
   * (`ciclo_membros.scholar_id` e `indicadores_cache.scholar_id`). Um regex mais
   * estreito no banco faria a gravação falhar depois de a tela ter aceitado.
   */
  it("o CHECK da migração 010 usa o mesmo formato de id", () => {
    const sql = readFileSync(
      new URL("../supabase/migrations/010_indicadores.sql", import.meta.url),
      "utf8",
    );
    const doRegex = RE_SCHOLAR_ID.source.replace(/\\\//g, "/");
    const noSql = [...sql.matchAll(/~ '([^']+)'/g)].map((m) => m[1]);
    expect(noSql.length).toBeGreaterThan(0);
    for (const r of noSql) expect(r).toBe(doRegex);
  });
});

// ============================================ 3. procedência, datas, ORCID

describe("fraseDeProcedencia — a fonte nunca fica implícita", () => {
  it("nunca devolve string vazia, para nenhuma fonte", () => {
    for (const f of ["scholar", "openalex", "manual", null] as const) {
      expect(fraseDeProcedencia(f, null).trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * A frase do OpenAlex CITA o Google Acadêmico — de propósito, para explicar
   * por que o número é mais baixo. O que ela não pode fazer é ATRIBUIR o número
   * a ele: quem nomeia a fonte é a abertura da frase ("segundo o OpenAlex"), e
   * "do seu Google Acadêmico" é reservado à fonte `scholar`.
   */
  it("NUNCA atribui ao Google Acadêmico um número do OpenAlex", () => {
    const oa = fraseDeProcedencia("openalex", "2026-08-10T12:00:00Z");
    expect(oa).toMatch(/^segundo o OpenAlex/);
    expect(oa).not.toMatch(/do seu Google Acad/i);
    expect(fraseDeProcedencia("scholar", null)).toMatch(/do seu Google Acad/i);
  });

  it("o Scholar diz a data da leitura quando ela existe", () => {
    expect(fraseDeProcedencia("scholar", "2026-08-10T12:00:00Z")).toContain("10/08");
    expect(fraseDeProcedencia("scholar", null)).not.toContain("atualizado");
  });

  it("por nome, avisa que é por semelhança e pede conferência", () => {
    expect(fraseDeProcedencia("openalex", null, true)).toMatch(/semelhan|confira/i);
  });

  it("as quatro frases são distintas entre si", () => {
    const frases = new Set(
      (["scholar", "openalex", "manual", null] as const).map((f) => fraseDeProcedencia(f, null)),
    );
    expect(frases.size).toBe(4);
  });
});

describe("dataCurta e normalizarOrcid", () => {
  it("dataCurta formata DD/MM e engole entrada inválida", () => {
    expect(dataCurta("2026-08-10T12:00:00Z")).toBe("10/08");
    expect(dataCurta(null)).toBeNull();
    expect(dataCurta("ontem")).toBeNull();
  });

  it("normalizarOrcid aceita nu e com URL, recusa o resto", () => {
    expect(normalizarOrcid("0000-0002-0848-1940")).toBe("0000-0002-0848-1940");
    expect(normalizarOrcid("https://orcid.org/0000-0002-0848-1940")).toBe("0000-0002-0848-1940");
    expect(normalizarOrcid("0000-0002-1825-009x")).toBe("0000-0002-1825-009X");
    expect(normalizarOrcid("0000-0002-0848")).toBeNull();
    expect(normalizarOrcid("")).toBeNull();
  });
});

describe("semIndicadores e patchDeIndicadores", () => {
  it("semIndicadores declara o motivo e não deixa a procedência vazia", () => {
    const s = semIndicadores("bloqueado");
    expect(s.fonte).toBeNull();
    expect(s.motivo).toBe("bloqueado");
    expect(s.h_index).toBeNull();
    expect(s.procedencia.trim().length).toBeGreaterThan(0);
  });

  it("o patch grava a PROCEDÊNCIA junto com o número — sempre", () => {
    const p = patchDeIndicadores({
      h_index: 57,
      citacoes: 13549,
      fonte: "openalex",
      atualizado_em: "2026-08-10T12:00:00Z",
    });
    expect(p).toEqual({
      indice_h: 57,
      total_citacoes: 13549,
      indicadores_fonte: "openalex",
      indicadores_atualizado_em: "2026-08-10T12:00:00Z",
    });
  });

  it("sem data, o patch carimba o instante — nunca grava número sem quando", () => {
    const p = patchDeIndicadores({ h_index: 3, citacoes: 9, fonte: "manual", atualizado_em: null });
    expect(p.indicadores_atualizado_em).not.toBeNull();
    expect(Number.isNaN(Date.parse(p.indicadores_atualizado_em!))).toBe(false);
  });
});

// ================================================== 4. rede mockada + orquestração

/** Resposta suficiente para o `buscarJson` interno (status, ok, json()). */
function respostaJson(corpo: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => corpo,
  } as unknown as Response;
}

/**
 * O autor do OpenAlex COM OS NÚMEROS REAIS medidos em 10/08/2026 para o ORCID
 * 0000-0002-0848-1940 (Wuelton Marcelo Monteiro): h 57, 13549 citações, i10 271.
 */
const AUTOR_OPENALEX = {
  display_name: "Wuelton Marcelo Monteiro",
  orcid: "https://orcid.org/0000-0002-0848-1940",
  cited_by_count: 13549,
  summary_stats: { h_index: 57, i10_index: 271 },
  last_known_institutions: [{ display_name: "Universidade do Estado do Amazonas" }],
};

const ORCID = "0000-0002-0848-1940";
const SCHOLAR_URL = "https://scholar.google.com/citations?user=JicYPdAAAAAJ&hl=pt-BR";

let urlsChamadas: string[] = [];

beforeEach(() => {
  urlsChamadas = [];
  supa.habilitado = true;
  supa.invoke.mockReset();
  supa.invoke.mockResolvedValue({ data: null, error: { message: "não publicada" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urlsChamadas.push(String(url));
      return respostaJson(AUTOR_OPENALEX);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buscarNoOpenAlexPorOrcid", () => {
  it("monta a rota com o ORCID como IRI, sem escapar as barras", async () => {
    const r = await buscarNoOpenAlexPorOrcid(ORCID);
    expect(r).toEqual({
      h_index: 57,
      citacoes: 13549,
      i10: 271,
      nome: "Wuelton Marcelo Monteiro",
      afiliacao: "Universidade do Estado do Amazonas",
    });
    expect(urlsChamadas[0]).toContain(`/authors/https://orcid.org/${ORCID}`);
    expect(urlsChamadas[0]).toContain("mailto=");
  });

  it("ORCID malformado nem chega a bater na rede", async () => {
    expect(await buscarNoOpenAlexPorOrcid("não tenho")).toBeNull();
    expect(urlsChamadas).toHaveLength(0);
  });

  it("404 (sem registro no OpenAlex) devolve null, não estoura", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respostaJson({}, 404)));
    expect(await buscarNoOpenAlexPorOrcid(ORCID)).toBeNull();
  });

  it("rede caída devolve null, não estoura", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    expect(await buscarNoOpenAlexPorOrcid(ORCID)).toBeNull();
  });

  /* ---------------------------------------------------------------------
     REGISTRO-TOCO — a guarda que impede o pior desfecho do módulo.
     O payload abaixo é o do ORCID 0000-0001-8160-2027, membro real da rede,
     medido em 10/08/2026: 200 com works_count 2 e tudo zerado. Sem a guarda,
     a Tela 1 gravava "0" rotulado "segundo o OpenAlex" num relatório do CNPq.
     Campo vazio faz a pergunta; zero preenchido a responde errado.
     --------------------------------------------------------------------- */
  it("registro-toco (200 com tudo zerado) devolve null — zero não é resposta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respostaJson({
          display_name: "Alice Maria Costa Martins",
          cited_by_count: 0,
          works_count: 2,
          summary_stats: { h_index: 0, i10_index: 0 },
        }),
      ),
    );
    expect(await buscarNoOpenAlexPorOrcid(ORCID)).toBeNull();
  });

  it("h zerado mas com citações reais NÃO é toco — continua respondendo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respostaJson({
          display_name: "Quem tem citação e h ainda não calculado",
          cited_by_count: 12,
          summary_stats: { h_index: 0 },
        }),
      ),
    );
    const r = await buscarNoOpenAlexPorOrcid(ORCID);
    expect(r).not.toBeNull();
    expect(r?.citacoes).toBe(12);
  });
});

describe("buscarNoScholar — a Edge Function, e o que acontece sem ela", () => {
  it("id inválido é recusado ANTES de chamar a função", async () => {
    const r = await buscarNoScholar("https://evil.test/citations?user=JicYPdAAAAAJ");
    expect(r).toEqual({ ok: false, motivo: "invalido" });
    expect(supa.invoke).not.toHaveBeenCalled();
  });

  it("plataforma desligada => `indisponivel` (e nunca uma exceção)", async () => {
    supa.habilitado = false;
    expect(await buscarNoScholar("JicYPdAAAAAJ")).toEqual({ ok: false, motivo: "indisponivel" });
  });

  it("função não publicada (erro do gateway) => `indisponivel`", async () => {
    supa.invoke.mockResolvedValue({ data: null, error: { message: "404" } });
    expect(await buscarNoScholar("JicYPdAAAAAJ")).toEqual({ ok: false, motivo: "indisponivel" });
  });

  it("traduz o `motivo` da função, e só os que ela tem permissão de mandar", async () => {
    for (const m of ["bloqueado", "nao_encontrado", "invalido", "erro"]) {
      supa.invoke.mockResolvedValue({ data: { ok: false, motivo: m }, error: null });
      expect(await buscarNoScholar("JicYPdAAAAAJ")).toEqual({ ok: false, motivo: m });
    }
    supa.invoke.mockResolvedValue({ data: { ok: false, motivo: "inventado" }, error: null });
    expect(await buscarNoScholar("JicYPdAAAAAJ")).toEqual({ ok: false, motivo: "erro" });
  });

  it("manda o id EXTRAÍDO, não a URL colada", async () => {
    supa.invoke.mockResolvedValue({ data: { ok: true, h_index: 194 }, error: null });
    await buscarNoScholar(SCHOLAR_URL);
    expect(supa.invoke).toHaveBeenCalledWith("indicadores", { body: { scholar_id: "JicYPdAAAAAJ" } });
  });
});

describe("obterIndicadores — a orquestração, com a fonte SEMPRE declarada", () => {
  it("sem ORCID e sem scholar_id: não busca nada e diz por quê", async () => {
    const r = await obterIndicadores({});
    expect(r.fonte).toBeNull();
    expect(r.motivo).toBe("sem_identificador");
    expect(r.procedencia.trim()).not.toBe("");
    expect(urlsChamadas).toHaveLength(0);
    expect(supa.invoke).not.toHaveBeenCalled();
  });

  it("com scholar_id, o Scholar VENCE — e o OpenAlex nem é consultado", async () => {
    supa.invoke.mockResolvedValue({
      data: {
        ok: true,
        h_index: 194,
        citacoes: 1070076,
        i10: 539,
        nome: "Geoffrey Hinton",
        afiliacao: "University of Toronto",
        atualizado_em: "2026-08-10T12:00:00Z",
        do_cache: true,
      },
      error: null,
    });
    const r = await obterIndicadores({ orcid: ORCID, scholarId: SCHOLAR_URL });
    expect(r.fonte).toBe("scholar");
    expect(r.h_index).toBe(194);
    expect(r.citacoes).toBe(1070076);
    expect(r.do_cache).toBe(true);
    expect(r.motivo).toBeNull();
    expect(r.procedencia).toMatch(/Google Acadêmico/);
    expect(r.procedencia).toContain("10/08");
    expect(urlsChamadas).toHaveLength(0);
  });

  it("sem scholar_id, o OpenAlex por ORCID responde sozinho — e é rotulado como tal", async () => {
    const r = await obterIndicadores({ orcid: ORCID });
    expect(r.fonte).toBe("openalex");
    expect(r.h_index).toBe(57);
    expect(r.citacoes).toBe(13549);
    expect(r.incerto).toBe(false);
    expect(r.procedencia).toMatch(/^segundo o OpenAlex/);
    expect(r.procedencia).not.toMatch(/do seu Google Acad/i);
    expect(supa.invoke).not.toHaveBeenCalled();
  });

  it("Scholar bloqueado: o OpenAlex entra e o MOTIVO do bloqueio sobrevive", async () => {
    supa.invoke.mockResolvedValue({ data: { ok: false, motivo: "bloqueado" }, error: null });
    const r = await obterIndicadores({ orcid: ORCID, scholarId: "JicYPdAAAAAJ" });
    expect(r.fonte).toBe("openalex");
    expect(r.h_index).toBe(57);
    expect(r.motivo).toBe("bloqueado");
    expect(r.procedencia).toMatch(/OpenAlex/);
  });

  it("Edge Function não publicada: cai no OpenAlex em silêncio (o caso de HOJE)", async () => {
    supa.invoke.mockResolvedValue({ data: null, error: { message: "Function not found" } });
    const r = await obterIndicadores({ orcid: ORCID, scholarId: "JicYPdAAAAAJ" });
    expect(r.fonte).toBe("openalex");
    expect(r.motivo).toBe("indisponivel");
  });

  it("AS DUAS FONTES FORA DO AR: nenhum número, motivo preservado, sem exceção", async () => {
    supa.invoke.mockResolvedValue({ data: { ok: false, motivo: "bloqueado" }, error: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const r = await obterIndicadores({ orcid: ORCID, scholarId: "JicYPdAAAAAJ" });
    expect(r.fonte).toBeNull();
    expect(r.h_index).toBeNull();
    expect(r.citacoes).toBeNull();
    expect(r.motivo).toBe("bloqueado");
    expect(r.procedencia.trim()).not.toBe("");
  });

  it("scholar_id de outro domínio é ignorado: o número vem do OpenAlex, rotulado", async () => {
    const r = await obterIndicadores({
      orcid: ORCID,
      scholarId: "https://evil.test/citations?user=JicYPdAAAAAJ",
    });
    expect(supa.invoke).not.toHaveBeenCalled();
    expect(r.fonte).toBe("openalex");
  });

  it("a fonte é declarada em TODOS os desfechos possíveis", async () => {
    const desfechos = [
      { data: { ok: true, h_index: 194, citacoes: 1, atualizado_em: null }, error: null },
      { data: { ok: false, motivo: "bloqueado" }, error: null },
      { data: { ok: false, motivo: "nao_encontrado" }, error: null },
      { data: null, error: { message: "off" } },
    ];
    for (const d of desfechos) {
      supa.invoke.mockResolvedValue(d);
      const r = await obterIndicadores({ orcid: ORCID, scholarId: "JicYPdAAAAAJ" });
      expect(["scholar", "openalex", "manual", null]).toContain(r.fonte);
      expect(r.procedencia.trim().length).toBeGreaterThan(0);
      if (r.fonte === null) expect(r.motivo).not.toBeNull();
    }
  });

  /**
   * O LIMITE ÉTICO, COMO TESTE. O robots.txt do Scholar proíbe
   * `view_op=search_authors`. Nenhuma URL montada pela orquestração pode ir ao
   * Scholar, e muito menos procurar autor por nome.
   */
  it("não existe busca de autor por nome — nenhuma URL vai ao Scholar pelo cliente", async () => {
    await obterIndicadores({ orcid: ORCID, scholarId: "JicYPdAAAAAJ" });
    expect(urlsChamadas.length).toBeGreaterThan(0);
    for (const u of urlsChamadas) {
      expect(u).toMatch(/^https:\/\/api\.openalex\.org\//);
      expect(u).not.toMatch(/scholar\.google|search_authors|mauthors/i);
    }
  });

  it("respeita um AbortSignal já cancelado: devolve sem número, sem estourar", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const r = await obterIndicadores({ orcid: ORCID }, { signal: ctrl.signal });
    expect(r.fonte).toBeNull();
    expect(r.procedencia.trim()).not.toBe("");
  });
});
