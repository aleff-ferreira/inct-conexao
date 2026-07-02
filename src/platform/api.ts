import { supabase } from "./supabaseClient";
import type {
  Application,
  ApplicationFile,
  ApplicationStatus,
  DocKind,
  Edital,
  Evaluation,
  Profile,
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
    const { data, error } = await sb
      .from("applications")
      .update({ ...draft, submitted_at: new Date().toISOString() })
      .eq("id", existingId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Application;
  }
  const { data: proto, error: pErr } = await sb.rpc("next_protocolo", { p_edital: draft.edital_id });
  if (pErr) throw new Error(pErr.message);
  const { data, error } = await sb
    .from("applications")
    .insert({ ...draft, protocolo: proto as string, status: "recebida", submitted_at: new Date().toISOString() })
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
  if (file.size > 2 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 2 MB.");

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
export async function signedUrl(path: string, expiresSeconds = 900): Promise<string> {
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

/** Exporta o ranking como CSV (para a ata da comissão). */
export function toCsv(rows: Array<Record<string, string | number | null>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}
