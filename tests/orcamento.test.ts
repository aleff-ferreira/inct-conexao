/**
 * Orçamento de bytes.
 *
 * Por que este arquivo existe: o site tem quatro scripts de build, dez arquivos
 * de teste e nenhum deles falhava quando a página engordava. O relevo chegou a
 * 2.065.194 B — 87% da rota do mapa — e ninguém percebeu, porque não havia nada
 * que percebesse. As fichas de estado desciam inteiras, inclusive na home, pelo
 * mesmo motivo.
 *
 * Cada número abaixo é um TETO negociado, não uma medida. Quando um deles
 * estourar, a pergunta certa não é "aumenta o teto?" — é "o que essa mudança
 * está entregando em troca?". Se a resposta for boa, o teto sobe junto com o
 * commit que a justifica.
 *
 * Roda sobre `dist/`, então exige `npm run build` antes. Sem dist, os testes
 * são pulados: quebrar a suíte de quem só quer rodar `npm test` seria pior que
 * não medir.
 */
import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..");
const DIST = join(RAIZ, "dist", "assets");
const temDist = existsSync(DIST);

/** kB gzip de um arquivo — é o que a rede de fato transfere. */
function gz(caminho: string): number {
  return gzipSync(readFileSync(caminho), { level: 6 }).length;
}

function acharChunk(prefixo: string): string | null {
  if (!temDist) return null;
  const f = readdirSync(DIST).find((n) => n.startsWith(prefixo) && (n.endsWith(".js") || n.endsWith(".css")));
  return f ? join(DIST, f) : null;
}

/* Tetos em bytes gzip. Medidos em 2026-08-04, com folga de ~8%. */
const TETO_GZ: Record<string, number> = {
  "index-": 115_000, // casca da aplicação, presente em toda rota
  "content-": 75_000, // conteúdo do mapa SEM as fichas (elas são chunks à parte)
  "MapaPage-": 24_000, // a página do mapa
};

describe("orçamento · bundles", () => {
  it.runIf(temDist).each(Object.entries(TETO_GZ))("%s cabe no teto", (prefixo, teto) => {
    const p = acharChunk(prefixo);
    expect(p, `chunk ${prefixo}* não encontrado em dist/`).toBeTruthy();
    const n = gz(p!);
    expect(n, `${prefixo}* está com ${n} B gz (teto ${teto})`).toBeLessThanOrEqual(teto);
  });

  it.runIf(temDist)("as fichas de estado não voltaram para dentro do bundle", () => {
    /* Elas somam 135 kB de JSON. Com `import.meta.glob({ eager: true })` isso
       entrava no `content-*.js` e descia até na home. Se o `content` voltar a
       inchar, é sinal de que alguém religou o eager. */
    const p = acharChunk("content-")!;
    expect(gz(p)).toBeLessThan(75_000);
  });
});

describe("orçamento · mídia", () => {
  const MAPAS = join(RAIZ, "public", "assets", "maps");

  it("nenhuma imagem de mapa passa do teto por arquivo", () => {
    /* O relevo em alta resolução é a única exceção declarada: ele só é pedido
       depois que a pessoa aproxima o mapa, e é opt-in por gesto. */
    const TETO = 520_000;
    const EXCECOES: Record<string, number> = { "brasil-relevo-alta.avif": 1_300_000 };

    for (const f of readdirSync(MAPAS)) {
      const n = statSync(join(MAPAS, f)).size;
      const teto = EXCECOES[f] ?? TETO;
      expect(n, `${f} tem ${n} B (teto ${teto})`).toBeLessThanOrEqual(teto);
    }
  });

  it("o relevo entregue por padrão é AVIF, e existe resguardo sem AVIF", () => {
    // Sem o resguardo, Safari < 16.4 ficaria sem relevo nenhum e ninguém saberia.
    expect(existsSync(join(MAPAS, "brasil-relevo.avif"))).toBe(true);
    expect(existsSync(join(MAPAS, "brasil-relevo-fallback.webp"))).toBe(true);
    expect(existsSync(join(MAPAS, "brasil-vizinhos.avif"))).toBe(true);
  });

  it("os arquivos originais de 2 MB não voltaram", () => {
    // `brasil-relevo.webp` tinha 2.065.194 B e não comprimia.
    expect(existsSync(join(MAPAS, "brasil-relevo.webp"))).toBe(false);
    expect(existsSync(join(MAPAS, "brasil-vizinhos.webp"))).toBe(false);
  });
});
