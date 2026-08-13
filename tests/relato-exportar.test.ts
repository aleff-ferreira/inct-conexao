/**
 * ============================================================================
 *  Exportadores do painel da coordenação — formato e honestidade, testados
 * ============================================================================
 *  O que NÃO pode quebrar em silêncio:
 *   1. CSV pt-BR de verdade: BOM, separador `;`, aspas escapadas, decimal com
 *      vírgula e data DD/MM/AAAA — sem isso o Excel da coordenação lê lixo.
 *   2. O CSV de produções é a CANÔNICA: dois coautores = UMA linha, e item
 *      fora do período NÃO aparece como contado.
 *   3. A minuta é FACTUAL: sem adjetivo (a mesma lista proibida do teste de
 *      `sugerirResultado`), sem percentual de meta, números em pt-BR e a
 *      parcialidade DITA em toda seção.
 *   4. O envelope encaixa nos tipos `Envelope*` de types.ts §2.1 — tsc valida
 *      a forma em compilação e o teste confere as chaves em runtime.
 * ============================================================================
 */
import { describe, expect, it } from "vitest";

import { agregarCiclo, type EntradaDaAgregacao } from "../src/relato/agregacao";
import type { ProducaoComVinculos } from "../src/relato/api";
import {
  csvFomento,
  csvPessoasRh,
  csvProducoes,
  dataBr,
  envelopeDoCiclo,
  minutaDoRelatorio,
  moedaBr,
  numeroBr,
  numeroBrLivre,
} from "../src/relato/exportar";
import type {
  CicloConfig,
  CicloMembro,
  EnvelopeCiclo,
  EnvelopeLaboratorio,
  EnvelopeRelato,
  Fato,
  Laboratorio,
  Producao,
  ProducaoVinculo,
  Relato,
  RelatorioCiclo,
} from "../src/relato/types";

// ------------------------------------------------------------- fixtures ----

const CICLO_ID = "00000000-0000-0000-0000-00000000c1c1";
const LAB_A = "00000000-0000-0000-0000-00000000a001";
const LAB_B = "00000000-0000-0000-0000-00000000a002";

const CONFIG: CicloConfig = {
  objetivos: [1, 2, 3].map((n) => ({ n, missao: "Pesquisa" })),
  metas: [
    {
      n: 7,
      objetivos: [1],
      progresso: [],
      pactuados: [
        { chave: "M07.1", oQue: "expedições científicas realizadas", min: null, max: 50, unidade: "expedição" },
      ],
    },
    {
      n: 23,
      objetivos: [2],
      progresso: [],
      pactuados: [{ chave: "M23.2", oQue: "alunos de mestrado formados", min: 9, max: 18, unidade: "aluno" }],
    },
  ],
};

