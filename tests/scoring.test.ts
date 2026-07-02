import { describe, it, expect } from "vitest";
import {
  clampScores,
  weightedTotal,
  bonusApplies,
  finalScore,
  aggregateFinal,
  rankState,
} from "../src/platform/scoring";
import type { Application, Criterio, Evaluation } from "../src/platform/types";

/** Critérios do edital 04/2026: Plano 60 · Histórico 20 · Lattes 10 · Vídeo 10. */
const CRITERIOS: Criterio[] = [
  { key: "plano", label: "Plano", peso: 6, max: 60 },
  { key: "historico", label: "Histórico", peso: 2, max: 20 },
  { key: "lattes", label: "Lattes", peso: 1, max: 10 },
  { key: "video", label: "Vídeo", peso: 1, max: 10 },
];

const BONUS = { label: "Ciência Delas", percent: 10, aplicaSe: "sexo=feminino" };

const app = (over: Partial<Application>): Application => ({
  id: "a1",
  edital_id: "e1",
  user_id: "u1",
  protocolo: "INCT-04-2026-0001",
  status: "recebida",
  nome: "Teste",
  cpf: "000",
  email: "t@t",
  telefone: "",
  sexo: "nao_informar",
  instituicao: "UNIR",
  curso: "Biologia",
  periodo: "4º",
  coeficiente: "8.5",
  estado: "RO",
  orientador: "X",
  video_url: "",
  lgpd_aceite: true,
  submitted_at: "2026-07-02T10:00:00Z",
  created_at: "2026-07-02T10:00:00Z",
  ...over,
});

const evaluation = (over: Partial<Evaluation>): Evaluation => ({
  id: "ev1",
  application_id: "a1",
  evaluator_id: "staff1",
  scores: {},
  total: 0,
  bonus_pct: 0,
  final_score: 0,
  parecer: "",
  submitted: true,
  ...over,
});

describe("clampScores + weightedTotal", () => {
  it("soma pontos por critério (máx. 100)", () => {
    expect(weightedTotal({ plano: 55, historico: 18, lattes: 8, video: 9 }, CRITERIOS)).toBe(90);
    expect(weightedTotal({ plano: 60, historico: 20, lattes: 10, video: 10 }, CRITERIOS)).toBe(100);
  });
  it("limita cada nota ao máximo do critério e trata lixo como 0", () => {
    expect(clampScores({ plano: 75, historico: -3, lattes: NaN, video: 5 }, CRITERIOS)).toEqual({
      plano: 60,
      historico: 0,
      lattes: 0,
      video: 5,
    });
    expect(weightedTotal({ plano: 999, historico: 999, lattes: 999, video: 999 }, CRITERIOS)).toBe(100);
  });
  it("ignora chaves desconhecidas (não infla o total)", () => {
    expect(weightedTotal({ plano: 10, hacker: 500 } as Record<string, number>, CRITERIOS)).toBe(10);
  });
});

describe("bônus Ciência Delas", () => {
  it("aplica somente a candidatas do sexo feminino", () => {
    expect(bonusApplies(app({ sexo: "feminino" }), BONUS)).toBe(true);
    expect(bonusApplies(app({ sexo: "masculino" }), BONUS)).toBe(false);
    expect(bonusApplies(app({ sexo: "nao_informar" }), BONUS)).toBe(false);
    expect(bonusApplies(app({ sexo: "feminino" }), undefined)).toBe(false);
  });
  it("nota final = total × 1,10 (sem teto, fiel ao edital)", () => {
    expect(finalScore(90, 10)).toBe(99);
    expect(finalScore(100, 10)).toBe(110);
    expect(finalScore(87.5, 0)).toBe(87.5);
  });
});

