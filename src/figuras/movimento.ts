/**
 * Movimento reduzido, uma convenção só.
 *
 * O projeto tinha duas. `viz.tsx` lia a media query uma vez, no corpo do
 * componente; `NumeroQueConta.tsx` lia dentro do efeito. Nenhuma das duas
 * escutava mudança, então quem liga "reduzir movimento" no sistema com o site
 * aberto continuava vendo animação até recarregar — e essa pessoa é justamente
 * quem tem enxaqueca vestibular ou distúrbio de atenção e acabou de pedir para
 * a tela parar de se mexer.
 *
 * `usaMovimentoReduzido` escuta. `movimentoReduzido` continua existindo para
 * quem precisa do valor fora de componente.
 */
import { useEffect, useState } from "react";

const CONSULTA = "(prefers-reduced-motion: reduce)";

/** Leitura pontual. Seguro em SSR e em teste sem `matchMedia`. */
export function movimentoReduzido(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(CONSULTA).matches;
}

/** Leitura reativa: reage a quem muda a preferência com a página aberta. */
export function usaMovimentoReduzido(): boolean {
  const [reduz, setReduz] = useState(movimentoReduzido);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(CONSULTA);
    const aoMudar = () => setReduz(mq.matches);
    aoMudar();
    mq.addEventListener("change", aoMudar);
    return () => mq.removeEventListener("change", aoMudar);
  }, []);
  return reduz;
}

/**
 * Rampa de animação compartilhada por `CountUp` e `NumeroQueConta`.
 *
 * Os dois componentes continuam separados — diferem em gatilho (mount contra
 * entrada na viewport) e em entrada (número contra texto com prefixo e sufixo).
 * O que era de fato repetido é só isto: o `requestAnimationFrame` com easing
 * cúbico e o cancelamento na saída.
 *
 * Chama `aoPasso` com o valor corrente e devolve a função de cancelar.
 */
export function rampa(alvo: number, dur: number, aoPasso: (n: number) => void): () => void {
  if (movimentoReduzido() || typeof requestAnimationFrame === "undefined") {
    aoPasso(alvo);
    return () => undefined;
  }
  let id = 0;
  let inicio = -1;
  const passo = (ts: number) => {
    if (inicio < 0) inicio = ts;
    const t = Math.min(1, (ts - inicio) / dur);
    aoPasso(Math.round(alvo * (1 - Math.pow(1 - t, 3))));
    if (t < 1) id = requestAnimationFrame(passo);
  };
  id = requestAnimationFrame(passo);
  return () => cancelAnimationFrame(id);
}
