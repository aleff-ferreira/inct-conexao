/**
 * ============================================================================
 *  Área "Relatório Anual" dentro da Gestão (#/gestao?area=relatorio)
 * ============================================================================
 *  Carregada com `lazy()` DENTRO de Gestao.tsx: o portal do processo seletivo
 *  não paga pelo código do relato, e vice-versa.
 *
 *  O QUE ESTA TELA É — e o que ela não é
 *  -------------------------------------
 *   • É o painel completo da coordenação: as respostas dos ~209 relatos
 *     agregadas em métricas (produção, RH, fomento, vozes da rede, metas) e as
 *     automações que poupam a tabulação manual do relatório anual (CSVs,
 *     envelope JSON e a minuta por seção).
 *   • NÃO calcula nada: toda agregação vem PRONTA de `agregarCiclo()`
 *     (src/relato/agregacao.ts) e toda exportação de `src/relato/exportar.ts`.
 *     Esta tela só decide o que mostrar e como.
 *   • NÃO decide permissão. Quem decide é a RLS da migração 005: os dados só
 *     chegam para quem está no roster do ciclo como coordenação ou CGES
 *     (`is_coordenacao`). O papel de admin/avaliador(a) da SELEÇÃO DE IC não
 *     abre esses dados — decisão de segurança da 005, e esta tela explica isso
 *     em vez de exibir uma tabela vazia sem motivo.
 *
 *  AS REGRAS DE HONESTIDADE, NA TELA
 *  ---------------------------------
 *   • O RECORTE (`recorte.frase`) fica visível em TODAS as abas — é a moldura
 *     de honestidade de qualquer número exibido aqui. A hora de geração é
 *     posta pela tela (a agregação é pura e não tem relógio).
 *   • NENHUM percentual de meta: a aba Metas mostra pactuado × declarado lado
 *     a lado, só onde a agregação diz que a correspondência é direta, e lista
 *     os demais pactuados como "sem medição automática" — visíveis, não somidos.
 *   • Produção fora do período aparece À PARTE, com o aviso de que não conta.
 *   • Barras são divs com rótulo numérico — sem biblioteca de gráfico, e cada
 *     barra carrega `aria-label` com o número por extenso.
 * ============================================================================
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  ClipboardList,
  Copy,
  Download,
  FileText,
  FlaskConical,
  GraduationCap,
  HandCoins,
  Lock,
  Megaphone,
  Paperclip,
  RefreshCw,
  Target,
} from "lucide-react";
import { RELATORIO_ANUAL_HREF, RELATORIO_LAB_HREF } from "../webinars/router";
import {
  cicloAberto,
  listarEquipeDoLaboratorio,
  listarRelatosDoLaboratorio,
  meuPapel,
  relatoDisponivel,
  urlAssinadaDeArquivo,
  vincularMeuCadastro,
} from "./api";
import { IdentificacaoComSessao } from "./BuscaPesquisador";
import {
  carregarDadosDoPainel,
  listarArquivosDosRelatosDoCiclo,
  type DadosDoPainel,
  type ItemForaDoCiclo,
  type Recorte,
} from "./agregacao";
import {
  baixarArquivo,
  csvFomento,
  csvPessoasRh,
  csvProducoes,
  envelopeDoCiclo,
  minutaDoRelatorio,
  type SecaoDaMinuta,
} from "./exportar";
import {
  ROTULO_PAPEL,
  ROTULO_PERIODO_SITUACAO,
  ROTULO_TIPO_FATO,
  ROTULO_TIPO_PRODUCAO,
} from "./config";
import type { CategoriaFormado, NivelEstudante } from "./narrativa";
import type {
  CicloMembro,
  Laboratorio,
  PapelNoCiclo,
  Relato,
  RelatoArquivo,
  RelatorioCiclo,
  RelatoStatus,
  UsoArquivo,
} from "./types";

// ------------------------------------------------------------- utilidades --

const STATUS_RELATO: Record<RelatoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  em_conferencia: "Em conferência",
  conferido: "Conferido",
};

/** Rótulos de RH — os mesmos textos da tela do laboratório (MeuLaboratorio). */
const ROTULO_NIVEL_ESTUDANTE: Record<NivelEstudante, string> = {
  ICJ: "Iniciação científica júnior (ICJ)",
  IC: "Iniciação científica (IC)",
  AT: "Apoio técnico (AT)",
  DTI: "Desenvolvimento tecnológico e industrial (DTI)",
  MS: "Mestrado (MS)",
  DR: "Doutorado (DR)",
  PD: "Pós-doutorado (PD)",
};

const ROTULO_CATEGORIA_FORMADO: Record<CategoriaFormado, string> = {
  IC: "Iniciação científica (IC e ICJ)",
  TCC: "Graduação (TCC)",
  MS: "Mestrado",
  DR: "Doutorado",
  PD: "Pós-doutorado",
};

const ROTULO_FONTE: Record<string, string> = {
  scholar: "Google Scholar",
  openalex: "OpenAlex",
  manual: "Informado manualmente",
  sem_fonte: "Sem procedência declarada",
};

/** Data "YYYY-MM-DD" ganha T00:00:00 para não escorregar um dia pelo fuso. */
function fmtData(iso: string | null): string {
  if (!iso) return "n/d";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "n/d" : d.toLocaleDateString("pt-BR");
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "n/d"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const fmtNum = (n: number): string => n.toLocaleString("pt-BR");

/** Tamanho legível — a coordenação lê "9,4 MB", não "9830400 bytes". */
function fmtBytes(n: number): string {
  if (n >= 1048576)
    return `${(n / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  if (n >= 1024) return `${fmtNum(Math.round(n / 1024))} KB`;
  return `${fmtNum(n)} B`;
}

/** `relato_arquivos.uso` na língua da tela do membro (Q32 do MeuAno). */
const ROTULO_USO_ARQUIVO: Record<UsoArquivo, string> = {
  comprovante: "Documento/comprovante",
  imagem_publicavel: "Imagem publicável",
};

const fmtBrl = (n: number): string =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ------------------------------------------------- número por extenso (aria) -
/**
 * Só para `aria-label` das barras: leitor de tela lendo "cento e doze relatos"
 * é mais claro que "112". Acima de 999.999 (não acontece neste painel) cai no
 * número formatado — nunca em texto errado.
 */
const EXT_UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const EXT_DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const EXT_CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function extenso(valor: number): string {
  const n = Math.round(valor);
  if (!Number.isFinite(n) || n < 0 || n >= 1_000_000) return fmtNum(valor);
  if (n >= 1000) {
    const mil = Math.floor(n / 1000);
    const resto = n % 1000;
    const m = mil === 1 ? "mil" : `${extenso(mil)} mil`;
    return resto === 0 ? m : `${m} ${resto < 100 ? "e " : ""}${extenso(resto)}`;
  }
  if (n === 100) return "cem";
  if (n < 20) return EXT_UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${EXT_DEZENAS[d]} e ${EXT_UNIDADES[u]}` : EXT_DEZENAS[d];
  }
  const c = Math.floor(n / 100);
  const r = n % 100;
  return r ? `${EXT_CENTENAS[c]} e ${extenso(r)}` : EXT_CENTENAS[c];
}

// ------------------------------------------------------ aba na hash (?pn=) --

const ABAS = ["visao", "producao", "pessoas", "fomento", "vozes", "metas", "exportar"] as const;
type Aba = (typeof ABAS)[number];

function abaDaHash(): Aba {
  if (typeof window === "undefined") return "visao";
  const query = window.location.hash.split("?").slice(1).join("?");
  const valor = new URLSearchParams(query).get("pn");
  return (ABAS as readonly string[]).includes(valor ?? "") ? (valor as Aba) : "visao";
}