function ciclo(): RelatorioCiclo {
  return {
    id: CICLO_ID,
    slug: "ciclo-1",
    numero: 1,
    titulo: "Relato Anual — Ciclo 1",
    status: "aberto",
    periodo_inicio: "2025-05-01",
    periodo_fim: "2026-04-30",
    abre_em: "2026-06-01T00:00:00Z",
    fecha_em: "2026-09-30T23:59:59Z",
    vigencia_inicio: null,
    chamada: "nº 46/2024",
    processo: null,
    config: CONFIG,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

function laboratorio(id: string, sigla: string, ordem: number): Laboratorio {
  return {
    id,
    ciclo_id: CICLO_ID,
    sigla,
    nome: `Laboratório ${sigla}`,
    instituicao_nome: "Instituição X",
    instituicao_ror: null,
    uf: "RO",
    municipio_ibge: null,
    dgp_nome: null,
    dgp_url: null,
    eets: [],
    objetivos: [],
    lla_user_id: null,
    lla_nome: "Líder",
    lla_email: null,
    curador_acervo: false,
    ativo: true,
    ordem,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

function membro(over: Partial<CicloMembro>): CicloMembro {
  return {
    id: "m-x",
    ciclo_id: CICLO_ID,
    user_id: null,
    nome: "Membro",
    email: "membro@inct.br",
    categoria_picc: "Pesquisador",
    papel: "pesquisador",
    laboratorio_id: LAB_A,
    instituicao_ror: null,
    instituicao_nome: "Instituição X",
    uf: "RO",
    pais_iso2: "BR",
    lattes_id: null,
    orcid: null,
    ppg: null,
    indice_h: null,
    total_citacoes: null,
    satisfacao: null,
    scholar_id: null,
    indicadores_fonte: null,
    indicadores_atualizado_em: null,
    idioma: "pt",
    convite_token: "token",
    convidado_em: null,
    primeiro_acesso_em: null,
    ativo: true,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...over,
  };
}

function relato(over: Partial<Relato>): Relato {
  return {
    id: "r-x",
    ciclo_id: CICLO_ID,
    user_id: "u-x",
    membro_id: null,
    protocolo: null,
    status: "rascunho",
    nada_a_declarar: false,
    narrativas: {},
    respostas: {},
    declaracao_veracidade: false,
    cessao_imagem: false,
    submitted_at: null,
    preenchido_por: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...over,
  };
}

function producao(over: Partial<Producao>, vinculos: Array<Partial<ProducaoVinculo>>): ProducaoComVinculos {
  const p: Producao = {
    id: "p-x",
    ciclo_id: CICLO_ID,
    ancora_tipo: "doi",
    ancora_valor: "10.1000/teste",
    ancora_resolvida: true,
    tipo: "artigo_periodico",
    outro_descricao: "",
    ambito: null,
    ambito_origem: "inferido",
    convidado: false,
    ano: 2025,
    publicado_em: "2025-08-01",
    acesso_aberto: null,
    jcr: null,
    qualis: null,
    metadados: {},
    data_referencia: "2025-08-01",
    ciclo_competencia_id: CICLO_ID,
    periodo_situacao: "no_periodo",
    primeiro_declarado_em: "2026-07-01T00:00:00Z",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...over,
  };
  return {
    producao: p,
    vinculos: vinculos.map((v, i) => ({
      id: `v-${p.id}-${i}`,
      producao_id: p.id,
      relato_id: "r-x",
      origem: "doi_colado",
      menciona_apoio: "nao_sei",
      objetivos: [],
      publicavel: true,
      confirmado_em: "2026-07-01T00:00:00Z",
      ...v,
    })),
  };
}

function fato(over: Partial<Fato>): Fato {
  return {
    id: "f-x",
    ciclo_id: CICLO_ID,
    laboratorio_id: LAB_A,
    tipo: "expedicao",
    ocorrido_em: "2025-09-01",
    titulo: "Fato",
    payload: {},
    status: "confirmado",
    duplicado_de: null,
    observacao_revisao: "",
    comite: null,
    eets: [],
    objetivos: [],
    criado_por: null,
    confirmado_por: null,
    confirmado_em: null,
    ciclo_competencia_id: CICLO_ID,
    periodo_situacao: "no_periodo",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...over,
  };
}

/**
 * O ciclo pequeno mas completo: 4 membros ativos (3 enviaram), produção
 * compartilhada entre dois laboratórios, produção fora do período, ajuste do
 * líder em MS, fomento com item sem valor, extensão, dificuldades marcadas.
 */
function entradaCompleta(): EntradaDaAgregacao {
  const membros = [
    membro({ id: "m-lla", user_id: "u-lla", nome: "Lía Der", papel: "lla", laboratorio_id: LAB_A }),
    membro({ id: "m-ana", user_id: "u-ana", nome: "Ana Prado", laboratorio_id: LAB_A }),
    membro({ id: "m-bia", user_id: "u-bia", nome: "Bia Souza", laboratorio_id: LAB_B }),
    membro({ id: "m-caio", user_id: "u-caio", nome: "Caio Terra", laboratorio_id: LAB_A }), // silencioso
  ];
  const relatos = [
    relato({
      id: "r-lla",
      user_id: "u-lla",
      membro_id: "m-lla",
      status: "enviado",
      protocolo: "CNX-R1-0001",
      submitted_at: "2026-07-10T12:00:00Z",
      narrativas: { governanca: { alterou_equipe: true, equipe_inclusoes: 2 } },
      respostas: { contadores: { formados: { MS: { valor: 5, nota: "2 defesas fora do sistema" } } } } as never,
    }),
    relato({
      id: "r-ana",
      user_id: "u-ana",
      membro_id: "m-ana",
      status: "enviado",
      protocolo: "CNX-R1-0002",
      narrativas: { dificuldades_categorias: ["atraso-recursos", "insumos"] },
      respostas: {
        objetivos_confirmados: [1, 2],
        fomento: [
          { agencia: "CNPq", processo: "401/2025", titulo: "Projeto X", valor_brl: 1234567.5 },
          { agencia: "CNPq", processo: "402/2025" }, // sem valor
          { agencia: "FAPERO", titulo: "Edital Y", valor_brl: 50000, complementar: true },
        ],
        extensao: { tem: true, produtos: ["material_didatico"] },
      },
    }),
    relato({
      id: "r-bia",
      user_id: "u-bia",
      membro_id: "m-bia",
      status: "enviado",
      protocolo: "CNX-R1-0003",
      narrativas: { dificuldades_categorias: ["atraso-recursos"] },
    }),
    // Conta criada fora do roster: dita no recorte, fora do envelope.
    relato({ id: "r-fantasma", user_id: "u-fantasma", membro_id: null, status: "rascunho" }),
  ];
  const producoes = [
    producao(
      {
        id: "p-artigo",
        jcr: 3.5,
        qualis: "A1",
        metadados: { title: 'Veneno; "aspas" e ponto-e-vírgula', "container-title": "Toxicon" },
      },
      [
        { relato_id: "r-ana", objetivos: [1] },
        { relato_id: "r-bia", objetivos: [2] },
      ],
    ),
    producao(
      { id: "p-capitulo", tipo: "capitulo", ancora_tipo: "isbn", ancora_valor: "978-85-333-0000-0", metadados: { title: "Capítulo Um" } },
      [{ relato_id: "r-ana" }],
    ),
    producao(
      {
        id: "p-antigo",
        ciclo_competencia_id: null,
        periodo_situacao: "linha_de_base",
        data_referencia: "2024-01-01",
        metadados: { title: "Antigo" },
      },
      [{ relato_id: "r-ana" }],
    ),
  ];
  const fatos = [
    fato({ id: "f-exp", tipo: "expedicao", titulo: "Expedição Nazaré" }),
    fato({ id: "f-acao", tipo: "acao_sociedade", titulo: "Feira de ciência", payload: { pessoas_alcancadas: 120 } }),
    fato({ id: "f-ms1", tipo: "formacao", payload: { nivel: "mestrado", situacao: "concluida_no_periodo" } }),
    fato({ id: "f-ms2", tipo: "formacao", payload: { nivel: "mestrado", situacao: "concluida_no_periodo" } }),
    fato({ id: "f-bolsa", tipo: "bolsista", payload: { modalidade: "ITI-A", situacao: "em_curso" } }),
    fato({
      id: "f-parc",
      tipo: "parceria",
      laboratorio_id: LAB_B,
      payload: { ror_id: "05f9por33", pais_iso2: "CO", instituicao_nome: "Univ. Y" },
    }),
    fato({ id: "f-prop", tipo: "expedicao", status: "proposto", criado_por: "u-ana", titulo: "Proposta nova" }),
  ];
  const adesoes = [
    { id: "a1", fato_id: "f-exp", relato_id: "r-ana", user_id: "u-ana", papel_no_fato: null, aderido_em: "2026-07-01T00:00:00Z" },
  ];
  return {
    ciclo: ciclo(),
    laboratorios: [laboratorio(LAB_A, "LAB-A", 1), laboratorio(LAB_B, "LAB-B", 2)],
    membros,
    relatos,
    producoes,
    fatos,
    adesoes,
  };
}

const dados = agregarCiclo(entradaCompleta());

/** Linhas de dados de um CSV: sem BOM, sem comentários, sem cabeçalho. */
function linhasDeDados(csv: string): string[] {
  const semBom = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
  return semBom
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .slice(1); // remove a linha de cabeçalho das colunas
}

// A mesma lista de `tests/relato-narrativa.test.ts`, mais os da spec da minuta.
const ADJETIVOS_PROIBIDOS = [
  "importante",
  "relevante",
  "expressivo",
  "inovador",
  "pioneiro",
  "impacto",
  "significativo",
];

// ----------------------------------------------------------------- testes --

describe("formato pt-BR puro", () => {
  it("número com milhar em ponto e decimal em vírgula", () => {
    expect(numeroBr(1234567.5, 2)).toBe("1.234.567,50");
    expect(numeroBr(1234567)).toBe("1.234.567");
    expect(numeroBr(0)).toBe("0");
  });

  it("moeda e número livre (JCR mantém as casas que tem)", () => {
    expect(moedaBr(0)).toBe("R$ 0,00");
    expect(moedaBr(50000)).toBe("R$ 50.000,00");
    expect(numeroBrLivre(3.5)).toBe("3,5");
    expect(numeroBrLivre(12)).toBe("12");
  });

  it("data ISO vira DD/MM/AAAA; nula vira vazio", () => {
    expect(dataBr("2025-05-01")).toBe("01/05/2025");
    expect(dataBr(null)).toBe("");
  });
});

describe("CSV: o formato que o Excel pt-BR abre direto", () => {
  const csv = csvProducoes(dados);

  it("começa com BOM UTF-8", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csvPessoasRh(dados).charCodeAt(0)).toBe(0xfeff);
    expect(csvFomento(dados).charCodeAt(0)).toBe(0xfeff);
  });

  it("separa por ';' e escapa aspas e ponto-e-vírgula dentro da célula", () => {
    expect(csv).toContain("ancora_tipo;ancora;tipo;titulo;veiculo;ano;ambito;qualis;jcr;laboratorios_envolvidos");
    expect(csv).toContain('"Veneno; ""aspas"" e ponto-e-vírgula"');
  });

  it("decimal com vírgula (JCR 3.5 sai 3,5 — aspada, porque vírgula força aspas)", () => {
    const artigo = linhasDeDados(csv).find((l) => l.includes("Veneno"));
    expect(artigo).toContain(';"3,5";');
  });

  it("datas do período no cabeçalho em DD/MM/AAAA", () => {
    expect(csv).toContain("01/05/2025 a 30/04/2026");
  });

  it("todo CSV carrega a frase de parcialidade do recorte", () => {
    for (const arquivo of [csv, csvPessoasRh(dados), csvFomento(dados)]) {
      expect(arquivo).toContain("3 de 4 membros enviaram o relato");
    }
  });
});

describe("csvProducoes: a canônica, nunca o vínculo", () => {
  const csv = csvProducoes(dados);

  it("dois coautores = UMA linha; total de linhas é o total contado", () => {
    expect(linhasDeDados(csv)).toHaveLength(2); // p-artigo + p-capitulo
  });

  it("item fora do período NÃO aparece", () => {
    expect(csv).not.toContain("Antigo");
  });

  it("laboratórios envolvidos saem juntos na linha canônica", () => {
    const artigo = linhasDeDados(csv).find((l) => l.includes("Veneno"));
    expect(artigo).toContain('"LAB-A, LAB-B"');
  });

  it("âncora com rótulo humano (DOI/ISBN) e valor", () => {
    expect(csv).toContain("DOI;10.1000/teste");
    expect(csv).toContain("ISBN;978-85-333-0000-0");
  });
});

describe("csvPessoasRh: contado e ajustado lado a lado", () => {
  const csv = csvPessoasRh(dados);

  it("MS formado: contado 2, valor final 5 (ajuste do líder vence) e a divergência aparece", () => {
    expect(csv).toContain("RH formado no período;MS;Mestrado;2;5;1;");
  });

  it("TCC explica por que não é contável em vez de fingir zero", () => {
    const tcc = linhasDeDados(csv).find((l) => l.includes(";TCC;"));
    expect(tcc).toContain("informe o número à mão");
  });

  it("bolsa sem nível de estudante fica DITA no cabeçalho, fora da soma", () => {
    expect(csv).toContain("ITI-A");
  });
});

describe("csvFomento: corrente e complementar separados, sem NaN", () => {
  const csv = csvFomento(dados);

  it("item sem valor sai com célula vazia — nunca NaN, nunca zero inventado", () => {
    expect(csv).toContain("CNPq;402/2025;;projeto corrente;\n");
    expect(csv).not.toContain("NaN");
  });

  it("complementar é rotulado como captação nova; valor com vírgula decimal", () => {
    expect(csv).toContain('FAPERO;;Edital Y;complementar ao INCT (captação nova);"50000,00"');
    expect(csv).toContain('CNPq;401/2025;Projeto X;projeto corrente;"1234567,50"');
  });

  it("totais do cabeçalho em pt-BR, separados e com os sem-valor contados à parte", () => {
    expect(csv).toContain("Total corrente: R$ 1.234.567,50");
    expect(csv).toContain("captação nova): R$ 50.000,00");
    expect(csv).toContain("Itens sem valor declarado: 1");
  });
});

describe("minuta: factual, parcial e em pt-BR", () => {
  const minuta = minutaDoRelatorio(dados);

  it("traz as sete seções pedidas, na ordem do relatório", () => {
    expect(minuta.map((s) => s.id)).toEqual([
      "producao",
      "rh",
      "expedicoes-sociedade",
      "parcerias-rede",
      "fomento",
      "dificuldades",
      "extensao",
    ]);
  });

  it("toda seção DIZ a parcialidade no próprio texto e cita a fonte", () => {
    for (const s of minuta) {
      expect(s.texto).toContain("Com 3 de 4 relatos recebidos");
      expect(s.fonte).toContain("3 relatos enviados de 4 esperados");
    }
  });

  it("nenhum adjetivo da lista proibida, em texto, título ou fonte", () => {
    for (const s of minuta) {
      const tudo = `${s.titulo} ${s.texto} ${s.fonte}`.toLowerCase();
      for (const palavra of ADJETIVOS_PROIBIDOS) {
        expect(tudo).not.toContain(palavra);
      }
    }
  });

  it("nenhum percentual — execução é contagem, nunca fração de meta", () => {
    for (const s of minuta) expect(s.texto).not.toContain("%");
  });

  it("produção: total canônico, coautoria interna e fora-do-período à parte", () => {
    const s = minuta.find((x) => x.id === "producao")!;
    expect(s.texto).toContain("2 produções");
    expect(s.texto).toContain("1 produção envolve dois ou mais relatos");
    expect(s.texto).toContain("mediana 3,5");
    expect(s.texto).toContain("fora do período");
  });

  it("RH: o valor com ajuste prevalece e a divergência é dita", () => {
    const s = minuta.find((x) => x.id === "rh")!;
    expect(s.texto).toContain("Mestrado: 5");
    expect(s.texto).toContain("o líder ajustou os contadores automáticos");
    expect(s.texto).toContain("ITI-A");
  });

  it("expedições/sociedade: estimativa sai como 'aproximadamente' e pendentes fora", () => {
    const s = minuta.find((x) => x.id === "expedicoes-sociedade")!;
    expect(s.texto).toContain("1 expedição científica");
    expect(s.texto).toContain("aproximadamente 120 pessoas");
    expect(s.texto).toContain("não entram nestas contagens");
  });

  it("fomento: valores em pt-BR, somas separadas e sem-valor dito", () => {
    const s = minuta.find((x) => x.id === "fomento")!;
    expect(s.texto).toContain("R$ 1.234.567,50 em projetos correntes");
    expect(s.texto).toContain("R$ 50.000,00 em financiamento complementar");
    expect(s.texto).toContain("1 item sem valor declarado");
  });

  it("dificuldades: contagens por opção e as não marcadas listadas (ausência é dado)", () => {
    const s = minuta.find((x) => x.id === "dificuldades")!;
    expect(s.texto).toContain("Atraso na liberação de recursos ou de bolsas: 2 relatos");
    expect(s.texto).toContain("Insumos e reagentes (compra ou importação): 1 relato");
    expect(s.texto).toContain("Nenhum relato marcou:");
  });

  it("extensão: relatos com projeto e produtos por tipo", () => {
    const s = minuta.find((x) => x.id === "extensao")!;
    expect(s.texto).toContain("1 relato declarou projeto de extensão");
    expect(s.texto).toContain("Material didático: 1");
  });
});

describe("envelope §2.1: a forma é contrato", () => {
  // O cast tipado abaixo é parte do teste: se o envelope deixar de encaixar
  // nos tipos Envelope*, o tsc quebra AQUI antes de o teste rodar.
  const env = envelopeDoCiclo(dados) as {
    ciclo: EnvelopeCiclo;
    relatos: EnvelopeRelato[];
    laboratorios: EnvelopeLaboratorio[];
  };

  it("ciclo e schemas nos lugares certos", () => {
    expect(env.ciclo.slug).toBe("ciclo-1");
    expect(env.ciclo.periodo_inicio).toBe("2025-05-01");
    for (const r of env.relatos) expect(r.schema).toBe("inct-relato/1");
    for (const l of env.laboratorios) expect(l.schema).toBe("inct-relato-lab/1");
  });

  it("toda chave obrigatória do EnvelopeRelato existe em runtime", () => {
    const chaves = ["schema", "ciclo", "membro", "producoes", "adesoes", "fatos_propostos", "narrativas", "respostas", "envio"];
    for (const r of env.relatos) for (const chave of chaves) expect(r).toHaveProperty(chave);
  });

  it("relato sem vínculo no roster fica FORA do envelope (e dito no recorte)", () => {
    expect(env.relatos).toHaveLength(3); // r-fantasma não cabe em EnvelopeMembro
    expect(dados.recorte.relatosSemVinculoNoRoster).toBe(1);
  });

  it("produção fora do período entra MARCADA — exportada como dado, nunca como contado", () => {
    const ana = env.relatos.find((r) => r.membro.membro_id === "m-ana")!;
    expect(ana.producoes).toHaveLength(3);
    const antigo = ana.producoes.find((p) => p.producao_id === "p-antigo")!;
    expect(antigo.periodo_situacao).toBe("linha_de_base");
  });

  it("coautores na rede e metas derivadas do mapa do config", () => {
    const ana = env.relatos.find((r) => r.membro.membro_id === "m-ana")!;
    const artigo = ana.producoes.find((p) => p.producao_id === "p-artigo")!;
    expect(artigo.coautores_na_rede).toEqual(["Bia Souza"]);
    expect(artigo.objetivos).toEqual([1]);
    expect(artigo.metas_derivadas).toEqual([7]); // objetivo 1 → meta 7, do config
  });

  it("adesões e fatos propostos viajam no relato de quem os fez", () => {
    const ana = env.relatos.find((r) => r.membro.membro_id === "m-ana")!;
    expect(ana.adesoes).toEqual([{ fato_id: "f-exp", papel_no_fato: null, aderido_em: "2026-07-01T00:00:00Z" }]);
    expect(ana.fatos_propostos.map((f) => f.fato_id)).toEqual(["f-prop"]);
    expect(ana.envio.protocolo).toBe("CNX-R1-0002");
  });

  it("laboratório só entra com relato de LLA real — nada de envio fabricado", () => {
    expect(env.laboratorios).toHaveLength(1); // LAB-B não tem LLA nem lla_user_id
    const labA = env.laboratorios[0];
    expect(labA.laboratorio.sigla).toBe("LAB-A");
    expect(labA.governanca).toEqual({ alterou_equipe: true, equipe_inclusoes: 2 });
    expect(labA.envio.protocolo).toBe("CNX-R1-0001");
    expect(labA.equipe.map((m) => m.membro_id).sort()).toEqual(["m-ana", "m-caio", "m-lla"]);
    expect(labA.fatos.map((f) => f.fato_id)).toContain("f-ms1");
  });

  it("fato com número de pessoas sai marcado como estimado; participantes por nome", () => {
    const labA = env.laboratorios[0];
    const acao = labA.fatos.find((f) => f.fato_id === "f-acao")!;
    expect(acao.estimado).toBe(true);
    const exp = labA.fatos.find((f) => f.fato_id === "f-exp")!;
    expect(exp.estimado).toBe(false);
    expect(exp.participantes).toEqual(["Ana Prado"]);
  });
});
