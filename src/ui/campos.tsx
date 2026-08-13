/**
 * ============================================================================
 *  Controles de formulário compartilhados
 * ============================================================================
 *  ESTA É A TERCEIRA CÓPIA, E É A CASA DEFINITIVA.
 *
 *  `MeuAno.tsx:694` e `MeuLaboratorio.tsx:694` trazem os mesmos controles, cada
 *  um no seu arquivo, com o marcador `EXTRAIR-DEPOIS` pedindo a extração. Eles
 *  NÃO foram tocados nesta mudança de propósito: são 6.900 linhas de formulário
 *  em produção, com relatório aberto, e refatorá-los junto com um formulário
 *  novo é o jeito de derrubar os dois.
 *
 *  A API aqui é IDÊNTICA à deles, campo por campo, exatamente para que a
 *  migração futura seja um `import` e a remoção do bloco local — sem renomear
 *  nada. Ao mexer aqui, mexa lá; ao mexer lá, mexa aqui.
 *
 *  POR QUE `src/ui/` E NÃO `src/relato/campos.tsx` (que é o que o marcador
 *  pede): `src/ui/` já existe (`passos.ts`, `NumeroQueConta.tsx`) e o primeiro
 *  consumidor destes controles fora do relato é o formulário do workshop, que
 *  não é do relato. Guardar um componente compartilhado dentro do módulo de um
 *  dos consumidores é como o acoplamento começa.
 *
 *  O QUE ESTES CONTROLES GARANTEM, E QUE NÃO SE PODE PERDER
 *  -------------------------------------------------------
 *   • `<fieldset>/<legend>` de verdade em todo grupo — nunca um `<div>` com
 *     `<p>` fazendo as vezes de rótulo (WCAG 1.3.1).
 *   • `aria-describedby` juntando dica e erro num atributo só (`idsDescricao`).
 *   • `aria-invalid` no controle, com a mensagem SEMPRE em texto ao lado: cor
 *     de borda nunca é o único indicador (WCAG 1.4.1).
 *   • Alvo de 44px, herdado de `.rel-escolha`; nas escolhas o `<input>` some da
 *     tela mas continua no DOM, porque é ele que dá a navegação por setas.
 *   • Marca-se o OPCIONAL, nunca o obrigatório. Não existe asterisco no repo.
 * ============================================================================
 */
import type { ReactNode } from "react";

/** Junta os ids de dica e erro num único `aria-describedby`. */
export function idsDescricao(id: string, temDica: boolean, temErro: boolean): string | undefined {
  const ids = [temDica ? `${id}-dica` : "", temErro ? `${id}-erro` : ""].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export type CampoBase = {
  id: string;
  rotulo: string;
  dica?: string;
  erro?: string;
  opcional?: boolean;
};

export function Rotulo({ id, rotulo, opcional }: { id: string; rotulo: string; opcional?: boolean }) {
  return (
    <label htmlFor={id}>
      {rotulo}
      {opcional ? <span className="rel-opcional"> (opcional)</span> : null}
    </label>
  );
}

export function Auxiliares({ id, dica, erro }: { id: string; dica?: string; erro?: string }) {
  return (
    <>
      {dica ? (
        <small className="rel-dica" id={`${id}-dica`}>
          {dica}
        </small>
      ) : null}
      {erro ? (
        <small className="plat-error rel-erro" id={`${id}-erro`}>
          {erro}
        </small>
      ) : null}
    </>
  );
}

/** Conta code points, não unidades UTF-16: um emoji é um caractere. */
function contarCaracteres(texto: string): number {
  return Array.from(texto.trim()).length;
}

export function Texto({
  id,
  rotulo,
  dica,
  erro,
  opcional,
  valor,
  aoMudar,
  maxLength,
  inputMode,
  autoComplete,
  tipo = "text",
  lista,
  placeholder,
}: CampoBase & {
  valor: string;
  aoMudar: (v: string) => void;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "url" | "email" | "tel";
  autoComplete?: string;
  tipo?: "text" | "url" | "email" | "tel" | "date" | "month" | "number";
  /** `id` de um `<datalist>` — sugestão, nunca lista fechada. */
  lista?: string;
  placeholder?: string;
}) {
  return (
    <div className="rel-campo" id={`campo-${id}`}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <input
        id={id}
        type={tipo}
        value={valor}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        list={lista}
        placeholder={placeholder}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idsDescricao(id, Boolean(dica), Boolean(erro))}
        onChange={(e) => aoMudar(e.target.value)}
      />
      <Auxiliares id={id} dica={dica} erro={erro} />
    </div>
  );
}