/** `replaceState`, como a Gestão faz com `area` — link direto sem poluir o histórico. */
function gravarAbaNaHash(aba: Aba): void {
  const hash = window.location.hash.replace(/^#/, "");
  const [path] = hash.split("?");
  const q = new URLSearchParams(hash.split("?").slice(1).join("?"));
  if (aba === "visao") q.delete("pn");
  else q.set("pn", aba);
  const qs = q.toString();
  window.history.replaceState(null, "", `#${path}${qs ? `?${qs}` : ""}`);
}

// -------------------------------------------------------------- primitivas --

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="plat-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/**
 * A barra do painel: div com largura proporcional e rótulo numérico SEMPRE
 * visível — a barra ilustra, o número informa. `aria-label` traz o número por
 * extenso para leitor de tela.
 */
function Barra({
  rotulo,
  valor,
  max,
  unidade,
  detalhe,
}: {
  rotulo: string;
  valor: number;
  max: number;
  /** [singular, plural] — "relato"/"relatos". */
  unidade: [string, string];
  detalhe?: string;
}) {
  const pct = max > 0 ? (100 * valor) / max : 0;
  return (
    <div
      className="pn-barra"
      role="img"
      aria-label={`${rotulo}: ${extenso(valor)} ${valor === 1 ? unidade[0] : unidade[1]}`}
    >
      <span className="pn-barra-rotulo">{rotulo}</span>
      <span className="pn-barra-trilho" aria-hidden="true">
        <span className="pn-barra-fill" style={{ width: `${Math.min(100, Math.max(valor > 0 ? 1.5 : 0, pct))}%` }} />
      </span>
      <span className="pn-barra-num" aria-hidden="true">
        {fmtNum(valor)}
      </span>
      {detalhe ? (
        <span className="pn-barra-detalhe" aria-hidden="true">
          {detalhe}
        </span>
      ) : null}
    </div>
  );
}

/** Copiar com `navigator.clipboard` e fallback (textarea + execCommand). */
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [estado, setEstado] = useState<"pronto" | "copiado" | "falhou">("pronto");
  useEffect(() => {
    if (estado === "pronto") return;
    const t = window.setTimeout(() => setEstado("pronto"), 2200);
    return () => window.clearTimeout(t);
  }, [estado]);
  return (
    <button
      className="button plat-ghost pn-copiar"
      onClick={async () => setEstado((await copiarTexto(texto)) ? "copiado" : "falhou")}
      aria-label={rotulo}
    >
      {estado === "copiado" ? (
        <>
          <Check size={14} aria-hidden="true" /> Copiado
        </>
      ) : estado === "falhou" ? (
        "Não deu, copie à mão"
      ) : (
        <>
          <Copy size={14} aria-hidden="true" /> Copiar
        </>
      )}
    </button>
  );
}

/**
 * A moldura de honestidade: o recorte de parcialidade acima de TODA aba. A
 * hora de geração é da tela (a agregação é pura); o botão atualiza sem
 * derrubar o painel.
 */
function MolduraDoRecorte({
  recorte,
  geradoEm,
  atualizando,
  erro,
  onAtualizar,
}: {
  recorte: Recorte;
  geradoEm: Date;
  atualizando: boolean;
  erro: string;
  onAtualizar: () => void;
}) {
  return (
    <div className="pn-moldura" role="status">
      <p className="pn-moldura-frase">{recorte.frase}</p>
      <p className="pn-moldura-meta">
        Números lidos do banco às {geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} de{" "}
        {geradoEm.toLocaleDateString("pt-BR")}.
        <button className="pn-atualizar" onClick={onAtualizar} disabled={atualizando}>
          <RefreshCw size={13} aria-hidden="true" /> {atualizando ? "Atualizando…" : "Atualizar"}
        </button>
      </p>
      {erro ? <p className="plat-error">{erro}</p> : null}
    </div>
  );
}

/** Esqueleto discreto do carregamento — blocos cinzentos, sem espetáculo. */
function Esqueleto() {
  return (
    <div className="pn-skeleton" aria-hidden="true">
      <div className="pn-skeleton-linha pn-skeleton-larga" />
      <div className="pn-skeleton-grade">
        <div className="pn-skeleton-linha" />
        <div className="pn-skeleton-linha" />
        <div className="pn-skeleton-linha" />
        <div className="pn-skeleton-linha" />
      </div>
      <div className="pn-skeleton-bloco" />
      <div className="pn-skeleton-bloco" />
    </div>
  );
}

// ------------------------------------------------------ cartões de acesso --

/**
 * Os cartões-porta para os formulários. Desde o gate por papel (012), o que
 * aparece depende de QUEM olha: papel 'lla' vê SÓ o cartão do laboratório;
 * qualquer outro papel do roster vê SÓ o individual; papel desconhecido
 * (deslogado, fora do roster ou ainda carregando) vê os DOIS — a porta de cada
 * formulário continua fazendo a própria checagem final de acesso, então
 * mostrar de menos aqui nunca esconde direito, e mostrar de mais nunca abre
 * porta. O aviso-incentivo e a nota de rodapé valem para todos os papéis.
 */
function CartoesDeAcesso({ papel }: { papel: PapelNoCiclo | null }) {
  const mostrarIndividual = papel !== "lla";
  const mostrarLaboratorio = papel === "lla" || papel === null;
  return (
    <>
      {/* O INCENTIVO, ANTES DOS CARTÕES (decisão do dono, 2026-08-07): a regra
          da rede é que solicitação de recurso se avalia contra o que a pessoa
          demonstrou NESTE relato. Dizer isso aqui — antes de a pessoa decidir
          se abre o formulário — transforma o relato de obrigação em interesse
          próprio. A frase diz a consequência real e o caminho, sem ameaça:
          quem relata habilita o próprio pedido; quem não relata deixa o pedido
          sem base para seguir. */}
      <div className="plat-card plat-notice rel-gestao-aviso">
        <HandCoins size={20} aria-hidden="true" />
        <div>
          <strong>Resultados registrados aqui são a porta para novos recursos</strong>
          <p>
            As solicitações de apoio do INCT-CONEXAO (expedições, insumos, diárias, participação em
            eventos) são avaliadas com base no que cada pesquisador(a) e laboratório{" "}
            <strong>demonstrou neste relato</strong>: é ele que permite à coordenação priorizar e
            justificar cada aporte ao CNPq. Relatou, pode solicitar. Sem resultados registrados, a
            solicitação não tem base para seguir. Os cerca de 10 minutos deste formulário valem o seu próximo
            recurso.
          </p>
        </div>
      </div>

      {/* SÓ .rel-gestao-cartoes: já carregou também .plat-eval-grid, e o
          align-items:start + colunas 1.1fr/1fr daquele grid (que é o layout da
          AVALIAÇÃO de IC) deixavam os cartões com larguras e alturas
          desiguais e os botões desalinhados — o mesmo defeito da dupla
          `plat-tabs`/`plat-area-btn` que já corrigimos na Gestão. */}
      {/* Com papel conhecido sobra UM cartão, e ele fica na primeira coluna do
          grid (meia largura a partir de 620px) — o `repeat(2, minmax(0,1fr))`
          de .rel-gestao-cartoes já faz esse papel de max-width; sem o wrapper
          o cartão esticaria a largura inteira da seção, que é o defeito. */}
      <div className="rel-gestao-cartoes">
        {mostrarIndividual ? (
          <div className="plat-card rel-gestao-cartao">
            <h3>
              <ClipboardList size={18} aria-hidden="true" /> Relatório Anual de Atividades
            </h3>
            <p>
              Formulário <strong>individual</strong>: cada pesquisador(a), estudante e técnico(a) da rede
              relata o próprio ano: produções, participação em atividades e o resultado principal.
            </p>
            <p className="plat-nav rel-gestao-abrir">
              <a className="button primary" href={RELATORIO_ANUAL_HREF}>
                Abrir o formulário <ArrowRight size={15} aria-hidden="true" />
              </a>
            </p>
          </div>
        ) : null}
        {mostrarLaboratorio ? (
          <div className="plat-card rel-gestao-cartao">
            <h3>
              <FlaskConical size={18} aria-hidden="true" /> Relatório Anual do Laboratório
            </h3>
            <p>
              Formulário do(a) <strong>líder de Laboratório Associado</strong> (LLA): consolida os fatos
              coletivos do laboratório (expedições, parcerias, formação) e responde pelas perguntas de
              governança.
            </p>
            <p className="plat-nav rel-gestao-abrir">
              <a className="button primary" href={RELATORIO_LAB_HREF}>
                Abrir o formulário <ArrowRight size={15} aria-hidden="true" />
              </a>
            </p>
          </div>
        ) : null}
      </div>
      {/* A nota "estes formulários não são a prestação de contas ao CNPq"
          morava aqui; removida a pedido do dono (10/08/2026). A distinção
          relato-interno × Relatório de Execução do Objeto segue documentada em
          docs/relato-anual.md para quem opera. */}
    </>
  );
}

// -------------------------------------------------------- estados vazios ---

function SemCiclo() {
  return (
    <div className="plat-card plat-notice rel-gestao-aviso">
      <CalendarClock size={20} aria-hidden="true" />
      <div>
        <strong>Nenhum ciclo de coleta aberto</strong>
        <p>
          A cobertura e a lista de relatos aparecem aqui quando a coordenação abre a janela de envio
          de um ciclo. Ciclos em conferência ou já consolidados não entram nesta visão.
        </p>
      </div>
    </div>
  );
}

/**
 * A pessoa está logada na Gestão (é admin/avaliador da seleção de IC), mas a
 * RLS do relato devolveria pouco ou nada. Dizer o PORQUÊ é o requisito: papel
 * da seleção e papel do ciclo são coisas diferentes, de propósito.
 *
 * ESTA TELA NÃO É MAIS UM BECO (diretriz do dono, 2026-08-11, depois de o
 * próprio coordenador ser barrado aqui). Antes de ela aparecer, o efeito de
 * carga já tentou o vínculo SILENCIOSO por e-mail pré-autorizado
 * (`vincularMeuCadastro`, 006/013) — é por esse caminho que a coordenação
 * entra sem ver erro nenhum. Se nada casou e o papel segue nulo, a tela
 * explica o porquê E oferece a identificação por busca de nome
 * (IdentificacaoComSessao, o mesmo componente do formulário individual), cujo
 * resultado vale para a plataforma inteira. Papel de gestão a busca RECUSA
 * por desenho (`papel_protegido` da 013): gestão nunca se reivindica por nome.
 */