describe("aggregateFinal (múltiplos avaliadores)", () => {
  it("faz a média apenas das avaliações enviadas", () => {
    const evals = [
      evaluation({ final_score: 90, submitted: true }),
      evaluation({ id: "ev2", evaluator_id: "staff2", final_score: 80, submitted: true }),
      evaluation({ id: "ev3", evaluator_id: "staff3", final_score: 10, submitted: false }), // rascunho: fora
    ];
    expect(aggregateFinal(evals)).toBe(85);
    expect(aggregateFinal([])).toBeNull();
    expect(aggregateFinal([evaluation({ submitted: false })])).toBeNull();
  });
});

describe("rankState — corte de vagas + regra de gênero", () => {
  const mk = (id: string, sexo: Application["sexo"], final: number | null, plano = 0) => ({
    a: app({ id, sexo }),
    final,
    plano,
  });

  const run = (rows: ReturnType<typeof mk>[], vagas: number) => {
    const finals = new Map(rows.map((r) => [r.a.id, r.final]));
    const scores = new Map(rows.map((r) => [r.a.id, { plano: r.plano }]));
    return rankState(
      rows.map((r) => r.a),
      finals,
      CRITERIOS,
      scores,
      vagas,
    );
  };

  it("ordena por nota final desc e corta pelas vagas", () => {
    const out = run([mk("a", "masculino", 70), mk("b", "masculino", 90), mk("c", "masculino", 80)], 2);
    expect(out.map((r) => r.app.id)).toEqual(["b", "c", "a"]);
    expect(out.map((r) => r.withinQuota)).toEqual([true, true, false]);
    expect(out[0].position).toBe(1);
  });

  it("desempata pela nota do critério de maior peso (Plano)", () => {
    const out = run([mk("a", "masculino", 80, 40), mk("b", "masculino", 80, 55)], 1);
    expect(out[0].app.id).toBe("b");
    expect(out[0].withinQuota).toBe(true);
  });

  it("promove candidatas abaixo do corte até ≥50% de mulheres (marcando o ajuste)", () => {
    // vagas=2 → mínimo 1 mulher; ranking puro aprovaria 2 homens
    const out = run(
      [mk("h1", "masculino", 95), mk("h2", "masculino", 90), mk("f1", "feminino", 85)],
      2,
    );
    const aprovados = out.filter((r) => r.withinQuota).map((r) => r.app.id);
    expect(aprovados).toContain("h1"); // 1º lugar permanece
    expect(aprovados).toContain("f1"); // promovida pela regra
    const f1 = out.find((r) => r.app.id === "f1")!;
    const h2 = out.find((r) => r.app.id === "h2")!;
    expect(f1.genderAdjusted).toBe(true);
    expect(h2.withinQuota).toBe(false);
    expect(h2.genderAdjusted).toBe(true);
  });

  it("não força a regra quando não há candidatas suficientes", () => {
    const out = run([mk("h1", "masculino", 95), mk("h2", "masculino", 90)], 2);
    expect(out.every((r) => !r.genderAdjusted)).toBe(true);
    expect(out.filter((r) => r.withinQuota)).toHaveLength(2);
  });

  it("já havendo mulheres aprovadas o suficiente, nada muda", () => {
    const out = run([mk("f1", "feminino", 95), mk("h1", "masculino", 90), mk("f2", "feminino", 60)], 2);
    const aprovados = out.filter((r) => r.withinQuota).map((r) => r.app.id);
    expect(aprovados).toEqual(["f1", "h1"]);
    expect(out.every((r) => !r.genderAdjusted)).toBe(true);
  });

  it("exclui desclassificadas e rascunhos; sem nota vai para o fim sem posição", () => {
    const rows = [mk("ok", "masculino", 80), mk("semnota", "masculino", null)];
    const withStatus = [rows[0], { ...rows[1], a: app({ id: "desc", status: "desclassificada" }) }];
    const out = run([rows[0], rows[1]], 1);
    expect(out.find((r) => r.app.id === "semnota")?.position).toBeNull();
    expect(out.find((r) => r.app.id === "semnota")?.withinQuota).toBe(false);
    const out2 = run(withStatus as ReturnType<typeof mk>[], 1);
    expect(out2.some((r) => r.app.id === "desc")).toBe(false);
  });
});
