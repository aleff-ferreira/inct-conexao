/** Tipos da Plataforma de Seleções (espelham supabase/migrations/001_platform.sql
 *  e 012_superadmin.sql). */

/**
 * 'superadmin' (012): herda tudo de 'admin' em todo o site e é o ÚNICO papel
 * que gere contas (allowlist + troca de papéis, painel Administração de Contas).
 */
export type Role = "superadmin" | "admin" | "avaliador" | "candidato";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

/** E-mail pré-autorizado da comissão: a conta nasce com este papel. */
export type StaffAllowlistEntry = {
  email: string;
  role: "superadmin" | "admin" | "avaliador";
  created_at?: string;
};

export type Criterio = {
  key: string;
  label: string;
  peso: number;
  max: number;
};

export type BonusRule = {
  label: string;
  percent: number;
  /** condição no formato "campo=valor" (ex.: "sexo=feminino") */
  aplicaSe: string;
};

export type DocumentoExigido = {
  kind: DocKind;
  label: string;
};

export type EstadoConfig = {
  uf: string;
  nome: string;
  vagas: number;
  instituicoes: string;
  orientadores: string[];
};

export type EditalConfig = {
  bolsa?: string;
  criterios: Criterio[];
  bonus?: BonusRule;
  regraGenero?: string;
  documentos: DocumentoExigido[];
  estados: EstadoConfig[];
};

export type EditalStatus = "rascunho" | "aberto" | "em_avaliacao" | "homologado" | "arquivado";

export type Edital = {
  id: string;
  slug: string;
  numero: string;
  titulo: string;
  status: EditalStatus;
  abre_em: string;
  fecha_em: string;
  config: EditalConfig;
};

export type Sexo = "feminino" | "masculino" | "outro" | "nao_informar";

export type ApplicationStatus =
  | "rascunho"
  | "recebida"
  | "em_avaliacao"
  | "aprovada"
  | "lista_espera"
  | "nao_aprovada"
  | "desclassificada";

export type Application = {
  id: string;
  edital_id: string;
  user_id: string;
  protocolo: string;
  status: ApplicationStatus;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  sexo: Sexo;
  instituicao: string;
  curso: string;
  periodo: string;
  coeficiente: string;
  estado: string;
  orientador: string;
  video_url: string;
  lgpd_aceite: boolean;
  submitted_at: string | null;
  created_at: string;
};

export type DocKind = "carta" | "plano" | "historico" | "lattes";

export type ApplicationFile = {
  id: string;
  application_id: string;
  kind: DocKind;
  storage_path: string;
  file_name: string;
  file_size: number;
};

export type Evaluation = {
  id: string;
  application_id: string;
  evaluator_id: string;
  scores: Record<string, number>;
  total: number;
  bonus_pct: number;
  final_score: number;
  parecer: string;
  submitted: boolean;
  created_at?: string;
  updated_at?: string;
};

/** Um evento do log append-only de avaliações (retenção para auditoria). */
export type EvaluationEvent = {
  id: string;
  application_id: string;
  evaluator_id: string;
  action: "insert" | "update";
  scores: Record<string, number>;
  total: number;
  bonus_pct: number;
  final_score: number;
  submitted: boolean;
  at: string;
};
