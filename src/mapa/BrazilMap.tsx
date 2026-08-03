/**
 * BrazilMap — mapa SVG das 27 UFs (geometria oficial do IBGE), com camadas ao
 * estilo de mapa de jogo: profundidade (oceano + relevo sutil + vinheta),
 * conexões animadas da sede para a rede, marcadores de instituições (pontos de
 * interesse), realce/ping de seleção e pulso da sede.
 *
 * Acessível por natureza: cada UF é um <path role="button" tabindex> focável e
 * operável por teclado (Enter/Espaço). Fly-to anima o viewBox (respeita
 * prefers-reduced-motion). Zoom/pan reais (botões, roda, arrasto). As camadas
 * decorativas têm aria-hidden — a informação equivalente está nos rótulos das
 * UFs, no painel e na lista-alternativa.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import type { Uf } from "./types";
import type { Camada } from "./layers";
import { INSTITUICOES_POR_UF, HUB } from "./layers";
import { VIEW, WORLD, focusViewBox, fullViewBox, ufs, ufBySigla } from "./geo";

type Box = [number, number, number, number];
type Pt = [number, number];

export type MapOverlays = { conexoes: boolean; pontos: boolean };
export type TooltipInfo = { titulo: string; sub?: string; tags: string[] };

export type BrazilMapProps = {
  camada: Camada;
  overlays: MapOverlays;
  selecionada: string | null;
  foco: string | null;
  /** enquadramento forçado (ex.: fly-to de região), sobrepõe seleção/foco */
  overrideTarget?: Box | null;
  /** UFs já exploradas (gamificação) — recebem um selo. */
  explorados?: Set<string>;
  destaques?: string[];
  /** Vitrine: só o relevo (sem tinta de dados, conexões, pontos ou rótulos). */
  vitrine?: boolean;
  /** Modo leve/economia de dados: NÃO baixa as imagens pesadas de relevo. */
  leve?: boolean;
  /**
   * Zoom pela roda do mouse. Padrão: ligado.
   *
   * Desligue quando o mapa ficar grudado ao lado de texto que rola. Com o mapa
   * fixo, o cursor passa a história inteira sobre o SVG, e aí o zoom por roda
   * vira armadilha: aproximar é possível, mas depois de aproximado a roda só
   * afasta — o leitor desce a página e não consegue voltar. O toque não sofre
   * disso (`touch-action: pan-y` no `.map-svg`), e os botões de zoom continuam.
   */
  zoomRoda?: boolean;
  reduzirMovimento: boolean;
  onSelecionar: (sigla: string) => void;
  onDestacar: (uf: Uf | null) => void;
  rotuloDe: (uf: Uf) => string;
  tooltipDe: (uf: Uf) => TooltipInfo;
};

const LABEL_MIN_W = 26;
const ASPECT = VIEW.w / VIEW.h;
const MAXZOOM = 7;
const DRAG_THRESHOLD = 5;
/** Relevo 3D real (satélite × sombreamento de DEM), recortado ao Brasil. Web Mercator, alinhado à malha. */
const RELIEVE_URL = `${import.meta.env.BASE_URL}assets/maps/brasil-relevo.webp`;
/** Vizinhos (América do Sul) esmaecidos — moldura "flutuante". */
const VIZINHOS_URL = `${import.meta.env.BASE_URL}assets/maps/brasil-vizinhos.webp`;

function clampView(b: Box): Box {
  let [x, y, w] = b;
  w = Math.min(WORLD.w, Math.max(WORLD.w / MAXZOOM, w));
  const h = w / ASPECT;
  x = Math.max(WORLD.x, Math.min(WORLD.x + WORLD.w - w, x));
  y = Math.max(WORLD.y, Math.min(WORLD.y + WORLD.h - h, y));
  return [x, y, w, h];
}

/** curva suave (arco) entre dois pontos, para as conexões da rede */
function arcPath([ax, ay]: Pt, [bx, by]: Pt): string {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const off = len * 0.16;
  const cx = mx - (dy / len) * off;
  const cy = my + (dx / len) * off;
  return `M${ax} ${ay} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx} ${by}`;
}

