/**
 * Posição de um estado numa camada — com o denominador à vista.
 *
 * A pergunta que isto responde é "este número é grande ou pequeno?", que é
 * legítima e que o mapa hoje não responde. Mas é também a função mais fácil de
 * transformar em afirmação falsa, e por isso ela tem duas travas.
 *
 * TRAVA 1 — só para camada `comparavel: true`.
 * "Só para camada sequencial" NÃO bastaria: a camada de doenças É sequencial, e
 * ainda assim seus totais somam conjuntos diferentes de doenças em cada estado.
 * Posto ali seria ranking de coisas distintas.
 *
 * TRAVA 2 — o denominador é o número de UFs COM DADO, e tem de ser impresso.
 * Nenhuma camada cobre as 27: notificações tem 4, vagas 18, instituições 21.
 * Dizer "1º de 27" quando só 4 foram medidos não é posição — é artefato de
 * cobertura, e o mais enganoso possível, porque parece uma medida nacional. A
 * frase honesta é "1º entre os 18 estados com dado publicado".
 */
import { ufs } from "./geo";
import { isAmazoniaLegal } from "./geo";
import type { Camada } from "./layers";
import type { Uf } from "./types";

export type Posto = {
  /** Nome do recorte: "Brasil", "Amazônia Legal", "Norte"… */
  recorte: string;
  /** Posição, 1 = maior valor. */
  posicao: number;
  /** Quantas UFs do recorte TÊM dado. É o denominador honesto. */
  de: number;
  /** Fração 0–1 para a barra. Decorativa. */
  fracao: number;
};

/**
 * Postos de uma UF em três recortes. Vazio quando a camada não é comparável
 * ou quando a UF não tem dado — nos dois casos, não existe posição a informar.
 */
export function posicaoDe(uf: Uf, camada: Camada): Posto[] {
  if (!camada.escopo.comparavel) return [];
  const meu = camada.valor(uf);
  if (meu == null) return [];

  const recortes: { nome: string; lista: Uf[] }[] = [
    { nome: "Brasil", lista: ufs },
    ...(isAmazoniaLegal(uf) ? [{ nome: "Amazônia Legal", lista: ufs.filter(isAmazoniaLegal) }] : []),
    { nome: uf.regiao, lista: ufs.filter((u) => u.regiao === uf.regiao) },
  ];

  return recortes.map(({ nome, lista }) => {
    // Só entram no denominador as UFs COM valor. Contar as sem dado como zero
    // inventaria uma posição melhor do que a real.
    const valores = lista
      .map((u) => camada.valor(u))
      .filter((v): v is number => v != null)
      .sort((a, b) => b - a);
    const posicao = valores.indexOf(meu) + 1;
    return {
      recorte: nome,
      posicao,
      de: valores.length,
      fracao: valores.length > 1 ? 1 - (posicao - 1) / (valores.length - 1) : 1,
    };
  });
}

/**
 * A frase que acompanha a régua.
 *
 * Diz "com dado publicado" sempre — sem isso, "3º de 18" parece uma posição
 * entre os 27 estados, e é entre os 18 que temos.
 */
export function frasePosicao(p: Posto, camada: Camada): string {
  /* Gênero do recorte: as cinco regiões do IBGE são masculinas ("no Norte", "no
     Nordeste"); só "Amazônia Legal" é feminina. Um "na Norte" numa página
     institucional custa mais credibilidade do que parece.
     E o rótulo da camada vai como está: `toLowerCase()` transformava
     "Vagas de IC (Edital 04/2026)" em "vagas de ic (edital 04/2026)". */
  const onde =
    p.recorte === "Brasil" ? "no Brasil"
    : p.recorte === "Amazônia Legal" ? "na Amazônia Legal"
    : `no ${p.recorte}`;
  return `${p.posicao}º entre os ${p.de} estados com dado publicado ${onde}, em ${camada.label}.`;
}

/**
 * Aviso de cobertura, para quando a camada mede pouco.
 *
 * Aparece junto da régua: posição calculada sobre 4 de 27 estados é uma
 * informação diferente de posição sobre 27 de 27, e a interface tem de dizer
 * qual das duas está mostrando.
 */
export function avisoCobertura(camada: Camada): string | null {
  const { medidas, total } = camada.escopo.cobertura;
  if (medidas >= total) return null;
  return `Esta camada tem valor medido em ${medidas} das ${total} unidades federativas. A posição é calculada só entre elas.`;
}
