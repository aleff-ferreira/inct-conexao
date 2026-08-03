/**
 * Desenho de figura: SVG como string, sem DOM e sem React.
 *
 * Por que string pura, e não JSX: este mesmo código precisa rodar em dois
 * lugares muito diferentes. No build, em Node, para gravar `public/figuras/<id>.svg`,
 * que é o que a pessoa com JavaScript desligado vai ver. E no navegador, para a
 * primeira pintura, antes de qualquer interatividade montar.
 *
 * Se fossem dois desenhos, um dia eles divergiriam, e o leitor sem JS receberia
 * silenciosamente um gráfico diferente do que todo mundo vê. Sendo a mesma
 * função, isso é impossível por construção.
 *
 * SVG e não PNG: 3 a 12 kB contra ~70 kB, e nítido em qualquer densidade de
 * tela. Como no OWID, fonte, ano e licença vão DENTRO do arquivo — a imagem
 * viaja sozinha, e sem o carimbo ela vira gráfico sem procedência.
 */
import type { Caixa } from "./tipos";

/** Escapa texto para dentro de XML. Sem isso um `&` na fonte quebra o SVG. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type Serie = {
  rotulo: string;
  cor: string;
  pontos: Array<{ x: number; y: number }>;
  /** Traço interrompido, para projeção ou série parcial. */
  tracejada?: boolean;
};

export type OpcoesLinha = {
  titulo: string;
  subtitulo: string;
  /** Linha de crédito impressa no rodapé do SVG. */
  credito: string;
  series: Serie[];
  formatarY?: (n: number) => string;
  formatarX?: (n: number) => string;
  /** Anotações em pontos específicos ("2004: pico da série"). */
  notas?: Array<{ x: number; y: number; texto: string }>;
  /**
   * Escreve título, subtítulo e crédito DENTRO do SVG. Padrão: sim.
   *
   * Verdadeiro para o arquivo que viaja sozinho — o da página estática, o do
   * botão de baixar, o que alguém cola num slide. Falso para o que é embutido
   * na página, onde o `<figcaption>` em HTML já diz a mesma coisa logo acima e
   * repetir apareceria como título duplicado na tela.
   */
  carimbo?: boolean;
};

/**
 * Margens do desenho, em unidades do viewBox.
 *
 * São constantes, e a tipografia também. A caixa de cada figura é escolhida
 * PRÓXIMA da largura em que ela vai ser renderizada, e é isso que mantém o
 * texto legível: num viewBox de largura L exibido com largura W, um texto de
 * tamanho s aparece com s*W/L, então s só fica estável enquanto L ≈ W.
 *
 * É por isso que existe uma variante estreita de cada figura para o celular,
 * gerada pela MESMA função com outra caixa, e não um SVG só espremido — espremer
 * levaria o rótulo do eixo a menos de 5px reais num telefone.
 */
const MARGEM_BASE = { topo: 76, direita: 20, baixo: 62, esquerda: 62 };

/**
 * Margens efetivas. Sem carimbo (título e subtítulo dentro do SVG) a margem de
 * cima encolhe e sobra área de gráfico: é o caso do SVG embutido na página, que
 * já tem `<figcaption>` em HTML acima dele. Repetir o título nos dois lugares
 * era duplicação visível na tela.
 */
const margens = (_caixa: Caixa, carimbo: boolean) => ({
  ...MARGEM_BASE,
  topo: carimbo ? MARGEM_BASE.topo : 22,
});

/**
 * Escolhe um teto "redondo" e os cortes do eixo.
 *
 * Deixar o topo do eixo no valor máximo exato dos dados produz rótulos como
 * "281.827", que ninguém lê. Arredondar para cima na potência de 10 mais
 * próxima, com passos de 1, 2 ou 5, dá "300.000" — que é o número que a pessoa
 * consegue guardar enquanto olha a linha.
 */
export function escala(max: number, alvoCortes = 5): { teto: number; cortes: number[] } {
  if (max <= 0) return { teto: 1, cortes: [0, 1] };
  const bruto = max / alvoCortes;
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? 10 * potencia;
  const teto = Math.ceil(max / passo) * passo;
  const cortes: number[] = [];
  for (let v = 0; v <= teto + passo / 2; v += passo) cortes.push(Math.round(v));
  return { teto, cortes };
}

