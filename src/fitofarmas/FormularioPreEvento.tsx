/**
 * ============================================================================
 *  I Workshop Conexão Fitofarmas — formulário PRÉ-EVENTO
 * ============================================================================
 *  Rota: #/fitofarmas · pública, sem login · 25 e 27 de agosto de 2026.
 *
 *  O QUE ESTA TELA FAZ
 *  -------------------
 *  Pergunta a quem JÁ ESTÁ INSCRITO no workshop o que ele quer e pode fazer
 *  com a rede INCT-CONEXAO DEPOIS do encontro, para que a coordenação chegue no
 *  dia 25 sabendo com quem sentar.
 *
 *  O QUE ELA NUNCA FAZ
 *  -------------------
 *   • Não pergunta satisfação, aprendizado nem aplicação do conteúdo: o evento
 *     ainda não aconteceu, e perguntar produziria dado falso.
 *   • Não pede login, não cria conta, não envia e-mail.
 *   • Não mostra o escore de intenção a quem responde. Devolver "você é
 *     prioritário" ensina quais caixas marcar e mata o instrumento na segunda
 *     edição. O escore existe só para a coordenação, e é calculado no servidor.
 *
 *  AS QUATRO DECISÕES QUE GOVERNAM ESTE ARQUIVO
 *  --------------------------------------------
 *   1. VALIDAÇÃO BLOQUEANTE POR PASSO. Ao contrário do relato anual (que é
 *      não-bloqueante porque tem sessão e rascunho no servidor), aqui não há
 *      sessão: quem avança com o passo pela metade chega ao fim e descobre tudo
 *      de uma vez. Bloquear cedo custa um clique; bloquear tarde custa a
 *      resposta inteira.
 *   2. CAMINHO CURTO. Quem marca "quero só acompanhar" pula os passos 3 e 4.
 *      Perguntar quanta infraestrutura cede a quem acabou de dizer que só quer
 *      receber notícias é o jeito mais rápido de obter uma resposta inventada.
 *   3. RASCUNHO LOCAL. Sem sessão, o servidor não tem onde guardar meio
 *      formulário de alguém que ele não sabe quem é. Ver `rascunho.ts` —
 *      a inversão em relação ao relato está explicada lá.
 *   4. NADA DE `throw`. Todo desfecho previsto volta como `ResultadoEnvio`.
 *      Quem chegou por QR code, em pé no corredor, não se recupera de um
 *      "algo deu errado".
 *
 *  ACESSIBILIDADE — o que não pode ser perdido numa edição futura
 *  -------------------------------------------------------------
 *   • O foco vai para o `<h2>` do passo a cada troca (menos na primeira
 *     renderização), senão quem usa leitor de tela continua ouvindo o rodapé.
 *   • O progresso é dito em MINUTOS, não em porcentagem: "60% concluído" não
 *     responde à única pergunta que a pessoa faz, que é "quanto falta?".
 *   • Toda escolha é `<fieldset>/<legend>`; todo erro é texto, nunca só borda.
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Database,
  FlaskConical,
  HandCoins,
  Handshake,
  Leaf,
  MapPin,
  Send,
  Trash2,
  Users,
} from "lucide-react";

import { absoluteUrl, useWebinarHead } from "../webinars/seo";
import { movimentoReduzido } from "../figuras/movimento";
import { Area, Caixas, Escala, Escolha, FichaSelecionavel, Selecao, Texto } from "../ui/campos";
import { carregarEdicao, enviarRespostas, fitofarmasDisponivel, type Edicao } from "./api";
import { esquecerRascunho, lerRascunho, salvarRascunho } from "./rascunho";
import {
  APORTES,
  APORTE_EXCLUSIVO,
  CANAIS,
  COMPROMISSOS,
  COMPROMISSO_EXCLUSIVO,
  DECISOES,
  DISPONIBILIDADES,
  EETS,
  FORMAS,
  HISTORICOS,
  HORIZONTES,
  INICIATIVAS,
  INICIATIVA_EXCLUSIVA,
  INSTITUICOES_SUGERIDAS,
  INTERESSES,
  INTERESSE_QUE_ENCURTA,
  MAX_DETALHE,
  MAX_EETS,
  OPCOES_UF,
  PASSOS,
  PASSOS_DE_COLABORACAO,
  PERGUNTA_DO_APORTE,
  PONTOS_CHANCE,
  SEDES,
  TEXTO,
  VINCULOS,
} from "./perguntas";
import {
  LIMITES,
  ROTULO_CAMPO,
  erroDoPasso,
  normalizarParaEnvio,
  pendenciasDe,
  type Pendencia,
} from "./validation";
import type {
  Aporte,
  Compromisso,
  Eet,
  Forma,
  Iniciativa,
  Interesse,
  Respostas,
  ResultadoEnvio,
} from "./types";

// ================================================== 1. ESTADO INICIAL ========

const VAZIO: Respostas = {
  nome: "",
  email: "",
  telefone: "",
  instituicao: "",
  uf: "",
  vinculo: "",
  lattes: "",
  orcid: "",
  interesse: "",
  sede: "",
  eets: [],
  formas: [],
  aportes: [],
  aportes_detalhe: {},
  iniciativas: [],
  disponibilidade: "",
  horizonte: "",
  decisao: "",
  historico: "",
  compromissos: [],
  chance_1a5: 0,
  comentario: "",
  canal: "",
  lgpd: false,
};

/** Ícone de cada aporte. Decorativo — o texto sozinho já diz tudo. */
const ICONE_APORTE = {
  infraestrutura: FlaskConical,
  dados: Database,
  projeto: Leaf,
  rede: Users,
  financiamento: HandCoins,
  equipe: Users,
  territorio: MapPin,
  nenhum: Boxes,
} as const;

