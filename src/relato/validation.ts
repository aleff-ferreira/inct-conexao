/**
 * Validações puras do formulário de relato anual (§3.3 da especificação).
 *
 * TUDO AQUI É PURO E LOCAL: nenhuma função desta arquivo vai à rede. O ORCID,
 * o ISBN e o DOI são conferidos no navegador antes de qualquer chamada — quem
 * digitou errado descobre em 0 ms, e a fila do `metadados.ts` só recebe entrada
 * que já tem forma de identificador.
 *
 * AS MENSAGENS SÃO CONTRATO. As strings de `MENSAGENS` foram escritas na
 * especificação (§3.3) e revisadas com a coordenação; elas dizem à pessoa o que
 * fazer em seguida. Trocá-las por "campo inválido" é regressão de produto, não
 * refatoração. Onde a especificação deixou a mensagem em branco ("—" na tabela)
 * o texto foi escrito aqui, no mesmo registro: primeiro o que está errado,
 * depois o caminho de saída.
 *
 * DATAS SÃO COMPARADAS COMO STRING. `"2026-05-01" > "2026-04-30"` é verdadeiro
 * em ISO-8601, e string não tem fuso. Construir `new Date("2026-05-01")` num
 * navegador em Porto Velho (UTC-4) devolve 30/04 às 20h — que é exatamente o
 * erro capaz de jogar um item do Ciclo 1 para fora do ciclo. Nenhuma comparação
 * de competência passa por objeto Date.
 */

// ============================================================ tipos e período

/** Janela reportável, no mesmo formato de `relatorio_ciclos.periodo_*`. */
export type Periodo = { readonly inicio: string; readonly fim: string };

/**
 * Ciclo 1, e só ele (decisão 3 do dono, §8.4). Fica aqui como valor de
 * conveniência para tela e teste; em produção o período vem do banco, porque
 * `relatorio_ciclos` é a fonte e o Ciclo 2 vai existir um dia.
 */
export const PERIODO_CICLO_1: Periodo = { inicio: "2025-05-01", fim: "2026-04-30" };

/**
 * Os mesmos quatro valores de `situacao_da_data()` no 005_relatos.sql, mais
 * `futura` e `invalida`, que existem SÓ no cliente: o banco nunca os vê porque
 * a tela recusa a data antes de gravar. Se um deles escapasse, o banco
 * classificaria a data futura como `posterior`.
 */
export type SituacaoPeriodo = "no_periodo" | "linha_de_base" | "posterior" | "sem_data";
export type SituacaoData = SituacaoPeriodo | "futura" | "invalida";

/** Resultado padrão: `valor` é a forma normalizada, pronta para gravar. */
export type Validacao = {
  readonly ok: boolean;
  /** Valor canônico a gravar (vazio quando o campo é opcional e veio vazio). */
  readonly valor: string;
  /** Vazio quando `ok`. Nunca técnica, nunca em inglês. */
  readonly mensagem: string;
};

const ok = (valor: string): Validacao => ({ ok: true, valor, mensagem: "" });
const erro = (valor: string, mensagem: string): Validacao => ({ ok: false, valor, mensagem });

// ==================================================================== limites

/** Limites que o banco também impõe (005_relatos.sql). Cliente e banco iguais. */
export const LIMITES = {
  /** `relato_arquivos.bytes <= 1048576` e o file_size_limit do bucket. */
  arquivoBytes: 1048576,
  /** `relato_arquivos.mime` check + allowed_mime_types do bucket `relatos`. */
  mimes: ["application/pdf", "image/jpeg", "image/png"] as const,
  /** §1.3: máx. 3 imagens por item, teto de 12 arquivos por relato. */
  imagensPorItem: 3,
  arquivosPorRelato: 12,
  /** `fatos.titulo` between 3 and 140. */
  tituloMin: 3,
  tituloMax: 140,
  /** `relatos_resultado`: between 20 and 600 quando o relato é enviado. */
  narrativaMin: 20,
  narrativaMax: 600,
  /** §2.6: texto para não especialistas. */
  naoEspecialistasMax: 400,
  /** §2.6: os quatro campos do PICC, só LLA/CGES. */
  narrativaLlaMax: 1200,
} as const;

