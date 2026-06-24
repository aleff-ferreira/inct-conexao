import {
  bySlug,
  groupBySlug,
  webinarGroups,
  webinars,
  type WebinarEvent,
  type WebinarGroup,
} from "./data";

/**
 * Camada de dados — site totalmente ESTÁTICO e autossuficiente.
 * Webinars e grupos vêm de data.ts; a equipe edita data.ts e o site é
 * recompilado e reenviado ao Hostinger. Não há backend, login ou serviço externo.
 */

export function useWebinars(): { events: WebinarEvent[]; loading: boolean } {
  return { events: webinars, loading: false };
}

export function useWebinar(slug: string): { event: WebinarEvent | undefined; loading: boolean; notFound: boolean } {
  const event = bySlug(webinars, slug);
  return { event, loading: false, notFound: !event };
}

export function useGroups(): { groups: WebinarGroup[]; loading: boolean } {
  return { groups: webinarGroups.filter((group) => group.published), loading: false };
}

export function useGroup(slug: string): { group: WebinarGroup | undefined; loading: boolean; notFound: boolean } {
  const group = groupBySlug(webinarGroups, slug);
  return { group, loading: false, notFound: !group };
}
