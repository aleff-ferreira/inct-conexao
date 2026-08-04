import {
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  Clock,
  Globe2,
  Loader2,
  PlayCircle,
  Radio,
  Users,
} from "lucide-react";
import { TEXTO_ACESSIBILIDADE, resolveStatus, webinarAsset } from "./data";
import { useWebinar } from "./store";
import { HUB_HREF, eventHref, useNow } from "./router";
import { absoluteUrl, buildEventJsonLd, useWebinarHead } from "./seo";
import {
  formatEventDate,
  formatEventTime,
  formatEventTimeRange,
  formatEventWeekday,
  icsDataUri,
  machineDate,
  scheduleLines,
  visitorTimeZone,
} from "./format";
import {
  AgendaTimeline,
  Countdown,
  EmptyState,
  MaterialsList,
  PartnerStrip,
  QuestionBlock,
  SpeakerCard,
  StatusBadge,
  StreamStage,
} from "./parts";

const STAGE_ID = "webinar-stage";

function scrollToStage() {
  const el = document.getElementById(STAGE_ID);
  if (!el) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

function NotFound() {
  useWebinarHead({ title: "Transmissão não encontrada | INCT-CONEXAO" });
  return (
    <main className="webinar-page" id="conteudo" tabIndex={-1}>
      <section className="section-band webinar-hub-section">
        <div className="section-inner">
          <EmptyState
            icon={Radio}
            title="Transmissão não encontrada"
            text="O endereço acessado não corresponde a nenhuma transmissão. Talvez o evento tenha sido movido ou o link esteja incompleto."
            action={
              <a className="button primary" href={HUB_HREF}>
                Ver todos os webinars
                <PlayCircle size={18} aria-hidden="true" />
              </a>
            }
          />
        </div>
      </section>
    </main>
  );
}

export function WebinarEvent({ slug }: { slug: string }) {
  const now = useNow();
  const { event, loading } = useWebinar(slug);

  const url = absoluteUrl(`${import.meta.env.BASE_URL}${eventHref(slug)}`);
  const ogImage = event ? absoluteUrl(webinarAsset(event.seo?.ogImage ?? event.heroImage ?? "hero-forest.jpg")) : undefined;

  useWebinarHead(
    event
      ? {
          title: `${event.title} | Webinars INCT-CONEXAO`,
          description: event.seo?.ogDescription ?? event.summary,
          keywords: event.seo?.keywords,
          ogTitle: event.seo?.ogTitle ?? event.title,
          ogDescription: event.seo?.ogDescription ?? event.summary,
          ogImage,
          ogType: "article",
          url,
          jsonLd: buildEventJsonLd(event, { url, imageUrl: ogImage }),
        }
      : { title: loading ? "Carregando transmissão… | INCT-CONEXAO" : "Transmissão não encontrada | INCT-CONEXAO" },
  );

  if (loading) {
    return (
      <main className="webinar-page" id="conteudo" tabIndex={-1}>
        <section className="section-band webinar-hub-section">
          <div className="section-inner">
            <div className="webinar-loading">
              <Loader2 size={24} aria-hidden="true" />
              <span>Carregando transmissão…</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!event) return <NotFound />;

  const status = resolveStatus(event, now);
  const heroImage = webinarAsset(event.heroImage ?? "hero-forest.jpg");
  const hasReplay = Boolean(event.replay);
  const paragraphs = event.description.split(/\n\n+/);
  /* O horário traduzido: Rondônia é UTC-4 e a maior parte da audiência está em
     UTC-3 — "16:00" seco fazia metade do público chegar uma hora antes. A
     primeira linha (Rondônia) já está no rótulo editorial; daqui saem as
     EXTRAS: "17:00 em Brasília" e, quando difere, "no seu horário". */
  const horariosExtras = scheduleLines(event.startsAt, visitorTimeZone())
    .slice(1)
    .map((l) => `${l.hora} ${l.rotulo}`)
    .join(" · ");

  return (
    <main className="webinar-page webinar-event" id="conteudo" tabIndex={-1}>
      {/* HERO */}
      <section className="section-band dark-band webinar-event-hero">
        <img className="webinar-event-hero-bg" src={heroImage} alt="" />
        <div className="webinar-event-hero-overlay" aria-hidden="true" />
        <div className="section-inner webinar-event-hero-inner">
          <a className="webinar-back" href={HUB_HREF}>
            <ArrowLeft size={16} aria-hidden="true" />
            Webinars
          </a>

          <div className="webinar-event-hero-tags">
            <StatusBadge status={status} />
            <span className="webinar-event-theme">{event.theme}</span>
          </div>

          <h1>{event.title}</h1>
          <p className="webinar-event-subtitle">{event.subtitle}</p>

          <div className="webinar-event-meta">
            <span>
              <CalendarClock size={17} aria-hidden="true" />
              <time dateTime={machineDate(event.startsAt)}>
                {formatEventWeekday(event.startsAt)}, {formatEventDate(event.startsAt)}
              </time>
            </span>
            <span>
              <Clock size={17} aria-hidden="true" />
              {formatEventTimeRange(event.startsAt, event.endsAt)}
            </span>
            <span>
              <Globe2 size={17} aria-hidden="true" />
              {event.timezoneLabel}
              {horariosExtras ? ` · ${horariosExtras}` : ""}
            </span>
          </div>

          <div className="webinar-event-hero-actions">
            {status === "live" ? (
              <button type="button" className="button primary" onClick={scrollToStage}>
                Assistir ao vivo
                <Radio size={18} aria-hidden="true" />
              </button>
            ) : status === "ended" ? (
              <button type="button" className="button primary" onClick={scrollToStage} disabled={!hasReplay}>
                {hasReplay ? "Assistir à gravação" : "Gravação em breve"}
                <PlayCircle size={18} aria-hidden="true" />
              </button>
            ) : event.registrationUrl ? (
              <a className="button primary" href={event.registrationUrl} target="_blank" rel="noreferrer">
                Inscreva-se
                <PlayCircle size={18} aria-hidden="true" />
              </a>
            ) : (
              <a className="button primary" href={icsDataUri(event, url)} download={`${event.slug}.ics`}>
                Adicionar à agenda
                <CalendarPlus size={18} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* PALCO / TRANSMISSÃO */}
      <section className="section-band webinar-stage-section" id={STAGE_ID}>
        <div className="section-inner">
          <StreamStage event={event} status={status} />
        </div>
      </section>

      {/* CONTEÚDO */}
      <section className="section-band webinar-event-body">
        <div className="section-inner webinar-event-layout">
          <div className="webinar-event-main">
            <div className="webinar-block">
              <p className="eyebrow dark">Sobre a mesa-redonda</p>
              <h2>{event.theme}</h2>
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="webinar-prose">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="webinar-block">
              <p className="eyebrow dark">Programação</p>
              <h2>Roteiro da transmissão</h2>
              <AgendaTimeline items={event.agenda} />
            </div>

            <div className="webinar-block">
              <p className="eyebrow dark">
                <Users size={15} aria-hidden="true" /> Composição da mesa
              </p>
              <h2>Palestrantes e moderação</h2>
              <div className="webinar-speaker-grid">
                {event.speakers.map((person, index) => (
                  <SpeakerCard key={person.name} person={person} kind="speaker" index={index} />
                ))}
                {event.moderator ? (
                  <SpeakerCard person={event.moderator} kind="moderator" index={event.speakers.length} />
                ) : null}
              </div>
            </div>
          </div>

          <aside className="webinar-event-aside">
            <div className="webinar-action-card">
              <div className="webinar-action-head">
                <StatusBadge status={status} size="sm" />
                <strong>
                  {status === "live"
                    ? "Transmitindo agora"
                    : status === "upcoming"
                      ? "Garanta sua participação"
                      : "Reveja quando quiser"}
                </strong>
              </div>

              {status === "upcoming" ? <Countdown targetIso={event.startsAt} compact /> : null}

              <div className="webinar-action-buttons">
                {status === "live" ? (
                  <button type="button" className="button primary" onClick={scrollToStage}>
                    Assistir ao vivo
                    <Radio size={18} aria-hidden="true" />
                  </button>
                ) : status === "ended" ? (
                  <button type="button" className="button primary" onClick={scrollToStage} disabled={!hasReplay}>
                    {hasReplay ? "Assistir à gravação" : "Gravação em breve"}
                    <PlayCircle size={18} aria-hidden="true" />
                  </button>
                ) : (
                  <>
                    {event.registrationUrl ? (
                      <a className="button primary" href={event.registrationUrl} target="_blank" rel="noreferrer">
                        Inscreva-se
                        <PlayCircle size={18} aria-hidden="true" />
                      </a>
                    ) : null}
                    <a className="button webinar-button-ghost" href={icsDataUri(event, url)} download={`${event.slug}.ics`}>
                      Adicionar à agenda
                      <CalendarPlus size={18} aria-hidden="true" />
                    </a>
                  </>
                )}
              </div>

              <dl className="webinar-facts">
                <div>
                  <dt>Data</dt>
                  <dd>{formatEventDate(event.startsAt)}</dd>
                </div>
                <div>
                  <dt>Horário</dt>
                  <dd>
                    {formatEventTime(event.startsAt)} · {event.timezoneLabel}
                    {horariosExtras ? ` · ${horariosExtras}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Formato</dt>
                  <dd>Transmissão online · acesso gratuito</dd>
                </div>
                <div>
                  <dt>Tema</dt>
                  <dd>{event.theme}</dd>
                </div>
                {event.acessibilidade?.declaracao ? (
                  <div>
                    <dt>Acessibilidade</dt>
                    <dd>{TEXTO_ACESSIBILIDADE[event.acessibilidade.declaracao]}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </aside>
        </div>
      </section>

      {/* PERGUNTAS */}
      <section className="section-band webinar-question-section">
        <div className="section-inner">
          <QuestionBlock event={event} status={status} />
        </div>
      </section>

      {/* MATERIAIS + PARCEIROS */}
      <section className="section-band webinar-resources-section">
        <div className="section-inner webinar-resources-layout">
          <div className="webinar-block">
            <p className="eyebrow dark">Materiais</p>
            <h2>Documentos e gravações</h2>
            <MaterialsList materials={event.materials} />
          </div>
          <div className="webinar-block">
            <p className="eyebrow dark">Realização</p>
            <h2>Instituições da rede</h2>
            <p className="webinar-prose webinar-partners-note">
              Mesa-redonda promovida pela rede INCT-CONEXAO com a participação das seguintes instituições.
            </p>
            <PartnerStrip partners={event.partners} />
          </div>
        </div>
      </section>
    </main>
  );
}
