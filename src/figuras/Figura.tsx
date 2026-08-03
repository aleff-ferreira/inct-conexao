/**
 * O invólucro de figura.
 *
 * Recebe só um `id`; título, fonte, licença, colunas e caixa vêm do registro.
 * Assim é impossível publicar um gráfico com a fonte escrita à mão no JSX.
 *
 * A DEGRADAÇÃO, que é o ponto todo:
 *
 *   1. A primeira coisa pintada é sempre o SVG estático, o MESMO arquivo que
 *      quem não tem JavaScript recebe. Ele já traz eixos, valores, título e
 *      fonte: se nada mais acontecer, a figura está completa e citável.
 *   2. Só depois, e só se valer a pena, entra a camada interativa por cima —
 *      mira, leitura ponto a ponto, navegação por teclado. Ela reusa a mesma
 *      geometria do desenho (`geometria()`), então nunca aponta para um lugar
 *      onde o traço não está.
 *   3. Com `?leve=1` ou `saveData`, a interatividade não entra. Quem está numa
 *      conexão cara na Amazônia recebe 3 kB de SVG e nada mais.
 *
 * O rodapé não é enfeite: fonte com ano, licença, link para a origem e CSV são
 * o que separa uma figura de uma ilustração.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { baixarCsv } from "./csv";
import { geometria } from "./desenho";
import type { Serie } from "./desenho";
import type { Caixa } from "./tipos";
import { figuraPorId } from "./registro";
import { fmtBR } from "./tipos";

/** `?leve=1` na hash ou economia de dados do sistema. */
function modoLeve(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hash.includes("leve=1")) return true;
  const c = (navigator as { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}

/** Extrai as séries do SVG já desenhado, para a camada interativa não redesenhar. */
function seriesDaFigura(id: string): { series: Serie[]; rotulos: string[] } | null {
  const fig = figuraPorId(id);
  if (!fig) return null;
  const linhas = fig.linhas();
  const chaves = fig.colunas.slice(1);
  return {
    series: chaves.map((c) => ({
      rotulo: c.rotulo,
      cor: "",
      pontos: linhas.map((l) => ({ x: Number(l[fig.colunas[0].chave]), y: Number(l[c.chave] ?? 0) })),
    })),
    rotulos: chaves.map((c) => c.rotulo),
  };
}

/**
 * Qual das duas caixas está no ar agora.
 *
 * A escolha do arquivo é do `<picture>`, mas a mira precisa saber a mesma coisa:
 * ela desenha num viewBox, e apontar com as coordenadas da caixa larga sobre o
 * SVG estreito colocaria a linha longe do traço. O ponto de corte é o mesmo
 * `700px` da media query — dois valores diferentes aqui seriam um bug que só
 * aparece na faixa entre eles.
 */
const CORTE_ESTREITO = "(max-width: 700px)";

function useCaixaAtiva(largo: Caixa, estreito: Caixa): Caixa {
  const [pequeno, setPequeno] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(CORTE_ESTREITO).matches,
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(CORTE_ESTREITO);
    const aoMudar = () => setPequeno(mq.matches);
    aoMudar();
    mq.addEventListener("change", aoMudar);
    return () => mq.removeEventListener("change", aoMudar);
  }, []);
  return pequeno ? estreito : largo;
}

