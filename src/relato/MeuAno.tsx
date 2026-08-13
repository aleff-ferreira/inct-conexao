/**
 * ============================================================================
 *  #/relatorio-anual — RELATÓRIO ANUAL DE ATIVIDADES, o relato individual dos
 *  209 membros da rede (§3.1)
 * ============================================================================
 *  NOME DO ARQUIVO: `MeuAno.tsx` é legado do nome antigo do formulário. O
 *  título em tela virou "Relatório Anual de Atividades" (renomeação de
 *  2026-08) e a rota canônica é `#/relatorio-anual`; `#/meu-ano` segue como
 *  alias permanente no roteador. O arquivo não foi renomeado porque isso
 *  tocaria todos os imports de uma vez — estabilidade primeiro.
 * ----------------------------------------------------------------------------
 *  Este arquivo é SÓ TELA. Toda ida ao banco passa por `api.ts`, toda regra de
 *  campo por `validation.ts`, toda resolução de metadado por `metadados.ts` e
 *  todo rótulo por `config.ts`. Nada aqui inventa dado, e nada aqui grava sem
 *  passar por uma dessas quatro portas.
 *
 *  AS QUATRO COISAS QUE DECIDEM SE A PESSOA TERMINA
 *  -----------------------------------------------
 *  1. A PORTA diz, na primeira frase, que isto NÃO é prestação de contas ao
 *     CNPq (essa vence aos 24 meses). Quem acha que está prestando contas
 *     responde com medo, e medo aqui vira campo vazio ou campo bonito.
 *  2. A SAÍDA DE DIGNIDADE foi REMOVIDA da tela a pedido do dono (2026-08-07):
 *     o atalho "neste ciclo não tive produção nem atividade para relatar" saiu
 *     da Tela 1 junto com a mensagem que o apresentava. O estado
 *     `nada_a_declarar` continua existindo no banco (`relatos_resultado` tem o
 *     `or nada_a_declarar`) e o DESFAZER continua na revisão — quem marcou a
 *     saída enquanto ela existiu precisa conseguir voltar atrás; só não há
 *     mais porta de entrada nova.
 *  3. O CAMPO DE DIFICULDADES carrega, ao lado, a nota de que vai direto ao
 *     Comitê Gestor, não passa pelo(a) líder do laboratório e não é publicado.
 *     Sem ela o corpus vem cheio de "sem dificuldades" — e um corpus assim é
 *     depois citado como evidência de que a rede não teve problemas.
 *  4. ITEM FORA DO PERÍODO É ACEITO, com a data verdadeira, marcado, e fora da
 *     contagem. Recusar criaria incentivo a adulterar a data, que é exatamente
 *     o dado que o CNPq vai auditar em 2027.
 *
 *  PROGRESSO EM MINUTOS, NUNCA EM PORCENTAGEM: "Tela 2 de 5 · faltam ~5 min".
 *  Porcentagem de formulário mede campos preenchidos, não esforço restante, e
 *  por isso mente justamente onde a pessoa está decidindo se continua.
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarX2,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FlaskConical,
  Info,
  ListPlus,
  Loader2,
  LogOut,
  Mail,
  Paperclip,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";

import { temSenhaAtiva, useAuth } from "../platform/auth";
import type { AuthState } from "../platform/auth";
import { conviteDaHash, RELATORIO_LAB_HREF } from "../webinars/router";
import PasswordCard from "../platform/PasswordCard";

/**
 * A porta de entrada agora COMEÇA pela identificação: a pessoa se encontra numa
 * busca sobre a equipe da proposta, confere o que o catálogo sabe dela e só
 * então diz em que e-mail quer receber o link. Tudo isso — combobox, cartão,
 * reivindicação — vive em BuscaPesquisador.tsx, que também guarda a porta
 * clássica (e-mail + senha) atrás de "não encontrei meu nome".
 */
import PortaComBusca, {
  CartaoDoCatalogo,
  carregarCatalogo,
  escolhaLembrada,
  esquecerEscolha,
  IdentificacaoComSessao,
  pessoaPorId,
  reivindicarCadastro,
} from "./BuscaPesquisador";
import type { PessoaDoCatalogo } from "./BuscaPesquisador";

import {
  abrirRelato,
  aderirAoFato,
  atualizarMeuCadastro,
  atualizarProducao,
  atualizarVinculo,
  checarAncora,
  cicloAberto,
  desaderirDoFato,
  enviarArquivo,
  enviarRelato,
  erroDeRelato,
  listarArquivos,
  listarAutores,
  listarFatosDoLaboratorio,
  listarLaboratorios,
  listarMinhasProducoes,
  membroPorConvite,
  meuVinculo,
  MIME_DOCX,
  minhasAdesoes,
  proporFato,
  registrarProducao,
  relatoDisponivel,
  removerArquivo,
  removerVinculo,
  salvarRascunho,
} from "./api";
import type { NovaProducao, PatchMembro, PatchProducao, PatchRelato, ProducaoDoRelato } from "./api";

import {
  ANCORA_SUGERIDA_POR_TIPO,
  MENSAGEM_PERIODO_SITUACAO,
  OBJETIVOS_POR_EET,
  ROTULO_PAPEL,
  ROTULO_PERIODO_SITUACAO,
  ROTULO_TIPO_FATO,
  ROTULO_TIPO_PRODUCAO,
  TIPOS_FATO,
  TIPOS_PRODUCAO,
  TIPOS_PRODUCAO_LISTA_CURTA,
  eetsDoCiclo,
  fraseDeAgradecimento,
  objetivosDosEets,
  podeCopiarAgradecimento,
  processoDoCiclo,
} from "./config";
import type { DerivacaoDeObjetivos } from "./config";

import { detectarTipoAncora, mensagemDedupe, separarColagem, valorParaGravar } from "./dedupe";
import {
  buscarArtigosDoScholar,
  extrairScholarId,
  fraseDeProcedencia,
  obterIndicadores,
  patchDeIndicadores,
  resolverArtigoADoi,
} from "./indicadores";
import type { Indicadores, IndicadoresFonte, MotivoIndicadores } from "./indicadores";
import {
  DIFICULDADES_OPCOES,
  OPORTUNIDADES_OPCOES,
  alternarCategoria,
  rotulosDe,
  sugerirResultado,
  tituloDoCsl,
  veiculoDoCsl,
} from "./narrativa";

import {
  buscarOrcidPorNome,
  CONCORRENCIA,
  executarComConcorrencia,
  normalizarTitulo,
  resolverDoi,
  resolverIsbn,
  resolverLote,
  separarPorPeriodo,
  trabalhosDoOrcid,
} from "./metadados";
import type { CandidatoOrcid, MetadadosNormalizados } from "./metadados";

import {
  LIMITES,
  MENSAGENS,
  PERIODO_CICLO_1,
  QUALIS_OPCOES,
  avaliarData,
  contarCaracteres,
  dataBr,
  hojeIso,
  mascararOrcid,
  qualisOuNull,
  validarInteiroOpcional,
  validarJcr,
  validarLattes,
  validarOrcid,
  validarResultadoPrincipal,
  validarTextoOpcional,
  validarTitulo,
  validarValorBrl,
} from "./validation";
import type { Periodo } from "./validation";

import type {
  AncoraTipo,
  CicloMembro,
  ExtensaoResposta,
  Fato,
  FatoParticipante,
  FomentoItem,
  Laboratorio,
  MetadadosCsl,
  Narrativas,
  PeriodoSituacao,
  Producao,
  Qualis,
  Relato,
  RelatoArquivo,
  RelatorioCiclo,
  RespostasRelato,
  TipoFato,
  TipoProducao,
} from "./types";

// ================================ 0. PATCHES DA 009 (Forms do CTC), LOCAIS ===
/*
 * A 009 acrescentou colunas que os patch-types de `api.ts` (escritos na 005)
 * ainda não listam. As extensões vivem AQUI, não em `api.ts`, porque este
 * arquivo é o único que as usa e `api.ts` pertence a outra frente de trabalho
 * (regra de arquivos da integração). São SUPERTIPOS estruturais dos originais:
 * um valor destes tipos é aceito por `atualizarMeuCadastro`/`salvarRascunho`/
 * `atualizarProducao` sem cast, e o PostgREST grava as colunas novas porque a
 * RLS as permite (membros_self_update para os 4 de `ciclo_membros`;
 * relatos_owner_update para `respostas`; producoes_update para jcr/qualis).
 */
/**
 * As três colunas da 010 (`scholar_id`, `indicadores_fonte`,
 * `indicadores_atualizado_em`). Declaradas AQUI e não lidas de `CicloMembro`
 * porque `types.ts` pertence a outra frente e ainda não as espelha — e porque
 * `atualizarMeuCadastro` faz `.select()` sem lista de colunas, então a linha
 * que volta do PostgREST já as traz mesmo sem o tipo saber. Quando `types.ts`
 * as declarar, esta intersecção continua válida e vira redundância inofensiva.
 */
type Colunas010 = {
  scholar_id?: string | null;
  indicadores_fonte?: IndicadoresFonte | null;
  indicadores_atualizado_em?: string | null;
};

type PatchMembroGforms = PatchMembro &
  Partial<Pick<CicloMembro, "ppg" | "indice_h" | "total_citacoes" | "satisfacao">> &
  Colunas010;
type PatchRelatoGforms = PatchRelato & { respostas?: RespostasRelato };
type PatchProducaoGforms = PatchProducao & { jcr?: number | null; qualis?: Qualis | null };

// ============================================================ 1. AS TELAS ===

type Passo = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Os minutos de cada tela saem da §3.1, ajustados na integração do Forms do
 * CTC (2026-08): a Tela 1 ganhou o bloco opcional de pós-graduação e
 * indicadores, a Tela 3 ganhou a confirmação de objetivos e nasceu a Tela 4
 * (Fomento e extensão — quem não tem nada passa em segundos). Somados dão
 * ~7 min; a porta promete "cerca de 8 minutos" porque a promessa tem de ser
 * folgada — prometer menos do que custa é o jeito mais rápido de a pessoa
 * fechar a aba na metade.
 */
const TELAS: readonly { n: Passo; titulo: string; subtitulo: string; minutos: number }[] = [
  {
    n: 1,
    titulo: "Confirme quem é você",
    subtitulo:
      "O que a proposta registrou sobre você já veio preenchido. Confira, e complete só o que falta: o laboratório e o ORCID.",
    minutos: 0.7,
  },
  {
    n: 2,
    titulo: "Confira a produção que encontramos",
    subtitulo: "Um toque por item. O que não estiver aqui, você cola o DOI ou registra à mão.",
    minutos: 1.5,
  },
  {
    n: 3,
    titulo: "O que o seu laboratório fez, e você participou",
    subtitulo: "Nada para digitar: marque de quais atividades você participou.",
    minutos: 1.2,
  },
  {
    n: 4,
    titulo: "Fomento e extensão",
    subtitulo: "Projetos, financiamento complementar e extensão. Tudo opcional. Sem nada a declarar, é só continuar.",
    minutos: 0.7,
  },
  {
    n: 5,
    titulo: "Em suas palavras",
    subtitulo: "É aqui que o relatório para gestores e para a sociedade nasce.",
    minutos: 2.5,
  },
  {
    n: 6,
    titulo: "Revise e envie",
    subtitulo: "Confira o que será enviado. Você pode voltar a qualquer tela.",
    minutos: 0.7,
  },
];

const TOTAL_TELAS = TELAS.length;

/** Minutos que faltam a partir da tela atual, arredondados para cima. */
function minutosRestantes(passo: Passo): number {
  const soma = TELAS.filter((t) => t.n >= passo).reduce((acc, t) => acc + t.minutos, 0);
  return Math.max(1, Math.ceil(soma));
}

// ======================================================= 2. HELPERS PUROS ===

