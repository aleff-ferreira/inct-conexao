/**
 * ============================================================================
 *  IDENTIFICAÇÃO DO PESQUISADOR — a primeira coisa que acontece no
 *  #/relatorio-anual (Relatório Anual de Atividades; #/meu-ano é alias legado)
 * ============================================================================
 *  Antes, a Tela 1 se chamava "Confirme quem é você" e SÓ funcionava para quem
 *  chegasse pelo link do convite: a linha do roster vinha resolvida no clique.
 *  Quem perdeu o e-mail, quem recebeu o link encaminhado por um colega, quem
 *  voltou três semanas depois com o token expirado — todos caíam numa tela de
 *  login que não os reconhecia. Aqui a pessoa se ENCONTRA, numa busca, sem
 *  depender de link nenhum.
 *
 *  AS QUATRO DECISÕES QUE ESTE ARQUIVO CARREGA
 *  -------------------------------------------
 *  1. A LISTA VIAJA NO PACOTE, NÃO VEM DO BANCO. As 209 pessoas da seção EQUIPE
 *     estão em `src/content/relato/equipe.json`, carregado sob demanda (a rota
 *     já é lazy). Tem de ser assim: a pessoa precisa se achar ANTES de ter
 *     sessão, e sem sessão a RLS da migração 005 não devolve uma linha sequer de
 *     `ciclo_membros` — corretamente. Buscar no banco aqui exigiria abrir o
 *     roster ao anônimo, que é o oposto do que a 005 decidiu.
 *
 *  2. POR ISSO O ARQUIVO NÃO TEM E-MAIL. O que a busca mostra é nome,
 *     instituição e UF — o que a proposta submetida já publica. Nenhum dado de
 *     contato entra no pacote do site (a extração conferiu: zero e-mails, zero
 *     telefones, zero CPFs).
 *
 *  3. O PRÓPRIO PESQUISADOR INFORMA O E-MAIL EM QUE QUER RECEBER O LINK.
 *     A proposta não traz o e-mail de ninguém — traz 190 links de Lattes e
 *     nenhum contato. Esperar a coordenação importar 209 endereços seria um
 *     bloqueio ANTES do primeiro disparo. Então: a pessoa se encontra, digita o
 *     e-mail que preferir (institucional ou pessoal), recebe o link mágico ali
 *     mesmo, e no primeiro acesso a linha do roster passa a ser dela.
 *     O risco residual — alguém escolher o nome de outra pessoa — é conhecido e
 *     tratado por três medidas, não por atrito: vínculo de uma vez só (§5),
 *     registro em `relato_eventos` (do lado do banco) e um caminho de desfazer
 *     para a coordenação. Erro visível e reversível é o patamar adequado numa
 *     rede acadêmica fechada onde o formulário não move dinheiro.
 *
 *  4. DEPOIS DA IDENTIFICAÇÃO, O FORMULÁRIO SE PREENCHE. Categoria PICC,
 *     titulação, bolsa, instituição, UF, país, áreas, responsabilidade,
 *     horas/semana e o ID Lattes vêm do catálogo. A pessoa CONFERE, não digita.
 *     O que o catálogo não tem (ORCID, laboratório) continua sendo perguntado.
 *
 *  A BUSCA É PURA E MORA NA METADE DE CIMA DESTE ARQUIVO
 *  ----------------------------------------------------
 *  `normalizar`, `tokenizar`, `construirIndice`, `buscar` e `realcar` não tocam
 *  em React, em rede nem em DOM: são funções de string testadas em
 *  `tests/relato-busca.test.ts`. O componente só desenha o que elas devolvem.
 *
 *  A LIÇÃO DO MAPA, QUE ESTE PROJETO JÁ PAGOU UMA VEZ
 *  --------------------------------------------------
 *  A busca do #/mapa casava por SUBSTRING (`norm(nome).includes(q)`), e com 27
 *  estados isso passa despercebido. Com 209 nomes não passa: "RO" casaria
 *  "PedRO", "CaROlina", "AlessandRO" — e a pessoa que digitou a sigla do seu
 *  estado receberia meia rede. Aqui o casamento é por PREFIXO DE PALAVRA, nunca
 *  no meio dela, e a UF só casa por igualdade exata. É o teste `"ro" não casa
 *  "Pedro"` que trava essa regressão.
 * ============================================================================
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Loader2, Mail, Search, TriangleAlert, UserCheck } from "lucide-react";

import type { AuthState } from "../platform/auth";
import { supabase } from "../platform/supabaseClient";
import { relatoDisponivel, vincularMeuCadastro } from "./api";
import { AvisoDePrivacidade, Porta } from "./Porta";

// =============================================================== 1. O DADO ===

/**
 * Uma pessoa do catálogo. Espelha `src/content/relato/equipe.json` campo a
 * campo, com DUAS folgas em relação ao arquivo:
 *
 *  • `categoriaPicc` e `horasSemana` aceitam `null`. No arquivo os 209 sempre
 *    têm os dois; quem não tem é o coordenador, que a proposta NÃO lista na
 *    seção EQUIPE (ver `EXTRAS`, adiante) e que precisa caber no mesmo tipo.
 *  • `origem` e `notaDeOrigem` não existem no arquivo: são acrescentados no
 *    carregamento para que a tela possa dizer de onde veio cada linha.
 */
export type PessoaDoCatalogo = {
  /** Slug estável do nome ("aldani-braz-carvalho"). Único no catálogo. */
  id: string;
  nome: string;
  /** Uma das 13 categorias do Quadro Geral do PICC. */
  categoriaPicc: string | null;
  titulacao: string | null;
  /** "-" quando não há bolsa; nunca vazio nos 209. */
  bolsa: string;
  instituicaoNome: string;
  instituicaoSigla: string;
  instituicaoDepartamento: string | null;
  uf: string | null;
  pais: string;
  areas: string[];
  areasRaw: string | null;
  horasSemana: number | null;
  responsabilidade: string;
  /** 16 dígitos; preenchido em 189 dos 209. */
  lattesId: string | null;
  lattesUrl: string | null;
  origem: "equipe" | "identificacao";
  /** Explicação visível quando a linha não veio da seção EQUIPE. */
  notaDeOrigem: string | null;
};

type PessoaBruta = Omit<PessoaDoCatalogo, "origem" | "notaDeOrigem" | "categoriaPicc" | "horasSemana"> & {
  categoriaPicc: string;
  horasSemana: number;
};

type EquipeJson = { _meta?: unknown; pessoas: PessoaBruta[] };

/**
 * O COORDENADOR NÃO ESTÁ NA SEÇÃO EQUIPE — e é a lacuna que mais afeta esta
 * tela. Andreimar Martins Soares assina a proposta na folha de IDENTIFICAÇÃO,
 * mas não aparece no quadro da equipe nem no Quadro Geral do PICC (não existe
 * categoria "Coordenador" entre as 13). Ele é o dono do sistema: vai abrir esta
 * busca, digitar o próprio nome e não se achar. Entra aqui, à parte, com o que
 * `src/content/relato/identificacao.json` afirma (instituição executora
 * FIOCRUZ RO, sede LABOGEOPA/UNIR, em Porto Velho) e com `null` em tudo o que
 * nenhuma fonte declara — nada aqui é inferido.
 */