export type MimeAceito = (typeof LIMITES.mimes)[number];

// ================================================================= mensagens

export const MENSAGENS = {
  /** §3.3, literal. */
  orcidChecksum: "Esse ORCID não confere: o último dígito não bate. Confira em orcid.org.",
  /** Escrita aqui: a tabela da §3.3 só previu a falha de checksum. */
  orcidFormato: "O ORCID tem 16 dígitos, no formato 0000-0000-0000-0000 (o último pode ser X).",
  /** §3.3, literal. */
  lattes: "O ID Lattes tem 16 números.",
  /**
   * §3.3, literal. Vale tanto para o que não tem forma de DOI quanto para o que
   * a cadeia de provedores não resolveu: em ambos os casos a saída é a mesma —
   * conferir ou registrar à mão — e duas mensagens para uma saída só é ruído.
   */
  doi: "Não encontramos esse DOI. Confira, ou registre à mão.",
  /** §3.3 deixou "—". */
  isbnDigito: "Esse ISBN não confere: o dígito verificador não bate. Confira a contracapa.",
  isbnTamanho: "O ISBN tem 10 ou 13 números.",
  /** §3.3 deixou "—". "nunca texto livre" é a regra; a busca é a saída. */
  ror: "Escolha a instituição na busca: o identificador ROR tem a forma 0xxxxxxxx e não é digitado à mão.",
  /** §3.3, literal. */
  dataFutura: "Essa data ainda não chegou.",
  /** §3.3, literal. */
  dataLinhaDeBase: "Isso é de antes do INCT começar: entra como linha de base.",
  /** Decisão 3 do dono (§8.4): aceito com a data verdadeira, marcado, não conta. */
  dataPosterior: "Isso é de depois do período deste ciclo: guardamos para o próximo relatório, e não entra na contagem deste.",
  dataInvalida: "Essa data não existe. Confira o dia e o mês.",
  dataAusente: "Informe a data.",
  /** §3.3, literal. */
  resultadoCurto: "Escreva pelo menos uma frase.",
  resultadoLongo: "Passou de 600 caracteres.",
  /** §3.3: erro no topo, com link que move o foco. */
  veracidade: "Marque a declaração de veracidade para enviar.",
  /** Literal do trigger `relatos_exige_cessao` no 005_relatos.sql: banco e tela dizem a mesma frase. */
  cessaoImagem: "Há imagem anexada: é preciso autorizar o uso das imagens para enviar.",
  arquivoTipo: "Envie JPEG, PNG ou PDF.",
  arquivoTamanho: "O arquivo passa de 1 MB mesmo depois da compressão. Envie uma versão menor.",
  uf: "A UF tem duas letras (ex.: RO).",
  titulo: "O título tem de 3 a 140 caracteres: uma linha dizendo o quê.",
  /**
   * Campos do Forms do CTC (009). Escritas aqui porque a §3.3 é anterior ao
   * questionário; mesmo registro das demais: o que está errado + a saída.
   */
  inteiro: "Use só números inteiros, sem sinal (ex.: 12).",
  jcr: "O fator de impacto é um número, como 3,2 (vírgula ou ponto no decimal).",
  valorBrl: "Informe o valor aproximado em reais, só números (ex.: 150000).",
  satisfacao: "A satisfação vai de 1 a 5.",
} as const;

/** Data ISO em pt-BR sem passar por Date (e portanto sem fuso). */
export function dataBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// ====================================================================== ORCID

/**
 * Só dígitos e X, sem cortar. O corte de tamanho é da MÁSCARA, nunca da
 * validação: truncar em 16 aqui faria "0000-0002-1825-00977" (um dígito a mais,
 * o erro de digitação mais comum depois do último dígito) virar silenciosamente
 * o ORCID de OUTRA pessoa — que passa no checksum e nunca mais é questionado.
 */
function digitosOrcid(bruto: string): string {
  const limpo = bruto.trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, "");
  return limpo.replace(/[^0-9Xx]/g, "").toUpperCase();
}

