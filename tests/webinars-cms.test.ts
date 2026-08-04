/**
 * O contrato entre o painel (/admin) e o módulo de webinários.
 *
 * O config.yml é o único lugar onde um erro não passa por TypeScript nem por
 * teste de componente: o que o widget grava é o que o site publica. Estes
 * testes leem o YAML como TEXTO e travam as duas decisões que protegem os
 * horários e as promessas da página.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TEXTO_ACESSIBILIDADE } from "../src/webinars/data";

const yml = readFileSync(join(__dirname, "..", "public/admin/config.yml"), "utf-8");

describe("config.yml · webinários", () => {
  it("startsAt/endsAt nunca voltam a ser widget datetime com token Z", () => {
    /* O widget datetime interpretava o horário digitado no fuso do NAVEGADOR
       de quem edita: um líder de grupo em São Paulo digitando "16:00" gravava
       15:00 reais em Rondônia, em silêncio. E o token Z carimbava o offset do
       editor. O campo virou string com pattern e offset -04:00 literal — este
       teste impede a regressão por conveniência ("datetime é mais bonito"). */
    expect(yml).not.toContain('format: "YYYY-MM-DDTHH:mm:ssZ"');
    expect(yml).toContain("00-04:00$");
  });

  it("os campos novos do PR-1 existem no painel", () => {
    for (const campo of ["liveStreamBackup", "acessibilidade", "transcricaoUrl", "audioUrl"]) {
      expect(yml, `campo ${campo} sumiu do config.yml`).toContain(`name: ${campo}`);
    }
  });

  it("o select de acessibilidade oferece exatamente o vocabulário que o código publica", () => {
    /* Divergência de catálogo é o erro recorrente deste repositório: uma opção
       no CMS sem texto correspondente publicaria promessa vazia; um texto sem
       opção seria inalcançável pelo editor. */
    const valores = [...yml.matchAll(/value: (libras-e-legenda|transcricao-posterior|sem-recursos)\b/g)].map((m) => m[1]);
    expect([...new Set(valores)].sort()).toEqual(Object.keys(TEXTO_ACESSIBILIDADE).sort());
  });

  it("os JSONs cadastrados obedecem ao pattern de horário que o painel exige", () => {
    /* O pattern só vale para quem edita PELO painel; um JSON editado à mão
       poderia divergir. Os dois têm de contar a mesma história. */
    const dir = join(__dirname, "..", "src/content/webinars");
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const j = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      for (const campo of ["startsAt", "endsAt"] as const) {
        expect(j[campo], `${f}: ${campo}`).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-04:00$/);
      }
    }
  });
});
