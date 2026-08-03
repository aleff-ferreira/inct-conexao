import { csvEscape, toCsv } from "../figuras/csv";
import type { Application, Criterio, Edital, Evaluation, EvaluationEvent, Profile } from "./types";

/**
 * Auditoria de justiça das avaliações — funções PURAS (sem Supabase, testáveis).
 *
 * A avaliação é ABERTA (todo avaliador pontua qualquer inscrição). Em vez de
 * prevenir injustiça com restrição, DETECTA-SE depois: este módulo produz, no
 * navegador do admin, dois artefatos que ele baixa e (o segundo) joga numa IA:
 *   1) CSV interno IDENTIFICADO — auditoria oficial da comissão (não compartilhar);
 *   2) JSON PSEUDONIMIZADO — para colar numa IA investigar injustiça.
 *
 * Honestidade estatística (regime de POUCOS avaliadores, ~200 inscrições):
 * o caso dominante é 1 avaliação por inscrição, onde métricas de consenso são
 * indefinidas. Por isso elas são emitidas como `null` EXPLÍCITO (nunca NaN) e o
 * sinal de topo é "decidida por um único avaliador". Conluio/viés demográfico
 * NÃO são exportados como acusação — o regime N-pequeno os torna ruído.
 */

// -------------------------------------------------------- utilidades puras --
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ------------------------------------------------------------------ tipos --
export type AuditRow = {
  // identidade (só no interno; pseudonimizada no de IA)
  cand_ref: string;
  aval_ref: string;
  estado: string;
  instituicao: string;
  curso: string;
  coeficiente: string;
  sexo: string;
  orientador?: string; // só interno
  candidato_nome?: string; // só interno
  candidato_cpf?: string; // só interno
  avaliador_email?: string; // só interno
  // notas
  notas: Record<string, number>;
  total: number;
  bonus_pct: number;
  final_score: number;
  parecer_chars: number;
  parecer?: string; // interno: cru; IA: com nomes removidos
  // contexto da inscrição
  n_avaliadores_inscricao: number;
  decidida_por_avaliador_unico: boolean;
  nota_final_agregada: number; // média oficial (todas submetidas)
  // sinais de consenso (só quando n>=3, senão null)
  desvio_vs_consenso: number | null;
  z_na_inscricao: number | null;
  flag_outlier: boolean;
  // sinais por linha
  flag_coi_orientador: boolean;
  flag_parecer_vazio: boolean;
  flag_notas_iguais: boolean;
  flag_nota_extrema: boolean;
  // histórico (do log append-only)
  n_gravacoes: number;
  n_edicoes: number;
  editada_apos_outra_submissao: boolean;
  flags: string[];
};

export type EvaluatorStat = {
  aval_ref: string;
  n_avaliacoes: number;
  media: number;
  desvio: number;
  bias_vs_global: number;
  n_coi: number;
  n_outlier: number;
  pct_parecer_vazio: number;
  amostra_suficiente: boolean; // n grande o bastante p/ ler o bias como sinal
};

export type AuditSummary = {
  total_avaliacoes: number;
  inscricoes_avaliadas: number;
  pct_decididas_por_unico: number;
  n_coi: number;
  n_outliers: number;
  n_extrema_sem_parecer: number;
  n_editadas_apos_outra: number;
};

export type Audit = {
  rows: AuditRow[]; // identificadas (internas)
  evaluators: EvaluatorStat[];
  summary: AuditSummary;
  internalCsv: string;
  aiJson: string;
};

