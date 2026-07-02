import type { Application, BonusRule, Criterio, Evaluation } from "./types";

/**
 * Motor de pontuação e classificação — funções PURAS (sem Supabase), fiéis ao
 * edital: notas por critério em pontos (0..max), total = soma (máx. 100),
 * bônus "Ciência Delas" = +10% sobre a nota final, ranking por estado com
 * corte pelas vagas e regra de ao menos 50% de mulheres quando houver
 * candidatas suficientes.
 */

/** Limita cada nota ao intervalo [0, max] do critério; ignora chaves desconhecidas. */
export function clampScores(scores: Record<string, number>, criterios: Criterio[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of criterios) {
    const raw = Number(scores[c.key] ?? 0);
    out[c.key] = Math.min(Math.max(Number.isFinite(raw) ? raw : 0, 0), c.max);
  }
  return out;
}

/** Total = soma dos pontos por critério (o "peso" já está embutido no máximo, ex.: Plano 0–60). */
export function weightedTotal(scores: Record<string, number>, criterios: Criterio[]): number {
  const clamped = clampScores(scores, criterios);
  return round2(criterios.reduce((sum, c) => sum + (clamped[c.key] ?? 0), 0));
}

/** A regra do bônus se aplica a esta inscrição? (condição "campo=valor", ex.: "sexo=feminino") */
export function bonusApplies(app: Pick<Application, "sexo">, bonus?: BonusRule): boolean {
  if (!bonus || !bonus.aplicaSe) return false;
  const [field, value] = bonus.aplicaSe.split("=").map((s) => s.trim());
  if (!field || value === undefined) return false;
  return String((app as Record<string, unknown>)[field] ?? "") === value;
}

/** Nota final = total × (1 + bônus%) — o edital não prevê teto após o bônus. */
export function finalScore(total: number, bonusPct: number): number {
  return round2(total * (1 + bonusPct / 100));
}

/** Média das avaliações ENVIADAS de uma inscrição (suporte a múltiplos avaliadores). */
export function aggregateFinal(evals: Evaluation[]): number | null {
  const done = evals.filter((e) => e.submitted);
  if (!done.length) return null;
  return round2(done.reduce((s, e) => s + Number(e.final_score), 0) / done.length);
}

export type RankedApplication = {
  app: Application;
  final: number | null;
  /** posição no estado (1-based); null se ainda sem nota */
  position: number | null;
  /** dentro das vagas do estado pelo ranking puro? */
  withinQuota: boolean;
  /** entrou/saiu por força da regra de gênero (≥50% mulheres) */
  genderAdjusted: boolean;
};

/**
 * Classifica as inscrições de UM estado: ordena por nota final (desc), com
 * desempate pela nota do critério de maior peso, depois pela inscrição mais
 * antiga. Aplica o corte de vagas e, em seguida, a regra "ao menos 50% de
 * mulheres havendo candidatas suficientes" — promovendo, se necessário, as
 * candidatas mais bem colocadas abaixo do corte (as trocas ficam marcadas
 * com `genderAdjusted` para revisão humana da comissão).
 */
export function rankState(
  apps: Application[],
  finals: Map<string, number | null>,
  criterios: Criterio[],
  scoresByApp: Map<string, Record<string, number>>,
  vagas: number,
  minWomenShare = 0.5,
): RankedApplication[] {
  const heaviest = [...criterios].sort((a, b) => b.max - a.max).map((c) => c.key);

  const scored = apps
    .filter((a) => a.status !== "desclassificada" && a.status !== "rascunho")
    .map((app) => ({ app, final: finals.get(app.id) ?? null }));

  scored.sort((x, y) => {
    const fx = x.final ?? -1;
    const fy = y.final ?? -1;
    if (fy !== fx) return fy - fx;
    for (const key of heaviest) {
      const sx = scoresByApp.get(x.app.id)?.[key] ?? 0;
      const sy = scoresByApp.get(y.app.id)?.[key] ?? 0;
      if (sy !== sx) return sy - sx;
    }
    const tx = x.app.submitted_at ?? x.app.created_at;
    const ty = y.app.submitted_at ?? y.app.created_at;
    return tx.localeCompare(ty);
  });

  const ranked: RankedApplication[] = scored.map((s, i) => ({
    app: s.app,
    final: s.final,
    position: s.final === null ? null : i + 1,
    withinQuota: s.final !== null && i < vagas,
    genderAdjusted: false,
  }));

  // Regra de gênero: ao menos ceil(vagas/2) mulheres entre as aprovadas,
  // quando existirem candidatas avaliadas em número suficiente.
  const minWomen = Math.ceil(vagas * minWomenShare);
  const evaluated = ranked.filter((r) => r.final !== null);
  const approved = evaluated.filter((r) => r.withinQuota);
  const womenApproved = approved.filter((r) => r.app.sexo === "feminino");
  const womenBelow = evaluated.filter((r) => !r.withinQuota && r.app.sexo === "feminino");

  let need = Math.min(minWomen, womenApproved.length + womenBelow.length) - womenApproved.length;
  if (need > 0) {
    // promove as melhores candidatas abaixo do corte, removendo os últimos
    // aprovados não-mulheres (de baixo para cima)
    const demotable = approved.filter((r) => r.app.sexo !== "feminino").reverse();
    for (let i = 0; i < need && i < womenBelow.length && i < demotable.length; i++) {
      womenBelow[i].withinQuota = true;
      womenBelow[i].genderAdjusted = true;
      demotable[i].withinQuota = false;
      demotable[i].genderAdjusted = true;
    }
  }

  return ranked;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
