/**
 * ============================================================================
 *  A BUSCA DE IDENTIFICAÇÃO DO PESQUISADOR (Tela 1 do #/relatorio-anual,
 *  o Relatório Anual de Atividades; #/meu-ano é alias legado)
 * ============================================================================
 *  Esta suíte existe por causa de um bug que este projeto JÁ COMETEU: a busca
 *  do #/mapa casa por SUBSTRING (`norm(nome).includes(q)`). Com 27 estados
 *  ninguém percebe. Com 209 nomes, "RO" passaria a casar "PedRO", "CaROlina" e
 *  "AlessandRO" — e quem digitou a sigla do próprio estado receberia meia rede
 *  antes de encontrar a si mesmo. O primeiro bloco daqui trava exatamente isso,
 *  contra o arquivo REAL, com as pessoas reais que produziriam o falso positivo.
 *
 *  O que mais quebra caro e em silêncio, e por isso está testado:
 *
 *  1. ACENTO. A proposta grafa "Estevao", "Mariuba" e "Damiao" sem acento; a
 *     lista revisada de orientadores grafa com. Se a busca não for cega a
 *     acento, essas três pessoas simplesmente não se acham — e não têm como
 *     saber por quê.
 *  2. O CORTE E A CONTAGEM. A tela anuncia "N pessoas encontradas · mostrando
 *     as 8 primeiras" numa região aria-live. Se `total` passar a significar
 *     "quantas couberam", o anúncio mente para quem não vê a lista.
 *  3. O COORDENADOR. Andreimar Martins Soares não está na seção EQUIPE da
 *     proposta (não existe categoria "Coordenador" entre as 13 do PICC). É o
 *     dono do sistema: se ele não se achar, a primeira pessoa a testar o
 *     formulário conclui que ele não funciona.
 *  4. A REIVINDICAÇÃO. A RPC vive na migração 006, escrita em paralelo. A
 *     leitura da resposta é tolerante de propósito — mas não pode inventar
 *     sucesso, e uma RPC ausente NÃO pode barrar a entrada de ninguém.
 *
 *  NENHUM TESTE VAI À REDE e nenhum monta componente: tudo aqui é função pura.
 * ============================================================================
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  LIMITE_PADRAO,
  MIN_CONSULTA,
  buscar,
  construirIndice,
  decodificarEntidades,
  emailPlausivel,
  interpretarFalhaDeReivindicacao,
  interpretarReivindicacao,
  linhaDeContexto,
  mascararEmail,
  montarCatalogo,
  normalizar,
  pessoaPorId,
  realcar,
  textoDeUmaLinha,
  tokenizar,
  type Catalogo,
  type PessoaDoCatalogo,
} from "../src/relato/BuscaPesquisador";

const RAIZ = join(__dirname, "..");

/** O arquivo real, lido do disco — não uma cópia que envelhece no teste. */
const EQUIPE = JSON.parse(
  readFileSync(join(RAIZ, "src", "content", "relato", "equipe.json"), "utf-8"),
) as { pessoas: Array<Record<string, unknown>> };

const catalogo: Catalogo = montarCatalogo(EQUIPE as never);
const indice = catalogo.indice;

/** Todos os nomes que a busca devolve, sem corte. */
function nomes(consulta: string, limite = 500): string[] {
  return buscar(indice, consulta, { limite }).itens.map((i) => i.pessoa.nome);
}

// ================================================ 1. O "RO" QUE NÃO É PEDRO =

