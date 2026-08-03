/**
 * Guardas do catálogo da rede.
 *
 * Por que este arquivo existe: os números da home eram escritos à mão e
 * divergiam do catálogo. A página afirmava 35 instituições na Amazônia Legal
 * contra 34 registradas, 21 em Rondônia contra 19, e "16 países" onde havia 16
 * instituições estrangeiras de 12 países distintos. Em site de instituição
 * científica isso é o erro mais barato de encontrar e o mais caro de manter.
 *
 * Agora os números da página são derivados de `src/content/rede.ts`, e estes
 * testes falham se alguém voltar a escrever um número à mão, se o formato de
 * `location` quebrar, ou se o mapa passar a discordar do diretório.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  partners,
  brasileiras,
  estrangeiras,
  instituicoesPorUf,
  naAmazoniaLegal,
  paisesEstrangeiros,
  ufDe,
  REDE,
  UFS_AMAZONIA_LEGAL,
} from "../src/content/rede";
import { INSTITUICOES_POR_UF } from "../src/mapa/layers";

const RAIZ = join(__dirname, "..");

describe("catálogo da rede · integridade", () => {
  it("todo registro tem nome, grupo, foco e localização", () => {
    const ruins = partners.filter((p) => !p.name?.trim() || !p.group?.trim() || !p.focus?.trim() || !p.location?.trim());
    expect(ruins.map((p) => p.name)).toEqual([]);
  });

  it("location segue o formato \"UF, Brasil\" ou \"País\"", () => {
    const fora = partners.filter((p) => {
      const uf = ufDe(p);
      if (uf === null) return /,/.test(p.location); // estrangeira não leva vírgula
      return !/^[A-Z]{2}$/.test(uf); // brasileira leva sigla de 2 letras
    });
    expect(fora.map((p) => p.location)).toEqual([]);
  });

  it("não há registro duplicado (mesmo nome)", () => {
    const vistos = new Set<string>();
    const repetidos: string[] = [];
    for (const p of partners) {
      const chave = p.name.trim().toLowerCase();
      if (vistos.has(chave)) repetidos.push(p.name);
      vistos.add(chave);
    }
    expect(repetidos).toEqual([]);
  });

  it("brasileiras e estrangeiras somam o total", () => {
    expect(brasileiras.length + estrangeiras.length).toBe(partners.length);
    expect(REDE.catalogadas).toBe(partners.length);
  });
});

describe("catálogo da rede · o mapa não pode divergir do diretório", () => {
  it("INSTITUICOES_POR_UF bate item por item com o catálogo", () => {
    expect(INSTITUICOES_POR_UF).toEqual(instituicoesPorUf);
  });

  it("a soma do mapa é o número de instituições brasileiras", () => {
    const soma = Object.values(INSTITUICOES_POR_UF).reduce((a, b) => a + b, 0);
    expect(soma).toBe(brasileiras.length);
  });
});

describe("catálogo da rede · números derivados", () => {
  it("Amazônia Legal conta só UFs da Amazônia Legal", () => {
    const al = new Set<string>(UFS_AMAZONIA_LEGAL);
    expect(naAmazoniaLegal.every((p) => al.has(ufDe(p) as string))).toBe(true);
    expect(REDE.amazoniaLegal).toBe(naAmazoniaLegal.length);
  });

  it("países é contagem de PAÍSES, não de instituições estrangeiras", () => {
    expect(REDE.paises).toBe(paisesEstrangeiros.length);
    // o erro histórico foi usar 16 (instituições) como se fosse país
    expect(REDE.paises).toBeLessThanOrEqual(REDE.estrangeiras);
  });

  it("o total da proposta é maior ou igual ao catalogado, e a diferença é declarada", () => {
    expect(REDE.naProposta).toBeGreaterThanOrEqual(REDE.catalogadas);
    const app = readFileSync(join(RAIZ, "src", "App.tsx"), "utf8");
    // a página precisa explicar a diferença entre proposta e diretório
    expect(app).toMatch(/já estão detalhadas no diretório/);
  });
});

describe("catálogo da rede · nenhum número escrito à mão na home", () => {
  const app = readFileSync(join(RAIZ, "src", "App.tsx"), "utf8");

  it("os números da rede vêm de REDE, não de literais", () => {
    // os valores antigos, que divergiam do catálogo, não podem voltar
    const proibidos = [
      /"35 instituições"/,
      /"16 países"/,
      /"21 instituições em Rondônia"/,
      /sede \+ 21 instituições/,
      /value: "86"/,
      /value: "35"/,
    ];
    const reincidentes = proibidos.filter((re) => re.test(app)).map(String);
    expect(reincidentes).toEqual([]);
  });

  it("App.tsx importa os derivados do catálogo", () => {
    expect(app).toMatch(/from "\.\/content\/rede"/);
  });
});