/** Caminho `d` de uma polilinha. */
function caminho(pontos: Array<{ px: number; py: number }>): string {
  return pontos.map((p, i) => `${i ? "L" : "M"}${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(" ");
}

export type Geometria = {
  /** Dado → coordenada do viewBox. */
  px: (x: number) => number;
  py: (y: number) => number;
  /** Coordenada do viewBox → o valor de x mais próximo que existe na série. */
  xMaisProximo: (px: number) => number;
  /** Retângulo útil do gráfico, em coordenadas do viewBox. */
  area: { x0: number; y0: number; x1: number; y1: number };
  teto: number;
  cortes: number[];
  valoresX: number[];
};

/**
 * A geometria do gráfico, isolada do desenho.
 *
 * Existe para que a camada interativa (mira, tooltip, foco de teclado) use
 * EXATAMENTE o mesmo mapeamento do SVG estático. Se cada uma calculasse o seu,
 * a mira apontaria para um ponto e o traço estaria em outro — e a divergência
 * apareceria só em telas de tamanho incomum, que é onde ninguém testa.
 */
export function geometria(series: Serie[], caixa: Caixa, carimbo = true): Geometria {
  const m = margens(caixa, carimbo);
  const x0 = m.esquerda;
  const x1 = caixa.largura - m.direita;
  const y0 = m.topo;
  const y1 = caixa.altura - m.baixo;

  const todosX = series.flatMap((s) => s.pontos.map((p) => p.x));
  const todosY = series.flatMap((s) => s.pontos.map((p) => p.y));
  const minX = Math.min(...todosX);
  const maxX = Math.max(...todosX);
  const { teto, cortes } = escala(Math.max(...todosY));
  const valoresX = Array.from(new Set(todosX)).sort((a, b) => a - b);

  const px = (x: number) => x0 + ((x - minX) / Math.max(1, maxX - minX)) * (x1 - x0);
  const py = (y: number) => y1 - (y / teto) * (y1 - y0);

  return {
    px,
    py,
    area: { x0, y0, x1, y1 },
    teto,
    cortes,
    valoresX,
    xMaisProximo: (alvo) =>
      valoresX.reduce((melhor, v) => (Math.abs(px(v) - alvo) < Math.abs(px(melhor) - alvo) ? v : melhor), valoresX[0]),
  };
}

/**
 * Gráfico de linha completo, pronto para gravar em arquivo ou injetar na página.
 *
 * As cores vêm por parâmetro (do tema do site) em vez de `currentColor` porque
 * o arquivo `.svg` aberto direto no navegador não herda CSS nenhum — e é
 * exatamente esse o caso do leitor sem JavaScript.
 */
export function desenharLinhas(o: OpcoesLinha, caixa: Caixa): string {
  const { largura, altura } = caixa;
  const carimbo = o.carimbo !== false;
  const g = geometria(o.series, caixa, carimbo);
  const { x0, x1, y1 } = g.area;
  const { px, py, cortes } = g;

  const fmtY = o.formatarY ?? ((n: number) => n.toLocaleString("pt-BR"));
  const fmtX = o.formatarX ?? String;

  const p: string[] = [];
  p.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-labelledby="t-titulo t-desc" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">`,
  );
  p.push(`<title id="t-titulo">${esc(o.titulo)}</title>`);
  p.push(`<desc id="t-desc">${esc(o.subtitulo)} ${esc(o.credito)}</desc>`);
  p.push(`<rect width="${largura}" height="${altura}" fill="#ffffff"/>`);

  if (carimbo) {
    p.push(`<text x="20" y="30" font-size="19" font-weight="700" fill="#0f2b46">${esc(o.titulo)}</text>`);
    p.push(`<text x="20" y="52" font-size="13" fill="#4b6478">${esc(o.subtitulo)}</text>`);
  }

  // Grade e eixo Y. Grade antes das linhas, para nunca cobrir o dado.
  for (const c of cortes) {
    const y = py(c);
    p.push(`<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x1}" y2="${y.toFixed(1)}" stroke="#e3e9ee" stroke-width="1"/>`);
    p.push(`<text x="${x0 - 9}" y="${(y + 4).toFixed(1)}" font-size="11" fill="#6b7f90" text-anchor="end">${esc(fmtY(c))}</text>`);
  }

  // Eixo X: no máximo 8 rótulos, senão viram uma tarja preta ilegível.
  const anos = g.valoresX;
  const salto = Math.max(1, Math.ceil(anos.length / 8));
  anos.forEach((x, i) => {
    if (i % salto && i !== anos.length - 1) return;
    p.push(`<text x="${px(x).toFixed(1)}" y="${y1 + 20}" font-size="11" fill="#6b7f90" text-anchor="middle">${esc(fmtX(x))}</text>`);
  });
  p.push(`<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="#9fb2c0" stroke-width="1"/>`);

  for (const s of o.series) {
    const pts = s.pontos.map((pt) => ({ px: px(pt.x), py: py(pt.y) }));
    p.push(
      `<path d="${caminho(pts)}" fill="none" stroke="${esc(s.cor)}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"${s.tracejada ? ' stroke-dasharray="6 4"' : ""}/>`,
    );
  }

  for (const n of o.notas ?? []) {
    const cx = px(n.x);
    const cy = py(n.y);
    const paraEsquerda = cx > (x0 + x1) / 2;
    p.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="#0f2b46"/>`);
    p.push(
      `<text x="${(cx + (paraEsquerda ? -10 : 10)).toFixed(1)}" y="${(cy - 12).toFixed(1)}" font-size="11.5" font-weight="600" fill="#0f2b46" text-anchor="${paraEsquerda ? "end" : "start"}">${esc(n.texto)}</text>`,
    );
  }

  // A legenda é do dado e fica sempre. O crédito só entra no arquivo que viaja
  // sozinho: embutido, a linha de fonte já está em HTML no rodapé da figura.
  if (o.series.length > 1) {
    let lx = x0;
    for (const s of o.series) {
      p.push(`<rect x="${lx}" y="${altura - 30}" width="11" height="11" rx="2" fill="${esc(s.cor)}"/>`);
      p.push(`<text x="${lx + 16}" y="${altura - 20}" font-size="11.5" fill="#4b6478">${esc(s.rotulo)}</text>`);
      lx += 22 + s.rotulo.length * 6.6;
    }
  } else if (carimbo) {
    p.push(`<text x="${x0}" y="${altura - 20}" font-size="10.5" fill="#8296a6">${esc(o.credito)}</text>`);
  }

  p.push("</svg>");
  return p.join("\n");
}