// ================================================== 2. AUXILIARES PUROS ======

/**
 * Onde mora cada campo que o SERVIDOR pode recusar. Hoje é um só — a 008
 * devolve `campo` apenas em `email_invalido`. Mapa explícito, e não busca por
 * `erroDoPasso`: quando a resposta do servidor chega, a validação da tela já
 * passou em todos os passos por definição, e a busca devolveria sempre nada.
 */
const PASSO_DO_CAMPO_DO_SERVIDOR: Readonly<Record<string, number>> = { email: 1 };

/** Respeita "reduzir movimento": `behavior` em JS vence o CSS, então é aqui. */
function comportamentoDeRolagem(): ScrollBehavior {
  return movimentoReduzido() ? "auto" : "smooth";
}

/** Alterna um item numa lista imutável. Fora do componente: é função pura. */
function alternar<T>(lista: readonly T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
}

/**
 * Alterna respeitando um item EXCLUSIVO ("nada disso", "prefiro definir
 * depois"): marcar o exclusivo limpa os outros; marcar outro tira o exclusivo.
 * Sem isto, "nada disso por enquanto" convive com três aportes marcados e o
 * dado deixa de significar coisa alguma.
 */
function alternarComExclusivo<T>(lista: readonly T[], item: T, exclusivo: T): T[] {
  if (item === exclusivo) return lista.includes(exclusivo) ? [] : [exclusivo];
  const semExclusivo = lista.filter((x) => x !== exclusivo);
  return alternar(semExclusivo, item);
}

/** Os passos que existem para ESTA pessoa. O portão é a pergunta `interesse`. */
function passosAtivos(f: Respostas): number[] {
  const todos = PASSOS.map((p) => p.id);
  if (f.interesse === INTERESSE_QUE_ENCURTA) {
    return todos.filter((id) => !PASSOS_DE_COLABORACAO.includes(id));
  }
  return todos;
}

/** Minutos restantes, somando só os passos que ainda vêm. */
function minutosRestantes(passo: number, ativos: readonly number[]): number {
  const faltam = ativos.filter((id) => id >= passo);
  return PASSOS.filter((p) => faltam.includes(p.id)).reduce((s, p) => s + p.minutos, 0);
}

// ================================================== 3. A PÁGINA =============

