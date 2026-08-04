/**
 * ============================================================================
 *  INCT-CONEXAO · Centro de transmissões científicas (Webinars) + Grupos
 *  CONTEÚDO EDITÁVEL PELO PAINEL (CMS)
 * ============================================================================
 *
 *  Onde fica o conteúdo
 *  --------------------
 *  Cada webinar é um arquivo JSON em `src/content/webinars/<slug>.json` e cada
 *  grupo é um arquivo em `src/content/groups/<slug>.json`. Os líderes de grupo
 *  editam esses arquivos pelo PAINEL em `/admin` (Sveltia CMS) — não precisam
 *  mexer em código. Este arquivo apenas CARREGA esses JSONs (via import.meta.glob),
 *  normaliza os caminhos de imagem/vídeo e expõe os arrays `webinars` e
 *  `webinarGroups` para os componentes em `src/webinars/*.tsx`.
 *
 *  Você também pode editar os JSONs à mão e reconstruir (npm run build) — o
 *  formato é o mesmo que o painel grava.
 *
 *  Status do evento
 *  ----------------
 *  Por padrão o status é DERIVADO das datas (`startsAt`/`endsAt`):
 *    antes de startsAt .......... "upcoming" (em breve)
 *    entre startsAt e endsAt ..... "live" (ao vivo)
 *    após endsAt ................. "ended" (encerrado / replay)
 *  Para forçar manualmente, defina `status: "live"` (ou "upcoming"/"ended").
 *
 *  Transmissão / gravação
 *  ----------------------
 *  `liveStream` e `replay` aceitam a URL (string) do YouTube/Vimeo/StreamYard —
 *  o player é montado automaticamente. Para uma gravação em arquivo próprio,
 *  use `replayVideo` (upload .mp4 pelo painel). Zoom/Meet não são incorporáveis:
 *  o site mostra, com elegância, um botão "Abrir transmissão".
 *
 *  Imagens
 *  -------
 *  Os campos de imagem (heroImage, coverImage, logo, foto…) guardam o NOME do
 *  arquivo em /public/assets (ex.: "clima-saude.jpg" ou "partner-logos/inpe.png").
 *  O painel também aceita caminhos como "/assets/arquivo.jpg" — a normalização
 *  abaixo cuida das duas formas.
 */

const BASE = import.meta.env.BASE_URL;

/** Caminho para um arquivo em /public/assets (ex.: webinarAsset("clima-saude.jpg")). */
export const webinarAsset = (file: string): string => `${BASE}assets/${file}`;

export type WebinarStatus = "upcoming" | "live" | "ended";
export type StreamProvider = "youtube" | "vimeo" | "streamyard" | "custom";

/** Fonte de mídia explícita: embed de terceiros (iframe) OU vídeo próprio (file). */
export type StreamSource =
  | { type: "iframe"; provider: StreamProvider; url: string }
  | { type: "file"; url: string };

/**
 * Entrada de transmissão aceita em `liveStream` / `replay`.
 * Forma simples (RECOMENDADA): basta colar a URL como string —
 *   liveStream: "https://youtu.be/VIDEO_ID"
 * O sistema reconhece YouTube/Vimeo/StreamYard e gera o player automaticamente.
 * Para um arquivo .mp4 próprio, use a forma explícita: { type: "file", url: ... }.
 */
export type StreamInput = string | StreamSource;

export type Speaker = {
  name: string;
  role: string;
  /** Sigla curta da instituição (ex.: "INPE"). */
  affiliation: string;
  /** Nome completo da instituição (opcional). */
  affiliationFull?: string;
  bio?: string;
  /** Caminho da foto via webinarAsset(...). Se omitido, mostra iniciais. */
  photo?: string;
  links?: { label: string; href: string }[];
};

export type AgendaItem = {
  /** Horário no formato "HH:MM". */
  time: string;
  title: string;
  /** Nome do responsável, ou "—" para debate/intervalo. */
  speaker?: string;
};

export type Material = {
  title: string;
  kind: "PDF" | "Slides" | "Link" | "Vídeo";
  /** URL do material. Se omitido, exibe estado "em breve". */
  href?: string;
  note?: string;
};

export type WebinarPartner = {
  name: string;
  acronym?: string;
  /** Caminho do logotipo via webinarAsset. */
  logo?: string;
};

export type WebinarSeo = {
  ogTitle?: string;
  ogDescription?: string;
  /** Nome do arquivo de imagem em /public/assets para compartilhamento. */
  ogImage?: string;
  keywords?: string[];
};

