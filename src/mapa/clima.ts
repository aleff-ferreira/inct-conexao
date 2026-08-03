/**
 * Tendência climatológica de estação chuvosa por região (padrão GERAL,
 * qualitativo). Base: climatologia brasileira / INMET. Não é previsão, não
 * indica risco de doença — apenas ilustra a sazonalidade que contextualiza os
 * temas de clima e saúde da rede. true = mês tipicamente chuvoso.
 * Ordem dos meses: Jan..Dez.
 */
export const CHUVA_POR_REGIAO: Record<string, boolean[]> = {
  //                J     F     M     A     M     J     J     A     S     O     N     D
  Norte:        [true, true, true, true, true, false, false, false, false, false, true, true],
  Nordeste:     [true, true, true, true, false, false, false, false, false, false, false, true],
  "Centro-Oeste": [true, true, true, false, false, false, false, false, false, true, true, true],
  Sudeste:      [true, true, true, false, false, false, false, false, false, true, true, true],
  Sul:          [true, true, true, true, true, true, true, true, true, true, true, true],
};

export function chuvaDaRegiao(regiao: string): boolean[] {
  return CHUVA_POR_REGIAO[regiao] ?? new Array(12).fill(false);
}
