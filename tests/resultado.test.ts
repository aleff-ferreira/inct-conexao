/**
 * Guardas do resultado do processo seletivo.
 *
 * Um resultado de seleção pública é diferente de todo o resto do site: ele traz
 * o nome de 50 pessoas reais, e cada uma vai procurar o próprio. Um nome
 * trocado, duplicado ou perdido numa edição futura é dano concreto a alguém —
 * não é "conteúdo desatualizado".
 *
 * Estes testes guardam três coisas:
 *   1. a integridade da lista (contagem, ausência de duplicata, UF válida);
 *   2. o que NÃO pode entrar (nota, classificação, CPF, parecer) — o processo
 *      publica o resultado, não a avaliação, e a decisão de nunca publicar a
 *      base de avaliações já foi tomada neste projeto;
 *   3. a coerência entre os números do painel e a própria lista, porque número
 *      grande sem denominador é o defeito recorrente deste site.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import resultado from "../src/content/editais/resultado-ic-2026.json";
import { ufBySigla } from "../src/mapa/geo";
import { VAGAS_IC_2026, totalVagasIc } from "../src/mapa/layers";
import { parseHash } from "../src/webinars/router";

const ESTADOS = resultado.estados;
const TODOS = ESTADOS.flatMap((e) => e.selecionados);

describe("resultado · integridade da lista", () => {
  it("tem 50 selecionados, e o painel diz o mesmo", () => {
    expect(TODOS).toHaveLength(50);
    expect(resultado.panorama.bolsas.valor).toBe(TODOS.length);
    // E o total do edital continua sendo 50: se um dia divergir, é erro nosso.
    expect(totalVagasIc).toBe(TODOS.length);
  });

  it("nenhum selecionado aparece duas vezes", () => {
    const nomes = TODOS.map((s) => s.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("todo nome e todo orientador estão preenchidos e são plausíveis", () => {
    for (const s of TODOS) {
      expect(s.nome.trim()).toBe(s.nome);
      expect(s.orientador.trim()).toBe(s.orientador);
      // Nome de pessoa tem ao menos dois termos; um só costuma ser truncamento.
      expect(s.nome.split(/\s+/).length, `selecionado "${s.nome}"`).toBeGreaterThanOrEqual(2);
      expect(s.orientador.split(/\s+/).length, `orientador "${s.orientador}"`).toBeGreaterThanOrEqual(2);
      // Sem resíduo de transcrição: dígitos ou caractere de controle.
      expect(s.nome, `selecionado "${s.nome}"`).not.toMatch(/[0-9_|]/);
      expect(s.orientador, `orientador "${s.orientador}"`).not.toMatch(/[0-9_|]/);
    }
  });

  it("toda UF existe e nenhuma se repete", () => {
    const siglas = ESTADOS.map((e) => e.sigla);
    expect(new Set(siglas).size).toBe(siglas.length);
    for (const e of ESTADOS) {
      const uf = ufBySigla(e.sigla);
      expect(uf, `sigla ${e.sigla}`).toBeTruthy();
      expect(e.nome).toBe(uf!.nome);
      expect(e.selecionados.length).toBeGreaterThan(0);
    }
  });

  it("o painel do processo bate com a lista", () => {
    const orientadores = new Set(TODOS.map((s) => s.orientador));
    expect(resultado.panorama.orientadoresComBolsista.valor).toBe(orientadores.size);
    // Regiões: derivadas das UFs, não escritas à mão.
    const regioes = new Set(ESTADOS.map((e) => ufBySigla(e.sigla)!.regiao));
    expect(resultado.panorama.regioes.valor).toBe(regioes.size);
    // Mulheres não é derivável do nome, e não deve ser: fica como dado
    // declarado. Só se exige que seja coerente com o total.
    expect(resultado.panorama.mulheres.valor).toBeLessThanOrEqual(TODOS.length);
  });

  it("todo número do painel traz definição com denominador", () => {
    for (const [id, n] of Object.entries(resultado.panorama)) {
      expect(typeof n.valor, id).toBe("number");
      expect(n.rotulo.length, id).toBeGreaterThan(4);
      // "36" sozinho é propaganda; "36 instituições envolvidas NESTE processo,
      // que não são as 81 do catálogo" é informação.
      expect(n.definicao.length, `definição de ${id}`).toBeGreaterThan(40);
    }
  });
});

describe("resultado · o que não pode ser publicado", () => {
  it("não expõe nota, classificação, parecer nem documento pessoal", () => {
    /* A decisão de não publicar a base de avaliação (83 candidatos com notas e
       pareceres) já foi tomada e está no .gitignore. Esta guarda impede que o
       dado volte por outra porta, dentro do arquivo do resultado.

       Proíbe CHAVES, não palavras: a primeira versão desta guarda reprovava a
       própria frase que explica que pareceres não são publicados. Guarda que
       pune o texto explicativo empurra na direção de remover a explicação. */
    const PROIBIDAS = /^(cpf|rg|nota|notas|parecer|pareceres|classificacao|classificação|pontuacao|pontuação|rank|posicao|posição|coeficiente|email|e-?mail|telefone|matricula|matrícula|endereco|endereço|nascimento|idade)$/i;
    const achadas: string[] = [];
    const andar = (o: unknown, caminho: string) => {
      if (Array.isArray(o)) return o.forEach((v, i) => andar(v, `${caminho}[${i}]`));
      if (o && typeof o === "object") {
        for (const [k, v] of Object.entries(o)) {
          if (PROIBIDAS.test(k)) achadas.push(`${caminho}.${k}`);
          andar(v, `${caminho}.${k}`);
        }
      }
    };
    andar(resultado, "resultado");
    expect(achadas, "campos de avaliação ou dado pessoal no resultado").toEqual([]);

    // E nenhum valor pode conter algo com cara de CPF ou de e-mail.
    const bruto = readFileSync(join(__dirname, "..", "src/content/editais/resultado-ic-2026.json"), "utf-8");
    expect(bruto).not.toMatch(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    expect(bruto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it("cada selecionado tem exatamente os dois campos previstos", () => {
    for (const s of TODOS) {
      expect(Object.keys(s).sort()).toEqual(["nome", "orientador"]);
    }
  });
});

