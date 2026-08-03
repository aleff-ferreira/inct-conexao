import { describe, it, expect } from "vitest";
import { friendlyError } from "../src/platform/errors";

describe("friendlyError (mensagens do candidato)", () => {
  it("traduz colisão de protocolo (unique violation) em orientação de recarregar", () => {
    const raw = new Error('duplicate key value violates unique constraint "applications_protocolo_key"');
    expect(friendlyError(raw)).toMatch(/já foi registrada/i);
    expect(friendlyError(raw)).not.toMatch(/duplicate key/i);
  });

  it("traduz falha de geração de protocolo (not-null) sem vazar erro cru", () => {
    const raw = new Error('null value in column "protocolo" violates not-null constraint');
    expect(friendlyError(raw)).toMatch(/protocolo/i);
    expect(friendlyError(raw)).not.toMatch(/not-null|null value/i);
  });

  it("traduz o erro da janela do edital", () => {
    expect(friendlyError(new Error("Inscrições fora do período (edital não está aberto)."))).toMatch(
      /não estão abertas/i,
    );
  });

  it("traduz indisponibilidade do PostgREST/schema cache", () => {
    expect(friendlyError(new Error("PGRST205: Could not find the table in the schema cache"))).toMatch(
      /instabilidade tempor/i,
    );
  });

  it("traduz falha de rede", () => {
    expect(friendlyError(new Error("Failed to fetch"))).toMatch(/conex/i);
  });

  it("mantém nossas mensagens PT-BR já amigáveis (fallback)", () => {
    expect(friendlyError(new Error("Envie o documento em PDF."))).toBe("Envie o documento em PDF.");
  });

  it("nunca retorna vazio", () => {
    expect(friendlyError(new Error(""))).toMatch(/\S/);
    expect(friendlyError(undefined)).toMatch(/\S/);
  });
});
