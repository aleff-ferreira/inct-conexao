/**
 * Página de uma matéria (#/noticias/<slug>).
 * Reaproveita o gerenciador de <head> dos webinars para título, Open Graph e
 * dados estruturados (NewsArticle + FAQPage quando a matéria tem um bloco FAQ).
 */
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, MapPin, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { absoluteUrl, useWebinarHead } from "../webinars/seo";
import { noticiaAsset, noticiaBySlug, noticiasRecentes, capaDe, formatarData, tempoDeLeitura } from "./data";
import { BlocoView, formatar } from "./blocks";
import { NOTICIAS_HREF, noticiaHref } from "../webinars/router";
import type { Noticia } from "./types";

/**
 * Vídeo de fundo do topo da matéria. Segue o MESMO padrão do hero da home
 * (`HeroVideo`, em App.tsx), que já funciona em produção:
 * - toca sozinho, em laço e sem som, sem controle de pausa;
 * - define o ATRIBUTO `muted`, não só a propriedade. O React define apenas a
 *   propriedade, e alguns navegadores só liberam o autoplay com o atributo
 *   presente. Era exatamente o que faltava aqui;
 * - retenta o play em `canplay`, porque a primeira tentativa pode cair enquanto
 *   o arquivo ainda carrega;
 * - pausa quando o topo sai da tela, para não gastar bateria à toa;
 * - no celular carrega um arquivo mais leve, em vez de sumir com o vídeo;
 * - se o arquivo falhar, sobra o pôster, que é a mesma cena parada.
 */
function VideoDeFundo({ slug, arquivo, arquivoMobile, poster }: {
  slug: string;
  arquivo: string;
  arquivoMobile?: string;
  poster: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [falhou, setFalhou] = useState(false);
  const src = useMemo(() => {
    const pequeno = typeof window !== "undefined" && window.matchMedia("(max-width: 680px)").matches;
    return noticiaAsset(slug, pequeno && arquivoMobile ? arquivoMobile : arquivo);
  }, [slug, arquivo, arquivoMobile]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.setAttribute("muted", "");
    const tentarTocar = () => {
      if (video.paused) void video.play().catch(() => undefined);
    };
    tentarTocar();
    video.addEventListener("canplay", tentarTocar);
    const io = new IntersectionObserver(
      ([entrada]) => (entrada.isIntersecting ? tentarTocar() : video.pause()),
      { threshold: 0.05 },
    );
    io.observe(video);
    return () => {
      video.removeEventListener("canplay", tentarTocar);
      io.disconnect();
    };
  }, [src]);

  const capa = noticiaAsset(slug, poster);
  // Um elemento só. O atributo `poster` já é a primeira pintura, então NÃO se
  // deve empilhar um <img> por baixo: ambos ficam a 42% de opacidade e o still
  // transparece através do vídeo, somando as duas imagens.
  if (falhou) return <img src={capa} alt="" fetchPriority="high" decoding="async" />;
  return (
    <video
      ref={videoRef}
      src={src}
      poster={capa}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      tabIndex={-1}
      onError={() => setFalhou(true)}
    />
  );
}

/** Links públicos do autor viram `sameAs` (o Google usa para desambiguar pessoas). */
function perfisDe(a: { lattes?: string; linkedin?: string; url?: string }): string[] {
  return [a.lattes, a.linkedin, a.url].filter((u): u is string => !!u && u.trim().length > 0);
}

function jsonLdDe(n: Noticia, url: string, imagem?: string): object {
  const faq = n.blocos.find((b) => b.tipo === "faq");
  const instituicao = { "@type": "Organization", name: "INCT-CONEXAO", url: "https://inct-conexao.com.br/" };
  const artigo = {
    "@type": "NewsArticle",
    headline: n.titulo,
    description: n.resumo,
    ...(imagem ? { image: [imagem] } : {}),
    datePublished: n.data,
    dateModified: n.atualizadoEm ?? n.data,
    inLanguage: "pt-BR",
    author: n.autores?.length
      ? n.autores.map((a) => {
          const perfis = perfisDe(a);
          return { "@type": "Person", name: a.nome, ...(perfis.length ? { sameAs: perfis } : {}) };
        })
      : instituicao,
    publisher: instituicao,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(n.tags?.length ? { keywords: n.tags.join(", ") } : {}),
  };
  if (faq && faq.tipo === "faq" && faq.itens.length) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        artigo,
        {
          "@type": "FAQPage",
          mainEntity: faq.itens.map((i) => ({
            "@type": "Question",
            name: i.pergunta,
            acceptedAnswer: { "@type": "Answer", text: i.resposta },
          })),
        },
      ],
    };
  }
  return { "@context": "https://schema.org", ...artigo };
}

