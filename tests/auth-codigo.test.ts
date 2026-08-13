import { describe, it, expect } from "vitest";
import {
  CODIGO_MAX,
  CODIGO_MIN,
  codigoIssue,
  normalizarCodigo,
  ptError,
  segundosDeEspera,
  tentativasRestantes,
} from "../src/platform/auth";

/**
 * O CÓDIGO NUMÉRICO DA REDEFINIÇÃO DE SENHA.
 *
 * Aqui só entra o que é PURO: normalização do que a pessoa digita ou cola,
 * validação do código e tradução das mensagens do GoTrue. O componente
 * montado não é testado — o projeto não tem essa infraestrutura, e o que
 * realmente quebrava em produção era texto e parse, não render.
 *
 * O COMPRIMENTO NÃO É FIXO, e este arquivo é o guarda disso: o painel do
 * Supabase configura o OTP de 6 a 10 dígitos, e a primeira versão do cliente
 * fixou 6 enquanto o projeto estava em 8 — o campo truncava a colagem e a
 * pessoa via "código incorreto" com o código certo na mão (e-mail real de
 * 07/08/2026, código 01438947). Os testes de regressão usam exatamente esse
 * código.
 */

describe("normalizarCodigo (o que a pessoa digita ou cola vira código)", () => {
  it("aceita o código limpo", () => {
    expect(normalizarCodigo("123456")).toBe("123456");
  });

  it("ignora espaços em volta e no meio", () => {
    expect(normalizarCodigo("  123456 ")).toBe("123456");
    expect(normalizarCodigo("123 456")).toBe("123456");
    expect(normalizarCodigo("1 2 3 4 5 6")).toBe("123456");
  });

  it("aceita a colagem com traço, ponto e traço tipográfico", () => {
    expect(normalizarCodigo("123-456")).toBe("123456");
    expect(normalizarCodigo("123.456")).toBe("123456");
    expect(normalizarCodigo("123–456")).toBe("123456"); // en dash, o que o e-mail em HTML insere
    expect(normalizarCodigo("123—456")).toBe("123456"); // em dash
  });

  it("descarta dígito não numérico (letra digitada por engano)", () => {
    expect(normalizarCodigo("12a456")).toBe("12456");
    expect(normalizarCodigo("abc")).toBe("");
  });

  it("REGRESSÃO 07/08/2026: o código de 8 dígitos do projeto passa INTEIRO", () => {
    // O painel do Supabase estava em 8 e o cliente truncava em 6: a pessoa
    // colava 01438947, o campo guardava 014389, e o envio falhava com "código
    // incorreto" — com o código certo na mão. Nunca mais.
    expect(normalizarCodigo("01438947")).toBe("01438947");
    expect(normalizarCodigo("0143 8947")).toBe("01438947");
    expect(codigoIssue("01438947")).toBe("");
  });

  it("aceita a faixa inteira do painel (6 a 10) e corta só acima do máximo", () => {
    expect(normalizarCodigo("1234567")).toBe("1234567"); // 7 é código possível
    expect(normalizarCodigo("1234567890")).toBe("1234567890"); // 10, o teto
    expect(normalizarCodigo("12345678901234")).toBe("1234567890"); // acima do teto: corta
  });

  it("acha o código quando a pessoa cola a frase inteira do e-mail", () => {
    expect(normalizarCodigo("Seu código é 123456")).toBe("123456");
    expect(normalizarCodigo("código: 987654 (válido por 1 hora)")).toBe("987654");
    // e com o comprimento real do projeto (8):
    expect(normalizarCodigo("digite o código abaixo: 01438947")).toBe("01438947");
  });

  it("não confunde uma data com o código na frase colada", () => {
    // "2026-08" continua sendo dois grupos ("2026" e "08"), então o único grupo
    // de seis dígitos do texto é o código de verdade.
    expect(normalizarCodigo("Pedido em 2026-08-07. Seu código é 445566.")).toBe("445566");
  });

  it("aceita vazio e string só de separadores sem quebrar", () => {
    expect(normalizarCodigo("")).toBe("");
    expect(normalizarCodigo("   ")).toBe("");
    expect(normalizarCodigo("---")).toBe("");
  });

  it("devolve sempre e só dígitos, dentro do teto do painel", () => {
    const entradas = ["123456", "12a456", "Seu código é 123456", "", "---", "9 8 7 6 5 4 3 2"];
    for (const entrada of entradas) {
      const saida = normalizarCodigo(entrada);
      expect(saida).toMatch(/^\d*$/);
      expect(saida.length).toBeLessThanOrEqual(CODIGO_MAX);
    }
  });

  it("a faixa exportada é a que o painel do Supabase aceita", () => {
    expect(CODIGO_MIN).toBe(6);
    expect(CODIGO_MAX).toBe(10);
    expect(CODIGO_MIN).toBeLessThanOrEqual(CODIGO_MAX);
  });
});

