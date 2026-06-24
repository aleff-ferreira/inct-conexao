import { useEffect } from "react";
import type { WebinarEvent } from "./data";

/**
 * Gerenciador de <head> no cliente. Atualiza título, meta description, Open
 * Graph / Twitter e JSON-LD por página e RESTAURA os valores ao sair.
 *
 * Limitação conhecida (SPA estática): scrapers sociais (Facebook, WhatsApp,
 * LinkedIn, X) NÃO executam JavaScript, então leem apenas as metatags do
 * index.html. As atualizações abaixo beneficiam a aba do navegador e o Google
 * (que renderiza JS), mas o cartão de compartilhamento social cai nos padrões
 * definidos no index.html. Cartões por-URL exigem pré-renderização/SSG — uma
 * evolução futura, fora do escopo do site estático atual.
 */

export type HeadConfig = {
  title: string;
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  /** URL absoluta da imagem de compartilhamento. */
  ogImage?: string;
  /** "website" | "article" | "event" ... */
  ogType?: string;
  /** URL canônica / og:url. */
  url?: string;
  /** Objeto JSON-LD (schema.org) ou null. */
  jsonLd?: object | null;
};

/** Converte um caminho relativo (ex.: "./assets/x.jpg") em URL absoluta. */
export function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.href).href;
  } catch {
    return path;
  }
}

type Cleanup = () => void;

function upsertMeta(attr: "name" | "property", key: string, content: string, cleanups: Cleanup[]): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (element) {
    const previous = element.getAttribute("content");
    element.setAttribute("content", content);
    cleanups.push(() => {
      if (previous === null) element?.removeAttribute("content");
      else element?.setAttribute("content", previous);
    });
  } else {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    element.setAttribute("content", content);
    document.head.appendChild(element);
    const created = element;
    cleanups.push(() => created.remove());
  }
}

function upsertCanonical(href: string, cleanups: Cleanup[]): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (link) {
    const previous = link.getAttribute("href");
    link.setAttribute("href", href);
    cleanups.push(() => {
      if (previous === null) link?.removeAttribute("href");
      else link?.setAttribute("href", previous);
    });
  } else {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", href);
    document.head.appendChild(link);
    const created = link;
    cleanups.push(() => created.remove());
  }
}

export function useWebinarHead(config: HeadConfig): void {
  const {
    title,
    description,
    keywords,
    ogTitle,
    ogDescription,
    ogImage,
    ogType = "website",
    url,
    jsonLd,
  } = config;

  // serialize deps so the effect re-runs only on real changes
  const key = JSON.stringify(config);

  useEffect(() => {
    const cleanups: Cleanup[] = [];

    const previousTitle = document.title;
    document.title = title;
    cleanups.push(() => {
      document.title = previousTitle;
    });

    if (description) upsertMeta("name", "description", description, cleanups);
    if (keywords && keywords.length) upsertMeta("name", "keywords", keywords.join(", "), cleanups);

    upsertMeta("property", "og:title", ogTitle ?? title, cleanups);
    if (ogDescription ?? description) upsertMeta("property", "og:description", (ogDescription ?? description)!, cleanups);
    upsertMeta("property", "og:type", ogType, cleanups);
    if (ogImage) upsertMeta("property", "og:image", ogImage, cleanups);
    if (url) upsertMeta("property", "og:url", url, cleanups);

    upsertMeta("name", "twitter:card", "summary_large_image", cleanups);
    upsertMeta("name", "twitter:title", ogTitle ?? title, cleanups);
    if (ogDescription ?? description) upsertMeta("name", "twitter:description", (ogDescription ?? description)!, cleanups);
    if (ogImage) upsertMeta("name", "twitter:image", ogImage, cleanups);

    if (url) upsertCanonical(url, cleanups);

    if (jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-webinar-jsonld", "");
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
      cleanups.push(() => script.remove());
    }

    return () => {
      // Restaura na ordem inversa.
      for (let i = cleanups.length - 1; i >= 0; i -= 1) cleanups[i]();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

// schema.org não possui um status "encerrado"; a conclusão é inferida pelo
// endDate (sempre presente). Por isso todos os estados usam EventScheduled.
const EVENT_STATUS = "https://schema.org/EventScheduled";

/** Monta o JSON-LD schema.org/Event para um evento online. */
export function buildEventJsonLd(event: WebinarEvent, opts: { url: string; imageUrl?: string }): object {
  const people = [...event.speakers];
  if (event.moderator) people.push(event.moderator);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.summary,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventStatus: EVENT_STATUS,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: {
      "@type": "VirtualLocation",
      url: opts.url,
    },
    organizer: {
      "@type": "Organization",
      name: "INCT-CONEXAO",
      url: absoluteUrl(import.meta.env.BASE_URL),
    },
    performer: people.map((person) => ({
      "@type": "Person",
      name: person.name,
      affiliation: person.affiliationFull ?? person.affiliation,
    })),
  };

  if (opts.imageUrl) jsonLd.image = [opts.imageUrl];

  // Evento gratuito: emite offers sempre (mantém elegibilidade a rich result),
  // apontando para a inscrição quando houver, ou para a própria página do evento.
  jsonLd.offers = {
    "@type": "Offer",
    price: "0",
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
    url: event.registrationUrl ?? opts.url,
  };

  return jsonLd;
}
