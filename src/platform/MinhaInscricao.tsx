import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, LogOut, Mail, Send } from "lucide-react";
import { platformEnabled, supabase } from "./supabaseClient";
import { useAuth } from "./auth";
import type { Application, Edital } from "./types";

const STATUS_LABEL: Record<Application["status"], string> = {
  rascunho: "Rascunho",
  recebida: "Recebida",
  em_avaliacao: "Em avaliação",
  aprovada: "Aprovada 🎉",
  lista_espera: "Lista de espera",
  nao_aprovada: "Não aprovada",
  desclassificada: "Desclassificada",
};

/** Página do candidato: acompanha as próprias inscrições (todas as seleções). */
export default function MinhaInscricao() {
  const auth = useAuth();
  const [rows, setRows] = useState<Array<Application & { edital?: Edital }> | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    document.title = "Minha inscrição | INCT-CONEXAO";
  }, []);

  useEffect(() => {
    if (!platformEnabled || !auth.session) return;
    const sb = supabase();
    sb.from("applications")
      .select("*, edital:editais(*)")
      .eq("user_id", auth.session.user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as Array<Application & { edital?: Edital }>) ?? []));
  }, [auth.session]);

  return (
    <main className="plat-page" id="conteudo" tabIndex={-1}>
      <section className="section-band plat-band">
        <div className="section-inner plat-inner">
          <a className="plat-back" href="#/editais/selecao-ic-2026">
            <ArrowLeft size={15} aria-hidden="true" /> Processo seletivo
          </a>
          <p className="eyebrow dark">Área do candidato</p>
          <h1>Minha inscrição</h1>

          {!platformEnabled ? (
            <div className="plat-card plat-notice">
              <div>
                <strong>Sistema em preparação</strong>
                <p>As inscrições on-line ainda não foram habilitadas.</p>
              </div>
            </div>
          ) : auth.loading ? (
            <div className="plat-loading">
              <Loader2 size={22} aria-hidden="true" /> Carregando…
            </div>
          ) : !auth.session ? (
            <div className="plat-card plat-login">
              <Mail size={22} aria-hidden="true" />
              <h2>Entre com o e-mail usado na inscrição</h2>
              {auth.otpSentTo ? (
                <p className="plat-ok">
                  <CheckCircle2 size={17} aria-hidden="true" /> Link enviado para{" "}
                  <strong>{auth.otpSentTo}</strong>. Abra seu e-mail e clique no link.
                </p>
              ) : (
                <form
                  className="plat-inline-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const { error } = await auth.signIn(emailInput);
                    setErrorMsg(error ?? "");
                  }}
                >
                  <input
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    aria-label="Seu e-mail"
                  />
                  <button className="button primary" type="submit">
                    Receber link <Send size={16} aria-hidden="true" />
                  </button>
                </form>
              )}
              {errorMsg ? <p className="plat-error">{errorMsg}</p> : null}
            </div>
          ) : rows === null ? (
            <div className="plat-loading">
              <Loader2 size={22} aria-hidden="true" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="plat-card plat-notice">
              <div>
                <strong>Nenhuma inscrição encontrada para {auth.session.user.email}</strong>
                <p>
                  Se as inscrições estão abertas, <a href="#/inscricao/selecao-ic-2026">inscreva-se aqui</a>.
                </p>
              </div>
            </div>
          ) : (
            <div className="plat-list">
              {rows.map((r) => (
                <article key={r.id} className="plat-card plat-app-row">
                  <div>
                    <span className={`plat-status plat-status--${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    <h3>{r.edital?.titulo ?? "Seleção"}</h3>
                    <p>
                      Protocolo <strong>{r.protocolo}</strong> · {r.estado} · {r.orientador}
                    </p>
                  </div>
                  {r.edital ? (
                    <a className="button plat-ghost" href={`#/inscricao/${r.edital.slug}`}>
                      Ver / editar <ArrowRight size={15} aria-hidden="true" />
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}

          {auth.session ? (
            <p className="plat-session">
              Conectado como <strong>{auth.session.user.email}</strong>
              <button className="plat-signout" onClick={auth.signOut}>
                <LogOut size={14} aria-hidden="true" /> Sair
              </button>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
