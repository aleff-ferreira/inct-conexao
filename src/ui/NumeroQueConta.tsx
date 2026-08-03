/**
 * Número que conta de zero até o valor quando entra na tela.
 *
 * Por que existe: as seções de rede e impacto da home são grades de números
 * parados. Fazê-los contar na primeira vez que aparecem é o sinal mais barato
 * de que a página está viva, sem exigir que a pessoa clique em nada.
 *
 * Regras que o componente respeita sozinho:
 * - anima UMA vez por número (repetir a cada rolagem viraria enfeite irritante);
 * - com `prefers-reduced-motion`, mostra o valor final direto, sem animar;
 * - aceita textos MISTOS ("35 instituições", "~R$ 2 mil"): anima só o primeiro
 *   número e preserva o que vem antes e depois. Texto sem número nenhum
 *   ("Amazônia Legal") passa intacto, então dá para aplicar a uma lista toda
 *   sem escolher item por item.
 */
import { useEffect, useRef, useState } from "react";

/** Quebra "~35 instituições" em prefixo "~", número 35 e sufixo " instituições". */
function partes(texto: string): { pre: string; n: number; pos: string; sep: string } | null {
  const m = /^(\D*?)(\d[\d.,]*)(.*)$/s.exec(texto);
  if (!m) return null;
  const bruto = m[2];
  // separador de milhar do pt-BR é o ponto; a vírgula é decimal e aqui não interessa
  const n = Number(bruto.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return { pre: m[1], n, pos: m[3], sep: bruto.includes(".") ? "." : "" };
}

function prefereMenosMovimento(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function NumeroQueConta({ valor, dur = 1100 }: { valor: string; dur?: number }) {
  const p = partes(valor);
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState<number | null>(null);
  const jaAnimou = useRef(false);

  useEffect(() => {
    if (!p || jaAnimou.current) return;
    const el = ref.current;
    if (!el) return;
    if (prefereMenosMovimento()) {
      jaAnimou.current = true;
      setN(p.n);
      return;
    }
    let raf = 0;
    const animar = () => {
      jaAnimou.current = true;
      let inicio = -1;
      const passo = (ts: number) => {
        if (inicio < 0) inicio = ts;
        const t = Math.min(1, (ts - inicio) / dur);
        // desaceleração cúbica: rápido no começo, assenta no fim
        setN(Math.round(p.n * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    };
    const io = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting && !jaAnimou.current) {
          animar();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, dur]);

  // Sem número no texto: devolve como está.
  if (!p) return <>{valor}</>;

  const exibido = n === null ? 0 : n;
  const formatado = p.sep ? exibido.toLocaleString("pt-BR") : String(exibido);
  return (
    <span ref={ref}>
      {p.pre}
      {formatado}
      {p.pos}
    </span>
  );
}
