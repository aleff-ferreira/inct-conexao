/**
 * ============================================================================
 *  Carregamento do conteúdo editorial do mapa (JSON por estado)
 * ============================================================================
 *  Um arquivo por estado em `src/content/mapa/estados/<uf>.json`, editável no
 *  painel Sveltia (/admin) ou à mão. Carregado no build via import.meta.glob
 *  (mesmo padrão de webinars/data.ts). Zero fetch em runtime.
 *
 *  Capítulos do modo narrativo: `src/content/mapa/narrativa/*.json`.
 * ============================================================================
 */
import type { Capitulo, EstadoConteudo, ResumoNotificacoes } from "./types";

const BASE = import.meta.env.BASE_URL;

/** Caminho de uma imagem em /public/assets. Aceita nome nu ou com prefixos. */
export function mapaAsset(file?: string): string | undefined {
  const s = file?.trim();
  if (!s) return undefined;
  if (/^(?:https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
  const bare = s.replace(/^\.?\/?(?:public\/)?assets\//i, "").replace(/^\.?\//, "");
  return `${BASE}assets/${bare}`;
}

const estadoFiles = import.meta.glob<{ default: EstadoConteudo }>("../content/mapa/estados/*.json", { eager: true });
const capituloFiles = import.meta.glob<{ default: Capitulo & { ordem?: number } }>("../content/mapa/narrativa/*.json", { eager: true });

/** Normaliza um registro de estado (aplica defaults e resolve imagens). */
function normalizarEstado(raw: EstadoConteudo): EstadoConteudo {
  return {
    ...raw,
    uf: raw.uf.toUpperCase(),
    publicado: raw.publicado !== false,
    animais: (raw.animais ?? []).filter((a) => a.publicado !== false),
    doencas: (raw.doencas ?? []).filter((d) => d.publicado !== false),
    servicos: raw.servicos ?? [],
    atividadesInct: raw.atividadesInct ?? [],
  };
}

/** Mapa UF(maiúscula) -> conteúdo publicado. */
export const conteudoPorUf: Map<string, EstadoConteudo> = new Map(
  Object.values(estadoFiles)
    .map((m) => normalizarEstado(m.default))
    .filter((e) => e.publicado !== false)
    .map((e) => [e.uf, e]),
);

/** true se há ficha publicada para a UF. */
export function temConteudo(sigla: string): boolean {
  return conteudoPorUf.has(sigla.toUpperCase());
}

export function conteudoDe(sigla?: string | null): EstadoConteudo | undefined {
  return sigla ? conteudoPorUf.get(sigla.toUpperCase()) : undefined;
}

/**
 * Notificações REPRESENTATIVAS de uma UF: soma e ano inicial. `null` se a ficha
 * não traz nenhum número (a lente do mapa usa isso para distinguir "sem dado").
 * Números marcados `representativo: false` (ex.: malária no SINAN, acompanhada
 * pelo SIVEP-Malária) ficam de fora, para não tornar a soma incoerente entre
 * estados.
 *
 * `desde` é o MENOR ano citado entre as doenças somadas, e não um ano fixo. O
 * mapa carimbava "(desde 2018)" em todo estado; Maranhão e Tocantins acumulam a
 * partir de 2016, então o rótulo tirava dois anos de dados reais do leitor.
 */
export function resumoNotificacoes(sigla: string): ResumoNotificacoes | null {
  const e = conteudoPorUf.get(sigla.toUpperCase());
  if (!e?.doencas?.length) return null;
  let soma = 0;
  let temDado = false;
  let desde: number | null = null;
  for (const d of e.doencas) {
    const n = d.notificacoes;
    if (n && n.representativo !== false) {
      soma += n.valor;
      temDado = true;
      const ano = Number(/(\d{4})/.exec(n.periodo ?? "")?.[1]);
      if (ano && (desde === null || ano < desde)) desde = ano;
    }
  }
  return temDado ? { valor: soma, desde } : null;
}

/** Só a soma. Conveniência para quem exibe o número solto. */
export function totalNotificacoes(sigla: string): number | null {
  return resumoNotificacoes(sigla)?.valor ?? null;
}

/** Capítulos do modo narrativo, ordenados. */
export const capitulos: Capitulo[] = Object.values(capituloFiles)
  .map((m) => m.default)
  .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

/**
 * O capítulo de um id, com volta ao primeiro quando o id não existe.
 *
 * Vive aqui, e não dentro do JSX, porque é a diferença entre uma página inteira
 * aparecer ou não: com `?cap=inexistente` a narrativa sumia por completo — mapa,
 * palco e texto — deixando só o cabeçalho, e a mensagem que sobrava dizia
 * "Nenhum capítulo cadastrado ainda", o que é falso, havendo quatro. Sendo
 * função pura de módulo, um teste em Node alcança; dentro do componente, não.
 */
export function capituloInicial(id?: string | null): Capitulo | undefined {
  return capitulos.find((c) => c.id === id) ?? capitulos[0];
}

/** Aviso de dev: fichas sem fontes num registro não-demonstração. */
if (import.meta.env.DEV) {
  for (const e of conteudoPorUf.values()) {
    const publicadoSemFonte = e.demonstracao !== true && (!e.fontes || e.fontes.length === 0);
    if (publicadoSemFonte) console.warn(`[mapa] ficha "${e.uf}" publicada sem fontes.`);
  }
}