/** Aplica a máscara 0000-0000-0000-000X progressivamente (para o onChange). */
export function mascararOrcid(bruto: string): string {
  const d = digitosOrcid(bruto).slice(0, 16); // aqui o corte é o maxlength do campo
  return (d.match(/.{1,4}/g) ?? []).join("-");
}

/**
 * ISO 7064 MOD 11-2, o algoritmo publicado pelo próprio ORCID.
 * total = (total + dígito) * 2 sobre os 15 primeiros; o verificador é
 * (12 - total mod 11) mod 11, com 10 grafado `X`.
 */
export function digitoVerificadorOrcid(quinzeDigitos: string): string {
  let total = 0;
  for (const c of quinzeDigitos) total = (total + Number(c)) * 2;
  const resto = (12 - (total % 11)) % 11;
  return resto === 10 ? "X" : String(resto);
}

/** Checksum puro, sem julgar formato. Use `validarOrcid` na tela. */
export function orcidChecksumOk(bruto: string): boolean {
  const d = digitosOrcid(bruto);
  if (!/^[0-9]{15}[0-9X]$/.test(d)) return false;
  return digitoVerificadorOrcid(d.slice(0, 15)) === d[15];
}

/**
 * ORCID é OPCIONAL (§2.2): vazio é válido e devolve valor vazio. Preenchido,
 * sai no formato que a constraint `ciclo_membros_orcid` exige.
 */
export function validarOrcid(bruto: string): Validacao {
  const cru = bruto.trim();
  if (!cru) return ok("");
  const d = digitosOrcid(cru);
  // Erro de forma devolve o que a pessoa digitou, inteiro: mascarar aqui
  // esconderia o dígito sobrando e o campo passaria a mentir sobre o problema.
  if (!/^[0-9]{15}[0-9X]$/.test(d)) return erro(cru, MENSAGENS.orcidFormato);
  if (digitoVerificadorOrcid(d.slice(0, 15)) !== d[15]) return erro(mascararOrcid(d), MENSAGENS.orcidChecksum);
  return ok(mascararOrcid(d));
}

// ===================================================================== Lattes

/** 16 dígitos, sem checksum público (§3.3). Opcional: vazio é válido. */
export function validarLattes(bruto: string): Validacao {
  const cru = bruto.trim();
  if (!cru) return ok("");
  const d = cru.replace(/\D/g, "");
  return /^[0-9]{16}$/.test(d) ? ok(d) : erro(d, MENSAGENS.lattes);
}

// ======================================================================== DOI

/**
 * Espaco em branco mais os invisiveis que o copiar-e-colar de PDF traz junto:
 * NBSP (U+00A0), hifen condicional (U+00AD), zero-width space/non-joiner/joiner
 * (U+200B-U+200D), word joiner (U+2060) e BOM (U+FEFF). Todos ja foram vistos
 * grudados em DOI colado de artigo.
 */
const RE_INVISIVEIS = /[\s\u00a0\u00ad\u200b-\u200d\u2060\ufeff]/g;

/** Forma que a especificação manda casar (§3.3). */
export const RE_DOI = /^10\.\d{4,9}\/\S+$/;

/**
 * Normaliza o que a pessoa colou:
 *  • tira o prefixo do resolvedor (`https://doi.org/`, `http://dx.doi.org/`, `doi:`);
 *  • baixa a caixa (o DOI é case-insensitive na rota do Crossref — verificado);
 *  • remove TODO espaço, inclusive o interno, que é como o PDF cola o DOI
 *    quebrado em duas linhas, e os invisíveis que vêm junto (NBSP, hífen
 *    condicional, zero-width).
 *
 * O espaço INTERNO é o ponto sensível: a normalização do banco (índice
 * `producoes_ancora_unica`) NÃO o remove. Por isso quem grava tem de gravar já
 * limpo — ver `dedupe.ts`, que explica a divisão de trabalho.
 */
export function normalizarDoi(bruto: string): string {
  return bruto
    .replace(RE_INVISIVEIS, "")
    .replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .toLowerCase();
}

/** Forma, não existência. Quem confere existência é `metadados.resolverDoi`. */
export function validarDoi(bruto: string): Validacao {
  const doi = normalizarDoi(bruto);
  if (!doi) return erro("", MENSAGENS.doi);
  return RE_DOI.test(doi) ? ok(doi) : erro(doi, MENSAGENS.doi);
}