export function BrazilMap({
  camada,
  overlays,
  selecionada,
  foco,
  overrideTarget,
  explorados,
  destaques = [],
  vitrine = false,
  leve = false,
  zoomRoda = true,
  reduzirMovimento,
  onSelecionar,
  onDestacar,
  rotuloDe,
  tooltipDe,
}: BrazilMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const target = useMemo<Box>(() => {
    if (overrideTarget) return overrideTarget;
    const sig = selecionada ?? foco;
    const uf = sig ? ufs.find((u) => u.sigla === sig) : undefined;
    return uf ? focusViewBox(uf) : fullViewBox();
  }, [selecionada, foco, overrideTarget]);

  const [view, setViewState] = useState<Box>(() => clampView(target));
  const viewRef = useRef<Box>(view);
  const raf = useRef(0);
  const setView = useCallback((b: Box) => {
    const c = clampView(b);
    viewRef.current = c;
    setViewState(c);
  }, []);

  const animateTo = useCallback(
    (to: Box) => {
      cancelAnimationFrame(raf.current);
      const dest = clampView(to);
      if (reduzirMovimento) { setView(dest); return; }
      const from = viewRef.current;
      let start = -1;
      const dur = 520;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const step = (ts: number) => {
        if (start < 0) start = ts;
        const t = Math.min(1, (ts - start) / dur);
        const k = ease(t);
        setView([from[0] + (dest[0] - from[0]) * k, from[1] + (dest[1] - from[1]) * k, from[2] + (dest[2] - from[2]) * k, from[3] + (dest[3] - from[3]) * k]);
        if (t < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    },
    [reduzirMovimento, setView],
  );

  useEffect(() => {
    animateTo(target);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target[0], target[1], target[2], target[3], reduzirMovimento]);

  // ---- zoom ----
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    cancelAnimationFrame(raf.current);
    const [x, y, w, h] = viewRef.current;
    const nw = w / factor;
    const nh = nw / ASPECT;
    const fx = (cx - x) / w;
    const fy = (cy - y) / h;
    setView([cx - fx * nw, cy - fy * nh, nw, nh]);
  }, [setView]);
  const zoomBy = useCallback((factor: number) => {
    const [x, y, w, h] = viewRef.current;
    zoomAt(factor, x + w / 2, y + h / 2);
  }, [zoomAt]);

  // Converte coordenadas de cliente para o espaço do mapa via getScreenCTM:
  // cobre o "letterboxing" do preserveAspectRatio (o elemento pode ser mais
  // largo que o mapa pintado) — um mapeamento linear pelo getBoundingClientRect
  // faria o zoom derivar para o centro e o arrasto "escorregar" na horizontal.
  const clientToView = useCallback((clientX: number, clientY: number): Pt => {
    const el = svgRef.current;
    const [x, y, w, h] = viewRef.current;
    const ctm = el?.getScreenCTM();
    if (!ctm) return [x + w / 2, y + h / 2];
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }, []);

  // Roda do mouse: zoom SÓ com o cursor sobre o mapa, sem rolar a página junto.
  // O onWheel do React é registrado como listener PASSIVO (preventDefault é
  // ignorado e a página rola ao mesmo tempo) — por isso registramos um listener
  // nativo não-passivo direto no <svg>. Fora do mapa, a página rola normalmente.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !zoomRoda) return;
    const onWheelNative = (e: WheelEvent) => {
      // No LIMITE do zoom não sequestra a rolagem — a página volta a rolar
      // (sem isso o mapa vira uma "armadilha de scroll" no panorama).
      const w = viewRef.current[2];
      const aproxima = e.deltaY < 0;
      if ((aproxima && w <= WORLD.w / MAXZOOM + 0.5) || (!aproxima && w >= WORLD.w - 0.5)) return;
      e.preventDefault();
      const [cx, cy] = clientToView(e.clientX, e.clientY);
      zoomAt(aproxima ? 1.18 : 1 / 1.18, cx, cy);
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [clientToView, zoomAt, zoomRoda]);

  // ---- pan + tooltip ----
  const drag = useRef<{ px: number; py: number } | null>(null);
  const moved = useRef(false);
  const [panning, setPanning] = useState(false);
  const [hoverUf, setHoverUf] = useState<Uf | null>(null);
  const [ptr, setPtr] = useState<Pt>([0, 0]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { px: e.clientX, py: e.clientY };
    moved.current = false;
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // posição do ponteiro relativa ao canvas (para o tooltip)
    const cr = canvasRef.current?.getBoundingClientRect();
    if (cr) setPtr([e.clientX - cr.left, e.clientY - cr.top]);
    if (!drag.current) return;
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!moved.current) {
      moved.current = true;
      setPanning(true);
      setHoverUf(null);
      svgRef.current?.setPointerCapture?.(e.pointerId);
    }
    drag.current = { px: e.clientX, py: e.clientY };
    cancelAnimationFrame(raf.current);
    const [x, y, w, h] = viewRef.current;
    // escala real "px de tela -> unidades do mapa" (considera o letterboxing)
    const ctm = svgRef.current?.getScreenCTM();
    const k = ctm ? 1 / ctm.a : 0;
    setView([x - dx * k, y - dy * k, w, h]);
  }, [setView]);
  const endPan = useCallback((e: React.PointerEvent) => {
    drag.current = null;
    if (panning) { setPanning(false); svgRef.current?.releasePointerCapture?.(e.pointerId); }
  }, [panning]);

  const enter = useCallback((u: Uf) => { setHoverUf(u); onDestacar(u); }, [onDestacar]);
  const leave = useCallback(() => { setHoverUf(null); onDestacar(null); }, [onDestacar]);
  // foco por TECLADO: o tooltip segue o cursor, mas sem mouse ele ficaria numa
  // posição obsoleta — ancora no centróide do estado focado (projeção atual).
  const enterTeclado = useCallback((u: Uf) => {
    const ctm = svgRef.current?.getScreenCTM();
    const cr = canvasRef.current?.getBoundingClientRect();
    if (ctm && cr) {
      const p = new DOMPoint(u.centroid[0], u.centroid[1]).matrixTransform(ctm);
      setPtr([p.x - cr.left, p.y - cr.top]);
    }
    enter(u);
  }, [enter]);

  const selecionarSeClique = useCallback((sigla: string) => {
    if (moved.current) { moved.current = false; return; }
    onSelecionar(sigla);
  }, [onSelecionar]);

  const destaqueSet = useMemo(() => new Set(destaques), [destaques]);
  const canPan = view[2] < WORLD.w - 0.5;
  const zoomK = view[2] / WORLD.w; // <1 quando aproximado (para manter marcadores ~constantes)

  // ---- geometria das camadas decorativas ----
  const hubUf = ufBySigla(HUB);
  const conexoes = useMemo(() => {
    if (!hubUf) return [];
    return ufs
      .filter((u) => u.sigla !== HUB && INSTITUICOES_POR_UF[u.sigla])
      .map((u) => ({ sigla: u.sigla, d: arcPath(hubUf.centroid, u.centroid) }));
  }, [hubUf]);
  const pontos = useMemo(
    () => ufs.filter((u) => INSTITUICOES_POR_UF[u.sigla]).map((u) => ({ u, n: INSTITUICOES_POR_UF[u.sigla] })),
    [],
  );

  const selUf = selecionada ? ufBySigla(selecionada) : null;
  const tip = hoverUf && !panning ? tooltipDe(hoverUf) : null;

  return (
    <div className="map-canvas" ref={canvasRef}>
      <div className="map-zoom" role="group" aria-label="Controles de zoom do mapa">
        <button type="button" className="icon-button map-zoom-btn" onClick={() => zoomBy(1.5)} aria-label="Aproximar"><Plus size={18} aria-hidden /></button>
        <button type="button" className="icon-button map-zoom-btn" onClick={() => zoomBy(1 / 1.5)} aria-label="Afastar"><Minus size={18} aria-hidden /></button>
        <button type="button" className="icon-button map-zoom-btn" onClick={() => animateTo(target)} aria-label="Reenquadrar o mapa"><Maximize2 size={16} aria-hidden /></button>
      </div>

      <svg
        ref={svgRef}
        className={`map-svg${panning ? " is-panning" : canPan ? " can-pan" : ""}${vitrine ? " is-vitrine" : ""}`}
        viewBox={view.join(" ")}
        role="group"
        aria-label="Mapa do Brasil por unidade federativa. Use Tab para percorrer os estados e Enter para abrir. Roda do mouse aproxima; arraste para deslocar."
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={(e) => { endPan(e); leave(); }}
        onPointerCancel={endPan}
      >
        <title>Mapa do Brasil — unidades federativas</title>
        <defs>
          {/* recorte no contorno do Brasil (união das UFs) */}
          <clipPath id="mapBrasilClip">
            {ufs.map((u) => <path key={`clip-${u.sigla}`} d={u.path} />)}
          </clipPath>
          {/* sombra que "levanta" o continente do fundo claro */}
          <filter id="mapLift" x="-15%" y="-12%" width="130%" height="138%">
            <feDropShadow dx="0" dy="9" stdDeviation="11" floodColor="#41504a" floodOpacity="0.3" />
          </filter>
          <filter id="mapGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* recorte por estado — usado pelo efeito de "erguer" no hover/seleção */}
          {ufs.map((u) => (
            <clipPath key={`clipuf-${u.sigla}`} id={`mapClip-${u.sigla}`}><path d={u.path} /></clipPath>
          ))}
          {/* sombra difusa do estado erguido (borrão barato: só o bbox do estado) */}
          <filter id="mapSoftBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.7" />
          </filter>
          {/* luz que varre o território no modo vitrine */}
          <linearGradient id="mapSheenGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* vizinhos (América do Sul) esmaecidos — moldura flutuante, atrás de tudo */}
        {!leve ? (
          <image className="map-vizinhos" href={VIZINHOS_URL} x={WORLD.x} y={WORLD.y} width={WORLD.w} height={WORLD.h}
            preserveAspectRatio="none" aria-hidden />
        ) : null}

        {/* relevo realista recortado ao Brasil, com sombra de elevação.
            Modo leve: silhueta plana no lugar (não baixa ~2,5 MB de imagem). */}
        {leve ? (
          <g className="map-base-leve" filter="url(#mapLift)" aria-hidden>
            {ufs.map((u) => <path key={`lv-${u.sigla}`} d={u.path} />)}
          </g>
        ) : (
          <g className="map-relief" filter="url(#mapLift)">
            <image href={RELIEVE_URL} x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h}
              preserveAspectRatio="none" clipPath="url(#mapBrasilClip)" aria-hidden />
          </g>
        )}

        {/* vitrine: uma luz suave varre o território (o mapa "respira").
            O clip vai NO PRÓPRIO rect: um <g clipPath> isolaria o grupo e o
            soft-light deixaria de enxergar o relevo. Some ao aproximar
            (senão a faixa viraria um "nevoeiro" periódico de tela cheia). */}
        {vitrine && !leve && !reduzirMovimento && zoomK > 0.8 ? (
          <rect className="map-vista-sheen" clipPath="url(#mapBrasilClip)" aria-hidden
            x={-720} y={-160} width={620} height={1050} fill="url(#mapSheenGrad)" />
        ) : null}

        {/* tinta translúcida da camada ativa (só onde há dado) — o relevo continua visível */}
        {!vitrine ? (
          <g className="map-tint" aria-hidden>
            {ufs.map((u) => {
              const v = camada.valor(u);
              const on = v != null && v !== 0;
              return (
                <path key={`tint-${u.sigla}`} d={u.path} fill={camada.cor(u)} fillOpacity={on ? 0.42 : 0} stroke="none" />
              );
            })}
          </g>
        ) : null}

        {/* fronteiras estaduais em "sulco" gravado no terreno (halo de sombra +
            vinco escuro + fio de luz), com traçado animado na entrada — nada de
            linha chapada */}
        <g className={`map-frontier${vitrine ? " is-vitrine" : ""}${!reduzirMovimento ? " is-anim" : ""}`}
           style={{ "--mapk": zoomK } as React.CSSProperties} aria-hidden>
          <g className="map-frontier-halo">
            {ufs.map((u) => <path key={`fh-${u.sigla}`} d={u.path} vectorEffect="non-scaling-stroke" />)}
          </g>
          <g className="map-frontier-dark">
            {ufs.map((u) => <path key={`fd-${u.sigla}`} d={u.path} vectorEffect="non-scaling-stroke" />)}
          </g>
          <g className="map-frontier-light">
            {ufs.map((u, i) => (
              <path key={`fz-${u.sigla}`} d={u.path} pathLength={1} vectorEffect="non-scaling-stroke"
                style={{ animationDelay: `${i * 36}ms` }} />
            ))}
          </g>
        </g>

        {/* conexões da rede (sede -> UFs com instituições) */}
        {!vitrine && overlays.conexoes && hubUf ? (
          <g className={`map-conexoes${reduzirMovimento ? " is-still" : ""}`} aria-hidden>
            {conexoes.map((c) => (
              <path key={`cx-${c.sigla}`} d={c.d} className="map-conexao" vectorEffect="non-scaling-stroke" />
            ))}
            {conexoes.map((c) => (
              <path key={`fl-${c.sigla}`} d={c.d} className="map-conexao-flow" vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        ) : null}

        {/* marcadores (pontos de interesse) — pino marrom com anel branco, estilo mapa editorial */}
        {!vitrine && overlays.pontos ? (
          <g className="map-pontos">
            {pontos.map(({ u, n }) => {
              const r = (3.4 + Math.sqrt(n) * 1.1) * Math.max(0.55, zoomK);
              const isHub = u.sigla === HUB;
              return (
                <g key={`poi-${u.sigla}`} transform={`translate(${u.centroid[0]} ${u.centroid[1]})`}
                   className={`map-poi${isHub ? " is-hub" : ""}`}
                   onClick={() => selecionarSeClique(u.sigla)}
                   onPointerEnter={() => enter(u)} onPointerLeave={leave}>
                  {isHub ? <circle className="map-poi-pulse" r={r * 2.6} /> : null}
                  <circle className="map-poi-ring" r={r * 2} vectorEffect="non-scaling-stroke" />
                  <circle className="map-poi-dot" r={r} vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}
          </g>
        ) : null}

        {/* estado "erguido" (hover ou seleção): cópia do próprio relevo recortada
            ao estado, com sombra difusa e leve escala — o estado levanta do mapa */}
        {(() => {
          const lift = hoverUf && !panning ? hoverUf : selUf;
          if (!lift) return null;
          const [lcx, lcy] = lift.centroid;
          const v = camada.valor(lift);
          const tinted = !vitrine && v != null && v !== 0;
          return (
            <g className="map-uf-lift" aria-hidden key={`lift-${lift.sigla}`}
               transform={`translate(${lcx} ${lcy}) scale(1.013) translate(${-lcx} ${-lcy})`}>
              <path d={lift.path} className="map-uf-lift-shadow" filter="url(#mapSoftBlur)" />
              <g clipPath={`url(#mapClip-${lift.sigla})`}>
                {leve
                  ? <path d={lift.path} fill="#e9f0ea" />
                  : <image href={RELIEVE_URL} x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} preserveAspectRatio="none" />}
                {tinted ? <path d={lift.path} fill={camada.cor(lift)} fillOpacity={0.3} /> : null}
              </g>
              {/* na seleção o anel fica por conta do .map-sel-outline (senão
                  os dois contornos, um escalado e outro não, dobrariam a borda) */}
              {lift.sigla !== selecionada ? (
                <path d={lift.path} className="map-uf-lift-ring" vectorEffect="non-scaling-stroke" />
              ) : null}
            </g>
          );
        })()}

        {/* interação: UFs focáveis por cima (transparentes) */}
        <g>
          {ufs.map((u) => {
            const sel = u.sigla === selecionada;
            const foc = u.sigla === foco;
            const dest = destaqueSet.has(u.sigla);
            const hov = hoverUf?.sigla === u.sigla;
            const exp = explorados?.has(u.sigla);
            const cls = ["map-uf", sel ? "is-selected" : "", foc && !sel ? "is-focus" : "", dest ? "is-highlight" : "", hov ? "is-hover" : "", exp ? "is-explored" : ""].filter(Boolean).join(" ");
            return (
              <path
                key={u.sigla}
                d={u.path}
                className={cls}
                role="button"
                tabIndex={0}
                aria-label={rotuloDe(u)}
                aria-pressed={sel}
                vectorEffect="non-scaling-stroke"
                onClick={() => selecionarSeClique(u.sigla)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelecionar(u.sigla); } }}
                onPointerEnter={() => enter(u)}
                onPointerLeave={leave}
                onFocus={() => enterTeclado(u)}
                onBlur={leave}
              />
            );
          })}
        </g>

        {/* realce + ping da seleção */}
        {selUf ? (
          <g aria-hidden className="map-sel-fx">
            <path d={selUf.path} className="map-sel-outline" vectorEffect="non-scaling-stroke" />
            {!reduzirMovimento ? (
              <circle key={`ping-${selUf.sigla}`} cx={selUf.centroid[0]} cy={selUf.centroid[1]} className="map-ping" r={6} />
            ) : null}
          </g>
        ) : null}

        {!vitrine ? (
          <g className="map-labels" aria-hidden>
            {ufs.map((u) => {
              if (u.bbox[2] - u.bbox[0] < LABEL_MIN_W) return null;
              return <text key={u.sigla} x={u.centroid[0]} y={u.centroid[1]} className="map-label">{u.sigla}</text>;
            })}
          </g>
        ) : null}
      </svg>

      {/* tooltip que segue o cursor */}
      {tip ? (
        <div className="map-tip" style={{ left: ptr[0], top: ptr[1] }} role="status" aria-hidden>
          <p className="map-tip-title">{tip.titulo}{tip.sub ? <span> {tip.sub}</span> : null}</p>
          {tip.tags.length ? (
            <div className="map-tip-tags">{tip.tags.map((t, i) => <span key={i}>{t}</span>)}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { VIEW };
