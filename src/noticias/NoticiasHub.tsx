/**
 * Hub de notícias (#/noticias): a matéria mais recente em destaque e as demais
 * em grade. Cresce sozinho conforme novas matérias entram em
 * `src/content/noticias/` — nenhuma alteração de código é necessária.
 */
import { Newspaper, CalendarDays, Clock3, ArrowRight, MapPin } from "lucide-react";
import { absoluteUrl, useWebinarHead } from "../webinars/seo";
import { noticias, capaDe, formatarData, tempoDeLeitura } from "./data";
import { noticiaHref } from "../webinars/router";
import { NoticiaCard } from "./NoticiaPage";
import { webinarAsset } from "../webinars/data";

export default function NoticiasHub() {
  useWebinarHead({
    title: "Notícias e expedições | INCT-CONEXAO",
    description:
      "Reportagens de campo, expedições científicas e resultados da rede INCT-CONEXAO: Saúde Única, clima, biodiversidade e bioeconomia na Amazônia.",
    ogTitle: "Notícias do INCT-CONEXAO",
    ogDescription: "Reportagens de campo e expedições científicas da rede amazônica de Saúde Única.",
    ogImage: absoluteUrl(webinarAsset("hero-forest.jpg")),
    ogType: "website",
    url: absoluteUrl(`${import.meta.env.BASE_URL}#/noticias`),
  });

  const [destaque, ...resto] = noticias;
  const capa = destaque ? capaDe(destaque) : undefined;

  return (
    <main className="webinar-page art-page" id="conteudo" tabIndex={-1}>
      <section className="section-band dark-band art-hub-hero">
        <div className="section-inner">
          <p className="eyebrow">
            <Newspaper size={16} aria-hidden="true" /> Da rede para o público
          </p>
          <h1>Notícias e expedições</h1>
          <p className="art-hub-lede">
            Reportagens de campo, resultados de pesquisa e bastidores das expedições do INCT-CONEXAO nas comunidades
            da Amazônia.
          </p>
        </div>
      </section>

      {!noticias.length ? (
        <section className="section-band">
          <div className="section-inner art-vazio">
            <h2>Ainda não há matérias publicadas</h2>
            <p>As reportagens da rede aparecerão aqui assim que forem publicadas.</p>
          </div>
        </section>
      ) : null}

      {destaque ? (
        <section className="section-band art-destaque-band">
          <div className="section-inner">
            <a className="art-destaque-card" href={noticiaHref(destaque.slug)}>
              {capa ? (
                <span className="art-destaque-media">
                  <img src={capa.src} alt="" loading="eager" decoding="async" />
                </span>
              ) : null}
              <span className="art-destaque-corpo">
                {destaque.chapeu ? <small className="art-card-chapeu">{destaque.chapeu}</small> : null}
                <strong>{destaque.titulo}</strong>
                <span className="art-destaque-resumo">{destaque.resumo}</span>
                <span className="art-card-meta">
                  <CalendarDays size={15} aria-hidden="true" />
                  <time dateTime={destaque.data}>{formatarData(destaque.data)}</time>
                  <span aria-hidden="true">·</span>
                  <Clock3 size={15} aria-hidden="true" /> {tempoDeLeitura(destaque)} min
                  {destaque.local ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <MapPin size={15} aria-hidden="true" /> {destaque.local}
                    </>
                  ) : null}
                </span>
                <span className="art-destaque-cta">
                  Ler a matéria <ArrowRight size={16} aria-hidden="true" />
                </span>
              </span>
            </a>
          </div>
        </section>
      ) : null}

      {resto.length ? (
        <section className="section-band art-lista-band">
          <div className="section-inner">
            <div className="webinar-section-head">
              <p className="eyebrow dark">Arquivo</p>
              <h2>Todas as matérias</h2>
            </div>
            <div className="art-grid">
              {resto.map((n) => (
                <NoticiaCard key={n.slug} noticia={n} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
