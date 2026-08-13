/**
 * ============================================================================
 *  Artigos do Google Acadêmico (Tela 2) — a prova a seco
 * ============================================================================
 *  Cobre o MOTOR que trouxe a lista de publicações do perfil do Scholar para
 *  dentro do relato: o parser puro (`parsearArtigosScholar`), a orquestração que
 *  chama a Edge Function e filtra pelo período (`buscarArtigosDoScholar`), e a
 *  resolução de cada candidato a um DOI pelo Crossref (`resolverArtigoADoi`,
 *  `casarTituloAno`, `buscarDoiPorTitulo`).
 *
 *  POR QUE O SCHOLAR, E NÃO SÓ O ORCID: o ORCID só tem o que a pessoa DEPOSITOU,
 *  e faltavam de 15% a 60% dos artigos. A página de perfil do Scholar lista o que
 *  vive só no Lattes e nas revistas nacionais. O preço são títulos TRUNCADOS e
 *  SEM DOI — por isso cada item entra como candidato a confirmar.
 *
 *  NENHUM TESTE AQUI TOCA A REDE: o HTML é fixture (recorte fiel da forma real de
 *  cada `<tr class="gsc_a_tr">`), o Supabase é módulo mockado e o `fetch` do
 *  Crossref é stub. A prova contra um perfil público REAL foi feita fora da suíte
 *  (curl), e o teste de "as duas cópias do parser são idênticas" garante que a
 *  cópia validada é a mesma que roda em produção na Edge Function.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";

/** Mesmo motivo de `relato-indicadores.test.ts`: o import é dinâmico e lê env. */
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
  parsearArtigosScholar,
  buscarArtigosDoScholar,
  resolverArtigoADoi,
  type ArtigoDoScholar,
} from "../src/relato/indicadores";
import {
  casarTituloAno,
  similaridadeTitulo,
  normalizarTitulo,
  buscarDoiPorTitulo,
  LIMIAR_TITULO,
  MIN_PREFIXO_TRUNCADO,
  type CandidatoCrossref,
} from "../src/relato/metadados";

// ================================================================ fixtures

/**
 * Recorte fiel de três `<tr class="gsc_a_tr">`: um título TRUNCADO (2026, com
 * `&#8230;` no fim), um título inteiro (2025) e um item FORA DO PERÍODO (2019).
 * O ano vive em `<span class="gsc_a_h …">`, o veículo traz o ano repetido dentro
 * de `<span class="gs_oph">` (que o parser remove) e o link é relativo, com
 * `&amp;` de copiar-colar de HTML. Os acentos vêm como CARACTERES CRUS, e não
 * como entidades nomeadas: a Edge Function decodifica o charset ISO-8859-1 da
 * página ANTES de parsear, então `&ccedil;` nunca chega ao parser — só bytes.
 */
const HTML_ARTIGOS = `<table id="gsc_a_t"><tbody id="gsc_a_b">
<tr class="gsc_a_tr"><td class="gsc_a_t"><a href="/citations?view_op=view_citation&amp;hl=pt-BR&amp;user=JicYPdAAAAAJ&amp;citation_for_view=JicYPdAAAAAJ:aaa" class="gsc_a_at">Neutralização cruzada de antivenenos e a resposta imune em&#8230;</a><div class="gs_gray">W M Monteiro, J Sachett, M Sartim</div><div class="gs_gray">Toxicon: X<span class="gs_oph">, 2026</span></div></td><td class="gsc_a_c"><a href="#" class="gsc_a_ac gs_ibl">3</a></td><td class="gsc_a_y"><span class="gsc_a_h gsc_a_hc gs_ibl">2026</span></td></tr>
<tr class="gsc_a_tr"><td class="gsc_a_t"><a href="/citations?view_op=view_citation&amp;user=JicYPdAAAAAJ&amp;citation_for_view=JicYPdAAAAAJ:bbb" class="gsc_a_at">Bioprospecção de peptídeos antimicrobianos</a><div class="gs_gray">A Bélem, C Conceição</div><div class="gs_gray">Revista Brasileira de Farmacognosia<span class="gs_oph">, 2025</span></div></td><td class="gsc_a_c"></td><td class="gsc_a_y"><span class="gsc_a_h gsc_a_hc gs_ibl">2025</span></td></tr>
<tr class="gsc_a_tr"><td class="gsc_a_t"><a href="/citations?view_op=view_citation&amp;user=JicYPdAAAAAJ&amp;citation_for_view=JicYPdAAAAAJ:ccc" class="gsc_a_at">Um estudo antigo sobre serpentes</a><div class="gs_gray">X Y</div><div class="gs_gray">Journal Antigo<span class="gs_oph">, 2019</span></div></td><td class="gsc_a_c"></td><td class="gsc_a_y"><span class="gsc_a_h gsc_a_hc gs_ibl">2019</span></td></tr>
</tbody></table>`;