function SemAcesso({
  papel,
  email,
  onIdentificado,
}: {
  papel: PapelNoCiclo | null;
  email?: string | undefined;
  onIdentificado: () => void;
}) {
  return (
    <>
    <div className="plat-card plat-notice rel-gestao-aviso">
      <Lock size={20} aria-hidden="true" />
      <div>
        <strong>O painel de cobertura é da coordenação do ciclo</strong>
        {papel === null ? (
          <p>
            Seu usuário{email ? <> (<strong>{email}</strong>)</> : null} não consta na equipe deste
            ciclo do Relatório Anual. Ser admin ou avaliador(a) da seleção de IC não abre estes dados:
            por decisão de segurança, o servidor só libera a cobertura e os relatos para quem está no
            roster do ciclo como <strong>coordenação</strong> ou <strong>CGES</strong>. Se você é da
            coordenação ou do CGES, o vínculo é automático pelo e-mail pré-autorizado: confira se
            entrou com o endereço que a coordenação registrou. Se você é pesquisador(a) da rede,
            identifique-se logo abaixo, que o seu caminho aparece.
          </p>
        ) : papel === "lla" ? (
          <p>
            Você consta neste ciclo como <strong>líder de Laboratório Associado</strong>. A
            conferência da sua equipe é feita dentro do próprio{" "}
            <a href={RELATORIO_LAB_HREF}>Relatório Anual do Laboratório</a>. Este painel, com a rede
            inteira, é restrito à coordenação e ao CGES.
          </p>
        ) : (
          <p>
            Você consta neste ciclo como <strong>membro da equipe</strong>. Seu caminho é o{" "}
            <a href={RELATORIO_ANUAL_HREF}>Relatório Anual de Atividades</a>. Este painel, com a
            cobertura da rede inteira, é restrito à coordenação e ao CGES.
          </p>
        )}
      </div>
    </div>
    {/* A saída do beco: quem está fora do roster se identifica AQUI, sem sair
        da tela. Depois do vínculo, `onIdentificado` recarrega o papel: quem
        virou pesquisador(a) vê os cartões do próprio papel; papel de gestão a
        RPC recusa com a mensagem dela (papel_protegido), sem drama. */}
    {papel === null ? (
      <IdentificacaoComSessao emailDaSessao={email ?? ""} onVinculado={onIdentificado} />
    ) : null}
    </>
  );
}

// ==================================================== ABA 1 · VISÃO GERAL ===