// --------------------------------------------------------- construção base --
function buildRows(
  apps: Application[],
  evals: Evaluation[],
  profiles: Profile[],
  criterios: Criterio[],
  events: EvaluationEvent[],
): AuditRow[] {
  const appById = new Map(apps.map((a) => [a.id, a]));
  const nameById = new Map(profiles.map((p) => [p.id, p]));
  const submitted = evals.filter((e) => e.submitted);

  // agrupa por inscrição para consenso/dispersão
  const byApp = new Map<string, Evaluation[]>();
  for (const e of submitted) {
    const arr = byApp.get(e.application_id) ?? [];
    arr.push(e);
    byApp.set(e.application_id, arr);
  }

  // eventos por (inscrição, avaliador) e a primeira submissão de OUTRO avaliador
  const evByKey = new Map<string, EvaluationEvent[]>();
  const firstOtherSubmit = new Map<string, { evaluator: string; at: number }[]>();
  for (const ev of events) {
    const k = `${ev.application_id}|${ev.evaluator_id}`;
    (evByKey.get(k) ?? evByKey.set(k, []).get(k)!).push(ev);
    if (ev.submitted) {
      const arr = firstOtherSubmit.get(ev.application_id) ?? [];
      arr.push({ evaluator: ev.evaluator_id, at: Date.parse(ev.at) });
      firstOtherSubmit.set(ev.application_id, arr);
    }
  }

  const rows: AuditRow[] = [];
  for (const e of submitted) {
    const app = appById.get(e.application_id);
    if (!app) continue;
    const prof = nameById.get(e.evaluator_id);
    const peers = byApp.get(e.application_id) ?? [e];
    const n = peers.length;
    const finals = peers.map((p) => Number(p.final_score));
    const others = peers.filter((p) => p.id !== e.id).map((p) => Number(p.final_score));

    const consenso = others.length ? mean(others) : null;
    const desvio = consenso === null ? null : round2(Number(e.final_score) - consenso);
    let z: number | null = null;
    let outlier = false;
    if (n >= 3) {
      const sd = stdev(finals);
      z = sd === 0 ? 0 : round2((Number(e.final_score) - mean(finals)) / sd);
      // z populacional satura em ~sqrt(n-1) (≈1.41 em n=3), então o limiar 1.3
      // pega só a nota realmente destoante do júri, sem duplo-marcar as demais.
      outlier = Math.abs(z) >= 1.3;
    }

    const scoreVals = criterios.map((c) => Number(e.scores?.[c.key] ?? 0));
    const notasIguais = scoreVals.length > 1 && scoreVals.every((v) => v === scoreVals[0]);
    const parecerLen = (e.parecer ?? "").trim().length;
    const coi = Boolean(prof?.full_name) && norm(app.orientador) === norm(prof!.full_name!);
    // extrema: todas no máximo do critério, ou todas em zero
    const todasNoMax = scoreVals.length > 0 && criterios.every((c) => Number(e.scores?.[c.key] ?? 0) >= c.max);
    const todasZero = scoreVals.length > 0 && scoreVals.every((v) => v === 0);

    const key = `${e.application_id}|${e.evaluator_id}`;
    const myEvents = evByKey.get(key) ?? [];
    const nEdicoes = myEvents.filter((x) => x.action === "update").length;
    const myLastAt = myEvents.length ? Math.max(...myEvents.map((x) => Date.parse(x.at))) : 0;
    const otherFirst = (firstOtherSubmit.get(e.application_id) ?? [])
      .filter((x) => x.evaluator !== e.evaluator_id)
      .reduce((min, x) => Math.min(min, x.at), Infinity);
    const editadaApos = myLastAt > 0 && otherFirst !== Infinity && myLastAt > otherFirst && nEdicoes > 0;

    const flags: string[] = [];
    if (coi) flags.push("COI_ORIENTADOR");
    if (outlier) flags.push(z! > 0 ? "OUTLIER_ALTO" : "OUTLIER_BAIXO");
    if (n === 1) flags.push("AVALIADOR_UNICO");
    if (parecerLen < 15) flags.push("PARECER_VAZIO");
    if (todasNoMax) flags.push("TODAS_NO_MAXIMO");
    if (todasZero) flags.push("TODAS_ZERO");
    if (notasIguais) flags.push("NOTAS_IGUAIS");
    if (editadaApos) flags.push("EDITADA_APOS_OUTRA");

    rows.push({
      cand_ref: app.protocolo,
      aval_ref: e.evaluator_id,
      estado: app.estado,
      instituicao: app.instituicao,
      curso: app.curso,
      coeficiente: app.coeficiente,
      sexo: app.sexo,
      orientador: app.orientador,
      candidato_nome: app.nome,
      candidato_cpf: app.cpf,
      avaliador_email: prof?.email,
      notas: Object.fromEntries(criterios.map((c) => [c.key, Number(e.scores?.[c.key] ?? 0)])),
      total: Number(e.total),
      bonus_pct: Number(e.bonus_pct),
      final_score: Number(e.final_score),
      parecer_chars: parecerLen,
      parecer: e.parecer ?? "",
      n_avaliadores_inscricao: n,
      decidida_por_avaliador_unico: n === 1,
      nota_final_agregada: round2(mean(finals)),
      desvio_vs_consenso: desvio,
      z_na_inscricao: z,
      flag_outlier: outlier,
      flag_coi_orientador: coi,
      flag_parecer_vazio: parecerLen < 15,
      flag_notas_iguais: notasIguais,
      flag_nota_extrema: todasNoMax || todasZero,
      n_gravacoes: myEvents.length,
      n_edicoes: nEdicoes,
      editada_apos_outra_submissao: editadaApos,
      // aval_ref recebe o NOME no interno; é trocado por alias no pseudonimizado
      flags,
    });
  }
  // preenche aval_ref com o nome legível (interno)
  for (const r of rows) {
    const prof = profiles.find((p) => p.id === r.aval_ref);
    r.aval_ref = prof?.full_name || prof?.email || r.aval_ref;
  }
  return rows;
}

