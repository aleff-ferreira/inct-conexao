/**
 * Validação, deduplicação e metadados do relato anual.
 *
 * Três coisas são testadas aqui porque quebram CARO e em silêncio:
 *
 * 1. O checksum do ORCID e do ISBN — errar aceita identificador inválido, e
 *    identificador inválido só aparece em 2027, quando alguém for casar
 *    coautoria e não casar nada.
 * 2. A EQUIVALÊNCIA CLIENTE-BANCO da chave de âncora. Se o cliente normalizar
 *    diferente do índice `producoes_ancora_unica`, ele diz "trabalho novo", a
 *    pessoa preenche tudo, e o INSERT morre no UNIQUE. Aqui a chave é conferida
 *    contra uma tabela de casos calculados à mão pela semântica do Postgres E
 *    contra o texto literal da migração 005 — se alguém mexer no SQL sem mexer
 *    no TypeScript, esta suíte quebra antes do deploy.
 * 3. As três situações de data (§3.3 e decisão 3 do dono): futura recusada,
 *    anterior vira linha de base, posterior fica guardada para o próximo
 *    relatório. Rejeitar o item posterior criaria incentivo a adulterar a data,
 *    que é exatamente o dado que o CNPq vai auditar.
 *
 * NENHUM TESTE VAI À REDE. `fetch` é sempre dublê.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MENSAGENS,
  PERIODO_CICLO_1,
  avaliarData,
  dataBr,
  dataDoMes,
  dataValida,
  digitoVerificadorOrcid,
  hojeIso,
  isbn10Ok,
  isbn13Ok,
  mascararOrcid,
  normalizarDoi,
  normalizarIsbn,
  normalizarRor,
  orcidChecksumOk,
  pendenciasDe,
  situacaoDoBanco,
  validarArquivo,
  validarCessaoImagem,
  validarDoi,
  validarIsbn,
  validarLattes,
  validarOrcid,
  validarResultadoPrincipal,
  validarRor,
  validarUf,
  validarVeracidade,
} from "../src/relato/validation";

import {
  SQL_ANCORA_ISBN,
  SQL_ANCORA_OUTROS,
  chaveAncora,
  detectarTipoAncora,
  lerChecagemAncora,
  mensagemDedupe,
  mesmaAncora,
  separarColagem,
  valorParaGravar,
} from "../src/relato/dedupe";

import {
  CADEIA_DOI,
  CONCORRENCIA,
  MAILTO_CROSSREF,
  MSG_DEGRADA_MANUAL,
  anoCruzaJanela,
  buscarOrcidPorNome,
  buscarRor,
  executarComConcorrencia,
  limparCacheMetadados,
  orcidDaApi,
  resolverDoi,
  resolverIsbn,
  resolverLote,
  separarPorPeriodo,
  tipoDoCrossref,
  trabalhosDoOrcid,
} from "../src/relato/metadados";

// =========================================================== ORCID (MOD 11-2)

describe("ORCID — checksum ISO 7064 MOD 11-2, validado localmente", () => {
  /* Os quatro primeiros são ORCIDs REAIS colhidos na apuração das APIs
     (src/content/relato/apis-metadados.json); o quinto é o exemplo canônico do
     próprio ORCID; os dois últimos terminam em X, que é o caso que a
     implementação ingênua erra. */
  const validos = [
    "0000-0003-1154-6503",
    "0000-0002-0848-1940",
    "0000-0002-1552-2288",
    "0000-0002-9243-9509",
    "0000-0002-1825-0097",
    "0000-0002-1694-233X",
    "0000-0002-9079-593X",
  ];

  it("aceita ORCID real de pesquisador da rede e o exemplo canônico", () => {
    for (const o of validos) expect(orcidChecksumOk(o), o).toBe(true);
  });

  it("o dígito X é 10, não a letra: 233X só passa porque o resto dá 10", () => {
    expect(digitoVerificadorOrcid("000000021694233")).toBe("X");
    expect(digitoVerificadorOrcid("000000021825009")).toBe("7");
  });

  it("recusa quando só o último dígito muda — que é o erro de digitação real", () => {
    expect(orcidChecksumOk("0000-0002-1825-0098")).toBe(false);
    expect(orcidChecksumOk("0000-0003-1154-6502")).toBe(false);
    expect(orcidChecksumOk("0000-0002-1694-2330")).toBe(false);
  });

  it("recusa quando dois dígitos internos trocam de lugar", () => {
    expect(orcidChecksumOk("0000-0002-8125-0097")).toBe(false);
  });

  it("recusa tamanho errado, letra fora da última posição e vazio", () => {
    expect(orcidChecksumOk("0000-0002-1825-009")).toBe(false);
    expect(orcidChecksumOk("0000-000X-1825-0097")).toBe(false);
    expect(orcidChecksumOk("")).toBe(false);
  });

  it("um dígito A MAIS não é truncado até virar o ORCID de outra pessoa", () => {
    /* "0000-0002-1825-00977" truncado em 16 vira 0000-0002-1825-0097, que passa
       no checksum e é de alguém. A validação não corta; só a máscara corta. */
    expect(orcidChecksumOk("0000-0002-1825-00977")).toBe(false);
    const v = validarOrcid("0000-0002-1825-00977");
    expect(v.ok).toBe(false);
    expect(v.mensagem).toBe(MENSAGENS.orcidFormato);
    expect(v.valor).toBe("0000-0002-1825-00977"); // devolve inteiro o que foi digitado
  });

  it("aceita colado da URL do orcid.org e devolve a forma que o banco exige", () => {
    const v = validarOrcid("https://orcid.org/0000-0002-1825-0097");
    expect(v.ok).toBe(true);
    expect(v.valor).toBe("0000-0002-1825-0097");
    expect(/^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$/.test(v.valor)).toBe(true);
  });

  it("aceita sem hífen e minúsculo, e devolve mascarado e maiúsculo", () => {
    expect(validarOrcid("000000021694233x").valor).toBe("0000-0002-1694-233X");
  });

  it("ORCID é opcional: vazio é válido e não gera mensagem", () => {
    expect(validarOrcid("   ")).toEqual({ ok: true, valor: "", mensagem: "" });
  });

  it("a mensagem do checksum é a da especificação, literal", () => {
    const v = validarOrcid("0000-0002-1825-0098");
    expect(v.ok).toBe(false);
    expect(v.mensagem).toBe("Esse ORCID não confere: o último dígito não bate. Confira em orcid.org.");
    expect(v.mensagem).toBe(MENSAGENS.orcidChecksum);
  });

  it("tamanho errado tem mensagem de FORMATO, não de checksum", () => {
    expect(validarOrcid("0000-0002-1825").mensagem).toBe(MENSAGENS.orcidFormato);
  });

  it("a máscara é progressiva, para servir ao onChange", () => {
    expect(mascararOrcid("0000")).toBe("0000");
    expect(mascararOrcid("000000021")).toBe("0000-0002-1");
    expect(mascararOrcid("0000000218250097999")).toBe("0000-0002-1825-0097");
  });
});

