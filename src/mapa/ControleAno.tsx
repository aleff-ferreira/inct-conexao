/**
 * Controle de ano da camada de focos.
 *
 * POR QUE NÃO REUSAR O `Timeline` DE `viz.tsx`
 * Ele não é um widget genérico: é o climatológico, com meses nomeados, semântica
 * de estação chuvosa/seca e a nota do INMET embutida. E desenha um `<button>`
 * por célula num grid de 12 colunas — com 22 anos numa tela de 360px, cada alvo
 * ficaria com ~13px, abaixo do mínimo de toque da WCAG 2.5.8 e inutilizável no
 * dedo.
 *
 * `<input type="range">` resolve isso de graça: alvo do tamanho do polegar,
 * setas do teclado, `role="slider"` nativo e anúncio correto — desde que se
 * declare `aria-valuetext`, senão o leitor de tela diz "5" em vez de "2008".
 *
 * A URL só é escrita ao SOLTAR o controle. Arrastar por 22 anos com escrita a
 * cada passo criaria 22 entradas e transformaria o botão Voltar numa armadilha.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { ANOS, ANO_INICIAL, ANO_FINAL, type MedidaFocos } from "./focos";

type Props = {
  ano: number;
  medida: MedidaFocos;
  reduzirMovimento: boolean;
  /** Chamado a cada passo — repinta o mapa, mas NÃO escreve na URL. */
  onPreview: (ano: number) => void;
  /** Chamado ao soltar: é aqui que a URL é escrita, com replace. */
  onFirmar: (ano: number) => void;
  onMedida: (m: MedidaFocos) => void;
};

export function ControleAno({ ano, medida, reduzirMovimento, onPreview, onFirmar, onMedida }: Props) {
  const [tocando, setTocando] = useState(false);
  const timer = useRef(0);

  /* Autoplay nasce DESLIGADO e não existe sob movimento reduzido. Animação de
     mudança frequentemente não melhora a compreensão — e quem pediu menos
     movimento pediu exatamente isto. */
  useEffect(() => {
    if (!tocando || reduzirMovimento) return;
    timer.current = window.setInterval(() => {
      onPreview(ano >= ANO_FINAL ? ANO_INICIAL : ano + 1);
    }, 700);
    return () => window.clearInterval(timer.current);
  }, [tocando, ano, reduzirMovimento, onPreview]);

  // Ao parar, firma o ano corrente na URL — senão o link não reflete a tela.
  useEffect(() => {
    if (!tocando) onFirmar(ano);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocando]);

  const passo = (d: number) => {
    const n = Math.min(ANO_FINAL, Math.max(ANO_INICIAL, ano + d));
    onPreview(n);
    onFirmar(n);
  };

  return (
    <div className="map-ano" role="group" aria-label="Ano dos focos de calor">
      <div className="map-ano-topo">
        <button type="button" className="map-ano-btn" onClick={() => passo(-1)} disabled={ano <= ANO_INICIAL} aria-label="Ano anterior">
          <ChevronLeft size={16} aria-hidden />
        </button>

        <label className="map-ano-label" htmlFor="map-ano-range">
          <strong>{ano}</strong>
          <span>
            {ANO_INICIAL}–{ANO_FINAL}
          </span>
        </label>

        <button type="button" className="map-ano-btn" onClick={() => passo(1)} disabled={ano >= ANO_FINAL} aria-label="Próximo ano">
          <ChevronRight size={16} aria-hidden />
        </button>

        {!reduzirMovimento ? (
          <button
            type="button"
            className={`map-ano-btn${tocando ? " is-on" : ""}`}
            onClick={() => setTocando((v) => !v)}
            aria-pressed={tocando}
            aria-label={tocando ? "Parar a animação dos anos" : "Percorrer os anos automaticamente"}
          >
            {tocando ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
          </button>
        ) : null}
      </div>

      <input
        id="map-ano-range"
        className="map-ano-range"
        type="range"
        min={ANO_INICIAL}
        max={ANO_FINAL}
        step={1}
        value={ano}
        /* `input` repinta; `change` (soltar) é que escreve na URL. */
        onInput={(e) => onPreview(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => onFirmar(Number(e.target.value))}
        list="map-ano-marcas"
        // Sem isto o leitor de tela anuncia a posição, não o ano.
        aria-valuetext={`Ano ${ano}`}
      />
      <datalist id="map-ano-marcas">
        {ANOS.filter((a) => a % 5 === 0).map((a) => (
          <option key={a} value={a} label={String(a)} />
        ))}
      </datalist>

      <div className="map-ano-medida" role="group" aria-label="O que a cor mostra">
        <button type="button" className={`map-ano-tab${medida === "absoluto" ? " is-on" : ""}`}
          aria-pressed={medida === "absoluto"} onClick={() => onMedida("absoluto")}>
          Focos no ano
        </button>
        <button type="button" className={`map-ano-tab${medida === "variacao" ? " is-on" : ""}`}
          aria-pressed={medida === "variacao"} onClick={() => onMedida("variacao")}>
          Variação desde {ANO_INICIAL}
        </button>
      </div>
    </div>
  );
}
