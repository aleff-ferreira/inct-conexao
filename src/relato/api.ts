/**
 * ============================================================================
 *  Camada de dados do Relato Anual — toda conversa com o Supabase
 * ============================================================================
 *  Mesmo desenho de `src/platform/api.ts`: função pequena, tipada, sem estado,
 *  e NENHUMA autorização feita aqui. Quem autoriza é a RLS da migração 005 —
 *  este arquivo é só a boca do banco. Se uma função daqui parecer estar
 *  "checando permissão", ela está errada: a checagem é do servidor, e o que
 *  cabe ao cliente é TRADUZIR a recusa para uma frase que a pessoa entenda.
 *
 *  A DIFERENÇA EM RELAÇÃO AO platform/api.ts, e o porquê
 *  -----------------------------------------------------
 *  Lá, cada função joga `error.message` cru e a tela chama `friendlyError`.
 *  Aqui as funções já lançam a mensagem TRADUZIDA (`erroDeRelato`), porque o
 *  005 tem 9 triggers que levantam exceção com texto próprio e 20 constraints
 *  nomeadas — deixar isso para a tela significa que a primeira tela que
 *  esquecer de traduzir mostra "new row violates row-level security policy" a
 *  um pesquisador sênior no meio do relatório. `erroDeRelato` também está
 *  exportado, e delega ao `friendlyError` no fim: mensagem já em PT-BR passa
 *  por ele sem alteração, então chamar os dois não estraga nada.
 *
 *  O QUE ESTE ARQUIVO NUNCA FAZ
 *  ----------------------------
 *   • Não expõe "quem declarou" a partir de `producoes` (a tabela não tem essa
 *     coluna, de propósito — a checagem de duplicata passa pela RPC
 *     `checar_ancora`, que devolve o título e nunca o nome).
 *   • Não grava `comite`, `ciclo_competencia_id`, `periodo_situacao` nem
 *     `protocolo`: são derivados por trigger. Enviar do cliente é convite a
 *     divergência silenciosa.
 *   • Não pergunta nem grava percentual de meta. Não existe função disso aqui.
 * ============================================================================
 */
import { platformEnabled, supabase } from "../platform/supabaseClient";
import { friendlyError } from "../platform/errors";
import { ehTipoDeProducao, limitesDeAnexo } from "./config";
import type {
  AncoraTipo,
  ChecagemAncora,
  CicloConfig,
  CicloMembro,
  CoberturaLinha,
  Fato,
  FatoParticipante,
  FatoPayload,
  FatosPorTipoLinha,
  Idioma,
  ItemForaDoPeriodo,
  Laboratorio,
  MencionaApoio,
  MetadadosCsl,
  Narrativas,
  OrigemVinculo,
  PapelNoCiclo,
  Producao,
  ProducaoAutor,
  ProducaoPorTipoLinha,
  ProducaoVinculo,
  RedeInstituicaoLinha,
  Relato,
  RelatorioCiclo,
  RelatoArquivo,
  RelatoEvento,
  StatusFato,
  TipoFato,
  TipoProducao,
  UsoArquivo,
} from "./types";

/** Bucket privado criado na seção 14 da 005. */
const BUCKET = "relatos";

/** O mime do .docx (011). O .doc legado (application/msword) NÃO entra. */
export const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Default do teto do .docx quando o config do ciclo ainda não tem
 * `anexos.max_bytes_docx` (config anterior à 011). Mesmo valor da migração.
 */
const MAX_BYTES_DOCX_PADRAO = 10485760;

/** A rota só funciona com a plataforma configurada (mesma checagem do 001). */
export function relatoDisponivel(): boolean {
  return platformEnabled;
}

// ================================================== 1. TRADUÇÃO DE ERROS ====

type FalhaBruta = { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };

function textoCru(e: unknown): string {
  if (!e) return "";
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const f = e as FalhaBruta;
    return [f.message, f.details, f.hint, f.code]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" · ");
  }
  return "";
}

/**
 * Traduz a recusa do Postgres/PostgREST para uma frase que orienta.
 *
 * A ordem importa: os casos do relato vêm ANTES do `friendlyError`, que é da
 * seleção de IC e traduziria "duplicate key" como "sua inscrição já foi
 * registrada" — certo lá, errado aqui.
 */