// ==================================================================== Lattes

describe("ID Lattes — 16 dígitos, sem checksum público", () => {
  it("aceita 16 dígitos e devolve só os números", () => {
    expect(validarLattes("1305959204330545").valor).toBe("1305959204330545");
    expect(validarLattes("1305.9592.0433.0545").valor).toBe("1305959204330545");
  });
  it("recusa 15 e 17 com a mensagem da especificação", () => {
    expect(validarLattes("130595920433054").mensagem).toBe("O ID Lattes tem 16 números.");
    expect(validarLattes("13059592043305455").mensagem).toBe(MENSAGENS.lattes);
  });
  it("é opcional", () => {
    expect(validarLattes("").ok).toBe(true);
  });
});

// ======================================================================= DOI

describe("DOI — normalização com a sujeira real do copiar-e-colar", () => {
  const alvo = "10.1590/1678-9199-jvatitd-2023-0039";

  it("tira o resolvedor em todas as formas que aparecem em PDF e em e-mail", () => {
    expect(normalizarDoi("https://doi.org/10.1590/1678-9199-JVATITD-2023-0039")).toBe(alvo);
    expect(normalizarDoi("http://dx.doi.org/10.1590/1678-9199-jvatitd-2023-0039")).toBe(alvo);
    expect(normalizarDoi("doi.org/10.1590/1678-9199-jvatitd-2023-0039")).toBe(alvo);
    expect(normalizarDoi("doi:10.1590/1678-9199-JVATITD-2023-0039")).toBe(alvo);
    expect(normalizarDoi("DOI: 10.1590/1678-9199-jvatitd-2023-0039")).toBe(alvo);
  });

  it("come o espaço que o PDF cola no meio do DOI quebrado em duas linhas", () => {
    expect(normalizarDoi("10.1590/1678-9199-jvatitd-\n2023-0039")).toBe(alvo);
    expect(normalizarDoi("10.1590/1678-9199-jvatitd- 2023-0039")).toBe(alvo);
    /* NBSP e zero-width vêm juntos do PDF e são invisíveis na tela — o campo
       ficaria "certo" e o DOI não resolveria nunca. */
    expect(normalizarDoi("10.1590/1678-9199-jvatitd-\u00a02023-0039")).toBe(alvo);
    expect(normalizarDoi("\ufeff10.1590/1678-9199-jvatitd-\u200b2023-0039")).toBe(alvo);
  });

  it("preserva as duas barras do DOI SciELO (que resolve assim, medido)", () => {
    expect(normalizarDoi(" 10.1590/1807-1929/agriambi.v26n12p947-952 ")).toBe("10.1590/1807-1929/agriambi.v26n12p947-952");
  });

  it("aceita DOI de dataset (DataCite) — a cadeia existe por causa dele", () => {
    expect(validarDoi("https://doi.org/10.5281/zenodo.7712765").valor).toBe("10.5281/zenodo.7712765");
    expect(validarDoi("10.6084/m9.figshare.21591173").ok).toBe(true);
  });

  it("recusa o que não tem forma de DOI, com a mensagem da especificação", () => {
    const v = validarDoi("Toxicon 2025, v. 240");
    expect(v.ok).toBe(false);
    expect(v.mensagem).toBe("Não encontramos esse DOI. Confira, ou registre à mão.");
    expect(validarDoi("10.15/x").ok).toBe(false); // prefixo curto demais
    expect(validarDoi("10.1590/").ok).toBe(false); // sem sufixo
    expect(validarDoi("").ok).toBe(false);
  });
});

// ====================================================================== ISBN

describe("ISBN — dígito verificador de 10 e de 13", () => {
  it("ISBN-13 válido (livro brasileiro real da apuração e um controle)", () => {
    expect(isbn13Ok("9788575412244")).toBe(true); // Ciência, nação e região — Editora FIOCRUZ
    expect(isbn13Ok("9780262033848")).toBe(true);
  });
  it("ISBN-10 válido, inclusive terminado em X", () => {
    expect(isbn10Ok("0262033844")).toBe(true);
    expect(isbn10Ok("0306406152")).toBe(true);
    expect(isbn10Ok("080442957X")).toBe(true);
  });
  it("recusa dígito verificador errado nos dois tamanhos", () => {
    expect(isbn13Ok("9788575412245")).toBe(false);
    expect(isbn10Ok("0262033845")).toBe(false);
    expect(isbn10Ok("014143960X")).toBe(false);
  });
  it("recusa transposição de dois dígitos (o erro que o peso 1-3 pega)", () => {
    expect(isbn13Ok("9788575412424")).toBe(false);
  });
  it("aceita hífens, espaços e o rótulo, e normaliza para dígitos", () => {
    expect(validarIsbn("978-85-754-1224-4").valor).toBe("9788575412244");
    expect(validarIsbn(" 0-8044-2957-x ").valor).toBe("080442957X");
  });
  it("tamanho errado tem mensagem própria; dígito errado tem a outra", () => {
    expect(validarIsbn("12345").mensagem).toBe(MENSAGENS.isbnTamanho);
    expect(validarIsbn("9788575412245").mensagem).toBe(MENSAGENS.isbnDigito);
  });
  it("é opcional", () => {
    expect(validarIsbn("").ok).toBe(true);
  });
});

// ======================================================================= ROR

