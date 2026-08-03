/**
 * Gamificação: "exploração" dos estados (sistema de recompensas ao estilo de
 * jogo). Guarda no localStorage quais UFs o usuário já abriu e deriva conquistas
 * (badges). Puro + testável (conquistasDe/proximaMeta são funções puras).
 */
import { useCallback, useState } from "react";
import { ufs } from "./geo";

const KEY = "inct-mapa-explorados-v1";
const AMAZONIA = ufs.filter((u) => u.amazoniaLegal).map((u) => u.sigla);
const REGIOES_UNICAS = [...new Set(ufs.map((u) => u.regiao))];
const regiaoDe = new Map(ufs.map((u) => [u.sigla, u.regiao]));

export type Conquista = {
  id: string;
  titulo: string;
  desc: string;
  /** progresso atual e meta (para barra) */
  atual: number;
  meta: number;
  desbloqueada: boolean;
};

/** Deriva as conquistas a partir do conjunto de UFs exploradas. */
export function conquistasDe(exp: Set<string>): Conquista[] {
  const n = exp.size;
  const naAmazonia = AMAZONIA.filter((s) => exp.has(s)).length;
  const regioesVisitadas = new Set([...exp].map((s) => regiaoDe.get(s)).filter(Boolean)).size;
  return [
    { id: "primeiro", titulo: "Primeiro passo", desc: "Abriu a primeira ficha de estado", atual: Math.min(n, 1), meta: 1, desbloqueada: n >= 1 },
    { id: "regioes", titulo: "Brasil afora", desc: "Visitou todas as 5 regiões", atual: regioesVisitadas, meta: REGIOES_UNICAS.length, desbloqueada: regioesVisitadas >= REGIOES_UNICAS.length },
    { id: "amazonia", titulo: "Amazônia Legal", desc: "Visitou os 9 estados da Amazônia Legal", atual: naAmazonia, meta: AMAZONIA.length, desbloqueada: naAmazonia >= AMAZONIA.length },
    { id: "explorador", titulo: "Explorador", desc: "Visitou 10 estados", atual: Math.min(n, 10), meta: 10, desbloqueada: n >= 10 },
    { id: "cartografo", titulo: "Cartógrafo", desc: "Visitou todos os 27 estados", atual: n, meta: 27, desbloqueada: n >= 27 },
  ];
}

function carregar(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); }
}
function salvar(s: Set<string>) {
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}

export function useExploracao() {
  const [explorados, setExplorados] = useState<Set<string>>(carregar);
  const marcar = useCallback((sigla: string) => {
    setExplorados((prev) => {
      if (prev.has(sigla)) return prev;
      const next = new Set(prev);
      next.add(sigla.toUpperCase());
      salvar(next);
      return next;
    });
  }, []);
  const limpar = useCallback(() => { setExplorados(new Set()); salvar(new Set()); }, []);
  return { explorados, marcar, limpar, conquistas: conquistasDe(explorados) };
}

export const TOTAL_UFS = ufs.length;
