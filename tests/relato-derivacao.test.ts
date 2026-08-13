/**
 * ============================================================================
 *  Derivação da Q20 (objetivos pelos EETs) e contadores da Conferência
 *  (Q10 e Q15–19) — as duas pontes puras da integração com o Forms do CTC
 * ============================================================================
 *  Por que estas duas funções têm suíte própria:
 *
 *  1. `objetivosDosEets` decide O QUE A PESSOA VÊ pré-marcado na Q20. Se a
 *     derivação inventar um número fora de 1..43, ou perder o objetivo 43
 *     (transversal, presente nas 8 EETs por decisão registrada no contrato),
 *     o erro se propaga para `objetivos_confirmados` de 209 relatos.
 *  2. `contarEstudantesEFormados` substitui SEIS perguntas de digitação
 *     (Q10, Q15–19) por números somados dos fatos. Uma regra de mapeamento
 *     errada (bolsa GM que não vira MS, ICJ que não soma com IC) produziria
 *     um número errado que o líder tende a aceitar — é a automação que mais
 *     precisa de teste de regressão.
 *
 *  O contrato é docs/relato-gforms.md (decisões 1, 7 e 10–14).
 */
import { describe, it, expect } from "vitest";

import {
  OBJETIVOS_POR_EET,
  numerosDosObjetivosDosEets,
  objetivosDosEets,
} from "../src/relato/config";

import {
  CATEGORIAS_FORMADO,
  NIVEIS_ESTUDANTE,
  contarEstudantesEFormados,
  nivelDaBolsa,
  type FatoParaContagem,
} from "../src/relato/narrativa";

/* ===================== 1. O MAPA EET → OBJETIVOS (curadoria) ============== */

describe("OBJETIVOS_POR_EET — invariantes do mapa curado", () => {
  it("tem exatamente as 8 EETs, EET-1..EET-8", () => {
    expect(Object.keys(OBJETIVOS_POR_EET)).toEqual([
      "EET-1", "EET-2", "EET-3", "EET-4", "EET-5", "EET-6", "EET-7", "EET-8",
    ]);
  });

  it("todo número está em 1..43 e nenhuma EET repete número", () => {
    for (const [eet, numeros] of Object.entries(OBJETIVOS_POR_EET)) {
      for (const n of numeros) {
        expect(n, `${eet} traz ${n}`).toBeGreaterThanOrEqual(1);
        expect(n, `${eet} traz ${n}`).toBeLessThanOrEqual(43);
      }
      expect(new Set(numeros).size, `${eet} repete número`).toBe(numeros.length);
    }
  });

  it("o objetivo 43 (transversal: publicações) está nas 8 EETs — decisão 7 do contrato", () => {
    for (const [eet, numeros] of Object.entries(OBJETIVOS_POR_EET)) {
      expect(numeros, `${eet} sem o 43`).toContain(43);
    }
  });
});

/* ============ 2. A DERIVAÇÃO SÍNCRONA (números para pré-marcar) =========== */

describe("numerosDosObjetivosDosEets — a pré-marcação da Q20", () => {
  it("uma EET devolve exatamente os números do mapa, atribuídos a ela", () => {
    const m = numerosDosObjetivosDosEets(["EET-1"]);
    expect([...m.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 43]);
    for (const eet of m.values()) expect(eet).toBe("EET-1");
  });

  it("objetivo em duas EETs escolhidas fica com a primeira na ordem EET-1..EET-8, não na ordem do array", () => {
    // O 11 está em EET-2 e EET-3; `laboratorios.eets` vem do banco sem ordem garantida.
    const m = numerosDosObjetivosDosEets(["EET-3", "EET-2"]);
    expect(m.get(11)).toBe("EET-2");
    const invertido = numerosDosObjetivosDosEets(["EET-2", "EET-3"]);
    expect(invertido.get(11)).toBe("EET-2");
  });

  it("união sem duplicata: EET-2 + EET-3 têm interseção e cada número aparece uma vez", () => {
    const m = numerosDosObjetivosDosEets(["EET-2", "EET-3"]);
    const esperado = new Set([...OBJETIVOS_POR_EET["EET-2"], ...OBJETIVOS_POR_EET["EET-3"]]);
    expect(new Set(m.keys())).toEqual(esperado);
  });

  it("lista vazia ou código desconhecido → mapa vazio (a tela cai no modo 'todos os 43')", () => {
    expect(numerosDosObjetivosDosEets([]).size).toBe(0);
    expect(numerosDosObjetivosDosEets(["EET-9", "banana"]).size).toBe(0);
  });
});

