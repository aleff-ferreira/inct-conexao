/**
 * ============================================================================
 *  Estado do mapa serializado na URL (hash) — deep links + voltar/avançar
 * ============================================================================
 *  A hash é a ÚNICA fonte de verdade do mapa. Forma:
 *    #/mapa                      -> vitrine (panorama do relevo), modo padrão
 *    #/mapa/ro                   -> estado selecionado (RO)
 *    #/mapa/ro?modo=explorador&tema=saude&camada=vagas-ic-2026&sec=animais
 *  Parâmetros (todos opcionais):
 *    modo   = panorama | narrativa | explorador
 *    tema   = saude | ambiente | pesquisa | comunidades
 *    camada = <id de camada>
 *    sec    = <id de seção do painel> (deep-link direto a uma seção)
 *    cap    = <id de capítulo do modo narrativo>
 *    lista  = 1  (mostra a lista-alternativa em vez do SVG)
 *    leve   = 1  (modo baixo consumo: sem imagens/animações pesadas)
 * ============================================================================
 */
import type { TemaId } from "./layers";

export type Modo = "panorama" | "narrativa" | "explorador";

export type MapaState = {
  uf: string | null; // sigla MAIÚSCULA ou null (nacional)
  modo: Modo;
  tema: TemaId | null;
  camada: string | null;
  sec: string | null;
  cap: string | null;
  lista: boolean;
  leve: boolean;
};

export const ESTADO_PADRAO: MapaState = {
  uf: null,
  modo: "panorama",
  tema: null,
  camada: "amazonia-legal",
  sec: null,
  cap: null,
  lista: false,
  leve: false,
};

const TEMAS_VALIDOS: TemaId[] = ["saude", "ambiente", "pesquisa", "comunidades"];
const UF_RE = /^[a-z]{2}$/i;

/** Lê o estado a partir de uma hash bruta (ex.: "#/mapa/ro?modo=..."). */
export function parseMapaHash(rawHash: string): MapaState {
  const hash = rawHash.replace(/^#/, "");
  const [pathPart, queryPart = ""] = hash.split("?");
  const segments = pathPart.split("/").filter(Boolean); // ["mapa", "ro"?]

  let uf: string | null = null;
  if (segments[1] && UF_RE.test(segments[1])) uf = segments[1].toUpperCase();

  const q = new URLSearchParams(queryPart);
  const modoRaw = q.get("modo");
  const modo: Modo =
    modoRaw === "explorador" ? "explorador"
    : modoRaw === "narrativa" ? "narrativa"
    : modoRaw === "panorama" ? "panorama"
    : ESTADO_PADRAO.modo;
  const temaRaw = q.get("tema");
  const tema = temaRaw && (TEMAS_VALIDOS as string[]).includes(temaRaw) ? (temaRaw as TemaId) : null;

  return {
    uf,
    // um estado selecionado força modo explorador (o painel abre no explorador)
    modo: uf ? "explorador" : modo,
    tema,
    camada: q.get("camada") || ESTADO_PADRAO.camada,
    sec: q.get("sec") || null,
    cap: q.get("cap") || null,
    lista: q.get("lista") === "1",
    leve: q.get("leve") === "1",
  };
}

/** Serializa o estado para uma hash (ex.: "#/mapa/ro?modo=explorador&tema=saude"). */
export function buildMapaHash(s: Partial<MapaState>): string {
  const st = { ...ESTADO_PADRAO, ...s };
  let path = "/mapa";
  if (st.uf) path += `/${st.uf.toLowerCase()}`;

  const q = new URLSearchParams();
  // só grava o que difere do padrão, mantendo URLs curtas e limpas.
  // modo só aparece na visão nacional (quando há uf, explorador é implícito).
  if (!st.uf && st.modo !== ESTADO_PADRAO.modo) q.set("modo", st.modo);
  if (st.tema) q.set("tema", st.tema);
  if (st.camada && st.camada !== ESTADO_PADRAO.camada) q.set("camada", st.camada);
  if (st.sec) q.set("sec", st.sec);
  if (st.cap) q.set("cap", st.cap);
  if (st.lista) q.set("lista", "1");
  if (st.leve) q.set("leve", "1");

  const qs = q.toString();
  return `#${path}${qs ? `?${qs}` : ""}`;
}

/** true se a hash aponta para a rota do mapa. */
export function isMapaHash(rawHash: string): boolean {
  const path = rawHash.replace(/^#/, "").split("?")[0];
  return path.split("/").filter(Boolean)[0] === "mapa";
}
