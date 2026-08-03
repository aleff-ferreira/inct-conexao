/**
 * Carrega o artefato geográfico oficial (IBGE) e expõe helpers.
 * O JSON é importado no build (resolveJsonModule) — zero fetch em runtime.
 */
import geoRaw from "./geo/br-uf.json";
import type { GeoData, Uf } from "./types";

export const geo = geoRaw as GeoData;
export const ufs: Uf[] = geo.ufs;
export const viewBox = geo.meta.viewBox;

const [vx, vy, vw, vh] = viewBox.split(" ").map(Number);
/** Caixa do Brasil (onde a malha vetorial e o relevo colorido vivem). */
export const VIEW = { x: vx, y: vy, w: vw, h: vh };

/** Moldura do "mundo": Brasil + margem para os vizinhos esmaecidos (18% por lado). */
const WPAD = 0.18;
export const WORLD = { x: vx - vw * WPAD, y: vy - vh * WPAD, w: vw * (1 + 2 * WPAD), h: vh * (1 + 2 * WPAD) };

const bySigla = new Map(ufs.map((u) => [u.sigla, u]));

/** Busca uma UF pela sigla (aceita minúsculas). */
export function ufBySigla(sigla?: string | null): Uf | undefined {
  if (!sigla) return undefined;
  return bySigla.get(sigla.toUpperCase());
}

/** Regiões na ordem norte→sul aproximada (para agrupar a lista). */
export const REGIOES = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

/** UFs agrupadas por região (para a lista-alternativa acessível). */
export function ufsPorRegiao(): { regiao: string; ufs: Uf[] }[] {
  return REGIOES.map((regiao) => ({
    regiao,
    ufs: ufs.filter((u) => u.regiao === regiao),
  })).filter((g) => g.ufs.length);
}

/** true se a UF pertence à Amazônia Legal (integral ou parcial). */
export const isAmazoniaLegal = (u: Uf): boolean => u.amazoniaLegal != null;

/** Enquadra um bbox arbitrário (com folga, proporção e escala mínima). */
function boxToViewBox(x0: number, y0: number, x1: number, y1: number, pad: number, minFrac: number): [number, number, number, number] {
  const aspect = VIEW.w / VIEW.h;
  let bw = (x1 - x0) * (1 + pad * 2);
  let bh = (y1 - y0) * (1 + pad * 2);
  if (bw / bh > aspect) bh = bw / aspect;
  else bw = bh * aspect;
  const minW = VIEW.w * minFrac;
  if (bw < minW) { bh *= minW / bw; bw = minW; }
  bw = Math.min(bw, VIEW.w);
  bh = bw / aspect;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  let nx = Math.max(VIEW.x, Math.min(cx - bw / 2, VIEW.x + VIEW.w - bw));
  let ny = Math.max(VIEW.y, Math.min(cy - bh / 2, VIEW.y + VIEW.h - bh));
  return [round(nx), round(ny), round(bw), round(bh)];
}

/** viewBox de "fly-to" para uma UF (escala mínima evita zoom absurdo no DF). */
export function focusViewBox(u: Uf, pad = 0.35): [number, number, number, number] {
  const [x0, y0, x1, y1] = u.bbox;
  return boxToViewBox(x0, y0, x1, y1, pad, 0.22);
}

/** viewBox que abraça um conjunto qualquer de UFs. */
export function ufsViewBox(lista: Uf[], pad = 0.08, minFrac = 0.3): [number, number, number, number] {
  if (!lista.length) return fullViewBox();
  const x0 = Math.min(...lista.map((u) => u.bbox[0]));
  const y0 = Math.min(...lista.map((u) => u.bbox[1]));
  const x1 = Math.max(...lista.map((u) => u.bbox[2]));
  const y1 = Math.max(...lista.map((u) => u.bbox[3]));
  return boxToViewBox(x0, y0, x1, y1, pad, minFrac);
}

/** viewBox de "fly-to" para uma REGIÃO (combina os bboxes das suas UFs). */
export function regionViewBox(regiao: string): [number, number, number, number] {
  return ufsViewBox(ufs.filter((u) => u.regiao === regiao), 0.08, 0.3);
}

/**
 * Resolve o nome de um enquadramento de capítulo. `null` = nome desconhecido.
 *
 * A Amazônia Legal existe aqui por necessidade, não por simetria: ela cruza
 * três regiões do IBGE, então `regionViewBox("Norte")` deixa Mato Grosso e
 * Maranhão de fora — e são os dois estados que o capítulo cita nominalmente.
 * A lista sai de `isAmazoniaLegal`, nunca de uma lista de siglas repetida no
 * JSON: duplicar catálogo é como os números da home divergiram do diretório.
 */
export function enquadramentoDe(nome?: string | null): [number, number, number, number] | null {
  if (!nome) return null;
  if (nome === "brasil") return fullViewBox();
  if (nome === "amazonia-legal") return ufsViewBox(ufs.filter(isAmazoniaLegal));
  return REGIOES.includes(nome) ? regionViewBox(nome) : null;
}

/** Enquadramento "mundo": Brasil + vizinhos esmaecidos ao redor. */
export const fullViewBox = (): [number, number, number, number] => [WORLD.x, WORLD.y, WORLD.w, WORLD.h];

const round = (v: number) => Math.round(v * 10) / 10;