describe("casamento por prefixo de palavra (a lição que o mapa já pagou)", () => {
  it('"ro" NÃO devolve quem só tem "ro" no meio de uma palavra', () => {
    const achados = nomes("ro");
    // Pessoas reais do arquivo: "ro" aparece dentro do nome, nunca no começo de
    // uma palavra, e a instituição/UF também não começa com "ro".
    expect(achados).not.toContain("Paulo Afonso Granjeiro");
    expect(achados).not.toContain("Alessandro Donaire de Santana");
    expect(achados).not.toContain("Elania Barros da Silva");
    expect(achados).not.toContain("Haroldo Fraga de Campos Velho");
  });

  it('"ro" devolve a UF exata e as palavras que COMEÇAM com "ro"', () => {
    const achados = nomes("ro");
    expect(achados.length).toBeGreaterThan(0);
    const temRondonia = catalogo.pessoas.some((p) => p.uf === "RO");
    expect(temRondonia).toBe(true);
    for (const nome of achados) {
      const p = catalogo.pessoas.find((x) => x.nome === nome) as PessoaDoCatalogo;
      const campos = [p.nome, p.instituicaoNome, p.instituicaoSigla, p.instituicaoDepartamento ?? "", p.areas.join(" "), p.categoriaPicc ?? ""];
      const algumComeca = campos.some((c) => tokenizar(c).some((t) => t.startsWith("ro")));
      // Ou casou uma palavra que começa com "ro", ou é da UF RO. Nunca "meio".
      expect(algumComeca || p.uf === "RO").toBe(true);
    }
  });

  it("uma palavra inteira ainda casa a si mesma (não quebramos o óbvio)", () => {
    expect(nomes("rondonia").length).toBeGreaterThan(0);
    expect(nomes("roberto").some((n) => n.startsWith("Roberto"))).toBe(true);
  });

  it("a UF casa só por igualdade: uma letra não devolve cinco estados", () => {
    // "r" é curta demais para buscar; e mesmo assim, se fosse aceita, não pode
    // varrer RO+RR+RJ+RN+RS de uma vez.
    expect(buscar(indice, "r").total).toBe(0);
    const doAm = buscar(indice, "am", { limite: 500 }).itens.map((i) => i.pessoa);
    expect(doAm.length).toBeGreaterThan(0);
    for (const p of doAm) {
      const casouPorPalavra = [
        p.nome,
        p.instituicaoNome,
        p.instituicaoSigla,
        p.instituicaoDepartamento ?? "",
        p.areas.join(" "),
        p.categoriaPicc ?? "",
      ].some((c) => tokenizar(c).some((t) => t.startsWith("am")));
      expect(p.uf === "AM" || casouPorPalavra).toBe(true);
    }
  });
});

// ============================================================== 2. A SIGLA ==

describe("busca por sigla de instituição", () => {
  it('"unir" devolve só gente da UNIR', () => {
    const achados = buscar(indice, "unir", { limite: 500 }).itens.map((i) => i.pessoa);
    expect(achados.length).toBeGreaterThan(20);
    for (const p of achados) expect(tokenizar(p.instituicaoSigla)).toContain("unir");
  });

  it("sigla com barra é quebrada em partes: FIOCRUZ/CE acha por “fiocruz”", () => {
    const comBarra = catalogo.pessoas.find((p) => p.instituicaoSigla.includes("/"));
    expect(comBarra).toBeTruthy();
    const achados = nomes("fiocruz");
    const fiocruzianos = catalogo.pessoas.filter((p) => tokenizar(p.instituicaoSigla).includes("fiocruz"));
    expect(fiocruzianos.length).toBeGreaterThan(0);
    for (const p of fiocruzianos) expect(achados).toContain(p.nome);
  });

  it("a sigla inteira ganha do prefixo: quem digita UFC quer a UFC", () => {
    const r = buscar(indice, "ufc", { limite: 500 });
    expect(r.itens.length).toBeGreaterThan(0);
    expect(tokenizar(r.itens[0]!.pessoa.instituicaoSigla)).toContain("ufc");
  });

  it("nome + sigla é E, não OU: “alice ufc” devolve uma pessoa só", () => {
    const r = buscar(indice, "alice ufc", { limite: 500 });
    expect(r.total).toBe(1);
    expect(r.itens[0]!.pessoa.nome).toBe("Alice Maria Costa Martins");
  });
});

// ============================================================= 3. O ACENTO ==

describe("insensibilidade a acento (as três grafias divergentes do projeto)", () => {
  it("acha com e sem acento, nos dois sentidos", () => {
    expect(nomes("estevão")).toContain("Estevão Rafael Fernandes");
    expect(nomes("estevao")).toContain("Estevão Rafael Fernandes");
    expect(nomes("gomez").some((n) => n.includes("Gómez"))).toBe(true);
    expect(nomes("gómez").some((n) => n.includes("Gómez"))).toBe(true);
  });

  it("normalizar tira acento, cedilha e apóstrofo curvo", () => {
    expect(normalizar("Ação Coração")).toBe("acao coracao");
    expect(normalizar("Sant’Anna")).toBe("sant'anna");
    expect(normalizar("  DOIS   espaços ")).toBe("dois espacos");
  });

  it("o apóstrofo separa palavras na busca (Sant’Anna acha por “anna”)", () => {
    expect(tokenizar("Felipe Sant’Anna Cavalcante")).toEqual(["felipe", "sant", "anna", "cavalcante"]);
  });
});

