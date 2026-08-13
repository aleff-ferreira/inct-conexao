/**
 * Deduplicação de produção: a chave de âncora, do lado do cliente.
 *
 * POR QUE ISTO EXISTE, E POR QUE É PERIGOSO
 * ------------------------------------------------------------------------
 * A unicidade real mora no banco, no índice `producoes_ancora_unica`
 * (005_relatos.sql), e é ele que impede que 4 coautores da rede virem 4 artigos
 * na Tabela A do CNPq. O cliente calcula a MESMA chave por dois motivos:
 * mostrar "este trabalho já foi registrado por outro membro da rede" antes de
 * gravar, e não empilhar duplicata dentro de um mesmo "colar vários de uma vez".
 *
 * Se as duas normalizações divergirem, o modo de falha é o pior possível: o
 * cliente diz "novo", a pessoa preenche o item inteiro, e o INSERT morre no
 * UNIQUE com um erro do Postgres na cara de quem só queria declarar um artigo.
 * Por isso a função abaixo é uma TRANSCRIÇÃO LITERAL da expressão SQL — não uma
 * reimplementação "equivalente" — e por isso `tests/relato.test.ts` lê o
 * 005_relatos.sql e confere que o texto do índice continua sendo este.
 *
 * A DIVISÃO DE TRABALHO COM `validation.ts`
 * ------------------------------------------------------------------------
 * `normalizarDoi()` (validation.ts) limpa o que a PESSOA colou — inclusive
 * espaço INTERNO, que é como o PDF quebra um DOI em duas linhas.
 * `chaveAncora()` (aqui) reproduz o que o BANCO faz com o valor gravado — e o
 * banco NÃO remove espaço interno: a expressão do índice só tira o prefixo do
 * resolvedor e baixa a caixa.
 *
 * Logo: limpe ANTES de gravar (`valorParaGravar`), e a chave do cliente passa a
 * bater com a do banco sempre. Gravar o texto cru e torcer para as chaves
 * coincidirem é que produz "10.1590/ abc" e "10.1590/abc" como dois trabalhos.
 */

import { normalizarDoi, normalizarIsbn, RE_DOI } from "./validation";

/** `producoes.ancora_tipo`, valores do CHECK no 005_relatos.sql. */
export const ANCORA_TIPOS = ["doi", "isbn", "issn_pagina", "inpi", "url_com_captura", "arquivo_sha256"] as const;
export type AncoraTipo = (typeof ANCORA_TIPOS)[number];

/**
 * Os dois fragmentos LITERAIS do 005_relatos.sql. Existem como constante para o
 * teste poder conferir contra o arquivo de migração: se alguém mudar a
 * expressão no banco sem mudar aqui, a suíte quebra na hora, e não em produção
 * na forma de um UNIQUE violado.
 */
export const SQL_ANCORA_ISBN = String.raw`regexp_replace(ancora_valor, '[^0-9Xx]', '', 'g')`;
export const SQL_ANCORA_OUTROS = String.raw`regexp_replace(ancora_valor, '^\s*(https?://(dx\.)?doi\.org/|doi:)\s*', '', 'i')`;

/**
 * `\s` do Postgres é `[[:space:]]`: espaço, \t, \n, \v, \f, \r — e SÓ.
 * O `\s` do JavaScript inclui ainda NBSP, U+2028/29, BOM e os espaços Unicode.
 * Escrever `\s` aqui faria o cliente comer um NBSP que o banco preserva, e as
 * duas chaves divergiriam justamente no caractere que vem colado de PDF. A
 * classe é explícita de propósito.
 */
const ESPACO_POSIX = "[ \\t\\n\\v\\f\\r]";
const PREFIXO_RESOLVEDOR = new RegExp(`^${ESPACO_POSIX}*(https?://(dx\\.)?doi\\.org/|doi:)${ESPACO_POSIX}*`, "i");
const NAO_ISBN = /[^0-9Xx]/g;

/**
 * A chave de deduplicação, idêntica à do índice `producoes_ancora_unica` e à da
 * RPC `checar_ancora`:
 *
 *   lower(case when ancora_tipo = 'isbn'
 *              then regexp_replace(ancora_valor, '[^0-9Xx]', '', 'g')
 *              else regexp_replace(ancora_valor, '^\s*(https?://(dx\.)?doi\.org/|doi:)\s*', '', 'i')
 *         end)
 *
 * Note o que ela NÃO faz, porque o banco também não faz: não tira espaço
 * interno, não tira pontuação final, não decodifica percent-encoding.
 */
export function chaveAncora(tipo: AncoraTipo, valor: string): string {
  const bruto = tipo === "isbn" ? valor.replace(NAO_ISBN, "") : valor.replace(PREFIXO_RESOLVEDOR, "");
  return bruto.toLowerCase();
}

/** Dois valores apontam para o mesmo trabalho? (mesma pergunta que o UNIQUE faz) */
export function mesmaAncora(tipo: AncoraTipo, a: string, b: string): boolean {
  return chaveAncora(tipo, a) === chaveAncora(tipo, b);
}

/**
 * O valor a gravar em `producoes.ancora_valor`.
 *
 * O comentário do 005 diz que a coluna preserva o valor digitado, e é verdade —
 * a chave é que normaliza. Mas há UMA sujeira que a chave não remove e que
 * portanto tem de morrer antes de gravar: o espaço (e os invisíveis) NO MEIO do
 * identificador. `regexp_replace(..., '^\s*(prefixo)\s*', ...)` só come espaço
 * colado ao prefixo; "10.1590/ abc" e "10.1590/abc" seriam duas produções, dois
 * artigos na Tabela A do CNPq, e ninguém entenderia por quê.
 *
 * Para `doi` o resultado é ponto fixo de `chaveAncora`: aplicar a expressão do
 * banco nele devolve ele mesmo. Para `isbn` a caixa do X final é irrelevante,
 * porque cliente e banco baixam a caixa na chave.
 */
