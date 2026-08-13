/**
 * ============================================================================
 *  A boca do banco da inscrição do curso "Do átomo à ação biológica"
 * ============================================================================
 *  Este arquivo NÃO AUTORIZA NADA. Toda a segurança está na migração 013: a
 *  tabela `curso_inscricoes` tem RLS ligada, nenhuma policy de escrita e
 *  `revoke all … from anon`. A única superfície aberta a quem não tem sessão é a
 *  função `registrar_inscricao_curso`, que é `security definer`.
 *
 *  NENHUMA FUNÇÃO DE ENVIO LANÇA PARA DESFECHO PREVISTO (mesma decisão de
 *  src/fitofarmas/api.ts): o formulário é público, e um `Error` que sobe até um
 *  `catch` genérico vira "algo deu errado" e a pessoa vai embora. Tudo volta
 *  como união discriminada (`ResultadoEnvio`), com a frase pronta.
 * ============================================================================
 */
import { platformEnabled, supabase } from "../platform/supabaseClient";
import { EDICAO_SLUG, MAX_VAGAS } from "./conteudo";
import type { EstadoEnvio, Inscricao, InscritoPainel, ResultadoEnvio, Vagas } from "./types";

const RPC_REGISTRAR = "registrar_inscricao_curso";
const RPC_VAGAS = "curso_vagas";

/** Dados públicos da edição, para a tela dizer a janela em vez de adivinhá-la. */
export type EdicaoCurso = {
  readonly slug: string;
  readonly titulo: string;
  readonly status: string;
  readonly abre_em: string;
  readonly fecha_em: string;
  readonly config: Record<string, unknown>;
};

/** A rota só grava com a plataforma configurada (mesma checagem do 001/008). */
export function cursoDisponivel(): boolean {
  return platformEnabled;
}

// =============================================== 1. A EDIÇÃO (leitura pública)

/**
 * Lê a edição publicada. `null` significa "não deu para saber" — nunca
 * "fechada": quem decide se está aberto é a RPC, no envio.
 */
export async function carregarEdicao(slug: string = EDICAO_SLUG): Promise<EdicaoCurso | null> {
  if (!platformEnabled) return null;
  try {
    const { data, error } = await supabase()
      .from("curso_edicoes")
      .select("slug, titulo, status, abre_em, fecha_em, config")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return data as EdicaoCurso;
  } catch {
    return null;
  }
}

// ============================================== 1a. AS VAGAS (leitura pública)

/**
 * Vagas por turma, pela RPC pública `curso_vagas` (só contagens agregadas). Não
 * é a autoridade — é o que a tela MOSTRA; quem decide se cabe é a RPC de registro
 * no envio (que reconta sob trava). `null` = não deu para saber; a tela então
 * não bloqueia nada e deixa a RPC recusar se estiver cheio.
 */
export async function carregarVagas(slug: string = EDICAO_SLUG): Promise<Vagas | null> {
  if (!platformEnabled) return null;
  try {
    const { data, error } = await supabase().rpc(RPC_VAGAS, { p_edicao_slug: slug });
    if (error || !data || typeof data !== "object") return null;
    const d = data as { max?: unknown; ocupacao?: unknown };
    const max = typeof d.max === "number" && d.max > 0 ? d.max : MAX_VAGAS;
    const ocupacao: Record<string, number> = {};
    if (d.ocupacao && typeof d.ocupacao === "object") {
      for (const [k, v] of Object.entries(d.ocupacao as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v) && v >= 0) ocupacao[k] = v;
      }
    }
    return { max, ocupacao };
  } catch {
    return null;
  }
}

// ==================================== 1b. O PAINEL DA GESTÃO (leitura, admin)

/**
 * As inscrições, pela view `curso_inscritos`. SÓ ADMIN recebe linhas: a view é
 * `security_invoker` e a policy da tabela exige `is_admin()`.
 *
 * Para um usuário logado SEM papel de admin, a RLS não devolve ERRO — devolve
 * ZERO LINHAS. O painel (PainelCurso.tsx) checa o papel ANTES de chamar isto.
 */
export type ResultadoPainel =
  | { readonly ok: true; readonly linhas: InscritoPainel[] }
  | { readonly ok: false; readonly mensagem: string };

