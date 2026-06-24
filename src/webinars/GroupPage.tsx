import { ArrowLeft, Building2, ExternalLink, Loader2, Radio, UserRound } from "lucide-react";
import { resolveStatus, webinarAsset, webinarsOfGroup } from "./data";
import { GROUPS_HREF, eventHref } from "./router";
import { useGroup, useWebinars } from "./store";
import { absoluteUrl, useWebinarHead } from "./seo";
import { EmptyState, EventCard } from "./parts";

function NotFound() {
  useWebinarHead({ title: "Grupo não encontrado | INCT-CONEXAO" });
  return (
    <main className="webinar-page" id="conteudo" tabIndex={-1}>
      <section className="section-band webinar-hub-section">
        <div className="section-inner">
          <EmptyState
            icon={Radio}
            title="Grupo não encontrado"
            text="O endereço acessado não corresponde a nenhum grupo de pesquisa publicado."
            action={
              <a className="button primary" href={GROUPS_HREF}>
                Ver todos os grupos
              </a>
            }
          />
        </div>
      </section>
    </main>
  );
}

export function GroupPage({ slug }: { slug: string }) {
  const { group, loading } = useGroup(slug);
  const { events } = useWebinars();

  const url = absoluteUrl(`${import.meta.env.BASE_URL}#/grupos/${slug}`);
  const ogImage = group ? absoluteUrl(webinarAsset(group.coverImage ?? "hero-forest.jpg")) : undefined;

  useWebinarHead(
    group
      ? {
          title: `${group.name} | Grupos INCT-CONEXAO`,
          description: group.description.split(/\n\n+/)[0] || group.name,
          ogTitle: group.name,
          ogDescription: group.description.split(/\n\n+/)[0] || group.name,
          ogImage,
          ogType: "article",
          url,
        }
      : { title: loading ? "Carregando grupo… | INCT-CONEXAO" : "Grupo não encontrado | INCT-CONEXAO" },
  );

  if (loading) {
    return (
      <main className="webinar-page" id="conteudo" tabIndex={-1}>
        <section className="section-band webinar-hub-section">
          <div className="section-inner">
            <div className="webinar-loading">
              <Loader2 size={24} aria-hidden="true" />
              <span>Carregando grupo…</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!group) return <NotFound />;

  const cover = webinarAsset(group.coverImage ?? "hero-forest.jpg");
  const paragraphs = group.description.split(/\n\n+/).filter(Boolean);
  const groupWebinars = webinarsOfGroup(events, slug);

  return (
    <main className="webinar-page webinar-event" id="conteudo" tabIndex={-1}>
      <section className="section-band dark-band webinar-event-hero">
        <img className="webinar-event-hero-bg" src={cover} alt="" />
        <div className="webinar-event-hero-overlay" aria-hidden="true" />
        <div className="section-inner webinar-event-hero-inner">
          <a className="webinar-back" href={GROUPS_HREF}>
            <ArrowLeft size={16} aria-hidden="true" />
            Grupos
          </a>
          <div className="webinar-event-hero-tags">
            <span className="webinar-event-theme">{group.acronym ?? "Grupo de pesquisa"}</span>
          </div>
          <h1>{group.name}</h1>
          <div className="webinar-event-meta">
            {group.leaderName ? (
              <span>
                <UserRound size={17} aria-hidden="true" />
                {group.leaderName}
              </span>
            ) : null}
            {group.institution ? (
              <span>
                <Building2 size={17} aria-hidden="true" />
                {group.institution}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section-band webinar-event-body">
        <div className="section-inner">
          <div className="webinar-block">
            <p className="eyebrow dark">Sobre o grupo</p>
            <h2>{group.acronym ?? group.name}</h2>
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="webinar-prose">
                {paragraph}
              </p>
            ))}
            {group.links && group.links.length ? (
              <div className="webinar-speaker-links" style={{ marginTop: 16 }}>
                {group.links.map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {groupWebinars.length ? (
        <section className="section-band webinar-hub-archive">
          <div className="section-inner">
            <div className="webinar-section-head">
              <p className="eyebrow dark">Transmissões do grupo</p>
              <h2>Webinars deste grupo</h2>
            </div>
            <div className="webinar-card-grid">
              {groupWebinars.map((event) => (
                <EventCard key={event.slug} event={event} status={resolveStatus(event)} href={eventHref(event.slug)} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