function buildEvaluatorStats(rows: AuditRow[], nEvaluators: number): EvaluatorStat[] {
  const globalMean = mean(rows.map((r) => r.final_score));
  const byAval = new Map<string, AuditRow[]>();
  for (const r of rows) (byAval.get(r.aval_ref) ?? byAval.set(r.aval_ref, []).get(r.aval_ref)!).push(r);
  const stats: EvaluatorStat[] = [];
  for (const [aval, rs] of byAval) {
    const finals = rs.map((r) => r.final_score);
    stats.push({
      aval_ref: aval,
      n_avaliacoes: rs.length,
      media: round2(mean(finals)),
      desvio: round2(stdev(finals)),
      bias_vs_global: round2(mean(finals) - globalMean),
      n_coi: rs.filter((r) => r.flag_coi_orientador).length,
      n_outlier: rs.filter((r) => r.flag_outlier).length,
      pct_parecer_vazio: rs.length ? Math.round((100 * rs.filter((r) => r.flag_parecer_vazio).length) / rs.length) : 0,
      // ler "bias" como sinal exige avaliadores suficientes E amostra individual razoável
      amostra_suficiente: nEvaluators >= 8 && rs.length >= 5,
    });
  }
  return stats.sort((a, b) => b.n_avaliacoes - a.n_avaliacoes);
}

function summarize(rows: AuditRow[]): AuditSummary {
  const apps = new Set(rows.map((r) => r.cand_ref));
  const unicas = new Set(rows.filter((r) => r.decidida_por_avaliador_unico).map((r) => r.cand_ref));
  return {
    total_avaliacoes: rows.length,
    inscricoes_avaliadas: apps.size,
    pct_decididas_por_unico: apps.size ? Math.round((100 * unicas.size) / apps.size) : 0,
    n_coi: rows.filter((r) => r.flag_coi_orientador).length,
    n_outliers: rows.filter((r) => r.flag_outlier).length,
    n_extrema_sem_parecer: rows.filter((r) => r.flag_nota_extrema && r.flag_parecer_vazio).length,
    n_editadas_apos_outra: rows.filter((r) => r.editada_apos_outra_submissao).length,
  };
}

// --------------------------------------------------- pseudonimização + CSV --
/** Remove nomes próprios (candidatos, orientadores, avaliadores) de um texto. */
export function scrubNames(text: string, tokens: string[]): string {
  if (!text) return text;
  let out = text;
  for (const t of [...tokens].filter((x) => x && x.trim().length >= 4).sort((a, b) => b.length - a.length)) {
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(esc, "gi"), "[nome removido]");
  }
  return out;
}

/* `csvEscape` e `toCsv` viviam aqui, privados, e nasceram de novo em
   `src/figuras/csv.ts` quando as figuras precisaram exportar dados. Duas
   implementações do mesmo formato divergem, e a que diverge é sempre a que não
   tem teste — então este módulo passou a importar a versão canônica, que é a
   coberta por `tests/figuras.test.ts`. O separador `;` e o BOM continuam sendo
   os mesmos, pelo mesmo motivo: Excel em português. */

