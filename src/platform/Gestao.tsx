import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Atom,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  GraduationCap,
  KeyRound,
  Leaf,
  Loader2,
  Lock,
  LogOut,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  Video,
} from "lucide-react";
import { platformEnabled } from "./supabaseClient";
import { useAuth, type AuthState } from "./auth";
import {
  listApplications,
  listEditais,
  listEvaluations,
  listEvaluationEvents,
  listFiles,
  listProfiles,
  purgeApplication,
  setApplicationStatus,
  setEditalStatus,
  signedUrl,
  toCsv,
  upsertEvaluation,
} from "./api";
import { ApagarDefinitivo } from "../ui/ApagarDefinitivo";
import {
  aggregateFinal,
  bonusApplies,
  clampScores,
  finalScore,
  rankState,
  weightedTotal,
} from "./scoring";
import { buildAudit, downloadAuditFiles } from "./audit";
import AuthCard from "./AuthCard";
import PasswordCard from "./PasswordCard";
import type {
  Application,
  ApplicationFile,
  Edital,
  Evaluation,
  EvaluationEvent,
  Profile,
} from "./types";

type Tab = "visao" | "inscricoes" | "classificacao" | "auditoria";

/**
 * As áreas novas são carregadas sob demanda: quem entra para avaliar inscrições
 * não paga pelo código do Relatório Anual nem pelo painel do workshop (o
 * inverso também vale — cada chunk só desce quando a área é aberta).
 */
const PainelRelatorio = lazy(() => import("../relato/PainelRelatorio"));
const PainelFitofarmas = lazy(() => import("../fitofarmas/PainelFitofarmas"));
const PainelCurso = lazy(() => import("../curso/PainelCurso"));
const PainelContas = lazy(() => import("./PainelContas"));

/**
 * As ÁREAS da Gestão. "Processo Seletivo" é todo o portal da comissão de IC,
 * intacto; "Relatório Anual" é o painel da coordenação do ciclo; "Fitofarmas"
 * (2026-08) é a leitura das respostas do formulário pré-evento do workshop —
 * métricas, lista priorizada por escore e CSV; "Contas" (2026-08, migração
 * 012) é a Administração de Contas — gerência de acesso do site inteiro,
 * exclusiva de SuperAdministradores (a antiga aba Equipe morava dentro do
 * Processo Seletivo e era de admin; a RLS da 012 fecha o dado por baixo).
 *
 * A área escolhida persiste na URL (`#/gestao?area=relatorio`,
 * `#/gestao?area=fitofarmas`, `#/gestao?area=contas`) para link direto e para
 * sobreviver ao F5 — mesmo padrão de query na hash que o mapa usa
 * (src/mapa/url.ts), implementado localmente porque aqui é um único
 * parâmetro. Valor desconhecido cai na área padrão, nunca em erro.
 */
type Area = "selecao" | "relatorio" | "fitofarmas" | "curso" | "contas";

function areaDaHash(): Area {
  if (typeof window === "undefined") return "selecao";
  const query = window.location.hash.split("?").slice(1).join("?");
  const valor = new URLSearchParams(query).get("area");
  if (valor === "relatorio") return "relatorio";
  if (valor === "fitofarmas") return "fitofarmas";
  if (valor === "curso") return "curso";
  if (valor === "contas") return "contas";
  return "selecao";
}

/**
 * Grava com `replaceState` (não cria entrada no histórico nem dispara
 * hashchange — o App não re-roteia). Preserva outros parâmetros que um dia
 * existam na query.
 */
