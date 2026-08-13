/**
 * ============================================================================
 *  Curso "Do átomo à ação biológica" — tipos do formulário e do envio
 * ============================================================================
 *  Cada união abaixo é GÊMEA de um `check (… in (…))` da migração 013. A tela
 *  oferece o que o banco aceita, e vice-versa. Ao acrescentar uma opção, mude os
 *  dois — e a lista correspondente em `conteudo.ts`.
 * ============================================================================
 */

export type Vinculo =
  | "grad_vet"
  | "grad_agro"
  | "grad_outro"
  | "pos_graduando"
  | "docente"
  | "tecnico"
  | "outro";

export type Semestre =
  | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "concluido"
  | "nao_se_aplica";

export type Experiencia = "nenhuma" | "basica" | "intermediaria" | "avancada";

/** Conteúdo 1 — Estruturas 3D, visualização molecular e IA (19 ou 20/08). */
export type TurmaC1 = "c1_19ago" | "c1_20ago";
/** Conteúdo 2 — Docking, interpretação molecular e ADMET (21/08 manhã ou tarde). */
export type TurmaC2 = "c2_21ago_manha" | "c2_21ago_tarde";

/** O estado inteiro do formulário. Vai cru para o jsonb `respostas`. */
export type Inscricao = {
  nome: string;
  email: string;
  whatsapp: string;
  instituicao: string;
  curso_area: string;
  vinculo: Vinculo | "";
  semestre: Semestre | "";
  experiencia: Experiencia | "";
  turma_conteudo1: TurmaC1 | "";
  turma_conteudo2: TurmaC2 | "";
  acessibilidade: string;
  lgpd: boolean;
};

/**
 * Os desfechos possíveis do envio. `recebido` é sucesso (inscrição nova OU
 * corrigida — a RPC não distingue as duas de propósito). Os demais são recusa
 * com frase pronta. `indisponivel`/`falha` são de transporte, tratados no
 * cliente; os outros vêm do servidor.
 */
export type EstadoEnvio =
  | "recebido"
  | "fora_da_janela"
  | "email_invalido"
  | "dados_invalidos"
  | "turma_lotada"
  | "indisponivel"
  | "falha";

/**
 * Vagas por turma. `ocupacao` traz quantas inscrições cada turma já tem (turma
 * ausente = 0); `max` é o teto por turma (config, default 40). Vem da RPC pública
 * `curso_vagas` — só contagens agregadas, nenhum dado pessoal.
 */
export type Vagas = {
  readonly max: number;
  readonly ocupacao: Readonly<Record<string, number>>;
};

export type ResultadoEnvio = {
  readonly ok: boolean;
  readonly estado: EstadoEnvio;
  readonly protocolo: string | null;
  readonly mensagem: string;
  /** Campo a focar quando o servidor recusa um campo específico (hoje: email). */
  readonly campo?: string;
};

/** Uma linha da view `curso_inscritos`, como o painel da coordenação a recebe. */
export type InscritoPainel = {
  readonly id: string;
  readonly edicao: string;
  readonly protocolo: string | null;
  readonly nome: string;
  readonly email: string;
  readonly whatsapp: string;
  readonly instituicao: string;
  readonly curso_area: string;
  readonly vinculo: Vinculo;
  readonly semestre: Semestre;
  readonly experiencia: Experiencia;
  readonly turma_conteudo1: TurmaC1;
  readonly turma_conteudo2: TurmaC2;
  readonly acessibilidade: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};