export function Figura({ id, className }: { id: string; className?: string }) {
  const fig = figuraPorId(id);
  const svgId = useId();
  const alvo = useRef<HTMLDivElement>(null);
  const [interativo, setInterativo] = useState(false);
  const [foco, setFoco] = useState<number | null>(null);

  const caixa = useCaixaAtiva(
    fig?.caixa ?? { largura: 1, altura: 1 },
    fig?.caixaMobile ?? { largura: 1, altura: 1 },
  );
  const dados = useMemo(() => (fig ? seriesDaFigura(fig.id) : null), [fig]);
  // `false` no carimbo: a geometria tem de ser a do SVG EMBUTIDO, que tem
  // margem de topo menor por não repetir o título.
  const geo = useMemo(
    () => (fig && dados ? geometria(dados.series, caixa, false) : null),
    [fig, dados, caixa],
  );

  /* Sobe para interativo só quando a figura chega perto da tela. Antes disso
     não há motivo para pagar por listener nenhum — e em modo leve nunca sobe. */
  useEffect(() => {
    if (modoLeve()) return;
    const el = alvo.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInterativo(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const aoMover = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!geo || !fig) return;
      const r = e.currentTarget.getBoundingClientRect();
      // Converte pixel de tela para coordenada do viewBox: o SVG escala com a
      // largura, então a razão nunca é 1 e usar clientX cru erraria o ponto.
      const naCaixa = ((e.clientX - r.left) / r.width) * caixa.largura;
      setFoco(geo.xMaisProximo(naCaixa));
    },
    [geo, caixa],
  );

  const aoTeclado = useCallback(
    (e: React.KeyboardEvent) => {
      if (!geo) return;
      const vs = geo.valoresX;
      const i = foco == null ? vs.length - 1 : vs.indexOf(foco);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        setFoco(vs[Math.min(vs.length - 1, Math.max(0, i + (e.key === "ArrowRight" ? 1 : -1)))]);
      } else if (e.key === "Home") {
        e.preventDefault();
        setFoco(vs[0]);
      } else if (e.key === "End") {
        e.preventDefault();
        setFoco(vs[vs.length - 1]);
      } else if (e.key === "Escape") {
        setFoco(null);
      }
    },
    [geo, foco],
  );

  if (!fig) {
    // Falha barulhenta em desenvolvimento, silenciosa em produção: um id errado
    // não pode derrubar a página, mas também não pode passar despercebido.
    if (import.meta.env.DEV) console.error(`<Figura id="${id}"> não está em src/figuras/registro.ts`);
    return null;
  }

  const valores = foco != null && dados
    ? dados.series.map((s, i) => ({ rotulo: dados.rotulos[i], y: s.pontos.find((p) => p.x === foco)?.y ?? null }))
    : [];

  return (
    <figure className={`figura${className ? ` ${className}` : ""}`} ref={alvo}>
      <figcaption className="figura-cab">
        <h3 className="figura-titulo">{fig.titulo}</h3>
        <p className="figura-sub">{fig.subtitulo}</p>
      </figcaption>

      <div
        className="figura-palco"
        style={{
          "--fig-prop": `${fig.caixa.largura} / ${fig.caixa.altura}`,
          "--fig-prop-sm": `${fig.caixaMobile.largura} / ${fig.caixaMobile.altura}`,
        } as React.CSSProperties}
        onPointerMove={interativo ? aoMover : undefined}
        onPointerLeave={interativo ? () => setFoco(null) : undefined}
        onKeyDown={interativo ? aoTeclado : undefined}
        tabIndex={interativo ? 0 : undefined}
        role={interativo ? "application" : undefined}
        aria-label={interativo ? `${fig.titulo}. Use as setas para percorrer os anos.` : undefined}
        aria-describedby={`${svgId}-tabela`}
      >
        {/* O estático é sempre a base. `width`/`height` reservam o espaço: é o
            que mantém o CLS em zero, e é o que o Our World in Data faz.
            A variante estreita entra por `<picture>`, e não por CSS, porque o
            navegador precisa escolher ANTES de baixar: só um dos dois arquivos
            é buscado. */}
        <picture>
          <source
            media="(max-width: 700px)"
            srcSet={`${import.meta.env.BASE_URL}figuras/${fig.id}-embed-sm.svg`}
            width={fig.caixaMobile.largura}
            height={fig.caixaMobile.altura}
          />
          <img
            className="figura-svg"
            src={`${import.meta.env.BASE_URL}figuras/${fig.id}-embed.svg`}
            width={fig.caixa.largura}
            height={fig.caixa.altura}
            alt={`${fig.titulo}. ${fig.subtitulo}.`}
            loading="lazy"
            decoding="async"
          />
        </picture>

        {interativo && geo && foco != null ? (
          <svg
            className="figura-mira"
            viewBox={`0 0 ${caixa.largura} ${caixa.altura}`}
            aria-hidden="true"
            focusable="false"
          >
            <line x1={geo.px(foco)} y1={geo.area.y0} x2={geo.px(foco)} y2={geo.area.y1} />
            {valores.map((v, i) =>
              v.y == null ? null : <circle key={i} cx={geo.px(foco)} cy={geo.py(v.y)} r={4.5} />,
            )}
          </svg>
        ) : null}

        {interativo && foco != null ? (
          <div
            className="figura-leitura"
            style={{ left: `${(geo!.px(foco) / caixa.largura) * 100}%` }}
            role="status"
            aria-live="polite"
          >
            <strong>{foco}</strong>
            {valores.map((v, i) => (
              <span key={i}>
                {dados!.rotulos.length > 1 ? `${v.rotulo}: ` : ""}
                {v.y == null ? "sem dado" : fmtBR(v.y)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="figura-rodape">
        <p className="figura-fonte">
          Fonte: <a href={fig.fonte.url} target="_blank" rel="noopener noreferrer">{fig.fonte.titulo}</a>
          {" — "}{fig.fonte.publicador} ({fig.fonte.ano}). {fig.fonte.licenca}.
        </p>
        <div className="figura-acoes">
          <button type="button" className="figura-botao" onClick={() => baixarCsv(fig)}>
            Baixar dados (CSV)
          </button>
          <a className="figura-botao" href={`${import.meta.env.BASE_URL}figuras/index.html#${fig.id}`}>
            Versão estática
          </a>
        </div>
      </div>

      {fig.fonte.nota ? (
        <details className="figura-nota">
          <summary>Como ler este número</summary>
          <p>{fig.fonte.nota}</p>
        </details>
      ) : null}

      {/* A tabela é a figura para quem usa leitor de tela. Fica visualmente
          escondida, nunca `display:none`, que a tiraria da árvore acessível. */}
      <table id={`${svgId}-tabela`} className="figura-tabela-oculta">
        <caption>{fig.titulo} — {fig.subtitulo}</caption>
        <thead>
          <tr>{fig.colunas.map((c) => <th key={c.chave} scope="col">{c.rotulo}</th>)}</tr>
        </thead>
        <tbody>
          {fig.linhas().map((l, i) => (
            <tr key={i}>{fig.colunas.map((c) => <td key={c.chave}>{String(l[c.chave] ?? "")}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
