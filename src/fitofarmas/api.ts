/**
 * ============================================================================
 *  A boca do banco do formulário pré-evento — I Workshop Conexão Fitofarmas
 * ============================================================================
 *  Este arquivo NÃO AUTORIZA NADA. Toda a segurança está na migração 008: a
 *  tabela `workshop_respostas` tem RLS ligada, nenhuma policy de escrita e
 *  `revoke all … from anon`. A única superfície aberta a quem não tem sessão é
 *  a função `registrar_intencao_workshop`, que é `security definer`. Se algo
 *  aqui parecer estar "checando permissão", está errado.
 *
 *  NENHUMA FUNÇÃO DAQUI LANÇA PARA DESFECHO PREVISTO
 *  -------------------------------------------------
 *  `platform/api.ts` lança e a tela traduz; `relato/api.ts` traduz na própria
 *  camada e lança. Este é o terceiro caso, e é diferente dos dois de propósito:
 *  o formulário é público, respondido em pé, por gente que chegou de QR code.
 *  Um `Error` que sobe até um `catch` genérico vira "algo deu errado" e a
 *  pessoa vai embora. Aqui tudo volta como união discriminada
 *  (`ResultadoEnvio`), com a frase pronta e o campo a focar.
 *
 *  O ESCORE NÃO PASSA POR AQUI
 *  ---------------------------
 *  `escore_intencao` é calculado dentro da RPC, no servidor. Este arquivo não o
 *  envia, não o lê e não o mostra. Um número de priorização que o navegador
 *  pode escolher não prioriza nada — e devolvê-lo a quem respondeu ensinaria
 *  quais caixas marcar na próxima vez.
 * ============================================================================
 */
import { platformEnabled, supabase } from "../platform/supabaseClient";
import type { RespostaPainel } from "./metricas";
import type { EstadoEnvio, Respostas, ResultadoEnvio } from "./types";

/** A edição corrente. Espelha `workshop_edicoes.slug` do seed 003. */
export const EDICAO_SLUG = "i-workshop-conexao-fitofarmas";

const RPC_REGISTRAR = "registrar_intencao_workshop";

/** Dados públicos da edição, para a tela dizer a janela em vez de adivinhá-la. */
export type Edicao = {
  readonly slug: string;
  readonly titulo: string;
  readonly status: string;
  readonly abre_em: string;
  readonly fecha_em: string;
  readonly config: Record<string, unknown>;
};

/**
 * A rota só grava com a plataforma configurada. Mesma checagem do 001 — sem as
 * variáveis de ambiente o site continua 100% estático, e a tela mostra um aviso
 * em vez de um formulário que engole respostas.
 */
export function fitofarmasDisponivel(): boolean {
  return platformEnabled;
}

// =============================================== 1. A EDIÇÃO (leitura pública)

/**
 * Lê a edição publicada. `null` significa "não deu para saber" — nunca
 * "fechada": a tela que confunde as duas coisas fecha o formulário sozinha
 * quando o Supabase pisca. Quem decide se está aberto é a RPC, no envio.
 */
export async function carregarEdicao(slug: string = EDICAO_SLUG): Promise<Edicao | null> {
  if (!platformEnabled) return null;
  try {
    const { data, error } = await supabase()
      .from("workshop_edicoes")
      .select("slug, titulo, status, abre_em, fecha_em, config")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return data as Edicao;
  } catch {
    return null;
  }
}

// ================================== 1b. O PAINEL DA GESTÃO (leitura, admin)

/**
 * As respostas, pela view `workshop_prioridade` — já ordenadas por escore e com
 * a faixa calculada pelo banco. SÓ ADMIN recebe linhas: a view é
 * `security_invoker` e a policy da tabela exige `is_admin()`.
 *
 * ARMADILHA DOCUMENTADA: para um usuário logado SEM papel de admin, a RLS não
 * devolve ERRO — devolve ZERO LINHAS. A tela não tem como distinguir "ninguém
 * respondeu" de "você não pode ver" olhando só o resultado, e por isso o painel
 * checa o papel ANTES de chamar isto (Gestao.tsx já sabe quem é admin) e só
 * mostra a lista vazia como "ninguém respondeu" para quem comprovadamente
 * PODERIA ver.
 */
export type ResultadoPainel =
  | { readonly ok: true; readonly linhas: RespostaPainel[] }
  | { readonly ok: false; readonly mensagem: string };

