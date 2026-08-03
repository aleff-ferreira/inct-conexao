#!/usr/bin/env node
/**
 * build-geodata.mjs — gera o artefato geográfico oficial do Mapa Interativo.
 *
 * Fonte: API de Malhas Territoriais v3 do IBGE (limites oficiais, sem traçado manual).
 *   https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=<Q>&intrarregiao=UF
 * Metadados: API de Localidades v1 do IBGE (nomes, siglas, regiões).
 *
 * Saída: src/mapa/geo/br-uf.json — 27 UFs projetadas (Mercator esférico) para um
 * viewBox fixo, com path SVG pré-computado, centroide, bbox e metadados de origem.
 * O artefato é VERSIONADO no repositório: o build do site nunca depende do IBGE
 * estar no ar. Para atualizar os limites, rode:  node scripts/build-geodata.mjs
 *
 * Zero dependências (Node >= 18).
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUALIDADE = process.env.GEO_QUALIDADE || "intermediaria"; // minima | intermediaria | maxima
const MALHA_URL = `https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=${QUALIDADE}&intrarregiao=UF`;
const META_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome";
const OUT = resolve(ROOT, "src/mapa/geo/br-uf.json");

// Amazônia Legal (Lei Complementar nº 124/2007): 8 estados integrais + Maranhão
// a oeste do meridiano 44°O (parcial).
const AMAZONIA_LEGAL = { AC: "integral", AP: "integral", AM: "integral", MT: "integral", PA: "integral", RO: "integral", RR: "integral", TO: "integral", MA: "parcial" };

const VIEW_W = 1000; // viewBox width; height derived from aspect

async function fetchJson(url, localFallback) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (localFallback && existsSync(localFallback)) {
      console.warn(`aviso: falha ao baixar ${url} (${err.message}); usando cópia local ${localFallback}`);
      return JSON.parse(readFileSync(localFallback, "utf8"));
    }
    throw err;
  }
}

// ---- Mercator esférico (Web Mercator, EPSG:3857 sem escala real) ----
const D2R = Math.PI / 180;
const mercX = (lon) => lon * D2R;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));

function eachCoord(geom, fn) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) for (const ring of poly) for (const pt of ring) fn(pt);
}

function main() {
  return (async () => {
    console.log(`baixando malha UF (qualidade=${QUALIDADE})…`);
    const malha = await fetchJson(MALHA_URL, resolve(ROOT, "tmp/br-uf-inter.geojson"));
    console.log("baixando metadados de estados…");
    const estados = await fetchJson(META_URL, resolve(ROOT, "tmp/estados-meta.json"));

    if (malha.features?.length !== 27) throw new Error(`esperava 27 UFs, recebi ${malha.features?.length}`);
    const metaByCod = new Map(estados.map((e) => [String(e.id), e]));

    // 1) bounds globais em coordenadas Mercator
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const f of malha.features) {
      eachCoord(f.geometry, ([lon, lat]) => {
        const x = mercX(lon), y = mercY(lat);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      });
    }
    const scale = VIEW_W / (maxX - minX);
    const viewH = Math.ceil((maxY - minY) * scale);
    const px = (lon) => (mercX(lon) - minX) * scale;
    const py = (lat) => (maxY - mercY(lat)) * scale; // y invertido (SVG cresce p/ baixo)

    const round = (v) => Math.round(v * 10) / 10;

    // 2) projeta cada UF
    const ufs = [];
    for (const f of malha.features) {
      const cod = String(f.properties.codarea);
      const meta = metaByCod.get(cod);
      if (!meta) throw new Error(`UF sem metadado: codarea=${cod}`);

      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      let d = "";
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      // centroide da maior área (fórmula do polígono, sobre o anel externo maior)
      let bestArea = -Infinity, cx = 0, cy = 0;

      for (const poly of polys) {
        for (let r = 0; r < poly.length; r++) {
          const ring = poly[r];
          const pts = ring.map(([lon, lat]) => [px(lon), py(lat)]);
          // path
          d += `M${round(pts[0][0])} ${round(pts[0][1])}`;
          for (let i = 1; i < pts.length - 1; i++) d += `L${round(pts[i][0])} ${round(pts[i][1])}`;
          d += "Z";
          // bbox
          for (const [x, y] of pts) {
            if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
            if (y < by0) by0 = y; if (y > by1) by1 = y;
          }
          // centroide só do anel externo (r === 0)
          if (r === 0) {
            let a = 0, sx = 0, sy = 0;
            for (let i = 0; i < pts.length - 1; i++) {
              const cross = pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
              a += cross;
              sx += (pts[i][0] + pts[i + 1][0]) * cross;
              sy += (pts[i][1] + pts[i + 1][1]) * cross;
            }
            a /= 2;
            if (Math.abs(a) > bestArea) {
              bestArea = Math.abs(a);
              cx = sx / (6 * a);
              cy = sy / (6 * a);
            }
          }
        }
      }

      ufs.push({
        sigla: meta.sigla,
        nome: meta.nome,
        codigoIbge: Number(cod),
        regiao: meta.regiao.nome,
        regiaoSigla: meta.regiao.sigla,
        amazoniaLegal: AMAZONIA_LEGAL[meta.sigla] ?? null,
        path: d,
        centroid: [round(cx), round(cy)],
        bbox: [round(bx0), round(by0), round(bx1), round(by1)],
      });
    }

    ufs.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const artifact = {
      meta: {
        fonte: "IBGE: API de Malhas Territoriais v3 (limites oficiais) + API de Localidades v1",
        urlMalha: MALHA_URL,
        urlMetadados: META_URL,
        qualidade: QUALIDADE,
        projecao: "Mercator esférico, ajustado ao viewBox",
        viewBox: `0 0 ${VIEW_W} ${viewH}`,
        geradoEm: new Date().toISOString().slice(0, 10),
        licenca: "Dados públicos do IBGE (acesso livre); exibir atribuição 'IBGE' na interface.",
        amazoniaLegalBase: "Lei Complementar nº 124/2007 (MA: parcial, a oeste do meridiano 44°O)",
      },
      ufs,
    };

    // 3) validações
    if (ufs.length !== 27) throw new Error(`artefato com ${ufs.length} UFs (esperava 27)`);
    for (const u of ufs) {
      if (!u.path.startsWith("M") || !u.path.endsWith("Z")) throw new Error(`path inválido: ${u.sigla}`);
      if (!u.sigla || !u.nome || !u.regiao) throw new Error(`metadado incompleto: ${JSON.stringify(u).slice(0, 80)}`);
    }
    const legal = ufs.filter((u) => u.amazoniaLegal).map((u) => u.sigla).sort();
    console.log("Amazônia Legal:", legal.join(", "));

    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(artifact));
    const kb = (JSON.stringify(artifact).length / 1024).toFixed(1);
    console.log(`ok: ${OUT} (${ufs.length} UFs, ${kb} kB, viewBox 0 0 ${VIEW_W} ${viewH})`);
  })();
}

main().catch((err) => { console.error("ERRO:", err.message); process.exit(1); });