describe("ROR — forma exata, nunca texto livre", () => {
  it("aceita o id nu e o colado da URL, e guarda nu (como o banco)", () => {
    expect(validarRor("02842cb31").valor).toBe("02842cb31"); // UNIR
    expect(normalizarRor("https://ror.org/01xe86309")).toBe("01xe86309"); // INPA
    expect(validarRor("https://ror.org/04jhswv08").valor).toBe("04jhswv08"); // Fiocruz
  });
  it("recusa nome de instituição digitado — é o que a regra existe para impedir", () => {
    const v = validarRor("Universidade Federal de Rondônia");
    expect(v.ok).toBe(false);
    expect(v.mensagem).toBe(MENSAGENS.ror);
  });
  it("recusa tamanho errado e id que não começa em zero", () => {
    expect(validarRor("2842cb31").ok).toBe(false);
    expect(validarRor("02842cb3").ok).toBe(false);
    expect(validarRor("12842cb31").ok).toBe(false);
  });
  it("bate com a constraint do 005: ^0[a-z0-9]{8}$", () => {
    expect(/^0[a-z0-9]{8}$/.test(validarRor("02842CB31").valor)).toBe(true);
  });
});

describe("UF", () => {
  it("duas letras maiúsculas, como a constraint do banco", () => {
    expect(validarUf("ro").valor).toBe("RO");
    expect(validarUf("Rondônia").ok).toBe(false);
  });
});

// ===================================================== datas: as 3 situações

describe("datas — as três situações da §3.3 e a decisão 3 do dono", () => {
  const hoje = "2026-08-04";

  it("data futura é RECUSADA (é a única recusa de data do sistema)", () => {
    const a = avaliarData("2026-09-01", PERIODO_CICLO_1, hoje);
    expect(a.situacao).toBe("futura");
    expect(a.aceita).toBe(false);
    expect(a.contaNoCiclo).toBe(false);
    expect(a.mensagem).toBe("Essa data ainda não chegou.");
  });

  it("anterior ao início do INCT é ACEITA como linha de base e não conta", () => {
    const a = avaliarData("2025-04-30", PERIODO_CICLO_1, hoje);
    expect(a.situacao).toBe("linha_de_base");
    expect(a.aceita).toBe(true);
    expect(a.contaNoCiclo).toBe(false);
    expect(a.mensagem).toBe("Isso é de antes do INCT começar: entra como linha de base.");
  });

  it("posterior ao fim do período é ACEITA com a data verdadeira e guardada", () => {
    /* Hoje é agosto/2026 e o período fechou em abril/2026: a expedição de junho
       é o caso corrente, não a exceção. Recusar empurraria a pessoa a recuar a
       data para caber na janela — corrompendo o dado que o CNPq vai auditar. */
    const a = avaliarData("2026-06-15", PERIODO_CICLO_1, hoje);
    expect(a.situacao).toBe("posterior");
    expect(a.aceita).toBe(true);
    expect(a.contaNoCiclo).toBe(false);
    expect(a.mensagem).toBe(MENSAGENS.dataPosterior);
    expect(a.mensagem).toMatch(/próximo relatório/);
  });

  it("dentro do período conta, inclusive nos dois extremos", () => {
    for (const d of ["2025-05-01", "2025-12-31", "2026-04-30"]) {
      const a = avaliarData(d, PERIODO_CICLO_1, hoje);
      expect(a.situacao, d).toBe("no_periodo");
      expect(a.contaNoCiclo, d).toBe(true);
      expect(a.mensagem, d).toBe("");
    }
  });

  it("um dia fora de cada extremo já muda a situação", () => {
    expect(avaliarData("2025-04-30", PERIODO_CICLO_1, hoje).situacao).toBe("linha_de_base");
    expect(avaliarData("2026-05-01", PERIODO_CICLO_1, hoje).situacao).toBe("posterior");
  });

  it("data inexistente é recusada; data vazia é 'sem_data' e não trava", () => {
    expect(avaliarData("2026-02-30", PERIODO_CICLO_1, hoje).situacao).toBe("invalida");
    expect(avaliarData("2026-13-01", PERIODO_CICLO_1, hoje).aceita).toBe(false);
    const vazia = avaliarData("", PERIODO_CICLO_1, hoje);
    expect(vazia.situacao).toBe("sem_data");
    expect(vazia.aceita).toBe(true);
  });

  it("a comparação é de STRING: não há fuso capaz de deslocar o dia", () => {
    /* new Date("2025-05-01") em UTC-4 devolve 30/04 às 20h — exatamente o erro
       capaz de jogar o primeiro dia do ciclo para fora do ciclo. */
    expect(avaliarData("2025-05-01", PERIODO_CICLO_1, hoje).situacao).toBe("no_periodo");
    expect("2026-05-01" > "2026-04-30").toBe(true);
    expect(dataValida("2025-02-29")).toBe(false);
    expect(dataValida("2024-02-29")).toBe(true);
  });

  it("os estados que só o cliente conhece têm tradução para o vocabulário do banco", () => {
    expect(situacaoDoBanco("futura")).toBe("posterior");
    expect(situacaoDoBanco("invalida")).toBe("sem_data");
    expect(situacaoDoBanco("no_periodo")).toBe("no_periodo");
    expect(situacaoDoBanco("linha_de_base")).toBe("linha_de_base");
  });

  it("fato com precisão de mês entra no dia 1, e a data sai em pt-BR sem Date", () => {
    expect(dataDoMes(2025, 9)).toBe("2025-09-01");
    expect(dataBr("2026-04-30")).toBe("30/04/2026");
    expect(hojeIso(new Date(2026, 7, 4, 23, 30))).toBe("2026-08-04");
  });
});

// ============================================================== narrativas

describe("narrativas e envio", () => {
  it("resultado principal exige uma frase e cabe em 600", () => {
    expect(validarResultadoPrincipal("curto").mensagem).toBe("Escreva pelo menos uma frase.");
    expect(validarResultadoPrincipal("a".repeat(20)).ok).toBe(true);
    expect(validarResultadoPrincipal("a".repeat(601)).mensagem).toMatch(/Corte 1\./);
  });
  it("declaração de veracidade é obrigatória para enviar", () => {
    expect(validarVeracidade(false).mensagem).toBe(MENSAGENS.veracidade);
    expect(validarVeracidade(true).ok).toBe(true);
  });
  it("cessão de imagem só é obrigatória quando há imagem publicável", () => {
    expect(validarCessaoImagem(false, false).ok).toBe(true);
    expect(validarCessaoImagem(false, true).ok).toBe(false);
    /* A frase é a mesma que o trigger do banco lança — tela e servidor não
       podem discordar sobre o motivo de um envio ter sido barrado. */
    expect(validarCessaoImagem(false, true).mensagem).toBe("Há imagem anexada: é preciso autorizar o uso das imagens para enviar.");
    expect(validarCessaoImagem(true, true).ok).toBe(true);
  });
  it("upload: jpeg/png/pdf e 1 MB, iguais aos limites do bucket", () => {
    expect(validarArquivo({ mime: "image/jpeg", bytes: 900_000 }).ok).toBe(true);
    expect(validarArquivo({ mime: "image/webp", bytes: 10 }).mensagem).toBe(MENSAGENS.arquivoTipo);
    expect(validarArquivo({ mime: "application/pdf", bytes: 1_048_577 }).mensagem).toBe(MENSAGENS.arquivoTamanho);
    expect(validarArquivo({ mime: "application/pdf", bytes: 1_048_576 }).ok).toBe(true);
  });
  it("o resumo de erros do topo preserva a ordem dos campos", () => {
    const p = pendenciasDe([
      ["orcid", validarOrcid("0000-0002-1825-0098")],
      ["lattes", validarLattes("1305959204330545")],
      ["veracidade", validarVeracidade(false)],
    ]);
    expect(p.map((x) => x.campo)).toEqual(["orcid", "veracidade"]);
  });
});

