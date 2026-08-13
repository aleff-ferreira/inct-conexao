/**
 * ============================================================================
 *  ESTADO HONESTO — auditoria de 13/08/2026 ("vazio-por-falha não pode
 *  parecer vazio-de-verdade")
 * ============================================================================
 *  Testes de FONTE (readFileSync): leem os arquivos do relato e TRAVAM os
 *  consertos graves da auditoria, para que um refactor não os desfaça em
 *  silêncio. Cada bloco nomeia o defeito que voltaria se o teste quebrasse.
 * ============================================================================
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..");
const meuAno = readFileSync(join(RAIZ, "src", "relato", "MeuAno.tsx"), "utf-8");
const meuLab = readFileSync(join(RAIZ, "src", "relato", "MeuLaboratorio.tsx"), "utf-8");
const busca = readFileSync(join(RAIZ, "src", "relato", "BuscaPesquisador.tsx"), "utf-8");

describe("Q20 (BlocoObjetivos) nunca some em silêncio", () => {
  it("não existe mais o 'if (falha) return null' que engolia a pergunta", () => {
    expect(meuAno).not.toMatch(/if \(falha\) return null/);
  });

  it("a falha do chunk vira aviso com 'Tentar de novo'", () => {
    expect(meuAno).toContain("Não conseguimos carregar os objetivos da proposta agora");
    // O botão de retry incrementa a tentativa, que entra na chave do efeito.
    expect(meuAno).toMatch(/setTentativa\(\(n\) => n \+ 1\)/);
    expect(meuAno).toMatch(/\[chaveEets, tentativa\]/);
  });

  it("membro com laboratório fora da lista ativa vê aviso, não a Q20 sumida", () => {
    expect(meuAno).toContain("Seu laboratório não está na lista ativa deste ciclo");
  });
});

describe("falha de cicloAberto não vira 'a coleta ainda não começou'", () => {
  it("o catch grava a falha em falhaDeCarga em vez de só setCiclo(null)", () => {
    const inicio = meuAno.indexOf("cicloAberto()");
    expect(inicio).toBeGreaterThan(-1);
    const trecho = meuAno.slice(inicio, inicio + 900);
    expect(trecho).toContain("setFalhaDeCarga(erroDeRelato(e))");
  });

  it("a guarda de falhaDeCarga rende ANTES da afirmação de 'sem ciclo'", () => {
    const posFalha = meuAno.indexOf("if (falhaDeCarga)");
    const posSemCiclo = meuAno.indexOf("A coleta ainda não começou");
    expect(posFalha).toBeGreaterThan(-1);
    expect(posSemCiclo).toBeGreaterThan(-1);
    expect(posFalha).toBeLessThan(posSemCiclo);
  });
});

describe("participação nas atividades (Tela 3) fala quando a gravação falha", () => {
  it("alternarAdesao tem try/catch que alimenta um estado de erro visível", () => {
    const inicio = meuAno.indexOf("const alternarAdesao");
    const corpo = meuAno.slice(inicio, inicio + 900);
    expect(corpo).toContain("try {");
    expect(corpo).toContain("setErroAdesao(erroDeRelato(e))");
  });

  it("o erro de adesão é renderizado na Tela 3", () => {
    expect(meuAno).toMatch(/\{erroAdesao \? <p className="plat-error rel-erro">\{erroAdesao\}<\/p> : null\}/);
  });

  it("o documento da pesquisa é OBRIGATÓRIO no envio e mora na Tela 2 (decisão do dono, 13/08)", () => {
    // O portão em enviar(): sem comprovante, o envio para com a mensagem.
    expect(meuAno).toMatch(/arquivos\.some\(\(a\) => a\.uso === "comprovante"\)/);
    expect(meuAno).toContain("ele é obrigatório. Anexe na tela 2");
    // O upload vive na Tela 2 (AnexoDocumento) e a revisão só mostra o STATUS.
    expect(meuAno).toContain("function AnexoDocumento");
    expect(meuAno).toContain("function StatusDocumento");
    expect(meuAno).not.toContain("AnexoRelatorio");
    // O selo é "obrigatório", não "(opcional)".
    expect(meuAno).toMatch(/Documento com dados da sua pesquisa <span className="rel-obrigatorio">/);
  });

  it("a seção de contar atividades é SEMPRE visível — sem estado de recolhimento (decisão do dono, 13/08)", () => {
    // O estado abrirProposta foi eliminado: não existe botão que esconda o
    // seletor de tipo, e o rótulo antigo "Contar uma ou mais atividades" sumiu.
    expect(meuAno).not.toContain("abrirProposta");
    expect(meuAno).not.toContain("Contar uma ou mais atividades");
    expect(meuAno).toContain("Contar atividades ao(à) líder do laboratório");
  });
});

describe("Tela 4 (fomento): o R$ de um item removido não vaza para o vizinho", () => {
  it("as listas de fomento não usam mais key={i}", () => {
    expect(meuAno).not.toMatch(/<div key=\{i\}/);
    expect(meuAno).toContain("uidsProjetos.current[i]");
    expect(meuAno).toContain("uidsComplementares.current[i]");
  });

  it("CampoValorBrl ressincroniza o texto local quando a prop muda por fora", () => {
    const inicio = meuAno.indexOf("function CampoValorBrl");
    const corpo = meuAno.slice(inicio, inicio + 1200);
    expect(corpo).toContain("ultimoValor");
    expect(corpo).toMatch(/useEffect\(/);
  });

  it("marcar 'Não' guarda a lista digitada para o 'Sim' restaurar", () => {
    expect(meuAno).toContain("projetosGuardados");
    expect(meuAno).toContain("complementaresGuardados");
  });
});

describe("contadores do CTC (L4) honram a promessa do rodapé de autosave", () => {
  it("há debounce de 800 ms chamando salvar quando sujo", () => {
    const inicio = meuLab.indexOf("function ContadoresDoForms");
    const corpo = meuLab.slice(inicio);
    expect(corpo).toMatch(/window\.setTimeout\([\s\S]{0,80}salvarRef\.current\(\);[\s\S]{0,40}800\)/);
  });

  it("desmontar com ajuste pendente grava na saída (a troca de tela era o gatilho da perda)", () => {
    const inicio = meuLab.indexOf("function ContadoresDoForms");
    const corpo = meuLab.slice(inicio);
    expect(corpo).toMatch(/if \(sujoRef\.current\) void salvarRef\.current\(\)/);
  });
});

describe("L4 Conferência: null não é zero", () => {
  it("as afirmações de vazio só saem para array [] de verdade", () => {
    expect(meuLab).toContain("carregandoContagens");
    expect(meuLab).toContain("Carregando as contagens…");
    expect(meuLab).toContain("Não conseguimos ler esta contagem agora");
  });
});

describe("identificação com sessão: sem loop mudo e sem cópia divergente", () => {
  it("o status 'indisponivel' vira aviso em vez de ricochete silencioso", () => {
    expect(busca).toContain('r.status === "indisponivel"');
    expect(busca).toContain("Não conseguimos completar o vínculo agora");
  });

  it("MeuAno importa a IdentificacaoComSessao compartilhada, sem duplicata local", () => {
    expect(busca).toMatch(/export function IdentificacaoComSessao/);
    expect(meuAno).not.toMatch(/function IdentificacaoComSessao/);
    expect(meuAno).toMatch(/IdentificacaoComSessao,?\n/);
  });
});