// ======================================================================= ISBN

/** Só dígitos e X final (o mesmo ISBN com e sem hífen é um só). */
export function normalizarIsbn(bruto: string): string {
  return bruto.replace(/[^0-9Xx]/g, "").toUpperCase();
}

export function isbn10Ok(d: string): boolean {
  if (!/^[0-9]{9}[0-9X]$/.test(d)) return false;
  let total = 0;
  for (let i = 0; i < 9; i++) total += Number(d[i]) * (10 - i);
  const resto = (11 - (total % 11)) % 11;
  return (resto === 10 ? "X" : String(resto)) === d[9];
}

export function isbn13Ok(d: string): boolean {
  if (!/^[0-9]{13}$/.test(d)) return false;
  let total = 0;
  for (let i = 0; i < 12; i++) total += Number(d[i]) * (i % 2 ? 3 : 1);
  return String((10 - (total % 10)) % 10) === d[12];
}

/** ISBN-10 ou ISBN-13 com dígito verificador (§3.3). Opcional: vazio é válido. */
export function validarIsbn(bruto: string): Validacao {
  const cru = bruto.trim();
  if (!cru) return ok("");
  const d = normalizarIsbn(cru);
  if (d.length !== 10 && d.length !== 13) return erro(d, MENSAGENS.isbnTamanho);
  const valido = d.length === 10 ? isbn10Ok(d) : isbn13Ok(d);
  return valido ? ok(d) : erro(d, MENSAGENS.isbnDigito);
}

// ======================================================================== ROR

/** Forma exata da §3.3 e das constraints `*_ror` do 005_relatos.sql. */
export const RE_ROR = /^0[a-z0-9]{8}$/;