export function valorParaGravar(tipo: AncoraTipo, bruto: string): string {
  if (tipo === "doi") return normalizarDoi(bruto);
  if (tipo === "isbn") return normalizarIsbn(bruto);
  return bruto.trim();
}

// ============================================================ colar vários

/**
 * Reconhece o que foi colado. Ordem importa: um ISBN-13 começa com 978/979 e
 * jamais casa com a forma do DOI, mas uma URL do doi.org casa com as duas
 * leituras se a de DOI não vier primeiro.
 */
export function detectarTipoAncora(bruto: string): AncoraTipo | null {
  const texto = bruto.trim();
  if (!texto) return null;
  if (RE_DOI.test(normalizarDoi(texto))) return "doi";
  // Só dígitos, X, hífen e espaço depois do rótulo opcional — senão
  // "https://exemplo.org/1234567890" viraria um ISBN de 10 dígitos.
  const semRotulo = texto.replace(/^isbn[-\s:]*(?:13|10)?[-\s:]*/i, "");
  if (/^[0-9Xx \-\u2010-\u2015\u00a0]+$/.test(semRotulo)) {
    const isbn = normalizarIsbn(semRotulo);
    if (isbn.length === 10 || isbn.length === 13) return "isbn";
  }
  if (/^https?:\/\/\S+$/i.test(texto)) return "url_com_captura";
  return null;
}

export type EntradaColada = {
  /** Linha como a pessoa colou — preservada para a tela poder mostrar o que não deu certo. */
  readonly bruto: string;
  readonly tipo: AncoraTipo | null;
  /** Valor pronto para gravar; vazio quando não deu para reconhecer. */
  readonly valor: string;
  readonly chave: string;
};

export type ListaColada = {
  readonly unicos: EntradaColada[];
  /** Repetidos DENTRO da própria colagem (a mesma referência duas vezes no PDF). */
  readonly repetidos: EntradaColada[];
  /** Linhas que não têm forma de identificador nenhum — viram registro manual. */
  readonly naoReconhecidos: EntradaColada[];
};

/**
 * "Colar vários de uma vez" (Tela 2, §3.1): um por linha. Nada é descartado —
 * o que não foi reconhecido volta rotulado, porque perder o que a pessoa colou
 * é pior do que não resolver o metadado (princípio de degradação da apuração
 * das APIs).
 */
export function separarColagem(texto: string): ListaColada {
  const linhas = texto.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const vistos = new Set<string>();
  const unicos: EntradaColada[] = [];
  const repetidos: EntradaColada[] = [];
  const naoReconhecidos: EntradaColada[] = [];

  for (const bruto of linhas) {
    const tipo = detectarTipoAncora(bruto);
    if (!tipo) {
      naoReconhecidos.push({ bruto, tipo: null, valor: "", chave: "" });
      continue;
    }
    const valor = valorParaGravar(tipo, bruto);
    const chave = `${tipo}:${chaveAncora(tipo, valor)}`;
    const entrada: EntradaColada = { bruto, tipo, valor, chave };
    if (vistos.has(chave)) repetidos.push(entrada);
    else {
      vistos.add(chave);
      unicos.push(entrada);
    }
  }
  return { unicos, repetidos, naoReconhecidos };
}

// ======================================================= resposta do banco

/**
 * O jsonb que a RPC `checar_ancora(p_ciclo, p_tipo, p_valor)` devolve.
 *
 * Repare no que NÃO vem: o nome de quem declarou primeiro. Isso é decisão de
 * banco (§1.4), não de tela — `producoes` é legível por qualquer membro do
 * ciclo porque é a base do dedupe, então expor o declarante ali vazaria "quem
 * declarou o quê" para a rede inteira via PostgREST. O nome só aparece depois
 * que o segundo confirma a coautoria, e aí vem de `producao_autores`.
 */
export type ChecagemAncora =
  | { readonly existe: false }
  | {
      readonly existe: true;
      readonly producao_id: string;
      readonly tipo: string;
      readonly ano: number | null;
      readonly titulo: string;
      readonly ja_declarado_por_membro: boolean;
    };

/** Lê o jsonb da RPC com desconfiança (é `unknown` na fronteira da rede). */
export function lerChecagemAncora(bruto: unknown): ChecagemAncora {
  if (!bruto || typeof bruto !== "object") return { existe: false };
  const o = bruto as Record<string, unknown>;
  if (o.existe !== true) return { existe: false };
  return {
    existe: true,
    producao_id: String(o.producao_id ?? ""),
    tipo: String(o.tipo ?? ""),
    ano: typeof o.ano === "number" ? o.ano : null,
    titulo: String(o.titulo ?? ""),
    ja_declarado_por_membro: o.ja_declarado_por_membro === true,
  };
}

/**
 * A frase da Tela 2 quando a âncora já existe. O segundo declarante NUNCA é
 * bloqueado (§4.5): ele confirma a coautoria e ganha um vínculo; a contagem
 * segue rodando uma vez só, na canônica.
 */
export function mensagemDedupe(c: ChecagemAncora): string {
  if (!c.existe) return "";
  const titulo = c.titulo ? `“${c.titulo}”` : "Este trabalho";
  return `${titulo} já foi registrado por outro membro da rede. Você é coautor(a)?`;
}