/** A página de bloqueio: HTTP 200, sem nenhuma `gsc_a_tr`. */
const HTML_CAPTCHA = `<!doctype html><html><body><div id="gs_captcha_c"><div class="g-recaptcha"></div>
<p>Nossos sistemas detectaram tráfego incomum.</p></div></body></html>`;

// ================================================= 1. parsearArtigosScholar

describe("parsearArtigosScholar — contra o HTML de fixture", () => {
  it("extrai as TRÊS linhas com título, veículo, autores, ano e link", () => {
    const artigos = parsearArtigosScholar(HTML_ARTIGOS);
    expect(artigos).toHaveLength(3);

    expect(artigos[0]).toEqual({
      titulo: "Neutralização cruzada de antivenenos e a resposta imune em…",
      veiculo: "Toxicon: X",
      autores: "W M Monteiro, J Sachett, M Sartim",
      ano: 2026,
      link: "https://scholar.google.com/citations?view_op=view_citation&hl=pt-BR&user=JicYPdAAAAAJ&citation_for_view=JicYPdAAAAAJ:aaa",
      truncado: true,
    });

    expect(artigos[1]).toEqual({
      titulo: "Bioprospecção de peptídeos antimicrobianos",
      veiculo: "Revista Brasileira de Farmacognosia",
      autores: "A Bélem, C Conceição",
      ano: 2025,
      link: "https://scholar.google.com/citations?view_op=view_citation&user=JicYPdAAAAAJ&citation_for_view=JicYPdAAAAAJ:bbb",
      truncado: false,
    });

    expect(artigos[2].ano).toBe(2019);
  });

  it("marca `truncado` só quando o título termina em reticência", () => {
    const artigos = parsearArtigosScholar(HTML_ARTIGOS);
    expect(artigos[0].truncado).toBe(true);
    expect(artigos[1].truncado).toBe(false);
    expect(artigos[2].truncado).toBe(false);
  });

  it("remove o ano repetido do veículo (o `<span class=\"gs_oph\">`)", () => {
    const artigos = parsearArtigosScholar(HTML_ARTIGOS);
    for (const a of artigos) expect(a.veiculo).not.toMatch(/\d{4}/);
  });

  it("torna o link absoluto e decodifica `&amp;`", () => {
    const artigos = parsearArtigosScholar(HTML_ARTIGOS);
    expect(artigos[0].link).toMatch(/^https:\/\/scholar\.google\.com\/citations\?/);
    expect(artigos[0].link).not.toMatch(/&amp;/);
  });

  it("CAPTCHA, HTML vazio e página sem `gsc_a_tr` devolvem lista vazia", () => {
    expect(parsearArtigosScholar(HTML_CAPTCHA)).toEqual([]);
    expect(parsearArtigosScholar("")).toEqual([]);
    expect(parsearArtigosScholar("<html><body>nada aqui</body></html>")).toEqual([]);
  });

  it("uma linha sem título (`gsc_a_at` ausente) não vira artigo", () => {
    const semTitulo = `<tr class="gsc_a_tr"><td class="gsc_a_t"><div class="gs_gray">Autor</div></td><td class="gsc_a_y"><span class="gsc_a_h">2025</span></td></tr>`;
    expect(parsearArtigosScholar(semTitulo)).toEqual([]);
  });
});