/** Guarda-se o id NU: `https://ror.org/02842cb31` vira `02842cb31`. */
export function normalizarRor(bruto: string): string {
  return bruto.trim().replace(/^https?:\/\/(www\.)?ror\.org\//i, "").toLowerCase();
}

/**
 * Forma apenas — de propósito. O ROR carrega checksum MOD 97-10, mas o banco
 * (constraint `ciclo_membros_ror`) só confere a forma: um cliente mais estrito
 * que o banco recusaria valor que o banco aceita, e a divergência apareceria
 * como "o sistema não deixa salvar o que já está salvo".
 */
export function validarRor(bruto: string): Validacao {
  const cru = bruto.trim();
  if (!cru) return ok("");
  const id = normalizarRor(cru);
  return RE_ROR.test(id) ? ok(id) : erro(id, MENSAGENS.ror);
}

export function validarUf(bruto: string): Validacao {
  const cru = bruto.trim();
  if (!cru) return ok("");
  const uf = cru.toUpperCase();
  return /^[A-Z]{2}$/.test(uf) ? ok(uf) : erro(uf, MENSAGENS.uf);
}

// ====================================================================== datas

/** Data de calendário real: 2026-02-30 é forma válida e data inexistente. */
export function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Hoje no relógio de quem preenche (é o que define "essa data ainda não chegou"). */
export function hojeIso(agora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

/** Fato com precisão de mês entra como dia 1 (§2.4). */
export function dataDoMes(ano: number, mes: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-01`;
}

export type AvaliacaoData = {
  readonly situacao: SituacaoData;
  /** `false` só para data futura ou inexistente — o resto é sempre aceito. */
  readonly aceita: boolean;
  /** `true` quando o item entra nas contagens do ciclo. */
  readonly contaNoCiclo: boolean;
  readonly mensagem: string;
};

/**
 * As três situações da §3.3 mais a decisão 3 do dono (§8.4).
 *
 * futura        → RECUSADA. É a única recusa de data do sistema.
 * linha_de_base → aceita, não conta; é "o que já existia" (§5.4).
 * no_periodo    → aceita e conta.
 * posterior     → ACEITA COM A DATA VERDADEIRA, marcada, fora de contagem.
 *
 * O `posterior` é a regra que existe para não criar incentivo a mentir: hoje é
 * agosto/2026 e o período fechou em abril/2026, então uma expedição de junho é
 * caso corrente. Recusar empurraria a pessoa a recuar a data para caber na
 * janela — corrompendo exatamente o dado que o CNPq vai auditar. Espelha
 * `situacao_da_data()` no 005_relatos.sql, onde `ciclo_competencia_id` fica
 * nulo e o item aguarda o Ciclo 2.
 */
export function avaliarData(
  iso: string,
  periodo: Periodo = PERIODO_CICLO_1,
  hoje: string = hojeIso(),
): AvaliacaoData {
  const cru = iso.trim();
  if (!cru) return { situacao: "sem_data", aceita: true, contaNoCiclo: false, mensagem: MENSAGENS.dataAusente };
  if (!dataValida(cru)) return { situacao: "invalida", aceita: false, contaNoCiclo: false, mensagem: MENSAGENS.dataInvalida };
  if (cru > hoje) return { situacao: "futura", aceita: false, contaNoCiclo: false, mensagem: MENSAGENS.dataFutura };
  if (cru < periodo.inicio) return { situacao: "linha_de_base", aceita: true, contaNoCiclo: false, mensagem: MENSAGENS.dataLinhaDeBase };
  if (cru > periodo.fim) return { situacao: "posterior", aceita: true, contaNoCiclo: false, mensagem: MENSAGENS.dataPosterior };
  return { situacao: "no_periodo", aceita: true, contaNoCiclo: true, mensagem: "" };
}

/** A situação como o banco a grava, sem os estados que só o cliente conhece. */
export function situacaoDoBanco(s: SituacaoData): SituacaoPeriodo {
  if (s === "futura") return "posterior";
  if (s === "invalida") return "sem_data";
  return s;
}

// ================================================================= narrativas

export function contarCaracteres(texto: string): number {
  return Array.from(texto.trim()).length;
}

/** 20–600 caracteres (§3.3 e a constraint `relatos_resultado`). */
export function validarResultadoPrincipal(texto: string): Validacao {
  const t = texto.trim();
  const n = contarCaracteres(t);
  if (n < LIMITES.narrativaMin) return erro(t, MENSAGENS.resultadoCurto);
  if (n > LIMITES.narrativaMax) return erro(t, `${MENSAGENS.resultadoLongo} Corte ${n - LIMITES.narrativaMax}.`);
  return ok(t);
}

/** Campo de texto livre com teto — vazio é válido (todos os demais são opcionais). */
export function validarTextoOpcional(texto: string, maximo: number): Validacao {
  const t = texto.trim();
  const n = contarCaracteres(t);
  if (n > maximo) return erro(t, `Passou de ${maximo} caracteres. Corte ${n - maximo}.`);
  return ok(t);
}

export function validarTitulo(texto: string): Validacao {
  const t = texto.trim();
  const n = contarCaracteres(t);
  return n >= LIMITES.tituloMin && n <= LIMITES.tituloMax ? ok(t) : erro(t, MENSAGENS.titulo);
}

// ===================================================================== envio

/** Obrigatória para `status='enviado'` (constraint `relatos_veracidade`). */
export function validarVeracidade(marcado: boolean): Validacao {
  return marcado ? ok("true") : erro("false", MENSAGENS.veracidade);
}

/** Obrigatória APENAS se houver arquivo com uso `imagem_publicavel`. */
export function validarCessaoImagem(marcado: boolean, temImagemPublicavel: boolean): Validacao {
  if (!temImagemPublicavel) return ok(marcado ? "true" : "false");
  return marcado ? ok("true") : erro("false", MENSAGENS.cessaoImagem);
}

export type ArquivoParaValidar = { readonly mime: string; readonly bytes: number };

/** ≤ 1 MB pós-compressão, jpeg/png/pdf (§3.3 e o bucket `relatos`). */
export function validarArquivo(a: ArquivoParaValidar): Validacao {
  if (!(LIMITES.mimes as readonly string[]).includes(a.mime)) return erro(a.mime, MENSAGENS.arquivoTipo);
  if (a.bytes > LIMITES.arquivoBytes) return erro(a.mime, MENSAGENS.arquivoTamanho);
  return ok(a.mime);
}

/** SHA-256 em hex minúsculo — o formato que `relato_arquivos_sha` aceita. */
export const RE_SHA256 = /^[0-9a-f]{64}$/;

/**
 * SHA-256 calculado no navegador antes de subir (§3.3). Exige contexto seguro:
 * `crypto.subtle` não existe em http://, e a ausência tem de ser tratada pela
 * tela como "sem hash", nunca como falha de upload.
 */
export async function sha256Hex(dados: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ===================================== campos do Forms do CTC (migração 009)
/*
 * Todos OPCIONAIS por decisão do contrato (docs/relato-gforms.md, decisões
 * 2 e 3): JCR, Qualis, índice H e citações são manuais porque não há base
 * pública confiável para derivá-los — e fingir derivação seria pior que pedir.
 * Vazio é sempre válido; nada aqui trava o envio.
 */

/**
 * Inteiro não negativo opcional (índice H, total de citações). Aceita ponto de
 * milhar ("1.234") porque é assim que o Scholar exibe e a pessoa copia.
 */
export function validarInteiroOpcional(bruto: string): Validacao {
  const cru = bruto.trim();
  if (!cru) return ok("");
  const d = cru.replace(/[.\s]/g, "");
  if (!/^\d{1,9}$/.test(d)) return erro(cru, MENSAGENS.inteiro);
  return ok(String(Number(d)));
}

/**
 * JCR (fator de impacto): decimal positivo, vírgula OU ponto — quem copia da
 * Clarivate cola "3.2", quem digita de memória escreve "3,2". Normaliza para
 * ponto, que é como `producoes.jcr` (numeric) grava.
 */
export function validarJcr(bruto: string): Validacao {
  const cru = bruto.trim();
  if (!cru) return ok("");
  const normal = cru.replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(normal)) return erro(cru, MENSAGENS.jcr);
  const n = Number(normal);
  if (!(n > 0)) return erro(cru, MENSAGENS.jcr);
  return ok(String(n));
}

/**
 * Valor em reais (fomento, Q21): aceita "R$ 1.500", "1.234,56", "150000".
 * Ponto de milhar pt-BR e vírgula decimal são traduzidos; a saída é o número
 * em forma canônica (ponto decimal), pronto para `Number()`.
 */
export function validarValorBrl(bruto: string): Validacao {
  const cru = bruto.trim();
  if (!cru) return ok("");
  let s = cru.replace(/R\$|\s/gi, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return erro(cru, MENSAGENS.valorBrl);
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? ok(String(n)) : erro(cru, MENSAGENS.valorBrl);
}

/**
 * As 10 notas Qualis aceitas pelo CHECK da 009 — as duas escalas (a vigente
 * A1..A4/B1..B4/C e o B5 da anterior, que muita gente ainda cita de memória).
 * A tela usa `<select>`, então a validação aqui é a tradução segura do value.
 */
export const QUALIS_OPCOES = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "B5", "C"] as const;
export type QualisOpcao = (typeof QUALIS_OPCOES)[number];

/** Traduz o value de um `<select>` para a união do CHECK; o resto vira null. */
export function qualisOuNull(bruto: string): QualisOpcao | null {
  const v = bruto.trim().toUpperCase();
  return (QUALIS_OPCOES as readonly string[]).includes(v) ? (v as QualisOpcao) : null;
}

/** Q31 — satisfação 1..5 (o CHECK de `ciclo_membros.satisfacao` é o mesmo). */
export function validarSatisfacao(n: number): Validacao {
  return Number.isInteger(n) && n >= 1 && n <= 5 ? ok(String(n)) : erro(String(n), MENSAGENS.satisfacao);
}

// ============================================================ resumo de erros

export type Pendencia = { readonly campo: string; readonly mensagem: string };

/**
 * Monta o resumo de erros do topo da tela (WCAG 3.3.1 / §6.1 item 4), na ordem
 * em que os campos aparecem — a ordem importa porque cada linha vira um link
 * que move o foco.
 */
export function pendenciasDe(campos: ReadonlyArray<readonly [string, Validacao]>): Pendencia[] {
  return campos
    .filter(([, v]) => !v.ok)
    .map(([campo, v]) => ({ campo, mensagem: v.mensagem }));
}
