/**
 * ============================================================================
 *  Anexo .docx do relato (migração 011) — a validação do CLIENTE
 * ============================================================================
 *  Duas coisas quebram CARO se regredirem, e é por isso que estão aqui:
 *
 *  1. A DETECÇÃO TOLERANTE do mime. `File.type` vem VAZIO para .docx em alguns
 *     Windows (registro sem a associação OOXML) e `application/octet-stream`
 *     em outros — confiar só no type recusaria o arquivo certo justamente na
 *     máquina de quem mais usa Word. A regra de `mimeDetectado` (api.ts):
 *     type explícito vence; quando ele não diz nada, a extensão .docx decide.
 *
 *  2. Os TETOS por tipo. O file_size_limit do bucket é GLOBAL (10 MB desde a
 *     011) e NÃO segura um pdf de 5 MB — quem segura é a validação do cliente
 *     ANTES do upload (senão o binário sobe e o CHECK da tabela o deixa órfão
 *     no Storage). docx: 10 MB (`anexos.max_bytes_docx` do config, com o
 *     default da migração quando ausente); pdf/jpeg/png: continuam em 1 MB.
 *
 *  NENHUM TESTE VAI À REDE: o cliente Supabase é dublê, e os casos de recusa
 *  provam também que a recusa acontece ANTES de qualquer chamada de upload.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const MIME_DOCX_LITERAL =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Registro do que chegou ao "Supabase": prova do que subiu (ou de que nada subiu). */
const chamadas = vi.hoisted(() => ({
  uploads: [] as Array<{ caminho: string; contentType: string | undefined }>,
  inserts: [] as Array<Record<string, unknown>>,
}));

vi.mock("../src/platform/supabaseClient", () => ({
  platformEnabled: true,
  supabase: () => ({
    storage: {
      from: (_bucket: string) => ({
        upload: async (
          caminho: string,
          _arquivo: unknown,
          opcoes?: { contentType?: string },
        ) => {
          chamadas.uploads.push({ caminho, contentType: opcoes?.contentType });
          return { error: null };
        },
      }),
    },
    from: (_tabela: string) => ({
      // `listarArquivos`: select("*").eq(...) resolve com lista vazia.
      select: (_cols?: string) => ({
        eq: (_c: string, _v: string) => Promise.resolve({ data: [], error: null }),
      }),
      insert: (linha: Record<string, unknown>) => {
        chamadas.inserts.push(linha);
        return {
          select: () => ({
            single: async () => ({ data: { id: "arq-teste", ...linha }, error: null }),
          }),
        };
      },
    }),
  }),
}));

import { enviarArquivo, MIME_DOCX } from "../src/relato/api";
import type { NovoArquivo } from "../src/relato/api";
import type { CicloConfig, UsoArquivo } from "../src/relato/types";

const MB = 1048576;

function arquivo(nome: string, bytes: number, type: string): File {
  return new File([new Uint8Array(bytes)], nome, { type });
}

function entrada(
  f: File,
  uso: UsoArquivo = "comprovante",
  config: CicloConfig | null = null,
): NovoArquivo {
  return {
    userId: "00000000-0000-4000-8000-000000000001",
    cicloSlug: "ciclo-1",
    alvo: { relatoId: "11111111-0000-4000-8000-000000000001" },
    arquivo: f,
    uso,
    config,
  };
}

beforeEach(() => {
  chamadas.uploads.length = 0;
  chamadas.inserts.length = 0;
});

// ============================== 1. detecção do mime quando File.type não ajuda

describe("detecção do .docx — File.type vazio ou octet-stream, a extensão decide", () => {
  it("exporta o mime OOXML certo (e nunca o .doc legado)", () => {
    expect(MIME_DOCX).toBe(MIME_DOCX_LITERAL);
    expect(MIME_DOCX).not.toContain("msword");
  });

  it("File.type VAZIO + nome .docx → sobe como docx (contentType detectado, não o do File)", async () => {
    const ficha = await enviarArquivo(entrada(arquivo("dados-pesquisa.docx", 5 * MB, "")));
    expect(ficha.mime).toBe(MIME_DOCX);
    expect(chamadas.uploads).toHaveLength(1);
    // Sem a detecção, o bucket receberia "" → application/octet-stream e
    // recusaria pelo allowed_mime_types.
    expect(chamadas.uploads[0].contentType).toBe(MIME_DOCX);
    expect(chamadas.uploads[0].caminho).toMatch(/\.docx$/);
  });

  it("File.type application/octet-stream + nome .docx → também é docx", async () => {
    const ficha = await enviarArquivo(
      entrada(arquivo("Relato Final (2).DOCX", 2 * MB, "application/octet-stream")),
    );
    expect(ficha.mime).toBe(MIME_DOCX);
    expect(chamadas.uploads[0].contentType).toBe(MIME_DOCX);
  });

  it("File.type explícito de docx dispensa a extensão", async () => {
    const ficha = await enviarArquivo(entrada(arquivo("sem-extensao", 1 * MB, MIME_DOCX_LITERAL)));
    expect(ficha.mime).toBe(MIME_DOCX);
  });

  it("type explícito DIFERENTE vence a extensão: um 'x.docx' que se diz PDF é tratado como PDF", async () => {
    // Fica no ramo pdf — e o teto do pdf (1 MB) é quem manda.
    await expect(
      enviarArquivo(entrada(arquivo("renomeado.docx", 2 * MB, "application/pdf"))),
    ).rejects.toThrow(/1 MB/);
    expect(chamadas.uploads).toHaveLength(0);
  });

  it(".doc legado (Word 2003) é recusado com instrução de salvar como .docx", async () => {
    await expect(enviarArquivo(entrada(arquivo("tese.doc", 100, "")))).rejects.toThrow(
      /\.doc \(Word 2003\).*salve como \.docx/,
    );
    expect(chamadas.uploads).toHaveLength(0);
  });

  it("octet-stream SEM extensão .docx não vira docx — é recusado como tipo desconhecido", async () => {
    await expect(
      enviarArquivo(entrada(arquivo("misterio.bin", 100, "application/octet-stream"))),
    ).rejects.toThrow(/PDF, JPEG ou PNG/);
    expect(chamadas.uploads).toHaveLength(0);
  });
});