// ================================ 2. as duas cópias do parser andando juntas

/**
 * O PARSER DOS ARTIGOS É DUPLICADO — cliente (bundle Vite) e Edge Function
 * (Deno) —, pelo mesmo motivo do parser do perfil: os dois runtimes não
 * compartilham módulo. A cópia que roda em PRODUÇÃO é a do Deno, que nenhum
 * outro teste alcança; aqui as duas são comparadas caractere a caractere, para
 * que uma divergência apareça na suíte e não num relatório com artigo faltando.
 */
describe("as duas cópias do parser de artigos (cliente e Edge) são idênticas", () => {
  const fonteCliente = readFileSync(new URL("../src/relato/indicadores.ts", import.meta.url), "utf8");
  const fonteDeno = readFileSync(
    new URL("../supabase/functions/indicadores/index.ts", import.meta.url),
    "utf8",
  );

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

  for (const nome of ["absolutizarScholar", "lerLinhaArtigo", "parsearArtigosScholar"]) {
    it(`${nome} é o mesmo código nos dois arquivos`, () => {
      expect(corpoDaFuncao(fonteDeno, nome)).toBe(corpoDaFuncao(fonteCliente, nome));
    });
  }
});

// ================================================= 3. buscarArtigosDoScholar

const SCHOLAR_ID = "JicYPdAAAAAJ";

/** Um artigo já parseado, como a Edge Function o devolve dentro de `artigos`. */
const art = (titulo: string, ano: number | null, extra: Record<string, unknown> = {}) => ({
  titulo,
  veiculo: "Rev",
  autores: "F",
  ano,
  link: null,
  truncado: false,
  ...extra,
});

