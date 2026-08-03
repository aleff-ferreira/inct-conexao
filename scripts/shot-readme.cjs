/**
 * Capturas do site para o README do repositório.
 *
 * Uso:  node scripts/shot-readme.cjs
 * Requer o preview rodando em http://localhost:4173 (npm run preview).
 *
 * As imagens vão para docs/img/ e são referenciadas pelo README. São geradas,
 * não desenhadas: se o site mudar, roda de novo e elas acompanham — README com
 * captura de uma versão que não existe mais é pior do que README sem imagem.
 *
 * Se o Chromium não abrir por falta de biblioteca do sistema, instale:
 *   sudo apt-get install -y libnspr4 libnss3 libasound2t64
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.BASE_URL || "http://localhost:4173";
const SAIDA = path.join(__dirname, "..", "docs", "img");

/** Cada quadro: rota, arquivo, e o que precisa acontecer antes de fotografar. */
const QUADROS = [
  {
    nome: "home.png",
    hash: "#/",
    largura: 1440,
    altura: 900,
    espera: 2600,
    legenda: "Home",
  },
  {
    nome: "mapa-narrativa.png",
    hash: "#/mapa?modo=narrativa",
    largura: 1440,
    altura: 900,
    espera: 3000,
    // Rola até a história para o mapa aparecer já grudado, que é o ponto.
    antes: async (p) => {
      await p.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
      await p.waitForTimeout(900);
    },
    legenda: "Modo narrativa do observatório territorial",
  },
  {
    nome: "mapa-explorador.png",
    hash: "#/mapa?modo=explorador&camada=vagas-ic-2026",
    largura: 1440,
    altura: 900,
    espera: 3200,
    legenda: "Explorador, com camada temática ativa",
  },
  {
    nome: "figuras.png",
    hash: "#/mapa",
    largura: 1440,
    altura: 900,
    espera: 2600,
    antes: async (p) => {
      // Leva a seção de séries temporais para o enquadramento.
      await p.evaluate(() => document.querySelector("#map-series-titulo")?.scrollIntoView());
      // O SVG é lazy: força o carregamento, senão a foto sai com o espaço vazio.
      await p.evaluate(() => document.querySelectorAll(".figura-svg").forEach((i) => i.setAttribute("loading", "eager")));
      await p.waitForTimeout(1500);
    },
    legenda: "Figuras citáveis, com fonte, licença e CSV",
  },
  {
    nome: "resultado-ic.png",
    hash: "#/editais/selecao-ic-2026/resultado",
    largura: 1440,
    altura: 900,
    espera: 2400,
    legenda: "Resultado de processo seletivo, consultável por nome",
  },
  {
    nome: "mapa-celular.png",
    hash: "#/mapa?modo=narrativa",
    largura: 390,
    altura: 844,
    espera: 3000,
    antes: async (p) => {
      await p.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
      await p.waitForTimeout(900);
    },
    legenda: "O mesmo mapa no celular",
  },
];

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const nav = await chromium.launch();
  console.log("capturando de %s\n", BASE);

  for (const q of QUADROS) {
    const pag = await nav.newPage({
      viewport: { width: q.largura, height: q.altura },
      deviceScaleFactor: 2, // telas densas: a imagem fica nítida no GitHub
    });
    await pag.goto(BASE + "/" + q.hash, { waitUntil: "networkidle" });
    await pag.waitForTimeout(q.espera);
    if (q.antes) await q.antes(pag);

    const destino = path.join(SAIDA, q.nome);
    await pag.screenshot({ path: destino });
    const kb = fs.statSync(destino).size / 1024;
    console.log("  %-22s %6.0f kB  %s", q.nome, kb, q.legenda);
    await pag.close();
  }

  await nav.close();
  console.log("\nimagens em docs/img/");
})();
