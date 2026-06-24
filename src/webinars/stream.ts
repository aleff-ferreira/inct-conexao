import type { StreamInput, StreamProvider } from "./data";

/**
 * Normaliza a transmissão informada em `liveStream` / `replay`.
 * Aceita uma URL "como veio" (watch, youtu.be, /live, vimeo.com, streamyard…)
 * e devolve o modo de exibição:
 *   - "embed"    → player incorporado (iframe) com a URL já no formato correto
 *   - "file"     → vídeo próprio (.mp4) reproduzido na página
 *   - "external" → link não incorporável (Zoom/Meet/etc.): abre em nova aba
 */
export type ResolvedStream =
  | { mode: "embed"; provider: StreamProvider; url: string }
  | { mode: "file"; url: string }
  | { mode: "external"; provider: string; url: string };

/** Extrai o ID de 11 caracteres de qualquer URL do YouTube. */
function youTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/live\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Converte uma URL do Vimeo (inclusive não listada com hash) no player embed. */
function vimeoEmbed(url: string): string | null {
  if (/player\.vimeo\.com\/video\//i.test(url)) return url; // já é embed
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-zA-Z]+))?/i);
  if (!match) return null;
  const [, id, hash] = match;
  return `https://player.vimeo.com/video/${id}?dnt=1${hash ? `&h=${hash}` : ""}`;
}

/** Reconhece provedores conhecidos; devolve null para URLs não identificadas. */
function recognize(url: string): ResolvedStream | null {
  // Arquivo de vídeo próprio (.mp4, .webm…) → reproduz na página (sem ser embed).
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i.test(url)) {
    return { mode: "file", url };
  }

  if (/(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url)) {
    const id = youTubeId(url);
    if (id) {
      return {
        mode: "embed",
        provider: "youtube",
        url: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
      };
    }
  }

  if (/vimeo\.com/i.test(url)) {
    const embed = vimeoEmbed(url);
    if (embed) return { mode: "embed", provider: "vimeo", url: embed };
  }

  if (/streamyard\.com/i.test(url)) {
    const embed = /[?&]embed=1\b/.test(url) ? url : `${url}${url.includes("?") ? "&" : "?"}embed=1`;
    return { mode: "embed", provider: "streamyard", url: embed };
  }

  // Plataformas de reunião: o link NÃO vira player — abre externamente.
  if (/(?:zoom\.us|zoom\.com|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)/i.test(url)) {
    const provider = /zoom\./i.test(url) ? "Zoom" : /meet\.google/i.test(url) ? "Google Meet" : "Microsoft Teams";
    return { mode: "external", provider, url };
  }

  // Já é uma URL de player/embed de outro provedor → confia.
  if (/\/embed\/|player\./i.test(url)) {
    return { mode: "embed", provider: "custom", url };
  }

  return null;
}

export function resolveStream(input?: StreamInput): ResolvedStream | null {
  if (!input) return null;

  if (typeof input === "object") {
    if (input.type === "file") return { mode: "file", url: input.url };
    // Forma explícita { type: "iframe" }: normaliza hosts conhecidos; caso
    // contrário, confia na URL informada como embed.
    return recognize(input.url) ?? { mode: "embed", provider: input.provider, url: input.url };
  }

  const url = input.trim();
  if (!url) return null;

  const known = recognize(url);
  if (known) return known;

  // String não reconhecida: exibe como link externo (nunca um iframe quebrado).
  if (import.meta.env.DEV) {
    console.warn(
      `[webinars] URL de transmissão não reconhecida como embed; será exibida como link externo: ${url}`,
    );
  }
  return { mode: "external", provider: "transmissão externa", url };
}