/* ============= 3. A DERIVAÇÃO COMPLETA (com texto da proposta) ============ */

describe("objetivosDosEets — derivação completa da Q20", () => {
  it("sem EET não é derivável — e a lista sai vazia, nunca os 43 crus", async () => {
    const d = await objetivosDosEets([]);
    expect(d).toEqual({ derivavel: false, objetivos: [] });
  });

  it("com EETs: derivável, ordenado por número, com texto integral e a EET responsável", async () => {
    const d = await objetivosDosEets(["EET-5"]);
    expect(d.derivavel).toBe(true);
    expect(d.objetivos.map((o) => o.numero)).toEqual([5, 6, 27, 30, 43]);
    for (const o of d.objetivos) {
      expect(o.eet).toBe("EET-5");
      // O texto vem do chunk da proposta — vazio significaria número sem prosa.
      expect(o.texto.length, `objetivo ${o.numero} sem texto na proposta`).toBeGreaterThan(10);
    }
  });

  it("todos os números do mapa têm texto na proposta (nenhuma curadoria aponta para o vazio)", async () => {
    const d = await objetivosDosEets(Object.keys(OBJETIVOS_POR_EET));
    for (const o of d.objetivos) {
      expect(o.texto.length, `objetivo ${o.numero} sem texto`).toBeGreaterThan(10);
    }
  });

  it("é pura no sentido que importa: mesma entrada, mesma saída", async () => {
    const a = await objetivosDosEets(["EET-3", "EET-7"]);
    const b = await objetivosDosEets(["EET-3", "EET-7"]);
    expect(a).toEqual(b);
  });
});

/* ================ 4. CONTADORES DA CONFERÊNCIA (Q10 e Q15–19) ============= */

const formacao = (nivel: string, situacao: string): FatoParaContagem => ({
  tipo: "formacao",
  payload: { nivel, situacao },
});
const bolsa = (modalidade: string, situacao: string): FatoParaContagem => ({
  tipo: "bolsista",
  payload: { modalidade, situacao },
});

describe("nivelDaBolsa — sigla vira nível SÓ quando inequívoca (decisão 12)", () => {
  it("mapeia as siglas inequívocas", () => {
    expect(nivelDaBolsa("IC")).toBe("IC");
    expect(nivelDaBolsa("ICJ")).toBe("ICJ");
    expect(nivelDaBolsa("DTI-B")).toBe("DTI");
    expect(nivelDaBolsa("AT")).toBe("AT");
    expect(nivelDaBolsa("GM")).toBe("MS");
    expect(nivelDaBolsa("GD")).toBe("DR");
    expect(nivelDaBolsa("PDJ")).toBe("PD");
    expect(nivelDaBolsa("PDS")).toBe("PD");
  });

  it("ICJ não é capturada por IC, nem ADC por AT — a ordem dos prefixos importa", () => {
    expect(nivelDaBolsa("ICJ")).toBe("ICJ");
    expect(nivelDaBolsa("ADC-1A")).toBeNull();
  });

  it("modalidades sem nível de estudante devolvem null (ITI, SET, ADC, EXP, EV)", () => {
    for (const s of ["ITI-A", "SET-B", "SET-C", "ADC-1C", "EXP-1", "EV-3"]) {
      expect(nivelDaBolsa(s), s).toBeNull();
    }
  });

  it("aceita caixa baixa e espaços — o payload é texto digitado", () => {
    expect(nivelDaBolsa("  gm ")).toBe("MS");
    expect(nivelDaBolsa("")).toBeNull();
  });
});