export default function NoticiaPage({ slug }: { slug: string }) {
  const noticia = noticiaBySlug(slug);
  const url = absoluteUrl(`${import.meta.env.BASE_URL}#${noticiaHref(slug).slice(1)}`);
  const capa = noticia ? capaDe(noticia) : undefined;
  const ogImagem = noticia?.seo?.ogImage
    ? absoluteUrl(noticiaAsset(noticia.slug, noticia.seo.ogImage))
    : capa
      ? absoluteUrl(capa.src)
      : undefined;

  useWebinarHead({
    title: noticia ? `${noticia.titulo} | INCT-CONEXAO` : "Matéria não encontrada | INCT-CONEXAO",
    description: noticia?.seo?.ogDescription ?? noticia?.resumo,
    keywords: noticia?.seo?.keywords ?? noticia?.tags,
    ogTitle: noticia?.seo?.ogTitle ?? noticia?.titulo,
    ogDescription: noticia?.seo?.ogDescription ?? noticia?.resumo,
    ogImage: ogImagem,
    ogType: "article",
    url,
    jsonLd: noticia ? jsonLdDe(noticia, url, ogImagem) : null,
  });

  if (!noticia) {
    return (
      <main className="webinar-page art-page" id="conteudo" tabIndex={-1}>
        <section className="section-band">
          <div className="section-inner art-vazio">
            <h1>Matéria não encontrada</h1>
            <p>O endereço pode ter mudado ou a matéria ainda não foi publicada.</p>
            <a className="button primary" href={NOTICIAS_HREF}>
              <ArrowLeft size={17} aria-hidden="true" /> Ver todas as notícias
            </a>
          </div>
        </section>
      </main>
    );
  }

  const minutos = tempoDeLeitura(noticia);
  const outras = noticiasRecentes(3, noticia.slug);

  return (
    <main className="webinar-page art-page" id="conteudo" tabIndex={-1}>
      {/* ---- topo ---- */}
      <header className="art-hero">
        {noticia.videoHero ? (
          <div className="art-hero-foto art-hero-video" aria-hidden="true">
            <VideoDeFundo
              slug={noticia.slug}
              arquivo={noticia.videoHero.arquivo}
              arquivoMobile={noticia.videoHero.arquivoMobile}
              poster={noticia.videoHero.poster}
            />
          </div>
        ) : capa ? (
          <div className="art-hero-foto" aria-hidden="true">
            <img src={capa.src} alt="" fetchPriority="high" decoding="async" />
          </div>
        ) : null}
        <div className="section-inner art-hero-inner">
          <a className="art-voltar" href={NOTICIAS_HREF}>
            <ArrowLeft size={15} aria-hidden="true" /> Notícias
          </a>
          {noticia.chapeu ? <p className="art-chapeu">{noticia.chapeu}</p> : null}
          <h1>{noticia.titulo}</h1>
          <p className="art-linha-fina">{formatar(noticia.resumo)}</p>

          {noticia.autores?.length ? (
            <p className="art-assinatura">
              <span className="art-assinatura-papel">{noticia.autores[0].papel ?? "Texto"}</span>
              {noticia.autores.map((a, i) => (
                <span key={i} className="art-autor">
                  {i > 0 ? <span className="art-autor-sep">e</span> : null}
                  <strong>{a.nome}</strong>
                  {perfisDe(a).length ? (
                    <span className="art-autor-links">
                      {a.lattes ? <a href={a.lattes} target="_blank" rel="noreferrer author">Lattes</a> : null}
                      {a.linkedin ? <a href={a.linkedin} target="_blank" rel="noreferrer author me">LinkedIn</a> : null}
                      {a.url ? <a href={a.url} target="_blank" rel="noreferrer author">Perfil</a> : null}
                    </span>
                  ) : null}
                </span>
              ))}
            </p>
          ) : null}

          <div className="art-meta">
            <span>
              <CalendarDays size={15} aria-hidden="true" />
              <time dateTime={noticia.data}>{formatarData(noticia.data)}</time>
            </span>
            <span>
              <Clock3 size={15} aria-hidden="true" /> {minutos} min de leitura
            </span>
            {noticia.local ? (
              <span>
                <MapPin size={15} aria-hidden="true" /> {noticia.local}
              </span>
            ) : null}
          </div>

          {noticia.numeros?.length ? (
            <dl className="art-numeros">
              {noticia.numeros.map((n, i) => (
                <div key={i}>
                  <dt>{n.rotulo}</dt>
                  <dd>{n.valor}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {noticia.imagemCredito ? <p className="art-hero-credito">{noticia.imagemCredito}</p> : null}
        </div>
      </header>

      {/* ---- corpo ---- */}
      <section className="section-band art-corpo-band">
        <div className="section-inner">
          <article className="art-corpo">
            {noticia.blocos.map((b, i) => (
              <BlocoView key={i} bloco={b} slug={noticia.slug} />
            ))}

            {noticia.equipe?.length ? (
              <>
                <h2 className="art-h2">Quem esteve em campo</h2>
                <ul className="art-equipe">
                  {noticia.equipe.map((p, i) => (
                    <li key={i}>
                      <strong>{p.nome}</strong>
                      {p.instituicao ? <span>{p.instituicao}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {noticia.creditos ? <p className="art-creditos">{formatar(noticia.creditos)}</p> : null}

            {noticia.fontes?.length ? (
              <p className="art-fontes">
                <span>Fontes:</span>{" "}
                {noticia.fontes.map((f, i) => (
                  <span key={i}>
                    {i > 0 ? "; " : ""}
                    {f.url ? (
                      <a href={f.url} target="_blank" rel="noreferrer">
                        {f.titulo}
                      </a>
                    ) : (
                      f.titulo
                    )}
                  </span>
                ))}
              </p>
            ) : null}

            <Compartilhar titulo={noticia.titulo} url={url} />

            {noticia.resumoIngles ? (
              <section className="art-ingles" lang="en">
                <h2>In English</h2>
                <p>{noticia.resumoIngles}</p>
              </section>
            ) : null}
          </article>
        </div>
      </section>

      {/* ---- leia também ---- */}
      {outras.length ? (
        <section className="section-band art-relacionadas">
          <div className="section-inner">
            <div className="webinar-section-head">
              <p className="eyebrow dark">Leia também</p>
              <h2>Outras notícias da rede</h2>
            </div>
            <div className="art-grid">
              {outras.map((n) => (
                <NoticiaCard key={n.slug} noticia={n} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

/** Botões de compartilhamento (WhatsApp, LinkedIn e copiar link). */
function Compartilhar({ titulo, url }: { titulo: string; url: string }) {
  const [copiado, setCopiado] = useState(false);
  const enc = encodeURIComponent;
  return (
    <div className="art-compartilhar">
      <span>
        <Share2 size={15} aria-hidden="true" /> Compartilhe
      </span>
      <a href={`https://api.whatsapp.com/send?text=${enc(`${titulo} ${url}`)}`} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`} target="_blank" rel="noreferrer">
        LinkedIn
      </a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noreferrer">
        Facebook
      </a>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(
            () => {
              setCopiado(true);
              window.setTimeout(() => setCopiado(false), 1800);
            },
            () => undefined,
          );
        }}
      >
        {copiado ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}

/** Cartão de matéria usado no hub, no "leia também" e na home. */
export function NoticiaCard({ noticia }: { noticia: Noticia }) {
  const capa = capaDe(noticia);
  return (
    <a className="art-card" href={noticiaHref(noticia.slug)}>
      {capa ? (
        <span className="art-card-media">
          <img src={capa.src} alt="" loading="lazy" decoding="async" />
        </span>
      ) : null}
      <span className="art-card-corpo">
        {noticia.chapeu ? <small className="art-card-chapeu">{noticia.chapeu}</small> : null}
        <strong>{noticia.titulo}</strong>
        <span className="art-card-resumo">{noticia.resumo}</span>
        <span className="art-card-meta">
          <time dateTime={noticia.data}>{formatarData(noticia.data)}</time>
          <span aria-hidden="true">·</span>
          {tempoDeLeitura(noticia)} min
          <ArrowRight size={15} aria-hidden="true" />
        </span>
      </span>
    </a>
  );
}