// ================================================ dedupe: cliente × banco

/**
 * Transcrição INDEPENDENTE da expressão do índice `producoes_ancora_unica`,
 * escrita a partir da semântica do Postgres e não do código de produção:
 *  • `\s` do POSIX é espaço, \t, \n, \v, \f, \r — e nada mais (o `\s` do
 *    JavaScript comeria também NBSP, e é aí que as duas chaves divergiriam);
 *  • `regexp_replace` sem a flag 'g' troca só a PRIMEIRA ocorrência, e o padrão
 *    é ancorado em ^;
 *  • o grupo do prefixo é OBRIGATÓRIO: sem `https://doi.org/` ou `doi:`, nada
 *    casa e nem o espaço inicial é removido.
 */
function chaveComoNoPostgres(tipo: string, valor: string): string {
  const s = "[ \\t\\n\\u000b\\f\\r]";
  const bruto =
    tipo === "isbn"
      ? valor.replace(/[^0-9Xx]/g, "")
      : valor.replace(new RegExp(`^${s}*(https?://(dx\\.)?doi\\.org/|doi:)${s}*`, "i"), "");
  return bruto.toLowerCase();
}

describe("dedupe — a chave do cliente é a chave do banco", () => {
  const casos: Array<[string, string, string]> = [
    // [tipo, valor gravado, chave esperada — calculada à mão pela expressão SQL]
    ["doi", "https://doi.org/10.1590/ABC", "10.1590/abc"],
    ["doi", "http://dx.doi.org/10.1590/ABC", "10.1590/abc"],
    ["doi", "HTTPS://DOI.ORG/10.1590/ABC", "10.1590/abc"],
    ["doi", "doi:10.1590/ABC", "10.1590/abc"],
    ["doi", "doi: 10.1590/ABC", "10.1590/abc"],
    ["doi", "  doi:10.1590/ABC", "10.1590/abc"],
    ["doi", "10.1590/ABC", "10.1590/abc"],
    // Sem prefixo, o grupo obrigatório não casa e o espaço inicial SOBREVIVE.
    // É por isso que o cliente tem de gravar já limpo.
    ["doi", "  10.1590/ABC", "  10.1590/abc"],
    // Espaço interno também sobrevive — mesma lição.
    ["doi", "10.1590/A B", "10.1590/a b"],
    // A âncora é ^: um DOI seguido de outro texto não é decapitado no meio.
    ["doi", "10.1590/abc https://doi.org/x", "10.1590/abc https://doi.org/x"],
    ["isbn", "978-85-754-1224-4", "9788575412244"],
    ["isbn", "ISBN 0-8044-2957-X", "080442957x"],
    ["isbn", "080442957x", "080442957x"],
    ["url_com_captura", "https://Exemplo.br/Pagina", "https://exemplo.br/pagina"],
  ];

  it("bate com a tabela de casos calculada pela semântica do Postgres", () => {
    for (const [tipo, valor, esperada] of casos) {
      expect(chaveAncora(tipo as "doi", valor), `${tipo} | ${JSON.stringify(valor)}`).toBe(esperada);
    }
  });

  it("bate com a transcrição independente da expressão SQL", () => {
    for (const [tipo, valor] of casos) {
      expect(chaveAncora(tipo as "doi", valor), valor).toBe(chaveComoNoPostgres(tipo, valor));
    }
  });

  it("o `\\s` do Postgres NÃO inclui NBSP — e o do JavaScript inclui", () => {
    /* Se `chaveAncora` usasse `\s`, este caso divergiria do banco: o cliente
       comeria o NBSP e o banco não. A classe explícita é o que evita isso. */
    const comNbsp = "\u00a0doi:10.1590/ABC";
    expect(chaveAncora("doi", comNbsp)).toBe(chaveComoNoPostgres("doi", comNbsp));
    expect(chaveAncora("doi", comNbsp)).toBe("\u00a0doi:10.1590/abc");
  });

  it("a expressão continua LITERALMENTE no 005_relatos.sql (índice e RPC)", () => {
    const sql = readFileSync(join(__dirname, "..", "supabase/migrations/005_relatos.sql"), "utf-8");
    // o índice único
    expect(sql).toContain(SQL_ANCORA_ISBN);
    expect(sql).toContain(SQL_ANCORA_OUTROS);
    // a RPC checar_ancora, dos dois lados da comparação
    expect(sql).toContain(SQL_ANCORA_ISBN.replace("ancora_valor", "p.ancora_valor"));
    expect(sql).toContain(SQL_ANCORA_OUTROS.replace("ancora_valor", "p.ancora_valor"));
    expect(sql).toContain(SQL_ANCORA_ISBN.replace("ancora_valor", "p_valor"));
    expect(sql).toContain(SQL_ANCORA_OUTROS.replace("ancora_valor", "p_valor"));
    expect(sql).toContain("create unique index if not exists producoes_ancora_unica");
  });

  it("o valor gravado é ponto fixo: aplicar a expressão do banco nele não muda nada", () => {
    const sujos = [
      "https://doi.org/10.1590/1678-9199-JVATITD-2023-0039",
      "  10.1590/ABC  ",
      "10.1590/1678-9199-jvatitd-\n2023-0039",
      "DOI: 10.5281/ZENODO.7712765",
    ];
    for (const bruto of sujos) {
      const gravado = valorParaGravar("doi", bruto);
      expect(chaveAncora("doi", gravado), bruto).toBe(gravado);
      expect(chaveComoNoPostgres("doi", gravado), bruto).toBe(gravado);
    }
  });

  it("as quatro grafias do mesmo artigo são UMA produção", () => {
    const formas = [
      "10.1590/1678-9199-jvatitd-2023-0039",
      "https://doi.org/10.1590/1678-9199-JVATITD-2023-0039",
      "doi: 10.1590/1678-9199-jvatitd-2023-0039",
      "10.1590/1678-9199-jvatitd-\n2023-0039",
    ].map((f) => valorParaGravar("doi", f));
    expect(new Set(formas.map((f) => chaveAncora("doi", f))).size).toBe(1);
    expect(mesmaAncora("doi", formas[0], formas[3])).toBe(true);
  });

  it("o mesmo ISBN com e sem hífen, com X maiúsculo ou minúsculo, é um só", () => {
    expect(mesmaAncora("isbn", "978-85-754-1224-4", "9788575412244")).toBe(true);
    expect(mesmaAncora("isbn", "0-8044-2957-X", "080442957x")).toBe(true);
    expect(mesmaAncora("isbn", "9788575412244", "9780262033848")).toBe(false);
  });
});

