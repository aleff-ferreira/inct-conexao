/**
 * Carrega as matérias de `src/content/noticias/*.json` no momento do build
 * (Vite `import.meta.glob`, mesmo padrão dos webinars) e expõe helpers de
 * ordenação/busca. Para publicar uma nova matéria basta acrescentar um JSON
 * nessa pasta — pelo painel (/admin) ou à mão. Nenhum código muda.
 */
import type { Bloco, Noticia } from "./types";

const BASE = import.meta.env.BASE_URL;

/** Caminho de uma imagem da matéria (/public/assets/noticias/<slug>/<arquivo>). */
export const noticiaAsset = (slug: string, arquivo: string): string =>
  /^(?:https?:)?\/\//i.test(arquivo) ? arquivo : `${BASE}assets/noticias/${slug}/${arquivo}`;

const arquivos = import.meta.glob<{ default: Noticia }>("../content/noticias/*.json", { eager: true });

function normalizar(raw: Noticia): Noticia {
  return {
    ...raw,
    chapeu: raw.chapeu?.trim() || undefined,
    blocos: Array.isArray(raw.blocos) ? raw.blocos : [],
    numeros: raw.numeros ?? [],
    equipe: raw.equipe ?? [],
    fontes: raw.fontes ?? [],
    tags: raw.tags ?? [],
    publicado: raw.publicado !== false,
  };
}

/** Matérias publicadas, da mais recente para a mais antiga. */
export const noticias: Noticia[] = Object.values(arquivos)
  .map((mod) => normalizar(mod.default))
  .filter((n) => n.publicado !== false)
  .sort((a, b) => b.data.localeCompare(a.data));

// Guarda de desenvolvimento: slugs duplicados quebram os links.
if (import.meta.env.DEV) {
  const slugs = noticias.map((n) => n.slug);
  const dup = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
  if (dup.length) console.error(`[noticias] slugs duplicados: ${dup.join(", ")}`);
}

export function noticiaBySlug(slug: string): Noticia | undefined {
  return noticias.find((n) => n.slug === slug);
}

/** As N matérias mais recentes (para a home e para "leia também"). */
export function noticiasRecentes(n = 3, exceto?: string): Noticia[] {
  return noticias.filter((x) => x.slug !== exceto).slice(0, n);
}

/* ------------------------------------------------------------------ */
/*  Derivados                                                          */
/* ------------------------------------------------------------------ */

/** Todo o texto legível de um bloco (para contagem de palavras e busca). */
export function textoDoBloco(b: Bloco): string {
  switch (b.tipo) {
    case "texto":
    case "subtitulo":
      return b.texto;
    case "imagem":
    case "galeria":
      return b.legenda ?? "";
    case "citacao":
      return `${b.texto} ${b.autor ?? ""}`;
    case "destaque":
      return `${b.titulo ?? ""} ${b.itens.join(" ")}`;
    case "etapas":
      return `${b.titulo ?? ""} ${b.itens.map((i) => `${i.titulo} ${i.texto}`).join(" ")}`;
    case "tabela":
      return `${b.titulo ?? ""} ${b.linhas.map((l) => `${l.rotulo} ${l.valor}`).join(" ")}`;
    case "faq":
      return `${b.titulo ?? ""} ${b.itens.map((i) => `${i.pergunta} ${i.resposta}`).join(" ")}`;
    default:
      return "";
  }
}

/** Tempo de leitura em minutos (200 palavras/min, mínimo 1). */
export function tempoDeLeitura(n: Noticia): number {
  const palavras = n.blocos.map(textoDoBloco).join(" ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}

/** Data por extenso em pt-BR (ex.: "19 de julho de 2026"). */
export function formatarData(iso: string): string {
  // Constrói em UTC para não deslocar o dia por causa do fuso do visitante.
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return iso;
  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Primeira imagem da matéria (capa das listagens), se houver. */
export function capaDe(n: Noticia): { src: string; alt: string } | undefined {
  if (n.imagem) return { src: noticiaAsset(n.slug, n.imagem.arquivo), alt: n.imagem.alt };
  for (const b of n.blocos) {
    if (b.tipo === "imagem") return { src: noticiaAsset(n.slug, b.imagem.arquivo), alt: b.imagem.alt };
    if (b.tipo === "galeria" && b.imagens[0]) return { src: noticiaAsset(n.slug, b.imagens[0].arquivo), alt: b.imagens[0].alt };
  }
  return undefined;
}