export async function listarRespostasDoPainel(): Promise<ResultadoPainel> {
  if (!platformEnabled) {
    return { ok: false, mensagem: "A plataforma ainda não está configurada neste ambiente." };
  }
  try {
    const { data, error } = await supabase()
      .from("workshop_prioridade")
      .select("*")
      .order("escore_intencao", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      const cru = textoCru(error).toLowerCase();
      // 42P01 / "does not exist": a 008 ainda não rodou no SQL Editor. É a
      // NOSSA pendência — a mensagem orienta a coordenação, não culpa ninguém.
      if (cru.includes("42p01") || cru.includes("does not exist") || cru.includes("schema cache")) {
        return {
          ok: false,
          mensagem:
            "O banco do workshop ainda não foi preparado: rode a migração 008 e o seed 003 no " +
            "SQL Editor do Supabase (ver docs/fitofarmas-pre-evento.md, seção 2).",
        };
      }
      return { ok: false, mensagem: "Não foi possível carregar as respostas. Tente de novo em instantes." };
    }

    const linhas = (data ?? []).map((r) => ({
      ...r,
      eets: r.eets ?? [],
      formas: r.formas ?? [],
      aportes: r.aportes ?? [],
      iniciativas: r.iniciativas ?? [],
      compromissos: r.compromissos ?? [],
      aportes_detalhe: (r.aportes_detalhe ?? {}) as Record<string, string>,
      aportes_nomeados: Number(r.aportes_nomeados ?? 0),
    })) as RespostaPainel[];

    return { ok: true, linhas };
  } catch (e) {
    return {
      ok: false,
      mensagem: falhaDeRede(e).mensagem,
    };
  }
}

// ====================================================== 2. O ENVIO (a RPC)

/** O que a RPC devolve, antes de a tela olhar. Campos livres = defesa. */
type RetornoRpc = {
  ok?: unknown;
  estado?: unknown;
  protocolo?: unknown;
  mensagem?: unknown;
  campo?: unknown;
};

const ESTADOS_CONHECIDOS: ReadonlySet<string> = new Set<EstadoEnvio>([
  "recebido",
  "atualizado",
  "fora_da_janela",
  "email_invalido",
  "dados_invalidos",
]);

const texto = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Extrai o texto de uma recusa, venha ela como for.
 *
 * ARMADILHA MEDIDA, não hipotética: o `error` do supabase-js NÃO é um `Error`.
 * É um objeto simples `{ message, details, hint, code }`, e `e instanceof Error`
 * é FALSO para ele. Um `falhaDeRede` que só olhasse `e.message` via `instanceof`
 * receberia string vazia e cairia sempre no galho genérico — foi exatamente o
 * que aconteceu no primeiro teste desta tela: o PostgREST devolveu 404/PGRST202
 * ("a função não existe", isto é, a 008 ainda não rodou) e a pessoa lia
 * "tente novamente em instantes", que é conselho inútil para um problema nosso.
 * Mesma solução do `textoCru` de `src/relato/api.ts`.
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

/**
 * Traduz a falha de TRANSPORTE (a que a RPC não teve chance de tratar). As
 * falhas de NEGÓCIO já vêm em português dentro do jsonb — não passam por aqui.
 */
function falhaDeRede(e: unknown): ResultadoEnvio {
  const cru = textoCru(e).toLowerCase();

  // PGRST202: a função não existe no cache de schema. É obra NOSSA — a 008
  // ainda não foi aplicada no SQL Editor —, nunca erro de quem respondeu, e a
  // frase tem de deixar isso claro para a pessoa não ficar tentando de novo.
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
        "O envio ainda não está no ar do nosso lado. Não é nada que você fez. Suas respostas " +
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
        "Não conseguimos falar com o servidor. Confira a conexão e toque em enviar de novo: " +
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
 * Envia as respostas.
 *
 * @param respostas   o estado inteiro do formulário — vai cru para o jsonb.
 * @param isca        o campo-armadilha. Humano nunca preenche; robô sempre.
 * @param msDesdeInicio  milissegundos desde a abertura da tela. A RPC recusa
 *                    abaixo de 4 s — e o faz devolvendo `ok`, para não ensinar
 *                    o robô a corrigir e voltar.
 *
 * Nunca lança. Nunca joga texto do Postgres na tela.
 */
export async function enviarRespostas(
  respostas: Respostas,
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
        "O envio on-line ainda não está no ar. Suas respostas continuam salvas neste navegador: " +
        "volte a esta página mais tarde, ou escreva para a coordenação.",
    };
  }

  try {
    const { data, error } = await supabase().rpc(RPC_REGISTRAR, {
      p_edicao_slug: slug,
      p_respostas: respostas,
      p_isca: isca,
      p_ms: Math.max(0, Math.round(msDesdeInicio)),
    });

    if (error) return falhaDeRede(error);

    const r = (data ?? {}) as RetornoRpc;
    const estado = texto(r.estado);
    if (!ESTADOS_CONHECIDOS.has(estado)) {
      // A RPC devolveu algo que este cliente não conhece: é versão nova do
      // banco contra versão velha do site. Não invente desfecho.
      return falhaDeRede("resposta inesperada");
    }

    return {
      ok: r.ok === true,
      estado: estado as EstadoEnvio,
      protocolo: typeof r.protocolo === "string" && r.protocolo ? r.protocolo : null,
      mensagem: texto(r.mensagem) || "Recebemos a sua resposta.",
      campo: texto(r.campo) || undefined,
    };
  } catch (e) {
    return falhaDeRede(e);
  }
}
