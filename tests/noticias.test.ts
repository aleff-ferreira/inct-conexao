import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseHash, noticiaHref, NOTICIAS_HREF } from "../src/webinars/router";
import type { Bloco, Noticia } from "../src/noticias/types";

const RAIZ = join(__dirname, "..");
const PASTA = join(RAIZ, "src", "content", "noticias");

const arquivos = readdirSync(PASTA).filter((f) => f.endsWith(".json"));
const materias: { arquivo: string; dados: Noticia }[] = arquivos.map((arquivo) => ({
  arquivo,
  dados: JSON.parse(readFileSync(join(PASTA, arquivo), "utf8")) as Noticia,
}));

const TIPOS_VALIDOS = new Set([
  "texto", "subtitulo", "imagem", "galeria", "video", "citacao", "destaque", "etapas", "tabela", "faq",
]);

/* ------------------------------------------------------------------ rotas */
describe("router · rotas de notícias", () => {
  it("#/noticias abre o hub", () => {
    expect(parseHash("#/noticias")).toEqual({ name: "noticias" });
    expect(NOTICIAS_HREF).toBe("#/noticias");
  });

  it("#/noticias/<slug> abre a matéria", () => {
    expect(parseHash("#/noticias/expedicao-resex-rio-ouro-preto")).toEqual({
      name: "noticia",
      slug: "expedicao-resex-rio-ouro-preto",
    });
  });

  it("faz round-trip href → parse", () => {
    for (const { dados } of materias) {
      const rota = parseHash(noticiaHref(dados.slug));
      expect(rota).toEqual({ name: "noticia", slug: dados.slug });
    }
  });

  it("aceita query string sem cair na home (regressão do parseHash)", () => {
    expect(parseHash("#/noticias?x=1").name).toBe("noticias");
  });

  it("decodifica slug com percent-encoding", () => {
    expect(parseHash("#/noticias/a%2Db")).toEqual({ name: "noticia", slug: "a-b" });
  });
});

