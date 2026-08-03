/**
 * Gera a camada estática das figuras: um SVG por figura e um índice navegável.
 *
 * POR QUE
 *     O site é SPA com roteamento por hash. A hash nunca chega ao servidor, e
 *     por isso o fallback por figura do Our World in Data — em que cada gráfico
 *     tem seu próprio URL servido pelo servidor — é impossível aqui. Fingir o
 *     contrário seria pior que assumir.
 *
 *     A resposta honesta é esta pasta: arquivos reais, servidos pelo servidor,
 *     que existem independentemente de JavaScript, de React e de rota. Quem tem
 *     JS desligado chega por um `<noscript>`; quem tem JS ligado recebe o mesmo
 *     SVG como primeira pintura, antes de qualquer interatividade montar.
 *
 * COMO
 *     Sem `tsx` e sem `vite-node` no projeto. Em vez de acrescentar dependência,
 *     usa-se a API Node do próprio Vite: `ssrLoadModule` transpila o TypeScript
 *     com a mesma config do site, então o que roda aqui é exatamente o que roda
 *     no navegador.
 *
 *     Saída em `public/`, e não como segunda entrada do Vite, de propósito: o
 *     Vite copia `public/` literalmente. Entrada de build passaria pelo bundler
 *     e poderia ganhar um `<script>` — justamente o que o fallback não pode ter.
 *
 * USO
 *     node scripts/build-figuras.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const DESTINO = join(RAIZ, "public", "figuras");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function tabelaHtml(fig, linhas) {
  const th = fig.colunas.map((c) => `<th scope="col" title="${esc(c.definicao)}">${esc(c.rotulo)}</th>`).join("");
  const tr = linhas
    .map((l) => `<tr>${fig.colunas.map((c) => `<td>${esc(l[c.chave] ?? "")}</td>`).join("")}</tr>`)
    .join("\n      ");
  return `<table>
    <caption>${esc(fig.titulo)} — ${esc(fig.subtitulo)}</caption>
    <thead><tr>${th}</tr></thead>
    <tbody>
      ${tr}
    </tbody>
  </table>`;
}

const ESTILO = `
    :root { color-scheme: light dark; }
    body { margin: 0 auto; padding: 32px 20px 64px; max-width: 860px;
           font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    h1 { font-size: 1.5rem; margin: 0 0 4px; }
    h2 { font-size: 1.2rem; margin: 40px 0 4px; }
    .sub { color: #4b6478; margin: 0 0 18px; }
    figure { margin: 0 0 12px; }
    img { max-width: 100%; height: auto; border: 1px solid #dde4ea; border-radius: 8px; background: #fff; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; margin-top: 12px; }
    caption { text-align: left; color: #4b6478; padding-bottom: 8px; font-size: 0.85rem; }
    th, td { border: 1px solid #dde4ea; padding: 5px 9px; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    th { background: #f3f6f9; }
    .fonte { font-size: 0.85rem; color: #4b6478; margin: 8px 0 0; }
    details { margin-top: 10px; }
    @media (prefers-color-scheme: dark) {
      body { background: #10171d; color: #e6edf3; }
      .sub, .fonte, caption { color: #9fb2c0; }
      th { background: #1a242d; }
      th, td { border-color: #2b3946; }
    }`;

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });
try {
  const { FIGURAS } = await server.ssrLoadModule("/src/figuras/registro.ts");
  const { csvDaFigura } = await server.ssrLoadModule("/src/figuras/csv.ts");

  mkdirSync(DESTINO, { recursive: true });
  const secoes = [];

  for (const fig of FIGURAS) {
    const linhas = fig.linhas();

    /* Três variantes, uma função só:
       <id>.svg          carimbado, para viajar sozinho (página estática, slide)
       <id>-embed.svg    sem carimbo, para dentro da página (o HTML já tem o título)
       <id>-embed-sm.svg idem, caixa estreita, para o rótulo do eixo sobreviver
                         no celular */
    const svg = fig.desenhar(linhas, fig.caixa, true);
    const embed = fig.desenhar(linhas, fig.caixa, false);
    const embedSm = fig.desenhar(linhas, fig.caixaMobile, false);
    writeFileSync(join(DESTINO, `${fig.id}.svg`), svg + "\n", "utf-8");
    writeFileSync(join(DESTINO, `${fig.id}-embed.svg`), embed + "\n", "utf-8");
    writeFileSync(join(DESTINO, `${fig.id}-embed-sm.svg`), embedSm + "\n", "utf-8");
    writeFileSync(join(DESTINO, `${fig.id}.csv`), csvDaFigura(fig), "utf-8");

    /* Esta página já traz título e subtítulo em HTML, então usa as variantes SEM
       carimbo — o arquivo carimbado fica como download, para quem vai levá-lo
       para fora daqui. width/height explícitos reservam o espaço e mantêm o CLS
       em zero; o <picture> troca pela caixa estreita no celular. */
    secoes.push(`  <section id="${esc(fig.id)}">
    <h2>${esc(fig.titulo)}</h2>
    <p class="sub">${esc(fig.subtitulo)}</p>
    <figure>
      <picture>
        <source media="(max-width: 700px)" srcset="./${esc(fig.id)}-embed-sm.svg"
                width="${fig.caixaMobile.largura}" height="${fig.caixaMobile.altura}">
        <img src="./${esc(fig.id)}-embed.svg" width="${fig.caixa.largura}" height="${fig.caixa.altura}"
             alt="${esc(fig.titulo)}. ${esc(fig.subtitulo)}. Os valores estão na tabela abaixo.">
      </picture>
    </figure>
    <p class="fonte">Fonte: ${esc(fig.fonte.titulo)} — ${esc(fig.fonte.publicador)} (${esc(fig.fonte.ano)}).
      <a href="${esc(fig.fonte.url)}">Origem</a> · ${esc(fig.fonte.licenca)} ·
      <a href="./${esc(fig.id)}.csv" download>Baixar CSV</a> ·
      <a href="./${esc(fig.id)}.svg" download>Baixar imagem</a></p>
    ${fig.fonte.nota ? `<details><summary>Como ler este número</summary><p class="fonte">${esc(fig.fonte.nota)}</p></details>` : ""}
    ${tabelaHtml(fig, linhas)}
  </section>`);
    console.log(`  ${fig.id}: ${(svg.length / 1024).toFixed(1)} kB de SVG, ${linhas.length} linhas`);
  }

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Figuras · INCT-CONEXAO</title>
  <meta name="description" content="Gráficos do INCT-CONEXAO em versão estática, com os dados em tabela e em CSV.">
  <style>${ESTILO}
  </style>
</head>
<body>
  <h1>Figuras</h1>
  <p class="sub">Versão estática dos gráficos do INCT-CONEXAO. Cada figura traz a fonte, os dados em
    tabela e o CSV. Esta página funciona sem JavaScript.
    <a href="../">Voltar ao site</a>.</p>
${secoes.join("\n\n")}
</body>
</html>
`;
  writeFileSync(join(DESTINO, "index.html"), html, "utf-8");
  console.log(`\npublic/figuras/ — ${FIGURAS.length} figuras, índice com ${(html.length / 1024).toFixed(1)} kB`);
} finally {
  await server.close();
}
