/**
 * ============================================================================
 *  Agregação do painel da coordenação — as regras de honestidade, testadas
 * ============================================================================
 *  O que NÃO pode quebrar em silêncio:
 *   1. Produção fora do período NUNCA entra em contagem (vai para a lista à
 *      parte) — é a DECISÃO 3, e é o dado que o CNPq audita.
 *   2. O ajuste do líder VENCE o contador automático, e a divergência aparece.
 *   3. Fomento sem valor não soma NaN — fica contado como "sem valor".
 *   4. Objetivo com zero confirmações é LISTADO (o buraco que a coordenação
 *      precisa ver antes do relatório), não escondido.
 *   5. Satisfação vazia não divide por zero; média sempre sai com o n.
 *   6. Nenhum percentual de meta declarado: pactuado sai como PAR
 *      (declarado, pactuado), e o que não tem medição direta fica listado.
 * ============================================================================
 */
import { describe, expect, it } from "vitest";

import { agregarCiclo, type EntradaDaAgregacao } from "../src/relato/agregacao";
import type { ProducaoComVinculos } from "../src/relato/api";
import type {
  CicloConfig,
  CicloMembro,
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
  objetivos: [1, 2, 3, 4, 5].map((n) => ({ n, missao: "Pesquisa" })),
  metas: [
    {
      n: 7,
      objetivos: [1],
      progresso: [{ prazo: "2º ano", percentual: "35%" }],
      pactuados: [
        { chave: "M07.1", oQue: "expedições científicas realizadas", min: null, max: 50, unidade: "expedição" },
        { chave: "M07.4", oQue: "inquéritos aplicados", min: 1000, max: 1000, unidade: "inquérito" },
      ],
    },
    {
      n: 23,
      objetivos: [2],
      progresso: [{ prazo: "2º ano", percentual: "35%" }],
      pactuados: [
        { chave: "M23.2", oQue: "alunos de mestrado formados", min: 9, max: 18, unidade: "aluno" },
      ],
    },
  ],
};

function ciclo(over: Partial<RelatorioCiclo> = {}): RelatorioCiclo {
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
    ...over,
  };
}

function laboratorio(id: string, sigla: string, ordem: number, over: Partial<Laboratorio> = {}): Laboratorio {
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
    ...over,
  };
}

let seqMembro = 0;
function membro(over: Partial<CicloMembro> = {}): CicloMembro {
  seqMembro += 1;
  const n = seqMembro;
  return {
    id: `membro-${n}`,
    ciclo_id: CICLO_ID,
    user_id: `user-${n}`,
    nome: `Membro ${n}`,
    email: `membro${n}@inct.br`,
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
    convite_token: `token-${n}`,
    convidado_em: null,
    primeiro_acesso_em: null,
    ativo: true,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...over,
  };
}

