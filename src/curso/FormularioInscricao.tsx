/**
 * ============================================================================
 *  Curso "Do átomo à ação biológica" — formulário de inscrição
 * ============================================================================
 *  Embutido em CursoPage.tsx, na seção `#inscricao`. Público, sem login.
 *
 *  MESMAS QUATRO DECISÕES DO FORMULÁRIO DO WORKSHOP (src/fitofarmas):
 *   1. VALIDAÇÃO BLOQUEANTE POR PASSO — sem sessão, bloquear cedo custa um
 *      clique; bloquear tarde custa a inscrição inteira.
 *   2. RASCUNHO LOCAL — sem sessão, o servidor não tem onde guardar meia
 *      inscrição (ver rascunho.ts).
 *   3. NADA DE `throw` — todo desfecho previsto volta como `ResultadoEnvio`.
 *   4. ISCA + RELÓGIO — honeypot e tempo mínimo de 4 s, checados no servidor.
 *
 *  O PERCURSO É A ESTRELA. O passo 1 é "Monte seu percurso": a pessoa escolhe
 *  uma oferta de cada conteúdo e vê, o tempo todo, as duas sessões que montam as
 *  suas 7 horas — uma confirmação visual que reaparece na revisão e no recibo.
 *
 *  ACESSIBILIDADE — não perder numa edição futura:
 *   • O foco vai para o `<h2>` do passo a cada troca (menos na 1ª renderização).
 *   • O progresso é dito em MINUTOS, não em porcentagem.
 *   • Toda escolha é `<fieldset>/<legend>`; todo erro é texto, nunca só cor.
 *   • As sessões são rádios de verdade (navegação por setas de graça).
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Accessibility,
  CalendarClock,
  CheckCircle2,
  Clock,
  GraduationCap,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { movimentoReduzido } from "../figuras/movimento";
import { Area, Escolha, Selecao, Texto } from "../ui/campos";
import { carregarEdicao, carregarVagas, cursoDisponivel, enviarInscricao, type EdicaoCurso } from "./api";
import {
  EXPERIENCIAS,
  MODULOS,
  PASSOS,
  SEMESTRES,
  TEXTO,
  TURMAS_C1,
  TURMAS_C2,
  turmaPorId,
  VINCULOS,
  type Turma,
} from "./conteudo";
import { esquecerRascunho, lerRascunho, salvarRascunho } from "./rascunho";
import { erroDoPasso, LIMITES, normalizarParaEnvio, pendenciasDe, ROTULO_CAMPO, type Pendencia } from "./validation";
import type { Inscricao, ResultadoEnvio, TurmaC1, TurmaC2, Vagas } from "./types";

// ================================================== 1. ESTADO INICIAL ========

const VAZIO: Inscricao = {
  nome: "",
  email: "",
  whatsapp: "",
  instituicao: "",
  curso_area: "",
  vinculo: "",
  semestre: "",
  experiencia: "",
  turma_conteudo1: "",
  turma_conteudo2: "",
  acessibilidade: "",
  lgpd: false,
};

const DICA_DO_PASSO: Readonly<Record<number, string>> = {
  1: "Escolha um horário para cada conteúdo. Juntos, eles formam as suas 7 horas.",
  2: "Só o necessário para organizar a turma, emitir o certificado e dar retorno.",
  3: "Não há resposta certa. Isso ajuda a docência a calibrar o ritmo para você.",
  4: "Confira o seu percurso, autorize e confirme. Você recebe um protocolo na tela.",
};

/** Respeita "reduzir movimento": `behavior` em JS vence o CSS. */
function comportamentoDeRolagem(): ScrollBehavior {
  return movimentoReduzido() ? "auto" : "smooth";
}

/** A janela está aberta agora? `null` = "não deu para saber" (a RPC decide). */
function janelaAberta(e: EdicaoCurso | null): boolean | null {
  if (!e) return null;
  if (e.status !== "aberto") return false;
  const agora = Date.now();
  return agora >= Date.parse(e.abre_em) && agora <= Date.parse(e.fecha_em);
}

