/**
 * Chamada do Mapa Interativo na home.
 *
 * Não é uma imagem com um link: é o MESMO componente `BrazilMap` da página do
 * mapa, com o relevo real. Passar o mouse acende o estado, clicar abre a ficha
 * dele em `#/mapa/<uf>`, e os botões de região dão um fly-to sem sair da home.
 * A ideia é que a pessoa perceba, na primeira tela de rolagem, que aquilo é
 * manipulável — e só então decida ir para a página inteira.
 *
 * Vive no pacote carregado sob demanda (React.lazy no App), então o relevo e a
 * geometria do IBGE não entram no bundle inicial do site.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Compass, MapPin, Layers } from "lucide-react";
import { BrazilMap, type MapOverlays, type TooltipInfo } from "./BrazilMap";
import { construirCamadas, INSTITUICOES_POR_UF, totalAmazoniaLegal } from "./layers";
import { temConteudo, totalNotificacoes, resumoNotificacoes, conteudoDe } from "./content";
import { regionViewBox, REGIOES } from "./geo";
import { MAPA_HREF } from "../webinars/router";
import type { Uf } from "./types";

const OVERLAYS: MapOverlays = { conexoes: false, pontos: true };

/** Regiões com atalho no teaser: as que fazem sentido para a rede. */
const ATALHOS = ["Norte", "Nordeste", "Centro-Oeste"] as const;

/** Camadas oferecidas na home, na ordem. Menos que na página inteira: aqui o
 *  objetivo é mostrar que o mapa se repinta, não esgotar as opções. */
const LENTES = ["amazonia-legal", "instituicoes", "vagas-ic-2026", "doencas-notificacoes"];

function prefereMenosMovimento(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Economia de dados do navegador, o mesmo critério usado na página do mapa. */
function economiaDeDados(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
}

/**
 * O relevo do mapa pesa 2,13 MB (brasil-relevo.webp mais os vizinhos). Baixar
 * isso em TODA visita à home, para uma seção que fica abaixo da dobra, é o tipo
 * de custo que castiga justamente o público em internet medida.
 *
 * Então o relevo só entra quando as duas condições valem: a seção chegou perto
 * da tela e o navegador não pediu economia de dados. Até lá o BrazilMap desenha
 * a silhueta real das UFs, que é geometria já carregada, e a interação toda
 * (hover, clique, camadas, fly-to) funciona igual. É degradação de textura,
 * não de conteúdo.
 */
function useRelevoLiberado(alvo: React.RefObject<HTMLElement | null>): boolean {
  const [liberado, setLiberado] = useState(false);
  useEffect(() => {
    if (economiaDeDados()) return;
    const el = alvo.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setLiberado(true);
          io.disconnect();
        }
      },
      // começa a baixar um pouco antes de aparecer, para não chegar em branco
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [alvo]);
  return liberado;
}

