/**
 * ============================================================================
 *  A TELA "EM SUAS PALAVRAS", REDUZIDA AO MÍNIMO QUE AINDA É HONESTO
 * ============================================================================
 *  A versão original tinha QUATRO caixas de texto livre — e texto livre é caro
 *  duas vezes: custa os minutos de quem escreve (era onde moravam 2min30 dos
 *  ~8min do formulário) e custa de novo na consolidação, porque prosa não se
 *  tabula. "Faltou reagente" escrito de 40 formas diferentes não vira o número
 *  "40 laboratórios com problema de insumo" sem alguém ler os 40.
 *
 *  A redução segue uma regra: TIRAR DIGITAÇÃO, NUNCA TIRAR INFORMAÇÃO.
 *
 *  1. O resultado principal continua sendo UMA frase da pessoa (é a
 *     matéria-prima do Indicador nº 2 e ninguém pode escrevê-la por ela) — mas
 *     ganha uma SUGESTÃO PRONTA, montada só com o que a própria pessoa acabou
 *     de declarar nas telas 2 e 3. Um clique aceita; editar é opcional. Quem
 *     declarou um artigo não precisa redigitar o título dele.
 *
 *  2. Dificuldades e oportunidades viram OPÇÕES DE MARCAR, com o detalhe em
 *     texto livre recolhido atrás de "quer detalhar?". O ganho não é só de
 *     atrito: marcado é agregável. A coordenação passa a saber "atraso de
 *     recursos apareceu em N dos 209 relatos" sem ler prosa — e é esse número,
 *     não a prosa, que vira argumento na renovação.
 *
 *  AS LISTAS NÃO SÃO PALPITE. Cada opção de dificuldade nasce de um custo que a
 *  própria proposta assume (expedições em comunidades e UCs, importação de
 *  equipamento, licenças CEP/CEUA/SISBIO/SISGEN/FUNAI na meta 6, bolsas de 17
 *  modalidades) — são as coisas que DÃO errado nesse tipo de projeto. Se a
 *  coordenação quiser outra lista, ela é dado, não código: basta preencher
 *  `config.dificuldades_opcoes` / `config.oportunidades_opcoes` no jsonb do
 *  ciclo que estas constantes viram fallback (mesmo padrão já usado para
 *  `veiculos_divulgacao`).
 * ============================================================================
 */
import type { Narrativas, RespostasRelato } from "./types";

export type OpcaoNarrativa = { id: string; rotulo: string };

export const DIFICULDADES_OPCOES: readonly OpcaoNarrativa[] = [
  { id: "atraso-recursos", rotulo: "Atraso na liberação de recursos ou de bolsas" },
  { id: "logistica-campo", rotulo: "Logística de campo e acesso a comunidades" },
  { id: "licencas", rotulo: "Licenças e autorizações (CEP/CEUA, SISBIO, SISGEN, FUNAI)" },
  { id: "insumos", rotulo: "Insumos e reagentes (compra ou importação)" },
  { id: "equipamento", rotulo: "Equipamento em falta, parado ou sem manutenção" },
  { id: "pessoal", rotulo: "Equipe reduzida ou evasão de bolsistas" },
  { id: "conectividade", rotulo: "Internet e conectividade instáveis" },
  { id: "burocracia", rotulo: "Burocracia administrativa da instituição" },
] as const;

export const OPORTUNIDADES_OPCOES: readonly OpcaoNarrativa[] = [
  { id: "parceria", rotulo: "Nova parceria de pesquisa" },
  { id: "financiamento", rotulo: "Novo financiamento ou edital captado" },
  { id: "internacional", rotulo: "Colaboração internacional" },
  { id: "convite", rotulo: "Convite para evento, banca ou rede" },
  { id: "linha-nova", rotulo: "Nova linha de pesquisa aberta pelos resultados" },
  { id: "politica-publica", rotulo: "Demanda de gestor público ou política pública" },
  { id: "divulgacao", rotulo: "Interesse de imprensa ou de divulgação" },
] as const;

/** Rótulos por id, para a revisão e para o export da coordenação. */
export function rotulosDe(ids: string[] | undefined, opcoes: readonly OpcaoNarrativa[]): string[] {
  if (!ids?.length) return [];
  const mapa = new Map(opcoes.map((o) => [o.id, o.rotulo]));
  return ids.map((id) => mapa.get(id) ?? id);
}