beforeEach(() => {
  supa.habilitado = true;
  supa.invoke.mockReset();
  supa.invoke.mockResolvedValue({ data: null, error: { message: "não publicada" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buscarArtigosDoScholar — chamada, filtro de período e degradação", () => {
  it("id inválido é recusado ANTES de chamar a função", async () => {
    const r = await buscarArtigosDoScholar("https://evil.test/citations?user=JicYPdAAAAAJ");
    expect(r).toEqual({ artigos: [], motivo: "invalido" });
    expect(supa.invoke).not.toHaveBeenCalled();
  });

  it("pede `comArtigos:true` e manda o id EXTRAÍDO, não a URL colada", async () => {
    supa.invoke.mockResolvedValue({ data: { ok: true, artigos: [] }, error: null });
    await buscarArtigosDoScholar(`https://scholar.google.com/citations?user=${SCHOLAR_ID}&hl=pt-BR`);
    expect(supa.invoke).toHaveBeenCalledWith("indicadores", {
      body: { scholar_id: SCHOLAR_ID, comArtigos: true },
    });
  });

  it("FILTRA o que está fora do período do ciclo (mantém 2025/2026, tira 2019)", async () => {
    supa.invoke.mockResolvedValue({
      data: { ok: true, artigos: [art("Recente A", 2026), art("Antigo", 2019), art("Recente B", 2025)] },
      error: null,
    });
    const r = await buscarArtigosDoScholar(SCHOLAR_ID);
    expect(r.motivo).toBeNull();
    expect(r.artigos.map((a) => a.titulo)).toEqual(["Recente A", "Recente B"]);
  });

  it("descarta item sem ano e item sem título (não dá para situá-los na janela)", async () => {
    supa.invoke.mockResolvedValue({
      data: { ok: true, artigos: [art("Sem ano", null), art("", 2026), art("Bom", 2025)] },
      error: null,
    });
    const r = await buscarArtigosDoScholar(SCHOLAR_ID);
    expect(r.artigos.map((a) => a.titulo)).toEqual(["Bom"]);
  });

  it("plataforma desligada => lista vazia e `indisponivel`, nunca exceção", async () => {
    supa.habilitado = false;
    expect(await buscarArtigosDoScholar(SCHOLAR_ID)).toEqual({ artigos: [], motivo: "indisponivel" });
  });

  it("função não publicada (erro do gateway) => `indisponivel`", async () => {
    supa.invoke.mockResolvedValue({ data: null, error: { message: "404" } });
    expect(await buscarArtigosDoScholar(SCHOLAR_ID)).toEqual({ artigos: [], motivo: "indisponivel" });
  });

  it("Scholar bloqueado => lista vazia com o MOTIVO preservado", async () => {
    supa.invoke.mockResolvedValue({ data: { ok: false, motivo: "bloqueado" }, error: null });
    expect(await buscarArtigosDoScholar(SCHOLAR_ID)).toEqual({ artigos: [], motivo: "bloqueado" });
  });

  it("motivo desconhecido da função vira `erro`, não um motivo inventado", async () => {
    supa.invoke.mockResolvedValue({ data: { ok: false, motivo: "inventado" }, error: null });
    expect(await buscarArtigosDoScholar(SCHOLAR_ID)).toEqual({ artigos: [], motivo: "erro" });
  });

  it("exceção dentro da invocação vira `indisponivel` — nunca estoura", async () => {
    supa.invoke.mockImplementation(async () => {
      throw new Error("offline");
    });
    expect(await buscarArtigosDoScholar(SCHOLAR_ID)).toEqual({ artigos: [], motivo: "indisponivel" });
  });
});

// ================================================= 4. casamento a DOI (puro)

describe("normalizarTitulo e similaridadeTitulo", () => {
  it("normaliza caixa, acento e pontuação a um espaço só", () => {
    expect(normalizarTitulo("Bioprospecção de Peptídeos: uma revisão!")).toBe(
      "bioprospeccao de peptideos uma revisao",
    );
  });

  it("Dice é 1 para o mesmo título e cai com palavras trocadas", () => {
    expect(similaridadeTitulo("a b c d", "a b c d")).toBe(1);
    expect(similaridadeTitulo("a b c d", "a b c x")).toBeCloseTo(0.75, 5);
    expect(similaridadeTitulo("nada", "totalmente diferente aqui")).toBe(0);
  });
});

describe("casarTituloAno — a decisão conservadora", () => {
  const cands: CandidatoCrossref[] = [
    { doi: "10.1000/exato", titulo: "Bioprospecção de peptídeos antimicrobianos", ano: 2025 },
    { doi: "10.1000/outro", titulo: "Um trabalho completamente diferente", ano: 2025 },
  ];

  it("casa o título inteiro por igualdade normalizada (acento/caixa não importam)", () => {
    const m = casarTituloAno("BIOPROSPECCAO DE PEPTIDEOS ANTIMICROBIANOS", 2025, cands);
    expect(m?.doi).toBe("10.1000/exato");
    expect(m?.score).toBe(1);
  });

  it("casa um título TRUNCADO por prefixo longo o bastante", () => {
    const m = casarTituloAno("Bioprospecção de peptíde", 2025, cands, true);
    expect(m?.doi).toBe("10.1000/exato");
  });

  it("RECUSA prefixo curto demais (evita casar 'Estudo da...' com qualquer coisa)", () => {
    expect(casarTituloAno("Bioprosp", 2025, cands, true)).toBeNull();
    expect("Bioprosp".length).toBeLessThan(MIN_PREFIXO_TRUNCADO);
  });

  it("RECUSA título diferente, mesmo com o ano certo", () => {
    expect(casarTituloAno("Ecologia de anfíbios amazônicos", 2025, cands)).toBeNull();
  });

  it("aceita diferença de 1 ano (online vs. impresso) e recusa 2", () => {
    expect(casarTituloAno("Bioprospecção de peptídeos antimicrobianos", 2024, cands)?.doi).toBe(
      "10.1000/exato",
    );
    expect(casarTituloAno("Bioprospecção de peptídeos antimicrobianos", 2023, cands)).toBeNull();
  });

  it("o limiar de similaridade é o que separa casar de não casar", () => {
    expect(LIMIAR_TITULO).toBeGreaterThanOrEqual(0.85);
  });
});

// ============================== 5. resolverArtigoADoi / buscarDoiPorTitulo

/** Resposta mínima que o `buscarJson` de metadados espera. */
function respostaJson(corpo: unknown, status = 200): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => corpo } as unknown as Response;
}

/** Um payload de busca do Crossref com os candidatos dados. */
function crossref(items: Array<{ DOI: string; title: string[]; ano: number }>) {
  return {
    message: {
      items: items.map((i) => ({ DOI: i.DOI, title: i.title, issued: { "date-parts": [[i.ano]] } })),
    },
  };
}

describe("resolverArtigoADoi — casa o candidato do Scholar a um DOI, ou não afirma", () => {
  let urls: string[] = [];

  beforeEach(() => {
    urls = [];
  });

  const stub = (corpo: unknown, status = 200) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return respostaJson(corpo, status);
      }),
    );

  const artigo = (over: Partial<ArtigoDoScholar>): ArtigoDoScholar => ({
    titulo: "Bioprospecção de peptídeos antimicrobianos",
    veiculo: "Rev",
    autores: "F",
    ano: 2025,
    link: null,
    truncado: false,
    ...over,
  });

  it("título inteiro que casa exato devolve o DOI", async () => {
    stub(crossref([{ DOI: "10.1590/abc-2025", title: ["Bioprospecção de peptídeos antimicrobianos"], ano: 2025 }]));
    expect(await resolverArtigoADoi(artigo({}))).toBe("10.1590/abc-2025");
  });

  it("título TRUNCADO casa pelo prefixo com o título completo do Crossref", async () => {
    stub(
      crossref([
        { DOI: "10.1590/completo", title: ["Bioprospecção de peptídeos antimicrobianos marinhos raros"], ano: 2026 },
      ]),
    );
    const r = await resolverArtigoADoi(artigo({ titulo: "Bioprospecção de peptídeos antimicrobianos…", ano: 2026, truncado: true }));
    expect(r).toBe("10.1590/completo");
  });

  it("título diferente NÃO afirma DOI (melhor deixar a pessoa confirmar)", async () => {
    stub(crossref([{ DOI: "10.1590/errado", title: ["Outra coisa totalmente distinta"], ano: 2025 }]));
    expect(await resolverArtigoADoi(artigo({}))).toBeNull();
  });

  it("sem ano não vai à rede — não há como confirmar", async () => {
    stub(crossref([]));
    expect(await resolverArtigoADoi(artigo({ ano: null }))).toBeNull();
    expect(urls).toHaveLength(0);
  });

  it("manda o filtro de data e o `mailto` do polite pool ao Crossref", async () => {
    stub(crossref([{ DOI: "10.1/x", title: ["Bioprospecção de peptídeos antimicrobianos"], ano: 2025 }]));
    await resolverArtigoADoi(artigo({}));
    expect(urls[0]).toContain("query.bibliographic=");
    expect(urls[0]).toContain("filter=from-pub-date:2024-01-01,until-pub-date:2026-12-31");
    expect(urls[0]).toContain("mailto=");
  });

  it("Crossref fora do ar => null, nunca exceção", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNRESET");
    }));
    expect(await resolverArtigoADoi(artigo({}))).toBeNull();
  });

  it("buscarDoiPorTitulo devolve o casamento com score, para quem quiser inspecionar", async () => {
    stub(crossref([{ DOI: "10.1/y", title: ["Bioprospecção de peptídeos antimicrobianos"], ano: 2025 }]));
    const m = await buscarDoiPorTitulo("Bioprospecção de peptídeos antimicrobianos", 2025);
    expect(m).toEqual({ doi: "10.1/y", titulo: "Bioprospecção de peptídeos antimicrobianos", ano: 2025, score: 1 });
  });
});