const EXTRAS: readonly PessoaDoCatalogo[] = [
  {
    id: "andreimar-martins-soares",
    nome: "Andreimar Martins Soares",
    categoriaPicc: null,
    titulacao: null,
    // Vazio, não "-": "-" significaria "a proposta registrou que não há bolsa",
    // e a proposta não registrou nada sobre ele. A tela dirá "não declarado".
    bolsa: "",
    instituicaoNome: "Fundação Oswaldo Cruz Rondônia",
    instituicaoSigla: "FIOCRUZ/RO",
    instituicaoDepartamento: null,
    uf: "RO",
    pais: "Brasil",
    areas: [],
    areasRaw: null,
    horasSemana: null,
    responsabilidade: "",
    lattesId: null,
    lattesUrl: null,
    origem: "identificacao",
    notaDeOrigem:
      "Você assina a proposta na folha de IDENTIFICAÇÃO, mas o quadro da EQUIPE não tem linha de coordenação, " +
      "por isso os campos abaixo vêm quase todos vazios. Complete o que faltar na próxima tela.",
  },
];

// ================================================== 2. NORMALIZAÇÃO E TOKENS =

/**
 * Minúsculas, sem acento, sem apóstrofo tipográfico, espaços colapsados.
 *
 * O NFD separa a letra do acento e o intervalo U+0300–U+036F varre a marca:
 * "Gómez" e "Gomez" viram a mesma coisa, e é isso que faz a busca achar as três
 * grafias divergentes do projeto (Estevão/Estevao, Mariúba/Mariuba,
 * Damião/Damiao) sem que ninguém precise saber qual das duas está no arquivo.
 * O apóstrofo curvo (’) de "Sant’Anna" também cai aqui: quem digita no celular
 * quase sempre produz o reto (').
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’ʼ´`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras de uma string, já normalizadas. Pontuação e barras separam. */
export function tokenizar(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Entidades HTML numéricas cruas no dado de origem: a proposta traz
 * "F&#297;sica, Qu&#297;mica" nas áreas de uma pessoa (&#297; é "ĩ"). A extração
 * preservou o defeito VERBATIM, e com razão — consertá-lo é decisão editorial.
 * Na tela, porém, mostrar "F&#297;sica" é mostrar lixo. Decodificamos só as
 * entidades numéricas, que não têm ambiguidade nenhuma.
 */
export function decodificarEntidades(texto: string): string {
  return texto.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (inteiro, corpo: string) => {
    const codigo = corpo[0]?.toLowerCase() === "x" ? parseInt(corpo.slice(1), 16) : parseInt(corpo, 10);
    if (!Number.isFinite(codigo) || codigo < 32 || codigo > 0x10ffff) return inteiro;
    return String.fromCodePoint(codigo);
  });
}

/**
 * Três das 209 responsabilidades guardam uma quebra de linha DIGITADA pelo
 * autor. O PDF não a exibe (o gerador do CNPq a trata como espaço), então
 * mostrá-la partiria a frase num lugar que ninguém escolheu.
 */
export function textoDeUmaLinha(texto: string): string {
  return texto.replace(/\s*\n\s*/g, " ").trim();
}

/** "maria.silva@unir.br" → "m•••@unir.br". Nunca revela o endereço alheio. */
export function mascararEmail(email: string): string {
  const limpo = email.trim();
  const arroba = limpo.lastIndexOf("@");
  if (arroba <= 0) return "•••";
  const inicio = limpo.slice(0, arroba);
  const dominio = limpo.slice(arroba + 1);
  const primeira = [...inicio][0] ?? "";
  return `${primeira}•••@${dominio}`;
}

/** A mesma checagem do `auth.signIn`, feita antes para não gastar um round-trip. */
export function emailPlausivel(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim().toLowerCase());
}

// ======================================================== 3. ÍNDICE E BUSCA =

type EntradaIndice = {
  pessoa: PessoaDoCatalogo;
  /** Nome inteiro normalizado — é sobre ele que os bônus de frase medem. */
  nomeNorm: string;
  tokensNome: string[];
  tokensSigla: string[];
  ufNorm: string | null;
  tokensInstituicao: string[];
  tokensDepartamento: string[];
  tokensAreas: string[];
  tokensCategoria: string[];
  /** Posição original: desempate estável quando pontos e nome empatam. */
  ordem: number;
};

export type IndiceBusca = { entradas: EntradaIndice[] };

export type ItemAchado = { pessoa: PessoaDoCatalogo; pontos: number };

export type ResultadoBusca = {
  /** A consulta normalizada — é o que o realce usa. */
  consulta: string;
  tokens: string[];
  /** Quantos casaram AO TODO (antes do corte). */
  total: number;
  /** Os `limite` primeiros, já ordenados. */
  itens: ItemAchado[];
};

/** Menos que isto não busca: uma letra devolveria meia rede e nada ensinaria. */
export const MIN_CONSULTA = 2;

/** Quantos cabem na lista sem virar rolagem infinita no celular. */
export const LIMITE_PADRAO = 8;

/**
 * Os pesos. Dois princípios, e nenhum número aqui é aleatório:
 *
 *  • IGUALDADE vale muito mais que PREFIXO. Quem digita "UFC" inteiro quer a
 *    UFC, não a UFCG.
 *  • O NOME é o campo que a pessoa está procurando — mas quando ela digita duas
 *    letras que são exatamente uma UF ou uma sigla, é quase certo que ela quis
 *    a UF ou a sigla. Daí `ufIgual` e `siglaIgual` acima de `nomeIgual`; o
 *    desempate real vem dos bônus de frase, que só o nome recebe.
 */
const PESO = {
  ufIgual: 30,
  siglaIgual: 28,
  siglaPrefixo: 14,
  nomeIgual: 24,
  nomePrefixo: 12,
  /** Somado quando o casamento é no PRIMEIRO nome. */
  nomePrimeiro: 6,
  instIgual: 10,
  instPrefixo: 5,
  deptIgual: 6,
  deptPrefixo: 3,
  areaIgual: 4,
  areaPrefixo: 2,
  catIgual: 3,
  catPrefixo: 1,
  /** A consulta inteira é o começo do nome inteiro ("alice ma" → Alice Maria). */
  bonusNomeComeca: 40,
  /** A consulta inteira aparece como palavra dentro do nome. */
  bonusNomeContem: 15,
  /** Todos os termos casaram no nome (e não espalhados por campos diferentes). */
  bonusTudoNoNome: 10,
} as const;

/**
 * O casamento de UM termo contra UMA lista de palavras.
 *
 * A REGRA QUE IMPORTA: `palavra.startsWith(termo)`, NUNCA `palavra.includes`.
 * É a diferença entre "ro" achar Rondônia/Rodrigues e "ro" achar Pedro,
 * Carolina e Alessandro. Prefixo é o que a pessoa está digitando; meio de
 * palavra é coincidência.
 */
function casarTermo(termo: string, palavras: string[], pesoIgual: number, pesoPrefixo: number): number {
  let melhor = 0;
  for (const palavra of palavras) {
    if (palavra === termo) return pesoIgual;
    if (pesoPrefixo > 0 && palavra.startsWith(termo)) melhor = Math.max(melhor, pesoPrefixo);
  }
  return melhor;
}