/* ========================================================== A SUGESTÃO ==== */

/** O que a sugestão precisa saber de uma produção — desacoplado do tipo do
 *  banco para a função ser pura e testável sem fixture gigante. */
export type ItemParaSugestao = {
  tipo: string;
  titulo: string | null;
  veiculo: string | null;
  ano: number | null;
};

export type FatoParaSugestao = {
  tipo: string;
  titulo: string;
  ocorridoEm: string | null; // ISO
};

/** CSL: `title` é string; alguns depósitos mandam array. Nunca confiar. */
export function tituloDoCsl(metadados: unknown): string | null {
  if (!metadados || typeof metadados !== "object") return null;
  const m = metadados as Record<string, unknown>;
  const bruto = Array.isArray(m.title) ? m.title[0] : m.title;
  const t = typeof bruto === "string" ? bruto.trim() : "";
  if (!t) return null;
  const cont = Array.isArray(m["container-title"]) ? m["container-title"][0] : m["container-title"];
  void cont; // veiculo sai por veiculoDoCsl; aqui só o título
  return t;
}

export function veiculoDoCsl(metadados: unknown): string | null {
  if (!metadados || typeof metadados !== "object") return null;
  const m = metadados as Record<string, unknown>;
  const bruto = Array.isArray(m["container-title"]) ? m["container-title"][0] : m["container-title"];
  const v = typeof bruto === "string" ? bruto.trim() : "";
  return v || null;
}

/* Ordem de prioridade da sugestão: o que mais provavelmente É o resultado do
   ano. Artigo primeiro — é o que a rede mais produz e o que o CNPq mais conta. */
const PRIORIDADE: readonly string[] = [
  "artigo_periodico",
  "livro",
  "capitulo",
  "patente",
  "software_aplicativo",
  "base_dados",
];

const MODELO_PRODUCAO: Record<string, (t: string, resto: string) => string> = {
  artigo_periodico: (t, resto) => `Publicamos o artigo “${t}”${resto}.`,
  livro: (t, resto) => `Publicamos o livro “${t}”${resto}.`,
  capitulo: (t, resto) => `Publicamos o capítulo de livro “${t}”${resto}.`,
  patente: (t, resto) => `Depositamos o pedido de patente “${t}”${resto}.`,
  software_aplicativo: (t, resto) => `Desenvolvemos e registramos o software “${t}”${resto}.`,
  base_dados: (t, resto) => `Publicamos a base de dados “${t}”${resto}.`,
};

const MODELO_FATO: Record<string, (t: string, resto: string) => string> = {
  expedicao: (t, resto) => `Participei da expedição “${t}”${resto}.`,
  acao_sociedade: (t, resto) => `Participei da ação de divulgação “${t}”${resto}.`,
  formacao: (t, resto) => `Contribuí com a formação “${t}”${resto}.`,
  parceria: (t, resto) => `Participei da parceria “${t}”${resto}.`,
};

const TETO = 600; // = LIMITES.narrativaMax; literal para o módulo seguir puro

/**
 * Monta UMA frase factual a partir do que a pessoa declarou. Devolve null
 * quando não há de onde tirar — a tela então não mostra sugestão nenhuma.
 *
 * A frase NUNCA inventa: só título, veículo e ano que a própria pessoa acabou
 * de declarar (e que vieram do Crossref, na maioria). Adjetivo, impacto e
 * importância são da pessoa — sugestão pomposa em nome alheio é pior que caixa
 * vazia, porque 209 relatos iguais de "resultado expressivo" viram ruído.
 */
