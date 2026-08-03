/**
 * Guardas do contrato de figura.
 *
 * Por que este arquivo existe: uma figura publicada é uma afirmação. Quem a
 * cita precisa poder responder de onde veio, de quando é e sob que licença
 * pode reusar — e nada disso sobrevive à boa intenção, só a um teste.
 *
 * Este arquivo NASCEU VERMELHO, de propósito. Ao ser escrito ele reprovou
 * quatro coisas que já estavam no ar:
 *
 *   1. A camada de notificações de doenças ia ao ar SEM DATA nenhuma. Era a
 *      suspeita inicial sobre `FONTE_REDE`, que na verdade carrega o ano dentro
 *      do título ("proposta CNPq 2024"); a fonte de fato sem data era a de
 *      saúde — e é a pior das duas, porque a mesma consulta ao TabNet devolve
 *      outro número meses depois, já que notificação entra com atraso.
 *   2. O mapa dizia "Edital 02/2026" em cinco lugares; o edital de verdade é o
 *      "Nº 04/2026" (`EditalIC2026.tsx:124`, `App.tsx:783`, `validation.ts:40`).
 *   3. A camada de doenças afirmava cobrir "Acre e Amapá" e cobria quatro
 *      estados: AC, AP, MA e TO.
 *   4. O tooltip rotulava tudo como "(desde 2018)", mas Maranhão e Tocantins
 *      acumulam a partir de 2016 — o mapa mostrava 60.524 notificações do
 *      Maranhão com dois anos a menos do que os dados de fato cobrem.
 *
 * Os três últimos são o mesmo erro do catálogo da rede, que `tests/rede.test.ts`
 * já fechou: prosa escrita à mão descrevendo um dado que mudou depois. A defesa
 * é a mesma — derivar do dado em vez de descrever o dado.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIGURAS, figuraPorId } from "../src/figuras/registro";
import { csvDaFigura, tabelaDaFigura, csvEscape } from "../src/figuras/csv";
import { escala, esc, geometria } from "../src/figuras/desenho";
import { construirCamadas, DATA_ACESSO_TABNET } from "../src/mapa/layers";
import { temConteudo, totalNotificacoes, resumoNotificacoes, conteudoPorUf } from "../src/mapa/content";

const RAIZ = join(__dirname, "..");
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf-8");

/* ================================================================== */
/*  O contrato                                                         */
/* ================================================================== */