function hhmm(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** O `title` do CSL-JSON vem como string ou array; nenhum dos dois é garantido. */
function tituloDaProducao(p: Producao): string {
  const t = p.metadados?.title;
  const texto = Array.isArray(t) ? t[0] : t;
  if (typeof texto === "string" && texto.trim()) return texto.trim();
  return p.ancora_valor;
}

function veiculoDaProducao(p: Producao): string {
  const v = p.metadados?.["container-title"];
  const texto = Array.isArray(v) ? v[0] : v;
  return typeof texto === "string" ? texto.trim() : "";
}

/** O período REPORTÁVEL vem do banco; `PERIODO_CICLO_1` só cobre a porta (sem sessão). */
function periodoDoCiclo(ciclo: RelatorioCiclo | null): Periodo {
  if (!ciclo) return PERIODO_CICLO_1;
  return { inicio: ciclo.periodo_inicio, fim: ciclo.periodo_fim };
}

/**
 * A âncora de um registro manual. Quando a pessoa cola algo que o
 * `detectarTipoAncora` não reconhece (um número de patente, um link encurtado,
 * o registro de uma coleção), o valor é preservado como está e o tipo cai na
 * captura de URL — a única das seis que serve para qualquer coisa. É a mesma
 * tradução que `config.ts` documenta para o tipo `outro` da taxonomia.
 */
function ancoraDoManual(tipoProducao: TipoProducao, valorBruto: string): { tipo: AncoraTipo; valor: string } {
  const detectado = detectarTipoAncora(valorBruto);
  if (detectado) return { tipo: detectado, valor: valorParaGravar(detectado, valorBruto) };
  const sugerida = ANCORA_SUGERIDA_POR_TIPO[tipoProducao];
  const tipo: AncoraTipo = sugerida === "inpi" ? "inpi" : "url_com_captura";
  return { tipo, valor: valorBruto.trim() };
}

/** Os tipos de fato que este papel pode propor (§4.1). */
function tiposDeFatoVisiveis(membro: CicloMembro | null, lab: Laboratorio | null): TipoFato[] {
  return TIPOS_FATO.filter((tipo) => {
    // O estudante não declara formação nem bolsa: quem declara é o orientador.
    // É assim que se mata a dupla contagem orientador × orientando.
    if (membro?.papel === "estudante" && (tipo === "formacao" || tipo === "bolsista")) return false;
    // Acervo só para laboratório curador; infraestrutura só para EET-1/EET-5.
    if (tipo === "acervo" && lab && !lab.curador_acervo) return false;
    if (tipo === "infraestrutura" && lab && !(lab.eets.includes("EET-1") || lab.eets.includes("EET-5"))) return false;
    return true;
  });
}

// ================================================== 3. ESTADO DA BUSCA ORCID =

type LinhaOrcid = {
  chave: string;
  titulo: string;
  veiculo: string;
  ano: number | null;
  doi: string | null;
  publicadoEm: string | null;
  acessoAberto: boolean | null;
  tipo: TipoProducao | null;
  metadados: MetadadosCsl | null;
  resolvida: boolean;
  /** Ano solto que cruza a janela: vem rotulado e a pessoa decide. */
  ambiguo: boolean;
};

type EstadoOrcid =
  | { fase: "ocioso" }
  | { fase: "buscando" }
  | { fase: "pronto"; linhas: LinhaOrcid[] }
  | { fase: "vazio"; motivo: string };

/**
 * Uma linha vinda do Google Acadêmico (§ Tela 2). O Scholar lista título (às
 * vezes CORTADO), veículo, autores e ano — nunca o DOI. Por isso cada item entra
 * como CANDIDATO: quando o Crossref confirma um DOI por título+ano (`resolvida`),
 * o "adicionar" grava um item ancorado normal; quando não, cai no registro
 * manual (título+ano+veículo), sem inventar DOI. O `link` é o do próprio perfil,
 * e serve de âncora para o item manual.
 */
type LinhaScholar = {
  chave: string;
  titulo: string;
  veiculo: string;
  autores: string;
  ano: number | null;
  truncado: boolean;
  link: string | null;
  doi: string | null;
  resolvida: boolean;
};

type EstadoScholar =
  | { fase: "ocioso" }
  | { fase: "buscando" }
  | { fase: "pronto"; linhas: LinhaScholar[] }
  | { fase: "vazio"; motivo: string };

/**
 * A frase discreta quando o Google Acadêmico não rendeu itens. Bloqueio e
 * indisponibilidade (Edge Function não publicada, rede) recebem uma linha
 * honesta e sem drama — quem colou o link na Tela 1 ouviu "daqui em diante vem
 * de lá sozinho", e a seção sumir sem palavra quebraria a promessa; leitura
 * vazia (motivo `null`) diz que não havia nada no período; o resto degrada em
 * silêncio (o ORCID segue) — o requisito de não travar a tela.
 */
function motivoScholarTexto(motivo: MotivoIndicadores | null): string {
  switch (motivo) {
    case "bloqueado":
      return "Hoje não conseguimos falar com o Google Acadêmico. Seguimos com o seu ORCID e com o que você registrar.";
    case "indisponivel":
      return "Não conseguimos consultar seu Google Acadêmico agora. Seguimos com o seu ORCID e com o que você registrar.";
    case null:
      return "Seu Google Acadêmico não listou trabalhos deste período.";
    default:
      return "";
  }
}

/** Chave de deduplicação por título normalizado + ano, quando não há DOI. */
function chaveTituloAno(titulo: string, ano: number | null): string | null {
  const t = normalizarTitulo(titulo);
  if (!t) return null;
  return `${t}|${ano ?? ""}`;
}

type EstadoSalvamento = { fase: "ocioso" | "salvando" | "salvo" | "erro"; mensagem: string };

// ============================================================ 4. O COMPONENTE

export default function MeuAno() {
  const auth = useAuth();

  const [ciclo, setCiclo] = useState<RelatorioCiclo | null | "carregando">("carregando");
  const [membro, setMembro] = useState<CicloMembro | null>(null);
  const [relato, setRelato] = useState<Relato | null>(null);
  const [laboratorios, setLaboratorios] = useState<Laboratorio[]>([]);
  const [producoes, setProducoes] = useState<ProducaoDoRelato[]>([]);
  const [fatos, setFatos] = useState<Fato[]>([]);
  const [adesoes, setAdesoes] = useState<FatoParticipante[]>([]);
  const [minhasPropostas, setMinhasPropostas] = useState<Fato[]>([]);
  const [arquivos, setArquivos] = useState<RelatoArquivo[]>([]);

  /* A sugestão da Tela 4: uma frase factual montada SÓ do que a pessoa
     declarou (telas 2 e 3). Título e veículo saem do CSL que o Crossref
     devolveu; fato aderido entra como reserva quando não há produção. */
  const sugestaoDeResultado = useMemo(() => {
    const itens = producoes.map(({ producao }) => ({
      tipo: producao.tipo,
      titulo: tituloDoCsl(producao.metadados),
      veiculo: veiculoDoCsl(producao.metadados),
      ano: producao.ano,
    }));
    const aderidos = fatos
      .filter((f) => adesoes.some((a) => a.fato_id === f.id))
      .map((f) => ({ tipo: f.tipo, titulo: f.titulo, ocorridoEm: f.ocorrido_em }));
    return sugerirResultado(itens, aderidos);
  }, [producoes, fatos, adesoes]);

  const [carregando, setCarregando] = useState(false);
  const [semRoster, setSemRoster] = useState(false);
  /** Incrementado quando a identificação com sessão vincula a linha do roster:
   *  força o efeito de carga a rodar de novo, agora achando o vínculo. */
  const [recarga, setRecarga] = useState(0);
  const [falhaDeCarga, setFalhaDeCarga] = useState("");
  /** A pessoa que ela mesma escolheu na busca, para a Tela 1 virar conferência. */
  const [pessoaCatalogo, setPessoaCatalogo] = useState<PessoaDoCatalogo | null>(null);

  const [passo, setPasso] = useState<Passo>(1);
  const [narrativas, setNarrativas] = useState<Narrativas>({});
  /** 009 — objetivos confirmados (Q20), fomento (Q12+Q21) e extensão (Q28..30). */
  const [respostas, setRespostas] = useState<RespostasRelato>({});
  const [nadaADeclarar, setNadaADeclarar] = useState(false);
  const [orcid, setOrcid] = useState<EstadoOrcid>({ fase: "ocioso" });
  /** Os artigos do Google Acadêmico da Tela 2, alçados aqui como o do ORCID:
   *  a busca (Edge Function + casamento no Crossref) roda uma vez e sobrevive à
   *  navegação entre as telas. */
  const [scholar, setScholar] = useState<EstadoScholar>({ fase: "ocioso" });

  const [salvo, setSalvo] = useState<EstadoSalvamento>({ fase: "ocioso", mensagem: "" });
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recibo, setRecibo] = useState<Relato | null>(null);

  const cabecaRef = useRef<HTMLHeadingElement | null>(null);
  const primeiraRenderizacao = useRef(true);

  // ---------------------------------------------------------------- autosave
  // Nada de localStorage como fonte de verdade (§4.4): o rascunho é do
  // servidor. Falha de rede vira ESTADO com nova tentativa, nunca tela de erro
  // — o texto continua na caixa e a pessoa continua escrevendo.
  const relatoRef = useRef<Relato | null>(null);
  const membroRef = useRef<CicloMembro | null>(null);
  const pendenteRelato = useRef<PatchRelato>({});
  const pendenteMembro = useRef<PatchMembro>({});
  const temporizador = useRef<number | null>(null);
  const tentativas = useRef(0);

  useEffect(() => {
    relatoRef.current = relato;
  }, [relato]);
  useEffect(() => {
    membroRef.current = membro;
  }, [membro]);

  const gravarPendencias = useCallback(async (): Promise<boolean> => {
    const alvoRelato = relatoRef.current;
    const alvoMembro = membroRef.current;
    const patchRelato = pendenteRelato.current;
    const patchMembro = pendenteMembro.current;
    const temRelato = Object.keys(patchRelato).length > 0 && alvoRelato;
    const temMembro = Object.keys(patchMembro).length > 0 && alvoMembro;
    if (!temRelato && !temMembro) return true;

    setSalvo({ fase: "salvando", mensagem: "Salvando…" });
    try {
      if (temRelato && alvoRelato) {
        const atualizado = await salvarRascunho(alvoRelato.id, patchRelato);
        pendenteRelato.current = {};
        setRelato(atualizado);
      }
      if (temMembro && alvoMembro) {
        const atualizado = await atualizarMeuCadastro(alvoMembro.id, patchMembro);
        pendenteMembro.current = {};
        setMembro(atualizado);
      }
      tentativas.current = 0;
      setSalvo({ fase: "salvo", mensagem: `Salvo automaticamente às ${hhmm(new Date())} · pode fechar e voltar depois` });
      return true;
    } catch {
      tentativas.current += 1;
      setSalvo({
        fase: "erro",
        mensagem: "Não conseguimos salvar agora. Seu texto está aqui e vamos tentar de novo.",
      });
      if (tentativas.current <= 5) {
        const espera = Math.min(30000, 1000 * 2 ** tentativas.current);
        if (temporizador.current) window.clearTimeout(temporizador.current);
        temporizador.current = window.setTimeout(() => {
          void gravarPendencias();
        }, espera);
      }
      return false;
    }
  }, []);

  const agendar = useCallback(
    (patch: { relato?: PatchRelato; membro?: PatchMembro }) => {
      if (patch.relato) pendenteRelato.current = { ...pendenteRelato.current, ...patch.relato };
      if (patch.membro) pendenteMembro.current = { ...pendenteMembro.current, ...patch.membro };
      if (temporizador.current) window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => {
        void gravarPendencias();
      }, 800);
    },
    [gravarPendencias],
  );

  useEffect(
    () => () => {
      if (temporizador.current) window.clearTimeout(temporizador.current);
    },
    [],
  );

  // ------------------------------------------------------------------ título
  // Restaura o título ao desmontar: sem isso, quem visita esta rota e volta
  // para "#/" fica com "Relatório Anual de Atividades" na aba e em qualquer
  // favorito salvo dali em diante. É o mesmo padrão de MapaPage e webinars/seo.ts.
  useEffect(() => {
    const anterior = document.title;
    document.title = "Relatório Anual de Atividades | INCT-CONEXAO";
    return () => {
      document.title = anterior;
    };
  }, []);

  // -------------------------------------------------------------- o ciclo ---
  // `relatorio_ciclos` só é legível por quem está autenticado (policy
  // ciclos_read), então a porta não tenta ler o banco: ela usa a janela de
  // conveniência de validation.ts, que existe exatamente para isso.
  useEffect(() => {
    if (!relatoDisponivel() || !auth.session) return;
    let cancelado = false;
    cicloAberto()
      .then((c) => {
        if (!cancelado) setCiclo(c);
      })
      .catch((e: unknown) => {
        // Falha de leitura NÃO é "nenhum ciclo aberto": cair no mesmo `null`
        // faria a tela afirmar "a coleta ainda não começou" para quem só
        // perdeu a rede. A falha vai para `falhaDeCarga`, que já tem a tela
        // de "Tentar de novo"; `null` fica reservado para a resposta
        // legítima do servidor.
        if (!cancelado) {
          setCiclo(null);
          setFalhaDeCarga(erroDeRelato(e));
        }
      });
    return () => {
      cancelado = true;
    };
  }, [auth.session]);

  // ------------------------------------- quem ela disse ser, antes de entrar --
  // O slug escolhido na busca fica no navegador dela (e só ele: nenhum e-mail).
  // Serve para a Tela 1 mostrar o cartão de conferência mesmo que o roster
  // ainda esteja magro — e para a segunda tentativa de vínculo, logo abaixo.
  useEffect(() => {
    if (!auth.session) return;
    const escolhido = escolhaLembrada();
    if (!escolhido) return;
    let cancelado = false;
    carregarCatalogo()
      .then((c) => {
        if (!cancelado) setPessoaCatalogo(pessoaPorId(c, escolhido));
      })
      .catch(() => {
        /* sem catálogo a Tela 1 continua funcionando: ela só perde o cartão */
      });
    return () => {
      cancelado = true;
    };
  }, [auth.session]);

  // ---------------------------------------------- roster, relato e conteúdo --
  useEffect(() => {
    if (!relatoDisponivel() || !auth.session || !ciclo || ciclo === "carregando") return;
    let cancelado = false;
    setCarregando(true);
    setFalhaDeCarga("");

    (async () => {
      const userId = auth.session!.user.id;
      const meuEmail = auth.session!.user.email ?? "";
      const token = tokenDoConvite();
      let linha = await meuVinculo(ciclo.id, userId);
      if (!linha && token) linha = await membroPorConvite(ciclo.id, token);

      // Voltou pelo link mágico e ainda não há linha dela no roster. Antes de
      // dizer "não encontramos você", tentamos a reivindicação UMA segunda vez,
      // agora com sessão: é idempotente, e cobre o caso de a RPC da 006 ainda
      // não existir no momento em que ela pediu o link. Falhar aqui não custa
      // nada — o caminho segue para a tela de sempre.
      const escolhido = escolhaLembrada();
      if (!linha && escolhido && meuEmail) {
        const r = await reivindicarCadastro({ catalogoId: escolhido, email: meuEmail });
        if (r.status === "vinculado") linha = await meuVinculo(ciclo.id, userId);
      }
      if (cancelado) return;

      if (!linha) {
        setSemRoster(true);
        setCarregando(false);
        return;
      }
      setMembro(linha);

      const aberto = await abrirRelato(ciclo.id, userId, linha.id);
      if (cancelado) return;
      setRelato(aberto);
      setNarrativas(aberto.narrativas ?? {});
      setRespostas(aberto.respostas ?? {});
      setNadaADeclarar(aberto.nada_a_declarar);

      const [labs, meus, minhas, anexos] = await Promise.all([
        listarLaboratorios(ciclo.id),
        listarMinhasProducoes(aberto.id),
        minhasAdesoes(ciclo.id, userId),
        listarArquivos({ relatoId: aberto.id }),
      ]);
      if (cancelado) return;
      setLaboratorios(labs);
      setProducoes(meus);
      setAdesoes(minhas);
      setArquivos(anexos);

      if (linha.laboratorio_id) {
        const [confirmados, todos] = await Promise.all([
          listarFatosDoLaboratorio(ciclo.id, linha.laboratorio_id, { apenasConfirmados: true }),
          listarFatosDoLaboratorio(ciclo.id, linha.laboratorio_id),
        ]);
        if (cancelado) return;
        setFatos(confirmados);
        setMinhasPropostas(todos.filter((f) => f.status === "proposto" || f.status === "rejeitado"));
      }
      setCarregando(false);
    })().catch((e) => {
      if (cancelado) return;
      setFalhaDeCarga(erroDeRelato(e));
      setCarregando(false);
    });

    return () => {
      cancelado = true;
    };
  }, [auth.session, ciclo, recarga]);

  // ------------------------------------------------- foco ao trocar de tela --
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    cabecaRef.current?.focus();
  }, [passo]);

  // ------------------------------------------------------------- derivados ---
  const cicloResolvido = ciclo === "carregando" ? null : ciclo;
  const periodo = useMemo(() => periodoDoCiclo(cicloResolvido), [cicloResolvido]);
  const meuLab = useMemo(
    () => laboratorios.find((l) => l.id === membro?.laboratorio_id) ?? null,
    [laboratorios, membro],
  );
  const temImagemPublicavel = arquivos.some((a) => a.uso === "imagem_publicavel");

  // -------------------------------------------------------------- mutações ---
  /**
   * O jsonb `narrativas` é gravado INTEIRO (o update substitui a coluna), então
   * quem edita mantém o bloco completo em memória. O espelho em `ref` existe
   * para que duas mudanças no mesmo tique — o resultado principal e o texto
   * para não especialistas que o acompanha — não se atropelem.
   */
  const narrativasRef = useRef<Narrativas>({});
  useEffect(() => {
    narrativasRef.current = narrativas;
  }, [narrativas]);

  const aplicarNarrativas = useCallback(
    (patch: Partial<Narrativas>) => {
      const proximo = { ...narrativasRef.current, ...patch };
      narrativasRef.current = proximo;
      setNarrativas(proximo);
      agendar({ relato: { narrativas: proximo } });
    },
    [agendar],
  );

  const mudarNarrativa = useCallback(
    (campo: keyof Narrativas, valor: string) => {
      aplicarNarrativas({ [campo]: valor } as Partial<Narrativas>);
    },
    [aplicarNarrativas],
  );

  /**
   * `relatos.respostas` (009) segue o MESMO contrato de `narrativas`: o jsonb
   * é gravado inteiro, o bloco completo vive em memória e o espelho em `ref`
   * evita que dois patches no mesmo tique se atropelem.
   */
  const respostasRef = useRef<RespostasRelato>({});
  useEffect(() => {
    respostasRef.current = respostas;
  }, [respostas]);

  const aplicarRespostas = useCallback(
    (patch: Partial<RespostasRelato>) => {
      const proximo = { ...respostasRef.current, ...patch };
      respostasRef.current = proximo;
      setRespostas(proximo);
      const patchRelato: PatchRelatoGforms = { respostas: proximo };
      agendar({ relato: patchRelato });
    },
    [agendar],
  );

  const mudarCadastro = useCallback(
    (patch: PatchMembroGforms) => {
      setMembro((atual) => (atual ? { ...atual, ...patch } : atual));
      agendar({ membro: patch });
    },
    [agendar],
  );

  /** Q13 — JCR/Qualis gravados na CANÔNICA (ver o comentário em `Producao`). */
  const salvarCamposDeArtigo = useCallback(async (producaoId: string, patch: PatchProducaoGforms) => {
    const p = await atualizarProducao(producaoId, patch);
    setProducoes((atual) => atual.map((x) => (x.producao.id === p.id ? { ...x, producao: p } : x)));
  }, []);

  const registrar = useCallback(
    async (entrada: Omit<NovaProducao, "ciclo_id" | "relato_id">) => {
      if (!cicloResolvido || !relato) throw new Error("O rascunho ainda não está pronto. Recarregue a página.");
      const r = await registrarProducao({ ...entrada, ciclo_id: cicloResolvido.id, relato_id: relato.id });
      setProducoes((atual) => {
        const semEste = atual.filter((p) => p.vinculo.id !== r.vinculo.id);
        return [...semEste, { vinculo: r.vinculo, producao: r.producao }];
      });
      return r;
    },
    [cicloResolvido, relato],
  );

  const remover = useCallback(async (vinculoId: string) => {
    await removerVinculo(vinculoId);
    setProducoes((atual) => atual.filter((p) => p.vinculo.id !== vinculoId));
  }, []);

  /** Falha ao marcar/desmarcar participação (Tela 3). Sem isto, a rejeição de
   *  `aderirAoFato` virava unhandled rejection: o checkbox só "não acendia" e a
   *  participação nunca chegava ao relato, sem uma palavra na tela. */
  const [erroAdesao, setErroAdesao] = useState("");

  const alternarAdesao = useCallback(
    async (fatoId: string, participar: boolean) => {
      if (!auth.session || !relato) return;
      const userId = auth.session.user.id;
      setErroAdesao("");
      try {
        if (participar) {
          const nova = await aderirAoFato({ fatoId, userId, relatoId: relato.id });
          setAdesoes((atual) => [...atual.filter((a) => a.fato_id !== fatoId), nova]);
        } else {
          await desaderirDoFato(fatoId, userId);
          setAdesoes((atual) => atual.filter((a) => a.fato_id !== fatoId));
        }
      } catch (e) {
        setErroAdesao(erroDeRelato(e));
      }
    },
    [auth.session, relato],
  );

  const propor = useCallback(
    async (entrada: { tipo: TipoFato; ocorrido_em: string; titulo: string }) => {
      if (!cicloResolvido || !membro?.laboratorio_id) return;
      const novo = await proporFato({
        ciclo_id: cicloResolvido.id,
        laboratorio_id: membro.laboratorio_id,
        tipo: entrada.tipo,
        ocorrido_em: entrada.ocorrido_em,
        titulo: entrada.titulo,
        eets: meuLab?.eets ?? [],
        objetivos: meuLab?.objetivos ?? [],
      });
      setMinhasPropostas((atual) => [...atual, novo]);
    },
    [cicloResolvido, membro, meuLab],
  );

  /* A ENTRADA da saída de dignidade (`escolherSaida`) foi removida com o botão
     da Tela 1 (pedido do dono, 2026-08-07). O DESFAZER abaixo fica: quem marcou
     `nada_a_declarar` enquanto o atalho existiu tem o estado gravado no banco,
     e sem este caminho a pessoa ficaria presa numa declaração que não pode
     mais refazer. */
  const desfazerSaida = useCallback(async () => {
    setNadaADeclarar(false);
    setPasso(2);
    if (relato) {
      pendenteRelato.current = { ...pendenteRelato.current, nada_a_declarar: false };
      await gravarPendencias();
    }
  }, [relato, gravarPendencias]);

  const enviar = useCallback(
    async (cessao: boolean) => {
      if (!relato) return;
      setEnviando(true);
      setAviso("");
      try {
        const gravou = await gravarPendencias();
        if (!gravou) {
          setAviso(
            "Não conseguimos salvar o que você escreveu antes de enviar. Seu texto continua aqui. Tente de novo em instantes.",
          );
          return;
        }
        const enviado = await enviarRelato(relato.id, {
          declaracao_veracidade: true,
          cessao_imagem: cessao,
        });
        setRelato(enviado);
        setRecibo(enviado);
      } catch (e) {
        setAviso(erroDeRelato(e));
      } finally {
        setEnviando(false);
      }
    },
    [relato, gravarPendencias],
  );

  /**
   * Sair esquece TAMBÉM quem ela disse ser na busca. Sem isto, dois colegas que
   * usam o mesmo computador do laboratório — situação normal na rede — veriam o
   * cartão de conferência do outro na Tela 1.
   */
  const sair = useCallback(async () => {
    esquecerEscolha();
    setPessoaCatalogo(null);
    await auth.signOut();
  }, [auth]);

  // ============================================================== GUARDAS ====
  if (!relatoDisponivel()) {
    return (
      <Moldura>
        <div className="plat-card plat-notice">
          <CalendarX2 size={22} aria-hidden="true" />
          <div>
            <strong>O relato anual ainda não está no ar</strong>
            <p>
              A coleta será aberta pela coordenação. Se você recebeu um convite por e-mail, guarde-o: o mesmo link
              continuará valendo.
            </p>
          </div>
        </div>
      </Moldura>
    );
  }

  if (auth.loading) {
    return (
      <Moldura>
        <p className="plat-loading">
          <Loader2 size={22} aria-hidden="true" /> Carregando…
        </p>
      </Moldura>
    );
  }

  // Chegou por um link de redefinição de senha: resolve isso antes de tudo,
  // senão a pessoa fica presa (o link volta para esta mesma página).
  if (auth.recovery) {
    return (
      <Moldura>
        <PasswordCard title="Definir nova senha" cta="Salvar nova senha" onSubmit={auth.updatePassword} />
      </Moldura>
    );
  }

  if (!auth.session) {
    return (
      <Moldura>
        {/* O título do cartão NÃO repete o <h1> da faixa: com os dois iguais, o
            mesmo texto aparecia duas vezes seguidas na tela e um leitor de tela
            anunciava o título em dobro. Aqui ele diz o que o cartão faz. */}
        <PortaComBusca auth={auth} titulo="Antes de começar">
          <p>
            <strong>Este não é o relatório de prestação de contas ao CNPq</strong>. Esse só vence aos 24 meses. Este é
            o <strong>Indicador nº 2</strong> que a própria rede pactuou: o relatório anual sobre o desenvolvimento
            técnico-científico da proposta, voltado a gestores públicos e à sociedade.
          </p>
          <p>
            Leva cerca de 8 minutos. Você pode sair e voltar quando quiser: fica salvo no servidor, não no seu
            navegador.
          </p>
          <p>
            Período do Ciclo 1: <strong>{dataBr(PERIODO_CICLO_1.inicio)}</strong> a{" "}
            <strong>{dataBr(PERIODO_CICLO_1.fim)}</strong>. O que for de depois disso é aceito com a data verdadeira e
            fica guardado para o próximo relatório: não some e não conta duas vezes.
          </p>
          {/* A regra de rateio, dita ANTES de a pessoa começar: é o que decide
              se ela investe os 8 minutos hoje ou deixa para depois. Escrita em
              torno do que ela GANHA, não da punição — quem lê "senão você perde"
              fecha a aba; quem lê "é assim que se pede" preenche. */}
          <p className="plat-notice">
            <TriangleAlert size={16} aria-hidden="true" />{" "}
            <span>
              <strong>Este relato é a base do rateio de recursos da rede.</strong> Diárias, passagens, insumos e
              bolsas são distribuídos a partir do que cada laboratório demonstrou ter produzido, e a coordenação só
              consegue defender um pedido com o que estiver registrado aqui. Quem não relata não fica de fora por
              punição: fica de fora porque não há o que apresentar em nome dele.
            </span>
          </p>
        </PortaComBusca>
      </Moldura>
    );
  }

  if (ciclo === "carregando" || carregando) {
    return (
      <Moldura email={auth.session.user.email} onSair={() => void sair()}>
        <p className="plat-loading">
          <Loader2 size={22} aria-hidden="true" /> Carregando seu relato…
        </p>
      </Moldura>
    );
  }

  // A falha de carga vem ANTES da guarda de "sem ciclo": o catch de
  // `cicloAberto` deixa `ciclo` nulo E grava a falha, e a afirmação "a coleta
  // ainda não começou" só pode aparecer quando o servidor de fato respondeu.
  if (falhaDeCarga) {
    return (
      <Moldura email={auth.session.user.email} onSair={() => void sair()}>
        <div className="plat-card plat-notice">
          <TriangleAlert size={22} aria-hidden="true" />
          <div>
            <strong>Não foi possível carregar seu relato agora</strong>
            <p>{falhaDeCarga}</p>
            <p>
              <button className="plat-linkbtn" onClick={() => location.reload()}>
                Tentar de novo
              </button>
            </p>
          </div>
        </div>
      </Moldura>
    );
  }

  if (!ciclo) {
    return (
      <Moldura email={auth.session.user.email} onSair={() => void sair()}>
        <div className="plat-card plat-notice">
          <CalendarX2 size={22} aria-hidden="true" />
          <div>
            <strong>A coleta ainda não começou</strong>
            <p>
              Nenhum ciclo está aberto neste momento. Quando a coordenação abrir, você recebe um e-mail, e este
              mesmo endereço passa a funcionar.
            </p>
          </div>
        </div>
      </Moldura>
    );
  }

  if (semRoster) {
    /*
     * ISTO ERA UM BECO SEM SAÍDA. A tela dizia "não encontramos você" e mandava
     * escrever para a coordenação — mas a pessoa está LOGADA e a lista da
     * equipe está aqui, no navegador dela. A identificação existia só na porta,
     * ANTES do login; quem entrasse por outro caminho (sessão já aberta, link
     * mágico em outro aparelho, ou simplesmente quem já tinha conta no site)
     * pulava a busca e batia na parede.
     *
     * Agora a mesma identificação acontece DEPOIS do login: a pessoa acha o
     * próprio nome, e o vínculo é feito com o e-mail que ela já autenticou.
     * O e-mail de contato deixou de ser um passo — ele já é o da sessão.
     */
    return (
      <Moldura email={auth.session.user.email} onSair={() => void sair()}>
        <IdentificacaoComSessao
          emailDaSessao={auth.session.user.email ?? ""}
          onVinculado={() => {
            setSemRoster(false);
            setRecarga((n) => n + 1);
          }}
        />
      </Moldura>
    );
  }

  // --------------------------------------------- o gate do(a) líder (012) ---
  // Quem consta no roster do ciclo com papel 'lla' relata PELO laboratório: o
  // formulário individual não é o caminho dele(a). O gate fica DEPOIS da
  // identificação (semRoster) e da carga do vínculo de propósito — é por este
  // fluxo que o(a) líder se identifica pela primeira vez, e é nesse momento que
  // a 012 grava `laboratorios.lla_user_id`. Coordenação e CGES não passam por
  // aqui (papéis próprios, podem precisar do individual); e o papel é confiável
  // porque a guard da 007 só deixa a coordenação alterá-lo.
  if (membro?.papel === "lla") {
    const rotuloLab = meuLab ? `${meuLab.sigla}, ${meuLab.nome}` : "seu Laboratório Associado";
    return (
      <Moldura email={auth.session.user.email} onSair={() => void sair()}>
        <div className="plat-card plat-notice">
          <FlaskConical size={22} aria-hidden="true" />
          <div>
            <strong>Você é líder do {rotuloLab}: o seu relato é o do laboratório</strong>
            <p>
              As produções e os fatos do ciclo (expedições, parcerias, formação) se declaram lá, junto das
              perguntas de governança. Não há um relato individual separado para quem lidera.
            </p>
            <p className="plat-nav">
              <a className="button primary" href={RELATORIO_LAB_HREF}>
                Abrir o Relatório Anual do Laboratório <ArrowRight size={16} aria-hidden="true" />
              </a>
            </p>
          </div>
        </div>
      </Moldura>
    );
  }

  if (recibo) {
    return (
      <Moldura email={auth.session.user.email} onSair={() => void sair()}>
        <Recibo
          relato={recibo}
          ciclo={ciclo}
          onComplementar={() => {
            setRecibo(null);
            setPasso(nadaADeclarar ? 6 : 1);
          }}
        />
      </Moldura>
    );
  }

  // ============================================================== O WIZARD ===
  const tela = TELAS[passo - 1];

  return (
    <Moldura email={auth.session.user.email} onSair={() => void sair()}>
      <Progresso passo={passo} />

      <section className="plat-card rel-tela" aria-labelledby="rel-titulo-tela">
        <header className="rel-cabeca">
          <h2 id="rel-titulo-tela" ref={cabecaRef} tabIndex={-1}>
            {tela.titulo}
          </h2>
          <p className="rel-dica">{tela.subtitulo}</p>
        </header>

        {passo === 1 ? (
          <Tela1
            membro={membro}
            email={auth.session.user.email ?? ""}
            pessoaCatalogo={pessoaCatalogo}
            laboratorios={laboratorios}
            lab={meuLab}
            onCadastro={mudarCadastro}
            auth={auth}
          />
        ) : null}

        {passo === 2 ? (
          <Tela2
            ciclo={ciclo}
            membro={membro}
            periodo={periodo}
            producoes={producoes}
            orcid={orcid}
            setOrcid={setOrcid}
            scholar={scholar}
            setScholar={setScholar}
            onRegistrar={registrar}
            onRemover={remover}
            onVinculo={async (vinculoId, patch) => {
              const v = await atualizarVinculo(vinculoId, patch);
              setProducoes((atual) => atual.map((p) => (p.vinculo.id === v.id ? { ...p, vinculo: v } : p)));
            }}
            onArtigo={salvarCamposDeArtigo}
            userId={auth.session.user.id}
            relatoId={relato?.id ?? null}
            arquivos={arquivos}
            onArquivos={setArquivos}
          />
        ) : null}

        {passo === 3 ? (
          <Tela3
            ciclo={ciclo}
            membro={membro}
            lab={meuLab}
            fatos={fatos}
            adesoes={adesoes}
            propostas={minhasPropostas}
            periodo={periodo}
            objetivosConfirmados={respostas.objetivos_confirmados}
            erroAdesao={erroAdesao}
            onAderir={alternarAdesao}
            onPropor={propor}
            onObjetivos={(numeros) => aplicarRespostas({ objetivos_confirmados: numeros })}
          />
        ) : null}

        {passo === 4 ? <TelaFomento respostas={respostas} onAplicar={aplicarRespostas} /> : null}

        {passo === 5 ? (
          <TelaPalavras narrativas={narrativas} sugestao={sugestaoDeResultado} onAplicar={aplicarNarrativas} />
        ) : null}

        {passo === 6 ? (
          <TelaRevisao
            ciclo={ciclo}
            membro={membro}
            relato={relato}
            narrativas={narrativas}
            respostas={respostas}
            producoes={producoes}
            adesoes={adesoes}
            propostas={minhasPropostas}
            fatos={fatos}
            arquivos={arquivos}
            userId={auth.session.user.id}
            nadaADeclarar={nadaADeclarar}
            temImagemPublicavel={temImagemPublicavel}
            enviando={enviando}
            aviso={aviso}
            onIr={(p) => setPasso(p)}
            onMudar={mudarNarrativa}
            onCadastro={mudarCadastro}
            onArquivos={setArquivos}
            onDesfazerSaida={() => void desfazerSaida()}
            onEnviar={enviar}
          />
        ) : null}

        <nav className="plat-nav rel-nav" aria-label="Navegação do formulário">
          {/* Na saída de dignidade não existe "voltar": quem declarou que não
              teve nada não pode cair, por acidente, na tela do campo
              obrigatório. O caminho de volta é explícito e está na própria
              tela ("na verdade, tenho algo a declarar"). */}
          {passo > 1 && !nadaADeclarar ? (
            <button className="button plat-ghost" onClick={() => setPasso((p) => (p - 1) as Passo)}>
              <ArrowLeft size={16} aria-hidden="true" /> Voltar
            </button>
          ) : (
            <span />
          )}
          {passo < TOTAL_TELAS ? (
            <button className="button primary" onClick={() => setPasso((p) => (p + 1) as Passo)}>
              Continuar <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <span />
          )}
        </nav>
      </section>

      <BarraSalvamento estado={salvo} onSalvar={() => void gravarPendencias()} />
    </Moldura>
  );
}

