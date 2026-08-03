/**
 * ============================================================================
 *  Catálogo da rede INCT-CONEXAO
 * ============================================================================
 *  Extraído de App.tsx para que os números da página possam ser DERIVADOS deste
 *  catálogo em vez de escritos à mão. Antes desta separação a home afirmava
 *  "35 instituições" na Amazônia Legal contra 34 registradas, "21 instituições"
 *  em Rondônia contra 19, e "16 países" onde havia 16 instituições estrangeiras
 *  de 12 países distintos. Número de instituição científica que não fecha com o
 *  próprio catálogo é o tipo de erro que um jornalista confere em cinco minutos.
 *
 *  `location` segue o formato "UF, Brasil" para instituições brasileiras e
 *  "País" para estrangeiras. É desse campo que saem todas as contagens, e o
 *  teste em tests/rede.test.ts falha se o formato quebrar ou se o mapa
 *  (INSTITUICOES_POR_UF em src/mapa/layers.ts) divergir daqui.
 * ============================================================================
 */

/** UFs da Amazônia Legal (Lei Complementar nº 124/2007). */
export const UFS_AMAZONIA_LEGAL = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"] as const;

export type Partner = {
  name: string;
  acronym?: string;
  group:
    | "Executora/Sede"
    | "Laboratório Associado"
    | "Colaboradora Nacional"
    | "Colaboradora"
    | "Parceira"
    | "FAP"
    | "Sociedade"
    | "Empresa"
    | "Colaboradora Estrangeira";
  location: string;
  focus: string;
};