describe("contrato de figura", () => {
  it("há figuras registradas", () => {
    expect(FIGURAS.length).toBeGreaterThan(0);
  });

  it.each(FIGURAS.map((f) => [f.id, f] as const))("%s tem proveniência completa", (_id, fig) => {
    expect(fig.fonte.titulo.length).toBeGreaterThan(8);
    expect(fig.fonte.publicador.length).toBeGreaterThan(2);
    expect(fig.fonte.url).toMatch(/^https?:\/\//);
    // Ano é o campo que mais falta e o que mais importa: dado sem data não
    // se cita. Aceita ano único ou intervalo.
    expect(fig.fonte.ano).toMatch(/\d{4}/);
    expect(fig.fonte.licenca.length).toBeGreaterThan(8);
  });

  it.each(FIGURAS.map((f) => [f.id, f] as const))("%s define cada coluna", (_id, fig) => {
    expect(fig.colunas.length).toBeGreaterThan(1);
    for (const c of fig.colunas) {
      expect(c.chave).toMatch(/^[a-z][a-z0-9_]*$/);
      // Rótulo não é definição: "Focos" não avisa que um incêndio vira vários.
      expect(c.definicao.length).toBeGreaterThan(20);
      expect(c.definicao).not.toBe(c.rotulo);
    }
  });

  it.each(FIGURAS.map((f) => [f.id, f] as const))("%s declara a caixa (CLS zero)", (_id, fig) => {
    expect(fig.caixa.largura).toBeGreaterThan(100);
    expect(fig.caixa.altura).toBeGreaterThan(100);
  });

  it("ids são únicos e estáveis para URL", () => {
    const ids = FIGURAS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("subtítulo define a métrica, não repete o título", () => {
    for (const f of FIGURAS) {
      expect(f.subtitulo.length).toBeGreaterThan(30);
      expect(f.subtitulo).not.toBe(f.titulo);
    }
  });
});

/* ================================================================== */
/*  Os dados por trás                                                  */
/* ================================================================== */

describe("dados da figura", () => {
  it.each(FIGURAS.map((f) => [f.id, f] as const))("%s: toda coluna existe em toda linha", (_id, fig) => {
    const linhas = fig.linhas();
    expect(linhas.length).toBeGreaterThan(2);
    for (const l of linhas) {
      for (const c of fig.colunas) expect(Object.keys(l)).toContain(c.chave);
    }
  });

  it("a série de focos bate com o JSON gerado pelo script", () => {
    const bruto = JSON.parse(ler("src/content/dados/focos-por-uf-ano.json"));
    const AL = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"];
    const fig = figuraPorId("focos-amazonia-legal")!;
    for (const l of fig.linhas()) {
      const esperado = AL.reduce((t, uf) => t + (bruto.focosPorUf[uf]?.[String(l.ano)] ?? 0), 0);
      expect(l.focos).toBe(esperado);
    }
  });

  it("o JSON de focos traz meta completo e a série cobre o período declarado", () => {
    const d = JSON.parse(ler("src/content/dados/focos-por-uf-ano.json"));
    for (const campo of ["titulo", "fonte", "publicador", "url", "licenca", "periodo", "geradoEm", "geradoPor"]) {
      expect(d.meta[campo], `meta.${campo}`).toBeTruthy();
    }
    const [de, ate] = d.meta.periodo.split(" a ").map(Number);
    expect(d.anos[0]).toBe(de);
    expect(d.anos[d.anos.length - 1]).toBe(ate);
    // A soma por bioma tem de fechar com o total. Foi assim que apareceu a
    // duplicação do índice do INPE, que contava cada arquivo duas vezes.
    const total = Object.values(d.focosPorUf as Record<string, Record<string, number>>)
      .reduce((t, v) => t + Object.values(v).reduce((a, b) => a + b, 0), 0);
    expect(Object.values(d.biomas as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(total);
  });
});

/* ================================================================== */
/*  CSV                                                                */
/* ================================================================== */

describe("csv", () => {
  it("escapa o que precisa e só o que precisa", () => {
    expect(csvEscape("simples")).toBe("simples");
    expect(csvEscape("com;ponto")).toBe('"com;ponto"');
    expect(csvEscape('aspas "aqui"')).toBe('"aspas ""aqui"""');
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(0)).toBe("0");
  });

  it.each(FIGURAS.map((f) => [f.id, f] as const))("%s: CSV traz BOM, procedência e a tabela", (_id, fig) => {
    const csv = csvDaFigura(fig);
    // BOM: sem ele o Excel em português mostra "Rondônia" como "RondÃ´nia".
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(fig.fonte.url);
    expect(csv).toContain(fig.fonte.licenca);
    expect(csv).toContain(fig.fonte.ano);
    for (const c of fig.colunas) expect(csv).toContain(c.definicao);
    // Uma linha de cabeçalho e uma por registro.
    const tabela = tabelaDaFigura(fig);
    expect(tabela.split("\n").length).toBe(fig.linhas().length + 1);
    expect(tabela.split("\n")[0]).toBe(fig.colunas.map((c) => c.chave).join(";"));
  });
});

/* ================================================================== */
/*  Desenho                                                            */
/* ================================================================== */

describe("desenho", () => {
  it("escala escolhe topo redondo", () => {
    expect(escala(281827).teto).toBe(300000);
    expect(escala(97).teto).toBe(100);
    expect(escala(0).teto).toBe(1);
    for (const max of [3, 47, 812, 99999, 5125559]) {
      const { teto, cortes } = escala(max);
      expect(teto).toBeGreaterThanOrEqual(max);
      expect(cortes[0]).toBe(0);
      expect(cortes[cortes.length - 1]).toBe(teto);
    }
  });

  it("escapa XML, senão um & na fonte quebra o arquivo", () => {
    expect(esc('a & b < c > d "e"')).toBe("a &amp; b &lt; c &gt; d &quot;e&quot;");
  });

  it.each(FIGURAS.map((f) => [f.id, f] as const))("%s: SVG é válido e carimba a procedência", (_id, fig) => {
    const svg = fig.desenhar(fig.linhas(), fig.caixa);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    // width/height explícitos são o que reserva espaço e mantém o CLS em zero.
    expect(svg).toContain(`width="${fig.caixa.largura}"`);
    expect(svg).toContain(`height="${fig.caixa.altura}"`);
    expect(svg).toContain(`viewBox="0 0 ${fig.caixa.largura} ${fig.caixa.altura}"`);
    // A imagem viaja sozinha: sem carimbo ela vira gráfico sem procedência.
    expect(svg).toContain("<title");
    expect(svg).toContain("<desc");
    // Nenhuma tag por fechar: contagem de "<" casa com a de ">".
    expect((svg.match(/</g) ?? []).length).toBe((svg.match(/>/g) ?? []).length);
    expect(svg).not.toContain("undefined");
    expect(svg).not.toContain("NaN");
  });

  it("a geometria do traço corresponde aos dados, não a um desenho paralelo", () => {
    const fig = figuraPorId("focos-amazonia-legal")!;
    const linhas = fig.linhas();
    const svg = fig.desenhar(linhas, fig.caixa);
    const d = /<path d="([^"]+)" fill="none"/.exec(svg)?.[1];
    expect(d).toBeTruthy();
    const pontos = d!.split(/[ML]/).filter(Boolean).map((p) => p.trim().split(" ").map(Number));
    expect(pontos.length).toBe(linhas.length);

    // O maior valor tem de virar o menor y (o eixo do SVG cresce para baixo).
    const valores = linhas.map((l) => Number(l.focos));
    const iMax = valores.indexOf(Math.max(...valores));
    const iMin = valores.indexOf(Math.min(...valores));
    const ys = pontos.map((p) => p[1]);
    expect(ys.indexOf(Math.min(...ys))).toBe(iMax);
    expect(ys.indexOf(Math.max(...ys))).toBe(iMin);

    // X é monótono: a série é temporal e não pode voltar no tempo.
    const xs = pontos.map((p) => p[0]);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it("as três variantes publicadas estão sincronizadas com o registro", () => {
    // Se este teste falhar, é só rodar `node scripts/build-figuras.mjs`.
    // Ele existe porque um SVG velho em public/ seria servido calado a quem não
    // tem JavaScript, mostrando números que o site já não afirma.
    for (const fig of FIGURAS) {
      const variantes: Array<[string, string]> = [
        [`${fig.id}.svg`, fig.desenhar(fig.linhas(), fig.caixa, true)],
        [`${fig.id}-embed.svg`, fig.desenhar(fig.linhas(), fig.caixa, false)],
        [`${fig.id}-embed-sm.svg`, fig.desenhar(fig.linhas(), fig.caixaMobile, false)],
      ];
      for (const [arquivo, esperado] of variantes) {
        expect(ler(`public/figuras/${arquivo}`).trimEnd(), `${arquivo} desatualizado`).toBe(esperado.trimEnd());
      }
    }
  });

  it("o embutido não repete o título que o HTML já mostra", () => {
    for (const fig of FIGURAS) {
      const embed = fig.desenhar(fig.linhas(), fig.caixa, false);
      const solto = fig.desenhar(fig.linhas(), fig.caixa, true);
      // O <title> acessível fica nos dois; o que sai é o <text> visível.
      expect(embed).toContain(`<title id="t-titulo">`);
      expect(embed.includes(`font-weight="700"`)).toBe(false);
      expect(solto.includes(`font-weight="700"`)).toBe(true);
      expect(embed.length).toBeLessThan(solto.length);
    }
  });

  it("a mira cai sobre o traço, nas duas caixas", () => {
    /* A camada interativa converte pixel de tela em coordenada do viewBox e
       pergunta à geometria qual ano está mais perto. Se ela usasse margens
       diferentes das do desenho, a linha da mira apareceria ao lado do ponto.
       Como o observador de interseção não roda em ambiente de teste, esta é a
       verificação que substitui o clique: reproduz a conta do componente. */
    const fig = figuraPorId("focos-amazonia-legal")!;
    const linhas = fig.linhas();
    const series = [{ rotulo: "x", cor: "", pontos: linhas.map((l) => ({ x: Number(l.ano), y: Number(l.focos) })) }];

    for (const caixa of [fig.caixa, fig.caixaMobile]) {
      // `false`: a página embute a variante sem carimbo, de margem menor.
      const g = geometria(series, caixa, false);
      for (const ano of g.valoresX) {
        // Aponta exatamente no ano: tem de devolver o próprio ano.
        expect(g.xMaisProximo(g.px(ano))).toBe(ano);
        // Aponta 30% do caminho até o vizinho: ainda tem de devolver o ano.
        const proximo = g.valoresX[g.valoresX.indexOf(ano) + 1];
        if (proximo == null) continue;
        const passo = g.px(proximo) - g.px(ano);
        expect(g.xMaisProximo(g.px(ano) + passo * 0.3)).toBe(ano);
        expect(g.xMaisProximo(g.px(ano) + passo * 0.7)).toBe(proximo);
      }
      // O traço nunca sai da área útil.
      for (const p of series[0].pontos) {
        expect(g.px(p.x)).toBeGreaterThanOrEqual(g.area.x0 - 0.01);
        expect(g.px(p.x)).toBeLessThanOrEqual(g.area.x1 + 0.01);
        expect(g.py(p.y)).toBeGreaterThanOrEqual(g.area.y0 - 0.01);
        expect(g.py(p.y)).toBeLessThanOrEqual(g.area.y1 + 0.01);
      }
    }
  });

  it("a caixa estreita mantém o rótulo do eixo legível no celular", () => {
    // Num viewBox de largura L exibido com largura W, um texto de tamanho s
    // aparece com s*W/L. O palco num telefone de 375px dá ~293px úteis; abaixo
    // de ~9px reais o eixo deixa de ser lido.
    const PALCO_CELULAR = 293;
    for (const fig of FIGURAS) {
      expect(fig.caixaMobile.largura).toBeLessThan(fig.caixa.largura);
      const aparente = 11 * (PALCO_CELULAR / fig.caixaMobile.largura);
      expect(aparente, `${fig.id}: rótulo a ${aparente.toFixed(1)}px no celular`).toBeGreaterThan(8.5);
      // E a caixa larga, exibida no desktop (~860px), não pode inchar o texto.
      expect(11 * (860 / fig.caixa.largura)).toBeLessThan(14);
    }
  });
});

/* ================================================================== */
/*  Os quatro defeitos que este arquivo nasceu para expor              */
/* ================================================================== */

describe("proveniência das camadas do mapa", () => {
  const camadas = construirCamadas(temConteudo, resumoNotificacoes);
  const de = (id: string) => camadas.find((c) => c.id === id)!;

  it("toda camada publicada tem fonte com ano", () => {
    for (const c of camadas) {
      expect(c.fonte, `camada ${c.id} sem fonte`).toBeTruthy();
      expect(c.fonte!.titulo.length).toBeGreaterThan(8);
      // Defeito 1: FONTE_REDE ia ao ar sem ano nenhum.
      expect(c.fonte!.data ?? c.fonte!.titulo, `camada ${c.id} sem ano`).toMatch(/\d{4}/);
    }
  });

  it("a data de acesso ao TabNet acompanha a ficha mais recente", () => {
    // Data chumbada envelhece calada. Este teste avisa quando uma ficha nova
    // deixa a camada citando um acesso mais antigo do que o dado que ela pinta.
    let maisRecente = "";
    for (const e of conteudoPorUf.values()) {
      for (const f of e.fontes ?? []) if (f.data && f.data > maisRecente) maisRecente = f.data;
    }
    expect(maisRecente).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DATA_ACESSO_TABNET).toBe(maisRecente);
  });

  it("o mapa cita o mesmo edital que a página do edital", () => {
    // Defeito 2: o mapa dizia 02/2026; o edital é o Nº 04/2026.
    const numero = /Nº (\d+\/\d{4})/.exec(ler("src/EditalIC2026.tsx"))?.[1];
    expect(numero).toBe("04/2026");
    for (const arquivo of ["src/mapa/layers.ts", "src/content/mapa/narrativa/04-formacao.json"]) {
      expect(ler(arquivo), `${arquivo} cita edital inexistente`).not.toMatch(/Edital 02\/2026/);
    }
    expect(de("vagas-ic-2026").label).toContain(numero!);
  });

  it("a camada de doenças descreve a cobertura que ela de fato tem", () => {
    // Defeito 3: dizia "Acre e Amapá" e pintava AC, AP, MA e TO.
    const cobertas = [...conteudoPorUf.keys()].filter((uf) => totalNotificacoes(uf) != null).sort();
    expect(cobertas.length).toBeGreaterThan(0);
    const descricao = de("doencas-notificacoes").descricao ?? "";
    for (const uf of cobertas) {
      expect(descricao, `descrição omite ${uf}, que está pintado`).toContain(uf);
    }
  });

  it("o rótulo não afirma um ano inicial que os dados não têm", () => {
    // Defeito 4: rotulava tudo "(desde 2018)"; MA e TO acumulam de 2016.
    const anos = new Set<string>();
    for (const e of conteudoPorUf.values()) {
      for (const d of e.doencas ?? []) {
        const p = d.notificacoes?.representativo !== false ? d.notificacoes?.periodo : undefined;
        const a = p ? /(\d{4})/.exec(p)?.[1] : undefined;
        if (a) anos.add(a);
      }
    }
    expect(anos.size).toBeGreaterThan(1); // é justamente por variar que o rótulo fixo mente

    const camada = de("doencas-notificacoes");
    const maisAntigo = [...anos].sort()[0];
    for (const uf of ["MA", "TO", "AC", "AP"]) {
      const rotulo = camada.rotularValor?.({ sigla: uf } as never) ?? "";
      if (!/\d{4}/.test(rotulo)) continue;
      const citado = /(\d{4})/.exec(rotulo)![1];
      const real = /(\d{4})/.exec(
        [...(conteudoPorUf.get(uf)?.doencas ?? [])]
          .filter((d) => d.notificacoes && d.notificacoes.representativo !== false)
          .map((d) => d.notificacoes!.periodo ?? "")
          .sort()[0] ?? "",
      )?.[1];
      if (real) expect(citado, `rótulo de ${uf} afirma ${citado}, dados começam em ${real}`).toBe(real);
    }
    expect(maisAntigo).toBeTruthy();
  });
});