export function Area({
  id,
  rotulo,
  dica,
  erro,
  opcional,
  valor,
  aoMudar,
  maximo,
  linhas = 4,
}: CampoBase & { valor: string; aoMudar: (v: string) => void; maximo: number; linhas?: number }) {
  const usados = contarCaracteres(valor);
  return (
    <div className="rel-campo" id={`campo-${id}`}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <textarea
        id={id}
        rows={linhas}
        value={valor}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idsDescricao(id, true, Boolean(erro))}
        onChange={(e) => aoMudar(e.target.value)}
      />
      <small className="rel-dica" id={`${id}-dica`}>
        {dica ? `${dica} · ` : ""}
        até {maximo} caracteres
      </small>
      <small className={usados > maximo ? "rel-contador is-erro" : "rel-contador"} aria-live="polite">
        {usados} de {maximo}
      </small>
      {erro ? (
        <small className="plat-error rel-erro" id={`${id}-erro`}>
          {erro}
        </small>
      ) : null}
    </div>
  );
}

export function Selecao({
  id,
  rotulo,
  dica,
  erro,
  opcional,
  valor,
  aoMudar,
  opcoes,
  vazio = "Selecione…",
}: CampoBase & {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: ReadonlyArray<readonly [string, string]>;
  vazio?: string;
}) {
  return (
    <div className="rel-campo" id={`campo-${id}`}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <select
        id={id}
        value={valor}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idsDescricao(id, Boolean(dica), Boolean(erro))}
        onChange={(e) => aoMudar(e.target.value)}
      >
        <option value="">{vazio}</option>
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
      <Auxiliares id={id} dica={dica} erro={erro} />
    </div>
  );
}

/**
 * Escolha ÚNICA em cartões.
 *
 * É `<label>` + rádio escondido, e não um grupo de `<button aria-pressed>`:
 * rádio dá navegação por setas dentro do grupo de graça, e um grupo de botões
 * só a dá se alguém escrever o gerenciador de foco à mão — e ninguém escreve.
 *
 * `colunas="uma"` empilha mesmo no desktop: opção com frase inteira ("Não
 * decido, mas levo e defendo internamente") não cabe em terço de linha.
 */
export function Escolha<T extends string>({
  legenda,
  dica,
  erro,
  nomeId,
  opcoes,
  valor,
  aoMudar,
  colunas = "tres",
}: {
  legenda: string;
  dica?: string;
  erro?: string;
  nomeId: string;
  opcoes: ReadonlyArray<readonly [T, string]>;
  valor: T | "";
  aoMudar: (v: T) => void;
  colunas?: "tres" | "uma";
}) {
  const classe = colunas === "uma" ? "rel-escolhas ff-uma-coluna rel-campo" : "rel-escolhas rel-campo";
  return (
    <fieldset className={classe} id={`campo-${nomeId}`}>
      <legend>{legenda}</legend>
      {dica ? (
        <small className="rel-dica ff-largura-total" id={`${nomeId}-dica`}>
          {dica}
        </small>
      ) : null}
      {opcoes.map(([v, r]) => (
        <label key={v} className="rel-escolha" htmlFor={`${nomeId}-${v}`}>
          <input
            id={`${nomeId}-${v}`}
            type="radio"
            name={nomeId}
            checked={valor === v}
            aria-invalid={erro ? true : undefined}
            aria-describedby={idsDescricao(nomeId, Boolean(dica), Boolean(erro))}
            onChange={() => aoMudar(v)}
          />
          <span>{r}</span>
        </label>
      ))}
      {erro ? (
        <small className="plat-error rel-erro ff-largura-total" id={`${nomeId}-erro`}>
          {erro}
        </small>
      ) : null}
    </fieldset>
  );
}

/** Grupo de caixas com `<fieldset>/<legend>` de verdade. */
export function Caixas<T extends string>({
  legenda,
  dica,
  erro,
  opcoes,
  marcadas,
  aoAlternar,
  nomeId,
  desabilitadas,
}: {
  legenda: string;
  dica?: string;
  erro?: string;
  opcoes: ReadonlyArray<readonly [T, string]>;
  marcadas: readonly T[];
  aoAlternar: (v: T) => void;
  nomeId: string;
  /** Ids que o teto já bloqueou. Desabilitado, nunca escondido. */
  desabilitadas?: readonly T[];
}) {
  return (
    <fieldset className="plat-fields rel-campo" id={`campo-${nomeId}`}>
      <legend>{legenda}</legend>
      {dica ? (
        <small className="rel-dica" id={`${nomeId}-dica`}>
          {dica}
        </small>
      ) : null}
      {opcoes.map(([v, r]) => {
        const bloqueada = desabilitadas?.includes(v) ?? false;
        return (
          <label
            key={v}
            className={bloqueada ? "rel-escolha ff-bloqueada" : "rel-escolha"}
            htmlFor={`${nomeId}-${v}`}
          >
            <input
              id={`${nomeId}-${v}`}
              type="checkbox"
              checked={marcadas.includes(v)}
              disabled={bloqueada}
              aria-describedby={idsDescricao(nomeId, Boolean(dica), Boolean(erro))}
              onChange={() => aoAlternar(v)}
            />
            <span>{r}</span>
          </label>
        );
      })}
      {erro ? (
        <small className="plat-error rel-erro" id={`${nomeId}-erro`}>
          {erro}
        </small>
      ) : null}
    </fieldset>
  );
}

