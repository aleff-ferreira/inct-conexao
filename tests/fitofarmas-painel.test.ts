/**
 * O painel do workshop na Gestão (#/gestao?area=fitofarmas).
 *
 * Três coisas quebram em silêncio aqui, e só apareceriam com a coordenação
 * olhando o painel na véspera do evento:
 *
 * 1. **Métrica errada.** "Quantas cadeiras no dia 25" decide logística; um
 *    filtro que esquece o `ambas` subestima o público dos dois dias. As
 *    funções são puras justamente para serem testadas com aritmética simples.
 *
 * 2. **CSV com id cru.** A planilha vai circular pela coordenação e por gente
 *    que nunca viu este código — `ate_1_dia_mes` numa célula é dado perdido.
 *    O teste confere que TODO id vira rótulo.
 *
 * 3. **A área sumir da Gestão num refactor.** Mesmo guarda textual das rotas:
 *    o Gestao.tsx precisa conter o botão, o lazy e o parse da query.
 *
 * E uma regra de arquitetura: o painel NUNCA recalcula escore nem faixa — a
 * régua é do servidor. O teste confere que PainelFitofarmas não importa
 * `escoreDe`/`faixaDe`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  calcularMetricas,
  filtrarLinhas,
  linhasParaCsv,
  rotuloDe,
  tituloDoAporte,
  type RespostaPainel,
} from "../src/fitofarmas/metricas";
import { toCsv } from "../src/platform/api";
import { VINCULOS } from "../src/fitofarmas/perguntas";

const raiz = join(__dirname, "..");
const gestao = readFileSync(join(raiz, "src/platform/Gestao.tsx"), "utf-8");
const painel = readFileSync(join(raiz, "src/fitofarmas/PainelFitofarmas.tsx"), "utf-8");
// O repo escreve comentários longos que CITAM as armadilhas evitadas — um
// padrão proibido tem de ser procurado no CÓDIGO, nunca na prosa (o mesmo
// aprendizado de tests/fitofarmas.test.ts).
const painelSemProsa = painel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Uma linha realista da view, para derivar as demais. */
const BASE: RespostaPainel = {
  id: "1",
  protocolo: "WFF-0001",
  nome: "Maria da Silva Santos",
  email: "maria@unir.br",
  telefone: "(69) 99999-0000",
  canal: "email",
  instituicao: "UNIR — Universidade Federal de Rondônia",
  uf: "RO",
  lattes: "1234567890123456",
  orcid: null,
  vinculo: "docente_pesquisador",
  interesse: "colaborar",
  sede: "ambas",
  escore_intencao: 72,
  faixa: "prioritario",
  eets: ["eet3", "eet4"],
  formas: ["pesquisa_conjunta"],
  aportes: ["dados"],
  aportes_detalhe: { dados: "Herbário HFSL, 12 mil exsicatas" },
  iniciativas: ["projeto_pesquisa"],
  compromissos: ["carta_intencao", "reuniao_30d"],
  disponibilidade: "ate_1_dia_mes",
  horizonte: "ate_6_meses",
  decisao: "decido",
  historico: "informal",
  chance_1a5: 4,
  aportes_nomeados: 1,
  comentario: null,
  created_at: "2026-08-08T10:00:00Z",
  updated_at: "2026-08-08T10:00:00Z",
};