function flattenForCsv(r: AuditRow, criterios: Criterio[]): Record<string, string | number | boolean | null> {
  const flat: Record<string, string | number | boolean | null> = {
    estado: r.estado,
    protocolo: r.cand_ref,
    candidato_nome: r.candidato_nome ?? "",
    candidato_cpf: r.candidato_cpf ?? "",
    sexo: r.sexo,
    instituicao: r.instituicao,
    curso: r.curso,
    coeficiente: r.coeficiente,
    orientador: r.orientador ?? "",
    avaliador: r.aval_ref,
    avaliador_email: r.avaliador_email ?? "",
  };
  for (const c of criterios) flat[`nota_${c.key}`] = r.notas[c.key] ?? 0;
  flat.total = r.total;
  flat.bonus_pct = r.bonus_pct;
  flat.final_score = r.final_score;
  flat.nota_final_agregada = r.nota_final_agregada;
  flat.n_avaliadores_inscricao = r.n_avaliadores_inscricao;
  flat.desvio_vs_consenso = r.desvio_vs_consenso;
  flat.z_na_inscricao = r.z_na_inscricao;
  flat.n_edicoes = r.n_edicoes;
  flat.parecer_chars = r.parecer_chars;
  flat.flags = r.flags.join("|");
  flat.parecer = r.parecer ?? "";
  return flat;
}

const GLOSSARIO: Record<string, string> = {
  decidida_por_avaliador_unico:
    "A inscrição teve só 1 avaliação: não há segunda opinião. Sinal PRINCIPAL neste regime de poucos avaliadores.",
  flag_coi_orientador:
    "O avaliador tem o mesmo nome do orientador pretendido (auto-avaliação). Heurística por casamento de texto: verificar, não é prova.",
  desvio_vs_consenso:
    "final_score menos a média das OUTRAS avaliações da mesma inscrição. null quando não há outra avaliação.",
  z_na_inscricao: "Desvio padronizado dentro da inscrição; só calculado quando há >=3 avaliações (senão null).",
  flag_outlier: "|z_na_inscricao| >= 1.3 (só quando >=3 avaliações). Nota destoante do júri.",
  flag_nota_extrema: "Todas as notas de critério no máximo ou todas em zero, possível padding para empurrar/afundar.",
  editada_apos_outra_submissao:
    "O avaliador alterou a própria nota DEPOIS de outra avaliação já ter sido enviada (via log append-only).",
  bias_vs_global: "Média do avaliador menos a média geral. Só é sinal confiável quando amostra_suficiente=true.",
};

const PROMPT = [
  "Você é auditor(a) de integridade de um processo seletivo de bolsas. Cada LINHA é UMA avaliação: um avaliador (AVxx) pontuando um candidato (Cxxx). A nota final do candidato é a MÉDIA das avaliações enviadas. O modelo é ABERTO: qualquer avaliador pode pontuar qualquer candidato. Investigue possíveis INJUSTIÇAS e liste, por prioridade, casos para REVISÃO HUMANA. NÃO acuse: aponte padrões com a evidência numérica e trate tudo como suspeita a verificar.",
  "Priorize, nesta ordem: (1) DECISÕES SEM CONTRADITÓRIO (inscrições com decidida_por_avaliador_unico=true, sobretudo perto do corte de vagas; é o risco dominante aqui. (2) CONFLITO DE INTERESSE) flag_coi_orientador=true; veja se a nota do COI está acima da dos demais. (3) OUTLIERS (flag_outlier=true (só existe quando a inscrição teve >=3 avaliações); separe outliers altos (inflam) de baixos (afundam), com peso extra se vier sem parecer (flag_parecer_vazio) ou com nota extrema. (4) LINGUAGEM do parecer) leia o texto e sinalize linguagem depreciativa, preconceituosa ou dupla-medida entre candidatos parecidos. (5) EDIÇÃO TARDIA: editada_apos_outra_submissao=true (mudou a nota depois de ver outra).",
  "REGRAS DE HONESTIDADE ESTATÍSTICA: os avaliadores são POUCOS. NÃO afirme conluio nem viés demográfico de um avaliador a partir de poucos casos, trate bias_vs_global como sinal só quando amostra_suficiente=true, e sempre declare a incerteza. Ao final, diga explicitamente O QUE NÃO DÁ PARA CONCLUIR com estes dados.",
  "Entregue: (a) TOP 10 casos priorizados (candidato, avaliador, tipo de risco, evidência numérica, ação sugerida); (b) avaliadores mais atípicos, com a ressalva de amostra; (c) limitações da análise.",
].join("\n\n");