export default function MapaTeaser() {
  const camadas = useMemo(() => construirCamadas(temConteudo, resumoNotificacoes), []);
  const lentes = useMemo(() => LENTES.map((id) => camadas.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c), [camadas]);
  const [lente, setLente] = useState(0);
  const camada = lentes[lente] ?? camadas[0];
  const [hover, setHover] = useState<Uf | null>(null);
  const [regiao, setRegiao] = useState<string | null>(null);
  const reduzir = useMemo(prefereMenosMovimento, []);
  const palcoRef = useRef<HTMLDivElement>(null);
  const relevo = useRelevoLiberado(palcoRef);

  const alvo = useMemo(() => (regiao ? regionViewBox(regiao) : null), [regiao]);

  const abrir = useCallback((sigla: string) => {
    window.location.hash = `#/mapa/${sigla.toLowerCase()}`;
  }, []);

  const tooltipDe = useCallback((u: Uf): TooltipInfo => {
    const tags: string[] = [];
    const inst = INSTITUICOES_POR_UF[u.sigla];
    if (inst) tags.push(`${inst} instituiç${inst > 1 ? "ões" : "ão"}`);
    const n = totalNotificacoes(u.sigla);
    if (n) tags.push(`${n.toLocaleString("pt-BR")} notificações`);
    tags.push(temConteudo(u.sigla) ? "ficha disponível" : "em preparação");
    return { titulo: u.nome, sub: u.sigla, tags: tags.slice(0, 3) };
  }, []);

  const rotuloDe = useCallback((u: Uf) => {
    const partes = [`${u.nome}, ${u.regiao}`];
    partes.push(temConteudo(u.sigla) ? "ficha disponível" : "ficha em preparação");
    partes.push("Enter para abrir no mapa");
    return partes.join(". ");
  }, []);

  /* O painel lateral reage ao passar o mouse: é o retorno imediato que mostra
     que o mapa responde. Sem hover, mostra o resumo da rede. */
  const uf = hover;
  const ficha = uf ? conteudoDe(uf.sigla) : undefined;

  return (
    <section className="section-band mapa-teaser-band" id="mapa-teaser">
      <div className="section-inner">
        <div className="mapa-teaser-head">
          <div>
            <p className="eyebrow dark">
              <Compass size={15} aria-hidden="true" /> Observatório territorial
            </p>
            <h2>Explore o território da rede</h2>
            <p className="mapa-teaser-lede">
              Passe o mouse para ver o que a rede tem em cada estado e clique para abrir a ficha.
              São {totalAmazoniaLegal} unidades da Amazônia Legal e o Brasil inteiro, com relevo real.
            </p>
          </div>
          <a className="button plat-ghost mapa-teaser-cta" href={MAPA_HREF}>
            Abrir o mapa completo <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

        {/* Alternador de camadas: clicar repinta o mapa na hora. É o controle
            mais tangível da seção, então fica acima do mapa, sempre visível. */}
        <div className="mapa-teaser-lentes" role="tablist" aria-label="Camada de dados do mapa">
          {lentes.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={i === lente}
              className={`mapa-teaser-lente${i === lente ? " is-on" : ""}`}
              onClick={() => setLente(i)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mapa-teaser-grid">
          <div className="mapa-teaser-palco" ref={palcoRef}>
            <BrazilMap
              camada={camada}
              overlays={OVERLAYS}
              selecionada={null}
              /* `foco` NÃO segue o mouse: se seguisse, o mapa reenquadraria a cada
                 estado sob o cursor e a pessoa perderia a referência do país.
                 O hover só acende o estado e alimenta o painel ao lado. */
              foco={null}
              overrideTarget={alvo}
              leve={!relevo}
              reduzirMovimento={reduzir}
              onSelecionar={abrir}
              onDestacar={setHover}
              rotuloDe={rotuloDe}
              tooltipDe={tooltipDe}
            />
          </div>

          <aside className="mapa-teaser-painel">
            {/* Só o miolo troca com o hover. Os atalhos de região ficam FORA do
                aria-live e fora da condicional: controle que desaparece quando o
                mouse entra no mapa é controle inalcançável. */}
            <div className="mapa-teaser-miolo" aria-live="polite">
            {uf ? (
              <>
                <p className="mapa-teaser-kicker">
                  <MapPin size={13} aria-hidden="true" /> {uf.regiao}
                  {uf.amazoniaLegal ? <span className="mapa-teaser-selo">Amazônia Legal</span> : null}
                </p>
                <h3>{uf.nome}</h3>
                <dl className="mapa-teaser-dados">
                  <div>
                    <dt>Instituições</dt>
                    <dd>{INSTITUICOES_POR_UF[uf.sigla] ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Notificações</dt>
                    <dd>{totalNotificacoes(uf.sigla)?.toLocaleString("pt-BR") ?? "sem dado"}</dd>
                  </div>
                  <div>
                    <dt>Ficha</dt>
                    <dd>{ficha ? `${ficha.doencas?.length ?? 0} doenças` : "em preparação"}</dd>
                  </div>
                </dl>
                {ficha?.destaque ? <p className="mapa-teaser-destaque">{ficha.destaque}</p> : null}
                <a className="button primary mapa-teaser-abrir" href={`#/mapa/${uf.sigla.toLowerCase()}`}>
                  Abrir ficha de {uf.sigla} <ArrowRight size={15} aria-hidden="true" />
                </a>
              </>
            ) : (
              <>
                <p className="mapa-teaser-kicker">
                  <Layers size={13} aria-hidden="true" /> Como usar
                </p>
                <h3>O mapa responde</h3>
                <p className="mapa-teaser-vazio">
                  Passe o mouse por um estado para ver os dados dele aqui. Use a roda do mouse sobre
                  o mapa para aproximar, arraste para deslocar e clique para abrir a ficha completa.
                </p>
                {/* A legenda muda com a camada: é o que dá sentido às cores. */}
                <div className="mapa-teaser-legenda">
                  <span>{camada.label}</span>
                  <ul>
                    {camada.legenda.map((item) => (
                      <li key={item.rotulo}>
                        <i style={{ background: item.cor }} aria-hidden="true" />
                        {item.rotulo}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            </div>

            <div className="mapa-teaser-atalhos">
              <span>Enquadrar</span>
              {ATALHOS.filter((r) => REGIOES.includes(r)).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`mapa-teaser-chip${regiao === r ? " is-on" : ""}`}
                  aria-pressed={regiao === r}
                  onClick={() => setRegiao(regiao === r ? null : r)}
                >
                  {r}
                </button>
              ))}
              <button
                type="button"
                className={`mapa-teaser-chip${regiao === null ? " is-on" : ""}`}
                aria-pressed={regiao === null}
                onClick={() => setRegiao(null)}
              >
                Brasil
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
