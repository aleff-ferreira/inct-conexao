import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ufs, VIEW, WORLD, ufBySigla, focusViewBox, ufsPorRegiao, regionViewBox, enquadramentoDe, REGIOES } from "../src/mapa/geo";
import { escolherPasso } from "../src/ui/passos";
import { parseMapaHash, buildMapaHash, isMapaHash, ESTADO_PADRAO } from "../src/mapa/url";
import { parseHash } from "../src/webinars/router";
import { construirCamadas, VAGAS_IC_2026, totalVagasIc, totalUfsComVagas, TEMAS, CAMADA_IDS, SECAO_IDS } from "../src/mapa/layers";
import { carregarTodasFichas, capitulos, capituloInicial, temConteudo, totalNotificacoes, resumoNotificacoes } from "../src/mapa/content";
import { conquistasDe } from "../src/mapa/gamify";
import { CHUVA_POR_REGIAO } from "../src/mapa/clima";
import type { EstadoConteudo } from "../src/mapa/types";

/* As fichas passaram a ser carregadas sob demanda (135 kB que nao precisam
   descer para quem nunca abre um estado). Em teste, pedimos todas de uma vez —
   await de topo, que o vitest suporta em ESM. */
const FICHAS = await carregarTodasFichas();

/* --------------------------------------------------------------- GEOMETRIA */
describe("geo · artefato oficial do IBGE", () => {
  it("tem exatamente 27 unidades federativas", () => {
    expect(ufs).toHaveLength(27);
  });

  it("cada UF tem sigla, nome, região e path SVG válido", () => {
    for (const u of ufs) {
      expect(u.sigla).toMatch(/^[A-Z]{2}$/);
      expect(u.nome).toBeTruthy();
      expect(u.regiao).toBeTruthy();
      expect(u.path.startsWith("M")).toBe(true);
      expect(u.path.endsWith("Z")).toBe(true);
    }
  });

  it("siglas são únicas", () => {
    const set = new Set(ufs.map((u) => u.sigla));
    expect(set.size).toBe(27);
  });

  it("bbox e centroide estão dentro do viewBox", () => {
    for (const u of ufs) {
      const [x0, y0, x1, y1] = u.bbox;
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(y0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(VIEW.w + 0.5);
      expect(y1).toBeLessThanOrEqual(VIEW.h + 0.5);
      const [cx, cy] = u.centroid;
      expect(cx).toBeGreaterThanOrEqual(x0);
      expect(cx).toBeLessThanOrEqual(x1);
      expect(cy).toBeGreaterThanOrEqual(y0);
      expect(cy).toBeLessThanOrEqual(y1);
    }
  });

  it("Amazônia Legal = 9 UFs (8 integrais + MA parcial)", () => {
    const legal = ufs.filter((u) => u.amazoniaLegal).map((u) => u.sigla).sort();
    expect(legal).toEqual(["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]);
    expect(ufBySigla("MA")!.amazoniaLegal).toBe("parcial");
    expect(ufBySigla("RO")!.amazoniaLegal).toBe("integral");
    expect(ufBySigla("CE")!.amazoniaLegal).toBeNull();
  });

  it("focusViewBox de qualquer UF permanece dentro do mapa", () => {
    for (const u of ufs) {
      const [x, y, w, h] = focusViewBox(u);
      expect(x).toBeGreaterThanOrEqual(VIEW.x - 0.5);
      expect(y).toBeGreaterThanOrEqual(VIEW.y - 0.5);
      expect(x + w).toBeLessThanOrEqual(VIEW.x + VIEW.w + 0.5);
      expect(y + h).toBeLessThanOrEqual(VIEW.y + VIEW.h + 0.5);
    }
  });

  it("ufsPorRegiao cobre as 27 UFs sem duplicar", () => {
    const total = ufsPorRegiao().reduce((n, g) => n + g.ufs.length, 0);
    expect(total).toBe(27);
  });
});

/* -------------------------------------------------------------------- URL */
describe("url · estado serializado na hash", () => {
  it("#/mapa → vitrine (panorama) com padrões", () => {
    const s = parseMapaHash("#/mapa");
    expect(s.uf).toBeNull();
    expect(s.modo).toBe("panorama");
    expect(s.camada).toBe("amazonia-legal");
  });

  it("#/mapa?modo=narrativa e ?modo=explorador são reconhecidos", () => {
    expect(parseMapaHash("#/mapa?modo=narrativa").modo).toBe("narrativa");
    expect(parseMapaHash("#/mapa?modo=explorador").modo).toBe("explorador");
    expect(parseMapaHash("#/mapa?modo=xpto").modo).toBe("panorama");
  });

  it("#/mapa/ro → estado selecionado força modo explorador", () => {
    const s = parseMapaHash("#/mapa/ro");
    expect(s.uf).toBe("RO");
    expect(s.modo).toBe("explorador");
  });

  it("ignora UF inválida", () => {
    expect(parseMapaHash("#/mapa/xyz").uf).toBeNull();
    expect(parseMapaHash("#/mapa/1").uf).toBeNull();
  });

  it("lê parâmetros de query", () => {
    const s = parseMapaHash("#/mapa/am?camada=vagas-ic-2026&sec=doencas&lista=1&leve=1");
    expect(s.uf).toBe("AM");
    expect(s.camada).toBe("vagas-ic-2026");
    expect(s.sec).toBe("doencas");
    expect(s.lista).toBe(true);
    expect(s.leve).toBe("1");
  });

  it("valor inválido na URL cai no padrão, e não passa em silêncio", () => {
    /* `?sec=banana` esvaziava o corpo do painel sem erro nem aviso — nenhum
       ramo do StatePanel casava. `?camada=` errada pintava o padrão e deixava
       um link mentiroso no ar. */
    expect(parseMapaHash("#/mapa/am?sec=banana").sec).toBeNull();
    expect(parseMapaHash("#/mapa/am?camada=xpto").camada).toBe(ESTADO_PADRAO.camada);
    for (const id of CAMADA_IDS) {
      expect(parseMapaHash(`#/mapa?camada=${id}`).camada).toBe(id);
    }
    for (const id of SECAO_IDS) {
      expect(parseMapaHash(`#/mapa/ro?sec=${id}`).sec).toBe(id);
    }
  });

  it("o modo leve tem três estados, e a escolha da pessoa viaja no link", () => {
    // "auto" é o padrão e fica fora da URL; sem os três estados, quem tem
    // economia de dados no aparelho não conseguia desligar o modo leve.
    expect(parseMapaHash("#/mapa").leve).toBe("auto");
    expect(parseMapaHash("#/mapa?leve=1").leve).toBe("1");
    expect(parseMapaHash("#/mapa?leve=0").leve).toBe("0");
    expect(parseMapaHash("#/mapa?leve=xyz").leve).toBe("auto");
    expect(buildMapaHash({ leve: "auto" })).toBe("#/mapa");
    expect(buildMapaHash({ leve: "0" })).toContain("leve=0");
    expect(buildMapaHash({ leve: "1" })).toContain("leve=1");
  });

  it("a lista de validação não envelhece em relação às camadas reais", () => {
    // Lista de validação desatualizada rejeita link legítimo — pior que não validar.
    const reais = construirCamadas(temConteudo, resumoNotificacoes).map((c) => c.id);
    expect([...CAMADA_IDS].sort()).toEqual([...reais].sort());
  });

  it("URLs ficam curtas (omite padrões)", () => {
    expect(buildMapaHash({ uf: "RO", camada: "amazonia-legal" })).toBe("#/mapa/ro");
    expect(buildMapaHash({})).toBe("#/mapa");
    expect(buildMapaHash({ modo: "explorador" })).toBe("#/mapa?modo=explorador");
  });

  it("faz round-trip parse→build→parse", () => {
    const casos = ["#/mapa", "#/mapa/ro", "#/mapa/ce?sec=animais", "#/mapa/am?camada=vagas-ic-2026&sec=doencas", "#/mapa?modo=explorador&lista=1"];
    for (const h of casos) {
      const s1 = parseMapaHash(h);
      const s2 = parseMapaHash(buildMapaHash(s1));
      expect(s2).toEqual(s1);
    }
  });

  it("isMapaHash reconhece a rota", () => {
    expect(isMapaHash("#/mapa")).toBe(true);
    expect(isMapaHash("#/mapa/ro?x=1")).toBe(true);
    expect(isMapaHash("#/webinars")).toBe(false);
  });

  // Regressão: o roteador principal precisa reconhecer a rota do mapa mesmo
  // com query string (senão #/mapa?modo=explorador caía na home).
  it("o roteador principal reconhece #/mapa com e sem query", () => {
    expect(parseHash("#/mapa").name).toBe("mapa");
    expect(parseHash("#/mapa?modo=explorador").name).toBe("mapa");
    expect(parseHash("#/mapa/ro?sec=animais").name).toBe("mapa");
    expect(parseHash("#/mapa?lista=1").name).toBe("mapa");
    // não quebra as rotas existentes
    expect(parseHash("#/webinars").name).toBe("hub");
    expect(parseHash("#pesquisa").name).toBe("home");
  });
});

/* ----------------------------------------------------------------- CAMADAS */
describe("layers · dados reais e verificáveis", () => {
  it("vagas de IC somam 50 em 18 UFs (Edital 02/2026)", () => {
    expect(totalVagasIc).toBe(50);
    expect(totalUfsComVagas).toBe(18);
    expect(Object.values(VAGAS_IC_2026).reduce((a, b) => a + b, 0)).toBe(50);
  });

  it("toda camada tem fonte declarada e legenda", () => {
    const camadas = construirCamadas(temConteudo);
    expect(camadas.length).toBeGreaterThanOrEqual(3);
    for (const c of camadas) {
      expect(c.fonte.titulo || c.fonte.publicador).toBeTruthy();
      expect(c.legenda.length).toBeGreaterThan(0);
      expect(TEMAS.map((t) => t.id)).toContain(c.tema);
      // cor definida para todas as UFs
      for (const u of ufs) expect(typeof c.cor(u)).toBe("string");
    }
  });

  it("camada de conteúdo reflete as fichas publicadas", () => {
    const camadas = construirCamadas(temConteudo);
    const conteudo = camadas.find((c) => c.id === "conteudo")!;
    expect(conteudo.valor(ufBySigla("RO")!)).toBe(1);
  });

  it("lente de doenças usa as notificações e só colore quem tem dado", () => {
    const camadas = construirCamadas(temConteudo, resumoNotificacoes);
    const doencas = camadas.find((c) => c.id === "doencas-notificacoes")!;
    expect(doencas.tema).toBe("saude");
    // AC e AP têm dado; um estado sem ficha epidemiológica não tem
    expect(doencas.valor(ufBySigla("AC")!)).toBeGreaterThan(0);
    expect(doencas.valor(ufBySigla("AP")!)).toBeGreaterThan(0);
    expect(doencas.valor(ufBySigla("SP")!)).toBeNull();
    // rótulo honesto para quem não tem dado
    expect(doencas.rotularValor!(ufBySigla("SP")!)).toMatch(/preparação/i);
  });
});

/* ---------------------------------------------------------------- CONTEÚDO */
describe("content · esquema editorial", () => {
  it("carrega as fichas de demonstração RO, AM, CE", () => {
    for (const uf of ["RO", "AM", "CE"]) expect(FICHAS.has(uf)).toBe(true);
  });

  it("todo registro publicado é consistente e citado", () => {
    for (const e of FICHAS.values() as IterableIterator<EstadoConteudo>) {
      expect(e.uf).toMatch(/^[A-Z]{2}$/);
      for (const a of e.animais ?? []) {
        expect(["confirmado", "provavel", "incerto"]).toContain(a.ocorrencia);
        expect(a.nomeCientifico).toBeTruthy();
        expect(a.fontes?.length ?? 0).toBeGreaterThan(0); // referência de identificação exige fonte
      }
      for (const d of e.doencas ?? []) {
        expect(d.nome).toBeTruthy();
        expect(d.fontes?.length ?? 0).toBeGreaterThan(0);
      }
      // registro NÃO-demonstração publicado precisa de fontes gerais
      if (!e.demonstracao) expect(e.fontes?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("capítulos têm id, título, texto e ordem única", () => {
    expect(capitulos.length).toBeGreaterThanOrEqual(3);
    const ids = new Set<string>();
    for (const c of capitulos) {
      expect(c.id).toBeTruthy();
      expect(c.titulo).toBeTruthy();
      expect(c.texto).toBeTruthy();
      ids.add(c.id);
    }
    expect(ids.size).toBe(capitulos.length);
  });

  it("capítulos referenciam UFs válidas quando têm foco", () => {
    for (const c of capitulos) {
      if (c.foco) expect(ufBySigla(c.foco)).toBeTruthy();
    }
  });

  /* ---------------------------------------------------------------------
     Guardas do scrollytelling.

     Antes destas, `cap.camada` era dado morto: estava no tipo e nos quatro
     JSONs e nenhuma linha o lia, então os quatro capítulos pintavam o mapa
     igual mesmo declarando camadas diferentes. Agora que ele vale, um id
     errado deixa de ser inofensivo — vira um fallback silencioso para outra
     camada, que é pior do que não fazer nada, porque parece funcionar.
     --------------------------------------------------------------------- */

  it("a ordem dos capítulos é declarada, numérica e única", () => {
    // O `?? 0` de content.ts mandava um capítulo sem `ordem` para antes do
    // primeiro, calado. O it() acima promete "ordem única" e só checava id.
    const ordens = capitulos.map((c) => c.ordem);
    for (const o of ordens) expect(typeof o).toBe("number");
    expect(new Set(ordens).size).toBe(capitulos.length);
  });

  it("a camada de cada capítulo existe de verdade", () => {
    const ids = construirCamadas(temConteudo, resumoNotificacoes).map((c) => c.id);
    for (const c of capitulos) {
      if (c.camada) expect(ids, `capítulo ${c.id}`).toContain(c.camada);
    }
  });

  it("os destaques são UFs válidas, sem repetição e sem repetir o foco", () => {
    for (const c of capitulos) {
      if (!c.destaques) continue;
      expect(new Set(c.destaques).size).toBe(c.destaques.length);
      for (const s of c.destaques) {
        expect(ufBySigla(s), `capítulo ${c.id}, destaque ${s}`).toBeTruthy();
        expect(s).not.toBe(c.foco);
      }
    }
  });

  it("o enquadramento de cada capítulo resolve, e não briga com o foco", () => {
    for (const c of capitulos) {
      if (!c.enquadrar) continue;
      expect(enquadramentoDe(c.enquadrar), `capítulo ${c.id}`).not.toBeNull();
      // `overrideTarget` vence `selecionada ?? foco` no BrazilMap: declarar os
      // dois esconde o foco sem avisar ninguém.
      expect(c.foco, `capítulo ${c.id} declara enquadrar E foco`).toBeFalsy();
    }
  });

  it("o CMS oferece todas as camadas e todos os enquadramentos que existem", () => {
    /* A lista do config.yml é cópia manual dos ids do código, e já divergiu:
       oferecia 3 das 5 camadas, então quem edita pelo /admin não conseguia
       escolher "instituicoes" nem "doencas-notificacoes". Divergência de
       catálogo é o erro recorrente deste repositório. */
    const yml = readFileSync(join(__dirname, "..", "public/admin/config.yml"), "utf-8");
    for (const c of construirCamadas(temConteudo, resumoNotificacoes)) {
      expect(yml, `camada ${c.id} não está no CMS`).toContain(`value: ${c.id}`);
    }
    for (const nome of ["brasil", "amazonia-legal", ...REGIOES]) {
      expect(enquadramentoDe(nome), `${nome} não resolve`).not.toBeNull();
      expect(yml, `enquadramento ${nome} não está no CMS`).toContain(`value: ${nome}`);
    }
  });

  it("capituloInicial nunca deixa o leitor sem capítulo", () => {
    // Com `?cap=inexistente` a narrativa inteira sumia — mapa, palco e texto —
    // e a mensagem restante dizia "nenhum capítulo cadastrado", havendo quatro.
    expect(capituloInicial("xpto")?.id).toBe(capitulos[0].id);
    expect(capituloInicial(null)?.id).toBe(capitulos[0].id);
    expect(capituloInicial(undefined)?.id).toBe(capitulos[0].id);
    expect(capituloInicial(capitulos[2].id)?.id).toBe(capitulos[2].id);
  });

  it("o enquadramento da Amazônia Legal cabe nos nove estados, com folga", () => {
    /* Cuidado com a justificativa fácil: "regionViewBox('Norte') corta o
       Maranhão" é FALSO. Medido, a caixa do Norte (789 de largura) acaba
       contendo MA e MT, porque o padding e a escala mínima a inflam muito além
       das 7 UFs que entraram no cálculo.

       O problema é outro, e mais sutil: essa cobertura é ACIDENTE. MA termina
       em x=774 numa caixa que vai até 789 — 2% de folga, encostado na borda —
       e nada no código garante isso. A caixa da Amazônia Legal parte das 9 UFs
       certas e dá 124 unidades de margem. Se a malha do IBGE for atualizada,
       a primeira quebra em silêncio e a segunda não. */
    const box = enquadramentoDe("amazonia-legal")!;
    const cabe = (b: number[], u: { bbox: number[] }) =>
      u.bbox[0] >= b[0] - 0.5 && u.bbox[2] <= b[0] + b[2] + 0.5 &&
      u.bbox[1] >= b[1] - 0.5 && u.bbox[3] <= b[1] + b[3] + 0.5;

    for (const u of ufs.filter((x) => x.amazoniaLegal)) {
      expect(cabe(box, u), `${u.sigla} fora do enquadramento da Amazônia Legal`).toBe(true);
    }
    // Mais folgada que a do Norte, que foi calculada sem MT nem MA.
    expect(box[2]).toBeGreaterThan(regionViewBox("Norte")[2]);
    // E não mais estreita que o limite do clampView, senão o BrazilMap alarga
    // em silêncio e o enquadramento declarado não é o que aparece na tela.
    expect(box[2]).toBeGreaterThanOrEqual(WORLD.w / 7);
  });
});

/* --------------------------------------------------- PASSOS POR ROLAGEM */

describe("ui · escolherPasso", () => {
  const p = (id: string, topo: number) => ({ id, topo });

  it("vence o último passo que já cruzou a linha", () => {
    const passos = [p("a", -400), p("b", -100), p("c", 500)];
    expect(escolherPasso(passos, 300)).toBe("b");
  });

  it("antes da história, vence o primeiro — nunca nenhum", () => {
    // Devolver null aqui significaria história sem capítulo ativo, que é o
    // estado quebrado que este módulo existe para evitar.
    expect(escolherPasso([p("a", 900), p("b", 1600)], 300)).toBe("a");
  });

  it("no fim, vence o último", () => {
    expect(escolherPasso([p("a", -2000), p("b", -1200), p("c", -400)], 300)).toBe("c");
  });

  it("lista vazia devolve null", () => {
    expect(escolherPasso([], 300)).toBeNull();
  });

  it("um salto de vários passos não fica preso no intermediário", () => {
    // Rolagem rápida: o observador pode acordar já com três passos acima da
    // linha. A regra tem de escolher o último, não o primeiro que encontrar.
    const passos = [p("a", -3000), p("b", -2000), p("c", -1000), p("d", 700)];
    expect(escolherPasso(passos, 400)).toBe("c");
  });

  it("empate no topo resolve pela ordem do documento", () => {
    expect(escolherPasso([p("a", 100), p("b", 100)], 300)).toBe("b");
  });
});

/* -------------------------------------------------- DADOS EPIDEMIOLÓGICOS */
describe("doenças · notificações com procedência", () => {
  it("carrega as fichas epidemiológicas AC e AP (dado real, não demonstração)", () => {
    for (const uf of ["AC", "AP"]) {
      const e = FICHAS.get(uf)!;
      expect(e).toBeTruthy();
      expect(e.demonstracao).toBe(false);
      expect(e.fontes?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("toda notificação traz valor, período, sistema e fonte", () => {
    for (const e of FICHAS.values() as IterableIterator<EstadoConteudo>) {
      for (const d of e.doencas ?? []) {
        if (!d.notificacoes) continue;
        expect(d.notificacoes.valor).toBeGreaterThanOrEqual(0);
        expect(d.notificacoes.periodo).toBeTruthy();
        expect(d.notificacoes.sistema).toBeTruthy();
        // procedência: fonte no próprio dado OU na ficha
        expect((d.notificacoes.fonte?.titulo || d.fontes?.length) ?? 0).toBeTruthy();
      }
    }
  });

  it("Amapá: a malária é marcada não-representativa (SIVEP) e fica fora do total", () => {
    const ap = FICHAS.get("AP")!;
    const malaria = ap.doencas!.find((d) => d.nome === "Malária")!;
    expect(malaria.notificacoes!.representativo).toBe(false);
    expect(malaria.notificacoes!.nota).toMatch(/SIVEP/);
    // total do estado NÃO inclui a malária (21) — só as notificações representativas
    const representativas = ap.doencas!
      .filter((d) => d.notificacoes && d.notificacoes.representativo !== false)
      .reduce((s, d) => s + d.notificacoes!.valor, 0);
    expect(totalNotificacoes("AP")).toBe(representativas);
    expect(totalNotificacoes("AP")).not.toBe(representativas + 21);
  });

  it("totalNotificacoes é null onde não há dado epidemiológico", () => {
    expect(totalNotificacoes("SP")).toBeNull();
    expect(totalNotificacoes("AC")).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------- GAMIFICAÇÃO + CLIMA */
describe("gamify · conquistas (sistema de recompensas)", () => {
  it("conjunto vazio: nada desbloqueado", () => {
    const c = conquistasDe(new Set());
    expect(c.every((x) => !x.desbloqueada)).toBe(true);
    expect(c.find((x) => x.id === "cartografo")!.meta).toBe(27);
  });

  it("um estado desbloqueia 'primeiro passo'", () => {
    const c = conquistasDe(new Set(["RO"]));
    expect(c.find((x) => x.id === "primeiro")!.desbloqueada).toBe(true);
    expect(c.find((x) => x.id === "regioes")!.desbloqueada).toBe(false);
  });

  it("uma UF de cada região desbloqueia 'Brasil afora'", () => {
    // RO(N), CE(NE), GO(CO), SP(SE), PR(S)
    const c = conquistasDe(new Set(["RO", "CE", "GO", "SP", "PR"]));
    expect(c.find((x) => x.id === "regioes")!.desbloqueada).toBe(true);
  });

  it("os 9 estados da Amazônia Legal desbloqueiam a conquista", () => {
    const al = ufs.filter((u) => u.amazoniaLegal).map((u) => u.sigla);
    const c = conquistasDe(new Set(al));
    expect(c.find((x) => x.id === "amazonia")!.desbloqueada).toBe(true);
  });

  it("todos os 27 desbloqueiam 'cartógrafo'", () => {
    const c = conquistasDe(new Set(ufs.map((u) => u.sigla)));
    expect(c.every((x) => x.desbloqueada)).toBe(true);
  });
});

describe("clima · timeline", () => {
  it("toda região tem 12 meses booleanos", () => {
    for (const r of ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"]) {
      expect(CHUVA_POR_REGIAO[r]).toHaveLength(12);
      expect(CHUVA_POR_REGIAO[r].every((v) => typeof v === "boolean")).toBe(true);
    }
  });
});
