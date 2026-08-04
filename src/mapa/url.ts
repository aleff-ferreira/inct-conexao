/**
 * ============================================================================
 *  Estado do mapa serializado na URL (hash) — deep links + voltar/avançar
 * ============================================================================
 *  A hash é a ÚNICA fonte de verdade do mapa. Forma:
 *    #/mapa                      -> vitrine (panorama do relevo), modo padrão
 *    #/mapa/ro                   -> estado selecionado (RO)
 *    #/mapa/ro?modo=explorador&camada=vagas-ic-2026&sec=animais
 *  Parâmetros (todos opcionais):
 *    modo   = panorama | narrativa | explorador
 *    camada = <id de camada>  — VALIDADO contra as camadas que existem
 *    sec    = <id de seção do painel> — VALIDADO
 *    cap    = <id de capítulo do modo narrativo>
 *    lista  = 1  (mostra a lista-alternativa em vez do SVG)
 *    leve   = 1 | 0  (1 força modo leve; 0 força o completo; ausente = decide
 *                     pelo aparelho)
 *
 *  Valor inválido NUNCA é aceito em silêncio. `?sec=banana` esvaziava o corpo
 *  do painel sem erro e sem aviso, e `?camada=` errada pintava o padrão
 *  deixando um link mentiroso no ar. O que não é reconhecido vira o padrão.
 *
 *  O parâmetro `tema` foi removido: era escrito e lido pela URL e não tinha um
 *  único consumidor no código.
 * ============================================================================
 */
import { CAMADA_IDS, SECAO_IDS } from "./layers";

export type Modo = "panorama" | "narrativa" | "explorador";

export type MapaState = {
  uf: string | null; // sigla MAIÚSCULA ou null (nacional)
  modo: Modo;
  camada: string | null;
  sec: string | null;
  cap: string | null;
  lista: boolean;
  /**
   * "auto" deixa o aparelho decidir (economia de dados ligada, rede 2G).
   * "1"/"0" são a escolha explícita da pessoa, e ganham do automático — antes
   * o botão ficava presa em ligado para quem tinha economia de dados no
   * sistema, com `aria-pressed` mentindo e o clique sem efeito.
   */
  leve: "auto" | "1" | "0";
};

export const ESTADO_PADRAO: MapaState = {
  uf: null,
  modo: "panorama",
  camada: "amazonia-legal",
  sec: null,
  cap: null,
  lista: false,
  leve: "auto",
};

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
  const camadaRaw = q.get("camada");
  const secRaw = q.get("sec");
  const leveRaw = q.get("leve");

  return {
    uf,
    // um estado selecionado força modo explorador (o painel abre no explorador)
    modo: uf ? "explorador" : modo,
    camada: camadaRaw && CAMADA_IDS.includes(camadaRaw) ? camadaRaw : ESTADO_PADRAO.camada,
    sec: secRaw && SECAO_IDS.includes(secRaw) ? secRaw : null,
    cap: q.get("cap") || null,
    lista: q.get("lista") === "1",
    leve: leveRaw === "1" ? "1" : leveRaw === "0" ? "0" : "auto",
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
  if (st.camada && st.camada !== ESTADO_PADRAO.camada) q.set("camada", st.camada);
  if (st.sec) q.set("sec", st.sec);
  if (st.cap) q.set("cap", st.cap);
  if (st.lista) q.set("lista", "1");
  // "auto" é o padrão e fica fora da URL; a escolha explícita viaja no link.
  if (st.leve !== "auto") q.set("leve", st.leve);

  const qs = q.toString();
  return `#${path}${qs ? `?${qs}` : ""}`;
}

/** true se a hash aponta para a rota do mapa. */
export function isMapaHash(rawHash: string): boolean {
  const path = rawHash.replace(/^#/, "").split("?")[0];
  return path.split("/").filter(Boolean)[0] === "mapa";
}
