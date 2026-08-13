/**
 * temSenhaAtiva() — a detecção que esconde o convite "definir uma senha" de
 * quem já a tem (apontado pelo dono em 10/08/2026: o painel aparecia até para
 * quem tinha acabado de ENTRAR digitando a senha).
 *
 * Dois sinais, qualquer um basta:
 *   1. a marca `user_metadata.senha_definida` (gravada por signUp/updatePassword);
 *   2. o `amr` do access token — como ESTA sessão nasceu.
 *
 * O JWT aqui é FABRICADO (header.payload.assinatura com payload base64url):
 * a função só decodifica o payload — não valida assinatura, porque isto decide
 * UI, não autorização. O teste espelha exatamente esse contrato.
 */
import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { temSenhaAtiva } from "../src/platform/auth";

/** JWT de mentira com o payload dado — o suficiente para o decode da função. */
function jwtCom(payload: object): string {
  const b64url = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `cabecalho.${b64url}.assinatura`;
}

function sessao(opts: { amr?: Array<{ method: string }>; metadata?: Record<string, unknown>; token?: string }): Session {
  return {
    access_token: opts.token ?? jwtCom({ amr: opts.amr ?? [] }),
    user: { user_metadata: opts.metadata ?? {} },
  } as unknown as Session;
}

describe("temSenhaAtiva — quem já tem senha não vê o convite", () => {
  it("sessão nula (deslogado) => false", () => {
    expect(temSenhaAtiva(null)).toBe(false);
  });

  it("entrou com SENHA (amr method=password) => true, sem depender de marca", () => {
    expect(temSenhaAtiva(sessao({ amr: [{ method: "password" }] }))).toBe(true);
  });

  it("entrou por LINK/CÓDIGO (amr otp) e sem marca => false — o convite aparece", () => {
    expect(temSenhaAtiva(sessao({ amr: [{ method: "otp" }] }))).toBe(false);
  });

  it("entrou por link MAS tem a marca senha_definida => true — definiu senha antes", () => {
    expect(
      temSenhaAtiva(sessao({ amr: [{ method: "otp" }], metadata: { senha_definida: true } })),
    ).toBe(true);
  });

  it("marca com valor não-booleano-verdadeiro NÃO conta (só `true` literal)", () => {
    expect(temSenhaAtiva(sessao({ amr: [{ method: "otp" }], metadata: { senha_definida: "sim" } }))).toBe(false);
  });

  it("amr com vários métodos acha o password no meio", () => {
    expect(
      temSenhaAtiva(sessao({ amr: [{ method: "otp" }, { method: "password" }] })),
    ).toBe(true);
  });

  it("payload base64url com - e _ decodifica (o replace existe por isso)", () => {
    // Payload escolhido para conter bytes que produzem '-'/'_' no base64url.
    const p = { amr: [{ method: "password" }], preenchimento: "??>>??>>??" };
    expect(temSenhaAtiva(sessao({ token: jwtCom(p) }))).toBe(true);
  });

  it("token deformado não estoura — devolve false e o convite aparece (pior caso inócuo)", () => {
    expect(temSenhaAtiva(sessao({ token: "nem.jwt" }))).toBe(false);
    expect(temSenhaAtiva(sessao({ token: "" }))).toBe(false);
    expect(temSenhaAtiva(sessao({ token: "a.b.c" }))).toBe(false);
  });

  it("payload sem amr => false", () => {
    expect(temSenhaAtiva(sessao({ token: jwtCom({ sub: "abc" }) }))).toBe(false);
  });
});
