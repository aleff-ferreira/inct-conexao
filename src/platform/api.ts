import { supabase } from "./supabaseClient";
import { DOC_MAX_BYTES, docMaxLabel } from "./validation";
import type {
  Application,
  ApplicationFile,
  ApplicationStatus,
  DocKind,
  Edital,
  Evaluation,
  EvaluationEvent,
  Profile,
  StaffAllowlistEntry,
} from "./types";

/** Camada de dados da plataforma. Toda a autorização real está nas políticas RLS. */

// ------------------------------------------------------------------ editais
export async function fetchEdital(slug: string): Promise<Edital | null> {
  const { data, error } = await supabase().from("editais").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Edital) ?? null;
}

export async function listEditais(): Promise<Edital[]> {
  const { data, error } = await supabase().from("editais").select("*").order("abre_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Edital[]) ?? [];
}

export function editalAberto(e: Edital, now: Date = new Date()): boolean {
  return e.status === "aberto" && now >= new Date(e.abre_em) && now <= new Date(e.fecha_em);
}

// -------------------------------------------------------------- inscrições
export async function myApplication(editalId: string, userId: string): Promise<Application | null> {
  const { data, error } = await supabase()
    .from("applications")
    .select("*")
    .eq("edital_id", editalId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Application) ?? null;
}

export type ApplicationDraft = Omit<
  Application,
  "id" | "protocolo" | "status" | "submitted_at" | "created_at"
>;

/** Cria (ou atualiza) a inscrição do candidato. O protocolo é gerado no banco. */
export async function saveApplication(draft: ApplicationDraft, existingId?: string): Promise<Application> {
  const sb = supabase();
  if (existingId) {
    // Edição até o fim do prazo NÃO altera submitted_at: o desempate do
    // ranking usa a data da primeira submissão — corrigir a inscrição não
    // pode rebaixar o candidato no critério de antiguidade.
    const { data, error } = await sb
      .from("applications")
      .update({ ...draft })
      .eq("id", existingId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Application;
  }
  // O protocolo é gerado no servidor (trigger BEFORE INSERT, contador atômico
  // por edital — migração 003). Não o compomos no cliente: isso evita a corrida
  // de count(*)+1 que duplicava protocolos sob submissões simultâneas.
  const { data, error } = await sb
    .from("applications")
    .insert({ ...draft, status: "recebida", submitted_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Application;
}

// ---------------------------------------------------------------- arquivos
export async function uploadDocument(
  userId: string,
  editalSlug: string,
  applicationId: string,
  kind: DocKind,
  file: File,
): Promise<ApplicationFile> {
  if (file.type !== "application/pdf") throw new Error("Envie o documento em PDF.");
  const maxBytes = DOC_MAX_BYTES[kind] ?? 1024 * 1024;
  if (file.size > maxBytes) throw new Error(`O PDF deve ter no máximo ${docMaxLabel(kind)}.`);

  const sb = supabase();
  const path = `${userId}/${editalSlug}/${kind}.pdf`;
  const { error: upErr } = await sb.storage.from("inscricoes").upload(path, file, { upsert: true });
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await sb
    .from("application_files")
    .upsert(
      { application_id: applicationId, kind, storage_path: path, file_name: file.name, file_size: file.size },
      { onConflict: "application_id,kind" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ApplicationFile;
}

export async function listFiles(applicationId: string): Promise<ApplicationFile[]> {
  const { data, error } = await supabase()
    .from("application_files")
    .select("*")
    .eq("application_id", applicationId);
  if (error) throw new Error(error.message);
  return (data as ApplicationFile[]) ?? [];
}

/** URL assinada (temporária) para a comissão visualizar um PDF sem download público. */
export async function signedUrl(path: string, expiresSeconds = 3600): Promise<string> {
  const { data, error } = await supabase().storage.from("inscricoes").createSignedUrl(path, expiresSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// ------------------------------------------------------------------ gestão
export async function listApplications(editalId: string): Promise<Application[]> {
  const { data, error } = await supabase()
    .from("applications")
    .select("*")
    .eq("edital_id", editalId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Application[]) ?? [];
}

export async function listEvaluations(editalId: string): Promise<Evaluation[]> {
  const { data, error } = await supabase()
    .from("evaluations")
    .select("*, applications!inner(edital_id)")
    .eq("applications.edital_id", editalId);
  if (error) throw new Error(error.message);
  return (data as unknown as Evaluation[]) ?? [];
}

export async function upsertEvaluation(
  ev: Omit<Evaluation, "id"> & { id?: string },
): Promise<Evaluation> {
  const { data, error } = await supabase()
    .from("evaluations")
    .upsert(
      {
        application_id: ev.application_id,
        evaluator_id: ev.evaluator_id,
        scores: ev.scores,
        total: ev.total,
        bonus_pct: ev.bonus_pct,
        final_score: ev.final_score,
        parecer: ev.parecer,
        submitted: ev.submitted,
      },
      { onConflict: "application_id,evaluator_id" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Evaluation;
}

export async function setApplicationStatus(id: string, status: ApplicationStatus): Promise<void> {
  const { error } = await supabase().from("applications").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setEditalStatus(id: string, status: Edital["status"]): Promise<void> {
  const { error } = await supabase().from("editais").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listStaff(): Promise<Profile[]> {
  const { data, error } = await supabase()
    .from("profiles")
    .select("*")
    .in("role", ["admin", "avaliador"]);
  if (error) throw new Error(error.message);
  return (data as Profile[]) ?? [];
}

/** Todos os perfis (RLS: apenas admin enxerga além do próprio). */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase().from("profiles").select("*").order("email");
  if (error) throw new Error(error.message);
  return (data as Profile[]) ?? [];
}

/** Define o papel de um perfil (RLS: apenas admin). */
export async function setProfileRole(id: string, role: Profile["role"]): Promise<void> {
  const { error } = await supabase().from("profiles").update({ role }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------- allowlist da comissão ---
export async function listAllowlist(): Promise<StaffAllowlistEntry[]> {
  const { data, error } = await supabase().from("staff_allowlist").select("*").order("email");
  if (error) throw new Error(error.message);
  return (data as StaffAllowlistEntry[]) ?? [];
}

/**
 * Pré-autoriza e-mails da comissão (contas novas nascem com o papel dado) e
 * PROMOVE retroativamente quem já tem conta como candidato.
 * Retorna quantos perfis existentes foram promovidos.
 */
export async function addToAllowlist(emails: string[], role: StaffAllowlistEntry["role"]): Promise<number> {
  if (!emails.length) return 0;
  const sb = supabase();
  const rows = emails.map((email) => ({ email, role }));
  const { error } = await sb.from("staff_allowlist").upsert(rows, { onConflict: "email" });
  if (error) throw new Error(error.message);
  const { data, error: pErr } = await sb
    .from("profiles")
    .update({ role })
    .in("email", emails)
    .eq("role", "candidato")
    .select("id");
  if (pErr) throw new Error(pErr.message);
  return data?.length ?? 0;
}

/** Remove um e-mail da lista (não rebaixa quem já criou conta — use a tabela de papéis). */
export async function removeFromAllowlist(email: string): Promise<void> {
  const { error } = await supabase().from("staff_allowlist").delete().eq("email", email);
  if (error) throw new Error(error.message);
}

// ------------------------------------------ auditoria (log append-only) ----
/**
 * Log append-only de todas as gravações de avaliação de um edital (para a
 * auditoria de justiça). RLS: apenas admin. Ordenado por tempo.
 */
export async function listEvaluationEvents(editalId: string): Promise<EvaluationEvent[]> {
  const { data, error } = await supabase()
    .from("evaluation_events")
    .select("*, applications!inner(edital_id)")
    .eq("applications.edital_id", editalId)
    .order("at", { ascending: true });
  if (error) throw new Error(error.message);
  // Descarta o objeto aninhado applications:{edital_id} usado só no filtro.
  return ((data as unknown as Array<EvaluationEvent & { applications?: unknown }>) ?? []).map(
    ({ applications: _drop, ...ev }) => ev,
  );
}

/** Exporta o ranking como CSV (para a ata da comissão). */
export function toCsv(rows: Array<Record<string, string | number | null>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    // Neutraliza injeção de fórmula em planilha (CSV injection): uma célula que
    // COMEÇA com = + - @ (ou TAB/CR) é EXECUTADA pelo Excel/LibreOffice. Vários
    // desses campos vêm de formulário público (nome, instituição, comentários),
    // então um `=HYPERLINK(...)` viajaria para a máquina de quem abre a planilha.
    // O apóstrofo força a célula a virar texto. Só em STRING: um `number` é dado
    // numérico legítimo (inclusive negativo) e nunca é vetor de fórmula.
    const g = typeof v === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",;\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g;
  };
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}
