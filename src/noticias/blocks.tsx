/**
 * Desenho dos blocos do corpo da matéria.
 *
 * SEGURANÇA: o texto vindo do conteúdo NUNCA vira HTML. A formatação simples
 * (**negrito**, _itálico_, [link](url)) é convertida em elementos React pelo
 * `formatar()` abaixo — não há `dangerouslySetInnerHTML` em lugar nenhum, então
 * uma matéria não consegue injetar script no site.
 */
import { Fragment, type ReactNode } from "react";
import type { Bloco, NoticiaImagem } from "./types";
import { noticiaAsset } from "./data";

/* ------------------------------------------------------------------ */
/*  Formatação inline segura                                           */
/* ------------------------------------------------------------------ */

/** Só aceitamos links http(s) e âncoras internas — nada de `javascript:`. */
function linkSeguro(href: string): string | null {
  const h = href.trim();
  return /^(https?:\/\/|\/|#)/i.test(h) ? h : null;
}

/**
 * Converte **negrito**, _itálico_ e [texto](url) em nós React.
 * Qualquer coisa fora desses padrões continua sendo texto puro.
 */
export function formatar(texto: string): ReactNode[] {
  const padrao = /\*\*([^*]+)\*\*|_([^_]+)_|\[([^\]]+)\]\(([^)\s]+)\)/g;
  const saida: ReactNode[] = [];
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = padrao.exec(texto)) !== null) {
    if (m.index > ultimo) saida.push(texto.slice(ultimo, m.index));
    if (m[1]) {
      saida.push(<strong key={i++}>{m[1]}</strong>);
    } else if (m[2]) {
      saida.push(<em key={i++}>{m[2]}</em>);
    } else if (m[3] && m[4]) {
      const href = linkSeguro(m[4]);
      saida.push(
        href ? (
          <a key={i++} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
            {m[3]}
          </a>
        ) : (
          <Fragment key={i++}>{m[3]}</Fragment>
        ),
      );
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) saida.push(texto.slice(ultimo));
  return saida;
}

/** Parágrafos separados por linha em branco. */
function Paragrafos({ texto }: { texto: string }) {
  return (
    <>
      {texto
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{formatar(p)}</p>
        ))}
    </>
  );
}

function Figura({ slug, imagem, largura }: { slug: string; imagem: NoticiaImagem; largura?: number }) {
  return (
    <img
      src={noticiaAsset(slug, imagem.arquivo)}
      alt={imagem.alt}
      loading="lazy"
      decoding="async"
      width={largura}
    />
  );
}

/** Legenda + crédito de uma figura. */
function Legenda({ legenda, credito }: { legenda?: string; credito?: string }) {
  if (!legenda && !credito) return null;
  return (
    <figcaption>
      {legenda ? formatar(legenda) : null}
      {credito ? <span className="art-credito">{legenda ? " " : ""}{credito}</span> : null}
    </figcaption>
  );
}

/* ------------------------------------------------------------------ */
/*  Blocos                                                             */
/* ------------------------------------------------------------------ */

export function BlocoView({ bloco, slug }: { bloco: Bloco; slug: string }) {
  switch (bloco.tipo) {
    case "texto":
      return <Paragrafos texto={bloco.texto} />;

    case "subtitulo":
      return <h2 className="art-h2">{formatar(bloco.texto)}</h2>;

    case "imagem":
      return (
        <figure className="art-figura">
          <Figura slug={slug} imagem={bloco.imagem} />
          <Legenda legenda={bloco.legenda} credito={bloco.credito} />
        </figure>
      );

    case "galeria":
      return (
        <figure className="art-figura art-galeria">
          <div className={`art-galeria-grid art-galeria-${bloco.imagens.length}`}>
            {bloco.imagens.map((im, i) => (
              <Figura key={i} slug={slug} imagem={im} />
            ))}
          </div>
          <Legenda legenda={bloco.legenda} credito={bloco.credito} />
        </figure>
      );

    case "video": {
      const capa = bloco.poster ? noticiaAsset(slug, bloco.poster) : undefined;
      return (
        <figure className="art-figura art-video">
          {/* Os vídeos são verticais (celular/drone) e, no tamanho original,
              ficariam como uma tira estreita no meio da coluna. O palco é uma
              janela com a largura do texto, e o vídeo a preenche recortado no
              centro (ver .art-video-palco em styles.css). */}
          <div className="art-video-palco">
            {/* preload="none": o arquivo só é baixado se a pessoa apertar play */}
            <video controls playsInline preload="none" poster={capa} aria-label={bloco.descricao}>
              <source src={noticiaAsset(slug, bloco.arquivo)} type="video/mp4" />
              {bloco.descricao}
            </video>
          </div>
          <Legenda legenda={bloco.legenda} credito={bloco.credito} />
          {bloco.transcricao ? (
            <details className="art-transcricao">
              <summary>Transcrição do áudio</summary>
              <Paragrafos texto={bloco.transcricao} />
            </details>
          ) : null}
        </figure>
      );
    }

    case "citacao":
      return (
        <blockquote className="art-citacao">
          <p>{formatar(bloco.texto)}</p>
          {bloco.autor ? <cite>{bloco.autor}</cite> : null}
        </blockquote>
      );

    case "destaque":
      return (
        <aside className="art-destaque">
          {bloco.titulo ? <p className="art-destaque-titulo">{bloco.titulo}</p> : null}
          <ul>
            {bloco.itens.map((item, i) => (
              <li key={i}>{formatar(item)}</li>
            ))}
          </ul>
        </aside>
      );

    case "etapas":
      return (
        <div className="art-etapas-bloco">
          {bloco.titulo ? <h3 className="art-h3">{bloco.titulo}</h3> : null}
          <ol className="art-etapas">
            {bloco.itens.map((item, i) => (
              <li key={i}>
                <strong>{item.titulo}</strong> {formatar(item.texto)}
              </li>
            ))}
          </ol>
        </div>
      );

    case "tabela":
      return (
        <div className="art-tabela">
          {bloco.titulo ? <h3>{bloco.titulo}</h3> : null}
          <dl>
            {bloco.linhas.map((l, i) => (
              <div key={i} className={l.estado === "feito" ? "is-feito" : undefined}>
                <span className="art-tabela-marca" aria-hidden />
                <dt>{l.rotulo}</dt>
                <dd>{formatar(l.valor)}</dd>
              </div>
            ))}
          </dl>
        </div>
      );

    case "faq":
      return (
        <div className="art-faq">
          {bloco.titulo ? <h2 className="art-h2">{bloco.titulo}</h2> : null}
          {bloco.itens.map((item, i) => (
            <details key={i} open={i === 0}>
              <summary>{item.pergunta}</summary>
              <div className="art-faq-resposta">
                <Paragrafos texto={item.resposta} />
              </div>
            </details>
          ))}
        </div>
      );

    default:
      return null;
  }
}
