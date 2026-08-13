import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarX2,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  LogOut,
  Mail,
  Send,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { platformEnabled } from "./supabaseClient";
import { useAuth } from "./auth";
import {
  editalAberto,
  fetchEdital,
  listFiles,
  myApplication,
  saveApplication,
  signedUrl,
  uploadDocument,
} from "./api";
import type { Application, ApplicationFile, DocKind, Edital, Sexo } from "./types";
import { DOC_MAX_BYTES, PERIODOS, docMaxLabel, formatCpf, isValidCpf, isValidVideoUrl } from "./validation";
import { friendlyError } from "./errors";
import AuthCard from "./AuthCard";
import PasswordCard from "./PasswordCard";

const EDITAL_HREF = "#/editais/selecao-ic-2026";

type FormState = {
  nome: string;
  cpf: string;
  telefone: string;
  sexo: Sexo;
  instituicao: string;
  curso: string;
  periodo: string;
  coeficiente: string;
  estado: string;
  orientador: string;
  video_url: string;
  lgpd: boolean;
};

const EMPTY: FormState = {
  nome: "",
  cpf: "",
  telefone: "",
  sexo: "nao_informar",
  instituicao: "",
  curso: "",
  periodo: "",
  coeficiente: "",
  estado: "",
  orientador: "",
  video_url: "",
  lgpd: false,
};

const STEPS = ["Identificação", "Dados acadêmicos", "Orientação", "Documentos", "Revisão"] as const;

