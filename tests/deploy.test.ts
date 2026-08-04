/**
 * As decisões do CI de deploy que não podem regredir por conveniência.
 *
 * O workflow é YAML lido por máquina alheia — nenhum tipo, nenhum teste de
 * unidade o protege. Estas asserções leem o arquivo como texto e travam o que,
 * se mudado "para simplificar", quebraria em produção sem aviso.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const wf = readFileSync(join(__dirname, "..", ".github/workflows/deploy.yml"), "utf-8");

describe("deploy.yml", () => {
  it("Node 22 pinado — o build no Node 18 falha saindo 0 e publicaria dist quebrado", () => {
    expect(wf).toContain('node-version: "22"');
  });

  it("testes ANTES do build, build ANTES do FTP — a ordem é o portão", () => {
    const teste = wf.indexOf("npm test");
    const build = wf.indexOf("npm run build");
    const ftp = wf.indexOf("FTP-Deploy-Action");
    expect(teste).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(teste);
    expect(ftp).toBeGreaterThan(build);
  });

  it("nunca clean-slate, nunca cancelar no meio, sempre FTPS", () => {
    /* clean-slate: true apagaria .htaccess, llms.txt e .private do servidor —
       arquivos que o CI não gerencia. cancel-in-progress: true deixaria o site
       metade novo, metade velho num push em sequência. */
    expect(wf).toContain("dangerous-clean-slate: false");
    expect(wf).not.toContain("dangerous-clean-slate: true");
    expect(wf).toContain("cancel-in-progress: false");
    expect(wf).toContain("protocol: ftps");
  });

  it("o alvo vem de variable (sem caminho de produção cravado) e o deploy é condicionado", () => {
    /* Cravar "./" aqui tornaria o PRIMEIRO run — o mais arriscado — um deploy
       direto na raiz. A variable começa em ./deploy-test/ e só vira "./" por
       decisão explícita no GitHub. */
    expect(wf).toContain("vars.FTP_SERVER_DIR");
    expect(wf).toContain("if: steps.gate.outputs.deploy == 'true'");
    // O que sobe é o dist/ construído, nunca a árvore do repositório.
    expect(wf).toContain("local-dir: ./dist/");
  });

  it("a guarda anti-build-vazio confere o dist antes do envio", () => {
    expect(wf).toContain("test -s dist/index.html");
    expect(wf).toContain('grep -q "assets/index-"');
  });
});