describe("dedupe — colar vários de uma vez", () => {
  it("separa únicos, repetidos e não reconhecidos, sem descartar nada", () => {
    const colado = [
      "https://doi.org/10.1590/1678-9199-JVATITD-2023-0039",
      "10.1590/1678-9199-jvatitd-2023-0039",
      "978-85-754-1224-4",
      "Silva et al., Toxicon, 2025 (sem DOI)",
      "10.5281/zenodo.7712765",
      "",
    ].join("\n");
    const r = separarColagem(colado);
    expect(r.unicos.map((u) => u.tipo)).toEqual(["doi", "isbn", "doi"]);
    expect(r.repetidos).toHaveLength(1);
    expect(r.repetidos[0].bruto).toBe("10.1590/1678-9199-jvatitd-2023-0039");
    expect(r.naoReconhecidos).toHaveLength(1);
    // o que não deu para reconhecer volta INTEIRO, para virar registro manual
    expect(r.naoReconhecidos[0].bruto).toBe("Silva et al., Toxicon, 2025 (sem DOI)");
  });

  it("distingue ISBN de URL que por acaso termina em 10 dígitos", () => {
    expect(detectarTipoAncora("https://exemplo.br/artigos/1234567890")).toBe("url_com_captura");
    expect(detectarTipoAncora("ISBN 978-85-754-1224-4")).toBe("isbn");
    expect(detectarTipoAncora("10.1590/abc")).toBe("doi");
    expect(detectarTipoAncora("https://doi.org/10.1590/abc")).toBe("doi");
    expect(detectarTipoAncora("nada disso")).toBe(null);
  });
});

describe("dedupe — a resposta da RPC não vaza quem declarou", () => {
  it("lê o jsonb de checar_ancora sem inventar campo", () => {
    const c = lerChecagemAncora({ existe: true, producao_id: "u1", tipo: "artigo_periodico", ano: 2025, titulo: "T", ja_declarado_por_membro: true });
    expect(c.existe).toBe(true);
    // o jsonb não traz nome de pessoa, e o tipo não tem onde guardá-lo
    expect(Object.keys(c).some((k) => /nome|autor|declarante/i.test(k))).toBe(false);
    expect(mensagemDedupe(c)).toMatch(/já foi registrado por outro membro da rede/);
  });
  it("qualquer coisa que não seja {existe:true} é 'não existe'", () => {
    expect(lerChecagemAncora({ existe: false }).existe).toBe(false);
    expect(lerChecagemAncora(null).existe).toBe(false);
    expect(lerChecagemAncora("erro").existe).toBe(false);
  });
});

// =========================================================== metadados (rede)

type CorpoDeRota = { status?: number; corpo?: unknown; jsonQuebra?: boolean; nuncaResponde?: boolean };
type Rota = { padrao: RegExp } & CorpoDeRota;

let chamadas: Array<{ url: string; init: RequestInit | undefined }> = [];

function dublarFetch(rotas: Rota[]): void {
  chamadas = [];
  const fn = async (entrada: unknown, init?: RequestInit): Promise<unknown> => {
    const url = String(entrada);
    chamadas.push({ url, init });
    const rota = rotas.find((r) => r.padrao.test(url));
    if (!rota) throw new TypeError("Failed to fetch");
    if (rota.nuncaResponde) {
      return new Promise((_ok, rejeitar) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new Error("The operation was aborted.");
          e.name = "AbortError";
          rejeitar(e);
        });
      });
    }
    const status = rota.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        // O 404 do Crossref é text/plain: se o código parsear antes de conferir
        // o status, "não encontrado" vira "erro" — e a tela some com o DOI.
        if (rota.jsonQuebra) throw new SyntaxError("Unexpected token R in JSON at position 0");
        return rota.corpo;
      },
    };
  };
  vi.stubGlobal("fetch", fn);
}

const CROSSREF_OK = {
  status: "ok",
  "message-type": "work",
  message: {
    DOI: "10.1590/1678-9199-jvatitd-2023-0039",
    title: ["Snake venom variation in the Amazon"],
    "container-title": ["Journal of Venomous Animals and Toxins including Tropical Diseases"],
    "short-container-title": ["J. Venom. Anim. Toxins incl. Trop. Dis."],
    publisher: "FapUNIFESP (SciELO)",
    "publisher-location": "Brazil",
    ISSN: ["1678-9199"],
    type: "journal-article",
    volume: "29",
    issued: { "date-parts": [[2023, 11, 14]] },
    license: [
      { URL: "https://example.org/tdm", "content-version": "tdm" },
      { URL: "https://creativecommons.org/licenses/by/4.0/", "content-version": "vor" },
    ],
    author: [
      { given: "Ana", family: "Silva", sequence: "first", ORCID: "http://orcid.org/0000-0003-1154-6503", affiliation: [{ name: "Universidade Federal de Rondônia" }] },
      { given: "Bruno", family: "Costa", sequence: "additional", ORCID: "https://orcid.org/0000-0002-0848-1940", affiliation: [] },
    ],
    URL: "https://doi.org/10.1590/1678-9199-jvatitd-2023-0039",
  },
};