export function sugerirResultado(producoes: ItemParaSugestao[], fatos: FatoParaSugestao[]): string | null {
  const candidatas = producoes
    .filter((p) => p.titulo)
    .sort((a, b) => {
      const pa = PRIORIDADE.indexOf(a.tipo);
      const pb = PRIORIDADE.indexOf(b.tipo);
      const na = pa === -1 ? PRIORIDADE.length : pa;
      const nb = pb === -1 ? PRIORIDADE.length : pb;
      if (na !== nb) return na - nb;
      return (b.ano ?? 0) - (a.ano ?? 0); // mais recente primeiro
    });

  const p = candidatas[0];
  if (p && p.titulo) {
    const partes = [p.veiculo, p.ano ? String(p.ano) : null].filter(Boolean);
    const resto = partes.length ? ` (${partes.join(", ")})` : "";
    const modelo = MODELO_PRODUCAO[p.tipo] ?? ((t: string, r: string) => `Registramos a produção “${t}”${r}.`);
    return aparar(modelo(p.titulo, resto));
  }

  const f = fatos.filter((x) => x.titulo)[0];
  if (f) {
    const ano = f.ocorridoEm ? f.ocorridoEm.slice(0, 4) : null;
    const resto = ano ? ` (${ano})` : "";
    const modelo = MODELO_FATO[f.tipo] ?? ((t: string, r: string) => `Participei de “${t}”${r}.`);
    return aparar(modelo(f.titulo, resto));
  }

  return null;
}

/** Encurta pelo TÍTULO (com reticências), nunca cortando a frase no meio. */
function aparar(frase: string): string {
  if (frase.length <= TETO) return frase;
  const excesso = frase.length - TETO + 1;
  return frase.replace(/“([^”]+)”/, (_, t: string) => `“${t.slice(0, Math.max(8, t.length - excesso))}…”`);
}

/* ============== CONTADORES DA CONFERÊNCIA (Q10 e Q15–19 do Forms) ========= */
/**
 * O maior ganho de automação da integração com o Forms do CTC: as perguntas
 * "nº de estudantes por nível" (Q10) e "RH formados" (Q15–19) NÃO viram campos
 * de digitação — viram números SOMADOS dos fatos `formacao` e `bolsista` que a
 * equipe já declarou. O líder confere e, se discordar, sobrepõe com nota.
 *
 * AS REGRAS, ESCRITAS PARA PODEREM SER CONTESTADAS (mesmo espírito das
 * REGRAS_DE_PROJECAO de MeuLaboratorio.tsx):
 *
 *  • ESTUDANTES (Q10) = formações `em_andamento` (pelo campo `nivel`) +
 *    bolsas `implantada`/`em_curso` (pela sigla da `modalidade`). A MESMA
 *    pessoa pode estar nas duas — o payload não tem identificador de pessoa
 *    que permita deduplicar — então a sobreposição é DITA em tela e resolvida
 *    pelo ajuste humano, nunca por adivinhação.
 *  • RH FORMADOS (Q15–19) = formações `concluida_no_periodo`, por nível.
 *    ICJ e IC somam juntos na categoria IC — é como a própria proposta pactua
 *    ("alunos de iniciação científica (ICJ e IC) formados", Meta 23).
 *  • TCC (Q16) NÃO É CONTÁVEL: `NivelFormacao` (005) não tem "graduação/TCC".
 *    Contar "o que der" aqui seria contar zero fingindo precisão; a linha
 *    existe, diz por que está vazia e aceita o número do líder com nota.
 *    Aproximação honesta vence precisão inventada.
 *  • Bolsa vira nível SÓ quando a sigla é inequívoca: IC→IC, ICJ→ICJ,
 *    DTI-*→DTI, AT*→AT, PDJ/PDS→PD, GM→MS, GD→DR. As demais modalidades da
 *    quota (ITI, SET, ADC, EXP, EV) são de extensão/difusão/visitante, não têm
 *    nível de estudante no Forms e saem LISTADAS como fora da soma — sumir com
 *    elas em silêncio seria esconder dado.
 *  • Formação `tecnica`/`comunitaria` (ou sem nível) não é nível do Forms:
 *    conta num total à parte (`formacoesForaDosNiveis`), exibido como nota.
 *
 * Quem chama decide QUAIS fatos entram (confirmados, no período — o mesmo
 * recorte de toda a Conferência); esta função só soma. Pura e testável.
 */

/** Os 7 níveis da pergunta 10 do Forms. */
export type NivelEstudante = "ICJ" | "IC" | "AT" | "DTI" | "MS" | "DR" | "PD";
export const NIVEIS_ESTUDANTE: readonly NivelEstudante[] = ["ICJ", "IC", "AT", "DTI", "MS", "DR", "PD"];

