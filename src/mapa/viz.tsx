/**
 * viz — componentes de visualização reutilizáveis do mapa (SVG puro, sem libs).
 * CountUp (animação de número), Ring (anel de progresso), BarChart (barras),
 * Timeline (linha do tempo climatológica ajustável). Todos respeitam
 * prefers-reduced-motion e trazem rótulos acessíveis.
 */
import { useEffect, useRef, useState } from "react";

const reduz = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Formata inteiros no padrão pt-BR (66962 → "66.962"). */
export const fmtNum = (n: number): string => n.toLocaleString("pt-BR");

/** Número que "conta" de 0 até value (técnica de destaque de marketing). */
export function CountUp({ value, dur = 900, format, className }: { value: number; dur?: number; format?: (n: number) => string; className?: string }) {
  const [n, setN] = useState(() => (reduz() ? value : 0));
  const raf = useRef(0);
  useEffect(() => {
    if (reduz()) { setN(value); return; }
    let start = -1;
    const step = (ts: number) => {
      if (start < 0) start = ts;
      const t = Math.min(1, (ts - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, dur]);
  return <span className={className}>{format ? format(n) : n}</span>;
}

/** Anel de progresso (ex.: "ficha X% completa"). */
export function Ring({ value, max, sub, size = 92, aria }: { value: number; max: number; sub?: string; size?: number; aria?: string }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const pct = max ? Math.min(1, value / max) : 0;
  const [dash, setDash] = useState(reduz() ? c * (1 - pct) : c);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDash(c * (1 - pct)));
    return () => cancelAnimationFrame(id);
  }, [c, pct]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="viz-ring" role="img" aria-label={aria ?? `${Math.round(pct * 100)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="viz-ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} className="viz-ring-fg" strokeDasharray={c} strokeDashoffset={dash} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 - 1} className="viz-ring-num">{Math.round(pct * 100)}%</text>
      {sub ? <text x={size / 2} y={size / 2 + 15} className="viz-ring-sub">{sub}</text> : null}
    </svg>
  );
}

export type BarDatum = { label: string; valor: number; cor?: string; sufixo?: string };

/** Barras horizontais (perfil do estado). Preenchem com animação no mount.
 *  `fmt` formata o valor exibido (padrão: número cru) — útil para milhares. */
export function BarChart({ data, ariaLabel, fmt }: { data: BarDatum[]; ariaLabel?: string; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.valor));
  const mostrar = (v: number) => (fmt ? fmt(v) : String(v));
  return (
    <div className="viz-bars" role="img" aria-label={ariaLabel ?? data.map((d) => `${d.label}: ${mostrar(d.valor)}`).join("; ")}>
      {data.map((d, i) => (
        <div className="viz-bar-row" key={i}>
          <span className="viz-bar-label">{d.label}</span>
          <span className="viz-bar-track">
            <span className="viz-bar-fill" style={{ width: `${(d.valor / max) * 100}%`, background: d.cor, animationDelay: `${i * 70}ms` }} />
          </span>
          <span className="viz-bar-val">{mostrar(d.valor)}{d.sufixo}</span>
        </div>
      ))}
    </div>
  );
}

const MES_CURTO = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Linha do tempo climatológica ajustável (estação chuvosa/seca por região). */
export function Timeline({ chuvoso, mes, onMes, regiao }: { chuvoso: boolean[]; mes: number; onMes: (m: number) => void; regiao: string }) {
  const molhado = chuvoso[mes];
  return (
    <div className="viz-timeline">
      <div className="viz-tl-head">
        <span className={`viz-tl-badge${molhado ? " is-wet" : " is-dry"}`}>{molhado ? "Estação chuvosa" : "Estação seca"}</span>
        <strong>{MES_LONGO[mes]}</strong>
      </div>
      <div className="viz-tl-cells" role="group" aria-label="Meses do ano">
        {chuvoso.map((c, i) => (
          <button key={i} type="button" className={`viz-tl-cell${c ? " is-wet" : ""}${i === mes ? " is-active" : ""}`}
            onClick={() => onMes(i)} aria-pressed={i === mes} aria-label={`${MES_LONGO[i]}: estação ${c ? "chuvosa" : "seca"}`}>
            {MES_CURTO[i]}
          </button>
        ))}
      </div>
      <input type="range" min={0} max={11} value={mes} onChange={(e) => onMes(Number(e.target.value))} className="viz-tl-range" aria-label={`Mês (${MES_LONGO[mes]})`} />
      <p className="viz-tl-note">Padrão climatológico geral da região {regiao} (tendência de chuva). Referência: climatologia/INMET. Não é previsão nem indica risco de doença.</p>
    </div>
  );
}
