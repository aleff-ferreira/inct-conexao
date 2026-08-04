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
  /* `original` guarda a URL como o editor colou. É a rota de fuga: quando o
     iframe não carrega (proxy institucional, bloqueador, rede que barra o
     provedor), o único socorro possível é um link direto — e a URL de embed
     não serve para isso, porque foi feita para viver dentro de um iframe. */
  | { mode: "embed"; provider: StreamProvider; url: string; original: string }
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
    /* "live_stream" tem exatamente 11 caracteres, todos válidos num ID — o
       padrão de /embed/ casava com a PALAVRA e o código montava
       embed/live_stream?rel=0, descartando o ?channel= que dava sentido à URL.
       O resultado era um iframe de erro, mudo. */
    if (match && match[1] !== "live_stream") return match[1];
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
    /* embed/live_stream?channel=UC…: o embed "da live corrente do canal".
       Preserva o channel — era ele que o extrator de ID descartava. Host
       www.youtube.com de propósito: a combinação youtube-nocookie +
       live_stream não é documentada (NÃO CONFIRMADA em teste próprio).
       Sem channel, a URL não aponta para nada: link externo, nunca um
       iframe mudo. */
    if (/\/embed\/live_stream/i.test(url)) {
      const channel = url.match(/[?&]channel=(UC[A-Za-z0-9_-]{10,})/);
      if (channel) {
        return {
          mode: "embed",
          provider: "youtube",
          url: `https://www.youtube.com/embed/live_stream?channel=${channel[1]}`,
          original: `https://www.youtube.com/channel/${channel[1]}/live`,
        };
      }
      return { mode: "external", provider: "YouTube", url };
    }

    /* youtube.com/@canal/live não expõe ID nenhum — não há como montar o
       embed. Vira link externo, com aviso em DEV: a forma que funciona é
       youtube.com/live/<id> do evento AGENDADO. */
    if (/youtube\.com\/@[^/?#]+\/live/i.test(url)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[webinars] URL @canal/live não é incorporável; será link externo. Agende a transmissão no YouTube Studio e cole youtube.com/live/<id>: ${url}`,
        );
      }
      return { mode: "external", provider: "YouTube", url };
    }

    const id = youTubeId(url);
    if (id) {
      return {
        mode: "embed",
        provider: "youtube",
        url: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
        original: url,
      };
    }
  }

  if (/vimeo\.com/i.test(url)) {
    const embed = vimeoEmbed(url);
    if (embed) return { mode: "embed", provider: "vimeo", url: embed, original: url };
  }

  if (/streamyard\.com/i.test(url)) {
    const embed = /[?&]embed=1\b/.test(url) ? url : `${url}${url.includes("?") ? "&" : "?"}embed=1`;
    return { mode: "embed", provider: "streamyard", url: embed, original: url };
  }

  // Plataformas de reunião: o link NÃO vira player — abre externamente.
  if (/(?:zoom\.us|zoom\.com|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)/i.test(url)) {
    const provider = /zoom\./i.test(url) ? "Zoom" : /meet\.google/i.test(url) ? "Google Meet" : "Microsoft Teams";
    return { mode: "external", provider, url };
  }

  // Já é uma URL de player/embed de outro provedor → confia.
  if (/\/embed\/|player\./i.test(url)) {
    return { mode: "embed", provider: "custom", url, original: url };
  }

  return null;
}

export function resolveStream(input?: StreamInput): ResolvedStream | null {
  if (!input) return null;

  if (typeof input === "object") {
    if (input.type === "file") return { mode: "file", url: input.url };
    // Forma explícita { type: "iframe" }: normaliza hosts conhecidos; caso
    // contrário, confia na URL informada como embed.
    return recognize(input.url) ?? { mode: "embed", provider: input.provider, url: input.url, original: input.url };
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