/** Leva o foco (e a rolagem) ao campo pendente, subindo até o 1º controle real. */
function focarCampo(campo: string): void {
  const direto = document.getElementById(campo);
  const caixa = document.getElementById(`campo-${campo}`);
  const controleDireto =
    direto instanceof HTMLInputElement ||
    direto instanceof HTMLSelectElement ||
    direto instanceof HTMLTextAreaElement
      ? direto
      : null;
  const primeiroDeDentro =
    caixa?.querySelector<HTMLElement>(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
    ) ?? null;
  const alvo = controleDireto ?? primeiroDeDentro;
  (caixa ?? direto ?? alvo)?.scrollIntoView({ block: "center", behavior: comportamentoDeRolagem() });
  alvo?.focus({ preventScroll: true });
}

// ================================================== 2. A SEÇÃO ===============

export default function FormularioInscricao() {
  const [f, setF] = useState<Inscricao>(VAZIO);
  const [passo, setPasso] = useState(1);
  const [erro, setErro] = useState<Pendencia | null>(null);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [recibo, setRecibo] = useState<ResultadoEnvio | null>(null);
  const [avisoRascunho, setAvisoRascunho] = useState(false);
  const [edicao, setEdicao] = useState<EdicaoCurso | null>(null);
  const [vagas, setVagas] = useState<Vagas | null>(null);
  const [isca, setIsca] = useState("");

  const abertoEm = useRef<number>(Date.now());
  const cabecaRef = useRef<HTMLHeadingElement>(null);
  const primeiraRenderizacao = useRef(true);
  const semeado = useRef(false);

  const ultimo = PASSOS[PASSOS.length - 1].id;
  const minutosRestantes = useMemo(
    () => PASSOS.filter((p) => p.id >= passo).reduce((s, p) => s + p.minutos, 0),
    [passo],
  );

  const set = <K extends keyof Inscricao>(chave: K, valor: Inscricao[K]): void => {
    setF((atual) => ({ ...atual, [chave]: valor }));
    if (erro) setErro(null);
    // Editar um campo resolve um erro do servidor (ex.: turma_lotada, e-mail): a
    // faixa vermelha some ao mexer, em vez de insistir até o próximo envio.
    if (recibo && !recibo.ok) setRecibo(null);
  };

  // ------------------------------------------------- rascunho: ler UMA vez
  useEffect(() => {
    if (semeado.current) return;
    semeado.current = true;
    const guardado = lerRascunho();
    if (guardado) {
      setF((atual) => ({ ...atual, ...guardado, lgpd: false }));
      setAvisoRascunho(true);
    }
  }, []);

  // ------------------------------------------------- rascunho: gravar (800ms)
  useEffect(() => {
    if (recibo?.ok) return;
    const id = window.setTimeout(() => salvarRascunho(f), 800);
    return () => window.clearTimeout(id);
  }, [f, recibo]);

  // ------------------------------------------------- a edição e as vagas
  useEffect(() => {
    let vivo = true;
    void carregarEdicao().then((e) => {
      if (vivo) setEdicao(e);
    });
    void carregarVagas().then((v) => {
      if (vivo && v) setVagas(v);
    });
    return () => {
      vivo = false;
    };
  }, []);

  /** Reconta as vagas (mostradas na tela). A autoridade é a RPC, no envio. */
  const recarregarVagas = (): void => {
    void carregarVagas().then((v) => {
      if (v) setVagas(v);
    });
  };

  // As vagas (`vagas`, passado ao SeletorTurma) são só para EXIBIR — a barra e o
  // rótulo — e para desabilitar a escolha de uma turma cheia que a pessoa AINDA
  // NÃO tem. NÃO bloqueiam avançar/enviar: `curso_vagas` conta a própria vaga de
  // quem já se inscreveu, então quem volta para corrigir a inscrição numa turma
  // cheia precisa passar. A RPC, sob trava, é a autoridade — só ela recusa
  // (`turma_lotada`) quem consome uma vaga NOVA, e a tela trata isso com jeito.

  // ------------------------------------------------- foco na troca de passo
  // Só `passo` na dependência: um envio que FALHA não deve rolar a página para
  // longe da mensagem de erro (mesma lição do formulário do workshop).
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    cabecaRef.current?.focus();
    cabecaRef.current?.scrollIntoView({ block: "start", behavior: comportamentoDeRolagem() });
  }, [passo]);

  // ---------------------------------------------------------------- navegação
  const avancar = (): void => {
    const problema = erroDoPasso(passo, f);
    if (problema) {
      setErro(problema);
      setTentou(true);
      focarCampo(problema.campo);
      return;
    }
    setErro(null);
    if (recibo && !recibo.ok) setRecibo(null);
    if (passo < ultimo) setPasso(passo + 1);
  };

  const voltar = (): void => {
    setErro(null);
    if (recibo && !recibo.ok) setRecibo(null);
    if (passo > 1) setPasso(passo - 1);
  };

  const enviar = async (): Promise<void> => {
    const faltando = pendenciasDe(f);
    if (faltando.length > 0) {
      setTentou(true);
      setErro(faltando[0]);
      const passoDoErro = [1, 2, 3, 4].find((id) => erroDoPasso(id, f)?.campo === faltando[0].campo);
      if (passoDoErro && passoDoErro !== passo) setPasso(passoDoErro);
      else focarCampo(faltando[0].campo);
      return;
    }

    setEnviando(true);
    const resultado = await enviarInscricao(normalizarParaEnvio(f), isca, Date.now() - abertoEm.current);
    setEnviando(false);
    setRecibo(resultado);

    if (resultado.ok) {
      esquecerRascunho();
      return;
    }
    // O servidor pode recusar o e-mail que a tela deixou passar (NBSP colado de
    // um PDF, p.ex.). Hoje o e-mail volta com `campo`, no passo 2.
    if (resultado.campo === "email") {
      if (passo !== 2) setPasso(2);
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => focarCampo("email")),
      );
    }
    // A turma lotou no servidor (autoridade final): limpa a turma cheia, reconta
    // as vagas, volta ao passo 1 e foca o seletor para a pessoa escolher a outra.
    if (resultado.estado === "turma_lotada") {
      if (resultado.campo === "turma_conteudo1") setF((a) => ({ ...a, turma_conteudo1: "" }));
      else if (resultado.campo === "turma_conteudo2") setF((a) => ({ ...a, turma_conteudo2: "" }));
      recarregarVagas();
      if (passo !== 1) setPasso(1);
      const alvo = resultado.campo;
      if (alvo) {
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => focarCampo(alvo)),
        );
      }
    }
  };

  const limparTudo = (): void => {
    esquecerRascunho();
    setF(VAZIO);
    setPasso(1);
    setAvisoRascunho(false);
    setTentou(false);
    setErro(null);
    cabecaRef.current?.focus();
  };

  // ------------------------------------------------------------- as guardas
  //  ORDEM (lição do formulário do workshop, FormularioPreEvento.tsx:401-406):
  //  o RECIBO vem ANTES da checagem de janela. `janelaAberta` relê `Date.now()`
  //  a cada render; sem esta ordem, quem confirma perto do `fecha_em` — e o
  //  relógio cruza o limite durante o ida-e-volta com o servidor — receberia a
  //  tela "inscrições encerradas" em vez do protocolo que o servidor já gravou.
  //  Quem fecha a janela de verdade é a RPC, no envio.
  if (!cursoDisponivel()) return <Indisponivel />;
  if (recibo?.ok) return <Recibo recibo={recibo} f={f} aoRecomecar={limparTudo} />;
  if (janelaAberta(edicao) === false) return <Encerrada edicao={edicao} />;

  const passoAtual = PASSOS.find((p) => p.id === passo) ?? PASSOS[0];
  const pendencias = tentou && passo === ultimo ? pendenciasDe(f) : [];

  return (
    <div className="rel-inner">
      <p className="rel-progresso">
        <span>
          Passo {passo} de {PASSOS.length}
        </span>
        <span>faltam ~{minutosRestantes} min</span>
        <progress value={passo} max={PASSOS.length} aria-label={`Passo ${passo} de ${PASSOS.length}`} />
      </p>

      <ol className="plat-steps">
        {PASSOS.map((p) => (
          <li
            key={p.id}
            className={p.id === passo ? "current" : p.id < passo ? "done" : ""}
            aria-current={p.id === passo ? "step" : undefined}
          >
            <span>{p.id}</span>
            {p.titulo}
          </li>
        ))}
      </ol>

      {avisoRascunho ? (
        <p className="plat-ok" role="status">
          <CheckCircle2 size={16} aria-hidden="true" /> Recuperamos o que você já tinha preenchido neste
          navegador. Confira antes de confirmar.
        </p>
      ) : null}

      {/* Confirmação visual do percurso — reaparece na revisão e no recibo. */}
      <PercursoResumo turma1={f.turma_conteudo1} turma2={f.turma_conteudo2} />

      <section className="rel-tela" aria-labelledby="curso-titulo-passo">
        <div className="rel-cabeca">
          <h2 id="curso-titulo-passo" ref={cabecaRef} tabIndex={-1}>
            {passoAtual.titulo}
          </h2>
          <p>{DICA_DO_PASSO[passo]}</p>
        </div>

        {passo === 1 ? <Passo1 f={f} set={set} erro={erro} vagas={vagas} /> : null}
        {passo === 2 ? <Passo2 f={f} set={set} erro={erro} /> : null}
        {passo === 3 ? <Passo3 f={f} set={set} erro={erro} /> : null}
        {passo === 4 ? <Passo4 f={f} set={set} erro={erro} /> : null}

        {/* A isca. Invisível para pessoa e leitor de tela, visível para robô. */}
        <div className="ff-isca" aria-hidden="true">
          <label htmlFor="curso-confirmacao">Não preencha este campo</label>
          <input
            id="curso-confirmacao"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={isca}
            onChange={(e) => setIsca(e.target.value)}
          />
        </div>

        {erro && passo !== ultimo ? (
          <p className="plat-error rel-erro" role="alert">
            <AlertTriangle size={16} aria-hidden="true" /> {erro.mensagem}
          </p>
        ) : null}

        {pendencias.length ? (
          <div className="rel-pendencias" role="alert">
            <strong>Falta isto para confirmar:</strong>
            <ul>
              {pendencias.map((p) => (
                <li key={p.campo}>{p.mensagem}</li>
              ))}
            </ul>
            {pendencias.map((p) => (
              <button
                key={`ir-${p.campo}`}
                type="button"
                onClick={() => {
                  const passoDoCampo = [1, 2, 3, 4].find((id) => erroDoPasso(id, f)?.campo === p.campo);
                  if (passoDoCampo) setPasso(passoDoCampo);
                  window.requestAnimationFrame(() =>
                    window.requestAnimationFrame(() => focarCampo(p.campo)),
                  );
                }}
              >
                Ir para {ROTULO_CAMPO[p.campo] ?? p.campo}
              </button>
            ))}
          </div>
        ) : null}

        {recibo && !recibo.ok ? (
          <p className="plat-error rel-erro" role="alert">
            <AlertTriangle size={16} aria-hidden="true" /> {recibo.mensagem}
          </p>
        ) : null}

        <div className="rel-nav plat-nav">
          {passo !== 1 ? (
            <button type="button" className="button plat-ghost" onClick={voltar} disabled={enviando}>
              <ArrowLeft size={15} aria-hidden="true" /> Voltar
            </button>
          ) : (
            <span />
          )}

          {passo === ultimo ? (
            <button type="button" className="button primary" onClick={() => void enviar()} disabled={enviando}>
              {enviando ? "Confirmando…" : TEXTO.ctaConfirmar} <Send size={15} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="button primary" onClick={avancar}>
              Continuar <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </section>

      <div className="rel-saida">
        <p className="rel-dica rel-dica--privacidade">{TEXTO.privacidade}</p>
        <button type="button" onClick={limparTudo}>
          <Trash2 size={15} aria-hidden="true" /> Limpar tudo neste navegador
        </button>
      </div>
    </div>
  );
}

// ================================================== 3. O PERCURSO (confirmação)

function ChipTurma({ turma, conteudo }: { turma: Turma | undefined; conteudo: 1 | 2 }) {
  const modulo = MODULOS[conteudo - 1];
  return (
    <div className={turma ? "curso-percurso-chip is-on" : "curso-percurso-chip"}>
      <span className="curso-percurso-num">{conteudo}</span>
      <span className="curso-percurso-txt">
        <strong>Conteúdo {conteudo}</strong>
        <small>{modulo.titulo}</small>
        <span className="curso-percurso-quando">
          {turma ? (
            <>
              <CalendarClock size={13} aria-hidden="true" /> {turma.diaRotulo} · {turma.inicio} às {turma.fim}
            </>
          ) : (
            "a escolher"
          )}
        </span>
      </span>
      {turma ? <CheckCircle2 className="curso-percurso-ok" size={18} aria-hidden="true" /> : null}
    </div>
  );
}

function PercursoResumo({ turma1, turma2 }: { turma1: TurmaC1 | ""; turma2: TurmaC2 | "" }) {
  const t1 = turma1 ? turmaPorId(turma1) : undefined;
  const t2 = turma2 ? turmaPorId(turma2) : undefined;
  const completo = Boolean(t1 && t2);
  return (
    <div className={completo ? "curso-percurso is-completo" : "curso-percurso"} aria-live="polite">
      <p className="curso-percurso-topo">
        <Sparkles size={15} aria-hidden="true" />
        <span>Seu percurso</span>
        <b>{completo ? "7 horas · completo ✓" : `${(t1 ? 1 : 0) + (t2 ? 1 : 0)} de 2 sessões`}</b>
      </p>
      <div className="curso-percurso-chips">
        <ChipTurma turma={t1} conteudo={1} />
        <ChipTurma turma={t2} conteudo={2} />
      </div>
    </div>
  );
}

// ================================================== 4. AVISOS ================

function Indisponivel() {
  return (
    <div className="plat-card plat-notice">
      <CalendarClock size={22} aria-hidden="true" />
      <div>
        <strong>As inscrições ainda não estão no ar</strong>
        <p>
          O curso {TEXTO.nome} acontece em {TEXTO.quando}, no {TEXTO.onde}. Guarde este endereço, que continua
          valendo, ou escreva para <a href={`mailto:${TEXTO.contato}`}>{TEXTO.contato}</a>.
        </p>
      </div>
    </div>
  );
}

function Encerrada({ edicao }: { edicao: EdicaoCurso | null }) {
  const encerrado = edicao?.status === "encerrado" || edicao?.status === "arquivado";
  return (
    <div className="plat-card plat-notice">
      <CalendarClock size={22} aria-hidden="true" />
      <div>
        <strong>{encerrado ? "As inscrições foram encerradas" : "As inscrições ainda não abriram"}</strong>
        <p>
          {encerrado
            ? "O período de inscrição deste curso já passou."
            : "As inscrições deste curso abrem em breve."}{" "}
          Para tirar dúvidas, escreva para <a href={`mailto:${TEXTO.contato}`}>{TEXTO.contato}</a>.
        </p>
      </div>
    </div>
  );
}

function Recibo({ recibo, f, aoRecomecar }: { recibo: ResultadoEnvio; f: Inscricao; aoRecomecar: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  return (
    <div className="rel-inner">
      <div className="rel-recibo">
        <CheckCircle2 size={44} aria-hidden="true" />
        <h2 ref={titulo} tabIndex={-1}>
          Inscrição confirmada
        </h2>
        <p>{recibo.mensagem}</p>
        {recibo.protocolo ? (
          <p>
            Protocolo: <code className="plat-protocolo">{recibo.protocolo}</code>
          </p>
        ) : null}

        <PercursoResumo turma1={f.turma_conteudo1} turma2={f.turma_conteudo2} />

        <p className="rel-dica">
          Nos vemos no {TEXTO.nome}, no {TEXTO.onde}. Precisa corrigir alguma coisa? Inscreva-se de novo com o
          mesmo e-mail. Isso substitui a resposta anterior, não duplica. Dúvidas:{" "}
          <a href={`mailto:${TEXTO.contato}`}>{TEXTO.contato}</a>.
        </p>
        <p className="rel-nav plat-nav">
          <a className="button plat-ghost" href="#/">
            Voltar ao site do INCT-CONEXAO
          </a>
          <button type="button" className="button plat-ghost" onClick={aoRecomecar}>
            Fazer outra inscrição
          </button>
        </p>
      </div>
    </div>
  );
}

// ================================================== 5. SELETOR DE TURMA ======

function SeletorTurma({
  conteudo,
  turmas,
  valor,
  aoMudar,
  erro,
  vagas,
}: {
  conteudo: 1 | 2;
  turmas: readonly Turma[];
  valor: string;
  aoMudar: (id: string) => void;
  erro?: string;
  vagas: Vagas | null;
}) {
  const modulo = MODULOS[conteudo - 1];
  const nomeId = conteudo === 1 ? "turma_conteudo1" : "turma_conteudo2";
  const rotuloTipo = conteudo === 1 ? "Aula teórica" : "Aula prática";
  const max = vagas?.max ?? 0;
  return (
    <fieldset className="rel-campo curso-turmas" id={`campo-${nomeId}`}>
      <legend>
        <span className="curso-turmas-num">{conteudo}</span> {rotuloTipo}: {modulo.titulo}
      </legend>
      <small className="rel-dica" id={`${nomeId}-dica`}>
        {modulo.escolha}
      </small>
      <div className="curso-turma-grid">
        {turmas.map((t) => {
          const restam = vagas ? Math.max(0, max - (vagas.ocupacao[t.id] ?? 0)) : null;
          const esg = restam === 0;
          // Só bloqueia uma turma cheia que a pessoa NÃO tem selecionada. A que
          // ela já escolheu continua clicável (correção da própria inscrição, que
          // o servidor aceita mesmo com a turma lotada).
          const bloqueada = esg && valor !== t.id;
          // A barra "de vida": cheia = muitas vagas, esvazia à medida que lotam;
          // a cor passa de verde a âmbar e clay conforme aperta.
          const pct = restam === null || max <= 0 ? 0 : Math.round((restam / max) * 100);
          const nivel = esg ? "esgotada" : pct <= 12 ? "critico" : pct <= 30 ? "baixo" : "ok";
          const classe = ["curso-turma", valor === t.id ? "is-on" : "", bloqueada ? "is-esgotada" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <label key={t.id} className={classe} htmlFor={`${nomeId}-${t.id}`}>
              <input
                id={`${nomeId}-${t.id}`}
                type="radio"
                name={nomeId}
                checked={valor === t.id}
                disabled={bloqueada}
                aria-invalid={erro ? true : undefined}
                aria-describedby={`${nomeId}-dica${erro ? ` ${nomeId}-erro` : ""}`}
                onChange={() => aoMudar(t.id)}
              />
              <span className="curso-turma-head">
                <span className="curso-turma-dia">
                  <CalendarClock size={15} aria-hidden="true" /> {t.diaRotulo}
                </span>
                <CheckCircle2 className="curso-turma-check" size={19} aria-hidden="true" />
              </span>
              <span className="curso-turma-hora">
                <Clock size={14} aria-hidden="true" /> {t.inicio} às {t.fim}
              </span>
              {restam === null ? (
                <span className="curso-turma-vaga curso-turma-vaga--indef">Vagas a confirmar</span>
              ) : (
                <span className="curso-turma-vaga" data-nivel={nivel}>
                  <span className="curso-turma-vaga-num">
                    {esg ? "Esgotado" : `${restam} ${restam === 1 ? "vaga restante" : "vagas restantes"}`}
                  </span>
                  <span
                    className="curso-turma-barra"
                    role="img"
                    aria-label={esg ? "Turma esgotada" : `${restam} de ${max} vagas restantes`}
                  >
                    <span className="curso-turma-barra-fill" style={{ width: `${pct}%` }} />
                  </span>
                </span>
              )}
            </label>
          );
        })}
      </div>
      {/* Sem `role="alert"`: na etapa 1 o erro do percurso já é anunciado pelo
          banner geral do passo; um segundo live region com o mesmo texto faria
          o leitor de tela repetir. Mesma escolha dos controles de ui/campos.tsx. */}
      {erro ? (
        <small className="plat-error rel-erro" id={`${nomeId}-erro`}>
          {erro}
        </small>
      ) : null}
    </fieldset>
  );
}

// ================================================== 6. PASSOS =================

type PropsPasso = {
  f: Inscricao;
  set: <K extends keyof Inscricao>(chave: K, valor: Inscricao[K]) => void;
  erro: Pendencia | null;
};

const erroDe = (erro: Pendencia | null, campo: string): string | undefined =>
  erro?.campo === campo ? erro.mensagem : undefined;

function Passo1({ f, set, erro, vagas }: PropsPasso & { vagas: Vagas | null }) {
  return (
    <div className="plat-fields">
      <SeletorTurma
        conteudo={1}
        turmas={TURMAS_C1}
        valor={f.turma_conteudo1}
        aoMudar={(id) => set("turma_conteudo1", id as TurmaC1)}
        erro={erroDe(erro, "turma_conteudo1")}
        vagas={vagas}
      />
      <SeletorTurma
        conteudo={2}
        turmas={TURMAS_C2}
        valor={f.turma_conteudo2}
        aoMudar={(id) => set("turma_conteudo2", id as TurmaC2)}
        erro={erroDe(erro, "turma_conteudo2")}
        vagas={vagas}
      />
    </div>
  );
}

function Passo2({ f, set, erro }: PropsPasso) {
  return (
    <div className="plat-fields">
      <Texto
        id="nome"
        rotulo="Nome completo"
        valor={f.nome}
        aoMudar={(v) => set("nome", v)}
        maxLength={LIMITES.nomeMax}
        autoComplete="name"
        erro={erroDe(erro, "nome")}
      />
      <Texto
        id="email"
        rotulo="E-mail"
        tipo="email"
        inputMode="email"
        valor={f.email}
        aoMudar={(v) => set("email", v)}
        maxLength={LIMITES.emailMax}
        autoComplete="email"
        dica="É por aqui que a coordenação confirma a inscrição. Inscrever-se de novo com o mesmo e-mail corrige, não duplica."
        erro={erroDe(erro, "email")}
      />
      <Texto
        id="whatsapp"
        rotulo="WhatsApp (com DDD)"
        tipo="tel"
        inputMode="tel"
        valor={f.whatsapp}
        aoMudar={(v) => set("whatsapp", v)}
        maxLength={LIMITES.whatsappMax}
        autoComplete="tel"
        placeholder="(69) 9 9999-9999"
        dica="Usamos para lembretes e retorno rápido sobre a turma."
        erro={erroDe(erro, "whatsapp")}
      />
      <Texto
        id="instituicao"
        rotulo="Instituição"
        valor={f.instituicao}
        aoMudar={(v) => set("instituicao", v)}
        maxLength={LIMITES.instituicaoMax}
        autoComplete="organization"
        placeholder="IFRO Campus Jaru"
        erro={erroDe(erro, "instituicao")}
      />
      <Texto
        id="curso_area"
        rotulo="Curso ou área"
        valor={f.curso_area}
        aoMudar={(v) => set("curso_area", v)}
        maxLength={LIMITES.cursoAreaMax}
        placeholder="Medicina Veterinária, Engenharia Agronômica…"
        erro={erroDe(erro, "curso_area")}
      />
      <Escolha
        legenda="O que melhor descreve o seu vínculo?"
        nomeId="vinculo"
        colunas="uma"
        opcoes={VINCULOS}
        valor={f.vinculo}
        aoMudar={(v) => set("vinculo", v)}
        erro={erroDe(erro, "vinculo")}
      />
      <Selecao
        id="semestre"
        rotulo="Semestre"
        valor={f.semestre}
        aoMudar={(v) => set("semestre", v as Inscricao["semestre"])}
        opcoes={SEMESTRES}
        vazio="Selecione o semestre…"
        dica="Docentes e técnicos podem marcar 'não se aplica'."
        erro={erroDe(erro, "semestre")}
      />
    </div>
  );
}

function Passo3({ f, set, erro }: PropsPasso) {
  return (
    <div className="plat-fields">
      <Escolha
        legenda="Qual é o seu nível de experiência com estruturas moleculares?"
        dica="Sinceridade ajuda mais que otimismo. O curso é pensado para começar do zero."
        nomeId="experiencia"
        colunas="uma"
        opcoes={EXPERIENCIAS}
        valor={f.experiencia}
        aoMudar={(v) => set("experiencia", v)}
        erro={erroDe(erro, "experiencia")}
      />
      <Area
        id="acessibilidade"
        rotulo="Precisa de algum apoio de acessibilidade?"
        opcional
        valor={f.acessibilidade}
        aoMudar={(v) => set("acessibilidade", v)}
        maximo={LIMITES.acessibilidadeMax}
        dica="Ex.: intérprete de Libras, material ampliado, mesa acessível, leitor de tela, apoio de mobilidade"
        erro={erroDe(erro, "acessibilidade")}
      />
    </div>
  );
}

function Passo4({ f, set, erro }: PropsPasso) {
  const rotulo = <T extends string>(lista: ReadonlyArray<readonly [T, string]>, id: T | ""): string =>
    lista.find(([v]) => v === id)?.[1] ?? "não informado";

  return (
    <div className="plat-fields">
      <div className="rel-revisao">
        <section>
          <h3>
            <GraduationCap size={16} aria-hidden="true" /> Quem é você
          </h3>
          <dl>
            <dt>Nome</dt>
            <dd>{f.nome || "não informado"}</dd>
            <dt>E-mail</dt>
            <dd>{f.email || "não informado"}</dd>
            <dt>WhatsApp</dt>
            <dd>{f.whatsapp || "não informado"}</dd>
            <dt>Instituição</dt>
            <dd>{f.instituicao || "não informado"}</dd>
            <dt>Curso / área</dt>
            <dd>{f.curso_area || "não informado"}</dd>
            <dt>Vínculo</dt>
            <dd>
              {rotulo(VINCULOS, f.vinculo)}
              {f.semestre && f.semestre !== "nao_se_aplica" ? ` · ${rotulo(SEMESTRES, f.semestre)}` : ""}
            </dd>
            <dt>Experiência</dt>
            <dd>{rotulo(EXPERIENCIAS, f.experiencia)}</dd>
            {f.acessibilidade ? (
              <>
                <dt>
                  <Accessibility size={13} aria-hidden="true" /> Acessibilidade
                </dt>
                <dd>{f.acessibilidade}</dd>
              </>
            ) : null}
          </dl>
        </section>
      </div>

      <fieldset className="rel-campo" id="campo-lgpd">
        <legend>Autorização</legend>
        <label className="plat-consent rel-escolha ff-consentimento" htmlFor="lgpd">
          <input
            id="lgpd"
            type="checkbox"
            checked={f.lgpd}
            aria-invalid={erroDe(erro, "lgpd") ? true : undefined}
            aria-describedby={erroDe(erro, "lgpd") ? "lgpd-erro" : undefined}
            onChange={(e) => set("lgpd", e.target.checked)}
          />
          <span>{TEXTO.lgpd}</span>
        </label>
        {erroDe(erro, "lgpd") ? (
          <small className="plat-error rel-erro" id="lgpd-erro" role="alert">
            <AlertTriangle size={15} aria-hidden="true" /> {erroDe(erro, "lgpd")}
          </small>
        ) : null}
      </fieldset>
    </div>
  );
}