// ====================================================== 4. ORDEM E O CORTE ==

describe("ranqueamento, corte e contagem", () => {
  it("quem começa com a consulta vem antes de quem só a contém depois", () => {
    const r = buscar(indice, "ana", { limite: 500 });
    expect(r.itens.length).toBeGreaterThan(3);
    expect(normalizar(r.itens[0]!.pessoa.nome).startsWith("ana")).toBe(true);
  });

  it("o nome ganha da instituição quando o termo casa nos dois", () => {
    // "maria" é nome de gente, não de instituição: nenhuma pontuação por
    // instituição pode subir acima de um primeiro nome exato.
    const r = buscar(indice, "maria", { limite: 5 });
    expect(r.itens.length).toBeGreaterThan(0);
    expect(tokenizar(r.itens[0]!.pessoa.nome)).toContain("maria");
  });

  it("total conta TUDO; itens respeita o limite", () => {
    const r = buscar(indice, "silva", { limite: 3 });
    expect(r.itens.length).toBeLessThanOrEqual(3);
    expect(r.total).toBeGreaterThanOrEqual(r.itens.length);
    const tudo = buscar(indice, "silva", { limite: 500 });
    expect(r.total).toBe(tudo.total);
  });

  it("o limite padrão é 8 e é o que a tela mostra", () => {
    expect(LIMITE_PADRAO).toBe(8);
    expect(buscar(indice, "a").itens.length).toBeLessThanOrEqual(LIMITE_PADRAO);
  });

  it(`abaixo de ${MIN_CONSULTA} letras não busca — e devolve zero, não a rede inteira`, () => {
    expect(buscar(indice, "").total).toBe(0);
    expect(buscar(indice, " ").total).toBe(0);
    expect(buscar(indice, "a").total).toBe(0);
  });

  it("é determinística: mesma consulta, mesma ordem", () => {
    const a = nomes("silva", 20);
    const b = nomes("silva", 20);
    expect(a).toEqual(b);
  });

  it("busca por termo que não existe devolve vazio, não erro", () => {
    const r = buscar(indice, "zzzzzz qqqqq");
    expect(r.total).toBe(0);
    expect(r.itens).toEqual([]);
  });
});

// ========================================================= 5. O CATÁLOGO ====

describe("o catálogo que a tela carrega", () => {
  it("traz as 209 da proposta mais o coordenador, que não está na EQUIPE", () => {
    expect(EQUIPE.pessoas.length).toBe(209);
    expect(catalogo.pessoas.length).toBe(210);
    const coordenador = catalogo.pessoas.find((p) => p.id === "andreimar-martins-soares");
    expect(coordenador).toBeTruthy();
    expect(coordenador!.origem).toBe("identificacao");
    expect(coordenador!.notaDeOrigem).toBeTruthy();
    // Ele NÃO pode estar na EQUIPE — se um dia entrar, esta linha avisa que a
    // exceção virou duplicata.
    expect(EQUIPE.pessoas.some((p) => p.nome === "Andreimar Martins Soares")).toBe(false);
  });

  it("o coordenador se acha pelo próprio nome", () => {
    expect(nomes("andreimar")).toContain("Andreimar Martins Soares");
    expect(nomes("Andreimar Martins Soares")).toContain("Andreimar Martins Soares");
  });

  it("ids são únicos (é por eles que a reivindicação identifica a linha)", () => {
    const ids = catalogo.pessoas.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nenhum dado de contato viaja no pacote", () => {
    const serializado = JSON.stringify(catalogo.pessoas);
    expect(serializado).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(serializado).not.toMatch(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/); // CPF
  });

  it("pessoaPorId acha e devolve null sem estourar", () => {
    expect(pessoaPorId(catalogo, "alice-maria-costa-martins")?.nome).toBe("Alice Maria Costa Martins");
    expect(pessoaPorId(catalogo, "nao-existe")).toBeNull();
    expect(pessoaPorId(null, "alice-maria-costa-martins")).toBeNull();
    expect(pessoaPorId(catalogo, null)).toBeNull();
  });

  it("a linha de contexto desambigua homônimos por instituição e UF", () => {
    const alice = pessoaPorId(catalogo, "alice-maria-costa-martins")!;
    expect(linhaDeContexto(alice)).toBe("Universidade Federal do Ceará (UFC) · CE");
    const estrangeiro = catalogo.pessoas.find((p) => p.uf === null && p.pais !== "Brasil")!;
    // Sem UF (estrangeiro), o país entra no lugar — a linha nunca fica pela metade.
    expect(linhaDeContexto(estrangeiro).endsWith(estrangeiro.pais)).toBe(true);
  });
});