/** Sim/Não — rádio, nunca caixa solta: "não marcado" não é "não". */
export function SimNao({
  legenda,
  nomeId,
  valor,
  aoMudar,
}: {
  legenda: string;
  nomeId: string;
  valor: boolean | undefined;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <fieldset className="rel-escolhas rel-campo" id={`campo-${nomeId}`}>
      <legend>{legenda}</legend>
      {(
        [
          [true, "Sim"],
          [false, "Não"],
        ] as const
      ).map(([v, r]) => (
        <label key={r} className={`rel-escolha rel-escolha--${v ? "sim" : "nao"}`} htmlFor={`${nomeId}-${r}`}>
          <input
            id={`${nomeId}-${r}`}
            type="radio"
            name={nomeId}
            checked={valor === v}
            onChange={() => aoMudar(v)}
          />
          <span>{r}</span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Escala de N pontos.
 *
 * Rádio, não `<input type="range">`: o range não tem estado "não respondi" e
 * devolve o meio por padrão — o dado nasceria com uma resposta que ninguém deu.
 * (O único range do repo é o seletor de ano do mapa, e não é campo de
 * formulário.) `valor = 0` é o terceiro estado, e ele não vira 3.
 *
 * Cada ponto carrega rótulo textual PRÓPRIO. "3" sozinho não significa nada e
 * cada pessoa inventa a sua régua; o número é `aria-hidden` justamente porque
 * quem ouve a tela precisa do rótulo, não do algarismo.
 */
export type PontoEscala = { readonly valor: number; readonly rotulo: string };

export function Escala({
  legenda,
  dica,
  erro,
  nomeId,
  pontos,
  ancoraBaixa,
  ancoraAlta,
  valor,
  aoMudar,
}: {
  legenda: string;
  dica?: string;
  erro?: string;
  nomeId: string;
  pontos: readonly PontoEscala[];
  ancoraBaixa: string;
  ancoraAlta: string;
  valor: number;
  aoMudar: (v: number) => void;
}) {
  return (
    <fieldset className="ff-escala rel-campo" id={`campo-${nomeId}`}>
      <legend>{legenda}</legend>
      {dica ? (
        <small className="rel-dica ff-largura-total" id={`${nomeId}-dica`}>
          {dica}
        </small>
      ) : null}
      {pontos.map((p) => (
        <label key={p.valor} className="rel-escolha" htmlFor={`${nomeId}-${p.valor}`}>
          <input
            id={`${nomeId}-${p.valor}`}
            type="radio"
            name={nomeId}
            checked={valor === p.valor}
            aria-invalid={erro ? true : undefined}
            aria-describedby={idsDescricao(nomeId, Boolean(dica), Boolean(erro))}
            onChange={() => aoMudar(p.valor)}
          />
          <b aria-hidden="true">{p.valor}</b>
          <span>{p.rotulo}</span>
        </label>
      ))}
      <p className="ff-escala-ancoras" aria-hidden="true">
        <span>{ancoraBaixa}</span>
        <span>{ancoraAlta}</span>
      </p>
      {erro ? (
        <small className="plat-error rel-erro ff-largura-total" id={`${nomeId}-erro`}>
          {erro}
        </small>
      ) : null}
    </fieldset>
  );
}

/** Selo curto. Uma ou duas palavras — quem precisar de frase usa outra coisa. */
export function Chip({
  texto,
  variante = "padrao",
}: {
  texto: string;
  variante?: "padrao" | "ok" | "aviso" | "eet";
}) {
  const classe = variante === "padrao" ? "rel-chip" : `rel-chip rel-chip--${variante}`;
  return <span className={classe}>{texto}</span>;
}

/**
 * Ficha selecionável — cartão com ícone, título e exemplo.
 *
 * `<button aria-pressed>` e não label+checkbox: a ficha ABRE um campo quando
 * marcada, e o alvo inteiro (incluindo o exemplo, que é o que faz a pergunta
 * ser entendida) precisa ser clicável sem que o clique no campo que ela abriu
 * a desmarque de volta.
 */
export function FichaSelecionavel({
  titulo,
  exemplo,
  marcada,
  aoAlternar,
  icone,
}: {
  titulo: string;
  exemplo: string;
  marcada: boolean;
  aoAlternar: () => void;
  icone?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={marcada ? "rel-ficha is-on" : "rel-ficha"}
      aria-pressed={marcada}
      onClick={aoAlternar}
    >
      {icone}
      <div>
        <strong>{titulo}</strong>
        <span>{exemplo}</span>
      </div>
      {marcada ? <Chip texto="marcado" variante="ok" /> : null}
    </button>
  );
}