/** As 5 categorias das perguntas 15–19 do Forms. */
export type CategoriaFormado = "IC" | "TCC" | "MS" | "DR" | "PD";
export const CATEGORIAS_FORMADO: readonly CategoriaFormado[] = ["IC", "TCC", "MS", "DR", "PD"];

/** O mínimo que a contagem precisa de um fato — `Fato` do banco encaixa direto. */
export type FatoParaContagem = {
  tipo: string;
  payload: Record<string, unknown>;
};

export type LinhaDeContagem<C extends string> = {
  chave: C;
  /** deFormacoes + deBolsas. O que a tela mostra como "somado dos fatos". */
  contado: number;
  deFormacoes: number;
  deBolsas: number;
  /** `false` = nenhum fato TEM o campo necessário; a linha explica em vez de fingir zero. */
  contavel: boolean;
  porQueNao?: string;
};

export type ContagemDaEquipe = {
  estudantes: LinhaDeContagem<NivelEstudante>[];
  formados: LinhaDeContagem<CategoriaFormado>[];
  /** Modalidades de bolsa ativas que não têm nível de estudante (ITI, SET, ADC…). */
  bolsasSemNivel: string[];
  /** Formações técnicas/comunitárias (ou sem nível): fora dos níveis do Forms. */
  formacoesForaDosNiveis: number;
};

const NIVEL_FORMACAO_PARA_ESTUDANTE: Record<string, NivelEstudante> = {
  ic_junior: "ICJ",
  ic: "IC",
  mestrado: "MS",
  doutorado: "DR",
  pos_doc: "PD",
};

const NIVEL_FORMACAO_PARA_FORMADO: Record<string, CategoriaFormado> = {
  ic_junior: "IC", // ICJ e IC somam juntos: é como a Meta 23 pactua
  ic: "IC",
  mestrado: "MS",
  doutorado: "DR",
  pos_doc: "PD",
};

const MOTIVO_TCC =
  "O fato de formação não tem o nível “graduação (TCC)”: informe o número à mão e avise a coordenação se ele importar.";

/**
 * Sigla de modalidade → nível de estudante. Só o inequívoco; o resto devolve
 * null e a tela lista a modalidade como fora da soma. A ordem dos prefixos
 * importa: ICJ antes de IC, e "AT" não captura "ADC" (prefixos de 2+ letras
 * conferidos contra as 17 siglas da quota: IC, ITI-A, SET-B/C/E/F/G, ADC-1A/1C,
 * DTI-A/B/C, EXP-1/3, EV-1/3, PDJ).
 */
export function nivelDaBolsa(modalidade: string): NivelEstudante | null {
  const s = modalidade.trim().toUpperCase();
  if (!s) return null;
  if (s === "ICJ" || s.startsWith("ICJ-")) return "ICJ";
  if (s === "IC" || s.startsWith("IC-")) return "IC";
  if (s === "AT" || s.startsWith("AT-") || s.startsWith("ATN")) return "AT";
  if (s.startsWith("DTI")) return "DTI";
  if (s === "GM" || s.startsWith("GM-")) return "MS";
  if (s === "GD" || s.startsWith("GD-")) return "DR";
  if (s === "PD" || s.startsWith("PDJ") || s.startsWith("PDS")) return "PD";
  return null;
}

function chaveTexto(payload: Record<string, unknown>, chave: string): string {
  const v = payload[chave];
  return typeof v === "string" ? v : "";
}