// ================================ 2. tetos por tipo — validados ANTES do upload

describe("tetos do cliente — 10 MB para docx, 1 MB para o resto", () => {
  it("docx de 5 MB passa (fica abaixo do teto de 10 MB)", async () => {
    const ficha = await enviarArquivo(entrada(arquivo("dados.docx", 5 * MB, MIME_DOCX_LITERAL)));
    expect(ficha.bytes).toBe(5 * MB);
    expect(chamadas.uploads).toHaveLength(1);
    expect(chamadas.inserts[0]).toMatchObject({ mime: MIME_DOCX, uso: "comprovante" });
  });

  it("docx de 11 MB é recusado ANTES do upload, com o teto na mensagem", async () => {
    await expect(
      enviarArquivo(entrada(arquivo("dados.docx", 11 * MB, MIME_DOCX_LITERAL))),
    ).rejects.toThrow(/\.docx.*10 MB/);
    expect(chamadas.uploads).toHaveLength(0);
    expect(chamadas.inserts).toHaveLength(0);
  });

  it("docx EXATAMENTE no teto (10485760 bytes) passa — o CHECK do banco é <=", async () => {
    const ficha = await enviarArquivo(entrada(arquivo("no-limite.docx", 10485760, "")));
    expect(ficha.bytes).toBe(10485760);
  });

  it("pdf de 2 MB é recusado — o teto de 10 MB é SÓ do docx", async () => {
    await expect(
      enviarArquivo(entrada(arquivo("comprovante.pdf", 2 * MB, "application/pdf"))),
    ).rejects.toThrow(/1 MB/);
    expect(chamadas.uploads).toHaveLength(0);
  });

  it("png de 2 MB idem — imagem continua em 1 MB", async () => {
    await expect(
      enviarArquivo(entrada(arquivo("foto.png", 2 * MB, "image/png"), "imagem_publicavel")),
    ).rejects.toThrow(/1 MB/);
  });

  it("pdf de até 1 MB continua passando como antes da 011", async () => {
    const ficha = await enviarArquivo(entrada(arquivo("recibo.pdf", MB, "application/pdf")));
    expect(ficha.mime).toBe("application/pdf");
    expect(chamadas.uploads[0].caminho).toMatch(/\.pdf$/);
  });

  it("o teto do docx vem do CONFIG do ciclo quando presente (baixá-lo lá vale sem deploy)", async () => {
    const config: CicloConfig = { anexos: { max_bytes_docx: 2 * MB } };
    await expect(
      enviarArquivo(entrada(arquivo("dados.docx", 3 * MB, MIME_DOCX_LITERAL), "comprovante", config)),
    ).rejects.toThrow(/2 MB/);
    // E abaixo do teto rebaixado, passa.
    const ficha = await enviarArquivo(
      enviarConfig(arquivo("dados.docx", MB, MIME_DOCX_LITERAL), config),
    );
    expect(ficha.bytes).toBe(MB);
  });
});

function enviarConfig(f: File, config: CicloConfig): NovoArquivo {
  return entrada(f, "comprovante", config);
}

// ==================================== 3. o docx só entra como 'comprovante'

describe("uso do docx — só 'comprovante' (regra da 011, CHECK relato_arquivos_docx_uso)", () => {
  it("docx com uso 'imagem_publicavel' é recusado no cliente, antes do upload", async () => {
    await expect(
      enviarArquivo(entrada(arquivo("dados.docx", MB, MIME_DOCX_LITERAL), "imagem_publicavel")),
    ).rejects.toThrow(/JPEG ou PNG/);
    expect(chamadas.uploads).toHaveLength(0);
  });

  it("a ficha gravada carrega o uso 'comprovante' e o sha256 calculado no navegador", async () => {
    await enviarArquivo(entrada(arquivo("dados.docx", 1024, MIME_DOCX_LITERAL)));
    const ficha = chamadas.inserts[0];
    expect(ficha.uso).toBe("comprovante");
    expect(String(ficha.sha256)).toMatch(/^[0-9a-f]{64}$/);
  });
});
