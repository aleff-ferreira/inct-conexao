import { ArrowRight, Building2, CalendarX2, Loader2, UsersRound } from "lucide-react";
import { webinarAsset, type WebinarGroup } from "./data";
import { groupHref } from "./router";
import { useGroups } from "./store";
import { absoluteUrl, useWebinarHead } from "./seo";
import { EmptyState } from "./parts";

function GroupCard({ group }: { group: WebinarGroup }) {
  const cover = webinarAsset(group.coverImage ?? "hero-forest.jpg");
  return (
    <a className="webinar-card" href={groupHref(group.slug)}>
      <span className="webinar-card-media">
        <img src={cover} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="webinar-card-body">
        <span className="webinar-card-theme">{group.acronym ?? "Grupo de pesquisa"}</span>
        <strong className="webinar-card-title">{group.name}</strong>
        {group.leaderName || group.institution ? (
          <span className="webinar-card-meta">
            <Building2 size={15} aria-hidden="true" />
            <span>{[group.leaderName, group.institution].filter(Boolean).join(" · ")}</span>
          </span>
        ) : null}
        <span className="webinar-card-cta">
          Ver grupo
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </span>
    </a>
  );
}

export function GroupsHub() {
  const { groups, loading } = useGroups();

  useWebinarHead({
    title: "Grupos de pesquisa | INCT-CONEXAO",
    description:
      "Grupos de pesquisa do INCT-CONEXAO: Saúde Única, clima, biodiversidade, bioeconomia e políticas públicas na Amazônia, cada um com sua agenda e suas transmissões.",
    ogTitle: "Grupos de pesquisa do INCT-CONEXAO",
    ogDescription: "Conheça os grupos da rede amazônica de ciência, tecnologia e inovação.",
    ogImage: absoluteUrl(webinarAsset("hero-forest.jpg")),
    ogType: "website",
    url: absoluteUrl(`${import.meta.env.BASE_URL}#/grupos`),
  });

  return (
    <main className="webinar-page" id="conteudo" tabIndex={-1}>
      <section className="section-band dark-band webinar-hub-hero">
        <img className="webinar-hub-hero-bg" src={webinarAsset("river-amazon.jpg")} alt="" />
        <div className="webinar-hub-hero-overlay" aria-hidden="true" />
        <div className="section-inner webinar-hub-hero-inner">
          <p className="eyebrow">
            <UsersRound size={16} aria-hidden="true" />
            Rede de pesquisa
          </p>
          <h1>Grupos de pesquisa</h1>
          <p className="webinar-hub-hero-text">
            Os grupos do INCT-CONEXAO articulam Saúde Única, clima, biodiversidade, bioeconomia e políticas públicas na
            Amazônia. Cada grupo mantém sua descrição e suas próprias transmissões científicas.
          </p>
        </div>
      </section>

      <section className="section-band webinar-hub-section">
        <div className="section-inner">
          <div className="webinar-section-head">
            <p className="eyebrow dark">Conheça os grupos</p>
            <h2>Quem faz a pesquisa</h2>
          </div>

          {loading ? (
            <div className="webinar-loading">
              <Loader2 size={24} aria-hidden="true" />
              <span>Carregando grupos…</span>
            </div>
          ) : groups.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="Nenhum grupo publicado ainda"
              text="Os grupos de pesquisa do INCT-CONEXAO aparecerão aqui assim que forem publicados."
            />
          ) : (
            <div className="webinar-card-grid">
              {groups.map((group) => (
                <GroupCard key={group.slug} group={group} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