export const partners: Partner[] = [
  {
    name: "Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia",
    acronym: "FIOCRUZ/RO",
    group: "Executora/Sede",
    location: "RO, Brasil",
    focus: "Instituição executora; coordenação geral, Saúde Única, biotecnologia, toxinologia e articulação da rede.",
  },
  {
    name: "Instituto Aggeu Magalhães",
    acronym: "IAM",
    group: "Laboratório Associado",
    location: "PE, Brasil",
    focus: "Laboratório associado em saúde, imunogenética, biologia molecular e doenças infecciosas.",
  },
  {
    name: "Universidade Estadual Paulista Júlio de Mesquita Filho",
    acronym: "UNESP",
    group: "Laboratório Associado",
    location: "SP, Brasil",
    focus: "Laboratório associado em climatologia geográfica, saúde ambiental, medicina veterinária e pesquisa translacional.",
  },
  {
    name: "Universidade Federal do Amapá",
    acronym: "UNIFAP",
    group: "Laboratório Associado",
    location: "AP, Brasil",
    focus: "Laboratório associado da Amazônia Legal; biodiversidade, ecologia, saúde e biotecnologia.",
  },
  {
    name: "Universidade Estadual da Paraíba",
    acronym: "UEPB",
    group: "Laboratório Associado",
    location: "PB, Brasil",
    focus: "Laboratório associado em bioensaios, educação científica e saúde.",
  },
  {
    name: "Universidade Federal de Uberlândia",
    acronym: "UFU",
    group: "Laboratório Associado",
    location: "MG, Brasil",
    focus: "Laboratório associado em farmacologia, toxinologia, dor, analgesia e fisiopatologia de venenos animais.",
  },
  {
    name: "Universidade Federal de São Paulo",
    acronym: "UNIFESP",
    group: "Laboratório Associado",
    location: "SP, Brasil",
    focus: "Laboratório associado em biologia estrutural, química medicinal e saúde.",
  },
  {
    name: "Instituto Federal de Educação, Ciência e Tecnologia de Rondônia",
    acronym: "IFRO",
    group: "Laboratório Associado",
    location: "RO, Brasil",
    focus: "Laboratório associado em sensoriamento remoto, clima urbano, formação técnica e educação científica.",
  },
  {
    name: "Universidade Federal do Amazonas",
    acronym: "UFAM",
    group: "Laboratório Associado",
    location: "AM, Brasil",
    focus: "Laboratório associado da Amazônia Legal; saúde, biodiversidade, ambiente e formação regional.",
  },
  {
    name: "Universidade Federal do Oeste do Pará",
    acronym: "UFOPA",
    group: "Laboratório Associado",
    location: "PA, Brasil",
    focus: "Laboratório associado da Amazônia Legal; território, biodiversidade, comunidades e ambiente.",
  },
  {
    name: "Universidade Federal de Minas Gerais",
    acronym: "UFMG",
    group: "Laboratório Associado",
    location: "MG, Brasil",
    focus: "Laboratório associado em bioquímica, biologia molecular, farmacologia e toxicologia.",
  },
  {
    name: "Universidade Federal da Grande Dourados",
    acronym: "UFGD",
    group: "Laboratório Associado",
    location: "MS, Brasil",
    focus: "Laboratório associado em geografia, vulnerabilidade climática, geoprocessamento e ciências ambientais.",
  },
  {
    name: "Pontifícia Universidade Católica do Paraná",
    acronym: "PUC/PR",
    group: "Laboratório Associado",
    location: "PR, Brasil",
    focus: "Laboratório associado em saúde, dados, modelagem e inovação aplicada.",
  },
  {
    name: "Instituto Leônidas e Maria Deane",
    acronym: "ILMD",
    group: "Laboratório Associado",
    location: "AM, Brasil",
    focus: "Laboratório associado da FIOCRUZ Amazônia em biologia molecular, imunologia e produtos naturais.",
  },
  {
    name: "Universidade Federal de São Carlos",
    acronym: "UFSCar",
    group: "Laboratório Associado",
    location: "SP, Brasil",
    focus: "Laboratório associado em biotecnologia, química medicinal, bioensaios e formação científica.",
  },
  {
    name: "Universidade de São Paulo",
    acronym: "USP",
    group: "Laboratório Associado",
    location: "SP, Brasil",
    focus: "Laboratório associado em geografia, ambiente, paisagem, modelagem e saúde.",
  },
  {
    name: "Fundação Oswaldo Cruz - Ceará",
    acronym: "FIOCRUZ/CE",
    group: "Laboratório Associado",
    location: "CE, Brasil",
    focus: "Laboratório associado em saúde pública, biotecnologia e doenças negligenciadas.",
  },
  {
    name: "Universidade Federal do Tocantins",
    acronym: "UFT",
    group: "Laboratório Associado",
    location: "TO, Brasil",
    focus: "Laboratório associado em biodiversidade, ambiente, saúde e bioeconomia.",
  },
  {
    name: "Universidade Federal de Mato Grosso",
    acronym: "UFMT",
    group: "Laboratório Associado",
    location: "MT, Brasil",
    focus: "Laboratório associado em ambiente, território, saúde e bioprospecção.",
  },
  {
    name: "Universidade Federal de São João Del-Rei",
    acronym: "UFSJ",
    group: "Laboratório Associado",
    location: "MG, Brasil",
    focus: "Laboratório associado em biomateriais, bioengenharia, microbiologia e popularização da ciência.",
  },
  {
    name: "Universidade Federal do Pará",
    acronym: "UFPA",
    group: "Laboratório Associado",
    location: "PA, Brasil",
    focus: "Laboratório associado da Amazônia Legal; biodiversidade, comunidades e saúde ambiental.",
  },
  {
    name: "Universidade Federal de Roraima",
    acronym: "UFRR",
    group: "Laboratório Associado",
    location: "RR, Brasil",
    focus: "Laboratório associado em plantas medicinais, saúde coletiva, biotecnologia e educação científica.",
  },
  {
    name: "Faculdade Santa Casa BH",
    acronym: "FSCBH",
    group: "Laboratório Associado",
    location: "MG, Brasil",
    focus: "Laboratório associado em saúde, assistência, formação e pesquisa clínica.",
  },
  {
    name: "Fundação Universidade Federal de Ciências da Saúde de Porto Alegre",
    acronym: "UFCSPA",
    group: "Laboratório Associado",
    location: "RS, Brasil",
    focus: "Laboratório associado em ciências da saúde, biologia molecular e formação.",
  },
  {
    name: "Universidade Estadual do Maranhão",
    acronym: "UEMA",
    group: "Laboratório Associado",
    location: "MA, Brasil",
    focus: "Laboratório associado em geografia física, climatologia, saúde ambiental e modelagem bioclimática.",
  },
  {
    name: "Universidade Federal de Rondônia",
    acronym: "UNIR",
    group: "Laboratório Associado",
    location: "RO, Brasil",
    focus: "Vice-coordenação; sede física no LABOGEOPA/UNIR, biodiversidade, geografia, ecologia e comunidades.",
  },
  {
    name: "Universidade Federal de Sergipe",
    acronym: "UFS",
    group: "Laboratório Associado",
    location: "SE, Brasil",
    focus: "Laboratório associado em biodiversidade, biotecnologia, saúde e formação.",
  },
  {
    name: "Universidade Federal do Maranhão",
    acronym: "UFMA",
    group: "Laboratório Associado",
    location: "MA, Brasil",
    focus: "Laboratório associado em ambiente, saúde, biodiversidade e educação científica.",
  },
  {
    name: "Instituto Butantan",
    acronym: "IBU",
    group: "Colaboradora Nacional",
    location: "SP, Brasil",
    focus: "Colaboração em toxinologia, imunobiológicos, venenos e saúde pública.",
  },
  {
    name: "Fundação Oswaldo Cruz",
    acronym: "FIOCRUZ",
    group: "Colaboradora Nacional",
    location: "RJ, Brasil",
    focus: "Colaboração nacional em saúde pública, biotecnologia e rede FIOCRUZ.",
  },
  {
    name: "Universidade Federal do Ceará",
    acronym: "UFC",
    group: "Colaboradora Nacional",
    location: "CE, Brasil",
    focus: "Colaboração em biotecnologia, saúde, produtos naturais e formação.",
  },
  {
    name: "Fundação CECIERJ",
    acronym: "CECIERJ",
    group: "Colaboradora Nacional",
    location: "RJ, Brasil",
    focus: "Colaboração em educação, divulgação científica e formação a distância.",
  },
  {
    name: "Universidade Federal de Alagoas",
    acronym: "UFAL",
    group: "Colaboradora Nacional",
    location: "AL, Brasil",
    focus: "Colaboração em biotecnologia, química, saúde e formação científica.",
  },
  {
    name: "Universidade Federal Rural do Rio de Janeiro",
    acronym: "UFRRJ",
    group: "Colaboradora Nacional",
    location: "RJ, Brasil",
    focus: "Colaboração em produtos naturais, plantas medicinais, fitoterápicos e Saúde Única.",
  },
  {
    name: "Universidade de Brasília",
    acronym: "UnB",
    group: "Colaboradora Nacional",
    location: "DF, Brasil",
    focus: "Colaboração em políticas públicas, saúde, ambiente e formação.",
  },
  {
    name: "Fundação Oswaldo Cruz Pantanal",
    acronym: "FIOCRUZ/Pantanal",
    group: "Colaboradora Nacional",
    location: "MS, Brasil",
    focus: "Colaboração em saúde, ambiente, Pantanal e integração centro-oeste/Amazônia.",
  },
  {
    name: "Universidade Federal do Rio Grande do Norte",
    acronym: "UFRN",
    group: "Colaboradora Nacional",
    location: "RN, Brasil",
    focus: "Colaboração em modelagem atmosférica, previsão de tempo e ciência de dados.",
  },
  {
    name: "Instituto Nacional de Pesquisas Espaciais",
    acronym: "INPE",
    group: "Colaboradora Nacional",
    location: "SP, Brasil",
    focus: "Modelagem numérica de tempo e clima, IA, previsão climática, SIMBAM e dados ambientais.",
  },
  {
    name: "Universidade Federal de Juiz de Fora",
    acronym: "UFJF",
    group: "Colaboradora Nacional",
    location: "MG, Brasil",
    focus: "Colaboração em saúde, ambiente, educação e análise de dados.",
  },
  {
    name: "Universidade Federal de Campina Grande",
    acronym: "UFCG",
    group: "Colaboradora Nacional",
    location: "PB, Brasil",
    focus: "Colaboração em meteorologia, clima, modelagem e dados ambientais.",
  },
  {
    name: "Universidade Federal do Paraná",
    acronym: "UFPR",
    group: "Colaboradora Nacional",
    location: "PR, Brasil",
    focus: "Colaboração em saúde, biodiversidade, biotecnologia e formação.",
  },
  {
    name: "Universidade Federal Fluminense",
    acronym: "UFF",
    group: "Colaboradora Nacional",
    location: "RJ, Brasil",
    focus: "Colaboração em saúde, ciências ambientais, educação e pesquisa aplicada.",
  },
  {
    name: "Instituto Brasileiro do Meio Ambiente e dos Recursos Naturais Renováveis",
    acronym: "IBAMA",
    group: "Colaboradora",
    location: "DF, Brasil",
    focus: "Colaboração ambiental, licenciamento, conservação e políticas públicas.",
  },
  {
    name: "Faculdades Associadas de Ariquemes",
    acronym: "FAAR/IESUR",
    group: "Colaboradora",
    location: "RO, Brasil",
    focus: "Colaboração regional em formação, pesquisa aplicada e extensão.",
  },
  {
    name: "Faculdade Católica de Rondônia",
    acronym: "FCR",
    group: "Colaboradora",
    location: "RO, Brasil",
    focus: "Colaboração regional em formação, direito, políticas públicas e extensão.",
  },
  {
    name: "Faculdades Integradas Aparício Carvalho",
    acronym: "FIMCA",
    group: "Colaboradora",
    location: "RO, Brasil",
    focus: "Colaboração regional em saúde, formação profissional e ações de extensão.",
  },
  {
    name: "Centro Universitário São Lucas",
    acronym: "UniSL",
    group: "Colaboradora",
    location: "RO, Brasil",
    focus: "Colaboração em saúde, farmácia, biotecnologia, educação científica e projetos.",
  },
  {
    name: "Centro de Pesquisa em Medicina Tropical de Rondônia",
    acronym: "CEPEM/SSER",
    group: "Colaboradora",
    location: "RO, Brasil",
    focus: "Colaboração em helmintologia, protozoologia, epidemiologia, medicina preventiva e saúde pública.",
  },
  {
    name: "Instituto Chico Mendes de Conservação da Biodiversidade",
    acronym: "ICMBio",
    group: "Colaboradora",
    location: "DF, Brasil",
    focus: "Colaboração em conservação, expedições científicas, biodiversidade e licenças ambientais.",
  },
  {
    name: "Instituto Federal de Roraima",
    acronym: "IFRR",
    group: "Colaboradora",
    location: "RR, Brasil",
    focus: "Colaboração em formação técnica, educação científica e ações regionais em Roraima.",
  },
  {
    name: "Ação Ecológica Guaporé",
    acronym: "ECOPORÉ",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceira em campo, comunidades, ciência cidadã, restauração ecológica e educação ambiental.",
  },
  {
    name: "Governo do Estado de Rondônia",
    acronym: "GOVERNO/RO",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Apoio institucional por SEDAM, SESAU, SEDEC e SEDUC para execução e políticas públicas.",
  },
  {
    name: "Prefeitura Municipal de Ji-Paraná",
    acronym: "PMJP",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria municipal para ações territoriais, saúde, educação e CT&I.",
  },
  {
    name: "Secretaria de Estado da Saúde de Roraima",
    acronym: "SESAU/RR",
    group: "Parceira",
    location: "RR, Brasil",
    focus: "Parceria estadual em saúde pública, dados epidemiológicos e ações territoriais.",
  },
  {
    name: "Prefeitura Municipal de Rorainópolis",
    acronym: "PMRILIS",
    group: "Parceira",
    location: "RR, Brasil",
    focus: "Parceria municipal para ações territoriais em Roraima.",
  },
  {
    name: "Secretaria de Educação do Estado de Rondônia",
    acronym: "SEDUC/RO",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria em educação científica, escolas, clubes de ciência e formação.",
  },
  {
    name: "Instituto de Pesquisas em Patologias Tropicais de Rondônia",
    acronym: "IPEPATRO",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria em patologias tropicais, diagnóstico, epidemiologia e saúde pública.",
  },
  {
    name: "Secretaria de Estado da Saúde de Rondônia",
    acronym: "SESAU/RO",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria em saúde pública, vigilância, capacitação e políticas informadas por evidências.",
  },
  {
    name: "Secretaria de Estado do Desenvolvimento Ambiental de Rondônia",
    acronym: "SEDAM/RO",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria em desenvolvimento ambiental, gestão de recursos naturais e políticas para a Amazônia.",
  },
  {
    name: "Prefeitura Municipal de Porto Velho",
    acronym: "PMPV",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria municipal para ações de saúde, educação, ambiente e comunidades.",
  },
  {
    name: "Fundação Rondônia de Amparo ao Desenvolvimento das Ações Científicas e Tecnológicas e à Pesquisa",
    acronym: "FAPERO",
    group: "FAP",
    location: "RO, Brasil",
    focus: "Fundação de amparo parceira, com apoio institucional à proposta e ao ecossistema de CT&I.",
  },
  {
    name: "Karipunas Associação Ecológica da Amazônia",
    acronym: "KARIPUNAS",
    group: "Sociedade",
    location: "RO, Brasil",
    focus: "Organização da sociedade civil e comunidades originárias para diálogo territorial e saberes tradicionais.",
  },
  {
    name: "Centro Cultural Indígena Paiter Wagôh Pakob",
    acronym: "PAITER SURUI",
    group: "Sociedade",
    location: "RO, Brasil",
    focus: "Organização indígena parceira; apoio humano e material para execução junto ao território Paiter Surui.",
  },
  {
    name: "Antigen Desenvolvimento de Tecnologias de Vacinas e Serviços LTDA",
    acronym: "Antigen",
    group: "Empresa",
    location: "TO, Brasil",
    focus: "Empresa parceira em tecnologias de vacinas, diagnóstico, inovação e transferência de conhecimento.",
  },
  {
    name: "Amazonzyme Pesquisa e Desenvolvimento de Produtos Biotecnológicos LTDA",
    acronym: "Amazonzyme",
    group: "Empresa",
    location: "AM, Brasil",
    focus: "Empresa parceira em produtos biotecnológicos, bioinsumos e inovação em biodiversidade.",
  },
  {
    name: "Université Paris-Cité",
    acronym: "UPCité",
    group: "Colaboradora Estrangeira",
    location: "França",
    focus: "Colaboração internacional em saúde, biotecnologia, biodiversidade e formação.",
  },
  {
    name: "Harvard University",
    acronym: "HARVARD",
    group: "Colaboradora Estrangeira",
    location: "Estados Unidos",
    focus: "Colaboração internacional em pesquisa, saúde, ambiente e ciência de dados.",
  },
  {
    name: "San Diego State University",
    acronym: "SDSU",
    group: "Colaboradora Estrangeira",
    location: "Estados Unidos",
    focus: "Colaboração internacional em ambiente, clima, saúde e formação.",
  },
  {
    name: "European Centre for Medium-Range Weather Forecasts",
    acronym: "ECMWF",
    group: "Colaboradora Estrangeira",
    location: "Inglaterra",
    focus: "Colaboração internacional em previsão de tempo, clima, dados e modelagem.",
  },
  {
    name: "Universidad Autónoma del Estado de México",
    acronym: "UAEM",
    group: "Colaboradora Estrangeira",
    location: "México",
    focus: "Colaboração internacional em biodiversidade, ambiente e saúde.",
  },
  {
    name: "Universidad Nacional Mayor de San Marcos",
    acronym: "UNMSM",
    group: "Colaboradora Estrangeira",
    location: "Peru",
    focus: "Colaboração internacional em biodiversidade amazônica, saúde e formação.",
  },
  {
    name: "Universidad Regional Amazónica IKIAM",
    acronym: "IKIAM",
    group: "Colaboradora Estrangeira",
    location: "Equador",
    focus: "Colaboração internacional amazônica em biodiversidade, território e biotecnologia.",
  },
  {
    name: "Universidad Nacional del Nordeste",
    acronym: "UNNE",
    group: "Colaboradora Estrangeira",
    location: "Argentina",
    focus: "Colaboração internacional em biotecnologia, saúde e toxinologia.",
  },
  {
    name: "Universidade do Porto",
    acronym: "U.PORTO",
    group: "Colaboradora Estrangeira",
    location: "Portugal",
    focus: "Colaboração internacional em biotecnologia, toxinologia e redes Brasil-Portugal.",
  },
  {
    name: "Imperial College London - Silwood Park Campus",
    acronym: "Silwood Park",
    group: "Colaboradora Estrangeira",
    location: "Inglaterra",
    focus: "Colaboração internacional em ecologia, biodiversidade, ambiente e modelagem.",
  },
  {
    name: "Centro para el Desarrollo de la Investigación Científica",
    acronym: "CEDIC",
    group: "Colaboradora Estrangeira",
    location: "Paraguai",
    focus: "Colaboração internacional em pesquisa científica, biotecnologia e saúde.",
  },
  {
    name: "Centre National de la Recherche Scientifique",
    acronym: "CNRS",
    group: "Colaboradora Estrangeira",
    location: "França",
    focus: "Colaboração internacional em pesquisa científica, biodiversidade, biologia e biotecnologia.",
  },
  {
    name: "Universidad Nacional Costa Rica",
    acronym: "UNA",
    group: "Colaboradora Estrangeira",
    location: "Costa Rica",
    focus: "Colaboração internacional em ambiente, saúde e biodiversidade tropical.",
  },
  {
    name: "Universidad de Costa Rica",
    acronym: "UCR",
    group: "Colaboradora Estrangeira",
    location: "Costa Rica",
    focus: "Colaboração internacional em biodiversidade, saúde, ambiente e formação.",
  },
  {
    name: "Universidad de Panama",
    acronym: "U.PANAMA",
    group: "Colaboradora Estrangeira",
    location: "Panamá",
    focus: "Colaboração internacional em biotecnologia, toxinologia, biodiversidade e saúde.",
  },
  {
    name: "Universidad Autónoma de Occidente de Cali",
    acronym: "UAO",
    group: "Colaboradora Estrangeira",
    location: "Colômbia",
    focus: "Colaboração internacional em inovação, território, ambiente e pesquisa aplicada.",
  },
];

