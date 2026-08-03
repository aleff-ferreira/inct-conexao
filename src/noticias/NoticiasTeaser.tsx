/**
 * Chamada de notícias na home. Fica dentro do pacote carregado sob demanda
 * (React.lazy no App), então o conteúdo das matérias NÃO entra no bundle
 * inicial do site — o peso não cresce conforme novas matérias são publicadas.
 */
import { Newspaper, ArrowRight } from "lucide-react";
import { noticias } from "./data";
import { NOTICIAS_HREF } from "../webinars/router";
import { NoticiaCard } from "./NoticiaPage";

export default function NoticiasTeaser() {
  const ultimas = noticias.slice(0, 3);
  if (!ultimas.length) return null;

  return (
    <section className="section-band art-teaser-band" id="noticias">
      <div className="section-inner">
        <div className="art-teaser-head">
          <div>
            <p className="eyebrow dark">
              <Newspaper size={15} aria-hidden="true" /> Da rede para o público
            </p>
            <h2>Notícias e expedições</h2>
          </div>
          <a className="button plat-ghost art-teaser-todas" href={NOTICIAS_HREF}>
            Ver todas <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
        <div className="art-grid">
          {ultimas.map((n) => (
            <NoticiaCard key={n.slug} noticia={n} />
          ))}
        </div>
      </div>
    </section>
  );
}