/**
 * O que esta edição declara de acessibilidade — e portanto PROMETE.
 *
 * É um select de três estados, e não booleanos soltos (`libras: true` ao lado
 * de `declaracao: "sem-recursos"` seria contradição possível; duas fontes de
 * verdade para o mesmo fato é como o catálogo diverge). O texto correspondente
 * é publicado na página: prometer "evento acessível" sem contrato assinado é
 * pior do que declarar honestamente o que não há.
 */
export type AcessibilidadeDeclarada = "libras-e-legenda" | "transcricao-posterior" | "sem-recursos";

export const TEXTO_ACESSIBILIDADE: Record<AcessibilidadeDeclarada, string> = {
  "libras-e-legenda":
    "Transmissão com intérprete de Libras e legenda em tempo real.",
  "transcricao-posterior":
    "A transmissão ao vivo não terá Libras nem legenda em tempo real. A gravação será publicada com legenda revisada e transcrição.",
  "sem-recursos":
    "Esta edição não conta com recursos de acessibilidade ao vivo. Se precisar de apoio para acompanhar, fale conosco pela página de contato.",
};

export type Acessibilidade = {
  declaracao?: AcessibilidadeDeclarada;
  /** URL da transcrição do replay (ex.: Internet Archive). */
  transcricaoUrl?: string;
  /** MP3 do evento — a rota de menor custo para quem tem pouca internet. */
  audioUrl?: string;
};

export type WebinarEvent = {
  slug: string;
  title: string;
  subtitle: string;
  theme: string;
  summary: string;
  /** Parágrafos separados por linha em branco (\n\n). */
  description: string;
  /** ISO 8601 COM fuso (ex.: "2026-08-27T16:00:00-04:00"). */
  startsAt: string;
  endsAt: string;
  timezoneLabel: string;
  /** Sobrepõe o status derivado das datas. */
  status?: WebinarStatus;
  /** Arquivo de imagem em /public/assets (capa). */
  heroImage?: string;

  liveStream?: StreamInput;
  /** URL alternativa em OUTRO serviço, exibida como rota de fuga sob o player. */
  liveStreamBackup?: string;
  replay?: StreamInput;
  /** Imagem usada como pôster do player (padrão: heroImage). */
  posterImage?: string;

  registrationUrl?: string;
  questionUrl?: string;
  acessibilidade?: Acessibilidade;

  speakers: Speaker[];
  moderator?: Speaker;
  agenda: AgendaItem[];
  materials: Material[];
  partners: WebinarPartner[];
  seo?: WebinarSeo;
  /** Snapshot do grupo dono (slug + nome), resolvido a partir de `groupSlug`. */
  group?: { slug: string; name: string };
  /** false = standby: o webinar fica OCULTO do site (use enquanto a data não
   *  estiver confirmada). Padrão: true. */
  published?: boolean;
};

export type GroupLink = { label: string; href: string };

/** Grupo de pesquisa do INCT (carrega a "descrição do grupo"). */
export type WebinarGroup = {
  slug: string;
  name: string;
  acronym?: string;
  /** Parágrafos separados por linha em branco (\n\n). */
  description: string;
  leaderName?: string;
  institution?: string;
  /** Arquivo de imagem em /public/assets (capa). */
  coverImage?: string;
  links?: GroupLink[];
  published?: boolean;
};

/* ------------------------------------------------------------------ */
/*  Carregamento + normalização do conteúdo (JSON gravado pelo painel) */
/* ------------------------------------------------------------------ */

/** Forma "crua" gravada pelo CMS (antes da normalização). */
type RawSpeaker = Omit<Speaker, "photo"> & { photo?: string };
type RawWebinar = {
  slug: string;
  title: string;
  subtitle?: string;
  theme?: string;
  summary?: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timezoneLabel?: string;
  status?: WebinarStatus | "";
  heroImage?: string;
  /** URL da transmissão ao vivo (YouTube/Vimeo/StreamYard). */
  liveStream?: string;
  /** URL reserva em outro serviço (rota de fuga sob o player). */
  liveStreamBackup?: string;
  /** URL da gravação (YouTube/Vimeo). Se presente, VENCE o replayVideo. */
  replay?: string;
  /** Arquivo de vídeo próprio enviado pelo painel (fallback quando não há URL). */
  replayVideo?: string;
  posterImage?: string;
  registrationUrl?: string;
  questionUrl?: string;
  acessibilidade?: { declaracao?: string; transcricaoUrl?: string; audioUrl?: string };
  speakers?: RawSpeaker[];
  moderator?: RawSpeaker;
  agenda?: AgendaItem[];
  materials?: Material[];
  partners?: { name: string; acronym?: string; logo?: string }[];
  seo?: WebinarSeo;
  /** Slug do grupo dono (relação escolhida no painel). */
  groupSlug?: string;
  /** false = standby (oculto). Padrão: true. */
  published?: boolean;
};
type RawGroup = Omit<WebinarGroup, "coverImage"> & { coverImage?: string };

