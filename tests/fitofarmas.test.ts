/**
 * O formulário pré-evento do I Workshop Conexão Fitofarmas (#/fitofarmas).
 *
 * Quatro coisas quebram aqui em silêncio, e todas só apareceriam com o QR code
 * já impresso e o e-mail já enviado — quando já não dá para consertar:
 *
 * 1. **O endereço existir no texto e não no roteador.** O link vai em QR code,
 *    em cartaz e em mensagem de WhatsApp. Um endereço que cai na home não avisa
 *    que caiu: a pessoa vê o site institucional, conclui que "o link expirou" e
 *    desiste em silêncio. A rota é testada pela CONSTANTE exportada, nunca por
 *    uma string reescrita no teste.
 *
 * 2. **A divergência entre os ids do cliente e os `check` do banco.** As listas
 *    de `perguntas.ts` e as constraints da 008 são as MESMAS listas, escritas
 *    duas vezes. Um id digitado diferente não quebra o build — vira uma
 *    resposta que o banco recusa no envio, na frente da pessoa, depois de
 *    quatro minutos de preenchimento. Aqui o .sql é LIDO e comparado.
 *
 * 3. **A divergência entre a régua do escore em TypeScript e a do SQL.** O
 *    escore que vale é o do servidor; `escore.ts` é a especificação executável
 *    dele. Se os pesos se separarem, a documentação passa a mentir sobre a
 *    priorização — e ninguém percebe, porque as duas rodam em lugares
 *    diferentes.
 *
 * 4. **A porta aberta.** A 008 é a primeira migração do projeto que aceita
 *    escrita sem sessão. O teste lê o SQL e prova que a tabela NÃO tem policy
 *    de insert para anônimo, que os grants foram revogados de PUBLIC antes de
 *    concedidos, e que a função do escore não é executável por anon.
 *
 * Fecha com o que NÃO pode existir: a rota fora do menu (é campanha com prazo)
 * e o módulo fora do bundle da home (ele puxa o SDK do Supabase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseHash, FITOFARMAS_HREF } from "../src/webinars/router";
import {
  APORTES,
  CANAIS,
  COMPROMISSOS,
  DECISOES,
  DISPONIBILIDADES,
  EETS,
  HISTORICOS,
  HORIZONTES,
  INICIATIVAS,
  INTERESSES,
  MAX_EETS,
  OPCOES_UF,
  PASSOS,
  SEDES,
  TOTAL_PASSOS,
  UFS,
  UF_EXTERIOR,
  VINCULOS,
} from "../src/fitofarmas/perguntas";
import {
  CORTES,
  PESO_COMPROMISSO,
  PESO_DECISAO,
  PESO_DISPONIBILIDADE,
  PESO_HISTORICO,
  PESO_HORIZONTE,
  PESO_INTERESSE,
  escoreDe,
  faixaDe,
} from "../src/fitofarmas/escore";
import {
  LIMITES,
  ROTULO_CAMPO,
  erroDoPasso,
  normalizarParaEnvio,
  pendenciasDe,
  validarEmail,
  validarLattesOuUrl,
  validarTelefone,
} from "../src/fitofarmas/validation";
import type { Respostas } from "../src/fitofarmas/types";

const raiz = join(__dirname, "..");
const sql = readFileSync(join(raiz, "supabase/migrations/008_workshop_fitofarmas.sql"), "utf-8");
const seed = readFileSync(join(raiz, "supabase/seeds/003_workshop_fitofarmas.sql"), "utf-8");
const appTsx = readFileSync(join(raiz, "src/App.tsx"), "utf-8");
const formulario = readFileSync(join(raiz, "src/fitofarmas/FormularioPreEvento.tsx"), "utf-8");

/**
 * Estes dois arquivos são densos em comentário — é a convenção do repositório,
 * e é a razão de haver uma frase como "NUNCA count(*) + 1" dentro da 008. Um
 * teste que procura padrão PROIBIDO tem de olhar o CÓDIGO, não a prosa: senão
 * ele falha justamente porque alguém documentou a armadilha que evitou.
 */
const sqlSemProsa = sql.replace(/^\s*--.*$/gm, "");
const formularioSemProsa = formulario
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/** Uma resposta completa e válida do caminho LONGO, para partir dela. */
const CHEIA: Respostas = {
  nome: "Maria da Silva Santos",
  email: "maria@unir.br",
  telefone: "(69) 99999-0000",
  instituicao: "UNIR — Universidade Federal de Rondônia",
  uf: "RO",
  vinculo: "docente_pesquisador",
  lattes: "",
  orcid: "",
  interesse: "colaborar",
  sede: "ambas",
  eets: ["eet3", "eet4"],
  formas: ["pesquisa_conjunta"],
  aportes: ["dados"],
  aportes_detalhe: { dados: "Herbário HFSL, 12 mil exsicatas" },
  iniciativas: ["projeto_pesquisa"],
  disponibilidade: "ate_1_dia_mes",
  horizonte: "ate_6_meses",
  decisao: "decido",
  historico: "informal",
  compromissos: ["reuniao_30d"],
  chance_1a5: 4,
  comentario: "",
  canal: "email",
  lgpd: true,
};