export async function listarInscritosDoPainel(): Promise<ResultadoPainel> {
  if (!platformEnabled) {
    return { ok: false, mensagem: "A plataforma ainda não está configurada neste ambiente." };
  }
  try {
    const { data, error } = await supabase()
      .from("curso_inscritos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      const cru = textoCru(error).toLowerCase();
      if (cru.includes("42p01") || cru.includes("does not exist") || cru.includes("schema cache")) {
        return {
          ok: false,
          mensagem:
            "O banco do curso ainda não foi preparado: rode a migração 013 e o seed 004 no " +
            "SQL Editor do Supabase (ver docs/curso-atomo-acao-biologica.md).",
        };
      }
      return { ok: false, mensagem: "Não foi possível carregar as inscrições. Tente de novo em instantes." };
    }

    return { ok: true, linhas: (data ?? []) as InscritoPainel[] };
  } catch (e) {
    return { ok: false, mensagem: falhaDeRede(e).mensagem };
  }
}

// ====================================================== 2. O ENVIO (a RPC)

type RetornoRpc = {
  ok?: unknown;
  estado?: unknown;
  protocolo?: unknown;
  mensagem?: unknown;
  campo?: unknown;
};

const ESTADOS_CONHECIDOS: ReadonlySet<string> = new Set<EstadoEnvio>([
  "recebido",
  "fora_da_janela",
  "email_invalido",
  "dados_invalidos",
  "turma_lotada",
]);

const texto = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Extrai o texto de uma recusa, venha ela como for. O `error` do supabase-js
 * NÃO é um `Error`: é `{ message, details, hint, code }`, e `instanceof Error`
 * é falso para ele (mesma armadilha medida em src/fitofarmas/api.ts).
 */
function textoCru(e: unknown): string {
  if (!e) return "";
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const f = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [f.message, f.details, f.hint, f.code]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" · ");
  }
  return "";
}

/** Traduz a falha de TRANSPORTE. As falhas de NEGÓCIO já vêm em português. */
function falhaDeRede(e: unknown): ResultadoEnvio {
  const cru = textoCru(e).toLowerCase();

  if (
    cru.includes("pgrst202") ||
    cru.includes("pgrst") ||
    cru.includes("could not find the function") ||
    cru.includes("schema cache")
  ) {
    return {
      ok: false,
      estado: "indisponivel",
      protocolo: null,
      mensagem:
        "A inscrição ainda não está no ar do nosso lado. Não é nada que você fez. Suas respostas " +
        "continuam salvas neste navegador. Tente de novo mais tarde ou escreva para a coordenação.",
    };
  }

  if (
    cru.includes("failed to fetch") ||
    cru.includes("networkerror") ||
    cru.includes("network request failed") ||
    cru.includes("load failed")
  ) {
    return {
      ok: false,
      estado: "falha",
      protocolo: null,
      mensagem:
        "Não conseguimos falar com o servidor. Confira a conexão e toque em confirmar de novo: " +
        "nada do que você escreveu foi perdido.",
    };
  }

  return {
    ok: false,
    estado: "falha",
    protocolo: null,
    mensagem:
      "Não foi possível enviar agora. Suas respostas continuam salvas neste navegador. " +
      "Tente novamente em instantes.",
  };
}

/**
 * Envia a inscrição.
 *
 * @param inscricao      o estado inteiro do formulário — vai cru para o jsonb.
 * @param isca           o campo-armadilha. Humano nunca preenche; robô sempre.
 * @param msDesdeInicio  ms desde a abertura da tela. A RPC recusa abaixo de 4 s
 *                       — e o faz devolvendo `ok`, para não ensinar o robô.
 *
 * Nunca lança. Nunca joga texto do Postgres na tela.
 */
export async function enviarInscricao(
  inscricao: Inscricao,
  isca: string,
  msDesdeInicio: number,
  slug: string = EDICAO_SLUG,
): Promise<ResultadoEnvio> {
  if (!platformEnabled) {
    return {
      ok: false,
      estado: "indisponivel",
      protocolo: null,
      mensagem:
        "A inscrição on-line ainda não está no ar. Suas respostas continuam salvas neste navegador: " +
        "volte a esta página mais tarde, ou escreva para a coordenação.",
    };
  }

  try {
    const { data, error } = await supabase().rpc(RPC_REGISTRAR, {
      p_edicao_slug: slug,
      p_dados: inscricao,
      p_isca: isca,
      p_ms: Math.max(0, Math.round(msDesdeInicio)),
    });

    if (error) return falhaDeRede(error);

    const r = (data ?? {}) as RetornoRpc;
    const estado = texto(r.estado);
    if (!ESTADOS_CONHECIDOS.has(estado)) {
      return falhaDeRede("resposta inesperada");
    }

    return {
      ok: r.ok === true,
      estado: estado as EstadoEnvio,
      protocolo: typeof r.protocolo === "string" && r.protocolo ? r.protocolo : null,
      mensagem: texto(r.mensagem) || "Recebemos a sua inscrição.",
      campo: texto(r.campo) || undefined,
    };
  } catch (e) {
    return falhaDeRede(e);
  }
}