/**
 * Reduz qualquer caminho de mídia ao nome relativo dentro de /public/assets.
 * Aceita "x.jpg", "assets/x.jpg", "/assets/x.jpg", "./assets/x.jpg" e
 * "public/assets/x.jpg". URLs absolutas (http, //, data:) passam intactas.
 */
export function bareAsset(path?: string): string | undefined {
  const s = path?.trim();
  if (!s) return undefined;
  if (/^(?:https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
  return s.replace(/^\.?\/?(?:public\/)?assets\//i, "").replace(/^\.?\//, "");
}

/** Caminho de mídia PRONTO para `src` (resolve via webinarAsset, exceto URLs absolutas). */
function assetUrl(path?: string): string | undefined {
  const bare = bareAsset(path);
  if (!bare) return undefined;
  if (/^(?:https?:)?\/\//i.test(bare) || bare.startsWith("data:")) return bare;
  return webinarAsset(bare);
}

function normalizeSpeaker(raw: RawSpeaker): Speaker {
  return {
    name: raw.name,
    role: raw.role,
    affiliation: raw.affiliation,
    affiliationFull: raw.affiliationFull,
    bio: raw.bio,
    photo: assetUrl(raw.photo),
    links: raw.links,
  };
}

export function normalizeWebinar(raw: RawWebinar, groupName: (slug: string) => string): WebinarEvent {
  /* A URL de replay VENCE o arquivo enviado. Era o contrário, e o custo era
     silencioso: um upload por engano (ou um placeholder esquecido no campo de
     arquivo) anulava o VOD do YouTube já cadastrado — e ninguém via erro
     nenhum, só o vídeo errado. O arquivo é o fallback de quem não tem URL. */
  const replayUrl = raw.replay?.trim() || undefined;
  const replay: StreamInput | undefined =
    replayUrl ?? (raw.replayVideo ? { type: "file", url: assetUrl(raw.replayVideo) as string } : undefined);
  if (import.meta.env.DEV && replayUrl && raw.replayVideo) {
    console.warn(
      `[webinars] ${raw.slug}: "replay" (URL) e "replayVideo" (arquivo) definidos ao mesmo tempo — a URL vence. Remova o arquivo se ele não for a gravação oficial.`,
    );
  }

  /* Acessibilidade: valida o select contra o vocabulário conhecido — um valor
     antigo gravado pelo CMS não pode publicar um texto de promessa errado. */
  const declaracao = (Object.keys(TEXTO_ACESSIBILIDADE) as AcessibilidadeDeclarada[]).find(
    (d) => d === raw.acessibilidade?.declaracao,
  );
  const transcricaoUrl = raw.acessibilidade?.transcricaoUrl?.trim() || undefined;
  const audioUrl = raw.acessibilidade?.audioUrl?.trim() || undefined;
  const acessibilidade: Acessibilidade | undefined =
    declaracao || transcricaoUrl || audioUrl ? { declaracao, transcricaoUrl, audioUrl } : undefined;

  return {
    slug: raw.slug,
    title: raw.title,
    subtitle: raw.subtitle ?? "",
    theme: raw.theme ?? "",
    summary: raw.summary ?? "",
    description: raw.description ?? "",
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    timezoneLabel: raw.timezoneLabel ?? "",
    status: raw.status || undefined,
    heroImage: bareAsset(raw.heroImage),
    liveStream: raw.liveStream?.trim() || undefined,
    liveStreamBackup: raw.liveStreamBackup?.trim() || undefined,
    replay,
    posterImage: bareAsset(raw.posterImage),
    registrationUrl: raw.registrationUrl?.trim() || undefined,
    questionUrl: raw.questionUrl?.trim() || undefined,
    acessibilidade,
    speakers: (raw.speakers ?? []).map(normalizeSpeaker),
    moderator: raw.moderator ? normalizeSpeaker(raw.moderator) : undefined,
    agenda: raw.agenda ?? [],
    materials: raw.materials ?? [],
    partners: (raw.partners ?? []).map((p) => ({ name: p.name, acronym: p.acronym, logo: assetUrl(p.logo) })),
    seo: raw.seo ? { ...raw.seo, ogImage: bareAsset(raw.seo.ogImage) } : undefined,
    group: raw.groupSlug ? { slug: raw.groupSlug, name: groupName(raw.groupSlug) } : undefined,
    published: raw.published !== false,
  };
}

export function normalizeGroup(raw: RawGroup): WebinarGroup {
  return {
    slug: raw.slug,
    name: raw.name,
    acronym: raw.acronym,
    description: raw.description ?? "",
    leaderName: raw.leaderName,
    institution: raw.institution,
    coverImage: bareAsset(raw.coverImage),
    links: raw.links ?? [],
    published: raw.published !== false,
  };
}

// Carrega todos os arquivos de conteúdo no momento do build (Vite import.meta.glob).
const groupFiles = import.meta.glob<{ default: RawGroup }>("../content/groups/*.json", { eager: true });
const webinarFiles = import.meta.glob<{ default: RawWebinar }>("../content/webinars/*.json", { eager: true });

export const webinarGroups: WebinarGroup[] = Object.values(groupFiles)
  .map((mod) => normalizeGroup(mod.default))
  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

const groupNameBySlug = new Map(webinarGroups.map((group) => [group.slug, group.name]));

export const webinars: WebinarEvent[] = Object.values(webinarFiles)
  .map((mod) => normalizeWebinar(mod.default, (slug) => groupNameBySlug.get(slug) ?? slug))
  .filter((event) => event.published !== false);

// Guarda de desenvolvimento: avisa se dois eventos tiverem o mesmo slug.
if (import.meta.env.DEV) {
  const slugs = webinars.map((event) => event.slug);
  const duplicated = [...new Set(slugs.filter((slug, index) => slugs.indexOf(slug) !== index))];
  if (duplicated.length) {
    console.error(`[webinars] slugs duplicados (cada evento precisa de um slug único): ${duplicated.join(", ")}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers (não precisam ser editados)                                */
/* ------------------------------------------------------------------ */

/** Resolve o status efetivo: usa `status` explícito ou deriva das datas. */
export function resolveStatus(event: WebinarEvent, now: Date = new Date()): WebinarStatus {
  if (event.status) return event.status;
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  // Datas inválidas (erro de digitação) caem em "upcoming" — nunca "ao vivo".
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "upcoming";
  const t = now.getTime();
  if (t < start) return "upcoming";
  if (t > end) return "ended";
  return "live";
}

/** Eventos ordenados do mais próximo para o mais distante (por data de início). */
export function sortByStartAsc(list: WebinarEvent[]): WebinarEvent[] {
  return [...list].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/* As funções abaixo operam sobre uma LISTA recebida (os eventos de `webinars`). */

export function bySlug(events: WebinarEvent[], slug: string): WebinarEvent | undefined {
  return events.find((event) => event.slug === slug);
}

export function upcomingFrom(events: WebinarEvent[], now: Date = new Date()): WebinarEvent[] {
  return sortByStartAsc(events.filter((event) => resolveStatus(event, now) === "upcoming"));
}

export function liveFrom(events: WebinarEvent[], now: Date = new Date()): WebinarEvent[] {
  return sortByStartAsc(events.filter((event) => resolveStatus(event, now) === "live"));
}

/** Eventos encerrados, do mais recente para o mais antigo. */
export function pastFrom(events: WebinarEvent[], now: Date = new Date()): WebinarEvent[] {
  return sortByStartAsc(events.filter((event) => resolveStatus(event, now) === "ended")).reverse();
}

/** Evento em destaque: ao vivo > próximo > último encerrado. */
export function featuredFrom(events: WebinarEvent[], now: Date = new Date()): WebinarEvent | undefined {
  return liveFrom(events, now)[0] ?? upcomingFrom(events, now)[0] ?? pastFrom(events, now)[0];
}

/* Grupos */
export function sortGroups(list: WebinarGroup[]): WebinarGroup[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function groupBySlug(groups: WebinarGroup[], slug: string): WebinarGroup | undefined {
  return groups.find((group) => group.slug === slug);
}

/** Webinars (publicados) pertencentes a um grupo, mais recentes primeiro. */
export function webinarsOfGroup(events: WebinarEvent[], groupSlug: string): WebinarEvent[] {
  return sortByStartAsc(events.filter((event) => event.group?.slug === groupSlug)).reverse();
}