export default function FormularioPreEvento() {
  useWebinarHead({
    title: `${TEXTO.titulo}: antes do encontro | INCT-CONEXAO`,
    description:
      "Porto Velho (25/08) e Cacoal (27/08) de 2026. Em 4 minutos, diga como você quer colaborar com a rede INCT-CONEXAO.",
    ogTitle: TEXTO.titulo,
    ogType: "website",
    url: absoluteUrl(`${import.meta.env.BASE_URL}#/fitofarmas`),
  });

  // ---------------------------------------------------------------- estado
  const [f, setF] = useState<Respostas>(VAZIO);
  const [passo, setPasso] = useState(1);
  const [erro, setErro] = useState<Pendencia | null>(null);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [recibo, setRecibo] = useState<ResultadoEnvio | null>(null);
  const [avisoRascunho, setAvisoRascunho] = useState(false);
  const [edicao, setEdicao] = useState<Edicao | null>(null);

  /**
   * A isca. Campo real, fora da tela e fora do foco: humano nunca preenche,
   * robô de formulário preenche tudo que encontra. Quem cai aqui recebe
   * `ok` e nada é gravado — dizer "recusado" ensinaria o robô a corrigir.
   */
  const [isca, setIsca] = useState("");

  /** Quando a tela abriu. A RPC recusa envio com menos de 4 s de preenchimento. */
  const abertoEm = useRef<number>(Date.now());
  const cabecaRef = useRef<HTMLHeadingElement>(null);
  const primeiraRenderizacao = useRef(true);
  const semeado = useRef(false);

  const ativos = useMemo(() => passosAtivos(f), [f]);
  const ultimo = ativos[ativos.length - 1] ?? 1;
  const indiceAtual = Math.max(0, ativos.indexOf(passo));

  const set = <K extends keyof Respostas>(chave: K, valor: Respostas[K]): void => {
    setF((atual) => ({ ...atual, [chave]: valor }));
    // Uma correção apaga o erro do passo na hora: manter a mensagem vermelha
    // depois de a pessoa consertar é acusá-la do que ela já resolveu.
    if (erro) setErro(null);
  };

  /**
   * Trocar o portão para "só acompanhar" APAGA o que foi respondido nos passos
   * de colaboração.
   *
   * Não é zelo: sem isto, quem preencheu o formulário inteiro e depois voltou
   * para dizer "na verdade só quero acompanhar" enviaria, por baixo, os eixos,
   * os aportes e os compromissos que acabou de renegar — e o escore contaria
   * pontos que a pessoa retirou. A tela de revisão também mentiria, porque ela
   * esconde a seção mas os dados continuavam lá.
   *
   * O servidor faz a mesma poda (seção 4 da 008), porque cliente nenhum é
   * autoridade sobre o que chega ao banco. Aqui a poda existe para que a REVISÃO
   * mostre a verdade antes do envio.
   */
  const escolherInteresse = (valor: Interesse): void => {
    setErro(null);
    setF((atual) =>
      valor === INTERESSE_QUE_ENCURTA
        ? {
            ...atual,
            interesse: valor,
            eets: [],
            formas: [],
            aportes: [],
            aportes_detalhe: {},
            iniciativas: [],
            disponibilidade: "",
            horizonte: "",
            decisao: "",
            historico: "",
            compromissos: [],
            chance_1a5: 0,
          }
        : { ...atual, interesse: valor },
    );
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
    if (recibo?.ok) return; // enviado: não ressuscitar o que já virou protocolo
    const id = window.setTimeout(() => salvarRascunho(f), 800);
    return () => window.clearTimeout(id);
  }, [f, recibo]);

  // ------------------------------------------------- a edição (janela e título)
  useEffect(() => {
    let vivo = true;
    void carregarEdicao().then((e) => {
      if (vivo) setEdicao(e);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // ------------------------------------------------- foco na troca de passo
  //
  // A dependência é SÓ `passo`. Com `recibo` na lista, todo envio que FALHA
  // rolava a página de volta ao topo do passo 5 — deixando a mensagem de erro,
  // que fica lá embaixo entre o consentimento e os botões, fora da tela num
  // celular. A pessoa tocava em "Enviar", a página subia, e nada visível
  // acontecia. O recibo de SUCESSO move o próprio foco (ver `Recibo`).
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
    const proximo = ativos.find((id) => id > passo);
    if (proximo) setPasso(proximo);
  };

  const voltar = (): void => {
    setErro(null);
    const anteriores = ativos.filter((id) => id < passo);
    const anterior = anteriores[anteriores.length - 1];
    if (anterior) setPasso(anterior);
  };

  const enviar = async (): Promise<void> => {
    const faltando = pendenciasDe(f, ativos);
    if (faltando.length > 0) {
      setTentou(true);
      setErro(faltando[0]);
      // Volta para o passo do primeiro problema: mostrar "falta o vínculo" na
      // tela de revisão, sem o campo à vista, é um beco sem saída.
      const passoDoErro = ativos.find((id) => erroDoPasso(id, f)?.campo === faltando[0].campo);
      if (passoDoErro && passoDoErro !== passo) setPasso(passoDoErro);
      else focarCampo(faltando[0].campo);
      return;
    }

    setEnviando(true);
    // NORMALIZA ANTES DE ENVIAR. O ORCID que a pessoa colou de orcid.org passa
    // na validação da tela e é RECUSADO pelo CHECK do banco, que só aceita a
    // forma com hífens — sem esta linha, o envio ficava impossível para sempre,
    // e o rascunho restaurava o mesmo valor a cada tentativa.
    const resultado = await enviarRespostas(
      normalizarParaEnvio(f),
      isca,
      Date.now() - abertoEm.current,
    );
    setEnviando(false);
    setRecibo(resultado);

    if (resultado.ok) {
      esquecerRascunho();
      return;
    }
    // O servidor pode recusar UM campo que a tela deixou passar (hoje só o
    // e-mail, que a 008 valida com a mesma expressão mas sobre um `btrim` do
    // Postgres, que não tira NBSP colado de um PDF). O mapa é explícito porque
    // a busca por `erroDoPasso` seria sempre nula aqui: chegar até a RPC já
    // significa que nenhum passo tem pendência.
    const passoDoCampo = resultado.campo ? PASSO_DO_CAMPO_DO_SERVIDOR[resultado.campo] : undefined;
    if (passoDoCampo) {
      if (passoDoCampo !== passo) setPasso(passoDoCampo);
      const alvo = resultado.campo;
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => focarCampo(alvo as string)),
      );
    }
  };

  // ------------------------------------------------------------- a moldura
  //  Ordem das guardas: primeiro a plataforma, depois o recibo, depois o
  //  formulário. Inverter faria alguém que acabou de enviar ver o aviso de
  //  indisponibilidade se a conexão caísse logo depois.
  if (!fitofarmasDisponivel()) return <Indisponivel />;
  if (recibo?.ok) return <Recibo recibo={recibo} />;

  const passoAtual = PASSOS.find((p) => p.id === passo) ?? PASSOS[0];
  const pendencias = tentou && passo === ultimo ? pendenciasDe(f, ativos) : [];

  return (
    <main className="plat-page rel-band" id="conteudo" tabIndex={-1}>
      <div className="section-inner rel-inner">
        <Cabecalho edicao={edicao} />

        <p className="rel-progresso">
          {/* Sem separador "·" entre os dois trechos: quando o contêiner
              estreita e os spans empilham, o ponto sobrava sozinho numa linha
              ("Passo 3 de 3 / · / faltam ~1 min"). O respiro entre eles é o
              `gap` do CSS, que some junto quando não há o que separar. */}
          <span>
            Passo {indiceAtual + 1} de {ativos.length}
          </span>
          <span>faltam ~{minutosRestantes(passo, ativos)} min</span>
          <progress
            value={indiceAtual + 1}
            max={ativos.length}
            aria-label={`Passo ${indiceAtual + 1} de ${ativos.length}`}
          />
        </p>

        <ol className="plat-steps">
          {PASSOS.filter((p) => ativos.includes(p.id)).map((p, i) => (
            <li
              key={p.id}
              className={p.id === passo ? "current" : p.id < passo ? "done" : ""}
              aria-current={p.id === passo ? "step" : undefined}
            >
              <span>{i + 1}</span>
              {p.titulo}
            </li>
          ))}
        </ol>

        {avisoRascunho ? (
          <p className="plat-ok" role="status">
            <CheckCircle2 size={16} aria-hidden="true" /> Recuperamos o que você já tinha preenchido neste
            navegador. Confira antes de enviar.
          </p>
        ) : null}

        <section className="rel-tela" aria-labelledby="ff-titulo-passo">
          <div className="rel-cabeca">
            <h2 id="ff-titulo-passo" ref={cabecaRef} tabIndex={-1}>
              {passoAtual.titulo}
            </h2>
            <p>{DICA_DO_PASSO[passo]}</p>
          </div>

          {passo === 1 ? <Passo1 f={f} set={set} erro={erro} /> : null}
          {passo === 2 ? (
            <Passo2 f={f} set={set} erro={erro} aoEscolherInteresse={escolherInteresse} />
          ) : null}
          {passo === 3 ? <Passo3 f={f} setF={setF} set={set} erro={erro} /> : null}
          {passo === 4 ? <Passo4 f={f} set={set} erro={erro} /> : null}
          {passo === 5 ? <Passo5 f={f} set={set} erro={erro} ativos={ativos} /> : null}

          {/* A isca. `aria-hidden` + `tabIndex={-1}` + `autoComplete="off"`:
              invisível para pessoa e para leitor de tela, visível para robô. */}
          <div className="ff-isca" aria-hidden="true">
            <label htmlFor="ff-confirmacao">Não preencha este campo</label>
            <input
              id="ff-confirmacao"
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
              <strong>Falta isto para enviar:</strong>
              <ul>
                {pendencias.map((p) => (
                  <li key={p.campo}>{p.mensagem}</li>
                ))}
              </ul>
              {pendencias.map((p) => (
                <button key={`ir-${p.campo}`} type="button" onClick={() => irPara(p, ativos, f, setPasso)}>
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
            {passo !== ativos[0] ? (
              <button type="button" className="button plat-ghost" onClick={voltar} disabled={enviando}>
                <ArrowLeft size={15} aria-hidden="true" /> Voltar
              </button>
            ) : (
              <span />
            )}

            {passo === ultimo ? (
              <button type="button" className="button primary" onClick={() => void enviar()} disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar minhas respostas"}{" "}
                <Send size={15} aria-hidden="true" />
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
          <button
            type="button"
            onClick={() => {
              esquecerRascunho();
              setF(VAZIO);
              setPasso(1);
              setAvisoRascunho(false);
              setTentou(false);
              setErro(null);
              // Já estando no passo 1, `setPasso(1)` não muda nada e o efeito de
              // foco não dispara: quem usa leitor de tela apagaria o formulário
              // inteiro e não ouviria absolutamente nada. Levar o foco ao
              // cabeçalho é o retorno — e é exatamente o que a troca de passo
              // faz nos outros casos.
              cabecaRef.current?.focus();
            }}
          >
            <Trash2 size={15} aria-hidden="true" /> Limpar tudo neste navegador
          </button>
        </div>
      </div>
    </main>
  );
}

// ================================================== 4. PEÇAS DA MOLDURA =====

const DICA_DO_PASSO: Readonly<Record<number, string>> = {
  1: "Só o necessário para a coordenação te procurar depois do encontro.",
  2: "A primeira pergunta define o resto do formulário: responda com sinceridade, não com gentileza.",
  3: "Marque o que é verdade hoje. Não há resposta certa, e “nada por enquanto” também é resposta.",
  4: "Aqui pedimos compromisso, não entusiasmo. Prefira prometer menos e cumprir.",
  5: "Confira, autorize e envie. Você recebe um protocolo na tela.",
};

function Cabecalho({ edicao }: { edicao: Edicao | null }) {
  return (
    <>
      <p className="eyebrow">{edicao?.titulo ?? TEXTO.titulo}</p>
      <h1>Antes do encontro, diga como você quer se conectar à rede</h1>
      <p className="rel-dica">
        <CalendarClock size={15} aria-hidden="true" /> {TEXTO.quando} · <MapPin size={15} aria-hidden="true" />{" "}
        {TEXTO.onde}
      </p>
      {/* Sem parágrafos de abertura, por decisão da coordenação (2026-08-07):
          o cabeçalho vai direto das datas ao formulário. */}
    </>
  );
}

/**
 * Aviso de indisponibilidade. Fala do EVENTO, nunca de variável de ambiente:
 * "VITE_SUPABASE_URL não definida" é a nossa pendência, não a da pessoa.
 */
function Indisponivel() {
  return (
    <main className="plat-page rel-band" id="conteudo" tabIndex={-1}>
      <div className="section-inner rel-inner">
        <div className="plat-card plat-notice">
          <CalendarClock size={22} aria-hidden="true" />
          <div>
            <strong>O formulário ainda não está no ar</strong>
            <p>
              O {TEXTO.titulo} acontece em {TEXTO.quando}. Guarde este endereço, que continua valendo, ou
              escreva para <a href={`mailto:${TEXTO.contato}`}>{TEXTO.contato}</a>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Recibo({ recibo }: { recibo: ResultadoEnvio }) {
  /**
   * O recibo PRECISA pegar o foco por conta própria.
   *
   * Quando ele aparece, a subárvore do formulário — inclusive o `<h2>` que o
   * efeito de foco da página usa — é desmontada, e o React zera aquela ref
   * antes de os efeitos rodarem. O botão "Enviar" também sai do DOM, e o
   * navegador devolve o foco ao `<body>`. Sem esta linha, quem usa leitor de
   * tela envia o formulário e ouve SILÊNCIO: o protocolo, que é a única prova
   * do envio, nunca é falado. (A rede de segurança do App.tsx não cobre o caso
   * porque ela só age em troca de ROTA, e a rota aqui não muda.)
   */
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  return (
    <main className="plat-page rel-band" id="conteudo" tabIndex={-1}>
      <div className="section-inner rel-inner">
        <div className="rel-recibo">
          <CheckCircle2 size={44} aria-hidden="true" />
          <h2 ref={titulo} tabIndex={-1}>
            Resposta recebida
          </h2>
          <p>{recibo.mensagem}</p>
          {recibo.protocolo ? (
            <p>
              Protocolo: <code className="plat-protocolo">{recibo.protocolo}</code>
            </p>
          ) : null}
          <p className="rel-dica">
            Nos vemos no {TEXTO.titulo}, {TEXTO.quando}. Se marcou um próximo passo, a coordenação vai te
            procurar pelo canal que você escolheu. Precisa corrigir alguma coisa? Responda de novo com o mesmo
            e-mail, ou escreva para <a href={`mailto:${TEXTO.contato}`}>{TEXTO.contato}</a>.
          </p>
          <p className="rel-nav plat-nav">
            <a className="button plat-ghost" href="#/">
              Voltar ao site do INCT-CONEXAO
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

/** Move o foco para o campo pendente, trocando de passo se preciso. */
function irPara(
  p: Pendencia,
  ativos: readonly number[],
  f: Respostas,
  setPasso: (n: number) => void,
): void {
  const passoDoCampo = ativos.find((id) => erroDoPasso(id, f)?.campo === p.campo);
  if (passoDoCampo) setPasso(passoDoCampo);
  // O passo troca no próximo quadro; o foco espera por ele.
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => focarCampo(p.campo)));
}

/**
 * Leva o foco ao campo pendente.
 *
 * DUAS ARMADILHAS, as duas já custaram um bug aqui:
 *
 *  1. `<fieldset>` NÃO É FOCÁVEL. Um grupo de rádio tem id `campo-<chave>` no
 *     fieldset, e chamar `.focus()` nele não faz nada — o foco fica onde estava
 *     (no botão "Continuar"), a pessoa lê "falta a disponibilidade" e não tem
 *     ideia de onde ela está. Por isso a busca desce até o primeiro CONTROLE
 *     de dentro do grupo.
 *  2. O primeiro controle pode estar DESABILITADO (o teto de 3 eixos desabilita
 *     as opções restantes). `:not([disabled])` evita focar o que não recebe
 *     foco e cair no mesmo silêncio do caso 1.
 *
 * A rolagem é do CONTÊINER, não do controle: em `.rel-escolha` o `<input>` está
 * fora da tela por CSS (clip-path), e rolar até ele levaria a lugar nenhum.
 * `.rel-campo` e `.ff-escala` têm `scroll-margin-top: 132px` para o campo não
 * parar debaixo do cabeçalho fixo.
 */
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

type PropsPasso = {
  f: Respostas;
  set: <K extends keyof Respostas>(chave: K, valor: Respostas[K]) => void;
  erro: Pendencia | null;
};

const erroDe = (erro: Pendencia | null, campo: string): string | undefined =>
  erro?.campo === campo ? erro.mensagem : undefined;

// ================================================== 5. PASSO 1 — QUEM É =====

function Passo1({ f, set, erro }: PropsPasso) {
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
        dica="É por aqui que a coordenação dá retorno. Responder de novo com o mesmo e-mail corrige a resposta anterior, não duplica."
        erro={erroDe(erro, "email")}
      />
      <Texto
        id="telefone"
        rotulo="WhatsApp ou telefone"
        tipo="tel"
        inputMode="tel"
        opcional
        valor={f.telefone}
        aoMudar={(v) => set("telefone", v)}
        maxLength={LIMITES.telefoneMax}
        autoComplete="tel"
        placeholder="(69) 9 9999-9999"
        erro={erroDe(erro, "telefone")}
      />
      <Texto
        id="instituicao"
        rotulo="Instituição, secretaria, associação ou empresa"
        valor={f.instituicao}
        aoMudar={(v) => set("instituicao", v)}
        maxLength={LIMITES.instituicaoMax}
        autoComplete="organization"
        lista="ff-instituicoes"
        dica="Comece a digitar: sugerimos as mais comuns, mas pode escrever qualquer uma."
        erro={erroDe(erro, "instituicao")}
      />
      {/* Sugestão, nunca lista fechada: um workshop regional atrai secretaria
          municipal e associação de produtores que não estão em catálogo nenhum,
          e `<select>` fechado ali é dado perdido. */}
      <datalist id="ff-instituicoes">
        {INSTITUICOES_SUGERIDAS.map((i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
      <Selecao
        id="uf"
        rotulo="Estado"
        valor={f.uf}
        aoMudar={(v) => set("uf", v)}
        opcoes={OPCOES_UF}
        vazio="Selecione o estado…"
        erro={erroDe(erro, "uf")}
      />
      <Escolha
        legenda="O que melhor descreve o seu vínculo?"
        nomeId="vinculo"
        opcoes={VINCULOS}
        valor={f.vinculo}
        aoMudar={(v) => set("vinculo", v)}
        erro={erroDe(erro, "vinculo")}
      />
      <Texto
        id="lattes"
        rotulo="Currículo Lattes"
        opcional
        valor={f.lattes}
        aoMudar={(v) => set("lattes", v)}
        maxLength={200}
        inputMode="url"
        dica="Cole o endereço do seu currículo ou só o número de 16 dígitos. Ajuda a coordenação a reconhecer competências sem te perguntar de novo."
        erro={erroDe(erro, "lattes")}
      />
      <Texto
        id="orcid"
        rotulo="ORCID"
        opcional
        valor={f.orcid}
        aoMudar={(v) => set("orcid", v)}
        maxLength={37}
        placeholder="0000-0000-0000-0000"
        erro={erroDe(erro, "orcid")}
      />
    </div>
  );
}

// ============================================ 6. PASSO 2 — O INTERESSE ======

function Passo2({
  f,
  set,
  erro,
  aoEscolherInteresse,
}: PropsPasso & { aoEscolherInteresse: (v: Interesse) => void }) {
  return (
    <div className="plat-fields">
      <Escolha
        legenda="Qual é hoje o seu interesse em integrar a rede INCT-CONEXAO?"
        dica="Não há resposta melhor que outra. A primeira opção encurta o formulário, e é uma escolha legítima."
        nomeId="interesse"
        colunas="uma"
        opcoes={INTERESSES}
        valor={f.interesse}
        aoMudar={aoEscolherInteresse}
        erro={erroDe(erro, "interesse")}
      />

      {f.interesse === INTERESSE_QUE_ENCURTA ? (
        <p className="rel-dica rel-dica--privacidade" role="status">
          {TEXTO.atalhoAcompanhar}
        </p>
      ) : null}

      <Escolha
        legenda="Em qual dia você pretende estar?"
        dica="Serve para o credenciamento e para montar as mesas de trabalho."
        nomeId="sede"
        opcoes={SEDES}
        valor={f.sede}
        aoMudar={(v) => set("sede", v)}
        erro={erroDe(erro, "sede")}
      />
    </div>
  );
}

// ==================================== 7. PASSO 3 — ONDE PODE CONTRIBUIR =====

function Passo3({
  f,
  set,
  setF,
  erro,
}: PropsPasso & { setF: Dispatch<SetStateAction<Respostas>> }) {
  const noTeto = f.eets.length >= MAX_EETS;
  const bloqueados = noTeto ? EETS.map(([id]) => id).filter((id) => !f.eets.includes(id)) : [];

  /**
   * Marcar/desmarcar um aporte também limpa o "qual?" que ele abriu. Sem isto,
   * quem marca "tenho base de dados", escreve o nome dela e depois desmarca a
   * ficha deixaria o texto órfão viajando para o banco — e o escore contaria
   * um ativo nomeado que a pessoa retirou.
   */
  const alternarAporte = (id: Aporte): void => {
    setF((atual) => {
      const aportes = alternarComExclusivo(atual.aportes, id, APORTE_EXCLUSIVO);
      const detalhe: Partial<Record<Aporte, string>> = {};
      for (const a of aportes) {
        const texto = atual.aportes_detalhe[a];
        if (texto) detalhe[a] = texto;
      }
      return { ...atual, aportes, aportes_detalhe: detalhe };
    });
  };

  /** Grava o "qual?" de UM aporte sem perder os demais. */
  const escreverDetalhe = (id: Exclude<Aporte, "nenhum">, texto: string): void => {
    setF((atual) => ({ ...atual, aportes_detalhe: { ...atual.aportes_detalhe, [id]: texto } }));
  };

  return (
    <div className="plat-fields">
      <Caixas
        legenda={`Em quais eixos você poderia contribuir? (até ${MAX_EETS})`}
        dica="Escolher poucos é a resposta: quem marca tudo não priorizou nada."
        nomeId="eets"
        opcoes={EETS}
        marcadas={f.eets}
        desabilitadas={bloqueados}
        aoAlternar={(v: Eet) => set("eets", alternar(f.eets, v) as Eet[])}
        erro={erroDe(erro, "eets")}
      />
      <p className="rel-contador" aria-live="polite">
        {f.eets.length} de {MAX_EETS} eixos
      </p>

      <Caixas
        legenda="De que formas você poderia contribuir?"
        nomeId="formas"
        opcoes={FORMAS}
        marcadas={f.formas}
        aoAlternar={(v: Forma) => set("formas", alternar(f.formas, v) as Forma[])}
        erro={erroDe(erro, "formas")}
      />

      <fieldset className="rel-campo" id="campo-aportes">
        <legend>O que você já teria hoje para agregar à rede?</legend>
        <small className="rel-dica">
          Toque no que existe de fato. Ao marcar, aparece um campo para nomear, e é o nome que faz a
          coordenação conseguir usar a informação.
        </small>
        <div className="rel-fichas">
          {APORTES.map((a) => {
            const Icone = ICONE_APORTE[a.id];
            return (
              <FichaSelecionavel
                key={a.id}
                titulo={a.titulo}
                exemplo={a.exemplo}
                marcada={f.aportes.includes(a.id)}
                aoAlternar={() => alternarAporte(a.id)}
                icone={<Icone size={20} aria-hidden="true" />}
              />
            );
          })}
        </div>
        {erroDe(erro, "aportes") ? (
          <small className="plat-error rel-erro" role="alert">
            {erroDe(erro, "aportes")}
          </small>
        ) : null}
      </fieldset>

      {/* Os "qual?" — um por aporte marcado, uma linha cada. Só aparecem se a
          ficha estiver marcada: campo condicional é o que mantém o formulário
          curto sem perder o sinal caro. */}
      {f.aportes
        .filter((a): a is Exclude<Aporte, "nenhum"> => a !== APORTE_EXCLUSIVO)
        .map((a) => (
          <Texto
            key={a}
            id={`detalhe-${a}`}
            rotulo={PERGUNTA_DO_APORTE[a]}
            valor={f.aportes_detalhe[a] ?? ""}
            aoMudar={(v) => escreverDetalhe(a, v)}
            maxLength={MAX_DETALHE}
            dica="Uma linha basta: o nome e um número, se houver."
            erro={erroDe(erro, `detalhe-${a}`)}
          />
        ))}
    </div>
  );
}

// ======================================== 8. PASSO 4 — O QUE VOCÊ ASSUME ====

function Passo4({ f, set, erro }: PropsPasso) {
  return (
    <div className="plat-fields">
      <Caixas
        legenda="O que você gostaria de construir junto com a rede?"
        nomeId="iniciativas"
        opcoes={INICIATIVAS}
        marcadas={f.iniciativas}
        aoAlternar={(v: Iniciativa) =>
          set("iniciativas", alternarComExclusivo(f.iniciativas, v, INICIATIVA_EXCLUSIVA) as Iniciativa[])
        }
        erro={erroDe(erro, "iniciativas")}
      />

      <Escolha
        legenda="Quanto tempo você consegue dedicar nos próximos 6 meses?"
        dica="Estimativa honesta vale mais que otimismo: é com ela que a coordenação monta os grupos."
        nomeId="disponibilidade"
        colunas="uma"
        opcoes={DISPONIBILIDADES}
        valor={f.disponibilidade}
        aoMudar={(v) => set("disponibilidade", v)}
        erro={erroDe(erro, "disponibilidade")}
      />

      <Escolha
        legenda="Em que prazo você conseguiria começar algo com a rede?"
        nomeId="horizonte"
        opcoes={HORIZONTES}
        valor={f.horizonte}
        aoMudar={(v) => set("horizonte", v)}
        erro={erroDe(erro, "horizonte")}
      />

      <Escolha
        legenda="Na sua instituição, você decide sobre parcerias ou precisa de aval?"
        dica="Não é pegadinha: quem precisa levar a proposta à chefia recebe material para levar, não convite."
        nomeId="decisao"
        colunas="uma"
        opcoes={DECISOES}
        valor={f.decisao}
        aoMudar={(v) => set("decisao", v)}
        erro={erroDe(erro, "decisao")}
      />

      <Escolha
        legenda="Nos últimos 24 meses, você já colaborou com alguma instituição da rede?"
        dica="Fiocruz RO, UNIR, IFRO, IESPRO, EMBRAPA, laboratórios associados, entre outras."
        nomeId="historico"
        colunas="uma"
        opcoes={HISTORICOS}
        valor={f.historico}
        aoMudar={(v) => set("historico", v)}
        erro={erroDe(erro, "historico")}
      />

      <Caixas
        legenda="Depois do workshop, o que você aceita assumir?"
        dica="Marque só o que você realmente faria. Em outubro a coordenação volta a esta lista, item por item."
        nomeId="compromissos"
        opcoes={COMPROMISSOS}
        marcadas={f.compromissos}
        aoAlternar={(v: Compromisso) =>
          set("compromissos", alternarComExclusivo(f.compromissos, v, COMPROMISSO_EXCLUSIVO) as Compromisso[])
        }
        erro={erroDe(erro, "compromissos")}
      />

      <Escala
        legenda="Qual a chance real de você participar de uma atividade da rede nos próximos 6 meses?"
        nomeId="chance_1a5"
        pontos={PONTOS_CHANCE}
        ancoraBaixa="Quase nula"
        ancoraAlta="Certa"
        valor={f.chance_1a5}
        aoMudar={(v) => set("chance_1a5", v as Respostas["chance_1a5"])}
        erro={erroDe(erro, "chance_1a5")}
      />
    </div>
  );
}

// ========================================= 9. PASSO 5 — REVISÃO E ENVIO =====

function Passo5({ f, set, erro, ativos }: PropsPasso & { ativos: readonly number[] }) {
  const curto = !ativos.includes(3);
  const rotulo = <T extends string>(lista: ReadonlyArray<readonly [T, string]>, id: T | ""): string =>
    lista.find(([v]) => v === id)?.[1] ?? "não informado";

  return (
    <div className="plat-fields">
      <div className="rel-revisao">
        <section>
          <h3>Quem é você</h3>
          <dl>
            <dt>Nome</dt>
            <dd>{f.nome || "não informado"}</dd>
            <dt>E-mail</dt>
            <dd>{f.email || "não informado"}</dd>
            <dt>Instituição</dt>
            <dd>
              {f.instituicao || "não informado"}
              {f.uf ? ` · ${f.uf}` : ""}
            </dd>
            <dt>Vínculo</dt>
            <dd>{rotulo(VINCULOS, f.vinculo)}</dd>
          </dl>
        </section>

        <section>
          <h3>Seu interesse</h3>
          <dl>
            <dt>Na rede</dt>
            <dd>{rotulo(INTERESSES, f.interesse)}</dd>
            <dt>No evento</dt>
            <dd>{rotulo(SEDES, f.sede)}</dd>
          </dl>
        </section>

        {curto ? null : (
          <section>
            <h3>O que você agrega</h3>
            <dl>
              <dt>Eixos</dt>
              <dd>{f.eets.map((e) => rotulo(EETS, e)).join(" · ") || "nenhum"}</dd>
              <dt>Formas</dt>
              <dd>{f.formas.map((x) => rotulo(FORMAS, x)).join(" · ") || "nenhum"}</dd>
              <dt>Aportes</dt>
              <dd>
                {f.aportes
                  .map((a) => {
                    const ficha = APORTES.find((x) => x.id === a);
                    const detalhe = (f.aportes_detalhe[a] ?? "").trim();
                    return detalhe ? `${ficha?.titulo}: ${detalhe}` : (ficha?.titulo ?? a);
                  })
                  .join(" · ") || "nenhum"}
              </dd>
              <dt>Compromissos</dt>
              <dd>{f.compromissos.map((c) => rotulo(COMPROMISSOS, c)).join(" · ") || "nenhum"}</dd>
              <dt>Disponibilidade</dt>
              <dd>
                {rotulo(DISPONIBILIDADES, f.disponibilidade)} · {rotulo(HORIZONTES, f.horizonte)}
              </dd>
            </dl>
          </section>
        )}
      </div>

      <Area
        id="comentario"
        rotulo="Quer registrar mais alguma coisa?"
        opcional
        valor={f.comentario}
        aoMudar={(v) => set("comentario", v)}
        maximo={LIMITES.comentarioMax}
        dica="Uma proposta, uma dúvida, uma pessoa que deveríamos conhecer"
        erro={erroDe(erro, "comentario")}
      />

      <Escolha
        legenda="Por onde prefere ser procurado(a)?"
        nomeId="canal"
        opcoes={CANAIS}
        valor={f.canal}
        aoMudar={(v) => set("canal", v)}
        erro={erroDe(erro, "canal")}
      />

      <fieldset className="rel-campo" id="campo-lgpd">
        <legend>Autorização</legend>
        <label className="plat-consent rel-escolha ff-consentimento" htmlFor="lgpd">
          <input
            id="lgpd"
            type="checkbox"
            checked={f.lgpd}
            aria-invalid={erroDe(erro, "lgpd") ? true : undefined}
            // Sem o describedby, o único campo obrigatório do formulário que
            // não relia o motivo ao receber o foco era justamente este: o leitor
            // dizia "caixa de seleção, não marcada, inválido" e parava aí.
            aria-describedby={erroDe(erro, "lgpd") ? "lgpd-erro" : undefined}
            onChange={(e) => set("lgpd", e.target.checked)}
          />
          <span>{TEXTO.lgpd}</span>
        </label>
        {erroDe(erro, "lgpd") ? (
          <small className="plat-error rel-erro" id="lgpd-erro" role="alert">
            <Handshake size={15} aria-hidden="true" /> {erroDe(erro, "lgpd")}
          </small>
        ) : null}
      </fieldset>
    </div>
  );
}
