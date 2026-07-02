import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Send,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { platformEnabled } from "./supabaseClient";
import { useAuth } from "./auth";
import {
  listApplications,
  listEditais,
  listEvaluations,
  listFiles,
  setApplicationStatus,
  setEditalStatus,
  signedUrl,
  toCsv,
  upsertEvaluation,
} from "./api";
import {
  aggregateFinal,
  bonusApplies,
  clampScores,
  finalScore,
  rankState,
  weightedTotal,
} from "./scoring";
import type { Application, ApplicationFile, Edital, Evaluation } from "./types";

type Tab = "visao" | "inscricoes" | "classificacao";

/** Portal da comissão: dashboard, avaliação e classificação — dentro do site. */
export default function Gestao() {
  const auth = useAuth();
  const [editais, setEditais] = useState<Edital[] | null>(null);
  const [editalId, setEditalId] = useState<string>("");
  const [apps, setApps] = useState<Application[]>([]);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [tab, setTab] = useState<Tab>("visao");
  const [openApp, setOpenApp] = useState<Application | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Gestão de Seleções | INCT-CONEXAO";
  }, []);

  const isStaff = auth.profile?.role === "admin" || auth.profile?.role === "avaliador";
  const isAdmin = auth.profile?.role === "admin";

  useEffect(() => {
    if (!platformEnabled || !isStaff) return;
    listEditais().then((list) => {
      setEditais(list);
      if (list.length && !editalId) setEditalId(list.find((e) => e.status !== "arquivado")?.id ?? list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  const edital = useMemo(() => editais?.find((e) => e.id === editalId) ?? null, [editais, editalId]);

  const reload = () => {
    if (!editalId) return;
    listApplications(editalId).then(setApps);
    listEvaluations(editalId).then(setEvals);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [editalId]);

  // ------------------------------------------------------------- derived
  const finalsByApp = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const a of apps) map.set(a.id, aggregateFinal(evals.filter((e) => e.application_id === a.id)));
    return map;
  }, [apps, evals]);

  const scoresByApp = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const a of apps) {
      const done = evals.filter((e) => e.application_id === a.id && e.submitted);
      const merged: Record<string, number> = {};
      for (const ev of done) for (const [k, v] of Object.entries(ev.scores)) merged[k] = (merged[k] ?? 0) + Number(v) / done.length;
      map.set(a.id, merged);
    }
    return map;
  }, [apps, evals]);

  // ---------------------------------------------------------------- guards
  if (!platformEnabled) {
    return (
      <Shell>
        <div className="plat-card plat-notice">
          <Lock size={20} aria-hidden="true" />
          <div>
            <strong>Plataforma não configurada</strong>
            <p>Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY e refaça o build (ver docs/plataforma-selecoes.md).</p>
          </div>
        </div>
      </Shell>
    );
  }
  if (auth.loading) {
    return (
      <Shell>
        <div className="plat-loading">
          <Loader2 size={22} aria-hidden="true" /> Carregando…
        </div>
      </Shell>
    );
  }
  if (!auth.session) {
    return (
      <Shell>
        <div className="plat-card plat-login">
          <Mail size={22} aria-hidden="true" />
          <h2>Acesso da comissão</h2>
          <p>Entre com seu e-mail institucional cadastrado para avaliar as inscrições.</p>
          {auth.otpSentTo ? (
            <p className="plat-ok">
              <CheckCircle2 size={17} aria-hidden="true" /> Link enviado para <strong>{auth.otpSentTo}</strong>.
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
                placeholder="email@instituicao.br"
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
      </Shell>
    );
  }
  if (!isStaff) {
    return (
      <Shell email={auth.session.user.email} onSignOut={auth.signOut}>
        <div className="plat-card plat-notice">
          <Lock size={20} aria-hidden="true" />
          <div>
            <strong>Acesso restrito à comissão</strong>
            <p>
              Seu usuário ({auth.session.user.email}) não tem papel de avaliador/admin. Peça ao administrador para
              promover seu perfil (ver docs/plataforma-selecoes.md).
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  // ------------------------------------------------------------------ UI
  return (
    <Shell email={auth.session.user.email} onSignOut={auth.signOut}>
      <div className="plat-toolbar">
        <label>
          Edital
          <select value={editalId} onChange={(e) => setEditalId(e.target.value)}>
            {(editais ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.numero} — {e.titulo} ({e.status})
              </option>
            ))}
          </select>
        </label>
        <nav className="plat-tabs" aria-label="Seções da gestão">
          <button className={tab === "visao" ? "active" : ""} onClick={() => setTab("visao")}>
            <BarChart3 size={15} aria-hidden="true" /> Visão geral
          </button>
          <button className={tab === "inscricoes" ? "active" : ""} onClick={() => setTab("inscricoes")}>
            <Users size={15} aria-hidden="true" /> Inscrições ({apps.length})
          </button>
          <button className={tab === "classificacao" ? "active" : ""} onClick={() => setTab("classificacao")}>
            <ShieldCheck size={15} aria-hidden="true" /> Classificação
          </button>
        </nav>
      </div>

      {!edital ? (
        <div className="plat-loading">
          <Loader2 size={22} aria-hidden="true" /> Carregando edital…
        </div>
      ) : openApp ? (
        <AvaliacaoView
          app={openApp}
          edital={edital}
          myId={auth.session.user.id}
          existing={evals.find((e) => e.application_id === openApp.id && e.evaluator_id === auth.session!.user.id)}
          onClose={() => {
            setOpenApp(null);
            reload();
          }}
        />
      ) : tab === "visao" ? (
        <DashboardView edital={edital} apps={apps} evals={evals} finals={finalsByApp} />
      ) : tab === "inscricoes" ? (
        <ListaView apps={apps} evals={evals} finals={finalsByApp} myId={auth.session.user.id} onOpen={setOpenApp} />
      ) : (
        <RankingView
          edital={edital}
          apps={apps}
          finals={finalsByApp}
          scores={scoresByApp}
          isAdmin={isAdmin}
          busy={busy}
          onHomologar={async (aprovadas, espera) => {
            if (!isAdmin) return;
            setBusy(true);
            try {
              for (const id of aprovadas) await setApplicationStatus(id, "aprovada");
              for (const id of espera) await setApplicationStatus(id, "lista_espera");
              await setEditalStatus(edital.id, "homologado");
              setEditais((prev) => prev?.map((e) => (e.id === edital.id ? { ...e, status: "homologado" } : e)) ?? null);
              reload();
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </Shell>
  );
}

// ------------------------------------------------------------- dashboard --
function DashboardView({
  edital,
  apps,
  evals,
  finals,
}: {
  edital: Edital;
  apps: Application[];
  evals: Evaluation[];
  finals: Map<string, number | null>;
}) {
  const submitted = apps.filter((a) => a.status !== "rascunho");
  const women = submitted.filter((a) => a.sexo === "feminino").length;
  const evaluated = submitted.filter((a) => finals.get(a.id) !== null).length;
  const totalVagas = edital.config.estados.reduce((s, e) => s + e.vagas, 0);

  return (
    <>
      <div className="plat-stats">
        <Stat label="Inscrições" value={String(submitted.length)} />
        <Stat label="Vagas" value={String(totalVagas)} />
        <Stat label="Candidatas (♀)" value={submitted.length ? `${Math.round((100 * women) / submitted.length)}%` : "—"} />
        <Stat label="Avaliadas" value={`${evaluated}/${submitted.length}`} />
        <Stat label="Pareceres enviados" value={String(evals.filter((e) => e.submitted).length)} />
      </div>
      <div className="plat-card">
        <h3>Inscrições por estado × vagas</h3>
        <div className="edital-table-wrap">
          <table className="edital-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th className="num">Vagas</th>
                <th className="num">Inscrições</th>
                <th className="num">Candidatas</th>
                <th className="num">Avaliadas</th>
              </tr>
            </thead>
            <tbody>
              {edital.config.estados.map((e) => {
                const daqui = submitted.filter((a) => a.estado === e.uf);
                return (
                  <tr key={e.uf}>
                    <td data-label="Estado">
                      {e.nome} ({e.uf})
                    </td>
                    <td data-label="Vagas" className="num">{e.vagas}</td>
                    <td data-label="Inscrições" className="num">{daqui.length}</td>
                    <td data-label="Candidatas" className="num">{daqui.filter((a) => a.sexo === "feminino").length}</td>
                    <td data-label="Avaliadas" className="num">{daqui.filter((a) => finals.get(a.id) !== null).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="plat-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

// ------------------------------------------------------------------ lista --
function ListaView({
  apps,
  evals,
  finals,
  myId,
  onOpen,
}: {
  apps: Application[];
  evals: Evaluation[];
  finals: Map<string, number | null>;
  myId: string;
  onOpen: (a: Application) => void;
}) {
  const [uf, setUf] = useState("");
  const [q, setQ] = useState("");
  const ufs = [...new Set(apps.map((a) => a.estado))].sort();
  const rows = apps
    .filter((a) => a.status !== "rascunho")
    .filter((a) => !uf || a.estado === uf)
    .filter((a) => !q || `${a.nome} ${a.protocolo} ${a.orientador}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="plat-card">
      <div className="plat-filters">
        <input placeholder="Buscar por nome, protocolo, orientador…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={uf} onChange={(e) => setUf(e.target.value)}>
          <option value="">Todos os estados</option>
          {ufs.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <p className="plat-empty">Nenhuma inscrição {apps.length ? "com esse filtro" : "recebida ainda"}.</p>
      ) : (
        <div className="edital-table-wrap">
          <table className="edital-table plat-clickable">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Candidato(a)</th>
                <th>UF</th>
                <th>Orientador(a)</th>
                <th className="num">Nota final</th>
                <th>Minha avaliação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const mine = evals.find((e) => e.application_id === a.id && e.evaluator_id === myId);
                const final = finals.get(a.id);
                return (
                  <tr key={a.id} onClick={() => onOpen(a)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(a)}>
                    <td data-label="Protocolo">{a.protocolo}</td>
                    <td data-label="Candidato(a)">{a.nome}</td>
                    <td data-label="UF">{a.estado}</td>
                    <td data-label="Orientador(a)">{a.orientador}</td>
                    <td data-label="Nota final" className="num">{final ?? "—"}</td>
                    <td data-label="Minha avaliação">
                      {mine?.submitted ? (
                        <span className="plat-ok">
                          <CheckCircle2 size={14} aria-hidden="true" /> enviada ({mine.final_score})
                        </span>
                      ) : mine ? (
                        "rascunho"
                      ) : (
                        "pendente"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- avaliação --
function AvaliacaoView({
  app,
  edital,
  myId,
  existing,
  onClose,
}: {
  app: Application;
  edital: Edital;
  myId: string;
  existing: Evaluation | undefined;
  onClose: () => void;
}) {
  const criterios = edital.config.criterios;
  const [scores, setScores] = useState<Record<string, number>>(existing?.scores ?? {});
  const [parecer, setParecer] = useState(existing?.parecer ?? "");
  const [files, setFiles] = useState<ApplicationFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    listFiles(app.id).then(setFiles).catch(() => setFiles([]));
  }, [app.id]);

  const total = weightedTotal(scores, criterios);
  const bonus = bonusApplies(app, edital.config.bonus) ? edital.config.bonus!.percent : 0;
  const final = finalScore(total, bonus);

  const save = async (submitted: boolean) => {
    setSaving(true);
    setMsg("");
    try {
      await upsertEvaluation({
        application_id: app.id,
        evaluator_id: myId,
        scores: clampScores(scores, criterios),
        total,
        bonus_pct: bonus,
        final_score: final,
        parecer,
        submitted,
      });
      setMsg(submitted ? "Avaliação enviada." : "Rascunho salvo.");
      if (submitted) onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="plat-eval">
      <button className="plat-back plat-back-btn" onClick={onClose}>
        <ArrowLeft size={15} aria-hidden="true" /> Voltar para a lista
      </button>
      <div className="plat-eval-grid">
        <div className="plat-card">
          <h3>
            {app.nome} <small>({app.protocolo})</small>
          </h3>
          <dl className="plat-review">
            <div>
              <dt>Contato</dt>
              <dd>
                {app.email} · {app.telefone || "—"}
              </dd>
            </div>
            <div>
              <dt>Acadêmico</dt>
              <dd>
                {app.curso} — {app.instituicao} · {app.periodo} período · CR {app.coeficiente || "—"}
              </dd>
            </div>
            <div>
              <dt>Orientação</dt>
              <dd>
                {app.estado} · {app.orientador}
              </dd>
            </div>
            <div>
              <dt>Sexo</dt>
              <dd>{app.sexo}{bonus ? ` · bônus Ciência Delas +${bonus}%` : ""}</dd>
            </div>
          </dl>
          <h4>Documentos</h4>
          <ul className="plat-doclist">
            {files.map((f) => (
              <li key={f.id}>
                <FileText size={15} aria-hidden="true" />
                <button
                  className="plat-doclink"
                  onClick={async () => {
                    const url = await signedUrl(f.storage_path);
                    window.open(url, "_blank", "noopener");
                  }}
                >
                  {f.kind} — {f.file_name} <ExternalLink size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
            {files.length === 0 ? <li className="plat-empty">Nenhum arquivo recebido.</li> : null}
            {app.video_url ? (
              <li>
                <Video size={15} aria-hidden="true" />
                <a href={app.video_url} target="_blank" rel="noreferrer" className="plat-doclink">
                  Vídeo de apresentação <ExternalLink size={13} aria-hidden="true" />
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="plat-card">
          <h3>Minha avaliação</h3>
          {criterios.map((c) => (
            <label key={c.key} className="plat-score">
              <span>
                {c.label} <small>(0–{c.max})</small>
              </span>
              <input
                type="number"
                min={0}
                max={c.max}
                step={0.5}
                value={scores[c.key] ?? ""}
                onChange={(e) => setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))}
              />
            </label>
          ))}
          <p className="plat-totais">
            Total: <strong>{total}</strong>
            {bonus ? (
              <>
                {" "}
                · Bônus: +{bonus}% · Final: <strong>{final}</strong>
              </>
            ) : (
              <>
                {" "}
                · Final: <strong>{final}</strong>
              </>
            )}
          </p>
          <label className="plat-parecer">
            Parecer (opcional)
            <textarea rows={4} value={parecer} onChange={(e) => setParecer(e.target.value)} />
          </label>
          {msg ? <p className="plat-ok">{msg}</p> : null}
          <div className="plat-nav">
            <button className="button plat-ghost" onClick={() => save(false)} disabled={saving}>
              Salvar rascunho
            </button>
            <button className="button primary" onClick={() => save(true)} disabled={saving}>
              {saving ? "Salvando…" : "Enviar avaliação"} <Send size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ranking --
function RankingView({
  edital,
  apps,
  finals,
  scores,
  isAdmin,
  busy,
  onHomologar,
}: {
  edital: Edital;
  apps: Application[];
  finals: Map<string, number | null>;
  scores: Map<string, Record<string, number>>;
  isAdmin: boolean;
  busy: boolean;
  onHomologar: (aprovadas: string[], espera: string[]) => Promise<void>;
}) {
  const ranked = edital.config.estados.map((e) => ({
    estado: e,
    rows: rankState(apps.filter((a) => a.estado === e.uf), finals, edital.config.criterios, scores, e.vagas),
  }));

  const exportCsv = () => {
    const rows = ranked.flatMap(({ estado, rows }) =>
      rows.map((r) => ({
        estado: estado.uf,
        posicao: r.position,
        protocolo: r.app.protocolo,
        nome: r.app.nome,
        sexo: r.app.sexo,
        orientador: r.app.orientador,
        nota_final: r.final,
        dentro_das_vagas: r.withinQuota ? "sim" : "não",
        ajuste_genero: r.genderAdjusted ? "sim" : "",
        status: r.app.status,
      })),
    );
    const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `classificacao-${edital.slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const aprovadas = ranked.flatMap(({ rows }) => rows.filter((r) => r.withinQuota).map((r) => r.app.id));
  const espera = ranked.flatMap(({ rows }) => rows.filter((r) => !r.withinQuota && r.final !== null).map((r) => r.app.id));

  return (
    <>
      <div className="plat-rank-actions">
        <button className="button plat-ghost" onClick={exportCsv}>
          Exportar CSV (ata) <Download size={15} aria-hidden="true" />
        </button>
        {isAdmin ? (
          <button
            className="button primary"
            disabled={busy || edital.status === "homologado"}
            onClick={() => {
              if (window.confirm("Homologar o resultado? As inscrições dentro das vagas serão marcadas como APROVADAS e as demais avaliadas como LISTA DE ESPERA.")) {
                void onHomologar(aprovadas, espera);
              }
            }}
          >
            {edital.status === "homologado" ? "Resultado homologado" : busy ? "Homologando…" : "Homologar resultado"}
            <ShieldCheck size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {edital.config.regraGenero ? <p className="plat-hint">{edital.config.regraGenero} Ajustes automáticos aparecem marcados com ♀ e devem ser referendados pela comissão.</p> : null}
      {ranked.map(({ estado, rows }) =>
        rows.length ? (
          <div className="plat-card" key={estado.uf}>
            <h3>
              {estado.nome} ({estado.uf}) — {estado.vagas} vaga{estado.vagas > 1 ? "s" : ""}
            </h3>
            <div className="edital-table-wrap">
              <table className="edital-table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Candidato(a)</th>
                    <th className="num">Nota final</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.app.id} className={r.withinQuota ? "plat-row-aprovada" : ""}>
                      <td data-label="#" className="num">{r.position ?? "—"}</td>
                      <td data-label="Candidato(a)">
                        {r.app.nome} <small>({r.app.protocolo})</small>
                        {r.genderAdjusted ? <span title="Ajuste pela regra de gênero"> ♀</span> : null}
                      </td>
                      <td data-label="Nota final" className="num">{r.final ?? "aguardando avaliação"}</td>
                      <td data-label="Situação">{r.withinQuota ? "Dentro das vagas" : r.final === null ? "Sem nota" : "Lista de espera"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null,
      )}
    </>
  );
}

// ------------------------------------------------------------------ shell --
function Shell({
  children,
  email,
  onSignOut,
}: {
  children: React.ReactNode;
  email?: string | undefined;
  onSignOut?: () => void;
}) {
  return (
    <main className="plat-page" id="conteudo" tabIndex={-1}>
      <section className="section-band plat-band">
        <div className="section-inner plat-inner plat-inner--wide">
          <p className="eyebrow dark">Gestão de seleções · Comissão INCT-CONEXAO</p>
          <h1>Avaliação de inscrições</h1>
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