function gravarAreaNaHash(area: Area): void {
  const hash = window.location.hash.replace(/^#/, "");
  const [path] = hash.split("?");
  const q = new URLSearchParams(hash.split("?").slice(1).join("?"));
  if (area === "selecao") q.delete("area");
  else q.set("area", area);
  // `pn=` é a aba interna do painel do Relatório — estado DELE, não da Gestão.
  // Sem esta limpeza, sair do Relatório levaria um `pn=producao` órfão para a
  // URL das outras áreas (fitofármacos inclusive), e um link copiado de lá
  // mentiria sobre onde aponta.
  if (area !== "relatorio") q.delete("pn");
  const qs = q.toString();
  window.history.replaceState(null, "", `#${path}${qs ? `?${qs}` : ""}`);
}

/** Portal da comissão: dashboard, avaliação e classificação — dentro do site. */
export default function Gestao() {
  const auth = useAuth();
  const [editais, setEditais] = useState<Edital[] | null>(null);
  const [editalId, setEditalId] = useState<string>("");
  const [apps, setApps] = useState<Application[]>([]);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [events, setEvents] = useState<EvaluationEvent[]>([]);
  const [tab, setTab] = useState<Tab>("visao");
  const [area, setArea] = useState<Area>(() => areaDaHash());
  const [openApp, setOpenApp] = useState<Application | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Restaura o título anterior ao sair da rota — sem isto a aba continuava
    // dizendo "Gestão …" na home. Mesmo padrão de MeuAno e do MapaPage.
    const anterior = document.title;
    document.title =
      area === "relatorio"
        ? "Gestão · Relatório Anual | INCT-CONEXAO"
        : area === "fitofarmas"
          ? "Gestão · Workshop Fitofarmas | INCT-CONEXAO"
          : area === "curso"
            ? "Gestão · Curso Do átomo à ação biológica | INCT-CONEXAO"
            : area === "contas"
              ? "Gestão · Administração de Contas | INCT-CONEXAO"
              : "Gestão de Seleções | INCT-CONEXAO";
    return () => {
      document.title = anterior;
    };
  }, [area]);

  // Link para #/gestao?area=... clicado com a Gestão já montada: o App não
  // remonta a rota (é a mesma), então a área é resincronizada aqui. O
  // `replaceState` de gravarAreaNaHash não dispara hashchange — sem eco.
  useEffect(() => {
    const sync = () => setArea(areaDaHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const trocarArea = (proxima: Area) => {
    setArea(proxima);
    gravarAreaNaHash(proxima);
  };

  // Herança de papéis (espelha is_admin()/is_staff() da migração 012):
  // superadmin conta como admin em toda a UI, e soma a área de Contas.
  const isSuper = auth.profile?.role === "superadmin";
  const isAdmin = isSuper || auth.profile?.role === "admin";
  const isStaff = isAdmin || auth.profile?.role === "avaliador";

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
    // Auditoria (admin): perfis para casar avaliador→nome e o log append-only.
    // Falha graciosa para [] quando o usuário não é admin (RLS).
    if (isAdmin) {
      listProfiles().then(setProfiles).catch(() => setProfiles([]));
      listEvaluationEvents(editalId).then(setEvents).catch(() => setEvents([]));
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [editalId, isAdmin]);

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
      <Shell area={area}>
        <div className="plat-card plat-notice">
          <Lock size={20} aria-hidden="true" />
          <div>
            {/* Texto PÚBLICO: esta tela fica atrás de um item da navegação
                principal — nome de variável de ambiente e doc interna não são
                para o visitante (Inscricao.tsx já fazia certo). */}
            <strong>Área da equipe em preparação</strong>
            <p>
              O acesso à gestão de seleções será habilitado em breve. Se você faz parte da
              equipe do INCT-CONEXAO, fale com a coordenação do projeto.
            </p>
          </div>
        </div>
      </Shell>
    );
  }
  if (auth.loading) {
    return (
      <Shell area={area}>
        <div className="plat-loading">
          <Loader2 size={22} aria-hidden="true" /> Carregando…
        </div>
      </Shell>
    );
  }
  if (auth.recovery) {
    return (
      <Shell area={area} email={auth.session?.user.email} onSignOut={auth.signOut}>
        <PasswordCard title="Definir nova senha" cta="Salvar nova senha" onSubmit={auth.updatePassword} />
      </Shell>
    );
  }
  if (!auth.session) {
    return (
      <Shell area={area}>
        <AuthCard auth={auth} role="committee" />
      </Shell>
    );
  }
  if (!isStaff) {
    return (
      <Shell area={area} email={auth.session.user.email} onSignOut={auth.signOut}>
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
  if (showPw) {
    return (
      <Shell area={area} email={auth.session.user.email} onSignOut={auth.signOut}>
        <div className="plat-eval">
          <button className="plat-back plat-back-btn" onClick={() => setShowPw(false)}>
            <ArrowLeft size={15} aria-hidden="true" /> Voltar ao painel
          </button>
          <PasswordCard title="Trocar minha senha" cta="Salvar nova senha" onSubmit={auth.updatePassword} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell area={area} email={auth.session.user.email} onSignOut={auth.signOut} onChangePassword={() => setShowPw(true)}>
      {/* Seletor de ÁREA — um nível acima das abas. "Processo Seletivo" é todo
          o portal da comissão, exatamente como era; "Relatório Anual" é a área
          nova, em chunk próprio. */}
      {/* SEM "plat-tabs" junto: a regra genérica `.plat-tabs button` (fundo
          branco, borda) tem especificidade maior que `.plat-area-btn` e vencia
          o visual do seletor — o botão INATIVO ficava branco e elevado, mais
          protagonista que o ativo. O seletor de área tem linguagem própria. */}
      <nav className="plat-areas" aria-label="Área da gestão">
        <button
          className={area === "selecao" ? "plat-area-btn active" : "plat-area-btn"}
          onClick={() => trocarArea("selecao")}
        >
          <GraduationCap size={15} aria-hidden="true" /> Processo Seletivo
        </button>
        <button
          className={area === "relatorio" ? "plat-area-btn active" : "plat-area-btn"}
          onClick={() => trocarArea("relatorio")}
        >
          <ClipboardList size={15} aria-hidden="true" /> Relatório Anual
        </button>
        <button
          className={area === "fitofarmas" ? "plat-area-btn active" : "plat-area-btn"}
          onClick={() => trocarArea("fitofarmas")}
        >
          <Leaf size={15} aria-hidden="true" /> Fitofarmas
        </button>
        <button
          className={area === "curso" ? "plat-area-btn active" : "plat-area-btn"}
          onClick={() => trocarArea("curso")}
        >
          <Atom size={15} aria-hidden="true" /> Curso
        </button>
        {/* Só superadmin VÊ o botão; quem chegar por link direto sem o papel
            cai no aviso de acesso restrito (e a RLS da 012 não entrega dado). */}
        {isSuper ? (
          <button
            className={area === "contas" ? "plat-area-btn active" : "plat-area-btn"}
            onClick={() => trocarArea("contas")}
          >
            <UserCog size={15} aria-hidden="true" /> Contas
          </button>
        ) : null}
      </nav>

      {area === "relatorio" ? (
        <Suspense
          fallback={
            <div className="plat-loading">
              <Loader2 size={22} aria-hidden="true" /> Carregando o painel do Relatório Anual…
            </div>
          }
        >
          <PainelRelatorio email={auth.session.user.email} />
        </Suspense>
      ) : area === "fitofarmas" ? (
        <Suspense
          fallback={
            <div className="plat-loading">
              <Loader2 size={22} aria-hidden="true" /> Carregando o painel do workshop…
            </div>
          }
        >
          {/* `isAdmin` decide só a MENSAGEM: a permissão real é a RLS da 008,
              que devolve zero linhas (não erro) a quem não é admin — e uma
              tabela vazia sem explicação diria "ninguém respondeu" a quem não
              podia ver. */}
          <PainelFitofarmas isAdmin={isAdmin} isSuper={isSuper} />
        </Suspense>
      ) : area === "curso" ? (
        <Suspense
          fallback={
            <div className="plat-loading">
              <Loader2 size={22} aria-hidden="true" /> Carregando o painel do curso…
            </div>
          }
        >
          {/* `isAdmin` decide só a MENSAGEM: a permissão real é a RLS da 013,
              que devolve zero linhas (não erro) a quem não é admin. */}
          <PainelCurso isAdmin={isAdmin} isSuper={isSuper} />
        </Suspense>
      ) : area === "contas" ? (
        isSuper ? (
          <Suspense
            fallback={
              <div className="plat-loading">
                <Loader2 size={22} aria-hidden="true" /> Carregando a administração de contas…
              </div>
            }
          >
            <PainelContas myId={auth.session.user.id} />
          </Suspense>
        ) : (
          <div className="plat-card plat-notice">
            <Lock size={20} aria-hidden="true" />
            <div>
              <strong>Painel restrito</strong>
              <p>
                A Administração de Contas é exclusiva de contas com papel SuperAdministrador(a).
                Se você precisa de alteração de acesso, fale com a coordenação do projeto.
              </p>
            </div>
          </div>
        )
      ) : (
        <>
      <div className="plat-toolbar">
        <label>
          Processo seletivo
          <select value={editalId} onChange={(e) => setEditalId(e.target.value)}>
            {(editais ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.numero}: {e.titulo} ({e.status})
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
          {isAdmin ? (
            <button className={tab === "auditoria" ? "active" : ""} onClick={() => setTab("auditoria")}>
              <FileSearch size={15} aria-hidden="true" /> Auditoria
            </button>
          ) : null}
          {/* A antiga aba Equipe virou a área Contas (superadmin) — a gerência
              de contas é do site inteiro, não de um processo seletivo. */}
        </nav>
      </div>

      {!edital ? (
        <div className="plat-loading">
          <Loader2 size={22} aria-hidden="true" /> Carregando processo seletivo…
        </div>
      ) : openApp ? (
        <AvaliacaoView
          app={openApp}
          edital={edital}
          myId={auth.session.user.id}
          isSuper={isSuper}
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
      ) : tab === "auditoria" && isAdmin ? (
        <AuditoriaView edital={edital} apps={apps} evals={evals} profiles={profiles} events={events} />
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
        </>
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
        <Stat label="Candidatas (♀)" value={submitted.length ? `${Math.round((100 * women) / submitted.length)}%` : "n/d"} />
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
                    <td data-label="Nota final" className="num">{final ?? "n/d"}</td>
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
  isSuper,
  existing,
  onClose,
}: {
  app: Application;
  edital: Edital;
  myId: string;
  isSuper: boolean;
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
                {app.email} · {app.telefone || "n/d"}
              </dd>
            </div>
            <div>
              <dt>Acadêmico</dt>
              <dd>
                {app.curso}: {app.instituicao} · {app.periodo} período · CR {app.coeficiente || "n/d"}
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
                  {f.kind}: {f.file_name} <ExternalLink size={13} aria-hidden="true" />
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

          {/* Só superadmin VÊ a zona; a permissão real é a trava da RPC (015).
              Cai TUDO: avaliações da comissão, log de auditoria e os PDFs. */}
          {isSuper ? (
            <ApagarDefinitivo
              alvo={`a inscrição ${app.protocolo} (${app.nome})`}
              confirmacao={app.protocolo || app.email}
              detalhes="Somem também as avaliações da comissão, o log de auditoria e os PDFs enviados."
              aoApagar={() => purgeApplication(app.id)}
              aoApagada={onClose}
            />
          ) : null}
        </div>

        <div className="plat-card">
          <h3>Minha avaliação</h3>
          {criterios.map((c) => (
            <label key={c.key} className="plat-score">
              <span>
                {c.label} <small>(0 a {c.max})</small>
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
  // Inscrições válidas (não rascunho / não desclassificada) ainda sem nota.
  // Homologar com elas pendentes as deixaria presas sem status terminal — o
  // candidato nunca veria a decisão final. Trave até concluir as avaliações.
  const pendentes = ranked.flatMap(({ rows }) => rows).filter((r) => r.final === null).length;

  return (
    <>
      <div className="plat-rank-actions">
        <button className="button plat-ghost" onClick={exportCsv}>
          Exportar CSV (ata) <Download size={15} aria-hidden="true" />
        </button>
        {isAdmin ? (
          <button
            className="button primary"
            disabled={busy || edital.status === "homologado" || pendentes > 0}
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
      {isAdmin && pendentes > 0 && edital.status !== "homologado" ? (
        <p className="plat-hint plat-warn">
          {pendentes} {pendentes > 1 ? "inscrições ainda sem avaliação" : "inscrição ainda sem avaliação"}. Conclua
          todas as avaliações antes de homologar; do contrário, essas inscrições ficariam sem resultado final.
        </p>
      ) : null}
      {edital.config.regraGenero ? <p className="plat-hint">{edital.config.regraGenero} Ajustes automáticos aparecem marcados com ♀ e devem ser referendados pela comissão.</p> : null}
      {ranked.map(({ estado, rows }) =>
        rows.length ? (
          <div className="plat-card" key={estado.uf}>
            <h3>
              {estado.nome} ({estado.uf}): {estado.vagas} vaga{estado.vagas > 1 ? "s" : ""}
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
                      <td data-label="#" className="num">{r.position ?? "n/d"}</td>
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

// ----------------------------------------------------------------- auditoria --
function AuditoriaView({
  edital,
  apps,
  evals,
  profiles,
  events,
}: {
  edital: Edital;
  apps: Application[];
  evals: Evaluation[];
  profiles: Profile[];
  events: EvaluationEvent[];
}) {
  const audit = useMemo(
    () => buildAudit(apps, evals, profiles, edital, events),
    [apps, evals, profiles, edital, events],
  );
  const s = audit.summary;
  const flagged = [...audit.rows].filter((r) => r.flags.length).sort((a, b) => b.flags.length - a.flags.length);

  return (
    <div className="plat-eval">
      <div className="plat-card">
        <h3>
          <ShieldAlert size={18} aria-hidden="true" /> Auditoria de justiça das avaliações
        </h3>
        <p className="plat-hint">
          A avaliação é aberta (todo avaliador pontua qualquer inscrição). A integridade é verificada depois, aqui:
          baixe os dois arquivos e investigue. O <strong>JSON</strong>, pseudonimizado, reúne as métricas em formato
          próprio para análise. Sinais são <strong>pistas para revisão humana</strong>, nunca acusação.
        </p>
        {audit.rows.length === 0 ? (
          <p className="plat-empty">Nenhuma avaliação enviada ainda.</p>
        ) : (
          <>
            <div className="plat-stats">
              <Stat label="Avaliações enviadas" value={String(s.total_avaliacoes)} />
              <Stat label="Inscrições avaliadas" value={String(s.inscricoes_avaliadas)} />
              <Stat label="Decididas por 1 avaliador" value={`${s.pct_decididas_por_unico}%`} />
              <Stat label="Conflito (auto-avaliação)" value={String(s.n_coi)} />
              <Stat label="Outliers (≥3 avaliadores)" value={String(s.n_outliers)} />
              <Stat label="Nota extrema sem parecer" value={String(s.n_extrema_sem_parecer)} />
              <Stat label="Editadas após outra" value={String(s.n_editadas_apos_outra)} />
            </div>
            <div className="plat-rank-actions">
              <button className="button primary" onClick={() => downloadAuditFiles(audit, edital.slug)}>
                Baixar auditoria (CSV interno + JSON de análise) <Download size={15} aria-hidden="true" />
              </button>
            </div>
            <p className="plat-hint plat-warn">
              <strong>LGPD:</strong> o <em>CSV interno</em> contém nome, CPF e pareceres. É a ata da comissão:
              <strong> não compartilhe</strong>. O <em>JSON</em> é pseudonimizado (não anônimo): em estados de 1 vaga,
              estado + curso + sexo podem reidentificar um candidato; trate como dado pessoal e use só para auditoria.
              A ausência de sinais <strong>não é prova de justiça</strong>: {s.pct_decididas_por_unico}% das inscrições
              foram decididas por um único avaliador, sem segunda opinião.
            </p>
          </>
        )}
      </div>

      {flagged.length ? (
        <div className="plat-card">
          <h3>Sinais a revisar ({flagged.length})</h3>
          <div className="edital-table-wrap">
            <table className="edital-table">
              <thead>
                <tr>
                  <th>Inscrição</th>
                  <th>Avaliador(a)</th>
                  <th className="num">Nota</th>
                  <th className="num">Nº aval.</th>
                  <th>Sinais</th>
                </tr>
              </thead>
              <tbody>
                {flagged.slice(0, 50).map((r, i) => (
                  <tr key={`${r.cand_ref}-${r.aval_ref}-${i}`}>
                    <td data-label="Inscrição">{r.cand_ref} <small>({r.estado})</small></td>
                    <td data-label="Avaliador(a)">{r.aval_ref}</td>
                    <td data-label="Nota" className="num">{r.final_score}</td>
                    <td data-label="Nº aval." className="num">{r.n_avaliadores_inscricao}</td>
                    <td data-label="Sinais">{r.flags.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {flagged.length > 50 ? (
            <p className="plat-hint">Mostrando 50 de {flagged.length}. Baixe os arquivos para a lista completa.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// A antiga EquipeView vive agora em PainelContas.tsx (área Contas, superadmin).

// ------------------------------------------------------------------ shell --
function Shell({
  children,
  email,
  onSignOut,
  onChangePassword,
  area = "selecao",
}: {
  children: React.ReactNode;
  email?: string | undefined;
  onSignOut?: () => void;
  onChangePassword?: () => void;
  /** Muda só o cabeçalho: quem chega por #/gestao?area=relatorio lê o assunto certo já na porta. */
  area?: Area;
}) {
  const relatorio = area === "relatorio";
  const contas = area === "contas";
  return (
    <main className="plat-page" id="conteudo" tabIndex={-1}>
      <section className="section-band plat-band">
        <div className="section-inner plat-inner plat-inner--wide">
          <p className="eyebrow dark">
            {contas
              ? "Gestão · Contas e acessos INCT-CONEXAO"
              : relatorio
                ? "Gestão · Equipe INCT-CONEXAO"
                : "Gestão de seleções · Comissão INCT-CONEXAO"}
          </p>
          <h1>{contas ? "Administração de Contas" : relatorio ? "Relatório Anual" : "Avaliação de inscrições"}</h1>
          {email ? (
            <p className="plat-session">
              Conectado como <strong>{email}</strong>
              {onChangePassword ? (
                <button className="plat-signout" onClick={onChangePassword}>
                  <KeyRound size={14} aria-hidden="true" /> Trocar senha
                </button>
              ) : null}
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
