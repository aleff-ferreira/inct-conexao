/**
 * ============================================================================
 *  Rascunho local do formulário pré-evento
 * ============================================================================
 *  POR QUE localStorage AQUI, SE O RELATO ANUAL O PROÍBE
 *  -----------------------------------------------------
 *  `src/relato/MeuAno.tsx:371-374` diz, com todas as letras, que localStorage
 *  não é fonte de verdade. Está certo LÁ: aquele formulário tem sessão e grava
 *  rascunho no servidor, então guardar uma segunda cópia no navegador só criaria
 *  duas verdades e a chance de a errada vencer.
 *
 *  Aqui não existe sessão. O formulário é público, sem login, e a pessoa chega
 *  por QR code no corredor do IESPRO, com 4G ruim. Não há onde o servidor
 *  guardar meio formulário de alguém que ele não sabe quem é. Então ou o
 *  rascunho é local, ou não existe — e não existir significa que uma ligação
 *  recebida no meio do preenchimento apaga quatro minutos de respostas.
 *
 *  A INVERSÃO É DELIBERADA e vale só para este módulo.
 *
 *  O QUE NUNCA ENTRA NO RASCUNHO
 *  -----------------------------
 *  O consentimento LGPD. Autorização restaurada de um armazenamento que a
 *  pessoa não vê não é autorização: ela tem de marcar a caixa na sessão em que
 *  envia. `lerRascunho` força `lgpd: false` na volta, sempre.
 *
 *  DEGRADAÇÃO SILENCIOSA. Safari em navegação privada e cota cheia fazem
 *  `setItem` lançar. Seguir sem lembrar é degradação aceitável; derrubar o
 *  formulário por causa do rascunho não é. Todo acesso está em `try`.
 * ============================================================================
 */
import type { Respostas } from "./types";

/** Convenção do repo: `inct.<módulo>.<coisa>`. */
const CHAVE = "inct.fitofarmas.rascunho";

/**
 * Trinta dias. O evento é em 25 e 27/08/2026 e a janela de resposta é curta;
 * rascunho mais velho que isso é de outra intenção, não da mesma pessoa
 * continuando de onde parou.
 */
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

type Envelope = { readonly em: number; readonly dados: unknown };

export function salvarRascunho(dados: Respostas): void {
  try {
    const { lgpd: _ignorado, ...semConsentimento } = dados;
    const envelope: Envelope = { em: Date.now(), dados: semConsentimento };
    window.localStorage.setItem(CHAVE, JSON.stringify(envelope));
  } catch {
    /* navegação privada, cota cheia: seguir sem lembrar é aceitável */
  }
}

/**
 * Devolve o rascunho ou `null`. NUNCA lança e nunca devolve consentimento: o
 * `lgpd` volta sempre `false`, e o chamador funde sobre o estado inicial.
 */
export function lerRascunho(): Partial<Respostas> | null {
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (!cru) return null;
    const envelope = JSON.parse(cru) as Envelope;
    if (!envelope?.em || Date.now() - envelope.em > VALIDADE_MS) {
      esquecerRascunho();
      return null;
    }
    const dados = envelope.dados as Partial<Respostas> | null;
    if (!dados || typeof dados !== "object") return null;
    return { ...dados, lgpd: false };
  } catch {
    // JSON corrompido por uma versão anterior do formulário: esquecer é melhor
    // que restaurar metade e deixar a pessoa com um estado que não existe.
    esquecerRascunho();
    return null;
  }
}

export function esquecerRascunho(): void {
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    /* idem */
  }
}

/** Existe rascunho guardado? Usado só para decidir se o aviso aparece. */
export function temRascunho(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) !== null;
  } catch {
    return false;
  }
}
