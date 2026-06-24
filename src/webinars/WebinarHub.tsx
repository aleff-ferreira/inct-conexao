import { CalendarClock, CalendarX2, Loader2, PlayCircle, Radio, Video } from "lucide-react";
import { featuredFrom, pastFrom, resolveStatus, upcomingFrom, webinarAsset } from "./data";
import { eventHref, useNow } from "./router";
import { useWebinars } from "./store";
import { absoluteUrl, useWebinarHead } from "./seo";
import { formatEventDate, formatEventTime, machineDate } from "./format";
import { Countdown, EmptyState, EventCard, StatusBadge } from "./parts";

export function WebinarHub() {
  const now = useNow();
  const { events, loading } = useWebinars();
  const upcoming = upcomingFrom(events, now);
  const past = pastFrom(events, now);
  const featured = featuredFrom(events, now);

  useWebinarHead({
    title: "Webinars e transmissões científicas | INCT-CONEXAO",
    description:
      "Centro de transmissões científicas do INCT-CONEXAO: mesas-redondas e webinars ao vivo e sob demanda sobre Saúde Única, clima, biodiversidade e bioeconomia na Amazônia.",
    ogTitle: "Webinars científicos do INCT-CONEXAO",
    ogDescription:
      "Mesas-redondas e transmissões ao vivo sobre Saúde Única, clima, biodiversidade e bioeconomia na Amazônia.",
    ogImage: absoluteUrl(webinarAsset("hero-forest.jpg")),
    ogType: "website",
    url: absoluteUrl(`${import.meta.env.BASE_URL}#/webinars`),
  });

  const hasAny = events.length > 0;
  const featuredStatus = featured ? resolveStatus(featured, now) : "upcoming";
  // Only drop the featured event from the list that matches its OWN status, so a
  // featured past event still appears in the archive (and vice-versa).
  const upcomingRest =
    featured && featuredStatus === "upcoming" ? upcoming.filter((event) => event.slug !== featured.slug) : upcoming;
  const pastRest =
    featured && featuredStatus === "ended" ? past.filter((event) => event.slug !== featured.slug) : past;

  const upcomingEmptyText =
    featuredStatus === "upcoming"
      ? "Não há outras transmissões agendadas além da que está em destaque. Acompanhe esta página para novas datas."
      : "Nenhuma transmissão agendada no momento. Acompanhe os canais do INCT-CONEXAO para novas datas.";

  return (
    <main className="webinar-page" id="conteudo" tabIndex={-1}>
      <section className="section-band dark-band webinar-hub-hero">
        <img className="webinar-hub-hero-bg" src={webinarAsset("hero-forest.jpg")} alt="" />
        <div className="webinar-hub-hero-overlay" aria-hidden="true" />
        <div className="section-inner webinar-hub-hero-inner">
          <p className="eyebrow">
            <Radio size={16} aria-hidden="true" />
            Centro de transmissões científicas
          </p>
          <h1>Webinars INCT-CONEXAO</h1>
          <p className="webinar-hub-hero-text">
            Mesas-redondas científicas ao vivo e sob demanda, conectando a rede amazônica de Saúde Única, clima,
            biodiversidade e bioeconomia ao público, a gestores e à comunidade científica.
          </p>
          <div className="webinar-hub-hero-chips" aria-hidden="true">
            <span>
              <Radio size={15} /> Transmissão ao vivo
            </span>
            <span>
              <Video size={15} /> Gravações sob demanda
            </span>
            <span>
              <CalendarClock size={15} /> Agenda científica
            </span>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="section-band webinar-hub-section">
          <div className="section-inner">
            <div className="webinar-loading">
              <Loader2 size={24} aria-hidden="true" />
              <span>Carregando transmissões…</span>
            </div>
          </div>
        </section>
      ) : !hasAny ? (
        <section className="section-band webinar-hub-section">
          <div className="section-inner">
            <EmptyState
              icon={CalendarX2}
              title="Ainda não há transmissões publicadas"
              text="O centro de transmissões científicas do INCT-CONEXAO está sendo preparado. Em breve, mesas-redondas e webinars aparecerão aqui."
            />
          </div>
        </section>
      ) : null}

      {!loading && featured ? (
        <section className="section-band webinar-hub-section webinar-featured-section">
          <div className="section-inner">
            <div className="webinar-section-head">
              <p className="eyebrow dark">{featuredStatus === "live" ? "Ao vivo agora" : featuredStatus === "upcoming" ? "Próxima transmissão" : "Em destaque"}</p>
              <h2>{featuredStatus === "live" ? "Acompanhe a transmissão em andamento" : featuredStatus === "upcoming" ? "Prepare-se para a próxima mesa-redonda" : "Reveja a mesa-redonda mais recente"}</h2>
            </div>

            <article className="webinar-featured">
              <a className="webinar-featured-media" href={eventHref(featured.slug)} aria-label={`Abrir: ${featured.title}`}>
                <img src={webinarAsset(featured.heroImage ?? "hero-forest.jpg")} alt="" loading="lazy" decoding="async" />
                <StatusBadge status={featuredStatus} />
              </a>
              <div className="webinar-featured-body">
                <span className="webinar-featured-theme">{featured.theme}</span>
                <h3>{featured.title}</h3>
                <p className="webinar-featured-summary">{featured.summary}</p>
                <div className="webinar-featured-meta">
                  <span>
                    <CalendarClock size={16} aria-hidden="true" />
                    <time dateTime={machineDate(featured.startsAt)}>
                      {formatEventDate(featured.startsAt)} · {formatEventTime(featured.startsAt)}
                    </time>
                  </span>
                  <span className="webinar-featured-tz">{featured.timezoneLabel}</span>
                </div>

                {featuredStatus === "upcoming" ? <Countdown targetIso={featured.startsAt} compact /> : null}

                <div className="webinar-featured-actions">
                  <a className="button primary" href={eventHref(featured.slug)}>
                    {featuredStatus === "live" ? "Assistir ao vivo" : featuredStatus === "upcoming" ? "Ver detalhes e se preparar" : "Assistir à gravação"}
                    <PlayCircle size={18} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {!loading && hasAny ? (
        <section className="section-band webinar-hub-section webinar-hub-upcoming">
          <div className="section-inner">
            <div className="webinar-section-head">
              <p className="eyebrow dark">Próximas transmissões</p>
              <h2>Agenda das mesas-redondas</h2>
            </div>
            {upcomingRest.length ? (
              <div className="webinar-card-grid">
                {upcomingRest.map((event) => (
                  <EventCard key={event.slug} event={event} status={resolveStatus(event, now)} href={eventHref(event.slug)} />
                ))}
              </div>
            ) : (
              <EmptyState icon={CalendarClock} title="Sem novas datas agendadas" text={upcomingEmptyText} />
            )}
          </div>
        </section>
      ) : null}

      {!loading && hasAny ? (
        <section className="section-band webinar-hub-section webinar-hub-archive">
          <div className="section-inner">
            <div className="webinar-section-head">
              <p className="eyebrow dark">Arquivo de gravações</p>
              <h2>Reveja transmissões anteriores</h2>
            </div>
            {pastRest.length ? (
              <div className="webinar-card-grid">
                {pastRest.map((event) => (
                  <EventCard key={event.slug} event={event} status={resolveStatus(event, now)} href={eventHref(event.slug)} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Video}
                title="As gravações aparecerão aqui"
                text="Assim que as mesas-redondas forem realizadas, os replays ficarão disponíveis neste arquivo para consulta."
              />
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
