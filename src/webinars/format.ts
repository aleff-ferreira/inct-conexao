import type { WebinarEvent } from "./data";

/**
 * Datas e horários são exibidos no fuso do evento (Rondônia, UTC-4), pareados
 * com o rótulo `timezoneLabel`, para que o horário anunciado seja o mesmo para
 * qualquer visitante — independentemente do fuso do navegador.
 */
const EVENT_TIME_ZONE = "America/Porto_Velho"; // UTC-4 fixo (sem horário de verão)

function formatWithZone(iso: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: EVENT_TIME_ZONE, ...options }).format(date);
  } catch {
    // Fallback caso o fuso IANA não esteja disponível no ambiente.
    return new Intl.DateTimeFormat("pt-BR", options).format(date);
  }
}

/** Ex.: "27 de agosto de 2026". */
export const formatEventDate = (iso: string): string =>
  formatWithZone(iso, { day: "numeric", month: "long", year: "numeric" });

/** Ex.: "quinta-feira". */
export const formatEventWeekday = (iso: string): string =>
  formatWithZone(iso, { weekday: "long" });

/** Ex.: "27 ago 2026". */
export const formatEventDateShort = (iso: string): string =>
  formatWithZone(iso, { day: "2-digit", month: "short", year: "numeric" }).replace(/\.$/, "");

/** Ex.: "16:00". */
export const formatEventTime = (iso: string): string =>
  formatWithZone(iso, { hour: "2-digit", minute: "2-digit", hour12: false });

/** Ex.: "16:00 – 17:30". */
export const formatEventTimeRange = (startIso: string, endIso: string): string => {
  const start = formatEventTime(startIso);
  const end = formatEventTime(endIso);
  return end ? `${start} às ${end}` : start;
};

/** ISO 8601 para máquina (usado em <time datetime>). */
export const machineDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** true quando o alvo já passou. */
  done: boolean;
  totalMs: number;
};

export function getCountdownParts(targetIso: string, now: Date = new Date()): CountdownParts {
  const target = new Date(targetIso).getTime();
  const diff = target - now.getTime();
  if (!Number.isFinite(target) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true, totalMs: Math.max(diff, 0) };
  }
  const seconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    done: false,
    totalMs: diff,
  };
}

/** Iniciais de um nome, ignorando títulos (Dr., Dra., Prof.). Ex.: "Dra. Helena Marques" -> "HM". */
export function initials(name: string): string {
  const titles = new Set(["dr", "dra", "prof", "profa", "me", "ma", "msc", "dr.", "dra.", "prof.", "profa."]);
  const words = name
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !titles.has(w.toLowerCase().replace(/\.$/, "")));
  const picked = words.slice(0, 2);
  if (picked.length === 0) return name.slice(0, 2).toUpperCase();
  return picked.map((w) => w[0]?.toUpperCase() ?? "").join("");
}

/* ------------------------------------------------------------------ */
/*  ICS (Adicionar à agenda) — gerado no cliente, sem dependências.    */
/* ------------------------------------------------------------------ */

const toIcsStamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
};

const escapeIcsText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildIcsContent(event: WebinarEvent, url: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//INCT-CONEXAO//Webinars//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.slug}@inct-conexao`,
    `DTSTAMP:${toIcsStamp(new Date().toISOString())}`,
    `DTSTART:${toIcsStamp(event.startsAt)}`,
    `DTEND:${toIcsStamp(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.summary)}`,
    `URL:${escapeIcsText(url)}`,
    `LOCATION:${escapeIcsText("Transmissão online · INCT-CONEXAO")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export function icsDataUri(event: WebinarEvent, url: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcsContent(event, url))}`;
}