function AbaVisaoGeral({ dados, ciclo }: { dados: DadosDoPainel; ciclo: RelatorioCiclo }) {
  const { recorte, coberturaPorPapel, coberturaPorLaboratorio, satisfacao, indicadores, fatos, rede } = dados;

  // Detalhe: o laboratório escolhido para a lista de relatos (comportamento
  // preservado da primeira versão do painel — a linha da cobertura é o mapa,
  // o clique nela abre o detalhe).
  const [labId, setLabId] = useState("");
  const [relatos, setRelatos] = useState<Relato[] | null>(null);
  const [equipe, setEquipe] = useState<CicloMembro[]>([]);
  const [carregandoRelatos, setCarregandoRelatos] = useState(false);
  const [erroRelatos, setErroRelatos] = useState("");

  const labs = useMemo(
    () => [...dados.brutos.laboratorios].sort((a, b) => a.ordem - b.ordem),
    [dados.brutos.laboratorios],
  );

  useEffect(() => {
    if (!labId) {
      setRelatos(null);
      setEquipe([]);
      return;
    }
    let vivo = true;
    setCarregandoRelatos(true);
    setErroRelatos("");
    Promise.all([
      listarRelatosDoLaboratorio(ciclo.id, labId),
      listarEquipeDoLaboratorio(ciclo.id, labId),
    ])
      .then(([rs, eq]) => {
        if (!vivo) return;
        setRelatos(rs);
        setEquipe(eq);
      })
      .catch((e) => {
        if (!vivo) return;
        setRelatos([]);
        setErroRelatos(e instanceof Error ? e.message : "Falha ao carregar os relatos.");
      })
      .finally(() => {
        if (vivo) setCarregandoRelatos(false);
      });
    return () => {
      vivo = false;
    };
  }, [ciclo.id, labId]);

  const nomePorMembro = useMemo(() => new Map(equipe.map((m) => [m.id, m.nome])), [equipe]);
  const labSelecionado = labs.find((l: Laboratorio) => l.id === labId) ?? null;
  const relatosOrdenados = useMemo(
    () => (relatos ?? []).slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [relatos],
  );

  const maxNota = Math.max(1, ...satisfacao.distribuicao.map((d) => d.membros));

  return (
    <>
      <div className="plat-stats">
        <Stat label="Membros ativos no roster" value={fmtNum(recorte.membrosAtivos)} />
        <Stat label="Relatos enviados" value={fmtNum(recorte.relatosEnviados)} />
        <Stat label="Em rascunho" value={fmtNum(recorte.relatosRascunho)} />
        <Stat label="Sem relato" value={fmtNum(recorte.membrosSemRelato)} />
        <Stat label="Sem vínculo no roster" value={fmtNum(recorte.relatosSemVinculoNoRoster)} />
      </div>

      <div className="plat-card">
        <h3>
          <BarChart3 size={18} aria-hidden="true" /> Cobertura por papel no ciclo
        </h3>
        <div className="edital-table-wrap">
          <table className="edital-table">
            <thead>
              <tr>
                <th>Papel</th>
                <th className="num">Convidados</th>
                <th className="num">Entraram</th>
                <th className="num">Enviaram</th>
                <th className="num">Rascunhos</th>
                <th className="num">Nada a declarar</th>
                <th className="num">Silenciosos</th>
              </tr>
            </thead>
            <tbody>
              {coberturaPorPapel.map((l) => (
                <tr key={l.papel}>
                  <td data-label="Papel">{ROTULO_PAPEL[l.papel]}</td>
                  <td data-label="Convidados" className="num">{fmtNum(l.convidados)}</td>
                  <td data-label="Entraram" className="num">{fmtNum(l.entraram)}</td>
                  <td data-label="Enviaram" className="num">{fmtNum(l.enviaram)}</td>
                  <td data-label="Rascunhos" className="num">{fmtNum(l.rascunhos)}</td>
                  <td data-label="Nada a declarar" className="num">{fmtNum(l.nadaADeclarar)}</td>
                  <td data-label="Silenciosos" className="num">{fmtNum(l.silenciosos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="plat-card rel-gestao-cobertura">
        <h3>
          <BarChart3 size={18} aria-hidden="true" /> Cobertura por laboratório
        </h3>
        <p className="plat-hint">
          Convidados · entraram · enviaram, direto do banco. Nenhum número é digitado. Sem esta
          leitura, um número baixo é ambíguo entre baixa produção e baixa resposta. Clique numa linha
          para ver os relatos daquele laboratório.
        </p>
        {coberturaPorLaboratorio.length === 0 ? (
          <p className="plat-empty">
            A cobertura ainda não tem linhas: o roster deste ciclo pode não ter sido importado.
          </p>
        ) : (
          <div className="edital-table-wrap">
            <table className="edital-table plat-clickable">
              <thead>
                <tr>
                  <th>Laboratório</th>
                  <th className="num">Convidados</th>
                  <th className="num">Entraram</th>
                  <th className="num">Enviaram</th>
                  <th className="num">Rascunhos</th>
                  <th className="num">Nada a declarar</th>
                  <th className="num">Silenciosos</th>
                </tr>
              </thead>
              <tbody>
                {coberturaPorLaboratorio.map((linha) => (
                  <tr
                    key={linha.laboratorioId ?? "sem-lab"}
                    onClick={() => linha.laboratorioId && setLabId(linha.laboratorioId)}
                    tabIndex={linha.laboratorioId ? 0 : -1}
                    onKeyDown={(e) => e.key === "Enter" && linha.laboratorioId && setLabId(linha.laboratorioId)}
                    aria-label={linha.laboratorioId ? `Ver os relatos de ${linha.sigla}` : undefined}
                  >
                    <td data-label="Laboratório">
                      {linha.laboratorioId ? (
                        <>
                          {linha.sigla} <small>{linha.nome}</small>
                        </>
                      ) : (
                        <em>{linha.nome}</em>
                      )}
                    </td>
                    <td data-label="Convidados" className="num">{fmtNum(linha.convidados)}</td>
                    <td data-label="Entraram" className="num">{fmtNum(linha.entraram)}</td>
                    <td data-label="Enviaram" className="num">{fmtNum(linha.enviaram)}</td>
                    <td data-label="Rascunhos" className="num">{fmtNum(linha.rascunhos)}</td>
                    <td data-label="Nada a declarar" className="num">{fmtNum(linha.nadaADeclarar)}</td>
                    <td data-label="Silenciosos" className="num">{fmtNum(linha.silenciosos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="plat-card rel-gestao-relatos">
        <h3>
          <FileText size={18} aria-hidden="true" /> Relatos recebidos
        </h3>
        <div className="plat-filters">
          <select
            value={labId}
            onChange={(e) => setLabId(e.target.value)}
            aria-label="Laboratório para listar os relatos"
          >
            <option value="">Escolha um laboratório…</option>
            {labs.map((l: Laboratorio) => (
              <option key={l.id} value={l.id}>
                {l.sigla}: {l.nome}
              </option>
            ))}
          </select>
        </div>
        {!labId ? (
          <p className="plat-empty">
            Escolha um laboratório acima, ou clique numa linha da cobertura, para ver os relatos da
            equipe.
          </p>
        ) : carregandoRelatos ? (
          <p className="plat-empty">Carregando relatos…</p>
        ) : erroRelatos ? (
          <p className="plat-error">{erroRelatos}</p>
        ) : relatosOrdenados.length === 0 ? (
          <p className="plat-empty">
            Nenhum relato {labSelecionado ? `de ${labSelecionado.sigla}` : "deste laboratório"} ainda,
            nem rascunho.
          </p>
        ) : (
          <div className="edital-table-wrap">
            <table className="edital-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Membro</th>
                  <th>Status</th>
                  <th>Atualizado em</th>
                </tr>
              </thead>
              <tbody>
                {relatosOrdenados.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Protocolo">{r.protocolo ?? "n/d"}</td>
                    <td data-label="Membro">
                      {r.membro_id
                        ? nomePorMembro.get(r.membro_id) ?? "Membro fora da equipe listada"
                        : "Sem vínculo no roster"}
                    </td>
                    <td data-label="Status">{STATUS_RELATO[r.status]}</td>
                    <td data-label="Atualizado em">{fmtDataHora(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="plat-hint">
          O protocolo nasce só no envio: rascunho aparece sem protocolo e não conta como enviado. A
          coleta segue aberta depois do envio: o número de "atualizado em" pode andar sem mudar o
          status.
        </p>
      </div>

      <div className="plat-card">
        <h3>Satisfação com o INCT neste ciclo</h3>
        <p className="plat-hint">{satisfacao.rotulo}</p>
        {satisfacao.respondentes > 0 ? (
          <>
            <div className="pn-barras">
              {satisfacao.distribuicao.map((d) => (
                <Barra
                  key={d.nota}
                  rotulo={`Nota ${d.nota}`}
                  valor={d.membros}
                  max={maxNota}
                  unidade={["membro", "membros"]}
                />
              ))}
            </div>
            {satisfacao.media !== null ? (
              <p className="plat-hint">
                Média:{" "}
                <strong>
                  {satisfacao.media.toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </strong>. Sempre leia com o n ao lado; média sem denominador é propaganda.
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="plat-card">
        <h3>Indicadores individuais preenchidos</h3>
        <div className="plat-stats">
          <Stat label="Com índice H" value={`${fmtNum(indicadores.comIndiceH)}/${fmtNum(indicadores.membrosAtivos)}`} />
          <Stat label="Com total de citações" value={`${fmtNum(indicadores.comCitacoes)}/${fmtNum(indicadores.membrosAtivos)}`} />
          <Stat label="Com perfil no Scholar" value={`${fmtNum(indicadores.comScholarId)}/${fmtNum(indicadores.membrosAtivos)}`} />
        </div>
        {indicadores.porFonte.length ? (
          <p className="plat-hint">
            Procedência dos números:{" "}
            {indicadores.porFonte
              .map((f) => `${ROTULO_FONTE[f.fonte] ?? f.fonte} (${fmtNum(f.membros)})`)
              .join(" · ")}
            . Número sem procedência declarada é passivo num relatório ao CNPq. Vale pedir a fonte.
          </p>
        ) : null}
      </div>

      <div className="plat-card">
        <h3>Fatos coletivos confirmados no ciclo</h3>
        <p className="plat-hint">
          {fmtNum(fatos.confirmadosNoCiclo)} fatos confirmados com competência neste ciclo
          {fatos.propostosPendentes > 0
            ? `, e ${fmtNum(fatos.propostosPendentes)} propostas aguardando a conferência dos líderes (não contam até serem confirmadas)`
            : ""}
          . Pessoas alcançadas é estimativa declarada: leia como "aproximadamente".
        </p>
        {fatos.porTipo.length === 0 ? (
          <p className="plat-empty">Nenhum fato confirmado no período ainda.</p>
        ) : (
          <div className="edital-table-wrap">
            <table className="edital-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="num">Itens</th>
                  <th className="num">Laboratórios</th>
                  <th className="num">Adesões</th>
                  <th className="num">Pessoas alcançadas (≈)</th>
                </tr>
              </thead>
              <tbody>
                {fatos.porTipo.map((l) => (
                  <tr key={l.tipo}>
                    <td data-label="Tipo">{ROTULO_TIPO_FATO[l.tipo]}</td>
                    <td data-label="Itens" className="num">{fmtNum(l.itens)}</td>
                    <td data-label="Laboratórios" className="num">{fmtNum(l.laboratorios)}</td>
                    <td data-label="Adesões" className="num">{fmtNum(l.adesoes)}</td>
                    <td data-label="Pessoas alcançadas (≈)" className="num">
                      {l.pessoasAlcancadasEstimado > 0 ? `≈ ${fmtNum(l.pessoasAlcancadasEstimado)}` : "n/d"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="plat-card">
        <h3>Rede de instituições</h3>
        <div className="plat-stats">
          <Stat label="Instituições (ROR distinto)" value={fmtNum(rede.instituicoesComRor)} />
          <Stat label="Países" value={fmtNum(rede.paises.length)} />
          <Stat label="UFs" value={fmtNum(rede.ufs.length)} />
          <Stat label="Membros sem ROR" value={fmtNum(rede.membrosSemRor)} />
        </div>
        <p className="plat-hint">
          Contado por ROR declarado (roster + parcerias confirmadas), nunca digitado.
          {rede.paises.length ? (
            <>
              {" "}
              Países: <strong>{rede.paises.join(", ")}</strong>.
            </>
          ) : null}
          {rede.ufs.length ? (
            <>
              {" "}
              UFs: <strong>{rede.ufs.join(", ")}</strong>.
            </>
          ) : null}
        </p>
      </div>
    </>
  );
}

// ====================================================== ABA 2 · PRODUÇÃO ===

function rotuloDoItemFora(item: ItemForaDoCiclo): string {
  const mapa =
    item.entidade === "producao"
      ? (ROTULO_TIPO_PRODUCAO as Record<string, string>)
      : (ROTULO_TIPO_FATO as Record<string, string>);
  return mapa[item.tipo] ?? item.tipo;
}

function AbaProducao({ dados }: { dados: DadosDoPainel }) {
  const { producao, foraDoPeriodo } = dados;
  const maxTipo = Math.max(1, ...producao.porTipo.map((t) => t.itens));
  const maxQualis = Math.max(1, ...producao.qualis.map((q) => q.itens));

  return (
    <>
      <div className="plat-stats">
        <Stat label="Produções contadas" value={fmtNum(producao.totalContado)} />
        <Stat label="Coautorias internas (1 item)" value={fmtNum(producao.compartilhadas)} />
        <Stat label="Fora do período (à parte)" value={fmtNum(foraDoPeriodo.length)} />
      </div>
      <p className="plat-hint">
        Conta aqui só o que tem competência neste ciclo e pelo menos um vínculo de membro, a mesma
        regra da view do banco. Item compartilhado por 2+ membros conta <strong>uma</strong> vez.
      </p>

      <div className="plat-card">
        <h3>Por tipo de produção</h3>
        {producao.porTipo.length === 0 ? (
          <p className="plat-empty">Nenhuma produção contada ainda.</p>
        ) : (
          <div className="pn-barras">
            {producao.porTipo.map((t) => (
              <Barra
                key={t.tipo}
                rotulo={ROTULO_TIPO_PRODUCAO[t.tipo]}
                valor={t.itens}
                max={maxTipo}
                unidade={["item", "itens"]}
                detalhe={`${fmtNum(t.nacionais)} nac. · ${fmtNum(t.internacionais)} int.${
                  t.ambitoNaoDefinido ? ` · ${fmtNum(t.ambitoNaoDefinido)} sem âmbito` : ""
                } · ${fmtNum(t.comAncoraResolvida)} com âncora resolvida`}
              />
            ))}
          </div>
        )}
        <p className="plat-hint">
          "Sem âmbito" = a coordenação ainda não homologou nacional/internacional. Não é "nacional
          por padrão".
        </p>
      </div>

      <div className="plat-card">
        <h3>Qualis dos artigos (campo manual e opcional)</h3>
        {producao.qualis.length === 0 ? (
          <p className="plat-empty">Nenhum artigo com Qualis informado ainda.</p>
        ) : (
          <div className="pn-barras">
            {producao.qualis.map((q) => (
              <Barra key={q.faixa} rotulo={q.faixa} valor={q.itens} max={maxQualis} unidade={["artigo", "artigos"]} />
            ))}
          </div>
        )}
        {producao.artigosSemQualis > 0 ? (
          <p className="plat-hint">
            {fmtNum(producao.artigosSemQualis)}{" "}
            {producao.artigosSemQualis === 1 ? "artigo ainda sem Qualis" : "artigos ainda sem Qualis"}. O
            campo é manual e opcional (decisão da 009); a distribuição acima cobre só quem informou.
          </p>
        ) : null}
      </div>

      <div className="plat-card">
        <h3>JCR (fator de impacto): mediana e faixa</h3>
        {producao.jcr.artigosComJcr === 0 ? (
          <p className="plat-empty">Nenhum artigo com JCR informado ainda.</p>
        ) : (
          <>
            <div className="plat-stats">
              <Stat
                label="Mediana"
                value={
                  producao.jcr.mediana === null
                    ? "n/d"
                    : producao.jcr.mediana.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
                }
              />
              <Stat
                label="Faixa (mín a máx)"
                value={
                  producao.jcr.minimo === null || producao.jcr.maximo === null
                    ? "n/d"
                    : `${producao.jcr.minimo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} a ${producao.jcr.maximo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`
                }
              />
              <Stat label="Artigos com JCR" value={fmtNum(producao.jcr.artigosComJcr)} />
              <Stat label="Sem JCR" value={fmtNum(producao.jcr.artigosSemJcr)} />
            </div>
            <p className="plat-hint">
              Mediana, nunca média: a média de fator de impacto é distorcida pela cauda e é
              exatamente o número que uma auditoria derrubaria.
            </p>
          </>
        )}
      </div>

      <div className="plat-card">
        <h3>Periódicos mais frequentes</h3>
        {producao.topPeriodicos.length === 0 ? (
          <p className="plat-empty">Nenhum periódico identificado nos metadados ainda.</p>
        ) : (
          <div className="edital-table-wrap">
            <table className="edital-table">
              <thead>
                <tr>
                  <th>Periódico</th>
                  <th className="num">Itens</th>
                </tr>
              </thead>
              <tbody>
                {producao.topPeriodicos.map((p) => (
                  <tr key={p.periodico}>
                    <td data-label="Periódico">{p.periodico}</td>
                    <td data-label="Itens" className="num">{fmtNum(p.itens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="plat-card pn-fora">
        <h3>Fora do período: não conta no ciclo</h3>
        <p className="plat-hint plat-warn">
          Itens aceitos com a data verdadeira e marcados: ficam <strong>fora de toda contagem</strong>{" "}
          até um ciclo cobri-los. Estão listados aqui para não sumirem: somá-los seria mentir.
        </p>
        {foraDoPeriodo.length === 0 ? (
          <p className="plat-empty">Nenhum item fora do período.</p>
        ) : (
          <div className="edital-table-wrap">
            <table className="edital-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {foraDoPeriodo.map((item) => (
                  <tr key={`${item.entidade}-${item.id}`}>
                    <td data-label="Item">{item.titulo}</td>
                    <td data-label="Tipo">{rotuloDoItemFora(item)}</td>
                    <td data-label="Data">{fmtData(item.data)}</td>
                    <td data-label="Situação">{ROTULO_PERIODO_SITUACAO[item.situacao]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// =================================================== ABA 3 · PESSOAS E RH ===

function AbaPessoas({ dados }: { dados: DadosDoPainel }) {
  const { rh } = dados;
  return (
    <>
      <p className="plat-hint">
        Contadores automáticos vêm dos fatos confirmados dos laboratórios;{" "}
        <strong>
          {rh.laboratoriosComAjuste} de {rh.laboratoriosComFatos}
        </strong>{" "}
        laboratórios com fatos ajustaram os automáticos, e o ajuste do líder <strong>vence</strong>,
        com a divergência exposta coluna a coluna.
      </p>

      <div className="plat-card">
        <h3>
          <GraduationCap size={18} aria-hidden="true" /> Estudantes ativos por nível
        </h3>
        <div className="edital-table-wrap">
          <table className="edital-table">
            <thead>
              <tr>
                <th>Nível</th>
                <th className="num">Contado automático</th>
                <th className="num">Valor final (ajuste vence)</th>
                <th className="num">Labs com ajuste</th>
              </tr>
            </thead>
            <tbody>
              {rh.estudantes.map((l) => (
                <tr key={l.chave}>
                  <td data-label="Nível">{ROTULO_NIVEL_ESTUDANTE[l.chave]}</td>
                  <td data-label="Contado automático" className="num">{fmtNum(l.contadoAutomatico)}</td>
                  <td data-label="Valor final" className="num">
                    <strong>{fmtNum(l.valorFinal)}</strong>
                  </td>
                  <td data-label="Labs com ajuste" className="num">
                    {l.laboratoriosComAjuste ? fmtNum(l.laboratoriosComAjuste) : "n/d"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rh.bolsasSemNivel.length ? (
          <p className="plat-hint">
            Modalidades de bolsa ativas sem nível de estudante correspondente (listadas, não somadas):{" "}
            <strong>{rh.bolsasSemNivel.join(", ")}</strong>.
          </p>
        ) : null}
      </div>

      <div className="plat-card">
        <h3>
          <GraduationCap size={18} aria-hidden="true" /> RH formado no período, por nível
        </h3>
        <div className="edital-table-wrap">
          <table className="edital-table">
            <thead>
              <tr>
                <th>Nível</th>
                <th className="num">Contado automático</th>
                <th className="num">Valor final (ajuste vence)</th>
                <th className="num">Labs com ajuste</th>
              </tr>
            </thead>
            <tbody>
              {rh.formados.map((l) => (
                <tr key={l.chave}>
                  <td data-label="Nível">
                    {ROTULO_CATEGORIA_FORMADO[l.chave]}
                    {!l.contavel && l.porQueNao ? <small className="pn-nota"> · {l.porQueNao}</small> : null}
                  </td>
                  <td data-label="Contado automático" className="num">
                    {l.contavel ? fmtNum(l.contadoAutomatico) : "n/d"}
                  </td>
                  <td data-label="Valor final" className="num">
                    {l.contavel ? <strong>{fmtNum(l.valorFinal)}</strong> : "n/d"}
                  </td>
                  <td data-label="Labs com ajuste" className="num">
                    {l.laboratoriosComAjuste ? fmtNum(l.laboratoriosComAjuste) : "n/d"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rh.formacoesForaDosNiveis > 0 ? (
          <p className="plat-hint">
            {fmtNum(rh.formacoesForaDosNiveis)}{" "}
            {rh.formacoesForaDosNiveis === 1
              ? "formação declarada fora dos níveis contáveis"
              : "formações declaradas fora dos níveis contáveis"}{" "}
            (técnica, comunitária…): registradas, não somadas nestas linhas.
          </p>
        ) : null}
      </div>
    </>
  );
}

// ============================================== ABA 4 · FOMENTO E EXTENSÃO ==

function AbaFomento({ dados }: { dados: DadosDoPainel }) {
  const { fomento, extensao } = dados;
  const maxProduto = Math.max(1, ...extensao.produtosPorTipo.map((p) => p.itens));

  return (
    <>
      <div className="plat-stats">
        <Stat label="Relatos com fomento" value={fmtNum(fomento.relatosComFomento)} />
        <Stat label="Total corrente (≈)" value={fmtBrl(fomento.totalCorrenteBrl)} />
        <Stat label="Total complementar (≈)" value={fmtBrl(fomento.totalComplementarBrl)} />
        <Stat label="Itens sem valor" value={fmtNum(fomento.itensSemValor)} />
      </div>
      <p className="plat-hint">
        <strong>Corrente</strong> = projetos citados como financiamento em curso;{" "}
        <strong>complementar</strong> = captação nova atraída pelo INCT, somados{" "}
        <strong>separadamente</strong>, porque o complementar é o argumento de renovação. Valores são
        estimativas declaradas pelos membros; itens sem valor ficam fora das somas (nunca NaN), mas
        contados.
      </p>

      <div className="plat-card">
        <h3>
          <HandCoins size={18} aria-hidden="true" /> Por agência de fomento
        </h3>
        {fomento.porAgencia.length === 0 ? (
          <p className="plat-empty">Nenhum fomento declarado ainda.</p>
        ) : (
          <div className="edital-table-wrap">
            <table className="edital-table">
              <thead>
                <tr>
                  <th>Agência</th>
                  <th className="num">Processos correntes</th>
                  <th className="num">Processos complementares</th>
                  <th className="num">Valor corrente (≈)</th>
                  <th className="num">Valor complementar (≈)</th>
                  <th className="num">Sem valor</th>
                </tr>
              </thead>
              <tbody>
                {fomento.porAgencia.map((a) => (
                  <tr key={a.agencia}>
                    <td data-label="Agência">{a.agencia}</td>
                    <td data-label="Processos correntes" className="num">{fmtNum(a.processosCorrente)}</td>
                    <td data-label="Processos complementares" className="num">{fmtNum(a.processosComplementar)}</td>
                    <td data-label="Valor corrente (≈)" className="num">{fmtBrl(a.valorCorrenteBrl)}</td>
                    <td data-label="Valor complementar (≈)" className="num">{fmtBrl(a.valorComplementarBrl)}</td>
                    <td data-label="Sem valor" className="num">{a.itensSemValor ? fmtNum(a.itensSemValor) : "n/d"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="plat-card">
        <h3>Processos declarados</h3>
        {fomento.processos.length === 0 ? (
          <p className="plat-empty">Nenhum processo declarado ainda.</p>
        ) : (
          <div className="edital-table-wrap">
            <table className="edital-table">
              <thead>
                <tr>
                  <th>Agência</th>
                  <th>Processo</th>
                  <th>Título</th>
                  <th className="num">Valor (≈)</th>
                  <th>Natureza</th>
                </tr>
              </thead>
              <tbody>
                {fomento.processos.map((p, i) => (
                  <tr key={`${p.agencia}-${p.processo}-${i}`}>
                    <td data-label="Agência">{p.agencia}</td>
                    <td data-label="Processo">{p.processo || "n/d"}</td>
                    <td data-label="Título">{p.titulo || "n/d"}</td>
                    <td data-label="Valor (≈)" className="num">
                      {p.valorBrl === null ? "sem valor" : fmtBrl(p.valorBrl)}
                    </td>
                    <td data-label="Natureza">{p.complementar ? "Complementar" : "Corrente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="plat-card">
        <h3>Extensão</h3>
        <p className="plat-hint">
          {fmtNum(extensao.relatosComExtensao)}{" "}
          {extensao.relatosComExtensao === 1
            ? "relato declarou projeto de extensão"
            : "relatos declararam projeto de extensão"}
          .
        </p>
        {extensao.produtosPorTipo.length === 0 ? (
          <p className="plat-empty">Nenhum produto de extensão declarado ainda.</p>
        ) : (
          <div className="pn-barras">
            {extensao.produtosPorTipo.map((p) => (
              <Barra
                key={p.tipo}
                rotulo={ROTULO_TIPO_PRODUCAO[p.tipo]}
                valor={p.itens}
                max={maxProduto}
                unidade={["item", "itens"]}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ================================================= ABA 5 · VOZES DA REDE ===

function AbaVozes({ dados }: { dados: DadosDoPainel }) {
  const { dificuldades, oportunidades } = dados;
  const maxDif = Math.max(1, ...dificuldades.map((d) => d.relatos));
  const maxOp = Math.max(1, ...oportunidades.map((o) => o.relatos));

  return (
    <>
      <p className="plat-hint">
        Contagem das categorias marcáveis dos relatos (enviados e rascunhos): "atraso de recursos
        apareceu em N relatos" é o número que vira argumento na renovação. Zero também é dado: a
        ausência de marcação aparece, não some.
      </p>

      <div className="plat-card">
        <h3>
          <Megaphone size={18} aria-hidden="true" /> Dificuldades relatadas
        </h3>
        {dificuldades.length === 0 ? (
          <p className="plat-empty">Nenhuma categoria de dificuldade configurada.</p>
        ) : (
          <div className="pn-barras">
            {dificuldades.map((d) => (
              <Barra key={d.id} rotulo={d.rotulo} valor={d.relatos} max={maxDif} unidade={["relato", "relatos"]} />
            ))}
          </div>
        )}
      </div>

      <div className="plat-card">
        <h3>
          <Megaphone size={18} aria-hidden="true" /> Oportunidades apontadas
        </h3>
        {oportunidades.length === 0 ? (
          <p className="plat-empty">Nenhuma categoria de oportunidade configurada.</p>
        ) : (
          <div className="pn-barras">
            {oportunidades.map((o) => (
              <Barra key={o.id} rotulo={o.rotulo} valor={o.relatos} max={maxOp} unidade={["relato", "relatos"]} />
            ))}
          </div>
        )}
      </div>

      <p className="plat-hint">
        O texto livre de dificuldades e oportunidades vai direto ao Comitê Gestor e não é agregado
        aqui: prosa não se tabula; as categorias existem exatamente para isso.
      </p>
    </>
  );
}

// ============================================== ABA 6 · METAS E OBJETIVOS ===

function AbaMetas({ dados }: { dados: DadosDoPainel }) {
  const { pactuados, objetivos } = dados;

  return (
    <>
      {pactuados.aviso ? <p className="plat-hint plat-warn">{pactuados.aviso}</p> : null}
      <p className="plat-hint">
        Regra da casa: <strong>nenhum percentual de meta</strong>. Onde a correspondência entre o
        declarado e um número pactuado é direta e documentável, os dois aparecem lado a lado. Quem
        lê compara. Onde não é, o pactuado fica listado como "sem medição automática": visível, não
        sumido.
      </p>

      <div className="plat-card">
        <h3>
          <Target size={18} aria-hidden="true" /> Pactuado × declarado (só correspondências diretas)
        </h3>
        {pactuados.medidos.length === 0 ? (
          <p className="plat-empty">Nenhuma correspondência direta configurada neste ciclo.</p>
        ) : (
          <div className="edital-table-wrap">
            <table className="edital-table">
              <thead>
                <tr>
                  <th>Chave</th>
                  <th>O quê</th>
                  <th>Pactuado</th>
                  <th className="num">Declarado até agora</th>
                  <th>Como foi medido</th>
                </tr>
              </thead>
              <tbody>
                {pactuados.medidos.map((m) => (
                  <tr key={m.chave}>
                    <td data-label="Chave">
                      <strong>{m.chave}</strong> <small>Meta {m.meta}</small>
                    </td>
                    <td data-label="O quê">{m.oQue}</td>
                    <td data-label="Pactuado">{m.pactuado}</td>
                    <td data-label="Declarado até agora" className="num">
                      <strong>{fmtNum(m.declarado)}</strong> <small>{m.unidade}</small>
                    </td>
                    <td data-label="Como foi medido">
                      <small>{m.comoFoiMedido}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="plat-hint">
          "Declarado até agora" é contagem sobre o recorte parcial lá de cima: nunca percentual, e
          nunca projeção sem rótulo de projeção.
        </p>
      </div>

      <div className="plat-card">
        <h3>Objetivos confirmados nos relatos (Q20)</h3>
        <p className="plat-hint">
          {fmtNum(objetivos.relatosQueResponderam)}{" "}
          {objetivos.relatosQueResponderam === 1 ? "relato confirmou" : "relatos confirmaram"} pelo
          menos um objetivo.{" "}
          {objetivos.semNenhumaConfirmacao.length ? (
            <>
              <strong>{fmtNum(objetivos.semNenhumaConfirmacao.length)} objetivos sem nenhuma
              confirmação</strong>,{" "}
              o buraco a resolver antes do relatório: obj.{" "}
              {objetivos.semNenhumaConfirmacao.join(", ")}.
            </>
          ) : (
            "Todos os objetivos têm ao menos uma confirmação."
          )}
        </p>
        <ul className="pn-objetivos" aria-label="Confirmações por objetivo">
          {objetivos.confirmacoes.map((c) => (
            <li
              key={c.numero}
              className={c.relatosConfirmaram === 0 ? "pn-obj pn-obj-zero" : "pn-obj"}
              aria-label={`Objetivo ${c.numero}: ${extenso(c.relatosConfirmaram)} ${
                c.relatosConfirmaram === 1 ? "relato confirmou" : "relatos confirmaram"
              }`}
            >
              <strong>{c.numero}</strong>
              <span>{fmtNum(c.relatosConfirmaram)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="plat-card">
        <h3>Pactuados sem medição automática ({fmtNum(pactuados.semMedicaoAutomatica.length)})</h3>
        <p className="plat-hint">
          Estes números da proposta não têm correspondência direta nos dados coletados: medi-los
          exigiria mapeamento que não existe, e inventá-lo seria a mentira mais cara deste módulo.
          Ficam listados para ninguém esquecer que existem.
        </p>
        {pactuados.semMedicaoAutomatica.length === 0 ? (
          <p className="plat-empty">Todos os pactuados têm medição automática.</p>
        ) : (
          <div className="edital-table-wrap">
            <table className="edital-table">
              <thead>
                <tr>
                  <th>Chave</th>
                  <th>O quê</th>
                  <th>Pactuado</th>
                </tr>
              </thead>
              <tbody>
                {pactuados.semMedicaoAutomatica.map((p) => (
                  <tr key={p.chave}>
                    <td data-label="Chave">
                      <strong>{p.chave}</strong> <small>Meta {p.meta}</small>
                    </td>
                    <td data-label="O quê">{p.oQue}</td>
                    <td data-label="Pactuado">{p.pactuado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ====================================================== ABA 7 · EXPORTAR ===

/**
 * "Baixar" de um anexo: a URL é ASSINADA e expira — gerada no clique, nunca na
 * carga (uma lista com 50 URLs geradas na montagem estaria toda vencida quando
 * a coordenação voltasse à aba uma hora depois).
 */
function BotaoBaixarAnexo({ arquivo }: { arquivo: RelatoArquivo }) {
  const [estado, setEstado] = useState<"pronto" | "gerando" | "falhou">("pronto");
  return (
    <button
      className="button plat-ghost pn-doc-baixar"
      disabled={estado === "gerando"}
      onClick={async () => {
        setEstado("gerando");
        try {
          const url = await urlAssinadaDeArquivo(arquivo.storage_path, 300);
          window.open(url, "_blank", "noopener");
          setEstado("pronto");
        } catch {
          setEstado("falhou");
        }
      }}
      aria-label={`Baixar ${arquivo.file_name}`}
    >
      {estado === "gerando" ? (
        "Gerando…"
      ) : estado === "falhou" ? (
        "Não deu, tente de novo"
      ) : (
        <>
          <Download size={14} aria-hidden="true" /> Baixar
        </>
      )}
    </button>
  );
}

/**
 * Os documentos que os pesquisadores anexaram aos relatos (o .docx com dados
 * da pesquisa da 011, e os PDFs/imagens de sempre) — a metade da coordenação
 * do recurso: sem esta lista, o anexo seria um buraco negro igual ao e-mail.
 * A carga é própria da seção (não entra em `carregarDadosDoPainel`): a lista
 * só interessa aqui, e pessoa/laboratório saem de `dados.brutos` sem leitura
 * extra.
 */
function DocumentosAnexados({ dados }: { dados: DadosDoPainel }) {
  const cicloId = dados.recorte.cicloId;
  const [arquivos, setArquivos] = useState<RelatoArquivo[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    setArquivos(null);
    setErro("");
    listarArquivosDosRelatosDoCiclo(cicloId)
      .then((a) => {
        if (vivo) setArquivos(a);
      })
      .catch((e) => {
        if (!vivo) return;
        setArquivos([]);
        setErro(e instanceof Error ? e.message : "Não foi possível listar os documentos agora.");
      });
    return () => {
      vivo = false;
    };
  }, [cicloId]);

  const { linhas, relatosEnviadosComAnexo, relatosRascunhoComAnexo, totalBytes } = useMemo(() => {
    const relatoPorId = new Map(dados.brutos.relatos.map((r) => [r.id, r]));
    const membroPorId = new Map(dados.brutos.membros.map((m) => [m.id, m]));
    const labPorId = new Map(dados.brutos.laboratorios.map((l) => [l.id, l]));
    const enviados = new Set<string>();
    const rascunhos = new Set<string>();
    let bytes = 0;
    const linhas = (arquivos ?? [])
      .map((arquivo) => {
        const relato = arquivo.relato_id ? relatoPorId.get(arquivo.relato_id) : undefined;
        const membro = relato?.membro_id ? membroPorId.get(relato.membro_id) : undefined;
        const lab = membro?.laboratorio_id ? labPorId.get(membro.laboratorio_id) : undefined;
        if (relato) (relato.status === "rascunho" ? rascunhos : enviados).add(relato.id);
        bytes += arquivo.bytes;
        return {
          arquivo,
          pessoa: membro?.nome ?? "Sem vínculo no roster",
          laboratorio: lab ? lab.sigla : "n/d",
        };
      })
      .sort((a, b) => b.arquivo.created_at.localeCompare(a.arquivo.created_at));
    return {
      linhas,
      relatosEnviadosComAnexo: enviados.size,
      relatosRascunhoComAnexo: rascunhos.size,
      totalBytes: bytes,
    };
  }, [arquivos, dados.brutos]);

  return (
    <div className="plat-card">
      <h3>
        <Paperclip size={18} aria-hidden="true" /> Documentos anexados
      </h3>
      {arquivos === null ? (
        <p className="plat-empty">Carregando os documentos…</p>
      ) : (
        <>
          <p className="plat-hint">
            <strong>
              {fmtNum(relatosEnviadosComAnexo)} de {fmtNum(dados.recorte.relatosEnviados)}
            </strong>{" "}
            relatos enviados têm documento anexado
            {relatosRascunhoComAnexo > 0
              ? ` (e mais ${fmtNum(relatosRascunhoComAnexo)} em rascunho)`
              : ""}
            {": "}
            {fmtNum(linhas.length)} {linhas.length === 1 ? "arquivo" : "arquivos"}, somando{" "}
            <strong>{fmtBytes(totalBytes)}</strong>. O plano do Supabase dá <strong>1 GB</strong> de
            storage; este somatório é o consumo a vigiar.
          </p>
          {erro ? <p className="plat-error">{erro}</p> : null}
          {linhas.length === 0 ? (
            <p className="plat-empty">Nenhum documento anexado até agora.</p>
          ) : (
            <div className="edital-table-wrap">
              <table className="edital-table">
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th>Laboratório</th>
                    <th>Arquivo</th>
                    <th>Anexado em</th>
                    <th className="num">
                      <span className="sr-only">Baixar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ arquivo, pessoa, laboratorio }) => (
                    <tr key={arquivo.id}>
                      <td data-label="Pessoa">{pessoa}</td>
                      <td data-label="Laboratório">{laboratorio}</td>
                      <td data-label="Arquivo" className="pn-doc-nome">
                        {arquivo.file_name}
                        <small>
                          {fmtBytes(arquivo.bytes)} · {ROTULO_USO_ARQUIVO[arquivo.uso]}
                        </small>
                      </td>
                      <td data-label="Anexado em">{fmtDataHora(arquivo.created_at)}</td>
                      <td data-label="Baixar" className="num">
                        <BotaoBaixarAnexo arquivo={arquivo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="plat-hint">
            O documento com dados da pesquisa entra em Word (.docx, até 10 MB) na tela de revisão do
            Relatório Anual de Atividades. O .doc de 2003 não é aceito; quem tiver, salva como
            .docx. O link de download é assinado e expira em minutos: gere na hora de usar.
          </p>
        </>
      )}
    </div>
  );
}

function AbaExportar({ dados }: { dados: DadosDoPainel }) {
  const slug = dados.recorte.cicloSlug;
  const [minuta, setMinuta] = useState<SecaoDaMinuta[] | null>(null);

  const minutaMd = useMemo(() => {
    if (!minuta) return "";
    return (
      `# Minuta do Relatório Anual: ${dados.recorte.cicloTitulo}\n\n` +
      `> ${dados.recorte.frase}\n\n` +
      minuta.map((s) => `## ${s.titulo}\n\n${s.texto}\n\n_Fonte: ${s.fonte}_`).join("\n\n")
    );
  }, [minuta, dados.recorte]);

  return (
    <>
      <p className="plat-hint">
        Todos os arquivos saem do mesmo agregado exibido nas abas, e carregam o mesmo recorte de
        parcialidade. Produção fora do período nunca sai como contada.
      </p>

      <div className="plat-card">
        <h3>
          <Download size={18} aria-hidden="true" /> Planilhas e dados
        </h3>
        <div className="pn-export-botoes">
          <button
            className="button plat-ghost"
            onClick={() => baixarArquivo(`producoes-${slug}.csv`, csvProducoes(dados), "text/csv;charset=utf-8")}
          >
            CSV · Produções <Download size={15} aria-hidden="true" />
          </button>
          <button
            className="button plat-ghost"
            onClick={() => baixarArquivo(`pessoas-rh-${slug}.csv`, csvPessoasRh(dados), "text/csv;charset=utf-8")}
          >
            CSV · Pessoas e RH <Download size={15} aria-hidden="true" />
          </button>
          <button
            className="button plat-ghost"
            onClick={() => baixarArquivo(`fomento-${slug}.csv`, csvFomento(dados), "text/csv;charset=utf-8")}
          >
            CSV · Fomento <Download size={15} aria-hidden="true" />
          </button>
          <button
            className="button plat-ghost"
            onClick={() =>
              baixarArquivo(
                `ciclo-${slug}.json`,
                JSON.stringify(envelopeDoCiclo(dados), null, 2),
                "application/json",
              )
            }
          >
            JSON do ciclo (envelope §2.1) <Download size={15} aria-hidden="true" />
          </button>
        </div>
        <p className="plat-hint">
          O JSON segue o formato de envelope de <code>types.ts</code>: é o que o relatório de 2027
          vai ler; não invente formato paralelo.
        </p>
      </div>

      <DocumentosAnexados dados={dados} />

      <div className="plat-card">
        <h3>
          <FileText size={18} aria-hidden="true" /> Minuta do relatório: seção a seção
        </h3>
        <p className="plat-hint">
          Texto <strong>factual, sem adjetivo</strong>, o mesmo princípio do resto do módulo: os
          números falam; "importante" e "expressivo" ficam para quem assina. Copie cada seção para o
          documento da coordenação, ou baixe tudo em Markdown.
        </p>
        {minuta === null ? (
          <p className="plat-nav">
            <button className="button primary" onClick={() => setMinuta(minutaDoRelatorio(dados))}>
              Gerar a minuta <FileText size={15} aria-hidden="true" />
            </button>
          </p>
        ) : (
          <>
            <p className="plat-nav">
              <button
                className="button primary"
                onClick={() => baixarArquivo(`minuta-relatorio-${slug}.md`, minutaMd, "text/markdown;charset=utf-8")}
              >
                Baixar tudo (.md) <Download size={15} aria-hidden="true" />
              </button>
            </p>
            {minuta.map((s) => (
              <section key={s.id} className="pn-minuta-secao">
                <header className="pn-minuta-cabecalho">
                  <h4>{s.titulo}</h4>
                  <BotaoCopiar texto={s.texto} rotulo={`Copiar a seção ${s.titulo}`} />
                </header>
                <p className="pn-minuta-texto">{s.texto}</p>
                <p className="pn-minuta-fonte">Fonte: {s.fonte}</p>
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ painel --

type Fase = "carregando" | "sem-ciclo" | "sem-acesso" | "pronto" | "erro";

const ROTULO_ABA: Record<Aba, string> = {
  visao: "Visão geral",
  producao: "Produção",
  pessoas: "Pessoas e RH",
  fomento: "Fomento e extensão",
  vozes: "Vozes da rede",
  metas: "Metas e objetivos",
  exportar: "Exportar",
};

function IconeDaAba({ aba }: { aba: Aba }) {
  const props = { size: 15, "aria-hidden": true } as const;
  switch (aba) {
    case "visao":
      return <BarChart3 {...props} />;
    case "producao":
      return <FileText {...props} />;
    case "pessoas":
      return <GraduationCap {...props} />;
    case "fomento":
      return <HandCoins {...props} />;
    case "vozes":
      return <Megaphone {...props} />;
    case "metas":
      return <Target {...props} />;
    case "exportar":
      return <Download {...props} />;
  }
}

export default function PainelRelatorio({ email }: { email?: string | undefined }) {
  const [fase, setFase] = useState<Fase>("carregando");
  const [erro, setErro] = useState("");
  const [ciclo, setCiclo] = useState<RelatorioCiclo | null>(null);
  const [papel, setPapel] = useState<PapelNoCiclo | null>(null);
  const [dados, setDados] = useState<DadosDoPainel | null>(null);
  const [geradoEm, setGeradoEm] = useState<Date>(() => new Date());
  const [atualizando, setAtualizando] = useState(false);
  const [erroAtualizar, setErroAtualizar] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [aba, setAba] = useState<Aba>(() => abaDaHash());

  // A aba persiste na hash (?area=relatorio&pn=producao) para link direto e F5;
  // link clicado com o painel montado é resincronizado pelo hashchange.
  useEffect(() => {
    const sync = () => setAba(abaDaHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const trocarAba = (proxima: Aba) => {
    setAba(proxima);
    gravarAbaNaHash(proxima);
  };

  useEffect(() => {
    // A Gestão já barra quando a plataforma não está configurada; esta checagem
    // é cinto de segurança para o caso de o componente ser montado por fora.
    if (!relatoDisponivel()) {
      setErro("A plataforma não está configurada neste ambiente.");
      setFase("erro");
      return;
    }
    let vivo = true;
    setFase("carregando");
    setErro("");
    (async () => {
      try {
        const c = await cicloAberto();
        if (!vivo) return;
        if (!c) {
          setFase("sem-ciclo");
          return;
        }
        setCiclo(c);

        // O papel vem do roster do CICLO (RPC), não de profiles.role. Falha da
        // RPC (ex.: usuário fora do roster) é tratada como "sem papel".
        let p: PapelNoCiclo | null = null;
        try {
          p = await meuPapel(c.id);
        } catch {
          p = null;
        }
        // SEM PAPEL AINDA NÃO É ERRO: antes de qualquer tela de "sem acesso",
        // tenta o vínculo SILENCIOSO por e-mail pré-autorizado (RPC
        // `vincular_meu_cadastro`, 006, consertada pela 013). É ESTE o caminho
        // do coordenador: a 013 põe a linha dele no roster com o e-mail real, e
        // o primeiro login que passar por aqui casa o user_id sem que ele veja
        // erro nenhum. Para quem não tem linha pré-autorizada a chamada devolve
        // 0 e nada muda; ela nunca lança.
        if (p === null) {
          const vinculados = await vincularMeuCadastro();
          if (vinculados > 0) {
            try {
              p = await meuPapel(c.id);
            } catch {
              p = null;
            }
          }
        }
        if (!vivo) return;
        setPapel(p);
        if (p !== "coordenacao" && p !== "cges") {
          setFase("sem-acesso");
          return;
        }

        const d = await carregarDadosDoPainel(c);
        if (!vivo) return;
        setDados(d);
        setGeradoEm(new Date());
        setFase("pronto");
      } catch (e) {
        if (!vivo) return;
        setErro(e instanceof Error ? e.message : "Não foi possível carregar o painel agora.");
        setFase("erro");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  /** Recarrega os dados SEM derrubar o painel — o erro aparece na moldura. */
  const atualizar = async () => {
    if (!ciclo || atualizando) return;
    setAtualizando(true);
    setErroAtualizar("");
    try {
      const d = await carregarDadosDoPainel(ciclo);
      setDados(d);
      setGeradoEm(new Date());
    } catch (e) {
      setErroAtualizar(e instanceof Error ? e.message : "Não foi possível atualizar agora.");
    } finally {
      setAtualizando(false);
    }
  };

  // -------------------------------------------------------------------- UI --
  if (fase === "carregando") {
    return (
      <div className="rel-gestao">
        <CartoesDeAcesso papel={papel} />
        <Esqueleto />
      </div>
    );
  }

  if (fase === "erro") {
    return (
      <div className="rel-gestao">
        <CartoesDeAcesso papel={papel} />
        <div className="plat-card">
          <p className="plat-error">{erro}</p>
          <p className="plat-nav">
            <button className="button primary" onClick={() => setTentativa((t) => t + 1)}>
              <RefreshCw size={15} aria-hidden="true" /> Tentar de novo
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (fase === "sem-ciclo") {
    return (
      <div className="rel-gestao">
        <CartoesDeAcesso papel={papel} />
        <SemCiclo />
      </div>
    );
  }

  if (fase === "sem-acesso") {
    return (
      <div className="rel-gestao">
        <CartoesDeAcesso papel={papel} />
        {/* Identificou-se pela busca? Recarregar tudo: o papel novo decide o
            que aparece (o gate por papel dos cartões e do painel já cuida). */}
        <SemAcesso papel={papel} email={email} onIdentificado={() => setTentativa((t) => t + 1)} />
      </div>
    );
  }

  if (!ciclo || !dados) return null; // impossível em "pronto"; acalma o narrowing

  return (
    <div className="rel-gestao">
      <CartoesDeAcesso papel={papel} />

      {/* A linha "título do ciclo · período reportável · janela de envio"
          morava aqui; removida a pedido do dono (11/08/2026), na sequência da
          nota dos formulários. Período e prazo continuam disponíveis dentro
          dos próprios formulários e no config do ciclo. */}

      {/* A moldura de honestidade: visível em TODAS as abas, antes de qualquer
          número — nenhuma métrica deste painel existe sem o recorte ao lado. */}
      <MolduraDoRecorte
        recorte={dados.recorte}
        geradoEm={geradoEm}
        atualizando={atualizando}
        erro={erroAtualizar}
        onAtualizar={() => void atualizar()}
      />

      <nav className="plat-tabs pn-abas" aria-label="Seções do painel do Relatório Anual">
        {ABAS.map((a) => (
          <button key={a} className={aba === a ? "active" : ""} onClick={() => trocarAba(a)}>
            <IconeDaAba aba={a} /> {ROTULO_ABA[a]}
          </button>
        ))}
      </nav>

      {aba === "visao" ? (
        <AbaVisaoGeral dados={dados} ciclo={ciclo} />
      ) : aba === "producao" ? (
        <AbaProducao dados={dados} />
      ) : aba === "pessoas" ? (
        <AbaPessoas dados={dados} />
      ) : aba === "fomento" ? (
        <AbaFomento dados={dados} />
      ) : aba === "vozes" ? (
        <AbaVozes dados={dados} />
      ) : aba === "metas" ? (
        <AbaMetas dados={dados} />
      ) : (
        <AbaExportar dados={dados} />
      )}
    </div>
  );
}