/* --------------------------------------------------------------- conteúdo */
describe("conteúdo · matérias publicadas", () => {
  it("há pelo menos uma matéria", () => {
    expect(materias.length).toBeGreaterThan(0);
  });

  it("o slug bate com o nome do arquivo e é único", () => {
    const vistos = new Set<string>();
    for (const { arquivo, dados } of materias) {
      expect(dados.slug).toBe(arquivo.replace(/\.json$/, ""));
      expect(dados.slug).toMatch(/^[a-z0-9-]+$/);
      expect(vistos.has(dados.slug)).toBe(false);
      vistos.add(dados.slug);
    }
  });

  it("tem os campos obrigatórios preenchidos", () => {
    for (const { dados } of materias) {
      expect(dados.titulo?.length).toBeGreaterThan(0);
      expect(dados.resumo?.length).toBeGreaterThan(0);
      expect(dados.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(dados.blocos)).toBe(true);
      expect(dados.blocos.length).toBeGreaterThan(0);
    }
  });

  it("todo bloco tem um tipo conhecido", () => {
    for (const { dados } of materias) {
      for (const bloco of dados.blocos) {
        expect(TIPOS_VALIDOS.has(bloco.tipo)).toBe(true);
      }
    }
  });

  it("toda imagem tem texto alternativo (acessibilidade)", () => {
    const semAlt: string[] = [];
    for (const { dados } of materias) {
      if (dados.imagem && !dados.imagem.alt?.trim()) semAlt.push(`${dados.slug}: capa`);
      for (const bloco of dados.blocos) {
        if (bloco.tipo === "imagem" && !bloco.imagem.alt?.trim()) semAlt.push(`${dados.slug}: ${bloco.imagem.arquivo}`);
        if (bloco.tipo === "galeria") {
          for (const im of bloco.imagens) if (!im.alt?.trim()) semAlt.push(`${dados.slug}: ${im.arquivo}`);
        }
      }
    }
    expect(semAlt).toEqual([]);
  });

  it("todo arquivo de imagem citado existe em public/assets/noticias/<slug>/", () => {
    const faltando: string[] = [];
    const checar = (slug: string, arquivo: string) => {
      if (/^(?:https?:)?\/\//i.test(arquivo)) return;
      const caminho = join(RAIZ, "public", "assets", "noticias", slug, arquivo);
      if (!existsSync(caminho)) faltando.push(`${slug}/${arquivo}`);
    };
    for (const { dados } of materias) {
      if (dados.imagem) checar(dados.slug, dados.imagem.arquivo);
      if (dados.seo?.ogImage) checar(dados.slug, dados.seo.ogImage);
      for (const bloco of dados.blocos) {
        if (bloco.tipo === "imagem") checar(dados.slug, bloco.imagem.arquivo);
        if (bloco.tipo === "galeria") for (const im of bloco.imagens) checar(dados.slug, im.arquivo);
      }
    }
    expect(faltando).toEqual([]);
  });

  it("blocos com lista não vêm vazios", () => {
    for (const { dados } of materias) {
      for (const bloco of dados.blocos as Bloco[]) {
        if (bloco.tipo === "destaque") expect(bloco.itens.length).toBeGreaterThan(0);
        if (bloco.tipo === "etapas") expect(bloco.itens.length).toBeGreaterThan(0);
        if (bloco.tipo === "tabela") expect(bloco.linhas.length).toBeGreaterThan(0);
        if (bloco.tipo === "faq") expect(bloco.itens.length).toBeGreaterThan(0);
        if (bloco.tipo === "galeria") {
          expect(bloco.imagens.length).toBeGreaterThanOrEqual(2);
          expect(bloco.imagens.length).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it("todo vídeo tem descrição acessível, capa e arquivo existente", () => {
    const problemas: string[] = [];
    for (const { dados } of materias) {
      for (const bloco of dados.blocos as Bloco[]) {
        if (bloco.tipo !== "video") continue;
        if (!bloco.descricao?.trim()) problemas.push(`${dados.slug}: ${bloco.arquivo} sem descrição`);
        if (!bloco.arquivo.endsWith(".mp4")) problemas.push(`${dados.slug}: ${bloco.arquivo} não é .mp4`);
        for (const arq of [bloco.arquivo, bloco.poster].filter(Boolean) as string[]) {
          const caminho = join(RAIZ, "public", "assets", "noticias", dados.slug, arq);
          if (!existsSync(caminho)) problemas.push(`${dados.slug}/${arq} não existe`);
        }
      }
    }
    expect(problemas).toEqual([]);
  });

  it("a imagem de compartilhamento continua em .jpg (robôs de redes sociais)", () => {
    for (const { dados } of materias) {
      if (dados.seo?.ogImage) expect(dados.seo.ogImage).toMatch(/\.jpe?g$/i);
    }
  });
});

/* ------------------------------------------------------------- REDUNDÂNCIA */
/** Camadas de uma matéria (título, linha-fina, box, corpo, FAQ) devem dizer
 *  cada fato UMA vez, com palavras próprias. Repetir os mesmos trechos entre
 *  camadas é o defeito que faz o texto soar automático. */
function camadasDe(n: Noticia): { nome: string; texto: string }[] {
  const out = [
    { nome: "titulo", texto: n.titulo },
    { nome: "linha-fina", texto: n.resumo },
  ];
  n.blocos.forEach((b, i) => {
    if (b.tipo === "texto") out.push({ nome: `texto[${i}]`, texto: b.texto });
    else if (b.tipo === "destaque") b.itens.forEach((it, j) => out.push({ nome: `box[${j}]`, texto: it }));
    else if (b.tipo === "faq") b.itens.forEach((it, j) => out.push({ nome: `faq[${j}]`, texto: it.resposta }));
    else if (b.tipo === "etapas") b.itens.forEach((it, j) => out.push({ nome: `etapa[${j}]`, texto: it.texto }));
  });
  return out.filter((c) => (c.texto ?? "").trim().length > 0);
}

/** Normaliza e devolve os n-gramas de `n` palavras. */
function ngramas(texto: string, n: number): Set<string> {
  const palavras = texto
    .toLowerCase()
    .replace(/[*_]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const s = new Set<string>();
  for (let i = 0; i + n <= palavras.length; i++) s.add(palavras.slice(i, i + n).join(" "));
  return s;
}

/** Nomes próprios longos podem repetir legitimamente (o da reserva, por exemplo). */
const REPETICAO_PERMITIDA = [
  "reserva extrativista do rio ouro preto",
  "ii expedicao cientifica resex rio ouro preto",
  "guajara mirim e nova mamore em rondonia",
];

describe("redação · cada fato dito uma vez", () => {
  it("nenhuma camada repete uma frase dentro de si mesma", () => {
    const achados: string[] = [];
    for (const { dados } of materias) {
      for (const c of camadasDe(dados)) {
        const frases = c.texto
          .split(/(?<=[.!?])\s+/)
          .map((f) => f.trim().toLowerCase().replace(/[*_"“”]/g, ""))
          .filter((f) => f.split(/\s+/).length >= 5); // ignora frases muito curtas
        const vistas = new Set<string>();
        for (const f of frases) {
          if (vistas.has(f)) achados.push(`${dados.slug} [${c.nome}] frase repetida: "${f.slice(0, 60)}…"`);
          vistas.add(f);
        }
      }
    }
    expect(achados).toEqual([]);
  });

  it("nenhum trecho de 6+ palavras se repete entre camadas da mesma matéria", () => {
    const achados: string[] = [];
    for (const { dados } of materias) {
      const camadas = camadasDe(dados);
      for (let a = 0; a < camadas.length; a++) {
        for (let b = a + 1; b < camadas.length; b++) {
          const comuns = [...ngramas(camadas[a].texto, 6)].filter((g) => ngramas(camadas[b].texto, 6).has(g));
          for (const g of comuns) {
            if (REPETICAO_PERMITIDA.some((p) => p.includes(g) || g.includes(p))) continue;
            achados.push(`${dados.slug} [${camadas[a].nome} x ${camadas[b].nome}]: "${g}"`);
          }
        }
      }
    }
    expect(achados).toEqual([]);
  });
});