describe("resultado · procedência e endereço", () => {
  it("declara edital e data de divulgação", () => {
    expect(resultado.edital).toMatch(/\d+\/\d{4}/);
    expect(resultado.divulgadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("não remete a um documento assinado que não vai existir", () => {
    /* Decisão do projeto: a publicação nesta página É o ato oficial. Não há
       PDF homologado, e prometer um seria pior que não mencionar nenhum —
       mandaria o leitor procurar algo inexistente e enfraqueceria justamente
       a autoridade da página. Esta guarda impede que a promessa volte. */
    const pagina = readFileSync(join(__dirname, "..", "src/editais/ResultadoIC2026.tsx"), "utf-8");
    const bruto = readFileSync(join(__dirname, "..", "src/content/editais/resultado-ic-2026.json"), "utf-8");
    for (const termo of ["homolog", "documentoOficial", "assinado", "prevalece"]) {
      expect(pagina.toLowerCase(), `página menciona "${termo}"`).not.toContain(termo.toLowerCase());
      expect(bruto.toLowerCase(), `JSON menciona "${termo}"`).not.toContain(termo.toLowerCase());
    }
    // O único PDF oferecido é o edital, que de fato existe em public/assets.
    expect(pagina).toContain("edital-selecao-ic-2026.pdf");
  });

  it("o endereço do resultado resolve, e não cai na home", () => {
    // O permalink de uma figura já quebrou assim neste projeto: a rota existia
    // no texto e não no roteador.
    expect(parseHash("#/editais/selecao-ic-2026/resultado").name).toBe("resultado-ic");
    // E a rota do edital continua funcionando.
    expect(parseHash("#/editais/selecao-ic-2026").name).toBe("edital");
    expect(parseHash("#/editais").name).toBe("edital");
  });
});

describe("resultado · a busca serve a quem procura o próprio nome", () => {
  /* A página é lazy e usa DOM, então o que se testa aqui é a REGRA, replicada
     do componente: sem acento, sem caixa, e sigla de estado como caso à parte.
     Se a regra do componente mudar sem mudar aqui, este teste passa e mente —
     por isso ele vive colado à razão dela, e não a uma implementação. */
  const chave = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const siglas = new Set(ESTADOS.map((e) => chave(e.sigla)));
  const combina = (alvo: string, e: { sigla: string; nome: string }, s: { nome: string; orientador: string }) => {
    if (!alvo) return true;
    if (siglas.has(alvo)) return chave(e.sigla) === alvo;
    return chave(s.nome).includes(alvo) || chave(s.orientador).includes(alvo) || chave(e.nome).includes(alvo);
  };
  const buscar = (termo: string) => {
    const alvo = chave(termo);
    return ESTADOS.flatMap((e) => e.selecionados.filter((s) => combina(alvo, e, s)));
  };

  it("acha sem acento e sem caixa", () => {
    expect(buscar("jose").length).toBeGreaterThan(0);
    expect(buscar("JOSÉ").length).toBe(buscar("jose").length);
    expect(buscar("rondonia")).toHaveLength(26);
    expect(buscar("Rondônia")).toHaveLength(26);
  });

  it("sigla de estado não vira substring solta", () => {
    // "RO" cai dentro de Pedro, Carolina e Roberta: sem a regra, devolvia 36
    // resultados em 7 estados para quem só queria Rondônia.
    expect(buscar("RO")).toHaveLength(26);
    expect(buscar("ro")).toHaveLength(26);
    expect(buscar("PA")).toHaveLength(8);
  });

  it("acha pelo orientador, que é como o próprio orientador confere sua lista", () => {
    expect(buscar("Ana Carla")).toHaveLength(4);
  });

  it("termo sem correspondência devolve vazio, não a lista inteira", () => {
    expect(buscar("zzzz")).toHaveLength(0);
  });
});

describe("resultado · o que ele contradiz no resto do site", () => {
  it("a distribuição realizada difere da prevista no edital, e isso é visível", () => {
    /* Este teste NÃO exige que batam — eles legitimamente não batem, porque a
       distribuição prevista é oferta e a realizada é resultado. Ele existe para
       que a divergência seja um fato registrado e não uma descoberta futura:
       a camada `vagas-ic-2026` do mapa pinta a PREVISÃO, e alguém vai comparar
       com esta página. */
    const realizado: Record<string, number> = {};
    for (const e of ESTADOS) realizado[e.sigla] = e.selecionados.length;

    const semBolsista = Object.keys(VAGAS_IC_2026).filter((uf) => !realizado[uf]);
    const acima = Object.keys(realizado).filter((uf) => realizado[uf] > (VAGAS_IC_2026[uf] ?? 0));

    // Os dois lados somam 50; o que muda é a distribuição.
    expect(Object.values(realizado).reduce((a, b) => a + b, 0)).toBe(totalVagasIc);
    // Fatos registrados nesta data, para virarem vermelho se alguém "corrigir"
    // um dos dois lados sem entender que medem coisas diferentes.
    expect(semBolsista.sort()).toEqual(["AL", "AP", "DF", "MS", "MT", "PB", "SE", "TO"]);
    expect(acima.sort()).toEqual(["PA", "PE", "PI", "RO", "RR"]);
  });
});
