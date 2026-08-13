/**
 * ============================================================================
 *  #/relatorio-laboratorio — RELATÓRIO ANUAL DO LABORATÓRIO, o formulário do
 *  Líder de Laboratório Associado (LLA)
 * ============================================================================
 *  NOME DO ARQUIVO: `MeuLaboratorio.tsx` é legado do nome antigo do formulário.
 *  O título em tela virou "Relatório Anual do Laboratório" (renomeação de
 *  2026-08) e a rota canônica é `#/relatorio-laboratorio`; `#/meu-laboratorio`
 *  segue como alias permanente no roteador. O arquivo não foi renomeado porque
 *  isso tocaria todos os imports de uma vez — estabilidade primeiro.
 * ----------------------------------------------------------------------------
 *  POR QUE ESTA TELA EXISTE (e por que são duas telas, não uma)
 *  ------------------------------------------------------------------------
 *  Expedição, ação de divulgação, parceria, formação, bolsista, acervo, dado,
 *  infraestrutura e política pública são COLETIVOS por natureza. Se cada membro
 *  pudesse criar um registro desses, cinco pessoas na mesma expedição
 *  produziriam cinco expedições — e a Meta 7 pactua "até 50 expedições".
 *  Deduplicação por DOI resolve artigo; não resolve nada disso.
 *
 *  Então: o LABORATÓRIO declara o fato UMA vez, aqui; o membro apenas ADERE em
 *  `#/relatorio-anual`. O que o LLA declarar nesta tela é exatamente a lista que os
 *  membros dele vão ver na Tela 3 deles — e é por isso que o convite do
 *  laboratório sai 15 dias antes do convite geral (§8.10 da especificação).
 *
 *  O QUE ESTA TELA NUNCA FAZ
 *  ------------------------------------------------------------------------
 *   • Não pergunta percentual de meta, nem "você cumpriu?". Nenhuma das 26
 *     metas vence no 1º ano (DECISÃO 4). A tela L4 exibe o que o sistema CONTOU
 *     e uma PROJEÇÃO informativa contra o marco do 2º ano, sempre rotulada.
 *   • Não digita participante: participantes são ESCOLHIDOS da lista de membros
 *     do laboratório. Nome digitado é dupla contagem esperando acontecer.
 *   • Não mostra ao LLA o campo `dificuldades` dos colegas. A Tela 4 do membro
 *     promete "não passa pelo(a) líder do seu laboratório"; a RLS deixa o LLA
 *     ler a linha inteira do relato, então a promessa é responsabilidade DESTA
 *     tela. L4 conta relatos; nunca renderiza narrativa de terceiro.
 *   • Não rejeita item por data fora do período (DECISÃO 3): aceita com a data
 *     verdadeira, marca com `.rel-chip--fora` e diz que fica para o próximo
 *     relatório. Rejeitar criaria incentivo a adulterar a data — que é
 *     exatamente o dado que o CNPq vai auditar.
 *
 *  ONDE O ENVIO ACONTECE, E POR QUE ISSO IMPORTA
 *  ------------------------------------------------------------------------
 *  A migração 005 NÃO criou tabela de relato-de-laboratório: `governanca` e os
 *  quatro campos narrativos do PICC moram em `relatos.narrativas` do próprio
 *  LLA (ver `types.ts`), porque é ele quem assina a declaração de veracidade.
 *  Consequência prática, dita em tela: enviar aqui é o MESMO envio do relato
 *  individual — um documento só, um protocolo só. Por isso toda gravação de
 *  narrativa aqui parte do objeto INTEIRO carregado do banco e sobrescreve
 *  apenas as chaves desta tela: `salvarNarrativas` substitui o jsonb todo, e
 *  perder o `resultado_principal` que a pessoa escreveu em `#/relatorio-anual` seria
 *  destruir o Indicador nº 2 dela.
 *
 *  DUPLICAÇÃO DELIBERADA COM `MeuAno.tsx`
 *  ------------------------------------------------------------------------
 *  Os controles de formulário (`Texto`, `Area`, `Selecao`…), o `Shell`, a barra
 *  de progresso, o indicador de autosave e o campo `resultado_principal` da L6
 *  estão duplicados aqui de propósito: os dois arquivos foram escritos em
 *  paralelo e nenhum pode editar o outro. QUANDO OS DOIS ESTIVEREM DE PÉ, isto
 *  deve ser extraído para `src/relato/campos.tsx` + `src/relato/Shell.tsx`.
 *  Cada bloco duplicado carrega o marcador EXTRAIR-DEPOIS.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Award,
  CalendarX2,
  CheckCircle2,
  Copy,
  Database,
  FileCheck2,
  GitMerge,
  GraduationCap,
  Handshake,
  Inbox,
  Info,
  Landmark,
  Loader2,
  LogOut,
  MapPin,
  Megaphone,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import { platformEnabled } from "../platform/supabaseClient";
import { useAuth } from "../platform/auth";
import { Porta } from "./Porta";
import PasswordCard from "../platform/PasswordCard";
import { RELATORIO_ANUAL_HREF } from "../webinars/router";
import {
  abrirRelato,
  aderirAoFato,
  cicloAberto,
  confirmarFato,
  criarFato,
  desaderirDoFato,
  enviarArquivo,
  enviarRelato,
  erroDeRelato,
  fundirFato,
  lerCobertura,
  lerFatosPorTipo,
  lerProducaoPorTipo,
  listarArquivos,
  listarEquipeDoLaboratorio,
  listarFatosDoLaboratorio,
  listarLaboratorios,
  listarParticipantes,
  listarRelatosDoLaboratorio,
  meuLaboratorioId,
  meuPapel,
  meuRelato,
  meuVinculo,
  rejeitarFato,
  removerArquivo,
  removerFato,
  salvarFato,
  salvarNarrativas,
  // Alias: `salvarRascunho` é também o nome do handler local da TelaFatos.
  salvarRascunho as salvarRascunhoDoRelato,
  urlAssinadaDeArquivo,
  vincularMeuCadastro,
} from "./api";
import { IdentificacaoComSessao } from "./BuscaPesquisador";
import {
  contarEstudantesEFormados,
  limparAjustes,
} from "./narrativa";
import type {
  AjusteDeContador,
  CategoriaFormado,
  ContadoresAjustes,
  ContagemDaEquipe,
  LinhaDeContagem,
  NivelEstudante,
  RespostasComContadores,
} from "./narrativa";
import {
  avisoDoAno1,
  bolsasDoCiclo,
  cicloCongelado,
  carregarProposta,
  comiteDoTipoDeFato,
  eetsDoCiclo,
  janelaDeEnvioAberta,
  MENSAGEM_PERIODO_SITUACAO,
  metaPorNumero,
  pactuadoPorChave,
  ROTULO_PAPEL,
  ROTULO_PERIODO_SITUACAO,
  ROTULO_TIPO_FATO,
  ROTULO_TIPO_PRODUCAO,
  TIPOS_FATO,
  textoDoPactuado,
  todosOsPactuados,
  veiculosDeDivulgacao,
} from "./config";
import { buscarRor } from "./metadados";
import type { CandidatoRor } from "./metadados";
import {
  avaliarData,
  contarCaracteres,
  dataBr,
  dataDoMes,
  LIMITES,
  pendenciasDe,
  validarCessaoImagem,
  validarResultadoPrincipal,
  validarRor,
  validarTextoOpcional,
  validarTitulo,
  validarVeracidade,
} from "./validation";
import type { Validacao } from "./validation";
import { ehFatoDe } from "./types";
import type {
  CicloMembro,
  CoberturaLinha,
  Fato,
  FatoParticipante,
  FatoPayload,
  FatosPorTipoLinha,
  Governanca,
  Laboratorio,
  Narrativas,
  NaturezaParceria,
  NivelFormacao,
  PapelNoCiclo,
  PayloadAcaoSociedade,
  PayloadAcervo,
  PayloadBolsista,
  PayloadDadoSoftware,
  PayloadExpedicao,
  PayloadFormacao,
  PayloadInfraestrutura,
  PayloadParceria,
  PayloadPoliticaPublica,
  ProducaoPorTipoLinha,
  PublicoAlvo,
  Relato,
  RelatorioCiclo,
  RelatoArquivo,
  SituacaoBolsa,
  SituacaoFormacao,
  TipoFato,
} from "./types";

// ============================================================ 1. AS 6 TELAS ==

const TELAS = [
  { titulo: "Equipe", minutos: 3 },
  { titulo: "Fatos do laboratório", minutos: 14 },
  { titulo: "Fila de propostas", minutos: 4 },
  { titulo: "Conferência", minutos: 3 },
  { titulo: "Governança", minutos: 8 },
  { titulo: "Revisão e envio", minutos: 3 },
] as const;

const TOTAL_TELAS = TELAS.length;

/** Minutos que ainda faltam a partir da tela atual (progresso em MINUTOS, §3). */
function minutosRestantes(indice: number): number {
  return TELAS.slice(indice).reduce((soma, t) => soma + t.minutos, 0);
}

// ================================================= 2. TEXTOS QUE SÃO CONTRATO =
/**
 * Frases escritas na especificação (ou decididas com o dono) e revisadas para
 * dizerem à pessoa o que fazer em seguida. Trocá-las por texto genérico é
 * regressão de produto, não refatoração.
 */
const TEXTO = {
  porta:
    "Este é o formulário do laboratório. Ele abre 15 dias antes do convite individual por um motivo prático: " +
    "o que você declarar aqui é exatamente a lista que os membros do seu laboratório vão ver na tela deles, " +
    "para marcar “participei”.",
  porQueColetivo:
    "Expedição, ação de divulgação, parceria, formação, bolsista, acervo, dado, infraestrutura e política pública " +
    "são declarados UMA vez, aqui. Se cada membro pudesse criar, cinco pessoas na mesma expedição virariam cinco " +
    "expedições, e a rede pactuou “até 50 expedições”.",
  semMeta:
    "Nenhuma meta vence no 1º ano. Este formulário não pergunta percentual de meta e não pergunta se você cumpriu: " +
    "ele coleta evidência, e o sistema projeta.",
  privacidadeComunidade:
    "Não escreva aqui nome, foto nem informação de pessoa da comunidade. O que se pede é o NÚMERO do parecer " +
    "(CEP/CONEP, SISBIO, SISGEN, CGEN), nunca o dado da pessoa.",
  imagem:
    "Foto do local, do material ou da atividade. Sem rostos, a menos que você tenha termo de autorização assinado: " +
    "nesse caso, anexe o termo junto.",
  fusao:
    "Fundir marca este item como duplicata de outro. O fato conta UMA vez na rede e continua aparecendo nos dois " +
    "grupos: é o caso de dois laboratórios que fizeram a mesma expedição conjunta.",
  rejeicaoVolta:
    "O comentário volta para quem propôs, na tela dele. Escreva o que faltou: é a única forma de a pessoa corrigir.",
  dificuldadesDosOutros:
    "O campo “o que atrapalhou” que seus colegas preenchem não aparece nesta tela e não passa por você: ele vai " +
    "direto ao Comitê Gestor. Aqui só existe a contagem.",
  envioUnico:
    "Enviar aqui é o mesmo envio do seu relato individual: um documento só, um protocolo só, assinado por você.",
  projecao:
    "Projeção informativa: nenhuma meta vence no 1º ano. Os números pactuados são da REDE inteira (28 laboratórios); " +
    "o que aparece abaixo é a contribuição do seu laboratório.",
} as const;

// ================================================ 3. AS 9 FICHAS (a tela L2) ==

type Ficha = {
  tipo: TipoFato;
  Icone: typeof MapPin;
  oQueEntra: string;
  /** Só aparece se o laboratório for curador de acervo (§4.1). */
  exigeCurador?: boolean;
  /** Só aparece para laboratório de EET-1 / EET-5 (§4.1). */
  exigeEets?: string[];
};

const FICHAS: Ficha[] = [
  {
    tipo: "expedicao",
    Icone: MapPin,
    oQueEntra: "Ida a campo: município, dias, quantas pessoas foram, número da autorização.",
  },
  {
    tipo: "acao_sociedade",
    Icone: Megaphone,
    oQueEntra: "Palestra, oficina, feira, matéria, material para escola ou comunidade.",
  },
  {
    tipo: "parceria",
    Icone: Handshake,
    oQueEntra: "Instituição parceira, com ROR. É daqui que sai a contagem de instituições e países.",
  },
  {
    tipo: "formacao",
    Icone: GraduationCap,
    oQueEntra: "IC, mestrado, doutorado, pós-doc, formação técnica ou comunitária. Quem declara é o orientador.",
  },
  { tipo: "bolsista", Icone: Award, oQueEntra: "Bolsa da quota do INCT: modalidade, situação e orientador." },
  {
    tipo: "acervo",
    Icone: Archive,
    oQueEntra: "O que entrou na coleção: quantos registros, faixa de tombo, SISGEN.",
    exigeCurador: true,
  },
  { tipo: "dado_software", Icone: Database, oQueEntra: "Base de dados, código ou modelo publicado, com DOI ou URL." },
  {
    tipo: "infraestrutura",
    Icone: Wrench,
    oQueEntra: "Equipamento ou estação instalada, e se é multiusuária.",
    exigeEets: ["EET-1", "EET-5"],
  },
  { tipo: "politica_publica", Icone: Landmark, oQueEntra: "Minuta, nota técnica, diretriz, audiência: instrumento, órgão e situação." },
];

const ROTULO_PUBLICO_ALVO: Record<PublicoAlvo, string> = {
  ensino_basico: "Ensino básico",
  ensino_fundamental: "Ensino fundamental",
  ensino_medio: "Ensino médio",
  ensino_superior: "Ensino superior",
  publico_geral: "Público em geral",
  profissionais_setoriais: "Profissionais setoriais",
  comunidade_tradicional: "Comunidade tradicional",
};

const ROTULO_NATUREZA: Record<NaturezaParceria, string> = {
  acordo_formal: "Acordo formal",
  coautoria: "Coautoria",
  visita_tecnica: "Visita técnica",
  intercambio: "Intercâmbio",
  projeto_conjunto: "Projeto conjunto",
  fornecimento_amostras: "Fornecimento de amostras",
  empresa: "Empresa",
  org_publica_social: "Organização pública ou social",
};

const ROTULO_NIVEL: Record<NivelFormacao, string> = {
  ic_junior: "Iniciação científica júnior (ICJ)",
  ic: "Iniciação científica (IC)",
  mestrado: "Mestrado",
  doutorado: "Doutorado",
  pos_doc: "Pós-doutorado",
  tecnica: "Formação técnica",
  comunitaria: "Formação comunitária",
};

const ROTULO_SITUACAO_FORMACAO: Record<SituacaoFormacao, string> = {
  em_andamento: "Em andamento",
  concluida_no_periodo: "Concluída no período",
  interrompida: "Interrompida",
};

const ROTULO_SITUACAO_BOLSA: Record<SituacaoBolsa, string> = {
  implantada: "Implantada",
  em_curso: "Em curso",
  concluida: "Concluída",
  cancelada: "Cancelada",
  nao_implantada: "Não implantada",
};

// ============================================ 4. LEITURA/ESCRITA DO PAYLOAD ===
/**
 * O `payload` é jsonb: no runtime ele é `unknown` por mais que o tipo diga
 * outra coisa. Ler com coerção explícita é o que impede que um número gravado
 * como string em 2026 estoure a tela em 2027.
 */
function txt(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}
function numTxt(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : typeof v === "string" ? v : "";
}
function listaTxt(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Rascunho do editor: TUDO string/boolean/array, porque campo de tela é texto. */
type Rascunho = {
  tipo: TipoFato;
  titulo: string;
  ocorridoEm: string;
  /** "dia" | "mes" — precisão de mês é aceita e vira dia 1 (§2.4). */
  precisao: "dia" | "mes";
  eets: string[];
  objetivos: number[];
  participantes: string[];
  // expedicao
  municipio: string;
  municipioNome: string;
  uf: string;
  comunidade: string;
  dias: string;
  pessoasEquipe: string;
  autorizacao: string;
  // acao_sociedade
  veiculo: string[];
  publicoAlvo: PublicoAlvo[];
  pessoasAlcancadas: string;
  url: string;
  // parceria
  rorId: string;
  paisIso2: string;
  instituicaoNome: string;
  natureza: string;
  objetivoResumido: string;
  // formacao
  nome: string;
  nivel: string;
  situacaoFormacao: string;
  dataDefesa: string;
  instituicaoRor: string;
  codigoPpgCapes: string;
  tituloTrabalho: string;
  situacaoAtualEgresso: string;
  // bolsista
  modalidade: string;
  situacaoBolsa: string;
  inicio: string;
  fim: string;
  orientadorId: string;
  avaliacaoDesempenho: string;
  // acervo
  siglaColecao: string;
  oQueFoiIncorporado: string;
  registros: string;
  faixaTombo: string;
  sisgen: string;
  // dado_software
  doiOuUrl: string;
  nomeDado: string;
  repositorio: string;
  // infraestrutura
  oQue: string;
  ondeInstalada: string;
  multiusuaria: boolean;
  // politica_publica
  instrumento: string;
  orgao: string;
  situacaoPolitica: string;
};

function rascunhoVazio(tipo: TipoFato, lab: Laboratorio): Rascunho {
  return {
    tipo,
    titulo: "",
    ocorridoEm: "",
    precisao: "dia",
    eets: [...lab.eets],
    objetivos: [...lab.objetivos],
    participantes: [],
    municipio: "",
    municipioNome: "",
    uf: lab.uf ?? "",
    comunidade: "",
    dias: "",
    pessoasEquipe: "",
    autorizacao: "",
    veiculo: [],
    publicoAlvo: [],
    pessoasAlcancadas: "",
    url: "",
    rorId: "",
    paisIso2: "",
    instituicaoNome: "",
    natureza: "",
    objetivoResumido: "",
    nome: "",
    nivel: "",
    situacaoFormacao: "",
    dataDefesa: "",
    instituicaoRor: lab.instituicao_ror ?? "",
    codigoPpgCapes: "",
    tituloTrabalho: "",
    situacaoAtualEgresso: "",
    modalidade: "",
    situacaoBolsa: "",
    inicio: "",
    fim: "",
    orientadorId: "",
    avaliacaoDesempenho: "",
    siglaColecao: "",
    oQueFoiIncorporado: "",
    registros: "",
    faixaTombo: "",
    sisgen: "",
    doiOuUrl: "",
    nomeDado: "",
    repositorio: "",
    oQue: "",
    ondeInstalada: "",
    multiusuaria: false,
    instrumento: "",
    orgao: "",
    situacaoPolitica: "",
  };
}

function rascunhoDoFato(fato: Fato, lab: Laboratorio, participantes: string[]): Rascunho {
  const p = fato.payload as Record<string, unknown>;
  const base = rascunhoVazio(fato.tipo, lab);
  return {
    ...base,
    tipo: fato.tipo,
    titulo: fato.titulo,
    ocorridoEm: fato.ocorrido_em,
    precisao: fato.ocorrido_em.endsWith("-01") ? "mes" : "dia",
    eets: [...fato.eets],
    objetivos: [...fato.objetivos],
    participantes,
    municipio: txt(p.municipio),
    municipioNome: txt(p.municipio_nome),
    uf: txt(p.uf) || base.uf,
    comunidade: txt(p.comunidade),
    dias: numTxt(p.dias),
    pessoasEquipe: numTxt(p.pessoas_equipe),
    autorizacao: txt(p.autorizacao),
    veiculo: listaTxt(p.veiculo),
    publicoAlvo: listaTxt(p.publico_alvo).filter((x): x is PublicoAlvo => x in ROTULO_PUBLICO_ALVO),
    pessoasAlcancadas: numTxt(p.pessoas_alcancadas),
    url: txt(p.url),
    rorId: txt(p.ror_id),
    paisIso2: txt(p.pais_iso2),
    instituicaoNome: txt(p.instituicao_nome),
    natureza: txt(p.natureza),
    objetivoResumido: txt(p.objetivo_resumido),
    nome: txt(p.nome),
    nivel: txt(p.nivel),
    situacaoFormacao: txt(p.situacao),
    dataDefesa: txt(p.data_defesa),
    instituicaoRor: txt(p.instituicao_ror) || base.instituicaoRor,
    codigoPpgCapes: txt(p.codigo_ppg_capes),
    tituloTrabalho: txt(p.titulo_trabalho),
    situacaoAtualEgresso: txt(p.situacao_atual_egresso),
    modalidade: txt(p.modalidade),
    situacaoBolsa: txt(p.situacao),
    inicio: txt(p.inicio),
    fim: txt(p.fim),
    orientadorId: txt(p.orientador_id),
    avaliacaoDesempenho: txt(p.avaliacao_desempenho),
    siglaColecao: txt(p.sigla_colecao),
    oQueFoiIncorporado: txt(p.o_que_foi_incorporado),
    registros: numTxt(p.registros),
    faixaTombo: txt(p.faixa_tombo),
    sisgen: txt(p.sisgen),
    doiOuUrl: txt(p.doi_ou_url),
    nomeDado: txt(p.nome),
    repositorio: txt(p.repositorio),
    oQue: txt(p.o_que),
    ondeInstalada: txt(p.onde_instalada),
    multiusuaria: p.multiusuaria === true,
    instrumento: txt(p.instrumento),
    orgao: txt(p.orgao),
    situacaoPolitica: txt(p.situacao),
  };
}

/** Tira chave vazia do jsonb: `{}` é mais honesto do que `{"uf": ""}`. */
function limpar<T extends object>(objeto: T): T {
  const entradas = Object.entries(objeto).filter(([, v]) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.length > 0;
    return true; // número e booleano passam: `false` e `0` são respostas
  });
  return Object.fromEntries(entradas) as T;
}