// ================================================= 6. DEFEITOS DA ORIGEM ====

describe("os defeitos que a proposta trouxe e a tela não pode repassar", () => {
  it("entidade HTML numérica crua é decodificada na exibição", () => {
    expect(decodificarEntidades("F&#297;sica, Qu&#297;mica")).toBe("Fĩsica, Quĩmica");
    // Sem entidade, nada muda; e o que não for entidade fica como está.
    expect(decodificarEntidades("Física")).toBe("Física");
    expect(decodificarEntidades("100 & 200")).toBe("100 & 200");
  });

  it("a pessoa com a entidade crua se acha pelo nome, apesar do dado sujo", () => {
    expect(nomes("zazeri").length).toBeGreaterThan(0);
  });

  it("a quebra de linha digitada na origem vira espaço (o PDF não a exibe)", () => {
    expect(textoDeUmaLinha("1) uma coisa\n2) outra")).toBe("1) uma coisa 2) outra");
    const comQuebra = catalogo.pessoas.filter((p) => p.responsabilidade.includes("\n"));
    expect(comQuebra.length).toBe(3);
    for (const p of comQuebra) expect(textoDeUmaLinha(p.responsabilidade)).not.toContain("\n");
  });
});

// ============================================================= 7. O REALCE ==

describe("realce dos trechos que casaram", () => {
  it("realça o começo da palavra e devolve o texto inteiro, na ordem", () => {
    const segs = realcar("Alice Maria Costa Martins", ["ali"]);
    expect(segs.map((s) => s.texto).join("")).toBe("Alice Maria Costa Martins");
    expect(segs.filter((s) => s.realce).map((s) => s.texto)).toEqual(["Ali"]);
  });

  it("realça respeitando o acento do texto original", () => {
    const segs = realcar("Aarón Gómez Argüello", ["gomez"]);
    expect(segs.map((s) => s.texto).join("")).toBe("Aarón Gómez Argüello");
    expect(segs.filter((s) => s.realce).map((s) => s.texto)).toEqual(["Gómez"]);
  });

  it("NÃO realça no meio da palavra (mesma regra da busca)", () => {
    const segs = realcar("Pedro Almeida", ["ro"]);
    expect(segs.filter((s) => s.realce)).toEqual([]);
    expect(segs).toEqual([{ texto: "Pedro Almeida", realce: false }]);
  });

  it("dois termos, duas marcas, sem faixas sobrepostas", () => {
    const segs = realcar("Universidade Federal de Rondônia", ["uni", "ron"]);
    expect(segs.filter((s) => s.realce).map((s) => s.texto)).toEqual(["Uni", "Ron"]);
    expect(segs.map((s) => s.texto).join("")).toBe("Universidade Federal de Rondônia");
  });

  it("texto vazio e lista de termos vazia não estouram", () => {
    expect(realcar("", ["a"])).toEqual([]);
    expect(realcar("Fulano", [])).toEqual([{ texto: "Fulano", realce: false }]);
  });
});

// ======================================================= 8. O E-MAIL (puro) =

describe("e-mail informado pela própria pessoa", () => {
  it("mascara sem nunca revelar o endereço alheio", () => {
    expect(mascararEmail("maria.silva@unir.br")).toBe("m•••@unir.br");
    expect(mascararEmail("a@b.co")).toBe("a•••@b.co");
    expect(mascararEmail("sem-arroba")).toBe("•••");
    expect(mascararEmail("")).toBe("•••");
  });

  it("valida o formato antes de gastar um round-trip", () => {
    expect(emailPlausivel("fulano@unir.br")).toBe(true);
    expect(emailPlausivel("  FULANO@UNIR.BR ")).toBe(true);
    expect(emailPlausivel("fulano@unir")).toBe(false);
    expect(emailPlausivel("fulano")).toBe(false);
    expect(emailPlausivel("")).toBe(false);
  });
});

