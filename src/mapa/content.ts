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
import indiceEstados from "../content/mapa/indice-estados.json";

const BASE = import.meta.env.BASE_URL;

/** Caminho de uma imagem em /public/assets. Aceita nome nu ou com prefixos. */
export function mapaAsset(file?: string): string | undefined {
  const s = file?.trim();
  if (!s) return undefined;
  if (/^(?:https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
  const bare = s.replace(/^\.?\/?(?:public\/)?assets\//i, "").replace(/^\.?\//, "");
  return `${BASE}assets/${bare}`;
}

/* As fichas NÃO são eager. Com `{ eager: true }` os 135.008 B de JSON
   editorial entravam no bundle e desciam para quem abre o mapa e nunca clica
   num estado — e também na HOME, porque o teaser importa este módulo.
   O que a interface precisa antes de abrir uma ficha vem do índice, que tem
   2.972 B: 2,2% do mesmo dado. */
const estadoFiles = import.meta.glob<{ default: EstadoConteudo }>("../content/mapa/estados/*.json");

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

type EntradaIndice = {
  nome: string | null;
  demonstracao: boolean;
  contagens: { animais: number; doencas: number; servicos: number; inct: number; ambiente: number; resumo: number };
  notificacoes: { valor: number; desde: number | null } | null;
};

/** Índice enxuto, gerado por `scripts/build-indice-mapa.py`. Sempre carregado. */
export const INDICE: Record<string, EntradaIndice> = indiceEstados.estados as Record<string, EntradaIndice>;

/** Fichas já lidas nesta sessão. Ler duas vezes o mesmo estado não custa rede. */
const cacheFichas = new Map<string, EstadoConteudo>();

/** Caminho do glob para uma sigla (os arquivos são nomeados pela UF minúscula). */
function arquivoDe(sigla: string): string | undefined {
  const alvo = `/${sigla.toLowerCase()}.json`;
  return Object.keys(estadoFiles).find((k) => k.endsWith(alvo));
}

/**
 * Lê a ficha completa de uma UF, sob demanda.
 *
 * Devolve `undefined` para estado sem ficha — que é diferente de ficha vazia, e
 * a interface precisa distinguir os dois para não dizer "sem dado" onde na
 * verdade é "ainda carregando".
 */
export async function carregarFicha(sigla?: string | null): Promise<EstadoConteudo | undefined> {
  if (!sigla) return undefined;
  const uf = sigla.toUpperCase();
  const emCache = cacheFichas.get(uf);
  if (emCache) return emCache;
  const arq = arquivoDe(uf);
  if (!arq || !INDICE[uf]) return undefined;
  const mod = await estadoFiles[arq]();
  const ficha = normalizarEstado(mod.default);
  if (ficha.publicado === false) return undefined;
  cacheFichas.set(uf, ficha);
  return ficha;
}

/** Todas as fichas de uma vez. Para teste e para scripts — nunca no caminho da UI. */
export async function carregarTodasFichas(): Promise<Map<string, EstadoConteudo>> {
  const m = new Map<string, EstadoConteudo>();
  for (const uf of Object.keys(INDICE)) {
    const f = await carregarFicha(uf);
    if (f) m.set(uf, f);
  }
  return m;
}

/** true se há ficha publicada para a UF. */
export function temConteudo(sigla: string): boolean {
  return Object.prototype.hasOwnProperty.call(INDICE, sigla.toUpperCase());
}

/** Ficha já em memória, se houver. Não dispara carregamento — use `carregarFicha`. */
export function fichaEmCache(sigla?: string | null): EstadoConteudo | undefined {
  return sigla ? cacheFichas.get(sigla.toUpperCase()) : undefined;
}

/** Contagens e nome sem abrir a ficha: é o que o teaser e as abas precisam. */
export function resumoDe(sigla?: string | null): EntradaIndice | undefined {
  return sigla ? INDICE[sigla.toUpperCase()] : undefined;
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
  return INDICE[sigla.toUpperCase()]?.notificacoes ?? null;
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

/* A checagem de "ficha publicada sem fontes" saiu daqui.
   Ela percorria todas as fichas em tempo de execução — o que, agora que elas
   são carregadas sob demanda, obrigaria a baixar as 135 kB só para emitir um
   aviso de desenvolvimento. A verificação passou para onde ela sempre deveria
   ter estado: `scripts/build-indice-mapa.py`, que já lê todas as fichas, e
   `tests/mapa.test.ts`, que reprova. */