function inteiro(s: string): number | undefined {
  const n = Number(s.replace(",", "."));
  return s.trim() && Number.isFinite(n) ? Math.round(n) : undefined;
}

function montarPayload(r: Rascunho): FatoPayload {
  switch (r.tipo) {
    case "expedicao":
      return limpar<PayloadExpedicao>({
        municipio: r.municipio.replace(/\D/g, ""),
        municipio_nome: r.municipioNome,
        uf: r.uf.toUpperCase(),
        comunidade: r.comunidade,
        dias: inteiro(r.dias),
        pessoas_equipe: inteiro(r.pessoasEquipe),
        autorizacao: r.autorizacao,
      });
    case "acao_sociedade":
      return limpar<PayloadAcaoSociedade>({
        veiculo: r.veiculo,
        publico_alvo: r.publicoAlvo,
        pessoas_alcancadas: inteiro(r.pessoasAlcancadas),
        url: r.url,
        municipio: r.municipio.replace(/\D/g, ""),
        municipio_nome: r.municipioNome,
      });
    case "parceria":
      return limpar<PayloadParceria>({
        ror_id: r.rorId,
        pais_iso2: r.paisIso2.toUpperCase(),
        instituicao_nome: r.instituicaoNome,
        natureza: (r.natureza || undefined) as NaturezaParceria | undefined,
        objetivo_resumido: r.objetivoResumido,
      });
    case "formacao":
      return limpar<PayloadFormacao>({
        nome: r.nome,
        nivel: (r.nivel || undefined) as NivelFormacao | undefined,
        situacao: (r.situacaoFormacao || undefined) as SituacaoFormacao | undefined,
        data_defesa: r.dataDefesa,
        instituicao_ror: r.instituicaoRor,
        uf: r.uf.toUpperCase(),
        codigo_ppg_capes: r.codigoPpgCapes,
        titulo_trabalho: r.tituloTrabalho,
        situacao_atual_egresso: r.situacaoAtualEgresso,
      });
    case "bolsista":
      return limpar<PayloadBolsista>({
        modalidade: r.modalidade,
        situacao: (r.situacaoBolsa || undefined) as SituacaoBolsa | undefined,
        inicio: r.inicio,
        fim: r.fim,
        orientador_id: r.orientadorId,
        avaliacao_desempenho: r.avaliacaoDesempenho,
      });
    case "acervo":
      return limpar<PayloadAcervo>({
        sigla_colecao: r.siglaColecao,
        o_que_foi_incorporado: r.oQueFoiIncorporado,
        registros: inteiro(r.registros),
        faixa_tombo: r.faixaTombo,
        sisgen: r.sisgen,
      });
    case "dado_software":
      return limpar<PayloadDadoSoftware>({
        doi_ou_url: r.doiOuUrl,
        nome: r.nomeDado,
        repositorio: r.repositorio,
      });
    case "infraestrutura":
      return limpar<PayloadInfraestrutura>({
        o_que: r.oQue,
        onde_instalada: r.ondeInstalada,
        multiusuaria: r.multiusuaria,
      });
    case "politica_publica":
      return limpar<PayloadPoliticaPublica>({
        instrumento: r.instrumento,
        orgao: r.orgao,
        situacao: r.situacaoPolitica,
      });
  }
}

/**
 * A linha de metadados do item na lista. Usa a guarda `ehFatoDe` em vez de
 * `as`: é ela que garante, em tempo de compilação, que `payload.dias` só é lido
 * de uma expedição.
 */
function resumoDoFato(fato: Fato): string {
  const partes: string[] = [dataBr(fato.ocorrido_em)];
  if (ehFatoDe(fato, "expedicao")) {
    const p = fato.payload;
    if (p.municipio_nome || p.uf) partes.push([p.municipio_nome, p.uf].filter(Boolean).join("/"));
    if (p.dias) partes.push(`${p.dias} dia(s)`);
    if (p.pessoas_equipe) partes.push(`${p.pessoas_equipe} na equipe`);
  } else if (ehFatoDe(fato, "acao_sociedade")) {
    const p = fato.payload;
    if (p.pessoas_alcancadas) partes.push(`aproximadamente ${p.pessoas_alcancadas} pessoas`);
    if (p.publico_alvo?.length) partes.push(p.publico_alvo.map((a) => ROTULO_PUBLICO_ALVO[a]).join(", "));
  } else if (ehFatoDe(fato, "parceria")) {
    const p = fato.payload;
    if (p.instituicao_nome) partes.push(p.instituicao_nome);
    if (p.ror_id) partes.push(`ROR ${p.ror_id}`);
    if (p.natureza) partes.push(ROTULO_NATUREZA[p.natureza]);
  } else if (ehFatoDe(fato, "formacao")) {
    const p = fato.payload;
    if (p.nome) partes.push(p.nome);
    if (p.nivel) partes.push(ROTULO_NIVEL[p.nivel]);
    if (p.situacao) partes.push(ROTULO_SITUACAO_FORMACAO[p.situacao]);
  } else if (ehFatoDe(fato, "bolsista")) {
    const p = fato.payload;
    if (p.modalidade) partes.push(p.modalidade);
    if (p.situacao) partes.push(ROTULO_SITUACAO_BOLSA[p.situacao]);
  } else if (ehFatoDe(fato, "acervo")) {
    const p = fato.payload;
    if (p.sigla_colecao) partes.push(p.sigla_colecao);
    if (p.registros) partes.push(`${p.registros} registro(s)`);
  } else if (ehFatoDe(fato, "dado_software")) {
    const p = fato.payload;
    if (p.repositorio) partes.push(p.repositorio);
    if (p.doi_ou_url) partes.push(p.doi_ou_url);
  } else if (ehFatoDe(fato, "infraestrutura")) {
    const p = fato.payload;
    if (p.onde_instalada) partes.push(p.onde_instalada);
    if (p.multiusuaria) partes.push("multiusuária");
  } else if (ehFatoDe(fato, "politica_publica")) {
    const p = fato.payload;
    if (p.orgao) partes.push(p.orgao);
    if (p.situacao) partes.push(p.situacao);
  }
  return partes.filter(Boolean).join(" · ");
}

// ======================================================= 5. CONTROLES DE TELA =
/* EXTRAIR-DEPOIS: estes controles são gêmeos dos de `MeuAno.tsx`. Quando os dois
   arquivos existirem, mover para `src/relato/campos.tsx` sem alterar a API. */

function idsDescricao(id: string, temDica: boolean, temErro: boolean): string | undefined {
  const ids = [temDica ? `${id}-dica` : "", temErro ? `${id}-erro` : ""].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

type CampoBase = {
  id: string;
  rotulo: string;
  dica?: string;
  erro?: string;
  opcional?: boolean;
};

function Rotulo({ id, rotulo, opcional }: { id: string; rotulo: string; opcional?: boolean }) {
  return (
    <label htmlFor={id}>
      {rotulo}
      {opcional ? <span className="rel-opcional"> (opcional)</span> : null}
    </label>
  );
}

function Auxiliares({ id, dica, erro }: { id: string; dica?: string; erro?: string }) {
  return (
    <>
      {dica ? (
        <small className="rel-dica" id={`${id}-dica`}>
          {dica}
        </small>
      ) : null}
      {erro ? (
        <small className="plat-error rel-erro" id={`${id}-erro`}>
          {erro}
        </small>
      ) : null}
    </>
  );
}

function Texto({
  id,
  rotulo,
  dica,
  erro,
  opcional,
  valor,
  aoMudar,
  maxLength,
  inputMode,
  autoComplete,
  tipo = "text",
}: CampoBase & {
  valor: string;
  aoMudar: (v: string) => void;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "url";
  autoComplete?: string;
  tipo?: "text" | "url" | "date" | "month" | "number";
}) {
  return (
    <div className="rel-campo">
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <input
        id={id}
        type={tipo}
        value={valor}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idsDescricao(id, Boolean(dica), Boolean(erro))}
        onChange={(e) => aoMudar(e.target.value)}
      />
      <Auxiliares id={id} dica={dica} erro={erro} />
    </div>
  );
}

function Area({
  id,
  rotulo,
  dica,
  erro,
  opcional,
  valor,
  aoMudar,
  maximo,
  linhas = 4,
}: CampoBase & { valor: string; aoMudar: (v: string) => void; maximo: number; linhas?: number }) {
  const usados = contarCaracteres(valor);
  return (
    <div className="rel-campo">
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <textarea
        id={id}
        rows={linhas}
        value={valor}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idsDescricao(id, true, Boolean(erro))}
        onChange={(e) => aoMudar(e.target.value)}
      />
      <small className="rel-dica" id={`${id}-dica`}>
        {dica ? `${dica} · ` : ""}
        até {maximo} caracteres
      </small>
      <small className={usados > maximo ? "rel-contador is-erro" : "rel-contador"}>
        {usados} de {maximo}
      </small>
      {erro ? (
        <small className="plat-error rel-erro" id={`${id}-erro`}>
          {erro}
        </small>
      ) : null}
    </div>
  );
}

function Selecao({
  id,
  rotulo,
  dica,
  erro,
  opcional,
  valor,
  aoMudar,
  opcoes,
  vazio = "Selecione…",
}: CampoBase & {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: ReadonlyArray<readonly [string, string]>;
  vazio?: string;
}) {
  return (
    <div className="rel-campo">
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <select
        id={id}
        value={valor}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idsDescricao(id, Boolean(dica), Boolean(erro))}
        onChange={(e) => aoMudar(e.target.value)}
      >
        <option value="">{vazio}</option>
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
      <Auxiliares id={id} dica={dica} erro={erro} />
    </div>
  );
}