// =========================================================== 5. A MOLDURA ===

/*
 * A identificação DEPOIS do login (a saída do beco sem saída) morava aqui em
 * cópia local, duplicando a exportada de BuscaPesquisador.tsx. A duplicata foi
 * eliminada na auditoria de 13/08: as duas divergiam no tratamento do status
 * `indisponivel`, e é a compartilhada que agora avisa em vez de ricochetear.
 */

function Moldura({
  children,
  email,
  onSair,
}: {
  children: React.ReactNode;
  email?: string | undefined;
  onSair?: () => void;
}) {
  return (
    <main className="plat-page" id="conteudo" tabIndex={-1}>
      <section className="section-band plat-band rel-band">
        <div className="section-inner plat-inner rel-inner">
          <p className="eyebrow dark">Relato anual da rede · Ciclo 1</p>
          <h1>Relatório Anual de Atividades</h1>
          {email ? (
            <p className="plat-session">
              Conectado como <strong>{email}</strong>
              {onSair ? (
                <button className="plat-signout" onClick={onSair}>
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

/**
 * `#/relatorio-anual?m=<token>` (e no alias legado `#/meu-ano?m=<token>`) —
 * chave OPACA de pré-preenchimento. Não autentica.
 *
 * A leitura em si mora no roteador, ao lado de `relatorioAnualHref()`, que escreve o
 * link. As duas pontas do token são o mesmo contrato (formato, `trim`, vazio
 * vira null): separá-las em duas cópias faria a pré-carga falhar em silêncio na
 * primeira vez que uma das pontas mudasse. Aqui fica só a guarda de SSR.
 */
function tokenDoConvite(): string | null {
  if (typeof window === "undefined") return null;
  return conviteDaHash(window.location.hash);
}

// ============================================================== 6. A PORTA ===

/**
 * A tela de entrada. Quem chega pelo link do convite já vem com sessão e NÃO
 * vê esta tela — ela existe para quem voltou três semanas depois, com o token
 * expirado, que é exatamente quem desiste.
 */

/**
 * O aviso fica AQUI, aberto em um toque, e não numa página distante: dizer o
 * que vira público depois de a pessoa escrever é tarde demais (§6.2).
 */

// ========================================================== 7. O PROGRESSO ===

/**
 * A frase do progresso: orientação + esforço honesto, com a voz acompanhando o
 * avanço — abre dizendo o custo inteiro (quem sabe o tamanho da tarefa começa),
 * no meio orienta, e no fim anima. Minutos, nunca porcentagem (§3), e nunca o
 * título da tela: o h2 logo abaixo já o diz (era "Tela 1 de 6 · faltam ~8 min",
 * trocado a pedido do dono em 11/08).
 */
function fraseDoProgresso(passo: Passo): string {
  const m = minutosRestantes(passo);
  if (passo === 1) return `Primeiro de ${TOTAL_TELAS} passos, uns ${m} minutos ao todo`;
  if (passo === TOTAL_TELAS)
    return m <= 1 ? "Último passo, falta menos de um minuto" : `Último passo, uns ${m} minutos`;
  return `Passo ${passo} de ${TOTAL_TELAS} · ${m <= 1 ? "falta só um minutinho" : `faltam uns ${m} minutos`}`;
}

function Progresso({ passo }: { passo: Passo }) {
  const frase = fraseDoProgresso(passo);
  return (
    <p className="rel-progresso">
      {/* Uma linha só, com qualquer separador DENTRO dela: o .rel-progresso é
          grid e cada nó vira linha própria — um "·" solto virava ponto órfão. */}
      <span className="rel-progresso-linha">{frase}</span>
      <progress value={passo} max={TOTAL_TELAS} aria-label={frase} />
    </p>
  );
}

/**
 * O rodapé do autosave. O botão "Salvar e continuar depois" é tecnicamente
 * redundante e existe assim mesmo: a expectativa mental exige o botão, e sem
 * ele a pessoa fecha a aba com medo de perder o que escreveu.
 */
function BarraSalvamento({ estado, onSalvar }: { estado: EstadoSalvamento; onSalvar: () => void }) {
  return (
    <div className="rel-salvo">
      <p aria-live="polite" className={estado.fase === "erro" ? "plat-error" : "plat-muted"}>
        {estado.mensagem || "Salvo automaticamente enquanto você escreve · pode fechar e voltar depois"}
      </p>
      <button className="button plat-ghost" onClick={onSalvar}>
        <Save size={15} aria-hidden="true" /> Salvar e continuar depois
      </button>
    </div>
  );
}

// ====================================================== 8. TELA 1 — QUEM É ===

/**
 * Lê as colunas da 010 de uma linha de `ciclo_membros` sem depender de
 * `types.ts` já as declarar. O PostgREST as devolve (o `.select()` de
 * `atualizarMeuCadastro` não tem lista de colunas); o que falta é só o tipo.
 * Valor de formato inesperado vira `null` — nunca chega torto na tela.
 */
function colunasDe010(membro: CicloMembro | null): Required<Colunas010> {
  const linha: Record<string, unknown> = membro ?? {};
  const fonte = linha.indicadores_fonte;
  return {
    scholar_id: typeof linha.scholar_id === "string" && linha.scholar_id ? linha.scholar_id : null,
    indicadores_fonte:
      fonte === "scholar" || fonte === "openalex" || fonte === "manual" ? fonte : null,
    indicadores_atualizado_em:
      typeof linha.indicadores_atualizado_em === "string" ? linha.indicadores_atualizado_em : null,
  };
}

/**
 * O endereço canônico do perfil a partir do id guardado. Serve para DEVOLVER à
 * pessoa o que ela colou: guardamos `user=`, mas quem colou um link espera ver
 * um link — mostrar `JicYPdAAAAAJ` num campo rotulado "link" seria trocar a
 * pergunta depois da resposta. `hl=pt-BR` porque é a página que ela reconhece.
 */
function urlDoPerfilScholar(id: string): string {
  return `https://scholar.google.com/citations?user=${id}&hl=pt-BR`;
}

function Tela1({
  membro,
  email,
  pessoaCatalogo,
  laboratorios,
  lab,
  onCadastro,
  auth,
}: {
  membro: CicloMembro | null;
  email: string;
  /** A linha da proposta que a própria pessoa escolheu na busca de entrada. */
  pessoaCatalogo: PessoaDoCatalogo | null;
  laboratorios: Laboratorio[];
  /** O laboratório escolhido — é dele que vem o grupo DGP (Q8/Q9) a conferir. */
  lab: Laboratorio | null;
  onCadastro: (patch: PatchMembroGforms) => void;
  auth: AuthState;
}) {
  const [orcidTexto, setOrcidTexto] = useState(membro?.orcid ?? "");
  const [lattesTexto, setLattesTexto] = useState(membro?.lattes_id ?? "");
  const [buscando, setBuscando] = useState(false);
  const [candidatos, setCandidatos] = useState<CandidatoOrcid[] | null>(null);
  const [erroBusca, setErroBusca] = useState("");

  /* ------------------------------------------------------------------------
     Q14 (009) + PROCEDÊNCIA (010) — os indicadores que se preenchem sozinhos.

     O pedido foi "índice H e citações extraídos automaticamente do Google
     Scholar". O que a apuração permitiu construir (o cabeçalho de
     `indicadores.ts` traz as medições):
       • o Scholar não manda CORS — do navegador é impossível. Só a Edge
         Function o alcança, e ela precisa do `user=` do perfil, que não temos
         para ninguém dos ~209 e que NÃO se pode descobrir por nome (o
         robots.txt proíbe a busca de autor). Daí o campo de link mais abaixo:
         cola-se UMA VEZ, vira `scholar_id`, e a partir dali é automático.
       • o OpenAlex responde por ORCID, do navegador, sem infra nenhuma — e
         esta tela já descobre o ORCID sozinha. É o preenchimento padrão, e sai
         rotulado como OpenAlex, jamais como Scholar: o corpus é menor e o h
         sai menor, e apresentar um como se fosse o outro é o erro que a coluna
         `indicadores_fonte` existe para tornar impossível.

     O NÚMERO ENTRA COMO SUGESTÃO. O campo segue editável; quem digitar por
     cima vira `manual`, e manual não é sobrescrito por busca nenhuma — dali em
     diante a busca vira uma OFERTA com botão, nunca uma substituição.
     ------------------------------------------------------------------------ */
  const c010 = colunasDe010(membro);
  const scholarIdSalvo = c010.scholar_id;
  const fonteSalva = c010.indicadores_fonte;
  const orcidSalvo = membro?.orcid ?? null;
  const hSalvo = membro?.indice_h ?? null;
  const citSalvo = membro?.total_citacoes ?? null;

  const [hTexto, setHTexto] = useState(hSalvo != null ? String(hSalvo) : "");
  const [citTexto, setCitTexto] = useState(citSalvo != null ? String(citSalvo) : "");
  const [scholarTexto, setScholarTexto] = useState(scholarIdSalvo ? urlDoPerfilScholar(scholarIdSalvo) : "");
  const [erroScholar, setErroScholar] = useState("");
  const [buscandoInd, setBuscandoInd] = useState(false);
  const [motivoInd, setMotivoInd] = useState<MotivoIndicadores | null>(null);
  /** Achado que NÃO foi aplicado porque o número da pessoa é dela. */
  const [oferta, setOferta] = useState<Indicadores | null>(null);
  const [tentativaInd, setTentativaInd] = useState(0);
  const hValidacao = hTexto.trim() ? validarInteiroOpcional(hTexto) : null;
  const citValidacao = citTexto.trim() ? validarInteiroOpcional(citTexto) : null;

  /* Os três campos são texto local gravado no blur; quando a coluna muda por
     fora (semeadura, busca automática, outra aba), o campo tem de acompanhar —
     é o mesmo par efeito/guarda do Lattes. O `!= null` impede que apagar o
     campo o faça reaparecer preenchido. */
  useEffect(() => {
    if (hSalvo != null) setHTexto(String(hSalvo));
  }, [hSalvo]);
  useEffect(() => {
    if (citSalvo != null) setCitTexto(String(citSalvo));
  }, [citSalvo]);
  useEffect(() => {
    if (scholarIdSalvo) setScholarTexto(urlDoPerfilScholar(scholarIdSalvo));
  }, [scholarIdSalvo]);

  /**
   * QUANDO A BUSCA PODE ESCREVER SOZINHA. Só quando não há número, ou quando o
   * que há já veio de busca (é atualização, que é justamente o que se pediu).
   * Número digitado à mão — inclusive o herdado da 009, quando a coluna de
   * fonte ainda não existia e portanto só uma pessoa pode tê-lo escrito — não
   * é substituído: vira oferta.
   */
  const podeSobrescrever =
    (hSalvo == null && citSalvo == null) || fonteSalva === "scholar" || fonteSalva === "openalex";
  const podeSobrescreverRef = useRef(podeSobrescrever);
  useEffect(() => {
    podeSobrescreverRef.current = podeSobrescrever;
  }, [podeSobrescrever]);

  /**
   * A BUSCA. Uma vez por identificador (a chave inclui `tentativaInd`, que é o
   * "buscar de novo"). Sem ORCID e sem `scholar_id` NÃO SE BUSCA NADA: procurar
   * autor por nome é o que o robots.txt do Scholar proíbe, e no OpenAlex
   * produz homônimo comprovado — as duas coisas custariam o número de outra
   * pessoa dentro de um relatório do CNPq.
   *
   * `obterIndicadores` não lança: falha vira `motivo`, e a tela segue manual.
   */
  const chaveIndicadores = `${orcidSalvo ?? ""}|${scholarIdSalvo ?? ""}|${tentativaInd}`;
  const indicadoresBuscados = useRef("");
  useEffect(() => {
    if (!orcidSalvo && !scholarIdSalvo) return;
    if (indicadoresBuscados.current === chaveIndicadores) return;
    indicadoresBuscados.current = chaveIndicadores;

    const controle = new AbortController();
    let vivo = true;
    setBuscandoInd(true);
    void obterIndicadores({ orcid: orcidSalvo, scholarId: scholarIdSalvo }, { signal: controle.signal }).then(
      (ind) => {
        if (!vivo) return;
        setBuscandoInd(false);
        setMotivoInd(ind.motivo);
        if (!ind.fonte) return;
        // Fonte que respondeu sem número nenhum não é resposta: gravá-la
        // carimbaria "segundo o OpenAlex" em dois campos vazios.
        if (ind.h_index == null && ind.citacoes == null) return;
        // `patchDeIndicadores` grava o número E a procedência na mesma volta:
        // não existe caminho neste arquivo que salve um sem o outro.
        if (podeSobrescreverRef.current) {
          onCadastro(patchDeIndicadores(ind));
          setOferta(null);
        } else {
          setOferta(ind);
        }
      },
    );
    return () => {
      vivo = false;
      controle.abort();
    };
  }, [orcidSalvo, scholarIdSalvo, chaveIndicadores, onCadastro]);

  /** Digitou por cima: o número passa a ser dele, e a fonte também. */
  const gravarIndicadorManual = (hNovo: number | null, citNovo: number | null) => {
    onCadastro(
      patchDeIndicadores({
        h_index: hNovo,
        citacoes: citNovo,
        // Campo esvaziado não é "informado por você": é não informado.
        fonte: hNovo == null && citNovo == null ? null : "manual",
        atualizado_em: null,
      }),
    );
  };

  /** O link colado. `extrairScholarId` aceita a URL inteira ou o id cru. */
  const aplicarLinkScholar = () => {
    const colado = scholarTexto.trim();
    if (!colado) {
      setErroScholar("");
      if (scholarIdSalvo) onCadastro({ scholar_id: null });
      return;
    }
    const id = extrairScholarId(colado);
    if (!id) {
      setErroScholar(
        "Não encontramos um perfil nesse endereço. Ele tem esta cara: scholar.google.com/citations?user=ABC12345",
      );
      return;
    }
    setErroScholar("");
    setScholarTexto(urlDoPerfilScholar(id));
    if (id !== scholarIdSalvo) onCadastro({ scholar_id: id });
  };

  /**
   * A fonte que a tela DIZ. Número sem fonte é o defeito que este bloco existe
   * para impedir — e um número herdado da 009 (fonte nula) só pode ter sido
   * digitado, então "informado por você" é verdade, não chute.
   */
  const fonteExibida: IndicadoresFonte | null =
    fonteSalva ?? (hSalvo != null || citSalvo != null ? "manual" : null);

  /** "índice H 58 e 41.761 citações" — só com o que a fonte de fato trouxe. */
  const resumoDaOferta = oferta
    ? [
        oferta.h_index != null ? `índice H ${oferta.h_index}` : null,
        oferta.citacoes != null ? `${oferta.citacoes.toLocaleString("pt-BR")} citações` : null,
      ]
        .filter(Boolean)
        .join(" e ")
    : "";

  /**
   * O CATÁLOGO PREENCHE O QUE ESTÁ VAZIO — E SÓ O QUE ESTÁ VAZIO.
   *
   * Uma vez, sem laço: o que o roster já tiver (porque a coordenação corrigiu,
   * ou porque a pessoa editou na volta anterior) VENCE o que a proposta diz. O
   * catálogo é de dezembro de 2024; o roster é de agora. Sobrescrever seria
   * fazer uma tela de conferência desfazer uma correção humana.
   */
  const semeado = useRef(false);
  useEffect(() => {
    if (semeado.current || !membro || !pessoaCatalogo) return;
    semeado.current = true;
    const patch: PatchMembro = {};
    if (!membro.nome.trim()) patch.nome = pessoaCatalogo.nome;
    if (!membro.instituicao_nome.trim()) patch.instituicao_nome = pessoaCatalogo.instituicaoNome;
    if (!membro.uf && pessoaCatalogo.uf) patch.uf = pessoaCatalogo.uf;
    if (!membro.lattes_id && pessoaCatalogo.lattesId) patch.lattes_id = pessoaCatalogo.lattesId;
    if (Object.keys(patch).length) onCadastro(patch);
  }, [membro, pessoaCatalogo, onCadastro]);

  // O campo do Lattes tem estado próprio (o `onBlur` é que grava). Quando a
  // semeadura acima preenche a coluna, o campo tem de acompanhar — senão a
  // pessoa vê "vazio" e o banco tem o número.
  const lattesDoRoster = membro?.lattes_id ?? "";
  useEffect(() => {
    if (lattesDoRoster) setLattesTexto(lattesDoRoster);
  }, [lattesDoRoster]);

  /**
   * O ORCID SE PROCURA SOZINHO — a pessoa confere, não lembra.
   *
   * Antes havia um link "Não lembro o meu", e ele era um pedido de trabalho
   * disfarçado: quem não lembra o próprio ORCID também não vai clicar num link
   * para descobri-lo. A proposta não traz ORCID de ninguém (traz 190 Lattes e
   * zero ORCIDs), então não há de onde pré-preencher — mas há de onde BUSCAR.
   *
   * A busca roda uma vez, ao abrir a tela, só quando o campo está vazio.
   * E o resultado NUNCA é gravado sozinho: homônimo existe, e um ORCID errado
   * traz a produção de outra pessoa para dentro do relatório do INCT. Um
   * candidato → oferecemos para confirmar. Vários → lista curta para escolher.
   * Nenhum → o campo segue como estava, sem barulho.
   */
  const buscouOrcid = useRef(false);
  useEffect(() => {
    if (buscouOrcid.current || !membro) return;
    if (membro.orcid || orcidTexto.trim()) return; // já tem: nada a procurar
    if (!membro.nome.trim().includes(" ")) return; // nome incompleto: a API pede dois termos
    buscouOrcid.current = true;
    let vivo = true;
    setBuscando(true);
    void buscarOrcidPorNome(membro.nome).then((r) => {
      if (!vivo) return;
      setBuscando(false);
      if (r.ok && r.candidatos.length) setCandidatos(r.candidatos);
      // Falha da API não pode sumir com o spinner em silêncio: uma linha
      // discreta devolve o caminho manual (o campo está logo acima).
      else if (!r.ok) setErroBusca("Não conseguimos procurar seu ORCID agora. Se souber o número, digite no campo acima.");
    });
    return () => {
      vivo = false;
    };
  }, [membro, orcidTexto]);

  const orcidValidacao = orcidTexto.trim() ? validarOrcid(orcidTexto) : null;
  const lattesValidacao = lattesTexto.trim() ? validarLattes(lattesTexto) : null;

  if (!membro) return <p className="plat-empty">Carregando seu cadastro…</p>;


  return (
    <div className="plat-fields">
      {/* A conferência: o que a proposta registrou, do jeito que ela registrou.
          Não é campo — é o espelho do que a pessoa escolheu ao entrar. */}
      {pessoaCatalogo ? <CartaoDoCatalogo pessoa={pessoaCatalogo} /> : null}

      <div className="rel-campo">
        <label htmlFor="m-nome">Nome completo</label>
        <input
          id="m-nome"
          value={membro.nome}
          autoComplete="name"
          onChange={(e) => onCadastro({ nome: e.target.value })}
        />
      </div>

      <div className="rel-campo">
        <label htmlFor="m-email">E-mail</label>
        <input id="m-email" value={email} readOnly autoComplete="email" />
        <small className="rel-dica">
          É o endereço que <strong>você escolheu</strong> ao entrar: a proposta não trouxe o e-mail de ninguém. Para
          trocá-lo, fale com a coordenação.
        </small>
      </div>

      <div className="rel-campo">
        <span className="rel-dica">
          <strong>Categoria na proposta:</strong> {membro.categoria_picc ?? "não informada"} ·{" "}
          <strong>Papel neste ciclo:</strong> {ROTULO_PAPEL[membro.papel]}
        </span>
        <small className="rel-dica">
          Categoria e papel vêm do quadro da equipe registrado na proposta e só a coordenação os altera: é o que
          impede que uma correção de tela vire mudança de permissão. Se estiver errado, escreva para{" "}
          <a href="mailto:inctconexao@gmail.com">inctconexao@gmail.com</a>.
        </small>
      </div>

      {/* SEMPRE um seletor. Antes, o campo virava input somente-leitura assim
          que houvesse um laboratório gravado — e como a semente atribui um a
          quase todo mundo (a partir do quadro da proposta, com siglas ainda
          provisórias), na prática ninguém conseguia se corrigir. A trava do
          banco também caiu, na migração 007: ela não protegia nada, porque a
          PRIMEIRA escolha já era livre. */}
      <div className="rel-campo">
        <label htmlFor="m-lab">Laboratório Associado</label>
        <select
          id="m-lab"
          value={membro.laboratorio_id ?? ""}
          onChange={(e) => onCadastro({ laboratorio_id: e.target.value || null })}
        >
          <option value="">Selecione…</option>
          {laboratorios.map((l) => (
            <option key={l.id} value={l.id}>
              {/* Com a lista expandida (98 laboratórios, 25 sem sigla), o
                  formato "sigla — nome" viraria " — Nome" nos sem sigla.
                  E o líder só entra se já não estiver embutido no nome (a
                  semente provisória dos 28 embutia). */}
              {l.sigla ? `${l.sigla}, ` : ""}
              {l.nome}
              {l.lla_nome && !l.nome.includes(l.lla_nome) ? ` · ${l.lla_nome}` : ""}
              {l.instituicao_nome && !l.nome.includes(l.instituicao_nome) && !(l.sigla ?? "").includes(l.instituicao_nome)
                ? ` (${l.instituicao_nome}${l.uf ? `/${l.uf}` : ""})`
                : ""}
            </option>
          ))}
        </select>
        <small className="rel-dica">
          É por ele que aparecem, na tela seguinte, as atividades do seu laboratório para você marcar participação.
          {membro.laboratorio_id
            ? " Veio do quadro da proposta. Se não for o seu, troque aqui mesmo."
            : ""}
        </small>

        {/* Q8/Q9 do Forms — o grupo no Diretório de Grupos de Pesquisa (DGP).
            CONFERÊNCIA, não edição: a decisão 9 do relato-gforms deixa a
            escrita de dgp_nome/dgp_url com a coordenação (RLS labs_coord_write,
            intocada pela 009). A tarefa chegou a cogitar o campo "editável",
            mas um input que a RLS recusaria no salvar mentiria para a pessoa —
            aqui ela confere e, se estiver errado, tem o caminho de saída. */}
        {lab && (lab.dgp_nome || lab.dgp_url) ? (
          <small className="rel-dica">
            <strong>Grupo no Diretório CNPq (DGP):</strong> {lab.dgp_nome ?? lab.nome}
            {lab.dgp_url ? (
              <>
                {" · "}
                <a href={lab.dgp_url} target="_blank" rel="noreferrer">
                  conferir o espelho <ExternalLink size={12} aria-hidden="true" />
                </a>
              </>
            ) : null}
            . Se o nome ou o link estiver errado, avise{" "}
            <a href="mailto:inctconexao@gmail.com">inctconexao@gmail.com</a>. Só a coordenação edita o cadastro do
            grupo.
          </small>
        ) : null}
      </div>

      <div className="rel-campo">
        <label htmlFor="m-instituicao">Instituição</label>
        <input
          id="m-instituicao"
          value={membro.instituicao_nome}
          autoComplete="organization"
          onChange={(e) => onCadastro({ instituicao_nome: e.target.value })}
        />
        <small className="rel-dica">
          {membro.instituicao_ror
            ? `Identificador ROR: ${membro.instituicao_ror}. É dele que sai a contagem de instituições e países da rede (Indicador nº 3).`
            : "Sem identificador ROR ainda. A coordenação completa esse campo. Ele é o que faz sua instituição contar no Indicador nº 3."}
        </small>
      </div>

      <div className="rel-campo">
        <label htmlFor="m-lattes">
          ID Lattes
        </label>
        <input
          id="m-lattes"
          inputMode="numeric"
          value={lattesTexto}
          aria-invalid={lattesValidacao ? !lattesValidacao.ok : undefined}
          aria-describedby="m-lattes-dica"
          onChange={(e) => setLattesTexto(e.target.value)}
          onBlur={() => {
            const v = validarLattes(lattesTexto);
            if (v.ok) onCadastro({ lattes_id: v.valor || null });
          }}
        />
        {lattesValidacao && !lattesValidacao.ok ? (
          <p className="plat-error rel-erro">{lattesValidacao.mensagem}</p>
        ) : null}
        <small id="m-lattes-dica" className="rel-dica">
          É do Lattes que o CNPq vai contar a produção da rede. Se o seu estiver desatualizado, o relatório de 2027
          sairá menor do que a rede produziu. Vale atualizar quando puder. Aqui não é obrigatório.
        </small>
      </div>

      <div className="rel-campo">
        <label htmlFor="m-orcid">
          ORCID
        </label>
        <input
          id="m-orcid"
          inputMode="numeric"
          placeholder="0000-0000-0000-000X"
          maxLength={19}
          value={orcidTexto}
          aria-invalid={orcidValidacao ? !orcidValidacao.ok : undefined}
          aria-describedby="m-orcid-dica"
          onChange={(e) => setOrcidTexto(mascararOrcid(e.target.value))}
          onBlur={() => {
            if (!orcidTexto.trim()) {
              onCadastro({ orcid: null });
              return;
            }
            const v = validarOrcid(orcidTexto);
            if (v.ok) onCadastro({ orcid: v.valor });
          }}
        />
        {orcidValidacao && !orcidValidacao.ok ? (
          <p className="plat-error rel-erro">{orcidValidacao.mensagem}</p>
        ) : null}
        <small id="m-orcid-dica" className="rel-dica">
          Com ele, a próxima tela já vem com a sua produção do período para você só confirmar.
        </small>

        {buscando ? (
          <p className="plat-hint">
            <Loader2 size={14} aria-hidden="true" /> Procurando seu ORCID pelo nome…
          </p>
        ) : null}
        {erroBusca ? <p className="plat-hint">{erroBusca}</p> : null}

        {/* O resultado da busca automática. NUNCA gravado sozinho: homônimo
            existe, e um ORCID errado traz produção de outra pessoa para dentro
            do relatório. Quem confirma é sempre a pessoa. */}
        {candidatos?.length ? (
          <div className="plat-notice rel-dica">
            <Search size={16} aria-hidden="true" />
            <div>
              <strong>
                {candidatos.length === 1
                  ? "Encontramos este ORCID com o seu nome. É você?"
                  : `Encontramos ${candidatos.length} ORCIDs com o seu nome. Algum é você?`}
              </strong>
              <ul className="plat-list">
                {candidatos.slice(0, 5).map((c) => (
                  <li key={c.orcid} className="rel-item">
                    <button
                      type="button"
                      className="plat-linkbtn rel-escolha"
                      onClick={() => {
                        setOrcidTexto(mascararOrcid(c.orcid));
                        onCadastro({ orcid: c.orcid });
                        setCandidatos(null);
                      }}
                    >
                      <span className="rel-item-titulo">Sim, sou eu: {c.nome || c.orcid}</span>
                      <span className="rel-item-meta">
                        {c.orcid}
                        {c.instituicoes.length ? ` · ${c.instituicoes.slice(0, 2).join(" · ")}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="plat-linkbtn" onClick={() => setCandidatos(null)}>
                Nenhum destes {candidatos.length > 1 ? "sou eu" : "é meu"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Q6 + Q14 do Forms do CTC (009), agora com a procedência da 010. Índice
          H e citações se preenchem sozinhos quando há de onde buscar, SEMPRE
          com a fonte dita ao lado, e seguem editáveis — ver o bloco de estado
          no topo desta função. */}
      <fieldset className="plat-fields">
        <legend>
          Pós-graduação e indicadores <span className="rel-opcional">(opcional, pedidos do Comitê Técnico-Científico)</span>
        </legend>
        <div className="rel-campo">
          <label htmlFor="m-ppg">Programa de Pós-graduação a que você está vinculado(a)</label>
          <input
            id="m-ppg"
            value={membro.ppg ?? ""}
            onChange={(e) => onCadastro({ ppg: e.target.value || null })}
            aria-describedby="m-ppg-dica"
          />
          <small id="m-ppg-dica" className="rel-dica">
            Como aparece na CAPES (ex.: “PPG em Biologia Experimental, UNIR”). Sem vínculo? Deixe em branco.
          </small>
        </div>
        <div className="rel-campo">
          <label htmlFor="m-indice-h">Índice H</label>
          <input
            id="m-indice-h"
            inputMode="numeric"
            value={hTexto}
            aria-invalid={hValidacao ? !hValidacao.ok : undefined}
            aria-describedby="m-indicadores-proc m-indicadores-dica"
            onChange={(e) => setHTexto(e.target.value)}
            onBlur={() => {
              const v = validarInteiroOpcional(hTexto);
              if (!v.ok) return;
              const novo = v.valor ? Number(v.valor) : null;
              // Tabulou sem mexer não é edição: a fonte fica como estava.
              if (novo === hSalvo) return;
              gravarIndicadorManual(novo, citSalvo);
            }}
          />
          {hValidacao && !hValidacao.ok ? <p className="plat-error rel-erro">{hValidacao.mensagem}</p> : null}
        </div>
        <div className="rel-campo">
          <label htmlFor="m-citacoes">Total de citações</label>
          <input
            id="m-citacoes"
            inputMode="numeric"
            value={citTexto}
            aria-invalid={citValidacao ? !citValidacao.ok : undefined}
            aria-describedby="m-indicadores-proc m-indicadores-dica"
            onChange={(e) => setCitTexto(e.target.value)}
            onBlur={() => {
              const v = validarInteiroOpcional(citTexto);
              if (!v.ok) return;
              const novo = v.valor ? Number(v.valor) : null;
              if (novo === citSalvo) return;
              gravarIndicadorManual(hSalvo, novo);
            }}
          />
          {citValidacao && !citValidacao.ok ? <p className="plat-error rel-erro">{citValidacao.mensagem}</p> : null}

          {/* A PROCEDÊNCIA, ao lado do número, sempre. A frase vem inteira de
              `fraseDeProcedencia` — é lá, e só lá, que cada fonte é nomeada, e
              é ela que carrega em UMA linha que a base do OpenAlex é menor. */}
          <div className="rel-ind-estado">
            {/* O `<p>` fica SEMPRE no DOM (some por `:empty` no CSS) porque
                região viva criada junto com o texto não é anunciada. */}
            <p id="m-indicadores-proc" className="rel-ind-proc" aria-live="polite">
              {buscandoInd ? (
                <>
                  <Loader2 size={14} aria-hidden="true" /> Buscando os seus indicadores…
                </>
              ) : fonteExibida ? (
                <>
                  <Sparkles size={14} aria-hidden="true" /> Índice H e citações:{" "}
                  {fraseDeProcedencia(fonteExibida, fonteSalva ? c010.indicadores_atualizado_em : null)}.
                </>
              ) : motivoInd && motivoInd !== "sem_identificador" ? (
                "Não conseguimos buscar agora. Pode digitar do seu perfil."
              ) : null}
            </p>
            {/* Fora da região viva de propósito: senão o leitor de tela lê
                "buscar de novo" a cada mudança de estado da linha acima. */}
            {!buscandoInd && (orcidSalvo || scholarIdSalvo) ? (
              <button type="button" className="plat-linkbtn" onClick={() => setTentativaInd((n) => n + 1)}>
                Buscar de novo
              </button>
            ) : null}
          </div>

          {/* O bloqueio do Scholar sobrevive no `motivo` mesmo quando o OpenAlex
              respondeu no lugar: quem colou o link merece saber por que o
              número não é o de lá. Nunca se insiste, nunca se contorna. */}
          {scholarIdSalvo && fonteExibida === "openalex" && motivoInd === "bloqueado" ? (
            <small className="rel-dica">
              O Google Acadêmico não respondeu desta vez. O número acima é do OpenAlex. Tentamos de novo na próxima
              vez que você abrir esta tela.
            </small>
          ) : null}

          <small id="m-indicadores-dica" className="rel-dica">
            O número é seu: pode corrigi-lo à mão a qualquer momento, e o que você digitar passa a valer. Não
            substituímos mais.
          </small>

          {/* O achado que NÃO foi aplicado, porque o número que está aí foi
              digitado por ela. Oferta com botão, nunca substituição silenciosa. */}
          {oferta ? (
            <div className="plat-card plat-notice rel-ind-oferta">
              <Info size={16} aria-hidden="true" />
              <div>
                <strong>
                  Encontramos {resumoDaOferta}, {oferta.procedencia}.
                </strong>
                <p>
                  Os números que estão no formulário foram informados por você, então não mexemos neles. Se preferir os
                  de lá, é um toque.
                </p>
                <div className="rel-ind-acoes">
                  <button
                    type="button"
                    className="plat-linkbtn"
                    onClick={() => {
                      onCadastro(patchDeIndicadores(oferta));
                      setOferta(null);
                    }}
                  >
                    Usar estes números
                  </button>
                  <button type="button" className="plat-linkbtn" onClick={() => setOferta(null)}>
                    Manter os meus
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* O LINK DO PERFIL — a única forma que existe de chegar ao Scholar.
            O id `user=` é opaco, não está em lugar nenhum que possamos ler
            (tentado pelo ORCID: veio vazio em todos os testados) e procurar
            autor por nome é o que o robots.txt proíbe. Por isso pede-se o
            link, uma vez, à própria pessoa. */}
        <div className="rel-campo">
          <label htmlFor="m-scholar">
            Página do seu Google Acadêmico
          </label>
          <input
            id="m-scholar"
            /* `inputMode="url"` sem `type="url"`: o teclado certo no celular,
               sem a validação nativa marcando de inválido quem colou o id cru
               em vez do endereço — `extrairScholarId` aceita os dois. */
            inputMode="url"
            placeholder="https://scholar.google.com/citations?user=…"
            value={scholarTexto}
            aria-invalid={erroScholar ? true : undefined}
            aria-describedby="m-scholar-dica"
            onChange={(e) => {
              setScholarTexto(e.target.value);
              if (erroScholar) setErroScholar("");
            }}
            onBlur={aplicarLinkScholar}
          />
          {erroScholar ? <p className="plat-error rel-erro">{erroScholar}</p> : null}
          <small id="m-scholar-dica" className="rel-dica">
            Abra o seu perfil no Google Acadêmico e <strong>copie o endereço da barra do navegador</strong>, ou use o
            botão de compartilhar do próprio perfil, que dá o mesmo link. É <strong>uma vez só</strong>: guardamos o
            identificador e, daqui em diante, o índice H e as citações vêm de lá sozinhos, atualizados, a cada
            relatório.{" "}
            {scholarIdSalvo ? (
              <>
                Guardado:{" "}
                <a href={urlDoPerfilScholar(scholarIdSalvo)} target="_blank" rel="noreferrer">
                  conferir o perfil <ExternalLink size={12} aria-hidden="true" />
                </a>
                . Para desfazer, apague o campo.
              </>
            ) : (
              "Sem ele, o número vem do OpenAlex, que é uma base menor."
            )}
          </small>
        </div>
      </fieldset>

      <div className="rel-campo">
        <label htmlFor="m-idioma">Idioma do formulário</label>
        <select
          id="m-idioma"
          value={membro.idioma}
          onChange={(e) => onCadastro({ idioma: e.target.value === "en" ? "en" : "pt" })}
        >
          <option value="pt">Português</option>
          <option value="en">English</option>
        </select>
        <small className="rel-dica">
          A versão em inglês das telas está em preparação. Por ora, sua escolha fica registrada e vale para os avisos
          que a coordenação enviar.
        </small>
      </div>

      {/* O convite só aparece para quem AINDA NÃO tem senha (quem entrou por
          link/código). Mostrá-lo a quem acabou de digitar a senha para entrar
          lia como descuido — apontado pelo dono em 10/08. A detecção
          (temSenhaAtiva) soma o amr do JWT com a marca user_metadata gravada
          por signUp/updatePassword. */}
      {!temSenhaAtiva(auth.session) ? (
        <details className="rel-dica">
          <summary>Definir uma senha (para voltar sem depender do e-mail)</summary>
          <PasswordCard title="Criar uma senha" cta="Salvar senha" onSubmit={auth.updatePassword} />
        </details>
      ) : null}

      {/* SEM botão próprio de avanço: o casco do wizard já renderiza o
          "Continuar" logo abaixo, e dois botões primários empilhados fazendo a
          mesma coisa ("Está certo" + "Continuar") liam como redundância —
          apontado pelo dono em 10/08. Um único caminho de avanço, o global. */}

      {/* Aqui ficava a "saída de dignidade" ("neste ciclo não tive produção nem
          atividade para relatar"). Removida a pedido do dono (2026-08-07) —
          ver o item 2 do cabeçalho deste arquivo. */}
    </div>
  );
}

// ==================================================== 9. TELA 2 — PRODUÇÃO ===

type ModoAdicao = "nenhum" | "colar" | "manual";

function Tela2({
  ciclo,
  membro,
  periodo,
  producoes,
  orcid,
  setOrcid,
  scholar,
  setScholar,
  onRegistrar,
  onRemover,
  onVinculo,
  onArtigo,
  userId,
  relatoId,
  arquivos,
  onArquivos,
}: {
  ciclo: RelatorioCiclo;
  membro: CicloMembro | null;
  periodo: Periodo;
  producoes: ProducaoDoRelato[];
  orcid: EstadoOrcid;
  setOrcid: (e: EstadoOrcid) => void;
  scholar: EstadoScholar;
  setScholar: (e: EstadoScholar) => void;
  onRegistrar: (entrada: Omit<NovaProducao, "ciclo_id" | "relato_id">) => Promise<{ jaExistia: boolean; producao: Producao }>;
  onRemover: (vinculoId: string) => Promise<void>;
  onVinculo: (vinculoId: string, patch: { menciona_apoio: "sim" | "nao" | "nao_sei" }) => Promise<void>;
  /** Q13 (009) — JCR e Qualis do artigo, gravados na canônica. */
  onArtigo: (producaoId: string, patch: PatchProducaoGforms) => Promise<void>;
  /** O documento obrigatório da pesquisa (13/08) — mora no fim DESTA tela. */
  userId: string;
  relatoId: string | null;
  arquivos: RelatoArquivo[];
  onArquivos: (arquivos: RelatoArquivo[]) => void;
}) {
  const [dispensadas, setDispensadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState<ModoAdicao>("nenhum");
  const [manualInicial, setManualInicial] = useState<Partial<CampoManual> | null>(null);
  const campoDoiRef = useRef<HTMLInputElement | null>(null);

  const orcidId = membro?.orcid ?? "";

  // A busca no ORCID acontece no NAVEGADOR, no momento em que a tela abre —
  // sem Edge Function, sem cron, sem infra nova (§7). O ORCID desta população é
  // POBRE na janela do ciclo, então a tela nunca depende dele para funcionar.
  //
  // `orcid.fase` fica FORA das dependências de propósito: ele muda dentro do
  // próprio efeito, e listá-lo faria a limpeza abortar a requisição um
  // milissegundo depois de criá-la. O `buscadoRef` é quem garante uma busca só.
  const buscadoRef = useRef("");
  useEffect(() => {
    if (!orcidId || orcid.fase !== "ocioso" || buscadoRef.current === orcidId) return;
    buscadoRef.current = orcidId;
    const controlador = new AbortController();
    setOrcid({ fase: "buscando" });

    (async () => {
      const lista = await trabalhosDoOrcid(orcidId, periodo, { signal: controlador.signal });
      if (controlador.signal.aborted) return;
      if (!lista.ok) {
        setOrcid({ fase: "vazio", motivo: "Não conseguimos consultar o ORCID agora." });
        return;
      }
      const { noPeriodo, ambiguos } = separarPorPeriodo(lista.trabalhos);
      const candidatos = [...noPeriodo, ...ambiguos];
      if (!candidatos.length) {
        setOrcid({ fase: "vazio", motivo: "Seu ORCID não tem trabalhos no período." });
        return;
      }
      const dois = candidatos.map((t) => t.doi).filter((d): d is string => Boolean(d));
      const resolvidos = dois.length ? await resolverLote(dois, { signal: controlador.signal }) : [];
      if (controlador.signal.aborted) return;

      const porDoi = new Map<string, MetadadosNormalizados>();
      for (const item of resolvidos) if (item.resultado.ok) porDoi.set(item.entrada, item.resultado.dados);

      const linhas: LinhaOrcid[] = candidatos.map((t, i) => {
        const meta = t.doi ? porDoi.get(t.doi) ?? null : null;
        return {
          chave: t.doi ?? `orcid-${t.putCode ?? i}`,
          titulo: meta?.titulo || t.titulo || "(sem título no ORCID)",
          veiculo: meta?.veiculo || t.veiculo || "",
          ano: meta?.ano ?? t.ano,
          doi: t.doi,
          publicadoEm: meta?.publicadoEm ?? null,
          acessoAberto: meta?.acessoAberto ?? null,
          tipo: (meta?.tipo as TipoProducao | null) ?? null,
          metadados: meta ? (meta.cru as MetadadosCsl) : null,
          resolvida: Boolean(meta),
          ambiguo: t.ambiguo,
        };
      });
      setOrcid({ fase: "pronto", linhas });
    })().catch(() => {
      if (!controlador.signal.aborted) {
        setOrcid({ fase: "vazio", motivo: "Não conseguimos consultar o ORCID agora." });
      }
    });

    return () => controlador.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcidId, periodo, setOrcid]);

  // -------------------------------------------- os artigos do Google Acadêmico
  // Só busca quando a pessoa colou o link do perfil na Tela 1 (`scholar_id`): o
  // `scholar_id` é IDENTIFICADOR, não consulta por nome — o robots.txt do
  // Scholar proíbe busca de autor, e este caminho nunca a faz. A Edge Function
  // lê a página do perfil (mesmo endpoint do índice H), e cada artigo, que vem
  // SEM DOI, é casado no Crossref por título+ano para virar candidato ancorado.
  //
  // Como no ORCID, `scholar.fase` fica FORA das dependências: ele muda dentro do
  // efeito, e o `buscadoScholarRef` é quem garante uma busca só. Nada aqui trava
  // a tela: bloqueio/plataforma-off degradam em silêncio e o ORCID segue.
  const scholarId = membro?.scholar_id ?? "";
  const buscadoScholarRef = useRef("");
  useEffect(() => {
    if (!scholarId || scholar.fase !== "ocioso" || buscadoScholarRef.current === scholarId) return;
    buscadoScholarRef.current = scholarId;
    const controlador = new AbortController();
    setScholar({ fase: "buscando" });

    (async () => {
      const resp = await buscarArtigosDoScholar(scholarId, periodo, { signal: controlador.signal });
      if (controlador.signal.aborted) return;
      if (!resp.artigos.length) {
        setScholar({ fase: "vazio", motivo: motivoScholarTexto(resp.motivo) });
        return;
      }
      // Descobre o DOI de cada artigo pelo Crossref (título+ano), com a mesma
      // concorrência do polite pool. Match fraco devolve `null` e o item segue
      // como candidato manual — nunca se afirma o DOI de outro trabalho.
      const dois = await executarComConcorrencia(resp.artigos, CONCORRENCIA, (a) =>
        resolverArtigoADoi(a, { signal: controlador.signal }),
      );
      if (controlador.signal.aborted) return;

      const linhas: LinhaScholar[] = resp.artigos.map((a, i) => ({
        chave: `scholar-${i}`,
        titulo: a.titulo,
        veiculo: a.veiculo,
        autores: a.autores,
        ano: a.ano,
        truncado: a.truncado,
        link: a.link,
        doi: dois[i],
        resolvida: Boolean(dois[i]),
      }));
      setScholar({ fase: "pronto", linhas });
    })().catch(() => {
      if (!controlador.signal.aborted) setScholar({ fase: "vazio", motivo: "" });
    });

    return () => controlador.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarId, periodo, setScholar]);

  const jaDeclarados = useMemo(
    () => new Set(producoes.map((p) => p.producao.ancora_valor.toLowerCase())),
    [producoes],
  );

  const linhasVisiveis =
    orcid.fase === "pronto"
      ? orcid.linhas.filter((l) => !dispensadas.has(l.chave) && !(l.doi && jaDeclarados.has(l.doi.toLowerCase())))
      : [];

  const semLista = orcid.fase === "vazio" || (orcid.fase === "pronto" && linhasVisiveis.length === 0);

  // Deduplicação do Google Acadêmico: um artigo do Scholar não aparece se já foi
  // registrado, nem se já está na lista do ORCID acima. O DOI é a âncora quando
  // resolvido; sem DOI, o par título-normalizado + ano faz o casamento. Isto
  // impede que o mesmo trabalho seja oferecido duas vezes, de duas fontes.
  const chavesDeclaradas = useMemo(() => {
    const titulos = new Set<string>();
    for (const { producao } of producoes) {
      const k = chaveTituloAno(tituloDaProducao(producao), producao.ano);
      if (k) titulos.add(k);
    }
    return titulos;
  }, [producoes]);

  const chavesOrcidVisiveis = new Set<string>();
  for (const l of linhasVisiveis) {
    const k = chaveTituloAno(l.titulo, l.ano);
    if (k) chavesOrcidVisiveis.add(k);
  }
  const doisOrcidVisiveis = new Set(
    linhasVisiveis.filter((l) => l.doi).map((l) => (l.doi as string).toLowerCase()),
  );

  const linhasScholarVisiveis =
    scholar.fase === "pronto"
      ? scholar.linhas.filter((l) => {
          if (dispensadas.has(l.chave)) return false;
          const doi = l.doi?.toLowerCase();
          if (doi && (jaDeclarados.has(doi) || doisOrcidVisiveis.has(doi))) return false;
          const k = chaveTituloAno(l.titulo, l.ano);
          if (k && (chavesDeclaradas.has(k) || chavesOrcidVisiveis.has(k))) return false;
          return true;
        })
      : [];

  // A tela NUNCA fica vazia: sem lista, o foco vai para o campo de colar DOI,
  // já pronto para receber. Só movemos o foco se ninguém estiver digitando —
  // a busca no ORCID pode demorar 8 s, e roubar o cursor de quem já começou a
  // preencher outra coisa é pior do que não ajudar.
  useEffect(() => {
    if (!semLista) return;
    const ativo = document.activeElement;
    if (ativo && ativo !== document.body) return;
    campoDoiRef.current?.focus();
  }, [semLista]);

  const aceitarDoOrcid = async (linha: LinhaOrcid) => {
    setErro("");
    if (!linha.doi) {
      setManualInicial({ titulo: linha.titulo, veiculo: linha.veiculo, ano: linha.ano ? String(linha.ano) : "" });
      setModo("manual");
      return;
    }
    try {
      await onRegistrar({
        ancora_tipo: "doi",
        ancora_valor: linha.doi,
        tipo: linha.tipo ?? "artigo_periodico",
        ancora_resolvida: linha.resolvida,
        ano: linha.ano,
        publicado_em: linha.publicadoEm,
        acesso_aberto: linha.acessoAberto,
        metadados: linha.metadados ?? {},
        origem: "orcid",
      });
      setDispensadas((s) => new Set(s).add(linha.chave));
    } catch (e) {
      setErro(erroDeRelato(e));
    }
  };

  /* As duas mutações da lista "Suas produções" passam pelo MESMO estado de
     erro dos aceites: sem o try/catch, a rejeição (rede, RLS de ciclo
     consolidado) era engolida como unhandled rejection — o item "não saía" ou
     o select "voltava sozinho", sem uma palavra na tela. */
  const removerItem = async (vinculoId: string) => {
    setErro("");
    try {
      await onRemover(vinculoId);
    } catch (e) {
      setErro(erroDeRelato(e));
    }
  };

  const mudarApoio = async (vinculoId: string, valor: "sim" | "nao" | "nao_sei") => {
    setErro("");
    try {
      await onVinculo(vinculoId, { menciona_apoio: valor });
    } catch (e) {
      setErro(erroDeRelato(e));
    }
  };

  const aceitarDoScholar = async (linha: LinhaScholar) => {
    setErro("");
    // Sem DOI confirmado: cai no MESMO caminho manual do ORCID sem DOI —
    // título + ano + veículo, e o link do perfil como âncora. Nada de DOI
    // inventado; o item entra "sem confirmação automática" e a pessoa confere.
    if (!linha.doi) {
      // Abre o formulário manual pré-preenchido — NÃO dispensa a linha: se a
      // pessoa cancelar, o candidato continua na lista; se registrar, a
      // deduplicação por título+ano o remove sozinho. Espelha o ORCID sem DOI.
      setManualInicial({
        titulo: linha.titulo,
        veiculo: linha.veiculo,
        ano: linha.ano ? String(linha.ano) : "",
        ancora: linha.link ?? "",
      });
      setModo("manual");
      return;
    }
    try {
      // Com DOI casado, resolve o CSL completo (autores, veículo, licença) para
      // gravar um item ANCORADO normal. Se o Crossref não devolver o registro
      // agora, grava ancorado no DOI mesmo assim, sem confirmação automática.
      const r = await resolverDoi(linha.doi);
      if (r.ok) {
        await onRegistrar({
          ancora_tipo: "doi",
          ancora_valor: linha.doi,
          tipo: (r.dados.tipo as TipoProducao | null) ?? "artigo_periodico",
          ancora_resolvida: true,
          ano: r.dados.ano ?? linha.ano,
          publicado_em: r.dados.publicadoEm,
          acesso_aberto: r.dados.acessoAberto,
          metadados: r.dados.cru as MetadadosCsl,
          origem: "importado",
          autores: r.dados.autores.map((a) => ({ ordem: a.ordem, nome: a.nome, orcid: a.orcid })),
        });
      } else {
        await onRegistrar({
          ancora_tipo: "doi",
          ancora_valor: linha.doi,
          tipo: "artigo_periodico",
          ancora_resolvida: false,
          ano: linha.ano,
          metadados: { title: linha.titulo, "container-title": linha.veiculo },
          origem: "importado",
        });
      }
      setDispensadas((s) => new Set(s).add(linha.chave));
    } catch (e) {
      setErro(erroDeRelato(e));
    }
  };

  return (
    <div className="plat-fields">
      {membro?.papel === "tecnico_admin" ? (
        <p className="plat-notice rel-dica">
          <Info size={16} aria-hidden="true" /> Se você não publica, tudo bem. Vá direto para a próxima tela. A parte
          que importa no seu caso é a de participação nas atividades do laboratório.
        </p>
      ) : null}

      {orcid.fase === "buscando" ? (
        <p className="plat-loading" aria-live="polite">
          <Loader2 size={18} aria-hidden="true" /> Procurando sua produção no ORCID…
        </p>
      ) : null}

      {orcid.fase === "pronto" && linhasVisiveis.length ? (
        <>
          <p aria-live="polite">
            <strong>
              Encontramos {linhasVisiveis.length} produç{linhasVisiveis.length === 1 ? "ão sua" : "ões suas"} entre{" "}
              {dataBr(periodo.inicio)} e {dataBr(periodo.fim)}.
            </strong>{" "}
            Um toque por item.
          </p>
          <ul className="plat-list">
            {linhasVisiveis.map((l) => (
              <li key={l.chave} className="rel-item">
                <p className="rel-item-titulo">{l.titulo}</p>
                <p className="rel-item-meta">
                  {[l.veiculo, l.ano ? String(l.ano) : "", l.doi ? `DOI ${l.doi}` : "sem DOI"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {l.ambiguo ? (
                  <p className="rel-chip">
                    Só o ano está declarado no ORCID: pode ser de dentro ou de fora do período. Você decide.
                  </p>
                ) : null}
                <div className="rel-escolhas">
                  <button className="button primary rel-escolha" onClick={() => void aceitarDoOrcid(l)}>
                    É minha e é do CONEXÃO
                  </button>
                  <button
                    className="button plat-ghost rel-escolha"
                    onClick={() => setDispensadas((s) => new Set(s).add(l.chave))}
                  >
                    Não é do CONEXÃO
                  </button>
                  <button
                    className="button plat-ghost rel-escolha"
                    onClick={() => setDispensadas((s) => new Set(s).add(l.chave))}
                  >
                    Não é minha
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {scholar.fase === "buscando" ? (
        <p className="plat-loading" aria-live="polite">
          <Loader2 size={18} aria-hidden="true" /> Procurando no seu Google Acadêmico…
        </p>
      ) : null}

      {linhasScholarVisiveis.length ? (
        <div className="rel-scholar">
          <p aria-live="polite">
            <strong>
              No seu Google Acadêmico, encontramos {linhasScholarVisiveis.length}{" "}
              {linhasScholarVisiveis.length === 1 ? "trabalho deste período" : "trabalhos deste período"} que ainda não
              estão na sua lista.
            </strong>{" "}
            O Google Acadêmico às vezes corta o título e não traz o DOI — confira cada um antes de confirmar.
          </p>
          <ul className="plat-list">
            {linhasScholarVisiveis.map((l) => (
              <li key={l.chave} className="rel-item">
                <p className="rel-item-titulo">
                  {l.titulo}
                  {l.truncado ? (
                    <span className="rel-opcional"> (título cortado pelo Google Acadêmico)</span>
                  ) : null}
                </p>
                <p className="rel-item-meta">
                  {[
                    l.veiculo,
                    l.ano ? String(l.ano) : "",
                    l.doi ? `DOI ${l.doi}` : "sem DOI — confira os dados ao registrar",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="rel-chip">do seu Google Acadêmico</p>
                <div className="rel-escolhas">
                  <button className="button primary rel-escolha" onClick={() => void aceitarDoScholar(l)}>
                    {l.doi ? "É minha e é do CONEXÃO" : "É minha: conferir e registrar"}
                  </button>
                  <button
                    className="button plat-ghost rel-escolha"
                    onClick={() => setDispensadas((s) => new Set(s).add(l.chave))}
                  >
                    Não é do CONEXÃO
                  </button>
                  <button
                    className="button plat-ghost rel-escolha"
                    onClick={() => setDispensadas((s) => new Set(s).add(l.chave))}
                  >
                    Não é minha
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scholarId && scholar.fase === "vazio" && scholar.motivo ? (
        <p className="plat-hint">{scholar.motivo}</p>
      ) : null}

      {semLista ? (
        <p className="plat-hint">
          {orcid.fase === "vazio" ? orcid.motivo : linhasScholarVisiveis.length ? "" : "Nada mais a confirmar por aqui."}{" "}
          Cole os DOIs. Cada um leva 5 segundos.
        </p>
      ) : null}

      {!orcidId ? (
        <p className="plat-hint">
          Você não informou um ORCID na tela anterior, então não temos de onde buscar sua produção. Cole os DOIs
          abaixo. Cada um leva 5 segundos.
        </p>
      ) : null}

      <AdicionarProducao
        ciclo={ciclo}
        campoRef={campoDoiRef}
        modo={modo}
        setModo={setModo}
        manualInicial={manualInicial}
        setManualInicial={setManualInicial}
        onRegistrar={onRegistrar}
      />

      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}

      <h3>
        Suas produções neste relato {producoes.length ? `(${producoes.length})` : ""}
      </h3>
      {producoes.length ? (
        <ul className="plat-list">
          {producoes.map(({ producao, vinculo }) => (
            <li key={vinculo.id} className="rel-item">
              <p className="rel-item-titulo">{tituloDaProducao(producao)}</p>
              <p className="rel-item-meta">
                {[
                  ROTULO_TIPO_PRODUCAO[producao.tipo],
                  veiculoDaProducao(producao),
                  producao.ano ? String(producao.ano) : "",
                  `${producao.ancora_tipo.toUpperCase()} ${producao.ancora_valor}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <ChipPeriodo situacao={producao.periodo_situacao} />
              {!producao.ancora_resolvida ? (
                <p className="rel-chip">
                  Sem confirmação automática do identificador. Vale registrar assim mesmo. A coordenação confere
                  depois.
                </p>
              ) : null}
              <div className="rel-campo">
                <label htmlFor={`apoio-${vinculo.id}`}>
                  O trabalho menciona o apoio do INCT/CNPq? <span className="rel-opcional">(opcional)</span>
                </label>
                <select
                  id={`apoio-${vinculo.id}`}
                  value={vinculo.menciona_apoio}
                  onChange={(e) => void mudarApoio(vinculo.id, e.target.value as "sim" | "nao" | "nao_sei")}
                >
                  <option value="nao_sei">Não sei</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              {producao.tipo === "artigo_periodico" ? (
                <CamposArtigo producao={producao} onSalvar={(patch) => onArtigo(producao.id, patch)} />
              ) : null}
              <button className="plat-linkbtn" onClick={() => void removerItem(vinculo.id)}>
                <Trash2 size={14} aria-hidden="true" /> Não é minha: remover deste relato
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="plat-empty">Nenhuma produção registrada ainda. Dá para enviar o relato sem nenhuma.</p>
      )}

      {/* O DOCUMENTO OBRIGATÓRIO da pesquisa — logo depois dos artigos
          (decisão do dono, 13/08). Sem relato aberto ainda não há onde
          pendurar o arquivo; o caso é transitório (a carga abre o relato). */}
      {relatoId ? (
        <AnexoDocumento
          userId={userId}
          ciclo={ciclo}
          relatoId={relatoId}
          arquivos={arquivos}
          onMudou={onArquivos}
        />
      ) : null}
    </div>
  );
}

type CampoManual = { titulo: string; veiculo: string; ano: string; ancora: string; tipo: TipoProducao; descricao: string };

const MANUAL_VAZIO: CampoManual = {
  titulo: "",
  veiculo: "",
  ano: "",
  ancora: "",
  tipo: "artigo_periodico",
  descricao: "",
};

/**
 * As três formas de acrescentar (§3.1): DOI único, colar vários e registrar
 * sem DOI. A terceira fica SEMPRE visível — é a que salva a pessoa quando a
 * API cai, quando o item é um relatório técnico ou quando o DOI não existe.
 */
function AdicionarProducao({
  ciclo,
  campoRef,
  modo,
  setModo,
  manualInicial,
  setManualInicial,
  onRegistrar,
}: {
  ciclo: RelatorioCiclo;
  campoRef: React.RefObject<HTMLInputElement | null>;
  modo: ModoAdicao;
  setModo: (m: ModoAdicao) => void;
  manualInicial: Partial<CampoManual> | null;
  setManualInicial: (v: Partial<CampoManual> | null) => void;
  onRegistrar: (entrada: Omit<NovaProducao, "ciclo_id" | "relato_id">) => Promise<{ jaExistia: boolean; producao: Producao }>;
}) {
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [previa, setPrevia] = useState<{ meta: MetadadosNormalizados; tipoAncora: AncoraTipo; valor: string } | null>(
    null,
  );
  const [dedupe, setDedupe] = useState<{
    frase: string;
    tipoAncora: AncoraTipo;
    valor: string;
    tipo: TipoProducao;
    ano: number | null;
  } | null>(null);
  const [coautores, setCoautores] = useState<string[]>([]);
  const [colagem, setColagem] = useState("");
  const [lote, setLote] = useState<
    | null
    | {
        itens: { valor: string; tipo: AncoraTipo; titulo: string; ano: number | null; tipoProducao: TipoProducao | null; meta: MetadadosCsl | null; resolvida: boolean; marcado: boolean }[];
        naoReconhecidos: string[];
      }
  >(null);
  const [manual, setManual] = useState<CampoManual>(MANUAL_VAZIO);

  useEffect(() => {
    if (manualInicial) {
      setManual({ ...MANUAL_VAZIO, ...manualInicial });
      setManualInicial(null);
    }
  }, [manualInicial, setManualInicial]);

  const limpar = () => {
    setPrevia(null);
    setDedupe(null);
    setCoautores([]);
    setTexto("");
  };

  const buscar = async () => {
    setErro("");
    setMensagem("");
    setPrevia(null);
    setDedupe(null);
    const bruto = texto.trim();
    if (!bruto) return;

    const tipoAncora = detectarTipoAncora(bruto);
    if (!tipoAncora) {
      // Nada de tela de erro: o que a pessoa digitou vai inteiro para o
      // registro manual, que é a degradação prevista de toda a cadeia de APIs.
      setManual({ ...MANUAL_VAZIO, ancora: bruto });
      setModo("manual");
      setMensagem("Não reconhecemos esse identificador. Complete os quatro campos abaixo e seguimos.");
      return;
    }

    const valor = valorParaGravar(tipoAncora, bruto);
    setOcupado(true);
    try {
      const checagem = await checarAncora(ciclo.id, tipoAncora, valor);
      if (checagem.existe) {
        // O nome de quem declarou primeiro NÃO vem nesta resposta, e é de
        // propósito: só depois da confirmação de coautoria é que nomes aparecem.
        setDedupe({
          frase: mensagemDedupe(checagem),
          tipoAncora,
          valor,
          tipo: checagem.tipo,
          ano: checagem.ano,
        });
        setOcupado(false);
        return;
      }
      const r = tipoAncora === "isbn" ? await resolverIsbn(valor) : await resolverDoi(valor);
      setOcupado(false);
      if (!r.ok) {
        setManual({ ...MANUAL_VAZIO, ancora: valor });
        setModo("manual");
        setMensagem(r.mensagem);
        return;
      }
      setPrevia({ meta: r.dados, tipoAncora, valor });
    } catch (e) {
      setOcupado(false);
      setErro(erroDeRelato(e));
    }
  };

  const confirmarPrevia = async () => {
    if (!previa) return;
    setOcupado(true);
    setErro("");
    try {
      await onRegistrar({
        ancora_tipo: previa.tipoAncora,
        ancora_valor: previa.valor,
        tipo: (previa.meta.tipo as TipoProducao | null) ?? "artigo_periodico",
        ancora_resolvida: true,
        ano: previa.meta.ano,
        publicado_em: previa.meta.publicadoEm,
        acesso_aberto: previa.meta.acessoAberto,
        metadados: previa.meta.cru as MetadadosCsl,
        origem: "doi_colado",
        autores: previa.meta.autores.map((a) => ({
          ordem: a.ordem,
          nome: a.nome,
          orcid: a.orcid,
        })),
      });
      setMensagem("Produção adicionada.");
      limpar();
    } catch (e) {
      setErro(erroDeRelato(e));
    } finally {
      setOcupado(false);
    }
  };

  const confirmarCoautoria = async () => {
    if (!dedupe) return;
    setOcupado(true);
    setErro("");
    try {
      const r = await onRegistrar({
        ancora_tipo: dedupe.tipoAncora,
        ancora_valor: dedupe.valor,
        tipo: dedupe.tipo,
        ano: dedupe.ano,
        origem: "doi_colado",
      });
      // Agora — e só agora — os nomes podem aparecer.
      const autores = await listarAutores(r.producao.id);
      setCoautores(autores.map((a) => a.nome).filter(Boolean));
      setMensagem("Coautoria confirmada. O trabalho conta uma vez para a rede.");
      setDedupe(null);
      setTexto("");
    } catch (e) {
      setErro(erroDeRelato(e));
    } finally {
      setOcupado(false);
    }
  };

  const prepararLote = async () => {
    setErro("");
    setMensagem("");
    const separado = separarColagem(colagem);
    const dois = separado.unicos.filter((u) => u.tipo === "doi").map((u) => u.valor);
    setOcupado(true);
    try {
      const resolvidos = dois.length ? await resolverLote(dois) : [];
      const porDoi = new Map<string, MetadadosNormalizados>();
      for (const item of resolvidos) if (item.resultado.ok) porDoi.set(item.entrada, item.resultado.dados);

      setLote({
        itens: separado.unicos.map((u) => {
          const meta = u.tipo === "doi" ? porDoi.get(u.valor) ?? null : null;
          return {
            valor: u.valor,
            tipo: u.tipo as AncoraTipo,
            titulo: meta?.titulo || u.bruto,
            ano: meta?.ano ?? null,
            tipoProducao: (meta?.tipo as TipoProducao | null) ?? null,
            meta: meta ? (meta.cru as MetadadosCsl) : null,
            resolvida: Boolean(meta),
            marcado: true,
          };
        }),
        naoReconhecidos: separado.naoReconhecidos.map((n) => n.bruto),
      });
    } catch (e) {
      setErro(erroDeRelato(e));
    } finally {
      setOcupado(false);
    }
  };

  const gravarLote = async () => {
    if (!lote) return;
    setOcupado(true);
    setErro("");
    let gravados = 0;
    try {
      for (const item of lote.itens.filter((i) => i.marcado)) {
        await onRegistrar({
          ancora_tipo: item.tipo,
          ancora_valor: item.valor,
          tipo: item.tipoProducao ?? "artigo_periodico",
          ancora_resolvida: item.resolvida,
          ano: item.ano,
          metadados: item.meta ?? {},
          origem: "doi_colado",
        });
        gravados += 1;
      }
      setMensagem(`${gravados} ${gravados === 1 ? "item adicionado" : "itens adicionados"}.`);
      setLote(null);
      setColagem("");
      setModo("nenhum");
    } catch (e) {
      setErro(erroDeRelato(e));
    } finally {
      setOcupado(false);
    }
  };

  const gravarManual = async () => {
    const tituloOk = validarTitulo(manual.titulo);
    if (!tituloOk.ok) {
      setErro(tituloOk.mensagem);
      return;
    }
    if (manual.ancora.trim().length < 3) {
      setErro("Informe um link, DOI, ISBN ou número de registro. É o que permite conferir o item depois.");
      return;
    }
    if (manual.tipo === "outro" && manual.descricao.trim().length < 3) {
      setErro("Descreva em poucas palavras que tipo de produção é esta.");
      return;
    }
    const ancora = ancoraDoManual(manual.tipo, manual.ancora);
    const ano = manual.ano.trim() ? Number(manual.ano.trim()) : null;
    setOcupado(true);
    setErro("");
    try {
      await onRegistrar({
        ancora_tipo: ancora.tipo,
        ancora_valor: ancora.valor,
        tipo: manual.tipo,
        outro_descricao: manual.tipo === "outro" ? manual.descricao.trim() : "",
        ancora_resolvida: false,
        ano: ano && Number.isFinite(ano) ? ano : null,
        metadados: {
          title: manual.titulo.trim(),
          "container-title": manual.veiculo.trim(),
        },
        origem: "manual",
      });
      setMensagem("Item registrado à mão.");
      setManual(MANUAL_VAZIO);
      setModo("nenhum");
    } catch (e) {
      setErro(erroDeRelato(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="rel-campo">
      <label htmlFor="doi-unico">Cole o DOI, o link ou o ISBN</label>
      <input
        id="doi-unico"
        ref={campoRef}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="10.1590/…"
        aria-describedby="doi-unico-dica"
      />
      <small id="doi-unico-dica" className="rel-dica">
        Um por vez. Buscamos os dados e mostramos a citação montada para você conferir antes de gravar.
      </small>
      <div className="plat-nav rel-nav">
        <button className="button primary" onClick={() => void buscar()} disabled={ocupado || !texto.trim()}>
          {ocupado ? "Buscando…" : "Buscar"} <Search size={15} aria-hidden="true" />
        </button>
        <span />
      </div>

      <p aria-live="polite" className="plat-ok">
        {mensagem}
      </p>
      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}
      {coautores.length ? (
        <p className="plat-hint">
          <Users size={14} aria-hidden="true" /> Coautores registrados neste trabalho: {coautores.join("; ")}.
        </p>
      ) : null}

      {dedupe ? (
        <div className="plat-card plat-notice">
          <Users size={20} aria-hidden="true" />
          <div>
            <strong>{dedupe.frase}</strong>
            <p>
              Se você é, criamos o seu vínculo com o mesmo trabalho: dois vínculos, uma contagem. Assim quatro
              coautores da rede não viram quatro artigos na tabela do CNPq.
            </p>
            <div className="plat-nav rel-nav">
              <button className="button plat-ghost" onClick={limpar}>
                Não sou coautor(a)
              </button>
              <button className="button primary" onClick={() => void confirmarCoautoria()} disabled={ocupado}>
                Sou coautor(a) <CheckCircle2 size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previa ? (
        <div className="plat-card">
          <p className="rel-item-titulo">{previa.meta.titulo || "(sem título)"}</p>
          <p className="rel-item-meta">
            {[
              previa.meta.veiculo,
              previa.meta.editora,
              previa.meta.ano ? String(previa.meta.ano) : "",
              previa.meta.tipo ? ROTULO_TIPO_PRODUCAO[previa.meta.tipo as TipoProducao] : "tipo a confirmar",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="rel-item-meta">
            {previa.meta.autores
              .slice(0, 6)
              .map((a) => a.nome)
              .join("; ")}
            {previa.meta.autores.length > 6 ? " et al." : ""}
          </p>
          <div className="plat-nav rel-nav">
            <button className="button plat-ghost" onClick={limpar}>
              Não é esta
            </button>
            <button className="button primary" onClick={() => void confirmarPrevia()} disabled={ocupado}>
              Adicionar esta produção <Plus size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="plat-nav rel-nav">
        <button className="plat-linkbtn" onClick={() => setModo(modo === "colar" ? "nenhum" : "colar")}>
          <ListPlus size={14} aria-hidden="true" /> Colar vários de uma vez
        </button>
        <button className="plat-linkbtn" onClick={() => setModo(modo === "manual" ? "nenhum" : "manual")}>
          <Plus size={14} aria-hidden="true" /> Registrar item sem DOI
        </button>
      </div>

      {modo === "colar" ? (
        <div className="rel-campo">
          <label htmlFor="colagem">Um identificador por linha</label>
          <textarea
            id="colagem"
            rows={6}
            value={colagem}
            onChange={(e) => setColagem(e.target.value)}
            aria-describedby="colagem-dica"
          />
          <small id="colagem-dica" className="rel-dica">
            Pode colar direto da sua lista de publicações. Nada é descartado: o que não for reconhecido volta aqui
            embaixo para você registrar à mão.
          </small>
          <div className="plat-nav rel-nav">
            <span />
            <button className="button primary" onClick={() => void prepararLote()} disabled={ocupado || !colagem.trim()}>
              {ocupado ? "Conferindo…" : "Conferir a lista"} <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>

          {lote ? (
            <>
              <ul className="plat-list">
                {lote.itens.map((item, i) => (
                  <li key={item.valor} className="rel-item">
                    <label className="plat-consent" htmlFor={`lote-${i}`}>
                      <input
                        id={`lote-${i}`}
                        type="checkbox"
                        checked={item.marcado}
                        onChange={(e) =>
                          setLote((atual) =>
                            atual
                              ? {
                                  ...atual,
                                  itens: atual.itens.map((x, j) =>
                                    j === i ? { ...x, marcado: e.target.checked } : x,
                                  ),
                                }
                              : atual,
                          )
                        }
                      />
                      <span>
                        <span className="rel-item-titulo">{item.titulo}</span>
                        <span className="rel-item-meta">
                          {[item.ano ? String(item.ano) : "", item.valor].filter(Boolean).join(" · ")}
                          {item.resolvida ? "" : " · sem confirmação automática"}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {lote.naoReconhecidos.length ? (
                <p className="plat-hint">
                  Não reconhecemos: {lote.naoReconhecidos.join(" · ")}. Use “Registrar item sem DOI” para esses.
                </p>
              ) : null}
              <div className="plat-nav rel-nav">
                <span />
                <button className="button primary" onClick={() => void gravarLote()} disabled={ocupado}>
                  Adicionar os marcados <Plus size={15} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {modo === "manual" ? (
        <fieldset className="plat-fields">
          <legend>Registrar item sem DOI</legend>
          <div className="rel-campo">
            <label htmlFor="man-tipo">Tipo de produção</label>
            <select
              id="man-tipo"
              value={manual.tipo}
              onChange={(e) => setManual((m) => ({ ...m, tipo: e.target.value as TipoProducao }))}
            >
              <optgroup label="Mais comuns">
                {TIPOS_PRODUCAO_LISTA_CURTA.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_PRODUCAO[t]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Todos os tipos">
                {TIPOS_PRODUCAO.filter((t) => !TIPOS_PRODUCAO_LISTA_CURTA.includes(t)).map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_PRODUCAO[t]}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          {manual.tipo === "outro" ? (
            <div className="rel-campo">
              <label htmlFor="man-descricao">Que tipo de produção é esta?</label>
              <input
                id="man-descricao"
                value={manual.descricao}
                onChange={(e) => setManual((m) => ({ ...m, descricao: e.target.value }))}
              />
            </div>
          ) : null}
          <div className="rel-campo">
            <label htmlFor="man-titulo">Título</label>
            <input
              id="man-titulo"
              value={manual.titulo}
              onChange={(e) => setManual((m) => ({ ...m, titulo: e.target.value }))}
            />
          </div>
          <div className="rel-campo">
            <label htmlFor="man-veiculo">
              Onde saiu <span className="rel-opcional">(periódico, evento, editora, repositório)</span>
            </label>
            <input
              id="man-veiculo"
              value={manual.veiculo}
              onChange={(e) => setManual((m) => ({ ...m, veiculo: e.target.value }))}
            />
          </div>
          <div className="rel-campo">
            <label htmlFor="man-ano">Ano</label>
            <input
              id="man-ano"
              inputMode="numeric"
              value={manual.ano}
              onChange={(e) => setManual((m) => ({ ...m, ano: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
            />
          </div>
          <div className="rel-campo">
            <label htmlFor="man-ancora">Link, DOI, ISBN ou número de registro</label>
            <input
              id="man-ancora"
              value={manual.ancora}
              onChange={(e) => setManual((m) => ({ ...m, ancora: e.target.value }))}
              aria-describedby="man-ancora-dica"
            />
            <small id="man-ancora-dica" className="rel-dica">
              Qualquer referência que permita achar o item depois. É ela que evita que o mesmo trabalho seja contado
              duas vezes quando outro coautor da rede o declarar.
            </small>
          </div>
          <div className="plat-nav rel-nav">
            <button className="button plat-ghost" onClick={() => setModo("nenhum")}>
              Cancelar
            </button>
            <button className="button primary" onClick={() => void gravarManual()} disabled={ocupado}>
              Adicionar <Plus size={15} aria-hidden="true" />
            </button>
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

/**
 * O selo da DECISÃO 3: aceito, marcado, guardado — nunca recusado.
 * É um `<span>` (e não um `<p>`) porque aparece dentro de rótulos de caixa de
 * seleção, onde só cabe conteúdo de frase.
 */
function ChipPeriodo({ situacao }: { situacao: PeriodoSituacao }) {
  if (situacao === "no_periodo") return null;
  return (
    <span className="rel-chip rel-chip--fora">
      <strong>{ROTULO_PERIODO_SITUACAO[situacao]}:</strong> {MENSAGEM_PERIODO_SITUACAO[situacao]}
    </span>
  );
}

/**
 * Q13 (009) — JCR e Qualis do artigo, RECOLHIDOS num `<details>`: quem só
 * confere a lista não os vê abertos; quem já preencheu os reencontra abertos.
 * Manuais e opcionais (decisão 2 do relato-gforms): não há base pública
 * confiável, e fingir derivação seria pior que pedir. O Qualis é `<select>`
 * com os 10 valores do CHECK — texto livre aqui produziria erro de banco.
 */
function CamposArtigo({
  producao,
  onSalvar,
}: {
  producao: Producao;
  onSalvar: (patch: PatchProducaoGforms) => Promise<void>;
}) {
  const [jcrTexto, setJcrTexto] = useState(producao.jcr != null ? String(producao.jcr) : "");
  const [erro, setErro] = useState("");
  /** Aberto de saída só para quem JÁ preencheu (constante: toggle fica nativo). */
  const [abertoDeSaida] = useState(producao.jcr != null || producao.qualis != null);
  const jcrValidacao = jcrTexto.trim() ? validarJcr(jcrTexto) : null;

  const salvar = async (patch: PatchProducaoGforms) => {
    setErro("");
    try {
      await onSalvar(patch);
    } catch (e) {
      setErro(erroDeRelato(e));
    }
  };

  return (
    <details className="rel-dica" open={abertoDeSaida || undefined}>
      <summary>JCR e Qualis do periódico (opcional)</summary>
      <div className="rel-campo">
        <label htmlFor={`jcr-${producao.id}`}>Fator de impacto (JCR)</label>
        <input
          id={`jcr-${producao.id}`}
          inputMode="decimal"
          placeholder="3,2"
          value={jcrTexto}
          aria-invalid={jcrValidacao ? !jcrValidacao.ok : undefined}
          onChange={(e) => setJcrTexto(e.target.value)}
          onBlur={() => {
            const v = validarJcr(jcrTexto);
            if (v.ok) void salvar({ jcr: v.valor ? Number(v.valor) : null });
          }}
        />
        {jcrValidacao && !jcrValidacao.ok ? <p className="plat-error rel-erro">{jcrValidacao.mensagem}</p> : null}
      </div>
      <div className="rel-campo">
        <label htmlFor={`qualis-${producao.id}`}>Qualis</label>
        <select
          id={`qualis-${producao.id}`}
          value={producao.qualis ?? ""}
          onChange={(e) => void salvar({ qualis: qualisOuNull(e.target.value) })}
        >
          <option value="">Não sei / não se aplica</option>
          {QUALIS_OPCOES.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        <small className="rel-dica">
          Preencha se souber. Não há base pública para conferirmos por você. Vale para o trabalho inteiro: seus
          coautores da rede veem o mesmo valor.
        </small>
      </div>
      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}
    </details>
  );
}

// ================================================ 10. TELA 3 — LABORATÓRIO ===

function Tela3({
  ciclo,
  membro,
  lab,
  fatos,
  adesoes,
  propostas,
  periodo,
  objetivosConfirmados,
  erroAdesao,
  onAderir,
  onPropor,
  onObjetivos,
}: {
  ciclo: RelatorioCiclo;
  membro: CicloMembro | null;
  lab: Laboratorio | null;
  fatos: Fato[];
  adesoes: FatoParticipante[];
  propostas: Fato[];
  periodo: Periodo;
  /** Q20 — o que já foi confirmado; `undefined` = a pessoa nunca confirmou. */
  objetivosConfirmados: number[] | undefined;
  /** Falha ao gravar uma participação — exibida junto à lista de fatos. */
  erroAdesao: string;
  onAderir: (fatoId: string, participar: boolean) => Promise<void>;
  onPropor: (entrada: { tipo: TipoFato; ocorrido_em: string; titulo: string }) => Promise<void>;
  onObjetivos: (numeros: number[]) => void;
}) {
  /* A seção de contar atividades é SEMPRE VISÍVEL (decisão do dono, 13/08 —
     evoluiu do "abre quando a lista está vazia" do mesmo dia): não existe mais
     estado de recolhimento. */
  const [tipo, setTipo] = useState<TipoFato | "">("");
  const [quando, setQuando] = useState("");
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);
  /**
   * Para onde o foco volta depois de um envio: a primeira ficha de tipo. O
   * formulário fica ABERTO entre um envio e o próximo (ver `enviarProposta`), e
   * quem navega por teclado precisa cair no começo do ciclo, não no botão de
   * enviar de um formulário já vazio.
   */
  const primeiraFichaRef = useRef<HTMLButtonElement | null>(null);

  /** Há algo digitado? Decide se o alvo "Limpar campos" aparece. */
  const temRascunhoAberto = Boolean(tipo || quando || titulo.trim());

  const aderidos = useMemo(() => new Set(adesoes.map((a) => a.fato_id)), [adesoes]);
  const tiposVisiveis = tiposDeFatoVisiveis(membro, lab);
  const avaliacao = quando ? avaliarData(quando, periodo, hojeIso()) : null;

  const porTipo = useMemo(() => {
    const mapa = new Map<TipoFato, Fato[]>();
    for (const f of fatos) {
      const lista = mapa.get(f.tipo) ?? [];
      lista.push(f);
      mapa.set(f.tipo, lista);
    }
    return mapa;
  }, [fatos]);

  if (!membro?.laboratorio_id) {
    return (
      <div className="plat-fields">
        <p className="plat-notice">
          <Info size={16} aria-hidden="true" /> Você ainda não está ligado(a) a um Laboratório Associado, então não há
          lista de atividades para marcar. Volte à primeira tela e escolha o seu laboratório, ou siga em frente: nada
          do que você já escreveu se perde.
        </p>
      </div>
    );
  }

  const enviarProposta = async () => {
    setErro("");
    setOk("");
    if (!tipo) {
      setErro("Escolha o tipo da atividade.");
      return;
    }
    const t = validarTitulo(titulo);
    if (!t.ok) {
      setErro(t.mensagem);
      return;
    }
    const data = avaliarData(quando, periodo, hojeIso());
    if (!data.aceita) {
      setErro(data.mensagem);
      return;
    }
    setOcupado(true);
    try {
      await onPropor({ tipo, ocorrido_em: quando, titulo: t.valor });
      /* O FORMULÁRIO FICA ABERTO, e é pedido do dono (2026-08-07): quem tem
         três atividades para contar — uma expedição, uma parceria e uma
         formação — contava a primeira e via o formulário sumir; a maioria
         entendia "só aceita uma" e as outras duas nunca chegavam ao líder.
         Fechar é escolha da pessoa (botão Fechar), não efeito do envio.
         Os campos limpam porque cada atividade é UMA proposta — tipo, data e
         título próprios; o que não muda entre uma e outra não existe. */
      setOk("Enviada! Os campos ficaram prontos para você contar outra atividade, se houver.");
      setTipo("");
      setQuando("");
      setTitulo("");
      primeiraFichaRef.current?.focus();
    } catch (e) {
      setErro(erroDeRelato(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="plat-fields">
      {fatos.length ? (
        <>
          <p>
            Estas são as atividades que {lab ? <strong>{lab.sigla}</strong> : "seu laboratório"} já registrou. Marque
            aquelas de que você participou.
          </p>
          {TIPOS_FATO.filter((t) => porTipo.has(t)).map((t) => (
            <fieldset key={t} className="plat-fields">
              <legend>{ROTULO_TIPO_FATO[t]}</legend>
              {(porTipo.get(t) ?? []).map((f) => (
                <label key={f.id} className="plat-consent rel-item rel-escolha" htmlFor={`fato-${f.id}`}>
                  <input
                    id={`fato-${f.id}`}
                    type="checkbox"
                    checked={aderidos.has(f.id)}
                    onChange={(e) => void onAderir(f.id, e.target.checked)}
                  />
                  <span>
                    <span className="rel-item-titulo">{f.titulo}</span>
                    <span className="rel-item-meta">{dataBr(f.ocorrido_em)}</span>
                    <ChipPeriodo situacao={f.periodo_situacao} />
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </>
      ) : (
        <p className="plat-notice">
          <Info size={16} aria-hidden="true" /> Seu laboratório ainda não registrou as atividades do ano. O que você
          contar aqui vai para a conferência do(a) líder.
        </p>
      )}

      {erroAdesao ? <p className="plat-error rel-erro">{erroAdesao}</p> : null}

      <h3>Aconteceu algo que não está nesta lista?</h3>
      <p className="rel-dica">
        Expedição, ação de divulgação, parceria, formação: essas coisas são coletivas e o laboratório as declara uma
        vez só. Se cada participante criasse a sua, uma expedição de cinco pessoas viraria cinco expedições. Conte
        aqui e o(a) líder confirma.
      </p>

      {/* SEMPRE EXPANDIDA (decisão do dono, 13/08): o seletor de atividades
          não vive mais atrás de um botão — a tela mostra de cara o que dá
          para fazer, com ou sem fatos na lista. */}
      {(
        <fieldset className="plat-fields">
          <legend>Contar atividades ao(à) líder do laboratório</legend>
          <p className="rel-dica">
            Uma de cada vez, quantas precisar: a cada envio os campos limpam e você pode contar a próxima.
          </p>
          <div className="rel-fichas">
            {tiposVisiveis.map((t, i) => (
              <button
                key={t}
                ref={i === 0 ? primeiraFichaRef : undefined}
                type="button"
                className={`rel-ficha rel-escolha${tipo === t ? " rel-ficha--ativa" : ""}`}
                aria-pressed={tipo === t}
                onClick={() => setTipo(t)}
              >
                {ROTULO_TIPO_FATO[t]}
              </button>
            ))}
          </div>
          <div className="rel-campo">
            <label htmlFor="prop-quando">Quando aconteceu</label>
            <input
              id="prop-quando"
              type="date"
              value={quando}
              max={hojeIso()}
              onChange={(e) => setQuando(e.target.value)}
              aria-describedby="prop-quando-dica"
              aria-invalid={avaliacao ? !avaliacao.aceita : undefined}
            />
            <small id="prop-quando-dica" className="rel-dica">
              Se não lembrar o dia, use o dia 1 do mês. {avaliacao && avaliacao.mensagem ? avaliacao.mensagem : ""}
            </small>
          </div>
          <div className="rel-campo">
            <label htmlFor="prop-titulo">O quê, em uma linha</label>
            <input
              id="prop-titulo"
              value={titulo}
              maxLength={LIMITES.tituloMax}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          {erro ? <p className="plat-error rel-erro">{erro}</p> : null}
          <div className="plat-nav rel-nav">
            {/* Sem "Fechar": a seção não recolhe mais. Quem digitou e desistiu
                limpa os campos — um alvo discreto, que só aparece quando há o
                que limpar. */}
            {temRascunhoAberto ? (
              <button
                className="plat-linkbtn"
                onClick={() => {
                  setErro("");
                  setTipo("");
                  setQuando("");
                  setTitulo("");
                }}
              >
                Limpar campos
              </button>
            ) : (
              <span />
            )}
            <button className="button primary" onClick={() => void enviarProposta()} disabled={ocupado}>
              {ocupado ? "Enviando…" : "Enviar para conferência"} <Send size={15} aria-hidden="true" />
            </button>
          </div>
        </fieldset>
      )}

      <p aria-live="polite" className="plat-ok">
        {ok}
      </p>

      {propostas.length ? (
        <div className="rel-fila">
          <h3>O que você já contou</h3>
          <ul className="plat-list">
            {propostas.map((p) => (
              <li key={p.id} className="rel-item">
                <p className="rel-item-titulo">{p.titulo}</p>
                <p className="rel-item-meta">
                  {ROTULO_TIPO_FATO[p.tipo]} · {dataBr(p.ocorrido_em)}
                </p>
                <p className="rel-chip">
                  {p.status === "proposto"
                    ? "Aguardando a confirmação do(a) líder do laboratório. Não conta até ser confirmado."
                    : `Não foi confirmado. ${p.observacao_revisao || "Fale com o(a) líder do seu laboratório."}`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Q20, no FIM da Tela 3 (decisão da tarefa: "fim da Tela 3, ou 3b").
          Fica DEPOIS das atividades porque a pergunta é reflexiva — ela faz
          mais sentido quando a pessoa acabou de rever o que fez no ano. Quem
          não tem laboratório nem chega aqui (o return acima), e está certo:
          sem EETs não há de onde derivar, e o caminho é escolher o
          laboratório na Tela 1. */}
      {lab ? (
        <BlocoObjetivos ciclo={ciclo} lab={lab} confirmados={objetivosConfirmados} onConfirmar={onObjetivos} />
      ) : (
        /* Há `laboratorio_id` gravado, mas ele não está na lista ativa do
           ciclo (a coordenação desativou o laboratório). Pular a Q20 em
           silêncio esconderia uma pergunta do relatório; aqui se diz o
           porquê e o caminho. */
        <p className="plat-notice">
          <Info size={16} aria-hidden="true" /> Seu laboratório não está na lista ativa deste ciclo, então não
          conseguimos mostrar os objetivos da proposta para você confirmar. Volte à primeira tela e escolha o seu
          laboratório, ou fale com a coordenação. Nada do que você já marcou se perde.
        </p>
      )}
    </div>
  );
}

/**
 * Q20 — DERIVAR E CONFIRMAR (decisão 1 do relato-gforms). A tela mostra SÓ os
 * objetivos ligados aos EETs do laboratório, JÁ MARCADOS, para a pessoa
 * confirmar ou desmarcar — nunca os 43 crus. O que persiste é a confirmação
 * humana (`respostas.objetivos_confirmados`); a pré-marcação é reproduzível e
 * não é gravada sozinha. Quando o CGES ainda não mapeou o laboratório
 * (`derivavel: false`), caem os 43, agrupados por EET, com aviso e NADA
 * pré-marcado — pré-marcar 43 seria confirmar por atacado.
 */
function BlocoObjetivos({
  ciclo,
  lab,
  confirmados,
  onConfirmar,
}: {
  ciclo: RelatorioCiclo;
  lab: Laboratorio;
  confirmados: number[] | undefined;
  onConfirmar: (numeros: number[]) => void;
}) {
  const [derivacao, setDerivacao] = useState<DerivacaoDeObjetivos | null>(null);
  const [marcados, setMarcados] = useState<Set<number> | null>(null);
  const [confirmadoAgora, setConfirmadoAgora] = useState(false);
  const [falha, setFalha] = useState(false);
  /** "Tentar de novo" da falha do chunk: entra na chave do efeito de carga, e o
   *  carregador de config.ts não memoiza rejeição — a nova tentativa rebusca. */
  const [tentativa, setTentativa] = useState(0);

  /* A derivação depende só dos EETs; a chave em string evita re-buscar quando
     o array vem do banco com a mesma lista em outra referência. */
  const chaveEets = lab.eets.join("|");
  useEffect(() => {
    let vivo = true;
    setFalha(false);
    (async () => {
      const d = await objetivosDosEets(lab.eets);
      // Fallback dos 43: reusa a MESMA derivação com as 8 EETs conhecidas —
      // o agrupamento por EET vem de graça e o texto é o da proposta.
      const efetiva: DerivacaoDeObjetivos = d.derivavel
        ? d
        : { derivavel: false, objetivos: (await objetivosDosEets(Object.keys(OBJETIVOS_POR_EET))).objetivos };
      if (!vivo) return;
      setDerivacao(efetiva);
    })().catch(() => {
      if (vivo) setFalha(true);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveEets, tentativa]);

  /* A marcação inicial, UMA vez: o que a pessoa já confirmou vence a
     derivação — inclusive um [] confirmado, que é resposta legítima. */
  useEffect(() => {
    if (!derivacao || marcados) return;
    if (confirmados !== undefined) setMarcados(new Set(confirmados));
    else if (derivacao.derivavel) setMarcados(new Set(derivacao.objetivos.map((o) => o.numero)));
    else setMarcados(new Set());
  }, [derivacao, confirmados, marcados]);

  if (falha) {
    /* NUNCA em silêncio (caso real da auditoria de 13/08): sem o chunk da
       proposta, a Q20 sumia sem uma palavra e a revisão dizia "nenhum
       confirmado ainda" como se fosse escolha da pessoa. Aviso honesto, com
       caminho: tentar de novo rebusca o chunk de verdade. */
    return (
      <p className="plat-notice">
        <TriangleAlert size={16} aria-hidden="true" />{" "}
        <span>
          Não conseguimos carregar os objetivos da proposta agora. Sua conexão pode ter oscilado; o resto do relato
          não é afetado.{" "}
          <button type="button" className="plat-linkbtn" onClick={() => setTentativa((n) => n + 1)}>
            Tentar de novo
          </button>
        </span>
      </p>
    );
  }
  if (!derivacao || !marcados) {
    return (
      <p className="plat-loading">
        <Loader2 size={16} aria-hidden="true" /> Carregando os objetivos da proposta…
      </p>
    );
  }

  const alternar = (n: number) => {
    const s = new Set(marcados);
    if (s.has(n)) s.delete(n);
    else s.add(n);
    setMarcados(s);
    onConfirmar([...s].sort((a, b) => a - b));
  };

  const confirmarComoEsta = () => {
    onConfirmar([...marcados].sort((a, b) => a - b));
    setConfirmadoAgora(true);
  };

  const titulos = new Map(eetsDoCiclo(ciclo.config).map((e) => [e.codigo, e.titulo]));
  const grupos = new Map<string, typeof derivacao.objetivos>();
  for (const o of derivacao.objetivos) {
    const lista = grupos.get(o.eet) ?? [];
    lista.push(o);
    grupos.set(o.eet, lista);
  }
  const jaConfirmou = confirmados !== undefined || confirmadoAgora;

  return (
    <fieldset className="plat-fields rel-fila">
      <legend>A quais objetivos da proposta o seu trabalho contribuiu neste ciclo?</legend>
      {derivacao.derivavel ? (
        <p className="rel-dica">
          Estes são os objetivos que <strong>parecem</strong> corresponder às frentes (EETs) do seu laboratório. É um
          palpite nosso para poupar sua leitura, não uma classificação oficial: a proposta lista as frentes e os
          objetivos separadamente, sem dizer quais vão com quais. <strong>Desmarque o que não for seu</strong> e marque
          o que faltar. Vale o que você marcar.
        </p>
      ) : (
        <p className="plat-notice rel-dica">
          <Info size={16} aria-hidden="true" /> A coordenação ainda não mapeou as frentes (EETs) do seu laboratório,
          então mostramos todos os objetivos, agrupados por frente. Marque só os seus.
        </p>
      )}

      {/* CADA EET É UM MENU RECOLHÍVEL (redesign de 10/08, pedido do dono: o
          bloco estava "carregado" — 43 parágrafos em caixas de chip centrado e
          negrito). As regras do peso visual:
          • objetivo agora é LINHA de checklist (.rel-objetivo — à esquerda,
            peso normal), não chip: rel-escolha é para rótulo curto;
          • o grupo abre por padrão SÓ quando é derivado (poucas frentes, já
            pré-marcadas) ou quando já tem marca do usuário — no fallback dos
            43, tudo nasce fechado e o resumo diz o placar de cada frente;
          • o código da EET ganha cor própria (.rel-eet-cod) para o olho achar
            a frente sem ler o título inteiro. */}
      {[...grupos.entries()].map(([eet, objetivos]) => {
        const marcadosAqui = objetivos.filter((o) => marcados.has(o.numero)).length;
        return (
          <details
            key={eet}
            className="rel-dica rel-eet"
            open={derivacao.derivavel || marcadosAqui > 0 || undefined}
          >
            <summary>
              <span className="rel-eet-cod">{eet}</span>
              {titulos.get(eet) ? ` ${titulos.get(eet)}` : ""}
              <span className="rel-eet-placar">
                {marcadosAqui > 0 ? `${marcadosAqui} de ${objetivos.length}` : `${objetivos.length} objetivos`}
              </span>
            </summary>
            {objetivos.map((o) => (
              <label key={o.numero} className="rel-objetivo" htmlFor={`obj-${o.numero}`}>
                <input
                  id={`obj-${o.numero}`}
                  type="checkbox"
                  checked={marcados.has(o.numero)}
                  onChange={() => alternar(o.numero)}
                />
                <span>
                  <strong>{o.numero}.</strong> {o.texto || "(texto no caderno da proposta)"}
                </span>
              </label>
            ))}
          </details>
        );
      })}

      <div className="plat-nav rel-nav">
        <span className="rel-dica">
          {marcados.size} objetivo{marcados.size === 1 ? "" : "s"} marcado{marcados.size === 1 ? "" : "s"}
        </span>
        {!jaConfirmou ? (
          <button type="button" className="button plat-ghost" onClick={confirmarComoEsta}>
            <CheckCircle2 size={15} aria-hidden="true" /> Está certo assim, confirmar
          </button>
        ) : (
          <span className="plat-ok" aria-live="polite">
            Confirmado. Qualquer ajuste aqui já fica salvo.
          </span>
        )}
      </div>
    </fieldset>
  );
}

// ========================================= 11. TELA 4 — FOMENTO E EXTENSÃO ===
/*
 * NOVA na integração do Forms do CTC (Q12, Q21, Q28..Q30) — a única tela que a
 * integração acrescentou, e desenhada para custar SEGUNDOS a quem não tem nada:
 * três perguntas Sim/Não com o Não como default, e o detalhe só aparece no Sim.
 * Tudo opcional; tudo vive em `relatos.respostas` (jsonb da 009) — fomento e
 * extensão são texto estruturado que a coordenação lê, não tabela.
 */

/** Um item de fomento em edição. `valor_brl` fica como texto até o blur. */
function TelaFomento({
  respostas,
  onAplicar,
}: {
  respostas: RespostasRelato;
  onAplicar: (patch: Partial<RespostasRelato>) => void;
}) {
  const fomento = respostas.fomento ?? [];
  const projetos = fomento.filter((f) => !f.complementar);
  const complementares = fomento.filter((f) => f.complementar === true);
  const extensao = respostas.extensao ?? {};

  /* O Sim/Não é estado de TELA (deriva do que existe); o dado é a lista. */
  const [temProjetos, setTemProjetos] = useState(projetos.length > 0);
  const [temComplementar, setTemComplementar] = useState(complementares.length > 0);
  const temExtensao = extensao.tem === true;

  /* CHAVES ESTÁVEIS DE TELA, nunca persistidas. Com `key={i}`, remover o
     projeto 0 fazia o React reaproveitar o estado local do CampoValorBrl do
     REMOVIDO no sobrevivente: o R$ do item apagado aparecia no seguinte e, no
     blur, era gravado no FomentoItem errado. Cada mutação abaixo atualiza as
     chaves em sincronia com a lista; carga externa ressemeia pelo tamanho. */
  const uidSeq = useRef(0);
  const novoUid = () => `fom-${++uidSeq.current}`;
  const uidsProjetos = useRef<string[]>([]);
  const uidsComplementares = useRef<string[]>([]);
  if (uidsProjetos.current.length !== projetos.length) uidsProjetos.current = projetos.map(() => novoUid());
  if (uidsComplementares.current.length !== complementares.length)
    uidsComplementares.current = complementares.map(() => novoUid());

  /* O "Não" não pode destruir no clique: o que a pessoa digitou fica guardado
     e volta inteiro se ela marcar "Sim" de novo nesta visita à tela — um
     clique errado num par de rádios adjacentes não apaga a Q12/Q21. */
  const projetosGuardados = useRef<{ itens: FomentoItem[]; uids: string[] } | null>(null);
  const complementaresGuardados = useRef<{ itens: FomentoItem[]; uids: string[] } | null>(null);

  /** Regrava o jsonb inteiro preservando a ordem projetos → complementares. */
  const gravar = (proxProjetos: FomentoItem[], proxComplementares: FomentoItem[]) => {
    const tudo = [
      ...proxProjetos.map((p) => ({ ...p, complementar: false })),
      ...proxComplementares.map((c) => ({ ...c, complementar: true })),
    ];
    onAplicar({ fomento: tudo });
  };

  const mudarProjeto = (i: number, patch: Partial<FomentoItem>) => {
    gravar(projetos.map((p, j) => (j === i ? { ...p, ...patch } : p)), complementares);
  };
  const mudarComplementar = (i: number, patch: Partial<FomentoItem>) => {
    gravar(projetos, complementares.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  };

  const adicionarProjeto = () => {
    uidsProjetos.current = [...uidsProjetos.current, novoUid()];
    gravar([...projetos, {}], complementares);
  };
  const removerProjeto = (i: number) => {
    uidsProjetos.current = uidsProjetos.current.filter((_, j) => j !== i);
    gravar(projetos.filter((_, j) => j !== i), complementares);
  };
  const adicionarComplementar = () => {
    uidsComplementares.current = [...uidsComplementares.current, novoUid()];
    gravar(projetos, [...complementares, {}]);
  };
  const removerComplementar = (i: number) => {
    uidsComplementares.current = uidsComplementares.current.filter((_, j) => j !== i);
    gravar(projetos, complementares.filter((_, j) => j !== i));
  };

  const mudarExtensao = (patch: Partial<ExtensaoResposta>) => {
    onAplicar({ extensao: { ...extensao, ...patch } });
  };

  return (
    <div className="plat-fields">
      {/* ------------------------------------------ Q12 — projetos correntes */}
      <fieldset className="plat-fields">
        <legend>Você coordena ou integra projeto de pesquisa com número de processo?</legend>
        <div className="rel-escolhas">
          <SimNao
            nome="fom-projetos"
            valor={temProjetos}
            onMudar={(sim) => {
              setTemProjetos(sim);
              if (sim && projetos.length === 0) {
                const guardado = projetosGuardados.current;
                projetosGuardados.current = null;
                uidsProjetos.current = guardado ? [...guardado.uids] : [novoUid()];
                gravar(guardado ? guardado.itens : [{}], complementares);
              }
              if (!sim) {
                projetosGuardados.current = { itens: projetos, uids: [...uidsProjetos.current] };
                uidsProjetos.current = [];
                gravar([], complementares);
              }
            }}
          />
        </div>
        {temProjetos ? (
          <>
            {projetos.map((p, i) => (
              <div key={uidsProjetos.current[i] ?? `p${i}`} className="rel-item plat-fields">
                <div className="rel-campo">
                  <label htmlFor={`proj-agencia-${i}`}>Agência de fomento</label>
                  <input
                    id={`proj-agencia-${i}`}
                    placeholder="CNPq, CAPES, FAPERO…"
                    value={p.agencia ?? ""}
                    onChange={(e) => mudarProjeto(i, { agencia: e.target.value || undefined })}
                  />
                </div>
                <div className="rel-campo">
                  <label htmlFor={`proj-processo-${i}`}>Número do processo</label>
                  <input
                    id={`proj-processo-${i}`}
                    placeholder="como a agência escreve"
                    value={p.processo ?? ""}
                    onChange={(e) => mudarProjeto(i, { processo: e.target.value || undefined })}
                  />
                </div>
                {/* O valor do recurso captado por este processo (pedido do dono,
                    12/08). Reusa o mesmo campo de R$ do financiamento
                    complementar — estimativa, opcional, sai rotulada. */}
                <CampoValorBrl
                  id={`proj-valor-${i}`}
                  valor={p.valor_brl}
                  onSalvar={(n) => mudarProjeto(i, { valor_brl: n ?? undefined })}
                />
                <div className="rel-campo">
                  <label htmlFor={`proj-titulo-${i}`}>
                    Título do projeto <span className="rel-opcional">(opcional)</span>
                  </label>
                  <input
                    id={`proj-titulo-${i}`}
                    value={p.titulo ?? ""}
                    onChange={(e) => mudarProjeto(i, { titulo: e.target.value || undefined })}
                  />
                </div>
                <button className="plat-linkbtn" onClick={() => removerProjeto(i)}>
                  <Trash2 size={14} aria-hidden="true" /> Remover este projeto
                </button>
              </div>
            ))}
            <button className="plat-linkbtn" onClick={adicionarProjeto}>
              <Plus size={14} aria-hidden="true" /> Adicionar outro projeto
            </button>
          </>
        ) : null}
      </fieldset>

      {/* ---------------------------------- Q21 — financiamento complementar */}
      <fieldset className="plat-fields">
        <legend>Recebeu financiamento complementar ao do INCT neste ciclo?</legend>
        <div className="rel-escolhas">
          <SimNao
            nome="fom-complementar"
            valor={temComplementar}
            onMudar={(sim) => {
              setTemComplementar(sim);
              if (sim && complementares.length === 0) {
                const guardado = complementaresGuardados.current;
                complementaresGuardados.current = null;
                uidsComplementares.current = guardado ? [...guardado.uids] : [novoUid()];
                gravar(projetos, guardado ? guardado.itens : [{}]);
              }
              if (!sim) {
                complementaresGuardados.current = { itens: complementares, uids: [...uidsComplementares.current] };
                uidsComplementares.current = [];
                gravar(projetos, []);
              }
            }}
          />
        </div>
        {temComplementar ? (
          <>
            {complementares.map((c, i) => (
              <div key={uidsComplementares.current[i] ?? `c${i}`} className="rel-item plat-fields">
                <div className="rel-campo">
                  <label htmlFor={`comp-agencia-${i}`}>De qual agência ou fonte</label>
                  <input
                    id={`comp-agencia-${i}`}
                    placeholder="CNPq, CAPES, FAPs, internacional…"
                    value={c.agencia ?? ""}
                    onChange={(e) => mudarComplementar(i, { agencia: e.target.value || undefined })}
                  />
                </div>
                <CampoValorBrl
                  id={`comp-valor-${i}`}
                  valor={c.valor_brl}
                  onSalvar={(n) => mudarComplementar(i, { valor_brl: n ?? undefined })}
                />
                <button className="plat-linkbtn" onClick={() => removerComplementar(i)}>
                  <Trash2 size={14} aria-hidden="true" /> Remover
                </button>
              </div>
            ))}
            <button className="plat-linkbtn" onClick={adicionarComplementar}>
              <Plus size={14} aria-hidden="true" /> Adicionar outra fonte
            </button>
          </>
        ) : null}
      </fieldset>

      {/* --------------------------------------- Q28..Q30 — projeto de extensão */}
      <fieldset className="plat-fields">
        <legend>Participou de projeto de extensão ligado ao INCT?</legend>
        <div className="rel-escolhas">
          <SimNao
            nome="fom-extensao"
            valor={temExtensao}
            onMudar={(sim) => mudarExtensao(sim ? { tem: true } : { tem: false })}
          />
        </div>
        {temExtensao ? (
          <div className="plat-fields">
            <div className="rel-campo">
              <label htmlFor="ext-titulo">Título do projeto</label>
              <input
                id="ext-titulo"
                value={extensao.titulo ?? ""}
                onChange={(e) => mudarExtensao({ titulo: e.target.value || undefined })}
              />
            </div>
            <div className="rel-campo">
              <label htmlFor="ext-instituicao">Instituição</label>
              <input
                id="ext-instituicao"
                value={extensao.instituicao ?? ""}
                onChange={(e) => mudarExtensao({ instituicao: e.target.value || undefined })}
              />
            </div>
            <div className="rel-campo">
              <label htmlFor="ext-responsavel">Responsável</label>
              <input
                id="ext-responsavel"
                value={extensao.responsavel ?? ""}
                onChange={(e) => mudarExtensao({ responsavel: e.target.value || undefined })}
              />
            </div>
            <div className="rel-campo">
              <label htmlFor="ext-coordenador">Quem coordena</label>
              <input
                id="ext-coordenador"
                value={extensao.coordenador ?? ""}
                onChange={(e) => mudarExtensao({ coordenador: e.target.value || undefined })}
              />
            </div>
            <div className="rel-campo">
              <label htmlFor="ext-inicio">Começou em</label>
              <input
                id="ext-inicio"
                type="date"
                value={extensao.periodo_inicio ?? ""}
                onChange={(e) => mudarExtensao({ periodo_inicio: e.target.value || undefined })}
              />
            </div>
            <div className="rel-campo">
              <label htmlFor="ext-fim">
                Termina em <span className="rel-opcional">(deixe vazio se estiver em andamento)</span>
              </label>
              <input
                id="ext-fim"
                type="date"
                value={extensao.periodo_fim ?? ""}
                onChange={(e) => mudarExtensao({ periodo_fim: e.target.value || undefined })}
              />
            </div>
            <fieldset className="rel-escolhas">
              <legend>
                O que o projeto produziu? <span className="rel-opcional">(marque o que houver)</span>
              </legend>
              {TIPOS_PRODUCAO_LISTA_CURTA.map((t) => (
                <ProdutoExtensao key={t} tipo={t} extensao={extensao} onMudar={mudarExtensao} />
              ))}
              <details className="rel-dica">
                <summary>Mais tipos</summary>
                {TIPOS_PRODUCAO.filter((t) => !TIPOS_PRODUCAO_LISTA_CURTA.includes(t)).map((t) => (
                  <ProdutoExtensao key={t} tipo={t} extensao={extensao} onMudar={mudarExtensao} />
                ))}
              </details>
            </fieldset>
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}

/** Par Sim/Não com o Não como default — é ele que faz a tela custar segundos. */
function SimNao({
  nome,
  valor,
  onMudar,
}: {
  nome: string;
  valor: boolean;
  onMudar: (sim: boolean) => void;
}) {
  return (
    <>
      <label className="rel-escolha">
        <input type="radio" name={nome} checked={!valor} onChange={() => onMudar(false)} /> Não
      </label>
      <label className="rel-escolha">
        <input type="radio" name={nome} checked={valor} onChange={() => onMudar(true)} /> Sim
      </label>
    </>
  );
}

/** Q30 — um produto da taxonomia da 005 como checkbox (reuso, não lista nova). */
function ProdutoExtensao({
  tipo,
  extensao,
  onMudar,
}: {
  tipo: TipoProducao;
  extensao: ExtensaoResposta;
  onMudar: (patch: Partial<ExtensaoResposta>) => void;
}) {
  const produtos = extensao.produtos ?? [];
  const marcado = produtos.includes(tipo);
  return (
    <label className="rel-escolha">
      <input
        type="checkbox"
        checked={marcado}
        onChange={() =>
          onMudar({ produtos: marcado ? produtos.filter((p) => p !== tipo) : [...produtos, tipo] })
        }
      />
      {ROTULO_TIPO_PRODUCAO[tipo]}
    </label>
  );
}

/** Valor em reais com validação no blur (aceita "R$ 1.500" e "1.234,56"). */
function CampoValorBrl({
  id,
  valor,
  onSalvar,
}: {
  id: string;
  valor: number | undefined;
  onSalvar: (n: number | null) => void;
}) {
  const [texto, setTexto] = useState(valor != null ? String(valor) : "");
  /* Ressincroniza quando a PROP muda por fora (item removido, restaurado ou
     gravado em outro caminho): sem isto, um componente reaproveitado pelo
     React exibia — e no blur gravava — o texto de OUTRO item. */
  const ultimoValor = useRef(valor);
  useEffect(() => {
    if (valor !== ultimoValor.current) {
      ultimoValor.current = valor;
      setTexto(valor != null ? String(valor) : "");
    }
  }, [valor]);
  const validacao = texto.trim() ? validarValorBrl(texto) : null;
  return (
    <div className="rel-campo">
      <label htmlFor={id}>
        Valor aproximado (R$) <span className="rel-opcional">(opcional)</span>
      </label>
      <input
        id={id}
        inputMode="numeric"
        placeholder="150000"
        value={texto}
        aria-invalid={validacao ? !validacao.ok : undefined}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          const v = validarValorBrl(texto);
          if (v.ok) onSalvar(v.valor ? Number(v.valor) : null);
        }}
      />
      {validacao && !validacao.ok ? <p className="plat-error rel-erro">{validacao.mensagem}</p> : null}
      <small className="rel-dica">É estimativa. Sai do relatório rotulada como estimativa.</small>
    </div>
  );
}

// ============================================== 12. TELA 5 — EM SUAS PALAVRAS =
/*
 * REDUZIDA (pedido do dono, 2026-08): eram QUATRO caixas de texto livre — e era
 * aqui que moravam 2min30 dos ~8min do formulário. A regra da redução: tirar
 * DIGITAÇÃO, nunca tirar informação.
 *
 *  • O resultado principal continua sendo a única digitação obrigatória (é a
 *    matéria-prima do Indicador nº 2; ninguém pode escrevê-lo pela pessoa),
 *    mas ganha SUGESTÃO PRONTA montada do que ela declarou nas telas 2 e 3 —
 *    um toque aceita, editar é opcional.
 *  • Dificuldades e oportunidades viraram OPÇÕES DE MARCAR (narrativa.ts), com
 *    o texto livre recolhido atrás de "quer detalhar?". Marcado é agregável:
 *    "atraso de recursos em N dos 209 relatos" é número, prosa não é.
 *  • O texto público continua nascendo espelhado do resultado; a caixa de
 *    ajuste fica recolhida — ajustar é exceção, não etapa.
 */

function TelaPalavras({
  narrativas,
  sugestao,
  onAplicar,
}: {
  narrativas: Narrativas;
  /** Frase factual montada do que a pessoa declarou; null = sem matéria-prima. */
  sugestao: string | null;
  onAplicar: (patch: Partial<Narrativas>) => void;
}) {
  const resultado = narrativas.resultado_principal ?? "";
  const publico = narrativas.texto_nao_especialistas ?? "";
  const catDificuldades = narrativas.dificuldades_categorias ?? [];
  const catOportunidades = narrativas.oportunidades_categorias ?? [];

  const vResultado = resultado.trim() ? validarResultadoPrincipal(resultado) : null;
  const vDificuldades = validarTextoOpcional(narrativas.dificuldades ?? "", LIMITES.narrativaMax);
  const vPublico = validarTextoOpcional(publico, LIMITES.naoEspecialistasMax);

  /* O texto público nasce espelhado do resultado enquanto a pessoa não tocar
     nele (semear uma vez, na primeira letra, entregaria a caixa com "A"). */
  const editouPublico = useRef(publico.trim().length > 0 && publico !== resultado);

  const mudarResultado = (valor: string) => {
    if (editouPublico.current) {
      onAplicar({ resultado_principal: valor });
      return;
    }
    onAplicar({
      resultado_principal: valor,
      texto_nao_especialistas: valor.slice(0, LIMITES.naoEspecialistasMax),
    });
  };

  return (
    <div className="plat-fields">
      <div className="rel-campo">
        <label htmlFor="n-resultado">Em uma frase, qual foi seu resultado mais importante neste ciclo?</label>

        {/* A sugestão só aparece enquanto a caixa está vazia: depois que a
            pessoa escreveu, empurrar frase pronta por cima seria retrabalho. */}
        {sugestao && !resultado.trim() ? (
          <div className="plat-notice rel-dica" role="group" aria-label="Sugestão de resposta">
            <Sparkles size={16} aria-hidden="true" />{" "}
            <span>
              Sugestão pronta, feita <strong>só do que você declarou</strong>: “{sugestao}”
            </span>{" "}
            <button type="button" className="plat-linkbtn" onClick={() => mudarResultado(sugestao)}>
              Usar esta frase
            </button>
          </div>
        ) : null}

        <textarea
          id="n-resultado"
          rows={4}
          maxLength={LIMITES.narrativaMax}
          value={resultado}
          aria-describedby="n-resultado-dica"
          aria-invalid={vResultado ? !vResultado.ok : undefined}
          onChange={(e) => mudarResultado(e.target.value)}
        />
        {vResultado && !vResultado.ok ? <p className="plat-error rel-erro">{vResultado.mensagem}</p> : null}
        <small id="n-resultado-dica" className="rel-dica">
          {contarCaracteres(resultado)}/{LIMITES.narrativaMax} caracteres. Esta frase pode ir para o relatório público
          e para o site.
        </small>
      </div>

      <fieldset className="rel-escolhas">
        <legend>
          O que atrapalhou neste ciclo? <span className="rel-opcional">(marque o que houver)</span>
          {catDificuldades.length > 0 ? (
            <span className="rel-escolhas-placar" aria-live="polite">
              {catDificuldades.length} marcada{catDificuldades.length === 1 ? "" : "s"}
            </span>
          ) : null}
          <span className="rel-dica" style={{ display: "block", fontWeight: 400 }}>
            <ShieldCheck size={14} aria-hidden="true" />{" "}
            <strong>
              Vai direto ao Comitê Gestor: não passa pelo(a) líder do seu laboratório e não será publicado.
            </strong>{" "}
            Dificuldade relatada agora vira argumento na renovação.
          </span>
        </legend>
        {DIFICULDADES_OPCOES.map((op) => (
          <label key={op.id} className="rel-escolha">
            <input
              type="checkbox"
              checked={catDificuldades.includes(op.id)}
              onChange={() => onAplicar(alternarCategoria(narrativas, "dificuldades_categorias", op.id))}
            />
            {op.rotulo}
          </label>
        ))}
        <details className="rel-dica">
          <summary>Quer detalhar? (opcional)</summary>
          <textarea
            aria-label="Detalhe das dificuldades"
            rows={3}
            maxLength={LIMITES.narrativaMax}
            value={narrativas.dificuldades ?? ""}
            onChange={(e) => onAplicar({ dificuldades: e.target.value })}
          />
          {!vDificuldades.ok ? <p className="plat-error rel-erro">{vDificuldades.mensagem}</p> : null}
        </details>
      </fieldset>

      <fieldset className="rel-escolhas">
        <legend>
          Que oportunidade nova apareceu? <span className="rel-opcional">(marque o que houver)</span>
          {catOportunidades.length > 0 ? (
            <span className="rel-escolhas-placar" aria-live="polite">
              {catOportunidades.length} marcada{catOportunidades.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </legend>
        {OPORTUNIDADES_OPCOES.map((op) => (
          <label key={op.id} className="rel-escolha">
            <input
              type="checkbox"
              checked={catOportunidades.includes(op.id)}
              onChange={() => onAplicar(alternarCategoria(narrativas, "oportunidades_categorias", op.id))}
            />
            {op.rotulo}
          </label>
        ))}
        <details className="rel-dica">
          <summary>Quer detalhar? (opcional)</summary>
          <textarea
            aria-label="Detalhe das oportunidades"
            rows={3}
            maxLength={LIMITES.narrativaMax}
            value={narrativas.oportunidades ?? ""}
            onChange={(e) => onAplicar({ oportunidades: e.target.value })}
          />
        </details>
      </fieldset>

      {/* O texto público já está pronto (espelha o resultado). Ajustar é
          exceção; por isso vive recolhido, mostrando antes o que será usado. */}
      {resultado.trim() ? (
        <div className="rel-campo">
          <p className="rel-dica">
            <strong>O que vai para o relatório público:</strong> “{publico || resultado}”
          </p>
          <details className="rel-dica">
            <summary>Ajustar o texto público (opcional)</summary>
            <textarea
              aria-label="Texto para não especialistas"
              rows={3}
              maxLength={LIMITES.naoEspecialistasMax}
              value={publico}
              aria-describedby="n-publico-dica"
              onChange={(e) => {
                editouPublico.current = true;
                onAplicar({ texto_nao_especialistas: e.target.value });
              }}
            />
            {!vPublico.ok ? <p className="plat-error rel-erro">{vPublico.mensagem}</p> : null}
            <small id="n-publico-dica" className="rel-dica">
              {contarCaracteres(publico)}/{LIMITES.naoEspecialistasMax} caracteres. Este texto <strong>é público</strong>:
              compõe o relatório para gestores e para a sociedade (o Indicador nº 2).
            </small>
          </details>
        </div>
      ) : null}
    </div>
  );
}

// ============================================ 13. TELA 6 — REVISE E ENVIE ====

function TelaRevisao({
  ciclo,
  membro,
  relato,
  narrativas,
  respostas,
  producoes,
  adesoes,
  propostas,
  fatos,
  arquivos,
  userId,
  nadaADeclarar,
  temImagemPublicavel,
  enviando,
  aviso,
  onIr,
  onMudar,
  onCadastro,
  onArquivos,
  onDesfazerSaida,
  onEnviar,
}: {
  ciclo: RelatorioCiclo;
  membro: CicloMembro | null;
  relato: Relato | null;
  narrativas: Narrativas;
  respostas: RespostasRelato;
  producoes: ProducaoDoRelato[];
  adesoes: FatoParticipante[];
  propostas: Fato[];
  fatos: Fato[];
  arquivos: RelatoArquivo[];
  userId: string;
  nadaADeclarar: boolean;
  temImagemPublicavel: boolean;
  enviando: boolean;
  aviso: string;
  onIr: (p: Passo) => void;
  onMudar: (campo: keyof Narrativas, valor: string) => void;
  onCadastro: (patch: PatchMembroGforms) => void;
  onArquivos: (arquivos: RelatoArquivo[]) => void;
  onDesfazerSaida: () => void;
  onEnviar: (cessao: boolean) => Promise<void>;
}) {
  const [veracidade, setVeracidade] = useState(relato?.declaracao_veracidade ?? false);
  const [cessao, setCessao] = useState(relato?.cessao_imagem ?? false);
  const [erro, setErro] = useState("");

  const semAncoraResolvida = producoes.filter((p) => !p.producao.ancora_resolvida).length;
  const foraDoPeriodo = producoes.filter((p) => p.producao.periodo_situacao !== "no_periodo").length;
  const resultado = narrativas.resultado_principal ?? "";
  const faltaResultado = !nadaADeclarar && !validarResultadoPrincipal(resultado).ok;

  const enviar = async () => {
    setErro("");
    // O documento da pesquisa é OBRIGATÓRIO (decisão do dono, 13/08). O portão
    // vale para os DOIS ramos de envio — a revisão completa e o
    // nada_a_declarar usam esta mesma função.
    if (!arquivos.some((a) => a.uso === "comprovante")) {
      setErro("Falta anexar o documento com dados da sua pesquisa — ele é obrigatório. Anexe na tela 2.");
      return;
    }
    if (!veracidade) {
      setErro(MENSAGENS.veracidade);
      document.getElementById("rev-veracidade")?.focus();
      return;
    }
    if (temImagemPublicavel && !cessao) {
      setErro(MENSAGENS.cessaoImagem);
      document.getElementById("rev-cessao")?.focus();
      return;
    }
    if (faltaResultado) {
      // Sem navegar: o painel de pendências no topo já tem o link que leva à
      // tela 5 e move o foco. Trocar de tela aqui apagaria esta mensagem.
      setErro("Falta a frase do seu resultado principal (pelo menos 20 caracteres). Ela está na tela 5.");
      return;
    }
    await onEnviar(cessao);
  };

  // ------------------------------------------------- a saída de dignidade ---
  if (nadaADeclarar) {
    return (
      <div className="plat-fields rel-revisao">
        <p className="plat-notice">
          <Info size={16} aria-hidden="true" /> Você declarou que neste ciclo não teve produção nem atividade para
          relatar. É uma resposta legítima e é registrada como tal: nenhuma pergunta obrigatória vem depois desta
          tela.
        </p>

        <div className="rel-campo">
          <label htmlFor="n-faltou">
            Quer contar o que faltou para começar? <span className="rel-opcional">(opcional)</span>
          </label>
          <textarea
            id="n-faltou"
            rows={4}
            maxLength={LIMITES.narrativaMax}
            value={narrativas.o_que_faltou ?? ""}
            onChange={(e) => onMudar("o_que_faltou", e.target.value)}
            aria-describedby="n-faltou-dica"
          />
          <small id="n-faltou-dica" className="rel-dica">
            Vai direto ao Comitê Gestor, não é publicado, e é o tipo de informação que muda decisão de gestão.
          </small>
        </div>

        <SatisfacaoCampo membro={membro} onCadastro={onCadastro} />

        <label className="plat-consent" htmlFor="rev-veracidade">
          <input
            id="rev-veracidade"
            type="checkbox"
            checked={veracidade}
            onChange={(e) => setVeracidade(e.target.checked)}
          />
          <span>Declaro que as informações acima são verdadeiras.</span>
        </label>

        {erro ? <p className="plat-error rel-erro">{erro}</p> : null}
        {aviso ? <p className="plat-error rel-erro">{aviso}</p> : null}

        <div className="plat-nav rel-nav">
          <button className="plat-linkbtn" onClick={onDesfazerSaida}>
            Na verdade, tenho algo a declarar
          </button>
          <button className="button primary" onClick={() => void enviar()} disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar meu relato"} <Send size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------- a revisão completa ---
  const fatosAderidos = fatos.filter((f) => adesoes.some((a) => a.fato_id === f.id));

  return (
    <div className="plat-fields rel-revisao">
      {(semAncoraResolvida || foraDoPeriodo || faltaResultado) ? (
        <div className="plat-card plat-notice rel-pendencias">
          <TriangleAlert size={20} aria-hidden="true" />
          <div>
            <strong>Antes de enviar, veja:</strong>
            <ul>
              {faltaResultado ? (
                <li>
                  Falta a frase do seu resultado principal.{" "}
                  <button className="plat-linkbtn" onClick={() => onIr(5)}>
                    ir para a tela 5
                  </button>
                </li>
              ) : null}
              {semAncoraResolvida ? (
                <li>
                  {semAncoraResolvida} {semAncoraResolvida === 1 ? "item está" : "itens estão"} sem âncora resolvida e
                  não {semAncoraResolvida === 1 ? "entra" : "entram"} na contagem. Você pode enviar assim mesmo.{" "}
                  <button className="plat-linkbtn" onClick={() => onIr(2)}>
                    ir para a tela 2
                  </button>
                </li>
              ) : null}
              {foraDoPeriodo ? (
                <li>
                  {foraDoPeriodo} {foraDoPeriodo === 1 ? "item está" : "itens estão"} fora do período do Ciclo 1:
                  {" "}guardamos com a data verdadeira, para o próximo relatório.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      <h3>Quem é você</h3>
      <dl className="plat-review">
        <div>
          <dt>Nome</dt>
          <dd>{membro?.nome ?? "não informado"}</dd>
        </div>
        <div>
          <dt>Papel neste ciclo</dt>
          <dd>{membro ? ROTULO_PAPEL[membro.papel] : "não informado"}</dd>
        </div>
        <div>
          <dt>ORCID</dt>
          <dd>{membro?.orcid ?? "não informado"}</dd>
        </div>
      </dl>
      <button className="plat-linkbtn" onClick={() => onIr(1)}>
        <ArrowLeft size={14} aria-hidden="true" /> corrigir na tela 1
      </button>

      <h3>Produção declarada ({producoes.length})</h3>
      {producoes.length ? (
        <ul className="plat-list">
          {producoes.map(({ producao, vinculo }) => (
            <li key={vinculo.id} className="rel-item">
              <span className="rel-item-titulo">{tituloDaProducao(producao)}</span>
              <span className="rel-item-meta">
                {ROTULO_TIPO_PRODUCAO[producao.tipo]}
                {producao.ano ? ` · ${producao.ano}` : ""}
              </span>
              <ChipPeriodo situacao={producao.periodo_situacao} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="plat-empty">Nenhuma produção declarada.</p>
      )}
      <button className="plat-linkbtn" onClick={() => onIr(2)}>
        <ArrowLeft size={14} aria-hidden="true" /> corrigir na tela 2
      </button>

      <h3>Participação em atividades do laboratório ({fatosAderidos.length})</h3>
      {fatosAderidos.length ? (
        <ul className="plat-list">
          {fatosAderidos.map((f) => (
            <li key={f.id} className="rel-item">
              <span className="rel-item-titulo">{f.titulo}</span>
              <span className="rel-item-meta">
                {ROTULO_TIPO_FATO[f.tipo]} · {dataBr(f.ocorrido_em)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="plat-empty">Nenhuma participação marcada.</p>
      )}
      {propostas.length ? (
        <p className="plat-hint">
          {propostas.length} {propostas.length === 1 ? "atividade contada" : "atividades contadas"} aguardando a
          conferência do(a) líder do laboratório.
        </p>
      ) : null}
      <button className="plat-linkbtn" onClick={() => onIr(3)}>
        <ArrowLeft size={14} aria-hidden="true" /> corrigir na tela 3
      </button>

      {/* Fomento/extensão/objetivos (009): contagens, não prosa — a revisão
          confere que o dado está lá, sem alongar a tela. */}
      <h3>Fomento, extensão e objetivos</h3>
      <dl className="plat-review">
        <div>
          <dt>Objetivos confirmados (tela 3)</dt>
          <dd>
            {respostas.objetivos_confirmados?.length
              ? respostas.objetivos_confirmados.join(", ")
              : "nenhum confirmado ainda"}
          </dd>
        </div>
        <div>
          <dt>Projetos e financiamento</dt>
          <dd>
            {respostas.fomento?.length
              ? `${respostas.fomento.length} ${respostas.fomento.length === 1 ? "item" : "itens"}`
              : "nenhum"}
          </dd>
        </div>
        <div>
          <dt>Projeto de extensão</dt>
          <dd>{respostas.extensao?.tem ? respostas.extensao.titulo || "sim" : "nenhum"}</dd>
        </div>
      </dl>
      <button className="plat-linkbtn" onClick={() => onIr(4)}>
        <ArrowLeft size={14} aria-hidden="true" /> corrigir na tela 4
      </button>

      <h3>Em suas palavras</h3>
      <dl className="plat-review">
        <div>
          <dt>Resultado mais importante</dt>
          <dd>{resultado || "não informado"}</dd>
        </div>
        <div>
          <dt>Texto para não especialistas (pode ser publicado)</dt>
          <dd>{narrativas.texto_nao_especialistas || "não informado"}</dd>
        </div>
        <div>
          <dt>Dificuldades (vai só ao Comitê Gestor)</dt>
          {/* As categorias marcadas aparecem por extenso — a pessoa confere o
              que assinou. O detalhe em texto livre continua resumido a
              "preenchido": é confidencial até na revisão dela própria? Não —
              é dela; mas repetir prosa longa aqui só alonga a revisão. */}
          <dd>
            {rotulosDe(narrativas.dificuldades_categorias, DIFICULDADES_OPCOES).join("; ") ||
              (narrativas.dificuldades ? "preenchido" : "nenhuma")}
            {narrativas.dificuldades_categorias?.length && narrativas.dificuldades ? " (+ detalhe)" : ""}
          </dd>
        </div>
        <div>
          <dt>Oportunidades</dt>
          <dd>
            {rotulosDe(narrativas.oportunidades_categorias, OPORTUNIDADES_OPCOES).join("; ") ||
              narrativas.oportunidades ||
              "nenhuma"}
          </dd>
        </div>
      </dl>
      <button className="plat-linkbtn" onClick={() => onIr(5)}>
        <ArrowLeft size={14} aria-hidden="true" /> corrigir na tela 5
      </button>

      <SatisfacaoCampo membro={membro} onCadastro={onCadastro} />

      {/* O upload mora na Tela 2 (depois dos artigos, decisão do dono 13/08);
          aqui fica só o STATUS — anexado ✓ ou faltando, com o caminho. */}
      <StatusDocumento arquivos={arquivos} onIr={onIr} />

      <label className="plat-consent" htmlFor="rev-veracidade">
        <input
          id="rev-veracidade"
          type="checkbox"
          checked={veracidade}
          onChange={(e) => setVeracidade(e.target.checked)}
        />
        <span>
          Declaro que as informações acima são verdadeiras. Esta declaração tem consequência administrativa, civil e
          penal para quem a assina.
        </span>
      </label>

      {temImagemPublicavel ? (
        <label className="plat-consent" htmlFor="rev-cessao">
          <input id="rev-cessao" type="checkbox" checked={cessao} onChange={(e) => setCessao(e.target.checked)} />
          <span>
            Autorizo o uso destas imagens pelo INCT-CONEXAO e pelo CNPq em comunicação institucional.
          </span>
        </label>
      ) : null}

      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}
      {aviso ? <p className="plat-error rel-erro">{aviso}</p> : null}

      {/* A mesma regra da abertura, repetida no ponto de decisão — aqui ela não
          convence a começar, e sim a NÃO enviar pela metade. */}
      <p className="plat-notice">
        <TriangleAlert size={16} aria-hidden="true" />{" "}
        <span>
          É a partir daqui que a coordenação defende os pedidos de recurso do seu laboratório: diárias, passagens,
          insumos e bolsas. <strong>O que não estiver neste relato não existe na hora do rateio.</strong> Ainda dá
          para voltar e acrescentar.
        </span>
      </p>

      <div className="plat-nav rel-nav">
        <button className="plat-linkbtn" onClick={() => onIr(1)}>
          Voltar ao começo
        </button>
        <button className="button primary" onClick={() => void enviar()} disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar meu relato"} <Send size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="plat-hint">
        Ciclo: {ciclo.titulo} · período de {dataBr(ciclo.periodo_inicio)} a {dataBr(ciclo.periodo_fim)}.
      </p>
    </div>
  );
}

/**
 * Q31 (009) — satisfação 1..5, micro-campo da revisão. Mora em `ciclo_membros`
 * (é resposta do CICLO: a mesma pessoa pode responder outra coisa no Ciclo 2)
 * e grava pelo mesmo autosave da Tela 1. Tocar de novo na nota desfaz — é
 * opcional de verdade, com caminho de volta.
 */
function SatisfacaoCampo({
  membro,
  onCadastro,
}: {
  membro: CicloMembro | null;
  onCadastro: (patch: PatchMembroGforms) => void;
}) {
  const nota = membro?.satisfacao ?? null;
  /* Redesign de 10/08 (pedido do dono): a versão anterior emprestava
     .rel-ficha (o CARTÃO do seletor de fatos do LLA) + .rel-escolha, com uma
     classe ativa que nem existia no CSS — as notas viravam números soltos num
     grid quebrado. Agora a escala é um controle próprio: 5 quadrados
     .rel-nota com os extremos escritos nas pontas, ativo preenchido. */
  return (
    <fieldset className="rel-escolhas">
      <legend>
        De 1 a 5, qual sua satisfação em participar do INCT neste ciclo?{" "}
        <span className="rel-opcional">(opcional)</span>
      </legend>
      <div className="rel-notas" role="group" aria-label="Nota de 1 (insatisfeito) a 5 (muito satisfeito)">
        <span className="rel-notas-extremo">insatisfeito(a)</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="rel-nota"
            aria-pressed={nota === n}
            onClick={() => onCadastro({ satisfacao: nota === n ? null : n })}
          >
            {n}
          </button>
        ))}
        <span className="rel-notas-extremo">muito satisfeito(a)</span>
      </div>
      <small className="rel-dica">Tocar de novo na nota desfaz. Vai só à coordenação.</small>
    </fieldset>
  );
}

/**
 * Q32 (009, ampliada na 011) — o anexo do relatório, OPCIONAL por decisão 4 do
 * relato-gforms: o sistema É o relatório; o anexo existe para o "documento com
 * dados da pesquisa" que a coordenação usa no relatório anual do INCT. Aceita
 * PDF (1 MB) e Word .docx (10 MB) com uso 'comprovante'; toda a validação de
 * formato/teto acontece em `enviarArquivo` ANTES do upload — aqui é só
 * transporte, nenhum parser de docx no cliente.
 */
function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * O DOCUMENTO DA PESQUISA — OBRIGATÓRIO desde 13/08 (decisão do dono; revoga a
 * decisão 4 do relato-gforms, que o tinha como opcional) e morando no FIM DA
 * TELA 2, logo depois dos artigos — é ali que a pessoa está pensando na própria
 * produção. A revisão só mostra o STATUS (anexado ✓ / faltando, com o caminho
 * de volta), e `enviar()` barra o envio sem ele.
 *
 * O desenho é uma DROPZONE: arrastar-e-soltar com estado visual de arrasto,
 * clique/Enter/Espaço abrindo o seletor (o input nativo fica recortado da
 * tela — o "Choose File" vem no idioma do navegador, não do site), cartão de
 * arquivo com nome/tamanho/remoção, e os limites ditos antes do erro.
 */
function AnexoDocumento({
  userId,
  ciclo,
  relatoId,
  arquivos,
  onMudou,
}: {
  userId: string;
  ciclo: RelatorioCiclo;
  relatoId: string;
  arquivos: RelatoArquivo[];
  onMudou: (arquivos: RelatoArquivo[]) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const comprovantes = arquivos.filter((a) => a.uso === "comprovante");

  const enviar = async (f: File) => {
    setErro("");
    setOcupado(true);
    try {
      const novo = await enviarArquivo({
        userId,
        cicloSlug: ciclo.slug,
        alvo: { relatoId },
        arquivo: f,
        uso: "comprovante",
        config: ciclo.config,
      });
      onMudou([...arquivos, novo]);
    } catch (e) {
      setErro(erroDeRelato(e));
    } finally {
      setOcupado(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remover = async (a: RelatoArquivo) => {
    setErro("");
    try {
      await removerArquivo({ id: a.id, storage_path: a.storage_path });
      onMudou(arquivos.filter((x) => x.id !== a.id));
    } catch (e) {
      setErro(erroDeRelato(e));
    }
  };

  const abrirSeletor = () => {
    if (!ocupado) inputRef.current?.click();
  };

  return (
    <fieldset className="plat-fields rel-doc" id="doc-pesquisa">
      <legend>
        Documento com dados da sua pesquisa <span className="rel-obrigatorio">obrigatório</span>
      </legend>
      <p className="rel-dica">
        É ele que a coordenação usa na montagem do relatório anual do INCT. Word (.docx) até 10 MB ou PDF até
        1 MB. Arquivo .doc antigo (Word 2003)? Abra no Word e salve como .docx.
      </p>

      <input
        className="rel-anexo-input"
        id="doc-anexo"
        ref={inputRef}
        type="file"
        accept={`.pdf,.docx,application/pdf,${MIME_DOCX}`}
        disabled={ocupado}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviar(f);
        }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {comprovantes.length ? (
        <ul className="rel-doc-lista">
          {comprovantes.map((a) => (
            <li key={a.id} className="rel-doc-arquivo">
              <Paperclip size={18} aria-hidden="true" className="rel-doc-icone" />
              <span className="rel-doc-nome">
                {a.file_name} <small>({tamanhoLegivel(a.bytes)})</small>
              </span>
              <span className="rel-doc-ok">
                <CheckCircle2 size={16} aria-hidden="true" /> anexado
              </span>
              <button className="plat-linkbtn" onClick={() => void remover(a)}>
                <Trash2 size={13} aria-hidden="true" /> Remover
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        aria-label="Anexar documento: arraste o arquivo até aqui ou toque para escolher"
        aria-disabled={ocupado || undefined}
        className={`rel-drop${arrastando ? " rel-drop--ativo" : ""}${comprovantes.length ? " rel-drop--compacto" : ""}`}
        onClick={abrirSeletor}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abrirSeletor();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!ocupado) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !ocupado) void enviar(f);
        }}
      >
        {ocupado ? (
          <>
            <Loader2 size={26} aria-hidden="true" className="rel-drop-girando" />
            <strong>Enviando…</strong>
          </>
        ) : (
          <>
            <Paperclip size={26} aria-hidden="true" />
            <strong>{comprovantes.length ? "Anexar outro documento" : "Arraste o documento até aqui"}</strong>
            <span>ou toque para escolher (.docx ou PDF)</span>
          </>
        )}
      </div>

      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}
    </fieldset>
  );
}

/**
 * O status do documento na REVISÃO: anexado ✓ (nomes) ou faltando, com o
 * caminho de volta. O upload em si mora na Tela 2, depois dos artigos.
 */
function StatusDocumento({
  arquivos,
  onIr,
}: {
  arquivos: RelatoArquivo[];
  onIr: (passo: Passo) => void;
}) {
  const comprovantes = arquivos.filter((a) => a.uso === "comprovante");
  if (comprovantes.length) {
    return (
      <p className="plat-ok rel-doc-status">
        <CheckCircle2 size={16} aria-hidden="true" /> Documento da pesquisa anexado:{" "}
        {comprovantes.map((a) => a.file_name).join(", ")}.
      </p>
    );
  }
  return (
    <p className="plat-notice rel-doc-status">
      <TriangleAlert size={16} aria-hidden="true" />{" "}
      <span>
        <strong>Falta o documento com dados da sua pesquisa</strong> — ele é obrigatório para enviar.{" "}
        <button className="plat-linkbtn" onClick={() => onIr(2)}>
          Anexar na tela 2
        </button>
      </span>
    </p>
  );
}

// ================================================ 14. O RECIBO DE PROTOCOLO ==

function Recibo({
  relato,
  ciclo,
  onComplementar,
}: {
  relato: Relato;
  ciclo: RelatorioCiclo;
  onComplementar: () => void;
}) {
  /* Mensagem, não boolean: a falha da área de transferência (permissão
     negada, contexto sem clipboard) precisa DIZER o caminho manual — a frase
     leva o número do processo, o único dado deste sistema que sai de casa.
     Mesmo padrão de copiarLista/copiarTudo em MeuLaboratorio.tsx. */
  const [copiaMensagem, setCopiaMensagem] = useState<{ texto: string; falhou: boolean } | null>(null);
  const processo = processoDoCiclo(ciclo);

  return (
    <div className="plat-card rel-recibo">
      <CheckCircle2 size={30} aria-hidden="true" />
      <h2>Recebido</h2>
      <p>
        Protocolo <strong className="plat-protocolo">{relato.protocolo ?? "não informado"}</strong>
      </p>
      <p>A coleta segue aberta. Você pode voltar e complementar quando quiser.</p>

      {podeCopiarAgradecimento(ciclo) ? (
        <div className="rel-campo">
          <p className="rel-dica">
            <strong>Para os seus próximos artigos:</strong> é o número do processo que o CNPq indexa. Copie e cole na
            seção de agradecimentos.
          </p>
          <blockquote className="rel-item-meta">{fraseDeAgradecimento("pt")}</blockquote>
          <button
            className="button plat-ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fraseDeAgradecimento("pt"));
                setCopiaMensagem({ texto: `Copiado. Processo ${processo}.`, falhou: false });
              } catch {
                setCopiaMensagem({
                  texto: "Não foi possível copiar automaticamente. Selecione a frase acima e copie à mão.",
                  falhou: true,
                });
              }
            }}
          >
            <ClipboardCopy size={15} aria-hidden="true" /> Copiar agradecimento
          </button>
          <p aria-live="polite" className={copiaMensagem?.falhou ? "plat-error rel-erro" : "plat-ok"}>
            {copiaMensagem?.texto ?? ""}
          </p>
        </div>
      ) : null}

      <div className="plat-nav rel-nav">
        <button className="button plat-ghost" onClick={onComplementar}>
          <ArrowLeft size={15} aria-hidden="true" /> Voltar e complementar
        </button>
        <a className="button primary" href="#/">
          Ir para o site <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