export function contarEstudantesEFormados(fatos: FatoParaContagem[]): ContagemDaEquipe {
  const estudantesF: Record<NivelEstudante, number> = { ICJ: 0, IC: 0, AT: 0, DTI: 0, MS: 0, DR: 0, PD: 0 };
  const estudantesB: Record<NivelEstudante, number> = { ICJ: 0, IC: 0, AT: 0, DTI: 0, MS: 0, DR: 0, PD: 0 };
  const formadosF: Record<CategoriaFormado, number> = { IC: 0, TCC: 0, MS: 0, DR: 0, PD: 0 };
  const bolsasSemNivel: string[] = [];
  let formacoesForaDosNiveis = 0;

  for (const f of fatos) {
    if (f.tipo === "formacao") {
      const nivel = chaveTexto(f.payload, "nivel");
      const situacao = chaveTexto(f.payload, "situacao");
      if (situacao === "em_andamento") {
        const chave = NIVEL_FORMACAO_PARA_ESTUDANTE[nivel];
        if (chave) estudantesF[chave] += 1;
        else formacoesForaDosNiveis += 1;
      } else if (situacao === "concluida_no_periodo") {
        const cat = NIVEL_FORMACAO_PARA_FORMADO[nivel];
        if (cat) formadosF[cat] += 1;
        else formacoesForaDosNiveis += 1;
      }
      // `interrompida` não é estudante atual nem formado: fica fora, de propósito.
    } else if (f.tipo === "bolsista") {
      const situacao = chaveTexto(f.payload, "situacao");
      if (situacao !== "implantada" && situacao !== "em_curso") continue;
      const modalidade = chaveTexto(f.payload, "modalidade");
      const chave = nivelDaBolsa(modalidade);
      if (chave) estudantesB[chave] += 1;
      else if (modalidade && !bolsasSemNivel.includes(modalidade)) bolsasSemNivel.push(modalidade);
    }
  }

  return {
    estudantes: NIVEIS_ESTUDANTE.map((chave) => ({
      chave,
      contado: estudantesF[chave] + estudantesB[chave],
      deFormacoes: estudantesF[chave],
      deBolsas: estudantesB[chave],
      contavel: true,
    })),
    formados: CATEGORIAS_FORMADO.map((chave) => ({
      chave,
      contado: formadosF[chave],
      deFormacoes: formadosF[chave],
      deBolsas: 0,
      contavel: chave !== "TCC",
      ...(chave === "TCC" ? { porQueNao: MOTIVO_TCC } : {}),
    })),
    bolsasSemNivel,
    formacoesForaDosNiveis,
  };
}

/* --------------- o ajuste do líder, persistido em `respostas` ------------- */
/**
 * O que persiste NÃO é a contagem (ela é reproduzível a partir dos fatos) — é
 * só a DIVERGÊNCIA declarada pelo líder: valor sobreposto e nota. Mora em
 * `relatos.respostas.contadores` (jsonb da 009, decisão 10 do
 * docs/relato-gforms.md): nenhuma coluna nova, e o mesmo relato único que o
 * LLA assina.
 */
export type AjusteDeContador = { valor: number; nota?: string };

export type ContadoresAjustes = {
  estudantes?: Partial<Record<NivelEstudante, AjusteDeContador>>;
  formados?: Partial<Record<CategoriaFormado, AjusteDeContador>>;
};

/**
 * `RespostasRelato` (types.ts) declara as chaves do formulário individual;
 * `contadores` é a chave do formulário do LABORATÓRIO no MESMO jsonb. O
 * alargamento é local deste módulo de propósito: o banco não distingue, e o
 * tipo de types.ts segue sendo o contrato do individual.
 */
export type RespostasComContadores = RespostasRelato & { contadores?: ContadoresAjustes };

/** Um grupo vazio some do jsonb: `{}` é mais honesto do que `{estudantes:{}}`. */
export function limparAjustes(ajustes: ContadoresAjustes): ContadoresAjustes | undefined {
  const saida: ContadoresAjustes = {};
  if (ajustes.estudantes && Object.keys(ajustes.estudantes).length) saida.estudantes = ajustes.estudantes;
  if (ajustes.formados && Object.keys(ajustes.formados).length) saida.formados = ajustes.formados;
  return Object.keys(saida).length ? saida : undefined;
}

/**
 * O valor que o relatório usa para uma linha: o ajuste do líder quando existe,
 * senão o contado. É A função que o export/consolidação deve chamar — para a
 * tela e o dado nunca divergirem.
 */
export function valorDaLinha(contado: number, ajuste: AjusteDeContador | undefined): number {
  return ajuste ? ajuste.valor : contado;
}

/** O patch de narrativas que um toque numa opção produz. */
export function alternarCategoria(
  atual: Narrativas,
  campo: "dificuldades_categorias" | "oportunidades_categorias",
  id: string,
): Partial<Narrativas> {
  const lista = atual[campo] ?? [];
  const nova = lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
  return { [campo]: nova };
}