/** Grupo de caixas com `<fieldset>/<legend>` de verdade (§6.1 item 2). */
function Caixas<T extends string>({
  legenda,
  dica,
  opcoes,
  marcadas,
  aoAlternar,
  nomeId,
}: {
  legenda: string;
  dica?: string;
  opcoes: ReadonlyArray<readonly [T, string]>;
  marcadas: readonly T[];
  aoAlternar: (v: T) => void;
  nomeId: string;
}) {
  return (
    <fieldset className="plat-fields rel-campo">
      <legend>{legenda}</legend>
      {dica ? <small className="rel-dica">{dica}</small> : null}
      {opcoes.map(([v, r]) => (
        <label key={v} className="rel-escolha" htmlFor={`${nomeId}-${v}`}>
          <input
            id={`${nomeId}-${v}`}
            type="checkbox"
            checked={marcadas.includes(v)}
            onChange={() => aoAlternar(v)}
          />
          <span>{r}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Sim/Não do formulário oficial do CNPq — rádio, nunca caixa solta. */
function SimNao({
  legenda,
  nomeId,
  valor,
  aoMudar,
}: {
  legenda: string;
  nomeId: string;
  valor: boolean | undefined;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <fieldset className="rel-escolhas">
      <legend>{legenda}</legend>
      <label className="rel-escolha rel-escolha--sim" htmlFor={`${nomeId}-sim`}>
        <input
          id={`${nomeId}-sim`}
          type="radio"
          name={nomeId}
          checked={valor === true}
          onChange={() => aoMudar(true)}
        />
        <span>Sim</span>
      </label>
      <label className="rel-escolha rel-escolha--nao" htmlFor={`${nomeId}-nao`}>
        <input
          id={`${nomeId}-nao`}
          type="radio"
          name={nomeId}
          checked={valor === false}
          onChange={() => aoMudar(false)}
        />
        <span>Não</span>
      </label>
    </fieldset>
  );
}

/** Selo curto. `fora` é a variante que quebra linha (frase, não palavra). */
function Chip({
  texto,
  fora,
  variante,
}: {
  texto: string;
  fora?: boolean;
  variante?: "comite" | "eet" | "ok" | "aviso";
}) {
  const classes = ["rel-chip", fora ? "rel-chip--fora" : "", variante ? `rel-chip--${variante}` : ""]
    .filter(Boolean)
    .join(" ");
  return <span className={classes}>{texto}</span>;
}

/**
 * Progresso em MINUTOS, nunca em porcentagem (§3). A barra é redundante de
 * propósito: o estado verdadeiro está no texto, porque a barra não pode ser o
 * único indicador (§6.1 item 10).
 */
/**
 * A frase acompanha o avanço — custo inteiro na abertura, orientação no meio,
 * ânimo no fim (o mesmo padrão do formulário individual, 11/08). Sem o título
 * da tela: o h2 de cada tela já o diz.
 */
function fraseDoProgresso(indice: number): string {
  const n = indice + 1;
  const m = minutosRestantes(indice);
  if (n === 1) return `Primeira de ${TOTAL_TELAS} telas, uns ${m} minutos ao todo`;
  if (n === TOTAL_TELAS)
    return m <= 1 ? "Última tela, falta menos de um minuto" : `Última tela, uns ${m} minutos`;
  return `Tela ${n} de ${TOTAL_TELAS} · ${m <= 1 ? "falta só um minutinho" : `faltam uns ${m} minutos`}`;
}

function Progresso({ indice }: { indice: number }) {
  const pct = Math.round(((indice + 1) / TOTAL_TELAS) * 100);
  const frase = fraseDoProgresso(indice);
  return (
    <div className="rel-progresso">
      <p>{frase}</p>
      <div
        className="rel-progresso-trilho"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={TOTAL_TELAS}
        aria-valuenow={indice + 1}
        aria-label={frase}
      >
        <span className="rel-progresso-preenchida" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Tabela sempre dentro do rolo: em 375px ela rola sozinha, a página não. */
function Rolo({ children }: { children: React.ReactNode }) {
  return <div className="rel-tabela-rolo">{children}</div>;
}

// ================================================================ 6. O SHELL ==
/* EXTRAIR-DEPOIS: gêmeo do Shell de `MeuAno.tsx`. */

function Shell({
  children,
  subtitulo,
  email,
  aoSair,
  largo,
}: {
  children: React.ReactNode;
  subtitulo?: string;
  email?: string | undefined;
  aoSair?: () => void;
  /** Só a conferência (L4) precisa: é a única tela com tabela de verdade. */
  largo?: boolean;
}) {
  return (
    <main className="plat-page" id="conteudo" tabIndex={-1}>
      {/* `rel-band` vai na SEÇÃO, não no <main>: seu padding de 152px existe para
          livrar o cabeçalho fixo, e `plat-band` já aplica o mesmo respiro. Nos
          dois elementos ao mesmo tempo o topo somava 304px de vazio. É o mesmo
          arranjo de MeuAno.tsx. */}
      <section className="section-band plat-band rel-band">
        <div className={`section-inner plat-inner rel-inner${largo ? " rel-inner--largo" : ""}`}>
          <a className="plat-back" href={RELATORIO_ANUAL_HREF}>
            <ArrowLeft size={15} aria-hidden="true" /> Relatório Anual de Atividades
          </a>
          <p className="eyebrow dark">Relato anual · formulário do laboratório</p>
          <h1>Relatório Anual do Laboratório</h1>
          {subtitulo ? <p className="plat-muted">{subtitulo}</p> : null}
          {email ? (
            <p className="plat-session">
              Conectado como <strong>{email}</strong>
              {aoSair ? (
                <button className="plat-signout" onClick={aoSair}>
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

function Aviso({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="plat-card plat-notice">
      <CalendarX2 size={22} aria-hidden="true" />
      <div>
        <strong>{titulo}</strong>
        {children}
      </div>
    </div>
  );
}

function horaAgora(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ============================================================ 7. O CONTEXTO ==

type Contexto = {
  ciclo: RelatorioCiclo;
  lab: Laboratorio;
  equipe: CicloMembro[];
  membro: CicloMembro | null;
  relato: Relato;
  userId: string;
  papel: PapelNoCiclo | null;
  souLla: boolean;
  congelado: boolean;
};

type Carga = {
  membro: CicloMembro | null;
  papel: PapelNoCiclo | null;
  labs: Laboratorio[];
  lab: Laboratorio | null;
  equipe: CicloMembro[];
  relato: Relato;
  fatos: Fato[];
  participantes: FatoParticipante[];
};

// ========================================================== 8. O COMPONENTE ==

export default function MeuLaboratorio() {
  const auth = useAuth();

  const [ciclo, setCiclo] = useState<RelatorioCiclo | null | "carregando">("carregando");
  const [carga, setCarga] = useState<Carga | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [labEscolhido, setLabEscolhido] = useState<string>("");
  const [tela, setTela] = useState(0);

  const [narrativas, setNarrativas] = useState<Narrativas>({});
  const narrativasGravadas = useRef<string>("{}");
  /**
   * Id do relato cujas narrativas já foram semeadas do banco.
   *
   * ISTO NÃO É MICRO-OTIMIZAÇÃO. O Supabase renova o token sozinho a cada ~50
   * min e `onAuthStateChange` devolve um objeto de sessão NOVO. Se a recarga
   * semeasse o estado de novo, ela sobrescreveria o que a pessoa acabou de
   * digitar e ainda não passou pelo debounce de 800 ms — o líder perderia
   * texto no meio de um campo de 1.200 caracteres, sem nada na tela explicando.
   */
  const relatoSemeado = useRef<string | null>(null);
  const [salvoEm, setSalvoEm] = useState("");
  const [erroSalvar, setErroSalvar] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [anuncio, setAnuncio] = useState("");

  // A sessão inteira muda de identidade a cada renovação de token; o id da
  // pessoa não. É por ele que as recargas são disparadas.
  const userId = auth.session?.user.id ?? null;

  // Restaura o título ao desmontar (mesmo padrão de MapaPage e webinars/seo.ts):
  // sem isso, voltar para "#/" deixa o título do formulário na aba do navegador.
  useEffect(() => {
    const anterior = document.title;
    document.title = "Relatório Anual do Laboratório | INCT-CONEXAO";
    return () => {
      document.title = anterior;
    };
  }, []);

  // ---- ciclo aberto (uma vez, com sessão) ---------------------------------
  useEffect(() => {
    if (!platformEnabled || !userId) return;
    let cancelado = false;
    cicloAberto()
      .then((c) => {
        if (!cancelado) setCiclo(c);
      })
      .catch((e: unknown) => {
        if (!cancelado) {
          setCiclo(null);
          setErro(erroDeRelato(e));
        }
      });
    return () => {
      cancelado = true;
    };
  }, [userId]);

  // ---- tudo o que a tela precisa, numa passada só -------------------------
  const carregar = useCallback(async () => {
    if (!userId || !ciclo || ciclo === "carregando") return;
    setCarregando(true);
    setErro("");
    try {
      const inicial = await Promise.all([
        meuVinculo(ciclo.id, userId),
        meuPapel(ciclo.id),
        meuLaboratorioId(ciclo.id),
        listarLaboratorios(ciclo.id),
      ]);
      let [membro, papel, meuLab] = inicial;
      const labs = inicial[3];
      // SEM LINHA NO ROSTER AINDA NÃO É BECO: antes de qualquer tela seca,
      // tenta o vínculo SILENCIOSO por e-mail pré-autorizado (RPC
      // `vincular_meu_cadastro`, 006, consertada pela 013). É o caminho de quem
      // a coordenação pré-autorizou (gestão inclusive): a linha do roster já
      // carrega o e-mail real e o vínculo casa aqui, sem a pessoa ver erro.
      // Para quem não tem linha a chamada devolve 0 e nada muda; nunca lança.
      if (!membro && (await vincularMeuCadastro()) > 0) {
        [membro, papel, meuLab] = await Promise.all([
          meuVinculo(ciclo.id, userId),
          meuPapel(ciclo.id),
          meuLaboratorioId(ciclo.id),
        ]);
      }
      const labId = labEscolhido || meuLab || "";
      const lab = labs.find((l) => l.id === labId) ?? null;
      const relato = await abrirRelato(ciclo.id, userId, membro?.id ?? null);

      let equipe: CicloMembro[] = [];
      let fatos: Fato[] = [];
      let participantes: FatoParticipante[] = [];
      if (lab) {
        equipe = await listarEquipeDoLaboratorio(ciclo.id, lab.id);
        fatos = await listarFatosDoLaboratorio(ciclo.id, lab.id);
        participantes = await listarParticipantes(fatos.map((f) => f.id));
      }

      setCarga({ membro, papel, labs, lab, equipe, relato, fatos, participantes });
      // Semeia UMA vez por relato: recarregar não pode desfazer digitação.
      if (relatoSemeado.current !== relato.id) {
        relatoSemeado.current = relato.id;
        const carregadas = relato.narrativas ?? {};
        setNarrativas(carregadas);
        narrativasGravadas.current = JSON.stringify(carregadas);
      }
    } catch (e: unknown) {
      setErro(erroDeRelato(e));
    } finally {
      setCarregando(false);
    }
  }, [userId, ciclo, labEscolhido]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Recarrega só os fatos: é o que muda a cada gravação de L2/L3. */
  const recarregarFatos = useCallback(async () => {
    if (!carga?.lab || !ciclo || ciclo === "carregando") return;
    const fatos = await listarFatosDoLaboratorio(ciclo.id, carga.lab.id);
    const participantes = await listarParticipantes(fatos.map((f) => f.id));
    setCarga((c) => (c ? { ...c, fatos, participantes } : c));
  }, [carga?.lab, ciclo]);

  // ---- autosave das narrativas (debounce 800 ms, aria-live) ---------------
  const relatoId = carga?.relato.id ?? null;
  const gravarNarrativas = useCallback(
    async (valor: Narrativas) => {
      if (!relatoId) return;
      setSalvando(true);
      try {
        await salvarNarrativas(relatoId, valor);
        narrativasGravadas.current = JSON.stringify(valor);
        setSalvoEm(horaAgora());
        setErroSalvar("");
      } catch (e: unknown) {
        // Falha de rede é ESTADO, não tela de erro: o texto continua na tela e
        // a próxima digitação tenta de novo.
        setErroSalvar(erroDeRelato(e));
      } finally {
        setSalvando(false);
      }
    },
    [relatoId],
  );

  useEffect(() => {
    if (!relatoId) return;
    const atual = JSON.stringify(narrativas);
    if (atual === narrativasGravadas.current) return;
    const id = window.setTimeout(() => void gravarNarrativas(narrativas), 800);
    return () => window.clearTimeout(id);
  }, [narrativas, relatoId, gravarNarrativas]);

  // O anúncio (aria-live) some sozinho: região viva que nunca esvazia acaba
  // relida a cada mudança vizinha e vira ruído para quem usa leitor de tela.
  useEffect(() => {
    if (!anuncio) return;
    const id = window.setTimeout(() => setAnuncio(""), 6000);
    return () => window.clearTimeout(id);
  }, [anuncio]);

  const mudarNarrativa = useCallback(<K extends keyof Narrativas>(chave: K, valor: Narrativas[K]) => {
    setNarrativas((n) => ({ ...n, [chave]: valor }));
  }, []);

  const mudarGovernanca = useCallback(<K extends keyof Governanca>(chave: K, valor: Governanca[K]) => {
    setNarrativas((n) => ({ ...n, governanca: { ...(n.governanca ?? {}), [chave]: valor } }));
  }, []);

  // ------------------------------------------------------------- guardas ---
  if (!platformEnabled) {
    return (
      <Shell>
        <Aviso titulo="Formulário do laboratório em preparação">
          <p>
            A coleta do relato anual ainda não foi habilitada neste ambiente. Quando abrir, você recebe um convite
            nominal por e-mail, 15 dias antes do convite geral da rede.
          </p>
        </Aviso>
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

  if (auth.recovery) {
    return (
      <Shell>
        <PasswordCard title="Definir nova senha" cta="Salvar nova senha" onSubmit={auth.updatePassword} />
      </Shell>
    );
  }

  // ---- a PORTA (sem sessão) ----------------------------------------------
  if (!auth.session) {
    return (
      <Shell>
        <Porta auth={auth} titulo="Formulário do laboratório">
          <p>{TEXTO.porta}</p>
          <hr />
          <p>{TEXTO.porQueColetivo}</p>
          <hr />
          <p>{TEXTO.semMeta}</p>
          <hr />
          <p>
            Leva de <strong>20 a 35 minutos</strong>, e você pode sair e voltar quando quiser: fica salvo no servidor,
            não no seu navegador. Se você é membro e não líder, seu formulário é o{" "}
            <a href={RELATORIO_ANUAL_HREF}>Relatório Anual de Atividades</a>.
          </p>
        </Porta>
      </Shell>
    );
  }

  const email = auth.session.user.email;

  if (ciclo === "carregando" || (carregando && !carga)) {
    return (
      <Shell email={email} aoSair={auth.signOut}>
        <div className="plat-loading">
          <Loader2 size={22} aria-hidden="true" /> Carregando o laboratório…
        </div>
      </Shell>
    );
  }

  if (!ciclo) {
    return (
      <Shell email={email} aoSair={auth.signOut}>
        <Aviso titulo="A coleta ainda não começou">
          <p>
            Nenhum ciclo de relato está aberto neste momento. Se você recebeu o convite hoje, avise a coordenação.
            Nada do que você escrever depois se perde.
          </p>
        </Aviso>
        {erro ? <p className="plat-error rel-erro">{erro}</p> : null}
      </Shell>
    );
  }

  if (erro && !carga) {
    return (
      <Shell email={email} aoSair={auth.signOut}>
        <Aviso titulo="Não foi possível carregar seu laboratório">
          <p>{erro}</p>
        </Aviso>
        <button className="button primary" onClick={() => void carregar()}>
          Tentar de novo
        </button>
      </Shell>
    );
  }

  if (!carga) {
    return (
      <Shell email={email} aoSair={auth.signOut}>
        <div className="plat-loading">
          <Loader2 size={22} aria-hidden="true" /> Carregando…
        </div>
      </Shell>
    );
  }

  const ehCoordenacao = carga.papel === "coordenacao" || carga.papel === "cges";

  // Coordenação sem laboratório próprio: escolhe qual laboratório vai conferir.
  if (!carga.lab) {
    if (ehCoordenacao && carga.labs.length) {
      return (
        <Shell email={email} aoSair={auth.signOut}>
          <div className="plat-card rel-tela">
            <div className="rel-cabeca">
              <h2>Qual laboratório?</h2>
              <p className="plat-muted">
                Você entrou como coordenação. Escolha o laboratório para conferir ou preencher em nome do líder: o
                log registra quem gravou.
              </p>
            </div>
            <Selecao
              id="escolher-lab"
              rotulo="Laboratório Associado"
              valor={labEscolhido}
              aoMudar={setLabEscolhido}
              opcoes={carga.labs.map((l) => [l.id, `${l.sigla}: ${l.nome}`] as const)}
            />
          </div>
        </Shell>
      );
    }
    /*
     * ISTO ERA UM BECO. Quem entrava logado SEM linha no roster (conta antiga,
     * link mágico em outro aparelho) lia um texto seco e parava. O vínculo
     * silencioso por e-mail já foi tentado em `carregar`; sobrando nada, a
     * pessoa se identifica AQUI, com o mesmo componente do formulário
     * individual — e o vínculo vale para a plataforma inteira. Depois do
     * vínculo, `carregar()` decide o caminho: líder segue para o formulário
     * (a 012 grava lla_user_id na identificação), membro é encaminhado ao
     * relato individual pelo aviso abaixo.
     */
    if (!carga.membro) {
      return (
        <Shell email={email} aoSair={auth.signOut}>
          <IdentificacaoComSessao emailDaSessao={email ?? ""} onVinculado={() => void carregar()} />
        </Shell>
      );
    }
    return (
      <Shell email={email} aoSair={auth.signOut}>
        <Aviso titulo="Esta tela é do líder do laboratório">
          <p>
            Seu cadastro não está ligado a nenhum Laboratório Associado, ou você não é o líder dele. Seu relato
            individual é o <a href={RELATORIO_ANUAL_HREF}>Relatório Anual de Atividades</a>. Se isso for engano, fale com a
            coordenação.
          </p>
        </Aviso>
      </Shell>
    );
  }

  const souLla = carga.lab.lla_user_id === auth.session.user.id || ehCoordenacao;

  if (!souLla) {
    return (
      <Shell email={email} aoSair={auth.signOut}>
        <Aviso titulo="Quem declara os fatos do laboratório é o(a) líder">
          <p>
            O líder registrado do {carga.lab.sigla} é <strong>{carga.lab.lla_nome || "não informado"}</strong>. Você participa dos
            fatos marcando “participei” no <a href={RELATORIO_ANUAL_HREF}>Relatório Anual de Atividades</a>, e se algo não estiver
            na lista, você propõe por lá e chega aqui como proposta.
          </p>
        </Aviso>
      </Shell>
    );
  }

  const ctx: Contexto = {
    ciclo,
    lab: carga.lab,
    equipe: carga.equipe,
    membro: carga.membro,
    relato: carga.relato,
    userId: auth.session.user.id,
    papel: carga.papel,
    souLla,
    congelado: cicloCongelado(ciclo),
  };

  const irPara = (indice: number) => {
    setTela(Math.max(0, Math.min(indice, TOTAL_TELAS - 1)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fila = carga.fatos.filter((f) => f.status === "proposto");
  const confirmados = carga.fatos.filter((f) => f.status === "confirmado");
  const rejeitados = carga.fatos.filter((f) => f.status === "rejeitado");

  return (
    <Shell
      subtitulo={`${carga.lab.sigla}: ${carga.lab.nome}${carga.lab.uf ? ` · ${carga.lab.uf}` : ""}`}
      email={email}
      aoSair={auth.signOut}
      largo={tela === 3}
    >
      <Progresso indice={tela} />

      {ctx.congelado ? (
        <div className="plat-card plat-notice">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Este ciclo já foi consolidado</strong>
            <p>Você continua vendo tudo o que foi declarado, mas não é mais possível alterar. Fale com a coordenação.</p>
          </div>
        </div>
      ) : null}

      {tela === 0 ? <TelaEquipe ctx={ctx} narrativas={narrativas} aoMudarGovernanca={mudarGovernanca} /> : null}

      {tela === 1 ? (
        <TelaFatos
          ctx={ctx}
          fatos={carga.fatos}
          participantes={carga.participantes}
          aoRecarregar={recarregarFatos}
          aoAnunciar={setAnuncio}
          aoPular={() => irPara(4)}
        />
      ) : null}

      {tela === 2 ? (
        <TelaFila
          ctx={ctx}
          fila={fila}
          confirmados={confirmados}
          rejeitados={rejeitados}
          participantes={carga.participantes}
          aoRecarregar={recarregarFatos}
          aoAnunciar={setAnuncio}
        />
      ) : null}

      {tela === 3 ? <TelaConferencia ctx={ctx} fatos={carga.fatos} /> : null}

      {tela === 4 ? (
        <TelaGovernanca
          ctx={ctx}
          narrativas={narrativas}
          aoMudarNarrativa={mudarNarrativa}
          aoMudarGovernanca={mudarGovernanca}
        />
      ) : null}

      {tela === 5 ? (
        <TelaRevisao
          ctx={ctx}
          fatos={carga.fatos}
          narrativas={narrativas}
          aoMudarNarrativa={mudarNarrativa}
          aoIrPara={irPara}
          aoRecarregar={carregar}
        />
      ) : null}

      {/* Rodapé fixo do autosave — WCAG 4.1.3: anuncia sem mover o foco. */}
      <div className={erroSalvar ? "rel-salvo is-erro" : "rel-salvo"} aria-live="polite">
        {erroSalvar ? (
          <span>
            <strong>Não conseguimos salvar agora.</strong> {erroSalvar} Seu texto está aqui e tentamos de novo na
            próxima alteração.{" "}
            <button className="plat-linkbtn" onClick={() => void gravarNarrativas(narrativas)}>
              tentar agora
            </button>
          </span>
        ) : salvando ? (
          <span>Salvando…</span>
        ) : salvoEm ? (
          <span>
            <CheckCircle2 size={14} aria-hidden="true" /> <strong>Salvo automaticamente às {salvoEm}</strong> · pode
            fechar e voltar depois
          </span>
        ) : (
          <span>Salvo automaticamente enquanto você escreve · pode fechar e voltar depois</span>
        )}
        {anuncio ? <span>{anuncio}</span> : null}
      </div>

      <div className="plat-nav rel-nav">
        {tela > 0 ? (
          <button className="button plat-ghost" onClick={() => irPara(tela - 1)}>
            <ArrowLeft size={16} aria-hidden="true" /> Voltar
          </button>
        ) : (
          <span />
        )}
        <div className="plat-nav--start">
          <button
            className="button plat-ghost"
            onClick={() => void gravarNarrativas(narrativas)}
            disabled={salvando || ctx.congelado}
          >
            <Save size={16} aria-hidden="true" /> Salvar e continuar depois
          </button>
          {tela < TOTAL_TELAS - 1 ? (
            <button className="button primary" onClick={() => irPara(tela + 1)}>
              Continuar <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

// ================================================================= L1 EQUIPE =

function TelaEquipe({
  ctx,
  narrativas,
  aoMudarGovernanca,
}: {
  ctx: Contexto;
  narrativas: Narrativas;
  aoMudarGovernanca: <K extends keyof Governanca>(chave: K, valor: Governanca[K]) => void;
}) {
  const g = narrativas.governanca ?? {};
  /**
   * DECISÃO REGISTRADA: a RLS não deixa o LLA editar `ciclo_membros` (só a
   * coordenação). Então esta tela NÃO promete o que não pode cumprir: as marcas
   * de saída existem para CONTAR (é o que o CNPq pergunta) e para gerar a lista
   * que o líder manda à coordenação. As marcas individuais ficam na sessão; o
   * que persiste são os contadores, porque `Governanca` só tem contadores.
   */
  const [saidas, setSaidas] = useState<string[]>([]);
  const [copiado, setCopiado] = useState("");

  // O próximo valor é calculado FORA do atualizador de estado: em StrictMode o
  // atualizador roda duas vezes, e um efeito colateral lá dentro gravaria duas.
  const alternarSaida = (id: string) => {
    const proximo = saidas.includes(id) ? saidas.filter((x) => x !== id) : [...saidas, id];
    setSaidas(proximo);
    aoMudarGovernanca("equipe_exclusoes", proximo.length);
    if (proximo.length > 0) aoMudarGovernanca("alterou_equipe", true);
  };

  const copiarLista = async () => {
    const linhas = ctx.equipe
      .filter((m) => saidas.includes(m.id))
      .map((m) => `SAIU: ${m.nome} <${m.email}>`)
      .join("\n");
    const texto = `Laboratório ${ctx.lab.sigla}: alterações de equipe\n${linhas || "(nenhuma saída marcada)"}\nInclusões informadas: ${g.equipe_inclusoes ?? 0}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado("Lista copiada. Cole no e-mail para a coordenação.");
    } catch {
      setCopiado("Não foi possível copiar automaticamente. Selecione o texto abaixo e copie à mão.");
    }
  };

  const semAcesso = ctx.equipe.filter((m) => !m.user_id).length;

  return (
    <div className="plat-card rel-tela">
      <div className="rel-cabeca">
        <h2>A equipe do {ctx.lab.sigla}</h2>
        <p className="plat-muted">
          Esta é a lista que veio da proposta. Confira quem saiu e informe quantas pessoas entraram: é exatamente o
          que o formulário do CNPq pergunta. Incluir e excluir gente do cadastro é da coordenação; aqui você marca e
          manda a lista.
        </p>
      </div>

      <ul className="plat-list">
        {ctx.equipe.map((m) => {
          const saiu = saidas.includes(m.id);
          return (
            <li key={m.id} className="rel-item">
              <p className="rel-item-titulo">
                {m.nome}
                {m.id === ctx.membro?.id ? " (você)" : ""}
              </p>
              <p className="rel-item-meta">
                {ROTULO_PAPEL[m.papel]}
                {m.categoria_picc ? ` · ${m.categoria_picc}` : ""} · {m.email}
              </p>
              <p className="rel-item-meta">
                {m.primeiro_acesso_em ? (
                  <Chip texto="já entrou" variante="ok" />
                ) : (
                  <Chip texto="ainda não entrou" variante="aviso" />
                )}
                {m.orcid ? <Chip texto={`ORCID ${m.orcid}`} /> : null}
              </p>
              <label className="rel-escolha" htmlFor={`saiu-${m.id}`}>
                <input
                  id={`saiu-${m.id}`}
                  type="checkbox"
                  checked={saiu}
                  disabled={ctx.congelado}
                  onChange={() => alternarSaida(m.id)}
                />
                <span>Saiu da equipe neste ciclo</span>
              </label>
            </li>
          );
        })}
        {ctx.equipe.length === 0 ? (
          <li className="plat-empty rel-item">
            Nenhuma pessoa está ligada a este laboratório no cadastro. Sem equipe cadastrada, ninguém consegue marcar participação
            nos fatos que você declarar. Avise a coordenação antes de seguir.
          </li>
        ) : null}
      </ul>

      {semAcesso > 0 ? (
        <p className="plat-hint rel-dica">
          <Info size={14} aria-hidden="true" /> {semAcesso} pessoa(s) ainda não acessaram o sistema. Elas aparecem na
          lista, mas só podem ser marcadas como participantes de um fato depois do primeiro acesso: é o cadastro que
          liga a pessoa à conta.
        </p>
      ) : null}

      <fieldset className="plat-fields">
        <legend>Alterações da equipe (formulário oficial do CNPq)</legend>
        <SimNao
          legenda="Houve alteração na equipe do laboratório neste período?"
          nomeId="alterou-equipe"
          valor={g.alterou_equipe}
          aoMudar={(v) => aoMudarGovernanca("alterou_equipe", v)}
        />
        <Texto
          id="equipe-inclusoes"
          rotulo="Pessoas incluídas no período"
          tipo="number"
          inputMode="numeric"
          valor={String(g.equipe_inclusoes ?? "")}
          aoMudar={(v) => aoMudarGovernanca("equipe_inclusoes", inteiro(v) ?? 0)}
          dica="Quantas pessoas passaram a integrar a equipe. Os nomes e e-mails vão para a coordenação, que faz a inclusão no cadastro."
        />
        <Texto
          id="equipe-exclusoes"
          rotulo="Pessoas excluídas no período"
          tipo="number"
          inputMode="numeric"
          valor={String(g.equipe_exclusoes ?? saidas.length)}
          aoMudar={(v) => aoMudarGovernanca("equipe_exclusoes", inteiro(v) ?? 0)}
          dica="Preenchido pelas marcas acima. Você pode corrigir."
        />
      </fieldset>

      <div className="plat-nav plat-nav--start">
        <button className="button plat-ghost" onClick={() => void copiarLista()}>
          <Copy size={16} aria-hidden="true" /> Copiar a lista para a coordenação
        </button>
      </div>
      {copiado ? <p className="plat-ok">{copiado}</p> : null}
    </div>
  );
}

// ========================================================= L2 FATOS (9 fichas)

function TelaFatos({
  ctx,
  fatos,
  participantes,
  aoRecarregar,
  aoAnunciar,
  aoPular,
}: {
  ctx: Contexto;
  fatos: Fato[];
  participantes: FatoParticipante[];
  aoRecarregar: () => Promise<void>;
  aoAnunciar: (t: string) => void;
  aoPular: () => void;
}) {
  const [editando, setEditando] = useState<{ tipo: TipoFato; fato: Fato | null } | null>(null);
  const [todasAsFichas, setTodasAsFichas] = useState(false);
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState(false);

  const meus = fatos.filter((f) => f.status === "confirmado" || f.status === "duplicado_de");
  const porTipo = useMemo(() => {
    const mapa = new Map<TipoFato, Fato[]>();
    for (const f of meus) mapa.set(f.tipo, [...(mapa.get(f.tipo) ?? []), f]);
    return mapa;
  }, [meus]);

  const participantesDe = (fatoId: string) =>
    participantes.filter((p) => p.fato_id === fatoId).map((p) => p.user_id);

  const fichasVisiveis = FICHAS.filter((f) => {
    if (todasAsFichas) return true;
    if (f.exigeCurador && !ctx.lab.curador_acervo) return false;
    if (f.exigeEets && !f.exigeEets.some((e) => ctx.lab.eets.includes(e))) return false;
    return true;
  });

  /**
   * Gravar é DUAS operações: o fato e a lista de participantes. Se a segunda
   * falhar (rede caindo no meio, que é o caso comum em campo), o fato já existe
   * no banco — e uma nova tentativa que ainda ache que é INSERT criaria uma
   * segunda expedição. Por isso `criado` é fixado no estado antes de qualquer
   * coisa poder falhar de novo: a retentativa cai no ramo de edição. É o mesmo
   * cuidado que `platform/Inscricao.tsx` documenta para os anexos.
   */
  const salvarRascunho = async (rascunho: Rascunho, fatoExistente: Fato | null) => {
    setGravando(true);
    setErro("");
    let criado: Fato | null = null;
    try {
      const payload = montarPayload(rascunho);
      let salvo: Fato;
      if (fatoExistente) {
        salvo = await salvarFato(fatoExistente.id, {
          titulo: rascunho.titulo.trim(),
          ocorrido_em: rascunho.ocorridoEm,
          payload,
          eets: rascunho.eets,
          objetivos: rascunho.objetivos,
        });
      } else {
        salvo = await criarFato({
          ciclo_id: ctx.ciclo.id,
          laboratorio_id: ctx.lab.id,
          tipo: rascunho.tipo,
          ocorrido_em: rascunho.ocorridoEm,
          titulo: rascunho.titulo.trim(),
          payload,
          eets: rascunho.eets,
          objetivos: rascunho.objetivos,
        });
        criado = salvo;
      }

      // Participantes: reconcilia contra o que já estava gravado.
      const atuais = fatoExistente ? participantesDe(fatoExistente.id) : [];
      const desejados = rascunho.participantes;
      for (const uid of desejados.filter((u) => !atuais.includes(u))) {
        await aderirAoFato({
          fatoId: salvo.id,
          userId: uid,
          relatoId: uid === ctx.userId ? ctx.relato.id : null,
        });
      }
      for (const uid of atuais.filter((u) => !desejados.includes(u))) {
        await desaderirDoFato(salvo.id, uid);
      }

      await aoRecarregar();
      setEditando(null);
      aoAnunciar(fatoExistente ? "Item atualizado." : "Item adicionado à lista do laboratório.");
    } catch (e: unknown) {
      setErro(erroDeRelato(e));
      if (criado) {
        try {
          await aoRecarregar();
        } catch {
          /* a recarga é conveniência; o essencial é não reinserir */
        }
        setEditando({ tipo: criado.tipo, fato: criado });
      }
    } finally {
      setGravando(false);
    }
  };

  if (editando) {
    return (
      <EditorDeFato
        key={editando.fato?.id ?? `novo-${editando.tipo}`}
        ctx={ctx}
        tipo={editando.tipo}
        fato={editando.fato}
        participantesDoFato={editando.fato ? participantesDe(editando.fato.id) : []}
        gravando={gravando}
        erro={erro}
        aoCancelar={() => setEditando(null)}
        aoSalvar={(r) => void salvarRascunho(r, editando.fato)}
      />
    );
  }

  return (
    <div className="plat-card rel-tela">
      <div className="rel-cabeca">
        <h2>O que o laboratório fez neste ciclo</h2>
        <p className="plat-muted">{TEXTO.porQueColetivo}</p>
        <p className="plat-hint rel-dica">
          <Info size={14} aria-hidden="true" /> O que você adicionar aqui vira a lista que os membros do{" "}
          {ctx.lab.sigla} vão ver na tela deles, para marcar “participei”. Quem não teve nada de um tipo não toca na
          ficha.
        </p>
      </div>

      <div className="rel-fichas">
        {fichasVisiveis.map((ficha) => {
          const lista = porTipo.get(ficha.tipo) ?? [];
          const Icone = ficha.Icone;
          return (
            <button
              key={ficha.tipo}
              type="button"
              className={lista.length ? "rel-ficha is-on" : "rel-ficha"}
              disabled={ctx.congelado}
              onClick={() => setEditando({ tipo: ficha.tipo, fato: null })}
            >
              <Icone size={20} aria-hidden="true" />
              <div>
                <strong>{ROTULO_TIPO_FATO[ficha.tipo]}</strong>
                <span>{ficha.oQueEntra}</span>
                <span>
                  Vai para o comitê {comiteDoTipoDeFato(ctx.ciclo.config, ficha.tipo)} · toque para acrescentar
                </span>
              </div>
              <Chip
                texto={lista.length ? `${lista.length} declarado(s)` : "acrescentar"}
                variante={lista.length ? "ok" : undefined}
              />
            </button>
          );
        })}
      </div>

      {fichasVisiveis.length < FICHAS.length ? (
        <button className="plat-linkbtn" onClick={() => setTodasAsFichas(true)}>
          Ver todas as 9 fichas (algumas ficam ocultas por perfil do laboratório)
        </button>
      ) : null}

      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}

      <h3>Já declarado</h3>
      {meus.length === 0 ? (
        <p className="plat-empty">
          Nada declarado ainda. Toque numa ficha acima para começar. Cada item leva menos de um minuto.
        </p>
      ) : (
        <ul className="plat-list">
          {TIPOS_FATO.filter((t) => porTipo.has(t)).map((t) => (
            <li key={t}>
              <h4>{ROTULO_TIPO_FATO[t]}</h4>
              <ul className="plat-list">
                {(porTipo.get(t) ?? []).map((f) => (
                  <li key={f.id} className={f.periodo_situacao === "no_periodo" ? "rel-item" : "rel-item is-fora"}>
                    <p className="rel-item-titulo">{f.titulo}</p>
                    <p className="rel-item-meta">{resumoDoFato(f)}</p>
                    <p className="rel-item-meta">
                      {f.periodo_situacao !== "no_periodo" ? (
                        <Chip texto={MENSAGEM_PERIODO_SITUACAO[f.periodo_situacao]} fora />
                      ) : null}
                      {f.status === "duplicado_de" ? <Chip texto="fundido com outro" variante="aviso" /> : null}
                      <Chip texto={`${participantesDe(f.id).length} participante(s)`} />
                      {f.eets.map((e) => (
                        <Chip key={e} texto={e} variante="eet" />
                      ))}
                    </p>
                    <button
                      className="button plat-ghost"
                      disabled={ctx.congelado}
                      onClick={() => setEditando({ tipo: f.tipo, fato: f })}
                    >
                      <Pencil size={15} aria-hidden="true" /> Ajustar este item
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="rel-saida">
        <p>
          Não houve fato coletivo neste ciclo? Tudo bem: nenhuma meta vence no 1º ano. Você ainda pode responder a
          governança, que é o que o CNPq pergunta ao líder.
        </p>
        <button onClick={aoPular}>
          Neste ciclo o laboratório não teve fatos coletivos a declarar
        </button>
      </div>

      {meus.some((f) => f.status === "duplicado_de") ? (
        <p className="plat-hint rel-dica">{TEXTO.fusao}</p>
      ) : null}

      <p className="plat-hint rel-dica">
        <Info size={14} aria-hidden="true" /> Item confirmado se ajusta, não se apaga: o histórico é a prova de quem
        declarou o quê, e o banco só permite excluir proposta ou item rejeitado. Isso fica na tela “Fila de
        propostas”.
      </p>
    </div>
  );
}

// =========================================================== EDITOR DE FATO ==

function EditorDeFato({
  ctx,
  tipo,
  fato,
  participantesDoFato,
  gravando,
  erro,
  aoCancelar,
  aoSalvar,
}: {
  ctx: Contexto;
  tipo: TipoFato;
  fato: Fato | null;
  participantesDoFato: string[];
  gravando: boolean;
  erro: string;
  aoCancelar: () => void;
  aoSalvar: (r: Rascunho) => void;
}) {
  const [r, setR] = useState<Rascunho>(() =>
    fato ? rascunhoDoFato(fato, ctx.lab, participantesDoFato) : rascunhoVazio(tipo, ctx.lab),
  );
  const [tentou, setTentou] = useState(false);

  const set = <K extends keyof Rascunho>(chave: K, valor: Rascunho[K]) => setR((v) => ({ ...v, [chave]: valor }));

  const validacaoTitulo = validarTitulo(r.titulo);
  const avaliacao = avaliarData(r.ocorridoEm, { inicio: ctx.ciclo.periodo_inicio, fim: ctx.ciclo.periodo_fim });
  const validacaoRor = validarRor(r.rorId);
  const erroTitulo = tentou && !validacaoTitulo.ok ? validacaoTitulo.mensagem : "";
  const erroData = tentou && !avaliacao.aceita ? avaliacao.mensagem : "";
  const erroRor = tipo === "parceria" && tentou && (!r.rorId || !validacaoRor.ok) ? validacaoRor.mensagem : "";

  const podeSalvar = validacaoTitulo.ok && avaliacao.aceita && r.ocorridoEm && (tipo !== "parceria" || validacaoRor.ok);

  const enviar = () => {
    setTentou(true);
    if (!podeSalvar) return;
    aoSalvar({ ...r, titulo: r.titulo.trim(), rorId: validacaoRor.valor });
  };

  const eets = eetsDoCiclo(ctx.ciclo.config);
  const bolsas = bolsasDoCiclo(ctx.ciclo.config);

  return (
    <div className="plat-card rel-tela">
      <div className="rel-cabeca">
        <h2>{ROTULO_TIPO_FATO[tipo]}</h2>
        <p className="plat-muted">
          Vai para o comitê <strong>{comiteDoTipoDeFato(ctx.ciclo.config, tipo)}</strong>. Você declara uma vez; os
          membros marcam participação.
        </p>
      </div>

      <fieldset className="plat-fields">
        <legend>O quê e quando</legend>
        <Texto
          id="fato-titulo"
          rotulo="Em uma linha, o que foi"
          valor={r.titulo}
          aoMudar={(v) => set("titulo", v)}
          maxLength={LIMITES.tituloMax}
          erro={erroTitulo}
          dica="De 3 a 140 caracteres. É este texto que os membros vão reconhecer na lista deles."
        />

        <fieldset className="plat-fields rel-campo">
          <legend>Precisão da data</legend>
          <label className="rel-escolha" htmlFor="precisao-dia">
            <input
              id="precisao-dia"
              type="radio"
              name="precisao"
              checked={r.precisao === "dia"}
              onChange={() => set("precisao", "dia")}
            />
            <span>Sei o dia</span>
          </label>
          <label className="rel-escolha" htmlFor="precisao-mes">
            <input
              id="precisao-mes"
              type="radio"
              name="precisao"
              checked={r.precisao === "mes"}
              onChange={() => set("precisao", "mes")}
            />
            <span>Só lembro o mês</span>
          </label>
        </fieldset>

        {r.precisao === "dia" ? (
          <Texto
            id="fato-data"
            rotulo="Quando aconteceu"
            tipo="date"
            valor={r.ocorridoEm}
            aoMudar={(v) => set("ocorridoEm", v)}
            erro={erroData}
            dica={avaliacao.situacao !== "no_periodo" && r.ocorridoEm ? avaliacao.mensagem : undefined}
          />
        ) : (
          <Texto
            id="fato-mes"
            rotulo="Mês em que aconteceu"
            tipo="month"
            valor={r.ocorridoEm ? r.ocorridoEm.slice(0, 7) : ""}
            aoMudar={(v) => {
              const [ano, mes] = v.split("-").map(Number);
              set("ocorridoEm", ano && mes ? dataDoMes(ano, mes) : "");
            }}
            erro={erroData}
            dica={
              avaliacao.situacao !== "no_periodo" && r.ocorridoEm
                ? avaliacao.mensagem
                : "Fato com precisão de mês entra como dia 1: é assim que o relatório conta."
            }
          />
        )}

        {r.ocorridoEm && avaliacao.aceita && avaliacao.situacao !== "no_periodo" ? (
          <p className="plat-hint rel-dica">
            <TriangleAlert size={14} aria-hidden="true" /> {avaliacao.mensagem} O item fica guardado com a data
            verdadeira: não apague nem “ajuste” a data para caber na janela.
          </p>
        ) : null}
      </fieldset>

      <CamposDoTipo ctx={ctx} r={r} set={set} erroRor={erroRor} bolsas={bolsas} />

      <ParticipantesDoFato ctx={ctx} escolhidos={r.participantes} aoAlternar={(uid) => set("participantes", r.participantes.includes(uid) ? r.participantes.filter((x) => x !== uid) : [...r.participantes, uid])} />

      <details className="rel-dica">
        <summary>Classificação (opcional, já vem do laboratório)</summary>
        <p className="plat-hint rel-dica">
          As EETs e os objetivos vêm do cadastro do {ctx.lab.sigla}. Só mexa se este item específico for de outra
          etapa: nada aqui é obrigatório, e nada aqui é decorativo.
        </p>
        {eets.length ? (
          <Caixas
            legenda="Etapas estratégicas (EET)"
            nomeId="fato-eets"
            opcoes={eets.map((e) => [e.codigo, `${e.codigo}: ${e.titulo.slice(0, 90)}${e.titulo.length > 90 ? "…" : ""}`] as const)}
            marcadas={r.eets}
            aoAlternar={(v) => set("eets", r.eets.includes(v) ? r.eets.filter((x) => x !== v) : [...r.eets, v])}
          />
        ) : (
          /* Classe 4 da auditoria: superfície que depende da semente do config.
             Sumir sem palavra esconderia que a classificação existe. */
          <p className="plat-empty">
            As etapas estratégicas (EETs) deste ciclo ainda não foram semeadas na configuração; o item pode ser salvo
            sem classificação e nada se perde.
          </p>
        )}
        <ObjetivosDoItem
          ctx={ctx}
          escolhidos={r.objetivos}
          aoAlternar={(n) =>
            set("objetivos", r.objetivos.includes(n) ? r.objetivos.filter((x) => x !== n) : [...r.objetivos, n])
          }
        />
      </details>

      {fato ? <AnexosDoFato ctx={ctx} fatoId={fato.id} /> : (
        <p className="plat-hint rel-dica">
          <Paperclip size={14} aria-hidden="true" /> Comprovante e foto ficam disponíveis depois de salvar este item.
        </p>
      )}

      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}

      <div className="plat-nav rel-nav">
        <button className="button plat-ghost" onClick={aoCancelar}>
          <X size={16} aria-hidden="true" /> Cancelar
        </button>
        <button className="button primary" onClick={enviar} disabled={gravando || ctx.congelado}>
          {gravando ? (
            <>
              Salvando… <Loader2 size={16} aria-hidden="true" />
            </>
          ) : (
            <>
              {fato ? "Salvar alterações" : "Adicionar à lista do laboratório"} <Plus size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** Os campos específicos de cada um dos 9 tipos (§2.4). */
function CamposDoTipo({
  ctx,
  r,
  set,
  erroRor,
  bolsas,
}: {
  ctx: Contexto;
  r: Rascunho;
  set: <K extends keyof Rascunho>(chave: K, valor: Rascunho[K]) => void;
  erroRor: string;
  bolsas: ReturnType<typeof bolsasDoCiclo>;
}) {
  const [veiculosSugeridos, setVeiculosSugeridos] = useState<string[]>(() => veiculosDeDivulgacao(ctx.ciclo.config));
  const [novoVeiculo, setNovoVeiculo] = useState("");

  // A lista literal do CNPq não existe em fonte conferida: enquanto a
  // coordenação não a colocar no config, oferecemos as ações do plano de
  // divulgação da própria proposta como sugestão, mais campo livre.
  useEffect(() => {
    if (r.tipo !== "acao_sociedade" || veiculosSugeridos.length) return;
    let cancelado = false;
    carregarProposta()
      .then((p) => {
        if (!cancelado) setVeiculosSugeridos(p.planoDivulgacao.acoes);
      })
      .catch(() => {
        /* sem sugestão: o campo livre continua funcionando */
      });
    return () => {
      cancelado = true;
    };
  }, [r.tipo, veiculosSugeridos.length]);

  switch (r.tipo) {
    case "expedicao":
      return (
        <fieldset className="plat-fields">
          <legend>A expedição</legend>
          <p className="rel-dica rel-dica--privacidade">
            <ShieldCheck size={14} aria-hidden="true" /> {TEXTO.privacidadeComunidade}
          </p>
          <Texto id="exp-municipio-nome" rotulo="Município" valor={r.municipioNome} aoMudar={(v) => set("municipioNome", v)} />
          <Texto
            id="exp-municipio"
            rotulo="Código IBGE do município"
            valor={r.municipio}
            aoMudar={(v) => set("municipio", v.replace(/\D/g, "").slice(0, 7))}
            inputMode="numeric"
            opcional
            dica="7 dígitos. É o código que faz o município virar ponto no mapa e linha na tabela do CNPq."
          />
          <Texto id="exp-uf" rotulo="UF" valor={r.uf} aoMudar={(v) => set("uf", v.toUpperCase().slice(0, 2))} maxLength={2} />
          <Texto
            id="exp-comunidade"
            rotulo="Comunidade visitada"
            valor={r.comunidade}
            aoMudar={(v) => set("comunidade", v)}
            opcional
            dica="O nome da COMUNIDADE, nunca o de uma pessoa."
          />
          <Texto id="exp-dias" rotulo="Dias em campo" tipo="number" inputMode="numeric" valor={r.dias} aoMudar={(v) => set("dias", v)} />
          <Texto
            id="exp-pessoas"
            rotulo="Pessoas na equipe"
            tipo="number"
            inputMode="numeric"
            valor={r.pessoasEquipe}
            aoMudar={(v) => set("pessoasEquipe", v)}
            dica="Estimativa. Sai do relatório com a palavra “aproximadamente”."
          />
          <Texto
            id="exp-autorizacao"
            rotulo="Número da autorização"
            valor={r.autorizacao}
            aoMudar={(v) => set("autorizacao", v)}
            opcional
            dica="CEP/CONEP, SISBIO, SISGEN ou CGEN: o número do parecer, não o conteúdo dele."
          />
        </fieldset>
      );

    case "acao_sociedade":
      return (
        <fieldset className="plat-fields">
          <legend>A ação junto à sociedade</legend>
          {veiculosSugeridos.length ? (
            <Caixas
              legenda="Veículo"
              nomeId="acao-veiculo"
              dica="Sugestões do plano de divulgação da proposta. Se o seu não estiver aqui, escreva abaixo."
              opcoes={veiculosSugeridos.map((v) => [v, v] as const)}
              marcadas={r.veiculo}
              aoAlternar={(v) => set("veiculo", r.veiculo.includes(v) ? r.veiculo.filter((x) => x !== v) : [...r.veiculo, v])}
            />
          ) : null}
          <div className="rel-campo">
            <Rotulo id="acao-veiculo-livre" rotulo="Outro veículo" opcional />
            <input
              id="acao-veiculo-livre"
              value={novoVeiculo}
              onChange={(e) => setNovoVeiculo(e.target.value)}
              aria-describedby="acao-veiculo-livre-dica"
            />
            <small className="rel-dica" id="acao-veiculo-livre-dica">
              Escreva e toque em acrescentar. Já acrescentados: {r.veiculo.join(", ") || "nenhum"}.
            </small>
            <button
              type="button"
              className="plat-linkbtn"
              onClick={() => {
                const v = novoVeiculo.trim();
                if (!v || r.veiculo.includes(v)) return;
                set("veiculo", [...r.veiculo, v]);
                setNovoVeiculo("");
              }}
            >
              <Plus size={14} aria-hidden="true" /> Acrescentar veículo
            </button>
          </div>
          <Caixas
            legenda="Público-alvo"
            nomeId="acao-publico"
            opcoes={(Object.keys(ROTULO_PUBLICO_ALVO) as PublicoAlvo[]).map((k) => [k, ROTULO_PUBLICO_ALVO[k]] as const)}
            marcadas={r.publicoAlvo}
            aoAlternar={(v) =>
              set("publicoAlvo", r.publicoAlvo.includes(v) ? r.publicoAlvo.filter((x) => x !== v) : [...r.publicoAlvo, v])
            }
          />
          <Texto
            id="acao-pessoas"
            rotulo="Pessoas alcançadas"
            tipo="number"
            inputMode="numeric"
            valor={r.pessoasAlcancadas}
            aoMudar={(v) => set("pessoasAlcancadas", v)}
            dica="Estimativa: o relatório publica este número com a palavra “aproximadamente”. Não invente precisão."
          />
          <Texto id="acao-url" rotulo="Link da atividade" tipo="url" inputMode="url" valor={r.url} aoMudar={(v) => set("url", v)} opcional />
          <Texto id="acao-municipio-nome" rotulo="Município" valor={r.municipioNome} aoMudar={(v) => set("municipioNome", v)} opcional />
          <Texto
            id="acao-municipio"
            rotulo="Código IBGE do município"
            valor={r.municipio}
            aoMudar={(v) => set("municipio", v.replace(/\D/g, "").slice(0, 7))}
            inputMode="numeric"
            opcional
          />
        </fieldset>
      );

    case "parceria":
      return (
        <fieldset className="plat-fields">
          <legend>A instituição parceira</legend>
          <p className="plat-hint rel-dica">
            <Info size={14} aria-hidden="true" /> A contagem de instituições e de países da rede (Indicador nº 3) sai
            daqui, do identificador ROR. Por isso a instituição é <strong>escolhida na busca</strong>, nunca digitada.
          </p>
          <BuscaDeInstituicao
            rorAtual={r.rorId}
            nomeAtual={r.instituicaoNome}
            erro={erroRor}
            aoEscolher={(c) => {
              set("rorId", c.rorId);
              set("instituicaoNome", c.nome);
              set("paisIso2", c.pais ?? "");
            }}
          />
          <Selecao
            id="parc-natureza"
            rotulo="Natureza da parceria"
            valor={r.natureza}
            aoMudar={(v) => set("natureza", v)}
            opcoes={(Object.keys(ROTULO_NATUREZA) as NaturezaParceria[]).map((k) => [k, ROTULO_NATUREZA[k]] as const)}
          />
          <Area
            id="parc-objetivo"
            rotulo="Objetivo da parceria, em poucas linhas"
            valor={r.objetivoResumido}
            aoMudar={(v) => set("objetivoResumido", v)}
            maximo={LIMITES.narrativaMax}
            opcional
          />
        </fieldset>
      );

    case "formacao":
      return (
        <fieldset className="plat-fields">
          <legend>A formação</legend>
          <p className="plat-hint rel-dica">
            <Info size={14} aria-hidden="true" /> Quem declara é o(a) orientador(a), aqui, uma vez. É assim que
            orientador e orientando não viram duas formações na Tabela B.
          </p>
          <Texto id="form-nome" rotulo="Nome do(a) estudante" valor={r.nome} aoMudar={(v) => set("nome", v)} autoComplete="off" />
          <Selecao
            id="form-nivel"
            rotulo="Nível"
            valor={r.nivel}
            aoMudar={(v) => set("nivel", v)}
            opcoes={(Object.keys(ROTULO_NIVEL) as NivelFormacao[]).map((k) => [k, ROTULO_NIVEL[k]] as const)}
          />
          <Selecao
            id="form-situacao"
            rotulo="Situação"
            valor={r.situacaoFormacao}
            aoMudar={(v) => set("situacaoFormacao", v)}
            opcoes={(Object.keys(ROTULO_SITUACAO_FORMACAO) as SituacaoFormacao[]).map(
              (k) => [k, ROTULO_SITUACAO_FORMACAO[k]] as const,
            )}
          />
          <Texto id="form-defesa" rotulo="Data da defesa" tipo="date" valor={r.dataDefesa} aoMudar={(v) => set("dataDefesa", v)} opcional />
          <Texto id="form-ppg" rotulo="Código CAPES do PPG" valor={r.codigoPpgCapes} aoMudar={(v) => set("codigoPpgCapes", v)} opcional />
          <Texto id="form-titulo-trabalho" rotulo="Título do trabalho" valor={r.tituloTrabalho} aoMudar={(v) => set("tituloTrabalho", v)} opcional />
          <Texto id="form-uf" rotulo="UF da instituição" valor={r.uf} aoMudar={(v) => set("uf", v.toUpperCase().slice(0, 2))} maxLength={2} opcional />
          <Texto
            id="form-egresso"
            rotulo="Situação atual do(a) egresso(a)"
            valor={r.situacaoAtualEgresso}
            aoMudar={(v) => set("situacaoAtualEgresso", v)}
            opcional
            dica="Onde está hoje. É o campo impossível de reconstituir depois, por isso se coleta já no 1º ano, mesmo sendo raro."
          />
        </fieldset>
      );

    case "bolsista":
      return (
        <fieldset className="plat-fields">
          <legend>A bolsa</legend>
          <Selecao
            id="bolsa-modalidade"
            rotulo="Modalidade"
            valor={r.modalidade}
            aoMudar={(v) => set("modalidade", v)}
            opcoes={bolsas.map((b) => [b.sigla, `${b.sigla}: ${b.modalidade}`] as const)}
            dica={bolsas.length ? undefined : "As modalidades ainda não foram cadastradas no ciclo; escreva a sigla no título do item."}
          />
          <Selecao
            id="bolsa-situacao"
            rotulo="Situação"
            valor={r.situacaoBolsa}
            aoMudar={(v) => set("situacaoBolsa", v)}
            opcoes={(Object.keys(ROTULO_SITUACAO_BOLSA) as SituacaoBolsa[]).map((k) => [k, ROTULO_SITUACAO_BOLSA[k]] as const)}
          />
          <Texto id="bolsa-inicio" rotulo="Início" tipo="date" valor={r.inicio} aoMudar={(v) => set("inicio", v)} />
          <Texto id="bolsa-fim" rotulo="Fim" tipo="date" valor={r.fim} aoMudar={(v) => set("fim", v)} opcional />
          <Selecao
            id="bolsa-orientador"
            rotulo="Orientador(a)"
            valor={r.orientadorId}
            aoMudar={(v) => set("orientadorId", v)}
            opcoes={ctx.equipe.map((m) => [m.id, m.nome] as const)}
            dica="Escolhido da equipe do laboratório, nunca digitado."
          />
          <Area
            id="bolsa-avaliacao"
            rotulo="Avaliação do desempenho"
            valor={r.avaliacaoDesempenho}
            aoMudar={(v) => set("avaliacaoDesempenho", v)}
            maximo={300}
            opcional
            dica="Manual PICC 5.7.2.2."
          />
        </fieldset>
      );

    case "acervo":
      return (
        <fieldset className="plat-fields">
          <legend>O que entrou na coleção</legend>
          <Texto id="acervo-sigla" rotulo="Sigla da coleção" valor={r.siglaColecao} aoMudar={(v) => set("siglaColecao", v)} />
          <Area
            id="acervo-o-que"
            rotulo="O que foi incorporado"
            valor={r.oQueFoiIncorporado}
            aoMudar={(v) => set("oQueFoiIncorporado", v)}
            maximo={LIMITES.narrativaMax}
          />
          <Texto
            id="acervo-registros"
            rotulo="Número de registros"
            tipo="number"
            inputMode="numeric"
            valor={r.registros}
            aoMudar={(v) => set("registros", v)}
            dica="É a soma destes números que responde ao Indicador nº 4."
          />
          <Texto id="acervo-tombo" rotulo="Faixa de tombo" valor={r.faixaTombo} aoMudar={(v) => set("faixaTombo", v)} opcional />
          <Texto id="acervo-sisgen" rotulo="Número SISGEN" valor={r.sisgen} aoMudar={(v) => set("sisgen", v)} opcional />
        </fieldset>
      );

    case "dado_software":
      return (
        <fieldset className="plat-fields">
          <legend>O dado ou software publicado</legend>
          <Texto id="dado-nome" rotulo="Nome" valor={r.nomeDado} aoMudar={(v) => set("nomeDado", v)} />
          <Texto
            id="dado-doi"
            rotulo="DOI ou URL"
            tipo="url"
            inputMode="url"
            valor={r.doiOuUrl}
            aoMudar={(v) => set("doiOuUrl", v)}
            dica="Sem identificador, o item existe mas não é verificável em auditoria."
          />
          <Texto id="dado-repo" rotulo="Repositório" valor={r.repositorio} aoMudar={(v) => set("repositorio", v)} opcional />
        </fieldset>
      );

    case "infraestrutura":
      return (
        <fieldset className="plat-fields">
          <legend>A infraestrutura instalada</legend>
          <Texto id="infra-o-que" rotulo="O quê" valor={r.oQue} aoMudar={(v) => set("oQue", v)} />
          <Texto id="infra-onde" rotulo="Onde foi instalada" valor={r.ondeInstalada} aoMudar={(v) => set("ondeInstalada", v)} />
          <label className="rel-escolha" htmlFor="infra-multi">
            <input
              id="infra-multi"
              type="checkbox"
              checked={r.multiusuaria}
              onChange={(e) => set("multiusuaria", e.target.checked)}
            />
            <span>É multiusuária</span>
          </label>
        </fieldset>
      );

    case "politica_publica":
      return (
        <fieldset className="plat-fields">
          <legend>A política pública</legend>
          <Texto
            id="pol-instrumento"
            rotulo="Instrumento"
            valor={r.instrumento}
            aoMudar={(v) => set("instrumento", v)}
            dica="Minuta, nota técnica, diretriz, projeto de lei, audiência…"
          />
          <Texto id="pol-orgao" rotulo="Órgão" valor={r.orgao} aoMudar={(v) => set("orgao", v)} />
          <Texto id="pol-situacao" rotulo="Situação" valor={r.situacaoPolitica} aoMudar={(v) => set("situacaoPolitica", v)} />
        </fieldset>
      );
  }
}

/** Participantes: ESCOLHIDOS da equipe, nunca digitados. */
function ParticipantesDoFato({
  ctx,
  escolhidos,
  aoAlternar,
}: {
  ctx: Contexto;
  escolhidos: string[];
  aoAlternar: (userId: string) => void;
}) {
  const comConta = ctx.equipe.filter((m) => m.user_id);
  const semConta = ctx.equipe.filter((m) => !m.user_id);
  return (
    <fieldset className="plat-fields">
      <legend>Quem participou</legend>
      <small className="rel-dica">
        Escolha da lista da sua equipe. Uma expedição com cinco pessoas continua sendo UMA expedição com cinco
        participantes: é essa a diferença que faz o número da rede fechar.
      </small>
      {comConta.map((m) => (
        <label key={m.id} className="rel-escolha" htmlFor={`part-${m.id}`}>
          <input
            id={`part-${m.id}`}
            type="checkbox"
            checked={m.user_id ? escolhidos.includes(m.user_id) : false}
            onChange={() => m.user_id && aoAlternar(m.user_id)}
          />
          <span>
            {m.nome} <span className="plat-muted">· {ROTULO_PAPEL[m.papel]}</span>
          </span>
        </label>
      ))}
      {comConta.length === 0 ? (
        <p className="plat-empty">
          Ninguém da equipe acessou o sistema ainda. Salve o item assim mesmo: cada pessoa poderá marcar “participei”
          na tela dela assim que entrar.
        </p>
      ) : null}
      {semConta.length ? (
        <small className="rel-dica">
          Ainda sem primeiro acesso, e por isso fora da lista: {semConta.map((m) => m.nome).join("; ")}. Elas próprias
          marcam participação quando entrarem.
        </small>
      ) : null}
    </fieldset>
  );
}

/** Objetivos (1..43), recolhidos e opcionais, com o texto vindo da proposta. */
function ObjetivosDoItem({
  ctx,
  escolhidos,
  aoAlternar,
}: {
  ctx: Contexto;
  escolhidos: number[];
  aoAlternar: (n: number) => void;
}) {
  const [textos, setTextos] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelado = false;
    carregarProposta()
      .then((p) => {
        if (cancelado) return;
        setTextos(new Map(p.objetivosEspecificos.map((o) => [o.numero, o.texto])));
      })
      .catch(() => {
        /* sem a prosa, os números continuam utilizáveis */
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const objetivos = ctx.ciclo.config.objetivos ?? [];
  if (!objetivos.length) {
    // Sem a semente do config o bloco não pode sumir mudo: a pessoa ficaria
    // sem saber que a classificação por objetivo existe (classe 4 da auditoria).
    return (
      <p className="plat-empty">
        Os objetivos específicos deste ciclo ainda não foram semeados na configuração; o item pode ser salvo sem essa
        classificação e nada se perde.
      </p>
    );
  }

  return (
    <fieldset className="plat-fields rel-campo">
      <legend>Objetivos específicos deste item</legend>
      <small className="rel-dica">
        Herdados do laboratório. Quem quiser precisão tem onde dar, e quem não quiser não perde nada: nenhum item é
        recusado por falta de objetivo.
      </small>
      {objetivos.map((o) => {
        const texto = textos.get(o.n);
        return (
          <label key={o.n} className="rel-escolha" htmlFor={`obj-${o.n}`}>
            <input
              id={`obj-${o.n}`}
              type="checkbox"
              checked={escolhidos.includes(o.n)}
              onChange={() => aoAlternar(o.n)}
            />
            <span>
              {o.n}. {texto ? `${texto.slice(0, 110)}${texto.length > 110 ? "…" : ""}` : `objetivo ${o.n}`}{" "}
              <span className="plat-muted">({o.missao})</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Busca no ROR — devolve LISTA, nunca escolhe sozinha. */
function BuscaDeInstituicao({
  rorAtual,
  nomeAtual,
  erro,
  aoEscolher,
}: {
  rorAtual: string;
  nomeAtual: string;
  erro: string;
  aoEscolher: (c: CandidatoRor) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const [candidatos, setCandidatos] = useState<CandidatoRor[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");

  const buscar = async () => {
    setBuscando(true);
    setAviso("");
    try {
      const r = await buscarRor(consulta);
      if (r.ok) {
        setCandidatos(r.candidatos);
        if (!r.candidatos.length) setAviso("Nada encontrado. Tente o nome oficial da instituição, sem sigla.");
      } else {
        setAviso("A busca de instituições não respondeu agora. Tente de novo em instantes.");
      }
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="rel-campo">
      <Rotulo id="ror-busca" rotulo="Instituição parceira" />
      <input
        id="ror-busca"
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        aria-describedby="ror-busca-dica ror-busca-erro"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void buscar();
          }
        }}
      />
      <small className="rel-dica" id="ror-busca-dica">
        {rorAtual ? (
          <>
            Escolhida: <strong>{nomeAtual || rorAtual}</strong> (ROR {rorAtual}).
          </>
        ) : (
          "Digite o nome e toque em buscar. Há instituição da rede sem registro ROR: se a sua não aparecer, avise a coordenação em vez de escolher a parecida."
        )}
      </small>
      {erro ? (
        <small className="plat-error rel-erro" id="ror-busca-erro">
          {erro}
        </small>
      ) : null}
      <button type="button" className="button plat-ghost" onClick={() => void buscar()} disabled={buscando}>
        {buscando ? <Loader2 size={15} aria-hidden="true" /> : <Search size={15} aria-hidden="true" />} Buscar
        instituição
      </button>
      {aviso ? <small className="rel-dica">{aviso}</small> : null}
      {candidatos.length ? (
        <ul className="plat-list">
          {candidatos.slice(0, 8).map((c) => (
            <li key={c.rorId} className="rel-item">
              <div>
                <p className="rel-item-titulo">{c.nome}</p>
                <p className="rel-item-meta">
                  ROR {c.rorId}
                  {c.cidade ? ` · ${c.cidade}` : ""}
                  {c.pais ? ` · ${c.pais}` : ""}
                </p>
              </div>
              <button type="button" className="button plat-ghost rel-escolha" onClick={() => aoEscolher(c)}>
                Escolher
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Comprovante e imagem do fato (o bucket aceita PDF/JPEG/PNG até 1 MB). */
function AnexosDoFato({ ctx, fatoId }: { ctx: Contexto; fatoId: string }) {
  const [arquivos, setArquivos] = useState<RelatoArquivo[]>([]);
  const [erro, setErro] = useState("");
  const [subindo, setSubindo] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      setArquivos(await listarArquivos({ fatoId }));
    } catch (e: unknown) {
      setErro(erroDeRelato(e));
    }
  }, [fatoId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const subir = async (arquivo: File, uso: "comprovante" | "imagem_publicavel") => {
    setSubindo(true);
    setErro("");
    try {
      await enviarArquivo({
        userId: ctx.userId,
        cicloSlug: ctx.ciclo.slug,
        alvo: { fatoId },
        arquivo,
        uso,
        config: ctx.ciclo.config,
      });
      await recarregar();
    } catch (e: unknown) {
      setErro(erroDeRelato(e));
    } finally {
      setSubindo(false);
    }
  };

  return (
    <fieldset className="plat-fields">
      <legend>Comprovante e imagem (opcional)</legend>
      <label className="plat-file rel-campo" htmlFor="anexo-comprovante">
        <span className="plat-file-label">
          <Paperclip size={16} aria-hidden="true" /> Comprovante (PDF, JPEG ou PNG, até 1 MB)
        </span>
        <input
          id="anexo-comprovante"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          disabled={subindo || ctx.congelado}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void subir(f, "comprovante");
          }}
        />
      </label>
      <label className="plat-file rel-campo" htmlFor="anexo-imagem">
        <span className="plat-file-label">
          <Paperclip size={16} aria-hidden="true" /> Imagem publicável
        </span>
        <input
          id="anexo-imagem"
          type="file"
          accept="image/jpeg,image/png"
          disabled={subindo || ctx.congelado}
          aria-describedby="anexo-imagem-dica"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void subir(f, "imagem_publicavel");
          }}
        />
        <small className="rel-dica" id="anexo-imagem-dica">
          {TEXTO.imagem}
        </small>
      </label>
      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}
      {arquivos.length ? (
        <ul className="plat-list">
          {arquivos.map((a) => (
            <li key={a.id} className="rel-item">
              <span className="rel-item-titulo">
                {a.file_name} <span className="plat-muted">· {(a.bytes / 1024).toFixed(0)} KB</span>
              </span>
              <span className="rel-escolhas">
                <button
                  className="plat-linkbtn"
                  onClick={async () => {
                    try {
                      const url = await urlAssinadaDeArquivo(a.storage_path, 300);
                      window.open(url, "_blank", "noopener");
                    } catch (e: unknown) {
                      setErro(erroDeRelato(e));
                    }
                  }}
                >
                  ver
                </button>
                <button
                  className="plat-linkbtn"
                  disabled={ctx.congelado}
                  onClick={async () => {
                    try {
                      await removerArquivo(a);
                      await recarregar();
                    } catch (e: unknown) {
                      setErro(erroDeRelato(e));
                    }
                  }}
                >
                  remover
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

// =========================================================== L3 FILA (§3.2) ==

function TelaFila({
  ctx,
  fila,
  confirmados,
  rejeitados,
  participantes,
  aoRecarregar,
  aoAnunciar,
}: {
  ctx: Contexto;
  fila: Fato[];
  confirmados: Fato[];
  rejeitados: Fato[];
  participantes: FatoParticipante[];
  aoRecarregar: () => Promise<void>;
  aoAnunciar: (t: string) => void;
}) {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [rejeitando, setRejeitando] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [fundindo, setFundindo] = useState<string | null>(null);
  const [alvoFusao, setAlvoFusao] = useState("");

  const nomeDe = (userId: string | null): string => {
    if (!userId) return "alguém da equipe";
    return ctx.equipe.find((m) => m.user_id === userId)?.nome ?? "alguém da equipe";
  };

  const executar = async (id: string, acao: () => Promise<unknown>, mensagem: string) => {
    setOcupado(id);
    setErro("");
    try {
      await acao();
      await aoRecarregar();
      aoAnunciar(mensagem);
    } catch (e: unknown) {
      setErro(erroDeRelato(e));
    } finally {
      setOcupado("");
    }
  };

  return (
    <div className="plat-card rel-tela">
      <div className="rel-cabeca">
        <h2>O que a equipe propôs</h2>
        <p className="plat-muted">
          Cada linha veio da tela de um membro, em “aconteceu algo que não está nesta lista?”. Enquanto estiver aqui,
          não conta em lugar nenhum, e a pessoa está esperando saber o que aconteceu com a proposta dela.
        </p>
      </div>

      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}

      {fila.length === 0 ? (
        <p className="plat-empty">
          <Inbox size={16} aria-hidden="true" /> Nenhuma proposta pendente. Quando um membro propuser um fato, ele
          aparece aqui.
        </p>
      ) : (
        <ul className="rel-fila">
          {fila.map((f) => {
            const doMesmoTipo = confirmados.filter((c) => c.tipo === f.tipo && c.id !== f.id);
            const quantos = participantes.filter((p) => p.fato_id === f.id).length;
            return (
              <li key={f.id}>
                <p className="rel-item-titulo">{f.titulo}</p>
                <p className="rel-item-meta">
                  {ROTULO_TIPO_FATO[f.tipo]} · {resumoDoFato(f)} · proposto por <strong>{nomeDe(f.criado_por)}</strong>
                </p>
                <p className="rel-item-meta">
                  <Chip texto={comiteDoTipoDeFato(ctx.ciclo.config, f.tipo)} variante="comite" />
                  {f.periodo_situacao !== "no_periodo" ? (
                    <Chip texto={ROTULO_PERIODO_SITUACAO[f.periodo_situacao]} fora />
                  ) : null}
                  {quantos ? <Chip texto={`${quantos} participante(s)`} /> : null}
                </p>

                <fieldset className="rel-escolhas">
                  <legend>O que fazer com esta proposta</legend>
                  <button
                    className="rel-escolha rel-escolha--sim"
                    disabled={ocupado === f.id || ctx.congelado}
                    onClick={() => void executar(f.id, () => confirmarFato(f.id), "Proposta confirmada.")}
                  >
                    <CheckCircle2 size={15} aria-hidden="true" /> Confirmar
                  </button>
                  <button
                    className="rel-escolha"
                    aria-pressed={fundindo === f.id}
                    disabled={ctx.congelado || doMesmoTipo.length === 0}
                    onClick={() => {
                      setFundindo(fundindo === f.id ? null : f.id);
                      setAlvoFusao("");
                    }}
                  >
                    <GitMerge size={15} aria-hidden="true" /> Fundir com outro
                  </button>
                  <button
                    className="rel-escolha rel-escolha--nao"
                    aria-pressed={rejeitando === f.id}
                    disabled={ctx.congelado}
                    onClick={() => {
                      setRejeitando(rejeitando === f.id ? null : f.id);
                      setComentario("");
                    }}
                  >
                    <X size={15} aria-hidden="true" /> Rejeitar
                  </button>
                </fieldset>

                {fundindo === f.id ? (
                  <div className="rel-campo">
                    <p className="plat-hint rel-dica">{TEXTO.fusao}</p>
                    <Selecao
                      id={`fusao-${f.id}`}
                      rotulo="Fundir com qual item já confirmado?"
                      valor={alvoFusao}
                      aoMudar={setAlvoFusao}
                      opcoes={doMesmoTipo.map((c) => [c.id, `${c.titulo} (${dataBr(c.ocorrido_em)})`] as const)}
                    />
                    <button
                      className="button primary"
                      disabled={!alvoFusao || ocupado === f.id}
                      onClick={() =>
                        void executar(f.id, () => fundirFato(f.id, alvoFusao), "Itens fundidos: conta uma vez.")
                      }
                    >
                      Confirmar a fusão
                    </button>
                  </div>
                ) : null}

                {rejeitando === f.id ? (
                  <div className="rel-campo">
                    <Area
                      id={`rejeicao-${f.id}`}
                      rotulo="Por que não entra? (volta para quem propôs)"
                      valor={comentario}
                      aoMudar={setComentario}
                      maximo={LIMITES.narrativaMax}
                      dica={TEXTO.rejeicaoVolta}
                    />
                    <button
                      className="button primary"
                      disabled={comentario.trim().length < 3 || ocupado === f.id}
                      onClick={() =>
                        void executar(
                          f.id,
                          () => rejeitarFato(f.id, comentario.trim()),
                          "Proposta rejeitada: o comentário volta para quem propôs.",
                        )
                      }
                    >
                      Enviar a rejeição
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="plat-hint rel-dica">
        <Info size={14} aria-hidden="true" /> Precisa corrigir a proposta antes de confirmar? Confirme e ajuste na tela
        “Fatos do laboratório”. Os campos são os mesmos, e a pessoa que propôs continua registrada como quem criou.
      </p>

      {rejeitados.length ? (
        <>
          <h3>Rejeitadas</h3>
          <p className="plat-muted">
            Quem propôs vê o seu comentário na tela dele e pode corrigir. Só proposta e item rejeitado podem ser
            apagados. O resto é histórico.
          </p>
          <ul className="plat-list">
            {rejeitados.map((f) => (
              <li key={f.id} className="rel-item">
                <p className="rel-item-titulo">{f.titulo}</p>
                <p className="rel-item-meta">
                  {ROTULO_TIPO_FATO[f.tipo]} · {dataBr(f.ocorrido_em)} · proposto por {nomeDe(f.criado_por)}
                </p>
                {f.observacao_revisao ? <p className="rel-item-meta">“{f.observacao_revisao}”</p> : null}
                <div className="rel-escolhas">
                  <button
                    className="rel-escolha rel-escolha--sim"
                    disabled={ocupado === f.id || ctx.congelado}
                    onClick={() =>
                      void executar(f.id, () => confirmarFato(f.id), "Proposta reaproveitada e confirmada.")
                    }
                  >
                    <CheckCircle2 size={15} aria-hidden="true" /> Reconsiderar
                  </button>
                  <button
                    className="rel-escolha"
                    disabled={ocupado === f.id || ctx.congelado}
                    onClick={() => void executar(f.id, () => removerFato(f.id), "Item apagado.")}
                  >
                    <Trash2 size={15} aria-hidden="true" /> Apagar de vez
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

// ==================================================== L4 CONFERÊNCIA (§3.2) ==
/**
 * PROJEÇÃO — as regras desta tela, escritas para poderem ser contestadas.
 *
 * Só entram aqui as correspondências LITERAIS entre o que o sistema conta e o
 * texto do número pactuado. "Expedições científicas realizadas" é contável a
 * partir de fatos `expedicao` confirmados e no período; "estações instaladas"
 * NÃO é, porque `infraestrutura` não distingue estação meteorológica de estação
 * de qualidade do ar sem interpretar texto livre — e interpretar texto livre
 * para alimentar um número que vai ao CNPq é inventar dado.
 *
 * Todo o resto dos 92 pactuados aparece como o que é: fora do alcance da
 * contagem automática, preenchido pela coordenação a partir dos itens. Dizer
 * isso ANTES é requisito da especificação (§7), não cortesia.
 */
type RegraDeProjecao = {
  chave: string;
  meta: number;
  contar: (fatos: Fato[]) => number;
  como: string;
};

const REGRAS_DE_PROJECAO: RegraDeProjecao[] = [
  {
    chave: "M07.1",
    meta: 7,
    como: "expedições confirmadas, com data dentro do período do ciclo",
    contar: (fatos) => fatos.filter((f) => f.tipo === "expedicao").length,
  },
  {
    chave: "M07.2",
    meta: 7,
    como: "comunidades distintas informadas nas expedições",
    contar: (fatos) => {
      const nomes = new Set<string>();
      for (const f of fatos) {
        if (!ehFatoDe(f, "expedicao")) continue;
        const c = f.payload.comunidade?.trim().toLowerCase();
        if (c) nomes.add(c);
      }
      return nomes.size;
    },
  },
  {
    chave: "M23.1",
    meta: 23,
    como: "formações de IC e ICJ marcadas como concluídas no período",
    contar: (fatos) =>
      fatos.filter(
        (f) =>
          ehFatoDe(f, "formacao") &&
          f.payload.situacao === "concluida_no_periodo" &&
          (f.payload.nivel === "ic" || f.payload.nivel === "ic_junior"),
      ).length,
  },
  {
    chave: "M23.2",
    meta: 23,
    como: "mestrados marcados como concluídos no período",
    contar: (fatos) =>
      fatos.filter((f) => ehFatoDe(f, "formacao") && f.payload.situacao === "concluida_no_periodo" && f.payload.nivel === "mestrado")
        .length,
  },
  {
    chave: "M23.3",
    meta: 23,
    como: "doutorados marcados como concluídos no período",
    contar: (fatos) =>
      fatos.filter((f) => ehFatoDe(f, "formacao") && f.payload.situacao === "concluida_no_periodo" && f.payload.nivel === "doutorado")
        .length,
  },
];

function percentualParaNumero(p: string): number | null {
  const n = Number(p.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function TelaConferencia({ ctx, fatos }: { ctx: Contexto; fatos: Fato[] }) {
  const [producao, setProducao] = useState<ProducaoPorTipoLinha[] | null>(null);
  const [fatosView, setFatosView] = useState<FatosPorTipoLinha[] | null>(null);
  const [cobertura, setCobertura] = useState<CoberturaLinha | null>(null);
  const [comTextoPublico, setComTextoPublico] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [p, fv, cob, relatos] = await Promise.all([
          lerProducaoPorTipo(ctx.ciclo.id),
          lerFatosPorTipo(ctx.ciclo.id),
          lerCobertura(ctx.ciclo.id),
          listarRelatosDoLaboratorio(ctx.ciclo.id, ctx.lab.id),
        ]);
        if (cancelado) return;
        setProducao(p);
        setFatosView(fv);
        setCobertura(cob.find((l) => l.laboratorio_id === ctx.lab.id) ?? null);
        // NUNCA renderizamos narrativa de terceiro aqui: só a CONTAGEM de quem
        // já escreveu o parágrafo para não especialistas (Indicador nº 2).
        setComTextoPublico(
          relatos.filter((rel: Relato) => (rel.narrativas?.texto_nao_especialistas ?? "").trim().length > 0).length,
        );
      } catch (e: unknown) {
        if (!cancelado) setErro(erroDeRelato(e));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [ctx.ciclo.id, ctx.lab.id]);

  const noPeriodo = fatos.filter((f) => f.status === "confirmado" && f.periodo_situacao === "no_periodo");
  const fora = fatos.filter((f) => f.periodo_situacao !== "no_periodo" && f.status !== "rejeitado");
  const propostas = fatos.filter((f) => f.status === "proposto");
  const totalProducoes = (producao ?? []).reduce((s, l) => s + l.itens, 0);
  const expedicoes = noPeriodo.filter((f) => f.tipo === "expedicao").length;

  const linhasProjecao = REGRAS_DE_PROJECAO.map((regra) => {
    const pactuado = pactuadoPorChave(ctx.ciclo.config, regra.chave);
    if (!pactuado) return null;
    const meta = metaPorNumero(ctx.ciclo.config, regra.meta);
    const marco2 = meta?.progresso.find((p) => p.prazo.startsWith("2"));
    const base = pactuado.min ?? pactuado.max;
    const pct = marco2 ? percentualParaNumero(marco2.percentual) : null;
    const alvo = base !== null && pct !== null ? Math.round((base * pct) / 100) : null;
    return {
      chave: regra.chave,
      oQue: pactuado.oQue,
      pactuado: textoDoPactuado(pactuado),
      contado: regra.contar(noPeriodo),
      alvo,
      marco: marco2 ? `${marco2.percentual} até o ${marco2.prazo}` : "sem marco declarado",
      como: regra.como,
    };
  }).filter((l): l is NonNullable<typeof l> => l !== null);

  const totalPactuados = todosOsPactuados(ctx.ciclo.config).length;

  /* `null` NÃO é zero: as views começam nulas e, sem esta distinção, todo
     líder via um flash de "nenhuma produção" a cada abertura — e, em falha de
     rede, a afirmação de vazio ficava na tela por baixo do erro do topo.
     Só array [] de verdade ganha as mensagens de vazio. */
  const carregandoContagens = !erro && producao === null;
  const semDados = (vazio: string) =>
    carregandoContagens ? (
      <p className="plat-loading">
        <Loader2 size={16} aria-hidden="true" /> Carregando as contagens…
      </p>
    ) : erro ? (
      <p className="plat-empty">Não conseguimos ler esta contagem agora. O erro está descrito no topo da tela.</p>
    ) : (
      <p className="plat-empty">{vazio}</p>
    );

  return (
    <div className="plat-card rel-tela">
      <div className="rel-cabeca">
        <h2>O que o sistema contou</h2>
        <p className="plat-muted">{avisoDoAno1(ctx.ciclo.config)}</p>
      </div>

      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}

      {ctx.papel === "coordenacao" || ctx.papel === "cges" ? (
        <p className="plat-hint rel-dica">
          <TriangleAlert size={14} aria-hidden="true" /> Você entrou como coordenação: as tabelas abaixo mostram tudo o
          que o seu acesso alcança, que é a rede inteira, não só este laboratório. Para o número por laboratório, use
          o painel de consolidação.
        </p>
      ) : null}

      {/* O total só é AFIRMADO depois que a leitura respondeu: dizer "0
          produções" durante a carga (ou após falha) seria o vazio-por-falha
          vestido de vazio-de-verdade. */}
      {producao ? (
        <p>
          <strong>
            Sua equipe declarou {totalProducoes} produç{totalProducoes === 1 ? "ão" : "ões"} e {expedicoes} expediç
            {expedicoes === 1 ? "ão" : "ões"}
          </strong>{" "}
          no período de {dataBr(ctx.ciclo.periodo_inicio)} a {dataBr(ctx.ciclo.periodo_fim)}. Nada disso foi digitado:
          tudo vem dos itens que a equipe declarou. Você aprova ou aponta, não redigita.
        </p>
      ) : null}

      <h3>Cobertura da equipe</h3>
      {cobertura ? (
        <Rolo>
          <table className="rel-tabela">
            <caption>Sem esta linha, um número baixo é ambíguo entre pouca produção e pouca resposta.</caption>
            <tbody>
              <tr>
                <th scope="row">Convidados</th>
                <td className="num">{cobertura.convidados}</td>
              </tr>
              <tr>
                <th scope="row">Entraram ao menos uma vez</th>
                <td className="num">{cobertura.entraram}</td>
              </tr>
              <tr>
                <th scope="row">Enviaram o relato</th>
                <td className="num">{cobertura.enviaram}</td>
              </tr>
              <tr>
                <th scope="row">Declararam “nada a declarar”</th>
                <td className="num">{cobertura.nada_a_declarar}</td>
              </tr>
              <tr>
                <th scope="row">Silenciosos</th>
                <td className="num">{cobertura.silenciosos}</td>
              </tr>
              <tr>
                <th scope="row">Parágrafos prontos para não especialistas</th>
                <td className="num">{comTextoPublico ?? "sem dados"}</td>
              </tr>
            </tbody>
          </table>
        </Rolo>
      ) : (
        semDados("Cobertura ainda não disponível para este laboratório.")
      )}
      <p className="plat-hint rel-dica">
        <ShieldCheck size={14} aria-hidden="true" /> {TEXTO.dificuldadesDosOutros}
      </p>

      <ContadoresDoForms ctx={ctx} fatos={noPeriodo} />

      <h3>Fatos coletivos confirmados</h3>
      {fatosView && fatosView.length ? (
        <Rolo>
          <table className="rel-tabela">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Comitê</th>
                <th scope="col" className="num">
                  Itens
                </th>
                <th scope="col" className="num">
                  Participações
                </th>
                <th scope="col">Pessoas alcançadas</th>
              </tr>
            </thead>
            <tbody>
              {fatosView.map((l) => (
                <tr key={`${l.tipo}-${l.comite}`}>
                  <th scope="row">{ROTULO_TIPO_FATO[l.tipo]}</th>
                  <td>{l.comite ?? "não informado"}</td>
                  <td className="num">{l.itens}</td>
                  <td className="num">{l.adesoes}</td>
                  <td>{l.pessoas_alcancadas_estimado ? `aproximadamente ${l.pessoas_alcancadas_estimado}` : "não informado"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Rolo>
      ) : (
        semDados("Nenhum fato confirmado com data dentro do período do ciclo.")
      )}

      <h3>Produção da equipe</h3>
      {producao && producao.length ? (
        <Rolo>
          <table className="rel-tabela">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col" className="num">
                  Itens
                </th>
                <th scope="col" className="num">
                  Com identificador resolvido
                </th>
              </tr>
            </thead>
            <tbody>
              {producao.map((l) => (
                <tr key={`${l.tipo}-${l.ambito ?? "?"}`}>
                  <th scope="row">{ROTULO_TIPO_PRODUCAO[l.tipo]}</th>
                  <td className="num">{l.itens}</td>
                  <td className="num">{l.com_ancora_resolvida}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Rolo>
      ) : (
        semDados(
          "Ninguém da equipe declarou produção com data no período ainda. Isso pode ser produção baixa ou resposta " +
            "baixa: a tabela de cobertura acima diz qual.",
        )
      )}

      <div className="rel-projecao">
        <h3>Projeção contra o marco do 2º ano</h3>
        <p className="plat-hint rel-dica">
          <TriangleAlert size={14} aria-hidden="true" /> {TEXTO.projecao}
        </p>
        {linhasProjecao.length ? (
          <>
            {linhasProjecao.map((l) => {
              const pct = l.alvo && l.alvo > 0 ? Math.min(Math.round((l.contado / l.alvo) * 100), 100) : 0;
              return (
                <div key={l.chave}>
                  <div className="rel-projecao-linha">
                    <span className="rel-projecao-rotulo">
                      {l.chave}: {l.oQue}
                    </span>
                    <span className="rel-projecao-trilho" aria-hidden="true">
                      <span className="rel-projecao-preenchida" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="rel-projecao-valor">
                      {l.contado}
                      {l.alvo !== null ? ` de ≈${l.alvo}` : ""}
                    </span>
                  </div>
                  <p className="rel-projecao-nota">
                    Pactuado na rede: {l.pactuado} · marco de {l.marco} · contamos {l.como}.
                  </p>
                </div>
              );
            })}
          </>
        ) : (
          <p className="plat-empty">
            O ciclo ainda não tem os números pactuados semeados na configuração, então não há projeção a exibir.
          </p>
        )}
        <p className="plat-muted">
          Restam {Math.max(totalPactuados - linhasProjecao.length, 0)} das {totalPactuados} quantidades pactuadas que
          nenhum item declarado alcança automaticamente: elas são preenchidas pela coordenação a partir dos itens, e
          por isso a tabela de execução do 1º ano vai aparecer parcialmente vazia. Isso é esperado: nenhuma meta vence
          agora.
        </p>
      </div>

      {(fora.length > 0 || propostas.length > 0) && (
        <>
          <h3>O que não entrou na contagem</h3>
          <ul className="plat-list">
            {propostas.length ? (
              <li className="rel-item">
                <span>
                  {propostas.length} proposta(s) da equipe ainda esperam sua conferência. Enquanto isso, não contam.
                </span>
              </li>
            ) : null}
            {fora.map((f) => (
              <li key={f.id} className="rel-item is-fora">
                <p className="rel-item-titulo">{f.titulo}</p>
                <p className="rel-item-meta">
                  {ROTULO_TIPO_FATO[f.tipo]} · {dataBr(f.ocorrido_em)}
                  <Chip texto={ROTULO_PERIODO_SITUACAO[f.periodo_situacao]} fora />
                </p>
              </li>
            ))}
          </ul>
          <p className="plat-hint rel-dica">
            Estes itens estão guardados com a data verdadeira e entram no próximo relatório. Não corrija a data para
            fazê-los caber: é exatamente esse dado que a auditoria confere.
          </p>
        </>
      )}
    </div>
  );
}

// ====================== CONTADORES DO FORMS DO CTC (Q10 e Q15–19) — em L4 ====
/**
 * As perguntas "nº de estudantes por nível" (Q10) e "RH formados" (Q15–19) do
 * questionário do CTC viram AQUI números somados dos fatos `formacao` e
 * `bolsista` que a equipe já declarou (docs/relato-gforms.md, decisão 10). O
 * líder CONFERE e ajusta — não redigita. A contagem é pura e mora em
 * `narrativa.ts` (`contarEstudantesEFormados`); esta seção só exibe e persiste.
 *
 * O QUE PERSISTE: só a divergência (valor sobreposto + nota), em
 * `relatos.respostas.contadores` do relato de quem preenche — o MESMO relato
 * único que o LLA assina (e, quando a coordenação preenche por um laboratório,
 * vai para o relato dela, como já acontece com a governança). A contagem em si
 * não persiste: é reproduzível a partir dos fatos.
 *
 * POR QUE NÃO USA `PatchRelato` estendido: `api.ts` é do formulário individual
 * (tarefa paralela) e não pôde ganhar a chave `respostas` aqui. `Partial<Relato>`
 * é estruturalmente aceito por `salvarRascunho` — sem cast — e a gravação parte
 * do jsonb INTEIRO relido do banco, sobrescrevendo só `contadores`: perder o
 * `fomento` que a pessoa declarou em #/relatorio-anual destruiria a Q12 dela.
 */

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

function contados(n: number, um: string, muitos: string): string {
  return `${n} ${n === 1 ? um : muitos}`;
}

/** "De onde veio" — a proveniência escrita, linha a linha (requisito da tarefa). */
function origemDeEstudantes(l: LinhaDeContagem<NivelEstudante>): string {
  const partes: string[] = [];
  if (l.deFormacoes) partes.push(contados(l.deFormacoes, "formação em andamento", "formações em andamento"));
  if (l.deBolsas) partes.push(contados(l.deBolsas, "bolsa da quota ativa", "bolsas da quota ativas"));
  return partes.length
    ? `somado de ${partes.join(" + ")} que sua equipe declarou`
    : "nenhum fato declarado neste nível";
}

function origemDeFormados(l: LinhaDeContagem<CategoriaFormado>): string {
  if (!l.contavel) return l.porQueNao ?? "";
  return l.contado
    ? `somado de ${contados(l.contado, "formação concluída no período", "formações concluídas no período")} que sua equipe declarou`
    : "nenhuma formação concluída neste nível";
}

function LinhaDeContador({
  id,
  rotulo,
  contado,
  contavel,
  origem,
  valor,
  nota,
  desabilitado,
  aoMudarValor,
  aoMudarNota,
}: {
  id: string;
  rotulo: string;
  contado: number;
  contavel: boolean;
  origem: string;
  valor: string;
  nota: string;
  desabilitado: boolean;
  aoMudarValor: (v: string) => void;
  aoMudarNota: (v: string) => void;
}) {
  return (
    <tr>
      <th scope="row">{rotulo}</th>
      <td className="num">{contavel ? contado : "não se aplica"}</td>
      <td>{origem}</td>
      <td className="num">
        <input
          id={id}
          type="number"
          min={0}
          inputMode="numeric"
          style={{ width: "5.5rem" }}
          aria-label={`Valor no relatório, ${rotulo}`}
          value={valor}
          disabled={desabilitado}
          onChange={(e) => aoMudarValor(e.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          maxLength={280}
          style={{ minWidth: "14rem" }}
          aria-label={`Nota, ${rotulo}`}
          placeholder="se corrigiu, diga por quê"
          value={nota}
          disabled={desabilitado}
          onChange={(e) => aoMudarNota(e.target.value)}
        />
      </td>
    </tr>
  );
}

function ContadoresDoForms({ ctx, fatos }: { ctx: Contexto; fatos: Fato[] }) {
  // `fatos` já chega no recorte de toda a Conferência: confirmados, no período.
  const contagem = useMemo<ContagemDaEquipe>(() => contarEstudantesEFormados(fatos), [fatos]);

  /**
   * `valores`/`notas` são TEXTO cru por linha (chave "e:IC", "f:MS"…): campo de
   * tela é texto, e derivar o ajuste só na gravação evita o input que "volta
   * sozinho" quando a pessoa apaga para digitar outro número. Linha sem entrada
   * exibe o contado — ausência = concordância, e concordância não persiste.
   */
  const [valores, setValores] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const sujoRef = useRef(false);
  const [sujo, setSujo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [salvoEm, setSalvoEm] = useState("");
  const [erro, setErro] = useState("");

  // Semeia do banco (relido fresco: a carga da tela pode ser de minutos atrás e
  // outra aba pode ter salvo). Nunca por cima do que a pessoa está digitando.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      let cont = ((ctx.relato.respostas ?? {}) as RespostasComContadores).contadores;
      try {
        const fresco = await meuRelato(ctx.ciclo.id, ctx.userId);
        if (fresco && fresco.id === ctx.relato.id) {
          cont = ((fresco.respostas ?? {}) as RespostasComContadores).contadores;
        }
      } catch {
        /* sem rede, a cópia da carga serve de semente */
      }
      if (cancelado || sujoRef.current) return;
      const v: Record<string, string> = {};
      const n: Record<string, string> = {};
      for (const [chave, a] of Object.entries(cont?.estudantes ?? {})) {
        if (!a) continue;
        v[`e:${chave}`] = String(a.valor);
        if (a.nota) n[`e:${chave}`] = a.nota;
      }
      for (const [chave, a] of Object.entries(cont?.formados ?? {})) {
        if (!a) continue;
        v[`f:${chave}`] = String(a.valor);
        if (a.nota) n[`f:${chave}`] = a.nota;
      }
      setValores(v);
      setNotas(n);
    })();
    return () => {
      cancelado = true;
    };
  }, [ctx.ciclo.id, ctx.userId, ctx.relato.id, ctx.relato.respostas]);

  /** Geração da edição: se a pessoa digitar DURANTE uma gravação em voo, o
   *  término da gravação não pode limpar o flag sujo da edição mais nova. */
  const edicao = useRef(0);
  const marcarSujo = () => {
    edicao.current += 1;
    sujoRef.current = true;
    setSujo(true);
  };

  const mudarValor = (chave: string, v: string) => {
    marcarSujo();
    setValores((atual) => ({ ...atual, [chave]: v }));
  };
  const mudarNota = (chave: string, v: string) => {
    marcarSujo();
    setNotas((atual) => ({ ...atual, [chave]: v }));
  };

  /** Texto cru → ajuste. `null` = concorda com o contado e nada persiste. */
  const ajusteDaLinha = (prefixo: "e" | "f", l: { chave: string; contado: number }): AjusteDeContador | null => {
    const bruto = valores[`${prefixo}:${l.chave}`];
    const nota = (notas[`${prefixo}:${l.chave}`] ?? "").trim();
    const digitado = bruto === undefined ? undefined : inteiro(bruto);
    const valor = Math.max(digitado ?? l.contado, 0);
    if (valor === l.contado && !nota) return null;
    return nota ? { valor, nota } : { valor };
  };

  const montarAjustes = (): ContadoresAjustes => {
    const estudantes: Partial<Record<NivelEstudante, AjusteDeContador>> = {};
    for (const l of contagem.estudantes) {
      const a = ajusteDaLinha("e", l);
      if (a) estudantes[l.chave] = a;
    }
    const formados: Partial<Record<CategoriaFormado, AjusteDeContador>> = {};
    for (const l of contagem.formados) {
      const a = ajusteDaLinha("f", l);
      if (a) formados[l.chave] = a;
    }
    return { estudantes, formados };
  };

  const salvar = async () => {
    const geracao = edicao.current;
    setGravando(true);
    setErro("");
    try {
      const contadores = limparAjustes(montarAjustes());
      // Parte do jsonb INTEIRO relido do banco e sobrescreve SÓ `contadores`:
      // é o mesmo contrato de `salvarNarrativas` (o merge parcial que perde o
      // `fomento` de #/relatorio-anual seria destruir a Q12 da pessoa).
      let base: RespostasComContadores = (ctx.relato.respostas ?? {}) as RespostasComContadores;
      try {
        const fresco = await meuRelato(ctx.ciclo.id, ctx.userId);
        if (fresco && fresco.id === ctx.relato.id) base = (fresco.respostas ?? {}) as RespostasComContadores;
      } catch {
        /* melhor gravar sobre a cópia da carga do que não gravar */
      }
      const respostas: RespostasComContadores = { ...base };
      if (contadores) respostas.contadores = contadores;
      else delete respostas.contadores;
      const patch: Partial<Relato> = { respostas };
      await salvarRascunhoDoRelato(ctx.relato.id, patch);
      // Só limpa o sujo se nada mudou durante a gravação: uma tecla no meio
      // do voo mantém o flag e o autosave abaixo grava de novo.
      if (edicao.current === geracao) {
        sujoRef.current = false;
        setSujo(false);
      }
      setSalvoEm(horaAgora());
    } catch (e: unknown) {
      setErro(erroDeRelato(e));
    } finally {
      setGravando(false);
    }
  };

  /* AUTOSAVE — o mesmo contrato do resto do formulário (800 ms após a última
   * tecla). O rodapé fixo promete "salvo automaticamente enquanto você
   * escreve" em TODAS as telas, inclusive nesta: os contadores eram a única
   * exceção, e ajuste digitado + troca de tela perdia a conferência em
   * silêncio. O botão "Salvar" continua para quem quer confirmação imediata.
   */
  const salvarRef = useRef(salvar);
  useEffect(() => {
    salvarRef.current = salvar;
  });
  useEffect(() => {
    if (!sujo || ctx.congelado) return;
    const t = window.setTimeout(() => {
      void salvarRef.current();
    }, 800);
    return () => window.clearTimeout(t);
  }, [valores, notas, sujo, ctx.congelado]);
  // Desmontou (trocou de tela, fechou a seção) com ajuste pendente: grava na
  // saída — é a troca de tela o gatilho real da perda relatada na auditoria.
  useEffect(
    () => () => {
      if (sujoRef.current) void salvarRef.current();
    },
    [],
  );

  return (
    <>
      <h3>Estudantes e pessoal formado (perguntas 10 e 15 a 19 do questionário do CTC)</h3>
      <p className="plat-muted">
        Nenhum destes números foi digitado: cada linha é <strong>somada dos fatos</strong> de formação e de bolsista
        que sua equipe declarou (confirmados, com data no período). Você confere. Se um número não bater com a
        realidade, escreva o valor certo em “no relatório” e o porquê na nota: o sistema guarda a contagem e a sua
        correção, sem apagar nenhuma das duas.
      </p>

      <Rolo>
        <table className="rel-tabela">
          <caption>Estudantes por nível (pergunta 10): você confere e ajusta, não redigita.</caption>
          <thead>
            <tr>
              <th scope="col">Nível</th>
              <th scope="col" className="num">
                Somado dos fatos
              </th>
              <th scope="col">De onde veio</th>
              <th scope="col" className="num">
                No relatório
              </th>
              <th scope="col">Nota</th>
            </tr>
          </thead>
          <tbody>
            {contagem.estudantes.map((l) => (
              <LinhaDeContador
                key={l.chave}
                id={`cont-e-${l.chave}`}
                rotulo={ROTULO_NIVEL_ESTUDANTE[l.chave]}
                contado={l.contado}
                contavel={l.contavel}
                origem={origemDeEstudantes(l)}
                valor={valores[`e:${l.chave}`] ?? String(l.contado)}
                nota={notas[`e:${l.chave}`] ?? ""}
                desabilitado={ctx.congelado}
                aoMudarValor={(v) => mudarValor(`e:${l.chave}`, v)}
                aoMudarNota={(v) => mudarNota(`e:${l.chave}`, v)}
              />
            ))}
          </tbody>
        </table>
      </Rolo>

      <Rolo>
        <table className="rel-tabela">
          <caption>Pessoal formado no período (perguntas 15 a 19): das formações concluídas.</caption>
          <thead>
            <tr>
              <th scope="col">Categoria</th>
              <th scope="col" className="num">
                Somado dos fatos
              </th>
              <th scope="col">De onde veio</th>
              <th scope="col" className="num">
                No relatório
              </th>
              <th scope="col">Nota</th>
            </tr>
          </thead>
          <tbody>
            {contagem.formados.map((l) => (
              <LinhaDeContador
                key={l.chave}
                id={`cont-f-${l.chave}`}
                rotulo={ROTULO_CATEGORIA_FORMADO[l.chave]}
                contado={l.contado}
                contavel={l.contavel}
                origem={origemDeFormados(l)}
                valor={valores[`f:${l.chave}`] ?? (l.contavel ? String(l.contado) : "")}
                nota={notas[`f:${l.chave}`] ?? ""}
                desabilitado={ctx.congelado}
                aoMudarValor={(v) => mudarValor(`f:${l.chave}`, v)}
                aoMudarNota={(v) => mudarNota(`f:${l.chave}`, v)}
              />
            ))}
          </tbody>
        </table>
      </Rolo>

      <p className="plat-hint rel-dica">
        <Info size={14} aria-hidden="true" /> A mesma pessoa pode aparecer numa formação E numa bolsa: o sistema não
        tem como saber que é uma só. Se houver sobreposição, corrija o total na linha e explique na nota.
      </p>
      {contagem.bolsasSemNivel.length ? (
        <p className="plat-hint rel-dica">
          <Info size={14} aria-hidden="true" /> Bolsas ativas fora desta soma por não terem nível de estudante no
          questionário: {contagem.bolsasSemNivel.join(", ")}. Elas continuam contadas nos fatos do laboratório.
        </p>
      ) : null}
      {contagem.formacoesForaDosNiveis > 0 ? (
        <p className="plat-hint rel-dica">
          <Info size={14} aria-hidden="true" />{" "}
          {contados(
            contagem.formacoesForaDosNiveis,
            "formação técnica/comunitária (ou sem nível informado) fica",
            "formações técnicas/comunitárias (ou sem nível informado) ficam",
          )}{" "}
          fora destes níveis do questionário. Continuam contadas nos fatos acima.
        </p>
      ) : null}

      <div className="plat-nav plat-nav--start">
        <button className="button primary" onClick={() => void salvar()} disabled={gravando || ctx.congelado || !sujo}>
          {gravando ? (
            <>
              Salvando… <Loader2 size={16} aria-hidden="true" />
            </>
          ) : (
            <>
              <Save size={16} aria-hidden="true" /> Salvar a conferência dos contadores
            </>
          )}
        </button>
        {salvoEm && !sujo ? <p className="plat-ok">Ajustes salvos às {salvoEm}. Vão no mesmo envio do seu relato.</p> : null}
      </div>
      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}
    </>
  );
}

// ==================================================== L5 GOVERNANÇA (§2.8) ===

function TelaGovernanca({
  ctx,
  narrativas,
  aoMudarNarrativa,
  aoMudarGovernanca,
}: {
  ctx: Contexto;
  narrativas: Narrativas;
  aoMudarNarrativa: <K extends keyof Narrativas>(chave: K, valor: Narrativas[K]) => void;
  aoMudarGovernanca: <K extends keyof Governanca>(chave: K, valor: Governanca[K]) => void;
}) {
  const g = narrativas.governanca ?? {};
  const [copiado, setCopiado] = useState("");
  const max = LIMITES.narrativaLlaMax;

  const copiarTudo = async () => {
    const blocos: Array<[string, string | undefined]> = [
      ["Impacto do INCT no estado da arte", narrativas.impacto_estado_da_arte],
      ["Contribuição para a inovação", narrativas.contribuicao_inovacao],
      ["Contribuição para a formação de recursos humanos", narrativas.contribuicao_formacao_rh],
      ["Contribuição para a difusão do conhecimento", narrativas.contribuicao_difusao],
      ["Justificativa de discrepância (item 12.1.2.c)", narrativas.justificativa_discrepancia],
      ["Mecanismos de interação entre os participantes", g.mecanismos_de_interacao],
      ["Dificuldades encontradas na articulação da rede", g.dificuldades_na_rede],
    ];
    const texto = blocos
      .filter(([, v]) => (v ?? "").trim())
      .map(([t, v]) => `${t}\n${v}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(texto || "(nada preenchido ainda)");
      setCopiado("Texto copiado, com os títulos do PICC. Dá para colar no sistema do CNPq sem reescrever.");
    } catch {
      setCopiado("Não foi possível copiar automaticamente. Selecione o texto nos campos e copie à mão.");
    }
  };

  const erroDe = (v: string | undefined): string => {
    const r: Validacao = validarTextoOpcional(v ?? "", max);
    return r.ok ? "" : r.mensagem;
  };

  return (
    <div className="plat-card rel-tela">
      <div className="rel-cabeca">
        <h2>Governança do laboratório</h2>
        <p className="plat-muted">
          As perguntas abaixo estão com os nomes literais do formulário oficial do CNPq e do PICC 5.7.2. Escreva aqui e
          o texto poderá ser colado no sistema do CNPq em 2027, sem reescrita. Nada é obrigatório no 1º ano.
        </p>
      </div>

      <fieldset className="plat-fields">
        <legend>Alterações no projeto</legend>
        <SimNao
          legenda="Houve alteração dos objetivos e/ou das metas?"
          nomeId="gov-objetivos"
          valor={g.alterou_objetivos_metas}
          aoMudar={(v) => aoMudarGovernanca("alterou_objetivos_metas", v)}
        />
        {g.alterou_objetivos_metas ? (
          <Area
            id="gov-objetivos-detalhe"
            rotulo="Qual alteração, e por quê"
            valor={g.alterou_objetivos_metas_detalhe ?? ""}
            aoMudar={(v) => aoMudarGovernanca("alterou_objetivos_metas_detalhe", v)}
            maximo={max}
            erro={erroDe(g.alterou_objetivos_metas_detalhe)}
          />
        ) : null}

        <SimNao
          legenda="Houve alteração do cronograma?"
          nomeId="gov-cronograma"
          valor={g.alterou_cronograma}
          aoMudar={(v) => aoMudarGovernanca("alterou_cronograma", v)}
        />
        {g.alterou_cronograma ? (
          <Area
            id="gov-cronograma-detalhe"
            rotulo="Qual alteração, e por quê"
            valor={g.alterou_cronograma_detalhe ?? ""}
            aoMudar={(v) => aoMudarGovernanca("alterou_cronograma_detalhe", v)}
            maximo={max}
            erro={erroDe(g.alterou_cronograma_detalhe)}
          />
        ) : null}

        <p className="plat-hint rel-dica">
          <Info size={14} aria-hidden="true" /> A alteração de equipe (inclusões e exclusões) fica na primeira tela,
          junto da lista de pessoas.
        </p>
      </fieldset>

      <fieldset className="plat-fields">
        <legend>Articulação da rede</legend>
        <Area
          id="gov-mecanismos"
          rotulo="Mecanismos de interação entre os participantes do INCT"
          valor={g.mecanismos_de_interacao ?? ""}
          aoMudar={(v) => aoMudarGovernanca("mecanismos_de_interacao", v)}
          maximo={max}
          linhas={6}
          erro={erroDe(g.mecanismos_de_interacao)}
          dica="Reuniões, câmaras técnicas, visitas, coautorias, uso compartilhado de infraestrutura."
        />
        <Area
          id="gov-dificuldades-rede"
          rotulo="Dificuldades encontradas na articulação da rede"
          valor={g.dificuldades_na_rede ?? ""}
          aoMudar={(v) => aoMudarGovernanca("dificuldades_na_rede", v)}
          maximo={max}
          linhas={6}
          erro={erroDe(g.dificuldades_na_rede)}
          dica="Dificuldade relatada agora vira argumento na renovação. Escreva sem rodeios."
        />
      </fieldset>

      <fieldset className="plat-fields">
        <legend>Os quatro campos do PICC (5.7.2)</legend>
        <Area
          id="picc-impacto"
          rotulo="Impacto do INCT no estado da arte"
          valor={narrativas.impacto_estado_da_arte ?? ""}
          aoMudar={(v) => aoMudarNarrativa("impacto_estado_da_arte", v)}
          maximo={max}
          linhas={6}
          opcional
          erro={erroDe(narrativas.impacto_estado_da_arte)}
        />
        <Area
          id="picc-inovacao"
          rotulo="Contribuição para a inovação"
          valor={narrativas.contribuicao_inovacao ?? ""}
          aoMudar={(v) => aoMudarNarrativa("contribuicao_inovacao", v)}
          maximo={max}
          linhas={6}
          opcional
          erro={erroDe(narrativas.contribuicao_inovacao)}
        />
        <Area
          id="picc-rh"
          rotulo="Contribuição para a formação de recursos humanos"
          valor={narrativas.contribuicao_formacao_rh ?? ""}
          aoMudar={(v) => aoMudarNarrativa("contribuicao_formacao_rh", v)}
          maximo={max}
          linhas={6}
          opcional
          erro={erroDe(narrativas.contribuicao_formacao_rh)}
        />
        <Area
          id="picc-difusao"
          rotulo="Contribuição para a difusão do conhecimento"
          valor={narrativas.contribuicao_difusao ?? ""}
          aoMudar={(v) => aoMudarNarrativa("contribuicao_difusao", v)}
          maximo={max}
          linhas={6}
          opcional
          erro={erroDe(narrativas.contribuicao_difusao)}
        />
        <Area
          id="picc-discrepancia"
          rotulo="Justificativa de discrepância entre o previsto e o realizado (item 12.1.2.c)"
          valor={narrativas.justificativa_discrepancia ?? ""}
          aoMudar={(v) => aoMudarNarrativa("justificativa_discrepancia", v)}
          maximo={max}
          linhas={6}
          opcional
          erro={erroDe(narrativas.justificativa_discrepancia)}
          dica="É aqui que se aponta o que a conferência mostrou de diferente do esperado. O sistema conta; você explica."
        />
      </fieldset>

      <div className="plat-nav plat-nav--start">
        <button className="button plat-ghost" onClick={() => void copiarTudo()}>
          <Copy size={16} aria-hidden="true" /> Copiar os textos com os títulos do CNPq
        </button>
      </div>
      {copiado ? <p className="plat-ok">{copiado}</p> : null}
      <p className="plat-muted">
        Laboratório {ctx.lab.sigla} · ciclo {ctx.ciclo.numero} · período {dataBr(ctx.ciclo.periodo_inicio)} a{" "}
        {dataBr(ctx.ciclo.periodo_fim)}.
      </p>
    </div>
  );
}

// ============================================== L6 REVISÃO E ENVIO (§3.2) ====

/** Nome humano do campo no resumo de erros (o link move o foco, §6.1 item 4). */
const ROTULO_PENDENCIA: Record<string, string> = {
  veracidade: "a declaração de veracidade",
  cessao: "a autorização de uso das imagens",
  resultado: "a frase do seu resultado principal",
};

function TelaRevisao({
  ctx,
  fatos,
  narrativas,
  aoMudarNarrativa,
  aoIrPara,
  aoRecarregar,
}: {
  ctx: Contexto;
  fatos: Fato[];
  narrativas: Narrativas;
  aoMudarNarrativa: <K extends keyof Narrativas>(chave: K, valor: Narrativas[K]) => void;
  aoIrPara: (i: number) => void;
  aoRecarregar: () => Promise<void>;
}) {
  const [veracidade, setVeracidade] = useState(ctx.relato.declaracao_veracidade);
  const [cessao, setCessao] = useState(ctx.relato.cessao_imagem);
  const [temImagem, setTemImagem] = useState(false);
  /** A lista de anexos falhou: a pergunta de cessão pode estar faltando. */
  const [avisoAnexos, setAvisoAnexos] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [tentou, setTentou] = useState(false);
  const [enviado, setEnviado] = useState<Relato | null>(
    ctx.relato.status === "rascunho" ? null : ctx.relato,
  );

  useEffect(() => {
    let cancelado = false;
    setAvisoAnexos("");
    listarArquivos({ relatoId: ctx.relato.id })
      .then((as) => {
        if (!cancelado) setTemImagem(as.some((a) => a.uso === "imagem_publicavel"));
      })
      .catch(() => {
        /* A trava do servidor continua valendo (a constraint recusa o envio
           sem cessão) — mas o checkbox sumir sem uma palavra deixava a pessoa
           descobrir só no clique de enviar, como erro tardio. */
        if (!cancelado) {
          setAvisoAnexos(
            "Não conseguimos conferir seus anexos agora. Se você enviou imagem publicável, a autorização de uso " +
              "será pedida na hora do envio.",
          );
        }
      });
    return () => {
      cancelado = true;
    };
  }, [ctx.relato.id]);

  const confirmados = fatos.filter((f) => f.status === "confirmado");
  const propostas = fatos.filter((f) => f.status === "proposto");
  const fora = fatos.filter((f) => f.periodo_situacao !== "no_periodo" && f.status !== "rejeitado");

  /**
   * EXTRAIR-DEPOIS: este campo é o mesmo `resultado_principal` da Tela 4 de
   * `MeuAno.tsx`. Ele aparece AQUI porque o envio é um só: a constraint
   * `relatos_resultado` recusa `status='enviado'` sem ele, e descobrir isso
   * como erro de banco depois de 30 minutos de formulário seria cruel.
   */
  const validacaoResultado = validarResultadoPrincipal(narrativas.resultado_principal ?? "");
  const precisaResultado = !ctx.relato.nada_a_declarar && !validacaoResultado.ok;

  const pendencias = pendenciasDe([
    ["veracidade", validarVeracidade(veracidade)],
    ["cessao", validarCessaoImagem(cessao, temImagem)],
    ...(precisaResultado ? ([["resultado", validacaoResultado]] as const) : []),
  ]);

  const janelaAberta = janelaDeEnvioAberta(ctx.ciclo);

  const enviar = async () => {
    setTentou(true);
    if (pendencias.length) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await enviarRelato(ctx.relato.id, {
        declaracao_veracidade: true,
        cessao_imagem: cessao,
      });
      setEnviado(r);
      await aoRecarregar();
    } catch (e: unknown) {
      setErro(erroDeRelato(e));
    } finally {
      setEnviando(false);
    }
  };

  if (enviado && enviado.status !== "rascunho") {
    return (
      <div className="rel-recibo">
        <CheckCircle2 size={30} aria-hidden="true" />
        <h2>Recebido</h2>
        <p>
          Protocolo <code>{enviado.protocolo ?? "sem protocolo"}</code>
        </p>
        <p>
          A coleta segue aberta: você pode voltar e complementar quando quiser. O que você declarou aqui já está
          visível para os membros do {ctx.lab.sigla} marcarem participação.
        </p>
        <p className="plat-muted">{TEXTO.envioUnico}</p>
        <div className="plat-nav plat-nav--start">
          <a className="button plat-ghost" href={RELATORIO_ANUAL_HREF}>
            Ir para o meu relato individual <ArrowRight size={16} aria-hidden="true" />
          </a>
          <button className="button plat-ghost" onClick={() => setEnviado(null)}>
            Continuar editando
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="plat-card rel-tela rel-revisao">
      <div className="rel-cabeca">
        <h2>Revise e envie</h2>
        <p className="plat-muted">{TEXTO.envioUnico}</p>
      </div>

      {tentou && pendencias.length ? (
        <div className="rel-pendencias" role="alert">
          <strong>Falta isto para enviar:</strong>
          <ul>
            {pendencias.map((p) => (
              <li key={p.campo}>{p.mensagem}</li>
            ))}
          </ul>
          {pendencias.map((p) => (
            <button
              key={`ir-${p.campo}`}
              onClick={() => {
                const alvo = document.getElementById(`campo-${p.campo}`);
                alvo?.focus();
                alvo?.scrollIntoView({ block: "center", behavior: "smooth" });
              }}
            >
              Ir para {ROTULO_PENDENCIA[p.campo] ?? p.campo}
            </button>
          ))}
        </div>
      ) : null}

      <section>
        <h3>O que será enviado</h3>
        <dl>
          <div>
            <dt>Equipe</dt>
            <dd>{ctx.equipe.length} pessoa(s) no laboratório</dd>
          </div>
          <div>
            <dt>Fatos confirmados</dt>
            <dd>
              {confirmados.length} item(ns): é esta a lista que os membros veem para marcar participação
            </dd>
          </div>
          <div>
            <dt>Propostas na fila</dt>
            <dd>{propostas.length} aguardando sua conferência</dd>
          </div>
          <div>
            <dt>Itens fora do período</dt>
            <dd>{fora.length} guardados com a data verdadeira, para o próximo relatório</dd>
          </div>
          <div>
            <dt>Textos do PICC</dt>
            <dd>
              {
                [
                  narrativas.impacto_estado_da_arte,
                  narrativas.contribuicao_inovacao,
                  narrativas.contribuicao_formacao_rh,
                  narrativas.contribuicao_difusao,
                ].filter((t) => (t ?? "").trim()).length
              }{" "}
              de 4 campos preenchidos
            </dd>
          </div>
        </dl>
        <button onClick={() => aoIrPara(0)}>Voltar à equipe</button>
        <button onClick={() => aoIrPara(1)}>Voltar aos fatos</button>
        <button onClick={() => aoIrPara(2)}>Voltar à fila de propostas</button>
        <button onClick={() => aoIrPara(3)}>Voltar à conferência</button>
        <button onClick={() => aoIrPara(4)}>Voltar à governança</button>
      </section>

      {propostas.length ? (
        <p className="plat-hint rel-dica">
          <TriangleAlert size={14} aria-hidden="true" /> {propostas.length} proposta(s) da equipe seguem sem
          conferência. Você pode enviar assim mesmo: elas simplesmente não contam enquanto isso, e quem propôs fica
          sem resposta.
        </p>
      ) : null}

      {precisaResultado ? (
        <fieldset className="plat-fields">
          <legend>Falta uma frase sua</legend>
          <p className="plat-muted">
            O envio é um só, e o relato individual pede uma frase: qual foi seu resultado mais importante neste ciclo.
            Escreva aqui (ou no <a href={RELATORIO_ANUAL_HREF}>Relatório Anual de Atividades</a>, é o mesmo campo).
          </p>
          <Area
            id="campo-resultado"
            rotulo="Em uma frase, qual foi seu resultado mais importante neste ciclo?"
            valor={narrativas.resultado_principal ?? ""}
            aoMudar={(v) => aoMudarNarrativa("resultado_principal", v)}
            maximo={LIMITES.narrativaMax}
            erro={tentou ? validacaoResultado.mensagem : ""}
            dica="De 20 a 600 caracteres. Esta frase pode ir para o relatório de gestores e para a sociedade."
          />
        </fieldset>
      ) : null}

      <section>
        <h3>Declarações</h3>
        <label className="plat-consent rel-campo" htmlFor="campo-veracidade">
          <input
            id="campo-veracidade"
            type="checkbox"
            checked={veracidade}
            onChange={(e) => setVeracidade(e.target.checked)}
          />
          <span>
            Declaro que as informações acima são verdadeiras. Assinar tem consequência administrativa, civil e penal,
            por isso a revisão desta tela existe.
          </span>
        </label>

        {temImagem ? (
          <label className="plat-consent rel-campo" htmlFor="campo-cessao">
            <input id="campo-cessao" type="checkbox" checked={cessao} onChange={(e) => setCessao(e.target.checked)} />
            <span>Autorizo o uso destas imagens pelo INCT-CONEXAO e pelo CNPq em comunicação institucional.</span>
          </label>
        ) : null}
        {avisoAnexos ? (
          <p className="plat-hint rel-dica">
            <Info size={14} aria-hidden="true" /> {avisoAnexos}
          </p>
        ) : null}
      </section>

      {!janelaAberta ? (
        <p className="plat-hint rel-dica">
          <CalendarX2 size={14} aria-hidden="true" /> A janela de envio deste ciclo não está aberta agora. Seu rascunho
          continua salvo, inteiro. Nada se perde. Fale com a coordenação para saber a data.
        </p>
      ) : null}

      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}

      <div className="plat-nav rel-nav">
        <button className="button plat-ghost" onClick={() => aoIrPara(4)}>
          <ArrowLeft size={16} aria-hidden="true" /> Voltar
        </button>
        <button
          className="button primary"
          onClick={() => void enviar()}
          disabled={enviando || ctx.congelado || !janelaAberta}
        >
          {enviando ? (
            <>
              Enviando… <Loader2 size={16} aria-hidden="true" />
            </>
          ) : (
            <>
              Enviar o relato do laboratório <Send size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      <p className="plat-muted">
        <FileCheck2 size={14} aria-hidden="true" /> Enviar não tranca a edição: a coleta segue aberta e você pode
        complementar quando quiser.
      </p>
    </div>
  );
}