/** O caminho CURTO: quem só quer acompanhar não responde os passos 3 e 4. */
const CURTA: Respostas = {
  ...CHEIA,
  interesse: "acompanhar",
  eets: [],
  formas: [],
  aportes: [],
  aportes_detalhe: {},
  iniciativas: [],
  disponibilidade: "",
  horizonte: "",
  decisao: "",
  historico: "",
  compromissos: [],
  chance_1a5: 0,
};

// ===========================================================================
describe("a rota #/fitofarmas", () => {
  it("resolve pela constante que vai no QR code, e não por uma string reescrita", () => {
    expect(FITOFARMAS_HREF).toBe("#/fitofarmas");
    expect(parseHash(FITOFARMAS_HREF)).toEqual({ name: "fitofarmas" });
  });

  it("resolve com barra final e com a query que um encurtador de link acrescenta", () => {
    expect(parseHash("#/fitofarmas/")).toEqual({ name: "fitofarmas" });
    expect(parseHash("#/fitofarmas?utm_source=whatsapp")).toEqual({ name: "fitofarmas" });
  });

  it("está montada no App.tsx com Suspense — sem isso o chunk nunca carrega", () => {
    expect(appTsx).toContain('route.name === "fitofarmas"');
    expect(appTsx).toContain("<FitofarmasPreEvento />");
  });

  it("entra por lazy(), nunca por import estático: o SDK do Supabase não pode ir para a home", () => {
    expect(appTsx).toContain('lazy(() => import("./fitofarmas/FormularioPreEvento"))');
    expect(appTsx).not.toMatch(/^import .*from "\.\/fitofarmas\//m);
  });

  it("ESTÁ no menu do cabeçalho (decisão do dono, 2026-08-07)", () => {
    // A implementação original deixava a rota fora do menu ("campanha com prazo
    // vira link morto em setembro"); o dono decidiu pela visibilidade durante a
    // campanha. Este teste trava a decisão ATUAL: se o item sumir do menu num
    // refactor, é regressão — a remoção deliberada pós-evento muda este teste
    // junto, e a ROTA continua existindo de qualquer forma (QR code impresso
    // não sabe que o evento acabou).
    const navItems = appTsx.slice(appTsx.indexOf("const navItems"), appTsx.indexOf("const navItems") + 2000);
    expect(navItems).toContain('label: "Fitofarmas"');
    expect(navItems).toContain("FITOFARMAS_HREF");
    expect(navItems).toContain('routes: ["fitofarmas"]');
  });
});

// ===========================================================================
describe("os ids do cliente e os `check` da 008 são as mesmas listas", () => {
  /** Extrai os literais de um `check (coluna in ('a','b',…))` do arquivo .sql. */
  const literaisDoCheck = (coluna: string): string[] => {
    const m = sql.match(new RegExp(`check \\(${coluna} in \\(([^)]*)\\)\\)`, "s"));
    if (!m) throw new Error(`não achei o check de ${coluna} na 008`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
  };

  const casos: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["vinculo", VINCULOS.map(([id]) => id)],
    ["interesse", INTERESSES.map(([id]) => id)],
    ["sede", SEDES.map(([id]) => id)],
    ["disponibilidade", DISPONIBILIDADES.map(([id]) => id)],
    ["horizonte", HORIZONTES.map(([id]) => id)],
    ["decisao", DECISOES.map(([id]) => id)],
    ["historico", HISTORICOS.map(([id]) => id)],
    ["canal", CANAIS.map(([id]) => id)],
  ];

  for (const [coluna, ids] of casos) {
    it(`${coluna}: cliente e banco aceitam exatamente os mesmos valores`, () => {
      expect(literaisDoCheck(coluna)).toEqual([...ids].sort());
    });
  }

  it("os pesos de compromisso da 008 cobrem TODOS os ids oferecidos na tela", () => {
    const pesos = sql.slice(sql.indexOf("join (values"), sql.indexOf(") as p(id, peso)"));
    for (const [id] of COMPROMISSOS) {
      expect(pesos, `compromisso ${id} sem peso na 008`).toContain(`'${id}'`);
    }
  });

  it("o teto de eixos é o mesmo dos dois lados", () => {
    expect(MAX_EETS).toBe(3);
    expect(sql).toContain("check (cardinality(eets) <= 3)");
    expect(EETS).toHaveLength(8);
  });

  it("o exclusivo dos aportes existe nas duas pontas ('nenhum' nunca pontua)", () => {
    expect(APORTES.some((a) => a.id === "nenhum")).toBe(true);
    expect(sql).toContain("where t.x <> 'nenhum'");
  });

  it("o exclusivo das iniciativas existe nas duas pontas", () => {
    expect(INICIATIVAS.some(([id]) => id === "nenhuma")).toBe(true);
    expect(sql).toContain("where t.x <> 'nenhuma'");
  });

  it("os limites de tamanho do cliente são os mesmos das constraints", () => {
    expect(sql).toContain("check (char_length(btrim(nome)) between 3 and 140)");
    expect(LIMITES.nomeMin).toBe(3);
    expect(LIMITES.nomeMax).toBe(140);
    expect(sql).toContain("char_length(email) <= 254");
    expect(LIMITES.emailMax).toBe(254);
    expect(sql).toContain("check (char_length(btrim(instituicao)) between 2 and 160)");
    expect(LIMITES.instituicaoMax).toBe(160);
    expect(sql).toContain("char_length(comentario) <= 600");
    expect(LIMITES.comentarioMax).toBe(600);
    // o "qual?" de cada aporte, imposto por `workshop_detalhe_ok`
    expect(sql).toContain("char_length(v) > 140");
    expect(LIMITES.detalheMax).toBe(140);
  });

  it("a expressão de e-mail é literalmente a mesma nos dois lados", () => {
    // Se a tela aceitasse o que o banco recusa, a pessoa levaria erro genérico
    // no envio, com tudo preenchido — o pior momento possível.
    expect(sql).toContain("^[a-z0-9._%+-]+@[a-z0-9-]+(\\.[a-z0-9-]+)+$");
    expect(validarEmail("ana@fiocruz.br").ok).toBe(true);
    expect(validarEmail("ana@fiocruz").ok).toBe(false);
    expect(validarEmail("ana@exemplo.invalid").ok).toBe(false);
    expect(sql).toContain("like '%.invalid'");
  });
});

// ===========================================================================
describe("a régua do escore: TypeScript e SQL não podem se separar", () => {
  /** Lê o número de um `when 'x' then N` dentro do bloco de uma coluna. */
  const pesoNoSql = (coluna: string, id: string): number => {
    const bloco = sql.slice(sql.indexOf(`case r ->> '${coluna}'`));
    const m = bloco.slice(0, 400).match(new RegExp(`when '${id}'\\s*then (\\d+)`));
    if (!m) throw new Error(`não achei o peso de ${coluna}='${id}' na 008`);
    return Number(m[1]);
  };

  const dimensoes: ReadonlyArray<readonly [string, Readonly<Record<string, number>>]> = [
    ["disponibilidade", PESO_DISPONIBILIDADE],
    ["horizonte", PESO_HORIZONTE],
    ["decisao", PESO_DECISAO],
    ["historico", PESO_HISTORICO],
    ["interesse", PESO_INTERESSE],
  ];

  for (const [coluna, pesos] of dimensoes) {
    it(`${coluna}: cada peso do escore.ts é o mesmo da 008`, () => {
      for (const [id, peso] of Object.entries(pesos)) {
        if (peso === 0) continue; // o `else 0` do SQL cobre os zeros
        expect(pesoNoSql(coluna, id), `${coluna}='${id}'`).toBe(peso);
      }
    });
  }

  it("os pesos de compromisso são os mesmos", () => {
    const bloco = sql.slice(sql.indexOf("join (values"), sql.indexOf(") as p(id, peso)"));
    for (const [id, peso] of Object.entries(PESO_COMPROMISSO)) {
      expect(bloco, `compromisso ${id}`).toContain(`('${id}', ${peso})`);
    }
  });

  it("nomear um aporte vale 5× marcar — é a distinção que sustenta o instrumento", () => {
    expect(sql).toContain("nomeados * 5 + (marcados - nomeados) * 1");
    const soMarcou = escoreDe({ ...CHEIA, aportes_detalhe: {} });
    const nomeou = escoreDe(CHEIA);
    expect(nomeou - soMarcou).toBe(4); // 5 (nomeado) − 1 (só marcado)
  });

  it("a autodeclaração vale no máximo 4 pontos em 100", () => {
    const minimo = escoreDe({ ...CHEIA, chance_1a5: 1 });
    const maximo = escoreDe({ ...CHEIA, chance_1a5: 5 });
    expect(maximo - minimo).toBe(4);
    expect(sql).toContain("least(4, greatest(0, coalesce((r ->> 'chance_1a5')::int, 0) - 1))");
  });

  it("o corte em 100 existe nos dois lados e ninguém estoura", () => {
    const tudo: Respostas = {
      ...CHEIA,
      interesse: "proposta",
      eets: ["eet1", "eet2", "eet3"],
      formas: ["pesquisa_conjunta", "infraestrutura"],
      aportes: ["infraestrutura", "dados", "projeto", "rede", "financiamento", "equipe", "territorio"],
      aportes_detalhe: {
        infraestrutura: "CLAE",
        dados: "Herbário",
        projeto: "PPGBIOEXP",
        rede: "redesFITO",
        financiamento: "FAPERO 2025",
        equipe: "3 mestrandos",
        territorio: "UBS do Cai N'Água",
      },
      iniciativas: ["projeto_pesquisa", "submissao_edital", "publicacao", "produto", "banco_dados"],
      disponibilidade: "ate_1_dia_semana",
      horizonte: "ja_tenho",
      decisao: "decido",
      historico: "formal",
      compromissos: [
        "carta_intencao",
        "coescrever_proposta",
        "sediar_atividade",
        "gt_redesfito",
        "compartilhar_dados",
      ],
      chance_1a5: 5,
    };
    expect(escoreDe(tudo)).toBe(100);
    expect(sql).toContain("greatest(0, least(100,");
  });

  it("quem só quer acompanhar não é punido — fica no zero, sem número negativo", () => {
    expect(escoreDe(CURTA)).toBe(0);
    expect(faixaDe(0)).toBe("informativo");
  });

  it("nunca lança em jsonb velho, torto ou faltando campos", () => {
    expect(escoreDe({})).toBe(0);
    expect(escoreDe({ compromissos: ["campo_que_nao_existe"] as never })).toBe(0);
    expect(escoreDe({ chance_1a5: 0 })).toBe(0);
  });

  it("as faixas da view da 008 são os mesmos cortes do escore.ts", () => {
    expect(sql).toContain(`when r.escore_intencao >= ${CORTES.prioritario} then 'prioritario'`);
    expect(sql).toContain(`when r.escore_intencao >= ${CORTES.promissor} then 'promissor'`);
    expect(sql).toContain(`when r.escore_intencao >= ${CORTES.acompanhar} then 'acompanhar'`);
    expect(faixaDe(CORTES.prioritario)).toBe("prioritario");
    expect(faixaDe(CORTES.promissor)).toBe("promissor");
    expect(faixaDe(CORTES.acompanhar)).toBe("acompanhar");
    expect(faixaDe(CORTES.acompanhar - 1)).toBe("informativo");
  });

  it("o compromisso caro vale mais que o barato — a ordem é o instrumento", () => {
    const barato = escoreDe({ ...CHEIA, compromissos: ["reuniao_30d"] });
    const caro = escoreDe({ ...CHEIA, compromissos: ["carta_intencao"] });
    expect(caro).toBeGreaterThan(barato);
    // "prefiro definir depois" é resposta honesta e não penaliza
    expect(escoreDe({ ...CHEIA, compromissos: ["depois"] })).toBe(
      escoreDe({ ...CHEIA, compromissos: [] }),
    );
  });
});

// ===========================================================================
describe("a 008 fecha a porta que abriu", () => {
  it("a tabela de respostas não tem NENHUMA policy de escrita", () => {
    const policies = [...sql.matchAll(/create policy (\w+) on public\.workshop_respostas\s+for (\w+)/g)];
    expect(policies.length).toBeGreaterThan(0);
    for (const [, nome, comando] of policies) {
      expect(comando.toLowerCase(), `a policy ${nome} não pode escrever`).toBe("select");
    }
  });

  it("anon perde tudo nas tabelas e ganha só a execução da RPC", () => {
    // Tolerante a espaçamento, intolerante ao conteúdo: o alinhamento das
    // colunas muda quando um nome novo entra na lista, a garantia não.
    expect(sqlSemProsa).toMatch(/revoke all\s+on public\.workshop_respostas\s+from anon;/);
    expect(sqlSemProsa).toMatch(/revoke all\s+on public\.workshop_respostas_versoes\s+from anon;/);
    expect(sqlSemProsa).toMatch(/grant\s+execute on function public\.registrar_intencao_workshop/);
  });

  it("o histórico de versões é append-only: escrito por trigger, sem policy de escrita", () => {
    // Sobrescrever por e-mail é a UX desejada; destruir o que estava lá não é.
    // Num formulário sem login o e-mail não prova nada, então a única defesa
    // honesta é guardar a versão anterior antes de trocar.
    expect(sql).toContain("create table if not exists public.workshop_respostas_versoes");
    expect(sql).toContain("alter table public.workshop_respostas_versoes enable row level security");
    expect(sql).toContain("execute function public.workshop_arquivar_versao()");
    const policies = [
      ...sql.matchAll(/create policy \w+ on public\.workshop_respostas_versoes\s+for (\w+)/g),
    ];
    expect(policies.length).toBeGreaterThan(0);
    for (const [, comando] of policies) expect(comando.toLowerCase()).toBe("select");
  });

  it("revoga de PUBLIC antes de conceder — revogar só de anon é inócuo", () => {
    const revoke = sql.indexOf("revoke execute on function public.registrar_intencao_workshop");
    const grant = sql.indexOf("grant  execute on function public.registrar_intencao_workshop");
    expect(revoke).toBeGreaterThan(0);
    expect(grant).toBeGreaterThan(revoke);
    expect(sql.slice(revoke, grant)).toContain("from public;");
  });

  it("a fórmula do escore NÃO é executável por quem responde", () => {
    // Saber a régua é saber quais caixas marcar. A função fica fechada.
    expect(sqlSemProsa).toMatch(
      /revoke execute on function public\.escore_intencao_workshop\(jsonb\)\s+from public, anon, authenticated;/,
    );
  });

  it("a view da coordenação respeita a RLS de quem consulta", () => {
    expect(sql).toContain("alter view public.workshop_prioridade set (security_invoker = on)");
  });

  it("tem isca, freio de tempo e freio de enxurrada", () => {
    expect(sql).toContain("coalesce(btrim(p_isca), '') <> ''");
    expect(sql).toContain("coalesce(p_ms, 0) < 4000");
    expect(sql).toContain("v_recentes >= 40");
    // A isca devolve ok=true de propósito: dizer "recusado" ensina o robô.
    const trecho = sql.slice(sql.indexOf("coalesce(btrim(p_isca)"), sql.indexOf("-- ---- 1. a edição"));
    expect(trecho).toContain("'ok', true");
  });

  it("um e-mail por edição: reenviar CORRIGE em vez de duplicar", () => {
    expect(sql).toContain("create unique index if not exists workshop_respostas_email_unico");
    expect(sql).toContain("(edicao_id, lower(email))");
  });

  it("a RPC não vira ORÁCULO de 'este e-mail já respondeu'", () => {
    // A RPC é executável por qualquer pessoa com a chave anônima (que é pública
    // por design). Se o desfecho de correção fosse distinguível do de primeira
    // resposta, percorrer a lista de convidados revelaria quem já respondeu.
    // Os TRÊS desfechos de sucesso — insert, update e corrida — usam o mesmo
    // estado e a mesma frase.
    expect(sqlSemProsa).not.toContain("'estado', 'atualizado'");
    const sucessos = [...sqlSemProsa.matchAll(/'ok', true, 'estado', '(\w+)'/g)].map((m) => m[1]);
    expect(sucessos.length).toBeGreaterThanOrEqual(3);
    expect(new Set(sucessos)).toEqual(new Set(["recebido"]));
  });

  it("o consentimento é exigido também na correção, não só na primeira resposta", () => {
    // Sem isto, "lgpd": false era recusado para e-mail novo e ACEITO para quem
    // já havia respondido — a linha seguia afirmando um consentimento que
    // aquele envio não trouxe.
    const update = sql.slice(sql.indexOf("update public.workshop_respostas set"));
    expect(update.slice(0, 2600)).toContain("consentimento_lgpd = coalesce((p_respostas ->> 'lgpd')::boolean, false)");
  });

  it("o freio de enxurrada conta ESCRITAS, não só linhas novas", () => {
    // touch_updated_at só mexe em updated_at: contando created_at, o ramo de
    // correção reescrevia a mesma linha para sempre por baixo do freio.
    expect(sql).toContain("r.updated_at > now() - interval '1 minute'");
    expect(sqlSemProsa).not.toContain("r.created_at > now() - interval '1 minute'");
  });

  it("as colunas de array têm vocabulário fechado e teto — não só as escalares", () => {
    for (const coluna of ["eets", "formas", "aportes", "iniciativas", "compromissos"]) {
      expect(sql, `${coluna} sem teto`).toContain(`check (cardinality(${coluna}) <=`);
      expect(sql, `${coluna} sem vocabulário`).toContain(`public.workshop_subset(${coluna},`);
    }
    // Os ids oferecidos na tela precisam estar no vocabulário do banco.
    const vocab = sql.slice(sql.indexOf("workshop_respostas_compromissos_valores"));
    for (const [id] of COMPROMISSOS) expect(vocab.slice(0, 600)).toContain(`'${id}'`);
  });

  it("o jsonb cru tem teto de tamanho", () => {
    expect(sql).toContain("check (length(respostas::text) <= 65536)");
  });

  it("o caminho curto é coerente no banco, não só na tela", () => {
    // Cliente adulterado mandando interesse='acompanhar' com
    // disponibilidade='ate_1_dia_semana' ganharia 18 pontos que ninguém deu.
    expect(sql).toContain("constraint workshop_respostas_caminho");
    expect(sql).toContain("interesse = 'acompanhar'");
  });

  it("o servidor PODA as respostas de colaboração antes de pontuar o caminho curto", () => {
    // Quem preencheu tudo e depois voltou para "só acompanhar" não pode levar
    // consigo os compromissos que renegou — nem no escore, nem no jsonb cru.
    const poda = sql.slice(sql.indexOf("if v_curto then"), sql.indexOf("-- ---- 5."));
    for (const chave of [
      "eets",
      "formas",
      "aportes",
      "aportes_detalhe",
      "iniciativas",
      "compromissos",
      "disponibilidade",
      "horizonte",
      "decisao",
      "historico",
      "chance_1a5",
    ]) {
      expect(poda, `a poda esqueceu '${chave}'`).toContain(`- '${chave}'`);
    }
    // A poda vem ANTES do cálculo do escore, senão não serve para nada.
    expect(sql.indexOf("if v_curto then")).toBeLessThan(
      sql.indexOf("v_escore := public.escore_intencao_workshop"),
    );
  });

  it("a tela apaga as mesmas chaves, para a revisão não mentir antes do envio", () => {
    const trecho = formulario.slice(
      formulario.indexOf("const escolherInteresse"),
      formulario.indexOf("// ------------------------------------------------- rascunho"),
    );
    for (const chave of ["eets", "formas", "aportes", "iniciativas", "compromissos", "chance_1a5"]) {
      expect(trecho, `escolherInteresse esqueceu '${chave}'`).toContain(chave);
    }
  });

  it("o protocolo é atômico — nunca count(*) + 1", () => {
    expect(sql).toContain("on conflict (edicao_id)");
    expect(sql).toContain("do update set ultimo = public.workshop_protocolo_seq.ultimo + 1");
    expect(sqlSemProsa).not.toMatch(/count\(\*\)\s*\+\s*1/);
  });

  it("é a 008 e o seed é o 003 — a ordem de aplicação está escrita no arquivo", () => {
    expect(sql).toContain("001 → 002 → 003 → 004 → 005 → 006 → 007 → **008** → seeds/003");
  });
});

// ===========================================================================
describe("o seed da edição", () => {
  it("usa o offset de Rondônia (−04), nunca Z nem carimbo sem fuso", () => {
    const carimbos = [...seed.matchAll(/'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[^']*)'/g)].map((m) => m[1]);
    expect(carimbos.length).toBeGreaterThan(0);
    for (const c of carimbos) {
      expect(c, `carimbo sem offset: ${c}`).toMatch(/-04$/);
    }
    expect(seed).not.toMatch(/\d{2}:\d{2}:\d{2}Z/);
  });

  it("o slug do seed é o mesmo que o cliente envia", () => {
    expect(seed).toContain("'i-workshop-conexao-fitofarmas'");
    const api = readFileSync(join(raiz, "src/fitofarmas/api.ts"), "utf-8");
    expect(api).toContain('EDICAO_SLUG = "i-workshop-conexao-fitofarmas"');
  });

  it("é idempotente: rodar de novo atualiza, não cria uma segunda edição", () => {
    expect(seed).toContain("on conflict (slug) do update set");
  });
});

// ===========================================================================
describe("a validação bloqueante, passo a passo", () => {
  it("uma resposta completa passa em todos os passos", () => {
    for (const p of PASSOS) expect(erroDoPasso(p.id, CHEIA), `passo ${p.id}`).toBeNull();
    expect(pendenciasDe(CHEIA, [1, 2, 3, 4, 5])).toEqual([]);
  });

  it("o caminho curto não é cobrado pelos passos que ele não tem", () => {
    expect(pendenciasDe(CURTA, [1, 2, 5])).toEqual([]);
    // …mas seria cobrado se alguém o mandasse pelo caminho longo
    expect(pendenciasDe(CURTA, [1, 2, 3, 4, 5]).length).toBeGreaterThan(0);
  });

  it("cada campo que falta devolve o id do campo, para o foco ir ao lugar certo", () => {
    expect(erroDoPasso(1, { ...CHEIA, nome: "Ma" })?.campo).toBe("nome");
    expect(erroDoPasso(1, { ...CHEIA, email: "sem-arroba" })?.campo).toBe("email");
    expect(erroDoPasso(1, { ...CHEIA, uf: "XX" })?.campo).toBe("uf");
    expect(erroDoPasso(1, { ...CHEIA, vinculo: "" })?.campo).toBe("vinculo");
    expect(erroDoPasso(2, { ...CHEIA, interesse: "" })?.campo).toBe("interesse");
    expect(erroDoPasso(3, { ...CHEIA, eets: [] })?.campo).toBe("eets");
    expect(erroDoPasso(3, { ...CHEIA, aportes: [] })?.campo).toBe("aportes");
    expect(erroDoPasso(4, { ...CHEIA, compromissos: [] })?.campo).toBe("compromissos");
    expect(erroDoPasso(4, { ...CHEIA, chance_1a5: 0 })?.campo).toBe("chance_1a5");
    expect(erroDoPasso(5, { ...CHEIA, lgpd: false })?.campo).toBe("lgpd");
  });

  it("nenhuma mensagem é técnica, em inglês, ou só 'campo inválido'", () => {
    const problemas = [
      erroDoPasso(1, { ...CHEIA, nome: "" }),
      erroDoPasso(1, { ...CHEIA, email: "x" }),
      erroDoPasso(3, { ...CHEIA, eets: [] }),
      erroDoPasso(5, { ...CHEIA, lgpd: false }),
    ];
    for (const p of problemas) {
      expect(p).not.toBeNull();
      expect(p!.mensagem.length).toBeGreaterThan(20);
      expect(p!.mensagem.toLowerCase()).not.toContain("invalid ");
      expect(p!.mensagem.toLowerCase()).not.toContain("campo inválido");
    }
  });

  it("o teto de 3 eixos é recusado, não truncado em silêncio", () => {
    const quatro = { ...CHEIA, eets: ["eet1", "eet2", "eet3", "eet4"] } as Respostas;
    expect(erroDoPasso(3, quatro)?.campo).toBe("eets");
  });

  it("o que sai para o banco está na forma que o banco aceita", () => {
    // O defeito que isto tranca: a tela aceita o ORCID em três grafias e o
    // banco só na quarta (com hífens). Sem normalizar, quem colasse o endereço
    // de orcid.org passava por toda a validação, era recusado pelo CHECK, via
    // "recarregue e envie de novo" — e o rascunho devolvia o mesmo valor.
    const cru: Respostas = {
      ...CHEIA,
      nome: "  Maria da Silva Santos  ",
      email: "  Maria.Santos@UNIR.br ",
      uf: "ro",
      orcid: "https://orcid.org/0000-0002-1825-0097",
      lattes: "http://lattes.cnpq.br/1234567890123456",
    };
    const pronto = normalizarParaEnvio(cru);

    expect(pronto.orcid).toBe("0000-0002-1825-0097");
    expect(pronto.orcid).toMatch(/^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$/);
    // a mesma expressão que o CHECK da 008 impõe
    expect(sql).toContain("orcid ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$'");

    expect(pronto.lattes).toBe("1234567890123456");
    expect(pronto.email).toBe("maria.santos@unir.br"); // o índice único é sobre lower(email)
    expect(pronto.uf).toBe("RO"); // o CHECK exige ^[A-Z]{2}$
    expect(pronto.nome).toBe("Maria da Silva Santos");
  });

  it("a tela normaliza ANTES de enviar, e não depois", () => {
    expect(formularioSemProsa).toContain("normalizarParaEnvio(f)");
  });

  it("quem é de fora do Brasil consegue passar do passo 1", () => {
    // Sem a saída "Fora do Brasil", o passo 1 era beco sem saída para as 16
    // instituições parceiras estrangeiras: campo obrigatório, select fechado.
    expect(OPCOES_UF.length).toBe(UFS.length + 1);
    expect(OPCOES_UF.some(([id]) => id === UF_EXTERIOR)).toBe(true);
    expect(UF_EXTERIOR).toMatch(/^[A-Z]{2}$/); // passa no check da 008 sem tocar no SQL
    expect(erroDoPasso(1, { ...CHEIA, uf: UF_EXTERIOR })).toBeNull();
    expect(erroDoPasso(1, { ...CHEIA, uf: "XX" })?.campo).toBe("uf");
  });

  it("o contador do comentário e o bloqueio do envio contam a MESMA coisa", () => {
    // 600 emojis: .length daria 1200 (UTF-16) e barraria o que o contador, que
    // conta code points, mostra como "600 de 600".
    const seiscentosEmojis = "🌿".repeat(LIMITES.comentarioMax);
    expect(erroDoPasso(5, { ...CHEIA, comentario: seiscentosEmojis })).toBeNull();
    expect(erroDoPasso(5, { ...CHEIA, comentario: seiscentosEmojis + "🌿" })?.campo).toBe(
      "comentario",
    );
  });

  it("iniciativas é bloqueante como os outros grupos pontuados do passo 4", () => {
    // Sem isto, o primeiro bloco da tela passava em branco e a diferença entre
    // "não respondeu" e "respondeu que não" desaparecia — 8 pontos que
    // atravessam corte de faixa.
    expect(erroDoPasso(4, { ...CHEIA, iniciativas: [] })?.campo).toBe("iniciativas");
    expect(erroDoPasso(4, { ...CHEIA, iniciativas: ["nenhuma"] })).toBeNull();
  });

  it("todo rótulo de ROTULO_CAMPO corresponde a uma pendência que existe", () => {
    // Chave órfã no mapa é sinal de campo que ninguém valida: foi assim que a
    // falta de validação de `iniciativas` apareceu.
    const emitidos = new Set<string>();
    const quebrar: Array<[keyof Respostas, Respostas[keyof Respostas]]> = [
      ["nome", ""], ["email", ""], ["telefone", "1"], ["instituicao", ""], ["uf", ""],
      ["vinculo", ""], ["lattes", "xyz"], ["orcid", "123"], ["interesse", ""], ["sede", ""],
      ["eets", []], ["formas", []], ["aportes", []], ["iniciativas", []],
      ["disponibilidade", ""], ["horizonte", ""], ["decisao", ""], ["historico", ""],
      ["compromissos", []], ["chance_1a5", 0], ["comentario", "x".repeat(700)],
      ["canal", ""], ["lgpd", false],
    ];
    for (const [chave, valor] of quebrar) {
      for (const p of PASSOS) {
        const achado = erroDoPasso(p.id, { ...CHEIA, [chave]: valor } as Respostas);
        if (achado) emitidos.add(achado.campo);
      }
    }
    for (const chave of Object.keys(ROTULO_CAMPO)) {
      expect(emitidos, `ROTULO_CAMPO tem '${chave}', mas nenhum passo emite essa pendência`).toContain(
        chave,
      );
    }
  });

  it("aceita as três formas que o CNPq publica um currículo Lattes", () => {
    expect(validarLattesOuUrl("http://lattes.cnpq.br/1234567890123456").valor).toBe("1234567890123456");
    expect(validarLattesOuUrl("1234567890123456").valor).toBe("1234567890123456");
    expect(
      validarLattesOuUrl("https://buscatextual.cnpq.br/buscatextual/visualizacv.do?id=K1234567").ok,
    ).toBe(true);
    expect(validarLattesOuUrl("").ok).toBe(true); // é opcional
    expect(validarLattesOuUrl("meu currículo").ok).toBe(false);
  });

  it("o telefone aceita a formatação brasileira real e recusa número curto", () => {
    expect(validarTelefone("(69) 9 8152-6200").ok).toBe(true);
    expect(validarTelefone("+55 69 98152 6200").ok).toBe(true);
    expect(validarTelefone("").ok).toBe(true); // é opcional
    expect(validarTelefone("998").ok).toBe(false);
  });

  it("as 27 UFs estão lá — quem é de SP não pode ser empurrado para 'outro'", () => {
    expect(UFS).toHaveLength(27);
    expect(UFS).toContain("RO");
    expect(UFS).toContain("SP");
  });
});

// ===========================================================================
describe("o que o formulário nunca faz", () => {
  it("não pergunta satisfação, aprendizado nem aplicação do conteúdo", () => {
    // É respondido ANTES do evento: perguntar isso produziria dado falso.
    const proibidas = /satisfa|aprend|o que você achou|avalie o evento|nota para o evento/i;
    expect(formularioSemProsa).not.toMatch(proibidas);
    const perguntas = readFileSync(join(raiz, "src/fitofarmas/perguntas.ts"), "utf-8");
    const perguntasSemProsa = perguntas.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(perguntasSemProsa).not.toMatch(proibidas);
  });

  it("não mostra o escore nem a faixa a quem responde", () => {
    expect(formulario).not.toContain("escoreDe");
    expect(formulario).not.toContain("faixaDe");
    expect(formulario).not.toContain("escore_intencao");
  });

  it("não pede login, não cria conta e não importa o módulo de autenticação", () => {
    expect(formulario).not.toContain("platform/auth");
    expect(formulario).not.toContain("AuthCard");
    expect(formulario).not.toContain("signIn");
  });

  it("não guarda o consentimento no rascunho local", () => {
    const rascunho = readFileSync(join(raiz, "src/fitofarmas/rascunho.ts"), "utf-8");
    expect(rascunho).toContain("lgpd: false");
    expect(rascunho).toContain("const { lgpd: _ignorado, ...semConsentimento } = dados");
  });

  it("nunca lança para desfecho previsto — tudo volta como união discriminada", () => {
    const api = readFileSync(join(raiz, "src/fitofarmas/api.ts"), "utf-8");
    expect(api).not.toMatch(/\bthrow\b/);
  });

  it("são cinco passos, e o caminho curto tira dois", () => {
    expect(TOTAL_PASSOS).toBe(5);
    expect(PASSOS.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