let seqRelato = 0;
function relato(over: Partial<Relato> = {}): Relato {
  seqRelato += 1;
  const n = seqRelato;
  return {
    id: `relato-${n}`,
    ciclo_id: CICLO_ID,
    user_id: `user-${n}`,
    membro_id: `membro-${n}`,
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

let seqProducao = 0;
function producao(over: Partial<Producao> = {}, vinculos = 1): ProducaoComVinculos {
  seqProducao += 1;
  const n = seqProducao;
  const p: Producao = {
    id: `producao-${n}`,
    ciclo_id: CICLO_ID,
    ancora_tipo: "doi",
    ancora_valor: `10.1000/teste-${n}`,
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
  const vs: ProducaoVinculo[] = Array.from({ length: vinculos }, (_, i) => ({
    id: `vinculo-${n}-${i}`,
    producao_id: p.id,
    relato_id: `relato-x-${i}`,
    origem: "doi_colado",
    menciona_apoio: "nao_sei",
    objetivos: [],
    publicavel: true,
    confirmado_em: "2026-07-01T00:00:00Z",
  }));
  return { producao: p, vinculos: vs };
}

let seqFato = 0;
function fato(over: Partial<Fato> = {}): Fato {
  seqFato += 1;
  const n = seqFato;
  return {
    id: `fato-${n}`,
    ciclo_id: CICLO_ID,
    laboratorio_id: LAB_A,
    tipo: "expedicao",
    ocorrido_em: "2025-09-01",
    titulo: `Fato ${n}`,
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

function entrada(over: Partial<EntradaDaAgregacao> = {}): EntradaDaAgregacao {
  return {
    ciclo: ciclo(),
    laboratorios: [laboratorio(LAB_A, "LAB-A", 1), laboratorio(LAB_B, "LAB-B", 2)],
    membros: [],
    relatos: [],
    producoes: [],
    fatos: [],
    adesoes: [],
    ...over,
  };
}

// ----------------------------------------------------------------- testes --

describe("caso de borda: ciclo vazio", () => {
  it("zero relatos não estoura nada e o recorte diz 0 de 0", () => {
    const d = agregarCiclo(entrada());
    expect(d.recorte.relatosEnviados).toBe(0);
    expect(d.recorte.membrosAtivos).toBe(0);
    expect(d.recorte.frase).toContain("0 de 0");
    expect(d.producao.totalContado).toBe(0);
    expect(d.satisfacao.media).toBeNull();
    expect(d.fomento.totalCorrenteBrl).toBe(0);
    expect(d.rh.laboratoriosComFatos).toBe(0);
    // TCC continua explicando por que não é contável, mesmo sem fato nenhum.
    const tcc = d.rh.formados.find((l) => l.chave === "TCC");
    expect(tcc?.contavel).toBe(false);
    expect(tcc?.porQueNao).toBeTruthy();
  });

  it("objetivos do config aparecem TODOS zerados — o buraco é visível", () => {
    const d = agregarCiclo(entrada());
    expect(d.objetivos.confirmacoes).toHaveLength(5);
    expect(d.objetivos.semNenhumaConfirmacao).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("recorte e cobertura", () => {
  it("conta enviados, rascunhos e silenciosos por membro do roster", () => {
    const m1 = membro({ id: "m-1", primeiro_acesso_em: "2026-07-01T00:00:00Z" });
    const m2 = membro({ id: "m-2", primeiro_acesso_em: "2026-07-01T00:00:00Z" });
    const m3 = membro({ id: "m-3" });
    const inativo = membro({ id: "m-4", ativo: false });
    const d = agregarCiclo(
      entrada({
        membros: [m1, m2, m3, inativo],
        relatos: [
          relato({ membro_id: "m-1", status: "enviado", protocolo: "CNX-R1-0001" }),
          relato({ membro_id: "m-2", status: "rascunho" }),
        ],
      }),
    );
    expect(d.recorte.membrosAtivos).toBe(3); // inativo não é denominador
    expect(d.recorte.relatosEnviados).toBe(1);
    expect(d.recorte.relatosRascunho).toBe(1);
    expect(d.recorte.membrosSemRelato).toBe(1);
    expect(d.recorte.frase).toContain("1 de 3");
    const labA = d.coberturaPorLaboratorio.find((l) => l.laboratorioId === LAB_A);
    expect(labA).toMatchObject({ convidados: 3, entraram: 2, enviaram: 1, rascunhos: 1, silenciosos: 1 });
  });

  it("quem não tem laboratório atribuído vira linha própria, não some", () => {
    const d = agregarCiclo(entrada({ membros: [membro({ laboratorio_id: null })] }));
    const semLab = d.coberturaPorLaboratorio.find((l) => l.laboratorioId === null);
    expect(semLab?.convidados).toBe(1);
  });
});

describe("produção: contagem honesta", () => {
  it("fora do período NÃO conta — vai para a lista à parte", () => {
    const dentro = producao();
    const fora = producao({
      ciclo_competencia_id: null,
      periodo_situacao: "linha_de_base",
      data_referencia: "2024-01-01",
    });
    const d = agregarCiclo(entrada({ producoes: [dentro, fora] }));
    expect(d.producao.totalContado).toBe(1);
    expect(d.foraDoPeriodo).toHaveLength(1);
    expect(d.foraDoPeriodo[0]).toMatchObject({ entidade: "producao", situacao: "linha_de_base" });
  });

  it("produção sem vínculo nenhum não conta (espelho da view)", () => {
    const d = agregarCiclo(entrada({ producoes: [producao({}, 0)] }));
    expect(d.producao.totalContado).toBe(0);
  });

  it("dois coautores = dois vínculos, UM item — e o item sai como compartilhado", () => {
    const d = agregarCiclo(entrada({ producoes: [producao({}, 2)] }));
    expect(d.producao.totalContado).toBe(1);
    expect(d.producao.compartilhadas).toBe(1);
  });

  it("JCR sai como MEDIANA e faixa, nunca média — a cauda não distorce", () => {
    const d = agregarCiclo(
      entrada({
        producoes: [producao({ jcr: 1 }), producao({ jcr: 2 }), producao({ jcr: 40 })],
      }),
    );
    expect(d.producao.jcr.mediana).toBe(2); // a média seria 14,3 — mentirosa
    expect(d.producao.jcr.minimo).toBe(1);
    expect(d.producao.jcr.maximo).toBe(40);
    expect(d.producao.jcr.artigosComJcr).toBe(3);
  });

  it("distribuição Qualis conta só o preenchido e diz quantos faltam", () => {
    const d = agregarCiclo(
      entrada({
        producoes: [producao({ qualis: "A1" }), producao({ qualis: "A1" }), producao()],
      }),
    );
    expect(d.producao.qualis).toEqual([{ faixa: "A1", itens: 2 }]);
    expect(d.producao.artigosSemQualis).toBe(1);
  });

  it("top periódicos vem do container-title do CSL", () => {
    const d = agregarCiclo(
      entrada({
        producoes: [
          producao({ metadados: { "container-title": "Toxicon" } }),
          producao({ metadados: { "container-title": ["Toxicon"] } }),
          producao({ metadados: { "container-title": "PLOS NTD" } }),
        ],
      }),
    );
    expect(d.producao.topPeriodicos[0]).toEqual({ periodico: "Toxicon", itens: 2 });
  });
});

describe("RH da rede: soma por laboratório e ajuste do líder", () => {
  const fatosDoLabA = [
    fato({ tipo: "formacao", payload: { nivel: "mestrado", situacao: "concluida_no_periodo" } }),
    fato({ tipo: "formacao", payload: { nivel: "mestrado", situacao: "concluida_no_periodo" } }),
    fato({ tipo: "formacao", payload: { nivel: "doutorado", situacao: "em_andamento" } }),
  ];

  it("sem ajuste, o valor final é o contado automático", () => {
    const d = agregarCiclo(entrada({ fatos: fatosDoLabA }));
    const ms = d.rh.formados.find((l) => l.chave === "MS");
    expect(ms).toMatchObject({ contadoAutomatico: 2, valorFinal: 2, laboratoriosComAjuste: 0 });
    const dr = d.rh.estudantes.find((l) => l.chave === "DR");
    expect(dr?.valorFinal).toBe(1);
  });

  it("o ajuste do líder VENCE o automático e a divergência aparece", () => {
    const lider = membro({ id: "m-lla", papel: "lla", laboratorio_id: LAB_A });
    const relatoDoLider = relato({
      membro_id: "m-lla",
      respostas: { contadores: { formados: { MS: { valor: 5, nota: "2 defesas fora do sistema" } } } } as never,
    });
    const d = agregarCiclo(
      entrada({ membros: [lider], relatos: [relatoDoLider], fatos: fatosDoLabA }),
    );
    const ms = d.rh.formados.find((l) => l.chave === "MS");
    expect(ms?.contadoAutomatico).toBe(2);
    expect(ms?.valorFinal).toBe(5); // o ajuste vence
    expect(ms?.laboratoriosComAjuste).toBe(1); // e a divergência aparece
    expect(d.rh.laboratoriosComAjuste).toBe(1);
  });

  it("laboratórios diferentes somam, cada um com o próprio ajuste", () => {
    const liderA = membro({ id: "m-la", papel: "lla", laboratorio_id: LAB_A });
    const d = agregarCiclo(
      entrada({
        membros: [liderA],
        relatos: [
          relato({
            membro_id: "m-la",
            respostas: { contadores: { formados: { MS: { valor: 3 } } } } as never,
          }),
        ],
        fatos: [
          ...fatosDoLabA,
          fato({
            laboratorio_id: LAB_B,
            tipo: "formacao",
            payload: { nivel: "mestrado", situacao: "concluida_no_periodo" },
          }),
        ],
      }),
    );
    const ms = d.rh.formados.find((l) => l.chave === "MS");
    expect(ms?.contadoAutomatico).toBe(3); // 2 do A + 1 do B
    expect(ms?.valorFinal).toBe(4); // A ajustado para 3, B contado 1
    expect(d.rh.laboratoriosComFatos).toBe(2);
  });

  it("fato não confirmado ou fora do período não entra na soma de RH", () => {
    const d = agregarCiclo(
      entrada({
        fatos: [
          fato({
            tipo: "formacao",
            status: "proposto",
            payload: { nivel: "mestrado", situacao: "concluida_no_periodo" },
          }),
          fato({
            tipo: "formacao",
            ciclo_competencia_id: null,
            periodo_situacao: "linha_de_base",
            payload: { nivel: "mestrado", situacao: "concluida_no_periodo" },
          }),
        ],
      }),
    );
    const ms = d.rh.formados.find((l) => l.chave === "MS");
    expect(ms?.contadoAutomatico).toBe(0);
  });
});

describe("fomento: corrente e complementar separados, sem NaN", () => {
  it("item sem valor_brl não soma NaN — fica contado como sem valor", () => {
    const d = agregarCiclo(
      entrada({
        relatos: [
          relato({
            respostas: {
              fomento: [
                { agencia: "CNPq", processo: "401/2025", valor_brl: 100000 },
                { agencia: "CNPq", processo: "402/2025" }, // sem valor
                { agencia: "FAPERO", titulo: "Edital X", valor_brl: 50000, complementar: true },
              ],
            },
          }),
        ],
      }),
    );
    expect(d.fomento.totalCorrenteBrl).toBe(100000);
    expect(d.fomento.totalComplementarBrl).toBe(50000);
    expect(Number.isFinite(d.fomento.totalCorrenteBrl)).toBe(true);
    expect(d.fomento.itensSemValor).toBe(1);
    expect(d.fomento.relatosComFomento).toBe(1);
    const cnpq = d.fomento.porAgencia.find((a) => a.agencia === "CNPq");
    expect(cnpq).toMatchObject({ processosCorrente: 2, itensSemValor: 1, valorCorrenteBrl: 100000 });
  });

  it("valor não numérico (dado sujo no jsonb) não contamina a soma", () => {
    const d = agregarCiclo(
      entrada({
        relatos: [
          relato({
            respostas: { fomento: [{ agencia: "CNPq", valor_brl: "muito" as never }] },
          }),
        ],
      }),
    );
    expect(d.fomento.totalCorrenteBrl).toBe(0);
    expect(d.fomento.itensSemValor).toBe(1);
  });

  it("agência vazia não some — vira 'Agência não informada'", () => {
    const d = agregarCiclo(
      entrada({ relatos: [relato({ respostas: { fomento: [{ valor_brl: 10 }] } })] }),
    );
    expect(d.fomento.porAgencia[0].agencia).toBe("Agência não informada");
  });
});

describe("objetivos, satisfação, dificuldades", () => {
  it("objetivo sem confirmação é listado; confirmado duas vezes no mesmo relato conta uma", () => {
    const d = agregarCiclo(
      entrada({
        relatos: [
          relato({ respostas: { objetivos_confirmados: [1, 2, 2] } }),
          relato({ respostas: { objetivos_confirmados: [2] } }),
        ],
      }),
    );
    const c = new Map(d.objetivos.confirmacoes.map((o) => [o.numero, o.relatosConfirmaram]));
    expect(c.get(1)).toBe(1);
    expect(c.get(2)).toBe(2); // dois RELATOS, não três marcações
    expect(d.objetivos.semNenhumaConfirmacao).toEqual([3, 4, 5]);
    expect(d.objetivos.relatosQueResponderam).toBe(2);
  });

  it("satisfação vazia: média nula e rótulo explícito — nunca divisão por zero", () => {
    const d = agregarCiclo(entrada({ membros: [membro(), membro()] }));
    expect(d.satisfacao.media).toBeNull();
    expect(d.satisfacao.respondentes).toBe(0);
    expect(d.satisfacao.rotulo).toContain("Ninguém respondeu");
  });

  it("média de 3 respostas é rotulada como média de 3 respostas", () => {
    const d = agregarCiclo(
      entrada({
        membros: [
          membro({ satisfacao: 5 }),
          membro({ satisfacao: 4 }),
          membro({ satisfacao: 3 }),
          membro(), // não respondeu
        ],
      }),
    );
    expect(d.satisfacao.media).toBe(4);
    expect(d.satisfacao.respondentes).toBe(3);
    expect(d.satisfacao.rotulo).toContain("3 resposta");
    expect(d.satisfacao.distribuicao.find((x) => x.nota === 4)?.membros).toBe(1);
  });

  it("dificuldades marcadas contam por id, com rótulo humano", () => {
    const d = agregarCiclo(
      entrada({
        relatos: [
          relato({ narrativas: { dificuldades_categorias: ["atraso-recursos", "insumos"] } }),
          relato({ narrativas: { dificuldades_categorias: ["atraso-recursos"] } }),
          relato({ narrativas: { oportunidades_categorias: ["parceria"] } }),
        ],
      }),
    );
    const atraso = d.dificuldades.find((o) => o.id === "atraso-recursos");
    expect(atraso?.relatos).toBe(2);
    expect(atraso?.rotulo).toContain("Atraso");
    expect(d.oportunidades.find((o) => o.id === "parceria")?.relatos).toBe(1);
    // opção nunca marcada continua na lista, com zero — ausência é dado
    expect(d.dificuldades.find((o) => o.id === "licencas")?.relatos).toBe(0);
  });
});

describe("pactuados: par (declarado, pactuado), nunca percentual", () => {
  it("expedições casam com M07.1 pela contagem de fatos confirmados", () => {
    const d = agregarCiclo(
      entrada({
        fatos: [
          fato({ tipo: "expedicao" }),
          fato({ tipo: "expedicao" }),
          fato({ tipo: "expedicao", status: "proposto" }), // não conta
          fato({ tipo: "expedicao", ciclo_competencia_id: null, periodo_situacao: "posterior" }), // não conta
        ],
      }),
    );
    const m071 = d.pactuados.medidos.find((p) => p.chave === "M07.1");
    expect(m071?.declarado).toBe(2);
    expect(m071?.pactuado).toBe("até 50 expedição");
    expect(m071?.comoFoiMedido).toBeTruthy();
  });

  it("mestres formados casam com M23.2 já com o ajuste do líder", () => {
    const lider = membro({ id: "m-lla", papel: "lla", laboratorio_id: LAB_A });
    const d = agregarCiclo(
      entrada({
        membros: [lider],
        relatos: [
          relato({
            membro_id: "m-lla",
            respostas: { contadores: { formados: { MS: { valor: 7 } } } } as never,
          }),
        ],
        fatos: [fato({ tipo: "formacao", payload: { nivel: "mestrado", situacao: "concluida_no_periodo" } })],
      }),
    );
    expect(d.pactuados.medidos.find((p) => p.chave === "M23.2")?.declarado).toBe(7);
  });

  it("pactuado sem correspondência direta fica LISTADO como sem medição — não some", () => {
    const d = agregarCiclo(entrada());
    const semMedicao = d.pactuados.semMedicaoAutomatica.map((p) => p.chave);
    expect(semMedicao).toContain("M07.4"); // inquéritos: nada nos dados mede isso
    // e nenhum pactuado do config se perdeu entre as duas listas
    const todas = [...d.pactuados.medidos.map((p) => p.chave), ...semMedicao];
    expect(todas.sort()).toEqual(["M07.1", "M07.4", "M23.2"].sort());
  });

  it("nenhum campo dos medidos é percentual declarado", () => {
    const d = agregarCiclo(entrada({ fatos: [fato({ tipo: "expedicao" })] }));
    for (const p of d.pactuados.medidos) {
      expect(typeof p.declarado).toBe("number"); // contagem, não fração
      expect(p.pactuado).not.toContain("%");
    }
    expect(d.pactuados.aviso.length).toBeGreaterThan(0);
  });

  it("config vazio (Ciclo 2 recém-nascido) não estoura: listas vazias", () => {
    const d = agregarCiclo(entrada({ ciclo: ciclo({ config: {} }) }));
    expect(d.pactuados.medidos).toEqual([]);
    expect(d.pactuados.semMedicaoAutomatica).toEqual([]);
  });
});

describe("indicadores de membros e rede", () => {
  it("conta preenchidos por fonte — número sem fonte aparece como sem_fonte", () => {
    const d = agregarCiclo(
      entrada({
        membros: [
          membro({ indice_h: 12, total_citacoes: 830, indicadores_fonte: "scholar", scholar_id: "JicYPdAAAAAJ" }),
          membro({ indice_h: 8, indicadores_fonte: "openalex" }),
          membro({ indice_h: 3 }), // preenchido sem fonte (linha anterior à 010)
          membro(), // nada
        ],
      }),
    );
    expect(d.indicadores.comIndiceH).toBe(3);
    expect(d.indicadores.comScholarId).toBe(1);
    const porFonte = new Map(d.indicadores.porFonte.map((f) => [f.fonte, f.membros]));
    expect(porFonte.get("scholar")).toBe(1);
    expect(porFonte.get("openalex")).toBe(1);
    expect(porFonte.get("sem_fonte")).toBe(1);
  });

  it("países e instituições saem do ROR declarado (roster + parceria confirmada)", () => {
    const d = agregarCiclo(
      entrada({
        membros: [
          membro({ instituicao_ror: "02842cb31", pais_iso2: "BR" }),
          membro({ instituicao_ror: "01qg3j296", pais_iso2: "PT" }),
          membro(), // sem ROR
        ],
        fatos: [
          fato({ tipo: "parceria", payload: { ror_id: "05f9por33", pais_iso2: "CO" } }),
        ],
      }),
    );
    expect(d.rede.instituicoesComRor).toBe(3);
    expect(d.rede.paises).toEqual(["BR", "CO", "PT"]);
    expect(d.rede.membrosSemRor).toBe(1);
  });

  it("fatos por tipo: adesões contadas por fato e propostas pendentes à parte", () => {
    const f1 = fato({ tipo: "expedicao" });
    const d = agregarCiclo(
      entrada({
        fatos: [f1, fato({ tipo: "acao_sociedade", payload: { pessoas_alcancadas: 120 } }), fato({ status: "proposto" })],
        adesoes: [
          { id: "a1", fato_id: f1.id, relato_id: null, user_id: "u1", papel_no_fato: null, aderido_em: "2026-07-01T00:00:00Z" },
          { id: "a2", fato_id: f1.id, relato_id: null, user_id: "u2", papel_no_fato: null, aderido_em: "2026-07-01T00:00:00Z" },
        ],
      }),
    );
    const exp = d.fatos.porTipo.find((t) => t.tipo === "expedicao");
    expect(exp?.itens).toBe(1);
    expect(exp?.adesoes).toBe(2);
    const acao = d.fatos.porTipo.find((t) => t.tipo === "acao_sociedade");
    expect(acao?.pessoasAlcancadasEstimado).toBe(120);
    expect(d.fatos.propostosPendentes).toBe(1);
  });

  it("extensão: conta relatos com projeto e os produtos por tipo", () => {
    const d = agregarCiclo(
      entrada({
        relatos: [
          relato({ respostas: { extensao: { tem: true, produtos: ["material_didatico", "curso_formacao"] } } }),
          relato({ respostas: { extensao: { tem: false } } }),
        ],
      }),
    );
    expect(d.extensao.relatosComExtensao).toBe(1);
    expect(d.extensao.produtosPorTipo).toContainEqual({ tipo: "material_didatico", itens: 1 });
  });
});

describe("pureza e rastreabilidade", () => {
  it("mesma entrada, mesma saída — sem relógio embutido", () => {
    const e = entrada({
      membros: [membro({ satisfacao: 4 })],
      relatos: [relato({ status: "enviado" })],
      fatos: [fato()],
    });
    const a = agregarCiclo(e);
    const b = agregarCiclo(e);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("os brutos viajam intactos para o exportador", () => {
    const e = entrada({ relatos: [relato()] });
    const d = agregarCiclo(e);
    expect(d.brutos.relatos).toBe(e.relatos);
    expect(d.brutos.ciclo.id).toBe(CICLO_ID);
  });
});
