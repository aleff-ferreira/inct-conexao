import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  Building2,
  CalendarClock,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  PlayCircle,
  Presentation,
  Radio,
  Video,
} from "lucide-react";
import type { AgendaItem, Material, Speaker, WebinarEvent, WebinarPartner, WebinarStatus } from "./data";
import { webinarAsset } from "./data";
import { resolveStream, type ResolvedStream } from "./stream";
import { formatEventDateShort, formatEventTime, getCountdownParts, initials, machineDate } from "./format";

const AVATAR_TONES = ["forest", "river", "leaf", "gold", "clay"] as const;

const STATUS_LABEL: Record<WebinarStatus, string> = {
  upcoming: "Em breve",
  live: "Ao vivo",
  ended: "Gravação",
};

export function StatusBadge({ status, size = "md" }: { status: WebinarStatus; size?: "sm" | "md" }) {
  return (
    <span className={`webinar-status webinar-status--${status} webinar-status--${size}`}>
      {status === "live" ? <span className="webinar-status-dot" aria-hidden="true" /> : null}
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Contagem regressiva                                                 */
/* ------------------------------------------------------------------ */

export function Countdown({ targetIso, compact = false }: { targetIso: string; compact?: boolean }) {
  const [parts, setParts] = useState(() => getCountdownParts(targetIso));

  useEffect(() => {
    setParts(getCountdownParts(targetIso));
    const id = window.setInterval(() => setParts(getCountdownParts(targetIso)), 1000);
    return () => window.clearInterval(id);
  }, [targetIso]);

  if (parts.done) return null;

  const cells: { value: number; label: string }[] = [
    { value: parts.days, label: "dias" },
    { value: parts.hours, label: "h" },
    { value: parts.minutes, label: "min" },
    { value: parts.seconds, label: "s" },
  ];

  const plural = (n: number, singular: string, pluralForm: string) => `${n} ${n === 1 ? singular : pluralForm}`;
  const accessibleLabel = `Faltam ${plural(parts.days, "dia", "dias")}, ${plural(parts.hours, "hora", "horas")} e ${plural(
    parts.minutes,
    "minuto",
    "minutos",
  )} para a transmissão.`;

  return (
    <div className={`webinar-countdown ${compact ? "is-compact" : ""}`} role="timer" aria-label={accessibleLabel}>
      {cells.map((cell) => (
        <div key={cell.label} className="webinar-countdown-cell" aria-hidden="true">
          <strong>{String(cell.value).padStart(2, "0")}</strong>
          <span>{cell.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Player (facade -> embed ou vídeo próprio)                          */
/* ------------------------------------------------------------------ */

function withAutoplay(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;
}

function IframePlayer({ url, title, poster }: { url: string; title: string; poster: string }) {
  const [active, setActive] = useState(false);

  if (!active) {
    return (
      <button
        type="button"
        className="webinar-play-facade"
        style={{ backgroundImage: `url("${poster}")` }}
        onClick={() => setActive(true)}
        aria-label={`Assistir: ${title}`}
      >
        <span className="webinar-play-glyph" aria-hidden="true">
          <PlayCircle size={34} />
        </span>
        <span className="webinar-play-text">Assistir agora</span>
      </button>
    );
  }

  return (
    <iframe
      className="webinar-iframe"
      src={withAutoplay(url)}
      title={title}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

function FilePlayer({ url, title, poster }: { url: string; title: string; poster: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // The big overlay shows only BEFORE the first play; afterwards the native
  // controls own play/pause, so a paused frame is never re-covered.
  const [started, setStarted] = useState(false);

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    void video.play().catch(() => {
      /* autoplay/playback bloqueado: controles nativos assumem */
    });
  };

  return (
    <div className="webinar-file-player">
      <video
        ref={videoRef}
        className="webinar-video"
        controls
        playsInline
        preload="metadata"
        poster={poster}
        aria-label={`Gravação: ${title}`}
        onPlay={() => setStarted(true)}
      >
        <source src={url} type="video/mp4" />
        Seu navegador não suporta a reprodução de vídeo. Acesse a gravação pelos materiais do evento.
      </video>
      {!started ? (
        <button type="button" className="webinar-play-overlay" onClick={play} aria-label={`Reproduzir gravação: ${title}`}>
          <PlayCircle size={34} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** Link de transmissão não incorporável (Zoom/Meet/etc.): abre em nova aba. */
function ExternalStream({ url, provider, poster, title }: { url: string; provider: string; poster: string; title: string }) {
  return (
    <div
      className="webinar-stage-fallback"
      style={{ backgroundImage: `linear-gradient(180deg, rgba(6,23,21,0.5), rgba(6,23,21,0.88)), url("${poster}")` }}
    >
      <div className="webinar-stage-fallback-inner">
        <span className="webinar-stage-chip">
          <ExternalLink size={16} aria-hidden={true} />
          Transmissão externa
        </span>
        <p className="webinar-stage-fallback-title">Esta transmissão é aberta em {provider}.</p>
        <a
          className="button primary"
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir transmissão em ${provider}: ${title}`}
        >
          Abrir transmissão
          <ExternalLink size={18} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function StreamPlayer({ resolved, title, poster }: { resolved: ResolvedStream; title: string; poster: string }) {
  if (resolved.mode === "file") return <FilePlayer url={resolved.url} title={title} poster={poster} />;
  if (resolved.mode === "external")
    return <ExternalStream url={resolved.url} provider={resolved.provider} poster={poster} title={title} />;
  return <IframePlayer url={resolved.url} title={title} poster={poster} />;
}

/** Estado vazio/aguardando exibido dentro do palco 16:9, sem deslocamento de layout. */
function StreamFallback({
  poster,
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  poster: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="webinar-stage-fallback" style={{ backgroundImage: `linear-gradient(180deg, rgba(6,23,21,0.42), rgba(6,23,21,0.86)), url("${poster}")` }}>
      <div className="webinar-stage-fallback-inner">
        <span className="webinar-stage-chip">
          <Icon size={16} aria-hidden={true} />
          {eyebrow}
        </span>
        <p className="webinar-stage-fallback-title">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** Nome de exibição do provedor incorporado — para a rota de fuga dizer PARA ONDE leva. */
const PROVIDER_LABEL: Record<string, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  streamyard: "StreamYard",
  custom: "site da transmissão",
};

/**
 * A rota de fuga sob o player. Falha de iframe entre origens é indetectável de
 * verdade (onerror não dispara em bloqueio de rede; onload dispara mesmo com
 * erro interno do player) — a correção honesta não é detectar, é o link
 * PERMANENTE: quem vê um retângulo preto atrás de um proxy institucional tem
 * para onde ir sem recarregar nada. No replay, entram também a transcrição e o
 * áudio — as rotas de menor banda.
 */
function StageEscape({ event, status, resolved }: { event: WebinarEvent; status: WebinarStatus; resolved: ResolvedStream | null }) {
  const links: { href: string; texto: string }[] = [];
  if (resolved?.mode === "embed") {
    links.push({ href: resolved.original, texto: `assistir direto no ${PROVIDER_LABEL[resolved.provider] ?? resolved.provider}` });
  }
  if (status === "live" && event.liveStreamBackup) {
    links.push({ href: event.liveStreamBackup, texto: "usar a transmissão reserva" });
  }
  if (status === "ended") {
    if (event.acessibilidade?.transcricaoUrl) links.push({ href: event.acessibilidade.transcricaoUrl, texto: "ler a transcrição" });
    if (event.acessibilidade?.audioUrl) links.push({ href: event.acessibilidade.audioUrl, texto: "ouvir em áudio (MP3)" });
  }
  if (!links.length) return null;

  return (
    <p className="webinar-stage-escape">
      {status === "ended" ? "Prefere outro formato? " : "Problemas com o vídeo? "}
      {links.map((l, i) => (
        <span key={l.href}>
          {i > 0 ? " · " : ""}
          <a href={l.href} target="_blank" rel="noreferrer">
            {l.texto}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </span>
      ))}
    </p>
  );
}

/**
 * Palco do vídeo: 16:9, sem layout shift, com estados graciosos por status.
 *  - live + transmissão -> player; live sem URL -> "entrando no ar"
 *  - upcoming -> contagem regressiva + "será exibida aqui"
 *  - ended + replay -> player; ended sem replay -> "gravação em breve"
 */
export function StreamStage({ event, status }: { event: WebinarEvent; status: WebinarStatus }) {
  const poster = webinarAsset(event.posterImage ?? event.heroImage ?? "hero-forest.jpg");
  const live = resolveStream(event.liveStream);
  const replay = resolveStream(event.replay);

  let inner: React.ReactNode;

  if (status === "live") {
    inner = live ? (
      <StreamPlayer resolved={live} title={`Transmissão ao vivo, ${event.title}`} poster={poster} />
    ) : (
      <StreamFallback poster={poster} icon={Radio} eyebrow="Ao vivo em instantes" title="Estamos entrando no ar. A transmissão aparecerá aqui automaticamente.">
        <p className="webinar-stage-note">Atualize a página caso o vídeo não inicie nos próximos minutos.</p>
      </StreamFallback>
    );
  } else if (status === "upcoming") {
    inner = (
      <StreamFallback poster={poster} icon={CalendarClock} eyebrow="Transmissão agendada" title="A transmissão ao vivo será exibida aqui.">
        <Countdown targetIso={event.startsAt} />
      </StreamFallback>
    );
  } else {
    inner = replay ? (
      <StreamPlayer resolved={replay} title={`Gravação, ${event.title}`} poster={poster} />
    ) : (
      <StreamFallback poster={poster} icon={Video} eyebrow="Encerrado" title="A gravação será publicada em breve.">
        <p className="webinar-stage-note">Assim que a edição for concluída, o replay aparecerá nesta página.</p>
      </StreamFallback>
    );
  }

  return (
    <>
      <div className="webinar-stage">{inner}</div>
      <StageEscape event={event} status={status} resolved={status === "live" ? live : status === "ended" ? replay : null} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Pessoas                                                             */
/* ------------------------------------------------------------------ */

export function SpeakerCard({ person, kind, index }: { person: Speaker; kind: "speaker" | "moderator"; index: number }) {
  const tone = AVATAR_TONES[index % AVATAR_TONES.length];
  const roleLabel = kind === "moderator" ? "Moderação" : "Palestrante";

  return (
    <article className={`webinar-speaker ${kind === "moderator" ? "is-moderator" : ""}`}>
      <div className="webinar-speaker-top">
        <span className={`webinar-avatar tone-${tone}`} aria-hidden={person.photo ? undefined : true}>
          {person.photo ? <img src={person.photo} alt={`Foto de ${person.name}`} loading="lazy" /> : initials(person.name)}
        </span>
        <span className="webinar-speaker-role">{roleLabel}</span>
      </div>
      <h3>{person.name}</h3>
      <p className="webinar-speaker-job">{person.role}</p>
      <p className="webinar-speaker-affiliation">
        <Building2 size={15} aria-hidden="true" />
        <span>
          {person.affiliation}
          {person.affiliationFull ? <em>{person.affiliationFull}</em> : null}
        </span>
      </p>
      {person.bio ? <p className="webinar-speaker-bio">{person.bio}</p> : null}
      {person.links && person.links.length ? (
        <div className="webinar-speaker-links">
          {person.links.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Programação (agenda)                                               */
/* ------------------------------------------------------------------ */

export function AgendaTimeline({ items }: { items: AgendaItem[] }) {
  return (
    <ol className="webinar-agenda">
      {items.map((item, index) => (
        <li key={`${item.time}-${index}`} className="webinar-agenda-item">
          <span className="webinar-agenda-time">
            <Clock size={14} aria-hidden="true" />
            {item.time}
          </span>
          <div className="webinar-agenda-body">
            <p className="webinar-agenda-title">{item.title}</p>
            {item.speaker ? <span className="webinar-agenda-speaker">{item.speaker}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  Materiais                                                           */
/* ------------------------------------------------------------------ */

const MATERIAL_ICON: Record<Material["kind"], ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  PDF: FileText,
  Slides: Presentation,
  Link: LinkIcon,
  Vídeo: Video,
};

export function MaterialsList({ materials }: { materials: Material[] }) {
  return (
    <div className="webinar-materials">
      {materials.map((material, index) => {
        const Icon = MATERIAL_ICON[material.kind] ?? FileText;
        const available = Boolean(material.href);
        const Tag = available ? "a" : "div";
        const isDownload = material.kind === "PDF" || material.kind === "Slides";

        return (
          <Tag
            key={`${material.title}-${index}`}
            className={`webinar-material ${available ? "" : "is-pending"}`}
            {...(available
              ? { href: material.href, target: "_blank", rel: "noreferrer" }
              : { "aria-disabled": true })}
          >
            <span className="webinar-material-icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <span className="webinar-material-body">
              <strong>{material.title}</strong>
              {material.note ? <small>{material.note}</small> : null}
            </span>
            <span className="webinar-material-action" aria-hidden="true">
              {available ? (
                isDownload ? <Download size={18} /> : <ExternalLink size={18} />
              ) : (
                <span className="webinar-material-soon">Em breve</span>
              )}
            </span>
          </Tag>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Perguntas do público                                               */
/* ------------------------------------------------------------------ */

export function QuestionBlock({ event, status }: { event: WebinarEvent; status: WebinarStatus }) {
  const open = Boolean(event.questionUrl);
  const helper =
    status === "ended"
      ? "O envio de perguntas foi encerrado com a transmissão."
      : open
        ? "Envie sua pergunta para a mesa. As mais relevantes serão respondidas durante o debate."
        : "O canal de perguntas será aberto pouco antes da transmissão.";

  return (
    <div className="webinar-question">
      <span className="webinar-question-icon" aria-hidden="true">
        <MessageSquare size={22} />
      </span>
      <div className="webinar-question-body">
        <h3>Participe do debate</h3>
        <p>{helper}</p>
      </div>
      {open && status !== "ended" ? (
        <a className="button primary webinar-question-cta" href={event.questionUrl} target="_blank" rel="noreferrer">
          Enviar pergunta
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Instituições parceiras                                              */
/* ------------------------------------------------------------------ */

export function PartnerStrip({ partners }: { partners: WebinarPartner[] }) {
  if (!partners.length) return null;
  return (
    <div className="webinar-partners">
      {partners.map((partner) => (
        <div className="webinar-partner" key={partner.name} title={partner.name}>
          {partner.logo ? (
            <img src={partner.logo} alt={`Logotipo ${partner.name}`} loading="lazy" decoding="async" />
          ) : (
            <span className="webinar-partner-acronym">{partner.acronym ?? partner.name}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Estado vazio genérico                                               */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="webinar-empty">
      <span className="webinar-empty-icon" aria-hidden="true">
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cartão de evento (hub / arquivo)                                   */
/* ------------------------------------------------------------------ */

export function EventCard({
  event,
  status,
  href,
}: {
  event: WebinarEvent;
  status: WebinarStatus;
  href: string;
}) {
  const cover = webinarAsset(event.heroImage ?? "hero-forest.jpg");
  const ctaLabel = status === "live" ? "Assistir ao vivo" : status === "upcoming" ? "Ver detalhes" : "Ver gravação";

  return (
    <a className="webinar-card" href={href}>
      <span className="webinar-card-media">
        <img src={cover} alt="" loading="lazy" decoding="async" />
        <StatusBadge status={status} size="sm" />
      </span>
      <span className="webinar-card-body">
        <span className="webinar-card-theme">{event.theme}</span>
        <strong className="webinar-card-title">{event.title}</strong>
        <span className="webinar-card-meta">
          <CalendarClock size={15} aria-hidden="true" />
          <time dateTime={machineDate(event.startsAt)}>
            {formatEventDateShort(event.startsAt)} · {formatEventTime(event.startsAt)}
          </time>
        </span>
        <span className="webinar-card-cta">
          {ctaLabel}
          <PlayCircle size={16} aria-hidden="true" />
        </span>
      </span>
    </a>
  );
}