// ================================================== 9. A REIVINDICAÇÃO ======

describe("leitura da resposta da RPC de reivindicação (migração 006)", () => {
  it("entende o objeto, a linha dentro de array e o true seco", () => {
    expect(interpretarReivindicacao({ status: "vinculado" })).toEqual({ status: "vinculado" });
    expect(interpretarReivindicacao([{ status: "vinculado" }])).toEqual({ status: "vinculado" });
    expect(interpretarReivindicacao(true)).toEqual({ status: "vinculado" });
  });

  it("no conflito, devolve o e-mail já mascarado — e mascara se vier inteiro", () => {
    expect(interpretarReivindicacao({ status: "ja_vinculado", email_mascarado: "m•••@unir.br" })).toEqual({
      status: "ja_vinculado",
      emailMascarado: "m•••@unir.br",
    });
    expect(interpretarReivindicacao({ status: "ja_vinculado", email: "maria.silva@unir.br" })).toEqual({
      status: "ja_vinculado",
      emailMascarado: "m•••@unir.br",
    });
  });

  it("resposta que não se reconhece NÃO vira sucesso", () => {
    expect(interpretarReivindicacao(null).status).toBe("indisponivel");
    expect(interpretarReivindicacao({}).status).toBe("indisponivel");
    expect(interpretarReivindicacao({ status: "coisa-nova" }).status).toBe("indisponivel");
  });

  it("fala a língua REAL da 006: campo `estado`, com os sete valores dela", () => {
    /* O contrato foi assumido antes de a migração existir, e ela fechou
       diferente: campo `estado` em vez de `status`, e estados mais finos.
       Estes casos são cópias literais dos jsonb_build_object da 006 — se a RPC
       mudar, é AQUI que o desencontro aparece primeiro. */
    // sucesso de verdade
    expect(
      interpretarReivindicacao({ ok: true, estado: "reivindicado", membro_id: "x", nome: "Fulana", email: "f@x.br" }),
    ).toEqual({ status: "vinculado" });
    // segunda tentativa da MESMA pessoa: sucesso, não conflito
    expect(interpretarReivindicacao({ ok: true, estado: "ja_seu", email: "f@x.br" })).toEqual({ status: "vinculado" });
    // conflito real, com máscara vinda do servidor
    expect(
      interpretarReivindicacao({ ok: false, estado: "ja_vinculado", email_mascarado: "m•••@unir.br" }),
    ).toEqual({ status: "ja_vinculado", emailMascarado: "m•••@unir.br" });
    // ciclo fechado, no vocabulário da 006
    expect(interpretarReivindicacao({ ok: false, estado: "ciclo_indisponivel" }).status).toBe("ciclo_fechado");
    expect(interpretarReivindicacao({ ok: false, estado: "nao_encontrado" }).status).toBe("nao_encontrado");
    // recusas COM explicação: a mensagem do servidor viaja até a tela
    const invalido = interpretarReivindicacao({
      ok: false,
      estado: "email_invalido",
      mensagem: "Confira o endereço: ele não parece um e-mail válido.",
    });
    expect(invalido).toEqual({ status: "recusado", mensagem: "Confira o endereço: ele não parece um e-mail válido." });
    const emUso = interpretarReivindicacao({ ok: false, estado: "email_em_uso", mensagem: "Este e-mail já está em outro cadastro deste ciclo. Use outro endereço ou fale com a coordenação." });
    expect(emUso.status).toBe("recusado");
  });

  it("RPC ausente é 'indisponivel' — e indisponível nunca barra a entrada", () => {
    const r = interpretarFalhaDeReivindicacao({
      code: "PGRST202",
      message: "Could not find the function public.reivindicar_cadastro(p_catalogo_id, p_email) in the schema cache",
    });
    expect(r.status).toBe("indisponivel");
    expect(r).toHaveProperty("motivo", "rpc-ausente");
  });

  it("a exceção do banco em português é reconhecida pelo que ela diz", () => {
    expect(interpretarFalhaDeReivindicacao({ message: "Este cadastro já foi vinculado a outro e-mail." }).status).toBe(
      "ja_vinculado",
    );
    expect(interpretarFalhaDeReivindicacao({ message: "Nenhum ciclo aberto." }).status).toBe("ciclo_fechado");
  });
});
