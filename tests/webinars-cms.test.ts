/**
 * O contrato entre o painel (/admin) e o módulo de webinários.
 *
 * O config.yml é o único lugar onde um erro não passa por TypeScript nem por
 * teste de componente: o que o widget grava é o que o site publica. Estes
 * testes leem o YAML como TEXTO e travam as decisões que protegem os horários
 * e as promessas da página.
 *
 * As travas foram endurecidas depois de uma revisão demonstrar três desvios:
 * regressão parcial a `datetime` (sem format, ou com aspas simples) passava;
 * o vocabulário do select era varrido no arquivo inteiro (outra coleção podia
 * mentir por ele); e o pattern do teste era uma CÓPIA do pattern do painel —
 * podiam divergir em silêncio. Agora o pattern é EXTRAÍDO do próprio YAML.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TEXTO_ACESSIBILIDADE } from "../src/webinars/data";

const yml = readFileSync(join(__dirname, "..", "public/admin/config.yml"), "utf-8");

/** Os scalars de pattern dos DOIS campos de horário, extraídos do YAML real. */
function padroesDeHorario(): string[] {
  return [...yml.matchAll(/name: (?:startsAt|endsAt)\n\s+widget: string\n\s+pattern:\n\s+- '([^']+)'/g)].map((m) => m[1]);
}

describe("config.yml · webinários", () => {
  it("nenhum campo volta a ser widget datetime — em NENHUMA grafia", () => {
    /* O widget datetime interpretava o horário digitado no fuso do NAVEGADOR
       de quem edita: alguém em São Paulo digitando "16:00" gravava 15:00 reais
       em Rondônia, em silêncio. Banir a STRING do format era burlável (aspas
       simples, ou datetime sem format). Banir o widget não é: o arquivo
       inteiro só usa `widget: date` (datas sem hora), que segue permitido. */
    expect(yml).not.toContain("widget: datetime");
  });

  it("startsAt e endsAt são string com o MESMO pattern, com faixas de calendário", () => {
    const padroes = padroesDeHorario();
    expect(padroes).toHaveLength(2);
    expect(padroes[0]).toBe(padroes[1]);
    // Faixas, não \d cego: T25:00 publicava página sem horário; mês 13 idem.
    const re = new RegExp(padroes[0]);
    expect(re.test("2026-08-27T16:00:00-04:00")).toBe(true);
    expect(re.test("2026-08-27T25:00:00-04:00")).toBe(false);
    expect(re.test("2026-13-01T16:00:00-04:00")).toBe(false);
    expect(re.test("2026-08-27T16:61:00-04:00")).toBe(false);
    expect(re.test("2026-08-27T16:00:00-03:00")).toBe(false);
  });

  it("os campos novos do PR-1 existem no painel", () => {
    for (const campo of ["liveStreamBackup", "acessibilidade", "transcricaoUrl", "audioUrl"]) {
      expect(yml, `campo ${campo} sumiu do config.yml`).toContain(`name: ${campo}`);
    }
  });

  it("o select de acessibilidade oferece exatamente o vocabulário que o código publica", () => {
    /* Escopado ao bloco do select (não ao YML inteiro) e com captura ABERTA:
       uma opção nova no painel sem texto no código aparece aqui — antes, a
       alternância fechada do regex a tornava invisível. */
    const inicio = yml.indexOf("name: declaracao");
    const fim = yml.indexOf("name: transcricaoUrl", inicio);
    expect(inicio).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(inicio);
    const bloco = yml.slice(inicio, fim);
    const valores = [...bloco.matchAll(/value: ([a-z][a-z-]*)/g)].map((m) => m[1]);
    expect(valores.length).toBeGreaterThan(0);
    expect([...new Set(valores)].sort()).toEqual(Object.keys(TEXTO_ACESSIBILIDADE).sort());
  });

  it("os JSONs cadastrados obedecem ao pattern do painel E são datas de verdade", () => {
    /* Valida com o pattern EXTRAÍDO do YAML (uma fonte só) e, por cima, com o
       calendário: 2026-02-30 passa em qualquer regex razoável, o Date aceita e
       publica 2 de março em silêncio. A ida-e-volta do dia civil pega isso. */
    const re = new RegExp(padroesDeHorario()[0]);
    const dir = join(__dirname, "..", "src/content/webinars");
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const j = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      for (const campo of ["startsAt", "endsAt"] as const) {
        const v = j[campo] as string;
        expect(v, `${f}: ${campo}`).toMatch(re);
        const d = new Date(v);
        expect(Number.isNaN(d.getTime()), `${f}: ${campo} não é uma data`).toBe(false);
        const diaCivil = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Porto_Velho",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(d);
        expect(diaCivil, `${f}: ${campo} é um dia que não existe no calendário (o Date "rolou" para outro)`).toBe(v.slice(0, 10));
      }
    }
  });
});
