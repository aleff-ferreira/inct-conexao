/**
 * ============================================================================
 *  Curso "Do átomo à ação biológica" — validação por passo
 * ============================================================================
 *  VALIDAÇÃO BLOQUEANTE POR PASSO, igual ao formulário do workshop
 *  (src/fitofarmas/validation.ts): sem sessão, quem avança com o passo pela
 *  metade só descobre no fim. Bloquear cedo custa um clique; bloquear tarde
 *  custa a inscrição inteira.
 *
 *  As regras de tamanho e o regex do e-mail são GÊMEOS dos CHECK da migração
 *  013 e da validação do servidor. Tela que aceita o que o banco recusa devolve
 *  erro genérico depois de tudo preenchido.
 * ============================================================================
 */
import { EXPERIENCIAS, SEMESTRES, VINCULOS } from "./conteudo";
import type { Experiencia, Inscricao, Semestre, TurmaC1, TurmaC2, Vinculo } from "./types";

export const LIMITES = {
  nomeMin: 3,
  nomeMax: 140,
  emailMax: 254,
  whatsappMin: 8,
  whatsappMax: 32,
  instituicaoMin: 2,
  instituicaoMax: 160,
  cursoAreaMin: 2,
  cursoAreaMax: 120,
  acessibilidadeMax: 600,
} as const;

/** Rótulo curto de cada campo, para os botões "Ir para …" da revisão. */
export const ROTULO_CAMPO: Readonly<Record<string, string>> = {
  turma_conteudo1: "o Conteúdo 1",
  turma_conteudo2: "o Conteúdo 2",
  nome: "o nome",
  email: "o e-mail",
  whatsapp: "o WhatsApp",
  instituicao: "a instituição",
  curso_area: "o curso ou área",
  vinculo: "o vínculo",
  semestre: "o semestre",
  experiencia: "a experiência",
  lgpd: "a autorização",
};

export type Pendencia = { readonly campo: string; readonly mensagem: string };

/** Mesma expressão do servidor (migração 013, seção 3). */
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

const conta = (s: string): number => Array.from(s.trim()).length;

const ehVinculo = (v: string): v is Vinculo => VINCULOS.some(([id]) => id === v);
const ehSemestre = (v: string): v is Semestre => SEMESTRES.some(([id]) => id === v);
const ehExperiencia = (v: string): v is Experiencia => EXPERIENCIAS.some(([id]) => id === v);
const ehTurma1 = (v: string): v is TurmaC1 => v === "c1_19ago" || v === "c1_20ago";
const ehTurma2 = (v: string): v is TurmaC2 => v === "c2_21ago_manha" || v === "c2_21ago_tarde";

/**
 * A primeira pendência do passo, ou `null`. A ORDEM importa: é a ordem em que os
 * campos aparecem na tela, para o foco cair no primeiro problema de cima.
 */
export function erroDoPasso(passo: number, f: Inscricao): Pendencia | null {
  const erro = (campo: string, mensagem: string): Pendencia => ({ campo, mensagem });

  if (passo === 1) {
    if (!ehTurma1(f.turma_conteudo1))
      return erro("turma_conteudo1", "Escolha um horário para o Conteúdo 1 (Estruturas 3D e IA).");
    if (!ehTurma2(f.turma_conteudo2))
      return erro("turma_conteudo2", "Escolha um horário para o Conteúdo 2 (Docking e ADMET).");
    return null;
  }

  if (passo === 2) {
    if (conta(f.nome) < LIMITES.nomeMin)
      return erro("nome", "Diga seu nome completo (pelo menos 3 letras).");
    const email = f.email.trim().toLowerCase();
    if (!email) return erro("email", "Precisamos do seu e-mail para confirmar a inscrição.");
    if (email.length > LIMITES.emailMax || !EMAIL_RE.test(email) || email.endsWith(".invalid"))
      return erro("email", "Confira o endereço: ele não parece um e-mail válido.");
    if (conta(f.whatsapp) < LIMITES.whatsappMin)
      return erro("whatsapp", "Informe um WhatsApp com DDD. É por ele que a coordenação dá retorno.");
    if (conta(f.instituicao) < LIMITES.instituicaoMin)
      return erro("instituicao", "Diga a sua instituição (por exemplo, IFRO Campus Jaru).");
    if (conta(f.curso_area) < LIMITES.cursoAreaMin)
      return erro("curso_area", "Diga o seu curso ou área (por exemplo, Medicina Veterinária).");
    if (!ehVinculo(f.vinculo)) return erro("vinculo", "Escolha o que melhor descreve o seu vínculo.");
    if (!ehSemestre(f.semestre)) return erro("semestre", "Escolha o seu semestre (ou 'não se aplica').");
    return null;
  }

  if (passo === 3) {
    if (!ehExperiencia(f.experiencia))
      return erro("experiencia", "Escolha o seu nível de experiência. Não há resposta errada.");
    if (conta(f.acessibilidade) > LIMITES.acessibilidadeMax)
      return erro("acessibilidade", `Resuma em até ${LIMITES.acessibilidadeMax} caracteres.`);
    return null;
  }

  if (passo === 4) {
    if (!f.lgpd) return erro("lgpd", "Para concluir, é preciso autorizar o uso dos dados.");
    return null;
  }

  return null;
}

/** Toda pendência que ainda impede o envio, na ordem dos passos. */
export function pendenciasDe(f: Inscricao): Pendencia[] {
  const out: Pendencia[] = [];
  for (const passo of [1, 2, 3, 4]) {
    const p = erroDoPasso(passo, f);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Normaliza antes de enviar: e-mail em minúsculas, tudo aparado. O banco faz o
 * `btrim`/`lower` de novo (cliente nenhum é autoridade), mas normalizar aqui
 * evita que um espaço colado de um PDF vire recusa depois de tudo preenchido.
 */
export function normalizarParaEnvio(f: Inscricao): Inscricao {
  return {
    ...f,
    nome: f.nome.trim(),
    email: f.email.trim().toLowerCase(),
    whatsapp: f.whatsapp.trim(),
    instituicao: f.instituicao.trim(),
    curso_area: f.curso_area.trim(),
    acessibilidade: f.acessibilidade.trim(),
  };
}