const LINHAS: RespostaPainel[] = [
  BASE, // ambas · prioritario · 72
  {
    ...BASE,
    id: "2",
    nome: "João Pereira",
    email: "joao@ifro.edu.br",
    instituicao: "IFRO — Campus Cacoal",
    sede: "cacoal",
    faixa: "promissor",
    escore_intencao: 50,
    vinculo: "profissional_saude",
    historico: "nao",
    aportes_nomeados: 0,
    compromissos: ["gt_redesfito"],
    updated_at: "2026-08-09T11:00:00Z", // corrigida
  },
  {
    ...BASE,
    id: "3",
    nome: "Ana Souza",
    email: "ana@semusa.pvh.br",
    instituicao: "SEMUSA Porto Velho",
    sede: "porto_velho",
    faixa: "acompanhar",
    escore_intencao: 30,
    vinculo: "gestor_publico",
    historico: "formal",
    aportes_nomeados: 0,
    compromissos: ["depois"],
  },
  {
    ...BASE,
    id: "4",
    nome: "Carlos Lima",
    email: "carlos@exemplo.br",
    instituicao: "Associação de Produtores",
    sede: "so_online",
    faixa: "informativo",
    escore_intencao: 4,
    vinculo: "comunidade_associacao",
    interesse: "acompanhar",
    historico: "tentei",
    eets: [],
    aportes: [],
    aportes_detalhe: {},
    compromissos: [],
    disponibilidade: null,
    horizonte: null,
    decisao: null,
    chance_1a5: null,
    aportes_nomeados: 0,
  },
];

// ===========================================================================
describe("as métricas do painel", () => {
  const m = calcularMetricas(LINHAS);

  it("conta as cadeiras de cada dia — e `ambas` ocupa cadeira nos dois", () => {
    // Maria (ambas) + Ana (porto_velho) = 2 no dia 25;
    // Maria (ambas) + João (cacoal) = 2 no dia 27.
    expect(m.dia25PortoVelho).toBe(2);
    expect(m.dia27Cacoal).toBe(2);
    expect(m.soOnline).toBe(1);
    expect(m.semDiaDefinido).toBe(0);
  });

  it("total, corrigidas e escore médio", () => {
    expect(m.total).toBe(4);
    expect(m.corrigidas).toBe(1); // só João voltou para corrigir
    expect(m.escoreMedio).toBe(Math.round((72 + 50 + 30 + 4) / 4));
  });

  it("as quatro faixas saem na ordem da régua, com contagem certa", () => {
    expect(m.porFaixa.map((f) => f.id)).toEqual([
      "prioritario",
      "promissor",
      "acompanhar",
      "informativo",
    ]);
    expect(m.porFaixa.map((f) => f.total)).toEqual([1, 1, 1, 1]);
  });

  it("compromissos agregados com RÓTULO, não id — e ordenados por frequência", () => {
    const carta = m.porCompromisso.find((c) => c.id === "carta_intencao");
    expect(carta?.total).toBe(1);
    expect(carta?.rotulo).toContain("carta de intenção");
    // nenhum rótulo é igual ao id (id não tem espaço; rótulo tem)
    for (const c of m.porCompromisso) expect(c.rotulo).not.toBe(c.id);
  });

  it("histórico real: formal e informal contam, 'tentei' e 'não' não", () => {
    expect(m.jaColaboraram).toBe(2); // Maria (informal) + Ana (formal)
  });

  it("com zero linhas nada explode e nada divide por zero", () => {
    const vazio = calcularMetricas([]);
    expect(vazio.total).toBe(0);
    expect(vazio.escoreMedio).toBe(0);
    expect(vazio.porFaixa.every((f) => f.total === 0)).toBe(true);
  });
});

// ===========================================================================
describe("o filtro da lista", () => {
  it("busca sem acento e sem caixa — 'joao' acha 'João'", () => {
    expect(filtrarLinhas(LINHAS, { busca: "joao", faixa: "", sede: "" })).toHaveLength(1);
    expect(filtrarLinhas(LINHAS, { busca: "SEMUSA", faixa: "", sede: "" })).toHaveLength(1);
    expect(filtrarLinhas(LINHAS, { busca: "associacao", faixa: "", sede: "" })).toHaveLength(1);
  });

  it("acha por protocolo e por e-mail", () => {
    expect(filtrarLinhas(LINHAS, { busca: "WFF-0001", faixa: "", sede: "" }).length).toBeGreaterThan(0);
    expect(filtrarLinhas(LINHAS, { busca: "ana@semusa", faixa: "", sede: "" })).toHaveLength(1);
  });

  it("faixa e sede compõem com a busca (E, não OU)", () => {
    expect(filtrarLinhas(LINHAS, { busca: "", faixa: "prioritario", sede: "" })).toHaveLength(1);
    expect(filtrarLinhas(LINHAS, { busca: "", faixa: "", sede: "cacoal" })).toHaveLength(1);
    expect(filtrarLinhas(LINHAS, { busca: "maria", faixa: "informativo", sede: "" })).toHaveLength(0);
  });
});