describe("contarEstudantesEFormados — a soma pura das Q10 e Q15–19", () => {
  it("vazio: todas as linhas zeradas, nas ordens fixas do Forms", () => {
    const c = contarEstudantesEFormados([]);
    expect(c.estudantes.map((l) => l.chave)).toEqual([...NIVEIS_ESTUDANTE]);
    expect(c.formados.map((l) => l.chave)).toEqual([...CATEGORIAS_FORMADO]);
    for (const l of [...c.estudantes, ...c.formados]) expect(l.contado).toBe(0);
    expect(c.bolsasSemNivel).toEqual([]);
    expect(c.formacoesForaDosNiveis).toBe(0);
  });

  it("estudantes (Q10) = formações em andamento + bolsas ativas, com as parcelas separadas", () => {
    const c = contarEstudantesEFormados([
      formacao("mestrado", "em_andamento"),
      bolsa("GM", "implantada"),
      bolsa("GM", "em_curso"),
    ]);
    const ms = c.estudantes.find((l) => l.chave === "MS")!;
    expect(ms.deFormacoes).toBe(1);
    expect(ms.deBolsas).toBe(2);
    expect(ms.contado).toBe(3); // a sobreposição é DITA em tela, não deduplicada (decisão 14)
  });

  it("RH formados (Q15–19) = concluída no período; ICJ e IC somam juntos em IC (Meta 23)", () => {
    const c = contarEstudantesEFormados([
      formacao("ic_junior", "concluida_no_periodo"),
      formacao("ic", "concluida_no_periodo"),
      formacao("doutorado", "concluida_no_periodo"),
    ]);
    expect(c.formados.find((l) => l.chave === "IC")!.contado).toBe(2);
    expect(c.formados.find((l) => l.chave === "DR")!.contado).toBe(1);
  });

  it("TCC não é contável e a linha explica o porquê (decisão 13)", () => {
    const tcc = contarEstudantesEFormados([]).formados.find((l) => l.chave === "TCC")!;
    expect(tcc.contavel).toBe(false);
    expect(tcc.porQueNao).toBeTruthy();
    for (const outra of contarEstudantesEFormados([]).formados.filter((l) => l.chave !== "TCC")) {
      expect(outra.contavel).toBe(true);
    }
  });

  it("bolsa concluída/cancelada/não implantada não conta como estudante atual", () => {
    const c = contarEstudantesEFormados([
      bolsa("IC", "concluida"),
      bolsa("IC", "cancelada"),
      bolsa("IC", "nao_implantada"),
    ]);
    expect(c.estudantes.find((l) => l.chave === "IC")!.contado).toBe(0);
    expect(c.bolsasSemNivel).toEqual([]); // inativa não vira nem aviso
  });

  it("formação interrompida fica fora das duas somas, de propósito", () => {
    const c = contarEstudantesEFormados([formacao("mestrado", "interrompida")]);
    expect(c.estudantes.find((l) => l.chave === "MS")!.contado).toBe(0);
    expect(c.formados.find((l) => l.chave === "MS")!.contado).toBe(0);
    expect(c.formacoesForaDosNiveis).toBe(0);
  });

  it("modalidade ativa sem nível é LISTADA como fora da soma — nunca some em silêncio", () => {
    const c = contarEstudantesEFormados([bolsa("ITI-A", "em_curso"), bolsa("ITI-A", "implantada")]);
    expect(c.bolsasSemNivel).toEqual(["ITI-A"]); // sem duplicata
    for (const l of c.estudantes) expect(l.contado).toBe(0);
  });

  it("formação técnica/comunitária (ou sem nível) vai para o total à parte", () => {
    const c = contarEstudantesEFormados([
      formacao("tecnica", "em_andamento"),
      formacao("comunitaria", "concluida_no_periodo"),
      { tipo: "formacao", payload: { situacao: "em_andamento" } },
    ]);
    expect(c.formacoesForaDosNiveis).toBe(3);
  });

  it("fatos de outros tipos são ignorados e a entrada não é mutada", () => {
    const fatos: FatoParaContagem[] = [
      { tipo: "expedicao", payload: { dias: 4 } },
      formacao("mestrado", "em_andamento"),
    ];
    const copia = JSON.parse(JSON.stringify(fatos)) as FatoParaContagem[];
    const a = contarEstudantesEFormados(fatos);
    const b = contarEstudantesEFormados(fatos);
    expect(fatos).toEqual(copia);
    expect(a).toEqual(b); // pura: mesma entrada, mesma saída
    expect(a.estudantes.find((l) => l.chave === "MS")!.contado).toBe(1);
  });
});
