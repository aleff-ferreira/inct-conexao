/**
 * ============================================================================
 *  A TELA 4 REDUZIDA — sugestão de resultado e categorias marcáveis
 * ============================================================================
 *  A Tela 4 tinha quatro caixas de texto livre e era onde moravam ~2min30 dos
 *  8 minutos do formulário. A redução trocou digitação por escolha, e estas
 *  são as duas regras que não podem quebrar em silêncio:
 *
 *  1. A SUGESTÃO NUNCA INVENTA. Ela só pode conter título, veículo e ano que a
 *     própria pessoa declarou. No dia em que alguém acrescentar um adjetivo
 *     ("resultado expressivo"), 209 relatos passam a dizer a mesma coisa e a
 *     frase deixa de ser dela — que é o oposto do Indicador nº 2.
 *  2. MARCAR É AGREGÁVEL, PROSA NÃO É. Os ids das categorias são o que permite
 *     contar "atraso de recursos em N dos 209 relatos" sem ler prosa. Se um id
 *     mudar, o histórico do ciclo anterior deixa de somar com o novo.
 * ============================================================================
 */
import { describe, it, expect } from "vitest";

import {
  DIFICULDADES_OPCOES,
  OPORTUNIDADES_OPCOES,
  alternarCategoria,
  rotulosDe,
  sugerirResultado,
  tituloDoCsl,
  veiculoDoCsl,
  type FatoParaSugestao,
  type ItemParaSugestao,
} from "../src/relato/narrativa";

const artigo: ItemParaSugestao = {
  tipo: "artigo_periodico",
  titulo: "Snake venom metalloproteinases from Bothrops atrox",
  veiculo: "Toxicon",
  ano: 2025,
};

describe("a sugestão só repete o que a pessoa declarou", () => {
  it("monta a frase com título, veículo e ano — e nada além disso", () => {
    const f = sugerirResultado([artigo], []);
    expect(f).toBe('Publicamos o artigo “Snake venom metalloproteinases from Bothrops atrox” (Toxicon, 2025).');
  });

  it("não acrescenta juízo de valor", () => {
    const f = sugerirResultado([artigo], []) ?? "";
    for (const palavra of ["importante", "relevante", "expressivo", "inovador", "pioneiro", "impacto"]) {
      expect(f.toLowerCase()).not.toContain(palavra);
    }
  });

  it("sem produção e sem fato, não há sugestão — a tela não mostra nada", () => {
    expect(sugerirResultado([], [])).toBeNull();
    // Item sem título (registro manual incompleto) não vira frase truncada.
    expect(sugerirResultado([{ tipo: "artigo_periodico", titulo: null, veiculo: "X", ano: 2025 }], [])).toBeNull();
  });

  it("artigo ganha de capítulo, e o mais recente ganha do mais antigo", () => {
    const cap: ItemParaSugestao = { tipo: "capitulo", titulo: "Um capítulo", veiculo: "Livro", ano: 2026 };
    expect(sugerirResultado([cap, artigo], [])).toContain("Snake venom");
    const antigo = { ...artigo, titulo: "Antigo", ano: 2020 };
    const novo = { ...artigo, titulo: "Novo", ano: 2026 };
    expect(sugerirResultado([antigo, novo], [])).toContain("Novo");
  });

  it("sem produção, cai no fato de que a pessoa participou", () => {
    const exp: FatoParaSugestao = {
      tipo: "expedicao",
      titulo: "Expedição ao Rio Ouro Preto",
      ocorridoEm: "2025-09-01",
    };
    expect(sugerirResultado([], [exp])).toBe('Participei da expedição “Expedição ao Rio Ouro Preto” (2025).');
  });

  it("título gigante é aparado NO TÍTULO, sem estourar o limite do campo", () => {
    const enorme = { ...artigo, titulo: "A".repeat(900) };
    const f = sugerirResultado([enorme], []) ?? "";
    expect(f.length).toBeLessThanOrEqual(600);
    expect(f).toContain("…"); // cortou no título, não na frase
    expect(f.endsWith(".")).toBe(true); // a frase continua uma frase
  });

  it("tipo desconhecido ainda produz frase (nunca quebra a tela)", () => {
    const estranho = { ...artigo, tipo: "coisa_nova_qualquer" };
    expect(sugerirResultado([estranho], [])).toContain("Snake venom");
  });
});

describe("leitura do CSL que o Crossref devolve", () => {
  it("aceita título em string e em array (depósitos variam)", () => {
    expect(tituloDoCsl({ title: "Um título" })).toBe("Um título");
    expect(tituloDoCsl({ title: ["Um título"] })).toBe("Um título");
    expect(veiculoDoCsl({ "container-title": ["Toxicon"] })).toBe("Toxicon");
  });

  it("metadados ausentes ou estranhos devolvem null, não quebram", () => {
    expect(tituloDoCsl(null)).toBeNull();
    expect(tituloDoCsl({})).toBeNull();
    expect(tituloDoCsl({ title: "   " })).toBeNull();
    expect(veiculoDoCsl(undefined)).toBeNull();
  });
});

describe("categorias marcáveis", () => {
  it("os ids são estáveis: mudar um quebra a soma entre ciclos", () => {
    // Congelados de propósito. Se este teste falhar por mudança deliberada,
    // é preciso migrar os relatos já enviados antes de trocar o id.
    expect(DIFICULDADES_OPCOES.map((o) => o.id)).toEqual([
      "atraso-recursos",
      "logistica-campo",
      "licencas",
      "insumos",
      "equipamento",
      "pessoal",
      "conectividade",
      "burocracia",
    ]);
    expect(OPORTUNIDADES_OPCOES.map((o) => o.id)).toEqual([
      "parceria",
      "financiamento",
      "internacional",
      "convite",
      "linha-nova",
      "politica-publica",
      "divulgacao",
    ]);
  });

  it("alternar marca e desmarca sem perder as outras", () => {
    let n = {};
    n = { ...n, ...alternarCategoria(n, "dificuldades_categorias", "insumos") };
    n = { ...n, ...alternarCategoria(n, "dificuldades_categorias", "pessoal") };
    expect((n as { dificuldades_categorias: string[] }).dificuldades_categorias).toEqual(["insumos", "pessoal"]);
    n = { ...n, ...alternarCategoria(n, "dificuldades_categorias", "insumos") };
    expect((n as { dificuldades_categorias: string[] }).dificuldades_categorias).toEqual(["pessoal"]);
  });

  it("rotulosDe traduz ids para a revisão, e tolera id desconhecido", () => {
    expect(rotulosDe(["insumos"], DIFICULDADES_OPCOES)).toEqual(["Insumos e reagentes (compra ou importação)"]);
    expect(rotulosDe(undefined, DIFICULDADES_OPCOES)).toEqual([]);
    // Id de um ciclo futuro, lido por um cliente antigo: mostra o id cru em vez
    // de sumir com a informação.
    expect(rotulosDe(["id-que-nao-existe"], DIFICULDADES_OPCOES)).toEqual(["id-que-nao-existe"]);
  });

  it("toda opção tem rótulo legível e id em kebab-case", () => {
    for (const o of [...DIFICULDADES_OPCOES, ...OPORTUNIDADES_OPCOES]) {
      expect(o.id).toMatch(/^[a-z][a-z-]*$/);
      expect(o.rotulo.length).toBeGreaterThan(10);
    }
  });
});
