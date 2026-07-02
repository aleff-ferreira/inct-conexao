import { describe, it, expect } from "vitest";
import {
  isValidCpf,
  formatCpf,
  isValidVideoUrl,
  isValidEmail,
  passwordIssue,
} from "../src/platform/validation";

describe("passwordIssue (login da comissão)", () => {
  it("exige pelo menos 10 caracteres", () => {
    expect(passwordIssue("curta123")).toMatch(/10 caracteres/);
    expect(passwordIssue("senha-bem-longa-1")).toBe("");
  });
  it("exige confirmação idêntica quando fornecida", () => {
    expect(passwordIssue("senha-bem-longa-1", "senha-bem-longa-2")).toMatch(/não conferem/);
    expect(passwordIssue("senha-bem-longa-1", "senha-bem-longa-1")).toBe("");
  });
});

describe("isValidCpf (dígitos verificadores)", () => {
  it("aceita CPFs válidos com e sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });
  it("rejeita dígito verificador errado, repetições e tamanhos errados", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
});

describe("formatCpf", () => {
  it("aplica a máscara progressivamente e corta excesso", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("529982247259999")).toBe("529.982.247-25");
    expect(formatCpf("abc529")).toBe("529");
  });
});

describe("isValidVideoUrl", () => {
  it("aceita apenas URLs https", () => {
    expect(isValidVideoUrl("https://youtu.be/abc123")).toBe(true);
    expect(isValidVideoUrl("https://drive.google.com/file/d/xyz/view")).toBe(true);
    expect(isValidVideoUrl("http://inseguro.com/video")).toBe(false);
    expect(isValidVideoUrl("youtu.be/abc123")).toBe(false);
    expect(isValidVideoUrl("")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("valida o formato básico", () => {
    expect(isValidEmail("pessoa@exemplo.com.br")).toBe(true);
    expect(isValidEmail("sem-arroba")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});
