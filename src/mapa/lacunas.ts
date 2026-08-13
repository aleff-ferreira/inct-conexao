/**
 * O que este mapa ainda NÃO sabe.
 *
 * Num mapa temático, o cinza é ambíguo por natureza: ele pode significar
 * "medimos e não há" ou "não medimos". Essas duas coisas são opostas, e um
 * observatório científico que não as distingue está afirmando a primeira
 * sempre que quer dizer a segunda.
 *
 * O npw.scot sinaliza lacunas de INFRAESTRUTURA — onde a rede cicloviária está
 * incompleta. O equivalente honesto aqui é sinalizar lacunas de EVIDÊNCIA: onde
 * o cadastro está incompleto. É o mesmo gesto aplicado ao que cada plataforma
 * de fato tem para oferecer.
 *
 * A varredura é feita sobre o ÍNDICE (2.972 B, sempre em memória), não sobre as
 * fichas — que agora são carregadas sob demanda. Sem isso, medir a cobertura
 * custaria baixar os 135 kB que a Onda 1 acabou de tirar do caminho.
 */
import { INDICE } from "./content";
import { ufs } from "./geo";
import { CAMADA_SEM_ID, type Camada } from "./layers";

export type LacunaCamada = {
  id: string;
  label: string;
  medidas: number;
  total: number;
  faltando: string[];
  comparavel: boolean;
  maturidade: string;
};

export type LacunaSecao = {
  secao: string;
  label: string;
  /** UFs com ficha que têm esta seção preenchida. */
  preenchidas: number;
  comFicha: number;
  faltando: string[];
};

export type Lacunas = {
  ufsComFicha: number;
  ufsTotal: number;
  ufsSemFicha: string[];
  camadas: LacunaCamada[];
  secoes: LacunaSecao[];
};

const SECOES: { chave: keyof typeof CONTAGENS_EXEMPLO; label: string }[] = [
  { chave: "resumo", label: "Visão geral" },
  { chave: "animais", label: "Animais peçonhentos" },
  { chave: "doencas", label: "Doenças" },
  { chave: "ambiente", label: "Ambiente" },
  { chave: "servicos", label: "Serviços de emergência" },
  { chave: "inct", label: "Atividades do INCT" },
];
const CONTAGENS_EXEMPLO = { resumo: 0, animais: 0, doencas: 0, ambiente: 0, servicos: 0, inct: 0 };

/**
 * Varre o que existe e devolve o que falta.
 *
 * Função pura: recebe as camadas, lê o índice, não toca em DOM nem em rede.
 * É consumida pela interface e pode ser chamada num script de build.
 */
export function varrerLacunas(camadas: Camada[]): Lacunas {
  const comFicha = Object.keys(INDICE);
  const semFicha = ufs.filter((u) => !comFicha.includes(u.sigla)).map((u) => u.sigla).sort();

  /* "Sem camada" fora do relatório: ela não mede nada por definição, e entraria
     aqui como "0 de 27, faltando as 27" — a pior lacuna da lista, num inventário
     cujo propósito é apontar onde o cadastro está atrasado. */
  const porCamada: LacunaCamada[] = camadas.filter((c) => c.id !== CAMADA_SEM_ID).map((c) => {
    const faltando = ufs.filter((u) => c.valor(u) == null).map((u) => u.sigla).sort();
    return {
      id: c.id,
      label: c.label,
      medidas: c.escopo.cobertura.medidas,
      total: c.escopo.cobertura.total,
      faltando,
      comparavel: c.escopo.comparavel,
      maturidade: c.escopo.maturidade,
    };
  });

  const porSecao: LacunaSecao[] = SECOES.map(({ chave, label }) => {
    const vazias = comFicha.filter((uf) => (INDICE[uf].contagens[chave] ?? 0) === 0).sort();
    return {
      secao: chave,
      label,
      preenchidas: comFicha.length - vazias.length,
      comFicha: comFicha.length,
      faltando: vazias,
    };
  });

  return {
    ufsComFicha: comFicha.length,
    ufsTotal: ufs.length,
    ufsSemFicha: semFicha,
    camadas: porCamada,
    secoes: porSecao,
  };
}

/**
 * Uma frase honesta sobre o preenchimento, para exibir junto do anel de
 * progresso da ficha. O anel media o "quanto está completo" sem dizer completo
 * em relação a quê.
 */
export function frasePreenchimento(l: Lacunas): string {
  const pct = Math.round((l.ufsComFicha / l.ufsTotal) * 100);
  return `${l.ufsComFicha} das ${l.ufsTotal} unidades federativas têm ficha publicada (${pct}%). ` +
    `Ausência de ficha significa cadastro não feito, e não ausência de risco ou de atividade.`;
}