function pontuar(entrada: EntradaIndice, termos: string[], consulta: string): number {
  let total = 0;
  let todosNoNome = true;

  for (const termo of termos) {
    // A UF só casa por IGUALDADE. Aceitar prefixo faria "r" devolver RO, RR,
    // RJ, RN e RS de uma vez — 5 estados por uma letra.
    let melhor = entrada.ufNorm && entrada.ufNorm === termo ? PESO.ufIgual : 0;
    if (melhor > 0) todosNoNome = false;

    const noNome = (() => {
      let ponto = casarTermo(termo, entrada.tokensNome, PESO.nomeIgual, PESO.nomePrefixo);
      const primeiro = entrada.tokensNome[0];
      if (ponto > 0 && primeiro && (primeiro === termo || primeiro.startsWith(termo))) ponto += PESO.nomePrimeiro;
      return ponto;
    })();
    if (noNome === 0) todosNoNome = false;
    melhor = Math.max(melhor, noNome);

    melhor = Math.max(melhor, casarTermo(termo, entrada.tokensSigla, PESO.siglaIgual, PESO.siglaPrefixo));
    melhor = Math.max(melhor, casarTermo(termo, entrada.tokensInstituicao, PESO.instIgual, PESO.instPrefixo));
    melhor = Math.max(melhor, casarTermo(termo, entrada.tokensDepartamento, PESO.deptIgual, PESO.deptPrefixo));
    melhor = Math.max(melhor, casarTermo(termo, entrada.tokensAreas, PESO.areaIgual, PESO.areaPrefixo));
    melhor = Math.max(melhor, casarTermo(termo, entrada.tokensCategoria, PESO.catIgual, PESO.catPrefixo));

    // E (não OU): um termo sem casamento nenhum elimina a pessoa. É o que faz
    // "alice ufc" devolver uma linha em vez de todas as Alices e toda a UFC.
    if (melhor === 0) return 0;
    total += melhor;
  }

  if (entrada.nomeNorm.startsWith(consulta)) total += PESO.bonusNomeComeca;
  else if (entrada.nomeNorm.includes(` ${consulta}`)) total += PESO.bonusNomeContem;
  if (todosNoNome) total += PESO.bonusTudoNoNome;

  return total;
}

/**
 * Pré-computa tudo o que a busca precisa. Roda UMA vez por carregamento do
 * catálogo; depois cada tecla digitada custa 209 comparações de string curta,
 * que é barato até num celular fraco em 3G.
 */
export function construirIndice(pessoas: readonly PessoaDoCatalogo[]): IndiceBusca {
  return {
    entradas: pessoas.map((pessoa, ordem) => ({
      pessoa,
      nomeNorm: normalizar(pessoa.nome),
      tokensNome: tokenizar(pessoa.nome),
      tokensSigla: tokenizar(pessoa.instituicaoSigla),
      ufNorm: pessoa.uf ? normalizar(pessoa.uf) : null,
      tokensInstituicao: tokenizar(pessoa.instituicaoNome),
      tokensDepartamento: pessoa.instituicaoDepartamento ? tokenizar(pessoa.instituicaoDepartamento) : [],
      tokensAreas: tokenizar(decodificarEntidades(pessoa.areas.join(" "))),
      tokensCategoria: pessoa.categoriaPicc ? tokenizar(pessoa.categoriaPicc) : [],
      ordem,
    })),
  };
}

/** A busca. Determinística: mesma entrada, mesma ordem, sempre. */
export function buscar(
  indice: IndiceBusca,
  consultaBruta: string,
  opcoes: { limite?: number } = {},
): ResultadoBusca {
  const limite = opcoes.limite ?? LIMITE_PADRAO;
  const consulta = normalizar(consultaBruta);
  const termos = tokenizar(consultaBruta);
  if (consulta.length < MIN_CONSULTA || termos.length === 0) {
    return { consulta, tokens: termos, total: 0, itens: [] };
  }

  const achados: Array<ItemAchado & { ordem: number }> = [];
  for (const entrada of indice.entradas) {
    const pontos = pontuar(entrada, termos, consulta);
    if (pontos > 0) achados.push({ pessoa: entrada.pessoa, pontos, ordem: entrada.ordem });
  }

  achados.sort(
    (a, b) =>
      b.pontos - a.pontos ||
      a.pessoa.nome.localeCompare(b.pessoa.nome, "pt-BR") ||
      a.ordem - b.ordem,
  );

  return {
    consulta,
    tokens: termos,
    total: achados.length,
    itens: achados.slice(0, Math.max(0, limite)).map(({ pessoa, pontos }) => ({ pessoa, pontos })),
  };
}

// ============================================================== 4. O REALCE =

export type Segmento = { texto: string; realce: boolean };

/**
 * Mapa caractere-a-caractere entre o texto ORIGINAL (com acento) e o
 * normalizado. Sem ele, realçar "Gomez" em "Gómez" cortaria no lugar errado
 * assim que o NFD mudasse o comprimento da string.
 */