export function erroDeRelato(e: unknown): string {
  const cru = textoCru(e);
  const m = cru.toLowerCase();
  if (!m) return "Não foi possível concluir. Tente novamente em instantes.";

  // ---- O trigger da 014: envio sem o documento obrigatório da pesquisa.
  // A tela já barra antes; isto cobre quem chegou ao banco por fora dela.
  if (m.includes("documento_obrigatorio")) {
    return "Falta anexar o documento com dados da sua pesquisa — ele é obrigatório. Anexe na tela 2 e envie de novo.";
  }

  // ---- RLS. É a recusa mais comum e a mais assustadora quando vaza crua.
  if (m.includes("row-level security") || m.includes("row level security") || m.includes("42501")) {
    return (
      "Seu acesso não alcança este registro. Em geral é um destes três: você ainda não consta " +
      "na equipe deste ciclo, o ciclo já foi consolidado, ou o item pertence a outro laboratório. " +
      "Se acha que é engano, fale com a coordenação. Ninguém perde o que já escreveu."
    );
  }

  // ---- Chaves únicas, cada uma com seu significado.
  if (m.includes("duplicate key") || m.includes("23505")) {
    if (m.includes("producoes_ancora_unica"))
      return "Este trabalho já está registrado na rede. Confirme a coautoria em vez de cadastrá-lo de novo.";
    if (m.includes("relatos_um_por_ciclo"))
      return "Você já tem um relato neste ciclo. Recarregue a página para continuar de onde parou.";
    if (m.includes("producao_vinculos_unico"))
      return "Esta produção já está no seu relato.";
    if (m.includes("fato_participantes_unico"))
      return "Você já marcou participação neste item.";
    if (m.includes("ciclo_membros_email_unico"))
      return "Este e-mail já está na equipe deste ciclo.";
    if (m.includes("relato_arquivos_storage_path_key") || m.includes("storage_path"))
      return "Já existe um arquivo com esse nome neste item. Renomeie e tente de novo.";
    return "Este registro já existe. Recarregue a página para vê-lo.";
  }

  // ---- Constraints nomeadas: cada uma sabe dizer o que faltou.
  if (m.includes("relatos_resultado"))
    return "Escreva pelo menos uma frase (de 20 a 600 caracteres) sobre seu resultado mais importante, ou marque “não tive produção nem atividade para relatar”.";
  if (m.includes("relatos_veracidade"))
    return "Para enviar é preciso declarar que as informações são verdadeiras.";
  if (m.includes("fatos_sem_futuro")) return "Essa data ainda não chegou.";
  if (m.includes("ciclo_membros_orcid"))
    return "Esse ORCID não está no formato 0000-0000-0000-000X. Confira em orcid.org.";
  if (m.includes("ciclo_membros_lattes")) return "O ID Lattes tem exatamente 16 números.";
  if (m.includes("_ror")) return "O identificador ROR tem o formato 0xxxxxxxx (9 caracteres, sem o https://ror.org/).";
  if (m.includes("producoes_outro"))
    return "Para o tipo “Outro”, descreva em poucas palavras do que se trata.";
  if (m.includes("relato_arquivos_dono"))
    return "O anexo precisa pertencer a um relato ou a um fato, não aos dois.";
  if (m.includes("relato_arquivos_sha")) return "A soma de verificação do arquivo veio inválida. Tente enviar de novo.";
  if (m.includes("fatos_titulo_check") || (m.includes("titulo") && m.includes("char_length")))
    return "O título precisa ter entre 3 e 140 caracteres.";
  if (m.includes("producoes_ancora_valor_check"))
    return "O identificador colado é curto ou longo demais (de 3 a 500 caracteres). Confira o DOI ou o link.";
  if (m.includes("relato_arquivos_bytes_check") || (m.includes("bytes") && m.includes("check")))
    return "O arquivo passa do limite de 1 MB (documento Word .docx: até 10 MB). Reduza e tente de novo.";
  if (m.includes("relato_arquivos_docx_uso"))
    return "Documento Word (.docx) entra só como documento da pesquisa. Para imagem publicável, envie JPEG ou PNG.";
  if (m.includes("23503") || m.includes("foreign key"))
    return "Um dos vínculos aponta para um registro que não existe mais. Recarregue a página e tente de novo.";

  // ---- Exceções dos triggers do 005: já foram escritas em português, para
  // gente. Repassar é melhor do que reescrever com menos precisão.
  if (
    m.includes("fora da janela de envio") ||
    m.includes("já foi consolidado") ||
    m.includes("peça a reabertura") ||
    m.includes("só o(a) líder do laboratório") ||
    m.includes("não muda de laboratório") ||
    m.includes("não pode ser transferida") ||
    m.includes("não muda de ciclo") ||
    m.includes("só a coordenação altera") ||
    m.includes("fale com a coordenação") ||
    m.includes("limite de 12 arquivos") ||
    m.includes("é preciso autorizar o uso das imagens")
  ) {
    const f = e as FalhaBruta;
    return typeof f?.message === "string" ? f.message : cru;
  }
  if (m.includes("sem permissão para consultar este ciclo"))
    return "Você ainda não consta na equipe deste ciclo. Peça à coordenação para incluir seu e-mail.";

  // ---- Sessão.
  if (m.includes("jwt") || m.includes("invalid claim") || m.includes("token is expired"))
    return "Sua sessão expirou. Peça um novo link de entrada. Nada do que você escreveu se perde.";

  // ---- Rede, cache de schema, tamanho de arquivo: o tradutor da plataforma já
  // cobre, e cobre igual. Reaproveitar mantém as duas superfícies coerentes.
  return friendlyError(new Error(cru));
}

function lancar(e: unknown): never {
  throw new Error(erroDeRelato(e));
}

/** Resposta do PostgREST reduzida ao que interessa. */
type Resposta<T> = { data: T | null; error: unknown };

async function um<T>(consulta: PromiseLike<Resposta<T>>): Promise<T | null> {
  const { data, error } = await consulta;
  if (error) lancar(error);
  return data ?? null;
}

async function exigir<T>(consulta: PromiseLike<Resposta<T>>): Promise<T> {
  const linha = await um(consulta);
  if (!linha) throw new Error("O servidor não devolveu o registro gravado. Recarregue a página.");
  return linha;
}

async function muitos<T>(consulta: PromiseLike<Resposta<T[]>>): Promise<T[]> {
  const { data, error } = await consulta;
  if (error) lancar(error);
  return data ?? [];
}

/** Descarta o objeto aninhado usado só como filtro (`!inner`). */
function semEmbutido<T extends object>(linhas: Array<T & Record<string, unknown>>, chave: string): T[] {
  return linhas.map((linha) => {
    const copia = { ...linha } as Record<string, unknown>;
    delete copia[chave];
    return copia as T;
  });
}

// ============================================== 2. CICLO, ROSTER, VÍNCULO ===

/**
 * O ciclo em coleta. Só `status='aberto'` é visível ao membro (policy
 * `ciclos_read`); enquanto a coordenação não abrir, isto devolve `null` e a
 * tela mostra "a coleta ainda não começou" — não um erro.
 */