export default function Inscricao({ slug }: { slug: string }) {
  const auth = useAuth();
  const [edital, setEdital] = useState<Edital | null | "loading">("loading");
  const [existing, setExisting] = useState<Application | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [existingFiles, setExistingFiles] = useState<ApplicationFile[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [docs, setDocs] = useState<Partial<Record<DocKind, File>>>({});
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState<Application | null>(null);

  useEffect(() => {
    document.title = "Inscrição: Seleção de Bolsistas IC/CNPq | INCT-CONEXAO";
  }, []);

  useEffect(() => {
    if (!platformEnabled) return;
    fetchEdital(slug)
      .then(setEdital)
      .catch(() => setEdital(null));
  }, [slug]);

  // Carrega inscrição existente (edição/consulta) quando logado.
  useEffect(() => {
    if (!platformEnabled || !auth.session || !edital || edital === "loading") return;
    setLoadFailed(false);
    myApplication(edital.id, auth.session.user.id).then((app) => {
      setExisting(app);
      if (app) {
        setForm({
          nome: app.nome,
          cpf: app.cpf,
          telefone: app.telefone,
          sexo: app.sexo,
          instituicao: app.instituicao,
          curso: app.curso,
          periodo: app.periodo,
          coeficiente: app.coeficiente,
          estado: app.estado,
          orientador: app.orientador,
          video_url: app.video_url,
          lgpd: app.lgpd_aceite,
        });
        listFiles(app.id).then(setExistingFiles).catch(() => setExistingFiles([]));
      }
    }).catch(() => {
      // Falha transitória ao carregar a inscrição: NÃO deixar cair no ramo de
      // criação (que geraria colisão UNIQUE se já existir). Bloqueia e pede recarregar.
      setLoadFailed(true);
    });
  }, [auth.session, edital]);

  const aberto = edital && edital !== "loading" ? editalAberto(edital) : false;
  const estados = edital && edital !== "loading" ? edital.config.estados : [];
  const documentos = edital && edital !== "loading" ? edital.config.documentos : [];
  const orientadores = useMemo(
    () => estados.find((e) => e.uf === form.estado)?.orientadores ?? [],
    [estados, form.estado],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const hasDoc = (kind: DocKind) => Boolean(docs[kind] || existingFiles.some((f) => f.kind === kind));

  const stepError = (): string => {
    switch (step) {
      case 0:
        if (form.nome.trim().length < 5) return "Informe seu nome completo.";
        if (!isValidCpf(form.cpf)) return "CPF inválido, confira os dígitos.";
        return "";
      case 1:
        if (!form.instituicao.trim()) return "Informe sua instituição.";
        if (!form.curso.trim()) return "Informe seu curso.";
        if (!form.periodo) return "Selecione o período (do 2º ao antepenúltimo).";
        return "";
      case 2:
        if (!form.estado) return "Selecione o estado.";
        if (!form.orientador) return "Selecione o(a) orientador(a) pretendido(a).";
        return "";
      case 3: {
        const missing = documentos.filter((d) => !hasDoc(d.kind));
        if (missing.length) return `Anexe: ${missing.map((m) => m.label.split(" (")[0]).join("; ")}.`;
        if (!isValidVideoUrl(form.video_url))
          return "Cole o link https do vídeo de apresentação (YouTube, Drive ou similar).";
        return "";
      }
      case 4:
        if (!form.lgpd) return "É preciso aceitar o termo de consentimento (LGPD) para enviar.";
        return "";
      default:
        return "";
    }
  };

  const next = () => {
    const err = stepError();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setErrorMsg("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    const err = stepError();
    if (err || !auth.session || !edital || edital === "loading") {
      setErrorMsg(err);
      return;
    }
    setSending(true);
    setErrorMsg("");
    try {
      const app = await saveApplication(
        {
          edital_id: edital.id,
          user_id: auth.session.user.id,
          nome: form.nome.trim(),
          cpf: formatCpf(form.cpf),
          email: auth.session.user.email ?? "",
          telefone: form.telefone.trim(),
          sexo: form.sexo,
          instituicao: form.instituicao.trim(),
          curso: form.curso.trim(),
          periodo: form.periodo,
          coeficiente: form.coeficiente.trim(),
          estado: form.estado,
          orientador: form.orientador,
          video_url: form.video_url.trim(),
          lgpd_aceite: form.lgpd,
        },
        existing?.id,
      );
      // A inscrição já existe no banco (protocolo emitido). Fixe-a no estado
      // ANTES dos uploads: se um upload falhar, o reenvio cai no ramo UPDATE em
      // vez de tentar um novo INSERT (que violaria o UNIQUE e deixaria a
      // inscrição órfã sem documentos).
      setExisting(app);
      for (const d of documentos) {
        const file = docs[d.kind];
        if (file) await uploadDocument(auth.session.user.id, edital.slug, app.id, d.kind, file);
      }
      setDone(app);
    } catch (e) {
      setErrorMsg(friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  // ---------------------------------------------------------------- guards
  if (!platformEnabled) {
    return (
      <Shell>
        <div className="plat-card plat-notice">
          <CalendarX2 size={22} aria-hidden="true" />
          <div>
            <strong>Sistema de inscrição em preparação</strong>
            <p>
              As inscrições on-line serão habilitadas em breve. Consulte o{" "}
              <a href={EDITAL_HREF}>processo seletivo</a> para o cronograma e os documentos exigidos.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (edital === "loading" || auth.loading) {
    return (
      <Shell>
        <div className="plat-loading">
          <Loader2 size={22} aria-hidden="true" /> Carregando…
        </div>
      </Shell>
    );
  }

  if (!edital) {
    return (
      <Shell>
        <div className="plat-card plat-notice">
          <CalendarX2 size={22} aria-hidden="true" />
          <div>
            <strong>Processo seletivo não encontrado</strong>
            <p>
              Verifique o endereço ou volte para a página de <a href={EDITAL_HREF}>oportunidades</a>.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  // Chegou por um link de redefinição de senha (sessão de recuperação): mostra
  // a tela de nova senha ANTES de qualquer outra coisa, para o candidato não
  // ficar preso (o link de reset volta para esta mesma página).
  if (auth.recovery) {
    return (
      <Shell titulo={edital.titulo} numero={edital.numero}>
        <PasswordCard title="Definir nova senha" cta="Salvar nova senha" onSubmit={auth.updatePassword} />
      </Shell>
    );
  }

  if (!aberto && !existing) {
    return (
      <Shell titulo={edital.titulo} numero={edital.numero}>
        <div className="plat-card plat-notice">
          <CalendarX2 size={22} aria-hidden="true" />
          <div>
            <strong>Inscrições fora do período</strong>
            <p>
              A janela de inscrição vai de {fmtData(edital.abre_em)} a {fmtData(edital.fecha_em)}. Consulte o{" "}
              <a href={EDITAL_HREF}>processo seletivo</a> para detalhes.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!auth.session) {
    return (
      <Shell titulo={edital.titulo} numero={edital.numero}>
        <AuthCard auth={auth} role="candidate" />
      </Shell>
    );
  }

  if (loadFailed) {
    return (
      <Shell titulo={edital.titulo} numero={edital.numero} onSignOut={auth.signOut} email={auth.session.user.email}>
        <div className="plat-card plat-notice">
          <CalendarX2 size={22} aria-hidden="true" />
          <div>
            <strong>Não foi possível carregar sua inscrição</strong>
            <p>
              Houve uma instabilidade momentânea. <a href="#/inscricao/selecao-ic-2026" onClick={() => location.reload()}>Recarregue a página</a> para continuar
              com segurança. Não crie uma nova inscrição, para evitar duplicidade.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell titulo={edital.titulo} numero={edital.numero}>
        <div className="plat-card plat-done no-print">
          <CheckCircle2 size={30} aria-hidden="true" />
          <h2>Inscrição {existing ? "atualizada" : "enviada"} com sucesso</h2>
          <p>
            Guarde seu comprovante abaixo: <strong>salve em PDF ou imprima</strong>. Ele confirma o envio da sua
            inscrição (protocolo <strong className="plat-protocolo">{done.protocolo}</strong>).
          </p>
          <div className="plat-nav plat-nav--start">
            <button className="button primary" onClick={() => window.print()}>
              Baixar / imprimir comprovante <Download size={16} aria-hidden="true" />
            </button>
            <a className="button plat-ghost" href="#/minha-inscricao">
              Acompanhar minha inscrição <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>

        <Comprovante app={done} edital={edital} documentos={documentos} />
      </Shell>
    );
  }

  // --------------------------------------------------------------- wizard
  return (
    <Shell titulo={edital.titulo} numero={edital.numero} onSignOut={auth.signOut} email={auth.session.user.email}>
      {existing && !aberto ? (
        <div className="plat-card plat-notice">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Inscrição recebida: protocolo {existing.protocolo}</strong>
            <p>O período de edição encerrou. Acompanhe o resultado pelo cronograma do processo seletivo.</p>
          </div>
        </div>
      ) : (
        <>
          {existing ? (
            <p className="plat-editing">
              Editando a inscrição <strong>{existing.protocolo}</strong> (permitido até {fmtData(edital.fecha_em)}).
            </p>
          ) : null}

          <ol className="plat-steps" aria-label="Etapas da inscrição">
            {STEPS.map((label, i) => (
              <li key={label} className={i === step ? "current" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>
                <span>{i + 1}</span> {label}
              </li>
            ))}
          </ol>

          <div className="plat-card">
            {step === 0 ? (
              <fieldset className="plat-fields">
                <legend>Identificação</legend>
                <label>
                  Nome completo
                  <input value={form.nome} onChange={(e) => set("nome", e.target.value)} autoComplete="name" />
                </label>
                <label>
                  CPF
                  <input
                    value={form.cpf}
                    onChange={(e) => set("cpf", formatCpf(e.target.value))}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                  />
                </label>
                <label>
                  Telefone/WhatsApp (opcional)
                  <input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} autoComplete="tel" />
                </label>
                <label>
                  Sexo
                  <select value={form.sexo} onChange={(e) => set("sexo", e.target.value as Sexo)}>
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                    <option value="outro">Outro</option>
                    <option value="nao_informar">Prefiro não informar</option>
                  </select>
                  <small>
                    Usado para a ação afirmativa “Ciência Delas” (bonificação de 10% para candidatas), conforme o
                    processo seletivo.
                  </small>
                </label>
              </fieldset>
            ) : null}

            {step === 1 ? (
              <fieldset className="plat-fields">
                <legend>Dados acadêmicos</legend>
                <label>
                  Instituição de ensino
                  <input
                    value={form.instituicao}
                    onChange={(e) => set("instituicao", e.target.value)}
                    placeholder="ex.: UNIR"
                  />
                </label>
                <label>
                  Curso de graduação
                  <input value={form.curso} onChange={(e) => set("curso", e.target.value)} />
                </label>
                <label>
                  Período atual
                  <select value={form.periodo} onChange={(e) => set("periodo", e.target.value)}>
                    <option value="">Selecione…</option>
                    {PERIODOS.map((p) => (
                      <option key={p} value={p}>
                        {p} período
                      </option>
                    ))}
                  </select>
                  <small>Elegível: do 2º ao antepenúltimo período do seu curso.</small>
                </label>
                <label>
                  Coeficiente de rendimento (CR/CRA)
                  <input
                    value={form.coeficiente}
                    onChange={(e) => set("coeficiente", e.target.value)}
                    placeholder="ex.: 8,75"
                  />
                </label>
              </fieldset>
            ) : null}

            {step === 2 ? (
              <fieldset className="plat-fields">
                <legend>Região e orientação</legend>
                <label>
                  Estado (região pretendida)
                  <select
                    value={form.estado}
                    onChange={(e) => {
                      set("estado", e.target.value);
                      set("orientador", "");
                    }}
                  >
                    <option value="">Selecione…</option>
                    {estados.map((e) => (
                      <option key={e.uf} value={e.uf}>
                        {e.nome} ({e.uf}): {e.vagas} vaga{e.vagas > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {form.estado ? (
                  <>
                    <p className="plat-inst">
                      Instituições: {estados.find((e) => e.uf === form.estado)?.instituicoes}
                    </p>
                    <label>
                      Orientador(a) pretendido(a)
                      <select value={form.orientador} onChange={(e) => set("orientador", e.target.value)}>
                        <option value="">Selecione…</option>
                        {orientadores.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : null}
              </fieldset>
            ) : null}

            {step === 3 ? (
              <fieldset className="plat-fields">
                <legend>Documentos (PDF) e vídeo</legend>
                {documentos.map((d) => {
                  const chosen = docs[d.kind];
                  const already = existingFiles.find((f) => f.kind === d.kind);
                  return (
                    <label key={d.kind} className="plat-file">
                      <span className="plat-file-label">
                        <FileText size={16} aria-hidden="true" /> {d.label} <small>(até {docMaxLabel(d.kind)})</small>
                      </span>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.type !== "application/pdf") {
                            setErrorMsg("Envie o documento em PDF.");
                            return;
                          }
                          if (file.size > (DOC_MAX_BYTES[d.kind] ?? 1024 * 1024)) {
                            setErrorMsg(
                              `O PDF de "${d.label.split(" (")[0]}" deve ter no máximo ${docMaxLabel(d.kind)}; comprima o arquivo (ex.: ilovepdf.com/compress_pdf) e tente de novo.`,
                            );
                            return;
                          }
                          setErrorMsg("");
                          setDocs((prev) => ({ ...prev, [d.kind]: file }));
                        }}
                      />
                      {chosen ? (
                        <small className="plat-ok">
                          <UploadCloud size={14} aria-hidden="true" /> {chosen.name} (
                          {(chosen.size / 1024).toFixed(0)} KB)
                        </small>
                      ) : already ? (
                        <small className="plat-ok">
                          <CheckCircle2 size={14} aria-hidden="true" /> Já enviado: {already.file_name}{" "}
                          <button
                            type="button"
                            className="plat-linkbtn"
                            onClick={async () => {
                              try {
                                const url = await signedUrl(already.storage_path, 300);
                                window.open(url, "_blank", "noopener");
                              } catch {
                                setErrorMsg("Não foi possível abrir o arquivo agora. Tente novamente.");
                              }
                            }}
                          >
                            ver o arquivo
                          </button>{" "}
                         · escolha um novo para substituir
                        </small>
                      ) : null}
                    </label>
                  );
                })}
                <label>
                  Link do vídeo de apresentação (1 a 3 min)
                  <input
                    value={form.video_url}
                    onChange={(e) => set("video_url", e.target.value)}
                    placeholder="https://…  (YouTube não listado, Google Drive etc.)"
                  />
                  <small>Garanta que o link esteja acessível para “qualquer pessoa com o link”.</small>
                </label>
              </fieldset>
            ) : null}

            {step === 4 ? (
              <div className="plat-fields">
                <h3>Revisão</h3>
                <dl className="plat-review">
                  <div>
                    <dt>Candidato(a)</dt>
                    <dd>
                      {form.nome} · CPF {form.cpf} · {auth.session.user.email}
                    </dd>
                  </div>
                  <div>
                    <dt>Acadêmico</dt>
                    <dd>
                      {form.curso}: {form.instituicao} · {form.periodo} período · CR {form.coeficiente || "n/d"}
                    </dd>
                  </div>
                  <div>
                    <dt>Orientação</dt>
                    <dd>
                      {estados.find((e) => e.uf === form.estado)?.nome} ({form.estado}) · {form.orientador}
                    </dd>
                  </div>
                  <div>
                    <dt>Documentos</dt>
                    <dd>
                      {documentos
                        .map((d) => `${d.label.split(" (")[0]}: ${docs[d.kind]?.name ?? existingFiles.find((f) => f.kind === d.kind)?.file_name ?? "n/d"}`)
                        .join(" · ")}
                    </dd>
                  </div>
                  <div>
                    <dt>Vídeo</dt>
                    <dd>{form.video_url}</dd>
                  </div>
                </dl>
                <label className="plat-consent">
                  <input type="checkbox" checked={form.lgpd} onChange={(e) => set("lgpd", e.target.checked)} />
                  <span>
                    Declaro que li o <a href={EDITAL_HREF}>processo seletivo</a> e <strong>autorizo o tratamento dos meus
                    dados pessoais</strong> (LGPD, Lei 13.709/2018) exclusivamente para este processo seletivo do
                    INCT-CONEXAO, pelo período necessário à sua conclusão.
                  </span>
                </label>
              </div>
            ) : null}

            {errorMsg ? <p className="plat-error">{errorMsg}</p> : null}

            <div className="plat-nav">
              {step > 0 ? (
                <button className="button plat-ghost" onClick={() => setStep((s) => s - 1)} disabled={sending}>
                  <ArrowLeft size={16} aria-hidden="true" /> Voltar
                </button>
              ) : (
                <span />
              )}
              {step < STEPS.length - 1 ? (
                <button className="button primary" onClick={next}>
                  Continuar <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <button className="button primary" onClick={submit} disabled={sending}>
                  {sending ? (
                    <>
                      Enviando… <Loader2 size={16} aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      {existing ? "Salvar alterações" : "Enviar inscrição"} <Send size={16} aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({
  children,
  titulo,
  numero,
  email,
  onSignOut,
}: {
  children: React.ReactNode;
  titulo?: string;
  numero?: string;
  email?: string | undefined;
  onSignOut?: () => void;
}) {
  return (
    <main className="plat-page" id="conteudo" tabIndex={-1}>
      <section className="section-band plat-band">
        <div className="section-inner plat-inner">
          <a className="plat-back" href={EDITAL_HREF}>
            <ArrowLeft size={15} aria-hidden="true" /> Processo seletivo
          </a>
          <p className="eyebrow dark">Inscrição on-line{numero ? ` · Processo Seletivo ${numero}` : ""}</p>
          <h1>{titulo ?? "Inscrição"}</h1>
          {email ? (
            <p className="plat-session">
              Conectado como <strong>{email}</strong>
              {onSignOut ? (
                <button className="plat-signout" onClick={onSignOut}>
                  <LogOut size={14} aria-hidden="true" /> Sair
                </button>
              ) : null}
            </p>
          ) : null}
          {children}
        </div>
      </section>
    </main>
  );
}

const assetPath = (fileName: string) => `${import.meta.env.BASE_URL}assets/${fileName}`;

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDataHora(iso: string | null): string {
  if (!iso) return "n/d";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Manaus",
  }) + " (horário de Manaus)";
}

/** Comprovante oficial de inscrição — impresso/salvo em PDF pelo candidato. */
function Comprovante({
  app,
  edital,
  documentos,
}: {
  app: Application;
  edital: Edital;
  documentos: { kind: DocKind; label: string }[];
}) {
  return (
    <div id="comprovante" className="comprovante">
      <div className="comprovante-head">
        <img className="comprovante-logo" src={assetPath("logo-symbol.png")} alt="" aria-hidden="true" />
        <div>
          <strong>INCT-CONEXAO</strong>
          <span>Processo Seletivo Simplificado Nº {edital.numero}</span>
        </div>
      </div>

      <h2 className="comprovante-title">Comprovante de Inscrição</h2>
      <p className="comprovante-proto">
        Protocolo <strong>{app.protocolo}</strong>
      </p>

      <dl className="comprovante-grid">
        <div><dt>Candidato(a)</dt><dd>{app.nome}</dd></div>
        <div><dt>CPF</dt><dd>{app.cpf}</dd></div>
        <div><dt>E-mail</dt><dd>{app.email}</dd></div>
        <div><dt>Instituição</dt><dd>{app.instituicao}</dd></div>
        <div><dt>Curso · período</dt><dd>{app.curso} · {app.periodo}</dd></div>
        <div><dt>Estado (UF)</dt><dd>{app.estado}</dd></div>
        <div><dt>Orientador(a) pretendido(a)</dt><dd>{app.orientador}</dd></div>
        <div><dt>Data e hora do envio</dt><dd>{fmtDataHora(app.submitted_at)}</dd></div>
        <div><dt>Seleção</dt><dd>{edital.titulo}</dd></div>
        <div><dt>Situação</dt><dd>Inscrição recebida</dd></div>
      </dl>

      <div className="comprovante-docs">
        <strong>Documentos anexados</strong>
        <ul>
          {documentos.map((d) => (
            <li key={d.kind}>
              <CheckCircle2 size={14} aria-hidden="true" /> {d.label.split(" (")[0]}
            </li>
          ))}
          {app.video_url ? (
            <li>
              <CheckCircle2 size={14} aria-hidden="true" /> Vídeo de apresentação
            </li>
          ) : null}
        </ul>
      </div>

      <p className="comprovante-foot">
        Guarde este comprovante. Ele confirma o recebimento da sua inscrição, mas não representa aprovação. A inscrição
        pode ser revisada com o mesmo e-mail até {fmtData(edital.fecha_em)}. O resultado será divulgado conforme o
        cronograma do processo seletivo.
      </p>
    </div>
  );
}