const DATACITE_OK = {
  data: {
    attributes: {
      doi: "10.5281/zenodo.7712765",
      titles: [{ title: "Plant Treaty Crop Indicator — Results" }],
      publisher: "Zenodo",
      publicationYear: 2023,
      types: { resourceTypeGeneral: "Dataset", resourceType: "Dataset" },
      creators: [{ name: "Pesquisadora X", nameIdentifiers: [{ nameIdentifierScheme: "ORCID", nameIdentifier: "https://orcid.org/0000-0002-1552-2288" }] }],
      dates: [{ date: "2023-03-08", dateType: "Issued" }],
      rights: [{ rightsUri: "https://creativecommons.org/licenses/by/4.0/legalcode" }],
      url: "https://zenodo.org/record/7712765",
    },
  },
};

beforeEach(() => {
  limparCacheMetadados();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("metadados — cadeia de resolução de DOI", () => {
  it("a ordem padrão é Crossref → DataCite → doi.org (§3.3 e a apuração)", () => {
    expect([...CADEIA_DOI]).toEqual(["crossref", "datacite", "doiorg"]);
    expect(CONCORRENCIA).toBe(3);
  });

  it("Crossref resolve e o objeto normalizado sai pronto para a tela e para o banco", async () => {
    dublarFetch([{ padrao: /api\.crossref\.org/, corpo: CROSSREF_OK }]);
    const r = await resolverDoi("https://doi.org/10.1590/1678-9199-JVATITD-2023-0039");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados.titulo).toBe("Snake venom variation in the Amazon");
    expect(r.dados.veiculo).toBe("Journal of Venomous Animals and Toxins including Tropical Diseases");
    expect(r.dados.ano).toBe(2023);
    expect(r.dados.publicadoEm).toBe("2023-11-14");
    expect(r.dados.tipo).toBe("artigo_periodico");
    expect(r.dados.ancoraValor).toBe("10.1590/1678-9199-jvatitd-2023-0039");
    expect(r.dados.issn).toEqual(["1678-9199"]);
    expect(r.dados.provedor).toBe("crossref");
    // a licença de versão de registro ganha da de mineração de texto
    expect(r.dados.licenca).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(r.dados.acessoAberto).toBe(true);
    // o CSL cru vai inteiro para producoes.metadados — é o cache de 2027
    expect(r.dados.cru).toEqual(CROSSREF_OK.message);
  });

  it("os autores saem com ORCID normalizado — é o que casa a coautoria interna", () => {
    // (o Indicador nº 3 depende disto; 100% dos autores SciELO vieram com ORCID)
    expect(orcidDaApi("http://orcid.org/0000-0003-1154-6503")).toBe("0000-0003-1154-6503");
    expect(orcidDaApi("0000-0002-1694-233X")).toBe("0000-0002-1694-233X");
    expect(orcidDaApi("sem orcid")).toBe(null);
    expect(orcidDaApi(null)).toBe(null);
  });

  it("os autores do Crossref viram a lista ordenada, com afiliação quando houver", async () => {
    dublarFetch([{ padrao: /api\.crossref\.org/, corpo: CROSSREF_OK }]);
    const r = await resolverDoi("10.1590/1678-9199-jvatitd-2023-0039");
    if (!r.ok) throw new Error("deveria resolver");
    expect(r.dados.autores).toHaveLength(2);
    expect(r.dados.autores[0]).toEqual({ ordem: 0, nome: "Ana Silva", orcid: "0000-0003-1154-6503", afiliacao: "Universidade Federal de Rondônia" });
    expect(r.dados.autores[1].orcid).toBe("0000-0002-0848-1940");
    expect(r.dados.autores[1].afiliacao).toBe(null);
  });

  it("o ?mailto= vai na URL: sem ele o Crossref rebaixa para concorrência 1", async () => {
    dublarFetch([{ padrao: /api\.crossref\.org/, corpo: CROSSREF_OK }]);
    await resolverDoi("10.1590/abc");
    expect(chamadas[0].url).toContain(`mailto=${encodeURIComponent(MAILTO_CROSSREF)}`);
    expect(chamadas[0].url).toContain("10.1590%2Fabc");
  });

  it("404 do Crossref (text/plain) NÃO é erro: cai para o DataCite e resolve", async () => {
    dublarFetch([
      { padrao: /api\.crossref\.org/, status: 404, jsonQuebra: true },
      { padrao: /api\.datacite\.org/, corpo: DATACITE_OK },
    ]);
    const r = await resolverDoi("10.5281/zenodo.7712765");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados.provedor).toBe("datacite");
    expect(r.dados.tipo).toBe("base_dados");
    expect(r.dados.ano).toBe(2023);
    expect(r.dados.publicadoEm).toBe("2023-03-08");
    expect(r.dados.autores[0].orcid).toBe("0000-0002-1552-2288");
    expect(r.dados.acessoAberto).toBe(true);
    expect(chamadas.map((c) => c.url.split("?")[0])).toEqual([
      "https://api.crossref.org/works/10.5281%2Fzenodo.7712765",
      "https://api.datacite.org/dois/10.5281%2Fzenodo.7712765",
    ]);
  });

  it("com os dois primeiros fora, o doi.org CSL-JSON ainda salva — e pede o Accept certo", async () => {
    dublarFetch([
      { padrao: /api\.crossref\.org/, status: 500 },
      { padrao: /api\.datacite\.org/, status: 404 },
      { padrao: /^https:\/\/doi\.org\//, corpo: { ...CROSSREF_OK.message, title: "Título só string" } },
    ]);
    const r = await resolverDoi("10.1590/abc");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados.provedor).toBe("doiorg");
    // CSL devolve title como string; Crossref devolve como array. Os dois valem.
    expect(r.dados.titulo).toBe("Título só string");
    const ultima = chamadas[chamadas.length - 1];
    expect((ultima.init?.headers as Record<string, string>).Accept).toBe("application/vnd.citationstyles.csl+json");
  });

  it("cadeia inteira falhando DEGRADA para manual, preservando o que foi digitado", async () => {
    dublarFetch([
      { padrao: /api\.crossref\.org/, status: 404, jsonQuebra: true },
      { padrao: /api\.datacite\.org/, status: 404 },
      { padrao: /^https:\/\/doi\.org\//, status: 404 },
    ]);
    const r = await resolverDoi("  https://doi.org/10.1590/NAO-EXISTE  ");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("nao_encontrado");
    expect(r.mensagem).toBe(MENSAGENS.doi);
    // o DOI normalizado volta para o formulário manual já preenchido
    expect(r.valorPreservado).toBe("10.1590/nao-existe");
    expect(r.tentados).toEqual(["crossref", "datacite", "doiorg"]);
  });

  it("falha de rede não vira tela de erro: vira mensagem de degradação", async () => {
    dublarFetch([]); // nenhuma rota: o dublê lança TypeError, como o navegador offline
    const r = await resolverDoi("10.1590/abc");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("rede");
    expect(r.mensagem).toBe(MSG_DEGRADA_MANUAL);
    expect(r.valorPreservado).toBe("10.1590/abc");
  });

  it("timeout por provedor: a fila não fica presa num DOI", async () => {
    dublarFetch([
      { padrao: /api\.crossref\.org/, nuncaResponde: true },
      { padrao: /api\.datacite\.org/, nuncaResponde: true },
      { padrao: /^https:\/\/doi\.org\//, nuncaResponde: true },
    ]);
    const r = await resolverDoi("10.1590/abc", { timeoutMs: 5 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("timeout");
    expect(r.mensagem).toBe(MSG_DEGRADA_MANUAL);
  });

  it("aborto do chamador (nova digitação) interrompe a cadeia na hora", async () => {
    dublarFetch([{ padrao: /./, nuncaResponde: true }]);
    const ctrl = new AbortController();
    const promessa = resolverDoi("10.1590/abc", { signal: ctrl.signal, timeoutMs: 5000 });
    ctrl.abort();
    const r = await promessa;
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("abortado");
    expect(r.mensagem).toBe(""); // aborto pedido pelo usuário não fala nada na tela
    expect(chamadas).toHaveLength(1); // não tentou os outros dois provedores
  });

  it("entrada sem forma de DOI nem sai do navegador", async () => {
    dublarFetch([{ padrao: /./, corpo: CROSSREF_OK }]);
    const r = await resolverDoi("Toxicon 2025");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("entrada_invalida");
    expect(chamadas).toHaveLength(0);
  });

  it("o cache de sessão evita reconsultar o mesmo DOI, em qualquer grafia", async () => {
    dublarFetch([{ padrao: /api\.crossref\.org/, corpo: CROSSREF_OK }]);
    await resolverDoi("10.1590/1678-9199-jvatitd-2023-0039");
    await resolverDoi("https://doi.org/10.1590/1678-9199-JVATITD-2023-0039");
    await resolverDoi("doi: 10.1590/1678-9199-jvatitd-2023-0039");
    expect(chamadas).toHaveLength(1);
  });

  it("tipo que o provedor não sabe traduzir volta null — a tela pergunta, ninguém chuta", () => {
    expect(tipoDoCrossref("journal-article")).toBe("artigo_periodico");
    expect(tipoDoCrossref("book-chapter")).toBe("capitulo");
    expect(tipoDoCrossref("proceedings-article")).toBe("trabalho_anais_completo");
    expect(tipoDoCrossref("posted-content")).toBe(null); // preprint não é linha da Tabela A
    expect(tipoDoCrossref("component")).toBe(null);
  });
});

describe("metadados — fila de concorrência 3", () => {
  it("nunca passa do limite e devolve na ordem da entrada", async () => {
    let emVoo = 0;
    let pico = 0;
    const entradas = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const saida = await executarComConcorrencia(entradas, 3, async (n) => {
      emVoo++;
      pico = Math.max(pico, emVoo);
      await new Promise((r) => setTimeout(r, 2));
      emVoo--;
      return n * 10;
    });
    expect(pico).toBe(3);
    expect(saida).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it("lote de DOIs mantém a ordem em que a pessoa colou", async () => {
    dublarFetch([{ padrao: /api\.crossref\.org/, corpo: CROSSREF_OK }]);
    const lote = await resolverLote(["10.1590/a", "10.1590/b", "10.1590/c", "nao-e-doi"]);
    expect(lote.map((x) => x.entrada)).toEqual(["10.1590/a", "10.1590/b", "10.1590/c", "nao-e-doi"]);
    expect(lote.map((x) => x.resultado.ok)).toEqual([true, true, true, false]);
  });
});

describe("metadados — ISBN pelo OpenLibrary", () => {
  it("resolve livro brasileiro e marca tipo livro", async () => {
    dublarFetch([
      {
        padrao: /openlibrary\.org/,
        corpo: {
          "ISBN:9788575412244": {
            title: "Ciência, nação e região",
            authors: [{ name: "Júlio César Schweickardt" }],
            publishers: [{ name: "Editora FIOCRUZ" }],
            publish_date: "2011",
            url: "https://openlibrary.org/books/OL1M",
          },
        },
      },
    ]);
    const r = await resolverIsbn("978-85-754-1224-4");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados.titulo).toBe("Ciência, nação e região");
    expect(r.dados.editora).toBe("Editora FIOCRUZ");
    expect(r.dados.ano).toBe(2011);
    expect(r.dados.tipo).toBe("livro");
    expect(r.dados.ancoraValor).toBe("9788575412244");
  });

  it("ISBN inexistente devolve HTTP 200 com corpo vazio — e isso é 'não encontrado'", async () => {
    dublarFetch([{ padrao: /openlibrary\.org/, corpo: {} }]);
    const r = await resolverIsbn("9780262033848");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("nao_encontrado");
    expect(r.valorPreservado).toBe("9780262033848");
  });
});

describe("metadados — ORCID é atalho, nunca alicerce", () => {
  const ORCID_OK = {
    group: [
      {
        // o MESMO trabalho declarado por duas fontes: conta como UM
        "external-ids": { "external-id": [{ "external-id-type": "doi", "external-id-value": "10.1590/DENTRO" }] },
        "work-summary": [
          { "put-code": 11, title: { title: { value: "Artigo dentro da janela" } }, "journal-title": { value: "Rev. Amazônica" }, type: "journal-article", "publication-date": { year: { value: "2025" }, month: { value: "09" }, day: { value: "14" } } },
          { "put-code": 12, title: { title: { value: "Artigo dentro da janela" } }, type: "journal-article", "publication-date": { year: { value: "2025" }, month: { value: "09" }, day: { value: "14" } } },
        ],
      },
      {
        // só o ANO: pode ser de janeiro (fora) ou de novembro (dentro)
        "external-ids": { "external-id": [{ "external-id-type": "doi", "external-id-value": "10.1590/AMBIGUO" }] },
        "work-summary": [{ "put-code": 21, title: { title: { value: "Só o ano" } }, type: "journal-article", "publication-date": { year: { value: "2025" } } }],
      },
      {
        // mês fechado ANTES do início: a janela é alinhada ao mês, então não há dúvida
        "external-ids": { "external-id": [] },
        "work-summary": [{ "put-code": 31, title: { title: { value: "Anterior ao INCT" } }, type: "book-chapter", "publication-date": { year: { value: "2024" }, month: { value: "03" } } }],
      },
      {
        // depois do fim do período: guardado para o próximo relatório
        "external-ids": { "external-id": [{ "external-id-type": "doi", "external-id-value": "10.1590/DEPOIS" }] },
        "work-summary": [{ "put-code": 41, title: { title: { value: "De junho de 2026" } }, type: "journal-article", "publication-date": { year: { value: "2026" }, month: { value: "06" } } }],
      },
    ],
  };

  it("conta GROUP e não work-summary — senão o número mostrado infla", async () => {
    dublarFetch([{ padrao: /pub\.orcid\.org/, corpo: ORCID_OK }]);
    const r = await trabalhosDoOrcid("0000-0003-1154-6503");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trabalhos).toHaveLength(4); // 5 work-summary, 4 trabalhos
    expect(r.trabalhos[0].titulo).toBe("Artigo dentro da janela");
    expect(r.trabalhos[0].doi).toBe("10.1590/dentro");
    expect(r.trabalhos[0].veiculo).toBe("Rev. Amazônica");
    expect(r.trabalhos[0].putCode).toBe(11);
  });

  it("manda Accept: application/json — sem ele a API devolve XML", async () => {
    dublarFetch([{ padrao: /pub\.orcid\.org/, corpo: ORCID_OK }]);
    await trabalhosDoOrcid("0000-0003-1154-6503");
    expect((chamadas[0].init?.headers as Record<string, string>).Accept).toBe("application/json");
    expect(chamadas[0].url).toBe("https://pub.orcid.org/v3.0/0000-0003-1154-6503/works");
  });

  it("separa dentro, ambíguo e fora — e o ano solto NUNCA é decidido pela máquina", async () => {
    dublarFetch([{ padrao: /pub\.orcid\.org/, corpo: ORCID_OK }]);
    const r = await trabalhosDoOrcid("0000-0003-1154-6503", PERIODO_CICLO_1);
    if (!r.ok) throw new Error("deveria listar");
    const s = separarPorPeriodo(r.trabalhos);
    expect(s.noPeriodo.map((t) => t.titulo)).toEqual(["Artigo dentro da janela"]);
    expect(s.ambiguos.map((t) => t.titulo)).toEqual(["Só o ano"]);
    expect(s.fora.map((t) => t.titulo)).toEqual(["Anterior ao INCT", "De junho de 2026"]);
    expect(s.fora[0].situacao).toBe("linha_de_base");
    expect(s.fora[1].situacao).toBe("posterior");
    expect(s.ambiguos[0].precisao).toBe("ano");
  });

  it("precisão de mês não é ambígua: a janela do Ciclo 1 é alinhada ao mês", () => {
    expect(anoCruzaJanela(2025, PERIODO_CICLO_1)).toBe(true);
    expect(anoCruzaJanela(2026, PERIODO_CICLO_1)).toBe(true);
    expect(anoCruzaJanela(2024, PERIODO_CICLO_1)).toBe(false);
    expect(anoCruzaJanela(2027, PERIODO_CICLO_1)).toBe(false);
  });

  it("ORCID vazio é resposta legítima, não falha — 33% da rede está nesse caso", async () => {
    dublarFetch([{ padrao: /pub\.orcid\.org/, corpo: { group: [] } }]);
    const r = await trabalhosDoOrcid("0000-0003-1154-6503");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trabalhos).toEqual([]);
  });

  it("ORCID fora do ar não trava a tela: degrada com mensagem de degradação", async () => {
    dublarFetch([{ padrao: /pub\.orcid\.org/, status: 503 }]);
    const r = await trabalhosDoOrcid("0000-0003-1154-6503");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("rede");
    expect(r.mensagem).toBe(MSG_DEGRADA_MANUAL);
  });

  it("busca por nome usa a sintaxe Solr e devolve candidatos para escolha humana", async () => {
    dublarFetch([
      {
        padrao: /expanded-search/,
        corpo: { "num-found": 1, "expanded-result": [{ "orcid-id": "0000-0003-1154-6503", "given-names": "Andreimar", "family-names": "Soares", "institution-name": [] }] },
      },
    ]);
    const r = await buscarOrcidPorNome("Andreimar Martins Soares");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidatos[0].orcid).toBe("0000-0003-1154-6503");
    expect(chamadas[0].url).toContain(encodeURIComponent("given-names:Andreimar AND family-name:Soares"));
    // medido: institution-name volta vazio — a tela não pode depender dele
    expect(r.candidatos[0].instituicoes).toEqual([]);
  });
});

describe("metadados — ROR nunca escolhe sozinho", () => {
  it("devolve a lista com UF apenas SUGERIDA (a Fiocruz RO cairia como RJ)", async () => {
    dublarFetch([
      {
        padrao: /api\.ror\.org/,
        corpo: {
          number_of_results: 2,
          items: [
            { id: "https://ror.org/02842cb31", names: [{ value: "Universidade Federal de Rondônia", types: ["ror_display"] }], locations: [{ geonames_details: { country_code: "BR", country_subdivision_code: "RO", name: "Porto Velho" } }] },
            { id: "https://ror.org/04jhswv08", names: [{ value: "Oswaldo Cruz Foundation", types: ["ror_display"] }], locations: [{ geonames_details: { country_code: "BR", country_subdivision_code: "RJ", name: "Rio de Janeiro" } }] },
          ],
        },
      },
    ]);
    const r = await buscarRor("Universidade Federal de Rondônia");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidatos).toHaveLength(2); // lista, não escolha
    expect(r.candidatos[0].rorId).toBe("02842cb31");
    expect(r.candidatos[0].ufSugerida).toBe("RO");
    expect(r.candidatos[1].ufSugerida).toBe("RJ");
    // o id sai NU, no formato da constraint do banco
    expect(/^0[a-z0-9]{8}$/.test(r.candidatos[0].rorId)).toBe(true);
  });

  it("consulta curta demais não vai à rede", async () => {
    dublarFetch([{ padrao: /./, corpo: {} }]);
    const r = await buscarRor("un");
    expect(r.ok).toBe(true);
    expect(chamadas).toHaveLength(0);
  });
});