// ---------------------------------------------------------------- fachada --
export function buildAudit(
  apps: Application[],
  evals: Evaluation[],
  profiles: Profile[],
  edital: Edital,
  events: EvaluationEvent[] = [],
): Audit {
  const criterios = edital.config.criterios;
  const rows = buildRows(apps, evals, profiles, criterios, events);

  // alias estáveis para a variante de IA
  const candAlias = new Map<string, string>();
  [...new Set(rows.map((r) => r.cand_ref))].sort().forEach((p, i) => candAlias.set(p, `C${String(i + 1).padStart(3, "0")}`));
  const avalAlias = new Map<string, string>();
  [...new Set(rows.map((r) => r.aval_ref))].sort().forEach((a, i) => avalAlias.set(a, `AV${String(i + 1).padStart(2, "0")}`));

  const nEvaluators = avalAlias.size;
  const evaluators = buildEvaluatorStats(rows, nEvaluators);
  const summary = summarize(rows);

  // CSV interno (identificado)
  const internalCsv = "﻿" + toCsv(rows.map((r) => flattenForCsv(r, criterios)));

  // JSON para IA (pseudonimizado; parecer com nomes removidos)
  const nameTokens = [
    ...apps.map((a) => a.nome),
    ...apps.map((a) => a.orientador),
    ...profiles.map((p) => p.full_name ?? ""),
  ];
  const aiLinhas = rows.map((r) => ({
    cand: candAlias.get(r.cand_ref),
    aval: avalAlias.get(r.aval_ref),
    estado: r.estado,
    instituicao: r.instituicao,
    curso: r.curso,
    coeficiente: r.coeficiente,
    sexo: r.sexo,
    notas: r.notas,
    total: r.total,
    bonus_pct: r.bonus_pct,
    final_score: r.final_score,
    n_avaliadores_inscricao: r.n_avaliadores_inscricao,
    decidida_por_avaliador_unico: r.decidida_por_avaliador_unico,
    nota_final_agregada: r.nota_final_agregada,
    desvio_vs_consenso: r.desvio_vs_consenso,
    z_na_inscricao: r.z_na_inscricao,
    parecer_chars: r.parecer_chars,
    parecer: scrubNames(r.parecer ?? "", nameTokens),
    flag_coi_orientador: r.flag_coi_orientador,
    flag_outlier: r.flag_outlier,
    flag_parecer_vazio: r.flag_parecer_vazio,
    flag_nota_extrema: r.flag_nota_extrema,
    editada_apos_outra_submissao: r.editada_apos_outra_submissao,
    flags: r.flags,
  }));

  const envelope = {
    aviso_privacidade:
      "Arquivo PSEUDONIMIZADO (não anônimo). Em estados com 1 vaga, estado+curso+sexo podem reidentificar um candidato. Trate como dado pessoal, não publique, e use só para auditoria de integridade.",
    contexto: {
      edital: `${edital.numero}: ${edital.titulo}`,
      modelo: "aberto: todo avaliador pode pontuar qualquer inscrição; nota final = média das avaliações enviadas",
      total_avaliacoes: summary.total_avaliacoes,
      inscricoes_avaliadas: summary.inscricoes_avaliadas,
      total_avaliadores: nEvaluators,
      pct_decididas_por_avaliador_unico: summary.pct_decididas_por_unico,
    },
    criterios: criterios.map((c) => ({ key: c.key, max: c.max })),
    regra_genero: edital.config.regraGenero ?? null,
    bonus: edital.config.bonus ? `+${edital.config.bonus.percent}% se ${edital.config.bonus.aplicaSe}` : null,
    glossario_metricas: GLOSSARIO,
    roteiro_investigacao: PROMPT,
    avaliadores: evaluators.map((e) => ({ ...e, aval_ref: avalAlias.get(e.aval_ref) ?? e.aval_ref })),
    linhas: aiLinhas,
  };

  return { rows, evaluators, summary, internalCsv, aiJson: JSON.stringify(envelope, null, 2) };
}

/** Dispara o download dos dois arquivos (efeito colateral no browser). */
export function downloadAuditFiles(audit: Audit, slug: string): void {
  const save = (content: string, type: string, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  save(audit.internalCsv, "text/csv;charset=utf-8", `auditoria-interna-${slug}.csv`);
  save(audit.aiJson, "application/json", `auditoria-analise-${slug}.json`);
}
