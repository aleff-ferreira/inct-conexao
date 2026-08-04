/**
 * Passos por rolagem — o motor do scrollytelling.
 *
 * O padrão é o do Reuters Graphics: um elemento em `position: sticky` fica
 * parado enquanto blocos de texto passam por ele, e o bloco que está na faixa
 * de leitura manda no que o elemento mostra. Sem biblioteca: um
 * `IntersectionObserver` e uma função pura.
 *
 * DUAS DECISÕES QUE PARECEM DETALHE E SÃO A FUNCIONALIDADE INTEIRA:
 *
 * 1. A faixa vem de `rootMargin`, NUNCA de `threshold`. Com `threshold: 0.5`,
 *    um capítulo mais alto que a faixa nunca alcança razão de interseção 0,5 —
 *    o callback simplesmente nunca dispara, e a funcionalidade morre calada,
 *    sem erro no console. Os capítulos aqui têm `min-height: 72svh` (o trilho
 *    `.map-step`, não o cartão que ele contém); qualquer limiar acima de ~0,5
 *    já os condenaria.
 *
 * 2. `escolherPasso` é separada e pura. O que quebra em scrollytelling é a
 *    regra de desempate — dois blocos na faixa ao mesmo tempo, salto de vários
 *    blocos numa rolagem rápida, o último bloco que nunca alcança a linha. Nada
 *    disso se testa com o observador no meio: `IntersectionObserver` não existe
 *    no ambiente de teste deste projeto (`environment: node`). Separando, a
 *    regra é testável em Node e o hook fica sendo só encanamento.
 */
import { useEffect, useRef } from "react";

export type PassoMedido = { id: string; topo: number };

/**
 * Qual passo está valendo, dada a posição de cada um e a linha de leitura.
 *
 * Vence o ÚLTIMO passo, na ordem do documento, cujo topo já cruzou a linha.
 * Se nenhum cruzou (o leitor ainda está acima da história), vence o primeiro —
 * nunca `null` com lista não vazia, porque devolver nada aqui significaria a
 * história sem capítulo ativo, que é justamente o estado quebrado.
 *
 * A regra é a mesma já usada no índice de seções da home, e é deliberadamente
 * indiferente à altura dos blocos: só o topo importa, então um capítulo curto
 * seguido de um longo não inverte a ordem.
 */
export function escolherPasso(passos: PassoMedido[], linha: number): string | null {
  if (!passos.length) return null;
  let escolhido = passos[0];
  for (const p of passos) if (p.topo <= linha) escolhido = p;
  return escolhido.id;
}

export type OpcoesPasso = {
  /** Altura da linha de leitura, em fração da viewport. Padrão: 45%. */
  faixa?: number;
};

/**
 * Observa os passos dentro de `container` e avisa quando o ativo muda.
 *
 * `aoMudar` fica numa ref de propósito: ele quase sempre fecha sobre o estado
 * da página, e se entrasse nas dependências o observador se registraria de novo
 * a cada render — perdendo cruzamentos no meio do caminho.
 */
export function usePassoAtivo(
  container: React.RefObject<HTMLElement | null>,
  ids: string[],
  aoMudar: (id: string) => void,
  opcoes: OpcoesPasso = {},
): void {
  const faixa = opcoes.faixa ?? 0.45;
  const cb = useRef(aoMudar);
  cb.current = aoMudar;
  const ultimo = useRef<string | null>(null);
  const chave = ids.join("|");

  useEffect(() => {
    const el = container.current;
    // Guarda obrigatória: o módulo é importado em teste, onde não há DOM.
    if (!el || typeof IntersectionObserver === "undefined") return;

    const passos = Array.from(el.querySelectorAll<HTMLElement>("[data-passo]"));
    if (!passos.length) return;

    const avaliar = () => {
      const medidos: PassoMedido[] = passos
        .map((p) => ({ id: p.dataset.passo ?? "", topo: p.getBoundingClientRect().top }))
        .filter((p) => p.id)
        .sort((a, b) => a.topo - b.topo);
      const id = escolherPasso(medidos, window.innerHeight * faixa);
      // Só reporta na TROCA. Sem isso, cada quadro de rolagem escreveria a
      // mesma coisa na URL — e a URL é o histórico do navegador.
      if (id && id !== ultimo.current) {
        ultimo.current = id;
        cb.current(id);
      }
    };

    const io = new IntersectionObserver(
      (entradas) => {
        // Enquanto ninguém entrou na faixa e não há ativo, não faz nada: gravar
        // o primeiro capítulo na URL antes de o leitor chegar na história seria
        // mexer no endereço de uma página que a pessoa nem começou a ler.
        if (!entradas.some((e) => e.isIntersecting) && ultimo.current === null) return;
        avaliar();
      },
      {
        // Uma faixa fina no meio da tela. Ver a nota 1 no topo do arquivo.
        rootMargin: `-${Math.round(faixa * 100)}% 0px -${100 - Math.round(faixa * 100) - 1}% 0px`,
        threshold: 0,
      },
    );
    for (const p of passos) io.observe(p);
    return () => io.disconnect();
  }, [container, chave, faixa]);
}

/**
 * Leva a rolagem até um passo.
 *
 * `instantaneo` corta a animação, e é o que o deep-link usa: o site tem
 * `scroll-behavior: smooth` global, então uma rolagem animada de vários écrans
 * atravessaria todos os capítulos do caminho, disparando o observador em cada
 * um e reescrevendo a URL várias vezes antes de chegar.
 */
export function rolarAtePasso(el: HTMLElement | null, instantaneo = false): void {
  if (!el) return;
  el.scrollIntoView({ behavior: instantaneo ? "instant" : "auto", block: "start" });
}