// ===========================================================================
describe("o CSV que a coordenação abre no Excel", () => {
  const linhas = linhasParaCsv(LINHAS);
  const csv = toCsv(linhas);

  it("todo id vira rótulo — planilha com 'ate_1_dia_mes' é dado perdido", () => {
    expect(csv).not.toMatch(/\bate_1_dia_mes\b/);
    expect(csv).not.toMatch(/\bdocente_pesquisador\b/);
    expect(csv).not.toMatch(/\bporto_velho\b/);
    expect(csv).not.toMatch(/\beet3\b/);
    expect(csv).toContain("Cerca de 1 dia por mês");
    expect(csv).toContain("Docente ou pesquisador(a)");
  });

  it("o aporte sai como 'Título: detalhe' — o par é que carrega o sinal", () => {
    expect(csv).toContain("Base de dados, coleção ou herbário: Herbário HFSL, 12 mil exsicatas");
  });

  it("o cabeçalho é legível e o escore vai como número", () => {
    const cabecalho = csv.split("\n")[0];
    expect(cabecalho).toContain("Nome");
    expect(cabecalho).toContain("Escore");
    expect(cabecalho).toContain("Compromissos");
    expect(linhas[0].Escore).toBe(72);
  });

  it("campo com ponto e vírgula não quebra a coluna (escape do toCsv)", () => {
    const comPontoEVirgula = linhasParaCsv([{ ...BASE, comentario: "a; b" }]);
    expect(toCsv(comPontoEVirgula)).toContain('"a; b"');
  });
});

// ===========================================================================
describe("a área na Gestão", () => {
  it("o botão, o lazy e o parse da query existem no Gestao.tsx", () => {
    expect(gestao).toContain('lazy(() => import("../fitofarmas/PainelFitofarmas"))');
    expect(gestao).toContain("Fitofarmas");
    expect(gestao).toContain('"fitofarmas"');
    expect(gestao).toContain('trocarArea("fitofarmas")');
  });

  it("o painel NUNCA recalcula escore nem faixa — a régua é do servidor", () => {
    expect(painelSemProsa).not.toContain("escoreDe");
    expect(painelSemProsa).not.toContain("faixaDe(");
  });

  it("o painel lê a view de priorização, não a tabela crua", () => {
    const api = readFileSync(join(raiz, "src/fitofarmas/api.ts"), "utf-8");
    expect(api).toContain('from("workshop_prioridade")');
  });

  it("o CSV exportado leva BOM — sem ele o Excel lê UTF-8 como Latin-1", () => {
    expect(painel).toContain('"\\uFEFF" + csv');
  });
});

// ===========================================================================
describe("auxiliares de rótulo", () => {
  it("rotuloDe devolve o rótulo, o id cru quando não acha, e 'não informado' para vazio", () => {
    expect(rotuloDe(VINCULOS, "tecnico")).toBe("Técnico(a) ou apoio à pesquisa");
    expect(rotuloDe(VINCULOS, "id_que_nao_existe")).toBe("id_que_nao_existe");
    expect(rotuloDe(VINCULOS, null)).toBe("não informado");
  });

  it("tituloDoAporte resolve as fichas", () => {
    expect(tituloDoAporte("dados")).toBe("Base de dados, coleção ou herbário");
    expect(tituloDoAporte("outro_qualquer")).toBe("outro_qualquer");
  });
});
