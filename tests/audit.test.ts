import { describe, it, expect } from "vitest";
import { buildAudit, scrubNames } from "../src/platform/audit";
import type { Application, Edital, Evaluation, Profile } from "../src/platform/types";

const CRITERIOS = [
  { key: "plano", label: "Plano", peso: 6, max: 60 },
  { key: "alinhamento", label: "Alinhamento", peso: 1, max: 10 },
  { key: "historico", label: "Histórico", peso: 1, max: 10 },
  { key: "lattes", label: "Lattes", peso: 1, max: 10 },
  { key: "video", label: "Vídeo", peso: 1, max: 10 },
];

const EDITAL: Edital = {
  id: "ed1",
  slug: "sel-2026",
  numero: "04/2026",
  titulo: "Seleção IC",
  status: "em_avaliacao",
  abre_em: "2026-07-06T00:00:00Z",
  fecha_em: "2026-07-19T00:00:00Z",
  config: { criterios: CRITERIOS, documentos: [], estados: [], bonus: { label: "CD", percent: 10, aplicaSe: "sexo=feminino" } },
};

const app = (over: Partial<Application>): Application => ({
  id: "a1",
  edital_id: "ed1",
  user_id: "u1",
  protocolo: "INCT-04-2026-0001",
  status: "recebida",
  nome: "Fulano de Tal",
  cpf: "123.456.789-00",
  email: "f@x.com",
  telefone: "",
  sexo: "masculino",
  instituicao: "UNIR",
  curso: "Biologia",
  periodo: "4º",
  coeficiente: "8.0",
  estado: "RO",
  orientador: "Maria Souza",
  video_url: "",
  lgpd_aceite: true,
  submitted_at: "2026-07-10T10:00:00Z",
  created_at: "2026-07-10T10:00:00Z",
  ...over,
});

const ev = (over: Partial<Evaluation>): Evaluation => ({
  id: "e1",
  application_id: "a1",
  evaluator_id: "av1",
  scores: { plano: 50, alinhamento: 8, historico: 8, lattes: 8, video: 8 },
  total: 82,
  bonus_pct: 0,
  final_score: 82,
  parecer: "Bom plano, coerente com os objetivos do projeto.",
  submitted: true,
  ...over,
});

const prof = (over: Partial<Profile>): Profile => ({
  id: "av1",
  email: "av1@x.com",
  full_name: "João Avaliador",
  role: "avaliador",
  ...over,
});

describe("buildAudit — regime de poucos avaliadores", () => {
  it("marca inscrição decidida por um único avaliador", () => {
    const audit = buildAudit([app({})], [ev({})], [prof({})], EDITAL, []);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].decidida_por_avaliador_unico).toBe(true);
    expect(audit.rows[0].flags).toContain("AVALIADOR_UNICO");
    expect(audit.summary.pct_decididas_por_unico).toBe(100);
    // sem consenso possível
    expect(audit.rows[0].desvio_vs_consenso).toBeNull();
    expect(audit.rows[0].z_na_inscricao).toBeNull();
  });

  it("detecta conflito de interesse (avaliador == orientador pretendido)", () => {
    const audit = buildAudit(
      [app({ orientador: "João Avaliador" })],
      [ev({})],
      [prof({ full_name: "joão  avaliador" })], // acento/espacos toleram
      EDITAL,
      [],
    );
    expect(audit.rows[0].flag_coi_orientador).toBe(true);
    expect(audit.rows[0].flags).toContain("COI_ORIENTADOR");
    expect(audit.summary.n_coi).toBe(1);
  });

  it("sinaliza outlier quando há >=3 avaliadores e uma nota destoa", () => {
    const apps = [app({})];
    const evals = [
      ev({ id: "x1", evaluator_id: "av1", final_score: 95 }),
      ev({ id: "x2", evaluator_id: "av2", final_score: 90 }),
      ev({ id: "x3", evaluator_id: "av3", final_score: 10, parecer: "" }),
    ];
    const profs = [prof({ id: "av1" }), prof({ id: "av2", full_name: "Ana" }), prof({ id: "av3", full_name: "Rui" })];
    const audit = buildAudit(apps, evals, profs, EDITAL, []);
    const low = audit.rows.find((r) => r.final_score === 10)!;
    const high = audit.rows.find((r) => r.final_score === 95)!;
    expect(low.flag_outlier).toBe(true);
    expect(low.flags).toContain("OUTLIER_BAIXO");
    expect(high.flag_outlier).toBe(false);
    // nota extrema (todas zero) sem parecer, no outlier baixo
    expect(low.flag_parecer_vazio).toBe(true);
  });

  it("pseudonimiza no JSON de IA (sem CPF/nome) e escrutina o parecer", () => {
    const audit = buildAudit(
      [app({ nome: "Fulano de Tal", orientador: "Maria Souza" })],
      [ev({ parecer: "Fulano de Tal tem bom histórico; orientadora Maria Souza é adequada." })],
      [prof({})],
      EDITAL,
      [],
    );
    const j = JSON.parse(audit.aiJson);
    expect(j.linhas[0].cand).toMatch(/^C\d{3}$/);
    expect(j.linhas[0].aval).toMatch(/^AV\d{2}$/);
    expect(audit.aiJson).not.toContain("123.456.789-00"); // CPF fora
    expect(audit.aiJson).not.toContain("Fulano de Tal"); // nome removido do parecer
    expect(audit.aiJson).not.toContain("Maria Souza"); // orientador removido
    expect(j.linhas[0].parecer).toContain("[nome removido]");
    // o CSV interno mantém a identificação
    expect(audit.internalCsv).toContain("123.456.789-00");
    expect(audit.internalCsv).toContain("Fulano de Tal");
  });

  it("registra edição após outra submissão a partir do log", () => {
    const apps = [app({})];
    const evals = [
      ev({ id: "x1", evaluator_id: "av1", final_score: 60 }),
      ev({ id: "x2", evaluator_id: "av2", final_score: 62 }),
    ];
    const profs = [prof({ id: "av1" }), prof({ id: "av2", full_name: "Ana" })];
    const events = [
      { id: "g1", application_id: "a1", evaluator_id: "av1", action: "insert" as const, scores: {}, total: 0, bonus_pct: 0, final_score: 95, submitted: true, at: "2026-07-11T09:00:00Z" },
      { id: "g2", application_id: "a1", evaluator_id: "av2", action: "insert" as const, scores: {}, total: 0, bonus_pct: 0, final_score: 62, submitted: true, at: "2026-07-11T10:00:00Z" },
      { id: "g3", application_id: "a1", evaluator_id: "av1", action: "update" as const, scores: {}, total: 0, bonus_pct: 0, final_score: 60, submitted: true, at: "2026-07-11T11:00:00Z" },
    ];
    const audit = buildAudit(apps, evals, profs, EDITAL, events);
    const av1row = audit.rows.find((r) => r.aval_ref === "João Avaliador")!;
    expect(av1row.n_edicoes).toBe(1);
    expect(av1row.editada_apos_outra_submissao).toBe(true);
    expect(av1row.flags).toContain("EDITADA_APOS_OUTRA");
  });
});

describe("scrubNames", () => {
  it("remove nomes próprios (>=4 chars) preservando o resto", () => {
    const out = scrubNames("A candidata Ana Beatriz foi avaliada por Ana Beatriz.", ["Ana Beatriz"]);
    expect(out).not.toContain("Ana Beatriz");
    expect(out).toContain("candidata");
  });
  it("não quebra com texto vazio", () => {
    expect(scrubNames("", ["X"])).toBe("");
  });
});