describe("codigoIssue (validação do código)", () => {
  it("aprova o código completo, inclusive colado com separador", () => {
    expect(codigoIssue("123456")).toBe("");
    expect(codigoIssue("123 456")).toBe("");
    expect(codigoIssue("123-456")).toBe("");
  });

  it("pede o código quando não há nada digitado", () => {
    expect(codigoIssue("")).toMatch(/digite o código/i);
    expect(codigoIssue("   ")).toMatch(/digite o código/i);
  });

  it("diz quantos dígitos vieram quando faltam — sem afirmar o total, que é do painel", () => {
    expect(codigoIssue("123")).toMatch(/incompleto/i);
    expect(codigoIssue("123")).toMatch(/digitou 3/);
    expect(codigoIssue("12a456")).toMatch(/digitou 5/);
    // A mensagem NÃO pode prometer um comprimento: foi a promessa de "6
    // dígitos" na tela, com o código real de 8 na mão da pessoa, que fez o
    // defeito parecer culpa dela.
    expect(codigoIssue("123")).not.toMatch(/\b6 dígitos\b|\bseis dígitos\b/i);
  });

  it("aceita qualquer comprimento da faixa do painel", () => {
    expect(codigoIssue("123456")).toBe(""); // 6, o mínimo
    expect(codigoIssue("01438947")).toBe(""); // 8, o real do projeto
    expect(codigoIssue("1234567890")).toBe(""); // 10, o teto
  });
});

describe("segundosDeEspera e tentativasRestantes (números que a API às vezes manda)", () => {
  it("lê os segundos do limite de envio do GoTrue", () => {
    expect(segundosDeEspera("For security purposes, you can only request this after 51 seconds.")).toBe(51);
    expect(segundosDeEspera("you can only request this after 1 second")).toBe(1);
  });

  it("devolve null quando não há número de segundos", () => {
    expect(segundosDeEspera("Token has expired or is invalid")).toBeNull();
    expect(segundosDeEspera("")).toBeNull();
  });

  it("lê as tentativas restantes quando (e só quando) a mensagem traz", () => {
    expect(tentativasRestantes("Invalid token. 2 attempts remaining.")).toBe(2);
    expect(tentativasRestantes("You have 3 more attempts before this code is locked.")).toBe(3);
    expect(tentativasRestantes("1 attempt left")).toBe(1);
  });

  it("devolve null quando a mensagem não conta tentativas", () => {
    expect(tentativasRestantes("Token has expired or is invalid")).toBeNull();
    expect(tentativasRestantes("Too many attempts")).toBeNull();
    expect(tentativasRestantes("For security purposes, you can only request this after 51 seconds.")).toBeNull();
  });
});