export async function cicloAberto(): Promise<RelatorioCiclo | null> {
  return um<RelatorioCiclo>(
    supabase()
      .from("relatorio_ciclos")
      .select("*")
      .eq("status", "aberto")
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

export async function cicloPorSlug(slug: string): Promise<RelatorioCiclo | null> {
  return um<RelatorioCiclo>(
    supabase().from("relatorio_ciclos").select("*").eq("slug", slug).maybeSingle(),
  );
}

/** A linha do roster da pessoa logada — o pré-preenchimento inteiro da Tela 1. */
export async function meuVinculo(cicloId: string, userId: string): Promise<CicloMembro | null> {
  return um<CicloMembro>(
    supabase()
      .from("ciclo_membros")
      .select("*")
      .eq("ciclo_id", cicloId)
      .eq("user_id", userId)
      .maybeSingle(),
  );
}

/**
 * Casa a linha do roster que tem o e-mail VERIFICADO desta conta e ainda está
 * sem dono (RPC `vincular_meu_cadastro`, migração 006).
 *
 * POR QUE ELA PRECISA EXISTIR SEPARADA DA REIVINDICAÇÃO
 * `reivindicar_cadastro` grava o e-mail na linha do catálogo; quem casa esse
 * e-mail com o `user_id` é o trigger do primeiro acesso — e ele só dispara em
 * INSERT de `auth.users`. Quem JÁ tinha conta (a maioria: qualquer pessoa que
 * tenha entrado no site antes, ou que tenha participado da seleção de IC) não
 * passa por esse INSERT, e ficaria com a linha preenchida e órfã. Esta função é
 * a outra metade do vínculo, e é idempotente: chamar de novo devolve 0.
 *
 * Nunca lança: se a 006 ainda não rodou, devolve 0 e o chamador segue — o
 * encanamento nosso não pode barrar pesquisador.
 */
export async function vincularMeuCadastro(): Promise<number> {
  if (!relatoDisponivel()) return 0;
  try {
    const { data, error } = await supabase().rpc("vincular_meu_cadastro");
    if (error) return 0;
    const alvo = Array.isArray(data) ? data[0] : data;
    const n = alvo && typeof alvo === "object" ? (alvo as Record<string, unknown>).vinculados : null;
    return typeof n === "number" ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Pré-preenchimento por `#/relatorio-anual?m=<token>` (o alias legado
 * `#/meu-ano?m=<token>` continua valendo).
 * O token NÃO autentica: a RLS continua exigindo que a linha seja sua (o
 * trigger da seção 15 casa `lower(email)` no primeiro acesso). Se a pessoa
 * abrir o link de outra, isto devolve `null` — que é o comportamento certo.
 */
export async function membroPorConvite(cicloId: string, token: string): Promise<CicloMembro | null> {
  return um<CicloMembro>(
    supabase()
      .from("ciclo_membros")
      .select("*")
      .eq("ciclo_id", cicloId)
      .eq("convite_token", token)
      .maybeSingle(),
  );
}

/** RPC `papel_no_ciclo` — o papel é do CICLO, não da pessoa. */
export async function meuPapel(cicloId: string): Promise<PapelNoCiclo | null> {
  const { data, error } = await supabase().rpc("papel_no_ciclo", { p_ciclo: cicloId });
  if (error) lancar(error);
  return typeof data === "string" ? (data as PapelNoCiclo) : null;
}

/** RPC `meu_laboratorio`. */
export async function meuLaboratorioId(cicloId: string): Promise<string | null> {
  const { data, error } = await supabase().rpc("meu_laboratorio", { p_ciclo: cicloId });
  if (error) lancar(error);
  return typeof data === "string" ? data : null;
}

/** RPC `sou_membro_do_ciclo`. */
export async function souMembroDoCiclo(cicloId: string): Promise<boolean> {
  const { data, error } = await supabase().rpc("sou_membro_do_ciclo", { p_ciclo: cicloId });
  if (error) lancar(error);
  return data === true;
}

/** Os 28 Laboratórios Associados, na ordem de exibição. */
export async function listarLaboratorios(cicloId: string): Promise<Laboratorio[]> {
  return muitos<Laboratorio>(
    supabase()
      .from("laboratorios")
      .select("*")
      .eq("ciclo_id", cicloId)
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
  );
}

/** A equipe de um laboratório — a lista de onde os participantes são ESCOLHIDOS. */
export async function listarEquipeDoLaboratorio(
  cicloId: string,
  laboratorioId: string,
): Promise<CicloMembro[]> {
  return muitos<CicloMembro>(
    supabase()
      .from("ciclo_membros")
      .select("*")
      .eq("ciclo_id", cicloId)
      .eq("laboratorio_id", laboratorioId)
      .eq("ativo", true)
      .order("nome", { ascending: true }),
  );
}

/**
 * O que a Tela 1 pode corrigir. `papel`, `email`, `categoria_picc` e `ativo`
 * NÃO estão aqui — o trigger `guard_membro_self` recusa, e é o guarda que
 * impede escalação de privilégio por um PATCH do PostgREST. `laboratorio_id` só
 * passa quando a coluna está vazia; trocar um já preenchido é com a coordenação.
 */
export type PatchMembro = Partial<{
  nome: string;
  orcid: string | null;
  lattes_id: string | null;
  idioma: Idioma;
  instituicao_ror: string | null;
  instituicao_nome: string;
  uf: string | null;
  laboratorio_id: string | null;
}>;

export async function atualizarMeuCadastro(membroId: string, patch: PatchMembro): Promise<CicloMembro> {
  return exigir<CicloMembro>(
    supabase().from("ciclo_membros").update(patch).eq("id", membroId).select().single(),
  );
}

// ========================================================= 3. O RELATO =====

/** O relato da pessoa neste ciclo (um por par ciclo+pessoa). */
export async function meuRelato(cicloId: string, userId: string): Promise<Relato | null> {
  return um<Relato>(
    supabase().from("relatos").select("*").eq("ciclo_id", cicloId).eq("user_id", userId).maybeSingle(),
  );
}

/**
 * Abre (ou recupera) o rascunho. O rascunho é o estado INICIAL e é REAL: a
 * pessoa abre, escreve metade, fecha e volta em três semanas. Nenhum protocolo
 * é queimado aqui — ele nasce só na transição para 'enviado' (seção 9 da 005).
 *
 * A corrida de duas abas abrindo ao mesmo tempo cai no UNIQUE
 * `relatos_um_por_ciclo`; nesse caso, releitura em vez de erro.
 */
export async function abrirRelato(
  cicloId: string,
  userId: string,
  membroId: string | null,
): Promise<Relato> {
  const existente = await meuRelato(cicloId, userId);
  if (existente) return existente;

  const { data, error } = await supabase()
    .from("relatos")
    .insert({ ciclo_id: cicloId, user_id: userId, membro_id: membroId })
    .select()
    .single();
  if (error) {
    const jaExiste = await meuRelato(cicloId, userId);
    if (jaExiste) return jaExiste;
    lancar(error);
  }
  return data as Relato;
}

/** O que o autosave grava. `status` e `protocolo` não entram: são do servidor. */
export type PatchRelato = Partial<{
  nada_a_declarar: boolean;
  narrativas: Narrativas;
  declaracao_veracidade: boolean;
  cessao_imagem: boolean;
}>;

export async function salvarRascunho(relatoId: string, patch: PatchRelato): Promise<Relato> {
  return exigir<Relato>(supabase().from("relatos").update(patch).eq("id", relatoId).select().single());
}

/**
 * Grava o bloco de narrativas INTEIRO (a coluna é um jsonb e o `update`
 * substitui). Quem chama mantém o estado completo em memória — é o mesmo
 * contrato do wizard de inscrição, e evita o merge parcial que perde texto
 * quando duas abas salvam quase juntas.
 */
export async function salvarNarrativas(relatoId: string, narrativas: Narrativas): Promise<Relato> {
  return salvarRascunho(relatoId, { narrativas });
}

/**
 * O envio. O servidor é quem emite o protocolo (`CNX-R1-0001`) e carimba
 * `submitted_at`; o trigger de janela recusa fora de `abre_em..fecha_em` e
 * exige a cessão de imagem quando há imagem publicável anexada.
 * A coleta segue aberta depois: enviar não tranca a edição.
 */
export async function enviarRelato(
  relatoId: string,
  confirmacoes: { declaracao_veracidade: boolean; cessao_imagem?: boolean },
): Promise<Relato> {
  if (!confirmacoes.declaracao_veracidade) {
    throw new Error("Para enviar é preciso declarar que as informações são verdadeiras.");
  }
  return exigir<Relato>(
    supabase()
      .from("relatos")
      .update({
        status: "enviado",
        declaracao_veracidade: true,
        cessao_imagem: confirmacoes.cessao_imagem ?? false,
      })
      .eq("id", relatoId)
      .select()
      .single(),
  );
}

/**
 * Os relatos do laboratório (leitura do LLA e da coordenação — a policy
 * `relatos_read` já limita; aqui só filtramos).
 */
export async function listarRelatosDoLaboratorio(
  cicloId: string,
  laboratorioId: string,
): Promise<Relato[]> {
  const linhas = await muitos<Relato & Record<string, unknown>>(
    supabase()
      .from("relatos")
      .select("*, ciclo_membros!inner(laboratorio_id)")
      .eq("ciclo_id", cicloId)
      .eq("ciclo_membros.laboratorio_id", laboratorioId),
  );
  return semEmbutido(linhas, "ciclo_membros");
}

/** O histórico do próprio relato ("o que eu declarei e quando" é prova da pessoa). */
export async function lerEventosDoRelato(relatoId: string): Promise<RelatoEvento[]> {
  return muitos<RelatoEvento>(
    supabase().from("relato_eventos").select("*").eq("relato_id", relatoId).order("at", { ascending: true }),
  );
}

// ======================================================== 4. PRODUÇÕES =====

/**
 * Espelho CLIENTE da normalização do índice `producoes_ancora_unica`.
 * Serve para comparar e para exibir — NUNCA para gravar: `ancora_valor` guarda
 * o que a pessoa colou, porque é isso que ela reconhece na conferência. A
 * unicidade real é do banco, e é lá que ela tem que continuar.
 */
export function normalizarAncora(tipo: AncoraTipo, valor: string): string {
  const bruto = valor.trim();
  if (tipo === "isbn") return bruto.replace(/[^0-9Xx]/g, "").toLowerCase();
  return bruto.replace(/^\s*(https?:\/\/(dx\.)?doi\.org\/|doi:)\s*/i, "").toLowerCase();
}

function interpretarChecagem(bruto: unknown): ChecagemAncora {
  if (!bruto || typeof bruto !== "object") return { existe: false };
  const o = bruto as Record<string, unknown>;
  if (o.existe !== true || typeof o.producao_id !== "string") return { existe: false };
  const tipo = typeof o.tipo === "string" && ehTipoDeProducao(o.tipo) ? o.tipo : "outro";
  return {
    existe: true,
    producao_id: o.producao_id,
    tipo: tipo as TipoProducao,
    ano: typeof o.ano === "number" ? o.ano : null,
    titulo: typeof o.titulo === "string" ? o.titulo : "",
    ja_declarado_por_membro: o.ja_declarado_por_membro === true,
  };
}

/**
 * RPC `checar_ancora` — o dedupe entre coautores.
 * Devolve se o trabalho já existe e o título; NUNCA o nome de quem declarou. O
 * nome só aparece depois que o segundo confirma a coautoria, e aí vem de
 * `producao_autores`. Não tente descobrir o declarante por outro caminho: a
 * tabela `producoes` não tem essa coluna justamente para isso.
 */
export async function checarAncora(
  cicloId: string,
  tipo: AncoraTipo,
  valor: string,
): Promise<ChecagemAncora> {
  const { data, error } = await supabase().rpc("checar_ancora", {
    p_ciclo: cicloId,
    p_tipo: tipo,
    p_valor: valor,
  });
  if (error) lancar(error);
  return interpretarChecagem(data);
}

/** A produção canônica junto do meu vínculo com ela. */
export type ProducaoDoRelato = { vinculo: ProducaoVinculo; producao: Producao };

export async function listarMinhasProducoes(relatoId: string): Promise<ProducaoDoRelato[]> {
  const linhas = await muitos<ProducaoVinculo & { producoes: Producao }>(
    supabase()
      .from("producao_vinculos")
      .select("*, producoes(*)")
      .eq("relato_id", relatoId)
      .order("confirmado_em", { ascending: true }),
  );
  return linhas
    .filter((l) => Boolean(l.producoes))
    .map(({ producoes, ...vinculo }) => ({ vinculo: vinculo as ProducaoVinculo, producao: producoes }));
}

export type NovoAutor = {
  ordem: number;
  nome: string;
  orcid?: string | null;
  is_membro_rede?: boolean;
  user_id?: string | null;
};

/**
 * Uma produção a declarar. `ambito` NÃO está aqui de propósito: é inferido pelo
 * sistema a partir do país da editora e homologado uma vez pela coordenação
 * (§2.3.1). Perguntar a 209 pessoas produz 209 definições na mesma coluna.
 */
export type NovaProducao = {
  ciclo_id: string;
  relato_id: string;
  ancora_tipo: AncoraTipo;
  /** Como a pessoa colou. A normalização é do banco. */
  ancora_valor: string;
  tipo: TipoProducao;
  /** Obrigatório quando `tipo === "outro"`. */
  outro_descricao?: string;
  /** `true` só quando uma API resolveu de verdade. */
  ancora_resolvida?: boolean;
  ano?: number | null;
  publicado_em?: string | null;
  acesso_aberto?: boolean | null;
  convidado?: boolean;
  metadados?: MetadadosCsl;
  /** Auditoria: como o item entrou. */
  origem: OrigemVinculo;
  menciona_apoio?: MencionaApoio;
  objetivos?: number[];
  publicavel?: boolean;
  /** Coautores do Crossref — alimentam o "você é coautor deste?". */
  autores?: NovoAutor[];
};

export type RegistroDeProducao = {
  producao: Producao;
  vinculo: ProducaoVinculo;
  /** `true` quando outro membro da rede já tinha declarado este trabalho. */
  jaExistia: boolean;
};

/**
 * Registra uma produção e a vincula ao relato.
 *
 * O SEGUNDO DECLARANTE NUNCA É BLOQUEADO: se a âncora já existe, reusamos a
 * linha canônica e criamos só o vínculo — dois vínculos, uma contagem. É o que
 * impede que 4 coautores da rede virem 4 artigos na Tabela A do CNPq.
 */
export async function registrarProducao(entrada: NovaProducao): Promise<RegistroDeProducao> {
  const sb = supabase();
  const existente = await checarAncora(entrada.ciclo_id, entrada.ancora_tipo, entrada.ancora_valor);

  let producao: Producao;
  let jaExistia = false;

  if (existente.existe) {
    jaExistia = true;
    producao = await exigir<Producao>(
      sb.from("producoes").select("*").eq("id", existente.producao_id).single(),
    );
  } else {
    const novo = {
      ciclo_id: entrada.ciclo_id,
      ancora_tipo: entrada.ancora_tipo,
      ancora_valor: entrada.ancora_valor.trim(),
      ancora_resolvida: entrada.ancora_resolvida ?? false,
      tipo: entrada.tipo,
      outro_descricao: entrada.outro_descricao ?? "",
      ano: entrada.ano ?? null,
      publicado_em: entrada.publicado_em ?? null,
      acesso_aberto: entrada.acesso_aberto ?? null,
      convidado: entrada.convidado ?? false,
      metadados: entrada.metadados ?? {},
    };
    const { data, error } = await sb.from("producoes").insert(novo).select().single();
    if (error) {
      // Corrida: outro coautor inseriu a mesma âncora entre a checagem e aqui.
      const agora = await checarAncora(entrada.ciclo_id, entrada.ancora_tipo, entrada.ancora_valor);
      if (!agora.existe) lancar(error);
      jaExistia = true;
      producao = await exigir<Producao>(
        sb.from("producoes").select("*").eq("id", agora.producao_id).single(),
      );
    } else {
      producao = data as Producao;
    }
  }

  const vinculo = await exigir<ProducaoVinculo>(
    sb
      .from("producao_vinculos")
      .upsert(
        {
          producao_id: producao.id,
          relato_id: entrada.relato_id,
          origem: entrada.origem,
          menciona_apoio: entrada.menciona_apoio ?? "nao_sei",
          objetivos: entrada.objetivos ?? [],
          publicavel: entrada.publicavel ?? true,
        },
        { onConflict: "producao_id,relato_id" },
      )
      .select()
      .single(),
  );

  if (entrada.autores?.length && !jaExistia) {
    await salvarAutores(producao.id, entrada.autores);
  }

  return { producao, vinculo, jaExistia };
}

/** O que o membro pode ajustar no PRÓPRIO vínculo. */
export type PatchVinculo = Partial<{
  menciona_apoio: MencionaApoio;
  objetivos: number[];
  publicavel: boolean;
  origem: OrigemVinculo;
}>;

export async function atualizarVinculo(vinculoId: string, patch: PatchVinculo): Promise<ProducaoVinculo> {
  return exigir<ProducaoVinculo>(
    supabase().from("producao_vinculos").update(patch).eq("id", vinculoId).select().single(),
  );
}

/**
 * Desfaz a atribuição. A linha canônica em `producoes` FICA: ela pode ser de
 * outro coautor, e apagá-la levaria junto o vínculo dele.
 */
export async function removerVinculo(vinculoId: string): Promise<void> {
  const { error } = await supabase().from("producao_vinculos").delete().eq("id", vinculoId);
  if (error) lancar(error);
}

/**
 * Correção dos metadados da canônica (RLS: só quem tem vínculo, ou a
 * coordenação). `ambito` só a coordenação decide; por isso não está no patch.
 */
export type PatchProducao = Partial<{
  tipo: TipoProducao;
  outro_descricao: string;
  ano: number | null;
  publicado_em: string | null;
  acesso_aberto: boolean | null;
  convidado: boolean;
  ancora_resolvida: boolean;
  metadados: MetadadosCsl;
}>;

export async function atualizarProducao(producaoId: string, patch: PatchProducao): Promise<Producao> {
  return exigir<Producao>(
    supabase().from("producoes").update(patch).eq("id", producaoId).select().single(),
  );
}

export async function listarAutores(producaoId: string): Promise<ProducaoAutor[]> {
  return muitos<ProducaoAutor>(
    supabase()
      .from("producao_autores")
      .select("*")
      .eq("producao_id", producaoId)
      .order("ordem", { ascending: true }),
  );
}

/** Cache dos coautores do Crossref. Mede a colaboração interna (Indicador nº 3). */
export async function salvarAutores(producaoId: string, autores: NovoAutor[]): Promise<ProducaoAutor[]> {
  if (!autores.length) return [];
  const linhas = autores.map((a) => ({
    producao_id: producaoId,
    ordem: a.ordem,
    nome: a.nome,
    orcid: a.orcid ?? null,
    is_membro_rede: a.is_membro_rede ?? false,
    user_id: a.user_id ?? null,
  }));
  return muitos<ProducaoAutor>(
    supabase().from("producao_autores").upsert(linhas, { onConflict: "producao_id,ordem" }).select(),
  );
}

// ============================================ 5. FATOS COLETIVOS E ADESÃO ===

/**
 * Os fatos do laboratório. O membro vê para ADERIR; o LLA vê para conferir.
 * `apenasConfirmados` é o que a Tela 3 usa: proposta pendente não vira lista de
 * participação até o LLA confirmar.
 */
export async function listarFatosDoLaboratorio(
  cicloId: string,
  laboratorioId: string,
  opcoes: { apenasConfirmados?: boolean } = {},
): Promise<Fato[]> {
  let consulta = supabase()
    .from("fatos")
    .select("*")
    .eq("ciclo_id", cicloId)
    .eq("laboratorio_id", laboratorioId);
  if (opcoes.apenasConfirmados) consulta = consulta.eq("status", "confirmado");
  return muitos<Fato>(consulta.order("ocorrido_em", { ascending: false }));
}

/** A fila da tela L3: o que os membros propuseram e aguarda o LLA. */
export async function listarFilaDePropostas(cicloId: string, laboratorioId: string): Promise<Fato[]> {
  return muitos<Fato>(
    supabase()
      .from("fatos")
      .select("*")
      .eq("ciclo_id", cicloId)
      .eq("laboratorio_id", laboratorioId)
      .eq("status", "proposto")
      .order("created_at", { ascending: true }),
  );
}

/**
 * Um fato a declarar. `comite`, `ciclo_competencia_id` e `periodo_situacao` não
 * entram: são derivados por trigger. `status` também não — quem não é o LLA do
 * laboratório tem o status COERGIDO para 'proposto' pelo servidor, e é assim
 * que uma expedição de 5 pessoas continua sendo 1 expedição.
 */
export type NovoFato = {
  ciclo_id: string;
  laboratorio_id: string;
  tipo: TipoFato;
  /** Precisão de mês é aceita: use dia 1. Fora do período é ACEITO e marcado. */
  ocorrido_em: string;
  titulo: string;
  payload?: FatoPayload;
  eets?: string[];
  objetivos?: number[];
};

async function inserirFato(entrada: NovoFato, status: StatusFato): Promise<Fato> {
  return exigir<Fato>(
    supabase()
      .from("fatos")
      .insert({
        ciclo_id: entrada.ciclo_id,
        laboratorio_id: entrada.laboratorio_id,
        tipo: entrada.tipo,
        ocorrido_em: entrada.ocorrido_em,
        titulo: entrada.titulo.trim(),
        payload: entrada.payload ?? {},
        eets: entrada.eets ?? [],
        objetivos: entrada.objetivos ?? [],
        status,
      })
      .select()
      .single(),
  );
}

/** Criação pelo LLA: nasce confirmado (o trigger coerge se quem chama não for o LLA). */
export async function criarFato(entrada: NovoFato): Promise<Fato> {
  return inserirFato(entrada, "confirmado");
}

/**
 * Proposta do membro (Tela 3, "aconteceu algo que não está nesta lista?").
 * Não conta até o LLA confirmar — e a tela precisa dizer isso.
 */
export async function proporFato(entrada: NovoFato): Promise<Fato> {
  return inserirFato(entrada, "proposto");
}

export type PatchFato = Partial<{
  titulo: string;
  ocorrido_em: string;
  payload: FatoPayload;
  eets: string[];
  objetivos: number[];
  observacao_revisao: string;
}>;

export async function salvarFato(fatoId: string, patch: PatchFato): Promise<Fato> {
  return exigir<Fato>(supabase().from("fatos").update(patch).eq("id", fatoId).select().single());
}

/** Confirmação pelo LLA. `confirmado_por`/`confirmado_em` são do trigger. */
export async function confirmarFato(fatoId: string): Promise<Fato> {
  return exigir<Fato>(
    supabase().from("fatos").update({ status: "confirmado" }).eq("id", fatoId).select().single(),
  );
}

/** Rejeição com comentário — o texto volta ao membro que propôs. */
export async function rejeitarFato(fatoId: string, observacao: string): Promise<Fato> {
  return exigir<Fato>(
    supabase()
      .from("fatos")
      .update({ status: "rejeitado", observacao_revisao: observacao })
      .eq("id", fatoId)
      .select()
      .single(),
  );
}

/**
 * Fusão: marca este fato como duplicata de outro. Conta UMA vez na rede e
 * continua visível nos dois grupos — a tela do LLA precisa dizer isso antes que
 * alguém reclame do número.
 */
export async function fundirFato(fatoId: string, duplicadoDe: string): Promise<Fato> {
  return exigir<Fato>(
    supabase()
      .from("fatos")
      .update({ status: "duplicado_de", duplicado_de: duplicadoDe })
      .eq("id", fatoId)
      .select()
      .single(),
  );
}

/** Só o LLA, e só enquanto 'proposto' ou 'rejeitado' (policy `fatos_delete`). */
export async function removerFato(fatoId: string): Promise<void> {
  const { error } = await supabase().from("fatos").delete().eq("id", fatoId);
  if (error) lancar(error);
}

/** Quem aderiu a estes fatos (a lista de participantes da expedição). */
export async function listarParticipantes(fatoIds: string[]): Promise<FatoParticipante[]> {
  if (!fatoIds.length) return [];
  return muitos<FatoParticipante>(
    supabase().from("fato_participantes").select("*").in("fato_id", fatoIds),
  );
}

/** Minhas adesões neste ciclo — o que a Tela 3 marca como já participado. */
export async function minhasAdesoes(cicloId: string, userId: string): Promise<FatoParticipante[]> {
  const linhas = await muitos<FatoParticipante & Record<string, unknown>>(
    supabase()
      .from("fato_participantes")
      .select("*, fatos!inner(ciclo_id)")
      .eq("user_id", userId)
      .eq("fatos.ciclo_id", cicloId),
  );
  return semEmbutido(linhas, "fatos");
}

/**
 * "Participei deste." Uma linha, sem payload — é a diferença entre "5 pessoas
 * participaram de 1 expedição" e "5 expedições".
 */
export async function aderirAoFato(entrada: {
  fatoId: string;
  userId: string;
  relatoId?: string | null;
  papelNoFato?: string | null;
}): Promise<FatoParticipante> {
  return exigir<FatoParticipante>(
    supabase()
      .from("fato_participantes")
      .upsert(
        {
          fato_id: entrada.fatoId,
          user_id: entrada.userId,
          relato_id: entrada.relatoId ?? null,
          papel_no_fato: entrada.papelNoFato ?? null,
        },
        { onConflict: "fato_id,user_id" },
      )
      .select()
      .single(),
  );
}

/** Desmarcar. Cada um desmarca a própria adesão (o LLA também pode). */
export async function desaderirDoFato(fatoId: string, userId: string): Promise<void> {
  const { error } = await supabase()
    .from("fato_participantes")
    .delete()
    .eq("fato_id", fatoId)
    .eq("user_id", userId);
  if (error) lancar(error);
}

// ================================================= 6. ARQUIVOS (Storage) ====

/** SHA-256 do arquivo, calculado no NAVEGADOR antes de subir (§3.3). */
export async function sha256Hex(arquivo: Blob): Promise<string> {
  const bytes = await arquivo.arrayBuffer();
  const resumo = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(resumo))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** O anexo pertence a um relato OU a um fato — nunca aos dois (CHECK do 005). */
export type AlvoDoArquivo = { relatoId: string; fatoId?: never } | { fatoId: string; relatoId?: never };

export type NovoArquivo = {
  userId: string;
  /** `relatorio_ciclos.slug` — compõe o caminho no bucket. */
  cicloSlug: string;
  alvo: AlvoDoArquivo;
  arquivo: File;
  uso: UsoArquivo;
  /** Para aplicar os limites do ciclo em vez dos defaults da migração. */
  config?: CicloConfig | null;
};

const EXTENSAO: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  [MIME_DOCX]: "docx",
};

/**
 * Detecção TOLERANTE do .docx. `File.type` vem VAZIO para .docx em alguns
 * Windows (registro sem a associação OOXML), e vem `application/octet-stream`
 * em outros — confiar só no type recusaria o arquivo certo justamente na
 * máquina de quem mais usa Word. A regra: o type explícito vence; quando ele
 * não diz nada (vazio/octet-stream), a extensão `.docx` do nome decide.
 * Um type explícito DIFERENTE (ex.: um .docx renomeado de um pdf) fica como
 * está — o servidor confere o resto.
 */
function mimeDetectado(arquivo: File): string {
  if (arquivo.type === MIME_DOCX) return MIME_DOCX;
  const semTipoUtil = arquivo.type === "" || arquivo.type === "application/octet-stream";
  if (semTipoUtil && /\.docx$/i.test(arquivo.name)) return MIME_DOCX;
  return arquivo.type;
}

/**
 * Sobe o arquivo e registra a ficha. Caminho:
 * `<auth.uid()>/<ciclo_slug>/<item_id>/<n>.<ext>` — a policy do bucket exige
 * que a primeira pasta seja o uid, e é isso que isola um membro do outro.
 *
 * DOCX (011): aceito SÓ com `uso='comprovante'` (é o "documento com dados da
 * pesquisa" que a coordenação baixa para o relatório anual), com teto próprio
 * de `anexos.max_bytes_docx` (10 MB na semente). Os demais tipos continuam no
 * `max_bytes` de 1 MB. Os tetos são validados AQUI, ANTES do upload — o
 * file_size_limit do bucket é global (10 MB) e não segura um pdf de 5 MB; o
 * CHECK condicional da tabela seguraria, mas aí o binário já teria subido e
 * ficaria órfão no Storage. O .doc legado (Word 2003) não entra.
 */
export async function enviarArquivo(entrada: NovoArquivo): Promise<RelatoArquivo> {
  const limites = limitesDeAnexo(entrada.config ?? null);
  const arquivo = entrada.arquivo;
  const mime = mimeDetectado(arquivo);
  const ehDocx = mime === MIME_DOCX;

  if (/\.doc$/i.test(arquivo.name) && !ehDocx) {
    throw new Error(
      "O formato .doc (Word 2003) não é aceito. Abra o arquivo no Word e salve como .docx.",
    );
  }
  if (ehDocx && entrada.uso !== "comprovante") {
    throw new Error(
      "Documento Word (.docx) entra só como documento da pesquisa. Para imagem publicável, envie JPEG ou PNG.",
    );
  }
  if (!ehDocx && !limites.mimes.includes(mime)) {
    throw new Error("Envie PDF, JPEG ou PNG. Word (.docx) entra só como documento da pesquisa.");
  }
  // O teto do docx vem do CONFIG do ciclo (semeado pela 011), lido direto —
  // `limitesDeAnexo()` (config.ts) antecede a 011 e não repassa o campo.
  const teto = ehDocx
    ? (entrada.config?.anexos?.max_bytes_docx ?? MAX_BYTES_DOCX_PADRAO)
    : limites.max_bytes;
  if (arquivo.size > teto) {
    const mb = (teto / 1048576).toFixed(0);
    throw new Error(
      ehDocx
        ? `O documento .docx deve ter no máximo ${mb} MB. Reduza (imagens comprimidas ajudam) e tente de novo.`
        : `O arquivo deve ter no máximo ${mb} MB. Comprima a imagem e tente de novo.`,
    );
  }

  const itemId = entrada.alvo.relatoId ?? entrada.alvo.fatoId;
  const existentes = await listarArquivos(entrada.alvo);
  if (entrada.alvo.relatoId && existentes.length >= limites.max_por_relato) {
    throw new Error(`Limite de ${limites.max_por_relato} arquivos por relato atingido.`);
  }

  const ext = EXTENSAO[mime] ?? "bin";
  const sha256 = await sha256Hex(arquivo);
  const caminho = `${entrada.userId}/${entrada.cicloSlug}/${itemId}/${existentes.length + 1}-${sha256.slice(0, 8)}.${ext}`;

  const sb = supabase();
  // `contentType: mime` (o DETECTADO), nunca `arquivo.type`: com type vazio o
  // bucket receberia application/octet-stream e recusaria pelo allowed_mime_types.
  const { error: erroUpload } = await sb.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { upsert: true, contentType: mime });
  if (erroUpload) lancar(erroUpload);

  return exigir<RelatoArquivo>(
    sb
      .from("relato_arquivos")
      .insert({
        relato_id: entrada.alvo.relatoId ?? null,
        fato_id: entrada.alvo.fatoId ?? null,
        storage_path: caminho,
        file_name: arquivo.name,
        sha256,
        mime,
        bytes: arquivo.size,
        uso: entrada.uso,
      })
      .select()
      .single(),
  );
}

export async function listarArquivos(alvo: AlvoDoArquivo): Promise<RelatoArquivo[]> {
  const consulta = supabase().from("relato_arquivos").select("*");
  return muitos<RelatoArquivo>(
    alvo.relatoId
      ? consulta.eq("relato_id", alvo.relatoId)
      : consulta.eq("fato_id", alvo.fatoId as string),
  );
}

/** URL temporária para ver o anexo sem torná-lo público. */
export async function urlAssinadaDeArquivo(storagePath: string, expiraSegundos = 3600): Promise<string> {
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(storagePath, expiraSegundos);
  if (error) lancar(error);
  if (!data?.signedUrl) throw new Error("Não foi possível abrir o arquivo agora. Tente de novo.");
  return data.signedUrl;
}

/** Remove a ficha e o binário. Se o binário já sumiu, a ficha ainda sai. */
export async function removerArquivo(arquivo: Pick<RelatoArquivo, "id" | "storage_path">): Promise<void> {
  const sb = supabase();
  const { error } = await sb.from("relato_arquivos").delete().eq("id", arquivo.id);
  if (error) lancar(error);
  await sb.storage.from(BUCKET).remove([arquivo.storage_path]);
}

// ================================================ 7. VIEWS DE CONFERÊNCIA ===
/**
 * Nenhum número deste bloco é digitado em lugar nenhum: todos saem de `select`.
 * E nenhum deles é "percentual de meta cumprida" — a projeção contra o marco do
 * 2º ano é calculada pela tela, a partir de `pactuados` do `config`, e sempre
 * exibida com o rótulo de projeção.
 */

/**
 * A saída mais importante do ciclo: convidados · entraram · enviaram · nada a
 * declarar · silenciosos. Sem ela, um número baixo é ambíguo entre baixa
 * produção e baixa resposta.
 */
export async function lerCobertura(cicloId: string): Promise<CoberturaLinha[]> {
  return muitos<CoberturaLinha>(supabase().from("v_cobertura").select("*").eq("ciclo_id", cicloId));
}

/** Tabela A do CNPq — conta na canônica, uma linha por trabalho. */
export async function lerProducaoPorTipo(cicloId: string): Promise<ProducaoPorTipoLinha[]> {
  return muitos<ProducaoPorTipoLinha>(
    supabase().from("v_producao_por_tipo").select("*").eq("ciclo_id", cicloId),
  );
}

/** Fatos confirmados por tipo — uma expedição conta uma vez, com N participantes. */
export async function lerFatosPorTipo(cicloId: string): Promise<FatosPorTipoLinha[]> {
  return muitos<FatosPorTipoLinha>(
    supabase().from("v_fatos_por_tipo").select("*").eq("ciclo_id", cicloId),
  );
}

/** Indicador 3 — instituições e países contados a partir do ROR declarado. */
export async function lerRedeInstituicoes(cicloId: string): Promise<RedeInstituicaoLinha[]> {
  return muitos<RedeInstituicaoLinha>(
    supabase().from("v_rede_instituicoes").select("*").eq("ciclo_id", cicloId),
  );
}

/**
 * A fila da DECISÃO 3: itens declarados com a data verdadeira que estão fora de
 * qualquer período. Não entram em contagem; esperam o próximo ciclo.
 */
export async function lerItensForaDoPeriodo(cicloId: string): Promise<ItemForaDoPeriodo[]> {
  return muitos<ItemForaDoPeriodo>(
    supabase().from("v_itens_fora_do_periodo").select("*").eq("ciclo_id", cicloId),
  );
}

// ============================== 8. LEITURAS DE CICLO INTEIRO (coordenação) ===
/**
 * As leituras que alimentam o painel da coordenação (`agregacao.ts`). Nenhuma
 * checa permissão: a RLS da 005 decide — para quem não é coordenação/CGES do
 * ciclo, `relatos` volta só com o próprio relato e o painel nem é montado (a
 * tela barra antes, pelo papel). Para a coordenação, volta o ciclo INTEIRO.
 *
 * PAGINAÇÃO EXPLÍCITA — o bug clássico de painel
 * ----------------------------------------------
 * O PostgREST corta qualquer resposta em 1000 linhas POR PADRÃO, SEM ERRO.
 * Um `select` ingênuo de ~1000+ produções devolveria as primeiras 1000 e o
 * painel mostraria um total menor que o real, sem nenhum sinal — mentira por
 * truncamento. Por isso TODAS as leituras desta seção passam por
 * `todasAsPaginas`, que pede blocos de `PAGINA` com `.range()` e só para
 * quando um bloco vem incompleto. A ordenação por `id` é o que torna as
 * páginas estáveis (sem `order`, o Postgres não garante ordem entre chamadas
 * e uma linha poderia aparecer em duas páginas ou em nenhuma).
 */

const PAGINA = 1000;

async function todasAsPaginas<T>(
  pagina: (de: number, ate: number) => PromiseLike<Resposta<T[]>>,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    if (error) lancar(error);
    const bloco = data ?? [];
    linhas.push(...bloco);
    if (bloco.length < PAGINA) return linhas;
  }
}

/** Todos os relatos do ciclo (rascunhos incluídos — a cobertura precisa deles). */
export async function listarRelatosDoCiclo(cicloId: string): Promise<Relato[]> {
  return todasAsPaginas<Relato>((de, ate) =>
    supabase()
      .from("relatos")
      .select("*")
      .eq("ciclo_id", cicloId)
      .order("id", { ascending: true })
      .range(de, ate),
  );
}

/**
 * O roster inteiro, inclusive inativos: quem agrega decide o recorte (a
 * cobertura usa só `ativo`, como a `v_cobertura`) — filtrar aqui esconderia
 * dado da função pura que é quem sabe explicar o filtro.
 */
export async function listarMembrosDoCiclo(cicloId: string): Promise<CicloMembro[]> {
  return todasAsPaginas<CicloMembro>((de, ate) =>
    supabase()
      .from("ciclo_membros")
      .select("*")
      .eq("ciclo_id", cicloId)
      .order("id", { ascending: true })
      .range(de, ate),
  );
}

/** A produção canônica com TODOS os vínculos dela (2 coautores = 2 vínculos, 1 item). */
export type ProducaoComVinculos = { producao: Producao; vinculos: ProducaoVinculo[] };

/**
 * Todas as produções declaradas NO ciclo (`ciclo_id`), com vínculos embutidos.
 * Atenção à diferença que a agregação respeita: `ciclo_id` é onde o item foi
 * DECLARADO; `ciclo_competencia_id` é onde ele CONTA (nulo = fora do período).
 */
export async function listarProducoesDoCiclo(cicloId: string): Promise<ProducaoComVinculos[]> {
  const linhas = await todasAsPaginas<Producao & { producao_vinculos: ProducaoVinculo[] | null }>(
    (de, ate) =>
      supabase()
        .from("producoes")
        .select("*, producao_vinculos(*)")
        .eq("ciclo_id", cicloId)
        .order("id", { ascending: true })
        .range(de, ate),
  );
  return linhas.map(({ producao_vinculos, ...producao }) => ({
    producao: producao as Producao,
    vinculos: producao_vinculos ?? [],
  }));
}

/** Todos os fatos do ciclo, em qualquer status — a agregação separa confirmados. */
export async function listarFatosDoCiclo(cicloId: string): Promise<Fato[]> {
  return todasAsPaginas<Fato>((de, ate) =>
    supabase()
      .from("fatos")
      .select("*")
      .eq("ciclo_id", cicloId)
      .order("id", { ascending: true })
      .range(de, ate),
  );
}

/** Todas as adesões do ciclo (o `!inner` em `fatos` é só filtro, descartado). */
export async function listarAdesoesDoCiclo(cicloId: string): Promise<FatoParticipante[]> {
  const linhas = await todasAsPaginas<FatoParticipante & Record<string, unknown>>((de, ate) =>
    supabase()
      .from("fato_participantes")
      .select("*, fatos!inner(ciclo_id)")
      .eq("fatos.ciclo_id", cicloId)
      .order("id", { ascending: true })
      .range(de, ate),
  );
  return semEmbutido(linhas, "fatos");
}
