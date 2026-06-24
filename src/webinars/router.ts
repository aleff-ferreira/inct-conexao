import { useEffect, useState } from "react";

/**
 * Roteamento leve por hash — sem dependências, compatível com hospedagem
 * estática (Netlify) e com `base: "./"`. Âncoras internas da home continuam
 * funcionando (`#pesquisa`); rotas de webinar usam o prefixo `#/`.
 *
 *   #                      -> home
 *   #pesquisa              -> home, rola até a seção "pesquisa"
 *   #/webinars             -> hub de webinars
 *   #/webinars/<slug>      -> página do evento
 */
export type Route =
  | { name: "home"; anchor?: string }
  | { name: "hub" }
  | { name: "event"; slug: string }
  | { name: "groups" }
  | { name: "group"; slug: string };

export const HUB_HREF = "#/webinars";
export const GROUPS_HREF = "#/grupos";
export const eventHref = (slug: string): string => `#/webinars/${slug}`;
export const groupHref = (slug: string): string => `#/grupos/${slug}`;

export function parseHash(rawHash: string): Route {
  const hash = rawHash.replace(/^#/, "");

  if (!hash.startsWith("/")) {
    return { name: "home", anchor: hash || undefined };
  }

  const segments = hash.split("/").filter(Boolean); // ["webinars", "<slug>"?]

  const decode = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value; // percent-encoding malformado → cai no "não encontrado"
    }
  };

  if (segments[0] === "webinars") {
    if (segments[1]) return { name: "event", slug: decode(segments[1]) };
    return { name: "hub" };
  }

  if (segments[0] === "grupos") {
    if (segments[1]) return { name: "group", slug: decode(segments[1]) };
    return { name: "groups" };
  }

  // Rota desconhecida: volta para a home com segurança.
  return { name: "home" };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(typeof window === "undefined" ? "" : window.location.hash),
  );

  useEffect(() => {
    const handleChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handleChange);
    return () => window.removeEventListener("hashchange", handleChange);
  }, []);

  return route;
}

/**
 * Relógio que dispara re-render periódico para que o status do evento
 * (upcoming → live → ended) acompanhe o tempo real sem recarregar a página.
 * Usado pelo hub e pela página de evento.
 */
export function useNow(periodMs = 10000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), periodMs);
    return () => window.clearInterval(id);
  }, [periodMs]);

  return now;
}
