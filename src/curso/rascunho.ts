/**
 * ============================================================================
 *  Rascunho local do formulário de inscrição do curso
 * ============================================================================
 *  MESMA INVERSÃO DELIBERADA DO WORKSHOP (src/fitofarmas/rascunho.ts): o relato
 *  anual proíbe localStorage porque tem sessão e grava rascunho no servidor.
 *  Aqui não há sessão — o formulário é público, sem login — então ou o rascunho
 *  é local, ou uma ligação recebida no meio do preenchimento apaga tudo.
 *
 *  O CONSENTIMENTO LGPD NUNCA ENTRA NO RASCUNHO. Autorização restaurada de um
 *  armazenamento que a pessoa não vê não é autorização: ela marca a caixa na
 *  sessão em que confirma. `lerRascunho` força `lgpd: false` na volta, sempre.
 *
 *  Todo acesso está em `try`: navegação privada e cota cheia fazem `setItem`
 *  lançar, e seguir sem lembrar é degradação aceitável; derrubar o formulário
 *  por causa do rascunho não é.
 * ============================================================================
 */
import type { Inscricao } from "./types";

/** Convenção do repo: `inct.<módulo>.<coisa>`. */
const CHAVE = "inct.curso.rascunho";

/** Trinta dias. O curso é em agosto/2026 e a janela é curta. */
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

type Envelope = { readonly em: number; readonly dados: unknown };

export function salvarRascunho(dados: Inscricao): void {
  try {
    const { lgpd: _ignorado, ...semConsentimento } = dados;
    const envelope: Envelope = { em: Date.now(), dados: semConsentimento };
    window.localStorage.setItem(CHAVE, JSON.stringify(envelope));
  } catch {
    /* navegação privada, cota cheia: seguir sem lembrar é aceitável */
  }
}

/** Devolve o rascunho ou `null`. NUNCA lança; `lgpd` volta sempre `false`. */
export function lerRascunho(): Partial<Inscricao> | null {
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (!cru) return null;
    const envelope = JSON.parse(cru) as Envelope;
    if (!envelope?.em || Date.now() - envelope.em > VALIDADE_MS) {
      esquecerRascunho();
      return null;
    }
    const dados = envelope.dados as Partial<Inscricao> | null;
    if (!dados || typeof dados !== "object") return null;
    return { ...dados, lgpd: false };
  } catch {
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
