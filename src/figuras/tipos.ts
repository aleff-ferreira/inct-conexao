/**
 * O contrato de figura.
 *
 * A ideia vem do Our World in Data: uma figura publicada não é um desenho, é um
 * objeto citável. Quem chega nela por um link precisa conseguir responder, sem
 * sair da página: o que está medido, de onde veio, de quando é, sob que licença
 * eu posso reusar, e onde está o número cru.
 *
 * Por isso os campos abaixo são OBRIGATÓRIOS e não opcionais. O tipo `Fonte` do
 * mapa (`src/mapa/types.ts:54`) tem `url`, `publicador` e `data` todos
 * opcionais, e o resultado está no ar: `FONTE_REDE` (`src/mapa/layers.ts:96`)
 * saiu sem ano e sem licença. Um campo opcional em contrato de proveniência é
 * um campo que uma hora vai faltar. `tests/figuras.test.ts` fecha a porta.
 *
 * A segunda ideia vem do Reuters Graphics: a figura tem que sobreviver sem
 * JavaScript. Daí `caixa` (proporção declarada, para CLS zero) e `desenhar`,
 * que é função PURA de string — o mesmo código gera o SVG estático no build,
 * em Node, e a primeira pintura no navegador.
 */

/** Um valor de célula. `null` é ausência de dado, e é diferente de zero. */
export type Valor = string | number | null;

/** Uma linha da tabela por trás da figura. */
export type Linha = Record<string, Valor>;

/** Caixa da figura, em unidades do viewBox. Vira `width`/`height` no `<img>`. */
export type Caixa = { largura: number; altura: number };

/**
 * Proveniência citável. Todo campo aqui é obrigatório de propósito.
 *
 * `ano` é string e não número porque série tem intervalo ("2003 a 2024"), e
 * espremer isso num inteiro perde a informação que mais importa ao leitor.
 */
export type FonteFigura = {
  titulo: string;
  publicador: string;
  url: string;
  ano: string;
  licenca: string;
  /** Ressalva metodológica: o que o número NÃO quer dizer. */
  nota?: string;
};

/**
 * Definição de coluna.
 *
 * `definicao` existe porque rótulo não é definição. "Focos" como cabeçalho não
 * diz que um incêndio grande gera vários focos, nem que foco não é área
 * queimada. Sem essa frase o leitor tira a conclusão errada com o dado certo.
 */
export type Coluna = {
  chave: string;
  rotulo: string;
  definicao: string;
  unidade?: string;
};

export type Figura = {
  /** Identificador estável: entra na URL e no nome do SVG. Nunca renomear. */
  id: string;
  titulo: string;
  /** Define a métrica numa frase. É o que o OWID põe abaixo do título. */
  subtitulo: string;
  fonte: FonteFigura;
  colunas: Coluna[];
  /** Caixa larga, para desktop e para o arquivo que viaja sozinho. */
  caixa: Caixa;
  /**
   * Caixa estreita, para telas de celular.
   *
   * Não é luxo: num viewBox de largura L exibido com largura W, um texto de
   * tamanho s aparece com s*W/L. Espremer a caixa de 760 num palco de 293px
   * leva o rótulo do eixo a menos de 5px reais — o gráfico continua correto e
   * fica ilegível justamente para a maior parte do público, que está no
   * telefone. A variante é gerada pela MESMA função, com outra caixa.
   */
  caixaMobile: Caixa;
  /** A tabela crua. É a mesma coisa que o CSV baixado e que a tabela do fallback. */
  linhas: () => Linha[];
  /**
   * Desenha a figura como string SVG. Pura: sem DOM, sem React, sem estado.
   * Roda no build (Node) para gerar o arquivo estático e no navegador para a
   * primeira pintura, o que garante que os dois nunca divirjam.
   *
   * `carimbo` escreve título, subtítulo e crédito dentro do SVG: verdadeiro no
   * arquivo solto, falso no embutido, onde o HTML já traz os dois acima.
   */
  desenhar: (linhas: Linha[], caixa: Caixa, carimbo?: boolean) => string;
};

/** Formata inteiros em pt-BR (66962 → "66.962"). */
export const fmtBR = (n: number): string => n.toLocaleString("pt-BR");