function mapear(texto: string): { norm: string; mapa: number[] } {
  let norm = "";
  const mapa: number[] = [];
  for (let i = 0; i < texto.length; i += 1) {
    const pedaco = (texto[i] as string)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[‘’ʼ´`]/g, "'")
      .toLowerCase();
    for (const c of pedaco) {
      norm += c;
      mapa.push(i);
    }
  }
  return { norm, mapa };
}

const PALAVRA = /[a-z0-9]/;

/**
 * Quebra o texto nos trechos que casaram com a busca. O realce segue a MESMA
 * regra da busca — começo de palavra, nunca meio — senão a lista destacaria
 * pedaços que não foram o motivo de o item estar ali.
 */
export function realcar(texto: string, termos: readonly string[]): Segmento[] {
  if (!texto) return [];
  const limpos = termos.filter(Boolean);
  if (!limpos.length) return [{ texto, realce: false }];

  const { norm, mapa } = mapear(texto);
  const faixas: Array<[number, number]> = [];

  for (const termo of limpos) {
    let de = norm.indexOf(termo);
    while (de !== -1) {
      const anterior = de > 0 ? (norm[de - 1] as string) : "";
      if (!anterior || !PALAVRA.test(anterior)) {
        const ate = de + termo.length - 1;
        const inicio = mapa[de];
        const fim = mapa[Math.min(ate, mapa.length - 1)];
        if (inicio !== undefined && fim !== undefined) faixas.push([inicio, fim + 1]);
      }
      de = norm.indexOf(termo, de + 1);
    }
  }

  if (!faixas.length) return [{ texto, realce: false }];
  faixas.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const unidas: Array<[number, number]> = [];
  for (const faixa of faixas) {
    const ultima = unidas[unidas.length - 1];
    if (ultima && faixa[0] <= ultima[1]) ultima[1] = Math.max(ultima[1], faixa[1]);
    else unidas.push([faixa[0], faixa[1]]);
  }

  const saida: Segmento[] = [];
  let cursor = 0;
  for (const [de, ate] of unidas) {
    if (de > cursor) saida.push({ texto: texto.slice(cursor, de), realce: false });
    saida.push({ texto: texto.slice(de, ate), realce: true });
    cursor = ate;
  }
  if (cursor < texto.length) saida.push({ texto: texto.slice(cursor), realce: false });
  return saida;
}

// =========================================== 5. A REIVINDICAÇÃO (fronteira) =

/**
 * A ÚNICA ida ao banco deste arquivo, e está isolada de propósito: a RPC vive
 * na migração 006, escrita em paralelo. Enquanto ela não existir no projeto, a
 * chamada devolve `indisponivel` e a tela SEGUE — manda o link mágico do mesmo
 * jeito, que é exatamente o comportamento que o formulário já tinha antes desta
 * tela existir. Escriturário nosso não pode barrar pesquisador.
 *
 * CONTRATO REAL DA 006 (o assumido dizia `status`; a migração fechou com
 * `estado`, e mais fino — `interpretarReivindicacao` lê os dois):
 *   reivindicar_cadastro(p_catalogo_id text, p_email text) → jsonb
 *   { "ok": boolean,
 *     "estado": "reivindicado" | "ja_seu" | "ja_vinculado" | "nao_encontrado"
 *             | "ciclo_indisponivel" | "email_invalido" | "email_em_uso",
 *     "mensagem": text, "email_mascarado": text|null }
 *   `reivindicado` e `ja_seu` seguem para o link; `ja_vinculado` abre a tela de
 *   conflito; `email_invalido`/`email_em_uso` mostram a mensagem e PARAM.
 *   • executável por `anon` (a pessoa ainda não tem sessão);
 *   • resolve sozinha o ciclo aberto (sem sessão não se lê `relatorio_ciclos`);
 *   • grava `lower(p_email)` na linha do roster, para que o trigger
 *     `vincular_membro_do_ciclo` (seção 15 da 005) case o `user_id` sozinho no
 *     primeiro acesso;
 *   • recusa a segunda reivindicação da MESMA linha e devolve o e-mail já
 *     vinculado JÁ MASCARADO — mascarar no servidor é o que impede esta tela de
 *     virar um oráculo de endereços alheios;
 *   • registra a tentativa em `relato_eventos`.
 */
export const RPC_REIVINDICAR = "reivindicar_cadastro";

export type ResultadoReivindicacao =
  | { status: "vinculado" }
  | { status: "ja_vinculado"; emailMascarado: string | null }
  | { status: "nao_encontrado" }
  | { status: "ciclo_fechado" }
  /** O servidor recusou COM explicação (e-mail inválido, e-mail já em uso em
   *  outro cadastro). A mensagem vem pronta da RPC, em português, e a tela a
   *  mostra sem enviar o link — enviar aqui mandaria a pessoa para uma conta
   *  que não corresponde ao cadastro que ela escolheu. */
  | { status: "recusado"; mensagem: string }
  /** A RPC não existe (ainda), a plataforma está desligada ou a rede caiu. */
  | { status: "indisponivel"; motivo: string };

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

/**
 * Leitura TOLERANTE da resposta. Tolerante porque o outro lado ainda está sendo
 * escrito: a RPC pode devolver um objeto, uma linha só dentro de um array
 * (`returns table`), ou um `true` seco. O que NÃO é tolerado é inventar
 * sucesso: resposta que não se reconhece vira `indisponivel`, e `indisponivel`
 * nunca impede a pessoa de entrar.
 */
export function interpretarReivindicacao(bruto: unknown): ResultadoReivindicacao {
  if (bruto === true) return { status: "vinculado" };
  const alvo = Array.isArray(bruto) ? bruto[0] : bruto;
  if (!alvo || typeof alvo !== "object") return { status: "indisponivel", motivo: "resposta-vazia" };

  const o = alvo as Record<string, unknown>;
  /* A 006 fechou com o campo `estado` — o contrato assumido aqui dizia
     `status`. Os dois ficam na lista: `estado` primeiro porque é o real. */
  const cru = (texto(o.estado) || texto(o.status) || texto(o.resultado) || texto(o.situacao)).toLowerCase();

  const emailBruto = texto(o.email_mascarado) || texto(o.emailMascarado) || texto(o.email);
  // Se o servidor mandar o endereço inteiro, mascaramos aqui: a tela nunca
  // mostra e-mail de terceiro, venha de onde vier.
  const emailMascarado = emailBruto ? (emailBruto.includes("•") ? emailBruto : mascararEmail(emailBruto)) : null;

  /* `reivindicado` é o sucesso da 006; `ja_seu` é a segunda tentativa da MESMA
     pessoa com o MESMO e-mail — a RPC devolve ok=true de propósito, porque o
     caso real é "não recebi o link", e tratá-lo como conflito mandaria a
     pessoa à coordenação sem motivo. Os dois seguem para o envio do link. */
  if (["reivindicado", "ja_seu", "vinculado", "ok", "criado", "atualizado", "sucesso"].includes(cru))
    return { status: "vinculado" };
  /* `papel_protegido` (estado novo da 013): a linha alvo tem papel de GESTÃO
     (coordenação/CGES) e nunca se reivindica por busca de nome — permitir
     seria escalada de privilégio (qualquer pessoa logada escolheria o nome do
     coordenador e ganharia o painel). O vínculo de gestão nasce SÓ pelo e-mail
     pré-autorizado (trigger da 005 no primeiro login; `vincular_meu_cadastro`
     da 006 para conta existente). No servidor este estado vem ANTES de
     `ja_vinculado`, para linha de gestão nunca devolver e-mail mascarado; aqui
     ele é recusa com explicação: mostrar `mensagem` e NÃO enviar link. */
  if (cru === "papel_protegido") {
    return {
      status: "recusado",
      mensagem:
        texto(o.mensagem) ||
        "Este cadastro é de um papel de gestão (coordenação ou CGES) e não se vincula pela busca de nome. " +
          "Se ele é seu, entre com o e-mail pré-autorizado pela coordenação: o vínculo é automático.",
    };
  }
  if (["ja_vinculado", "já_vinculado", "ocupado", "conflito"].includes(cru))
    return { status: "ja_vinculado", emailMascarado };
  if (["nao_encontrado", "não_encontrado", "inexistente"].includes(cru)) return { status: "nao_encontrado" };
  if (["ciclo_fechado", "ciclo_indisponivel", "fechado", "sem_ciclo"].includes(cru))
    return { status: "ciclo_fechado" };
  /* Recusas com explicação: a RPC manda `mensagem` pronta em português. */
  if (["email_invalido", "email_em_uso"].includes(cru)) {
    return {
      status: "recusado",
      mensagem: texto(o.mensagem) || "O servidor recusou este e-mail. Confira o endereço ou fale com a coordenação.",
    };
  }
  return { status: "indisponivel", motivo: cru || "status-desconhecido" };
}

/** A falha do PostgREST/Postgres traduzida para o mesmo vocabulário. */
export function interpretarFalhaDeReivindicacao(erro: unknown): ResultadoReivindicacao {
  const partes =
    erro && typeof erro === "object"
      ? [texto((erro as Record<string, unknown>).message), texto((erro as Record<string, unknown>).code), texto((erro as Record<string, unknown>).details), texto((erro as Record<string, unknown>).hint)]
      : [texto(erro)];
  const m = partes.join(" · ").toLowerCase();

  // A 006 ainda não rodou: o PostgREST devolve PGRST202 ("could not find the
  // function ... in the schema cache"). Não é erro da pessoa — é obra nossa.
  if (m.includes("pgrst202") || m.includes("could not find the function") || m.includes("schema cache")) {
    return { status: "indisponivel", motivo: "rpc-ausente" };
  }
  if (m.includes("já foi vinculado") || m.includes("ja foi vinculado") || m.includes("ja_vinculado")) {
    return { status: "ja_vinculado", emailMascarado: null };
  }
  if (m.includes("nenhum ciclo") || m.includes("ciclo fechado") || m.includes("fora da janela")) {
    return { status: "ciclo_fechado" };
  }
  return { status: "indisponivel", motivo: m.slice(0, 120) || "falha-desconhecida" };
}

export async function reivindicarCadastro(entrada: {
  catalogoId: string;
  email: string;
}): Promise<ResultadoReivindicacao> {
  if (!relatoDisponivel()) return { status: "indisponivel", motivo: "plataforma-desligada" };
  try {
    const { data, error } = await supabase().rpc(RPC_REIVINDICAR, {
      p_catalogo_id: entrada.catalogoId,
      p_email: entrada.email.trim().toLowerCase(),
    });
    if (error) return interpretarFalhaDeReivindicacao(error);
    return interpretarReivindicacao(data);
  } catch (e) {
    return interpretarFalhaDeReivindicacao(e);
  }
}

// ======================================================= 6. O CATÁLOGO (io) =

export type Catalogo = { pessoas: PessoaDoCatalogo[]; indice: IndiceBusca };

/* Sem `eager`: o equipe.json são ~230 kB de JSON que só quem abre esta tela
   precisa. Mesmo padrão de config.ts e de mapa/content.ts. */
const arquivoEquipe = import.meta.glob<{ default: EquipeJson }>("../content/relato/equipe.json");

/** Ordem alfabética pt-BR: é assim que a pessoa espera se procurar rolando. */
export function montarCatalogo(bruto: EquipeJson): Catalogo {
  const daEquipe: PessoaDoCatalogo[] = (bruto.pessoas ?? []).map((p) => ({
    ...p,
    categoriaPicc: p.categoriaPicc ?? null,
    horasSemana: typeof p.horasSemana === "number" ? p.horasSemana : null,
    areas: Array.isArray(p.areas) ? p.areas : [],
    origem: "equipe",
    notaDeOrigem: null,
  }));
  const pessoas = [...daEquipe, ...EXTRAS].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { pessoas, indice: construirIndice(pessoas) };
}

/**
 * Memoiza a Promise (chamar duas vezes não busca duas vezes), mas NÃO memoiza a
 * rejeição: um chunk que falhou por queda de rede precisa poder ser tentado de
 * novo, senão a tela fica quebrada até o F5.
 */
let promessaCatalogo: Promise<Catalogo> | null = null;

export function carregarCatalogo(): Promise<Catalogo> {
  if (!promessaCatalogo) {
    const entrada = Object.values(arquivoEquipe)[0];
    if (!entrada) return Promise.reject(new Error("A lista da equipe não está neste pacote (equipe.json)."));
    promessaCatalogo = entrada()
      .then((m) => montarCatalogo(m.default))
      .catch((e: unknown) => {
        promessaCatalogo = null;
        throw e;
      });
  }
  return promessaCatalogo;
}

export function pessoaPorId(catalogo: Catalogo | null, id: string | null): PessoaDoCatalogo | null {
  if (!catalogo || !id) return null;
  return catalogo.pessoas.find((p) => p.id === id) ?? null;
}

// ==================================================== 7. A ESCOLHA LEMBRADA =

/**
 * O slug escolhido fica no navegador da própria pessoa, e SÓ ele: nenhum
 * e-mail, nenhum dado de contato. Serve para que, ao voltar pelo link mágico
 * (outra aba, minutos depois), a Tela 1 já saiba quem ela disse ser e possa
 * conferir o pré-preenchimento mesmo que a RPC ainda não tenha vinculado nada.
 */
const CHAVE_ESCOLHA = "inct.relato.catalogo";

export function lembrarEscolha(id: string): void {
  try {
    window.localStorage.setItem(CHAVE_ESCOLHA, id);
  } catch {
    /* modo privado do Safari, cota cheia: seguir sem lembrar é degradação aceitável */
  }
}

export function escolhaLembrada(): string | null {
  try {
    const v = window.localStorage.getItem(CHAVE_ESCOLHA);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function esquecerEscolha(): void {
  try {
    window.localStorage.removeItem(CHAVE_ESCOLHA);
  } catch {
    /* idem */
  }
}

// ========================================================== 8. O COMBOBOX ===

function Realce({ texto: conteudo, termos }: { texto: string; termos: readonly string[] }) {
  const partes = useMemo(() => realcar(conteudo, termos), [conteudo, termos]);
  return (
    <>
      {partes.map((p, i) => (p.realce ? <mark key={i}>{p.texto}</mark> : <span key={i}>{p.texto}</span>))}
    </>
  );
}

/** "Universidade Federal de Rondônia (UNIR) · RO" — o que desambigua homônimos. */
export function linhaDeContexto(p: PessoaDoCatalogo): string {
  const instituicao = p.instituicaoSigla && p.instituicaoSigla !== p.instituicaoNome
    ? `${p.instituicaoNome} (${p.instituicaoSigla})`
    : p.instituicaoNome;
  return [instituicao, p.uf ?? p.pais].filter(Boolean).join(" · ");
}

/**
 * O combobox do padrão ARIA 1.2 — não uma lista solta abaixo de um input.
 *
 * O FOCO DO DOM NUNCA SAI DO INPUT. A opção "focada" é apontada por
 * `aria-activedescendant` e marcada com `aria-selected`; as setas movem essa
 * marca, o Enter escolhe, o Escape fecha. É o que faz a lista existir para quem
 * navega por teclado e para quem usa leitor de tela — e é exatamente o que a
 * busca do #/mapa não fez.
 */
export function BuscaPesquisador({
  catalogo,
  onEscolher,
  autoFoco = false,
  limite = LIMITE_PADRAO,
}: {
  catalogo: Catalogo;
  onEscolher: (pessoa: PessoaDoCatalogo) => void;
  autoFoco?: boolean;
  limite?: number;
}) {
  const base = useId();
  const idCampo = `${base}-campo`;
  const idLista = `${base}-lista`;
  const idDica = `${base}-dica`;
  const opcaoId = (i: number) => `${base}-op-${i}`;

  const [consulta, setConsulta] = useState("");
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);

  const caixa = useRef<HTMLDivElement | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);
  const itemAtivo = useRef<HTMLLIElement | null>(null);

  const resultado = useMemo(() => buscar(catalogo.indice, consulta, { limite }), [catalogo, consulta, limite]);
  const itens = resultado.itens;
  const curta = normalizar(consulta).length > 0 && normalizar(consulta).length < MIN_CONSULTA;
  /* `aria-expanded` tem de dizer a VERDADE: só é `true` quando a lista está
     mesmo no DOM. Anunciar uma lista aberta que não existe é pior do que não
     anunciar nada — o leitor de tela manda procurar o que não está lá. */
  const listaVisivel = aberta && resultado.tokens.length > 0 && !curta;

  useEffect(() => {
    if (autoFoco) campo.current?.focus();
  }, [autoFoco]);

  // A opção ativa tem de estar VISÍVEL: com 8 itens e a lista rolando por
  // dentro, navegar por teclado sem isto move uma marca que ninguém vê.
  useEffect(() => {
    itemAtivo.current?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const escolher = useCallback(
    (pessoa: PessoaDoCatalogo) => {
      setAberta(false);
      setAtivo(-1);
      onEscolher(pessoa);
    },
    [onEscolher],
  );

  const aoDigitar = (valor: string) => {
    setConsulta(valor);
    setAberta(true);
    setAtivo(-1);
  };

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = itens.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!aberta) {
        setAberta(true);
        setAtivo(e.altKey ? -1 : 0);
        return;
      }
      if (n) setAtivo((i) => (i + 1) % n);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!aberta) {
        setAberta(true);
        setAtivo(n ? n - 1 : -1);
        return;
      }
      if (n) setAtivo((i) => (i <= 0 ? n - 1 : i - 1));
      return;
    }
    if (e.key === "Home" && aberta && n) {
      e.preventDefault();
      setAtivo(0);
      return;
    }
    if (e.key === "End" && aberta && n) {
      e.preventDefault();
      setAtivo(n - 1);
      return;
    }
    if (e.key === "Enter") {
      // Um resultado só: o Enter escolhe sem obrigar a descer com a seta.
      const alvo = ativo >= 0 ? itens[ativo] : n === 1 ? itens[0] : undefined;
      if (aberta && alvo) {
        e.preventDefault();
        escolher(alvo.pessoa);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (aberta) {
        setAberta(false);
        setAtivo(-1);
      } else if (consulta) {
        setConsulta("");
      }
      return;
    }
    if (e.key === "Tab") setAberta(false);
  };

  const anuncio = (() => {
    if (curta) return `Digite ao menos ${MIN_CONSULTA} letras.`;
    if (!resultado.tokens.length) return "";
    if (resultado.total === 0) return "Nenhum nome encontrado.";
    if (resultado.total === 1) return "1 pessoa encontrada.";
    if (resultado.total > itens.length)
      return `${resultado.total} pessoas encontradas · mostrando as ${itens.length} primeiras.`;
    return `${resultado.total} pessoas encontradas.`;
  })();

  return (
    <div className="rel-campo">
      <label htmlFor={idCampo}>Comece digitando o seu nome</label>

      {/* .rel-busca é a única âncora posicionada: rótulo e contagem ficam FORA
          dele de propósito — qualquer irmão entre o campo e a lista empurraria
          a lista para longe do input. */}
      <div className="rel-busca" ref={caixa}>
        <input
          id={idCampo}
          ref={campo}
          className="rel-busca-campo"
          type="text"
          role="combobox"
          aria-expanded={listaVisivel}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-describedby={idDica}
          aria-activedescendant={listaVisivel && ativo >= 0 && itens[ativo] ? opcaoId(ativo) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Nome, instituição ou sigla"
          value={consulta}
          onChange={(e) => aoDigitar(e.target.value)}
          onKeyDown={aoTeclar}
          onFocus={() => {
            if (consulta) setAberta(true);
          }}
          onBlur={(e) => {
            if (!caixa.current?.contains(e.relatedTarget as Node | null)) {
              setAberta(false);
              setAtivo(-1);
            }
          }}
        />

        {listaVisivel ? (
          <ul className="rel-busca-lista" id={idLista} role="listbox" aria-label="Pessoas do INCT-CONEXAO">
            {itens.length ? (
              itens.map((item, i) => (
                <li
                  key={item.pessoa.id}
                  id={opcaoId(i)}
                  role="option"
                  aria-selected={i === ativo}
                  className={`rel-busca-opcao${i === ativo ? " is-ativa" : ""}`}
                  ref={i === ativo ? itemAtivo : undefined}
                  // O mousedown roubaria o foco do input e fecharia a lista
                  // antes do clique chegar. Prevenir aqui é o que mantém o
                  // padrão ARIA de pé no mouse.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => escolher(item.pessoa)}
                >
                  <span className="rel-busca-nome">
                    <Realce texto={item.pessoa.nome} termos={resultado.tokens} />
                  </span>
                  <span className="rel-busca-meta">
                    <Realce texto={linhaDeContexto(item.pessoa)} termos={resultado.tokens} />
                  </span>
                </li>
              ))
            ) : (
              <li className="rel-busca-vazio" role="presentation">
                <strong>Nada com “{consulta.trim()}”.</strong>
                <span>
                  Tente o sobrenome, a sigla da instituição (UNIR, UFC, FIOCRUZ) ou a sigla do estado. A lista é a
                  equipe registrada na proposta submetida ao CNPq.
                </span>
              </li>
            )}
          </ul>
        ) : null}
      </div>

      <p className="rel-busca-contagem" aria-live="polite">
        {anuncio}
      </p>

      <small id={idDica} className="rel-dica">
        São {catalogo.pessoas.length} pessoas. Acha por nome, por instituição e por sigla, e não faz diferença
        digitar com ou sem acento.
      </small>
    </div>
  );
}

// ===================================================== 9. O CARTÃO DA PESSOA =

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

const NAO_DECLARADO = "não declarado na proposta";

/**
 * O que o catálogo sabe, para CONFERIR — não para digitar. Aparece duas vezes
 * no fluxo: antes de entrar (quando a pessoa se encontra) e depois de entrar
 * (quando a Tela 1 vira conferência).
 */
export function CartaoDoCatalogo({
  pessoa,
  titulo,
  onTrocar,
  rotuloTrocar = "Não sou eu · escolher outro nome",
  focar = false,
}: {
  pessoa: PessoaDoCatalogo;
  titulo?: string;
  onTrocar?: () => void;
  rotuloTrocar?: string;
  /**
   * Move o foco para o título ao montar. Ligado APENAS quando o cartão nasce de
   * uma escolha na busca: o campo do combobox desaparece nesse instante e, sem
   * isto, o foco do teclado voltaria para o começo do documento — que é o jeito
   * mais rápido de perder quem navega sem mouse bem no meio da identificação.
   */
  focar?: boolean;
}) {
  const cabeca = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (focar) cabeca.current?.focus();
  }, [focar]);

  const instituicaoBase = [
    pessoa.instituicaoNome,
    pessoa.instituicaoSigla ? `(${pessoa.instituicaoSigla})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const instituicao = pessoa.instituicaoDepartamento
    ? `${instituicaoBase}, ${pessoa.instituicaoDepartamento}`
    : instituicaoBase;

  const areas = pessoa.areas.length ? decodificarEntidades(pessoa.areas.join(" · ")) : NAO_DECLARADO;
  const responsabilidade = textoDeUmaLinha(decodificarEntidades(pessoa.responsabilidade));

  return (
    <div className="rel-identificado">
      <h3 ref={cabeca} tabIndex={focar ? -1 : undefined}>
        {titulo ?? pessoa.nome}
      </h3>
      {titulo ? <p>{pessoa.nome}</p> : null}

      {pessoa.origem === "equipe" ? (
        <p>
          Isto veio da EQUIPE da proposta submetida ao CNPq. Confira: você não precisa digitar nada aqui. O que
          estiver errado, a coordenação corrige.
        </p>
      ) : pessoa.notaDeOrigem ? (
        <p>{pessoa.notaDeOrigem}</p>
      ) : null}

      <dl>
        <Linha rotulo="Categoria na proposta" valor={pessoa.categoriaPicc ?? NAO_DECLARADO} />
        <Linha rotulo="Titulação" valor={pessoa.titulacao ?? NAO_DECLARADO} />
        <Linha
          rotulo="Bolsa"
          valor={pessoa.bolsa ? (pessoa.bolsa === "-" ? "sem bolsa registrada na proposta" : pessoa.bolsa) : NAO_DECLARADO}
        />
        <Linha rotulo="Instituição" valor={instituicao || NAO_DECLARADO} />
        <Linha rotulo="Onde" valor={[pessoa.uf, pessoa.pais].filter(Boolean).join(" · ") || NAO_DECLARADO} />
        <Linha
          rotulo="Dedicação declarada"
          valor={pessoa.horasSemana ? `${pessoa.horasSemana} horas por semana` : NAO_DECLARADO}
        />
        <Linha rotulo="Áreas de atuação" valor={areas} />
        <div>
          <dt>ID Lattes</dt>
          <dd>
            {pessoa.lattesId ? (
              pessoa.lattesUrl ? (
                <a href={pessoa.lattesUrl} target="_blank" rel="noreferrer">
                  {pessoa.lattesId}
                </a>
              ) : (
                pessoa.lattesId
              )
            ) : (
              NAO_DECLARADO
            )}
          </dd>
        </div>
      </dl>

      {responsabilidade ? (
        <p>
          <strong>O que você escreveu como sua responsabilidade no projeto:</strong> {responsabilidade}
        </p>
      ) : null}

      {onTrocar ? (
        <button type="button" onClick={onTrocar}>
          {rotuloTrocar}
        </button>
      ) : null}
    </div>
  );
}

// ============================================== 10. A PORTA COM IDENTIFICAÇÃO =

type FaseDaPorta =
  | { nome: "buscando" }
  | { nome: "conferindo"; pessoa: PessoaDoCatalogo }
  | { nome: "conflito"; pessoa: PessoaDoCatalogo; emailMascarado: string | null };

/**
 * A tela de entrada inteira: (1) a pessoa se acha, (2) confere o cartão, (3)
 * diz em que e-mail quer receber, (4) recebe o link e entra.
 *
 * A porta ANTIGA (e-mail + senha, sem catálogo) continua existindo atrás de
 * "não encontrei meu nome": quem já tem conta, quem foi incluído depois pela
 * coordenação e quem simplesmente não está na proposta entram por ela. Nenhum
 * caminho que funcionava ontem deixou de funcionar.
 */
export default function PortaComBusca({
  auth,
  titulo,
  children,
}: {
  auth: AuthState;
  titulo: string;
  children: React.ReactNode;
}) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [falha, setFalha] = useState("");
  const [fase, setFase] = useState<FaseDaPorta>({ nome: "buscando" });
  const [email, setEmail] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [espera, setEspera] = useState(0);
  const [semCatalogo, setSemCatalogo] = useState(false);
  /**
   * "pessoa|email" já reivindicado com sucesso nesta sessão. Sem isto, clicar em
   * "me mande outro link" reivindicaria de novo a MESMA linha com o MESMO
   * endereço — e a segunda chamada, corretamente, responderia "já vinculado".
   * A pessoa veria um conflito consigo mesma por ter pedido um segundo e-mail.
   */
  const jaReivindicado = useRef("");

  useEffect(() => {
    let cancelado = false;
    carregarCatalogo()
      .then((c) => {
        if (!cancelado) setCatalogo(c);
      })
      .catch(() => {
        if (!cancelado) setFalha("Não conseguimos carregar a lista da equipe agora.");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const id = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [espera]);

  // Caminho alternativo: a porta clássica, sem catálogo.
  if (semCatalogo || falha) {
    return (
      <Porta auth={auth} titulo={titulo}>
        {children}
        {falha ? (
          <p className="plat-hint">
            {falha} Você pode entrar pelo e-mail normalmente. Nada do que fizer aqui depende daquela lista.
          </p>
        ) : (
          <p className="plat-hint">
            Sem problema: entre pelo e-mail. Se o seu cadastro não estiver na equipe deste ciclo, a primeira tela vai
            dizer isso e mostrar para quem escrever.
          </p>
        )}
        {!falha ? (
          <button type="button" className="plat-linkbtn" onClick={() => setSemCatalogo(false)}>
            Voltar e procurar meu nome na lista
          </button>
        ) : null}
      </Porta>
    );
  }

  const enviarLink = async (pessoa: PessoaDoCatalogo) => {
    setErro("");
    if (!emailPlausivel(email)) {
      setErro("Informe um e-mail válido: é para lá que o link vai.");
      return;
    }
    setOcupado(true);

    // A escrituração vem ANTES do link, mas nunca no caminho crítico: só um
    // conflito real ("este cadastro já é de outra pessoa") interrompe o envio.
    const chave = `${pessoa.id}|${email.trim().toLowerCase()}`;
    if (jaReivindicado.current !== chave) {
      const r = await reivindicarCadastro({ catalogoId: pessoa.id, email });
      if (r.status === "ja_vinculado") {
        setOcupado(false);
        setFase({ nome: "conflito", pessoa, emailMascarado: r.emailMascarado });
        return;
      }
      if (r.status === "ciclo_fechado") {
        setOcupado(false);
        setErro(
          "A coleta não está aberta neste momento. Quando a coordenação abrir, este mesmo endereço passa a funcionar.",
        );
        return;
      }
      if (r.status === "recusado") {
        // O servidor explicou (e-mail inválido, ou já usado por outro cadastro
        // deste ciclo). Mostrar e parar: enviar o link assim mesmo conectaria a
        // pessoa a uma conta que não corresponde ao cadastro escolhido.
        setOcupado(false);
        setErro(r.mensagem);
        return;
      }
      jaReivindicado.current = chave;
    }

    lembrarEscolha(pessoa.id);
    const { error } = await auth.signIn(email);
    setOcupado(false);
    if (error) {
      setErro(error);
      return;
    }
    setEspera(60);
  };

  return (
    <div className="plat-card rel-porta">
      <h2>{titulo}</h2>
      {children}

      {!catalogo ? (
        <p className="plat-loading">
          <Loader2 size={18} aria-hidden="true" /> Carregando a lista da equipe…
        </p>
      ) : fase.nome === "buscando" ? (
        <>
          <p>
            <strong>Comece por você.</strong> Encontre seu nome na equipe registrada na proposta. O formulário se
            preenche com o que ela já diz sobre você, e aí você só confere.
          </p>
          <BuscaPesquisador
            catalogo={catalogo}
            onEscolher={(pessoa) => {
              setErro("");
              setFase({ nome: "conferindo", pessoa });
            }}
          />
        </>
      ) : fase.nome === "conflito" ? (
        <div className="plat-card plat-notice">
          <TriangleAlert size={22} aria-hidden="true" />
          <div>
            <strong>
              O cadastro de {fase.pessoa.nome} já foi vinculado a {fase.emailMascarado ?? "outro e-mail"}.
            </strong>
            <p>
              Se esse endereço é seu, entre por ele. Se ele se parece com o seu, mas tem um erro de digitação, foi o
              que aconteceu. E se não é seu (se você é {fase.pessoa.nome} e outra pessoa escolheu seu nome),
              escreva para <a href="mailto:inctconexao@gmail.com">inctconexao@gmail.com</a> dizendo qual é o seu nome
              na lista: a coordenação solta o vínculo e você entra em seguida. Nada do que já estiver declarado se
              perde nesse caminho.
            </p>
            <div className="plat-nav rel-nav">
              <button type="button" className="plat-linkbtn" onClick={() => setFase({ nome: "buscando" })}>
                Escolher outro nome
              </button>
              <button type="button" className="button plat-ghost" onClick={() => setSemCatalogo(true)}>
                Entrar por e-mail e senha
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <CartaoDoCatalogo pessoa={fase.pessoa} focar onTrocar={() => setFase({ nome: "buscando" })} />

          {auth.otpSentTo ? (
            <p className="plat-ok">
              <UserCheck size={16} aria-hidden="true" /> Enviamos um link de entrada para{" "}
              <strong>{auth.otpSentTo}</strong>. Abra o e-mail <strong>neste mesmo navegador</strong> e clique no
              link. Ele já cai dentro do formulário, sem tela de senha.
            </p>
          ) : null}

          <form
            className="plat-fields"
            onSubmit={(e) => {
              e.preventDefault();
              void enviarLink(fase.pessoa);
            }}
          >
            <div className="rel-campo">
              <label htmlFor="ident-email">Em que e-mail você quer receber o link de entrada?</label>
              <input
                id="ident-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-describedby="ident-email-dica"
              />
              <small id="ident-email-dica" className="rel-dica">
                <strong>Pode ser o institucional ou o pessoal</strong>, o que você abrir com mais facilidade. A
                proposta não trouxe o e-mail de ninguém, então quem escolhe é você. É por ele que você volta ao
                rascunho depois, e ele fica só no cadastro deste ciclo.
              </small>
            </div>

            {erro ? <p className="plat-error rel-erro">{erro}</p> : null}

            <div className="plat-nav rel-nav">
              <button type="button" className="plat-linkbtn" onClick={() => setFase({ nome: "buscando" })}>
                Não sou eu
              </button>
              <button className="button primary" type="submit" disabled={ocupado || espera > 0}>
                {ocupado
                  ? "Enviando…"
                  : espera > 0
                    ? `Reenviar em ${espera}s`
                    : auth.otpSentTo
                      ? "Me mande outro link"
                      : "Receber meu link de entrada"}{" "}
                <Mail size={15} aria-hidden="true" />
              </button>
            </div>
          </form>
        </>
      )}

      {/* Só na fase da busca: depois que a pessoa se encontrou, oferecer "entre
          assim mesmo" seria oferecer uma saída para um problema que ela já não
          tem. */}
      {catalogo && fase.nome === "buscando" ? (
        <p className="plat-hint">
          <Search size={14} aria-hidden="true" /> Não encontrou seu nome? A lista é a equipe da proposta submetida em
          2024. Quem entrou na rede depois não está nela.{" "}
          <button type="button" className="plat-linkbtn" onClick={() => setSemCatalogo(true)}>
            Entrar pelo e-mail assim mesmo <ArrowRight size={13} aria-hidden="true" />
          </button>
        </p>
      ) : null}

      <AvisoDePrivacidade />
    </div>
  );
}

// ========================== 11. A IDENTIFICAÇÃO COM SESSÃO (nenhum beco) ====

/**
 * A identificação DEPOIS do login — a saída padrão de QUALQUER beco.
 *
 * A pessoa está autenticada, mas nenhuma linha do roster é dela. Antes isso era
 * uma parede ("escreva para a coordenação") em cada tela que dependia do
 * vínculo; aqui ela acha o próprio nome na lista da proposta e o vínculo é
 * feito com o e-mail que ela JÁ autenticou. O vínculo (`ciclo_membros.user_id`)
 * É a identidade da plataforma: feito uma vez, vale em toda tela que pergunte
 * quem a pessoa é — por isso este componente é COMPARTILHADO (formulário
 * individual, formulário do laboratório e painel da coordenação), e não uma
 * cópia por tela.
 *
 * São dois passos no servidor, e os dois precisam acontecer:
 *   1. `reivindicar_cadastro` grava o e-mail da sessão na linha do catálogo;
 *   2. `vincular_meu_cadastro` casa essa linha com o `user_id`.
 * O passo 2 existe porque o trigger de primeiro acesso só dispara em INSERT de
 * `auth.users` — e esta pessoa já tinha conta, senão não estaria logada aqui.
 *
 * O QUE ESTE COMPONENTE RECUSA, DE PROPÓSITO: linha com papel de gestão
 * (coordenação/CGES) devolve `papel_protegido` na 013 e aparece aqui como
 * recusa com a mensagem da RPC, sem drama e sem link — gestão se vincula pelo
 * e-mail pré-autorizado, nunca pela busca de nome (ver
 * `interpretarReivindicacao`).
 */
export function IdentificacaoComSessao({
  emailDaSessao,
  onVinculado,
}: {
  emailDaSessao: string;
  onVinculado: () => void;
}) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [escolhida, setEscolhida] = useState<PessoaDoCatalogo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [conflito, setConflito] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    carregarCatalogo()
      .then((c) => vivo && setCatalogo(c))
      .catch(() => vivo && setErro("Não foi possível carregar a lista da equipe. Recarregue a página."));
    return () => {
      vivo = false;
    };
  }, []);

  const confirmar = async (pessoa: PessoaDoCatalogo) => {
    setErro("");
    setConflito(null);
    setOcupado(true);
    const r = await reivindicarCadastro({ catalogoId: pessoa.id, email: emailDaSessao });
    if (r.status === "ja_vinculado") {
      setOcupado(false);
      setConflito(r.emailMascarado ?? "outro endereço");
      return;
    }
    if (r.status === "recusado") {
      // Inclui o `papel_protegido` da 013: a RPC explica, a tela mostra, nada
      // foi gravado e nenhum link é enviado.
      setOcupado(false);
      setErro(r.mensagem);
      return;
    }
    if (r.status === "nao_encontrado") {
      setOcupado(false);
      setErro(
        "Este nome está na lista da proposta, mas ainda não foi cadastrado neste ciclo pela coordenação. " +
          "Escreva para inctconexao@gmail.com informando o nome e o e-mail que você usou aqui.",
      );
      return;
    }
    if (r.status === "indisponivel") {
      // Antes, "indisponivel" seguia para `vincularMeuCadastro` (que devolve 0
      // sem lançar) e o recarregamento devolvia a pessoa a ESTA mesma tela:
      // "Sou eu, continuar" piscava e voltava, em loop mudo. Falha de
      // infraestrutura (RPC ausente, rede) vira aviso com caminho.
      setOcupado(false);
      setErro(
        "Não conseguimos completar o vínculo agora. Tente de novo em instantes; se continuar assim, escreva para " +
          "inctconexao@gmail.com. Nada do que você escolheu se perde.",
      );
      return;
    }
    // "vinculado" segue: a segunda chamada é quem fecha o vínculo, e ela é
    // idempotente. Se nada casar, o chamador recarrega e a pessoa volta a esta
    // mesma tela — sem perder o que escolheu.
    lembrarEscolha(pessoa.id);
    await vincularMeuCadastro();
    setOcupado(false);
    onVinculado();
  };

  return (
    <div className="plat-card rel-porta">
      <h2>Falta identificar você na equipe</h2>
      <p>
        Você entrou como <strong>{emailDaSessao || "sua conta"}</strong>, mas este endereço ainda não está ligado a
        nenhum nome da equipe registrada na proposta. Encontre-se na lista abaixo: é uma vez só, e a identificação
        vale para a <strong>plataforma inteira</strong> (formulários do relato, adesões e tudo o que perguntar quem
        você é).
      </p>

      {conflito ? (
        <div className="plat-notice rel-erro">
          <TriangleAlert size={18} aria-hidden="true" />
          <div>
            <strong>Este nome já foi vinculado a {conflito}</strong>
            <p>
              Se esse endereço é seu, saia e entre com ele. Se não for, escolha outro nome, ou escreva para{" "}
              <a href="mailto:inctconexao@gmail.com">inctconexao@gmail.com</a>, que o pedido ficou registrado.
            </p>
          </div>
        </div>
      ) : null}
      {erro ? <p className="plat-error rel-erro">{erro}</p> : null}

      {!catalogo ? (
        <p className="plat-loading">
          <Loader2 size={18} aria-hidden="true" /> Carregando a lista da equipe…
        </p>
      ) : escolhida ? (
        <>
          <CartaoDoCatalogo
            pessoa={escolhida}
            focar
            onTrocar={() => {
              setEscolhida(null);
              setConflito(null);
              setErro("");
            }}
          />
          <div className="plat-nav rel-nav">
            <button type="button" className="plat-linkbtn" onClick={() => setEscolhida(null)}>
              Não sou eu
            </button>
            <button className="button primary" disabled={ocupado} onClick={() => void confirmar(escolhida)}>
              {ocupado ? "Vinculando…" : "Sou eu, continuar"} <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <BuscaPesquisador catalogo={catalogo} autoFoco onEscolher={setEscolhida} />
      )}

      <p className="rel-dica">
        Não está na lista? A equipe vem da proposta submetida ao CNPq. Escreva para{" "}
        <a href="mailto:inctconexao@gmail.com">inctconexao@gmail.com</a> informando o nome e este e-mail. Nada do que
        você escrever depois se perde.
      </p>
    </div>
  );
}