/* ------------------------------------------------------------------ */
/*  Números derivados: a única fonte de verdade da página              */
/* ------------------------------------------------------------------ */

const AL = new Set<string>(UFS_AMAZONIA_LEGAL);

/** "RO, Brasil" -> "RO"; "França" -> null (estrangeira). */
export function ufDe(p: Partner): string | null {
  return p.location.endsWith("Brasil") ? p.location.split(",")[0].trim() : null;
}

export const brasileiras = partners.filter((p) => ufDe(p) !== null);
export const estrangeiras = partners.filter((p) => ufDe(p) === null);

/** Contagem por UF, no mesmo formato de INSTITUICOES_POR_UF do mapa. */
export const instituicoesPorUf: Record<string, number> = brasileiras.reduce<Record<string, number>>((acc, p) => {
  const uf = ufDe(p) as string;
  acc[uf] = (acc[uf] ?? 0) + 1;
  return acc;
}, {});

export const naAmazoniaLegal = brasileiras.filter((p) => AL.has(ufDe(p) as string));
export const ufsDaAmazoniaLegalComRegistro = [...new Set(naAmazoniaLegal.map((p) => ufDe(p) as string))].sort();
/** Países estrangeiros distintos. NÃO confundir com número de instituições. */
export const paisesEstrangeiros = [...new Set(estrangeiras.map((p) => p.location))].sort();

export const REDE = {
  /** Registros no catálogo navegável desta página. */
  catalogadas: partners.length,
  brasileiras: brasileiras.length,
  estrangeiras: estrangeiras.length,
  paises: paisesEstrangeiros.length,
  amazoniaLegal: naAmazoniaLegal.length,
  ufsAmazoniaLegal: ufsDaAmazoniaLegalComRegistro.length,
  rondonia: instituicoesPorUf.RO ?? 0,
  /**
   * Total da proposta submetida ao CNPq em 2024. É MAIOR que `catalogadas`
   * porque o catálogo navegável só lista as instituições já detalhadas. A
   * diferença é declarada na página, não escondida.
   */
  naProposta: 86,
} as const;