describe("ptError no fluxo do CÓDIGO", () => {
  it("traduz código errado/expirado sem mandar a pessoa procurar link", () => {
    const t = ptError("Token has expired or is invalid", "codigo", "otp_expired");
    expect(t).toMatch(/código incorreto ou expirado/i);
    expect(t).toMatch(/mais recente/i);
    expect(t).not.toMatch(/link/i);
    expect(t).not.toMatch(/token|expired|invalid/i);
  });

  it("explica que pedir outro código cancela o anterior", () => {
    expect(ptError("Token has expired or is invalid", "codigo", "otp_expired")).toMatch(
      /cancela o anterior/i,
    );
  });

  it("acrescenta as tentativas restantes quando a API as informa", () => {
    expect(ptError("Invalid token. 2 attempts remaining.", "codigo", "otp_expired")).toMatch(
      /restam 2 tentativas/i,
    );
    expect(ptError("Invalid token. 1 attempt remaining.", "codigo", "otp_expired")).toMatch(
      /resta 1 tentativa/i,
    );
  });

  it("não inventa tentativas restantes quando a API não as informa", () => {
    expect(ptError("Token has expired or is invalid", "codigo", "otp_expired")).not.toMatch(/tentativa/i);
  });

  it("traduz tentativas demais dizendo que o código continua valendo", () => {
    const t = ptError("Request rate limit reached", "codigo", "over_request_rate_limit");
    expect(t).toMatch(/tentativas demais/i);
    expect(t).toMatch(/continua valendo/i);
  });

  it("traduz o limite de envio com os segundos exatos e falando em CÓDIGO", () => {
    const t = ptError(
      "For security purposes, you can only request this after 51 seconds.",
      "codigo",
      "over_email_send_rate_limit",
    );
    expect(t).toMatch(/aguarde 51 segundos/i);
    expect(t).toMatch(/código/i);
    expect(t).not.toMatch(/link/i);
  });

  it("no fluxo do LINK o mesmo limite de envio fala em link", () => {
    const t = ptError("For security purposes, you can only request this after 51 seconds.", "link");
    expect(t).toMatch(/aguarde 51 segundos/i);
    expect(t).toMatch(/link/i);
  });

  it("traduz e-mail que não bate sem confirmar se a conta existe", () => {
    const t = ptError("User not found", "codigo", "user_not_found");
    expect(t).toMatch(/confira/i);
    expect(t).not.toMatch(/não existe|não há conta|conta inexistente/i);
  });

  it("traduz código malformado recusado pelo servidor — sem prometer comprimento", () => {
    const t = ptError("Missing one of these parameters: token", "codigo", "validation_failed");
    expect(t).toMatch(/só números/i);
    expect(t).not.toMatch(/\b6 dígitos\b|\bseis dígitos\b/i);
  });

  it("nunca vaza o código de erro cru do Supabase no texto final", () => {
    expect(ptError("Algo inesperado aconteceu", "codigo", "unexpected_failure")).toBe(
      "Algo inesperado aconteceu",
    );
  });
});

describe("ptError no fluxo do LINK (o que já existia continua valendo)", () => {
  it("mantém a tradução de credenciais inválidas", () => {
    expect(ptError("Invalid login credentials")).toBe("E-mail ou senha incorretos.");
  });

  it("mantém a explicação do PKCE (mesmo navegador) e agora oferece o código", () => {
    const t = ptError("code verifier should be non-empty");
    expect(t).toMatch(/mesmo navegador/i);
    expect(t).toMatch(/código numérico/i);
  });

  it("mantém o link expirado/já usado, apontando o código como saída", () => {
    const t = ptError("Email link is invalid or has expired");
    expect(t).toMatch(/expirou ou já foi usado/i);
    expect(t).toMatch(/código numérico/i);
  });

  it("mantém a senha fraca e a senha repetida", () => {
    expect(ptError("Password should be at least 10 characters")).toMatch(/10\+ caracteres/);
    expect(ptError("New password should be different from the old password")).toMatch(/diferente da atual/i);
  });

  it("mantém o fallback: mensagem desconhecida passa intacta", () => {
    expect(ptError("Erro não catalogado")).toBe("Erro não catalogado");
  });
});
